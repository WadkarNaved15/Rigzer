import React, { useRef } from "react";
import type { PageData } from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";

interface VideoDemosProps {
  id: string;
  pageData: PageData;
  setPageData: React.Dispatch<React.SetStateAction<PageData>>;
}

const VideoDemos: React.FC<VideoDemosProps> = ({ id,pageData, setPageData }) => {
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <SortableCard id={id}>
    <div className="col-span-2 mt-8">
      <h3 className="text-2xl font-bold text-white mb-4">Video Demos</h3>

      <div className="grid grid-cols-1 gap-6">
        {pageData.videos.map((v, index) => (
          <div key={index} className="relative">
            <video
              src={v}
              controls
              className="rounded-lg shadow-md w-full max-h-96"
            />
            <button
              type="button"
              className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs"
              onClick={() =>
                setPageData((prev) => ({
                  ...prev,
                  videos: prev.videos.filter((_, i) => i !== index),
                }))
              }
            >
              ✕
            </button>
          </div>
        ))}
      </div>

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
          onChange={(e) => {
            if (!e.target.files) return;
            const files = Array.from(e.target.files);
            const newUrls = files.map((file) => URL.createObjectURL(file));
            setPageData((prev) => ({
              ...prev,
              videos: [...prev.videos, ...newUrls],
            }));
          }}
        />
      </div>
    </div>
    </SortableCard>
  );
};

export default VideoDemos;
