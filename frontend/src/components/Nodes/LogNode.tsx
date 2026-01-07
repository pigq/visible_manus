import { Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/StoreContext';
import { useRef } from 'react';

export function LogNode() {
  const { messages } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show more messages since we have more space
  const recentMessages = messages.slice(-30);

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'user_input':
        return 'text-amber-400';
      case 'planner':
        return 'text-amber-400';
      case 'agent':
        return 'text-orange-400';
      case 'tool':
        return 'text-orange-400';
      case 'output':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-zinc-400';
    }
  };

  const getMessagePrefix = (type: string, agent?: string) => {
    switch (type) {
      case 'user_input':
        return '>';
      case 'planner':
        return '[Planner]';
      case 'agent':
        return `[${agent || 'Agent'}]`;
      case 'tool':
        return `  └─`;
      case 'output':
        return '✓';
      case 'error':
        return '✗';
      default:
        return '•';
    }
  };

  // Prevent wheel event from bubbling to canvas (which causes zoom)
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="w-[420px] p-5 rounded-2xl border bg-zinc-900 flex flex-col shadow-xl transition-all duration-500 border-zinc-800"
      onWheel={handleWheel}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
        <Layers size={18} className="text-zinc-400" />
        <span className="text-sm font-bold text-zinc-300">CONTEXT</span>
        <span className="ml-auto text-xs text-zinc-600">{messages.length} messages</span>
      </div>

      <div
        ref={scrollRef}
        className="h-[400px] bg-black/50 p-4 rounded border border-zinc-800 overflow-y-auto font-mono text-xs space-y-1.5"
      >
        <AnimatePresence mode="popLayout">
          {recentMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-zinc-600 italic">No context yet...</span>
            </div>
          ) : (
            recentMessages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.01 }}
                className={`${getMessageColor(msg.type)} leading-relaxed`}
              >
                <span className="text-zinc-600">{getMessagePrefix(msg.type, msg.agent)}</span>{' '}
                <span>{msg.content}</span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
