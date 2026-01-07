"""
WebSocket Server for Visible Manus Frontend
Integrates the multi-agent system with real-time UI updates
"""

import asyncio
import json
import os
import re
import uuid
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Set, Optional, Callable, Any

import websockets
from websockets.server import WebSocketServerProtocol
from dotenv import load_dotenv

# Add parent directory to path
import sys
sys.path.insert(0, str(Path(__file__).parent))

from core.mcp_manager import get_mcp_manager
from core.task_manager import TaskList, Task
from core.executor import TaskExecutor
from core.llm_client import LLMClient
from planner.planner_agent import PLANNER_SYSTEM_PROMPT
from agents.research_agent import ResearchAgent
from agents.web_coder_agent import WebCoderAgent

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Suppress noisy loggers
for name in ["mcp", "httpx", "httpcore", "openai", "urllib3", "asyncio"]:
    logging.getLogger(name).setLevel(logging.ERROR)

TASK_LIST_FILE = Path(__file__).parent / "tmp" / "task_list.json"
OUTPUT_DIR = Path(__file__).parent / "output"


class EventEmitter:
    """Manages WebSocket event broadcasting"""

    def __init__(self):
        self.connections: Set[WebSocketServerProtocol] = set()

    async def broadcast(self, event_type: str, data: dict):
        """Broadcast event to all connected clients"""
        message = json.dumps({
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        })

        if self.connections:
            await asyncio.gather(
                *[self._safe_send(ws, message) for ws in self.connections],
                return_exceptions=True
            )

    async def _safe_send(self, ws: WebSocketServerProtocol, message: str):
        """Send message with error handling"""
        try:
            await ws.send(message)
        except websockets.exceptions.ConnectionClosed:
            self.connections.discard(ws)


class InstrumentedLLMClient(LLMClient):
    """LLM Client with event hooks for UI updates"""

    def __init__(self, emitter: EventEmitter, agent_name: str = "planner", **kwargs):
        super().__init__(**kwargs)
        self.emitter = emitter
        self.agent_name = agent_name

    async def chat(self, messages: list, allowed_servers: list = None) -> list:
        """Override chat to emit events"""
        response_messages = await super().chat(messages, allowed_servers)

        # Emit events for tool calls
        for msg in response_messages:
            if msg.get("role") == "assistant":
                content = msg.get("content")
                tool_calls = msg.get("tool_calls")

                if content:
                    await self.emitter.broadcast("thinking", {
                        "agent": self.agent_name,
                        "content": content
                    })

                if tool_calls:
                    for tc in tool_calls:
                        tool_name = tc['function']['name']
                        # Remove server prefix for display
                        display_name = tool_name.split('__')[-1] if '__' in tool_name else tool_name

                        await self.emitter.broadcast("tool_call", {
                            "agent": self.agent_name,
                            "id": tc.get('id', str(uuid.uuid4())[:8]),
                            "tool": display_name,
                            "args": tc['function'].get('arguments', '{}'),
                            "status": "calling"
                        })

        return response_messages


class InstrumentedAgent:
    """Wrapper for agents to emit events"""

    def __init__(self, agent, emitter: EventEmitter, agent_name: str):
        self.agent = agent
        self.emitter = emitter
        self.agent_name = agent_name
        self._original_llm_client = agent.llm_client

    def set_mcp_client(self, mcp_client):
        self.agent.set_mcp_client(mcp_client)

    async def process(self, prompt: str) -> str:
        """Process with event emission"""
        # Emit agent start
        await self.emitter.broadcast("agent_status", {
            "agent": self.agent_name,
            "status": "working"
        })

        # Hook into LLM client for tool call events
        original_chat = self.agent.llm_client.chat

        async def instrumented_chat(messages, allowed_servers=None):
            response = await original_chat(messages, allowed_servers)

            for msg in response:
                # Emit LLM response (agent thinking/response)
                if msg.get("role") == "assistant":
                    content = msg.get("content")
                    if content:
                        await self.emitter.broadcast("agent_response", {
                            "agent": self.agent_name,
                            "content": content[:1000]  # Limit length for UI
                        })

                # Emit tool calls
                if msg.get("tool_calls"):
                    for tc in msg["tool_calls"]:
                        tool_name = tc['function']['name']
                        display_name = tool_name.split('__')[-1] if '__' in tool_name else tool_name
                        tc_id = tc.get('id', str(uuid.uuid4())[:8])

                        await self.emitter.broadcast("tool_call", {
                            "agent": self.agent_name,
                            "id": tc_id,
                            "tool": display_name,
                            "args": tc['function'].get('arguments', '{}')[:200],
                            "status": "calling"
                        })

                # Emit tool results (marks tool calls as complete)
                if msg.get("role") == "tool":
                    tool_call_id = msg.get("tool_call_id")
                    tool_name = msg.get("name", "unknown")
                    display_name = tool_name.split('__')[-1] if '__' in tool_name else tool_name
                    result_preview = str(msg.get("content", ""))[:200]

                    if tool_call_id:
                        await self.emitter.broadcast("tool_result", {
                            "agent": self.agent_name,
                            "id": tool_call_id,
                            "tool": display_name,
                            "result": result_preview,
                            "status": "complete"
                        })

            return response

        self.agent.llm_client.chat = instrumented_chat

        try:
            result = await self.agent.process(prompt)

            await self.emitter.broadcast("agent_status", {
                "agent": self.agent_name,
                "status": "complete"
            })

            return result
        except Exception as e:
            await self.emitter.broadcast("agent_status", {
                "agent": self.agent_name,
                "status": "error",
                "error": str(e)
            })
            raise
        finally:
            self.agent.llm_client.chat = original_chat


class ManusServer:
    """WebSocket server for Manus multi-agent system"""

    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.emitter = EventEmitter()
        self.manager = None
        self.mcp_client = None
        self.planner_client = None
        self.agents: Dict[str, InstrumentedAgent] = {}
        self.initialized = False

    async def initialize(self):
        """Initialize MCP connections and agents"""
        if self.initialized:
            return

        logger.info("Initializing MCP connections...")

        self.manager = get_mcp_manager()

        # Server configurations
        planner_server = ("planner", str(Path(__file__).parent / "planner" / "planner_agent.py"))
        file_writer_server = ("file_writer", str(Path(__file__).parent / "tools" / "mcp_servers" / "file_writer_server.py"))
        browser_mcp_config = ("browsermcp", {
            "command": "npx",
            "args": ["@browsermcp/mcp@latest"]
        })

        servers = [planner_server, file_writer_server, browser_mcp_config]

        await self.manager.initialize(servers)
        self.mcp_client = self.manager.get_client()

        # Create instrumented planner client
        self.planner_client = InstrumentedLLMClient(self.emitter, "planner")
        self.planner_client.set_mcp_client(self.mcp_client)

        # Create instrumented agents
        research_agent = ResearchAgent()
        research_agent.set_mcp_client(self.mcp_client)

        web_coder_agent = WebCoderAgent()
        web_coder_agent.set_mcp_client(self.mcp_client)

        self.agents = {
            "ResearchAgent": InstrumentedAgent(research_agent, self.emitter, "ResearchAgent"),
            "WebCoderAgent": InstrumentedAgent(web_coder_agent, self.emitter, "WebCoderAgent")
        }

        self.initialized = True
        logger.info("Server initialized successfully")

    async def react_loop(self, user_request: str, max_rounds: int = 50) -> str:
        """Main ReAct loop with event emission"""

        # Emit session start
        await self.emitter.broadcast("session_start", {
            "user_input": user_request
        })

        await self.emitter.broadcast("input_status", {"status": "active"})
        await self.emitter.broadcast("planner_status", {"status": "working"})

        task_list = TaskList()
        task_list.save(str(TASK_LIST_FILE))

        # Create executor with instrumented agents
        executor = TaskExecutor(task_list, self.agents)

        planner_messages = [
            {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
            {"role": "user", "content": user_request}
        ]

        round_num = 1
        planner_servers = [("planner", str(Path(__file__).parent / "planner" / "planner_agent.py"))]

        while round_num <= max_rounds:
            # Emit planner thinking
            await self.emitter.broadcast("planner_status", {"status": "working"})

            # Call planner
            response_messages = await self.planner_client.chat(planner_messages, allowed_servers=planner_servers)
            planner_messages.extend(response_messages)
            last_message = planner_messages[-1]

            # Handle tool results
            if last_message.get("role") == "tool":
                tool_content = str(last_message.get("content", ""))

                # CONTINUE signal
                if "CONTINUE" in tool_content:
                    await self._execute_tasks(executor, planner_messages)
                    round_num += 1
                    continue

                # FINALIZED signal
                elif "FINALIZED:" in tool_content:
                    # Extract text from TextContent object format
                    # Format: [TextContent(type='text', text="FINALIZED: ...", annotations=None, meta=None)]

                    final_response = None

                    # Method 1: Try to extract text= value with double quotes (handles most content)
                    text_match = re.search(r'text="(.*?)"(?:\s*,\s*annotations|\s*\))', tool_content, re.DOTALL)
                    if text_match:
                        final_response = text_match.group(1)

                    # Method 2: Try single quotes
                    if not final_response:
                        text_match = re.search(r"text='(.*?)'(?:\s*,\s*annotations|\s*\))", tool_content, re.DOTALL)
                        if text_match:
                            final_response = text_match.group(1)

                    # Method 3: Direct FINALIZED extraction
                    if not final_response:
                        finalized_match = re.search(r'FINALIZED:\s*(.+)', tool_content, re.DOTALL)
                        if finalized_match:
                            final_response = finalized_match.group(1).strip()
                            # Remove trailing metadata if present
                            final_response = re.sub(r'[\'"],?\s*annotations=.*$', '', final_response, flags=re.DOTALL).strip()

                    # Clean up the response
                    if final_response:
                        # Remove FINALIZED: prefix if present
                        if "FINALIZED:" in final_response:
                            final_response = final_response.split("FINALIZED:", 1)[-1].strip()
                    else:
                        # Last resort: strip the TextContent wrapper manually
                        final_response = tool_content
                        final_response = re.sub(r'^\[?TextContent\(type=[\'"]text[\'"],\s*text=[\'"]', '', final_response)
                        final_response = re.sub(r'[\'"],\s*annotations=None,\s*meta=None\)\]?$', '', final_response)
                        final_response = final_response.replace("FINALIZED:", "").strip()

                    # Get output files
                    output_files = self._get_output_files()

                    await self.emitter.broadcast("output", {
                        "status": "complete",
                        "text": final_response,
                        "files": output_files
                    })

                    await self.emitter.broadcast("session_end", {
                        "status": "complete",
                        "output": final_response
                    })

                    return final_response

                # Task list created
                elif "Created" in tool_content and "tasks" in tool_content:
                    await self._execute_tasks(executor, planner_messages)
                    round_num += 1
                    continue

                round_num += 1
                continue

            if "tool_calls" in last_message:
                round_num += 1
                continue

            # Direct response without tool calls - planner responded directly to user
            if last_message.get("role") == "assistant" and last_message.get("content"):
                direct_response = last_message.get("content")

                await self.emitter.broadcast("output", {
                    "status": "complete",
                    "text": direct_response,
                    "files": []
                })

                await self.emitter.broadcast("session_end", {
                    "status": "complete",
                    "output": direct_response
                })

                return direct_response

            break

        # Max rounds reached or unexpected break - ensure session ends properly
        error_msg = "Execution interrupted (max rounds reached)"
        await self.emitter.broadcast("output", {
            "status": "error",
            "text": error_msg,
            "files": []
        })
        await self.emitter.broadcast("session_end", {
            "status": "error",
            "error": error_msg
        })
        return error_msg

    async def _execute_tasks(self, executor: TaskExecutor, planner_messages: list):
        """Execute ready tasks with event emission"""

        task_list = TaskList.load(str(TASK_LIST_FILE))
        executor.task_list = task_list

        # Emit tasks update
        tasks_data = [
            {
                "task_id": t.task_id,
                "agent": t.agent,
                "description": t.description,
                "dependencies": t.dependencies,
                "status": t.status.value if hasattr(t.status, 'value') else str(t.status)
            }
            for t in task_list.tasks
        ]
        await self.emitter.broadcast("tasks_update", {"tasks": tasks_data})

        all_results = []

        # Loop through batches - execute one batch at a time with proper events
        while True:
            # Reload task list to get current state
            task_list = TaskList.load(str(TASK_LIST_FILE))
            executor.task_list = task_list

            # Get ready tasks
            ready_tasks = task_list.get_ready_tasks()
            if not ready_tasks:
                break

            # Emit running status and agent_task for each ready task
            for task in ready_tasks:
                await self.emitter.broadcast("task_status", {
                    "task_id": task.task_id,
                    "status": "running",
                    "agent": task.agent
                })

                await self.emitter.broadcast("agent_task", {
                    "agent": task.agent,
                    "task": {
                        "task_id": task.task_id,
                        "description": task.description
                    }
                })

            # Execute only this batch
            _, batch_results = await executor.execute_one_batch()
            task_list.save(str(TASK_LIST_FILE))

            # Emit completion status for each result
            for result in batch_results:
                status = "completed" if "result" in result else "failed"
                await self.emitter.broadcast("task_status", {
                    "task_id": result.get("task_id"),
                    "status": status,
                    "result": result.get("result", result.get("error", ""))[:500]
                })
                all_results.append(result)

        # Update planner messages
        if not all_results:
            prompt = "All tasks completed. Use finalize_plan to respond."
        else:
            formatted_results = executor.format_results(all_results)
            task_summary = task_list.get_summary()
            prompt = f"{formatted_results}\n\n{task_summary}\n\nReview and decide: adjust, continue, or finalize."

        planner_messages.append({"role": "user", "content": prompt})

        # Emit planner context update so frontend can show the task results
        await self.emitter.broadcast("planner_context", {
            "type": "task_results",
            "content": prompt
        })

    def _get_output_files(self) -> list:
        """Get list of output files"""
        if not OUTPUT_DIR.exists():
            return []

        files = []
        for f in OUTPUT_DIR.rglob("*"):
            if f.is_file():
                files.append(str(f.relative_to(OUTPUT_DIR)))
        return files

    async def handle_connection(self, websocket: WebSocketServerProtocol):
        """Handle WebSocket connection"""
        self.emitter.connections.add(websocket)
        logger.info(f"Client connected. Total: {len(self.emitter.connections)}")

        try:
            # Send connection confirmation
            await websocket.send(json.dumps({
                "type": "connected",
                "data": {"message": "Connected to Manus server"}
            }))

            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.handle_message(data, websocket)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "data": {"message": "Invalid JSON"}
                    }))
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "data": {"message": str(e)}
                    }))

        finally:
            self.emitter.connections.discard(websocket)
            logger.info(f"Client disconnected. Total: {len(self.emitter.connections)}")

    async def handle_message(self, data: dict, websocket: WebSocketServerProtocol):
        """Handle incoming WebSocket message"""
        msg_type = data.get("type")
        payload = data.get("data", {})

        if msg_type == "user_input":
            user_text = payload.get("text", "")
            if user_text:
                # Run in background to not block WebSocket
                asyncio.create_task(self._process_request(user_text))

        elif msg_type == "ping":
            await websocket.send(json.dumps({"type": "pong"}))

    async def _process_request(self, user_text: str):
        """Process user request"""
        try:
            await self.react_loop(user_text)
        except Exception as e:
            logger.error(f"Error processing request: {e}")
            await self.emitter.broadcast("error", {
                "message": str(e)
            })
            await self.emitter.broadcast("session_end", {
                "status": "error",
                "error": str(e)
            })

    async def run(self):
        """Start the WebSocket server"""
        await self.initialize()

        logger.info(f"Starting WebSocket server on ws://{self.host}:{self.port}")

        async with websockets.serve(self.handle_connection, self.host, self.port):
            logger.info("Server is running. Press Ctrl+C to stop.")
            await asyncio.Future()  # Run forever

    async def close(self):
        """Clean up resources"""
        if self.manager:
            await self.manager.close()


async def main():
    """Entry point"""
    print("=" * 60)
    print(" VISIBLE MANUS - WebSocket Server")
    print("=" * 60)
    print()
    print("Starting server...")
    print()
    print("IMPORTANT: Before using ResearchAgent, ensure:")
    print("  1. Chrome browser is open")
    print("  2. Browser MCP extension is installed")
    print("  3. Click 'Connect' in the extension")
    print()

    server = ManusServer(host="localhost", port=8765)

    try:
        await server.run()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await server.close()
        print("Server stopped.")


if __name__ == "__main__":
    asyncio.run(main())
