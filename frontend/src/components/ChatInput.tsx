import { useState } from 'react';
import { Send } from 'lucide-react';
import { useStore } from '../stores/StoreContext';

interface ChatInputProps {
  onSendRequest: (text: string) => void;
  defaultValue?: string;
  suggestions?: string[];
}

export function ChatInput({ onSendRequest, defaultValue = '', suggestions = [] }: ChatInputProps) {
  const { inputStatus } = useStore();
  const [input, setInput] = useState(defaultValue);

  const canSend = inputStatus === 'idle' || inputStatus === 'complete';
  const isProcessing = inputStatus === 'active' || inputStatus === 'working';
  const showSuggestions = suggestions.length > 0 && !input.trim() && canSend;

  const handleSubmit = () => {
    if (input.trim() && canSend) {
      onSendRequest(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4 font-sans">
      {showSuggestions && (
        <div className="flex flex-wrap gap-2 mb-3 justify-center">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-800/80 border border-zinc-700 rounded-full hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isProcessing ? "Processing..." : "Enter your request..."}
          disabled={isProcessing}
          className="flex-1 bg-transparent text-zinc-200 placeholder-zinc-500 outline-none text-sm px-2"
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend || !input.trim()}
          className={`p-2.5 rounded-lg transition-colors ${
            canSend && input.trim()
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              : 'bg-zinc-800 text-zinc-600'
          }`}
        >
          <Send size={18} />
        </button>
      </div>
      {isProcessing && (
        <div className="text-center mt-2">
          <span className="text-xs text-amber-400 font-medium animate-pulse">Processing request...</span>
        </div>
      )}
    </div>
  );
}
