"""
Actions Module for AutoQA

Handles mouse and keyboard actions with human-like timing.
"""

import time
from enum import Enum
from typing import Optional

import pyautogui


# Configure pyautogui safety settings
pyautogui.FAILSAFE = True  # Move mouse to corner to abort
pyautogui.PAUSE = 0.1  # Small pause between actions


class ActionType(str, Enum):
    """Supported action types."""
    CLICK = "click"
    TYPE = "type"
    SCROLL = "scroll"
    DOUBLE_CLICK = "double_click"
    RIGHT_CLICK = "right_click"


def human_click(x: int, y: int, duration: float = 0.2, simple: bool = True) -> None:
    """
    Perform a click at the specified coordinates.
    
    Args:
        x: Global X coordinate.
        y: Global Y coordinate.
        duration: Time to move to target (seconds).
        simple: If True, use simple pyautogui.click(). If False, use human-like pattern.
    """
    if simple:
        # Simple click - more reliable
        print(f"Simple click at ({x}, {y})")
        pyautogui.click(x, y)
    else:
        # Human-like click - needed for simulators
        print(f"Human click at ({x}, {y})")
        pyautogui.moveTo(x, y, duration=duration)
        pyautogui.mouseDown()
        time.sleep(0.1)  # Hold duration - critical for simulators
        pyautogui.mouseUp()


def human_double_click(x: int, y: int, duration: float = 0.2) -> None:
    """
    Perform a human-like double-click.
    
    Args:
        x: Global X coordinate.
        y: Global Y coordinate.
        duration: Time to move to target (seconds).
    """
    pyautogui.moveTo(x, y, duration=duration)
    
    # First click
    pyautogui.mouseDown()
    time.sleep(0.05)
    pyautogui.mouseUp()
    
    time.sleep(0.1)  # Gap between clicks
    
    # Second click
    pyautogui.mouseDown()
    time.sleep(0.05)
    pyautogui.mouseUp()


def human_right_click(x: int, y: int, duration: float = 0.2) -> None:
    """
    Perform a human-like right-click.
    
    Args:
        x: Global X coordinate.
        y: Global Y coordinate.
        duration: Time to move to target (seconds).
    """
    pyautogui.moveTo(x, y, duration=duration)
    pyautogui.mouseDown(button='right')
    time.sleep(0.1)
    pyautogui.mouseUp(button='right')


def human_type(
    text: str,
    x: Optional[int] = None,
    y: Optional[int] = None,
    click_first: bool = True,
    interval: float = 0.05
) -> None:
    """
    Type text with human-like timing.
    
    Optionally clicks a target location first to focus the input field.
    
    Args:
        text: The text to type.
        x: X coordinate to click first (optional).
        y: Y coordinate to click first (optional).
        click_first: Whether to click the location before typing.
        interval: Delay between keystrokes (seconds).
    """
    if click_first and x is not None and y is not None:
        human_click(x, y)
        time.sleep(0.5)  # Wait for focus
    
    # Use write for alphanumeric, handles special chars too
    pyautogui.write(text, interval=interval)


def human_scroll(
    direction: str,
    x: Optional[int] = None,
    y: Optional[int] = None,
    clicks: int = 10
) -> None:
    """
    Scroll in the specified direction.
    
    Args:
        direction: "up", "down", "left", or "right".
        x: X coordinate to scroll at (optional, uses current position).
        y: Y coordinate to scroll at (optional, uses current position).
        clicks: Number of scroll "clicks" (intensity). Default 10 for meaningful scroll.
    """
    # Move to position if specified
    if x is not None and y is not None:
        pyautogui.moveTo(x, y, duration=0.1)
    
    direction = direction.lower()
    
    print(f"Scrolling {direction} with {clicks} clicks")
    
    if direction == "up":
        pyautogui.scroll(clicks)  # Positive = scroll up
    elif direction == "down":
        pyautogui.scroll(-clicks)  # Negative = scroll down
    elif direction == "left":
        pyautogui.hscroll(-clicks)  # Horizontal scroll
    elif direction == "right":
        pyautogui.hscroll(clicks)
    else:
        raise ValueError(f"Invalid scroll direction: {direction}")


def execute_action(
    action_type: ActionType,
    x: int,
    y: int,
    text: Optional[str] = None,
    scroll_direction: Optional[str] = None
) -> dict:
    """
    Execute an action at the specified coordinates.
    
    Args:
        action_type: The type of action to perform.
        x: Global X coordinate.
        y: Global Y coordinate.
        text: Text to type (for TYPE action).
        scroll_direction: Direction to scroll (for SCROLL action).
        
    Returns:
        Dict with action result details.
    """
    result = {
        "action_type": action_type.value,
        "coordinates": [x, y],
        "success": True
    }
    
    try:
        if action_type == ActionType.CLICK:
            human_click(x, y)
            
        elif action_type == ActionType.DOUBLE_CLICK:
            human_double_click(x, y)
            
        elif action_type == ActionType.RIGHT_CLICK:
            human_right_click(x, y)
            
        elif action_type == ActionType.TYPE:
            if not text:
                raise ValueError("Text is required for TYPE action")
            human_type(text, x, y, click_first=True)
            result["text_typed"] = text
            
        elif action_type == ActionType.SCROLL:
            direction = scroll_direction or "down"
            human_scroll(direction, x, y)
            result["scroll_direction"] = direction
            
        else:
            raise ValueError(f"Unknown action type: {action_type}")
            
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
    
    return result


def get_current_mouse_position() -> tuple[int, int]:
    """Get the current mouse cursor position."""
    pos = pyautogui.position()
    return pos.x, pos.y
