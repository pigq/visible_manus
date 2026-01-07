"""
Web Fetch MCP Server
Provides tools for fetching web content
"""

from mcp.server.fastmcp import FastMCP
import json

server = FastMCP("Web Fetch")


@server.tool()
def fetch_url(url: str, extract_text: bool = True) -> str:
    """Fetch content from a URL

    Args:
        url: URL to fetch
        extract_text: If True, extract only text content; if False, return raw HTML

    Returns:
        Fetched content or error message
    """
    try:
        import requests
        from bs4 import BeautifulSoup

        # Fetch URL
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        if not extract_text:
            # Return raw HTML
            return response.text

        # Extract text using BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()

        # Get text
        text = soup.get_text()

        # Clean up text
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)

        result = {
            "url": url,
            "title": soup.title.string if soup.title else "No title",
            "content": text[:10000],  # Limit to 10k chars
            "content_length": len(text)
        }

        return json.dumps(result, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({
            "error": str(e),
            "url": url
        }, ensure_ascii=False)


@server.tool()
def search_web(query: str, num_results: int = 5) -> str:
    """Search the web using DuckDuckGo

    Args:
        query: Search query
        num_results: Number of results to return (default: 5)

    Returns:
        JSON string with search results
    """
    try:
        from duckduckgo_search import DDGS

        results = []
        with DDGS() as ddgs:
            for i, result in enumerate(ddgs.text(query, max_results=num_results)):
                results.append({
                    "title": result.get("title", ""),
                    "url": result.get("href", ""),
                    "snippet": result.get("body", "")
                })

        return json.dumps({
            "query": query,
            "results": results
        }, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({
            "error": str(e),
            "query": query
        }, ensure_ascii=False)


if __name__ == "__main__":
    # Suppress all logging
    import logging
    import warnings
    warnings.filterwarnings("ignore")
    logging.basicConfig(level=logging.CRITICAL)
    for logger_name in ["mcp", "mcp.server", "httpx", "httpcore", "duckduckgo_search"]:
        logging.getLogger(logger_name).setLevel(logging.CRITICAL)
        logging.getLogger(logger_name).propagate = False

    server.run()
