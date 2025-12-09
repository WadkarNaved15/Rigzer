import React from "react";
import type { PageData } from "../../types/Devlogs";
import AutoResizeTextarea from "../Devlogs/AutoResizeTextarea";
import SortableCard from "../Home/SortableCard";

interface GameInfoProps {
  id: string;
  pageData: PageData;
  handleChange?: (key: keyof PageData, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  readOnly?: boolean;
}

const GameInfo: React.FC<GameInfoProps> = ({ id, pageData, handleChange, readOnly = false }) => {
  return (
    <SortableCard id={id}>
      <div className="col-span-1 space-y-6">
        <div className="bg-slate-700 rounded-lg p-6">
          {readOnly ? (
            <>
              <h2 className="text-xl font-bold text-white">{pageData.gameInfoTitle}</h2>
              <p className="text-slate-300 mt-2 whitespace-pre-wrap">
                {pageData.gameInfoDescription}
              </p>
            </>
          ) : (
            <>
              <input
                type="text"
                className="text-xl font-bold text-white bg-transparent outline-none w-full"
                value={pageData.gameInfoTitle}
                 onChange={(e) => handleChange && handleChange("gameInfoTitle", e)}
              />
              <AutoResizeTextarea
                value={pageData.gameInfoDescription}
                className="text-slate-300 bg-transparent outline-none w-full mt-2"
                onChange={(e) => handleChange && handleChange("gameInfoDescription", e)}
              />
            </>
          )}
        </div>
      </div>
    </SortableCard>
  );
};

export default GameInfo;
