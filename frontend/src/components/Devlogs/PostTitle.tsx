import React from "react";
import type { PageData } from "../../types/Devlogs";
import AutoWidthInput from "./AutoWidthInput";
import { Heart, Twitter, Facebook } from "lucide-react";
import SortableCard from "../Home/SortableCard";

interface PostTitleProps {
  id: string;
  pageData: PageData;
  handleChange?: (
    key: keyof PageData,
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  readOnly?: boolean;
}

const PostTitle: React.FC<PostTitleProps> = ({
  id,
  pageData,
  handleChange,
  readOnly = false,
}) => {
  return (
    <SortableCard id={id} disabled={readOnly}>
      <div className="col-span-2 mt-2 mb-6">
        {/* Post title */}
        {readOnly ? (
          <h1 className="text-3xl font-bold text-white mb-4">
            {pageData.postTitle || "Untitled Post"}
          </h1>
        ) : (
          <input
            type="text"
            className="text-3xl font-bold text-white mb-4 bg-transparent outline-none w-full"
            value={pageData.postTitle}
            onChange={(e) => handleChange("postTitle", e)}
          />
        )}

        {/* Game Info title + Devlog tag */}
        <div className="flex items-center space-x-4 text-slate-400 mb-4">
          {readOnly ? (
            <span className="text-orange-400 font-bold">
              {pageData.gameInfoTitle || "Game Info"}
            </span>
          ) : (
            <AutoWidthInput
              value={pageData.gameInfoTitle}
              spanClassName="absolute invisible whitespace-pre font-bold text-orange-400"
              className="text-orange-400 bg-transparent outline-none font-bold"
              onChange={(e) => handleChange("gameInfoTitle", e)}
            />
          )}
          <span>»</span>
          <p className="bg-transparent outline-none">Devlog</p>
        </div>

        {/* Like + Author info */}
        <div className="flex items-center space-x-6 mb-4">
          <button
            type="button"
            className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded"
            disabled={readOnly}
          >
            <Heart size={16} />
            <span>Like</span>
          </button>
          <p className="text-slate-400 bg-transparent outline-none">
            1 day ago
          </p>
          <span className="text-slate-400">by</span>
          {readOnly ? (
            <span className="text-orange-400 font-bold">
              {pageData.author || "Unknown Author"}
            </span>
          ) : (
            <AutoWidthInput
              value={pageData.author}
              spanClassName="absolute invisible whitespace-pre font-bold text-orange-400"
              className="text-orange-400 bg-transparent outline-none font-bold"
              onChange={(e) => handleChange("author", e)}
            />
          )}
        </div>

        {/* Share buttons */}
        <div className="flex items-center space-x-4">
          <span className="text-slate-400">Share this post:</span>
          <button
            type="button"
            className="text-slate-400 hover:text-white"
            disabled={readOnly}
          >
            <Twitter size={20} />
          </button>
          <button
            type="button"
            className="text-slate-400 hover:text-white"
            disabled={readOnly}
          >
            <Facebook size={20} />
          </button>
        </div>
      </div>
    </SortableCard>
  );
};

export default PostTitle;
