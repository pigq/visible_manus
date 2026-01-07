"""
Base Agent Class
Abstract base class for all subagents in the system
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.llm_client import LLMClient


class BaseAgent:
    """Base class for all agents"""

    def __init__(self, system_prompt: str, allowed_servers: list, model: str = None):
        """Initialize base agent

        Args:
            system_prompt: System prompt for this agent
            allowed_servers: List of (server_name, server_path) tuples this agent can access
            model: Model name (default: deepseek-chat)
        """
        self.system_prompt = system_prompt
        self.allowed_servers = allowed_servers
        self.agent_name = self.__class__.__name__

        # Create LLM client
        self.llm_client = LLMClient(model=model)

    def set_mcp_client(self, mcp_client):
        """Set MCP client (called by executor during initialization)

        Args:
            mcp_client: MCP client instance from manager
        """
        self.llm_client.set_mcp_client(mcp_client)

    async def chat(self, messages: list) -> dict:
        """Chat with the agent (internal method with full message history)

        Args:
            messages: List of message dicts

        Returns:
            Final assistant message dict
        """
        # Build full message list with system prompt
        full_messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        full_messages.extend(messages)

        round_count = 0
        max_rounds = 20  # Prevent infinite loops

        # Loop until we get final assistant response (no tool calls)
        while round_count < max_rounds:
            round_count += 1

            # Call LLM
            response_messages = await self.llm_client.chat(
                full_messages,
                allowed_servers=self.allowed_servers
            )

            # Add response messages to history
            full_messages.extend(response_messages)

            # Check if last message is final assistant response
            last_message = full_messages[-1]

            if last_message.get("role") == "assistant" and "tool_calls" not in last_message:
                # Got final response
                return last_message

        # Max rounds reached
        return full_messages[-1] if full_messages else {"role": "assistant", "content": "Error: No response"}

    async def process(self, prompt: str) -> str:
        """Process a prompt and return response (used by executor)

        Args:
            prompt: Task prompt/description

        Returns:
            Agent response as string
        """
        # Convert prompt to messages
        messages = [{"role": "user", "content": prompt}]

        # Call chat
        response = await self.chat(messages)

        # Extract content
        content = response.get("content", "")

        return content
