"""
Task Executor - Executes tasks from TaskList
Handles agent context building, parallel execution, and result processing
"""

import asyncio
import os
from typing import Dict, List, Any
from .task_manager import TaskList, Task, TaskStatus


class TaskExecutor:
    """Task execution engine"""

    def __init__(self, task_list: TaskList, agents: Dict[str, Any]):
        """Initialize task executor

        Args:
            task_list: TaskList instance
            agents: Dictionary of agents {"AgentName": agent_instance}
        """
        self.task_list = task_list
        self.agents = agents

    async def execute_ready_tasks(self) -> List[Dict]:
        """Execute all ready tasks (dependencies satisfied)

        Executes tasks in batches, with parallel execution within each batch.
        Continues until no more ready tasks are available.

        Returns:
            List of execution results, each containing:
                - task_id: str
                - description: str
                - agent: str
                - result: str (on success)
                - error: str (on failure)
        """
        all_results = []

        # Loop until no more ready tasks
        while True:
            ready_tasks = self.task_list.get_ready_tasks()

            if not ready_tasks:
                break

            # Execute current batch in parallel
            results = await asyncio.gather(*[
                self._execute_task(task) for task in ready_tasks
            ], return_exceptions=True)

            # Process results and exceptions
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    task = ready_tasks[i]
                    result_dict = {
                        "task_id": task.task_id,
                        "description": task.description,
                        "agent": task.agent,
                        "error": str(result)
                    }
                    all_results.append(result_dict)
                    # Mark as failed
                    self.task_list.mark_failed(task.task_id, str(result))
                else:
                    all_results.append(result)

        return all_results

    async def execute_one_batch(self) -> tuple[List[Task], List[Dict]]:
        """Execute only the currently ready tasks (one batch)

        Returns:
            Tuple of (ready_tasks, results) where:
                - ready_tasks: List of tasks that were executed
                - results: List of execution results
        """
        ready_tasks = self.task_list.get_ready_tasks()

        if not ready_tasks:
            return [], []

        # Execute current batch in parallel
        raw_results = await asyncio.gather(*[
            self._execute_task(task) for task in ready_tasks
        ], return_exceptions=True)

        # Process results and exceptions
        results = []
        for i, result in enumerate(raw_results):
            if isinstance(result, Exception):
                task = ready_tasks[i]
                result_dict = {
                    "task_id": task.task_id,
                    "description": task.description,
                    "agent": task.agent,
                    "error": str(result)
                }
                results.append(result_dict)
                self.task_list.mark_failed(task.task_id, str(result))
            else:
                results.append(result)

        return ready_tasks, results

    async def _execute_task(self, task: Task) -> Dict:
        """Execute a single task

        Args:
            task: Task to execute

        Returns:
            Execution result dictionary
        """
        # Mark as executing
        self.task_list.mark_executing(task.task_id)

        try:
            # Build agent prompt with dependency results
            agent_prompt = self._build_agent_prompt(task)

            # Get agent
            agent = self.agents.get(task.agent)
            if not agent:
                raise ValueError(f"Unknown agent: {task.agent}")

            # Execute task through agent
            result = await agent.process(agent_prompt)

            # Mark as completed
            self.task_list.mark_completed(task.task_id, result)

            return {
                "task_id": task.task_id,
                "description": task.description,
                "agent": task.agent,
                "result": result
            }

        except Exception as e:
            # Mark as failed
            error_msg = str(e)
            self.task_list.mark_failed(task.task_id, error_msg)

            return {
                "task_id": task.task_id,
                "description": task.description,
                "agent": task.agent,
                "error": error_msg
            }

    def _build_agent_prompt(self, task: Task) -> str:
        """Build prompt for agent, including dependency task results as context

        Args:
            task: Current task

        Returns:
            Complete prompt string
        """
        prompt_parts = []

        # If there are dependencies, include their results as context
        if task.dependencies:
            prompt_parts.append("## Previous Task Results\n")
            for dep_id in task.dependencies:
                dep_task = self.task_list.get_task(dep_id)
                if dep_task:
                    prompt_parts.append(f"### Task {dep_id}: {dep_task.description}")
                    if dep_task.result:
                        prompt_parts.append(f"Result:\n```\n{dep_task.result}\n```\n")
                    elif dep_task.error:
                        prompt_parts.append(f"Failed:\n```\n{dep_task.error}\n```\n")

        # Add current task description
        prompt_parts.append("## Current Task\n")
        prompt_parts.append(task.description)

        return "\n".join(prompt_parts)

    def format_results(self, results: List[Dict]) -> str:
        """Format execution results for returning to Planner

        Args:
            results: List of execution result dicts

        Returns:
            Formatted result string
        """
        if not results:
            return "No tasks were executed"

        lines = ["Task Execution Results:\n"]

        for result in results:
            task_id = result.get("task_id", "unknown")
            description = result.get("description", "")
            agent = result.get("agent", "")

            lines.append(f"### Task {task_id}")
            lines.append(f"Description: {description}")
            lines.append(f"Agent: {agent}")

            if "result" in result:
                lines.append(f"Result:\n```\n{result['result']}\n```")
            elif "error" in result:
                lines.append(f"Failed:\n```\n{result['error']}\n```")

            lines.append("")  # Empty line separator

        return "\n".join(lines)
