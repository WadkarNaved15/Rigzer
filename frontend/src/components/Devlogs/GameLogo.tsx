import React, { useRef ,useEffect} from "react";
import type {PageData} from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";



interface GameLogoCardProps {
    id: string;
    pageData: PageData;
    setPageData: React.Dispatch<React.SetStateAction<PageData>>;
    handleChange: (key: keyof PageData, e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * A component that displays either a logo image for the game
 * or an editable text title with an upload button.
 */
const GameLogoCard: React.FC<GameLogoCardProps> = ({ id,pageData, setPageData,handleChange }) => {
  const titleImageRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
  return () => {
    if (pageData.gameTitleImage?.url) {
      URL.revokeObjectURL(pageData.gameTitleImage.url);
    }
  };
}, [pageData.gameTitleImage]);


//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setPageData((prev) => ({
//       ...prev,
//       gameTitle: e.target.value,
//     }));
//   };

//  const handleFileChange = (key: keyof PageData, e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file) {
//       const newImageUrl = URL.createObjectURL(file);
//       setPageData((prev) => ({ ...prev, [key]: newImageUrl }));
//     }
//   };

  return (
    <SortableCard id={id}>
    <div className="col-span-2 text-center mt-12">
                <div className="inline-block relative w-full">
                  {pageData?.gameTitleImage ? (
                    <div className="relative">
                      <img
                        src={pageData.gameTitleImage.url}
                        alt="Game Title"
                        className="mx-auto w-full max-h-72 object-contain"
                      />
                      <button
                        type="button"
                        className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded"
                        onClick={() =>
                          setPageData((prev) => ({ ...prev, gameTitleImage: null }))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        className="text-6xl font-bold text-orange-400 mb-2 bg-transparent text-center outline-none"
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
                            setPageData(prev => ({
                            ...prev,
                            gameTitleImage: { url: URL.createObjectURL(file), type: file.type }
                            }));
                        }
                        e.target.value = ""; // 👈 clear so picking the same file again triggers onChange
                        }}

                  />
                  <div className="mt-4 flex justify-center gap-4">
                    <button
                      type="button"
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
                      onClick={() => titleImageRef.current.click()}
                    >
                      Upload Title Image
                    </button>
                  </div>
                </div>
              </div>
            </SortableCard>
  );
};

export default GameLogoCard;
