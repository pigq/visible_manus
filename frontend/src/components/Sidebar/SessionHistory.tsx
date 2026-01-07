import { History, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSystemStore } from '../../stores/systemStore';
import type { Session } from '../../types';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDuration(start: number, end?: number): string {
  const duration = (end || Date.now()) - start;
  const seconds = Math.floor(duration / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function SessionItem({ session, isActive }: { session: Session; isActive: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        p-3 rounded-lg mb-2 cursor-pointer transition-colors
        ${isActive ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-zinc-800/50 hover:bg-zinc-800'}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        {session.status === 'running' && (
          <Loader2 size={12} className="text-amber-400 animate-spin" />
        )}
        {session.status === 'complete' && (
          <CheckCircle size={12} className="text-green-400" />
        )}
        {session.status === 'error' && (
          <XCircle size={12} className="text-red-400" />
        )}
        <span className="text-xs text-zinc-500">
          {formatDate(session.startTime)}
        </span>
        <span className="text-xs text-zinc-600 ml-auto">
          {formatDuration(session.startTime, session.endTime)}
        </span>
      </div>
      <p className="text-sm text-zinc-300 truncate">
        {session.userInput}
      </p>
      {session.finalOutput && (
        <p className="text-xs text-zinc-500 mt-1 truncate">
          {session.finalOutput}
        </p>
      )}
    </motion.div>
  );
}

export function SessionHistory() {
  const { sessions, currentSession } = useSystemStore();

  // Sort sessions by start time, newest first
  const sortedSessions = [...sessions].sort((a, b) => b.startTime - a.startTime);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <History size={16} className="text-zinc-400" />
        <span className="text-sm font-semibold text-zinc-200">History</span>
        <span className="ml-auto text-xs text-zinc-500">
          {sessions.length} sessions
        </span>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="popLayout">
          {sortedSessions.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-8">
              No previous sessions.
            </div>
          ) : (
            sortedSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={currentSession?.id === session.id}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
