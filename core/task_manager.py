"""
Task Manager - Task list data structures and management
Core component for ReAct Planner task management
"""

import os
import json
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class TaskStatus(Enum):
    """Task status enumeration"""
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    """Single task data structure"""
    task_id: str
    agent: str  # Agent name to execute this task
    description: str  # Task description (will be used as agent prompt)
    dependencies: List[str] = field(default_factory=list)  # List of task_ids this task depends on
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[str] = None
    error: Optional[str] = None


class TaskList:
    """Task list management class"""

    def __init__(self):
        self.tasks: List[Task] = []
        self.completed: bool = False

    def create_tasks(self, tasks: List[Dict]) -> str:
        """Create initial task list

        Args:
            tasks: List of task dicts, each containing:
                - task_id: str (unique identifier)
                - agent: str (agent name)
                - description: str (task description)
                - dependencies: List[str] (optional, list of task_ids)

        Returns:
            Creation result message
        """
        if self.tasks:
            return "Error: Task list already exists, use add_task to add new tasks"

        # Validate and collect task IDs
        task_ids = set()
        for task_data in tasks:
            task_id = task_data.get("task_id")
            if not task_id:
                return "Error: Task missing task_id"
            if task_id in task_ids:
                return f"Error: Duplicate task_id: {task_id}"
            task_ids.add(task_id)

        # Validate dependencies
        for task_data in tasks:
            deps = task_data.get("dependencies", [])
            for dep_id in deps:
                if dep_id not in task_ids:
                    return f"Error: Task {task_data['task_id']} depends on non-existent task {dep_id}"

        # Create task objects
        for task_data in tasks:
            task = Task(
                task_id=task_data["task_id"],
                agent=task_data.get("agent", "DefaultAgent"),
                description=task_data["description"],
                dependencies=task_data.get("dependencies", [])
            )
            self.tasks.append(task)

        return f"Created {len(self.tasks)} tasks"

    def add_task(self, task_id: str, agent: str, description: str,
                 dependencies: List[str] = None, after_task_id: Optional[str] = None) -> str:
        """Add new task to list

        Args:
            task_id: Task ID
            agent: Agent to execute this task
            description: Task description
            dependencies: List of task_ids this task depends on
            after_task_id: Insert after this task (optional)

        Returns:
            Addition result message
        """
        # Check if task_id already exists
        if self.get_task(task_id):
            return f"Error: task_id {task_id} already exists"

        # Validate dependencies
        if dependencies:
            for dep_id in dependencies:
                if not self.get_task(dep_id):
                    return f"Error: Dependency task {dep_id} does not exist"

        # Create new task
        new_task = Task(
            task_id=task_id,
            agent=agent,
            description=description,
            dependencies=dependencies or []
        )

        # Insert position
        if after_task_id:
            insert_index = None
            for i, task in enumerate(self.tasks):
                if task.task_id == after_task_id:
                    insert_index = i + 1
                    break
            if insert_index is None:
                return f"Error: after_task_id {after_task_id} does not exist"
            self.tasks.insert(insert_index, new_task)
        else:
            self.tasks.append(new_task)

        return f"Added task {task_id}"

    def modify_task(self, task_id: str, new_description: str,
                    new_agent: Optional[str] = None) -> str:
        """Modify existing task

        Args:
            task_id: Task ID to modify
            new_description: New task description
            new_agent: New agent name (optional)

        Returns:
            Modification result message
        """
        task = self.get_task(task_id)
        if not task:
            return f"Error: Task {task_id} does not exist"

        if task.status != TaskStatus.PENDING:
            return f"Error: Task {task_id} has status {task.status.value}, cannot modify"

        task.description = new_description
        if new_agent:
            task.agent = new_agent

        return f"Modified task {task_id}"

    def remove_task(self, task_id: str) -> str:
        """Remove task from list

        Args:
            task_id: Task ID to remove

        Returns:
            Removal result message
        """
        task = self.get_task(task_id)
        if not task:
            return f"Error: Task {task_id} does not exist"

        if task.status != TaskStatus.PENDING:
            return f"Error: Task {task_id} has status {task.status.value}, cannot remove"

        # Check if other tasks depend on this task
        for t in self.tasks:
            if task_id in t.dependencies:
                return f"Error: Task {t.task_id} depends on {task_id}, cannot remove"

        self.tasks = [t for t in self.tasks if t.task_id != task_id]
        return f"Removed task {task_id}"

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID

        Args:
            task_id: Task ID

        Returns:
            Task object, or None if not found
        """
        for task in self.tasks:
            if task.task_id == task_id:
                return task
        return None

    def get_ready_tasks(self) -> List[Task]:
        """Get all ready tasks (dependencies satisfied and status is pending)

        Returns:
            List of ready tasks
        """
        ready = []
        for task in self.tasks:
            if task.status != TaskStatus.PENDING:
                continue

            # Check if all dependencies are completed
            deps_satisfied = True
            for dep_id in task.dependencies:
                dep_task = self.get_task(dep_id)
                if not dep_task or dep_task.status != TaskStatus.COMPLETED:
                    deps_satisfied = False
                    break

            if deps_satisfied:
                ready.append(task)

        return ready

    def mark_executing(self, task_id: str) -> None:
        """Mark task as executing"""
        task = self.get_task(task_id)
        if task:
            task.status = TaskStatus.EXECUTING

    def mark_completed(self, task_id: str, result: str) -> None:
        """Mark task as completed"""
        task = self.get_task(task_id)
        if task:
            task.status = TaskStatus.COMPLETED
            task.result = result

    def mark_failed(self, task_id: str, error: str) -> None:
        """Mark task as failed"""
        task = self.get_task(task_id)
        if task:
            task.status = TaskStatus.FAILED
            task.error = error

    def has_pending_tasks(self) -> bool:
        """Check if there are any pending tasks"""
        return any(t.status == TaskStatus.PENDING for t in self.tasks)

    def to_dict(self) -> Dict:
        """Serialize to dictionary

        Returns:
            Dictionary representation of task list
        """
        return {
            "tasks": [
                {
                    "task_id": t.task_id,
                    "agent": t.agent,
                    "description": t.description,
                    "dependencies": t.dependencies,
                    "status": t.status.value,
                    "result": t.result,
                    "error": t.error
                }
                for t in self.tasks
            ],
            "completed": self.completed
        }

    def get_summary(self) -> str:
        """Get task list summary

        Returns:
            Formatted summary string
        """
        lines = ["Task List Status:"]

        for task in self.tasks:
            status_icon = {
                TaskStatus.PENDING: "⏳",
                TaskStatus.EXECUTING: "🔄",
                TaskStatus.COMPLETED: "✅",
                TaskStatus.FAILED: "❌"
            }.get(task.status, "?")

            deps_str = f" (deps: {', '.join(task.dependencies)})" if task.dependencies else ""
            lines.append(f"  {status_icon} {task.task_id}: [{task.agent}] {task.description[:50]}...{deps_str}")

            if task.result:
                result_preview = task.result[:100] + "..." if len(task.result) > 100 else task.result
                lines.append(f"      Result: {result_preview}")
            if task.error:
                lines.append(f"      Error: {task.error}")

        pending_count = sum(1 for t in self.tasks if t.status == TaskStatus.PENDING)
        completed_count = sum(1 for t in self.tasks if t.status == TaskStatus.COMPLETED)
        failed_count = sum(1 for t in self.tasks if t.status == TaskStatus.FAILED)

        lines.append(f"\nStats: Pending {pending_count}, Completed {completed_count}, Failed {failed_count}")

        return "\n".join(lines)

    def save(self, filepath: str) -> None:
        """Save task list to file

        Args:
            filepath: Path to save file
        """
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        # Serialize to dict
        data = self.to_dict()

        # Write to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, filepath: str) -> 'TaskList':
        """Load task list from file

        Args:
            filepath: Path to load from

        Returns:
            Loaded TaskList instance
        """
        if not os.path.exists(filepath):
            # File doesn't exist, return empty TaskList
            return cls()

        # Read file
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Rebuild TaskList
        task_list = cls()
        task_list.completed = data.get("completed", False)

        # Rebuild Task objects
        for task_data in data.get("tasks", []):
            task = Task(
                task_id=task_data["task_id"],
                agent=task_data["agent"],
                description=task_data["description"],
                dependencies=task_data.get("dependencies", []),
                status=TaskStatus(task_data["status"]),
                result=task_data.get("result"),
                error=task_data.get("error")
            )
            task_list.tasks.append(task)

        return task_list
