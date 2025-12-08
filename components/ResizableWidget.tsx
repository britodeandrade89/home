import React, { useState, useRef, useEffect } from 'react';
import { MoveDiagonal, GripHorizontal } from 'lucide-react';

interface ResizableWidgetProps {
  children: React.ReactNode;
  width: number;
  height: number;
  onResize: (width: number, height: number) => void;
  position: { x: number; y: number };
  onPositionChange: (x: number, y: number) => void;
  className?: string;
  locked?: boolean;
  minWidth?: number;
  minHeight?: number;
}

const ResizableWidget: React.FC<ResizableWidgetProps> = ({ 
  children, 
  width,
  height,
  onResize, 
  position,
  onPositionChange,
  className = "",
  locked = false,
  minWidth = 100,
  minHeight = 100
}) => {
  const [isSelected, setIsSelected] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  
  // Drag State
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });

  // Resize State
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ w: 0, h: 0 });

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
  const handleResizeStart = (clientX: number, clientY: number) => {
    if (locked) return;
    isResizing.current = true;
    resizeStart.current = { x: clientX, y: clientY };
    initialSize.current = { w: width, h: height };
  };

  const handleResizeMove = (clientX: number, clientY: number) => {
    if (!isResizing.current) return;
    const dx = clientX - resizeStart.current.x;
    const dy = clientY - resizeStart.current.y;
    
    const newWidth = Math.max(minWidth, initialSize.current.w + dx);
    const newHeight = Math.max(minHeight, initialSize.current.h + dy);
    
    onResize(newWidth, newHeight);
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
        handleResizeMove(e.clientX, e.clientY);
      }
    };
    
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging.current && e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
      if (isResizing.current && e.touches.length > 0) {
        handleResizeMove(e.touches[0].clientX, e.touches[0].clientY);
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
  }, [position, width, height, locked]);

  return (
    <div 
      ref={widgetRef} 
      className={`absolute transition-colors duration-200 ${isSelected && !locked ? 'z-50 ring-1 ring-yellow-400/50' : 'z-10'} ${className}`} 
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: width,
        height: height,
        left: 0,
        top: 0,
        touchAction: 'none'
      }}
      onClick={(e) => { if(!locked) { e.stopPropagation(); setIsSelected(true); } }}
    >
      <div className="w-full h-full overflow-hidden">
        {children}
      </div>
      
      {!locked && (
        <>
          {/* DRAG HANDLE (Top Center) */}
          <div 
            className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-500 rounded-full shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-[60] hover:scale-110 transition-transform"
            onMouseDown={(e) => { 
              e.preventDefault(); 
              e.stopPropagation();
              handleDragStart(e.clientX, e.clientY); 
            }}
            onTouchStart={(e) => { 
              e.preventDefault(); 
              e.stopPropagation();
              if (e.touches && e.touches.length > 0) {
                 handleDragStart(e.touches[0].clientX, e.touches[0].clientY); 
              }
            }}
          >
            <GripHorizontal size={20} className="text-black" />
          </div>

          {/* Border Indicator */}
          <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-yellow-400/50 rounded-xl"></div>
          
          {/* Resize Handle (Bottom Right) */}
          <div 
            className="resize-handle absolute -bottom-3 -right-3 w-8 h-8 bg-yellow-400 rounded-full shadow-lg flex items-center justify-center cursor-nwse-resize pointer-events-auto hover:scale-110 active:bg-yellow-300 z-50" 
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleResizeStart(e.clientX, e.clientY); }}
            onTouchStart={(e) => { 
              e.stopPropagation(); 
              e.preventDefault(); 
              if (e.touches && e.touches.length > 0) {
                handleResizeStart(e.touches[0].clientX, e.touches[0].clientY); 
              }
            }}
          >
            <MoveDiagonal size={16} className="text-black" />
          </div>
        </>
      )}
    </div>
  );
};

export default ResizableWidget;