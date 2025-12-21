import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface PostHeaderProps {
  username: string;
  timestamp: string;
  price: number;
}

const PostHeader: React.FC<PostHeaderProps> = ({
  username,
  timestamp,
  price
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex items-center justify-between w-full">

      {/* LEFT: Avatar + Username + Date */}
      <div className="flex items-center gap-3">

        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{username}</h3>
          <span className="text-gray-400">•</span>
          <p className="text-sm text-gray-500 dark:text-gray-400">{timestamp}</p>
        </div>
      </div>

      {/* RIGHT: Price + Menu Button */}
      <div className="flex items-center">

        {/* PRICE */}
        <span
          className="
          text-sm font-semibold text-[#5799EF]
          p-2 rounded-full 
          bg-[#5799EF]/20 
          transition-all duration-200
          cursor-pointer
          hover:text-black dark:hover:text-white
          "
        >
          ${price}
        </span>


        {/* MENU BUTTON */}
        <div className="relative" ref={menuRef}>
          <button
            className="
              p-2 rounded-full transition-all duration-200 
              dark:text-gray-400 
              hover:text-black dark:hover:text-white
            "
            onClick={toggleMenu}
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20">
              <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                Report
              </button>
              <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                Copy link
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PostHeader;
