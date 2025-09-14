import React, { useRef } from "react";
import SortableCard from "./SortableCard";

interface GameLogoCardProps {
  id: string;
  pageData: any;
  setPageData: React.Dispatch<React.SetStateAction<any>>;
  handleChange: (field: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly?: boolean;
}

const GameLogoCard: React.FC<GameLogoCardProps> = ({
  id,
  pageData,
  setPageData,
  handleChange,
}) => {
  const titleImageRef = useRef<HTMLInputElement>(null);

  return (
    <SortableCard id={id}>
      <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
        <div className="text-center mt-2">
          <div className="inline-block relative w-full">
            {pageData?.gameTitleImage ? (
              <div className="relative">
                <img
                  src={pageData.gameTitleImage.url}
                  alt="Game Title"
                  className="mx-auto w-full max-h-72 object-cover"
                />
                {!readonly && (
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded"
                  onClick={() =>
                    setPageData((prev: any) => ({
                      ...prev,
                      gameTitleImage: null,
                    }))
                  }
                >
                  ✕
                </button>
                )}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="text-3xl font-bold text-orange-400 mb-2 bg-transparent text-center outline-none"
                  style={{
                    textShadow: "3px 3px 0px #d97706, 6px 6px 0px #92400e",
                    WebkitTextStroke: "2px #ffffff",
                  }}
                  value={pageData.gameTitle}
                  onChange={(e) => handleChange("gameTitle", e)}
                />
                <div className="w-full h-1 bg-orange-400 rounded"></div>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              ref={titleImageRef}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPageData((prev: any) => ({
                    ...prev,
                    gameTitleImage: {
                      url: URL.createObjectURL(file),
                      type: file.type,
                    },
                  }));
                }
              }}
            />
            <div className="mt-4 flex justify-center gap-4">
              <button
                type="button"
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
                onClick={() => titleImageRef.current?.click()}
              >
                Upload Title Image
              </button>
            </div>
          </div>
        </div>
      </div>
    </SortableCard>
  );
};

export default GameLogoCard;
