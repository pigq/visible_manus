import { useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareText, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageLog } from './MessageLog';
import { SessionHistory } from './SessionHistory';

type TabType = 'log' | 'history';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('log');

  return (
    <motion.div
      className="h-full bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0"
      initial={false}
      animate={{ width: isCollapsed ? 48 : 320 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header with toggle - matching ai-dev-journal sidebar style */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        {!isCollapsed && (
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('log')}
              className={`
                flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-all duration-200
                ${activeTab === 'log'
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-lg'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}
              `}
            >
              <div className={`p-1.5 rounded-md ${activeTab === 'log' ? 'bg-zinc-900 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>
                <MessageSquareText size={14} />
              </div>
              Log
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`
                flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-all duration-200
                ${activeTab === 'history'
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-lg'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}
              `}
            >
              <div className={`p-1.5 rounded-md ${activeTab === 'history' ? 'bg-zinc-900 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>
                <History size={14} />
              </div>
              History
            </button>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
        >
          {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-hidden"
          >
            {activeTab === 'log' ? <MessageLog /> : <SessionHistory />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed icons */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-2 p-2">
          <button
            onClick={() => {
              setIsCollapsed(false);
              setActiveTab('log');
            }}
            className={`
              p-2 rounded-lg transition-colors
              ${activeTab === 'log' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
            `}
            title="Live Log"
          >
            <MessageSquareText size={18} />
          </button>
          <button
            onClick={() => {
              setIsCollapsed(false);
              setActiveTab('history');
            }}
            className={`
              p-2 rounded-lg transition-colors
              ${activeTab === 'history' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
            `}
            title="Session History"
          >
            <History size={18} />
          </button>
        </div>
      )}

      {/* Footer - matching ai-dev-journal */}
      {!isCollapsed && (
        <div className="p-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-600 font-mono">
            v1.0.0.manus_system
          </div>
        </div>
      )}
    </motion.div>
  );
}
