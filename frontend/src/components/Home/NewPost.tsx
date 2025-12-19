import React, { useState, useRef, ChangeEvent } from 'react';
import { X, Image as ImageIcon, DollarSign } from 'lucide-react';
import '@google/model-viewer';

interface PostModalProps {
  onCancel: () => void;
}

interface Asset {
  id: string;
  file: File;        // actual file
  previewUrl: string;
  uploadedUrl?: string; // CloudFront URL after upload
  name: string;
  progress?: number;   // 0–100
  status?: "pending" | "uploading" | "done" | "error";
}


const PostModal: React.FC<PostModalProps> = ({ onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"; // Ensure this is set in your .env file
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 4 - assets.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const newAssets: Asset[] = [];

    filesToProcess.forEach((file) => {
      if (!file.name.endsWith(".glb")) return;

      newAssets.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      });
    });

    if (newAssets.length) {
      setAssets((prev) => [...prev, ...newAssets]);
      if (assets.length === 0) setActiveIndex(0);
    }

    e.target.value = "";
  };

  const uploadAssetToS3 = (
    asset: Asset,
    onProgress: (percent: number) => void
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // 1. Get presigned URL
        const res = await fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: asset.file.name,
            fileType: asset.file.type || "model/gltf-binary",
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");

        const { uploadUrl, fileUrl } = await res.json();

        // 2. Upload with progress (XHR)
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader(
          "Content-Type",
          asset.file.type || "model/gltf-binary"
        );

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(fileUrl);
          } else {
            reject(new Error("Upload failed"));
          }
        };

        xhr.onerror = () => reject(new Error("Upload error"));

        xhr.send(asset.file);
      } catch (err) {
        reject(err);
      }
    });
  };

  const handlePostSubmit = async () => {
    if (isSubmitting) return; // Guard clause
    setIsSubmitting(true);
    try {
      const updatedAssets = [...assets];

      await Promise.all(
        updatedAssets.map(async (asset, index) => {
          updatedAssets[index].status = "uploading";
          updatedAssets[index].progress = 0;
          setAssets([...updatedAssets]);

          const uploadedUrl = await uploadAssetToS3(asset, (percent) => {
            updatedAssets[index].progress = percent;
            setAssets([...updatedAssets]);
          });

          updatedAssets[index].uploadedUrl = uploadedUrl;
          updatedAssets[index].status = "done";
          updatedAssets[index].progress = 100;
          setAssets([...updatedAssets]);
        })
      );
      setIsSavingMetadata(true); // Trigger the "Fetching metadata" UI
      // Now create post in DB
      const response=await fetch(`${BACKEND_URL}/api/allposts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "model_post",
          title,
          description,
          price: Number(price),
          assets: updatedAssets.map(a => ({
            name: a.name,
            url: a.uploadedUrl,
          })),
        }),
      });
      if (!response.ok) throw new Error("Database save failed");
      onCancel();
    } catch (err) {
      console.error("Post creation failed", err);
    }
  };


  const removeAsset = (index: number) => {
    const updated = assets.filter((_, i) => i !== index);
    setAssets(updated);
    // Adjust active index if we deleted the current one
    if (activeIndex >= updated.length) {
      setActiveIndex(Math.max(0, updated.length - 1));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-black min-h-[75vh] rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-30 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full transition-colors">
            <X size={20} className="text-black dark:text-white" />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">Compose 3D Bundle</h2>
        </div>
        <button
          onClick={handlePostSubmit}
          disabled={!description || assets.length === 0 || isSubmitting}
          className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold px-5 py-1.5 rounded-full transition shadow-sm"
        >
          {isSubmitting ? "Posting..." : "Post"}
        </button>

      </div>

      <div className="flex flex-1 p-4 gap-4 overflow-y-auto custom-scrollbar">
        {/* User Avatar */}
        <div className="flex-shrink-0">
          <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-700 flex items-center justify-center text-gray-400">
            <ImageIcon size={20} />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          {/* Inputs Section */}
          <div className="space-y-1">
            <input
              type="text"
              placeholder="Post Title"
              className="w-full text-2xl font-bold bg-transparent border-none outline-none text-black dark:text-white placeholder-gray-500 focus:ring-0 p-0"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="What's special about these models?"
              className="w-full text-lg bg-transparent border-none outline-none text-black dark:text-white placeholder-gray-500 resize-none focus:ring-0 min-h-[100px] p-0 mt-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 3D Asset Management UI */}
          {assets.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* Asset Selector Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {assets.map((asset, index) => (
                  <button
                    key={asset.id}
                    onClick={() => setActiveIndex(index)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap ${activeIndex === index
                      ? 'bg-sky-500 border-sky-500 text-white shadow-md'
                      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-500 hover:border-sky-500'
                      }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider">Asset {index + 1}</span>
                    <X
                      size={14}
                      className="hover:text-red-200 dark:hover:text-red-400 transition-colors"
                      onClick={(e) => { e.stopPropagation(); removeAsset(index); }}
                    />
                  </button>
                ))}

                {assets.length < 4 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-full text-gray-400 hover:text-sky-500 hover:border-sky-500 transition"
                    title="Add another asset"
                  >
                    <ImageIcon size={18} />
                  </button>
                )}
              </div>

              {/* Main Preview Area */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 group">

                {/* NOTE: backgroundColor: "transparent" added here 
                  This makes the model sit directly on the container's dark bg 
                */}
                {/* @ts-ignore */}
                <model-viewer
                  src={assets[activeIndex].uploadedUrl || assets[activeIndex].previewUrl}
                  camera-controls
                  auto-rotate
                  exposure="1.0"
                  environment-image="neutral"
                  shadow-intensity="1"
                  // Added transparent background here
                  style={{ width: "100%", height: "400px", backgroundColor: "transparent" }}
                />

                <div className="absolute top-4 right-4 pointer-events-none bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-white text-[10px] font-bold uppercase tracking-wider">
                  Previewing: {assets[activeIndex].name.substring(0, 15)}{assets[activeIndex].name.length > 15 ? '...' : ''}
                </div>
              </div>
            </div>
          ) : (
            /* Upload Placeholder */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl py-16 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-all group"
            >
              <div className="p-3 rounded-full bg-sky-50 dark:bg-sky-900/20 text-sky-500 group-hover:scale-110 transition-transform">
                <ImageIcon size={32} />
              </div>
              <p className="text-gray-500 font-medium">Upload up to 4 .glb assets</p>
            </div>
          )}
        </div>
      </div>
      {/* Enhanced Upload Progress Overlay */}
      <div className="space-y-3 px-1 mt-2">
        {/* Metadata Saving Overlay */}
        {isSavingMetadata && (
          <div className="mx-4 p-4 rounded-xl border border-sky-100 dark:border-sky-900/30 bg-sky-50/50 dark:bg-sky-900/10 flex items-center justify-center gap-3 animate-pulse">
            <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">
              Finalizing post & fetching metadata...
            </span>
          </div>
        )}
        {assets.map((asset) => (
          asset.status === "uploading" && (
            <div
              key={asset.id}
              className="p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                  <span className="text-xs font-medium text-gray-700 dark:text-zinc-300 truncate">
                    Uploading {asset.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-sky-500 tabular-nums">
                  {asset.progress || 0}%
                </span>
              </div>

              <div className="relative w-full h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                {/* Progress Fill with Glow Effect */}
                <div
                  className="absolute top-0 left-0 h-full bg-sky-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_8px_rgba(14,165,233,0.4)]"
                  style={{ width: `${asset.progress || 0}%` }}
                />
              </div>
            </div>
          )
        ))}
      </div>
      {/* Footer Tools */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-black flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Price Input Container */}
          <div className="flex items-center bg-gray-100 dark:bg-zinc-900 rounded-full px-3 py-1.5 border border-transparent focus-within:border-sky-500 text-sky-500 transition-all">
            <DollarSign size={16} />
            <input
              type="number"
              placeholder="Price"
              min="0"
              className="bg-transparent border-none outline-none text-sm w-24 text-black dark:text-white placeholder-gray-500 focus:ring-0 ml-1 appearance-none"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 rounded-full transition ${assets.length >= 4 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20'}`}
            disabled={assets.length >= 4}
            title="Add Asset"
          >
            <ImageIcon size={22} />
          </button>
        </div>

        <div className={`text-xs font-bold ${assets.length === 4 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-600'}`}>
          {assets.length} / 4 Assets
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".glb"
        multiple
      />
    </div>
  );
};

export default PostModal;