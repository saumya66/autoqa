"""
Test Generator Agent

Takes text-based test cases and converts them into executable JSON format
that can be run by the OrchestratorAgent.

Key Design Principles:
1. Tests are chained - each test ends at a state where the next test can begin
2. First test always starts from the app's home/landing page
3. Each test includes navigation and setup steps to reach the required state
4. Each test includes cleanup/reset steps to return to a known state
"""

from typing import Any, Optional, List
from .base_agent import BaseAgent


class TestGeneratorAgent(BaseAgent):
    """
    Agent that converts human-readable test cases into executable JSON steps
    for visual QA automation of mobile/web apps.
    
    Input: Test case with natural language steps
    Output: JSON test steps compatible with OrchestratorAgent
    """
    
    @property
    def system_prompt(self) -> str:
        return """You are an expert QA automation engineer specializing in visual UI testing for mobile and web applications.

Your job is to convert human-readable test cases into executable JSON format that an AI visual agent can run.

## KEY PRINCIPLES

1. **STATE MANAGEMENT**: 
   - The first test in a sequence ALWAYS starts from the app's HOME/LANDING page
   - Each test must begin with SETUP STEPS to navigate from the starting state to the required precondition state
   - Each test must end with CLEANUP STEPS to return to a KNOWN STATE (usually the page where the next test will begin)
   
2. **NATURAL FLOW**:
   - Tests are executed in sequence
   - The ending state of Test N becomes the starting state of Test N+1
   - Include navigation steps (back button, home button, menu navigation) as needed

3. **VISUAL TARGETING**:
   - Describe UI elements clearly for visual identification
   - Use exact text labels when visible (e.g., "Button labeled 'Add to Bag'")
   - Use visual descriptions for icons (e.g., "Cart icon in top-right corner", "Back arrow in header")
   - Be specific about location when multiple similar elements exist

4. **VERIFICATION**:
   - Include verification after each critical action
   - Verify visual changes (toast messages, screen transitions, count updates)
   - Use verifiable, observable criteria

## ACTION TYPES

- **navigate**: Go to a specific screen/page (use for setup navigation)
- **click/tap**: Tap on a UI element
- **type**: Enter text into an input field
- **scroll**: Scroll in a direction (up, down, left, right)
- **swipe**: Swipe gesture for carousels, etc.
- **wait**: Wait for an element or condition
- **verify**: Check that something is visible/present
- **back**: Press the back button/gesture

## OUTPUT FORMAT

Respond ONLY with valid JSON:
{
  "test_id": "TC-001",
  "title": "Test title",
  "starting_state": "Description of where the app should be when test starts",
  "ending_state": "Description of where the app will be when test ends",
  "setup_steps": [
    // Steps to navigate FROM starting_state TO precondition state
  ],
  "test_steps": [
    // The actual test steps
  ],
  "cleanup_steps": [
    // Steps to return to a known state for the next test
  ],
  "success_criteria": "What defines success for this test",
  "estimated_duration_seconds": 30
}

## STEP FORMAT

Each step (in setup_steps, test_steps, or cleanup_steps) should have:
{
  "step_number": 1,
  "action": "click",
  "target": "Exact visual description of the element",
  "value": "optional - for type actions or scroll direction",
  "verification": "What to verify after this action",
  "note": "optional - context for the AI agent"
}

## EXAMPLE

For a test "Verify user can add product to bag from product listing":

{
  "test_id": "TC-003",
  "title": "Verify user can add product to bag from product listing",
  "starting_state": "App home page",
  "ending_state": "Product listing page with item added to bag",
  "setup_steps": [
    {
      "step_number": 1,
      "action": "click",
      "target": "Category tab or menu item to reach product listing",
      "verification": "Product listing page loads with products visible"
    }
  ],
  "test_steps": [
    {
      "step_number": 1,
      "action": "scroll",
      "target": "Product listing area",
      "value": "down",
      "verification": "More products become visible"
    },
    {
      "step_number": 2,
      "action": "click",
      "target": "Floating 'Add' button on any visible product card",
      "verification": "Success feedback (toast message, animation, or bag count increase)"
    },
    {
      "step_number": 3,
      "action": "verify",
      "target": "Bag/Cart icon in header",
      "verification": "Bag count shows '1' or incremented number"
    }
  ],
  "cleanup_steps": [
    {
      "step_number": 1,
      "action": "back",
      "target": "Back button or back gesture",
      "verification": "Returns to previous screen",
      "note": "Optional - only if next test needs a different starting page"
    }
  ],
  "success_criteria": "Product successfully added to bag, bag count updated",
  "estimated_duration_seconds": 25
}

Be practical and focused. Mobile apps often have: bottom navigation bars, header with back/menu buttons, floating action buttons, toast notifications."""

    def parse_response(self, response_text: str) -> Any:
        """Parse the JSON response from Gemini."""
        return self.extract_json(response_text)
    
    def convert_test_case(
        self, 
        test_case: dict, 
        ui_context: str = "",
        previous_ending_state: str = "App home page",
        is_first_test: bool = False
    ) -> Optional[dict]:
        """
        Convert a single test case to executable JSON format.
        
        Args:
            test_case: A test case dict with id, title, steps, expected_result.
            ui_context: Optional UI context to help with element targeting.
            previous_ending_state: Where the previous test ended (for chaining).
            is_first_test: If True, this test starts from home page.
        
        Returns:
            Executable test case dict or None if conversion failed.
        """
        starting_state = "App home page" if is_first_test else previous_ending_state
        
        prompt = f"""Convert this test case into executable JSON steps.

## CONTEXT
- Starting State: {starting_state}
- This is {"the FIRST test - MUST start from app home page" if is_first_test else "a SUBSEQUENT test - starts where the previous test ended"}

## TEST CASE
ID: {test_case.get('id', 'TC-???')}
Title: {test_case.get('title', test_case.get('name', 'Unknown'))}
Category: {test_case.get('category', 'functional')}
Priority: {test_case.get('priority', 'medium')}

Preconditions:
{chr(10).join(['- ' + p for p in test_case.get('preconditions', [])])}

Steps:
{chr(10).join([f'{i+1}. {s}' for i, s in enumerate(test_case.get('steps', []))])}

Expected Result: {test_case.get('expected_result', 'Test passes')}
"""
        
        if ui_context:
            prompt += f"""
## UI CONTEXT (elements available in the app)
{ui_context}

Use these element descriptions for accurate targeting."""

        prompt += """

## IMPORTANT
1. Include SETUP STEPS to navigate from the starting state to where the test begins
2. Include CLEANUP STEPS if the test modifies app state (like adding items to bag)
3. Specify the ENDING STATE clearly so the next test knows where it starts
4. Use exact visual descriptions for targets"""

        try:
            response = self.call_llm(
                user_prompt=prompt,
                max_tokens=3000
            )
            result = self.parse_response(response)
            
            # Ensure required fields
            if result:
                result["test_id"] = test_case.get("id", result.get("test_id", "TC-???"))
                if "ending_state" not in result:
                    result["ending_state"] = "Unknown state"
                if "starting_state" not in result:
                    result["starting_state"] = starting_state
                    
            return result
        except Exception as e:
            print(f"[TestGeneratorAgent] Error converting test case: {e}")
            return None
    
    def convert_all_test_cases(
        self, 
        test_cases: List[dict], 
        ui_context: str = ""
    ) -> List[dict]:
        """
        Convert multiple test cases to executable format with proper chaining.
        
        Tests are converted in sequence, with each test's ending state
        becoming the next test's starting state.
        
        Args:
            test_cases: List of test case dicts.
            ui_context: Optional UI context for element targeting.
        
        Returns:
            List of executable test case dicts.
        """
        executable_tests = []
        previous_ending_state = "App home page"
        
        for i, tc in enumerate(test_cases):
            is_first = (i == 0)
            test_id = tc.get('id', f'TC-{i+1:03d}')
            test_title = tc.get('title', tc.get('name', 'Unknown'))
            
            print(f"[TestGeneratorAgent] Converting [{i+1}/{len(test_cases)}]: {test_id} - {test_title}")
            print(f"  Starting from: {previous_ending_state}")
            
            executable = self.convert_test_case(
                tc, 
                ui_context, 
                previous_ending_state,
                is_first
            )
            
            if executable:
                executable_tests.append(executable)
                # Update state for next test
                previous_ending_state = executable.get("ending_state", "Unknown state")
                print(f"  Ending at: {previous_ending_state}")
            else:
                # Include failed conversion with error marker
                executable_tests.append({
                    "test_id": test_id,
                    "title": test_title,
                    "error": "Failed to convert to executable format",
                    "original": tc,
                    "starting_state": previous_ending_state,
                    "ending_state": previous_ending_state  # Assume no change
                })
        
        return executable_tests
    
    def generate_test_suite_summary(self, executable_tests: List[dict]) -> dict:
        """
        Generate a summary of the test suite for documentation.
        
        Args:
            executable_tests: List of converted executable tests.
        
        Returns:
            Summary dict with test flow and statistics.
        """
        total_steps = 0
        total_duration = 0
        test_flow = []
        
        for test in executable_tests:
            if "error" in test:
                test_flow.append({
                    "test_id": test.get("test_id"),
                    "status": "conversion_failed"
                })
                continue
            
            setup_steps = len(test.get("setup_steps", []))
            test_steps = len(test.get("test_steps", []))
            cleanup_steps = len(test.get("cleanup_steps", []))
            step_count = setup_steps + test_steps + cleanup_steps
            duration = test.get("estimated_duration_seconds", 30)
            
            total_steps += step_count
            total_duration += duration
            
            test_flow.append({
                "test_id": test.get("test_id"),
                "title": test.get("title"),
                "starting_state": test.get("starting_state"),
                "ending_state": test.get("ending_state"),
                "step_count": step_count,
                "estimated_seconds": duration
            })
        
        return {
            "total_tests": len(executable_tests),
            "total_steps": total_steps,
            "estimated_total_seconds": total_duration,
            "estimated_total_minutes": round(total_duration / 60, 1),
            "test_flow": test_flow
        }