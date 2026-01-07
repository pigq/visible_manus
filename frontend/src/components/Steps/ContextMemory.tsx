import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Step 2: Context Memory - Add conversation history
// Shows: User Input → Context → API Call → Response

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const sampleInputs = [
  'Can you tell me more about that?',
  'How does that relate to what you said earlier?',
  'Can you give me an example?',
  'What are the implications of this?',
];

const mockResponses = [
  "I understand! Based on what you've told me, I can help you further with this topic.",
  "That's a great follow-up question. Building on our previous discussion...",
  "I remember you mentioned that earlier. Let me connect those ideas...",
];

// Connection line component matching multi-agent style
function ConnectionLine({ isActive, color }: { isActive: boolean; color: 'amber' | 'green' }) {
  const strokeColor = color === 'amber' ? '#f59e0b' : '#4ade80';

  return (
    <svg width="60" height="60" className="shrink-0">
      {isActive && (
        <motion.path
          d="M 0 30 C 30 30, 30 30, 60 30"
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
        d="M 0 30 C 30 30, 30 30, 60 30"
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

export function ContextMemory() {
  const [input, setInput] = useState('Can you tell me more about that?');
  const [status, setStatus] = useState<'idle' | 'sending' | 'complete'>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [inputIndex, setInputIndex] = useState(0);

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

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setStatus('sending');
    setCurrentResponse('');

    // Simulate API call with context
    setTimeout(() => {
      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: randomResponse,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentResponse(randomResponse);
      setStatus('complete');
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative z-10 flex flex-col items-center gap-6 pt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-zinc-200 mb-2">Context Memory</h2>
          <p className="text-sm text-zinc-500 max-w-md">
            Add memory to remember previous messages. Now Claude can reference earlier parts of the conversation.
          </p>
        </div>

        <div className="flex items-start gap-6">
          {/* Input Node */}
          <motion.div
            className={`w-[260px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
              status === 'sending' ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-800'
            }`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
              <span className="text-sm font-bold text-zinc-300">USER INPUT</span>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Continue the conversation..."
              disabled={status === 'sending'}
              className="w-full h-24 bg-black/50 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
            />

            <button
              onClick={handleSubmit}
              disabled={!input.trim() || status === 'sending'}
              className={`w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                input.trim() && status !== 'sending'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-zinc-800 text-zinc-600'
              }`}
            >
              Send
            </button>
          </motion.div>

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
                <p className="text-xs text-zinc-500 italic text-center py-4">No history yet</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="text-[11px] py-1">
                    <span className={`font-medium ${msg.role === 'user' ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {msg.role === 'user' ? 'user: ' : 'assistant: '}
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
              status === 'sending' ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-800'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
              <span className="text-sm font-bold text-zinc-300">API</span>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
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

          {/* Output Node */}
          <motion.div
            className={`w-[260px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
              status === 'complete' ? 'border-green-500 shadow-green-500/20' : 'border-zinc-800'
            }`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
              <span className="text-sm font-bold text-zinc-300">RESPONSE</span>
            </div>

            <div className="h-[300px] bg-black/50 border border-zinc-800 rounded-lg p-3 overflow-y-auto">
              {currentResponse ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-200 leading-relaxed">
                  {currentResponse}
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
