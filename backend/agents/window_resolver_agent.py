"""
Window Resolver Agent

Intelligently determines which window the user wants to interact with
based on their instruction and the list of available windows.
"""

from dataclasses import dataclass
from typing import Optional

from agents.base_agent import BaseAgent


@dataclass
class WindowMatch:
    """Result from window resolution."""
    window_title: str
    app_name: Optional[str]
    confidence: str  # "high", "medium", "low"
    reasoning: str


class WindowResolverAgent(BaseAgent):
    """
    Agent for determining which window to use based on user instruction.
    
    Given an instruction like "in Slack message John" and a list of open windows,
    determines which window the user is referring to.
    
    Usage:
        agent = WindowResolverAgent()
        windows = [{"title": "Slack", "app_name": "Slack"}, ...]
        result = agent.resolve("message John hi in slack", windows)
        if result:
            print(f"Use window: {result.window_title}")
    """
    
    @property
    def system_prompt(self) -> str:
        return """You are a Window Resolution Agent. Your job is to determine which application window the user wants to interact with.

You will be given:
1. A user instruction (what they want to do)
2. A list of currently open windows

Your task: Identify which window best matches the user's intent.

IMPORTANT: Return ONLY a JSON object with no markdown formatting:

{
  "window_title": "exact title from the list",
  "app_name": "application name",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}

Rules:
- Match based on app name mentioned in instruction (slack, chrome, safari, terminal, etc.)
- Match based on context clues (message → chat apps, browse → browsers, code → editors)
- If multiple windows of same app, pick the most relevant one
- If no clear match, return null

Examples:
- "message john in slack" → Match window with "Slack" in title/app
- "search on google" → Match Chrome/Safari/browser window
- "write code" → Match VS Code/Cursor/editor window"""

    def parse_response(self, response_text: str) -> Optional[WindowMatch]:
        """Parse Gemini's response into a WindowMatch."""
        data = self.extract_json(response_text)
        
        if data is None or not isinstance(data, dict):
            return None
        
        window_title = data.get("window_title")
        if not window_title:
            return None
        
        return WindowMatch(
            window_title=window_title,
            app_name=data.get("app_name"),
            confidence=data.get("confidence", "medium"),
            reasoning=data.get("reasoning", "")
        )
    
    def resolve(
        self,
        instruction: str,
        windows: list[dict]
    ) -> Optional[WindowMatch]:
        """
        Resolve which window to use for the given instruction.
        
        Args:
            instruction: User's instruction (e.g., "message john hi in slack")
            windows: List of window dicts with "title" and "app_name" keys
            
        Returns:
            WindowMatch if a suitable window is found, None otherwise.
        """
        if not windows:
            return None
        
        # Format windows list for the prompt
        windows_text = "\n".join([
            f"- Title: \"{w.get('title', 'Unknown')}\", App: \"{w.get('app_name', 'Unknown')}\""
            for w in windows
        ])
        
        user_prompt = f"""User instruction: "{instruction}"

Available windows:
{windows_text}

Which window should be used for this instruction?"""
        
        response_text = self.call_llm(
            user_prompt=user_prompt,
            max_tokens=256
        )
        
        print(f"WindowResolverAgent response: {response_text}")
        
        return self.parse_response(response_text)
    
    def resolve_with_screenshot_hints(
        self,
        instruction: str,
        windows: list[dict],
        screenshots: dict[str, bytes] = None
    ) -> Optional[WindowMatch]:
        """
        Resolve window using screenshots for better accuracy.
        
        This is more expensive (multiple images) but more accurate
        for ambiguous cases.
        
        Note: Not implemented yet - for future enhancement.
        """
        # For now, fall back to text-based resolution
        return self.resolve(instruction, windows)
