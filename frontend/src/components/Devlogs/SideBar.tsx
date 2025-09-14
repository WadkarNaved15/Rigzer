import React from "react";
import type { PageData } from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";

interface PurchaseProps {
    id: string;
    pageData: PageData;
    setPageData: React.Dispatch<React.SetStateAction<PageData>>;
}



const SideBar: React.FC<PurchaseProps> = ({id, pageData, setPageData }) => {
      const handleNestedChange = (
        parentKey: keyof PageData,
        childKey: keyof PageData["gameDetails"],
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => {
        setPageData((prev) => ({
          ...prev,
          [parentKey]: {
            ...prev[parentKey],
            [childKey]: e.target.value,
          },
        }));
      }
      

  return (
        <SortableCard id={id}>
              <div className="bg-slate-700 rounded-lg p-6 text-sm space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <input
                    type="text"
                    className="text-orange-400 bg-transparent outline-none text-right w-[80%]"
                    value={pageData.gameDetails.status}
                    onChange={(e) => handleNestedChange("gameDetails", "status", e)}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Author</span>
                  <input
                    type="text"
                    className="text-orange-400 bg-transparent outline-none text-right w-[80%]"
                    value={pageData.gameDetails.author}
                    onChange={(e) => handleNestedChange("gameDetails", "author", e)}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Genre</span>
                  <input
                    type="text"
                    className="text-orange-400 bg-transparent outline-none text-right w-[80%]"
                    value={pageData.gameDetails.genre}
                    onChange={(e) => handleNestedChange("gameDetails", "genre", e)}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tags</span>
                  <input
                    type="text"
                    className="text-orange-400 bg-transparent outline-none text-right w-[80%]"
                    value={pageData.gameDetails.tags}
                    onChange={(e) => handleNestedChange("gameDetails", "tags", e)}
                  />
                </div>
              </div>
          </SortableCard>
  );
};

export default SideBar;
