import { useEffect, useRef, useCallback, useState } from 'react';
import { useSystemStore } from '../stores/systemStore';
import type { ToolCall } from '../types';

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
}

interface ServerEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

export function useWebSocket({ url, autoConnect = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const hasConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format tool call for display
  const formatToolArgs = (args: string): string => {
    try {
      const parsed = JSON.parse(args);
      // For computer tool, prioritize action
      if (parsed.action) {
        const action = parsed.action;
        const extra = parsed.coordinate ? ` at ${JSON.stringify(parsed.coordinate)}` :
                      parsed.text ? `: "${parsed.text.slice(0, 30)}${parsed.text.length > 30 ? '...' : ''}"` :
                      parsed.url ? `: ${parsed.url.slice(0, 40)}${parsed.url.length > 40 ? '...' : ''}` : '';
        return `(action=${action}${extra})`;
      }
      const mainArg = parsed.url || parsed.text || parsed.filename || parsed.query || parsed.selector || parsed.path || '';
      const shortArg = typeof mainArg === 'string' && mainArg.length > 40
        ? `${mainArg.slice(0, 40)}...`
        : mainArg;
      return shortArg ? `(${shortArg})` : '';
    } catch {
      return args.length > 50 ? `(${args.slice(0, 50)}...)` : `(${args})`;
    }
  };

  // Handle incoming WebSocket messages - access store directly to avoid dependency issues
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const wsEvent: ServerEvent = JSON.parse(event.data);
      const { type, data } = wsEvent;

      // Get store actions directly to avoid stale closures
      const store = useSystemStore.getState();

      switch (type) {
        case 'connected':
          console.log('Server connection confirmed:', data.message);
          break;

        case 'session_start':
          store.reset();
          store.setInputText(data.user_input as string);
          store.setInputStatus('active');
          store.startSession(data.user_input as string);
          store.addMessage({ type: 'user_input', content: data.user_input as string });
          break;

        case 'input_status':
          store.setInputStatus(data.status as 'idle' | 'active' | 'working' | 'complete' | 'error');
          break;

        case 'planner_status':
          store.setPlannerStatus(data.status as 'idle' | 'active' | 'working' | 'complete' | 'error');
          break;

        case 'thinking':
          if (data.agent === 'planner') {
            store.setPlannerThinking(data.content as string);
            store.addMessage({ type: 'planner', content: data.content as string });
          }
          break;

        case 'tool_call': {
          const toolName = data.tool as string;
          const toolArgs = formatToolArgs(data.args as string);
          const toolDisplay = `${toolName}${toolArgs}`;

          const toolCall: ToolCall = {
            id: data.id as string || `tc-${Date.now()}`,
            tool: toolName,
            args: toolDisplay,
            timestamp: Date.now(),
            status: 'calling',
          };

          if (data.agent === 'planner') {
            store.setPlannerToolCall(toolCall);
            store.addMessage({ type: 'tool', content: toolDisplay, tool: toolName });
          } else if (data.agent === 'ResearchAgent') {
            store.addResearchAgentToolCall(toolCall);
            store.addMessage({ type: 'tool', content: toolDisplay, agent: 'ResearchAgent', tool: toolName });
          } else if (data.agent === 'WebCoderAgent') {
            store.addWebCoderAgentToolCall(toolCall);
            store.addMessage({ type: 'tool', content: toolDisplay, agent: 'WebCoderAgent', tool: toolName });
          }
          break;
        }

        case 'tool_call_complete': {
          const agent = data.agent as string;
          const toolCallId = data.id as string;

          if (agent === 'ResearchAgent') {
            store.updateResearchAgentToolCall(toolCallId, { status: 'complete' });
          } else if (agent === 'WebCoderAgent') {
            store.updateWebCoderAgentToolCall(toolCallId, { status: 'complete' });
          }
          break;
        }

        case 'tool_result': {
          const agent = data.agent as string;
          const toolCallId = data.id as string;
          const toolName = data.tool as string;
          const result = data.result as string;

          // Update tool call status
          if (agent === 'ResearchAgent') {
            store.updateResearchAgentToolCall(toolCallId, { status: 'complete' });
          } else if (agent === 'WebCoderAgent') {
            store.updateWebCoderAgentToolCall(toolCallId, { status: 'complete' });
          }

          // Add message for tool result
          store.addMessage({
            type: 'tool_result',
            content: `${toolName}: ${result}`,
            agent,
            tool: toolName
          });
          break;
        }

        case 'agent_response': {
          const agent = data.agent as string;
          const content = data.content as string;

          // Add message for agent LLM response
          store.addMessage({
            type: 'agent',
            content,
            agent
          });
          break;
        }

        case 'planner_context': {
          // Task results returned to planner context
          const content = data.content as string;

          // Add message showing task results in planner context
          store.addMessage({
            type: 'planner',
            content: content.length > 500 ? `${content.slice(0, 500)}...` : content
          });
          break;
        }

        case 'tasks_update': {
          const tasks = (data.tasks as Array<{
            task_id: string;
            agent: string;
            description: string;
            dependencies: string[];
            status: string;
          }>).map(t => ({
            ...t,
            status: t.status as 'pending' | 'running' | 'completed' | 'failed',
          }));
          store.setTasks(tasks);
          store.setPlannerStatus('active');
          store.setPlannerToolCall(undefined);
          store.addMessage({ type: 'planner', content: `Tasks created: ${tasks.length} tasks` });
          break;
        }

        case 'task_status': {
          const taskId = data.task_id as string;
          const status = data.status as 'pending' | 'running' | 'completed' | 'failed';
          const result = data.result as string | undefined;

          store.updateTask(taskId, {
            status,
            result,
          });

          // Add message for task completion
          if (status === 'completed') {
            store.addMessage({
              type: 'planner',
              content: `Task ${taskId} completed${result ? `: ${result.slice(0, 100)}...` : ''}`
            });
          } else if (status === 'failed') {
            store.addMessage({
              type: 'error',
              content: `Task ${taskId} failed${result ? `: ${result}` : ''}`
            });
          }
          break;
        }

        case 'agent_status': {
          const agent = data.agent as string;
          const status = data.status as 'idle' | 'active' | 'working' | 'complete' | 'error';

          if (agent === 'ResearchAgent') {
            store.setResearchAgentStatus(status);
            if (status === 'working') {
              store.clearResearchAgentToolCalls();
              store.addMessage({ type: 'agent', content: 'Starting work...', agent });
            } else if (status === 'complete') {
              store.addMessage({ type: 'agent', content: 'Completed task', agent });
            }
          } else if (agent === 'WebCoderAgent') {
            store.setWebCoderAgentStatus(status);
            if (status === 'working') {
              store.clearWebCoderAgentToolCalls();
              store.addMessage({ type: 'agent', content: 'Starting work...', agent });
            } else if (status === 'complete') {
              store.addMessage({ type: 'agent', content: 'Completed task', agent });
            }
          }
          break;
        }

        case 'agent_task': {
          const agent = data.agent as string;
          const task = data.task as { task_id: string; description: string };

          const fullTask = {
            task_id: task.task_id,
            agent,
            description: task.description,
            dependencies: [] as string[],
            status: 'running' as const,
          };

          if (agent === 'ResearchAgent') {
            store.setResearchAgentTask(fullTask);
          } else if (agent === 'WebCoderAgent') {
            store.setWebCoderAgentTask(fullTask);
          }

          store.addMessage({ type: 'agent', content: `Starting: ${task.description}`, agent });
          break;
        }

        case 'output': {
          const outputText = data.text as string;
          const outputFiles = (data.files as string[]) || [];

          store.setOutputStatus('complete');
          store.setOutput(outputText, outputFiles);
          store.addMessage({ type: 'output', content: outputText });
          // Mark session as complete so user can input again
          store.setInputStatus('complete');
          store.setPlannerStatus('complete');
          break;
        }

        case 'session_end': {
          const status = data.status as string;
          store.setInputStatus('complete');
          store.setPlannerStatus('complete');

          if (status === 'complete') {
            store.endSession(data.output as string);
          } else {
            store.endSession(undefined, true);
          }
          break;
        }

        case 'error':
          setError(data.message as string);
          store.addMessage({ type: 'error', content: data.message as string });
          // Reset input status so user can try again
          store.setInputStatus('idle');
          break;

        case 'pong':
          // Heartbeat response
          break;

        default:
          console.log('Unknown event type:', type, data);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, []); // No dependencies - uses getState() for store access

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Prevent multiple connections (including during CONNECTING state)
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('WebSocket connected to', url);

        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = window.setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000); // Send ping every 15 seconds
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');

        // Stop heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Auto-reconnect after 3 seconds (only if not intentionally disconnected)
        if (hasConnectedRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            console.log('Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };

      wsRef.current.onerror = (e) => {
        setError('WebSocket connection error');
        console.error('WebSocket error:', e);
      };

      wsRef.current.onmessage = handleMessage;
    } catch (err) {
      setError('Failed to connect to WebSocket');
      console.error('WebSocket connection failed:', err);
    }
  }, [url, handleMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    // Clear heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Clear pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Send message through WebSocket
  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }, []);

  // Auto-connect on mount - use ref to prevent double connection in StrictMode
  useEffect(() => {
    if (autoConnect && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connect();
    }
    return () => {
      hasConnectedRef.current = false;
      disconnect();
    };
  }, [autoConnect]); // Minimal dependencies

  return {
    isConnected,
    error,
    connect,
    disconnect,
    send,
  };
}
