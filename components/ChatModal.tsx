import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';
import { getChatResponse } from '../services/gemini';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Olá! Sou seu assistente doméstico inteligente. Como posso ajudar?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    const responseText = await getChatResponse(userText);
    
    setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="bg-zinc-900/90 border border-white/10 rounded-3xl w-full max-w-2xl flex flex-col h-[600px] relative shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-purple-900/20">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Assistente AI</h2>
              <p className="text-xs text-white/50">Smart Home Chat</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 p-6 overflow-y-auto hide-scrollbar flex flex-col gap-4">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-white/10' : 'bg-blue-600/20'}`}>
                {msg.role === 'user' ? <User size={14} className="text-white"/> : <Bot size={14} className="text-blue-400"/>}
              </div>
              <div 
                className={`p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-white text-black rounded-tr-sm' 
                    : 'bg-white/5 text-white border border-white/5 rounded-tl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 mr-auto max-w-[85%] animate-pulse">
               <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-blue-400"/>
               </div>
               <div className="p-3 rounded-2xl bg-white/5 border border-white/5 rounded-tl-sm flex items-center gap-2">
                  <Sparkles size={14} className="animate-spin text-blue-400"/>
                  <span className="text-xs text-white/50">Digitando...</span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex gap-2 relative">
            <input 
              className="flex-1 bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-4 text-base text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Pergunte algo ao painel..." 
            />
            <button 
              type="submit"
              className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group" 
              disabled={isLoading || !input.trim()}
            >
              <Send size={18} className="text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;