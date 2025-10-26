import React, { useMemo, useState } from "react";
import { useLikes } from "../../hooks/useLikes";
import PostHeader from "./PostHeader";
import PostInteractions from "./PostInteractions";
import CommentSection from "./CommentSection";
import "@google/model-viewer";
import type { ExePostProps } from "../../types/Post";
import axios from "axios";

const ExePost: React.FC<ExePostProps> = ({
  user,
  description,
  gameUrl,
  createdAt,
  comments = 0,
  _id,
}) => {
  const timestamp = useMemo(() => new Date(createdAt).toLocaleString(), [createdAt]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false); // ✅ toggle comment section

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);

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

      console.log("Game stream started:", response.data);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="relative bg-white w-full border-gray-200 dark:bg-black shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      <div className="p-4">
        <PostHeader username={user.username} timestamp={timestamp} />

        {description && (
          <div className="mb-4">
            <p className="text-gray-800 dark:text-gray-200">{description}</p>
          </div>
        )}
        {/* 3D model division */}
        <div className="flex justify-center relative overflow-hidden w-full h-[400px] rounded-xl">
          <div className="w-full h-full flex items-center justify-center">
            <model-viewer
              src="/models/free_1972_datsun_240k_gt.glb"
              alt="3D model"
              auto-rotate
              camera-controls
              style={{ width: "600px", height: "400px" }}
            ></model-viewer>
          </div>
        </div>
        {/* Game preview / play button */}
        {/* <div className="flex justify-center relative overflow-hidden w-full bg-gray-100 dark:bg-gray-700 h-[400px] rounded-xl">
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <button
              onClick={handleGameStream}
              disabled={loading}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
            >
              {loading ? "Loading..." : "Play Game"}
            </button>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>
        </div> */}

        <div className="w-[40%] p-4 pl-6 flex flex-col justify-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Game Details</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            <span className="font-semibold">URL:</span> {gameUrl}
          </p>
        </div>
      </div>

      {/* Post Interactions */}
      <PostInteractions
        likes={likesCount}
        comments={comments}
        isLiked={isLiked}
        onLike={handleLike}
        onCommentToggle={() => setShowComments(!showComments)} // ✅ toggle
      />

      {/* Comment Section (shown only if showComments is true) */}
      {showComments && <CommentSection postId={_id} BACKEND_URL={BACKEND_URL} />}
    </article>
  );
};

export default ExePost;
