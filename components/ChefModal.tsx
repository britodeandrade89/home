import React, { useState } from 'react';
import { X, ChefHat, Sparkles } from 'lucide-react';
import { getChefSuggestion } from '../services/gemini';

interface ChefModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChefModal: React.FC<ChefModalProps> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsLoading(true);
    const result = await getChefSuggestion(input);
    setResponse(result);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="bg-zinc-900/90 border border-white/10 rounded-3xl w-full max-w-2xl flex flex-col h-[600px] relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={24} className="text-white" />
        </button>
        <div className="p-6 border-b border-white/10 flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl">
            <ChefHat size={32} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Chef IA</h2>
            <p className="text-white/50">O que vamos cozinhar hoje?</p>
          </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto hide-scrollbar text-white">
          {isLoading ? (
            <div className="text-center mt-20">
              <Sparkles className="animate-spin mx-auto mb-2 text-yellow-400" size={32}/>
              <p>Criando receita...</p>
            </div>
          ) : response ? (
            <p className="whitespace-pre-wrap text-lg font-light leading-relaxed">{response}</p>
          ) : (
            <div className="text-center mt-20 text-white/30">
              <ChefHat size={60} className="mx-auto mb-4 opacity-20"/>
              <p>Diga os ingredientes que você tem!</p>
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-6 border-t border-white/10 flex gap-2">
          <input 
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 text-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50" 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            placeholder="Ex: Ovos, queijo e tomate..." 
          />
          <button 
            type="submit"
            className="bg-yellow-500 text-black px-6 py-4 rounded-xl font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50" 
            disabled={isLoading}
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChefModal;