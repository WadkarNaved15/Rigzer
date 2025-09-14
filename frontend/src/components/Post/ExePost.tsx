import React, { useMemo, useState } from 'react';
import PostHeader from './PostHeader';
import PostInteractions from './PostInteractions';
import type { ExePostProps } from '../../types/Post';
import axios from 'axios';

const ExePost: React.FC<ExePostProps> = ({
  user,
  description,
  gameUrl,
  createdAt,
  likes = 0,
  comments = 0,
}) => {
  const timestamp = useMemo(() => new Date(createdAt).toLocaleString(), [createdAt]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const handleGameStream = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/gameRoutes/start_game`, {
        gameUrl,
      });

      if (response.status !== 200) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = response.data;
      console.log('Game stream started:', data);

      // further logic...
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <article
      className="relative bg-white w-full border-gray-200
      dark:bg-black shadow-sm
      overflow-hidden transition-all duration-300 hover:shadow-md
      /* top bolt */
      before:content-[''] before:absolute before:top-0 before:left-0
      before:h-[2px] before:w-32
      before:bg-gradient-to-r before:from-gray-400 before:via-gray-600 before:to-transparent
      before:animate-shine

      /* left bolt */
      after:content-[''] after:absolute after:top-0 after:left-0
      after:w-[0.75px] after:h-[40px]
      after:bg-gradient-to-b after:from-gray-400 after:via-gray-600 after:to-transparent
      after:animate-shine-vertical"
    >
      {/* ⚪ Bottom-right bolts */}
      <span className="absolute bottom-0 right-0 h-[0.75px] w-[40px]
        bg-gradient-to-l from-gray-400 via-gray-600 to-transparent animate-shine" />
      <span className="absolute bottom-0 right-0 w-[0.75px] h-[40px]
        bg-gradient-to-t from-gray-400 via-gray-600 to-transparent animate-shine-vertical" />

      <div className="p-4">
        <PostHeader username={user.username} timestamp={timestamp} />

        {description && (
          <div className="mb-4">
            <p className="text-gray-800 dark:text-gray-200">{description}</p>
          </div>
        )}
        <div className="w-full flex">
          <div className="flex justify-center relative overflow-hidden w-[60%] bg-gray-100 dark:bg-gray-700  h-[400px] rounded-xl">
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              {error && <p className="text-red-500 mt-2">{error}</p>}
            </div>
          </div>
          <div className="w-[40%] p-4 pl-6 flex flex-col justify-center">
            <model-viewer
              src="/models/2016_rezvani_beast_x.glb"
              alt="3D Car Model"
              auto-rotate
              autoplay
              disable-zoom
              disable-pan
              disable-tap
              style={{ width: "100%", height: "400px", background: "transparent" }}
            ></model-viewer>
          </div>
        </div>
      </div>

      <PostInteractions likes={likes} comments={comments} />
    </article>
  );
};

export default ExePost;