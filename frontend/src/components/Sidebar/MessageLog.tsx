import { Clock, MessageSquare, Brain, Search, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSystemStore } from '../../stores/systemStore';
import type { Message } from '../../types';
import { useEffect, useRef } from 'react';

const messageIcons: Record<Message['type'], React.ReactNode> = {
  user_input: <MessageSquare size={12} className="text-amber-400" />,
  planner: <Brain size={12} className="text-amber-400" />,
  agent: <Search size={12} className="text-orange-400" />,
  tool: <Wrench size={12} className="text-orange-400" />,
  tool_result: <Wrench size={12} className="text-cyan-400" />,
  output: <CheckCircle size={12} className="text-green-400" />,
  error: <AlertCircle size={12} className="text-red-400" />,
};

const messageColors: Record<Message['type'], string> = {
  user_input: 'border-l-amber-500',
  planner: 'border-l-amber-500',
  agent: 'border-l-orange-500',
  tool: 'border-l-orange-500',
  tool_result: 'border-l-cyan-500',
  output: 'border-l-green-500',
  error: 'border-l-red-500',
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function MessageItem({ message }: { message: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`
        border-l-2 ${messageColors[message.type]}
        bg-zinc-800/50 rounded-r-lg p-2 mb-2
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        {messageIcons[message.type]}
        <span className="text-xs text-zinc-500">
          {formatTime(message.timestamp)}
        </span>
        {message.agent && (
          <span className="text-xs text-zinc-400 bg-zinc-700/50 px-1.5 py-0.5 rounded">
            {message.agent}
          </span>
        )}
        {message.tool && (
          <span className="text-xs text-orange-400 font-mono">
            {message.tool}
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
        {message.content.length > 200
          ? `${message.content.slice(0, 200)}...`
          : message.content}
      </p>
    </motion.div>
  );
}

export function MessageLog() {
  const { messages } = useSystemStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Clock size={16} className="text-zinc-400" />
        <span className="text-sm font-semibold text-zinc-200">Live Log</span>
        <span className="ml-auto text-xs text-zinc-500">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3 space-y-1"
      >
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-8">
              No messages yet. Start a session to see live updates.
            </div>
          ) : (
            messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
