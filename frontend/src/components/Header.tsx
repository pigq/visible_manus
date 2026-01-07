import { Cpu, Play } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface HeaderProps {
  isConnected: boolean;
  onConnect: () => void;
  onSendTest: (text: string) => void;
}

export function Header({ isConnected, onConnect, onSendTest }: HeaderProps) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendTest(inputText.trim());
      setInputText('');
    }
  };

  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      {/* Logo - matching ai-dev-journal sidebar header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg" style={{ backgroundColor: '#FACA15' }}>
          <Cpu size={20} className="text-zinc-900" />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#FACA15' }}>
            Visible Manus
          </h1>
          <p className="text-xs text-zinc-500">Multi-Agent Orchestrator</p>
        </div>
      </div>

      {/* Input form - matching ai-dev-journal button style */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3 flex-1 max-w-xl mx-8">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter a request..."
            className="w-full bg-black/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`
            flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all
            ${inputText.trim()
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
          `}
        >
          <Play size={12} />
          Run
        </button>
      </form>

      {/* Connection status */}
      <motion.button
        onClick={onConnect}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all
          ${isConnected
            ? 'bg-zinc-800 text-green-400 border border-zinc-700'
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200 hover:border-zinc-600'}
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-zinc-600'}`} />
        {isConnected ? 'Connected' : 'Offline'}
      </motion.button>
    </header>
  );
}
