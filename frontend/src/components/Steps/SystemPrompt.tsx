import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Step 3: System Prompt - Configure AI behavior
// Shows: System Prompt + User Input (vertical) → Context → API Call → Response

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const presetPrompts = [
  { id: 'default', label: 'Default', prompt: 'You are a helpful AI assistant.' },
  { id: 'coder', label: 'Coder', prompt: 'You are an expert programmer. Respond with code examples and technical explanations.' },
  { id: 'teacher', label: 'Teacher', prompt: 'You are a patient teacher. Explain concepts simply and use analogies.' },
  { id: 'creative', label: 'Creative', prompt: 'You are a creative writer. Be imaginative and use vivid language.' },
];

const sampleInputs = [
  'Explain how machine learning works',
  'What is the difference between AI and ML?',
  'How do neural networks learn?',
  'What is deep learning?',
];

const mockResponses: Record<string, string[]> = {
  default: ["I'd be happy to help you with that question.", "Let me assist you with this task."],
  coder: ["Here's a code solution:\n```python\ndef example():\n    return 'Hello World'\n```", "From a technical perspective, you'll want to use..."],
  teacher: ["Think of it like this: imagine you have a box of crayons...", "Let me break this down into simpler steps for you."],
  creative: ["In the shimming light of understanding, your question blooms like a curious flower...", "Picture a world where your idea takes flight on wings of possibility..."],
};

// Connection line component
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

export function SystemPrompt() {
  const [selectedPrompt, setSelectedPrompt] = useState(presetPrompts[0]);
  const [customPrompt, setCustomPrompt] = useState(presetPrompts[0].prompt);
  const [input, setInput] = useState('Explain how machine learning works');
  const [status, setStatus] = useState<'idle' | 'sending' | 'complete'>('idle');
  const [response, setResponse] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputIndex, setInputIndex] = useState(0);

  const handlePromptSelect = (preset: typeof presetPrompts[0]) => {
    setSelectedPrompt(preset);
    setCustomPrompt(preset.prompt);
  };

  // Reload sample input after completion
  useEffect(() => {
    if (status === 'complete' && messages.length > 0) {
      const nextIndex = (inputIndex + 1) % sampleInputs.length;
      setInputIndex(nextIndex);
      setInput(sampleInputs[nextIndex]);
    }
  }, [status, messages.length]);

  const handleSubmit = () => {
    if (!input.trim() || status === 'sending') return;

    // Add system message if first message
    const newMessages: Message[] = [];
    if (messages.length === 0) {
      newMessages.push({
        id: `msg-system`,
        role: 'system',
        content: customPrompt,
      });
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
    };
    newMessages.push(userMessage);

    setMessages((prev) => [...prev, ...newMessages]);
    setStatus('sending');
    setResponse('');

    setTimeout(() => {
      const responses = mockResponses[selectedPrompt.id] || mockResponses.default;
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: randomResponse,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setResponse(randomResponse);
      setStatus('complete');
    }, 2000);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative z-10 flex flex-col items-center gap-6 pt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-zinc-200 mb-2">System Prompt</h2>
          <p className="text-sm text-zinc-500 max-w-md">
            Define Claude's personality and behavior with a system prompt. This shapes how the AI responds.
          </p>
        </div>

        <div className="flex items-center gap-5">
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

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-1 mb-3">
                {presetPrompts.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePromptSelect(preset)}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                      selectedPrompt.id === preset.id
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full h-16 bg-black/50 border border-zinc-800 rounded-lg p-2 text-[11px] text-orange-200 resize-none focus:outline-none focus:border-orange-500/50"
              />
            </motion.div>

            {/* User Input Node */}
            <motion.div
              className={`w-[260px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
                status === 'sending' ? 'border-amber-500' : 'border-zinc-800'
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
                placeholder="Ask something..."
                disabled={status === 'sending'}
                className="w-full h-24 bg-black/50 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500/50"
              />

              <button
                onClick={handleSubmit}
                disabled={!input.trim() || status === 'sending'}
                className={`w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                  input.trim() && status !== 'sending'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-zinc-800 text-zinc-600'
                }`}
              >
                Send
              </button>
            </motion.div>
          </div>

          <ConnectionLine isActive={status === 'sending'} color="amber" />

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
                      msg.role === 'system' ? 'text-orange-400' : msg.role === 'user' ? 'text-amber-400' : 'text-zinc-500'
                    }`}>
                      {msg.role === 'system' ? 'system: ' : msg.role === 'user' ? 'user: ' : 'assistant: '}
                    </span>
                    <span className="text-zinc-300">{msg.content}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <ConnectionLine isActive={status === 'sending'} color="amber" />

          {/* API Node */}
          <motion.div
            className={`w-[140px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
              status === 'sending' ? 'border-amber-500' : 'border-zinc-800'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
              <span className="text-sm font-bold text-zinc-300">API</span>
            </div>

            <div className="flex flex-col items-center py-4">
              <AnimatePresence mode="wait">
                {status === 'sending' ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                    <motion.div
                      className="w-10 h-10 rounded-lg border border-amber-500 flex items-center justify-center bg-zinc-950"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <span className="text-amber-400 text-lg font-bold">...</span>
                    </motion.div>
                    <span className="mt-2 text-[9px] font-bold text-amber-400">PROCESSING</span>
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

          <ConnectionLine isActive={status === 'complete'} color="green" />

          {/* Response Node */}
          <motion.div
            className={`w-[260px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
              status === 'complete' ? 'border-green-500' : 'border-zinc-800'
            }`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
              <span className="text-sm font-bold text-zinc-300">RESPONSE</span>
              {status === 'complete' && (
                <span className="ml-auto text-[9px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">
                  {selectedPrompt.label}
                </span>
              )}
            </div>

            <div className="h-[300px] bg-black/50 border border-zinc-800 rounded-lg p-3 overflow-y-auto">
              {response ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-200 leading-relaxed whitespace-pre-wrap">
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
