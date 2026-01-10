import { useState, useRef, useEffect } from 'react';
import { Trash2, Move } from 'lucide-react';

export interface ElementPosition {
  x: number;
  y: number;
}

export interface ElementSize {
  width: number;
  height: number;
}

interface DraggableElementProps {
  id: string;
  position: ElementPosition;
  size?: ElementSize;
  onPositionChange: (position: ElementPosition) => void;
  onSizeChange?: (size: ElementSize) => void;
  onDelete: () => void;
  onAlignmentChange?: (x: number, y: number) => void;
  resizable?: boolean;
  children: React.ReactNode;
}

type ResizeDirection =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export default function DraggableElement({
  id,
  position,
  size,
  onPositionChange,
  onSizeChange,
  onDelete,
  onAlignmentChange,
  resizable = false,
  children,
}: DraggableElementProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    posX: 0,
    posY: 0,
    direction: "" as ResizeDirection,
  });

  const elementRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const isResizingRef = useRef(false);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      if (!isDragging && !isResizingRef.current) {
        setIsHovered(false);
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // CRITICAL: Block all dragging if resize is active
    if (isResizingRef.current || isResizing) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Don't drag if clicking on these elements
    const target = e.target as HTMLElement;
    if (target.closest('.resize-handle')) return;
    if (target.closest('.delete-button')) return;
    if (target.closest('input, textarea, button:not(.drag-handle button)')) return;

    // Only allow drag from drag handle or element content
    const isDragHandle = target.closest('.drag-handle');
    if (!isDragHandle) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    direction: ResizeDirection
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    // CRITICAL: Hard lock to prevent any dragging
    isResizingRef.current = true;
    setIsDragging(false);
    setIsResizing(true);
    setIsHovered(true); // Keep hover state during resize
    
    setResizeStart({
      width: size?.width || 0,
      height: size?.height || 0,
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
      direction,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // DRAG MODE: Only if dragging and NOT resizing
      if (isDragging && !isResizingRef.current && !isResizing) {
        e.preventDefault();
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        onPositionChange({ x: newX, y: newY });
        if (onAlignmentChange) {
          onAlignmentChange(newX, newY);
        }
      } 
      // RESIZE MODE: Only if resizing
      else if (isResizing && isResizingRef.current && size && onSizeChange) {
        e.preventDefault();
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;

        // Calculate new dimensions based on direction
        switch (resizeStart.direction) {
          case "right":
            newWidth = resizeStart.width + dx;
            break;
          case "bottom":
            newHeight = resizeStart.height + dy;
            break;
          case "left":
            newWidth = resizeStart.width - dx;
            newX = resizeStart.posX + dx;
            break;
          case "top":
            newHeight = resizeStart.height - dy;
            newY = resizeStart.posY + dy;
            break;
          case "top-left":
            newWidth = resizeStart.width - dx;
            newHeight = resizeStart.height - dy;
            newX = resizeStart.posX + dx;
            newY = resizeStart.posY + dy;
            break;
          case "top-right":
            newWidth = resizeStart.width + dx;
            newHeight = resizeStart.height - dy;
            newY = resizeStart.posY + dy;
            break;
          case "bottom-left":
            newWidth = resizeStart.width - dx;
            newHeight = resizeStart.height + dy;
            newX = resizeStart.posX + dx;
            break;
          case "bottom-right":
            newWidth = resizeStart.width + dx;
            newHeight = resizeStart.height + dy;
            break;
        }

        // Apply minimum size constraints
        const minWidth = 100;
        const minHeight = 50;
        
        // Clamp dimensions
        if (newWidth < minWidth) {
          newWidth = minWidth;
          // Adjust position if resizing from left
          if (resizeStart.direction.includes("left")) {
            newX = resizeStart.posX + resizeStart.width - minWidth;
          }
        }
        
        if (newHeight < minHeight) {
          newHeight = minHeight;
          // Adjust position if resizing from top
          if (resizeStart.direction.includes("top")) {
            newY = resizeStart.posY + resizeStart.height - minHeight;
          }
        }

        // Update size
        onSizeChange({ width: newWidth, height: newHeight });

        // Update position for left/top resizing
        if (resizeStart.direction.includes("left") || resizeStart.direction.includes("top")) {
          onPositionChange({ x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        setIsDragging(false);
        setIsResizing(false);
        isResizingRef.current = false;
        
        if (onAlignmentChange) {
          onAlignmentChange(-1, -1);
        }
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, position, resizeStart, size, onPositionChange, onSizeChange, onAlignmentChange]);

  // Cursor styles for resize handles
  const getResizeCursor = (direction: ResizeDirection) => {
    const cursors: Record<ResizeDirection, string> = {
      'top': 'n-resize',
      'bottom': 's-resize',
      'left': 'w-resize',
      'right': 'e-resize',
      'top-left': 'nw-resize',
      'top-right': 'ne-resize',
      'bottom-left': 'sw-resize',
      'bottom-right': 'se-resize',
    };
    return cursors[direction];
  };

  return (
    <>
      <style>{`
        .resize-handle {
          position: absolute;
          width: 12px;
          height: 12px;
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          z-index: 1002 !important;
          transition: all 0.15s ease;
        }
        .resize-handle:hover {
          background: #3b82f6;
          transform: scale(1.3);
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
        }
        .resize-handle:active {
          transform: scale(1.1);
        }
        .drag-handle {
          pointer-events: auto;
        }
      `}</style>
      
      <div
        ref={elementRef}
        className={`absolute ${isHovered || isDragging || isResizing ? 'z-[100]' : 'z-10'}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: size ? `${size.width}px` : 'auto',
          height: size ? `${size.height}px` : 'auto',
          cursor: isResizing ? 'resizing' : isDragging ? 'grabbing' : 'default',
          userSelect: 'none',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {(isHovered || isDragging || isResizing) && (
          <>
            <div className="absolute inset-0 border-2 border-blue-500/50 pointer-events-none rounded" />

            <div
              className="drag-handle absolute -top-10 left-0 flex gap-1 bg-blue-500 rounded px-2 py-1.5 cursor-grab active:cursor-grabbing shadow-lg"
              style={{ zIndex: 1000 }}
              onMouseDown={handleMouseDown}
              onMouseEnter={handleMouseEnter}
            >
              <Move size={14} className="text-white" />
              <span className="text-white text-xs font-medium">Drag</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="delete-button ml-1 text-white hover:text-red-300 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}

        {resizable && (isHovered || isResizing) && (
          <>
            {/* Corner handles */}
            <div 
              className="resize-handle top-left" 
              style={{ 
                top: -6, 
                left: -6, 
                cursor: 'nwse-resize',
                pointerEvents: 'auto',
                zIndex: 1002
              }} 
              onMouseDown={(e) => handleResizeMouseDown(e, "top-left")}
              onMouseEnter={handleMouseEnter}
            />
            <div 
              className="resize-handle top-right" 
              style={{ 
                top: -6, 
                right: -6, 
                cursor: 'nesw-resize',
                pointerEvents: 'auto',
                zIndex: 1002
              }} 
              onMouseDown={(e) => handleResizeMouseDown(e, "top-right")}
              onMouseEnter={handleMouseEnter}
            />
            <div 
              className="resize-handle bottom-left" 
              style={{ 
                bottom: -6, 
                left: -6, 
                cursor: 'nesw-resize',
                pointerEvents: 'auto',
                zIndex: 1002
              }} 
              onMouseDown={(e) => handleResizeMouseDown(e, "bottom-left")}
              onMouseEnter={handleMouseEnter}
            />
            <div 
              className="resize-handle bottom-right" 
              style={{ 
                bottom: -6, 
                right: -6, 
                cursor: 'nwse-resize',
                pointerEvents: 'auto',
                zIndex: 1002
              }} 
              onMouseDown={(e) => handleResizeMouseDown(e, "bottom-right")}
              onMouseEnter={handleMouseEnter}
            />

            {/* Side handles */}
            <div 
              className="resize-handle top" 
              style={{ 
                top: -6, 
                left: "50%", 
                transform: "translateX(-50%)", 
                cursor: 'ns-resize',
                pointerEvents: 'auto',
                zIndex: 1002
              }} 
              onMouseDown={(e) => handleResizeMouseDown(e, "top")}
              onMouseEnter={handleMouseEnter}
            />
            <div 
              className="resize-handle bottom" 
              style={{ 
                bottom: -6, 
                left: "50%", 
                transform: "translateX(-50%)", 
                cursor: 'ns-resize',
                pointerEvents: 'auto',
                zIndex: 1002
              }} 
              onMouseDown={(e) => handleResizeMouseDown(e, "bottom")}
              onMouseEnter={handleMouseEnter}
            />
            <div 
              className="resize-handle left" 
              style={{ 
                left: -6, 
                top: "50%", 
                transform: "translateY(-50%)", 
                cursor: 'ew-resize',
                pointerEvents: 'auto',
                zIndex: 1002
              }} 
              onMouseDown={(e) => handleResizeMouseDown(e, "left")}
              onMouseEnter={handleMouseEnter}
            />
            <div 
              className="resize-handle right" 
              style={{ 
                right: -6, 
                top: "50%", 
                transform: "translateY(-50%)", 
                cursor: 'ew-resize',
                pointerEvents: 'auto',
                zIndex: 1002
              }} 
              onMouseDown={(e) => handleResizeMouseDown(e, "right")}
              onMouseEnter={handleMouseEnter}
            />
          </>
        )}

        <div className="element-content pointer-events-auto h-full w-full">
          {children}
        </div>
      </div>
    </>
  );
}