"""
Context Builder

Orchestrates the context retriever agents to build a unified FeatureContext
from multiple input sources (images, documents, videos, text).

Flow:
1. Upload phase: Store raw files (no AI processing yet)
2. Generate phase: Process ALL files together, then generate tests

Contexts are persisted to JSON files in the data/contexts/ folder.
Raw files are stored in data/raw/ until processed.
"""

import base64
import json
import os
import time
from pathlib import Path
from typing import Optional

from models.context import ContextType, ContextItem, FeatureContext
from agents import (
    ImageContextRetrieverAgent,
    DocumentContextRetrieverAgent,
    VideoContextRetrieverAgent,
    TestPlannerAgent,
    TestGeneratorAgent,
)


# Data directories
DATA_DIR = Path(__file__).parent / "data" / "contexts"
RAW_DIR = Path(__file__).parent / "data" / "raw"


class ContextBuilder:
    """
    Builds a unified FeatureContext from multiple input sources.
    
    Key Design: AI processing is DEFERRED until generate_test_plan is called.
    During upload, we only store raw files. This allows users to upload
    everything first, then process all at once for better context understanding.
    
    Usage:
        builder = ContextBuilder()
        context = builder.create_context("Add to Bag Feature")
        
        # Add inputs (stored but not processed yet)
        builder.add_image(context.id, image_bytes, "product_page.png")
        builder.add_document(context.id, pdf_bytes, "prd.pdf", "pdf")
        builder.add_text(context.id, "User should be able to...")
        
        # Process all and generate tests
        test_plan = builder.generate_test_plan(context.id)
    """
    
    def __init__(self):
        self._contexts: dict[str, FeatureContext] = {}
        
        # Ensure data directories exist
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        
        # Load existing contexts from disk
        self._load_all_contexts()
    
    def _get_context_path(self, context_id: str) -> Path:
        """Get the file path for a context."""
        return DATA_DIR / f"{context_id}.json"
    
    def _get_raw_path(self, context_id: str, item_id: str, extension: str = "") -> Path:
        """Get the file path for raw data."""
        context_dir = RAW_DIR / context_id
        context_dir.mkdir(parents=True, exist_ok=True)
        return context_dir / f"{item_id}{extension}"
    
    def _save_context(self, context: FeatureContext) -> None:
        """Save a context to disk (without raw data - that's stored separately)."""
        path = self._get_context_path(context.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(context.to_dict(include_raw=False), f, indent=2, ensure_ascii=False)
        print(f"[ContextBuilder] Saved context to {path}")
    
    def _save_raw_file(self, context_id: str, item_id: str, data: bytes, extension: str = "") -> str:
        """Save raw file data to disk. Returns the file path."""
        path = self._get_raw_path(context_id, item_id, extension)
        with open(path, "wb") as f:
            f.write(data)
        print(f"[ContextBuilder] Saved raw file to {path}")
        return str(path)
    
    def _load_raw_file(self, context_id: str, item_id: str, extension: str = "") -> Optional[bytes]:
        """Load raw file data from disk."""
        path = self._get_raw_path(context_id, item_id, extension)
        if path.exists():
            with open(path, "rb") as f:
                return f.read()
        return None
    
    def _load_context(self, path: Path) -> Optional[FeatureContext]:
        """Load a context from disk."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Reconstruct FeatureContext from dict
            context = FeatureContext(
                id=data["id"],
                name=data["name"],
                description=data.get("description", ""),
                status=data.get("status", "draft"),
                created_at=data.get("created_at", ""),
                items=[]
            )
            
            # Reconstruct items
            for item_data in data.get("items", []):
                item = ContextItem(
                    id=item_data["id"],
                    type=ContextType(item_data["type"]),
                    source_name=item_data["source_name"],
                    extracted=item_data.get("extracted", {}),
                    processed=item_data.get("processed", False),
                    file_type=item_data.get("file_type"),
                    created_at=item_data.get("created_at", "")
                )
                context.items.append(item)
            
            return context
        except Exception as e:
            print(f"[ContextBuilder] Error loading context from {path}: {e}")
            return None
    
    def _load_all_contexts(self) -> None:
        """Load all existing contexts from disk."""
        if not DATA_DIR.exists():
            return
        
        for path in DATA_DIR.glob("*.json"):
            # Skip test files
            if "_tests.json" in str(path):
                continue
            context = self._load_context(path)
            if context:
                self._contexts[context.id] = context
                print(f"[ContextBuilder] Loaded context: {context.name} ({context.id})")
        
        print(f"[ContextBuilder] Loaded {len(self._contexts)} contexts from disk")
    
    def _delete_context_files(self, context_id: str) -> None:
        """Delete all files for a context."""
        # Delete context JSON
        path = self._get_context_path(context_id)
        if path.exists():
            path.unlink()
        
        # Delete raw files directory
        raw_path = RAW_DIR / context_id
        if raw_path.exists():
            import shutil
            shutil.rmtree(raw_path)
        
        # Delete tests file if exists
        tests_path = DATA_DIR / f"{context_id}_tests.json"
        if tests_path.exists():
            tests_path.unlink()
        
        print(f"[ContextBuilder] Deleted all files for context: {context_id}")
    
    def create_context(self, name: str, description: str = "") -> FeatureContext:
        """Create a new feature context."""
        context = FeatureContext.create(name, description)
        self._contexts[context.id] = context
        self._save_context(context)
        return context
    
    def get_context(self, context_id: str) -> Optional[FeatureContext]:
        """Get a context by ID."""
        return self._contexts.get(context_id)
    
    def list_contexts(self) -> list[dict]:
        """List all contexts with summary info."""
        return [ctx.to_dict() for ctx in self._contexts.values()]
    
    def delete_context(self, context_id: str) -> bool:
        """Delete a context by ID."""
        if context_id in self._contexts:
            del self._contexts[context_id]
            self._delete_context_files(context_id)
            return True
        return False
    
    # =========================================================================
    # UPLOAD METHODS - Store raw files WITHOUT AI processing
    # =========================================================================
    
    def add_image(
        self,
        context_id: str,
        image_bytes: bytes,
        source_name: str,
        additional_context: str = ""
    ) -> Optional[ContextItem]:
        """
        Add an image to a context. Stores raw data - AI processing happens later.
        """
        context = self._contexts.get(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        # Create item (not processed yet)
        item = ContextItem.create(
            type=ContextType.IMAGE,
            source_name=source_name,
            extracted={},  # Empty - will be filled during processing
            processed=False
        )
        
        # Store additional context if provided
        if additional_context:
            item.extracted["additional_context"] = additional_context
        
        # Save raw file
        extension = Path(source_name).suffix or ".png"
        self._save_raw_file(context_id, item.id, image_bytes, extension)
        
        context.items.append(item)
        self._save_context(context)
        
        print(f"[ContextBuilder] Stored image: {source_name} (pending processing)")
        return item
    
    def add_document(
        self,
        context_id: str,
        document_bytes: bytes,
        source_name: str,
        file_type: str,
        additional_context: str = ""
    ) -> Optional[ContextItem]:
        """
        Add a document to a context. Stores raw data - AI processing happens later.
        """
        context = self._contexts.get(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        # Create item (not processed yet)
        item = ContextItem.create(
            type=ContextType.DOCUMENT,
            source_name=source_name,
            extracted={},
            processed=False,
            file_type=file_type
        )
        
        if additional_context:
            item.extracted["additional_context"] = additional_context
        
        # Save raw file
        extension = f".{file_type}" if not source_name.endswith(f".{file_type}") else ""
        self._save_raw_file(context_id, item.id, document_bytes, extension or Path(source_name).suffix)
        
        context.items.append(item)
        self._save_context(context)
        
        print(f"[ContextBuilder] Stored document: {source_name} (pending processing)")
        return item
    
    def add_video(
        self,
        context_id: str,
        video_bytes: bytes,
        source_name: str,
        additional_context: str = ""
    ) -> Optional[ContextItem]:
        """
        Add a video to a context. Stores raw data - AI processing happens later.
        """
        context = self._contexts.get(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        # Create item (not processed yet)
        item = ContextItem.create(
            type=ContextType.VIDEO,
            source_name=source_name,
            extracted={},
            processed=False
        )
        
        if additional_context:
            item.extracted["additional_context"] = additional_context
        
        # Save raw file
        extension = Path(source_name).suffix or ".mp4"
        self._save_raw_file(context_id, item.id, video_bytes, extension)
        
        context.items.append(item)
        self._save_context(context)
        
        print(f"[ContextBuilder] Stored video: {source_name} (pending processing)")
        return item
    
    def add_text(
        self,
        context_id: str,
        text: str,
        source_name: str = "user_notes"
    ) -> ContextItem:
        """
        Add raw text notes to a context. Text is stored directly (no AI needed).
        """
        context = self._contexts.get(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        # Text doesn't need AI processing - just store it directly
        item = ContextItem.create(
            type=ContextType.TEXT,
            source_name=source_name,
            extracted={"text": text, "type": "user_input"},
            processed=True  # Text is already "processed"
        )
        
        context.items.append(item)
        self._save_context(context)
        
        print(f"[ContextBuilder] Stored text note: {source_name}")
        return item
    
    def update_status(self, context_id: str, status: str) -> bool:
        """Update the status of a context."""
        context = self._contexts.get(context_id)
        if not context:
            return False
        context.status = status
        self._save_context(context)
        return True
    
    # =========================================================================
    # PROCESSING - Process all pending items
    # =========================================================================
    
    def _process_pending_items(self, context: FeatureContext, provider: str = "claude") -> None:
        """Process all unprocessed items in a context using AI agents."""
        pending_items = [item for item in context.items if not item.processed]
        
        if not pending_items:
            print(f"[ContextBuilder] No pending items to process")
            return
        
        # Extract user feedback if present
        feedback_items = [
            item for item in context.items 
            if item.type == ContextType.TEXT and item.extracted.get("type") == "correction"
        ]
        user_feedback = ""
        if feedback_items:
            latest_feedback = max(feedback_items, key=lambda x: x.extracted.get("timestamp", 0))
            user_feedback = latest_feedback.extracted.get("text", "")
            print(f"[ContextBuilder] Using user feedback for reprocessing: {user_feedback[:100]}...")
        
        image_agent = ImageContextRetrieverAgent(provider=provider)
        document_agent = DocumentContextRetrieverAgent(provider=provider)
        video_agent = VideoContextRetrieverAgent(provider=provider)
        
        print(f"[ContextBuilder] Processing {len(pending_items)} pending items (provider={provider})...")
        
        for item in pending_items:
            try:
                if item.type == ContextType.IMAGE:
                    self._process_image(context.id, item, user_feedback, image_agent)
                elif item.type == ContextType.DOCUMENT:
                    self._process_document(context.id, item, user_feedback, document_agent)
                elif item.type == ContextType.VIDEO:
                    self._process_video(context.id, item, user_feedback, video_agent)
            except Exception as e:
                print(f"[ContextBuilder] Error processing {item.source_name}: {e}")
                item.extracted["error"] = str(e)
                item.processed = True
        
        self._save_context(context)
    
    def _process_image(self, context_id: str, item: ContextItem, user_feedback: str = "", agent=None) -> None:
        """Process a single image item with AI."""
        extension = Path(item.source_name).suffix or ".png"
        raw_bytes = self._load_raw_file(context_id, item.id, extension)
        
        if not raw_bytes:
            raise ValueError(f"Raw file not found for {item.source_name}")
        
        print(f"[ContextBuilder] Processing image: {item.source_name}")
        additional_context = item.extracted.get("additional_context", "")
        
        if user_feedback:
            if additional_context:
                additional_context = f"{additional_context}\n\nUser Feedback/Corrections: {user_feedback}"
            else:
                additional_context = f"User Feedback/Corrections: {user_feedback}"
        
        if agent is None:
            agent = ImageContextRetrieverAgent()
        result = agent.process(raw_bytes, additional_context)
        
        if result:
            if additional_context:
                result["additional_context"] = additional_context
            item.extracted = result
            item.processed = True
        else:
            item.extracted["error"] = "AI processing failed"
            item.processed = True
    
    def _process_document(self, context_id: str, item: ContextItem, user_feedback: str = "", agent=None) -> None:
        """Process a single document item with AI."""
        extension = f".{item.file_type}" if item.file_type else Path(item.source_name).suffix
        raw_bytes = self._load_raw_file(context_id, item.id, extension)
        
        if not raw_bytes:
            raise ValueError(f"Raw file not found for {item.source_name}")
        
        print(f"[ContextBuilder] Processing document: {item.source_name}")
        additional_context = item.extracted.get("additional_context", "")
        
        if user_feedback:
            if additional_context:
                additional_context = f"{additional_context}\n\nUser Feedback/Corrections: {user_feedback}"
            else:
                additional_context = f"User Feedback/Corrections: {user_feedback}"
        
        if agent is None:
            agent = DocumentContextRetrieverAgent()
        result = agent.process(
            raw_bytes, 
            item.file_type or "txt",
            additional_context
        )
        
        if result:
            if additional_context:
                result["additional_context"] = additional_context
            item.extracted = result
            item.processed = True
        else:
            item.extracted["error"] = "AI processing failed"
            item.processed = True
    
    def _process_video(self, context_id: str, item: ContextItem, user_feedback: str = "", agent=None) -> None:
        """Process a single video item with AI."""
        extension = Path(item.source_name).suffix or ".mp4"
        raw_bytes = self._load_raw_file(context_id, item.id, extension)
        
        if not raw_bytes:
            raise ValueError(f"Raw file not found for {item.source_name}")
        
        print(f"[ContextBuilder] Processing video: {item.source_name}")
        additional_context = item.extracted.get("additional_context", "")
        
        if user_feedback:
            if additional_context:
                additional_context = f"{additional_context}\n\nUser Feedback/Corrections: {user_feedback}"
            else:
                additional_context = f"User Feedback/Corrections: {user_feedback}"
        
        if agent is None:
            agent = VideoContextRetrieverAgent()
        result = agent.process(raw_bytes, additional_context)
        
        if result:
            if additional_context:
                result["additional_context"] = additional_context
            item.extracted = result
            item.processed = True
        else:
            item.extracted["error"] = "AI processing failed"
            item.processed = True
    
    # =========================================================================
    # CONTEXT BUILDING - Process all items and generate summary
    # =========================================================================
    
    def build_context(self, context_id: str, user_feedback: str = "", provider: str = "claude") -> Optional[dict]:
        """
        Process all uploaded items and build the unified context.
        
        Args:
            context_id: The context ID to build.
            user_feedback: Optional feedback/corrections from the user to improve context.
            provider: AI provider to use ('claude' or 'gemini').
        """
        context = self._contexts.get(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        if not context.items:
            raise ValueError(f"Context has no items. Upload some inputs first.")
        
        # If user provided feedback, add it as a correction note
        if user_feedback:
            print(f"[ContextBuilder] Processing user feedback: {user_feedback[:100]}...")
            feedback_item = ContextItem.create(
                type=ContextType.TEXT,
                source_name="user_feedback",
                extracted={"text": user_feedback, "type": "correction", "timestamp": time.time()},
                processed=True
            )
            context.items.append(feedback_item)
            # Reprocess items with feedback in mind
            # Mark all items as unprocessed so they can be reprocessed with feedback context
            for item in context.items:
                if item.type != ContextType.TEXT or item.extracted.get("type") != "correction":
                    item.processed = False
        
        # Update status
        context.status = "processing"
        self._save_context(context)
        
        # Process all pending items (with feedback context if provided)
        print(f"[ContextBuilder] === Building context for: {context.name} ===")
        if user_feedback:
            print(f"[ContextBuilder] Reprocessing with user feedback...")
        self._process_pending_items(context, provider=provider)
        
        # Build summary of what was understood
        summary = self._build_context_summary(context)
        
        # Update status
        context.status = "context_ready"
        self._save_context(context)
        
        return {
            "context_id": context_id,
            "feature_name": context.name,
            "summary": summary,
            "processed_items": [
                {
                    "id": item.id,
                    "type": item.type.value,
                    "source_name": item.source_name,
                    "processed": item.processed,
                    "extracted_summary": self._get_item_summary(item)
                }
                for item in context.items
            ],
            "status": context.status,
            "has_feedback": bool(user_feedback)
        }
    
    def _build_context_summary(self, context: FeatureContext) -> dict:
        """Build a human-readable summary of the processed context."""
        summary = {
            "screens_detected": [],
            "ui_elements": [],
            "requirements": [],
            "user_flows": [],
            "text_notes": []
        }
        
        for item in context.items:
            if not item.processed:
                continue
                
            if item.type == ContextType.IMAGE:
                screen_name = item.extracted.get("screen_title") or item.extracted.get("screen_type", "Unknown screen")
                summary["screens_detected"].append({
                    "name": screen_name,
                    "source": item.source_name,
                    "description": item.extracted.get("description", "")
                })
                
                elements = item.extracted.get("elements", [])
                for elem in elements[:10]:  # Top 10 elements
                    summary["ui_elements"].append({
                        "type": elem.get("type", "element"),
                        "label": elem.get("label", ""),
                        "location": elem.get("location", "")
                    })
            
            elif item.type == ContextType.DOCUMENT:
                reqs = item.extracted.get("requirements", [])
                for req in reqs:
                    summary["requirements"].append({
                        "text": req.get("text", ""),
                        "priority": req.get("priority", "should")
                    })
                
                flows = item.extracted.get("user_flows", [])
                for flow in flows:
                    summary["user_flows"].append({
                        "name": flow.get("name", "Flow"),
                        "steps": flow.get("steps", [])
                    })
            
            elif item.type == ContextType.VIDEO:
                steps = item.extracted.get("steps", [])
                if steps:
                    summary["user_flows"].append({
                        "name": f"Recorded flow from {item.source_name}",
                        "steps": [s.get("description", "") for s in steps]
                    })
            
            elif item.type == ContextType.TEXT:
                summary["text_notes"].append(item.extracted.get("text", ""))
        
        return summary
    
    def _get_item_summary(self, item: ContextItem) -> str:
        """Get a brief summary of what was extracted from an item."""
        if item.type == ContextType.IMAGE:
            screen = item.extracted.get("screen_title") or item.extracted.get("screen_type", "")
            elements = len(item.extracted.get("elements", []))
            return f"{screen} - {elements} UI elements detected"
        
        elif item.type == ContextType.DOCUMENT:
            reqs = len(item.extracted.get("requirements", []))
            flows = len(item.extracted.get("user_flows", []))
            return f"{reqs} requirements, {flows} user flows extracted"
        
        elif item.type == ContextType.VIDEO:
            steps = len(item.extracted.get("steps", []))
            return f"{steps} interaction steps detected"
        
        elif item.type == ContextType.TEXT:
            text = item.extracted.get("text", "")
            return f"{len(text)} characters of notes"
        
        return "Processed"
    
    # =========================================================================
    # TEST GENERATION
    # =========================================================================
    
    def generate_test_plan(self, context_id: str, provider: str = "claude") -> Optional[dict]:
        """
        Generate text-based test cases for user review.
        
        Assumes context has already been built (items processed).
        """
        context = self._contexts.get(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        if not context.items:
            raise ValueError(f"Context has no items. Upload some inputs first.")
        
        # Check if context has been processed
        pending = [item for item in context.items if not item.processed]
        if pending:
            raise ValueError(f"Context has {len(pending)} unprocessed items. Build context first.")
        
        # Update status
        print(f"[ContextBuilder] Generating test plan for: {context.name}")
        context.status = "generating_plan"
        self._save_context(context)
        
        context_dict = context.to_dict()
        test_planner = TestPlannerAgent(provider=provider)
        test_plan = test_planner.generate_from_feature_context(context_dict)
        
        if not test_plan:
            context.status = "draft"
            self._save_context(context)
            raise Exception("Failed to generate test plan")
        
        result = {
            "context_id": context_id,
            "feature_name": context.name,
            "feature_summary": test_plan.get("feature_summary", ""),
            "test_cases": test_plan.get("test_cases", []),
            "coverage_notes": test_plan.get("coverage_notes", ""),
            "status": "pending_review",
            "executable_tests": None
        }
        
        # Update context status
        context.status = "pending_review"
        self._save_context(context)
        
        # Save test plan for review
        tests_path = DATA_DIR / f"{context_id}_tests.json"
        with open(tests_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"[ContextBuilder] Saved test plan to {tests_path} - awaiting user review")
        
        return result
    
    def approve_tests(self, context_id: str, approved_test_ids: list = None) -> Optional[dict]:
        """Mark test cases as approved (ready for execution)."""
        context = self._contexts.get(context_id)
        if not context:
            raise ValueError(f"Context not found: {context_id}")
        
        tests_path = DATA_DIR / f"{context_id}_tests.json"
        if not tests_path.exists():
            raise ValueError(f"No test plan found. Generate test plan first.")
        
        with open(tests_path, "r", encoding="utf-8") as f:
            test_data = json.load(f)
        
        if test_data.get("status") != "pending_review":
            raise ValueError(f"Test plan status is '{test_data.get('status')}', expected 'pending_review'")
        
        test_cases = test_data.get("test_cases", [])
        
        if approved_test_ids:
            test_cases = [tc for tc in test_cases if tc.get("id") in approved_test_ids]
        
        if not test_cases:
            raise ValueError("No test cases to approve.")
        
        print(f"[ContextBuilder] Approving {len(test_cases)} test cases...")
        
        # Mark tests as approved (no JSON generation needed)
        test_data["status"] = "approved"
        test_data["test_cases"] = test_cases
        
        context.status = "ready"
        self._save_context(context)
        
        with open(tests_path, "w", encoding="utf-8") as f:
            json.dump(test_data, f, indent=2, ensure_ascii=False)
        print(f"[ContextBuilder] ✓ Approved {len(test_cases)} test cases. Ready for execution.")
        
        return test_data
    
    def update_test_case(self, context_id: str, test_id: str, updates: dict) -> Optional[dict]:
        """Update a specific test case."""
        tests_path = DATA_DIR / f"{context_id}_tests.json"
        if not tests_path.exists():
            raise ValueError(f"No test plan found for context {context_id}")
        
        with open(tests_path, "r", encoding="utf-8") as f:
            test_data = json.load(f)
        
        test_cases = test_data.get("test_cases", [])
        updated = False
        for tc in test_cases:
            if tc.get("id") == test_id:
                for key, value in updates.items():
                    tc[key] = value
                updated = True
                break
        
        if not updated:
            raise ValueError(f"Test case {test_id} not found")
        
        with open(tests_path, "w", encoding="utf-8") as f:
            json.dump(test_data, f, indent=2, ensure_ascii=False)
        
        return test_data
    
    def get_test_plan(self, context_id: str) -> Optional[dict]:
        """Get the test plan for review."""
        tests_path = DATA_DIR / f"{context_id}_tests.json"
        if not tests_path.exists():
            return None
        
        with open(tests_path, "r", encoding="utf-8") as f:
            return json.load(f)


# Lazy singleton instance
_context_builder: Optional[ContextBuilder] = None

def get_context_builder() -> ContextBuilder:
    """Get the singleton ContextBuilder instance (lazy initialization)."""
    global _context_builder
    if _context_builder is None:
        _context_builder = ContextBuilder()
    return _context_builder
