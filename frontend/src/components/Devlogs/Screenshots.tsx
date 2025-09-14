import React, { useRef } from "react";
import type { PageData } from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";

interface ScreenshotProps {
  id: string;
  pageData: PageData;
  setPageData: React.Dispatch<React.SetStateAction<PageData>>;
}

const Screenshots: React.FC<ScreenshotProps> = ({ id,pageData, setPageData }) => {
  const screenshot1Ref = useRef<HTMLInputElement | null>(null);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newUrls = files.map((file) => URL.createObjectURL(file));

    setPageData((prev) => ({
      ...prev,
      screenshots: [...prev.screenshots, ...newUrls],
    }));

    // reset input so selecting the same file again still triggers onChange
    e.target.value = "";
  };

  const handleRemoveScreenshot = (index: number) => {
    setPageData((prev) => {
      // revoke the URL being removed
      URL.revokeObjectURL(prev.screenshots[index]);
      return {
        ...prev,
        screenshots: prev.screenshots.filter((_, i) => i !== index),
      };
    });
  };

  return (
    <SortableCard id={id}>
    <div className="col-span-2 mt-8">
      <h3 className="text-2xl font-bold text-white mb-4">Screenshots</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pageData.screenshots.map((s, index) => (
          <div key={index} className="relative">
            <img
              src={s}
              alt={`Screenshot ${index + 1}`}
              className="rounded-lg shadow-md w-full h-48 object-contain"
            />
            <button
              type="button"
              className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs"
              onClick={() => handleRemoveScreenshot(index)}
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
          onClick={() => screenshot1Ref.current?.click()}
        >
          Upload Screenshot
        </button>
        <input
          type="file"
          accept="image/*"
          ref={screenshot1Ref}
          hidden
          multiple
          onChange={handleFilesChange}
        />
      </div>
    </div>
    </SortableCard>
  );
};

export default Screenshots;
