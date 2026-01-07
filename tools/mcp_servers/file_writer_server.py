"""
File Writer MCP Server
Provides tools for writing HTML/CSS/JavaScript files
"""

from mcp.server.fastmcp import FastMCP
import os
from pathlib import Path

server = FastMCP("File Writer")


@server.tool()
def write_file(filepath: str, content: str) -> str:
    """Write content to a file

    Args:
        filepath: Path to file (relative to output directory)
        content: File content to write

    Returns:
        Success message with file path
    """
    try:
        # Define output directory (relative to current working directory)
        output_dir = Path.cwd() / "output"
        output_dir.mkdir(exist_ok=True)

        # Resolve file path (prevent directory traversal)
        file_path = output_dir / filepath
        file_path = file_path.resolve()

        # Security check: ensure file is within output directory
        if not str(file_path).startswith(str(output_dir.resolve())):
            return f"Error: Invalid file path - must be within output directory"

        # Create parent directories if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return f"Successfully wrote {len(content)} characters to {file_path}"

    except Exception as e:
        return f"Error writing file: {e}"


@server.tool()
def read_file(filepath: str) -> str:
    """Read content from a file

    Args:
        filepath: Path to file (relative to output directory)

    Returns:
        File content or error message
    """
    try:
        output_dir = Path.cwd() / "output"
        file_path = output_dir / filepath
        file_path = file_path.resolve()

        # Security check
        if not str(file_path).startswith(str(output_dir.resolve())):
            return f"Error: Invalid file path - must be within output directory"

        if not file_path.exists():
            return f"Error: File not found - {file_path}"

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return content

    except Exception as e:
        return f"Error reading file: {e}"


@server.tool()
def list_files(directory: str = ".") -> str:
    """List files in output directory

    Args:
        directory: Subdirectory to list (relative to output directory)

    Returns:
        List of files and directories
    """
    try:
        output_dir = Path.cwd() / "output"
        target_dir = output_dir / directory
        target_dir = target_dir.resolve()

        # Security check
        if not str(target_dir).startswith(str(output_dir.resolve())):
            return f"Error: Invalid directory path"

        if not target_dir.exists():
            return f"Error: Directory not found - {target_dir}"

        # List files and directories
        items = []
        for item in sorted(target_dir.iterdir()):
            if item.is_dir():
                items.append(f"[DIR]  {item.name}/")
            else:
                size = item.stat().st_size
                items.append(f"[FILE] {item.name} ({size} bytes)")

        if not items:
            return "Directory is empty"

        return "\n".join(items)

    except Exception as e:
        return f"Error listing files: {e}"


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
