import { useEffect, useState } from "react";
import ReadOnlyCanvas from "../components/Articles/ReadOnlyCanvas";

interface Props {
  canvasId: string;
  onClose: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

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
      {/* Modern Transparent Cross Icon */}
      <button
        onClick={onClose}
        aria-label="Close article"
        className="absolute top-6 left-6 z-50 p-2 rounded-full 
                   transition-all duration-200 ease-in-out
                   text-black/70 dark:text-white/70 
                   hover:bg-black/5 dark:hover:bg-white/10 
                   hover:text-black dark:hover:text-white
                   backdrop-blur-sm"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
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