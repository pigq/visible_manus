"""
LLM Client for DeepSeek API
Simplified version without streaming - uses standard completion API
"""

import os
import json
from dotenv import load_dotenv
from openai import OpenAI, APIError

# Load environment variables
load_dotenv()


class LLMClient:
    """DeepSeek API client using OpenAI-compatible interface"""

    def __init__(self, model: str = None):
        """Initialize LLM client

        Args:
            model: Model name (default: deepseek-chat)
        """
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.base_url = os.getenv("DEEPSEEK_URL", "https://api.deepseek.com")
        self.model = model if model else "deepseek-chat"

        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY not found in .env file")

        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )

        # Will be set by MCP manager
        self.mcp_client = None

    def set_mcp_client(self, mcp_client):
        """Set MCP client for tool access

        Args:
            mcp_client: MCP client instance from pool
        """
        self.mcp_client = mcp_client

    def _filter_tools_by_servers(self, all_tools: list, allowed_servers: list) -> list:
        """Filter tools to only include those from allowed servers

        Args:
            all_tools: All available tools from MCP
            allowed_servers: List of (server_name, server_path) tuples

        Returns:
            Filtered tool list
        """
        if allowed_servers is None:
            return all_tools

        if len(allowed_servers) == 0:
            return []

        # Extract server names
        allowed_server_names = {server_name for server_name, _ in allowed_servers}

        # Filter tools
        filtered_tools = []
        for tool in all_tools:
            tool_name = tool["function"]["name"]

            # Find which server this tool belongs to
            for raw_tool in self.mcp_client.available_tools:
                if raw_tool["name"] == tool_name:
                    if raw_tool["server"] in allowed_server_names:
                        filtered_tools.append(tool)
                    break

        return filtered_tools

    async def chat(self, messages: list, allowed_servers: list = None) -> list:
        """Send chat request and get response messages

        Args:
            messages: List of message dicts with role and content
            allowed_servers: List of (server_name, path) tuples to filter tools

        Returns:
            List of response messages (may include tool calls and tool results)
        """
        if not self.mcp_client:
            raise RuntimeError("MCP client not set. Call set_mcp_client() first")

        try:
            # Get available tools
            all_tools = self.mcp_client.get_available_tools()

            # Filter tools based on allowed servers
            tools = self._filter_tools_by_servers(all_tools, allowed_servers)

            # Build API parameters
            api_params = {
                "model": self.model,
                "messages": messages,
            }

            # Only add tools if available
            if tools and len(tools) > 0:
                api_params["tools"] = tools
                api_params["parallel_tool_calls"] = True

            # Call API (non-streaming)
            completion = self.client.chat.completions.create(**api_params)

            # Parse response
            response_messages = []
            choice = completion.choices[0]
            message = choice.message

            # Build assistant message
            assistant_msg = {
                "role": "assistant",
                "content": message.content
            }

            # Print raw LLM response
            if message.content:
                print(f"\n{'='*70}")
                print("💭 LLM RESPONSE:")
                print(f"{'='*70}")
                print(message.content)
                print(f"{'='*70}\n")

            # Check for tool calls
            if message.tool_calls:
                print(f"\n{'='*70}")
                print("🔧 LLM TOOL CALLS:")
                print(f"{'='*70}")
                for tc in message.tool_calls:
                    print(f"  → {tc.function.name}")
                    try:
                        args = json.loads(tc.function.arguments)
                        print(f"    Arguments: {json.dumps(args, indent=6, ensure_ascii=False)}")
                    except:
                        print(f"    Arguments: {tc.function.arguments}")
                print(f"{'='*70}\n")

                tool_calls_list = []
                for tc in message.tool_calls:
                    tool_calls_list.append({
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    })
                assistant_msg["tool_calls"] = tool_calls_list

                # Add assistant message
                response_messages.append(assistant_msg)

                # Execute tools
                tool_results = await self._execute_tool_calls(tool_calls_list)
                response_messages.extend(tool_results)
            else:
                # No tool calls, just return assistant message
                response_messages.append(assistant_msg)

            return response_messages

        except APIError as e:
            print(f"API request failed: {e}")
            return [{"role": "assistant", "content": f"API request failed: {e}"}]
        except Exception as e:
            print(f"Unknown error: {e}")
            return [{"role": "assistant", "content": f"Unknown error: {e}"}]

    async def _execute_tool_calls(self, tool_calls: list) -> list:
        """Execute tool calls using MCP client

        Args:
            tool_calls: List of tool call dicts

        Returns:
            List of tool result messages
        """
        tool_responses = []

        for tool_call in tool_calls:
            tool_call_id = tool_call.get("id")
            func_info = tool_call.get("function")

            if not func_info or not tool_call_id:
                continue

            function_name = func_info.get("name")
            arguments_str = func_info.get("arguments", "{}")

            try:
                # Parse arguments
                args = json.loads(arguments_str) if arguments_str.strip() else {}
            except json.JSONDecodeError as e:
                error_msg = f"Failed to parse arguments for {function_name}: {e}"
                tool_responses.append({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "name": function_name,
                    "content": error_msg
                })
                continue

            try:
                # Call tool via MCP
                result = await self.mcp_client.call_tool(function_name, args)

                # Print tool result
                print(f"\n{'─'*70}")
                print(f"✅ TOOL RESULT: {function_name}")
                print(f"{'─'*70}")
                result_str = str(result)
                if len(result_str) > 500:
                    print(f"{result_str[:500]}... (truncated, {len(result_str)} chars total)")
                else:
                    print(result_str)
                print(f"{'─'*70}\n")

                tool_responses.append({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "name": function_name,
                    "content": str(result)
                })

            except Exception as e:
                error_msg = f"Error executing {function_name}: {str(e)}"
                print(f"\n{'─'*70}")
                print(f"❌ TOOL ERROR: {function_name}")
                print(f"{'─'*70}")
                print(error_msg)
                print(f"{'─'*70}\n")

                tool_responses.append({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "name": function_name,
                    "content": error_msg
                })

        return tool_responses
