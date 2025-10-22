import React, { memo, useMemo} from 'react';
import PostHeader from './PostHeader';
import PostInteractions from './PostInteractions';
import { useLikes } from '../../hooks/useLikes';
import type { NormalPostProps } from '../../types/Post'; 
const NormalPost: React.FC<NormalPostProps> = ({
  user,
  description,
  media,
  createdAt,
  comments = 0,
  _id
}) => {
  const timestamp = useMemo(() => new Date(createdAt).toLocaleString(), [createdAt]);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const mediaUrl = media?.[0] ?? '';
  const isVideo = useMemo(() => /\.(mp4|webm|ogg)$/i.test(mediaUrl), [mediaUrl]);

  return (
<article
  className="relative bg-white border w-full border-gray-200 
  dark:border-gray-600 dark:bg-black shadow-sm 
  overflow-hidden transition-all duration-300 hover:shadow-md
  /* top bolt */
  before:content-[''] before:absolute before:top-0 before:left-0 
  before:h-[2px] before:w-32 
  before:bg-gradient-to-r before:from-[#3D7A6E] before:via-teal-400 before:to-transparent
  before:animate-shine
  /* left bolt */
  after:content-[''] after:absolute after:top-0 after:left-0 
  after:w-[0.75px] after:h-[40px]
  after:bg-gradient-to-b after:from-[#3D7A6E] after:via-teal-400 after:to-transparent
  after:animate-shine-vertical"
>
      <div className="p-4">
        <PostHeader username={user.username} timestamp={timestamp} />

        {description && (
          <p className="mb-4 text-gray-800 dark:text-gray-200">{description}</p>
        )}

        <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-700 h-[400px] rounded-xl">
          {mediaUrl ? (
            isVideo ? (
              <video
                controls
                className="w-full h-full object-contain"
                src={mediaUrl}
                preload="metadata"
              />
            ) : (
              <img
                src={mediaUrl}
                alt="Post content"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400">No media available</p>
            </div>
          )}
        </div>

        <PostInteractions likes={likesCount} comments={comments} isLiked={isLiked} onLike={handleLike} />
      </div>
    </article>
  );
};

export default memo(NormalPost);
