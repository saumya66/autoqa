"""
Context Models for Feature Test Generation

These models represent the unified context extracted from various inputs
(images, documents, videos, text) that will be used to generate test cases.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
import uuid


class ContextType(str, Enum):
    """Type of context source"""
    IMAGE = "image"
    DOCUMENT = "document"
    VIDEO = "video"
    TEXT = "text"


@dataclass
class UIElement:
    """A UI element detected in an image"""
    type: str  # button, input, icon, text, image, link, etc.
    label: str  # The text or description of the element
    location: str  # top, bottom, center, top_right, etc.
    interactable: bool = True


@dataclass
class Requirement:
    """A requirement extracted from a document"""
    text: str
    category: str  # functional, validation, error_handling, edge_case
    priority: str  # must, should, could


@dataclass
class FlowStep:
    """A step in a user flow (from video or document)"""
    order: int
    action: str  # click, type, scroll, swipe, wait
    target: str  # Element to interact with
    description: str
    from_screen: Optional[str] = None
    to_screen: Optional[str] = None


@dataclass
class ScreenContext:
    """Context extracted from a single image/screen"""
    screen_type: str  # product_details, listing, form, settings, etc.
    title: Optional[str] = None
    elements: list[UIElement] = field(default_factory=list)
    text_content: list[str] = field(default_factory=list)
    description: str = ""


@dataclass
class DocumentContext:
    """Context extracted from a document"""
    feature_name: str
    summary: str
    requirements: list[Requirement] = field(default_factory=list)
    user_flows: list[dict] = field(default_factory=list)
    edge_cases: list[str] = field(default_factory=list)
    acceptance_criteria: list[str] = field(default_factory=list)


@dataclass
class VideoContext:
    """Context extracted from a video"""
    flow_name: str
    total_steps: int
    steps: list[FlowStep] = field(default_factory=list)
    summary: str = ""


@dataclass
class ContextItem:
    """A single piece of context from any source"""
    id: str
    type: ContextType
    source_name: str  # Original filename or identifier
    extracted: dict  # AI-extracted structured data (empty until processed)
    raw_base64: Optional[str] = None  # Base64 encoded raw data (for images)
    processed: bool = False  # Whether AI has processed this item
    file_type: Optional[str] = None  # For documents: pdf, docx, txt
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    @staticmethod
    def create(
        type: ContextType, 
        source_name: str, 
        extracted: dict = None, 
        raw_base64: str = None,
        processed: bool = False,
        file_type: str = None
    ) -> "ContextItem":
        return ContextItem(
            id=str(uuid.uuid4()),
            type=type,
            source_name=source_name,
            extracted=extracted or {},
            raw_base64=raw_base64,
            processed=processed,
            file_type=file_type
        )


@dataclass
class FeatureContext:
    """Combined context from all inputs for a feature"""
    id: str
    name: str
    description: str = ""
    items: list[ContextItem] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    status: str = "draft"  # draft, ready, processing, completed
    
    @staticmethod
    def create(name: str, description: str = "") -> "FeatureContext":
        return FeatureContext(
            id=str(uuid.uuid4()),
            name=name,
            description=description
        )
    
    # Convenience accessors
    @property
    def images(self) -> list[ContextItem]:
        return [i for i in self.items if i.type == ContextType.IMAGE]
    
    @property
    def documents(self) -> list[ContextItem]:
        return [i for i in self.items if i.type == ContextType.DOCUMENT]
    
    @property
    def videos(self) -> list[ContextItem]:
        return [i for i in self.items if i.type == ContextType.VIDEO]
    
    @property
    def text_items(self) -> list[ContextItem]:
        return [i for i in self.items if i.type == ContextType.TEXT]
    
    def get_all_requirements(self) -> list[Requirement]:
        """Get all requirements from all document sources"""
        reqs = []
        for item in self.documents:
            for req_dict in item.extracted.get("requirements", []):
                reqs.append(Requirement(
                    text=req_dict.get("text", ""),
                    category=req_dict.get("category", "functional"),
                    priority=req_dict.get("priority", "should")
                ))
        return reqs
    
    def get_all_ui_elements(self) -> list[UIElement]:
        """Get all UI elements from all image sources"""
        elements = []
        for item in self.images:
            for elem_dict in item.extracted.get("elements", []):
                elements.append(UIElement(
                    type=elem_dict.get("type", "unknown"),
                    label=elem_dict.get("label", ""),
                    location=elem_dict.get("location", "unknown"),
                    interactable=elem_dict.get("interactable", True)
                ))
        return elements
    
    def get_all_flow_steps(self) -> list[FlowStep]:
        """Get all flow steps from video sources"""
        steps = []
        for item in self.videos:
            for step_dict in item.extracted.get("steps", []):
                steps.append(FlowStep(
                    order=step_dict.get("order", 0),
                    action=step_dict.get("action", "click"),
                    target=step_dict.get("target", ""),
                    description=step_dict.get("description", ""),
                    from_screen=step_dict.get("from_screen"),
                    to_screen=step_dict.get("to_screen")
                ))
        return sorted(steps, key=lambda s: s.order)
    
    def to_dict(self, include_raw: bool = False) -> dict:
        """Convert to dictionary for JSON serialization"""
        items_data = []
        for item in self.items:
            item_dict = {
                "id": item.id,
                "type": item.type.value,
                "source_name": item.source_name,
                "extracted": item.extracted,
                "processed": item.processed,
                "file_type": item.file_type,
                "created_at": item.created_at
            }
            # Only include raw_base64 if explicitly requested (for processing)
            if include_raw and item.raw_base64:
                item_dict["raw_base64"] = item.raw_base64
            items_data.append(item_dict)
        
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at,
            "items": items_data,
            "summary": {
                "total_items": len(self.items),
                "images": len(self.images),
                "documents": len(self.documents),
                "videos": len(self.videos),
                "text_notes": len(self.text_items),
                "processed": len([i for i in self.items if i.processed]),
                "pending": len([i for i in self.items if not i.processed])
            }
        }
