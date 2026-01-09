import { useEffect, useState } from "react";
import ReadOnlyCanvas from "../components/Articles/ReadOnlyCanvas";

interface Props {
  canvasId: string;
  onClose: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const CANVAS_WIDTH = 750;
const GAP = 20; // The specific gap you want (in pixels)
export default function ArticleOverlay({ canvasId, onClose }: Props) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/article/${canvasId}`)
      .then(res => res.json())
      .then(setData);
  }, [canvasId]);

  if (!data) {
    return (
      <div className="h-[80vh] flex items-center justify-center text-[#888]">
        Loading article...
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Premium Close Button - Anchored to Canvas Edge */}
      <button
        onClick={onClose}
        aria-label="Close article"
        style={{ 
          left: `calc(50% + ${CANVAS_WIDTH / 2}px + ${GAP}px)` 
        }}
        className="
          /* CHANGED LINE: Removed 'right-8' and added 'fixed top-24' with style anchor */
          fixed top-20 z-[60] 
          p-3 rounded-full transition-all duration-300 ease-in-out
          
          /* LIGHT THEME: Dark content */
          bg-white/40 text-black border border-black/10
          hover:bg-black hover:text-white
          
          /* DARK THEME: Light content */
          dark:bg-black/40 dark:text-white dark:border-white/20
          dark:hover:bg-white dark:hover:text-black
          
          /* Glassmorphism & Depth */
          backdrop-blur-xl shadow-xl active:scale-90
        "
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="22" 
          height="22" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <ReadOnlyCanvas data={data} />
    </div>
  );
}