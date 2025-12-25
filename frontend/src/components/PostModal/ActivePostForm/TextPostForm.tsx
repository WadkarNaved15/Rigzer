import React, { useState, useRef, ChangeEvent } from 'react';
import { X, Image as ImageIcon, DollarSign, Film } from 'lucide-react';

interface PostModalProps {
  onCancel: () => void;
}

interface Asset {
  id: string;
  file: File;
  previewUrl: string;
  uploadedUrl?: string;
  name: string;
  type: string; // "image" or "video"
  progress?: number;
  status?: "pending" | "uploading" | "done" | "error";
}

const MediaPostForm: React.FC<PostModalProps> = ({ onCancel }) => {
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 4 - assets.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const newAssets: Asset[] = filesToProcess.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));

    if (newAssets.length) {
      setAssets((prev) => [...prev, ...newAssets]);
      if (assets.length === 0) setActiveIndex(0);
    }
    e.target.value = "";
  };

  const uploadAssetToS3 = (asset: Asset, onProgress: (percent: number) => void): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: asset.file.name,
            fileType: asset.file.type,
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, fileUrl } = await res.json();

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", asset.file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => xhr.status === 200 ? resolve(fileUrl) : reject();
        xhr.onerror = () => reject();
        xhr.send(asset.file);
      } catch (err) { reject(err); }
    });
  };

  const handlePostSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updatedAssets = [...assets];
      await Promise.all(updatedAssets.map(async (asset, index) => {
        updatedAssets[index].status = "uploading";
        setAssets([...updatedAssets]);
        const uploadedUrl = await uploadAssetToS3(asset, (p) => {
          updatedAssets[index].progress = p;
          setAssets([...updatedAssets]);
        });
        updatedAssets[index].uploadedUrl = uploadedUrl;
        updatedAssets[index].status = "done";
        setAssets([...updatedAssets]);
      }));

      setIsSavingMetadata(true);
      const response = await fetch(`${BACKEND_URL}/api/allposts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "media_post",
          description,
          price: Number(price),
          assets: updatedAssets.map(a => ({ name: a.name, url: a.uploadedUrl, type: a.type })),
        }),
      });
      if (!response.ok) throw new Error();
      onCancel();
    } catch (err) { console.error(err); setIsSubmitting(false); }
  };

  const removeAsset = (index: number) => {
    const updated = assets.filter((_, i) => i !== index);
    setAssets(updated);
    if (activeIndex >= updated.length) setActiveIndex(Math.max(0, updated.length - 1));
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-black min-h-[75vh] rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white dark:bg-black z-30 border-b border-gray-100 dark:border-zinc-800">
        <h2 className="text-xl font-bold text-black dark:text-white">Compose Media</h2>
        <button
          onClick={handlePostSubmit}
          disabled={!description || assets.length === 0 || isSubmitting}
          className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold px-5 py-1.5 rounded-full transition"
        >
          {isSubmitting ? "Posting..." : "Post"}
        </button>
      </div>

      <div className="flex-1 p-4 flex gap-4 overflow-y-auto">
        <div className="flex-shrink-0">
          <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-gray-400">
            <ImageIcon size={20} />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <textarea
            placeholder="What's happening?"
            className="w-full text-lg bg-transparent border-none outline-none text-black dark:text-white placeholder-gray-500 resize-none focus:ring-0 min-h-[120px] p-0"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {assets.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {assets.map((asset, index) => (
                  <button
                    key={asset.id}
                    onClick={() => setActiveIndex(index)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${activeIndex === index ? 'bg-sky-500 text-white' : 'bg-zinc-900 border-zinc-700 text-gray-500'}`}
                  >
                    <span className="text-xs font-bold uppercase">{asset.type} {index + 1}</span>
                    <X size={14} onClick={(e) => { e.stopPropagation(); removeAsset(index); }} />
                  </button>
                ))}
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-video flex items-center justify-center">
                {assets[activeIndex].type === 'video' ? (
                  <video 
                    src={assets[activeIndex].previewUrl} 
                    controls 
                    className="max-h-full max-w-full"
                  />
                ) : (
                  <img 
                    src={assets[activeIndex].previewUrl} 
                    className="max-h-full max-w-full object-contain" 
                    alt="preview"
                  />
                )}
              </div>
            </div>
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-zinc-800 rounded-2xl py-16 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-zinc-900/30 transition-all">
              <div className="p-3 rounded-full bg-sky-900/20 text-sky-500"><ImageIcon size={32} /></div>
              <p className="text-gray-500 font-medium">Add Photos or Videos</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bars */}
      <div className="px-4">
        {isSavingMetadata && (
           <div className="p-3 rounded-xl bg-sky-900/10 text-sky-400 text-sm animate-pulse text-center">Finalizing...</div>
        )}
        {assets.map((asset) => asset.status === "uploading" && (
          <div key={asset.id} className="p-2 mb-2 bg-zinc-900 rounded-lg">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-zinc-400">Uploading {asset.name}</span>
              <span className="text-sky-500">{asset.progress}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 transition-all" style={{ width: `${asset.progress}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-900 rounded-full px-3 py-1.5 text-sky-500 border border-transparent focus-within:border-sky-500">
            <DollarSign size={16} />
            <input type="number" placeholder="Price" className="bg-transparent border-none outline-none text-sm w-20 ml-1" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="text-sky-500 p-2 hover:bg-sky-900/20 rounded-full">
            <Film size={22} />
          </button>
        </div>
        <div className="text-xs font-bold text-gray-600">{assets.length} / 4 Assets</div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,video/*" 
        multiple 
      />
    </div>
  );
};

export default MediaPostForm;