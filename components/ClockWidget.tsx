import React from 'react';

interface ClockWidgetProps {
  currentTime: Date;
  greeting: string;
  onInteraction?: () => void;
}

const ClockWidget: React.FC<ClockWidgetProps> = ({ currentTime, greeting, onInteraction }) => (
  <div className="flex flex-col items-start cursor-pointer active:scale-95 transition-transform" onClick={onInteraction}>
    <div className="text-3xl font-light tracking-wide opacity-90 drop-shadow-md flex items-center gap-2 uppercase">
       {greeting}
    </div>
    <div className="text-[6rem] md:text-[8rem] font-medium tracking-tighter opacity-90 leading-none mt-2">
      {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </div>
    <div className="text-sm opacity-60 uppercase tracking-widest mt-1 ml-1">Brasília</div>
  </div>
);

export default ClockWidget;