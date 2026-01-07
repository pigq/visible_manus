export type Step = 'api' | 'context' | 'prompt' | 'tools' | 'reason' | 'multi' | 'live';

interface BuildGuideProps {
  currentStep: Step;
  onSelectStep: (step: Step) => void;
}

const steps = [
  { id: 'api' as Step, label: 'API Integration' },
  { id: 'context' as Step, label: 'Context Memory' },
  { id: 'prompt' as Step, label: 'System Prompt' },
  { id: 'tools' as Step, label: 'Tool / MCP' },
  { id: 'reason' as Step, label: 'Reason & Act' },
  { id: 'multi' as Step, label: 'Multi Agent' },
];

export function BuildGuide({ currentStep, onSelectStep }: BuildGuideProps) {
  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 font-sans">
      <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
        <img
          src="./logo.png?v=2"
          alt="Visible Manus"
          className="w-12 h-12"
          style={{ filter: 'brightness(0) saturate(100%) invert(83%) sepia(36%) saturate(1500%) hue-rotate(358deg) brightness(103%) contrast(101%)' }}
        />
        <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          Visible Manus
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {steps.map((item) => {
          const isActive = currentStep === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectStep(item.id)}
              className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
        <button
          onClick={() => onSelectStep('live')}
          className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-colors ${
            currentStep === 'live'
              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`}
        >
          Live Demo
        </button>
      </nav>
    </div>
  );
}
