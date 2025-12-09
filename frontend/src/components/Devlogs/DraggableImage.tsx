import React, { useState, useRef, useEffect } from "react";
import SortableCard from "../Home/SortableCard";
import type { Media } from "../../types/Devlogs";

interface DraggableImageProps {
  id: string;
  media: Media;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}

const DraggableImage: React.FC<DraggableImageProps> = ({
  id,
  media,
  onRemove,
  readOnly = false,
}) => {
  const [width, setWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, width: 0 });
  const aspectRatio = useRef<number>(1);

  // Calculate initial dimensions on image load
  const handleImageLoad = () => {
    if (imageRef.current && width === null) {
      const img = imageRef.current;
      aspectRatio.current = img.naturalWidth / img.naturalHeight;
      
      // Set initial size to fit within max constraints
      const maxWidth = 600;
      let initialWidth = img.naturalWidth;
      
      if (initialWidth > maxWidth) {
        initialWidth = maxWidth;
      }
      
      setWidth(initialWidth);
    }
  };

  const handleResizeStart = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (width === null) return;
    
    setIsResizing(true);
    startPos.current = {
      x: e.clientX,
      width: width,
    };
    
    // Prevent any text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  };

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing) return;

      e.preventDefault();
      e.stopPropagation();

      // Calculate only horizontal movement
      const deltaX = e.clientX - startPos.current.x;
      
      // Calculate new width (maintaining aspect ratio automatically via CSS)
      const newWidth = Math.max(100, Math.min(1200, startPos.current.width + deltaX));
      
      setWidth(newWidth);
    };

    const handleResizeEnd = (e: MouseEvent) => {
      if (isResizing) {
        e.preventDefault();
        e.stopPropagation();
      }
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove, { capture: true });
      document.addEventListener("mouseup", handleResizeEnd, { capture: true });
      
      return () => {
        document.removeEventListener("mousemove", handleResizeMove, { capture: true });
        document.removeEventListener("mouseup", handleResizeEnd, { capture: true });
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizing]);

  return (
    <SortableCard id={id}>
      <div 
        ref={containerRef}
        className="relative inline-block"
        style={isResizing ? { pointerEvents: 'none' } : undefined}
      >
        <img
          ref={imageRef}
          src={media.url}
          alt="Screenshot"
          onLoad={handleImageLoad}
          style={width !== null ? { 
            width: `${width}px`, 
            height: 'auto'
          } : { maxWidth: '600px', height: 'auto' }}
          className="
            rounded-lg shadow-md
            flex
            justify-center
            items-center
            max-w-full 
            object-contain 
            block
          "
          draggable={false}
        />
        {!readOnly && (
          <>
            <button
              type="button"
              className="
                absolute top-2 right-2 
                bg-red-500 hover:bg-red-600 
                text-white px-3 py-1 
                rounded text-sm shadow
                z-10
              "
              onClick={(e) => {
                e.stopPropagation();
                onRemove(id);
              }}
            >
              ✕
            </button>
            
            {/* Right edge resize handle */}
            <div
              className="
                absolute top-1/2 -translate-y-1/2 -right-1
                w-3 h-12
                cursor-ew-resize
                bg-white
                border-2 border-blue-500
                rounded-sm
                hover:bg-blue-50
                z-10
                flex items-center justify-center
              "
              onMouseDown={handleResizeStart}
              onPointerDown={handleResizeStart}
              style={{ 
                userSelect: 'none',
                touchAction: 'none',
                pointerEvents: 'auto'
              }}
            >
              <div className="w-0.5 h-8 bg-blue-500"></div>
            </div>
            
            {/* Bottom-right corner resize handle */}
            <div
              className="
                absolute -bottom-1 -right-1
                w-4 h-4
                cursor-ew-resize
                bg-white
                border-2 border-blue-500
                rounded-sm
                hover:bg-blue-50
                z-10
              "
              onMouseDown={handleResizeStart}
              onPointerDown={handleResizeStart}
              style={{ 
                userSelect: 'none',
                touchAction: 'none',
                pointerEvents: 'auto'
              }}
            />
          </>
        )}
      </div>
    </SortableCard>
  );
};

export default DraggableImage;