import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import FollowFace from "./FollowFace";
import PocketPost from "../Post/PocketPost";
import { usePublishedArticles } from "../../context/PublishedArticleContext";
interface CanvasPreview {
  _id: string;
  title: string;
  hero_image_url?: string;
  author_name?: string;
}
interface Pocket {
  _id: string;
  user: {
    username: string;
    avatar?: string;
  };
  createdAt: string;
  brandName: string;
  tagline?: string;
  compiledBundleUrl: string;
}

type Face = "follow" | "reading" | "pockets";

const Tower: React.FC<{
  activeFace: Face;
}> = ({ activeFace }) => {
  const { articles } = usePublishedArticles();
  const cubeRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [loadingPockets, setLoadingPockets] = useState(false);
  const [translateZ, setTranslateZ] = useState(150);

  useEffect(() => {
    const update = () => {
      if (cubeRef.current) {
        // Keeping the 0.45 multiplier for breathing room
        setTranslateZ(cubeRef.current.offsetWidth * 0.45);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const rotation = useMemo(() => {
    if (activeFace === "follow") return "rotateY(0deg)";
    if (activeFace === "reading") return "rotateY(-120deg)";
    return "rotateY(-240deg)";
  }, [activeFace]);

  useEffect(() => {
    if (activeFace !== "pockets") return;

    setLoadingPockets(true);

    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fetchpockets/fetch_pockets`)
      .then((res) => res.json())
      .then((data) => {
        setPockets(data.pockets || []);
      })
      .catch(() => { })
      .finally(() => setLoadingPockets(false));
  }, [activeFace]);

  return (
    <div className="h-full w-full bg-[#F3F4F6] dark:bg-[#191919] overflow-hidden flex perspective-2000">
      <div
        ref={cubeRef}
        className="relative w-full h-full preserve-3d transition-transform duration-700 ease-in-out"
        style={{ transform: rotation }}
      >
        {/* FACE 1: FOLLOW (Already corrected previously) */}
        <FollowFace translateZ={translateZ} />

        {/* FACE 2: READING - Now fixed with absolute positioning and backface logic */}
        <div
          className="absolute inset-0 face bg-[#F3F4F6] dark:bg-[#191919] dark:text-white overflow-y-auto backface-hidden"
          style={{ transform: `rotateY(120deg) translateZ(${translateZ}px)` }}
        >
          {/* Internal scrollable container */}
          <div className="grid grid-cols-2 gap-4 px-3 py-6">
            {articles.map((canvas) => (
              <div
                key={canvas._id}
                onClick={() => navigate(`/articles/${canvas._id}`)}
                className="cursor-pointer group flex flex-col"
              >
                <div className="relative aspect-[3/4] bg-gray-200 dark:bg-[#111] rounded-xl overflow-hidden border border-[#E0E0E5] dark:border-white/5 shadow-lg transition-transform duration-300 group-hover:border-purple-500/50 group-hover:shadow-purple-500/10">
                  {canvas.hero_image_url ? (
                    <img
                      src={canvas.hero_image_url}
                      alt={canvas.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-400 dark:text-[#444] space-y-2">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <PlusCircle size={14} />
                      </div>
                      <span>No Image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>

                <div className="mt-3 px-1">
                  <h3 className="text-xs font-semibold line-clamp-2 leading-tight text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {canvas.title}
                  </h3>
                  {canvas.author_name && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-500 dark:text-[#777] font-medium">
                      {canvas.author_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* FACE 3: POCKETS 👇 ADD THIS HERE */}
        <div
          className="absolute inset-0 bg-[#F3F4F6] dark:bg-[#191919] overflow-y-auto backface-hidden"
          style={{ transform: `rotateY(240deg) translateZ(${translateZ}px)` }}
        >
          {loadingPockets ? (
            <div className="text-center mt-10 text-gray-400">
              Loading pockets...
            </div>
          ) : pockets.length === 0 ? (
            <div className="text-center mt-10 text-gray-400">
              No pockets yet
            </div>
          ) : (
            pockets.map((pocket) => (
              <PocketPost key={pocket._id} {...pocket} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(Tower);
