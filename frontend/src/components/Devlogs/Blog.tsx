import React from "react";
import type { PageData } from "../../types/Devlogs";
import AutoResizeTextarea from "./AutoResizeTextarea";
import SortableCard from "../Home/SortableCard";

interface BlogProps {
  id: string;
  pageData: PageData;
  handleChange?: (
    key: keyof PageData,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  readOnly?: boolean;
}

const Blog: React.FC<BlogProps> = ({
  id,
  pageData,
  handleChange,
  readOnly = false,
}) => {
  return (
    <SortableCard id={id} disabled={readOnly}>
      <div className="col-span-2 prose prose-invert max-w-none mt-4 mb-8 space-y-4">
        {readOnly ? (
          <p className="text-xl italic text-slate-300">
            {pageData.italicQuote || "No quote available."}
          </p>
        ) : (
          <AutoResizeTextarea
            value={pageData.italicQuote}
            className="text-xl italic text-slate-300 bg-transparent outline-none w-full"
            onChange={(e) => handleChange("italicQuote", e)}
          />
        )}

        {/* You can repeat the same readOnly pattern for bodyParagraph1, bodyParagraph2, etc. */}
      </div>
    </SortableCard>
  );
};

export default Blog;
