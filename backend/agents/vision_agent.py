"""
Vision Agent

Responsible for detecting UI elements in screenshots.
Returns bounding boxes and element labels.
"""

from dataclasses import dataclass
from typing import Optional

from agents.base_agent import BaseAgent


@dataclass
class ElementDetection:
    """Result from UI element detection."""
    box_2d: tuple[int, int, int, int]  # (ymin, xmin, ymax, xmax) in 0-1000 scale
    label: str
    center_normalized: tuple[float, float]  # (x, y) center in 0-1000 scale
    confidence: Optional[float] = None
    
    @property
    def ymin(self) -> int:
        return self.box_2d[0]
    
    @property
    def xmin(self) -> int:
        return self.box_2d[1]
    
    @property
    def ymax(self) -> int:
        return self.box_2d[2]
    
    @property
    def xmax(self) -> int:
        return self.box_2d[3]
    
    def to_dict(self) -> dict:
        return {
            "box_2d": list(self.box_2d),
            "label": self.label,
            "center_normalized": list(self.center_normalized),
            "confidence": self.confidence
        }


class VisionAgent(BaseAgent):
    """
    Agent for detecting UI elements in screenshots.
    
    Given a screenshot and an instruction, identifies the target element
    and returns its bounding box coordinates.
    
    Usage:
        agent = VisionAgent()
        result = agent.detect(screenshot_bytes, "Click the Login button")
        if result:
            print(f"Found {result.label} at {result.center_normalized}")
    """
    
    @property
    def system_prompt(self) -> str:
        return """You are a GUI Automation Agent specialized in detecting UI elements.
You are looking at a screenshot of an application window.

Your task is to identify the UI element that matches the user's instruction.

IMPORTANT: Return ONLY a JSON object with no markdown formatting, no explanation:

{"box_2d": [ymin, xmin, ymax, xmax], "label": "name of element found"}

Coordinate rules:
- All coordinates are normalized to a 0-1000 scale
- (0, 0) is the top-left corner
- (1000, 1000) is the bottom-right corner
- box_2d format is [ymin, xmin, ymax, xmax]



SCROLL TARGET RULES:
- If instruction mentions "center of the screen" or "center of the content area" or "middle of screen":
  Return the CENTER of the main scrollable content area (usually the middle of the screen)
  Use coordinates that represent the vertical and horizontal center: approximately [400, 400, 600, 600]
- If instruction mentions "center of [specific area]", return the center of THAT area
- For scroll targets, the bounding box should cover a central portion where scrolling will work

If the element is not found, return: null"""
    
    def parse_response(self, response_text: str) -> Optional[ElementDetection]:
        """Parse Gemini's response into an ElementDetection."""
        data = self.extract_json(response_text)
        
        if data is None:
            return None
        
        # Handle both dict and other formats
        if not isinstance(data, dict):
            return None
        
        box = data.get("box_2d")
        if not box or len(box) != 4:
            return None
        
        ymin, xmin, ymax, xmax = box
        
        # Calculate center in normalized coordinates
        center_x = (xmin + xmax) / 2
        center_y = (ymin + ymax) / 2
        
        return ElementDetection(
            box_2d=(ymin, xmin, ymax, xmax),
            label=data.get("label", "unknown"),
            center_normalized=(center_x, center_y),
            confidence=data.get("confidence")
        )
    
    def detect(
        self,
        screenshot_bytes: bytes,
        instruction: str
    ) -> Optional[ElementDetection]:
        """
        Detect a UI element matching the instruction.
        
        Args:
            screenshot_bytes: PNG image bytes of the window.
            instruction: What element to find (e.g., "the Login button").
            
        Returns:
            ElementDetection if found, None otherwise.
        """
        user_prompt = f'Find the UI element: "{instruction}"'
        
        response_text = self.call_llm(
            user_prompt=user_prompt,
            image_bytes=screenshot_bytes,
            max_tokens=256
        )
        
        print(f"VisionAgent response: {response_text}")
        
        return self.parse_response(response_text)
    
    def detect_multiple(
        self,
        screenshot_bytes: bytes,
        instructions: list[str]
    ) -> list[Optional[ElementDetection]]:
        """
        Detect multiple UI elements in a single screenshot.
        
        Args:
            screenshot_bytes: PNG image bytes of the window.
            instructions: List of elements to find.
            
        Returns:
            List of ElementDetection results (None for not found).
        """
        results = []
        for instruction in instructions:
            result = self.detect(screenshot_bytes, instruction)
            results.append(result)
        return results


def calculate_screen_coordinates(
    detection: ElementDetection,
    window_left: int,
    window_top: int,
    window_width: int,
    window_height: int,
    screenshot_width: int,
    screenshot_height: int,
    y_offset_ratio: float = 0.0
) -> tuple[int, int]:
    """
    Convert normalized coordinates to global screen coordinates.
    
    Args:
        detection: The ElementDetection result.
        window_left: Window's left position (logical pixels).
        window_top: Window's top position (logical pixels).
        window_width: Window's width (logical pixels).
        window_height: Window's height (logical pixels).
        screenshot_width: Actual screenshot width (physical pixels).
        screenshot_height: Actual screenshot height (physical pixels).
        y_offset_ratio: Offset from center towards top (-0.5) or bottom (+0.5).
                        0.0 = center, -0.3 = 30% towards top, +0.3 = 30% towards bottom.
        
    Returns:
        Tuple of (global_x, global_y) in screen coordinates.
    """
    center_x_norm, center_y_norm = detection.center_normalized
    
    # Apply Y offset (useful for clicking top part of search bars, etc.)
    if y_offset_ratio != 0.0:
        ymin, _, ymax, _ = detection.box_2d
        box_height = ymax - ymin
        center_y_norm = center_y_norm + (box_height * y_offset_ratio)
    
    # Calculate scale factor (for Retina displays)
    scale_factor_x = screenshot_width / window_width
    scale_factor_y = screenshot_height / window_height
    
    # Gemini's coordinates are relative to the screenshot (physical pixels)
    # Convert normalized (0-1000) to screenshot pixels (physical)
    screenshot_x = (center_x_norm / 1000) * screenshot_width
    screenshot_y = (center_y_norm / 1000) * screenshot_height
    
    # Convert to logical pixels (offset from window origin)
    logical_offset_x = screenshot_x / scale_factor_x
    logical_offset_y = screenshot_y / scale_factor_y
    
    # Convert to global screen coordinates
    global_x = window_left + logical_offset_x
    global_y = window_top + logical_offset_y
    
    return int(global_x), int(global_y)
