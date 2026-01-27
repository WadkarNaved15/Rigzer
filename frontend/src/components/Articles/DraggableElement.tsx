import { useState, useRef, useEffect } from 'react';
import { Trash2, Move, Maximize2 } from 'lucide-react';

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
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
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
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    if ((e.target as HTMLElement).closest('.delete-button')) return;
    if ((e.target as HTMLElement).closest('input, textarea')) return;

    const isDragHandle = (e.target as HTMLElement).closest('.drag-handle');
    if (!isDragHandle && (e.target as HTMLElement).closest('.element-content')) return;

    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      width: size?.width || 0,
      height: size?.height || 0,
      x: e.clientX,
      y: e.clientY,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        onPositionChange({ x: newX, y: newY });
        if (onAlignmentChange) {
          onAlignmentChange(newX, newY);
        }
      } else if (isResizing && size && onSizeChange) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newWidth = Math.max(100, resizeStart.width + deltaX);
        const newHeight = Math.max(50, resizeStart.height + deltaY);
        onSizeChange({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      if (onAlignmentChange) {
        onAlignmentChange(-1, -1);
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
  }, [isDragging, isResizing, dragStart, position, resizeStart, size, onAlignmentChange]);

  return (
    <div
      ref={elementRef}
      className={`absolute ${
        isHovered || isDragging || isResizing ? 'z-[100]' : 'z-10'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: size ? `${size.width}px` : 'auto',
        height: size ? `${size.height}px` : 'auto',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {(isHovered || isDragging || isResizing) && (
        <>
          <div className="absolute inset-0 border-2 border-blue-500/50 pointer-events-none rounded" />

          <div
            className="drag-handle absolute -top-10 left-0 flex gap-1 bg-blue-500 rounded px-2 py-1.5 cursor-grab active:cursor-grabbing shadow-lg"
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
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
        <div
          className="resize-handle absolute -bottom-3 -right-3 w-6 h-6 bg-blue-500 rounded-full cursor-nwse-resize z-[110] flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors"
          onMouseDown={handleResizeMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Maximize2 size={10} className="text-white" />
        </div>
      )}

      <div className="element-content pointer-events-auto">{children}</div>
    </div>
  );
}
