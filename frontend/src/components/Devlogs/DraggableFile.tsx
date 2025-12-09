import React from "react";
import SortableCard from "../Home/SortableCard";
import type { FileItem } from "../../types/Devlogs";

interface DraggableFileProps {
  id: string;
  fileItem: FileItem;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}

const DraggableFile: React.FC<DraggableFileProps> = ({
  id,
  fileItem,
  onRemove,
  readOnly = false,
}) => {
  return (
    <SortableCard id={id}>
      <div className="bg-slate-700 rounded-lg p-4 flex justify-between items-center">
        <div className="flex-1">
          <span className="font-bold text-gray-300 block">{fileItem.title}</span>
          <span className="text-gray-400 text-sm">{fileItem.size}</span>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="ml-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            onClick={() => onRemove(id)}
          >
            ✕
          </button>
        )}
      </div>
    </SortableCard>
  );
};

export default DraggableFile;

