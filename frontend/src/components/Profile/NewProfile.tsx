import React from "react";
import { Star, Heart, Plus, Play, Image, Video, X } from "lucide-react";
import FollowButton from "../FollowButton";
import FollowersList from "../FollowersList";
import { useEffect, useState } from "react";
import Post from "../Post";
import type { PostProps } from "../../types/Post";
import { useUser } from "../../context/user";
import axios from "axios";
interface ProfilePageProps {
  setProfileOpen: (open: boolean) => void;
}
const ProfilePage: React.FC<ProfilePageProps> = ({ setProfileOpen }) => {
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const [userPosts, setUserPosts] = useState<PostProps[]>([]);
const [loadingPosts, setLoadingPosts] = useState(false);
const { user } = useUser();
useEffect(() => {
    if (!user?.id) return;

    const fetchUserPosts = async () => {
      setLoadingPosts(true);
      try {
        const res = await axios.get(
          `${BACKEND_URL}/api/posts/user_posts/${user.id}`
        );
        setUserPosts(res.data.posts);
      } catch (err) {
        console.error("Failed to load user posts", err);
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchUserPosts();
  }, [user?.id]);
  console.log("User in ProfilePage:", user);
  console.log("User posts in ProfilePage:", userPosts);
  return (
    <div className="relative pt-2 min-h-screen bg-gray-100 dark:bg-black text-gray-900 dark:text-white">
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
            <h1 className="text-2xl font-light mb-2">
              John Developer
              <span className="text-gray-500 dark:text-gray-400 text-xl ml-2">(I)</span>
            </h1>
            <div className="flex space-x-4 mb-2 text-gray-600 dark:text-gray-400">
              <span>Game Designer</span>
              <span>•</span>
              <span>Software Engineer</span>
              <span>•</span>
              <span>3D Artist</span>
            </div>
          </div>
          <div className="ml-16">
            <FollowersList userId={user?.id} />
          </div>
          {/* <div className="text-right">
            <div className="flex items-center space-x-2 mb-2">
              <div className="bg-yellow-400 text-black px-2 py-1 rounded text-xs font-bold">IMDbPro</div>
              <div className="bg-green-600 px-2 py-1 rounded text-xs">Top 500</div>
              <span className="text-gray-500 dark:text-gray-400">150</span>
            </div>
          </div> */}
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
              <button className="absolute top-4 left-4 bg-black/50 p-2 rounded-full hover:bg-black/70">
                <Play className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right Side - Stats */}
          <div className="flex flex-col space-y-2">
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
          </div>
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
        <div className="grid md:grid-cols-2 gap-8">
          <div className="mx-auto mt-8 w-full">
            <h2 className="text-2xl font-semibold mb-4 dark:text-[#3D7A6E]">
              Your Posts
            </h2>

            {loadingPosts && (
              <div className="text-gray-400">Loading your posts...</div>
            )}

            {!loadingPosts && userPosts.length === 0 && (
              <div className="text-gray-400">
                You haven’t uploaded any posts yet.
              </div>
            )}

            <div className="flex flex-col gap-6">
              {userPosts.map((post) => (
                <Post
                  key={post._id}
                  {...post}
                  onOpenDetails={() => {
                    // optional: open post detail modal
                  }}
                />
              ))}
            </div>
          </div>


          {/* Right Card - Support & Donations */}
          <div className="bg-gray-200 dark:bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 dark:text-[#3D7A6E]">Support Morgan's Causes</h2>
            <div className="space-y-6">
              {[
                { title: "Environmental Initiative", color: "green", desc: "Support Morgan Freeman's bee sanctuary and environmental conservation efforts.", btn: "Donate to Bee Sanctuary" },
                { title: "Education Fund", color: "blue", desc: "Contribute to scholarship programs for aspiring actors and filmmakers.", btn: "Support Education" },
                { title: "Hurricane Relief", color: "red", desc: "Help rebuild communities affected by natural disasters.", btn: "Emergency Relief Fund" },
                { title: "Fan Club", color: "yellow", desc: "Join the official Morgan Freeman fan community for exclusive content and updates.", btn: "Join Fan Club - $9.99/month" },
              ].map((item, idx) => (
                <div key={idx} className={`${idx !== 3 ? "" : "border-t border-gray-400 dark:border-gray-600"} pt-6`}>
                  <h3 className="font-semibold mb-3">{item.title}</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{item.desc}</p>
                  <button
                    className={`bg-${item.color}-600 text-white px-4 py-2 rounded hover:bg-${item.color}-700 w-full`}
                  >
                    {item.btn}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    // </div>
  );
};

export default ProfilePage;
