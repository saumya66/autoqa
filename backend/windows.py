"""
Window Management Module for AutoQA

Handles listing windows and getting window bounds.
Platform-specific implementations for macOS and Windows.
"""

import platform
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional

import mss


@dataclass
class WindowBounds:
    """Represents window position and size."""
    left: int
    top: int
    width: int
    height: int
    
    def to_dict(self) -> dict:
        return {
            "left": self.left,
            "top": self.top,
            "width": self.width,
            "height": self.height
        }


@dataclass
class WindowInfo:
    """Information about an open window."""
    id: str
    title: str
    bounds: WindowBounds
    app_name: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "bounds": self.bounds.to_dict(),
            "app_name": self.app_name
        }


def get_platform() -> str:
    """Get the current platform."""
    return platform.system().lower()


def list_windows() -> list[WindowInfo]:
    """
    List all open windows with their bounds.
    
    Returns:
        List of WindowInfo objects.
    """
    current_platform = get_platform()
    
    if current_platform == "darwin":
        return _list_windows_macos()
    elif current_platform == "windows":
        return _list_windows_windows()
    else:
        raise NotImplementedError(f"Platform {current_platform} not supported")


def get_window_by_title(title: str) -> Optional[WindowInfo]:
    """
    Find a window by its title (partial match).
    
    Args:
        title: The window title to search for.
        
    Returns:
        WindowInfo if found, None otherwise.
    """
    windows = list_windows()
    
    # Try exact match first
    for window in windows:
        if window.title == title:
            return window
    
    # Try partial match (case-insensitive)
    title_lower = title.lower()
    for window in windows:
        if title_lower in window.title.lower():
            return window
    
    return None


def activate_window(window: WindowInfo) -> bool:
    """
    Bring a window to the front (activate it).
    
    Args:
        window: WindowInfo object to activate.
        
    Returns:
        True if successful, False otherwise.
    """
    current_platform = get_platform()
    
    if current_platform == "darwin":
        return _activate_window_macos(window)
    elif current_platform == "windows":
        return _activate_window_windows(window)
    else:
        return False


def _activate_window_macos(window: WindowInfo) -> bool:
    """Activate a window on macOS using AppleScript."""
    if not window.app_name:
        return False
    
    # Use AppleScript to activate the app
    script = f'''
    tell application "{window.app_name}"
        activate
    end tell
    '''
    
    try:
        subprocess.run(
            ["osascript", "-e", script],
            check=True,
            capture_output=True,
            timeout=5
        )
        # Give the window time to come to front
        import time
        time.sleep(0.3)
        return True
    except Exception as e:
        print(f"Failed to activate window: {e}")
        return False


def _activate_window_windows(window: WindowInfo) -> bool:
    """Activate a window on Windows using pygetwindow."""
    try:
        import pygetwindow as gw
        windows = gw.getWindowsWithTitle(window.title)
        if windows:
            windows[0].activate()
            import time
            time.sleep(0.3)
            return True
    except Exception as e:
        print(f"Failed to activate window: {e}")
    return False


def capture_window(window: WindowInfo) -> bytes:
    """
    Capture a screenshot of the specified window region.
    
    Args:
        window: WindowInfo object with bounds.
        
    Returns:
        PNG image bytes.
    """
    with mss.mss() as sct:
        monitor = {
            "left": window.bounds.left,
            "top": window.bounds.top,
            "width": window.bounds.width,
            "height": window.bounds.height
        }
        screenshot = sct.grab(monitor)
        return mss.tools.to_png(screenshot.rgb, screenshot.size)


def get_screenshot_dimensions(window: WindowInfo) -> tuple[int, int]:
    """
    Get the actual pixel dimensions of a screenshot for scale factor calculation.
    
    On Retina displays, the screenshot will be larger than the logical window bounds.
    
    Args:
        window: WindowInfo object with bounds.
        
    Returns:
        Tuple of (width, height) in actual pixels.
    """
    with mss.mss() as sct:
        monitor = {
            "left": window.bounds.left,
            "top": window.bounds.top,
            "width": window.bounds.width,
            "height": window.bounds.height
        }
        screenshot = sct.grab(monitor)
        return screenshot.width, screenshot.height


def check_permissions() -> dict:
    """
    Check if required permissions are granted (macOS only).
    
    Returns:
        Dict with permission status.
    """
    if get_platform() != "darwin":
        return {"screen_recording": True, "accessibility": True}
    
    return _check_permissions_macos()


# =============================================================================
# macOS Implementation
# =============================================================================

def _list_windows_macos() -> list[WindowInfo]:
    """List windows on macOS using Quartz."""
    try:
        from Quartz import (
            CGWindowListCopyWindowInfo,
            kCGWindowListOptionOnScreenOnly,
            kCGNullWindowID,
            kCGWindowListExcludeDesktopElements
        )
    except ImportError:
        raise ImportError(
            "pyobjc-framework-Quartz is required on macOS. "
            "Install with: pip install pyobjc-framework-Quartz"
        )
    
    windows = []
    options = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements
    window_list = CGWindowListCopyWindowInfo(options, kCGNullWindowID)
    
    for idx, window in enumerate(window_list):
        # Skip windows without titles or with empty titles
        title = window.get("kCGWindowName", "")
        if not title:
            continue
        
        # Skip very small windows (likely system elements)
        bounds = window.get("kCGWindowBounds", {})
        width = int(bounds.get("Width", 0))
        height = int(bounds.get("Height", 0))
        if width < 100 or height < 100:
            continue
        
        owner_name = window.get("kCGWindowOwnerName", "Unknown")
        
        window_info = WindowInfo(
            id=str(window.get("kCGWindowNumber", idx)),
            title=title,
            bounds=WindowBounds(
                left=int(bounds.get("X", 0)),
                top=int(bounds.get("Y", 0)),
                width=width,
                height=height
            ),
            app_name=owner_name
        )
        windows.append(window_info)
    
    return windows


def _check_permissions_macos() -> dict:
    """Check macOS permissions for screen recording and accessibility."""
    result = {
        "screen_recording": False,
        "accessibility": False
    }
    
    # Check screen recording permission by trying to capture
    try:
        with mss.mss() as sct:
            # Try to grab a small region
            sct.grab({"left": 0, "top": 0, "width": 1, "height": 1})
            result["screen_recording"] = True
    except Exception:
        result["screen_recording"] = False
    
    # Check accessibility permission
    try:
        from ApplicationServices import AXIsProcessTrusted
        result["accessibility"] = AXIsProcessTrusted()
    except ImportError:
        # If we can't import, assume it's fine (will fail later if not)
        result["accessibility"] = True
    except Exception:
        result["accessibility"] = False
    
    return result


# =============================================================================
# Windows Implementation
# =============================================================================

def _list_windows_windows() -> list[WindowInfo]:
    """List windows on Windows using pygetwindow."""
    try:
        import pygetwindow as gw
    except ImportError:
        raise ImportError(
            "pygetwindow is required on Windows. "
            "Install with: pip install pygetwindow"
        )
    
    windows = []
    
    for idx, window in enumerate(gw.getAllWindows()):
        # Skip windows without titles
        if not window.title:
            continue
        
        # Skip minimized windows
        if window.isMinimized:
            continue
        
        # Skip very small windows
        if window.width < 100 or window.height < 100:
            continue
        
        window_info = WindowInfo(
            id=str(idx),
            title=window.title,
            bounds=WindowBounds(
                left=window.left,
                top=window.top,
                width=window.width,
                height=window.height
            )
        )
        windows.append(window_info)
    
    return windows
