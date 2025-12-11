import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface PostHeaderProps {
  username: string;
  timestamp: string;
  avatarUrl?: string;
}

const PostHeader: React.FC<PostHeaderProps> = ({
  username,
  timestamp,
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
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
    <div className="flex justify-between items-center">

      {/* LEFT SIDE: avatar + name + timestamp */}
      <div className="flex items-center gap-3 rounded-xl mb-4">
        <img
          src={avatarUrl}
          alt={username}
          className="h-10 w-10 rounded-full object-cover"
          loading="lazy"
        />

        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{username}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{timestamp}</p>
        </div>
      </div>

      {/* SPACER */}
      <div className="flex-1" />

      {/* PRICE (Far Right) */}
      <span
        className="
    text-sm font-semibold text-[#5799EF]
    p-2 rounded-full 
    hover:bg-[#5799EF]/20 
    transition-all duration-200
    cursor-pointer
  "
      >
        $25
      </span>


      {/* MENU BUTTON */}
      <div className="absolute top-1 right-6" ref={menuRef}>
        <button
          className="dark:text-gray-400 hover:text-black dark:hover:text-white"
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
  );
};

export default PostHeader;
