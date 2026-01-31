import React from "react";
import { Star, Heart, Plus, Play, Image, Video, X, Settings } from "lucide-react";
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
        {/* Parent Container - Added 'flex' and 'items-start' */}
        <div className="w-full max-w-6xl mx-auto px-4 pt-2 flex justify-between items-start">

          {/* LEFT SIDE: Profile Card Section */}
          <div className="w-full max-w-5xl px-4 pt-2">
            <div className="relative overflow-hidden rounded-3xl bg-[#191919] border border-white/10 shadow-2xl">
              {/* 1. Banner Section */}
              <div className="relative h-48 md:h-64 overflow-hidden">
                <img
                  src="https://fastly.picsum.photos/id/299/800/200.jpg?hmac=xMdRbjiNM_IogJDEgKIJ0GeCxZ8nwOGd5_Wf_ODZ94s"
                  className="w-full h-full object-cover"
                  alt="Cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, transparent 0%, rgba(25, 25, 25, 0.2) 30%, rgba(25, 25, 25, 0.7) 60%, #191919 100%)`
                  }}
                />
              </div>

              {/* 2. Info Overlay Section */}
              <div className="relative px-6 pb-8 -mt-20 flex flex-col items-center text-center md:flex-row md:items-end md:text-left gap-6 z-10">
                <div className="relative group shrink-0">
                  <img
                    src={user?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&h=256&auto=format&fit=crop"}
                    className="relative w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-8 border-[#191919] shadow-2xl hover:scale-105 transition-transform duration-300 cursor-pointer"
                    alt="Avatar"
                  />
                </div>
                <div className="md:mb-4">
                  <p className="text-gray-400 font-medium text-sm md:text-base leading-relaxed">
                    With an <span className="text-white">authoritative voice</span> and calm demeanor,
                    this ever popular American actor...
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Your other component goes here */}
          <div className="w-40 shrink-0 pt-2">
            {/* Replace this with your actual component */}
            <div className="bg-[#191919] p-6 rounded-3xl border border-white/10 text-white">
              <h3 className="text-xl font-bold">Right Side Component</h3>
              <p className="text-gray-400">Content goes here...</p>
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