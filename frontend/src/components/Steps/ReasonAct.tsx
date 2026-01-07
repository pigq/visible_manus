import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Step 5: Reason & Act - Based on Step 4 with reasoning loops
// Shows: System Prompt + User Input (vertical) → Context → API + Tool (vertical) → Response
// The API uses multiple loops: Think → Act → Observe → Think → ... → Response

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
  content: string;
}

interface ToolCall {
  id: string;
  tool: string;
  args: string;
  status: 'calling' | 'complete';
  result?: string;
}

const availableTools = [
  { id: 'web_search', label: 'Web Search' },
  { id: 'calculator', label: 'Calculator' },
  { id: 'read_file', label: 'Read File' },
];

const sampleInputs = [
  'What is the population of Tokyo and how does it compare to New York?',
  'Calculate the compound interest on $10,000 at 5% for 3 years',
  'Research the latest AI breakthroughs in 2024',
  'How many calories are in a Big Mac and what percentage of daily intake is that?',
];

// Reasoning steps for complex query
const mockReasoningSequence = [
  { type: 'thought', content: 'I need to search for Tokyo population first...' },
  { type: 'tool_call', tool: 'web_search', args: 'Tokyo population 2024' },
  { type: 'tool_result', content: 'Tokyo: 13.96 million people' },
  { type: 'thought', content: 'Now I need to find New York population...' },
  { type: 'tool_call', tool: 'web_search', args: 'New York population 2024' },
  { type: 'tool_result', content: 'New York: 8.34 million people' },
  { type: 'thought', content: 'Let me calculate the difference...' },
  { type: 'tool_call', tool: 'calculator', args: '13.96 - 8.34' },
  { type: 'tool_result', content: '5.62 million' },
  { type: 'thought', content: 'Now I can formulate my response with all the data.' },
];

// Horizontal connection line component
function ConnectionLine({ isActive, color }: { isActive: boolean; color: 'amber' | 'green' }) {
  const strokeColor = color === 'amber' ? '#f59e0b' : '#4ade80';

  return (
    <svg width="50" height="60" className="shrink-0">
      {isActive && (
        <motion.path
          d="M 0 30 C 25 30, 25 30, 50 30"
          fill="none"
          stroke={strokeColor}
          strokeWidth={6}
          strokeOpacity={0.2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
      <motion.path
        d="M 0 30 C 25 30, 25 30, 50 30"
        fill="none"
        stroke={isActive ? strokeColor : '#27272a'}
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5 }}
      />
    </svg>
  );
}

// Vertical connection line between API and TOOL
function VerticalConnectionLine({ isActive }: { isActive: boolean }) {
  const strokeColor = '#f97316'; // orange

  return (
    <svg width="140" height="20" className="shrink-0">
      {isActive && (
        <motion.path
          d="M 70 0 L 70 20"
          fill="none"
          stroke={strokeColor}
          strokeWidth={6}
          strokeOpacity={0.2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
      <motion.path
        d="M 70 0 L 70 20"
        fill="none"
        stroke={isActive ? strokeColor : '#27272a'}
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  );
}

export function ReasonAct() {
  const [input, setInput] = useState(sampleInputs[0]);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'tool_use' | 'complete'>('idle');
  const [response, setResponse] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [loopCount, setLoopCount] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const stepIndexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const systemPrompt = 'You are an AI assistant with access to tools: web_search, calculator, read_file. Think step by step.';

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Reload sample input after completion
  useEffect(() => {
    if (status === 'complete' && messages.length > 0) {
      const nextIndex = (inputIndex + 1) % sampleInputs.length;
      setInputIndex(nextIndex);
      setInput(sampleInputs[nextIndex]);
    }
  }, [status, messages.length]);

  const handleSubmit = () => {
    if (!input.trim() || status !== 'idle') return;

    // Add system message if first message
    const newMessages: Message[] = [];
    if (messages.length === 0) {
      newMessages.push({
        id: 'msg-system',
        role: 'system',
        content: systemPrompt,
      });
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
    };
    newMessages.push(userMessage);

    setMessages((prev) => [...prev, ...newMessages]);
    setStatus('thinking');
    setResponse('');
    setToolCalls([]);
    setLoopCount(0);
    stepIndexRef.current = 0;

    // Start reasoning loop
    intervalRef.current = setInterval(() => {
      const idx = stepIndexRef.current;
      if (idx < mockReasoningSequence.length) {
        const step = mockReasoningSequence[idx];

        if (step.type === 'thought') {
          setStatus('thinking');
          setCurrentTool(null);
          setLoopCount((prev) => prev + 1);
          setMessages((prev) => [
            ...prev,
            { id: `msg-thought-${Date.now()}`, role: 'thought', content: step.content || '' },
          ]);
        } else if (step.type === 'tool_call') {
          setStatus('tool_use');
          setCurrentTool(step.tool!);
          const toolCall: ToolCall = {
            id: `tc-${Date.now()}`,
            tool: step.tool!,
            args: step.args!,
            status: 'calling',
          };
          setToolCalls([toolCall]);
          setMessages((prev) => [
            ...prev,
            { id: `msg-assistant-call-${Date.now()}`, role: 'assistant', content: `${step.tool}(${step.args})` },
          ]);
        } else if (step.type === 'tool_result') {
          setToolCalls((prev) => prev.map((tc) => ({ ...tc, status: 'complete', result: step.content || '' })));
          setMessages((prev) => [
            ...prev,
            { id: `msg-tool-result-${Date.now()}`, role: 'tool', content: `→ ${step.content || ''}` },
          ]);
        }

        stepIndexRef.current = idx + 1;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setTimeout(() => {
          const responseText = 'Tokyo has a population of 13.96 million, while New York has 8.34 million. Tokyo is larger by 5.62 million people, making it about 67% more populous than New York.';
          setMessages((prev) => [
            ...prev,
            { id: `msg-assistant-${Date.now()}`, role: 'assistant', content: responseText },
          ]);
          setResponse(responseText);
          setStatus('complete');
          setCurrentTool(null);
        }, 500);
      }
    }, 1000);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative z-10 flex flex-col items-center gap-6 pt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-zinc-200 mb-2">Reason & Act</h2>
          <p className="text-sm text-zinc-500 max-w-md">
            The LLM thinks step-by-step, using multiple tools in a reasoning loop before formulating its final response.
          </p>
        </div>

        {/* Available Tools indicator */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs text-zinc-500">Available Tools:</span>
          {availableTools.map((tool) => (
            <div
              key={tool.id}
              className={`px-2 py-1 rounded border transition-all ${
                currentTool === tool.id
                  ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
              }`}
            >
              <span className="text-[10px]">{tool.label}</span>
            </div>
          ))}
          {loopCount > 0 && (
            <div className="ml-2 px-2 py-1 rounded bg-amber-500/20 border border-amber-500/50">
              <span className="text-[10px] text-amber-300">Loop #{loopCount}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-5">
          {/* System Prompt + User Input (Vertical Stack) */}
          <div className="flex flex-col gap-3">
            {/* System Prompt Node */}
            <motion.div
              className="w-[260px] rounded-2xl border border-orange-500/50 bg-zinc-900 p-4 shadow-xl shadow-orange-500/10"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
                <span className="text-sm font-bold text-zinc-300">SYSTEM PROMPT</span>
              </div>
              <p className="text-[11px] text-orange-200 leading-relaxed">{systemPrompt}</p>
            </motion.div>

            {/* User Input Node */}
            <motion.div
              className={`w-[260px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
                status === 'thinking' ? 'border-amber-500' : 'border-zinc-800'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
                <span className="text-sm font-bold text-zinc-300">USER INPUT</span>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a complex question..."
                disabled={status !== 'idle'}
                className="w-full h-24 bg-black/50 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500/50"
              />

              <button
                onClick={handleSubmit}
                disabled={!input.trim() || status !== 'idle'}
                className={`w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                  input.trim() && status === 'idle'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-zinc-800 text-zinc-600'
                }`}
              >
                Send
              </button>
            </motion.div>
          </div>

          <ConnectionLine isActive={status !== 'idle'} color="amber" />

          {/* Context Node */}
          <motion.div
            className={`w-[400px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
              messages.length > 0 ? 'border-amber-500/50' : 'border-zinc-800'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
              <span className="text-sm font-bold text-zinc-300">CONTEXT</span>
              <span className="ml-auto text-[10px] text-amber-400 font-bold">{messages.length} msgs</span>
            </div>

            <div className="h-[380px] bg-black/50 border border-zinc-800 rounded-lg p-3 space-y-1 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4">No context yet</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="text-[11px] py-1">
                    <span className={`font-medium ${
                      msg.role === 'system' ? 'text-orange-400' :
                      msg.role === 'user' ? 'text-amber-400' :
                      msg.role === 'tool' ? 'text-cyan-400' :
                      msg.role === 'thought' ? 'text-purple-400' :
                      'text-zinc-500'
                    }`}>
                      {msg.role === 'system' ? 'system: ' :
                       msg.role === 'user' ? 'user: ' :
                       msg.role === 'tool' ? 'tool: ' :
                       msg.role === 'thought' ? 'think: ' :
                       'assistant: '}
                    </span>
                    <span className="text-zinc-300">{msg.content}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <ConnectionLine isActive={status === 'thinking' || status === 'tool_use' || status === 'complete'} color="amber" />

          {/* API + Tool (Vertical Stack) */}
          <div className="flex flex-col items-center">
            {/* API Node */}
            <motion.div
              className={`w-[140px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
                status === 'thinking' ? 'border-amber-500' : 'border-zinc-800'
              }`}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
                <span className="text-sm font-bold text-zinc-300">API</span>
                {loopCount > 0 && (
                  <span className="ml-auto text-[9px] text-amber-400">#{loopCount}</span>
                )}
              </div>

              <div className="flex flex-col items-center py-2">
                <AnimatePresence mode="wait">
                  {status === 'thinking' ? (
                    <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                      <motion.div
                        className="w-10 h-10 rounded-lg border border-amber-500 flex items-center justify-center bg-zinc-950"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <span className="text-amber-400 text-lg font-bold">...</span>
                      </motion.div>
                      <span className="mt-2 text-[9px] font-bold text-amber-400">THINKING</span>
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-lg border border-zinc-700 flex items-center justify-center bg-zinc-950">
                        <span className="text-zinc-500 text-sm font-bold">LLM</span>
                      </div>
                      <span className="mt-2 text-[9px] font-bold text-zinc-500">STANDBY</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Vertical Connection Line */}
            <VerticalConnectionLine isActive={status === 'tool_use' || status === 'complete'} />

            {/* Tool Node */}
            <motion.div
              className={`w-[140px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
                status === 'tool_use' ? 'border-orange-500 shadow-orange-500/20' : 'border-zinc-800'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
                <span className="text-sm font-bold text-zinc-300">TOOL</span>
                {status === 'tool_use' && (
                  <motion.div
                    className="ml-auto w-2 h-2 rounded-full bg-orange-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </div>

              <div className="flex flex-col items-center py-2">
                {toolCalls.length === 0 ? (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-lg border border-zinc-700 flex items-center justify-center bg-zinc-950">
                      <span className="text-zinc-500 text-[9px] font-bold">TOOL</span>
                    </div>
                    <span className="mt-2 text-[9px] font-bold text-zinc-500">STANDBY</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className={`w-10 h-10 mx-auto rounded-lg border flex items-center justify-center bg-zinc-950 ${
                      toolCalls[0].status === 'calling' ? 'border-orange-500' : 'border-green-500'
                    }`}>
                      <span className={`text-[8px] font-bold ${
                        toolCalls[0].status === 'calling' ? 'text-orange-400' : 'text-green-400'
                      }`}>
                        {toolCalls[0].tool.split('_')[0].toUpperCase()}
                      </span>
                    </div>
                    <span className={`mt-2 text-[9px] font-bold block ${
                      toolCalls[0].status === 'calling' ? 'text-orange-400' : 'text-green-400'
                    }`}>
                      {toolCalls[0].status === 'calling' ? 'RUNNING' : 'DONE'}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <ConnectionLine isActive={status === 'complete'} color="green" />

          {/* Response Node */}
          <motion.div
            className={`w-[260px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
              status === 'complete' ? 'border-green-500' : 'border-zinc-800'
            }`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
              <span className="text-sm font-bold text-zinc-300">RESPONSE</span>
            </div>

            <div className="h-[300px] bg-black/50 border border-zinc-800 rounded-lg p-3 overflow-y-auto">
              {response ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-200 leading-relaxed">
                  {response}
                </motion.p>
              ) : (
                <p className="text-sm text-zinc-500 italic">Waiting for response...</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
