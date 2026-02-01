import React from "react";
import { Star, Heart, Plus, Play, Image, Video, X, Settings, Youtube, Instagram } from "lucide-react";
import FollowButton from "../FollowButton";
import FollowersList from "../FollowersList";
import { useEffect, useState, useRef, useLayoutEffect } from "react";
import Post from "../Post";
import { Suspense, lazy } from "react";
import type { ExePostProps, NormalPostProps } from "../../types/Post";
const NormalPostDetails = lazy(() => import("../../Pages/NormalPostDetails"));
const PostDetails = lazy(() => import("../../Pages/PostDetail"));
import type { PostProps } from "../../types/Post";
import { useUser } from "../../context/user";
import axios from "axios";
interface ProfilePageProps {
  setProfileOpen: (open: boolean) => void;
}
const ProfilePage: React.FC<ProfilePageProps> = ({ setProfileOpen }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [userPosts, setUserPosts] = useState<PostProps[]>([]);
  const leftRef = useRef<HTMLDivElement>(null);
  const [postDetailsOpen, setPostDetailsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostProps | null>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isModelPostOpen =
    postDetailsOpen && selectedPost?.type === "model_post";
  const [loadingPosts, setLoadingPosts] = useState(false);
  const { user } = useUser();
  useEffect(() => {
    if (!user?._id) return;

    const fetchUserPosts = async () => {
      setLoadingPosts(true);
      try {
        const res = await axios.get(
          `${BACKEND_URL}/api/posts/user_posts/${user._id}`
        );
        setUserPosts(res.data.posts);
      } catch (err) {
        console.error("Failed to load user posts", err);
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchUserPosts();
  }, [user?._id]);


  console.log("User in ProfilePage:", user);
  console.log("User posts in ProfilePage:", userPosts);
  return (
    <div className="relative pt-2 min-h-screen bg-gray-100 dark:bg-[#191919] text-gray-900 dark:text-white">
      {/* Close Button */}
      <button
        onClick={() => setProfileOpen(false)}
        className="absolute top-2 right-2 rounded-full text-black dark:text-gray-100 
               hover:bg-gray-300 dark:hover:bg-gray-700 transition-all p-2"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main Content - 75% width */}
      <div className="mx-auto px-2 ">
        {/* Header Section */}
        <div className="w-full border-b border-white/10 bg-[#191919] pb-8 mb-8 pt-4">
          {/* Main Header Container */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between px-6 max-w-6xl mx-auto">

            <div className="flex flex-col gap-1">
              {/* Name and Action Button Row */}
              <div className="flex items-center gap-5 flex-wrap">
                <h1 className="text-4xl font-black tracking-tight text-white italic uppercase">
                  {user?.username || "John Developer"}
                </h1>

                <button className="bg-white hover:bg-gray-200 text-[#191919] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] active:scale-95">
                  Edit Profile
                </button>
              </div>
            </div>
            <div className="md:mr-20 lg:mr-8">
              <FollowersList userId={user?._id} />
            </div>
          </div>
        </div>
        {/* Profile Hero Section */}
        <div className="w-full max-w-6xl flex justify-between items-start">

          {/* LEFT SIDE: Profile Card Section */}
          <div className="w-full max-w-5xl px-4 pt-2">
            <div className="relative overflow-hidden rounded-3xl bg-[#191919] border border-white/10 shadow-2xl min-h-[400px]">

              {/* 1. Banner Section */}
              <div className="relative h-32 md:h-48 overflow-hidden">
                <img
                  src="https://fastly.picsum.photos/id/299/800/200.jpg?hmac=xMdRbjiNM_IogJDEgKIJ0GeCxZ8nwOGd5_Wf_ODZ94s"
                  className="w-full h-full object-cover"
                  alt="Cover"
                />
                {/* Overlay gradient to blend the bottom of the banner */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, transparent 0%, rgba(25, 25, 25, 0.2) 30%, rgba(25, 25, 25, 0.7) 60%, #191919 100%)`
                  }}
                />
              </div>

              <div className="relative px-6 -mt-14 md:-mt-20 flex flex-col items-center text-center md:flex-row md:items-end md:text-left gap-6 z-10">
                <div className="relative group shrink-0">
                  <img
                    src={user?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&h=256&auto=format&fit=crop"}
                    className="relative w-28 h-28 md:w-40 md:h-40 rounded-full object-cover border-4 md:border-8 border-[#191919] shadow-2xl hover:scale-105 transition-transform duration-300 cursor-pointer bg-[#191919]"
                    alt="Avatar"
                  />
                </div>

                {/* Profile Text - Adjusted margin to align with bottom of the overlapping pic */}
                <div className="md:mb-4">
                  <p className="text-gray-400 font-medium text-xs md:text-sm leading-relaxed max-w-sm">
                    With an <span className="text-white">authoritative voice</span> and calm demeanor...
                  </p>
                </div>
              </div>

              {/* Remaining space for content */}
              <div className="p-6 pt-10">
                {/* Other content goes here */}
              </div>
            </div>
          </div>

          <div className="w-40 shrink-0 pt-2">
            <div className="bg-[#191919] p-4 rounded-3xl border border-white/10 text-white shadow-2xl flex flex-col gap-4 items-center">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Socials</h3>

              <div className="flex flex-col gap-3 w-full">

                {/* X (Twitter) - Custom SVG for the 'X' logo */}
                <a href="#" className="group relative flex items-center justify-center w-full h-12 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl transition-all duration-300">
                  <svg className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                  </svg>
                  <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white text-black text-[10px] font-bold py-1 px-3 rounded-md pointer-events-none uppercase tracking-tighter">
                    Twitter
                  </div>
                </a>

                {/* YouTube */}
                <a href="#" className="group relative flex items-center justify-center w-full h-12 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/40 rounded-2xl transition-all duration-300">
                  <Youtube className="w-5 h-5 text-gray-400 group-hover:text-red-500 group-hover:scale-110 transition-all" />
                  <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-red-600 text-white text-[10px] font-bold py-1 px-3 rounded-md pointer-events-none uppercase tracking-tighter">
                    YouTube
                  </div>
                </a>

                {/* Instagram */}
                <a href="#" className="group relative flex items-center justify-center w-full h-12 bg-white/5 hover:bg-pink-500/10 border border-white/5 hover:border-pink-500/40 rounded-2xl transition-all duration-300">
                  <Instagram className="w-5 h-5 text-gray-400 group-hover:text-pink-500 group-hover:scale-110 transition-all" />
                  <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-tr from-yellow-400 to-pink-600 text-white text-[10px] font-bold py-1 px-3 rounded-md pointer-events-none uppercase tracking-tighter">
                    Instagram
                  </div>
                </a>

                {/* Steam - Custom SVG for Steam logo */}
                <a href="#" className="group relative flex items-center justify-center w-full h-12 bg-white/5 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/40 rounded-2xl transition-all duration-300">
                  <svg className="w-6 h-6 fill-gray-400 group-hover:fill-blue-400 group-hover:scale-110 transition-all" viewBox="0 0 24 24">
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.67c.527-.354 1.155-.519 1.777-.472l2.813-4.067V9.113c0-2.392 1.954-4.34 4.344-4.34 2.391 0 4.344 1.948 4.344 4.34 0 2.392-1.953 4.34-4.344 4.34-.14 0-.279-.01-.417-.027l-3.979 4.013c.032.19.047.385.047.583 0 1.952-1.595 3.54-3.556 3.54a3.53 3.53 0 0 1-3.21-2.03L.05 16.591C1.22 20.85 5.232 24 10 24c6.627 0 12-5.373 12-12S18.627 0 12 0h-.021z" />
                  </svg>
                  <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-blue-600 text-white text-[10px] font-bold py-1 px-3 rounded-md pointer-events-none uppercase tracking-tighter">
                    Steam
                  </div>
                </a>
                {/* Discord */}
                <a href="#" className="group relative flex items-center justify-center w-full h-12 bg-white/5 hover:bg-[#5865F2]/10 border border-white/5 hover:border-[#5865F2]/40 rounded-2xl transition-all duration-300">
                  <svg className="w-5 h-5 fill-gray-400 group-hover:fill-[#5865F2] transition-all group-hover:scale-110" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z" />
                  </svg>
                  {/* Tooltip */}
                  <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-[#5865F2] text-white text-[10px] font-bold py-1.5 px-3 rounded-lg pointer-events-none shadow-xl border border-white/10 uppercase tracking-tighter">
                    Discord
                  </div>
                </a>

              </div>
            </div>
          </div>

        </div>

        {/* Spacer for content below to account for the overlapping avatar */}
        <div className="h-16 w-full" />
      </div>

      {/* Two Component Cards Section */}
      {/* <div className="bg-gray-200 dark:bg-gray-900 py-12"> */}
      <div className=" mx-auto ">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">

          {/* MODEL POST → replace LEFT + RIGHT */}
          {isModelPostOpen ? (
            <div className="lg:col-span-12 w-full">
              <Suspense fallback={null}>
                <PostDetails
                  post={selectedPost as ExePostProps}
                  onClose={() => {
                    setPostDetailsOpen(false);
                    setSelectedPost(null);
                  }}
                />
              </Suspense>
            </div>
          ) : (
            <>
              {/* LEFT COLUMN */}
              <div className="lg:col-span-7 flex flex-col w-full">
                {loadingPosts && <div className="text-gray-400">Loading your posts...</div>}

                {!loadingPosts && userPosts.length === 0 && (
                  <div className="text-gray-400">You haven’t uploaded any posts yet.</div>
                )}

                {postDetailsOpen && selectedPost ? (
                  <Suspense fallback={null}>
                    <NormalPostDetails
                      post={selectedPost as NormalPostProps}
                      BACKEND_URL={BACKEND_URL}
                      onClose={() => {
                        setPostDetailsOpen(false);
                        setSelectedPost(null);
                      }}
                    />
                  </Suspense>
                ) : (
                  <div className="flex flex-col">
                    {userPosts.map((post) => (
                      <Post
                        key={post._id}
                        {...post}
                        onOpenDetails={() => {
                          setSelectedPost(post);
                          setPostDetailsOpen(true);
                        }}
                      />
                    ))}
                  </div>
                )}

              </div>

              {/* RIGHT COLUMN — ONLY FOR NON-MODEL POSTS */}
              <div className="lg:col-span-5 hidden lg:block">
                <div className="sticky top-4">
                  <div className="bg-gray-200 dark:bg-gray-900 rounded-2xl p-6 w-full flex flex-col max-h-[calc(100vh-40px)] shadow-sm">

                    <h2 className="text-2xl font-bold mb-6 dark:text-[#3D7A6E]">
                      Support Morgan&apos;s Causes
                    </h2>

                    <div className="overflow-y-auto pr-4 space-y-6 flex-grow
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-thumb]:bg-gray-400/50
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-track]:bg-transparent
              dark:[&::-webkit-scrollbar-thumb]:bg-gray-600/50">

                      {[
                        {
                          title: "Environmental Initiative",
                          desc: "Support Morgan Freeman's bee sanctuary and environmental conservation efforts.",
                          btn: "Donate to Bee Sanctuary",
                          btnClass: "bg-green-600 hover:bg-green-700 text-white",
                        },
                        {
                          title: "Education Fund",
                          desc: "Contribute to scholarship programs for aspiring actors and filmmakers.",
                          btn: "Support Education",
                          btnClass: "bg-blue-600 hover:bg-blue-700 text-white",
                        },
                        {
                          title: "Hurricane Relief",
                          desc: "Help rebuild communities affected by natural disasters.",
                          btn: "Emergency Relief Fund",
                          btnClass: "bg-red-600 hover:bg-red-700 text-white",
                        },
                        {
                          title: "Fan Club",
                          desc: "Join the official Morgan Freeman fan community for exclusive content and updates.",
                          btn: "Join Fan Club – $9.99/month",
                          btnClass: "bg-yellow-500 hover:bg-yellow-600 text-black",
                          divider: true,
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className={`pt-6 ${item.divider ? "border-t border-gray-300 dark:border-gray-700" : ""}`}
                        >
                          <h3 className="font-semibold mb-3">{item.title}</h3>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                            {item.desc}
                          </p>
                          <button className={`w-full px-4 py-2.5 rounded-lg ${item.btnClass}`}>
                            {item.btn}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
    // </div>
  );
};

export default ProfilePage;