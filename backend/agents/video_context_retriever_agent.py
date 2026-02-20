"""
Video Context Retriever Agent

Processes video recordings (screen recordings, user flows) and extracts
structured flow steps for test generation.
"""

import base64
import io
import tempfile
from typing import Any, Optional

from .base_agent import BaseAgent


class VideoContextRetrieverAgent(BaseAgent):
    """
    Agent for extracting user flow steps from video recordings.
    
    Works by:
    1. Extracting keyframes from video
    2. Sending frames to Gemini for analysis
    3. Detecting user actions between frames
    """
    
    @property
    def system_prompt(self) -> str:
        return """You are analyzing a sequence of screenshots extracted from a screen recording of a mobile/web app.

Your task is to identify what actions the user performed between each frame.

For each significant change between frames, identify:

1. FRAME NUMBER - Which frame shows the change
2. ACTION TYPE - What action was performed:
   - click - User tapped/clicked an element
   - type - User entered text
   - scroll - User scrolled the screen
   - swipe - User swiped (e.g., carousel)
   - wait - Screen changed without user action (loading, animation)
   - navigate - User navigated (back button, deep link)

3. TARGET - What element was interacted with (be specific!)
4. RESULT - What changed on screen after the action

Respond ONLY with valid JSON in this exact format:
{
  "flow_name": "Add to Bag Flow",
  "total_frames": 8,
  "steps": [
    {
      "frame_index": 0,
      "action": "initial",
      "target": null,
      "description": "App home screen with product categories",
      "from_screen": null,
      "to_screen": "home"
    },
    {
      "frame_index": 2,
      "action": "click",
      "target": "FWD tab in bottom navigation",
      "description": "User tapped FWD tab to see fashion feed",
      "from_screen": "home",
      "to_screen": "fwd_feed"
    },
    {
      "frame_index": 4,
      "action": "scroll",
      "target": "product feed",
      "description": "User scrolled down to see more products",
      "from_screen": "fwd_feed",
      "to_screen": "fwd_feed"
    },
    {
      "frame_index": 5,
      "action": "click",
      "target": "Product card - Blue T-Shirt",
      "description": "User tapped on a product to see details",
      "from_screen": "fwd_feed",
      "to_screen": "product_details"
    }
  ],
  "summary": "User navigated from home to FWD feed, scrolled to find a product, then viewed its details"
}

Be precise about:
- Which frame shows each action
- Exact element names/labels when visible
- Screen transitions"""

    def parse_response(self, response_text: str) -> Any:
        """Parse the JSON response from Gemini."""
        return self.extract_json(response_text)
    
    def extract_keyframes(
        self,
        video_bytes: bytes,
        max_frames: int = 20,
        threshold: float = 0.4
    ) -> list[bytes]:
        """
        Extract keyframes from a video based on scene changes.
        
        Args:
            video_bytes: The video file as bytes.
            max_frames: Maximum number of frames to extract.
            threshold: Threshold for scene change detection (0-1).
        
        Returns:
            List of frame images as PNG bytes.
        """
        try:
            import cv2
            import numpy as np
        except ImportError:
            raise ImportError("opencv-python is required for video processing. Install with: pip install opencv-python")
        
        # Write video to temp file (cv2 needs file path)
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(video_bytes)
            temp_path = f.name
        
        try:
            cap = cv2.VideoCapture(temp_path)
            frames = []
            prev_hist = None
            
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            # Sample rate: at least 1 frame per second
            sample_interval = max(1, int(fps / 2))
            
            frame_idx = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Only analyze every N frames
                if frame_idx % sample_interval == 0:
                    # Calculate histogram for scene change detection
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
                    hist = cv2.normalize(hist, hist).flatten()
                    
                    is_keyframe = False
                    
                    if prev_hist is None:
                        # First frame is always a keyframe
                        is_keyframe = True
                    else:
                        # Compare with previous histogram
                        correlation = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL)
                        if correlation < (1 - threshold):
                            is_keyframe = True
                    
                    if is_keyframe:
                        # Encode frame as PNG
                        _, png_data = cv2.imencode(".png", frame)
                        frames.append(png_data.tobytes())
                        prev_hist = hist
                        
                        if len(frames) >= max_frames:
                            break
                
                frame_idx += 1
            
            cap.release()
            
            # If we got very few frames, sample evenly
            if len(frames) < 3 and total_frames > 10:
                cap = cv2.VideoCapture(temp_path)
                frames = []
                sample_points = [int(total_frames * i / max_frames) for i in range(max_frames)]
                
                frame_idx = 0
                while cap.isOpened() and len(frames) < max_frames:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    if frame_idx in sample_points:
                        _, png_data = cv2.imencode(".png", frame)
                        frames.append(png_data.tobytes())
                    
                    frame_idx += 1
                
                cap.release()
            
            return frames
            
        finally:
            # Clean up temp file
            import os
            try:
                os.unlink(temp_path)
            except:
                pass
    
    def process(
        self,
        video_bytes: bytes,
        additional_context: str = "",
        max_frames: int = 15
    ) -> Optional[dict]:
        """
        Process a video and extract user flow steps.
        
        Args:
            video_bytes: The video file as bytes.
            additional_context: Optional context about the video.
            max_frames: Maximum keyframes to analyze.
        
        Returns:
            Structured flow steps dict or None if processing failed.
        """
        try:
            # Extract keyframes
            frames = self.extract_keyframes(video_bytes, max_frames=max_frames)
            
            if not frames:
                print("[VideoContextRetrieverAgent] No keyframes extracted from video")
                return None
            
            print(f"[VideoContextRetrieverAgent] Extracted {len(frames)} keyframes")
            
            # Build prompt with multiple images
            prompt = f"""I'm sending you {len(frames)} keyframes extracted from a screen recording.
Analyze the sequence and identify what actions the user performed.

{additional_context}

Frame sequence follows:"""
            
            # For now, we'll analyze frames one at a time and combine
            # (Gemini has limits on multiple images in one request)
            all_steps = []
            
            for i, frame_bytes in enumerate(frames):
                frame_prompt = f"Frame {i + 1} of {len(frames)}. Describe what you see on this screen."
                
                response = self.call_gemini(
                    user_prompt=frame_prompt,
                    image_bytes=frame_bytes,
                    max_tokens=512
                )
                
                all_steps.append({
                    "frame_index": i,
                    "description": response.strip()
                })
            
            # Now do a final pass to identify actions between frames
            steps_text = "\n".join([
                f"Frame {s['frame_index']}: {s['description']}"
                for s in all_steps
            ])
            
            analysis_prompt = f"""Given these frame descriptions from a screen recording:

{steps_text}

Identify the user actions that occurred between frames. What did the user click, type, scroll, or swipe to cause each screen change?

{additional_context if additional_context else ""}

Respond with the structured JSON as specified."""
            
            final_response = self.call_gemini(
                user_prompt=analysis_prompt,
                max_tokens=2048
            )
            
            return self.parse_response(final_response)
            
        except Exception as e:
            print(f"[VideoContextRetrieverAgent] Error processing video: {e}")
            return None
