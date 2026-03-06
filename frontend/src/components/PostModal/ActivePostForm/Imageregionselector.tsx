import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Move, ZoomIn, ZoomOut } from 'lucide-react';

export interface CropRegion {
  /** CSS backgroundPosition, e.g. "40% 60%" */
  backgroundPosition: string;
  /** CSS backgroundSize, e.g. "150%" or "cover" */
  backgroundSize: string;
  /** Normalised 0–1 focal point on the original image */
  focalX: number;
  focalY: number;
  /** Zoom multiplier (1 = cover baseline, >1 = zoomed in) */
  zoom: number;
}

interface Props {
  imageSrc: string;
  onChange: (region: CropRegion) => void;
  initialFocal?: { x: number; y: number };
  initialZoom?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

/**
 * With zoom, backgroundSize is no longer just "cover" — it's:
 *   cover_scale * zoom  (expressed as a percentage of the container, or as px)
 *
 * We use backgroundSize as a percentage string: `${coverPct * zoom}%`
 * where coverPct = max(containerW/imgW, containerH/imgH) * 100
 *
 * Then backgroundPosition % still works the same overflow logic,
 * but now the rendered size = img * coverScale * zoom.
 */
function computeStyles(
  focalX: number,
  focalY: number,
  zoom: number,
  containerW: number,
  containerH: number,
  imgW: number,
  imgH: number,
): { backgroundSize: string; backgroundPosition: string } {
  // Cover scale (zoom=1 baseline)
  const scaleX = containerW / imgW;
  const scaleY = containerH / imgH;
  const coverScale = Math.max(scaleX, scaleY);

  // With zoom applied
  const renderedW = imgW * coverScale * zoom;
  const renderedH = imgH * coverScale * zoom;

  // backgroundSize as a percentage of the container
  // CSS bg-size % is relative to the container — so renderedW/containerW * 100
  const bgSizeW = (renderedW / containerW) * 100;
  const bgSizeH = (renderedH / containerH) * 100;

  // Overflow available for panning
  const overflowX = renderedW - containerW;
  const overflowY = renderedH - containerH;

  // Desired offset to centre the focal point
  let pctX = 50;
  let pctY = 50;

  if (overflowX > 0.5) {
    const targetPx = clamp(focalX * renderedW - containerW / 2, 0, overflowX);
    pctX = (targetPx / overflowX) * 100;
  }
  if (overflowY > 0.5) {
    const targetPy = clamp(focalY * renderedH - containerH / 2, 0, overflowY);
    pctY = (targetPy / overflowY) * 100;
  }

  return {
    backgroundSize: `${Math.round(bgSizeW)}% ${Math.round(bgSizeH)}%`,
    backgroundPosition: `${Math.round(pctX)}% ${Math.round(pctY)}%`,
  };
}

const ImageRegionSelector: React.FC<Props> = ({
  imageSrc,
  onChange,
  initialFocal,
  initialZoom = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focal, setFocal] = useState({ x: initialFocal?.x ?? 0.5, y: initialFocal?.y ?? 0.5 });
  const [zoom, setZoom] = useState(clamp(initialZoom, MIN_ZOOM, MAX_ZOOM));
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const computeRegion = useCallback(
    (x: number, y: number, z: number): CropRegion => {
      if (!imgNatural || !containerSize || containerSize.w === 0) {
        return {
          backgroundPosition: `${Math.round(x * 100)}% ${Math.round(y * 100)}%`,
          backgroundSize: 'cover',
          focalX: x,
          focalY: y,
          zoom: z,
        };
      }
      const styles = computeStyles(x, y, z, containerSize.w, containerSize.h, imgNatural.w, imgNatural.h);
      return { ...styles, focalX: x, focalY: y, zoom: z };
    },
    [imgNatural, containerSize],
  );

  const emit = useCallback(
    (x: number, y: number, z: number) => onChange(computeRegion(x, y, z)),
    [computeRegion, onChange],
  );

  useEffect(() => {
    if (imgNatural && containerSize) emit(focal.x, focal.y, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgNatural, containerSize]);

  const handlePointer = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      setFocal({ x, y });
      emit(x, y, zoom);
    },
    [emit, zoom],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handlePointer(e);
  };
  const onPointerMove = (e: React.PointerEvent) => { if (dragging.current) handlePointer(e); };
  const onPointerUp = () => { dragging.current = false; };

  // Pinch-to-zoom via wheel
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const nextZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    emit(focal.x, focal.y, nextZoom);
  };

  const changeZoom = (delta: number) => {
    const nextZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    emit(focal.x, focal.y, nextZoom);
  };

  const setPreset = (x: number, y: number) => { setFocal({ x, y }); emit(x, y, zoom); };

  const preview = computeRegion(focal.x, focal.y, zoom);
  const dotX = `${focal.x * 100}%`;
  const dotY = `${focal.y * 100}%`;
  const zoomPct = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Focus &amp; Zoom
        </label>
        <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono tabular-nums">
          {Math.round(focal.x * 100)}% · {Math.round(focal.y * 100)}% · {zoom.toFixed(1)}×
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 dark:text-indigo-500 font-medium">
        <Move size={11} />
        <span>Drag to pan · scroll or use buttons to zoom</span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        className="relative w-full rounded-xl overflow-hidden border-2 border-indigo-300 dark:border-indigo-700 cursor-crosshair select-none"
        style={{ aspectRatio: '16/7' }}
      >
        {/* Preview with zoom-aware backgroundSize */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: preview.backgroundSize,
            backgroundPosition: preview.backgroundPosition,
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Rule-of-thirds grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '33.33% 33.33%',
          }}
        />

        {/* Crosshairs */}
        <div className="absolute top-0 bottom-0 w-px pointer-events-none"
          style={{ left: dotX, background: 'rgba(99,102,241,0.9)', transform: 'translateX(-0.5px)' }} />
        <div className="absolute left-0 right-0 h-px pointer-events-none"
          style={{ top: dotY, background: 'rgba(99,102,241,0.9)', transform: 'translateY(-0.5px)' }} />

        {/* Focal dot */}
        <div className="absolute pointer-events-none"
          style={{ left: dotX, top: dotY, transform: 'translate(-50%, -50%)' }}>
          <div className="w-9 h-9 rounded-full border-2 border-white/80 shadow-lg flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.25)', backdropFilter: 'blur(4px)' }}>
            <div className="w-3 h-3 rounded-full bg-white"
              style={{ boxShadow: '0 0 0 2px rgba(99,102,241,0.9)' }} />
          </div>
        </div>

        {/* Zoom badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black tabular-nums text-white pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          {zoom.toFixed(1)}×
        </div>

        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-white pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          Focus point
        </div>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeZoom(-ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>

        {/* Zoom slider */}
        <div className="relative flex-1 h-6 flex items-center">
          {/* Track */}
          <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${zoomPct}%` }}
            />
          </div>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            onChange={(e) => {
              const z = parseFloat(e.target.value);
              setZoom(z);
              emit(focal.x, focal.y, z);
            }}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
            title={`Zoom: ${zoom.toFixed(1)}×`}
          />
        </div>

        <button
          onClick={() => changeZoom(ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>

        {/* Zoom level label */}
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 tabular-nums w-8 text-right">
          {zoom.toFixed(1)}×
        </span>
      </div>

      {/* Preset buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: 'Top',    x: 0.5, y: 0.1 },
          { label: 'Centre', x: 0.5, y: 0.5 },
          { label: 'Bottom', x: 0.5, y: 0.9 },
          { label: 'Left',   x: 0.1, y: 0.5 },
          { label: 'Right',  x: 0.9, y: 0.5 },
        ].map(({ label, x, y }) => {
          const active = Math.abs(focal.x - x) < 0.05 && Math.abs(focal.y - y) < 0.05;
          return (
            <button key={label} onClick={() => setPreset(x, y)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                active
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-500'
              }`}>
              {label}
            </button>
          );
        })}
        {zoom !== 1 && (
          <button onClick={() => { setZoom(1); emit(focal.x, focal.y, 1); }}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-400">
            Reset zoom
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageRegionSelector;