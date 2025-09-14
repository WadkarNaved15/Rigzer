import React from "react";
import type { PageData } from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";

interface FilesUploadProps {
  id: string;
  pageData: PageData;
  setPageData: React.Dispatch<React.SetStateAction<PageData>>;
}

const FilesUpload: React.FC<FilesUploadProps> = ({ id,pageData, setPageData }) => {
  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const uploadedFiles = Array.from(e.target.files).map((file, idx) => ({
      id: Date.now() + idx,
      title: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`, // convert to MB
    }));

    setPageData((prev) => ({
      ...prev,
      files: [...prev.files, ...uploadedFiles],
    }));
  };

  return (
    <SortableCard id={id}>
    <div className="col-span-2 mb-8">
      <h3 className="text-2xl font-bold text-white mb-6">Files</h3>

      {/* Upload Files */}
      <div className="mb-4">
        <input
          type="file"
          multiple
          id="file-upload"
          className="hidden"
          onChange={handleFilesUpload}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded"
        >
          Upload Files
        </label>
      </div>

      {/* File List */}
      <div className="space-y-4">
        {pageData.files.map((file) => (
          <div
            key={file.id}
            className="bg-slate-700 rounded-lg p-4 flex justify-between items-center"
          >
            <span className="font-bold text-gray-300">{file.title}</span>
            <span className="text-gray-400 text-sm">{file.size}</span>
          </div>
        ))}
      </div>
    </div>
    </SortableCard>
  );
};

export default FilesUpload;
