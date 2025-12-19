import React, { useState } from 'react';
import { Plus, Bell, Activity, X } from 'lucide-react';
import ReminderItem from './ReminderItem';
import { Reminder } from '../types';

interface RemindersWidgetProps {
  reminders: Reminder[];
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
}

const RemindersWidget: React.FC<RemindersWidgetProps> = ({ reminders, onAdd, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd(text);
      setText('');
      setIsAdding(false);
    }
  };

  return (
    <div className="w-full h-full bg-black/50 backdrop-blur-2xl border-2 border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 text-yellow-400">
          <Bell size={24} />
          <span className="font-bold tracking-[0.3em] text-sm uppercase">Lembretes</span>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)} 
          className={`p-2 rounded-full transition-all ${isAdding ? 'bg-red-500 text-white rotate-45' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {/* Add Input */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-6 animate-fade-in shrink-0">
          <input 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="O que lembrar?"
            className="w-full bg-black/60 border-2 border-yellow-500/50 rounded-2xl px-5 py-4 text-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-500 shadow-xl"
          />
        </form>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-4 pr-2">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20">
            <Activity size={48} className="mb-4 opacity-10 animate-pulse"/>
            <p className="text-lg font-light italic">Nenhum compromisso.</p>
          </div>
        ) : (
          reminders.map((r, i) => (
            <div key={`${r.id}-${i}`} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <ReminderItem 
                  reminder={r} 
                  onDelete={onDelete} 
                />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RemindersWidget;