import React, { useRef, useEffect } from "react";
import type { PageData ,Media} from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";

interface VideoDemosProps {
  id: string;
  pageData: PageData;
  setPageData?: React.Dispatch<React.SetStateAction<PageData>>;
  readOnly?: boolean;
}

const VideoDemos: React.FC<VideoDemosProps> = ({
  id,
  pageData,
  setPageData,
  readOnly = false,
}) => {
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up blob URLs when unmounting
  useEffect(() => {
    return () => {
      pageData.videos.forEach((v) => {
        if (v.startsWith("blob:")) URL.revokeObjectURL(v);
      });
    };
  }, [pageData.videos]);

  const handleRemove = (index: number) => {
    const url = pageData.videos[index];
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    
    setPageData((prev) => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
    }));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    const newMedia: Media[] = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type,
    }));

    setPageData?.((prev) => ({
      ...prev,
      videos: [...prev.videos, ...newMedia],
    }));

    e.target.value = ""; // allow re-upload of same file
  };

  return (
    <SortableCard id={id} disabled={readOnly}>
      <div className="col-span-2 mt-8">
        <h3 className="text-2xl font-bold text-white mb-4">Video Demos</h3>

        <div className="grid grid-cols-1 gap-6">
          {pageData.videos.map((v, index) => (
            <div key={index} className="relative">
              <video
                src={v.url}
                controls
                className="rounded-lg shadow-md w-full max-h-96"
              />
              {!readOnly && (
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs"
                  onClick={() => handleRemove(index)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="mt-4">
            <button
              type="button"
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
              onClick={() => videoInputRef.current?.click()}
            >
              Upload Video
            </button>

            <input
              type="file"
              accept="video/*"
              ref={videoInputRef}
              hidden
              multiple
              onChange={handleUpload}
            />
          </div>
        )}
      </div>
    </SortableCard>
  );
};

export default VideoDemos;
