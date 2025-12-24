import React, { useState, useRef, ChangeEvent } from 'react';
import { X, Image as ImageIcon, DollarSign, Film, Plus } from 'lucide-react';

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
          type: "normal_post",
          description,
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

      <div className="flex-1 p-4 flex gap-4 overflow-y-auto custom-scrollbar">
        <div className="flex-shrink-0">
          <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-gray-400">
            <ImageIcon size={20} />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <textarea
            placeholder="What's happening?"
            className="w-full text-lg bg-transparent border-none outline-none text-black dark:text-white placeholder-gray-500 resize-none focus:ring-0 min-h-[100px] p-0"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {assets.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* Asset Selector Tabs Area */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {assets.map((asset, index) => (
                  <button
                    key={asset.id}
                    onClick={() => setActiveIndex(index)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap ${
                      activeIndex === index 
                        ? 'bg-sky-500 border-sky-500 text-white shadow-md' 
                        : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-500 hover:border-sky-500'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider">{asset.type} {index + 1}</span>
                    <X 
                      size={14} 
                      className="hover:text-red-200 dark:hover:text-red-400 transition-colors"
                      onClick={(e) => { e.stopPropagation(); removeAsset(index); }} 
                    />
                  </button>
                ))}

                {/* Inline "Add" Button appears here after assets are added */}
                {assets.length < 4 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-full text-gray-400 hover:text-sky-500 hover:border-sky-500 transition-all flex-shrink-0"
                    title="Add more media"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>

              {/* Preview Display */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 aspect-video flex items-center justify-center">
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
                
                <div className="absolute top-4 right-4 pointer-events-none bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-white text-[10px] font-bold uppercase tracking-wider">
                  {assets[activeIndex].name.substring(0, 15)}...
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()} 
              className="border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl py-16 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-all group"
            >
              <div className="p-3 rounded-full bg-sky-50 dark:bg-sky-900/20 text-sky-500 group-hover:scale-110 transition-transform">
                <ImageIcon size={32} />
              </div>
              <p className="text-gray-500 font-medium">Add Photos or Videos (Up to 4)</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress Overlay */}
      <div className="px-4 space-y-2">
        {isSavingMetadata && (
           <div className="p-3 rounded-xl border border-sky-100 dark:border-sky-900/30 bg-sky-50 dark:bg-sky-900/10 text-sky-600 dark:text-sky-400 text-sm animate-pulse text-center font-semibold">
             Finalizing post...
           </div>
        )}
        {assets.map((asset) => asset.status === "uploading" && (
          <div key={asset.id} className="p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
            <div className="flex justify-between text-[10px] font-bold mb-2">
              <span className="text-gray-700 dark:text-zinc-300 truncate">Uploading {asset.name}</span>
              <span className="text-sky-500">{asset.progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${asset.progress}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-black">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={assets.length >= 4}
            className={`p-2 rounded-full transition-all ${assets.length >= 4 ? 'text-gray-400 cursor-not-allowed' : 'text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20'}`}
          >
            <Film size={22} />
          </button>
        </div>
        <div className={`text-xs font-bold ${assets.length === 4 ? 'text-orange-500' : 'text-gray-400'}`}>
          {assets.length} / 4 Assets
        </div>
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