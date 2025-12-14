import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
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
          flex items-center justify-between
          px-6 py-4
          border-b
          bg-white text-black
          dark:bg-black dark:text-white
          border-gray-200 dark:border-gray-800
          "
        >
          <h1 className="text-lg font-semibold tracking-tight">
            Asset Preview
          </h1>

          <button
            onClick={onClose}
            className="
      p-2 rounded-full
      hover:bg-black/5
      dark:hover:bg-white/10
      transition
    "
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
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
