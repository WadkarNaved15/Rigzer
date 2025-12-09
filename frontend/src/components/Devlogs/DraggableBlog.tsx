import React from "react";
import SortableCard from "../Home/SortableCard";
import AutoResizeTextarea from "./AutoResizeTextarea";
import type { BlogSection } from "../../types/Devlogs";

interface DraggableBlogProps {
  id: string;
  blogSection: BlogSection;
  onUpdate: (id: string, content: string) => void;
  onRemove: (id: string) => void;
  readOnly?: boolean;
}
const DraggableBlog: React.FC<DraggableBlogProps> = ({
  id,
  blogSection,
  onUpdate,
  onRemove,
  readOnly = false,
}) => {
  return (
    <SortableCard id={id} >
      <div className="prose prose-invert max-w-none bg-slate-700/50 rounded-lg p-6">
        {readOnly ? (
          <p className="text-lg text-slate-300 whitespace-pre-wrap">
            {blogSection.content || "No content available."}
          </p>
        ) : (
          <>
            <AutoResizeTextarea 
              value={blogSection.content}
              className="text-lg text-slate-300 bg-transparent outline-none w-full border-none focus:ring-0"
              placeholder="Write your blog content here..."
              onChange={(e) => onUpdate(id, e.target.value)}
            />
            <button
              type="button"
              className="mt-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              onClick={() => onRemove(id)}
            >
              Remove Section
            </button>
          </>
        )}
      </div>
    </SortableCard>
  );
};

export default DraggableBlog;
