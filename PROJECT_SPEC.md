# Project Specification: AutoQA (Visual QA Agent) - v1.1

## 1. Executive Summary

We are building a **framework-agnostic Autonomous QA Agent** as a standalone desktop application.

- **Core Philosophy:** "If a human can see it on screen, the Agent can test it."
- **Mechanism:** The Agent captures screenshots of a specific target window, analyzes the UI visually using **Google Gemini**, and executes mouse/keyboard actions.
- **Target Platform:** Windows & macOS.

---

## 2. Technical Stack & Libraries

### **Frontend (Electron + React)**

- **Role:** A thin client. It just sends commands to the Python backend and displays the "Agent's Eye" view.

### **Backend (Python 3.10+)**

- **Server:** `FastAPI` + `Uvicorn`.
- **Vision/Screenshots:**
  - **`mss`**: Use this instead of `pyautogui` for screenshots (faster and handles multi-monitor setups better).
  - **`Pillow`**: For cropping and drawing debug overlays.
- **Input Control:** `pyautogui`.
- **Window Management:** `pygetwindow` (Windows) / `pyobjc` (macOS).
- **AI Model:** Direct HTTP to Gemini API via `requests` (Gemini 2.0 Flash for speed).

---

## 3. Data Flow & Endpoints

### **A. Environment Setup**

- Create a `.env` file for `GEMINI_API_KEY`.
- **macOS Note:** The app must explicitly check for "Screen Recording" and "Accessibility" permissions on startup.

### **B. API Contract**

#### `GET /windows`

- **Returns:** List of open application windows.

```json
[
  {"id": "1", "title": "iPhone 15 Simulator", "bounds": {"left": 0, "top": 0, "width": 500, "height": 800}}
]
```

#### `POST /act`

- **Input:**

```json
{
  "window_title": "iPhone 15 Simulator",
  "instruction": "Click the Login button",
  "action_type": "click"
}
```

Supported `action_type` values: `"click"`, `"type"`, `"scroll"`

- **Logic:**
  1. Find window bounds.
  2. Capture screenshot using `mss`.
  3. Send to Gemini → Get Bounding Box `[ymin, xmin, ymax, xmax]`.
  4. Calculate **Center Point**.
  5. Perform Action (Click/Type/Scroll).

- **Response:**

```json
{
  "status": "success",
  "action_performed": "click",
  "coordinates": [500, 300],
  "debug_image": "base64_string..."
}
```

---

## 4. Critical Logic (The "Do Not Break" Rules)

### **A. Coordinate Calculation (The Formula)**

Gemini returns 0-1000 normalized coordinates. We must convert this to the **center point** of the element in global screen pixels.

```python
# 1. Parse Gemini Output
ymin, xmin, ymax, xmax = gemini_box  # (0-1000 scale)

# 2. Get Center in 0-1000 scale
center_x_norm = (xmin + xmax) / 2
center_y_norm = (ymin + ymax) / 2

# 3. Convert to Window Pixels
local_x = (center_x_norm / 1000) * window_width
local_y = (center_y_norm / 1000) * window_height

# 4. Convert to Global Screen (Handling Retina Scaling)
# NOTE: 'mss' handles Retina scaling differently than pyautogui.
# If using mss, the screenshot size is physical pixels.
# The window bounds from pyobjc might be logical points.
scale_factor = screenshot_width / window_bounds_width
global_x = window_left + (local_x / scale_factor)
global_y = window_top + (local_y / scale_factor)
```

### **B. The "Human Click"**

Do not use instant clicks.

```python
def human_click(x, y):
    pyautogui.moveTo(x, y, duration=0.2)
    pyautogui.mouseDown()
    time.sleep(0.1)  # Debounce
    pyautogui.mouseUp()
```

### **C. Handling "Type" Actions**

If the instruction implies typing (e.g., "Type 'hello' into email"):

1. **Click** the target first (to focus).
2. **Wait** 0.5s.
3. **Type** using `pyautogui.write('text', interval=0.05)`.

---

## 5. Gemini System Prompt

Use this exact prompt structure in the Python backend:

```
System Instruction:
You are a GUI Automation Agent. You are looking at a cropped screenshot of a specific application window.

Task:
Identify the UI element that matches the user's instruction: "{instruction}".

Output Format:
Return ONLY a JSON object with no markdown formatting:

{
  "box_2d": [ymin, xmin, ymax, xmax],
  "label": "name of element found"
}

If the element is not found, return null.
```

---

## 6. Build Notes

- **Dependencies:** `fastapi`, `uvicorn`, `mss`, `python-dotenv`, `requests`, `pyautogui`, `pillow`, `pyobjc` (macOS), `pygetwindow` (Windows).
- **PyInstaller:** When bundling, use `--hidden-import uvicorn.logging` and `--onedir` for faster startup.

---

## 7. Out of Scope (V2)

- Multi-step planning/orchestration
- Auto-verification of actions
- Retry logic with re-capture
- MJPEG streaming of agent vision
