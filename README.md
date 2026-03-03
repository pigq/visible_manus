# Visible Manus

A multi-agent AI orchestration system with real-time visualization. Watch AI agents plan, execute tasks, and collaborate through an interactive canvas interface.

## Setup

### Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_URL=https://api.deepseek.com

# Start WebSocket server
python server.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Browser MCP (for ResearchAgent)

1. Open Chrome browser
2. Install Browser MCP extension
3. Click "Connect" in the extension

## Usage

1. Open <http://localhost:5173>
2. Navigate to "Live Demo" in the sidebar
3. Enter a request (e.g., "research about Glassmorphism style and build a sample page")
4. Watch the agents work in real-time on the canvas

## Architecture

- **Planner**: Breaks down requests into tasks with dependencies
- **ResearchAgent**: Web research using browser automation
- **WebCoderAgent**: Creates HTML/CSS/JS webpages
- **Frontend**: React + Vite + Zustand + Framer Motion
- **Communication**: WebSocket for real-time updates

## Contact

Scan the QR code to connect with me
