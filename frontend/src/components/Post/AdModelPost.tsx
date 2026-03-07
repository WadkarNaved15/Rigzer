import React, { useEffect, useRef, useState } from 'react';
import '@google/model-viewer';
import type { AdModelPostProps } from '../../types/Post';

const hexToRgb = (hex: string): string | null => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : null;
};

const AdModelPost: React.FC<AdModelPostProps> = ({
  _id,
  user,
  description,
  adModelPost,
  onOpenDetails,
}) => {
  const postRef = useRef<HTMLElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const viewStartTime = useRef<number | null>(null);
  const [modelVisible, setModelVisible] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  if (!adModelPost) return null;

  const { brandName, logoUrl, bgMode, bgColor, bgImageUrl, bgImagePosition, bgImageSize, overlayOpacity = 30, asset } = adModelPost;

  const resolvedBgPos = bgImagePosition ?? '50% 50%';
  const resolvedBgSize = bgImageSize ?? 'cover';

  const modelUrl =
    asset?.optimization?.status === 'completed' && asset.optimizedUrl
      ? asset.optimizedUrl
      : asset?.originalUrl;

  const isTransparent = bgMode === 'color' && (!bgColor || bgColor === 'transparent');
  const isImage = bgMode === 'image' && !!bgImageUrl;
  const accentRgb = !isTransparent && bgMode === 'color' && bgColor ? hexToRgb(bgColor) : null;

  const getContrastText = (hex: string) => {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);

  return luminance > 186 ? "#000000" : "#ffffff";
};

  // ── Observers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const modelObserver = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setModelVisible(true); },
      { threshold: 0.1 }
    );
    if (modelRef.current) modelObserver.observe(modelRef.current);

    const postObserver = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          viewStartTime.current = Date.now();
          fetch(`${BACKEND_URL}/api/interactions/playtime-start`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: _id }) }).catch(() => {});
          fetch(`${BACKEND_URL}/api/interactions/view`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: _id }) }).catch(() => {});
        } else {
          if (!viewStartTime.current) return;
          const duration = Math.floor((Date.now() - viewStartTime.current) / 1000);
          viewStartTime.current = null;
          fetch(`${BACKEND_URL}/api/interactions/playtime-end`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: _id, duration }) }).catch(() => {});
        }
      },
      { threshold: 0.4 }
    );
    if (postRef.current) postObserver.observe(postRef.current);
    return () => { modelObserver.disconnect(); postObserver.disconnect(); };
  }, [_id]);

  // ── TRANSPARENT: ExePost-style ────────────────────────────────────────────
  if (isTransparent) {
    return (
      <article
        ref={postRef}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onOpenDetails?.();
        }}
        className="relative w-full border border-gray-200 dark:border-gray-700 bg-[#F9FAFB] dark:bg-[#191919] hover:bg-[#F7F9F9] dark:hover:bg-[#16181C] transition-colors duration-200 cursor-pointer"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.06)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {logoUrl ? (
                <img src={logoUrl} alt={brandName || 'Brand'} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-[8px] font-black text-gray-500">
                  {(brandName || user?.username || 'B').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-gray-700 dark:text-gray-300 text-xs font-bold tracking-wide">
                {brandName || user?.username || 'Creator'}
              </span>
            </div>
            <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-400"
              style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)' }}>Ad</div>
          </div>

          {description && <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed mb-3">{description}</p>}

          <div ref={modelRef} className="relative overflow-hidden w-full h-[400px] rounded-xl bg-gray-100 dark:bg-zinc-900/50">
            {modelVisible && modelUrl ? (
              // @ts-ignore
              <model-viewer src={modelUrl} camera-controls auto-rotate autoplay animation-name="*"
                exposure="1.2" environment-image="neutral" shadow-intensity="1"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                style={{ width: '100%', height: '400px', backgroundColor: 'transparent' }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-zinc-800 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  // ── COLOR / IMAGE: glassmorphism ──────────────────────────────────────────

  // Outer article: image mode = layers handle bg / color mode = solid dark base + tinted gradient
  // The solid base (#0a0a0f) ensures the tinted gradient looks identical in light and dark themes.
  // Without it the nearly-transparent gradient (0.12–0.22 opacity) picks up the page bg color.
  // Outer: color mode = exact solid bgColor (no mixing, no gradient, same in all themes)
  //         image mode = position:relative so absolute layers stack correctly
  const outerStyle: React.CSSProperties = isImage
    ? { position: 'relative' }
    : { background: bgColor! };

  // Card: color mode = dark semi-transparent overlay so text stays readable on the solid color
  //        image mode = sharp image, zero blur on the card itself
  const glassCardBase: React.CSSProperties = isImage
    ? {
        backgroundImage: `url(${bgImageUrl})`,
        backgroundSize: resolvedBgSize,
        backgroundPosition: resolvedBgPos,
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
      }
    : {
        background: `rgba(0,0,0,${overlayOpacity / 100})`,
        border: `1px solid rgba(${accentRgb},0.3)`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)`,
      };

  const headerPillStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.22)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
  };

  const adBadgeStyle: React.CSSProperties = accentRgb
    ? { background: `rgba(${accentRgb},0.25)`, border: `1px solid rgba(${accentRgb},0.4)`, color: bgColor! }
    : { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)' };

  // Model area: transparent so the outer bgColor shows through cleanly
  const modelAreaStyle: React.CSSProperties = { background: 'transparent' };

  return (
    <article
      ref={postRef}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        onOpenDetails?.();
      }}
      className="relative w-full cursor-pointer overflow-hidden"
      style={outerStyle}
    >
      {/* ── Outer bg for image mode: blurred, low-opacity ── */}
      {isImage && (
        <>
          {/* The actual blurred background image */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `url(${bgImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(28px)',
            transform: 'scale(1.12)',
            opacity: 0.45,
          }} />
          {/* Subtle dark tint — keep low so the image's own colors stay visible */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: `rgba(0,0,0,${overlayOpacity / 100 * 0.4})` }} />
        </>
      )}

      {/* Grain texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat' }} />

      {/* ── Glass card — m-3 gap gives the "floating" appearance ── */}
      <div className="relative z-10 m-3 rounded-2xl overflow-hidden" style={glassCardBase}>

        {/* Image mode: pure dark tint only — NO backdropFilter (would blur card's own backgroundImage) */}
        {isImage && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: `rgba(0,0,0,${overlayOpacity / 100})` }} />
        )}

        {/* All content sits above the overlay */}
        <div className="relative z-10">

          {/* ── Floating brand pill ── */}
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={headerPillStyle}>
              {logoUrl ? (
                <img src={logoUrl} alt={brandName || 'Brand'} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black"
                  style={accentRgb
                    ? { background: `rgba(${accentRgb},0.35)`, color: bgColor! }
                    : { background: 'rgba(255,255,255,0.2)', color: 'white' }
                  }>
                  {(brandName || user?.username || 'B').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-white text-xs font-bold tracking-wide drop-shadow-sm">
                {brandName || user?.username || 'Creator'}
              </span>
            </div>
            <div className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest" style={adBadgeStyle}>
              Ad
            </div>
          </div>

          {/* ── 3D model ── */}
          <div ref={modelRef} className="relative w-full overflow-hidden" style={{ ...modelAreaStyle, height: '380px' }}>
            {accentRgb && (
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 60% 50% at 50% 60%, rgba(${accentRgb},0.2) 0%, transparent 70%)` }} />
            )}

            {modelVisible && modelUrl ? (
              // @ts-ignore
              <model-viewer src={modelUrl} camera-controls auto-rotate autoplay animation-name="*"
                exposure="1.15" environment-image="neutral" shadow-intensity="0.8"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                style={{ width: '100%', height: '380px', backgroundColor: 'transparent' }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl animate-pulse"
                  style={{ background: accentRgb ? `rgba(${accentRgb},0.15)` : 'rgba(255,255,255,0.08)' }} />
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none"
              style={{ background: isImage ? 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' : `linear-gradient(to top, rgba(${accentRgb ?? '0,0,0'},0.15), transparent)` }} />
          </div>

          {/* Bottom accent line */}
          <div className="h-0.5 w-full"
            style={accentRgb
              ? { background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.6), rgba(${accentRgb},0.3), transparent)` }
              : { background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.12), transparent)' }
            } />
        </div>
      </div>
       {/* Description */}
          {description && (
  <div className="px-4 pb-3">
    <p
      className={`text-sm leading-relaxed font-light tracking-wide ${
        isTransparent || bgMode === "image"
          ? "text-black dark:text-white"
          : ""
      }`}
      style={{
        color:
          bgMode === "color" && bgColor !== "transparent"
            ? getContrastText(bgColor)
            : undefined,
        textShadow:
          bgMode === "image"
            ? "0 1px 2px rgba(0,0,0,0.6)"
            : "none",
      }}
    >
      {description}
    </p>
  </div>
)}
    </article>
  );
};

export default AdModelPost;