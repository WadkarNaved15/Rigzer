import React, { useState, useRef, ChangeEvent } from 'react';
import { X, Image as ImageIcon, Upload, Palette, ArrowLeft } from 'lucide-react';
import '@google/model-viewer';
import type { AdModelPostFormProps, AdAsset } from "../../../types/Post";

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

const hexToRgb = (hex: string): string | null => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : null;
};

const AdModelPostForm: React.FC<AdModelPostFormProps> = ({ onCancel, onBack }) => {
  const [description, setDescription] = useState('');
  const [brandName, setBrandName] = useState('');
  const [asset, setAsset] = useState<AdAsset | null>(null);
  const [bgColor, setBgColor] = useState('transparent');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bgMode, setBgMode] = useState<'color' | 'image'>('color');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'brand' | 'background'>('model');

  const modelInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const isTransparent = bgMode === 'color' && bgColor === 'transparent';
  const isImage = bgMode === 'image' && !!bgImage;
  const accentRgb = !isTransparent && bgMode === 'color' ? hexToRgb(bgColor) : null;

  // ── File handlers ─────────────────────────────────────────────────────────
  const handleModelFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.glb')) return;
    setAsset({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), name: file.name, status: 'pending' });
    e.target.value = '';
  };

  const handleBgImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgImageFile(file);
    setBgImage(URL.createObjectURL(file));
    setBgMode('image');
    e.target.value = '';
  };

  const handleLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoImage(URL.createObjectURL(file));
    e.target.value = '';
  };

  // ── S3 upload ─────────────────────────────────────────────────────────────
  const uploadToS3 = async (file: File, category: string, onProgress?: (p: number) => void): Promise<{ fileUrl: string; key: string }> => {
    const res = await fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileType: file.type || 'model/gltf-binary', category , fileSize: file.size }),
    });
    if (!res.ok) throw new Error('Failed to get upload URL');
    const { uploadUrl, key } = await res.json();
    const fileUrl = `${import.meta.env.VITE_GAMES_STORAGE_PRIVATE_CLOUDFRONT}/${key}`;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'model/gltf-binary');
      xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress?.(Math.round((ev.loaded / ev.total) * 100)); };
      xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error('Upload failed')));
      xhr.onerror = () => reject(new Error('Upload error'));
      xhr.send(file);
    });
    return { fileUrl, key };
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!asset || isSubmitting) return;
    setIsSubmitting(true);
    let modelKey: string | undefined;
    try {
      setAsset((prev) => prev ? { ...prev, status: 'uploading', progress: 0 } : prev);
      const { fileUrl: modelUrl, key: mKey } = await uploadToS3(asset.file, 'original', (p) => {
        setAsset((prev) => prev ? { ...prev, progress: p } : prev);
      });
      modelKey = mKey;
      setAsset((prev) => prev ? { ...prev, status: 'done', progress: 100, uploadedUrl: modelUrl, originalKey: mKey } : prev);

      let bgImageUrl: string | undefined;
      if (bgMode === 'image' && bgImageFile) {
        const { fileUrl } = await uploadToS3(bgImageFile, 'media');
        bgImageUrl = fileUrl;
      }

      let logoUrl: string | undefined;
      if (logoFile) {
        const { fileUrl } = await uploadToS3(logoFile, 'media');
        logoUrl = fileUrl;
      }

      setIsSavingMetadata(true);
      const response = await fetch(`${BACKEND_URL}/api/allposts`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ad_model_post', description,
          adModelPost: {
            brandName, bgMode,
            bgColor: bgMode === 'color' ? bgColor : undefined,
            bgImageUrl: bgMode === 'image' ? bgImageUrl : undefined,
            logoUrl,
            asset: { name: asset.name, originalUrl: modelUrl, originalKey: mKey },
          },
        }),
      });
      if (!response.ok) throw new Error('Database save failed');
      setIsSavingMetadata(false);
      setIsSubmitting(false);
      onCancel();
    } catch (err) {
      console.error('Ad post creation failed', err);
      if (modelKey) {
        await fetch(`${BACKEND_URL}/api/upload/cleanup`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: [modelKey] }),
        });
      }
      setIsSavingMetadata(false);
      setIsSubmitting(false);
    }
  };

  // ── Preview styles ────────────────────────────────────────────────────────

  // Outer wrapper: image mode = position:relative (layers handle bg), color = gradient
  const glassOuterStyle: React.CSSProperties = isImage
    ? { position: 'relative' }
    : { background: `linear-gradient(145deg, rgba(${accentRgb},0.12) 0%, rgba(${accentRgb},0.22) 100%)` };

  // Inner glass card: image mode = the card itself has the bg image + frosted overlay
  const glassCardStyle: React.CSSProperties = isImage
    ? {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
      }
    : {
        background: `linear-gradient(160deg, rgba(${accentRgb},0.18) 0%, rgba(${accentRgb},0.08) 100%)`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid rgba(${accentRgb},0.25)`,
        boxShadow: `0 8px 32px rgba(${accentRgb ?? '0,0,0'},0.15), inset 0 1px 0 rgba(255,255,255,0.08)`,
      };

  const glassPillStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.22)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
  };

  const glassAdBadgeStyle: React.CSSProperties = accentRgb
    ? { background: `rgba(${accentRgb},0.25)`, border: `1px solid rgba(${accentRgb},0.4)`, color: bgColor }
    : { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.7)' };

  const glassModelAreaStyle: React.CSSProperties = {
    background: isImage
      ? 'rgba(0,0,0,0.15)'
      : `radial-gradient(ellipse at center, rgba(${accentRgb},0.18) 0%, rgba(${accentRgb},0.06) 70%)`,
  };

  // Transparent pill style (for ExePost-style preview)
  const transparentPillStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.06)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-lg bg-white dark:bg-[#191919]">

      {/* ── Form Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white/80 dark:bg-[#191919]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
              <ArrowLeft size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}
          <div>
            <h2 className="text-base font-bold text-black dark:text-white leading-tight">Ad Showcase</h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">3D Model Ad</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!asset || isSubmitting}
          className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-bold px-5 py-1.5 rounded-full text-sm transition shadow-sm"
        >
          {isSubmitting ? 'Posting...' : 'Publish Ad'}
        </button>
      </div>

      {/* ── Tab Nav ─── */}
      <div className="flex border-b border-gray-100 dark:border-zinc-800 px-4 bg-white dark:bg-[#191919]">
        {(['model', 'brand', 'background'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">

        {/* ── MODEL tab ─── */}
        {activeTab === 'model' && (
          <div className="p-4 flex flex-col gap-4">
            {asset ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800">
                {/* @ts-ignore */}
                <model-viewer src={asset.previewUrl} camera-controls auto-rotate exposure="1.2" environment-image="neutral" shadow-intensity="1" style={{ width: '100%', height: '360px', backgroundColor: 'transparent' }} />
                <button onClick={() => setAsset(null)} className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-black/80 transition">
                  <X size={14} />
                </button>
                <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg text-white text-[10px] font-bold uppercase tracking-wider">
                  {asset.name.substring(0, 20)}{asset.name.length > 20 ? '...' : ''}
                </div>
              </div>
            ) : (
              <div onClick={() => modelInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/40 rounded-xl py-16 flex flex-col items-center gap-3 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all group">
                <div className="p-4 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Upload size={28} />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">Upload one .glb model</p>
                <p className="text-gray-400 dark:text-gray-600 text-xs">Single model only • GLB format</p>
              </div>
            )}
            <textarea
              placeholder="Optional description or caption..."
              className="w-full text-sm bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 outline-none text-black dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition min-h-[80px]"
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {/* ── BRAND tab ─── */}
        {activeTab === 'brand' && (
          <div className="p-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Brand / Creator Name</label>
              <input type="text" placeholder="Your brand or studio name"
                className="w-full text-sm bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none text-black dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Logo / Icon</label>
              {logoImage ? (
                <div className="flex items-center gap-3">
                  <img src={logoImage} alt="Logo" className="w-14 h-14 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700" />
                  <button onClick={() => { setLogoImage(null); setLogoFile(null); }} className="text-xs text-red-400 hover:text-red-500 font-semibold">Remove</button>
                </div>
              ) : (
                <div onClick={() => logoInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl py-8 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition group">
                  <div className="p-3 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 group-hover:scale-110 transition-transform"><ImageIcon size={22} /></div>
                  <p className="text-xs text-gray-400 font-medium">Upload logo or brand icon</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BACKGROUND tab ─── */}
        {activeTab === 'background' && (
          <div className="p-4 flex flex-col gap-4">
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-zinc-900 rounded-xl">
              <button onClick={() => setBgMode('color')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${bgMode === 'color' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-gray-400'}`}>
                <Palette size={13} /> Color
              </button>
              <button onClick={() => setBgMode('image')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${bgMode === 'image' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-gray-400'}`}>
                <ImageIcon size={13} /> Image
              </button>
            </div>

            {bgMode === 'color' && (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Theme Color</label>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => setBgColor('transparent')} title="Transparent"
                    className={`w-9 h-9 rounded-full border-2 relative overflow-hidden transition-all ${bgColor === 'transparent' ? 'border-gray-700 dark:border-white scale-110 shadow-lg' : 'border-gray-300 dark:border-zinc-600'}`}>
                    <span className="absolute inset-0" style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0 / 8px 8px' }} />
                  </button>
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setBgColor(c)} style={{ backgroundColor: c }}
                      className={`w-9 h-9 rounded-full border-2 transition-all ${bgColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`} />
                  ))}
                  <label className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 dark:border-zinc-600 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition overflow-hidden relative">
                    <input type="color" className="opacity-0 absolute w-0 h-0" value={bgColor === 'transparent' ? '#6366f1' : bgColor} onChange={(e) => setBgColor(e.target.value)} />
                    <span className="text-xs text-gray-400 font-bold">+</span>
                  </label>
                </div>
                <div className="h-14 rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden flex items-center justify-center"
                  style={isTransparent
                    ? { background: 'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 14px 14px' }
                    : { background: `linear-gradient(135deg, ${bgColor}40, ${bgColor}90)` }
                  }>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-black/10 backdrop-blur-sm text-gray-700">
                    {isTransparent ? 'Transparent — matches normal post style' : bgColor}
                  </span>
                </div>
              </div>
            )}

            {bgMode === 'image' && (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Background Image</label>
                {bgImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 aspect-video">
                    <img src={bgImage} alt="Background" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center opacity-0 hover:opacity-100 transition">
                      <button onClick={() => { setBgImage(null); setBgImageFile(null); setBgMode('color'); }}
                        className="px-3 py-1.5 bg-white/90 text-red-500 text-xs font-bold rounded-full">Remove</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => bgImageInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl py-10 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition group">
                    <div className="p-3 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 group-hover:scale-110 transition-transform"><ImageIcon size={22} /></div>
                    <p className="text-xs text-gray-400 font-medium">Upload background image</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            LIVE PREVIEW
        ══════════════════════════════════════════════════════════════════ */}
        <div className="px-4 pb-4">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2">Live Preview</p>

          {isTransparent ? (
            /* ── TRANSPARENT: ExePost-style ── */
            <div className="relative w-full border border-gray-200 dark:border-gray-700 bg-[#F9FAFB] dark:bg-[#191919] rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={transparentPillStyle}>
                    {logoImage ? (
                      <img src={logoImage} alt="Logo" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-[8px] font-black text-gray-500">
                        {(brandName || 'B').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-gray-700 dark:text-gray-300 text-xs font-bold tracking-wide">
                      {brandName || 'Brand Name'}
                    </span>
                  </div>
                  <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-400"
                    style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)' }}>Ad</div>
                </div>
                {description && <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed mb-3">{description}</p>}
                <div className="relative overflow-hidden w-full h-[400px] rounded-xl bg-gray-100 dark:bg-zinc-900/50">
                  {asset ? (
                    // @ts-ignore
                    <model-viewer src={asset.previewUrl} camera-controls auto-rotate exposure="1.2" environment-image="neutral" shadow-intensity="1"
                      style={{ width: '100%', height: '400px', backgroundColor: 'transparent' }} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-30">
                      <Upload size={28} className="text-gray-400" />
                      <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">3D Model</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          ) : (
            /* ── COLOR / IMAGE: glassmorphism ── */
            <div className="relative w-full overflow-hidden" style={glassOuterStyle}>

              {/* Outer blurred image — low opacity, glass feel */}
              {isImage && (
                <>
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: `url(${bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(28px)',
                    transform: 'scale(1.12)',
                    opacity: 0.45,
                  }} />
                  {/* Dark tint over outer blurred bg */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(5,5,15,0.35)' }} />
                </>
              )}

              {/* Glass card — m-3 gives the floating gap from article edges */}
              <div className="relative z-10 m-3 rounded-2xl overflow-hidden" style={glassCardStyle}>

                {/* Frosted glass overlay on top of the card's bg image */}
                {isImage && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'rgba(8,8,20,0.42)',
                    backdropFilter: 'blur(2px)',
                    WebkitBackdropFilter: 'blur(2px)',
                  }} />
                )}

                <div className="relative z-10">
                  {/* Floating pill */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-1">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={glassPillStyle}>
                      {logoImage ? (
                        <img src={logoImage} alt="Logo" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black"
                          style={accentRgb
                            ? { background: `rgba(${accentRgb},0.35)`, color: bgColor }
                            : { background: 'rgba(255,255,255,0.2)', color: 'white' }
                          }>
                          {(brandName || 'B').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-white text-xs font-bold tracking-wide drop-shadow-sm">
                        {brandName || 'Brand Name'}
                      </span>
                    </div>
                    <div className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest" style={glassAdBadgeStyle}>
                      Ad
                    </div>
                  </div>

                  {/* Model area */}
                  <div className="relative w-full overflow-hidden" style={{ ...glassModelAreaStyle, height: '340px' }}>
                    {accentRgb && (
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse 60% 50% at 50% 60%, rgba(${accentRgb},0.2) 0%, transparent 70%)` }} />
                    )}
                    {asset ? (
                      // @ts-ignore
                      <model-viewer src={asset.previewUrl} camera-controls auto-rotate
                        exposure="1.15" environment-image="neutral" shadow-intensity="0.8"
                        style={{ width: '100%', height: '340px', backgroundColor: 'transparent' }} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-25">
                        <Upload size={28} className="text-white" />
                        <span className="text-white text-[10px] font-bold uppercase tracking-widest">3D Model</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
                      style={{ background: isImage ? 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' : `linear-gradient(to top, rgba(${accentRgb ?? '0,0,0'},0.12), transparent)` }} />
                  </div>

                  {description && (
                    <div className="px-4 py-3">
                      <p className="text-white/75 text-sm leading-relaxed font-light">{description}</p>
                    </div>
                  )}

                  <div className="h-0.5 w-full"
                    style={{ background: accentRgb
                      ? `linear-gradient(90deg, transparent, rgba(${accentRgb},0.5), rgba(${accentRgb},0.25), transparent)`
                      : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.12), transparent)'
                    }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload progress */}
        {asset?.status === 'uploading' && (
          <div className="mx-4 mb-4 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">Uploading {asset.name}</span>
              <span className="text-[10px] font-bold text-indigo-500">{asset.progress ?? 0}%</span>
            </div>
            <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${asset.progress ?? 0}%` }} />
            </div>
          </div>
        )}

        {isSavingMetadata && (
          <div className="mx-4 mb-4 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center gap-2 animate-pulse">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Finalizing ad post...</span>
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input ref={modelInputRef} type="file" accept=".glb" className="hidden" onChange={handleModelFile} />
      <input ref={bgImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgImage} />
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
    </div>
  );
};

export default AdModelPostForm;