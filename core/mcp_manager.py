"""
MCP Connection Pool Manager
Singleton pattern for managing MCP server connections
"""

import asyncio
from typing import Optional, List, Tuple, Union, Dict, Any
from .mcp_client import MCPClient

# Type alias for server config: (name, path_or_config)
ServerConfig = Tuple[str, Union[str, Dict[str, Any]]]


class MCPManager:
    """MCP connection pool - singleton pattern"""

    _instance: Optional['MCPManager'] = None
    _lock = asyncio.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        # Avoid duplicate initialization
        if self._initialized:
            return

        self._initialized = True
        self._mcp_client: Optional[MCPClient] = None
        self._servers_config: List[ServerConfig] = []
        self._is_initialized = False

    async def initialize(self, servers_config: List[ServerConfig]):
        """Initialize connection pool and connect to all MCP servers

        Args:
            servers_config: List of (server_name, server_config) tuples where server_config is either:
                - A string path to a Python server script
                - A dict with 'command' and 'args' keys for npx-based servers
                Example: [("time_tool", "servers/time_server.py"),
                         ("browsermcp", {"command": "npx", "args": ["@browsermcp/mcp@latest"]})]
        """
        async with self._lock:
            # If already initialized with same config, return
            if self._is_initialized and self._servers_config == servers_config:
                return

            # If config changed, close old connections
            if self._is_initialized and self._servers_config != servers_config:
                await self._close_internal()

            # Create new MCP client
            self._mcp_client = MCPClient()
            self._servers_config = servers_config

            # Connect to all servers
            for server_name, server_config in servers_config:
                try:
                    await self._mcp_client.connect_to_server(server_name, server_config)
                except Exception:
                    # Silently fail for individual server connections
                    pass

            self._is_initialized = True

    def get_client(self) -> MCPClient:
        """Get MCP client instance

        Returns:
            MCPClient instance

        Raises:
            RuntimeError: If pool not initialized
        """
        if not self._is_initialized or self._mcp_client is None:
            raise RuntimeError("MCP pool not initialized. Call initialize() first")

        return self._mcp_client

    async def _close_internal(self):
        """Internal close method (without lock)"""
        if self._mcp_client:
            try:
                await self._mcp_client.close()
            except Exception:
                pass
            self._mcp_client = None

        self._is_initialized = False
        self._servers_config = []

    async def close(self):
        """Close connection pool and disconnect from all servers"""
        async with self._lock:
            await self._close_internal()

    @property
    def is_initialized(self) -> bool:
        """Check if pool is initialized"""
        return self._is_initialized

    def get_connected_servers(self) -> List[str]:
        """Get list of connected server names"""
        return [name for name, _ in self._servers_config]


# Global pool instance
_global_pool: Optional[MCPManager] = None


def get_mcp_manager() -> MCPManager:
    """Get global MCP manager instance

    Returns:
        MCPManager instance
    """
    global _global_pool
    if _global_pool is None:
        _global_pool = MCPManager()
    return _global_pool
