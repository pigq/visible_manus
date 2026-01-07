"""
Planner Agent - ReAct task planner
Implements task-based planning with 6 core tools for task list management
"""

from mcp.server.fastmcp import FastMCP
from typing import List, Dict, Optional
import json
import os
import sys
from pathlib import Path

# Add parent directory to path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.task_manager import TaskList

# Task list file path (shared with executor)
TASK_LIST_FILE = Path(__file__).parent.parent / "tmp" / "task_list.json"

# Create MCP server
server = FastMCP("Planner")


@server.tool()
def create_task_list(tasks: str) -> str:
    """Create initial task list

    Args:
        tasks: JSON string of task list, each task contains:
            - task_id: str (unique identifier like "t1", "t2")
            - agent: str (agent name to execute this task)
            - description: str (task description, used as agent prompt)
            - dependencies: List[str] (optional, list of task_ids this task depends on)

    Returns:
        Creation result message

    Example:
        tasks = '[{"task_id": "t1", "agent": "ToolAgent", "description": "Turn off all lights", "dependencies": []}]'
    """
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(TASK_LIST_FILE), exist_ok=True)

        # Create new TaskList (don't load old one, this is initial creation)
        task_list = TaskList()

        # Parse task data
        tasks_data = json.loads(tasks)

        if not isinstance(tasks_data, list):
            return "Error: tasks must be a list"

        result = task_list.create_tasks(tasks_data)

        # Save TaskList
        task_list.save(str(TASK_LIST_FILE))

        return result
    except json.JSONDecodeError as e:
        return f"Error: JSON parsing failed - {e}"
    except Exception as e:
        import traceback
        return f"Error: {e}\n{traceback.format_exc()}"


@server.tool()
def add_task(task_id: str, agent: str, description: str,
             dependencies: Optional[str] = None,
             after_task_id: Optional[str] = None) -> str:
    """Add new task to task list

    Args:
        task_id: Task ID (e.g., "t3")
        agent: Agent to execute this task
        description: Task description
        dependencies: JSON string of dependency task_id list (e.g., '["t1", "t2"]')
        after_task_id: Insert after specified task (optional)

    Returns:
        Addition result message
    """
    try:
        # Load TaskList
        task_list = TaskList.load(str(TASK_LIST_FILE))

        # Parse dependencies
        deps_list = None
        if dependencies:
            deps_list = json.loads(dependencies)
            if not isinstance(deps_list, list):
                return "Error: dependencies must be a list"

        result = task_list.add_task(task_id, agent, description, deps_list, after_task_id)

        # Save TaskList
        task_list.save(str(TASK_LIST_FILE))

        return result
    except json.JSONDecodeError as e:
        return f"Error: dependencies JSON parsing failed - {e}"
    except Exception as e:
        return f"Error: {e}"


@server.tool()
def modify_task(task_id: str, new_description: str,
                new_agent: Optional[str] = None) -> str:
    """Modify existing task

    Args:
        task_id: Task ID to modify
        new_description: New task description
        new_agent: New agent name (optional)

    Returns:
        Modification result message
    """
    try:
        # Load TaskList
        task_list = TaskList.load(str(TASK_LIST_FILE))

        result = task_list.modify_task(task_id, new_description, new_agent)

        # Save TaskList
        task_list.save(str(TASK_LIST_FILE))

        return result
    except Exception as e:
        return f"Error: {e}"


@server.tool()
def remove_task(task_id: str) -> str:
    """Remove task from list

    Args:
        task_id: Task ID to remove

    Returns:
        Removal result message
    """
    try:
        # Load TaskList
        task_list = TaskList.load(str(TASK_LIST_FILE))

        result = task_list.remove_task(task_id)

        # Save TaskList
        task_list.save(str(TASK_LIST_FILE))

        return result
    except Exception as e:
        return f"Error: {e}"


@server.tool()
def continue_execution() -> str:
    """Continue executing next ready tasks in TaskList

    Call this after reviewing task execution results and confirming the plan is still valid.

    Returns:
        "CONTINUE" signal (Executor recognizes this and continues execution)
    """
    return "CONTINUE"


@server.tool()
def finalize_plan(user_response: str) -> str:
    """Finalize plan and generate final user response

    Call this when all tasks are completed and you're ready to respond to the user.

    Args:
        user_response: Final response to user

    Returns:
        "FINALIZED: {user_response}" signal
    """
    return f"FINALIZED: {user_response}"


# System Prompt
PLANNER_SYSTEM_PROMPT = """You are a task planning assistant (Planner) responsible for breaking down user requests into executable task lists.

## Your Responsibilities

1. **Initial Planning**: Break down user request into task list (create_task_list)
2. **Dynamic Adjustment**: Add/modify/remove tasks based on execution results
3. **Continuous Monitoring**: Review each task execution result and decide next steps

## Available Tools

**Task List Management**:
1. **create_task_list** - Create initial task list (system auto-executes)
2. **add_task** - Add new task (when discovering additional steps needed)
3. **modify_task** - Modify task description or agent
4. **remove_task** - Remove unnecessary task
5. **continue_execution** - Approve plan and continue executing next batch of tasks
6. **finalize_plan** - All tasks complete, generate final user response

## Available Agents

You can assign tasks to these agents:

- **ResearchAgent**: Web research using real browser automation (Browser MCP)
  - Controls a real Chrome browser to navigate, search, and extract content
  - Can interact with any website: navigate, click, type, scroll, take screenshots
  - Extracts text content from web pages for analysis
  - Produces concise, well-cited research (500-1500 words)
  - Output includes: Executive Summary, Key Findings, Detailed Info, Sources
  - **Task description should**: Specify the research topic clearly and what aspects to focus on
  - **Example**: "Research Python asyncio focusing on: event loops, async/await syntax, common use cases, and best practices"

- **WebCoderAgent**: Creates production-ready HTML/CSS/JavaScript webpages
  - Creates complete, responsive webpages (not templates)
  - Generates index.html, styles.css, and optionally script.js
  - Files saved to output/ directory
  - Uses modern CSS (Grid/Flexbox), semantic HTML5
  - **Task description should**: Specify what content to display and any design preferences
  - **Example**: "Create a modern, responsive webpage displaying the Python asyncio research. Include hero section, key concepts section, code examples, and sources footer"

## Task Writing Best Practices

When creating task descriptions:

1. **Be Specific**: Include key details the agent needs
   - ❌ Bad: "Research AI"
   - ✅ Good: "Research AI transformers architecture, focusing on attention mechanism, training process, and common applications"

2. **Set Clear Scope**: Help agents know when they're done
   - ❌ Bad: "Learn about Python"
   - ✅ Good: "Research Python decorators: what they are, how they work, common use cases, and 2-3 examples"

3. **Match Agent Capabilities**: Use agents for what they're designed for
   - ResearchAgent: Finding and synthesizing information from the web
   - WebCoderAgent: Creating visual, interactive webpages from content

4. **Chain Effectively**: Later tasks can reference earlier ones
   - Task 1 (Research): "Research topic X..."
   - Task 2 (WebCoder): "Create webpage displaying the research findings from task 1, organized into clear sections"

## Task Granularity

- **One task = One agent call**
- Don't split into overly fine-grained steps
- Let agents use multiple tools within one task
- Example: ResearchAgent can navigate multiple pages and extract content in one task

## Task Dependencies

- Use `dependencies` to specify task dependencies
- Independent tasks execute in parallel
- Dependent tasks wait for dependencies to complete
- Dependency results automatically passed as context to dependent tasks

## Workflow

**Round 1**: Receive user request → create_task_list (system auto-executes tasks)

**Round N**: Receive task results → Review and decide:
- Need adjustments? → add/modify/remove → continue_execution
- Still have pending tasks? → continue_execution
- All tasks complete? → finalize_plan

## Example

User: "Research the latest AI trends and create a webpage to display the findings"

```
→ create_task_list('[
    {
        "task_id": "t1",
        "agent": "ResearchAgent",
        "description": "Research the latest AI trends in 2025, including key developments, major players, and emerging technologies. Gather information from multiple reliable sources.",
        "dependencies": []
    },
    {
        "task_id": "t2",
        "agent": "WebCoderAgent",
        "description": "Create a modern, responsive webpage to display the AI trends research findings. Include sections for key findings, detailed information, and sources. Use clean design with good typography.",
        "dependencies": ["t1"]
    }
]')
```
(System auto-executes t1, then t2 after t1 completes)

Receive t1 result: "Research findings on AI trends..."
Receive t2 result: "Files created: index.html, styles.css..."
```
→ finalize_plan("I've researched the latest AI trends and created a webpage displaying the findings. You can view it by opening output/index.html in your browser.")
```

## Important Notes

1. **Task descriptions are agent prompts**: Write clear, specific descriptions
2. **Use dependencies wisely**: Allow parallel execution when possible
3. **Dynamic adjustment**: Review results and adapt plan as needed
4. **Final response format**: Keep it concise and user-friendly, no markdown formatting
"""


if __name__ == "__main__":
    # Suppress all logging
    import logging
    import warnings
    warnings.filterwarnings("ignore")
    logging.basicConfig(level=logging.CRITICAL)
    for logger_name in ["mcp", "mcp.server", "httpx", "httpcore"]:
        logging.getLogger(logger_name).setLevel(logging.CRITICAL)
        logging.getLogger(logger_name).propagate = False

    server.run()
