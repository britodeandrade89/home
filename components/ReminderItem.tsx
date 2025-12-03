import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { Reminder } from '../types';

interface ReminderItemProps {
  reminder: Reminder;
  onDelete: (id: string) => void;
}

const ReminderItem: React.FC<ReminderItemProps> = ({ reminder, onDelete }) => {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    isDragging.current = true;
    startX.current = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) return;
    const currentX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const diff = currentX - startX.current;
    
    // Only allow dragging left (negative x)
    if (diff < 0) {
      setOffsetX(Math.max(diff, -150)); // Max swipe limit
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (offsetX < -100) {
      // Trigger delete if swiped far enough
      onDelete(reminder.id);
    } else {
      // Snap back
      setOffsetX(0);
    }
  };

  return (
    <div className="relative overflow-hidden mb-3 select-none">
      {/* Background Layer (Delete Icon) */}
      <div className="absolute inset-y-0 right-0 w-full bg-red-600 rounded-xl flex items-center justify-end px-6">
        <Trash2 className="text-white animate-pulse" size={24} />
      </div>

      {/* Foreground Layer (Content) */}
      <div 
        className={`relative p-4 rounded-xl border backdrop-blur-sm transition-transform duration-200 cursor-grab active:cursor-grabbing ${
          reminder.type === 'alert' ? 'bg-black/60 border-red-500/30' : 
          reminder.type === 'action' ? 'bg-black/60 border-blue-500/30' : 
          'bg-black/40 border-white/10'
        }`}
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        <div className="flex justify-between text-[10px] opacity-70 mb-2 font-bold uppercase tracking-wider">
           <span className={reminder.type === 'alert' ? 'text-red-300' : reminder.type === 'action' ? 'text-blue-300' : 'text-gray-300'}>
                {reminder.type === 'alert' ? 'Urgente' : reminder.type === 'action' ? 'Tarefa' : 'Info'}
           </span>
           <span>{reminder.time}</span>
        </div>
        <p className="text-base font-light leading-snug text-white">{reminder.text}</p>
      </div>
    </div>
  );
};

export default ReminderItem;