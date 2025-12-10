import React, { useState, useRef, useEffect } from 'react';
import { GripHorizontal } from 'lucide-react';

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

type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se' | null;

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
  const resizeDir = useRef<ResizeDirection>(null);
  const resizeStart = useRef({ x: 0, y: 0 });
  const initialSize = useRef({ w: 0, h: 0 });
  const initialResizePos = useRef({ x: 0, y: 0 });

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
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, dir: ResizeDirection) => {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return; // SAFETY CHECK ADDED
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    isResizing.current = true;
    resizeDir.current = dir;
    resizeStart.current = { x: clientX, y: clientY };
    initialSize.current = { w: width, h: height };
    initialResizePos.current = { ...position };
  };

  const handleResizeMove = (clientX: number, clientY: number) => {
    if (!isResizing.current || !resizeDir.current) return;
    
    const dx = clientX - resizeStart.current.x;
    const dy = clientY - resizeStart.current.y;
    
    let newW = initialSize.current.w;
    let newH = initialSize.current.h;
    let newX = initialResizePos.current.x;
    let newY = initialResizePos.current.y;

    // Calculate new dimensions and position based on direction
    if (resizeDir.current.includes('e')) {
      newW = Math.max(minWidth, initialSize.current.w + dx);
    }
    if (resizeDir.current.includes('s')) {
      newH = Math.max(minHeight, initialSize.current.h + dy);
    }
    if (resizeDir.current.includes('w')) {
      const proposedW = initialSize.current.w - dx;
      if (proposedW >= minWidth) {
        newW = proposedW;
        newX = initialResizePos.current.x + dx;
      }
    }
    if (resizeDir.current.includes('n')) {
      const proposedH = initialSize.current.h - dy;
      if (proposedH >= minHeight) {
        newH = proposedH;
        newY = initialResizePos.current.y + dy;
      }
    }

    onResize(newW, newH);
    if (newX !== position.x || newY !== position.y) {
      onPositionChange(newX, newY);
    }
  };

  const handleEnd = () => {
    isDragging.current = false;
    isResizing.current = false;
    resizeDir.current = null;
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
      if ((isDragging.current || isResizing.current) && e.touches.length > 0) {
        const t = e.touches[0];
        if (isDragging.current) handleDragMove(t.clientX, t.clientY);
        if (isResizing.current) handleResizeMove(t.clientX, t.clientY);
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
      className={`absolute transition-none ${isSelected && !locked ? 'z-50' : 'z-10'} ${className}`} 
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
      <div className="w-full h-full relative">
        {children}

        {/* Highlight Border when selected */}
        {!locked && isSelected && (
           <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-yellow-400/60 rounded-3xl z-40"></div>
        )}

        {/* Controls */}
        {!locked && (
          <>
            {/* DRAG HANDLE (Top Center) */}
            <div 
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-5 bg-yellow-500 rounded-full shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-[60] hover:scale-110 transition-transform"
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
              <GripHorizontal size={16} className="text-black" />
            </div>

            {/* RESIZE HANDLES (4 Corners) */}
            {/* Top Left */}
            <div 
              className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-400 rounded-full shadow-md cursor-nw-resize z-50 hover:scale-125 transition-transform"
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
              onTouchStart={(e) => handleResizeStart(e, 'nw')}
            />
            {/* Top Right */}
            <div 
              className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full shadow-md cursor-ne-resize z-50 hover:scale-125 transition-transform"
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
              onTouchStart={(e) => handleResizeStart(e, 'ne')}
            />
            {/* Bottom Left */}
            <div 
              className="absolute -bottom-2 -left-2 w-6 h-6 bg-yellow-400 rounded-full shadow-md cursor-sw-resize z-50 hover:scale-125 transition-transform"
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
              onTouchStart={(e) => handleResizeStart(e, 'sw')}
            />
            {/* Bottom Right */}
            <div 
              className="absolute -bottom-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full shadow-md cursor-se-resize z-50 hover:scale-125 transition-transform"
              onMouseDown={(e) => handleResizeStart(e, 'se')}
              onTouchStart={(e) => handleResizeStart(e, 'se')}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ResizableWidget;