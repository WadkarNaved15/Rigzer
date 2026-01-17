import {
  X, UserPlus, UserCheck, Box, Layers, Cpu, Maximize2,
  Paintbrush, Image as ImageIcon,
  Move, Activity, Download, ShoppingCart, CreditCard, ShieldCheck, Info, HardDrive, FileCode, Monitor, Tag
} from "lucide-react";
import { ExePostProps } from "../types/Post";
import CommentSection from "../components/Post/CommentSection";
import { useState } from "react";
import "@google/model-viewer";

const PostDetail = ({ post, onClose }: { post: ExePostProps; onClose: () => void }) => {
  const assets = post.modelPost?.assets ?? [];
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
  const title = post.modelPost?.title
  const price = post.modelPost?.price
  const [activeIndex, setActiveIndex] = useState(0);
  const activeAsset = assets[activeIndex];
  const meta = activeAsset?.metadata;

  return (
    <>
      <div className="w-full flex justify-center">
        <div
          className="
    w-full max-w-7xl 
            /* 1. Changed min-h to fit content instead of forcing 80% screen height */
            h-auto 
            bg-white text-black
            dark:bg-[#191919] dark:text-white
            overflow-visible
  "
        >


          {/* HEADER */}

          <div
            className="
    sticky top-0 z-30
    w-full
    border-b
    bg-white text-black
    dark:bg-[#191919] dark:text-white
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
          hover:bg-[#191919]/5 dark:hover:bg-white/10
        "
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>
            </div>
          </div>



          {/* MAIN HORIZONTAL LAYOUT */}
          <div className="px-6 pb-4">
            <div className="grid grid-cols-12 gap-8 items-start">

              {/* LEFT CONTENT */}
              <aside className="col-span-3 flex flex-col gap-8">
                {/* TITLE & DESCRIPTION */}
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                    Premium Asset
                  </div>

                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
                      {title ?? "Untitled 3D Model"}
                    </h2>
                    <div className="mt-4 prose prose-sm dark:prose-invert">
                      <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                        {post.description || "No description provided for this high-quality 3D asset."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* FILE QUICK SPECS */}
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-neutral-900/40 border border-gray-100 dark:border-white/5 space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200/50 dark:border-white/5">
                    <Info className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">File Details</span>
                  </div>

                  <div className="grid gap-4">
                    {/* File Size */}
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-sm border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                          <HardDrive className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Size</p>
                      </div>
                      <p className="text-sm font-bold">{meta.downloadSizeMB} MB</p>
                    </div>

                    {/* Format */}
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-sm border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                          <FileCode className="w-4 h-4 text-purple-500" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Format</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20">
                        GLB / GLTF
                      </span>
                    </div>



                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        {/* Icon changed to 'Tag' to better represent price/commerce */}
                        <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-sm border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                          <Tag className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Price</p>
                      </div>

                      {/* Price styled as a prominent, clean badge */}
                      <div className="flex flex-col items-end">
                        <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-bold border border-green-500/20 shadow-sm">
                          ${price ?? "0.00"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              {/* CENTER — 3D MODEL */}
              {/* CENTER — ENHANCED 3D MODEL VIEWER */}
              <main className="col-span-6 flex flex-col items-center">
                {/* The Container: Added a stage-like gradient and deep shadows */}
                <div className="relative w-full h-[580px] rounded-2xl overflow-hidden bg-gradient-to-b from-gray-50 to-gray-200 dark:from-neutral-900 dark:to-black border border-gray-200 dark:border-gray-800 shadow-2xl">

                  {/* Model Viewer Logic: Added environment-image and exposure for better rendering */}
                  {/* @ts-ignore */}
                  <model-viewer
                    src={activeAsset.url}
                    alt="3D model"
                    auto-rotate
                    camera-controls
                    shadow-intensity="2"
                    shadow-softness="1"
                    exposure="1.2"
                    environment-image="neutral"
                    loading="eager"
                    style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
                  >
                    {/* Visual Loading State */}
                    <div slot="progress-bar" className="w-full h-1 bg-blue-500 animate-pulse" />
                    {/* @ts-ignore */}
                  </model-viewer>

                  {/* Asset Selection Logic: Floated inside the viewer with Glassmorphism */}
                  {assets.length > 1 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl bg-white/70 dark:bg-[#191919]/70 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl flex gap-3 z-10">
                      {assets.map((asset, idx) => (
                        <button
                          key={asset.url}
                          onClick={() => setActiveIndex(idx)}
                          className={`group relative flex flex-col items-center transition-all duration-300 ${idx === activeIndex ? "scale-110" : "opacity-60 hover:opacity-100"
                            }`}
                        >
                          {/* Asset Icons: Replaced text with a visual box + glow effect */}
                          <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all
              ${idx === activeIndex
                              ? "border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                              : "border-transparent bg-gray-200 dark:bg-white/10"}
            `}>
                            <Box className={`w-6 h-6 ${idx === activeIndex ? "text-blue-500" : "text-gray-500"}`} />
                          </div>

                          {/* Miniature Label */}
                          <span className={`text-[10px] mt-1 font-bold uppercase tracking-tighter ${idx === activeIndex ? "text-blue-500" : "text-gray-400"
                            }`}>
                            {asset.name.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sub-viewer hint */}
                <div className="mt-4 flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-widest">
                  <div className="h-px w-8 bg-gray-300 dark:bg-gray-700" />
                  <span>Interactive 3D Preview</span>
                  <div className="h-px w-8 bg-gray-300 dark:bg-gray-700" />
                </div>
              </main>

              {/* RIGHT CONTENT */}
              <aside className="col-span-3 space-y-8 text-sm">
                {/* TECHNICAL SPECIFICATIONS GROUP */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Technical Specs</h4>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Geometry Info */}
                    <div className="group p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50 transition-all hover:border-blue-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <Maximize2 className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold">Geometry</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-gray-500 dark:text-gray-400">Meshes</p>
                          <p className="font-mono font-medium">{meta.geometry.meshes}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-gray-500 dark:text-gray-400">Vertices</p>
                          <p className="font-mono font-medium">{meta.geometry.vertices.toLocaleString()}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-gray-500 dark:text-gray-400">Triangles</p>
                          <p className="font-mono font-medium">{meta.geometry.triangles.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Surface & Materials */}
                    <div className="group p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50 transition-all hover:border-blue-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <Paintbrush className="w-4 h-4 text-purple-500" />
                        <span className="font-semibold">Surface</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-gray-500 dark:text-gray-400">Materials</p>
                          <p className="font-medium">{meta.materials}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-gray-500 dark:text-gray-400">Textures</p>
                          <p className={`font-medium ${meta.textures.present ? "text-green-500" : "text-gray-400"}`}>
                            {meta.textures.present ? "Included" : "None"}
                          </p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-gray-500 dark:text-gray-400">UV Layers</p>
                          <p className="font-medium">{meta.uvLayers}</p>
                        </div>
                      </div>
                    </div>

                    {/* Capabilities */}
                    <div className="group p-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50 transition-all hover:border-blue-500/30">
                      <div className="flex items-center gap-3 mb-3">
                        <Activity className="w-4 h-4 text-orange-500" />
                        <span className="font-semibold">Capabilities</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-gray-500 dark:text-gray-400">Rigged</p>
                          <p className="font-medium">{meta.rigged ? "✅ Ready" : "❌ No"}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-gray-500 dark:text-gray-400">Animations</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.animations.present ? "bg-orange-500/10 text-orange-500" : "bg-gray-100 text-gray-400"}`}>
                            {meta.animations.present ? `${meta.animations.count} Sequences` : "Static"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA SECTION */}
                <div className="pt-6 space-y-4 border-t border-gray-200 dark:border-neutral-800">
                  <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                    <ShieldCheck className="w-5 h-5" />
                    Buy Assets
                  </button>

                  <p className="text-center text-[11px] text-gray-400 uppercase tracking-widest font-medium">
                    License: Standard Digital Media
                  </p>
                </div>
              </aside>


            </div>
          </div>

        </div>
      </div>
      <div className="w-full max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-9">
            <CommentSection
              postId={post._id}
              BACKEND_URL={BACKEND_URL}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default PostDetail;