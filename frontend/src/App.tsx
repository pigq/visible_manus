import { useCallback, useState } from 'react';
import { InfiniteCanvas, CanvasControls } from './components/Canvas';
import { ChatInput } from './components/ChatInput';
import { BuildGuide } from './components/Sidebar';
import type { Step } from './components/Sidebar';
import { ApiIntegration, ContextMemory, SystemPrompt, ToolMcp, ReasonAct } from './components/Steps';
import { useWebSocket } from './hooks';
import { useSystemStore } from './stores/systemStore';
import { useDemoStore } from './stores/demoStore';
import { StoreProvider } from './stores/StoreContext';
import type { Task, ToolCall } from './types';

// WebSocket URL (configure based on your backend)
const WS_URL = 'ws://localhost:8765';

function App() {
  const [currentStep, setCurrentStep] = useState<Step>('api');
  const { isConnected, error, connect, send } = useWebSocket({
    url: WS_URL,
    autoConnect: true, // Auto-connect to backend
  });

  // Demo store actions (for Multi Agent demo page)
  const demoStore = useDemoStore();

  // Live store actions (for Live Demo page)
  const liveStore = useSystemStore();

  // Demo mode: simulate system events for testing without backend
  const runDemo = useCallback((text: string) => {
    demoStore.reset();

    // Simulate user input
    demoStore.setInputText(text);
    demoStore.setInputStatus('active');
    demoStore.startSession(text);
    demoStore.addMessage({ type: 'user_input', content: text });

    // Simulate planner thinking
    setTimeout(() => {
      demoStore.setPlannerStatus('working');
      demoStore.setPlannerThinking('Analyzing request and determining which agents to use...');
      demoStore.addMessage({ type: 'planner', content: 'Analyzing request...' });
    }, 500);

    // Simulate planner tool call
    setTimeout(() => {
      const toolCall: ToolCall = {
        id: 'tc-1',
        tool: 'create_task_list',
        args: 'create_task_list(2 tasks)',
        timestamp: Date.now(),
        status: 'calling',
      };
      demoStore.setPlannerToolCall(toolCall);
      demoStore.addMessage({ type: 'tool', content: toolCall.args, tool: 'create_task_list' });
    }, 1500);

    // Simulate task list update
    setTimeout(() => {
      const tasks: Task[] = [
        {
          task_id: '1',
          agent: 'ResearchAgent',
          description: 'Research the topic and gather information',
          dependencies: [],
          status: 'pending',
        },
        {
          task_id: '2',
          agent: 'WebCoderAgent',
          description: 'Create the output file based on research',
          dependencies: ['1'],
          status: 'pending',
        },
      ];
      demoStore.setTasks(tasks);
      demoStore.setPlannerStatus('active');
      demoStore.setPlannerToolCall(undefined);
      demoStore.addMessage({ type: 'planner', content: 'Tasks created: 2 tasks' });
    }, 2500);

    // Simulate Research Agent start
    setTimeout(() => {
      demoStore.clearResearchAgentToolCalls();
      demoStore.setResearchAgentStatus('working');
      demoStore.setResearchAgentTask({
        task_id: '1',
        agent: 'ResearchAgent',
        description: 'Research the topic and gather information',
        dependencies: [],
        status: 'running',
      });
      demoStore.updateTask('1', { status: 'running' });
      demoStore.addMessage({ type: 'agent', content: 'Starting research...', agent: 'ResearchAgent' });
    }, 3500);

    // Simulate Research Agent tool calls
    setTimeout(() => {
      const tc: ToolCall = {
        id: 'tc-r1',
        tool: 'navigate',
        args: 'navigate(https://google.com)',
        timestamp: Date.now(),
        status: 'calling',
      };
      demoStore.addResearchAgentToolCall(tc);
      demoStore.addMessage({ type: 'tool', content: tc.args, agent: 'ResearchAgent', tool: 'navigate' });
    }, 4000);

    setTimeout(() => {
      demoStore.updateResearchAgentToolCall('tc-r1', { status: 'complete' });
      const tc: ToolCall = {
        id: 'tc-r2',
        tool: 'type',
        args: `type(${text})`,
        timestamp: Date.now(),
        status: 'calling',
      };
      demoStore.addResearchAgentToolCall(tc);
      demoStore.addMessage({ type: 'tool', content: tc.args, agent: 'ResearchAgent', tool: 'type' });
    }, 5000);

    setTimeout(() => {
      demoStore.updateResearchAgentToolCall('tc-r2', { status: 'complete' });
      const tc: ToolCall = {
        id: 'tc-r3',
        tool: 'get_text',
        args: 'get_text(search results)',
        timestamp: Date.now(),
        status: 'calling',
      };
      demoStore.addResearchAgentToolCall(tc);
      demoStore.addMessage({ type: 'tool', content: tc.args, agent: 'ResearchAgent', tool: 'get_text' });
    }, 6000);

    // Research Agent complete
    setTimeout(() => {
      demoStore.updateResearchAgentToolCall('tc-r3', { status: 'complete' });
      demoStore.setResearchAgentStatus('complete');
      demoStore.updateTask('1', { status: 'completed', result: 'Research completed successfully' });
      demoStore.addMessage({ type: 'agent', content: 'Research completed', agent: 'ResearchAgent' });
    }, 7500);

    // WebCoder Agent start
    setTimeout(() => {
      demoStore.clearWebCoderAgentToolCalls();
      demoStore.setWebCoderAgentStatus('working');
      demoStore.setWebCoderAgentTask({
        task_id: '2',
        agent: 'WebCoderAgent',
        description: 'Create the output file based on research',
        dependencies: ['1'],
        status: 'running',
      });
      demoStore.updateTask('2', { status: 'running' });
      demoStore.addMessage({ type: 'agent', content: 'Starting file creation...', agent: 'WebCoderAgent' });
    }, 8500);

    // WebCoder Agent tool calls
    setTimeout(() => {
      const tc: ToolCall = {
        id: 'tc-w1',
        tool: 'write_file',
        args: 'write_file(output.html)',
        timestamp: Date.now(),
        status: 'calling',
      };
      demoStore.addWebCoderAgentToolCall(tc);
      demoStore.addMessage({ type: 'tool', content: tc.args, agent: 'WebCoderAgent', tool: 'write_file' });
    }, 9500);

    setTimeout(() => {
      demoStore.updateWebCoderAgentToolCall('tc-w1', { status: 'complete' });
      demoStore.setWebCoderAgentStatus('complete');
      demoStore.updateTask('2', { status: 'completed', result: 'File created successfully' });
      demoStore.addMessage({ type: 'agent', content: 'File created: output.html', agent: 'WebCoderAgent' });
    }, 11000);

    // Final output
    setTimeout(() => {
      demoStore.setOutputStatus('complete');
      demoStore.setOutput(
        `Task completed successfully!\n\nI researched "${text}" and created an output file with the results.`,
        ['output.html']
      );
      demoStore.setInputStatus('complete');
      demoStore.setPlannerStatus('complete');
      demoStore.endSession('Task completed successfully');
      demoStore.addMessage({ type: 'output', content: 'Task completed successfully!' });
    }, 12000);
  }, [demoStore]);

  const handleSendRequest = useCallback((text: string) => {
    if (isConnected) {
      // Send through WebSocket if connected
      send({ type: 'user_input', data: { text } });
    } else {
      // Run demo mode using live store if not connected
      liveStore.reset();
      liveStore.setInputText(text);
      liveStore.setInputStatus('active');
      liveStore.startSession(text);
      liveStore.addMessage({ type: 'user_input', content: text });
      // Add a message indicating no connection
      setTimeout(() => {
        liveStore.addMessage({ type: 'error', content: 'Not connected to backend. Please connect first.' });
        liveStore.setInputStatus('idle');
      }, 500);
    }
  }, [isConnected, send, liveStore]);

  // Render content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 'api':
        return <ApiIntegration />;
      case 'context':
        return <ContextMemory />;
      case 'prompt':
        return <SystemPrompt />;
      case 'tools':
        return <ToolMcp />;
      case 'reason':
        return <ReasonAct />;
      case 'multi':
        return (
          <StoreProvider mode="demo">
            <InfiniteCanvas />
            <CanvasControls />
            <ChatInput key="multi" onSendRequest={runDemo} defaultValue="Research the latest AI news and create a summary report" />
            {/* Demo Mode Indicator */}
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 font-sans">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-zinc-400 font-medium">Demo Mode</span>
            </div>
          </StoreProvider>
        );
      case 'live':
        return (
          <StoreProvider mode="live">
            <InfiniteCanvas />
            <CanvasControls />
            <ChatInput
              key="live"
              onSendRequest={handleSendRequest}
              defaultValue="research about Glassmorphism style and build a sample page."
            />
            {/* Connection Status Indicator */}
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 font-sans">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-zinc-500'}`} />
              <span className="text-xs text-zinc-400 font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {!isConnected && (
                <button
                  onClick={connect}
                  className="ml-1 px-2 py-1 text-xs font-medium text-amber-400 rounded transition-colors hover:bg-zinc-800"
                >
                  Connect
                </button>
              )}
              {error && (
                <span className="text-xs text-red-400 ml-2">{error}</span>
              )}
            </div>
          </StoreProvider>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-black text-zinc-100 overflow-hidden font-sans selection:bg-amber-500/30">
      <BuildGuide currentStep={currentStep} onSelectStep={setCurrentStep} />

      <main className="flex-1 relative overflow-hidden">
        {renderStepContent()}
      </main>
    </div>
  );
}

export default App;
