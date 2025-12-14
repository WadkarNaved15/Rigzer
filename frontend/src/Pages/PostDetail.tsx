import { useNavigate } from "react-router-dom";
import { X, UserPlus, UserCheck } from "lucide-react";
import { PostProps } from "../types/Post";

import "@google/model-viewer";

const PostDetail = ({ post, onClose }: { post: PostProps; onClose: () => void }) => {
  const navigate = useNavigate();
  return (
    <div className="w-full h-full flex justify-center">
      <div
        className="
    w-full max-w-7xl min-h-[80vh]
    overflow-y-auto
    bg-white text-black
    dark:bg-black dark:text-white
  "
      >


        {/* HEADER */}

        <div
          className="
    sticky top-0 z-30
    w-full
    border-b
    bg-white text-black
    dark:bg-black dark:text-white
    border-gray-200 dark:border-gray-800
    px-6 py-4
  "
        >
          <div className="flex items-center justify-between w-full">

            {/* LEFT: Username + Date */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0">
                  <img
                    src={
                      post.user.avatarUrl ??
                      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    }
                    alt={post.user.username}
                    className="h-full w-full object-cover"
                  />
                </div>


                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {post.user.username}
                </h3>
                <button
                  className="p-1 rounded-full transition-colors duration-150 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <UserPlus className="w-4 h-4 text-blue-500" />
                </button>
              </div>
            </div>

            {/* RIGHT: Price + Close */}
            <div className="flex items-center gap-2">
              {/* CLOSE BUTTON */}
              <button
                onClick={onClose}
                className="
          p-2 rounded-full
          transition-all duration-200
          text-gray-500
          hover:text-black dark:hover:text-white
          hover:bg-black/5 dark:hover:bg-white/10
        "
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

            </div>
          </div>
        </div>



        {/* MAIN HORIZONTAL LAYOUT */}
        <div className="px-6 py-10">
          <div className="grid grid-cols-12 gap-8 items-start">

            {/* LEFT CONTENT */}
            <aside className="col-span-3 space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  1972 Datsun 240K GT
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  High-quality 3D vehicle asset designed for real-time rendering
                  and interactive previews.
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Category</p>
                  <p className="font-medium">Vehicle</p>
                </div>

                <div>
                  <p className="text-gray-500 dark:text-gray-400">Format</p>
                  <p className="font-medium">GLB</p>
                </div>

                <div>
                  <p className="text-gray-500 dark:text-gray-400">Usage</p>
                  <p className="font-medium">Games / Web / AR</p>
                </div>
              </div>
            </aside>

            {/* CENTER — 3D MODEL */}
            <main className="col-span-6 flex justify-center">
              <div className="relative w-full h-[520px]">


                {/* @ts-ignore */}
                <model-viewer
                  src="/models/full_gameready_city_buildings.glb"
                  alt="3D model"
                  auto-rotate
                  camera-controls
                  shadow-intensity="1"
                  exposure="1"
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "transparent",
                  }}
                />


              </div>
            </main>

            {/* RIGHT CONTENT */}
            <aside className="col-span-3 space-y-6">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Polygons</p>
                  <p className="font-medium">Optimized</p>
                </div>

                <div>
                  <p className="text-gray-500 dark:text-gray-400">Textures</p>
                  <p className="font-medium">Included</p>
                </div>

                <div>
                  <p className="text-gray-500 dark:text-gray-400">License</p>
                  <p className="font-medium">Royalty-Free</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 text-sm">
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Inspect the model interactively. Zoom, rotate and analyze
                  geometry and textures in real time.
                </p>
              </div>
            </aside>

          </div>
        </div>

      </div>
    </div>
  );
};

export default PostDetail;
