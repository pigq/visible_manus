"""
Main Entry Point for Manus Multi-Agent System
Interactive mode with full LLM output visibility
"""

import asyncio
import os
import sys
import re
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

from core.mcp_manager import get_mcp_manager
from core.task_manager import TaskList
from core.executor import TaskExecutor
from core.llm_client import LLMClient
from planner.planner_agent import PLANNER_SYSTEM_PROMPT
from agents.research_agent import ResearchAgent
from agents.web_coder_agent import WebCoderAgent

load_dotenv()

VERBOSE = os.getenv("VERBOSE", "true").lower() == "true"
TASK_LIST_FILE = Path(__file__).parent / "tmp" / "task_list.json"


def print_section(title):
    """Print section header"""
    print("\n" + "="*70)
    print(f" {title}")
    print("="*70)


def print_llm_output(role, content, tool_calls=None):
    """Print LLM message in readable format"""
    if role == "assistant":
        if tool_calls:
            print("\n🤖 PLANNER ACTION:")
            for tc in tool_calls:
                tool_name = tc['function']['name'].replace('planner__', '')
                print(f"   → Calling: {tool_name}")
                try:
                    args = tc['function'].get('arguments', '{}')
                    import json
                    args_dict = json.loads(args)
                    if 'tasks' in args_dict:
                        print(f"   → Creating task list...")
                    elif 'user_response' in args_dict:
                        resp = args_dict['user_response']
                        print(f"   → Finalizing: {resp[:100]}...")
                except:
                    pass
        elif content:
            print(f"\n🤖 PLANNER THINKING:\n{content}")
    elif role == "tool":
        # Don't print tool results, they're noisy
        pass


async def react_loop(user_request: str, agents: dict, planner_client: LLMClient, max_rounds: int = 50) -> str:
    """ReAct main loop with verbose output"""

    print_section("USER REQUEST")
    print(f"{user_request}")

    task_list = TaskList()
    task_list.save(str(TASK_LIST_FILE))

    executor = TaskExecutor(task_list, agents)

    planner_messages = [
        {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
        {"role": "user", "content": user_request}
    ]

    round_num = 1
    planner_servers = [("planner", str(Path(__file__).parent / "planner" / "planner_agent.py"))]

    while round_num <= max_rounds:
        if VERBOSE:
            print(f"\n{'─'*70}")
            print(f"Round {round_num}")
            print(f"{'─'*70}")

        # Call planner
        response_messages = await planner_client.chat(planner_messages, allowed_servers=planner_servers)

        # Show planner output
        if VERBOSE:
            for msg in response_messages:
                if msg.get("role") == "assistant":
                    print_llm_output("assistant", msg.get("content"), msg.get("tool_calls"))

        planner_messages.extend(response_messages)
        last_message = planner_messages[-1]

        # Handle tool results
        if last_message.get("role") == "tool":
            tool_content = str(last_message.get("content", ""))

            # CONTINUE signal
            if "CONTINUE" in tool_content:
                print("\n⚙️  Executing tasks...")

                task_list = TaskList.load(str(TASK_LIST_FILE))
                executor.task_list = task_list

                execution_results = await executor.execute_ready_tasks()
                task_list.save(str(TASK_LIST_FILE))

                # Show execution results
                if VERBOSE and execution_results:
                    print_section("TASK EXECUTION RESULTS")
                    for result in execution_results:
                        task_id = result.get("task_id")
                        agent = result.get("agent")
                        desc = result.get("description", "")[:80]

                        print(f"\n📋 Task: {task_id} ({agent})")
                        print(f"   Description: {desc}...")

                        if "result" in result:
                            res = result["result"]
                            # Show first 300 chars of result
                            print(f"   ✅ Result: {res[:300]}{'...' if len(res) > 300 else ''}")
                        elif "error" in result:
                            print(f"   ❌ Error: {result['error']}")

                if not execution_results:
                    prompt = "All tasks completed. Use finalize_plan to respond."
                else:
                    formatted_results = executor.format_results(execution_results)
                    task_summary = task_list.get_summary()
                    prompt = f"{formatted_results}\n\n{task_summary}\n\nReview and decide: adjust, continue, or finalize."

                planner_messages.append({"role": "user", "content": prompt})
                round_num += 1
                continue

            # FINALIZED signal
            elif "FINALIZED:" in tool_content:
                match = re.search(r"text='FINALIZED:\s*(.+?)'", tool_content)
                if match:
                    final_response = match.group(1)
                else:
                    final_response = tool_content.replace("FINALIZED:", "").strip()
                    final_response = re.sub(r".*text='(.*?)'.*", r"\1", final_response)

                return final_response

            # Task list created
            elif "Created" in tool_content and "tasks" in tool_content:
                print("\n✅ Task list created, executing...")

                task_list = TaskList.load(str(TASK_LIST_FILE))
                executor.task_list = task_list

                execution_results = await executor.execute_ready_tasks()
                task_list.save(str(TASK_LIST_FILE))

                # Show execution results
                if VERBOSE and execution_results:
                    print_section("TASK EXECUTION RESULTS")
                    for result in execution_results:
                        task_id = result.get("task_id")
                        agent = result.get("agent")
                        desc = result.get("description", "")[:80]

                        print(f"\n📋 Task: {task_id} ({agent})")
                        print(f"   Description: {desc}...")

                        if "result" in result:
                            res = result["result"]
                            print(f"   ✅ Result: {res[:300]}{'...' if len(res) > 300 else ''}")
                        elif "error" in result:
                            print(f"   ❌ Error: {result['error']}")

                if not execution_results:
                    prompt = "No tasks ready. Check dependencies."
                else:
                    formatted_results = executor.format_results(execution_results)
                    task_summary = task_list.get_summary()
                    prompt = f"{formatted_results}\n\n{task_summary}\n\nReview and decide: adjust, continue, or finalize."

                planner_messages.append({"role": "user", "content": prompt})
                round_num += 1
                continue

            round_num += 1
            continue

        if "tool_calls" in last_message:
            round_num += 1
            continue

        break

    return "Execution interrupted (max rounds reached)"


async def main():
    """Main interactive loop"""

    print_section("MANUS MULTI-AGENT SYSTEM")
    print("\nInitializing system...")

    # Initialize MCP manager
    manager = get_mcp_manager()

    # Server configurations
    planner_server = ("planner", str(Path(__file__).parent / "planner" / "planner_agent.py"))
    file_writer_server = ("file_writer", str(Path(__file__).parent / "tools" / "mcp_servers" / "file_writer_server.py"))

    # Browser MCP for ResearchAgent
    browser_mcp_config = ("browsermcp", {
        "command": "npx",
        "args": ["@browsermcp/mcp@latest"]
    })

    servers = [planner_server, file_writer_server, browser_mcp_config]

    print("   Connecting to MCP servers...")
    await manager.initialize(servers)
    print(f"   ✓ Connected to {len(servers)} server(s)")

    # Browser MCP connection notice
    print("\n" + "="*70)
    print(" BROWSER MCP CONNECTION REQUIRED")
    print("="*70)
    print("\n   ResearchAgent uses Browser MCP for web research.")
    print("   To enable browser automation:")
    print("\n   1. Open Chrome browser")
    print("   2. Click the Browser MCP extension icon in toolbar")
    print("   3. Click 'Connect' button")
    print("\n   (Skip if you won't use ResearchAgent)")
    print("="*70)
    input("\n   Press Enter after connecting (or to skip)...")

    mcp_client = manager.get_client()

    # Create planner
    print("   Creating planner...")
    planner_client = LLMClient()
    planner_client.set_mcp_client(mcp_client)
    print("   ✓ Planner ready")

    # Create agents
    print("   Initializing agents...")
    research_agent = ResearchAgent()
    research_agent.set_mcp_client(mcp_client)

    web_coder_agent = WebCoderAgent()
    web_coder_agent.set_mcp_client(mcp_client)

    agents = {
        "ResearchAgent": research_agent,
        "WebCoderAgent": web_coder_agent
    }
    print(f"   ✓ Loaded {len(agents)} agent(s): ResearchAgent, WebCoderAgent")

    print("\n✅ System ready!")
    print("\nType your request (or 'quit' to exit):")

    # Interactive loop
    try:
        while True:
            print("\n" + "─"*70)
            user_input = input("\n> ").strip()

            if not user_input:
                continue

            if user_input.lower() in ['quit', 'exit', 'q']:
                print("\nGoodbye!")
                break

            try:
                result = await react_loop(user_input, agents, planner_client)

                print_section("FINAL RESULT")
                print(result)

                # Check for output files
                output_dir = Path(__file__).parent / "output"
                if output_dir.exists():
                    files = list(output_dir.rglob("*"))
                    if files:
                        print(f"\n📁 Files created in output/:")
                        for file in sorted(files):
                            if file.is_file():
                                print(f"   - {file.relative_to(output_dir)}")

            except KeyboardInterrupt:
                print("\n\nInterrupted by user")
                break
            except Exception as e:
                print(f"\n❌ Error: {e}")
                import traceback
                traceback.print_exc()

    finally:
        print("\nClosing connections...")
        await manager.close()
        print("Done.")


if __name__ == "__main__":
    # Suppress all noisy logs - only show warnings and errors
    import logging
    import warnings

    # Suppress warnings
    warnings.filterwarnings("ignore")

    # Set root logger to WARNING
    logging.basicConfig(level=logging.ERROR)

    # Suppress specific loggers
    loggers_to_suppress = [
        "mcp",
        "mcp.server",
        "mcp.client",
        "httpx",
        "httpcore",
        "h11",
        "openai",
        "urllib3",
        "duckduckgo_search",
        "asyncio",
    ]

    for logger_name in loggers_to_suppress:
        logging.getLogger(logger_name).setLevel(logging.CRITICAL)
        logging.getLogger(logger_name).propagate = False

    asyncio.run(main())
