import React from "react";
import type { GameDetails, PageData } from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";

interface SideBarProps {
  id: string;
  pageData: PageData;
  setPageData?: React.Dispatch<React.SetStateAction<PageData>>;
  readOnly?: boolean;
}

const SideBar: React.FC<SideBarProps> = ({
  id,
  pageData,
  setPageData,
  readOnly = false,
}) => {
  const handleNestedChange = (
    parentKey: keyof PageData,
    childKey: keyof PageData["gameDetails"],
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setPageData?.((prev) => ({
      ...prev,
      [parentKey]: {
  ...prev[parentKey] as GameDetails,
  [childKey]: e.target.value,
},

    }));
  };

  const fieldClass =
    "text-orange-400 bg-transparent outline-none text-right w-[80%]" +
    (readOnly ? " cursor-default opacity-80" : "");

  return (
    <SortableCard id={id}>
      <div className="bg-slate-700 rounded-lg p-6 text-sm space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-400">Status</span>
          <input
            type="text"
            className={fieldClass}
            value={pageData.gameDetails.status}
            onChange={(e) => handleNestedChange("gameDetails", "status", e)}
            readOnly={readOnly}
          />
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Author</span>
          <input
            type="text"
            className={fieldClass}
            value={pageData.gameDetails.author}
            onChange={(e) => handleNestedChange("gameDetails", "author", e)}
            readOnly={readOnly}
          />
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Genre</span>
          <input
            type="text"
            className={fieldClass}
            value={pageData.gameDetails.genre}
            onChange={(e) => handleNestedChange("gameDetails", "genre", e)}
            readOnly={readOnly}
          />
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Tags</span>
          <input
            type="text"
            className={fieldClass}
            value={pageData.gameDetails.tags}
            onChange={(e) => handleNestedChange("gameDetails", "tags", e)}
            readOnly={readOnly}
          />
        </div>
      </div>
    </SortableCard>
  );
};

export default SideBar;
