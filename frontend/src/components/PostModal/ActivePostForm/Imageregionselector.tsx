import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Move } from 'lucide-react';

export interface CropRegion {
  /** backgroundPosition values as percentages, e.g. "40% 60%" */
  backgroundPosition: string;
  /** For display — normalised 0-1 focal point */
  focalX: number;
  focalY: number;
}

interface Props {
  imageSrc: string;
  /** Called whenever the user moves the focal point */
  onChange: (region: CropRegion) => void;
  /** Initial focal point (0–1 each), defaults to centre */
  initialFocal?: { x: number; y: number };
}

const ImageRegionSelector: React.FC<Props> = ({ imageSrc, onChange, initialFocal }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focal, setFocal] = useState({ x: initialFocal?.x ?? 0.5, y: initialFocal?.y ?? 0.5 });
  const dragging = useRef(false);

  const emit = useCallback((x: number, y: number) => {
    const px = Math.round(x * 100);
    const py = Math.round(y * 100);
    onChange({
      backgroundPosition: `${px}% ${py}%`,
      focalX: x,
      focalY: y,
    });
  }, [onChange]);

  // emit initial value on mount
  useEffect(() => {
    emit(focal.x, focal.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const handlePointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width);
    const y = clamp((e.clientY - rect.top) / rect.height);
    setFocal({ x, y });
    emit(x, y);
  }, [emit]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handlePointer(e);
  };
  const onPointerMove = (e: React.PointerEvent) => { if (dragging.current) handlePointer(e); };
  const onPointerUp = () => { dragging.current = false; };

  const dotX = `${focal.x * 100}%`;
  const dotY = `${focal.y * 100}%`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Focus Point
        </label>
        <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono tabular-nums">
          {Math.round(focal.x * 100)}% · {Math.round(focal.y * 100)}%
        </span>
      </div>

      {/* Instruction hint */}
      <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 dark:text-indigo-500 font-medium">
        <Move size={11} />
        <span>Drag to choose which part of the image is centred behind the model</span>
      </div>

      {/* Selector canvas */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative w-full rounded-xl overflow-hidden border-2 border-indigo-300 dark:border-indigo-700 cursor-crosshair select-none"
        style={{ aspectRatio: '16/7' }}
      >
        {/* Background image fills the container — no object-fit clipping */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: `${focal.x * 100}% ${focal.y * 100}%`,
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)
            `,
            backgroundSize: '33.33% 33.33%',
          }}
        />

        {/* Rule-of-thirds lines */}
        <div className="absolute inset-0 pointer-events-none">
          {[33.33, 66.66].map((p) => (
            <React.Fragment key={p}>
              <div className="absolute top-0 bottom-0 w-px" style={{ left: `${p}%`, background: 'rgba(255,255,255,0.18)' }} />
              <div className="absolute left-0 right-0 h-px" style={{ top: `${p}%`, background: 'rgba(255,255,255,0.18)' }} />
            </React.Fragment>
          ))}
        </div>

        {/* Crosshair lines from focal point */}
        <div className="absolute top-0 bottom-0 w-px pointer-events-none"
          style={{ left: dotX, background: 'rgba(99,102,241,0.7)', transform: 'translateX(-0.5px)' }} />
        <div className="absolute left-0 right-0 h-px pointer-events-none"
          style={{ top: dotY, background: 'rgba(99,102,241,0.7)', transform: 'translateY(-0.5px)' }} />

        {/* Focal dot */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: dotX,
            top: dotY,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Outer ring */}
          <div className="w-9 h-9 rounded-full border-2 border-white/80 shadow-lg flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.25)', backdropFilter: 'blur(4px)' }}>
            {/* Inner dot */}
            <div className="w-3 h-3 rounded-full bg-white shadow-md" style={{ boxShadow: '0 0 0 2px rgba(99,102,241,0.8)' }} />
          </div>
        </div>

        {/* Corner label */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-white pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
          Focus point
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: 'Top', x: 0.5, y: 0.1 },
          { label: 'Centre', x: 0.5, y: 0.5 },
          { label: 'Bottom', x: 0.5, y: 0.9 },
          { label: 'Left', x: 0.1, y: 0.5 },
          { label: 'Right', x: 0.9, y: 0.5 },
        ].map(({ label, x, y }) => {
          const active = Math.abs(focal.x - x) < 0.05 && Math.abs(focal.y - y) < 0.05;
          return (
            <button
              key={label}
              onClick={() => { setFocal({ x, y }); emit(x, y); }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                active
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-500'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ImageRegionSelector;