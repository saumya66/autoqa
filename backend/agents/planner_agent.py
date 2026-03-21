"""
Planner Agent

Responsible for breaking down complex instructions into actionable steps.
Each step is a simple action (click, type, scroll) that can be executed.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from agents.base_agent import BaseAgent


class ActionType(str, Enum):
    """Types of actions the agent can perform."""
    CLICK = "click"
    TYPE = "type"
    SCROLL = "scroll"
    WAIT = "wait"


@dataclass
class PlannedAction:
    """A single action in the execution plan."""
    action: ActionType
    target: str  # Description of what to interact with
    value: Optional[str] = None  # Text to type, scroll direction, etc.
    
    def to_dict(self) -> dict:
        return {
            "action": self.action.value,
            "target": self.target,
            "value": self.value
        }
    
    @staticmethod
    def from_dict(data: dict) -> "PlannedAction":
        return PlannedAction(
            action=ActionType(data.get("action", "click")),
            target=data.get("target", ""),
            value=data.get("value")
        )


@dataclass
class ExecutionPlan:
    """A plan consisting of multiple actions to achieve a goal."""
    goal: str
    steps: list[PlannedAction]
    reasoning: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "goal": self.goal,
            "steps": [step.to_dict() for step in self.steps],
            "reasoning": self.reasoning
        }


class PlannerAgent(BaseAgent):
    """
    Agent for breaking down complex instructions into simple action steps.
    
    Given a high-level instruction like "Login with username X and password Y",
    creates a step-by-step plan of click/type/scroll actions.
    
    Usage:
        agent = PlannerAgent()
        plan = agent.create_plan("Login with username 'test' and password 'secret'")
        for step in plan.steps:
            print(f"{step.action}: {step.target}")
    """
    
    @property
    def system_prompt(self) -> str:
        return """You are a GUI Automation Planner Agent.
Your job is to break down complex user instructions into simple, sequential action steps.

Each step must be ONE of these actions:
- click: Click on a UI element
- type: Type text (always click the input field first!)
- scroll: Scroll up/down/left/right
- wait: Wait for something to load

IMPORTANT RULES:
1. Before typing, ALWAYS click the input field first
2. Keep steps atomic and simple
3. Each step should target ONE specific UI element
4. Be specific about what element to interact with

Return ONLY a JSON array with no markdown formatting:

[
  {"action": "click", "target": "description of element to click"},
  {"action": "type", "target": "description of input field", "value": "text to type"},
  {"action": "click", "target": "description of button to click"}
]

Valid actions: click, type, scroll, wait
For scroll, use value: "up", "down", "left", or "right"
For wait, use value as seconds: "2" (optional, defaults to 1 second)"""
    
    def parse_response(self, response_text: str) -> Optional[list[PlannedAction]]:
        """Parse Gemini's response into a list of PlannedActions."""
        data = self.extract_json(response_text)
        
        if data is None:
            return None
        
        # Handle if it's wrapped in an object
        if isinstance(data, dict):
            if "steps" in data:
                data = data["steps"]
            else:
                return None
        
        if not isinstance(data, list):
            return None
        
        actions = []
        for item in data:
            if isinstance(item, dict):
                try:
                    action = PlannedAction.from_dict(item)
                    actions.append(action)
                except (ValueError, KeyError):
                    continue
        
        return actions if actions else None
    
    def create_plan(
        self,
        instruction: str,
        context: Optional[str] = None
    ) -> Optional[ExecutionPlan]:
        """
        Create an execution plan for a complex instruction.
        
        Args:
            instruction: The high-level instruction to break down.
            context: Optional context about the current UI state.
            
        Returns:
            ExecutionPlan with steps, or None if planning failed.
        """
        user_prompt = f'Break down this instruction into steps: "{instruction}"'
        
        if context:
            user_prompt += f"\n\nCurrent UI context: {context}"
        
        response_text = self.call_llm(
            user_prompt=user_prompt,
            max_tokens=1024
        )
        
        print(f"PlannerAgent response: {response_text}")
        
        steps = self.parse_response(response_text)
        
        if not steps:
            return None
        
        return ExecutionPlan(
            goal=instruction,
            steps=steps
        )
    
    def create_plan_with_screenshot(
        self,
        instruction: str,
        screenshot_bytes: bytes
    ) -> Optional[ExecutionPlan]:
        """
        Create an execution plan using the current screenshot for context.
        
        This is more accurate as the planner can see what's on screen.
        
        Args:
            instruction: The high-level instruction to break down.
            screenshot_bytes: Current screenshot of the target window.
            
        Returns:
            ExecutionPlan with steps, or None if planning failed.
        """
        user_prompt = f"""Look at this screenshot and break down this instruction into steps:
"{instruction}"

Based on what you see in the UI, create a plan to accomplish this task."""
        
        response_text = self.call_llm(
            user_prompt=user_prompt,
            image_bytes=screenshot_bytes,
            max_tokens=1024
        )
        
        print(f"PlannerAgent (with screenshot) response: {response_text}")
        
        steps = self.parse_response(response_text)
        
        if not steps:
            return None
        
        return ExecutionPlan(
            goal=instruction,
            steps=steps
        )
