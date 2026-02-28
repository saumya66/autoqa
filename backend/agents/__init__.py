"""
AutoQA Agents Module

This module contains reusable AI agents for the AutoQA system.
Each agent is responsible for a specific task and can be called from anywhere.

Available Agents:
- VisionAgent: Detects UI elements in screenshots
- PlannerAgent: Breaks down complex instructions into action steps (static)
- WindowResolverAgent: Determines which window to use from instruction
- OrchestratorAgent: Reactive agent that adapts to screen changes

Context Retriever Agents (for test generation):
- ImageContextRetrieverAgent: Extracts UI context from images/Figma designs
- DocumentContextRetrieverAgent: Extracts requirements from PRD/documents
- VideoContextRetrieverAgent: Extracts flow steps from screen recordings
"""

from agents.base_agent import BaseAgent
from agents.vision_agent import VisionAgent
from agents.planner_agent import PlannerAgent
from agents.window_resolver_agent import WindowResolverAgent
from agents.orchestrator_agent import OrchestratorAgent
from agents.computer_use_agent import ComputerUseAgent
from agents.claude_computer_use_agent import ClaudeComputerUseAgent
from agents.image_context_retriever_agent import ImageContextRetrieverAgent
from agents.document_context_retriever_agent import DocumentContextRetrieverAgent
from agents.video_context_retriever_agent import VideoContextRetrieverAgent
from agents.test_planner_agent import TestPlannerAgent
from agents.test_generator_agent import TestGeneratorAgent

__all__ = [
    # Core execution agents
    "BaseAgent",
    "VisionAgent", 
    "PlannerAgent",
    "WindowResolverAgent",
    "OrchestratorAgent",
    "ComputerUseAgent",
    "ClaudeComputerUseAgent",
    # Context retriever agents
    "ImageContextRetrieverAgent",
    "DocumentContextRetrieverAgent",
    "VideoContextRetrieverAgent",
    # Test generation agents
    "TestPlannerAgent",
    "TestGeneratorAgent",
]
