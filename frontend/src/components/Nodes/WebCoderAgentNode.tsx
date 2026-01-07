import { Code, FileCode, FileText, FolderOpen, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/StoreContext';
import type { ToolCall } from '../../types';

const toolIcons: Record<string, React.ReactNode> = {
  write_file: <FileCode size={14} />,
  read_file: <FileText size={14} />,
  list_files: <FolderOpen size={14} />,
};

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const icon = toolIcons[toolCall.tool] || <Code size={14} />;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`flex items-center gap-2 text-xs p-2 rounded border ${toolCall.status === 'calling' ? 'border-orange-500/30 bg-orange-500/5' : 'border-zinc-800'}`}
    >
      <span className="text-orange-400">{icon}</span>
      <span className="font-mono text-zinc-400 flex-1 truncate">{toolCall.args}</span>
      {toolCall.status === 'calling' && <Loader2 size={12} className="text-orange-400 animate-spin" />}
      {toolCall.status === 'complete' && <CheckCircle2 size={12} className="text-green-400" />}
      {toolCall.status === 'error' && <XCircle size={12} className="text-red-400" />}
    </motion.div>
  );
}

export function WebCoderAgentNode() {
  const { webCoderAgent } = useStore();
  const { status, toolCalls } = webCoderAgent;
  const isActive = status === 'active' || status === 'working';
  const recentToolCalls = toolCalls.slice(-6);

  return (
    <div className={`w-80 h-[300px] p-5 rounded-2xl border bg-zinc-900 flex flex-col shadow-xl transition-all duration-500 ${isActive ? 'border-orange-500 shadow-orange-500/20' : status === 'complete' ? 'border-green-500 shadow-green-500/20' : 'border-zinc-800'}`}>
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
        <Code size={18} className="text-zinc-400" />
        <span className="text-sm font-bold text-zinc-300">WEBCODER AGENT</span>
        {isActive && (
          <motion.div
            className="ml-auto w-2 h-2 rounded-full bg-orange-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>

      {/* Tool calls */}
      <div className="flex-1 bg-black/50 p-3 rounded border border-zinc-800 overflow-y-auto space-y-2">
        <AnimatePresence mode="popLayout">
          {recentToolCalls.length === 0 ? (
            <span className="text-xs text-zinc-600 italic">Waiting for task...</span>
          ) : (
            recentToolCalls.map((tc) => <ToolCallItem key={tc.id} toolCall={tc} />)
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
