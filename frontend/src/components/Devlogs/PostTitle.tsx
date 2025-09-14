import React from "react";
import type {PageData} from "../../types/Devlogs";
import AutoWidthInput from "./AutoWidthInput";
import { Heart, Twitter, Facebook } from "lucide-react";
import SortableCard from "../Home/SortableCard";

interface PostTitleProps {
    id: string;
    pageData: PageData;
    handleChange: (key: keyof PageData, e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PostTitle: React.FC<PostTitleProps> = ({id, pageData,handleChange }) => {

    return (
      <SortableCard id={id}>
        <div className="col-span-2 mt-2 mb-6">
                <input
                  type="text"
                  className="text-3xl font-bold text-white mb-4 bg-transparent outline-none w-full"
                  value={pageData.postTitle}
                  onChange={(e) => handleChange("postTitle", e)}
                />
                <div className="flex items-center space-x-4 text-slate-400 mb-4">
                  <AutoWidthInput
                      value={pageData.gameInfoTitle}
                      spanClassName="absolute invisible whitespace-pre font-bold text-orange-400"
                      className="text-orange-400 bg-transparent outline-none font-bold"
                      onChange={(e) => handleChange("gameInfoTitle", e)}
                    />
                  <span>»</span>
                 <p className="bg-transparent outline-none">Devlog</p>
                </div>
                <div className="flex items-center space-x-6 mb-4">
                  <button type="button" className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded">
                    <Heart size={16} />
                    <span>Like</span>
                  </button>
                   <p className="text-slate-400 bg-transparent outline-none">1 day ago</p>
                  <span className="text-slate-400">by</span>
                  <AutoWidthInput
                      value={pageData.author}
                      spanClassName="absolute invisible whitespace-pre font-bold text-orange-400"
                      className="text-orange-400 bg-transparent outline-none font-bold"
                      onChange={(e) => handleChange("author", e)}
                    />
                </div>
                <div className="flex items-center space-x-4">
                 <span className="text-slate-400">Share this post:</span>
                 <button type="button" className="text-slate-400 hover:text-white">
                    <Twitter size={20} />
                  </button>
                  <button type="button" className="text-slate-400 hover:text-white">
                    <Facebook size={20} />
                  </button>
                </div>
              </div> 
      </SortableCard>
    );
};

export default PostTitle;