"""
Base Agent Class

All agents inherit from this base class which provides common functionality
for interacting with AI providers (Gemini or Claude).
"""

import base64
import json
import os
import re
from abc import ABC, abstractmethod
from typing import Any, Literal, Optional

from google import genai
from google.genai import types
import anthropic


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6"

Provider = Literal["gemini", "claude"]


class BaseAgent(ABC):
    """
    Base class for all AutoQA agents.

    Provides common functionality for:
    - AI provider communication (Gemini via google-genai SDK, Claude via anthropic SDK)
    - Response parsing
    - Error handling

    Pass provider='gemini' or provider='claude' to switch backends.
    """

    def __init__(
        self,
        provider: Provider = "claude",
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
    ):
        self.provider = provider
        self.temperature = temperature

        if provider == "gemini":
            key = api_key or os.getenv("GEMINI_API_KEY")
            if not key:
                raise ValueError("GEMINI_API_KEY not found. Set it in .env or pass directly.")
            self.client = genai.Client(api_key=key)
            self.model = model or DEFAULT_GEMINI_MODEL
        else:
            key = api_key or os.getenv("ANTHROPIC_API_KEY")
            if not key:
                raise ValueError("ANTHROPIC_API_KEY not found. Set it in .env or pass directly.")
            self.client = anthropic.Anthropic(api_key=key)
            self.model = model or DEFAULT_CLAUDE_MODEL

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Return the system prompt for this agent."""
        pass

    @abstractmethod
    def parse_response(self, response_text: str) -> Any:
        """Parse the raw response text into structured data."""
        pass

    def call_llm(
        self,
        user_prompt: str,
        image_bytes: Optional[bytes] = None,
        max_tokens: int = 1024,
    ) -> str:
        """
        Call the configured AI provider with text and optional image.
        Routes to Claude or Gemini based on ``self.provider``.

        Returns:
            Raw text response.
        """
        if self.provider == "claude":
            return self._call_claude(user_prompt, image_bytes, max_tokens)
        return self._call_gemini(user_prompt, image_bytes, max_tokens)

    def _call_gemini(
        self,
        user_prompt: str,
        image_bytes: Optional[bytes] = None,
        max_tokens: int = 1024,
    ) -> str:
        contents: list[types.Part] = [
            types.Part.from_text(text=user_prompt)
        ]

        if image_bytes:
            contents.append(
                types.Part.from_bytes(data=image_bytes, mime_type="image/png")
            )

        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=self.system_prompt,
                temperature=self.temperature,
                max_output_tokens=max_tokens,
                response_mime_type="application/json",
            ),
        )

        text = response.text
        if not text:
            if response.candidates:
                candidate = response.candidates[0]
                reason = getattr(candidate, "finish_reason", None)
                print(f"[Gemini] Empty response. finish_reason={reason}")
            return "null"

        return text

    def _call_claude(
        self,
        user_prompt: str,
        image_bytes: Optional[bytes] = None,
        max_tokens: int = 1024,
    ) -> str:
        system = self.system_prompt + "\n\nRespond ONLY with valid JSON. No markdown, no explanation."

        content: list[dict] = []

        if image_bytes:
            img_b64 = base64.b64encode(image_bytes).decode("utf-8")
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": img_b64,
                },
            })

        content.append({"type": "text", "text": user_prompt})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": content}],
            temperature=self.temperature,
        )

        text = response.content[0].text if response.content else ""
        if not text:
            print(f"[Claude] Empty response. stop_reason={response.stop_reason}")
            return "null"

        return text

    def extract_json(self, text: str) -> Optional[dict]:
        """
        Extract JSON from a text response that may contain markdown.

        Returns:
            Parsed JSON dict or None if not found.
        """
        cleaned = text.strip()

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
            return json.loads(cleaned)
        except json.JSONDecodeError:
            json_match = re.search(r'\{[^{}]*\}', cleaned)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass

            array_match = re.search(r'\[[\s\S]*\]', cleaned)
            if array_match:
                try:
                    return json.loads(array_match.group())
                except json.JSONDecodeError:
                    pass

        return None
