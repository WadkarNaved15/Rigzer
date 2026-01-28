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
    .get(`${BACKEND_URL}/api/articles/published`)
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
    <div className="grid grid-cols-2 gap-4 px-3 py-4">
      {readingCanvases.map((canvas) => (
        <div
          key={canvas._id}
          onClick={() => onOpenArticle(canvas._id)}
          className="cursor-pointer group flex flex-col"
        >
          {/* Vertical Article Thumbnail Layout */}
          <div className="relative aspect-[3/4] bg-[#111] rounded-xl overflow-hidden border border-white/5 shadow-lg transition-all duration-300 group-hover:border-purple-500/50 group-hover:shadow-purple-500/10">
            {canvas.hero_image_url ? (
              <img
                src={canvas.hero_image_url}
                alt={canvas.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#444] space-y-2">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                   <PlusCircle size={14} />
                </div>
                <span>No Image</span>
              </div>
            )}
            
            {/* Subtle Gradient for "Premium" feel */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>

          <div className="mt-3 px-1">
            <h3 className="text-xs sm:text-sm font-semibold line-clamp-2 leading-tight group-hover:text-purple-400 transition-colors">
              {canvas.title}
            </h3>

            {canvas.author_name && (
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[#777] font-medium">
                {canvas.author_name}
              </p>
            )}
          </div>
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
