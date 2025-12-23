import React from 'react';
import { X, Box, Image as ImageIcon, Gamepad2 } from 'lucide-react';
import { POST_TYPES, PostType } from "../../types/postTypes";

interface PostTypeHeaderProps {
  active: PostType;
  onChange: (t: PostType) => void;
  onCancel: () => void;
}

// Icon Map updated to handle 'game' instead of 'text'
const ICON_MAP: Record<string, React.ReactNode> = {
  model: <Box size={22} />,
  media: <ImageIcon size={22} />,
  game: <Gamepad2 size={22} />, // Represents the Game Post form
};

const PostTypeHeader: React.FC<PostTypeHeaderProps> = ({
  active,
  onChange,
  onCancel,
}) => {
  return (
    <div className="relative flex items-center justify-center px-4 py-3 bg-white dark:bg-black border-b border-gray-100 dark:border-zinc-800">
      
      {/* Navigation Container with Constant Gap */}
      <div className="flex items-center justify-center gap-10"> 
        {POST_TYPES.map((t) => (
          <div key={t.id} className="group relative flex flex-col items-center">
            <button
              onClick={() => onChange(t.id)}
              className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
                active === t.id
                  ? "text-sky-500 bg-sky-50 dark:bg-sky-500/10 shadow-sm"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-900"
              }`}
            >
              {ICON_MAP[t.id]}
              
              {/* Active Indicator Bar */}
              <div className={`absolute -bottom-3 w-6 h-1 rounded-full transition-all duration-300 ${
                active === t.id ? "bg-sky-500 scale-x-100 opacity-100" : "scale-x-0 opacity-0 bg-transparent"
              }`} />
            </button>

            {/* Hover Tooltip - Automatically pulls "Game Post" from label */}
            <div className="absolute top-full mt-4 flex flex-col items-center opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 transform translate-y-[-8px] group-hover:translate-y-0 z-50">
              <div className="w-2 h-2 bg-zinc-900 dark:bg-zinc-200 rotate-45 -mb-1" />
              <span className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-2xl">
                {t.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Close Button */}
      <button 
        onClick={onCancel}
        className="absolute right-6 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-all"
        aria-label="Close"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default PostTypeHeader;