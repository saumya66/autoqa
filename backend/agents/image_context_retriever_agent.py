"""
Image Context Retriever Agent

Processes images (Figma designs, screenshots, UI mockups) and extracts
structured UI context for test generation.
"""

from typing import Any, Optional

from .base_agent import BaseAgent


class ImageContextRetrieverAgent(BaseAgent):
    """
    Agent for extracting UI context from images.
    
    Can process:
    - Figma design exports
    - App screenshots
    - UI mockups
    - Wireframes
    """
    
    @property
    def system_prompt(self) -> str:
        return """You are a UI/UX analyst specializing in mobile and web applications.
        
Your task is to analyze UI screenshots and extract structured information that can be used for test case generation.

When analyzing an image, identify:

1. SCREEN TYPE - What kind of screen is this?
   - Examples: home, product_details, cart, checkout, settings, search_results, login, profile

2. KEY ELEMENTS - All interactive and important elements:
   - Buttons (with exact labels)
   - Input fields (with placeholder text if visible)
   - Navigation elements (tabs, back buttons, menus)
   - Icons (describe what they represent)
   - Links and clickable text
   - Images with descriptions
   - Status indicators

3. CONTENT - Text content on screen:
   - Headings and titles
   - Product information (name, price, etc.)
   - Any error messages or notifications
   - Labels and descriptions

4. LAYOUT - Structural information:
   - Header content
   - Footer/navigation bar
   - Main content area
   - Floating elements

Respond ONLY with valid JSON in this exact format:
{
  "screen_type": "product_details",
  "screen_title": "Product Details Page",
  "elements": [
    {
      "type": "button",
      "label": "Add to Bag",
      "location": "bottom_fixed",
      "interactable": true
    },
    {
      "type": "icon",
      "label": "Back arrow",
      "location": "top_left",
      "interactable": true
    },
    {
      "type": "selector",
      "label": "Size: S M L XL",
      "location": "middle",
      "interactable": true
    },
    {
      "type": "image",
      "label": "Product image carousel",
      "location": "top",
      "interactable": true
    }
  ],
  "text_content": [
    "Men's Casual T-Shirt",
    "₹1,299",
    "4.2 ★ | 256 reviews"
  ],
  "navigation": {
    "header": ["back_button", "share_icon", "wishlist_icon", "bag_icon"],
    "footer": ["home_tab", "categories_tab", "studio_tab", "profile_tab"]
  },
  "description": "A product details page showing a men's t-shirt with price, rating, size selector, and Add to Bag button. Bottom navigation has 4 tabs."
}

Be thorough but precise. Only include elements you can clearly see in the image."""

    def parse_response(self, response_text: str) -> Any:
        """Parse the JSON response from Gemini."""
        return self.extract_json(response_text)
    
    def process(self, image_bytes: bytes, additional_context: str = "") -> Optional[dict]:
        """
        Process an image and extract UI context.
        
        Args:
            image_bytes: The image data as bytes.
            additional_context: Optional additional context about the image
                               (e.g., "This is the checkout page of an e-commerce app")
        
        Returns:
            Structured UI context dict or None if processing failed.
        """
        prompt = "Analyze this UI screenshot and extract the structured information."
        
        if additional_context:
            prompt += f"\n\nAdditional context: {additional_context}"
        
        try:
            response = self.call_llm(
                user_prompt=prompt,
                image_bytes=image_bytes,
                max_tokens=2048
            )
            return self.parse_response(response)
        except Exception as e:
            print(f"[ImageContextRetrieverAgent] Error processing image: {e}")
            return None
    
    def process_multiple(self, images: list[tuple[bytes, str]]) -> list[dict]:
        """
        Process multiple images in sequence.
        
        Args:
            images: List of (image_bytes, context_string) tuples.
        
        Returns:
            List of extracted contexts for each image.
        """
        results = []
        for i, (image_bytes, context) in enumerate(images):
            screen_context = f"Screen {i + 1} of {len(images)}. {context}"
            result = self.process(image_bytes, screen_context)
            if result:
                result["order"] = i + 1
                results.append(result)
        return results
