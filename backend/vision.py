"""
Vision Module for AutoQA

Handles Gemini AI integration for UI element detection.
Uses direct HTTP requests to Gemini API (no SDK).
"""

import base64
import json
import os
import re
from dataclasses import dataclass
from io import BytesIO
from typing import Optional

import requests
from PIL import Image, ImageDraw


# Gemini API Configuration
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-2.0-flash"


@dataclass
class GeminiConfig:
    """Configuration for Gemini API."""
    api_key: str
    base_url: str = GEMINI_BASE_URL
    model: str = DEFAULT_MODEL
    
    @property
    def endpoint(self) -> str:
        """Get the full API endpoint URL."""
        return f"{self.base_url}/{self.model}:generateContent"


# Global config - set via configure_gemini()
_gemini_config: Optional[GeminiConfig] = None


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


def configure_gemini(
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    base_url: str = GEMINI_BASE_URL
) -> None:
    """
    Configure the Gemini API.
    
    Args:
        api_key: API key. If None, reads from GEMINI_API_KEY env var.
        model: Model name (default: gemini-2.0-flash).
        base_url: Base URL for the API.
    """
    global _gemini_config
    
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError(
            "GEMINI_API_KEY not found. Set it in .env or pass directly."
        )
    
    _gemini_config = GeminiConfig(
        api_key=key,
        model=model,
        base_url=base_url
    )


def get_gemini_config() -> GeminiConfig:
    """Get the current Gemini configuration."""
    if _gemini_config is None:
        raise ValueError("Gemini not configured. Call configure_gemini() first.")
    return _gemini_config


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
    config = get_gemini_config()
    
    # Use provided model or fall back to config
    if model_name:
        endpoint = f"{config.base_url}/{model_name}:generateContent"
    else:
        endpoint = config.endpoint
    
    # Build the prompt
    prompt = _build_system_prompt(instruction)
    
    # Convert image to base64
    image_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
    
    # Build the request payload (Gemini REST API format)
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": image_b64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,  # Low temperature for consistent outputs
            "maxOutputTokens": 256
        }
    }
    
    # Make the API request
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": config.api_key
    }
    
    response = requests.post(
        endpoint,
        json=payload,
        headers=headers,
        timeout=30
    )
    print(f"Gemini API response: {response.text}")
    
    # Handle errors
    if response.status_code != 200:
        raise Exception(f"Gemini API error: {response.status_code} - {response.text}")
    
    # Parse response
    result = response.json()
    
    # Extract text from response
    try:
        text = result["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise Exception(f"Unexpected Gemini response format: {e}")
    
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
    # Clean up the response (remove markdown code blocks if present)
    cleaned = response_text.strip()
    
    # Remove markdown code block wrapper if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)
    
    # Handle null response
    if cleaned.lower() == "null" or not cleaned:
        return None
    
    try:
        data = json.loads(cleaned)
        print(f"Parsed JSON: {data}")
    except json.JSONDecodeError:
        # Try to extract JSON from the response
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
    
    # Extract bounding box
    box = data.get("box_2d")
    if not box or len(box) != 4:
        return None
    
    ymin, xmin, ymax, xmax = box
    
    # Calculate center in normalized coordinates
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
    
    Gemini returns coordinates in 0-1000 scale relative to the screenshot it saw.
    The screenshot is in physical pixels (2x on Retina), but pyautogui and window
    bounds work in logical pixels. We need to convert properly.
    
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
    
    # Calculate scale factor (for Retina displays)
    # scale_factor = physical pixels / logical pixels
    scale_factor_x = screenshot_width / window_width
    scale_factor_y = screenshot_height / window_height
    
    print(f"  Scale factors: x={scale_factor_x:.2f}, y={scale_factor_y:.2f}")
    
    # Gemini's coordinates are relative to the screenshot (physical pixels)
    # Convert normalized (0-1000) to screenshot pixels (physical)
    screenshot_x = (center_x_norm / 1000) * screenshot_width
    screenshot_y = (center_y_norm / 1000) * screenshot_height
    
    print(f"  Screenshot pixels (physical): x={screenshot_x:.2f}, y={screenshot_y:.2f}")
    
    # Convert to logical pixels (offset from window origin)
    logical_offset_x = screenshot_x / scale_factor_x
    logical_offset_y = screenshot_y / scale_factor_y
    
    print(f"  Logical offset: x={logical_offset_x:.2f}, y={logical_offset_y:.2f}")
    
    # Convert to global screen coordinates
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
    
    # Convert normalized coordinates to pixel coordinates
    ymin, xmin, ymax, xmax = detection.box_2d
    
    x1 = int((xmin / 1000) * width)
    y1 = int((ymin / 1000) * height)
    x2 = int((xmax / 1000) * width)
    y2 = int((ymax / 1000) * height)
    
    # Draw rectangle
    draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
    
    # Draw center point
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    r = 5
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill="red")
    
    # Draw label
    draw.text((x1, y1 - 20), detection.label, fill="red")
    
    # Convert back to bytes
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def image_to_base64(image_bytes: bytes) -> str:
    """Convert image bytes to base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")
