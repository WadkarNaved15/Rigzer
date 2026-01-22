import React from "react";
import { Star, Heart, Plus, Play, Image, Video, X } from "lucide-react";
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
        <div className="flex justify-start items-start">
          <div>
            {/* Container for Name and Buttons */}
            <div className="flex items-center gap-6 mb-3">
              {/* Name - Large and Bold */}
              <h1 className="text-4xl font-extrabold tracking-tight flex items-baseline">
                John Developer
              </h1>

              {/* Buttons - Using flex and self-center for pixel-perfect alignment */}
              <div className="flex items-center gap-2 pt-1">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full text-sm font-bold transition-all shadow-sm active:scale-95">
                  Follow
                </button>
                <button className="bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-black dark:text-white px-6 py-2 rounded-full text-sm font-bold transition-all shadow-sm active:scale-95 border border-transparent dark:border-gray-700">
                  Message
                </button>
              </div>
            </div>

            {/* Roles / Subtitle */}
            <div className="flex items-center space-x-4 mb-2 text-gray-600 dark:text-gray-400 font-medium">
              <span>Game Designer</span>
              <span className="text-xs opacity-50">•</span>
              <span>Software Engineer</span>
              <span className="text-xs opacity-50">•</span>
              <span>3D Artist</span>
            </div>
          </div>

          {/* Followers List remains on the right */}
          <div className="ml-16 pt-2">
            <FollowersList userId={user?._id} />
          </div>
        </div>

        {/* Main Profile Section */}
        <div className="flex gap-8 mb-4">
          {/* Left Side - Profile Image */}
          <div className="flex-shrink-0">
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"
              alt="Morgan Freeman"
              className="w-52 h-52 object-cover rounded-lg"
            />
          </div>

          {/* Center - Movie Still */}
          <div className="flex-1">
            <div className="relative bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden h-52">
              <img
                src="/api/placeholder/600/400"
                alt="Driving Miss Daisy scene"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold mb-1 text-white">DRIVING MISS DAISY (1989)</h3>
                    </div>
                    <div className="flex items-center space-x-4 text-white">
                      <div className="flex items-center space-x-1">
                        <span className="text-sm">👍</span>
                        <span className="text-sm">38</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Heart className="w-4 h-4 text-red-500" />
                        <span className="text-sm">23</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button className="absolute top-4 left-4 bg-[#191919]/50 p-2 rounded-full hover:bg-[#191919]/70">
                <Play className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right Side - Stats */}
          {/* <div className="flex flex-col space-y-2">
            <div className="text-center bg-gray-100 dark:bg-gray-800 rounded-xl shadow-md">
              <Video className="w-24 h-12 mx-auto text-gray-600 dark:text-gray-400" />
              <div className="text-xl font-bold">99+</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">VIDEOS</div>
            </div>
            <div className="text-center bg-gray-100 dark:bg-gray-800 rounded-xl shadow-md">
              <Image className="w-24 h-12 mx-auto text-gray-600 dark:text-gray-400" />
              <div className="text-xl font-bold">99+</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">PHOTOS</div>
            </div>
          </div> */}
        </div>

        {/* Biography Text */}
        <div className="mb-8 text-gray-700 dark:text-gray-300">
          <p className="leading-relaxed mb-4">
            With an authoritative voice and calm demeanor, this ever popular American actor has grown into one of
            the most respected figures in modern US cinema. Morgan was born on June 1, 1937 in Memphis,
            Tennessee, to Mayme Edna (Revere), a teacher, and Morgan Porterfield Freeman, a barber...
          </p>
          {/* <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-blue-600 dark:text-blue-400">
              <a href="#" className="hover:underline">More at IMDbPro</a>
              <a href="#" className="hover:underline">Contact info</a>
              <a href="#" className="hover:underline">Agent info</a>
              <a href="#" className="hover:underline">Resume</a>
            </div>
            <div className="bg-gray-200 dark:bg-gray-800 px-4 py-2 rounded">
              <span className="text-sm text-gray-700 dark:text-gray-300">Born: June 1, 1937</span>
            </div>
          </div> */}
        </div>

        {/* Add to List Button */}
        {/* <div className="mb-12">
          <button className="bg-yellow-400 text-black px-8 py-3 rounded-full font-semibold hover:bg-yellow-300 flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Add to list</span>
          </button>
        </div> */}
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