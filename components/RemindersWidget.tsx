import React, { useState } from 'react';
import { Plus, Bell, Activity } from 'lucide-react';
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
    <div className="w-[350px] bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-4 shadow-2xl flex flex-col max-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2 text-yellow-400">
          <Bell size={18} />
          <span className="font-bold tracking-widest text-xs uppercase">Lembretes</span>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)} 
          className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
        >
          <Plus size={16} className="text-white" />
        </button>
      </div>

      {/* Add Input */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-3 animate-fade-in">
          <input 
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Novo lembrete..."
            className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
          />
        </form>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-white/30">
            <Activity size={24} className="mb-2 opacity-50"/>
            <p className="text-xs">Sem lembretes.</p>
          </div>
        ) : (
          reminders.map((r, i) => (
            <ReminderItem 
              key={`${r.id}-${i}`} 
              reminder={r} 
              onDelete={onDelete} 
            />
          ))
        )}
      </div>
    </div>
  );
};

export default RemindersWidget;