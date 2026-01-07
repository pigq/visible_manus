import { useState } from 'react';
import { User, Play } from 'lucide-react';
import { useStore } from '../../stores/StoreContext';

interface InputNodeProps {
  onSendRequest: (text: string) => void;
}

export function InputNode({ onSendRequest }: InputNodeProps) {
  const { inputStatus, inputText } = useStore();
  const [localInput, setLocalInput] = useState('');

  const canSend = inputStatus === 'idle' || inputStatus === 'complete';
  const isActive = inputStatus === 'active' || inputStatus === 'working';

  const handleSubmit = () => {
    if (localInput.trim() && canSend) {
      onSendRequest(localInput.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Show inputText if processing, otherwise show editable input
  const showingResult = inputText && !canSend;

  return (
    <div className={`w-64 p-5 rounded-2xl border bg-zinc-900 flex flex-col gap-4 shadow-xl transition-all duration-500 ${isActive ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-800'}`}>
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <User size={18} className="text-zinc-400" />
        <span className="text-sm font-bold text-zinc-300">INPUT</span>
      </div>
      <div className="bg-black/50 p-3 rounded border border-zinc-800 font-mono text-xs text-amber-100 truncate">
        {showingResult ? (
          inputText
        ) : (
          <input
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hello world"
            className="w-full bg-transparent outline-none placeholder-zinc-600"
          />
        )}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!canSend || !localInput.trim()}
        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${
          (canSend && localInput.trim()) || inputStatus === 'complete'
            ? 'bg-amber-600 hover:bg-amber-500 text-white'
            : 'bg-zinc-800 text-zinc-600'
        }`}
      >
        <Play size={12} /> {inputStatus === 'complete' ? 'Re-run' : 'Send Request'}
      </button>
    </div>
  );
}
