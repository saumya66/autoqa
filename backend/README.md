# AutoQA Backend

Python FastAPI server for the AutoQA Visual QA Agent.

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Up Environment

```bash
# Copy the example env file
cp ../.env.example ../.env

# Edit .env and add your Gemini API key
# Get one at: https://makersuite.google.com/app/apikey
```

### 4. Run the Server

```bash
python main.py
```

The server will start at `http://127.0.0.1:8000`

## API Endpoints

### Health Check
```bash
curl http://127.0.0.1:8000/
```

### List Windows
```bash
curl http://127.0.0.1:8000/windows
```

### Check Permissions (macOS)
```bash
curl http://127.0.0.1:8000/permissions
```

### Perform Action
```bash
curl -X POST http://127.0.0.1:8000/act \
  -H "Content-Type: application/json" \
  -d '{
    "window_title": "iPhone 15 Simulator",
    "instruction": "Click the Login button",
    "action_type": "click"
  }'
```

### Action Types

| Type | Description | Extra Fields |
|------|-------------|--------------|
| `click` | Single click | - |
| `double_click` | Double click | - |
| `right_click` | Right click | - |
| `type` | Type text | `text: "your text"` |
| `scroll` | Scroll | `scroll_direction: "up\|down\|left\|right"` |

### Capture Screenshot Only
```bash
curl -X POST "http://127.0.0.1:8000/capture?window_title=Safari"
```

## macOS Permissions

The app requires these permissions:

1. **Screen Recording** - System Preferences > Privacy & Security > Screen Recording
2. **Accessibility** - System Preferences > Privacy & Security > Accessibility

## Project Structure

```
backend/
├── main.py         # FastAPI server & endpoints
├── windows.py      # Window management (list, bounds, capture)
├── vision.py       # Gemini AI integration
├── actions.py      # Mouse/keyboard actions
├── requirements.txt
└── README.md
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
