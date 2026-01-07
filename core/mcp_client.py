"""
MCP Client for connecting to and managing MCP servers
"""

import asyncio
import json
import sys
from typing import Optional, List, Dict, Any, Union
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


class MCPClient:
    """MCP client for managing connections to multiple MCP servers"""

    # Tools to block (they cause token limit issues)
    BLOCKED_TOOLS = ['screenshot', 'browser_screenshot', 'take_screenshot']

    def __init__(self):
        """Initialize MCP client"""
        self.sessions: Dict[str, ClientSession] = {}
        self.exit_stack = AsyncExitStack()
        self.available_tools: List[Dict[str, Any]] = []

    async def connect_to_server(self, server_name: str, server_config: Union[str, Dict[str, Any]]):
        """Connect to an MCP server

        Args:
            server_name: Unique name for the server
            server_config: Either a path to a Python server script (str) or a config dict with:
                - command: The command to run (e.g., "npx", "python")
                - args: List of arguments for the command
                - env: Optional environment variables dict
        """
        if isinstance(server_config, str):
            # Legacy support: Python script path
            server_params = StdioServerParameters(
                command=sys.executable,
                args=[server_config],
                env=None
            )
        else:
            # New format: dict with command, args, env
            server_params = StdioServerParameters(
                command=server_config["command"],
                args=server_config.get("args", []),
                env=server_config.get("env")
            )

        stdio_transport = await self.exit_stack.enter_async_context(
            stdio_client(server_params)
        )
        stdio, write = stdio_transport
        session = await self.exit_stack.enter_async_context(
            ClientSession(stdio, write)
        )

        await session.initialize()
        self.sessions[server_name] = session

        # Get tools from this server
        response = await session.list_tools()
        for tool in response.tools:
            # Skip blocked tools (screenshot causes token limit issues)
            if any(blocked in tool.name.lower() for blocked in self.BLOCKED_TOOLS):
                continue

            # Prefix tool name with server name to avoid conflicts
            prefixed_name = f"{server_name}__{tool.name}"
            self.available_tools.append({
                "name": prefixed_name,
                "original_name": tool.name,
                "description": tool.description,
                "input_schema": tool.inputSchema,
                "server": server_name
            })

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]):
        """Call a tool by its prefixed name

        Args:
            tool_name: Tool name with server prefix (e.g., "time_tool__get_current_time")
            arguments: Tool arguments as dict

        Returns:
            Tool result content
        """
        # Find the server and original tool name
        server_name = None
        original_name = None
        for tool in self.available_tools:
            if tool["name"] == tool_name:
                server_name = tool["server"]
                original_name = tool["original_name"]
                break

        if not server_name or server_name not in self.sessions:
            raise ValueError(f"Tool {tool_name} not found or server not connected")

        session = self.sessions[server_name]
        # Call tool using original name (without prefix)
        result = await session.call_tool(original_name, arguments)

        return result.content

    def get_available_tools(self) -> List[Dict[str, Any]]:
        """Get all available tools in OpenAI function format

        Returns:
            List of tool definitions
        """
        return [{
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["input_schema"]
            }
        } for tool in self.available_tools]

    async def close(self):
        """Close all MCP server connections"""
        try:
            await self.exit_stack.aclose()
        except RuntimeError as e:
            # Ignore "cancel scope" errors during shutdown
            if "cancel scope" not in str(e):
                raise
