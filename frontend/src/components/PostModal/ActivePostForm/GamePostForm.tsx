import React, { useState, useRef, ChangeEvent } from 'react';
import { X, Upload, FileArchive, Laptop, Cpu, Database, Info } from 'lucide-react';

interface PostModalProps {
  onCancel: () => void;
}

interface GameAsset {
  id: string;
  file: File;
  uploadedUrl?: string;
  name: string;
  size: number;
  progress?: number;
  status?: 'pending' | 'uploading' | 'done' | 'error';
}

const GamePostForm: React.FC<PostModalProps> = ({ onCancel }) => {
  /* ---------------- Core State ---------------- */
  const [gameName, setGameName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const [platform, setPlatform] = useState<'windows'>('windows');
  const [buildType, setBuildType] = useState<'windows_exe' | 'windows_zip'>('windows_exe');
  const [startPath, setStartPath] = useState('');
  const [engine, setEngine] = useState('');

  /* -------- System Requirements (Optional) -------- */
  const [ramGB, setRamGB] = useState('');
  const [cpuCores, setCpuCores] = useState('');
  const [requiresGPU, setRequiresGPU] = useState(false);

  const [asset, setAsset] = useState<GameAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  /* ---------------- File Select ---------------- */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAsset({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      status: 'pending'
    });

    e.target.value = '';
  };

  /* ---------------- Upload ---------------- */
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk

  const uploadGameToS3 = async (
    asset: GameAsset,
    onProgress: (p: number) => void
  ): Promise<string> => {
    const startRes = await fetch(`${BACKEND_URL}/api/upload/game/start-multipart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: asset.file.name, fileType: asset.file.type }),
    });
    const { uploadId, key } = await startRes.json();

    const totalChunks = Math.ceil(asset.file.size / CHUNK_SIZE);
    const uploadedParts: { ETag: string; PartNumber: number }[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const partNumber = i + 1;
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, asset.file.size);
      const chunk = asset.file.slice(start, end);

      const urlRes = await fetch(`${BACKEND_URL}/api/upload/game/get-part-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, key, partNumber }),
      });
      const { uploadUrl } = await urlRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: chunk,
      });

      if (!uploadRes.ok) throw new Error(`Chunk ${partNumber} failed`);

      const etag = uploadRes.headers.get('ETag');
      if (!etag) throw new Error('No ETag returned');

      uploadedParts.push({ ETag: etag.replace(/"/g, ''), PartNumber: partNumber });

      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    const completeRes = await fetch(`${BACKEND_URL}/api/upload/game/complete-multipart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, key, parts: uploadedParts }),
    });

    const { fileUrl } = await completeRes.json();
    return fileUrl;
  };

  /* ---------------- Submit ---------------- */
  const handlePostSubmit = async () => {
    if (!asset || !gameName || !startPath || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      asset.status = 'uploading';
      setAsset({ ...asset });

      const uploadedUrl = await uploadGameToS3(asset, p => {
        asset.progress = p;
        setAsset({ ...asset });
      });

      asset.uploadedUrl = uploadedUrl;
      asset.status = 'done';
      setAsset({ ...asset });

      setIsSavingMetadata(true);

      const response = await fetch(`${BACKEND_URL}/api/allposts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'game_post',
          description,
          game: {
            gameName,
            version,
            platform,
            buildType,
            startPath,
            engine,
            runMode: 'sandboxed',
            price: Number(price) || 0,
            systemRequirements: {
              ramGB: ramGB ? Number(ramGB) : null,
              cpuCores: cpuCores ? Number(cpuCores) : null,
              gpuRequired: requiresGPU
            },
            file: {
              name: asset.name,
              url: uploadedUrl,
              size: asset.size
            }
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An unexpected error occurred while saving the post');
      }

      onCancel();
    } catch (err: any) {
      console.error("Submission Error:", err);
      setErrorMessage(err.message);
      setIsSubmitting(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-[#191919] min-h-[80vh] max-h-[90vh] rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-xl transition-colors duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 sticky top-0 bg-white/80 dark:bg-[#191919]/80 backdrop-blur-md z-30">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Upload Game</h2>
          <p className="text-xs text-gray-500 dark:text-zinc-500">Configure your build and system requirements</p>
        </div>
        <button
          onClick={handlePostSubmit}
          disabled={!asset || !startPath || !gameName || isSubmitting}
          className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold px-6 py-2 rounded-full transition shadow-md shadow-sky-500/20"
        >
          {isSubmitting ? 'Publishing...' : 'Publish'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2"><Info size={16}/> {errorMessage}</span>
            <X className="cursor-pointer" size={18} onClick={() => setErrorMessage(null)} />
          </div>
        )}

        {/* Basic Information */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sky-500 font-semibold text-sm uppercase tracking-wider">
            <Laptop size={16} />
            <span>Game Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              placeholder="Game Name"
              value={gameName}
              onChange={e => setGameName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-zinc-800 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
            />
            <input
              placeholder="Version (1.0.0)"
              value={version}
              onChange={e => setVersion(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-zinc-800 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
            />
          </div>
          <textarea
            placeholder="Tell us about your game..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-zinc-800 focus:ring-2 focus:ring-sky-500 outline-none min-h-[100px] resize-none transition-all"
          />
        </section>

        {/* Technical Configuration */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sky-500 font-semibold text-sm uppercase tracking-wider">
            <Database size={16} />
            <span>Deployment Config</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value as any)}
              className="bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-zinc-800 outline-none cursor-pointer hover:border-sky-500 transition-colors"
            >
              <option value="windows">Windows</option>
              <option value="linux">Linux</option>
            </select>
            <select
              value={buildType}
              onChange={e => setBuildType(e.target.value as any)}
              className="bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-zinc-800 outline-none cursor-pointer hover:border-sky-500 transition-colors"
            >
              <option value="windows_exe">Windows EXE</option>
              <option value="windows_zip">Windows ZIP</option>
              <option value="html5">HTML5</option>
            </select>
          </div>
          <div className="space-y-1">
            <input
              placeholder="Executable path (e.g. Build/Game.exe)"
              value={startPath}
              onChange={e => setStartPath(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-sky-500/50 dark:border-sky-500/30 focus:ring-2 focus:ring-sky-500 outline-none transition-all font-mono text-sm"
            />
            <p className="px-1 text-[10px] text-gray-500 font-medium">Internal path to start the game after extraction</p>
          </div>
          <input
            placeholder="Engine (Unity, Unreal, Godot...)"
            value={engine}
            onChange={e => setEngine(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-zinc-800 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
          />
        </section>

        {/* System Requirements */}
        <section className="p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-zinc-300 font-bold text-sm">
            <Cpu size={16} />
            <span>Minimum System Requirements</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="RAM (GB)"
              value={ramGB}
              onChange={e => setRamGB(e.target.value)}
              className="bg-white dark:bg-zinc-900 text-black dark:text-white p-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 outline-none"
            />
            <input
              type="number"
              placeholder="CPU Cores"
              value={cpuCores}
              onChange={e => setCpuCores(e.target.value)}
              className="bg-white dark:bg-zinc-900 text-black dark:text-white p-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 outline-none"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-gray-300 dark:border-zinc-700 text-sky-500 focus:ring-sky-500"
              checked={requiresGPU}
              onChange={e => setRequiresGPU(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-600 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors">Dedicated GPU Required</span>
          </label>
        </section>

        {/* File Upload Area */}
        <div className="pt-2">
          {asset ? (
            <div className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 relative group">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-xl">
                  <FileArchive size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-black dark:text-white truncate">{asset.name}</p>
                  <p className="text-[10px] text-gray-500 font-bold">{(asset.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {!isSubmitting && (
                  <button 
                    onClick={() => setAsset(null)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <X size={18} className="text-gray-400" />
                  </button>
                )}
              </div>

              {asset.status === 'uploading' && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                    <span className="text-sky-600 dark:text-sky-400">Uploading Build</span>
                    <span className="text-sky-600 dark:text-sky-400">{asset.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(14,165,233,0.4)]" 
                      style={{ width: `${asset.progress}%` }} 
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl py-12 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-all group"
            >
              <div className="p-4 rounded-full bg-sky-50 dark:bg-sky-900/20 text-sky-500 group-hover:scale-110 transition-transform duration-300">
                <Upload size={32} />
              </div>
              <div className="text-center">
                <p className="text-gray-900 dark:text-white font-bold">Upload Game Build</p>
                <p className="text-xs text-gray-500 mt-1">Accepts .zip, .exe, .apk (Max 5GB)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Footer */}
      {isSavingMetadata && (
        <div className="px-6 py-3 bg-sky-50 dark:bg-sky-900/10 border-t border-sky-100 dark:border-sky-900/20">
          <p className="text-xs text-sky-600 dark:text-sky-400 font-semibold animate-pulse text-center">
            Finalizing game metadata and permissions...
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".zip,.exe,.apk"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default GamePostForm;