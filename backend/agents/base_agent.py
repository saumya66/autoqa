"""
Base Agent Class

All agents inherit from this base class which provides common functionality
for interacting with the Gemini API.
"""

import base64
import json
import os
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional

import requests


@dataclass
class GeminiConfig:
    """Configuration for Gemini API."""
    api_key: str
    base_url: str = "https://generativelanguage.googleapis.com/v1beta/models"
    model: str = "gemini-2.0-flash"
    
    @property
    def endpoint(self) -> str:
        """Get the full API endpoint URL."""
        return f"{self.base_url}/{self.model}:generateContent"


class BaseAgent(ABC):
    """
    Base class for all AutoQA agents.
    
    Provides common functionality for:
    - Gemini API communication
    - Response parsing
    - Error handling
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.0-flash",
        temperature: float = 0.1
    ):
        """
        Initialize the agent.
        
        Args:
            api_key: Gemini API key. If None, reads from GEMINI_API_KEY env var.
            model: Gemini model to use.
            temperature: Temperature for generation (lower = more deterministic).
        """
        key = api_key or os.getenv("GEMINI_API_KEY")
        if not key:
            raise ValueError("GEMINI_API_KEY not found. Set it in .env or pass directly.")
        
        self.config = GeminiConfig(api_key=key, model=model)
        self.temperature = temperature
    
    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Return the system prompt for this agent."""
        pass
    
    @abstractmethod
    def parse_response(self, response_text: str) -> Any:
        """Parse the raw response text into structured data."""
        pass
    
    def call_gemini(
        self,
        user_prompt: str,
        image_bytes: Optional[bytes] = None,
        max_tokens: int = 1024
    ) -> str:
        """
        Call Gemini API with text and optional image.
        
        Args:
            user_prompt: The user's instruction/query.
            image_bytes: Optional PNG image bytes.
            max_tokens: Maximum tokens in response.
            
        Returns:
            Raw text response from Gemini.
        """
        # Build the parts array
        parts = [{"text": f"{self.system_prompt}\n\n{user_prompt}"}]
        
        # Add image if provided
        if image_bytes:
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
            parts.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": image_b64
                }
            })
        
        # Build payload
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": max_tokens
            }
        }
        
        # Make request
        headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": self.config.api_key
        }
        
        # Use tuple timeout (connect_timeout, read_timeout) for better Ctrl+C response
        response = requests.post(
            self.config.endpoint,
            json=payload,
            headers=headers,
            timeout=(5, 25)  # 5s connect, 25s read
        )
        
        if response.status_code != 200:
            raise Exception(f"Gemini API error: {response.status_code} - {response.text}")
        
        # Extract text from response
        result = response.json()
        try:
            return result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise Exception(f"Unexpected Gemini response format: {e}")
    
    def extract_json(self, text: str) -> Optional[dict]:
        """
        Extract JSON from a text response that may contain markdown.
        
        Args:
            text: Raw text that may contain JSON.
            
        Returns:
            Parsed JSON dict or None if not found.
        """
        cleaned = text.strip()
        
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
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract JSON object from text
            json_match = re.search(r'\{[^{}]*\}', cleaned)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            
            # Try to extract JSON array from text
            array_match = re.search(r'\[[\s\S]*\]', cleaned)
            if array_match:
                try:
                    return json.loads(array_match.group())
                except json.JSONDecodeError:
                    pass
        
        return None
