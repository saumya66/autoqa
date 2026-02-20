"""
AutoQA Backend Server

FastAPI server that provides endpoints for window management and action execution.
"""

import os
import signal
import sys
import time
from contextlib import asynccontextmanager
from typing import Optional


# Signal handler for clean shutdown
def signal_handler(signum, frame):
    print("\n\n🛑 Interrupted! Shutting down...")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

import asyncio
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi import File, UploadFile, Form

from actions import ActionType, execute_action
from context_builder import get_context_builder
from models.context import ContextType
from agents import VisionAgent, PlannerAgent, WindowResolverAgent, OrchestratorAgent
from agents.orchestrator_agent import ActionType as OrchestratorActionType
from agents.vision_agent import calculate_screen_coordinates
from agents.planner_agent import ActionType as PlanActionType
from vision import (
    calculate_click_coordinates,
    configure_gemini,
    detect_element,
    draw_debug_overlay,
    image_to_base64,
)
from windows import (
    activate_window,
    capture_window,
    check_permissions,
    get_screenshot_dimensions,
    get_window_by_title,
    list_windows,
)


# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - configure Gemini on startup."""
    # Startup
    try:
        configure_gemini()
        print("✓ Gemini API configured")
    except ValueError as e:
        print(f"⚠ Warning: {e}")
        print("  The /act endpoint will fail until GEMINI_API_KEY is set.")
    
    # Check permissions on macOS
    perms = check_permissions()
    if not perms.get("screen_recording"):
        print("⚠ Warning: Screen Recording permission not granted")
        print("  Go to System Preferences > Privacy & Security > Screen Recording")
    if not perms.get("accessibility"):
        print("⚠ Warning: Accessibility permission not granted")
        print("  Go to System Preferences > Privacy & Security > Accessibility")
    
    yield
    
    # Shutdown
    print("AutoQA server shutting down...")


# Create FastAPI app
app = FastAPI(
    title="AutoQA",
    description="Visual QA Agent - Autonomous UI Testing",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to Electron app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request/Response Models
# =============================================================================

class ActRequest(BaseModel):
    """Request body for the /act endpoint."""
    window_title: str
    instruction: str
    action_type: str = "click"  # click, type, scroll, double_click, right_click
    text: Optional[str] = None  # For type action
    scroll_direction: Optional[str] = None  # For scroll action: up, down, left, right


class ActResponse(BaseModel):
    """Response body for the /act endpoint."""
    status: str
    action_performed: str
    coordinates: list[int]
    element_label: Optional[str] = None
    debug_image: Optional[str] = None  # Base64 encoded image with overlay
    error: Optional[str] = None


class WindowResponse(BaseModel):
    """Response body for a single window."""
    id: str
    title: str
    bounds: dict
    app_name: Optional[str] = None


class PermissionsResponse(BaseModel):
    """Response body for permissions check."""
    screen_recording: bool
    accessibility: bool


class ChainRequest(BaseModel):
    """Request body for the /chain endpoint."""
    window_title: Optional[str] = None  # If not provided, WindowResolverAgent will determine it
    instruction: str
    use_screenshot_for_planning: bool = True  # Use screenshot when creating plan


class StepResult(BaseModel):
    """Result of a single step in a chain."""
    step_number: int
    action: str
    target: str
    status: str
    coordinates: Optional[list[int]] = None
    error: Optional[str] = None


class ChainResponse(BaseModel):
    """Response body for the /chain endpoint."""
    status: str
    goal: str
    total_steps: int
    completed_steps: int
    results: list[StepResult]
    error: Optional[str] = None


class AutoRequest(BaseModel):
    """Request body for the /auto endpoint (reactive orchestrator)."""
    instruction: str
    window_title: Optional[str] = None  # Auto-detected if not provided
    max_steps: int = 15  # Maximum steps before giving up


class AutoStepResult(BaseModel):
    """Result of a single step in the auto flow."""
    step_number: int
    current_state: str
    action: str
    target: Optional[str] = None
    value: Optional[str] = None
    reasoning: str
    success: bool
    coordinates: Optional[list[int]] = None
    error: Optional[str] = None


class AutoResponse(BaseModel):
    """Response body for the /auto endpoint."""
    status: str  # "success", "partial", "failed", "max_steps_reached"
    goal: str
    success: bool
    steps_taken: int
    max_steps: int
    final_state: str
    steps: list[AutoStepResult]
    error: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "AutoQA", "version": "1.0.0"}


@app.get("/windows", response_model=list[WindowResponse])
async def get_windows():
    """
    List all open windows that can be targeted.
    
    Returns:
        List of windows with their titles and bounds.
    """
    try:
        windows = list_windows()
        return [
            WindowResponse(
                id=w.id,
                title=w.title,
                bounds=w.bounds.to_dict(),
                app_name=w.app_name
            )
            for w in windows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/permissions", response_model=PermissionsResponse)
async def get_permissions():
    """
    Check if required permissions are granted (macOS).
    
    Returns:
        Permission status for screen recording and accessibility.
    """
    perms = check_permissions()
    return PermissionsResponse(**perms)


@app.post("/act", response_model=ActResponse)
async def perform_action(request: ActRequest):
    """
    Perform an action on a target window.
    
    This endpoint:
    1. Finds the target window
    2. Captures a screenshot
    3. Sends to Gemini to detect the target element
    4. Calculates click coordinates
    5. Performs the action
    
    Returns:
        Action result with coordinates and debug image.
    """
    # 1. Find the window
    window = get_window_by_title(request.window_title)
    if not window:
        raise HTTPException(
            status_code=404,
            detail=f"Window not found: {request.window_title}"
        )
    
    # 2. Capture screenshot
    try:
        screenshot_bytes = capture_window(window)
        screenshot_width, screenshot_height = get_screenshot_dimensions(window)
        print(f"Screenshot dimensions: {screenshot_width}x{screenshot_height}")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to capture screenshot: {e}"
        )
    
    # 3. Detect element with Gemini
    try:
        detection = detect_element(screenshot_bytes, request.instruction)
        print(f"Detection: {detection}")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini API error: {e}"
        )
    
    if detection is None:
        return ActResponse(
            status="error",
            action_performed="none",
            coordinates=[0, 0],
            error=f"Element not found: {request.instruction}"
        )
    
    # 4. Calculate click coordinates
    print(f"\n=== Coordinate Calculation Debug ===")
    print(f"Window bounds: left={window.bounds.left}, top={window.bounds.top}, width={window.bounds.width}, height={window.bounds.height}")
    print(f"Screenshot size: {screenshot_width}x{screenshot_height}")
    print(f"Scale factors: x={screenshot_width/window.bounds.width}, y={screenshot_height/window.bounds.height}")
    print(f"Center normalized (x,y): {detection.center_normalized}")
    
    global_x, global_y = calculate_click_coordinates(
        detection=detection,
        window_left=window.bounds.left,
        window_top=window.bounds.top,
        window_width=window.bounds.width,
        window_height=window.bounds.height,
        screenshot_width=screenshot_width,
        screenshot_height=screenshot_height
    )
    print(f"Global coordinates: {global_x}, {global_y}")
    print(f"=== End Debug ===\n")
    # 5. Draw debug overlay
    try:
        debug_image_bytes = draw_debug_overlay(screenshot_bytes, detection)
        debug_image_b64 = image_to_base64(debug_image_bytes)
    except Exception:
        debug_image_b64 = None
    
    # 6. Activate the window (bring to front)
    print(f"Activating window: {window.app_name}")
    activated = activate_window(window)
    if not activated:
        print(f"Warning: Could not activate window {window.title}")
    
    # 7. Perform the action
    try:
        action_type = ActionType(request.action_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action_type: {request.action_type}. "
                   f"Valid types: {[a.value for a in ActionType]}"
        )
    
    action_result = execute_action(
        action_type=action_type,
        x=global_x,
        y=global_y,
        text=request.text,
        scroll_direction=request.scroll_direction
    )
    
    if not action_result["success"]:
        return ActResponse(
            status="error",
            action_performed=request.action_type,
            coordinates=[global_x, global_y],
            element_label=detection.label,
            debug_image=debug_image_b64,
            error=action_result.get("error")
        )
    
    return ActResponse(
        status="success",
        action_performed=request.action_type,
        coordinates=[global_x, global_y],
        element_label=detection.label,
        debug_image=debug_image_b64
    )


@app.post("/capture")
async def capture_only(window_title: str):
    """
    Capture a screenshot of the target window without performing any action.
    
    Useful for debugging and viewing what the agent sees.
    """
    window = get_window_by_title(window_title)
    if not window:
        raise HTTPException(
            status_code=404,
            detail=f"Window not found: {window_title}"
        )
    
    try:
        screenshot_bytes = capture_window(window)
        return {
            "status": "success",
            "window": window.to_dict(),
            "image": image_to_base64(screenshot_bytes)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to capture screenshot: {e}"
        )


@app.post("/test-click")
async def test_click(x: int, y: int):
    """
    Test endpoint to move mouse to specific coordinates and click.
    Use this to verify mouse control is working correctly.
    
    Example: curl -X POST "http://127.0.0.1:8000/test-click?x=500&y=500"
    """
    import pyautogui
    
    # Get current position first
    current_pos = pyautogui.position()
    print(f"Current mouse position: {current_pos}")
    print(f"Screen size: {pyautogui.size()}")
    print(f"Attempting to click at: ({x}, {y})")
    
    try:
        # Simple click - no fancy human simulation
        pyautogui.click(x, y)
        
        new_pos = pyautogui.position()
        print(f"Mouse position after click: {new_pos}")
        
        return {
            "status": "success",
            "clicked_at": [x, y],
            "mouse_before": [current_pos.x, current_pos.y],
            "mouse_after": [new_pos.x, new_pos.y],
            "screen_size": list(pyautogui.size())
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "mouse_position": [current_pos.x, current_pos.y]
        }


@app.post("/chain", response_model=ChainResponse)
async def execute_chain(request: ChainRequest):
    """
    Execute a chain of actions based on a high-level instruction.
    
    This endpoint:
    1. If window_title not provided, uses WindowResolverAgent to determine it
    2. Uses PlannerAgent to break down the instruction into steps
    3. For each step, uses VisionAgent to find the target element
    4. Executes the action
    5. Re-captures screenshot before the next step
    
    Examples:
        # With explicit window:
        POST /chain
        {"window_title": "Slack", "instruction": "message john hi"}
        
        # Without window (auto-detect):
        POST /chain
        {"instruction": "in slack message john hi"}
    """
    # 1. Initialize agents
    try:
        planner = PlannerAgent()
        vision = VisionAgent()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # 2. Resolve window if not provided
    window_title = request.window_title
    
    if not window_title:
        print(f"\n{'='*50}")
        print(f"No window specified. Using WindowResolverAgent...")
        print(f"{'='*50}")
        
        try:
            resolver = WindowResolverAgent()
            all_windows = list_windows()
            
            # Format windows for the resolver
            windows_for_resolver = [
                {"title": w.title, "app_name": w.app_name}
                for w in all_windows
            ]
            
            match = resolver.resolve(request.instruction, windows_for_resolver)
            
            if match:
                window_title = match.window_title
                print(f"✓ Resolved to: {window_title}")
                print(f"  Confidence: {match.confidence}")
                print(f"  Reasoning: {match.reasoning}")
            else:
                return ChainResponse(
                    status="error",
                    goal=request.instruction,
                    total_steps=0,
                    completed_steps=0,
                    results=[],
                    error="Could not determine which window to use. Please specify window_title."
                )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Window resolution failed: {e}"
            )
    
    # 3. Find the window
    window = get_window_by_title(window_title)
    if not window:
        raise HTTPException(
            status_code=404,
            detail=f"Window not found: {window_title}"
        )
    
    # 4. Create the execution plan
    print(f"\n{'='*50}")
    print(f"Creating plan for: {request.instruction}")
    print(f"{'='*50}")
    
    try:
        # Capture initial screenshot for planning
        screenshot_bytes = capture_window(window)
        
        if request.use_screenshot_for_planning:
            plan = planner.create_plan_with_screenshot(
                instruction=request.instruction,
                screenshot_bytes=screenshot_bytes
            )
        else:
            plan = planner.create_plan(instruction=request.instruction)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Planning failed: {e}"
        )
    
    if not plan or not plan.steps:
        return ChainResponse(
            status="error",
            goal=request.instruction,
            total_steps=0,
            completed_steps=0,
            results=[],
            error="Could not create an execution plan"
        )
    
    print(f"\nPlan created with {len(plan.steps)} steps:")
    for i, step in enumerate(plan.steps):
        print(f"  {i+1}. {step.action.value}: {step.target} {f'({step.value})' if step.value else ''}")
    
    # 4. Execute each step
    results = []
    completed = 0
    
    # Activate window once at the start
    activate_window(window)
    
    for i, step in enumerate(plan.steps):
        step_num = i + 1
        print(f"\n--- Step {step_num}/{len(plan.steps)}: {step.action.value} '{step.target}' ---")
        
        step_result = StepResult(
            step_number=step_num,
            action=step.action.value,
            target=step.target,
            status="pending"
        )
        
        try:
            # Re-capture screenshot before each step (UI may have changed)
            screenshot_bytes = capture_window(window)
            screenshot_width, screenshot_height = get_screenshot_dimensions(window)
            
            # Find the target element
            detection = vision.detect(screenshot_bytes, step.target)
            
            if detection is None:
                step_result.status = "error"
                step_result.error = f"Could not find: {step.target}"
                results.append(step_result)
                print(f"  ✗ Element not found")
                continue
            
            # Calculate coordinates
            global_x, global_y = calculate_screen_coordinates(
                detection=detection,
                window_left=window.bounds.left,
                window_top=window.bounds.top,
                window_width=window.bounds.width,
                window_height=window.bounds.height,
                screenshot_width=screenshot_width,
                screenshot_height=screenshot_height
            )
            
            step_result.coordinates = [global_x, global_y]
            print(f"  Found at: ({global_x}, {global_y})")
            
            # Execute the action based on type
            if step.action == PlanActionType.CLICK:
                action_result = execute_action(
                    action_type=ActionType.CLICK,
                    x=global_x,
                    y=global_y
                )
            elif step.action == PlanActionType.TYPE:
                action_result = execute_action(
                    action_type=ActionType.TYPE,
                    x=global_x,
                    y=global_y,
                    text=step.value or ""
                )
            elif step.action == PlanActionType.SCROLL:
                action_result = execute_action(
                    action_type=ActionType.SCROLL,
                    x=global_x,
                    y=global_y,
                    scroll_direction=step.value or "down"
                )
            elif step.action == PlanActionType.WAIT:
                wait_time = float(step.value) if step.value else 1.0
                time.sleep(wait_time)
                action_result = {"success": True}
            else:
                action_result = {"success": False, "error": f"Unknown action: {step.action}"}
            
            if action_result.get("success"):
                step_result.status = "success"
                completed += 1
                print(f"  ✓ Action completed")
            else:
                step_result.status = "error"
                step_result.error = action_result.get("error", "Unknown error")
                print(f"  ✗ Action failed: {step_result.error}")
            
            # Small delay between actions for UI to update
            time.sleep(0.5)
            
        except Exception as e:
            step_result.status = "error"
            step_result.error = str(e)
            print(f"  ✗ Exception: {e}")
        
        results.append(step_result)
    
    # 5. Return results
    print(f"\n{'='*50}")
    print(f"Chain completed: {completed}/{len(plan.steps)} steps successful")
    print(f"{'='*50}\n")
    
    return ChainResponse(
        status="success" if completed == len(plan.steps) else "partial",
        goal=request.instruction,
        total_steps=len(plan.steps),
        completed_steps=completed,
        results=results
    )


@app.post("/plan")
async def create_plan(window_title: str, instruction: str, use_screenshot: bool = True):
    """
    Create an execution plan without executing it.
    
    Useful for previewing what actions will be taken.
    """
    window = get_window_by_title(window_title)
    if not window:
        raise HTTPException(
            status_code=404,
            detail=f"Window not found: {window_title}"
        )
    
    try:
        planner = PlannerAgent()
        
        if use_screenshot:
            screenshot_bytes = capture_window(window)
            plan = planner.create_plan_with_screenshot(instruction, screenshot_bytes)
        else:
            plan = planner.create_plan(instruction)
        
        if not plan:
            return {"status": "error", "error": "Could not create plan"}
        
        return {
            "status": "success",
            "goal": plan.goal,
            "steps": [step.to_dict() for step in plan.steps]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auto", response_model=AutoResponse)
async def auto_execute(request: AutoRequest):
    """
    Reactive orchestrator that adapts to screen changes.
    
    Unlike /chain which plans everything upfront, /auto:
    1. Observes the current screen
    2. Decides on ONE action
    3. Executes it
    4. Observes the new screen
    5. Repeats until goal is achieved or max_steps reached
    
    This handles:
    - Page navigations
    - Modal dialogs
    - Loading states
    - Unexpected UI changes
    
    Example:
        POST /auto
        {"instruction": "in slack message john hello"}
    """
    # 1. Resolve window if not provided
    window_title = request.window_title
    
    if not window_title:
        print(f"\n{'='*60}")
        print(f"AUTO MODE: {request.instruction}")
        print(f"{'='*60}")
        print(f"Resolving target window...")
        
        try:
            resolver = WindowResolverAgent()
            all_windows = list_windows()
            
            windows_for_resolver = [
                {"title": w.title, "app_name": w.app_name}
                for w in all_windows
            ]
            
            match = resolver.resolve(request.instruction, windows_for_resolver)
            
            if match:
                window_title = match.window_title
                print(f"✓ Target window: {window_title}")
            else:
                return AutoResponse(
                    status="failed",
                    goal=request.instruction,
                    success=False,
                    steps_taken=0,
                    max_steps=request.max_steps,
                    final_state="Could not determine target window",
                    steps=[],
                    error="Could not determine which window to use"
                )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Window resolution failed: {e}")
    
    # 2. Find the window
    window = get_window_by_title(window_title)
    if not window:
        raise HTTPException(status_code=404, detail=f"Window not found: {window_title}")
    
    # 3. Initialize orchestrator and vision agent
    try:
        orchestrator = OrchestratorAgent()
        vision = VisionAgent()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # 4. Activate window
    activate_window(window)
    
    # 5. Run the reactive loop
    steps: list[AutoStepResult] = []
    previous_actions: list[str] = []
    final_state = "Unknown"
    success = False
    
    # Loop detection: track recent actions to detect stuck states
    recent_actions: list[tuple[str, str]] = []  # (action, target) pairs
    LOOP_THRESHOLD = 3  # If same action repeated 3+ times, we're stuck
    
    def detect_loop(action: str, target: str) -> tuple[bool, str]:
        """Check if we're stuck in a loop doing similar actions.
        
        Returns (is_loop, pattern_description)
        """
        recent_actions.append((action, target.lower() if target else ""))
        if len(recent_actions) > LOOP_THRESHOLD:
            recent_actions.pop(0)
        
        if len(recent_actions) >= LOOP_THRESHOLD:
            # Check if all recent actions have the same action type
            actions_only = [a[0] for a in recent_actions]
            if len(set(actions_only)) == 1:
                # Same action type - check if targets are similar (contain same keywords)
                targets = [a[1] for a in recent_actions]
                
                # Check for exact match
                if len(set(targets)) == 1:
                    return True, f"exact: {action} on '{target}'"
                
                # Check for similar patterns (e.g., "add to bag" appearing in all)
                keywords = ["add to bag", "add to cart", "buy now", "add", "remove"]
                for kw in keywords:
                    if all(kw in t for t in targets):
                        return True, f"similar: all targets contain '{kw}'"
                
                # Check if all clicks are on the same type of action
                if action == "click" and len(set(targets)) > 1:
                    # Different targets but same action - might still be stuck
                    common_words = set(targets[0].split()) & set(targets[1].split()) if len(targets) > 1 else set()
                    if len(common_words) >= 2:  # At least 2 words in common
                        return True, f"pattern: repeated clicks with common words {common_words}"
        
        return False, ""
    
    print(f"\nStarting reactive execution (max {request.max_steps} steps)...")
    
    for step_num in range(1, request.max_steps + 1):
        print(f"\n--- Step {step_num}/{request.max_steps} ---")
        
        # Capture current screenshot
        try:
            screenshot_bytes = capture_window(window)
            screenshot_width, screenshot_height = get_screenshot_dimensions(window)
        except Exception as e:
            steps.append(AutoStepResult(
                step_number=step_num,
                current_state="Failed to capture screenshot",
                action="error",
                reasoning=str(e),
                success=False,
                error=str(e)
            ))
            break
        
        # Get orchestrator decision
        decision = orchestrator.analyze_and_decide(
            screenshot_bytes=screenshot_bytes,
            goal=request.instruction,
            previous_actions=previous_actions
        )
        
        print(f"  State: {decision.current_state}")
        print(f"  Action: {decision.action.value} -> {decision.target or 'N/A'}")
        print(f"  Reasoning: {decision.reasoning}")
        if decision.learning:
            print(f"  Learning: {decision.learning}")
        
        # Check for terminal states
        if decision.goal_complete or decision.action == OrchestratorActionType.DONE:
            print(f"  ✓ Goal complete!")
            steps.append(AutoStepResult(
                step_number=step_num,
                current_state=decision.current_state,
                action="done",
                target=None,
                value=None,
                reasoning=decision.reasoning,
                success=True
            ))
            final_state = decision.current_state
            success = True
            break
        
        if decision.action == OrchestratorActionType.STUCK:
            print(f"  ✗ Stuck: {decision.reasoning}")
            steps.append(AutoStepResult(
                step_number=step_num,
                current_state=decision.current_state,
                action="stuck",
                target=None,
                value=None,
                reasoning=decision.reasoning,
                success=False,
                error="Agent is stuck and cannot proceed"
            ))
            final_state = decision.current_state
            break
        
        # Handle wait action
        if decision.action == OrchestratorActionType.WAIT:
            wait_time = float(decision.value) if decision.value else 1.0
            print(f"  ⏳ Waiting {wait_time}s...")
            time.sleep(wait_time)
            steps.append(AutoStepResult(
                step_number=step_num,
                current_state=decision.current_state,
                action="wait",
                value=str(wait_time),
                reasoning=decision.reasoning,
                success=True
            ))
            # Build rich history entry with observation and learning
            history_entry = f"waited {wait_time}s | saw: {decision.current_state}"
            if decision.learning:
                history_entry += f" | learned: {decision.learning}"
            previous_actions.append(history_entry)
            final_state = decision.current_state
            continue
        
        # For click/type/scroll, we need to find the element first
        step_result = AutoStepResult(
            step_number=step_num,
            current_state=decision.current_state,
            action=decision.action.value,
            target=decision.target,
            value=decision.value,
            reasoning=decision.reasoning,
            success=False
        )
        
        # SPECIAL HANDLING FOR SCROLL: Always use window center for reliable scrolling
        if decision.action == OrchestratorActionType.SCROLL:
            # Calculate the center of the window for scrolling
            # This is more reliable than trying to find "document" or generic scroll targets
            global_x = window.bounds.left + (window.bounds.width // 2)
            global_y = window.bounds.top + (window.bounds.height // 2)
            step_result.coordinates = [global_x, global_y]
            print(f"  Scrolling at window center: ({global_x}, {global_y})")
            
            try:
                # Helper to build rich history entry
                def build_history_entry_scroll(action_desc: str) -> str:
                    entry = f"{action_desc} | saw: {decision.current_state}"
                    if decision.learning:
                        entry += f" | learned: {decision.learning}"
                    return entry
                
                action_result = execute_action(
                    action_type=ActionType.SCROLL,
                    x=global_x,
                    y=global_y,
                    scroll_direction=decision.value or "down"
                )
                previous_actions.append(build_history_entry_scroll(f"scrolled {decision.value} at center of screen"))
                
                if action_result.get("success"):
                    step_result.success = True
                    print(f"  ✓ Scroll completed")
                else:
                    step_result.error = action_result.get("error", "Unknown error")
                    print(f"  ✗ Scroll failed: {step_result.error}")
            except Exception as e:
                step_result.error = str(e)
                print(f"  ✗ Exception: {e}")
            
            steps.append(step_result)
            final_state = decision.current_state
            
            # Check for scroll loop
            is_loop, pattern = detect_loop("scroll", decision.value or "down")
            if is_loop:
                loop_warning = f"🚨 LOOP DETECTED ({pattern}): You've scrolled {decision.value or 'down'} {LOOP_THRESHOLD} times! STOP scrolling and try a COMPLETELY DIFFERENT approach - look for navigation elements or click something visible NOW."
                previous_actions.append(loop_warning)
                print(f"  ⚠️ Scroll loop detected! Pattern: {pattern}")
            
            time.sleep(0.5)
            continue
        
        if decision.target:
            # Use VisionAgent to find the element (for click/type actions)
            detection = vision.detect(screenshot_bytes, decision.target)
            
            if detection is None:
                print(f"  ✗ Could not find: {decision.target}")
                step_result.error = f"Element not found: {decision.target}"
                steps.append(step_result)
                # Build rich history entry with what was seen and what failed
                history_entry = f"FAILED to find '{decision.target}' | saw: {decision.current_state}"
                if decision.learning:
                    history_entry += f" | learned: {decision.learning}"
                previous_actions.append(history_entry)
                final_state = decision.current_state
                continue
            
            # Calculate coordinates
            # Use slight upward offset (-0.2) for clicks to hit top portion of elements
            # This helps with search bars, buttons, etc. where clickable area is smaller
            y_offset = -0.2 if decision.action == OrchestratorActionType.CLICK else 0.0
            
            global_x, global_y = calculate_screen_coordinates(
                detection=detection,
                window_left=window.bounds.left,
                window_top=window.bounds.top,
                window_width=window.bounds.width,
                window_height=window.bounds.height,
                screenshot_width=screenshot_width,
                screenshot_height=screenshot_height,
                y_offset_ratio=y_offset
            )
            
            step_result.coordinates = [global_x, global_y]
            print(f"  Found at: ({global_x}, {global_y}) [y_offset: {y_offset}]")
            
            # Execute the action
            try:
                # Helper to build rich history entry
                def build_history_entry(action_desc: str) -> str:
                    entry = f"{action_desc} | saw: {decision.current_state}"
                    if decision.learning:
                        entry += f" | learned: {decision.learning}"
                    return entry
                
                if decision.action == OrchestratorActionType.CLICK:
                    action_result = execute_action(
                        action_type=ActionType.CLICK,
                        x=global_x,
                        y=global_y
                    )
                    previous_actions.append(build_history_entry(f"clicked '{decision.target}'"))
                    
                elif decision.action == OrchestratorActionType.TYPE:
                    action_result = execute_action(
                        action_type=ActionType.TYPE,
                        x=global_x,
                        y=global_y,
                        text=decision.value or ""
                    )
                    previous_actions.append(build_history_entry(f"typed '{decision.value}' in '{decision.target}'"))
                    
                # Note: SCROLL is handled separately above (uses window center)
                else:
                    action_result = {"success": False, "error": f"Unknown action: {decision.action}"}
                
                if action_result.get("success"):
                    step_result.success = True
                    print(f"  ✓ Action completed")
                else:
                    step_result.error = action_result.get("error", "Unknown error")
                    print(f"  ✗ Action failed: {step_result.error}")
                    
            except Exception as e:
                step_result.error = str(e)
                print(f"  ✗ Exception: {e}")
        else:
            step_result.error = "No target specified for action"
            print(f"  ✗ No target specified")
        
        steps.append(step_result)
        final_state = decision.current_state
        
        # Check for loop detection
        is_loop, pattern = detect_loop(decision.action.value, decision.target or "")
        if is_loop:
            # Special handling for shopping flows
            if "add" in (decision.target or "").lower() and "bag" in (decision.target or "").lower():
                loop_warning = f"🚨 CRITICAL LOOP ({pattern}): You've clicked 'Add to Bag' type buttons {LOOP_THRESHOLD}+ times! The item IS ADDED. NOW you MUST click the BAG/CART ICON in the TOP NAVIGATION or HEADER - NOT another 'Add to Bag' button! Look for a bag icon 🛒 in the top-right corner or bottom navigation bar."
            else:
                loop_warning = f"🚨 LOOP DETECTED ({pattern}): You've done '{decision.action.value}' on similar targets {LOOP_THRESHOLD} times! STOP and try a COMPLETELY DIFFERENT approach. Look for NAVIGATION elements (icons in header/footer) instead of repeating the same action."
            previous_actions.append(loop_warning)
            print(f"  ⚠️ Loop detected! Pattern: {pattern}")
        
        # Wait for UI to update
        time.sleep(0.5)
    
    # 6. Determine final status
    if success:
        status = "success"
    elif len(steps) >= request.max_steps:
        status = "max_steps_reached"
    elif any(s.success for s in steps):
        status = "partial"
    else:
        status = "failed"
    
    print(f"\n{'='*60}")
    print(f"Auto execution complete: {status}")
    print(f"Steps taken: {len(steps)}/{request.max_steps}")
    print(f"{'='*60}\n")
    
    return AutoResponse(
        status=status,
        goal=request.instruction,
        success=success,
        steps_taken=len(steps),
        max_steps=request.max_steps,
        final_state=final_state,
        steps=steps
    )


# =============================================================================
# SSE Streaming Endpoint
# =============================================================================

@app.post("/auto/stream")
async def auto_execute_stream(request: AutoRequest):
    """
    SSE streaming version of /auto endpoint.
    
    Streams step-by-step updates as the agent executes.
    Each event is a JSON object with event type and data.
    
    Event types:
    - "start": Execution started
    - "step": A step was executed
    - "complete": Execution finished successfully
    - "error": An error occurred
    """
    
    async def event_generator():
        # 1. Resolve window if not provided
        window_title = request.window_title
        
        if not window_title:
            yield f"data: {json.dumps({'event': 'status', 'message': 'Resolving target window...'})}\n\n"
            await asyncio.sleep(0)
            
            try:
                resolver = WindowResolverAgent()
                all_windows = list_windows()
                
                windows_for_resolver = [
                    {"title": w.title, "app_name": w.app_name}
                    for w in all_windows
                ]
                
                match = resolver.resolve(request.instruction, windows_for_resolver)
                
                if match:
                    window_title = match.window_title
                    yield f"data: {json.dumps({'event': 'status', 'message': f'Target window: {window_title}'})}\n\n"
                else:
                    yield f"data: {json.dumps({'event': 'error', 'message': 'Could not determine target window'})}\n\n"
                    return
            except Exception as e:
                yield f"data: {json.dumps({'event': 'error', 'message': f'Window resolution failed: {str(e)}'})}\n\n"
                return
        
        # 2. Find the window
        window = get_window_by_title(window_title)
        if not window:
            yield f"data: {json.dumps({'event': 'error', 'message': f'Window not found: {window_title}'})}\n\n"
            return
        
        # 3. Initialize agents
        try:
            orchestrator = OrchestratorAgent()
            vision = VisionAgent()
        except ValueError as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
            return
        
        # 4. Activate window
        activate_window(window)
        
        # 5. Send start event
        yield f"data: {json.dumps({'event': 'start', 'goal': request.instruction, 'window': window_title, 'max_steps': request.max_steps})}\n\n"
        await asyncio.sleep(0)
        
        # 6. Run the reactive loop
        steps = []
        previous_actions = []
        final_state = "Unknown"
        success = False
        
        # Loop detection
        recent_actions = []
        LOOP_THRESHOLD = 3
        
        def detect_loop(action: str, target: str) -> tuple[bool, str]:
            """Check if we're stuck in a loop doing similar actions."""
            recent_actions.append((action, target.lower() if target else ""))
            if len(recent_actions) > LOOP_THRESHOLD:
                recent_actions.pop(0)
            
            if len(recent_actions) >= LOOP_THRESHOLD:
                actions_only = [a[0] for a in recent_actions]
                if len(set(actions_only)) == 1:
                    targets = [a[1] for a in recent_actions]
                    if len(set(targets)) == 1:
                        return True, f"exact: {action} on '{target}'"
                    keywords = ["add to bag", "add to cart", "buy now", "add", "remove"]
                    for kw in keywords:
                        if all(kw in t for t in targets):
                            return True, f"similar: targets contain '{kw}'"
            return False, ""
        
        for step_num in range(1, request.max_steps + 1):
            # Capture screenshot
            try:
                screenshot_bytes = capture_window(window)
                screenshot_width, screenshot_height = get_screenshot_dimensions(window)
            except Exception as e:
                step_data = {
                    'step_number': step_num,
                    'action': 'error',
                    'success': False,
                    'error': str(e),
                    'current_state': 'Failed to capture screenshot'
                }
                yield f"data: {json.dumps({'event': 'step', 'step': step_data})}\n\n"
                break
            
            # Get orchestrator decision
            decision = orchestrator.analyze_and_decide(
                screenshot_bytes=screenshot_bytes,
                goal=request.instruction,
                previous_actions=previous_actions
            )
            
            # Check terminal states
            if decision.goal_complete or decision.action == OrchestratorActionType.DONE:
                step_data = {
                    'step_number': step_num,
                    'action': 'done',
                    'target': None,
                    'value': None,
                    'reasoning': decision.reasoning,
                    'current_state': decision.current_state,
                    'success': True
                }
                yield f"data: {json.dumps({'event': 'step', 'step': step_data})}\n\n"
                final_state = decision.current_state
                success = True
                break
            
            if decision.action == OrchestratorActionType.STUCK:
                step_data = {
                    'step_number': step_num,
                    'action': 'stuck',
                    'target': None,
                    'value': None,
                    'reasoning': decision.reasoning,
                    'current_state': decision.current_state,
                    'success': False,
                    'error': 'Agent is stuck'
                }
                yield f"data: {json.dumps({'event': 'step', 'step': step_data})}\n\n"
                final_state = decision.current_state
                break
            
            # Handle wait action
            if decision.action == OrchestratorActionType.WAIT:
                wait_time = float(decision.value) if decision.value else 1.0
                step_data = {
                    'step_number': step_num,
                    'action': 'wait',
                    'value': str(wait_time),
                    'reasoning': decision.reasoning,
                    'current_state': decision.current_state,
                    'success': True
                }
                yield f"data: {json.dumps({'event': 'step', 'step': step_data})}\n\n"
                await asyncio.sleep(wait_time)
                
                history_entry = f"waited {wait_time}s | saw: {decision.current_state}"
                if decision.learning:
                    history_entry += f" | learned: {decision.learning}"
                previous_actions.append(history_entry)
                final_state = decision.current_state
                continue
            
            # Initialize step result
            step_data = {
                'step_number': step_num,
                'action': decision.action.value,
                'target': decision.target,
                'value': decision.value,
                'reasoning': decision.reasoning,
                'current_state': decision.current_state,
                'success': False
            }
            
            # Handle scroll at window center
            if decision.action == OrchestratorActionType.SCROLL:
                global_x = window.bounds.left + (window.bounds.width // 2)
                global_y = window.bounds.top + (window.bounds.height // 2)
                step_data['coordinates'] = [global_x, global_y]
                
                try:
                    action_result = execute_action(
                        action_type=ActionType.SCROLL,
                        x=global_x,
                        y=global_y,
                        scroll_direction=decision.value or "down"
                    )
                    
                    history_entry = f"scrolled {decision.value} at center | saw: {decision.current_state}"
                    if decision.learning:
                        history_entry += f" | learned: {decision.learning}"
                    previous_actions.append(history_entry)
                    
                    if action_result.get("success"):
                        step_data['success'] = True
                    else:
                        step_data['error'] = action_result.get("error", "Unknown error")
                except Exception as e:
                    step_data['error'] = str(e)
                
                yield f"data: {json.dumps({'event': 'step', 'step': step_data})}\n\n"
                final_state = decision.current_state
                
                is_loop, pattern = detect_loop("scroll", decision.value or "down")
                if is_loop:
                    previous_actions.append(f"🚨 LOOP ({pattern}): Scrolled {LOOP_THRESHOLD}x - STOP and try clicking visible elements or navigation")
                
                await asyncio.sleep(0.5)
                continue
            
            # For click/type, find element first
            if decision.target:
                detection = vision.detect(screenshot_bytes, decision.target)
                
                if detection is None:
                    step_data['error'] = f"Element not found: {decision.target}"
                    yield f"data: {json.dumps({'event': 'step', 'step': step_data})}\n\n"
                    
                    history_entry = f"FAILED to find '{decision.target}' | saw: {decision.current_state}"
                    if decision.learning:
                        history_entry += f" | learned: {decision.learning}"
                    previous_actions.append(history_entry)
                    final_state = decision.current_state
                    await asyncio.sleep(0.3)
                    continue
                
                # Calculate coordinates
                y_offset = -0.2 if decision.action == OrchestratorActionType.CLICK else 0.0
                
                global_x, global_y = calculate_screen_coordinates(
                    detection=detection,
                    window_left=window.bounds.left,
                    window_top=window.bounds.top,
                    window_width=window.bounds.width,
                    window_height=window.bounds.height,
                    screenshot_width=screenshot_width,
                    screenshot_height=screenshot_height,
                    y_offset_ratio=y_offset
                )
                
                step_data['coordinates'] = [global_x, global_y]
                
                # Execute action
                try:
                    def build_history(action_desc):
                        entry = f"{action_desc} | saw: {decision.current_state}"
                        if decision.learning:
                            entry += f" | learned: {decision.learning}"
                        return entry
                    
                    if decision.action == OrchestratorActionType.CLICK:
                        action_result = execute_action(
                            action_type=ActionType.CLICK,
                            x=global_x,
                            y=global_y
                        )
                        previous_actions.append(build_history(f"clicked '{decision.target}'"))
                        
                    elif decision.action == OrchestratorActionType.TYPE:
                        action_result = execute_action(
                            action_type=ActionType.TYPE,
                            x=global_x,
                            y=global_y,
                            text=decision.value or ""
                        )
                        previous_actions.append(build_history(f"typed '{decision.value}' in '{decision.target}'"))
                    else:
                        action_result = {"success": False, "error": f"Unknown action"}
                    
                    if action_result.get("success"):
                        step_data['success'] = True
                    else:
                        step_data['error'] = action_result.get("error", "Unknown error")
                        
                except Exception as e:
                    step_data['error'] = str(e)
            else:
                step_data['error'] = "No target specified"
            
            yield f"data: {json.dumps({'event': 'step', 'step': step_data})}\n\n"
            final_state = decision.current_state
            
            # Loop detection
            is_loop, pattern = detect_loop(decision.action.value, decision.target or "")
            if is_loop:
                if "add" in (decision.target or "").lower() and "bag" in (decision.target or "").lower():
                    previous_actions.append(f"🚨 CRITICAL: Item IS added! NOW click BAG/CART ICON in TOP NAVIGATION - NOT 'Add to Bag'!")
                else:
                    previous_actions.append(f"🚨 LOOP ({pattern}): STOP repeating! Try NAVIGATION elements (header/footer icons)")
            
            await asyncio.sleep(0.5)
        
        # Determine final status
        steps_taken = step_num
        if success:
            status = "success"
        elif steps_taken >= request.max_steps:
            status = "max_steps_reached"
        else:
            status = "failed"
        
        # Send complete event
        yield f"data: {json.dumps({'event': 'complete', 'status': status, 'success': success, 'steps_taken': steps_taken, 'final_state': final_state})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# =============================================================================
# Feature Context API (for Test Generation)
# =============================================================================

class CreateContextRequest(BaseModel):
    """Request to create a new feature context."""
    name: str
    description: str = ""


class AddTextRequest(BaseModel):
    """Request to add text notes to a context."""
    text: str
    source_name: str = "user_notes"


@app.post("/feature/create")
async def create_feature_context(request: CreateContextRequest):
    """
    Create a new feature context for test generation.
    
    Returns the context ID to use for adding inputs.
    """
    context = get_context_builder().create_context(request.name, request.description)
    return {
        "success": True,
        "context_id": context.id,
        "name": context.name,
        "created_at": context.created_at
    }


@app.get("/feature/list")
async def list_feature_contexts():
    """List all feature contexts."""
    return {
        "success": True,
        "contexts": get_context_builder().list_contexts()
    }


@app.get("/feature/{context_id}")
async def get_feature_context(context_id: str):
    """Get a feature context by ID."""
    context = get_context_builder().get_context(context_id)
    if not context:
        raise HTTPException(status_code=404, detail=f"Context not found: {context_id}")
    
    return {
        "success": True,
        "context": context.to_dict()
    }


@app.delete("/feature/{context_id}")
async def delete_feature_context(context_id: str):
    """Delete a feature context."""
    deleted = get_context_builder().delete_context(context_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Context not found: {context_id}")
    
    return {"success": True, "message": f"Context {context_id} deleted"}


@app.post("/feature/{context_id}/image")
async def add_image_to_context(
    context_id: str,
    file: UploadFile = File(...),
    additional_context: str = Form("")
):
    """
    Add an image (Figma design, screenshot, etc.) to a feature context.
    
    The image will be analyzed by AI to extract UI elements.
    """
    try:
        context = get_context_builder().get_context(context_id)
        if not context:
            raise HTTPException(status_code=404, detail=f"Context not found: {context_id}")
        
        image_bytes = await file.read()
        
        item = get_context_builder().add_image(
            context_id=context_id,
            image_bytes=image_bytes,
            source_name=file.filename or "uploaded_image",
            additional_context=additional_context
        )
        
        if not item:
            raise HTTPException(status_code=500, detail="Failed to process image")
        
        return {
            "success": True,
            "item_id": item.id,
            "source_name": item.source_name,
            "extracted": item.extracted
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feature/{context_id}/document")
async def add_document_to_context(
    context_id: str,
    file: UploadFile = File(...),
    additional_context: str = Form("")
):
    """
    Add a document (PRD PDF/DOCX, text file) to a feature context.
    
    The document will be analyzed to extract requirements.
    """
    try:
        context = get_context_builder().get_context(context_id)
        if not context:
            raise HTTPException(status_code=404, detail=f"Context not found: {context_id}")
        
        doc_bytes = await file.read()
        filename = file.filename or "document"
        
        # Determine file type
        if filename.endswith(".pdf"):
            file_type = "pdf"
        elif filename.endswith(".docx"):
            file_type = "docx"
        elif filename.endswith(".txt"):
            file_type = "txt"
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Use .pdf, .docx, or .txt"
            )
        
        item = get_context_builder().add_document(
            context_id=context_id,
            document_bytes=doc_bytes,
            source_name=filename,
            file_type=file_type,
            additional_context=additional_context
        )
        
        if not item:
            raise HTTPException(status_code=500, detail="Failed to process document")
        
        return {
            "success": True,
            "item_id": item.id,
            "source_name": item.source_name,
            "extracted": item.extracted
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feature/{context_id}/video")
async def add_video_to_context(
    context_id: str,
    file: UploadFile = File(...),
    additional_context: str = Form("")
):
    """
    Add a video (screen recording) to a feature context.
    
    The video will be analyzed to extract user flow steps.
    """
    try:
        context = get_context_builder().get_context(context_id)
        if not context:
            raise HTTPException(status_code=404, detail=f"Context not found: {context_id}")
        
        video_bytes = await file.read()
        
        item = get_context_builder().add_video(
            context_id=context_id,
            video_bytes=video_bytes,
            source_name=file.filename or "recording.mp4",
            additional_context=additional_context
        )
        
        if not item:
            raise HTTPException(status_code=500, detail="Failed to process video")
        
        return {
            "success": True,
            "item_id": item.id,
            "source_name": item.source_name,
            "extracted": item.extracted
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feature/{context_id}/text")
async def add_text_to_context(context_id: str, request: AddTextRequest):
    """
    Add text notes to a feature context.
    
    Use this for user descriptions, acceptance criteria, notes, etc.
    """
    try:
        context = get_context_builder().get_context(context_id)
        if not context:
            raise HTTPException(status_code=404, detail=f"Context not found: {context_id}")
        
        item = get_context_builder().add_text(
            context_id=context_id,
            text=request.text,
            source_name=request.source_name
        )
        
        return {
            "success": True,
            "item_id": item.id,
            "source_name": item.source_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/feature/{context_id}/status")
async def update_context_status(context_id: str, status: str):
    """Update the status of a feature context."""
    valid_statuses = ["draft", "ready", "processing", "completed"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Use one of: {valid_statuses}"
        )
    
    updated = get_context_builder().update_status(context_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Context not found: {context_id}")
    
    return {"success": True, "status": status}


class BuildContextRequest(BaseModel):
    """Request to build context with optional feedback."""
    user_feedback: str = ""


@app.post("/feature/{context_id}/build-context")
async def build_context(context_id: str, request: BuildContextRequest = None):
    """
    Process all uploaded items and build the unified context.
    
    This processes images, documents, and videos with AI to extract
    structured information. Returns a summary of what was understood.
    
    If user_feedback is provided, the context will be regenerated with corrections.
    """
    try:
        feedback = request.user_feedback if request else ""
        result = get_context_builder().build_context(context_id, feedback)
        
        message = "Context built successfully. Review the summary and generate test cases."
        if feedback:
            message = "Context regenerated with your feedback. Review the updated summary."
        
        return {
            "success": True,
            "context_id": context_id,
            "feature_name": result.get("feature_name"),
            "summary": result.get("summary"),
            "processed_items": result.get("processed_items"),
            "status": result.get("status"),
            "has_feedback": result.get("has_feedback", False),
            "message": message
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feature/{context_id}/generate-plan")
async def generate_test_plan(context_id: str):
    """
    Generate text-based test cases for user review.
    
    This analyzes the processed context and creates human-readable test cases.
    User should review these before approving for executable generation.
    """
    try:
        result = get_context_builder().generate_test_plan(context_id)
        
        return {
            "success": True,
            "context_id": context_id,
            "feature_name": result.get("feature_name"),
            "feature_summary": result.get("feature_summary"),
            "test_count": len(result.get("test_cases", [])),
            "test_cases": result.get("test_cases", []),
            "coverage_notes": result.get("coverage_notes", ""),
            "status": result.get("status"),
            "message": "Test plan generated. Please review and approve to generate executable tests."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ApproveTestsRequest(BaseModel):
    """Request to approve test cases."""
    approved_test_ids: list = None  # If None, approve all


@app.post("/feature/{context_id}/approve-tests")
async def approve_and_generate(context_id: str, request: ApproveTestsRequest = None):
    """
    Step 2: Approve test cases and generate executable JSON.
    
    After user reviews the test plan, call this to generate the executable steps.
    Optionally pass specific test IDs to include only those.
    """
    try:
        approved_ids = request.approved_test_ids if request else None
        result = get_context_builder().approve_and_generate_executable(context_id, approved_ids)
        
        return {
            "success": True,
            "context_id": context_id,
            "feature_name": result.get("feature_name"),
            "test_count": len(result.get("test_cases", [])),
            "test_cases": result.get("test_cases", []),
            "executable_tests": result.get("executable_tests", []),
            "status": result.get("status"),
            "message": "Executable tests generated. Ready for execution."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdateTestCaseRequest(BaseModel):
    """Request to update a test case."""
    name: str = None
    description: str = None
    steps: list = None
    excluded: bool = None


@app.patch("/feature/{context_id}/tests/{test_id}")
async def update_test_case(context_id: str, test_id: str, request: UpdateTestCaseRequest):
    """
    Update a specific test case before approval.
    
    Allows user to modify test name, steps, or mark as excluded.
    """
    try:
        updates = {k: v for k, v in request.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        result = get_context_builder().update_test_case(context_id, test_id, updates)
        
        return {
            "success": True,
            "context_id": context_id,
            "test_id": test_id,
            "message": "Test case updated"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/feature/{context_id}/tests")
async def get_test_plan(context_id: str):
    """
    Get the test plan (text test cases and optionally executable tests).
    """
    tests = get_context_builder().get_test_plan(context_id)
    if not tests:
        raise HTTPException(
            status_code=404, 
            detail=f"No test plan found for context {context_id}. Generate test plan first."
        )
    
    return {
        "success": True,
        **tests
    }


# =============================================================================
# TEST EXECUTION WITH SSE STREAMING
# =============================================================================

class ExecuteTestsRequest(BaseModel):
    """Request to execute generated tests."""
    window_title: str
    test_ids: list = None  # If None, execute all tests


@app.post("/feature/{context_id}/execute")
async def execute_tests_stream(context_id: str, request: ExecuteTestsRequest):
    """
    Execute generated tests on a target window with SSE streaming.
    
    Streams events:
    - suite_start: Test suite execution started
    - test_start: Individual test started
    - step: Test step executed
    - test_complete: Individual test completed
    - suite_complete: All tests finished
    - error: Error occurred
    """
    # Load test plan
    tests_data = get_context_builder().get_test_plan(context_id)
    if not tests_data:
        raise HTTPException(status_code=404, detail="No test plan found")
    
    if tests_data.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Tests not approved yet. Approve tests first.")
    
    executable_tests = tests_data.get("executable_tests", [])
    if not executable_tests:
        raise HTTPException(status_code=400, detail="No executable tests found")
    
    # Filter to requested tests if specified
    if request.test_ids:
        executable_tests = [t for t in executable_tests if t.get("test_id") in request.test_ids]
    
    # Validate window
    window = get_window_by_title(request.window_title)
    if not window:
        raise HTTPException(status_code=404, detail=f"Window not found: {request.window_title}")
    
    async def execute_test_suite():
        """Generator that executes tests and yields SSE events."""
        # Initialize agents
        vision_agent = VisionAgent()
        orchestrator = OrchestratorAgent()
        
        # Suite start event
        yield f"data: {json.dumps({'event': 'suite_start', 'context_id': context_id, 'window': request.window_title, 'total_tests': len(executable_tests)})}\n\n"
        
        suite_results = {
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "test_results": []
        }
        
        for test_idx, test in enumerate(executable_tests):
            test_id = test.get("test_id", f"TC-{test_idx+1}")
            test_title = test.get("title", "Unknown Test")
            
            # Skip tests with conversion errors
            if "error" in test:
                yield f"data: {json.dumps({'event': 'test_skip', 'test_id': test_id, 'reason': test.get('error')})}\n\n"
                suite_results["skipped"] += 1
                suite_results["test_results"].append({
                    "test_id": test_id,
                    "status": "skipped",
                    "reason": test.get("error")
                })
                continue
            
            # Test start
            yield f"data: {json.dumps({'event': 'test_start', 'test_id': test_id, 'title': test_title, 'test_number': test_idx + 1, 'total_tests': len(executable_tests), 'starting_state': test.get('starting_state', ''), 'ending_state': test.get('ending_state', '')})}\n\n"
            
            test_passed = True
            test_steps_results = []
            
            # Execute all steps (setup + test + cleanup)
            all_steps = []
            for step in test.get("setup_steps", []):
                step["phase"] = "setup"
                all_steps.append(step)
            for step in test.get("test_steps", []):
                step["phase"] = "test"
                all_steps.append(step)
            for step in test.get("cleanup_steps", []):
                step["phase"] = "cleanup"
                all_steps.append(step)
            
            for step_idx, step in enumerate(all_steps):
                step_number = step.get("step_number", step_idx + 1)
                action = step.get("action", "unknown")
                target = step.get("target", "")
                value = step.get("value", "")
                verification = step.get("verification", "")
                phase = step.get("phase", "test")
                
                # Step start event
                yield f"data: {json.dumps({'event': 'step_start', 'test_id': test_id, 'step_number': step_number, 'phase': phase, 'action': action, 'target': target})}\n\n"
                
                try:
                    # Activate window
                    activate_window(request.window_title)
                    await asyncio.sleep(0.3)
                    
                    # Capture screenshot
                    screenshot = capture_window(request.window_title)
                    if not screenshot:
                        raise Exception("Failed to capture window")
                    
                    screenshot_b64 = image_to_base64(screenshot)
                    
                    # Execute based on action type
                    step_success = True
                    step_error = None
                    coordinates = None
                    
                    if action in ["click", "tap"]:
                        # Find element and click
                        detection = vision_agent.detect(screenshot_b64, target)
                        if detection and detection.get("found"):
                            bounds = window["bounds"]
                            scale = get_screenshot_dimensions(screenshot, bounds)
                            coords = calculate_screen_coordinates(
                                detection.get("bounding_box", [0, 0, 0, 0]),
                                bounds,
                                scale,
                                y_offset_ratio=-0.2
                            )
                            coordinates = [coords["global_x"], coords["global_y"]]
                            
                            execute_action(ActionType.CLICK, x=coords["global_x"], y=coords["global_y"])
                            await asyncio.sleep(0.5)
                        else:
                            step_success = False
                            step_error = f"Element not found: {target}"
                    
                    elif action == "type":
                        # Find input and type
                        detection = vision_agent.detect(screenshot_b64, target)
                        if detection and detection.get("found"):
                            bounds = window["bounds"]
                            scale = get_screenshot_dimensions(screenshot, bounds)
                            coords = calculate_screen_coordinates(
                                detection.get("bounding_box", [0, 0, 0, 0]),
                                bounds,
                                scale,
                                y_offset_ratio=-0.2
                            )
                            coordinates = [coords["global_x"], coords["global_y"]]
                            
                            execute_action(ActionType.CLICK, x=coords["global_x"], y=coords["global_y"])
                            await asyncio.sleep(0.3)
                            execute_action(ActionType.TYPE, text=value)
                            await asyncio.sleep(0.3)
                        else:
                            step_success = False
                            step_error = f"Input not found: {target}"
                    
                    elif action == "scroll":
                        bounds = window["bounds"]
                        center_x = bounds["left"] + bounds["width"] // 2
                        center_y = bounds["top"] + bounds["height"] // 2
                        coordinates = [center_x, center_y]
                        
                        direction = value.lower() if value else "down"
                        clicks = 10 if direction in ["down", "right"] else -10
                        execute_action(ActionType.SCROLL, x=center_x, y=center_y, clicks=clicks)
                        await asyncio.sleep(0.5)
                    
                    elif action == "back":
                        # Use keyboard shortcut or find back button
                        import pyautogui
                        pyautogui.press("escape")
                        await asyncio.sleep(0.5)
                    
                    elif action == "wait":
                        await asyncio.sleep(2)
                    
                    elif action == "verify":
                        # Capture new screenshot and verify element exists
                        new_screenshot = capture_window(request.window_title)
                        if new_screenshot:
                            new_b64 = image_to_base64(new_screenshot)
                            detection = vision_agent.detect(new_b64, target)
                            if not (detection and detection.get("found")):
                                step_success = False
                                step_error = f"Verification failed: {target} not found"
                    
                    # Step complete event
                    step_result = {
                        "step_number": step_number,
                        "phase": phase,
                        "action": action,
                        "target": target,
                        "success": step_success,
                        "coordinates": coordinates,
                        "error": step_error
                    }
                    test_steps_results.append(step_result)
                    
                    yield f"data: {json.dumps({'event': 'step_complete', 'test_id': test_id, **step_result})}\n\n"
                    
                    if not step_success:
                        test_passed = False
                        # Continue with cleanup steps even if test fails
                        if phase != "cleanup":
                            # Skip remaining test steps, jump to cleanup
                            break
                    
                except Exception as e:
                    step_result = {
                        "step_number": step_number,
                        "phase": phase,
                        "action": action,
                        "target": target,
                        "success": False,
                        "error": str(e)
                    }
                    test_steps_results.append(step_result)
                    
                    yield f"data: {json.dumps({'event': 'step_error', 'test_id': test_id, **step_result})}\n\n"
                    test_passed = False
                    break
            
            # Test complete event
            test_status = "passed" if test_passed else "failed"
            if test_passed:
                suite_results["passed"] += 1
            else:
                suite_results["failed"] += 1
            
            test_result = {
                "test_id": test_id,
                "title": test_title,
                "status": test_status,
                "steps": test_steps_results
            }
            suite_results["test_results"].append(test_result)
            
            yield f"data: {json.dumps({'event': 'test_complete', 'test_id': test_id, 'status': test_status, 'steps_executed': len(test_steps_results)})}\n\n"
            
            # Small delay between tests
            await asyncio.sleep(1)
        
        # Suite complete event
        yield f"data: {json.dumps({'event': 'suite_complete', 'passed': suite_results['passed'], 'failed': suite_results['failed'], 'skipped': suite_results['skipped'], 'total': len(executable_tests)})}\n\n"
    
    return StreamingResponse(
        execute_test_suite(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    
    print(f"""
    ╔════════════════════════════════════════════════════╗
    ║               AutoQA Server                        ║
    ║       Visual QA Agent - Backend v3.0               ║
    ╠════════════════════════════════════════════════════╣
    ║  Test Execution (Reactive):                        ║
    ║    POST /auto       - Adaptive orchestrator        ║
    ║    GET  /auto/stream - SSE streaming               ║
    ║                                                    ║
    ║  Feature Context (Test Generation):                ║
    ║    POST /feature/create    - New context           ║
    ║    GET  /feature/list      - List contexts         ║
    ║    GET  /feature/:id       - Get context           ║
    ║    POST /feature/:id/image - Add image             ║
    ║    POST /feature/:id/document - Add doc            ║
    ║    POST /feature/:id/video - Add video             ║
    ║    POST /feature/:id/text  - Add notes             ║
    ║                                                    ║
    ║  Utilities:                                        ║
    ║    GET  /windows    - List windows                 ║
    ║    GET  /permissions - Check perms                 ║
    ║                                                    ║
    ║  Press Ctrl+C twice to force quit                  ║
    ╚════════════════════════════════════════════════════╝
    """)
    
    try:
        # Run with uvicorn
        config = uvicorn.Config(
            "main:app",
            host=host,
            port=port,
            reload=False,
            timeout_keep_alive=5,
            log_level="info"
        )
        server = uvicorn.Server(config)
        server.run()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped.")
        sys.exit(0)
