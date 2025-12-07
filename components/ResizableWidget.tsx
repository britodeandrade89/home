import React, { useState, useRef, useEffect } from 'react';
import { MoveDiagonal } from 'lucide-react';

interface ResizableWidgetProps {
  children: React.ReactNode;
  scale: number;
  onScaleChange: (scale: number) => void;
  position: { x: number; y: number };
  onPositionChange: (x: number, y: number) => void;
  className?: string;
  locked?: boolean;
}

const ResizableWidget: React.FC<ResizableWidgetProps> = ({ 
  children, 
  scale, 
  onScaleChange, 
  position,
  onPositionChange,
  className = "",
  locked = false
}) => {
  const [isSelected, setIsSelected] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  
  // Drag State
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });

  // Resize State
  const isResizing = useRef(false);
  const resizeStart = useRef(0);
  const startScale = useRef(1);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setIsSelected(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // --- DRAG HANDLERS ---
  const handleDragStart = (clientX: number, clientY: number) => {
    if (locked || isResizing.current) return;
    isDragging.current = true;
    dragStart.current = { x: clientX, y: clientY };
    initialPos.current = { ...position };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging.current) return;
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;
    onPositionChange(initialPos.current.x + dx, initialPos.current.y + dy);
  };

  // --- RESIZE HANDLERS ---
  const handleResizeStart = (clientY: number) => {
    if (locked) return;
    isResizing.current = true;
    resizeStart.current = clientY;
    startScale.current = scale;
  };

  const handleResizeMove = (clientY: number) => {
    if (!isResizing.current) return;
    const delta = (clientY - resizeStart.current) * 0.005;
    onScaleChange(Math.max(0.5, Math.min(3.0, startScale.current + delta)));
  };

  const handleEnd = () => {
    isDragging.current = false;
    isResizing.current = false;
  };

  // --- GLOBAL LISTENERS ---
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        e.preventDefault();
        handleDragMove(e.clientX, e.clientY);
      }
      if (isResizing.current) {
        e.preventDefault();
        handleResizeMove(e.clientY);
      }
    };
    
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging.current && e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
      if (isResizing.current && e.touches.length > 0) {
        handleResizeMove(e.touches[0].clientY);
      }
    };

    const onUp = () => handleEnd();

    document.addEventListener("mousemove", onMouseMove, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, [position, scale, locked]);

  return (
    <div 
      ref={widgetRef} 
      className={`absolute transition-colors duration-200 ${locked ? '' : 'cursor-grab active:cursor-grabbing'} ${isSelected && !locked ? 'z-50' : 'z-10'} ${className}`} 
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`,
        left: 0,
        top: 0,
        touchAction: 'none'
      }}
      onClick={(e) => { if(!locked) { e.stopPropagation(); setIsSelected(true); } }}
      onMouseDown={(e) => { 
        if((e.target as HTMLElement).closest('.resize-handle')) return;
        handleDragStart(e.clientX, e.clientY); 
      }}
      onTouchStart={(e) => { 
        if((e.target as HTMLElement).closest('.resize-handle')) return;
        if (e.touches && e.touches.length > 0) {
           handleDragStart(e.touches[0].clientX, e.touches[0].clientY); 
        }
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
      
      {isSelected && !locked && (
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-yellow-400/50 rounded-xl" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div 
            className="resize-handle absolute -bottom-3 -right-3 w-8 h-8 bg-yellow-400 rounded-full shadow-lg flex items-center justify-center cursor-nwse-resize pointer-events-auto hover:scale-110 active:bg-yellow-300 z-50" 
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleResizeStart(e.clientY); }}
            onTouchStart={(e) => { 
              e.stopPropagation(); 
              e.preventDefault(); 
              if (e.touches && e.touches.length > 0) {
                handleResizeStart(e.touches[0].clientY); 
              }
            }}
          >
            <MoveDiagonal size={16} className="text-black" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ResizableWidget;