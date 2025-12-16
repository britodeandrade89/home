import React from 'react';

interface ClockWidgetProps {
  currentTime: Date;
  greeting: string;
  onInteraction?: () => void;
  width?: number; // Prop para responsividade
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ currentTime, greeting, onInteraction, width = 300 }) => {
  // Cálculos dinâmicos baseados na largura do widget
  const timeSize = Math.max(width / 3.5, 40); // Mínimo 40px
  const greetingSize = Math.max(width / 12, 14); // Mínimo 14px
  
  return (
    <div 
      className="flex flex-col items-start cursor-pointer active:scale-95 transition-transform w-full h-full overflow-hidden" 
      onClick={onInteraction}
    >
      <div 
        className="font-light tracking-wide opacity-90 drop-shadow-md flex items-center gap-2 uppercase whitespace-nowrap"
        style={{ fontSize: `${greetingSize}px` }}
      >
         {greeting}
      </div>
      <div 
        className="font-medium tracking-tighter opacity-90 leading-none mt-1 whitespace-nowrap"
        style={{ fontSize: `${timeSize}px` }}
      >
        {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-sm opacity-60 uppercase tracking-widest mt-1 ml-1">Brasília</div>
    </div>
  );
};

export default ClockWidget;