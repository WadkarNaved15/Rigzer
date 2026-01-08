import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { PlusCircle } from "lucide-react";
import FollowFace from "./FollowFace";
import { useUser } from "../../context/user";
import FollowButton from "../FollowButton";
interface CanvasPreview {
  _id: string;
  title: string;
  hero_image_url?: string;
  author_name?: string;
}


type Face = "follow" | "reading" ;

const Tower: React.FC<{
  activeFace: Face;
  onOpenArticle: (canvasId: string) => void;
}> = ({ activeFace, onOpenArticle }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { user } = useUser();
  const cubeRef = useRef<HTMLDivElement>(null);
  const [readingCanvases, setReadingCanvases] = useState<CanvasPreview[]>([]);
  const [translateZ, setTranslateZ] = useState(150);

  // Recompute translateZ on mount + resize
  useEffect(() => {
    const update = () => {
      if (cubeRef.current) {
        setTranslateZ(cubeRef.current.offsetWidth / 2);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
useEffect(() => {
  axios
    .get(`${BACKEND_URL}/api/article/published`)
    .then(res => setReadingCanvases(res.data))
    .catch(console.error);
}, []);
// This logs the data every time it changes
useEffect(() => {
  console.log("Current Reading Canvases:", readingCanvases);
}, [readingCanvases]);
  // Map active face to rotation
  const rotation = useMemo(() => {
    // 0 degrees for follow, 180 degrees for reading
    return activeFace === "follow" ? "rotateY(0deg)" : "rotateY(-180deg)";
  }, [activeFace]);


  const ReadingFace = () => (
  <div
    className="face dark:text-white dark:bg-[#191919] overflow-y-auto"
    style={{ transform: `rotateY(180deg) translateZ(${translateZ}px)` }}
  >
    <div className="grid grid-cols-2 gap-3 px-2 py-3">
      {readingCanvases.map(canvas => (
        <div
          key={canvas._id}
          onClick={() => onOpenArticle(canvas._id)}
          className="cursor-pointer group"
        >
          <div className="aspect-[4/3] bg-[#111] rounded-lg overflow-hidden border border-white/10">
            {canvas.hero_image_url ? (
              <img
                src={canvas.hero_image_url}
                alt={canvas.title}
                className="w-full h-full object-cover group-hover:scale-105 transition"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-[#666]">
                No Thumbnail
              </div>
            )}
          </div>

          <h3 className="mt-2 text-sm font-medium line-clamp-2">
            {canvas.title}
          </h3>

          {canvas.author_name && (
            <p className="text-xs text-[#777]">{canvas.author_name}</p>
          )}
        </div>
      ))}
    </div>
  </div>
);

  return (
    <div className="flex-1 dark:bg-[#191919] h-full w-full overflow-hidden flex items-center justify-center perspective-1000">
      <div
        ref={cubeRef}
        className="relative w-full h-full flex justify-center preserve-3d transition-transform duration-700"
        style={{ transform: rotation }}
      >
        <FollowFace translateZ={translateZ}/>
        <ReadingFace />
      </div>
    </div>
  );
};

export default React.memo(Tower);
