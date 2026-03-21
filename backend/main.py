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
from pathlib import Path
from dotenv import load_dotenv

# Load env vars BEFORE importing cloud_client so CLOUD_API_URL is available at module level
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi import File, UploadFile, Form

import pyautogui
from actions import ActionType, execute_action, human_click, human_scroll
from context_builder import get_context_builder
from models.context import ContextType
from agents import VisionAgent, PlannerAgent, WindowResolverAgent, OrchestratorAgent, ImageContextRetrieverAgent, TestPlannerAgent
from agents.computer_use_agent import ComputerUseAgent
from agents.claude_computer_use_agent import ClaudeComputerUseAgent
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
from cloud_client import (
    is_configured as cloud_is_configured,
    auth_login as cloud_auth_login,
    auth_register as cloud_auth_register,
    auth_me as cloud_auth_me,
    list_projects as cloud_list_projects,
    create_project as cloud_create_project,
    get_project as cloud_get_project,
    update_project as cloud_update_project,
    delete_project as cloud_delete_project,
    list_context_items as cloud_list_context_items,
    save_context_items_batch as cloud_save_context_items_batch,
    save_test_cases_bulk as cloud_save_test_cases_bulk,
    list_test_cases_by_feature as cloud_list_test_cases,
    create_test_run as cloud_create_test_run,
    update_test_run as cloud_update_test_run,
    create_test_result as cloud_create_test_result,
)


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

# Global store for guidance (context_id:test_id -> list of guidance strings)
guidance_store: dict[str, list[str]] = {}


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


class CURequest(BaseModel):
    """Request body for the /cu/stream endpoint (Computer Use)."""
    instruction: str
    window_title: Optional[str] = None
    max_steps: int = 25


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
# Projects (proxy to cloud when CLOUD_API_URL + token; requires auth)
# =============================================================================

class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


def _get_bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthRegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "AutoQA", "version": "1.0.0"}


# ─── Auth (proxy to cloud) ───────────────────────────────────────────────────
@app.post("/auth/login")
async def auth_login(body: AuthLoginRequest):
    """Login. Requires cloud backend."""
    if not cloud_is_configured():
        raise HTTPException(status_code=503, detail="Cloud backend not configured")
    result = cloud_auth_login(body.email, body.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return result


@app.post("/auth/register")
async def auth_register(body: AuthRegisterRequest):
    """Register. Requires cloud backend."""
    if not cloud_is_configured():
        raise HTTPException(status_code=503, detail="Cloud backend not configured")
    result = cloud_auth_register(body.email, body.password, body.name)
    if not result:
        raise HTTPException(status_code=400, detail="Registration failed (email may already exist)")
    return result


@app.get("/auth/me")
async def auth_me(request: Request):
    """Get current user. Requires Bearer token."""
    token = _get_bearer_token(request)
    if not cloud_is_configured():
        raise HTTPException(status_code=503, detail="Cloud backend not configured")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = cloud_auth_me(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


# ─── Projects (proxy to cloud) ──────────────────────────────────────────────
@app.get("/projects")
async def list_projects(request: Request):
    """List projects. Requires cloud + Bearer token."""
    token = _get_bearer_token(request)
    if not cloud_is_configured():
        return []
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    projects = cloud_list_projects(token=token)
    return projects


@app.post("/projects")
async def create_project(request: Request, body: ProjectCreateRequest):
    """Create project. Requires cloud + Bearer token."""
    token = _get_bearer_token(request)
    if not cloud_is_configured():
        raise HTTPException(status_code=503, detail="Cloud backend not configured")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    project = cloud_create_project(name=body.name, description=body.description, token=token)
    if not project:
        raise HTTPException(status_code=502, detail="Failed to create project")
    return project


@app.get("/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    """Get project by ID. Requires cloud + Bearer token."""
    token = _get_bearer_token(request)
    if not cloud_is_configured():
        raise HTTPException(status_code=503, detail="Cloud backend not configured")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    project = cloud_get_project(project_id, token=token)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.patch("/projects/{project_id}")
async def update_project(project_id: str, request: Request, body: ProjectUpdateRequest):
    """Update project. Requires cloud + Bearer token."""
    token = _get_bearer_token(request)
    if not cloud_is_configured():
        raise HTTPException(status_code=503, detail="Cloud backend not configured")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        project = cloud_get_project(project_id, token=token)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    project = cloud_update_project(project_id, token=token, **updates)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/projects/{project_id}")
async def delete_project(project_id: str, request: Request):
    """Delete project. Requires cloud + Bearer token."""
    token = _get_bearer_token(request)
    if not cloud_is_configured():
        raise HTTPException(status_code=503, detail="Cloud backend not configured")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    ok = cloud_delete_project(project_id, token=token)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


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
# Computer Use Endpoint (Gemini Computer Use Tool)
# =============================================================================

def get_browser_url(app_name: str = "") -> str:
    """Get the current URL from the frontmost browser tab via AppleScript."""
    import subprocess
    browsers = {
        "Google Chrome": 'tell application "Google Chrome" to get URL of active tab of front window',
        "Safari": 'tell application "Safari" to get URL of front document',
        "Arc": 'tell application "Arc" to get URL of active tab of front window',
        "Brave Browser": 'tell application "Brave Browser" to get URL of active tab of front window',
        "Microsoft Edge": 'tell application "Microsoft Edge" to get URL of active tab of front window',
    }
    candidates = [app_name] if app_name in browsers else list(browsers.keys())
    for name in candidates:
        script = browsers.get(name)
        if not script:
            continue
        try:
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True, timeout=2,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except Exception:
            continue
    return ""


def cu_to_global(x_norm: int, y_norm: int, window) -> tuple[int, int]:
    """Convert Computer Use 0-999 normalized coords to global screen coords."""
    global_x = int(window.bounds.left + (x_norm / 1000) * window.bounds.width)
    global_y = int(window.bounds.top + (y_norm / 1000) * window.bounds.height)
    return global_x, global_y


def execute_cu_action(action_name: str, args: dict, window) -> dict:
    """
    Execute a single Computer Use action.

    Returns a result dict to send back as FunctionResponse.
    """
    result = {}

    if action_name == "open_web_browser":
        activate_window(window)

    elif action_name == "wait_5_seconds":
        time.sleep(5)

    elif action_name == "click_at":
        gx, gy = cu_to_global(args["x"], args["y"], window)
        human_click(gx, gy)
        result["coordinates"] = [gx, gy]

    elif action_name == "hover_at":
        gx, gy = cu_to_global(args["x"], args["y"], window)
        pyautogui.moveTo(gx, gy, duration=0.2)
        result["coordinates"] = [gx, gy]

    elif action_name == "type_text_at":
        gx, gy = cu_to_global(args["x"], args["y"], window)
        text = args.get("text", "")
        press_enter = args.get("press_enter", True)
        clear_first = args.get("clear_before_typing", True)

        human_click(gx, gy)
        time.sleep(0.3)

        if clear_first:
            pyautogui.hotkey("command", "a")
            time.sleep(0.1)
            pyautogui.press("backspace")
            time.sleep(0.1)

        pyautogui.write(text, interval=0.03)

        if press_enter:
            time.sleep(0.1)
            pyautogui.press("enter")

        result["coordinates"] = [gx, gy]
        result["text"] = text

    elif action_name == "scroll_document":
        direction = args.get("direction", "down")
        gx = window.bounds.left + window.bounds.width // 2
        gy = window.bounds.top + window.bounds.height // 2
        human_scroll(direction, gx, gy)
        result["direction"] = direction

    elif action_name == "scroll_at":
        gx, gy = cu_to_global(args["x"], args["y"], window)
        direction = args.get("direction", "down")
        magnitude = args.get("magnitude", 800)
        clicks = max(1, int(magnitude / 100))
        human_scroll(direction, gx, gy, clicks=clicks)
        result["coordinates"] = [gx, gy]
        result["direction"] = direction

    elif action_name == "key_combination":
        keys_str = args.get("keys", "")
        keys = [k.strip().lower() for k in keys_str.split("+")]
        key_map = {"control": "ctrl", "meta": "command", "cmd": "command"}
        keys = [key_map.get(k, k) for k in keys]
        if len(keys) == 1:
            pyautogui.press(keys[0])
        else:
            pyautogui.hotkey(*keys)
        result["keys"] = keys_str

    elif action_name == "navigate":
        url = args.get("url", "")
        pyautogui.hotkey("command", "l")
        time.sleep(0.3)
        pyautogui.hotkey("command", "a")
        time.sleep(0.1)
        pyautogui.write(url, interval=0.02)
        time.sleep(0.1)
        pyautogui.press("enter")
        result["url"] = url

    elif action_name == "search":
        pyautogui.hotkey("command", "l")
        time.sleep(0.3)

    elif action_name == "go_back":
        pyautogui.hotkey("command", "[")

    elif action_name == "go_forward":
        pyautogui.hotkey("command", "]")

    elif action_name == "drag_and_drop":
        sx, sy = cu_to_global(args["x"], args["y"], window)
        dx, dy = cu_to_global(args["destination_x"], args["destination_y"], window)
        pyautogui.moveTo(sx, sy, duration=0.2)
        pyautogui.mouseDown()
        time.sleep(0.1)
        pyautogui.moveTo(dx, dy, duration=0.4)
        time.sleep(0.1)
        pyautogui.mouseUp()
        result["from"] = [sx, sy]
        result["to"] = [dx, dy]

    else:
        result["warning"] = f"Unrecognised action: {action_name}"

    return result


@app.post("/cu/stream")
async def computer_use_stream(request: CURequest):
    """
    SSE streaming endpoint using Gemini Computer Use.

    The Computer Use model sees the screenshot and directly outputs actions
    (click_at, type_text_at, scroll, etc.) with exact coordinates — replacing
    the OrchestratorAgent + VisionAgent two-call pattern.

    Event types:
    - "start": Execution started
    - "thinking": Model's reasoning (when available)
    - "action": An action was executed
    - "complete": Execution finished
    - "error": An error occurred
    """

    async def event_generator():
        # 1. Resolve window
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

        # 2. Find and activate window
        window = get_window_by_title(window_title)
        if not window:
            yield f"data: {json.dumps({'event': 'error', 'message': f'Window not found: {window_title}'})}\n\n"
            return

        # 3. Initialise Computer Use agent
        try:
            agent = ComputerUseAgent()
        except ValueError as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
            return

        activate_window(window)
        time.sleep(0.5)

        yield f"data: {json.dumps({'event': 'start', 'goal': request.instruction, 'window': window_title, 'max_steps': request.max_steps, 'model': agent.model})}\n\n"
        await asyncio.sleep(0)

        # 4. Capture initial screenshot and start
        try:
            screenshot_bytes = capture_window(window)
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': f'Screenshot failed: {str(e)}'})}\n\n"
            return

        print(f"[CU] Starting — goal: {request.instruction}")
        cu_response = agent.start(request.instruction, screenshot_bytes)

        step_num = 0

        # 5. Agent loop
        for turn in range(request.max_steps):
            if cu_response.thinking:
                yield f"data: {json.dumps({'event': 'thinking', 'text': cu_response.thinking})}\n\n"
                await asyncio.sleep(0)

            if cu_response.text:
                yield f"data: {json.dumps({'event': 'status', 'message': cu_response.text})}\n\n"
                await asyncio.sleep(0)

            if cu_response.is_done:
                print(f"[CU] Done — {cu_response.text}")
                break

            # Execute all actions from this turn
            action_results: list[tuple[str, dict]] = []

            for action in cu_response.actions:
                step_num += 1
                step_data = {
                    "step_number": step_num,
                    "action": action.name,
                    "args": action.args,
                    "success": False,
                }

                if action.safety_decision:
                    decision_type = action.safety_decision.get("decision", "")
                    explanation = action.safety_decision.get("explanation", "")
                    if decision_type == "require_confirmation":
                        step_data["safety_warning"] = explanation
                        yield f"data: {json.dumps({'event': 'safety', 'explanation': explanation, 'action': action.name})}\n\n"

                try:
                    print(f"[CU] Step {step_num}: {action.name}({action.args})")
                    result = execute_cu_action(action.name, action.args, window)
                    step_data["success"] = True
                    step_data["result"] = result
                    action_results.append((action.name, result))
                except Exception as e:
                    error_msg = str(e)
                    print(f"[CU] Error on {action.name}: {error_msg}")
                    step_data["error"] = error_msg
                    action_results.append((action.name, {"error": error_msg}))

                yield f"data: {json.dumps({'event': 'action', 'step': step_data})}\n\n"
                await asyncio.sleep(0)

            # Wait for any UI updates to settle
            time.sleep(1.0)

            # Capture new screenshot and get browser URL
            try:
                screenshot_bytes = capture_window(window)
            except Exception as e:
                yield f"data: {json.dumps({'event': 'error', 'message': f'Screenshot failed: {str(e)}'})}\n\n"
                break

            current_url = get_browser_url(window.app_name or "")
            cu_response = agent.step(action_results, screenshot_bytes, current_url=current_url)

        # 6. Complete
        success = cu_response.is_done
        status = "success" if success else ("max_steps_reached" if step_num >= request.max_steps else "failed")

        yield f"data: {json.dumps({'event': 'complete', 'status': status, 'success': success, 'steps_taken': step_num, 'final_message': cu_response.text or ''})}\n\n"

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
# Claude Computer Use Endpoint
# =============================================================================

def execute_claude_action(action, window) -> dict:
    """Execute a single Claude Computer Use action. Coords are in window-local pixels."""
    result = {}
    atype = action.action

    if atype == "screenshot":
        pass

    elif atype in ("left_click", "right_click", "middle_click", "double_click", "triple_click"):
        if action.coordinate:
            gx = window.bounds.left + action.coordinate[0]
            gy = window.bounds.top + action.coordinate[1]
            btn = action.button or "left"
            if atype == "left_click":
                human_click(gx, gy)
            elif atype == "right_click":
                pyautogui.rightClick(gx, gy)
            elif atype == "middle_click":
                pyautogui.middleClick(gx, gy)
            elif atype == "double_click":
                pyautogui.doubleClick(gx, gy)
            elif atype == "triple_click":
                pyautogui.tripleClick(gx, gy)
            result["coordinates"] = [gx, gy]

    elif atype == "type":
        if action.text:
            pyautogui.write(action.text, interval=0.03)
        result["text"] = action.text

    elif atype == "key":
        if action.text:
            keys = action.text.split("+")
            key_map = {"ctrl": "ctrl", "cmd": "command", "super": "command",
                       "alt": "alt", "option": "alt", "shift": "shift",
                       "return": "enter", "space": "space"}
            mapped = [key_map.get(k.strip().lower(), k.strip().lower()) for k in keys]
            if len(mapped) == 1:
                pyautogui.press(mapped[0])
            else:
                pyautogui.hotkey(*mapped)
        result["keys"] = action.text

    elif atype == "mouse_move":
        if action.coordinate:
            gx = window.bounds.left + action.coordinate[0]
            gy = window.bounds.top + action.coordinate[1]
            pyautogui.moveTo(gx, gy, duration=0.2)
            result["coordinates"] = [gx, gy]

    elif atype == "scroll":
        if action.coordinate:
            gx = window.bounds.left + action.coordinate[0]
            gy = window.bounds.top + action.coordinate[1]
        else:
            gx = window.bounds.left + window.bounds.width // 2
            gy = window.bounds.top + window.bounds.height // 2
        direction = action.scroll_direction or "down"
        amount = action.scroll_amount or 3
        clicks = amount * 3
        human_scroll(direction, gx, gy, clicks=clicks)
        result["direction"] = direction

    elif atype == "left_click_drag":
        if action.start_coordinate and action.end_coordinate:
            sx = window.bounds.left + action.start_coordinate[0]
            sy = window.bounds.top + action.start_coordinate[1]
            dx = window.bounds.left + action.end_coordinate[0]
            dy = window.bounds.top + action.end_coordinate[1]
            pyautogui.moveTo(sx, sy, duration=0.2)
            pyautogui.mouseDown()
            time.sleep(0.1)
            pyautogui.moveTo(dx, dy, duration=0.4)
            time.sleep(0.1)
            pyautogui.mouseUp()
            result["from"] = [sx, sy]
            result["to"] = [dx, dy]

    elif atype == "hold_key":
        if action.text and action.duration:
            pyautogui.keyDown(action.text)
            time.sleep(action.duration)
            pyautogui.keyUp(action.text)

    elif atype == "wait":
        time.sleep(2)

    else:
        result["warning"] = f"Unrecognised action: {atype}"

    return result


@app.post("/claude-cu/stream")
async def claude_computer_use_stream(request: CURequest):
    """
    SSE streaming endpoint using Claude Computer Use.

    Works on any application (browser, desktop, terminal).
    Coordinates are in actual pixels — no normalization.

    Event types: start, thinking, action, complete, error
    """

    async def event_generator():
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

        window = get_window_by_title(window_title)
        if not window:
            yield f"data: {json.dumps({'event': 'error', 'message': f'Window not found: {window_title}'})}\n\n"
            return

        try:
            agent = ClaudeComputerUseAgent(
                display_width=window.bounds.width,
                display_height=window.bounds.height,
            )
        except ValueError as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
            return

        activate_window(window)
        time.sleep(0.5)

        yield f"data: {json.dumps({'event': 'start', 'goal': request.instruction, 'window': window_title, 'max_steps': request.max_steps, 'model': agent.model})}\n\n"
        await asyncio.sleep(0)

        try:
            screenshot_bytes = capture_window(window)
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': f'Screenshot failed: {str(e)}'})}\n\n"
            return

        print(f"[Claude-CU] Starting — goal: {request.instruction}")
        cu_response = agent.start(request.instruction, screenshot_bytes)

        step_num = 0

        for turn in range(request.max_steps):
            if cu_response.thinking:
                yield f"data: {json.dumps({'event': 'thinking', 'text': cu_response.thinking})}\n\n"
                await asyncio.sleep(0)

            if cu_response.text:
                yield f"data: {json.dumps({'event': 'status', 'message': cu_response.text})}\n\n"
                await asyncio.sleep(0)

            if cu_response.is_done:
                print(f"[Claude-CU] Done — {cu_response.text}")
                break

            tool_use_ids: list[str] = []

            for action in cu_response.actions:
                step_num += 1

                if action.action == "screenshot":
                    tool_use_ids.append(action.tool_use_id)
                    continue

                step_data = {
                    "step_number": step_num,
                    "action": action.action,
                    "args": {},
                    "success": False,
                    "reasoning": cu_response.thinking or cu_response.text or "",
                }
                if action.coordinate:
                    step_data["args"]["coordinate"] = action.coordinate
                if action.text:
                    step_data["args"]["text"] = action.text
                if action.scroll_direction:
                    step_data["args"]["direction"] = action.scroll_direction

                try:
                    print(f"[Claude-CU] Step {step_num}: {action.action}({step_data['args']})")
                    result = execute_claude_action(action, window)
                    step_data["success"] = True
                    step_data["result"] = result
                except Exception as e:
                    error_msg = str(e)
                    print(f"[Claude-CU] Error on {action.action}: {error_msg}")
                    step_data["error"] = error_msg

                tool_use_ids.append(action.tool_use_id)

                yield f"data: {json.dumps({'event': 'action', 'step': step_data})}\n\n"
                await asyncio.sleep(0)

            time.sleep(1.0)

            try:
                screenshot_bytes = capture_window(window)
            except Exception as e:
                yield f"data: {json.dumps({'event': 'error', 'message': f'Screenshot failed: {str(e)}'})}\n\n"
                break

            cu_response = agent.step(tool_use_ids, screenshot_bytes)

        success = cu_response.is_done
        status = "success" if success else ("max_steps_reached" if step_num >= request.max_steps else "failed")

        yield f"data: {json.dumps({'event': 'complete', 'status': status, 'success': success, 'steps_taken': step_num, 'final_message': cu_response.text or ''})}\n\n"

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
    provider: str = "claude"


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
        provider = request.provider if request else "claude"
        result = get_context_builder().build_context(context_id, feedback, provider=provider)
        
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


class GeneratePlanRequest(BaseModel):
    """Request to generate a test plan."""
    provider: str = "claude"


@app.post("/feature/{context_id}/generate-plan")
async def generate_test_plan(context_id: str, request: GeneratePlanRequest = None):
    """
    Generate text-based test cases for user review.
    
    This analyzes the processed context and creates human-readable test cases.
    User should review these before approving for executable generation.
    """
    try:
        provider = request.provider if request else "claude"
        result = get_context_builder().generate_test_plan(context_id, provider=provider)
        
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
async def approve_tests(context_id: str, request: ApproveTestsRequest = None):
    """
    Step 2: Approve test cases (mark as ready for execution).
    
    After user reviews the test plan, call this to approve tests.
    Optionally pass specific test IDs to approve only those.
    """
    try:
        approved_ids = request.approved_test_ids if request else None
        result = get_context_builder().approve_tests(context_id, approved_ids)
        
        return {
            "success": True,
            "context_id": context_id,
            "feature_name": result.get("feature_name"),
            "test_count": len(result.get("test_cases", [])),
            "test_cases": result.get("test_cases", []),
            "status": result.get("status"),
            "message": "Tests approved. Ready for execution."
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
    provider: str = "claude"
    # Optional: when set and CLOUD_API_URL configured, fetch tests from cloud and save runs/results
    cloud_feature_id: str | None = None
    cloud_user_id: str | None = None
    cloud_token: str | None = None


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
    print(f"\n{'='*80}")
    print(f"[EXECUTE] ===== /feature/{context_id}/execute ENDPOINT CALLED =====")
    print(f"[EXECUTE] Request received: context_id={context_id}, window_title={request.window_title}, provider={request.provider}")
    print(f"[EXECUTE] Request test_ids: {request.test_ids}")
    
    # Load test plan: from cloud when logged in, else from local
    test_cases = []
    if cloud_is_configured() and request.cloud_feature_id and request.cloud_user_id and request.cloud_token:
        print(f"[EXECUTE] Fetching test cases from cloud for feature {request.cloud_feature_id}...")
        try:
            cloud_tcs = cloud_list_test_cases(request.cloud_feature_id, token=request.cloud_token)
            if cloud_tcs:
                # Convert cloud format (steps_text) to execute format (steps array)
                for tc in cloud_tcs:
                    steps_text = tc.get("steps_text") or ""
                    steps = [s.strip() for s in steps_text.split("\n") if s.strip()] if steps_text else []
                    test_cases.append({
                        "id": tc["id"],
                        "test_key": tc.get("test_key"),
                        "title": tc.get("title", ""),
                        "steps": steps,
                        "expected_result": tc.get("expected_result"),
                        "goal": tc.get("goal"),
                    })
                print(f"[EXECUTE] ✓ Loaded {len(test_cases)} test cases from cloud")
        except Exception as e:
            print(f"[EXECUTE] ✗ Cloud fetch failed: {e}")
            raise HTTPException(status_code=502, detail=f"Failed to fetch tests from cloud: {e}")
    else:
        print(f"[EXECUTE] Loading test plan for context {context_id}...")
        try:
            tests_data = get_context_builder().get_test_plan(context_id)
            if not tests_data:
                print(f"[EXECUTE] ✗ No test plan found")
                raise HTTPException(status_code=404, detail="No test plan found")
            print(f"[EXECUTE] ✓ Test plan loaded")
        except Exception as e:
            print(f"[EXECUTE] ✗ Error loading test plan: {e}")
            raise

        if tests_data.get("status") != "approved":
            print(f"[EXECUTE] ✗ Tests not approved. Status: {tests_data.get('status')}")
            raise HTTPException(status_code=400, detail="Tests not approved yet. Approve tests first.")

        test_cases = tests_data.get("test_cases", [])
    print(f"[EXECUTE] Found {len(test_cases)} test cases")
    if not test_cases:
        print(f"[EXECUTE] ✗ No test cases found")
        raise HTTPException(status_code=400, detail="No test cases found")
    
    # Filter to requested tests if specified
    if request.test_ids:
        print(f"[EXECUTE] Filtering to requested test IDs: {request.test_ids}")
        test_cases = [tc for tc in test_cases if tc.get("id") in request.test_ids]
        print(f"[EXECUTE] After filtering: {len(test_cases)} tests")
    
    # Validate window
    print(f"[EXECUTE] Looking for window: {request.window_title}")
    try:
        window = get_window_by_title(request.window_title)
        if not window:
            print(f"[EXECUTE] ✗ Window not found: {request.window_title}")
            raise HTTPException(status_code=404, detail=f"Window not found: {request.window_title}")
        print(f"[EXECUTE] ✓ Window found: {window.title} (app: {window.app_name})")
        print(f"[EXECUTE] Window bounds: left={window.bounds.left}, top={window.bounds.top}, width={window.bounds.width}, height={window.bounds.height}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[EXECUTE] ✗ Error finding window: {e}")
        raise HTTPException(status_code=500, detail=f"Error finding window: {str(e)}")
    
    print(f"[EXECUTE] Starting async test suite execution...")
    print(f"{'='*80}\n")
    
    async def execute_test_suite():
        """Generator that executes tests and yields SSE events."""
        provider = request.provider
        print(f"[EXECUTE] ===== Test Suite Execution Started (provider={provider}) =====")
        print(f"[EXECUTE] Context ID: {context_id}")
        print(f"[EXECUTE] Window: {request.window_title}")
        print(f"[EXECUTE] Total tests: {len(test_cases)}")
        
        suite_start_event = {'event': 'suite_start', 'context_id': context_id, 'window': request.window_title, 'total_tests': len(test_cases)}
        yield f"data: {json.dumps(suite_start_event)}\n\n"
        
        # Cloud: create run when logged in (test cases already in cloud)
        cloud_run_id = None
        if cloud_is_configured() and request.cloud_feature_id and request.cloud_user_id and request.cloud_token:
            try:
                run_doc = cloud_create_test_run(
                    feature_id=request.cloud_feature_id,
                    user_id=request.cloud_user_id,
                    provider=provider,
                    model="claude-haiku-4-5" if provider == "claude" else "gemini",
                    total_tests=len(test_cases),
                    target_window=request.window_title,
                    token=request.cloud_token,
                )
                if run_doc:
                    cloud_run_id = run_doc.get("id")
                    print(f"[EXECUTE] Cloud run created: {cloud_run_id}")
            except Exception as e:
                print(f"[EXECUTE] Cloud run create failed: {e}")
        
        suite_results = {"passed": 0, "failed": 0, "skipped": 0, "test_results": []}
        
        for test_idx, test_case in enumerate(test_cases):
            test_id = test_case.get("id", f"TC-{test_idx+1}")
            test_title = test_case.get("title", "Unknown Test")
            print(f"[EXECUTE] ===== Test [{test_idx + 1}/{len(test_cases)}]: {test_id} - {test_title} =====")
            
            steps_text = "\n".join([f"{i+1}. {step}" for i, step in enumerate(test_case.get("steps", []))])
            goal = f"""{test_title}

Steps to execute:
{steps_text}

Expected result: {test_case.get("expected_result", "N/A")}"""
            
            guidance_key = f"{context_id}:{test_id}"
            if guidance_key in guidance_store:
                goal += "\n\nUser Guidance:\n" + "\n".join([f"- {g}" for g in guidance_store[guidance_key]])
            
            test_start_event = {
                'event': 'test_start',
                'test_id': test_id,
                'title': test_title,
                'test_number': test_idx + 1,
                'total_tests': len(test_cases),
                'goal': goal
            }
            yield f"data: {json.dumps(test_start_event)}\n\n"
            
            test_passed = False
            test_steps = []
            
            if provider == "claude":
                # ── Claude Computer Use path ──
                try:
                    agent = ClaudeComputerUseAgent(
                        display_width=window.bounds.width,
                        display_height=window.bounds.height,
                    )
                except ValueError as e:
                    yield f"data: {json.dumps({'event': 'step_error', 'test_id': test_id, 'step_number': 0, 'error': str(e)})}\n\n"
                    suite_results["failed"] += 1
                    suite_results["test_results"].append({"test_id": test_id, "title": test_title, "status": "failed", "steps": []})
                    yield f"data: {json.dumps({'event': 'test_complete', 'test_id': test_id, 'status': 'failed', 'steps_executed': 0})}\n\n"
                    continue

                activate_window(window)
                time.sleep(0.5)

                try:
                    screenshot_bytes = capture_window(window)
                except Exception as e:
                    yield f"data: {json.dumps({'event': 'step_error', 'test_id': test_id, 'step_number': 0, 'error': f'Screenshot failed: {str(e)}'})}\n\n"
                    suite_results["failed"] += 1
                    suite_results["test_results"].append({"test_id": test_id, "title": test_title, "status": "failed", "steps": []})
                    yield f"data: {json.dumps({'event': 'test_complete', 'test_id': test_id, 'status': 'failed', 'steps_executed': 0})}\n\n"
                    continue

                cu_response = agent.start(goal, screenshot_bytes)
                step_num = 0
                max_steps = 30

                for turn in range(max_steps):
                    if cu_response.thinking:
                        latest_thinking = cu_response.thinking

                    if cu_response.is_done:
                        print(f"[EXECUTE-CU] ✓ Claude says done: {cu_response.text}")
                        test_passed = True
                        break

                    tool_use_ids: list[str] = []

                    for action in cu_response.actions:
                        step_num += 1

                        if action.action == "screenshot":
                            tool_use_ids.append(action.tool_use_id)
                            continue

                        step_data = {
                            'step_number': step_num,
                            'action': action.action,
                            'target': action.text or None,
                            'value': f"({action.coordinate[0]}, {action.coordinate[1]})" if action.coordinate else None,
                            'reasoning': cu_response.thinking or cu_response.text or '',
                            'current_state': '',
                            'success': False,
                            'coordinates': None,
                            'error': None
                        }

                        try:
                            print(f"[EXECUTE-CU] Step {step_num}: {action.action}")
                            result = execute_claude_action(action, window)
                            step_data['success'] = True
                            step_data['coordinates'] = result.get("coordinates")
                        except Exception as e:
                            print(f"[EXECUTE-CU] Error: {e}")
                            step_data['error'] = str(e)

                        tool_use_ids.append(action.tool_use_id)
                        test_steps.append(step_data)

                        step_event = {
                            'event': 'step',
                            'test_id': test_id,
                            **step_data
                        }
                        yield f"data: {json.dumps(step_event)}\n\n"
                        await asyncio.sleep(0)

                    time.sleep(1.0)

                    try:
                        screenshot_bytes = capture_window(window)
                    except Exception as e:
                        print(f"[EXECUTE-CU] Screenshot failed: {e}")
                        break

                    if tool_use_ids:
                        cu_response = agent.step(tool_use_ids, screenshot_bytes)
                    else:
                        cu_response = agent.step(
                            [action.tool_use_id for action in cu_response.actions] if cu_response.actions else [],
                            screenshot_bytes,
                        )

            else:
                # ── Gemini legacy path (OrchestratorAgent + VisionAgent) ──
                vision_agent = VisionAgent(provider="gemini")
                orchestrator = OrchestratorAgent(provider="gemini")
                max_steps = 30
                action_history = []

                for step_num in range(1, max_steps + 1):
                    try:
                        activate_window(window)
                        await asyncio.sleep(0.3)

                        screenshot = capture_window(window)
                        if not screenshot:
                            raise Exception("Failed to capture window")

                        decision = orchestrator.analyze_and_decide(
                            screenshot_bytes=screenshot,
                            goal=goal,
                            previous_actions=action_history
                        )

                        if decision.action == OrchestratorActionType.STUCK:
                            need_help_event = {
                                'event': 'need_help',
                                'test_id': test_id,
                                'step_number': step_num,
                                'current_state': decision.current_state,
                                'reasoning': decision.reasoning,
                                'question': decision.reasoning
                            }
                            yield f"data: {json.dumps(need_help_event)}\n\n"

                            g_key = f"{context_id}:{test_id}"
                            if g_key in guidance_store and guidance_store[g_key]:
                                goal += f"\n\nUser Guidance: {guidance_store[g_key][-1]}"
                                guidance_store[g_key] = []
                            else:
                                test_steps.append({'step_number': step_num, 'action': 'stuck', 'reasoning': decision.reasoning, 'success': False, 'error': 'Waiting for human guidance'})
                                break

                        if decision.goal_complete or decision.action == OrchestratorActionType.DONE:
                            test_passed = True
                            test_steps.append({'step_number': step_num, 'action': 'done', 'reasoning': decision.reasoning, 'success': True})
                            break

                        step_success = True
                        step_error = None
                        coordinates = None

                        if decision.action == OrchestratorActionType.CLICK:
                            detection = vision_agent.detect(screenshot, decision.target)
                            if detection and detection.get("found"):
                                screenshot_width, screenshot_height = get_screenshot_dimensions(screenshot, window)
                                global_x, global_y = calculate_screen_coordinates(
                                    detection=detection,
                                    window_left=window.bounds.left, window_top=window.bounds.top,
                                    window_width=window.bounds.width, window_height=window.bounds.height,
                                    screenshot_width=screenshot_width, screenshot_height=screenshot_height,
                                    y_offset_ratio=-0.2
                                )
                                coordinates = [global_x, global_y]
                                execute_action(ActionType.CLICK, x=global_x, y=global_y)
                                await asyncio.sleep(0.5)
                            else:
                                step_success = False
                                step_error = f"Element not found: {decision.target}"

                        elif decision.action == OrchestratorActionType.TYPE:
                            detection = vision_agent.detect(screenshot, decision.target)
                            if detection and detection.get("found"):
                                screenshot_width, screenshot_height = get_screenshot_dimensions(screenshot, window)
                                global_x, global_y = calculate_screen_coordinates(
                                    detection=detection,
                                    window_left=window.bounds.left, window_top=window.bounds.top,
                                    window_width=window.bounds.width, window_height=window.bounds.height,
                                    screenshot_width=screenshot_width, screenshot_height=screenshot_height,
                                    y_offset_ratio=-0.2
                                )
                                coordinates = [global_x, global_y]
                                execute_action(ActionType.CLICK, x=global_x, y=global_y)
                                await asyncio.sleep(0.3)
                                execute_action(ActionType.TYPE, text=decision.value or "")
                                await asyncio.sleep(0.3)
                            else:
                                step_success = False
                                step_error = f"Input not found: {decision.target}"

                        elif decision.action == OrchestratorActionType.SCROLL:
                            center_x = window.bounds.left + window.bounds.width // 2
                            center_y = window.bounds.top + window.bounds.height // 2
                            coordinates = [center_x, center_y]
                            direction = decision.value.lower() if decision.value else "down"
                            execute_action(ActionType.SCROLL, x=center_x, y=center_y, scroll_direction=direction)
                            await asyncio.sleep(0.5)

                        elif decision.action == OrchestratorActionType.WAIT:
                            wait_seconds = int(decision.value) if decision.value and decision.value.isdigit() else 1
                            await asyncio.sleep(wait_seconds)

                        action_desc = f"{decision.action.value}"
                        if decision.target:
                            action_desc += f" on '{decision.target}'"
                        action_history.append(action_desc)

                        test_steps.append({
                            'step_number': step_num,
                            'action': decision.action.value,
                            'target': decision.target,
                            'value': decision.value,
                            'reasoning': decision.reasoning,
                            'current_state': decision.current_state,
                            'success': step_success,
                            'coordinates': coordinates,
                            'error': step_error
                        })

                        step_event = {
                            'event': 'step',
                            'test_id': test_id,
                            'step_number': step_num,
                            'action': decision.action.value,
                            'target': decision.target,
                            'value': decision.value,
                            'reasoning': decision.reasoning,
                            'current_state': decision.current_state,
                            'success': step_success,
                            'coordinates': coordinates,
                            'error': step_error
                        }
                        yield f"data: {json.dumps(step_event)}\n\n"

                        await asyncio.sleep(0.5)

                    except Exception as e:
                        import traceback
                        print(f"[EXECUTE] Exception in step {step_num}: {traceback.format_exc()}")
                        test_steps.append({'step_number': step_num, 'action': 'error', 'success': False, 'error': str(e)})
                        yield f"data: {json.dumps({'event': 'step_error', 'test_id': test_id, 'step_number': step_num, 'error': str(e)})}\n\n"
                        test_passed = False
                        break

            # ── Test complete (shared by both providers) ──
            test_status = "passed" if test_passed else "failed"
            conclusion = ""
            if provider == "claude" and cu_response:
                conclusion = cu_response.text or cu_response.thinking or ""
            elif provider != "claude" and 'decision' in dir():
                conclusion = getattr(decision, 'reasoning', '') or ""
            print(f"[EXECUTE] ===== Test {test_id} {test_status.upper()} =====")
            
            if test_passed:
                suite_results["passed"] += 1
            else:
                suite_results["failed"] += 1
            
            suite_results["test_results"].append({"test_id": test_id, "title": test_title, "status": test_status, "steps": test_steps})
            
            # Cloud: save test result (test_case id from cloud data)
            if cloud_run_id:
                cloud_tc_id = test_case.get("id")  # Cloud test cases have id from DB
                if cloud_tc_id:
                    try:
                        cloud_create_test_result(
                            run_id=cloud_run_id,
                            test_case_id=str(cloud_tc_id),
                            status=test_status,
                            conclusion=conclusion or None,
                            steps=test_steps,
                            steps_executed=len(test_steps),
                            token=request.cloud_token,
                        )
                    except Exception as e:
                        print(f"[EXECUTE] Cloud result save failed: {e}")
            
            test_complete_event = {'event': 'test_complete', 'test_id': test_id, 'status': test_status, 'steps_executed': len(test_steps), 'conclusion': conclusion}
            yield f"data: {json.dumps(test_complete_event)}\n\n"
            await asyncio.sleep(1)
        
        # Suite complete
        if cloud_run_id:
            try:
                from datetime import datetime, timezone
                cloud_update_test_run(
                    cloud_run_id,
                    token=request.cloud_token,
                    status="completed",
                    passed=suite_results["passed"],
                    failed=suite_results["failed"],
                    skipped=suite_results["skipped"],
                    completed_at=datetime.now(timezone.utc).isoformat(),
                )
            except Exception as e:
                print(f"[EXECUTE] Cloud run update failed: {e}")
        
        suite_complete_event = {'event': 'suite_complete', 'passed': suite_results['passed'], 'failed': suite_results['failed'], 'skipped': suite_results['skipped'], 'total': len(test_cases)}
        yield f"data: {json.dumps(suite_complete_event)}\n\n"
        print(f"[EXECUTE] ===== Execution Finished =====")
    
    return StreamingResponse(
        execute_test_suite(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


class ProvideGuidanceRequest(BaseModel):
    """Request to provide guidance when agent is stuck."""
    guidance: str


@app.post("/feature/{context_id}/execute/{test_id}/guidance")
async def provide_guidance(context_id: str, test_id: str, request: ProvideGuidanceRequest):
    """
    Provide guidance to the agent when it's stuck during test execution.
    
    This allows the human to give direction when the agent emits a 'need_help' event.
    """
    guidance_key = f"{context_id}:{test_id}"
    
    if guidance_key not in guidance_store:
        guidance_store[guidance_key] = []
    
    guidance_store[guidance_key].append(request.guidance)
    print(f"[GUIDANCE] Received guidance for {guidance_key}: {request.guidance}")
    
    return {
        "success": True,
        "message": "Guidance received. Agent will use this in the next step.",
        "guidance": request.guidance
    }


# =============================================================================
# Cloud-backed Project + Feature Context Endpoints (SSE)
# =============================================================================

class CreateProjectRequest(BaseModel):
    name: str
    description: Optional[str] = None
    images: list = []   # [{"filename": str, "content_b64": str, "file_size": int}]
    texts: list = []    # [str]
    token: str


@app.post("/cloud/project/create")
async def cloud_create_project_with_context(request: CreateProjectRequest):
    """
    SSE endpoint: save images/text to cloud, run AI agents, create project with context_summary.

    Streams progress events:
      {"event": "progress", "message": "..."}
      {"event": "done", "project": {...}}
      {"event": "error", "message": "..."}
    """
    async def generate():
        try:
            yield f"data: {json.dumps({'event': 'progress', 'message': 'Processing images...'})}\n\n"

            image_agent = ImageContextRetrieverAgent(provider="claude")
            image_contexts = []
            for img in request.images:
                import base64
                raw = base64.b64decode(img["content_b64"])
                result = image_agent.process(raw, "")
                if result:
                    image_contexts.append(result)

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Synthesising context...'})}\n\n"

            # Build combined context text for synthesis
            context_parts = []
            for ctx in image_contexts:
                if ctx.get("description"):
                    context_parts.append(f"Screen: {ctx.get('screen_title', 'Unknown')} — {ctx['description']}")
                for elem in ctx.get("elements", [])[:10]:
                    context_parts.append(f"  UI element: {elem.get('label', '')} ({elem.get('type', '')})")
            for text in request.texts:
                context_parts.append(f"User note: {text}")

            # Use TestPlannerAgent's underlying LLM to synthesise a project-level summary
            from agents.base_agent import BaseAgent
            class _SynthAgent(BaseAgent):
                @property
                def system_prompt(self):
                    return (
                        "You are a product analyst. Given observations about an app (screens, UI elements, user notes), "
                        "write a project context summary that describes what the product does, "
                        "key screens, and main user flows. "
                        "Respond with JSON: {\"summary\": \"your text here\"}"
                    )
                def parse_response(self, response_text: str):
                    return self.extract_json(response_text)
                def synthesise(self, raw_context: str) -> str:
                    result = self.parse_response(self.call_gemini(raw_context, max_tokens=512))
                    return (result or {}).get("summary", "") if result else ""

            synth = _SynthAgent(provider="claude")
            context_summary = synth.synthesise("\n".join(context_parts)) if context_parts else ""

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Saving project...'})}\n\n"

            project = cloud_create_project(
                name=request.name,
                description=request.description,
                context_summary=context_summary,
                token=request.token,
            )
            if not project:
                yield f"data: {json.dumps({'event': 'error', 'message': 'Failed to create project in cloud'})}\n\n"
                return

            # Save context items to cloud (fire-and-forget, non-blocking)
            if request.images or request.texts:
                cloud_save_context_items_batch(
                    level="project",
                    level_id=project["id"],
                    images=request.images,
                    texts=request.texts,
                    token=request.token,
                )

            yield f"data: {json.dumps({'event': 'done', 'project': project})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


class UpdateProjectContextRequest(BaseModel):
    token: str
    images: list = []  # [{"filename": str, "content_b64": str, "file_size": int}]
    texts: list = []   # [str]


@app.post("/cloud/project/{project_id}/update-context")
async def cloud_update_project_context(project_id: str, request: UpdateProjectContextRequest):
    """
    SSE endpoint: replace context items for an existing project, re-run AI agents,
    update project.context_summary in cloud.

    Streams:
      {"event": "progress", "message": "..."}
      {"event": "done", "context_summary": "..."}
      {"event": "error", "message": "..."}
    """
    async def generate():
        try:
            # Save new assets (replaces any existing ones)
            if request.images or request.texts:
                yield f"data: {json.dumps({'event': 'progress', 'message': 'Saving context assets...'})}\n\n"
                await asyncio.sleep(0)
                await asyncio.to_thread(
                    cloud_save_context_items_batch,
                    level="project",
                    level_id=project_id,
                    images=request.images,
                    texts=request.texts,
                    token=request.token,
                )

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Processing images...'})}\n\n"
            await asyncio.sleep(0)

            import base64
            image_agent = ImageContextRetrieverAgent(provider="claude")
            image_contexts = []
            for img in request.images:
                raw = base64.b64decode(img["content_b64"])
                result = await asyncio.to_thread(image_agent.process, raw, "")
                if result:
                    image_contexts.append(result)

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Synthesising context...'})}\n\n"
            await asyncio.sleep(0)

            context_parts = []
            for ctx in image_contexts:
                if ctx.get("description"):
                    context_parts.append(f"Screen: {ctx.get('screen_title', 'Unknown')} — {ctx['description']}")
                for elem in ctx.get("elements", [])[:10]:
                    context_parts.append(f"  UI element: {elem.get('label', '')} ({elem.get('type', '')})")
            for text in request.texts:
                context_parts.append(f"User note: {text}")

            from agents.base_agent import BaseAgent
            class _SynthAgent(BaseAgent):
                @property
                def system_prompt(self):
                    return (
                        "You are a product analyst. Given observations about an app (screens, UI elements, user notes), "
                        "write a project context summary that describes what the product does, "
                        "key screens, and main user flows. "
                        "Respond with JSON: {\"summary\": \"your text here\"}"
                    )
                def parse_response(self, response_text: str):
                    return self.extract_json(response_text)
                def synthesise(self, raw_context: str) -> str:
                    result = self.parse_response(self.call_llm(raw_context, max_tokens=512))
                    return (result or {}).get("summary", "") if result else ""

            synth = _SynthAgent(provider="claude")
            context_summary = await asyncio.to_thread(synth.synthesise, "\n".join(context_parts)) if context_parts else ""

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Saving updated context...'})}\n\n"
            await asyncio.sleep(0)

            from cloud_client import _request as cloud_request
            update_code, update_body = await asyncio.to_thread(
                cloud_request,
                "PATCH",
                f"/api/v1/projects/{project_id}",
                json={"context_summary": context_summary},
                token=request.token,
            )
            print(f"[update-context] PATCH /api/v1/projects/{project_id} → {update_code}: {update_body}")
            if update_code != 200:
                yield f"data: {json.dumps({'event': 'error', 'message': f'Cloud update failed ({update_code}): {update_body}'})}\n\n"
                return

            yield f"data: {json.dumps({'event': 'done', 'context_summary': context_summary})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class BuildFeatureContextRequest(BaseModel):
    project_id: str
    feature_id: str
    token: str
    user_feedback: Optional[str] = None
    images: list = []  # [{"filename": str, "content_b64": str, "file_size": int}]
    texts: list = []   # [str]


@app.post("/cloud/feature/{feature_id}/build-context")
async def cloud_build_feature_context(feature_id: str, request: BuildFeatureContextRequest):
    """
    SSE endpoint: fetch feature + project context items from cloud, run agents,
    build context_summary, persist to cloud feature record.

    Streams:
      {"event": "progress", "message": "..."}
      {"event": "done", "summary": {...}, "context_summary": "..."}
      {"event": "error", "message": "..."}
    """
    async def generate():
        try:
            # If new assets provided, save them first (replaces existing)
            if request.images or request.texts:
                yield f"data: {json.dumps({'event': 'progress', 'message': 'Saving context assets...'})}\n\n"
                await asyncio.sleep(0)
                await asyncio.to_thread(
                    cloud_save_context_items_batch,
                    level="feature",
                    level_id=feature_id,
                    images=request.images,
                    texts=request.texts,
                    token=request.token,
                )

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Fetching feature context...'})}\n\n"
            await asyncio.sleep(0)
            feature_items = await asyncio.to_thread(cloud_list_context_items, "feature", feature_id, token=request.token)

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Fetching project context...'})}\n\n"
            await asyncio.sleep(0)
            project_items = await asyncio.to_thread(cloud_list_context_items, "project", request.project_id, token=request.token)

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Analysing images...'})}\n\n"
            await asyncio.sleep(0)

            import base64
            image_agent = ImageContextRetrieverAgent(provider="claude")
            image_contexts = []
            feedback_prefix = f"User correction: {request.user_feedback}\n\n" if request.user_feedback else ""

            all_items = feature_items + project_items
            for item in all_items:
                if item.get("type") == "image" and item.get("content"):
                    raw = base64.b64decode(item["content"])
                    result = await asyncio.to_thread(image_agent.process, raw, feedback_prefix)
                    if result:
                        result["_source"] = item.get("filename", "image")
                        image_contexts.append(result)

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Synthesising context...'})}\n\n"
            await asyncio.sleep(0)

            # Build structured summary
            screens = []
            ui_elements = []
            text_notes = []

            for ctx in image_contexts:
                screen_name = ctx.get("screen_title") or ctx.get("screen_type", "Unknown screen")
                screens.append({"name": screen_name, "source": ctx.get("_source", ""), "description": ctx.get("description", "")})
                for elem in ctx.get("elements", [])[:10]:
                    ui_elements.append({"type": elem.get("type", ""), "label": elem.get("label", ""), "location": elem.get("location", "")})

            for item in all_items:
                if item.get("type") == "text" and item.get("content"):
                    text_notes.append(item["content"])

            summary = {
                "screens_detected": screens,
                "ui_elements": ui_elements,
                "requirements": [],
                "user_flows": [],
                "text_notes": text_notes,
            }

            # Synthesise a natural-language context_summary
            context_parts = []
            for s in screens:
                context_parts.append(f"Screen '{s['name']}': {s['description']}")
            for note in text_notes:
                context_parts.append(f"Note: {note}")
            if request.user_feedback:
                context_parts.append(f"User feedback: {request.user_feedback}")

            from agents.base_agent import BaseAgent
            class _SynthAgent(BaseAgent):
                @property
                def system_prompt(self):
                    return (
                        "You are a QA analyst. Given observations about a specific feature or user flow "
                        "(screens, UI elements, user notes), write a concise feature context summary "
                        "(3-6 sentences) describing what the feature does and key interactions. "
                        "Respond with JSON: {\"summary\": \"your text here\"}"
                    )
                def parse_response(self, response_text: str):
                    return self.extract_json(response_text)
                def synthesise(self, raw_context: str) -> str:
                    result = self.parse_response(self.call_llm(raw_context, max_tokens=512))
                    return (result or {}).get("summary", "") if result else ""

            synth = _SynthAgent(provider="claude")
            context_summary = await asyncio.to_thread(synth.synthesise, "\n".join(context_parts)) if context_parts else ""

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Saving context...'})}\n\n"
            await asyncio.sleep(0)

            from cloud_client import update_feature as cloud_update_feature
            await asyncio.to_thread(
                cloud_update_feature, feature_id,
                token=request.token, context_summary=context_summary, status="context_ready"
            )

            yield f"data: {json.dumps({'event': 'done', 'summary': summary, 'context_summary': context_summary})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class SaveFeatureTestsRequest(BaseModel):
    feature_id: str
    token: str
    test_cases: list  # [{id, name/title, description, steps, expected_result, category, priority}]


@app.post("/cloud/feature/{feature_id}/save-tests")
async def cloud_save_feature_tests(feature_id: str, request: SaveFeatureTestsRequest):
    """
    Save approved test cases to the cloud backend.
    Deletes any existing test cases for this feature first, then bulk-inserts.
    """
    cloud_tests = []
    for tc in request.test_cases:
        cloud_tests.append({
            "feature_id": feature_id,
            "test_key": tc.get("id", f"TC-{len(cloud_tests)+1:03d}"),
            "title": tc.get("name") or tc.get("title", "Untitled"),
            "description": tc.get("description"),
            "steps_text": "\n".join(tc.get("steps", [])) if isinstance(tc.get("steps"), list) else tc.get("steps_text"),
            "goal": tc.get("description") or tc.get("name") or "Test execution",
            "expected_result": tc.get("expected_result"),
            "priority": tc.get("priority"),
            "category": tc.get("category"),
        })

    saved = cloud_save_test_cases_bulk(feature_id, cloud_tests, token=request.token)
    return {"ok": True, "saved": len(saved)}


class GenerateFeatureTestsRequest(BaseModel):
    project_id: str
    feature_id: str
    token: str
    provider: str = "claude"


@app.post("/cloud/feature/{feature_id}/generate-tests")
async def cloud_generate_feature_tests(feature_id: str, request: GenerateFeatureTestsRequest):
    """
    SSE endpoint: fetch project + feature context_summary from cloud, generate test cases.

    Streams:
      {"event": "progress", "message": "..."}
      {"event": "done", "test_cases": [...], "feature_summary": "..."}
      {"event": "error", "message": "..."}
    """
    async def generate():
        try:
            yield f"data: {json.dumps({'event': 'progress', 'message': 'Fetching context summaries...'})}\n\n"
            await asyncio.sleep(0)

            project = await asyncio.to_thread(cloud_get_project, request.project_id, token=request.token)
            project_context = (project or {}).get("context_summary", "") or ""

            from cloud_client import get_feature as cloud_get_feature
            feature = await asyncio.to_thread(cloud_get_feature, feature_id, token=request.token)
            feature_context = (feature or {}).get("context_summary", "") or ""

            if not feature_context:
                yield f"data: {json.dumps({'event': 'error', 'message': 'Feature context not built yet. Build context first.'})}\n\n"
                return

            yield f"data: {json.dumps({'event': 'progress', 'message': 'Generating test cases...'})}\n\n"
            await asyncio.sleep(0)

            from agents.test_planner_agent import TestPlannerAgent
            planner = TestPlannerAgent(provider=request.provider)

            combined_context = {
                "name": (feature or {}).get("name", ""),
                "description": (feature or {}).get("description", ""),
                "context_summary": feature_context,
                "project_context": project_context,
                "items": [],
            }
            test_plan = await asyncio.to_thread(planner.generate_from_feature_context, combined_context)

            if not test_plan:
                yield f"data: {json.dumps({'event': 'error', 'message': 'Test generation failed'})}\n\n"
                return

            yield f"data: {json.dumps({'event': 'done', 'feature_summary': test_plan.get('feature_summary', ''), 'test_cases': test_plan.get('test_cases', []), 'coverage_notes': test_plan.get('coverage_notes', '')})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
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
