"""
Orchestrator Agent

A reactive agent that observes the screen, decides on the next action,
executes it, and loops until the goal is achieved.

Unlike the PlannerAgent which creates a static plan upfront, the Orchestrator
adapts to screen changes in real-time.
"""

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from agents.base_agent import BaseAgent


class ActionType(str, Enum):
    """Types of actions the orchestrator can take."""
    CLICK = "click"
    TYPE = "type"
    SCROLL = "scroll"
    WAIT = "wait"
    DONE = "done"  # Goal is complete
    STUCK = "stuck"  # Can't proceed


@dataclass
class OrchestratorDecision:
    """Decision made by the orchestrator for the current step."""
    action: ActionType
    target: Optional[str] = None  # Element to interact with
    value: Optional[str] = None   # Text to type, scroll direction, etc.
    reasoning: str = ""           # Why this action was chosen
    goal_complete: bool = False   # Is the overall goal achieved?
    current_state: str = ""       # Description of current screen
    confidence: str = "medium"    # high, medium, low
    learning: Optional[str] = None  # What agent learned/observed (for memory)
    
    def to_dict(self) -> dict:
        return {
            "action": self.action.value,
            "target": self.target,
            "value": self.value,
            "reasoning": self.reasoning,
            "goal_complete": self.goal_complete,
            "current_state": self.current_state,
            "confidence": self.confidence,
            "learning": self.learning
        }


@dataclass
class StepLog:
    """Log entry for a single step."""
    step_number: int
    current_state: str
    action: str
    target: Optional[str]
    value: Optional[str]
    reasoning: str
    success: bool
    coordinates: Optional[tuple[int, int]] = None
    error: Optional[str] = None


@dataclass
class OrchestratorResult:
    """Final result of the orchestrator run."""
    goal: str
    success: bool
    steps_taken: int
    max_steps: int
    final_state: str
    steps: list[StepLog] = field(default_factory=list)
    error: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "goal": self.goal,
            "success": self.success,
            "steps_taken": self.steps_taken,
            "max_steps": self.max_steps,
            "final_state": self.final_state,
            "steps": [
                {
                    "step": s.step_number,
                    "state": s.current_state,
                    "action": s.action,
                    "target": s.target,
                    "value": s.value,
                    "reasoning": s.reasoning,
                    "success": s.success,
                    "coordinates": list(s.coordinates) if s.coordinates else None,
                    "error": s.error
                }
                for s in self.steps
            ],
            "error": self.error
        }


class OrchestratorAgent(BaseAgent):
    """
    Reactive orchestrator that adapts to screen changes.
    
    Unlike static planning, the orchestrator:
    1. Observes the current screen
    2. Decides on ONE action based on the goal
    3. Executes that action
    4. Observes the new screen
    5. Repeats until goal is achieved
    
    This allows it to handle:
    - Page navigations
    - Modal dialogs
    - Loading states
    - Unexpected UI changes
    
    Usage:
        orchestrator = OrchestratorAgent()
        decision = orchestrator.analyze_and_decide(
            screenshot_bytes=screenshot,
            goal="Send a message to John saying hello",
            previous_actions=["clicked on search", "typed John"]
        )
    """
    
    @property
    def system_prompt(self) -> str:
        return """You are an intelligent UI Automation Orchestrator. You can see a screenshot of an application and must decide what to do next to achieve a goal.

For each screenshot, you must:
1. Describe what you currently see (current_state)
2. CHECK if the current context matches what's needed for the goal
3. Decide if the goal is already complete (goal_complete)
4. Note any important observation in "learning" (what you found or didn't find)
5. If not complete, decide the next single action to take

RESPOND WITH ONLY A JSON OBJECT (no markdown):

{
  "current_state": "Brief description of what's on screen",
  "goal_complete": false,
  "action": "click|type|scroll|wait|done|stuck",
  "target": "description of element to interact with",
  "value": "text to type OR scroll direction OR wait seconds",
  "reasoning": "Why this action helps achieve the goal",
  "confidence": "high|medium|low",
  "learning": "Important observation: what you found or did NOT find on this screen"
}

ACTION TYPES:
- click: Click on an element. Specify target.
- type: Type text. Specify target (input field) and value (text to type).
- scroll: Scroll the page. Specify target (area) and value (up/down/left/right).
- wait: Wait for something to load. Specify value (seconds, default 1).
- done: Goal is complete! Set goal_complete to true.
- stuck: Cannot proceed. Explain in reasoning.

CRITICAL RULES:
1. ALWAYS verify you're in the RIGHT CONTEXT before acting!
   - If goal says "message John" but you see "Chat with Mike", you MUST navigate to John first!
   - If goal says "open settings" but you're on home page, navigate to settings first!
   - NEVER type or interact until you've confirmed you're in the correct place!

2. NAVIGATION FIRST: Common navigation actions:
   - Search: Click search bar/icon, type the name/query
   - Sidebar: Click on items in sidebar/menu to navigate
   - Back: Click back button if you're in wrong place
   
3. Take ONE action at a time
4. Before typing in an input, click it first to focus
5. If you see a loading indicator, use "wait"
6. Be VERY specific about which element to target

7. LOOP DETECTION - CRITICAL:
   - Check your action history! If you see SIMILAR actions repeated:
     * STOP doing the same thing!
     * The goal likely requires moving to the NEXT step
     * Look for NAVIGATION elements (icons in header/footer)
   - Don't keep clicking action buttons hoping for different results!

8. ICONS ARE IMPORTANT - Look for visual elements, not just text:
   - Apps use ICONS for navigation (home, search, profile, cart, settings, back arrow)
   - Icons are usually in: TOP header bar, BOTTOM navigation bar, or floating buttons
   - Common icons: 🏠 Home, 🔍 Search, 👤 Profile, 🛒 Cart/Bag, ⚙️ Settings, ← Back, ☰ Menu
   - When looking for navigation, describe the ICON: "bag icon in top right", "home icon in bottom nav"

9. RESET STRATEGY - If completely stuck:
   - If nothing makes sense or you're going in circles:
     * Click BACK button or arrow to go back one screen
     * Or click HOME icon to go to home screen
     * Then START FRESH with a new approach
   - Don't keep trying the same failed path!
   - Think: "What would a human do if they were lost in this app?"

10. SCROLLING - VERY IMPORTANT:
   - For scroll target, ALWAYS specify "center of the screen" or "center of the scrollable content area"
   - WRONG targets for scroll: "document", "page", "screen" (too vague, may hit wrong area)
   - RIGHT targets for scroll: "center of the main content area", "middle of the product list"
   - When looking for something (like a button), scroll to reveal MORE content
   - If you scrolled once and didn't find what you need, SCROLL AGAIN!
   - Keep scrolling until you see NEW content or reach the end (no new content appears)
   - Don't give up after one scroll - the element might be further down/up
   - EXAMPLE: Looking for "Logout" button:
     * Scroll down on "center of the screen" → see "Settings, Help" but no Logout → scroll MORE
     * Scroll down again → see "About, Privacy" but no Logout → scroll MORE  
     * Scroll down again → see same content as before → reached bottom, try elsewhere

8. MEMORY - Use your action history:
   - Check "Previous steps" to see what you already tried
   - DON'T repeat failed paths! If you went into Settings and didn't find Logout, don't go to Settings again
   - If something wasn't found in a section, note it and try a different approach

EXAMPLE - Goal: "Message John hello"
- If current screen shows "Chat with Mike": 
  WRONG: Click input field and type "hello" (wrong person!)
  RIGHT: Click search icon to find John first
  
- If current screen shows "Chat with John":
  RIGHT: Now click input field, then type "hello", then send

EXAMPLE - Goal: "Find Logout button"
- Scrolled once, saw "Profile, Orders, Wishlist" but no Logout:
  WRONG: Give up or click something random
  RIGHT: Scroll down MORE to reveal more options
  
- Went into Settings, didn't find Logout, came back:
  WRONG: Click Settings again
  RIGHT: Try scrolling on main page or look for different menu"""

    def parse_response(self, response_text: str) -> Optional[OrchestratorDecision]:
        """Parse Gemini's response into an OrchestratorDecision."""
        data = self.extract_json(response_text)
        
        if data is None or not isinstance(data, dict):
            return None
        
        try:
            action_str = data.get("action", "stuck")
            action = ActionType(action_str)
        except ValueError:
            action = ActionType.STUCK
        
        return OrchestratorDecision(
            action=action,
            target=data.get("target"),
            value=data.get("value"),
            reasoning=data.get("reasoning", ""),
            goal_complete=data.get("goal_complete", False),
            current_state=data.get("current_state", "Unknown"),
            confidence=data.get("confidence", "medium"),
            learning=data.get("learning")
        )
    
    def analyze_and_decide(
        self,
        screenshot_bytes: bytes,
        goal: str,
        previous_actions: list[str] = None
    ) -> OrchestratorDecision:
        """
        Analyze the current screen and decide on the next action.
        
        Args:
            screenshot_bytes: Current screenshot of the window.
            goal: The overall goal to achieve.
            previous_actions: List of actions already taken (for context).
            
        Returns:
            OrchestratorDecision with the next action to take.
        """
        # Build the prompt with context
        previous_context = ""
        if previous_actions:
            actions_str = "\n".join([f"  {i+1}. {a}" for i, a in enumerate(previous_actions)])
            previous_context = f"\n\nActions already taken:\n{actions_str}\n"
        
        user_prompt = f"""GOAL: {goal}
{previous_context}
Look at the current screenshot and decide the NEXT SINGLE ACTION to take."""

        response_text = self.call_gemini(
            user_prompt=user_prompt,
            image_bytes=screenshot_bytes,
            max_tokens=512
        )
        
        print(f"OrchestratorAgent response: {response_text}")
        
        decision = self.parse_response(response_text)
        
        if decision is None:
            return OrchestratorDecision(
                action=ActionType.STUCK,
                reasoning="Failed to parse orchestrator response",
                current_state="Unknown"
            )
        
        return decision
    
    def is_terminal_state(self, decision: OrchestratorDecision) -> bool:
        """Check if we should stop the loop."""
        return (
            decision.goal_complete or
            decision.action == ActionType.DONE or
            decision.action == ActionType.STUCK
        )
