"""
Vision Module for AutoQA

Handles Gemini AI integration for UI element detection.
Uses the official google-genai SDK.
"""

import base64
import json
import os
import re
from dataclasses import dataclass
from io import BytesIO
from typing import Optional

from google import genai
from google.genai import types
from PIL import Image, ImageDraw


DEFAULT_MODEL = "gemini-2.5-flash"


@dataclass
class DetectionResult:
    """Result from Gemini UI element detection."""
    box_2d: tuple[int, int, int, int]  # (ymin, xmin, ymax, xmax) in 0-1000 scale
    label: str
    center_normalized: tuple[float, float]  # (x, y) center in 0-1000 scale
    
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


# Global client - set via configure_gemini()
_client: Optional[genai.Client] = None
_model: str = DEFAULT_MODEL


def configure_gemini(
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL,
) -> None:
    """
    Configure the Gemini client.
    
    Args:
        api_key: API key. If None, reads from GEMINI_API_KEY env var.
        model: Model name (default: gemini-3-flash-preview).
    """
    global _client, _model
    
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError(
            "GEMINI_API_KEY not found. Set it in .env or pass directly."
        )
    
    _client = genai.Client(api_key=key)
    _model = model


def _get_client() -> genai.Client:
    """Get the current Gemini client."""
    if _client is None:
        raise ValueError("Gemini not configured. Call configure_gemini() first.")
    return _client


def detect_element(
    screenshot_bytes: bytes,
    instruction: str,
    model_name: Optional[str] = None
) -> Optional[DetectionResult]:
    """
    Use Gemini to detect a UI element matching the instruction.
    
    Args:
        screenshot_bytes: PNG image bytes of the window.
        instruction: User's instruction (e.g., "Click the Login button").
        model_name: Gemini model to use (overrides config).
        
    Returns:
        DetectionResult if element found, None otherwise.
    """
    client = _get_client()
    model = model_name or _model
    system_prompt = _build_system_prompt(instruction)

    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_text(text=f'Find the UI element: "{instruction}"'),
            types.Part.from_bytes(data=screenshot_bytes, mime_type="image/png"),
        ],
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.1,
            max_output_tokens=256,
            response_mime_type="application/json",
        ),
    )

    text = response.text
    print(f"Gemini API response: {text}")

    if not text:
        raise Exception("Gemini returned an empty response")

    return _parse_gemini_response(text)


def _build_system_prompt(instruction: str) -> str:
    """Build the system prompt for Gemini."""
    return f"""You are a GUI Automation Agent. You are looking at a cropped screenshot of a specific application window.

Task:
Identify the UI element that matches the user's instruction: "{instruction}".

Output Format:
Return ONLY a JSON object with no markdown formatting:

{{"box_2d": [ymin, xmin, ymax, xmax], "label": "name of element found"}}

The coordinates should be normalized to a 0-1000 scale, where:
- (0, 0) is the top-left corner
- (1000, 1000) is the bottom-right corner

If the element is not found, return null."""


def _parse_gemini_response(response_text: str) -> Optional[DetectionResult]:
    """
    Parse Gemini's response into a DetectionResult.
    
    Args:
        response_text: Raw text response from Gemini.
        
    Returns:
        DetectionResult if valid, None otherwise.
    """
    cleaned = response_text.strip()
    
    # Remove markdown code block wrapper if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)
    
    if cleaned.lower() == "null" or not cleaned:
        return None
    
    try:
        data = json.loads(cleaned)
        print(f"Parsed JSON: {data}")
    except json.JSONDecodeError:
        json_match = re.search(r'\{[^{}]*\}', cleaned)
        if json_match:
            try:
                data = json.loads(json_match.group())
            except json.JSONDecodeError:
                return None
        else:
            return None
    
    if data is None:
        return None
    
    box = data.get("box_2d")
    if not box or len(box) != 4:
        return None
    
    ymin, xmin, ymax, xmax = box
    center_x = (xmin + xmax) / 2
    center_y = (ymin + ymax) / 2
    
    return DetectionResult(
        box_2d=(ymin, xmin, ymax, xmax),
        label=data.get("label", "unknown"),
        center_normalized=(center_x, center_y)
    )


def calculate_click_coordinates(
    detection: DetectionResult,
    window_left: int,
    window_top: int,
    window_width: int,
    window_height: int,
    screenshot_width: int,
    screenshot_height: int
) -> tuple[int, int]:
    """
    Convert Gemini's normalized coordinates to global screen coordinates.
    
    Args:
        detection: The DetectionResult from Gemini.
        window_left: Window's left position (logical pixels).
        window_top: Window's top position (logical pixels).
        window_width: Window's width (logical pixels).
        window_height: Window's height (logical pixels).
        screenshot_width: Actual screenshot width (physical pixels).
        screenshot_height: Actual screenshot height (physical pixels).
        
    Returns:
        Tuple of (global_x, global_y) in screen coordinates (logical pixels).
    """
    center_x_norm, center_y_norm = detection.center_normalized
    
    scale_factor_x = screenshot_width / window_width
    scale_factor_y = screenshot_height / window_height
    
    print(f"  Scale factors: x={scale_factor_x:.2f}, y={scale_factor_y:.2f}")
    
    screenshot_x = (center_x_norm / 1000) * screenshot_width
    screenshot_y = (center_y_norm / 1000) * screenshot_height
    
    print(f"  Screenshot pixels (physical): x={screenshot_x:.2f}, y={screenshot_y:.2f}")
    
    logical_offset_x = screenshot_x / scale_factor_x
    logical_offset_y = screenshot_y / scale_factor_y
    
    print(f"  Logical offset: x={logical_offset_x:.2f}, y={logical_offset_y:.2f}")
    
    global_x = window_left + logical_offset_x
    global_y = window_top + logical_offset_y
    
    print(f"  Final global: x={window_left} + {logical_offset_x:.2f} = {global_x:.2f}")
    print(f"  Final global: y={window_top} + {logical_offset_y:.2f} = {global_y:.2f}")
    
    return int(global_x), int(global_y)


def draw_debug_overlay(
    screenshot_bytes: bytes,
    detection: DetectionResult
) -> bytes:
    """
    Draw a red bounding box on the screenshot for debugging.
    
    Args:
        screenshot_bytes: Original PNG screenshot bytes.
        detection: The detected element.
        
    Returns:
        PNG bytes with the overlay drawn.
    """
    image = Image.open(BytesIO(screenshot_bytes))
    draw = ImageDraw.Draw(image)
    
    width, height = image.size
    
    ymin, xmin, ymax, xmax = detection.box_2d
    
    x1 = int((xmin / 1000) * width)
    y1 = int((ymin / 1000) * height)
    x2 = int((xmax / 1000) * width)
    y2 = int((ymax / 1000) * height)
    
    draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
    
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    r = 5
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill="red")
    
    draw.text((x1, y1 - 20), detection.label, fill="red")
    
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def image_to_base64(image_bytes: bytes) -> str:
    """Convert image bytes to base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")
