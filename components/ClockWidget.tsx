import React from 'react';

interface ClockWidgetProps {
  currentTime: Date;
  greeting: string;
  onInteraction?: () => void;
  width?: number; 
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ currentTime, greeting, onInteraction, width = 300 }) => {
  // Ajuste fino das proporções:
  // greetingSize agora é width / 22 (era width / 12), reduzindo pela metade visualmente.
  // timeSize escalado por width / 3.8 para caber melhor.
  const timeSize = Math.max(width / 3.8, 32); 
  const greetingSize = Math.max(width / 22, 10); 
  const locationSize = Math.max(width / 30, 9);
  
  return (
    <div 
      className="flex flex-col items-start justify-center h-full w-full cursor-pointer active:scale-95 transition-transform overflow-hidden p-2" 
      onClick={onInteraction}
    >
      <div 
        className="font-light tracking-wide opacity-80 drop-shadow-md uppercase whitespace-nowrap text-yellow-400 leading-none mb-1"
        style={{ fontSize: `${greetingSize}px` }}
      >
         {greeting}
      </div>
      <div 
        className="font-bold tracking-tighter text-white leading-none whitespace-nowrap"
        style={{ fontSize: `${timeSize}px` }}
      >
        {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div 
        className="opacity-50 uppercase tracking-[0.2em] mt-1 ml-0.5"
        style={{ fontSize: `${locationSize}px` }}
      >
        Brasília
      </div>
    </div>
  );
};

export default ClockWidget;