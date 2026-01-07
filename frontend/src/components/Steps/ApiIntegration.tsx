import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const mockResponses = [
  "Hello! I'm Claude, an AI assistant made by Anthropic. I'm here to help you with any questions or tasks you might have. How can I assist you today?",
  "That's an interesting question! Let me think about this carefully and provide you with a helpful response.",
  "I'd be happy to help you with that. Based on your request, here's what I can tell you...",
];

// Connection line component matching multi-agent style
function ConnectionLine({ isActive, color }: { isActive: boolean; color: 'amber' | 'green' }) {
  const strokeColor = color === 'amber' ? '#f59e0b' : '#4ade80';

  return (
    <svg width="80" height="60" className="shrink-0">
      {isActive && (
        <motion.path
          d="M 0 30 C 40 30, 40 30, 80 30"
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
        d="M 0 30 C 40 30, 40 30, 80 30"
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

export function ApiIntegration() {
  const [input, setInput] = useState('Hello, can you help me understand how AI works?');
  const [status, setStatus] = useState<'idle' | 'sending' | 'complete'>('idle');
  const [response, setResponse] = useState('');

  const handleSubmit = () => {
    if (!input.trim() || status === 'sending') return;

    setStatus('sending');
    setResponse('');

    setTimeout(() => {
      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      setResponse(randomResponse);
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

      <div className="relative z-10 flex flex-col items-center gap-8 pt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-zinc-200 mb-2">API Integration</h2>
          <p className="text-sm text-zinc-500 max-w-md">
            The simplest form of AI interaction. Send a message to the LLM API and receive a response.
          </p>
        </div>

        <div className="flex items-center">
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
              placeholder="Type your message here..."
              disabled={status === 'sending'}
              className="w-full h-24 bg-black/50 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
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

          <ConnectionLine isActive={status === 'sending'} color="amber" />

          {/* API Node */}
          <motion.div
            className={`w-[140px] rounded-2xl border bg-zinc-900 p-4 shadow-xl transition-all duration-500 ${
              status === 'sending' ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-800'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
              <span className="text-sm font-bold text-zinc-300">API</span>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              <AnimatePresence mode="wait">
                {status === 'sending' ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
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
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center"
                  >
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

            <div className="h-[120px] bg-black/50 border border-zinc-800 rounded-lg p-3 overflow-y-auto">
              {response ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-green-200 leading-relaxed"
                >
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
