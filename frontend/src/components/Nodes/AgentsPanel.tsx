import { CheckCircle2, Search, Code, Globe, MousePointer2, Keyboard, ArrowUpDown, Camera, FileText, FileEdit, FileSearch, FolderOpen, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, type TargetAndTransition } from 'framer-motion';
import { useStore } from '../../stores/StoreContext';

// Tool animation configurations
const toolAnimations: Record<string, {
  icon: React.ElementType;
  label: string;
  animation: TargetAndTransition;
  color: string;
}> = {
  navigate: {
    icon: Globe,
    label: 'NAVIGATING',
    animation: { rotate: [0, 360], transition: { duration: 2, repeat: Infinity, ease: 'linear' } },
    color: '#f59e0b'
  },
  click: {
    icon: MousePointer2,
    label: 'CLICKING',
    animation: { scale: [1, 0.8, 1], y: [0, 2, 0], transition: { duration: 0.3, repeat: Infinity, repeatDelay: 0.5 } },
    color: '#f59e0b'
  },
  type: {
    icon: Keyboard,
    label: 'TYPING',
    animation: { y: [0, -2, 0], transition: { duration: 0.15, repeat: Infinity } },
    color: '#f59e0b'
  },
  scroll: {
    icon: ArrowUpDown,
    label: 'SCROLLING',
    animation: { y: [0, -4, 0, 4, 0], transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } },
    color: '#f59e0b'
  },
  screenshot: {
    icon: Camera,
    label: 'CAPTURING',
    animation: { scale: [1, 1.1, 1], opacity: [1, 0.5, 1], transition: { duration: 0.5, repeat: Infinity, repeatDelay: 1 } },
    color: '#f59e0b'
  },
  extract_text: {
    icon: FileText,
    label: 'EXTRACTING',
    animation: { x: [0, 2, 0, -2, 0], transition: { duration: 0.4, repeat: Infinity } },
    color: '#f59e0b'
  },
  write_file: {
    icon: FileEdit,
    label: 'WRITING',
    animation: { rotate: [0, -5, 5, 0], transition: { duration: 0.5, repeat: Infinity } },
    color: '#f59e0b'
  },
  read_file: {
    icon: FileSearch,
    label: 'READING',
    animation: { scale: [1, 1.05, 1], transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' } },
    color: '#f59e0b'
  },
  list_files: {
    icon: FolderOpen,
    label: 'LISTING',
    animation: { rotateY: [0, 15, 0, -15, 0], transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } },
    color: '#f59e0b'
  },
};

function ToolAnimation({ toolName, toolArgs }: { toolName: string; toolArgs?: string }) {
  const extractToolType = (tool: string, args?: string): string => {
    if (args) {
      const actionMatch = args.match(/action=(\w+)/i);
      if (actionMatch) return actionMatch[1].toLowerCase();
    }
    const lowerTool = tool.toLowerCase();
    for (const key of Object.keys(toolAnimations)) {
      if (lowerTool.includes(key)) return key;
    }
    if (args) {
      const lowerArgs = args.toLowerCase();
      for (const key of Object.keys(toolAnimations)) {
        if (lowerArgs.includes(key)) return key;
      }
    }
    return 'navigate';
  };

  const toolType = extractToolType(toolName, toolArgs);
  const config = toolAnimations[toolType] || toolAnimations.navigate;
  const Icon = config.icon;

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-4"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <div className="relative">
        <motion.div
          className="absolute rounded-full"
          style={{ width: 64, height: 64, left: -8, top: -8, backgroundColor: config.color + '20' }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <motion.div
          className="w-12 h-12 rounded-lg border flex items-center justify-center bg-zinc-950"
          style={{ borderColor: config.color, color: config.color }}
          animate={config.animation}
        >
          <Icon size={24} />
        </motion.div>
      </div>
      <motion.span
        className="mt-3 text-[10px] font-bold"
        style={{ color: config.color }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {config.label}
      </motion.span>
    </motion.div>
  );
}

function AgentCard({
  name,
  icon: Icon,
  status,
  currentTool,
  agentColor,
}: {
  name: string;
  icon: React.ElementType;
  status: string;
  currentTool?: { tool: string; args?: string } | null;
  agentColor: string;
}) {
  const isActive = status === 'active' || status === 'working';
  const isComplete = status === 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-3 transition-all duration-300 bg-zinc-950 ${
        isActive ? 'shadow-lg' : isComplete ? 'border-green-500/50' : 'border-zinc-800'
      }`}
      style={{
        borderColor: isActive ? agentColor : isComplete ? '#22c55e' : undefined,
        boxShadow: isActive ? `0 0 20px ${agentColor}30` : 'none',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-zinc-900" style={{ color: isActive ? agentColor : '#71717a' }}>
          <Icon size={14} />
        </div>
        <span className="text-xs font-bold" style={{ color: isActive ? agentColor : '#a1a1aa' }}>
          {name}
        </span>
        {isActive && (
          <motion.div
            className="ml-auto w-2 h-2 rounded-full"
            style={{ backgroundColor: agentColor }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
        {isComplete && <CheckCircle2 size={12} className="ml-auto text-green-400" />}
      </div>

      <AnimatePresence mode="wait">
        {isActive && currentTool ? (
          <ToolAnimation key={currentTool.tool + (currentTool.args || '')} toolName={currentTool.tool} toolArgs={currentTool.args} />
        ) : isActive ? (
          <motion.div key="thinking" className="flex flex-col items-center justify-center py-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="w-12 h-12 rounded-lg border flex items-center justify-center bg-zinc-950"
              style={{ borderColor: agentColor }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 size={24} style={{ color: agentColor }} />
            </motion.div>
            <span className="mt-3 text-[10px] font-bold" style={{ color: agentColor }}>PROCESSING</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isActive && !isComplete && (
        <div className="py-4 text-center">
          <div className="text-[10px] text-zinc-600 italic">STANDBY</div>
        </div>
      )}

      {isComplete && (
        <motion.div className="flex flex-col items-center justify-center py-4" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="w-12 h-12 rounded-lg border border-green-500 flex items-center justify-center bg-green-500/20">
            <CheckCircle2 size={24} className="text-green-400" />
          </div>
          <span className="mt-3 text-[10px] font-bold text-green-400">COMPLETE</span>
        </motion.div>
      )}
    </motion.div>
  );
}

export function AgentsPanel() {
  const { researchAgent, webCoderAgent, tasks } = useStore();

  const hasActiveAgents = researchAgent.status === 'working' || webCoderAgent.status === 'working' || researchAgent.status === 'active' || webCoderAgent.status === 'active';
  const hasResearchTasks = tasks.some((t) => t.agent === 'ResearchAgent');
  const hasWebCoderTasks = tasks.some((t) => t.agent === 'WebCoderAgent');
  const showResearch = hasResearchTasks || researchAgent.status !== 'idle';
  const showWebCoder = hasWebCoderTasks || webCoderAgent.status !== 'idle';

  const getCurrentTool = (toolCalls: { tool: string; args?: string; status: string }[]): { tool: string; args?: string } | null => {
    const callingTool = toolCalls.find(tc => tc.status === 'calling');
    if (callingTool) return { tool: callingTool.tool, args: callingTool.args };
    if (toolCalls.length > 0) {
      const last = toolCalls[toolCalls.length - 1];
      return { tool: last.tool, args: last.args };
    }
    return null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`w-[320px] h-[520px] rounded-2xl border bg-zinc-900 flex flex-col shadow-xl transition-all duration-500 ${
        hasActiveAgents ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-800'
      }`}
      onWheel={handleWheel}
    >
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-sm font-bold text-zinc-300">AGENTS</span>
        {hasActiveAgents && (
          <span className="text-[9px] font-bold text-amber-400 animate-pulse">ACTIVE</span>
        )}
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto" data-scrollable>
        <AnimatePresence mode="popLayout">
          {!showResearch && !showWebCoder ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-zinc-500 italic">No agents assigned</p>
            </div>
          ) : (
            <>
              {showResearch && (
                <AgentCard
                  key="research"
                  name="RESEARCH"
                  icon={Search}
                  status={researchAgent.status}
                  currentTool={getCurrentTool(researchAgent.toolCalls)}
                  agentColor="#f59e0b"
                />
              )}
              {showWebCoder && (
                <AgentCard
                  key="webcoder"
                  name="WEBCODER"
                  icon={Code}
                  status={webCoderAgent.status}
                  currentTool={getCurrentTool(webCoderAgent.toolCalls)}
                  agentColor="#f97316"
                />
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
