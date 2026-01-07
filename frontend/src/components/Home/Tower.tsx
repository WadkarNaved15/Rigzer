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


type Face = "follow" | "posts" | "reading" | "projects";

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
    const map: Record<Face, string> = {
      follow: "rotateY(0deg)",
      posts: "rotateY(-90deg)",
      reading: "rotateY(-180deg)",
      projects: "rotateY(-270deg)",
    };
    return map[activeFace];
  }, [activeFace]);


  const PostsFace = () => (
    <div
      className="face dark:text-white dark:bg-[#151515] overflow-y-auto"
      style={{ transform: `rotateY(90deg) translateZ(${translateZ}px)` }}
    >
      <div className="h-full space-y-4 px-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border-b pb-4">
            <div className="flex items-center gap-2 mb-2">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                alt={`Author ${i + 1}`}
                className="w-8 h-8 rounded-full"
              />
              <span className="font-semibold mb-2">Author {i + 1}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2 dark:text-gray-200">
              Sample post content that demonstrates layout and readability.
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const ReadingFace = () => (
  <div
    className="face dark:text-white dark:bg-[#151515] overflow-y-auto"
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


  const ProjectsFace = () => (
    <div
      className="face dark:text-white dark:bg-[#151515] overflow-y-auto"
      style={{ transform: `rotateY(-90deg) translateZ(${translateZ}px)` }}
    >
      <div className="h-full space-y-4 px-2">
        <h3 className="font-semibold mb-2">Projects</h3>
        <ul className="list-disc pl-6 text-gray-600 dark:text-gray-200 space-y-1">
          <li>Voxel Sandbox</li>
          <li>Roguelike Toolkit</li>
          <li>WebGL Racer</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="flex-1 dark:bg-[#151515] h-full w-full overflow-hidden flex items-center justify-center perspective-1000">
      <div
        ref={cubeRef}
        className="relative w-full h-full flex justify-center preserve-3d transition-transform duration-700"
        style={{ transform: rotation }}
      >
        <FollowFace translateZ={translateZ}/>
        <PostsFace />
        <ReadingFace />
        <ProjectsFace />
      </div>
    </div>
  );
};

export default React.memo(Tower);
