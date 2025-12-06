import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowRight, Loader2, Gamepad } from "lucide-react"; // Using Lucide icons for a modern feel

// --- Component Start ---
export default function RecommendedPosts() {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  // 1. Data Fetching Effect
  useEffect(() => {
    async function load() {
      try {
        const data = await axios.get(`${BACKEND_URL}/api/recommend`, {
          withCredentials: true,
        });
        if (data && data.data) {
          setRecommendations(data.data.recommendations);
          setPreferences(data.data.preferences);
        }
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 2. Loading State UI
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mr-3" />
        <span className="text-xl text-gray-400">Loading your personalized game recommendations...</span>
      </div>
    );

  // 3. No Recommendations State UI
  if (!recommendations.length)
    return (
      <div className="min-h-screen p-10 bg-gray-950 text-center flex flex-col justify-center items-center">
        <Gamepad className="w-12 h-12 text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-400">No Recommendations Yet</h2>
        <p className="text-gray-500 mt-2">
          Start interacting with games to build your unique preference profile!
        </p>
      </div>
    );

  // 4. Main Content UI
  return (
    <div className="min-h-screen p-4 sm:p-8 lg:p-12 bg-gray-950 text-white">
      {/* User Preferences Section */}
      {preferences && (
        <section className="mb-10 p-6 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-sm bg-gray-900/70">
          <header className="flex items-center mb-5">
            <h2 className="text-3xl font-extrabold text-cyan-400 tracking-wider">
              Your Gaming Profile
            </h2>
            <p className="text-sm ml-4 text-gray-400">
              Insights driving your personalized feed
            </p>
          </header>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Top Tags */}
            <div>
              <h3 className="text-xl font-semibold mb-3 text-gray-200 border-b border-gray-800 pb-2">
                Top Tags
              </h3>
              <div className="flex gap-3 flex-wrap">
                {Object.keys(preferences.topTags).map(tag => (
                  <span
                    key={tag}
                    className="bg-cyan-700/30 text-cyan-200 border border-cyan-700 px-4 py-1.5 rounded-full text-sm font-medium transition hover:bg-cyan-600/50"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Top Genres */}
            <div>
              <h3 className="text-xl font-semibold mb-3 text-gray-200 border-b border-gray-800 pb-2">
                Top Genres
              </h3>
              <div className="flex gap-3 flex-wrap">
                {Object.keys(preferences.topGenres).map(genre => (
                  <span
                    key={genre}
                    className="bg-fuchsia-700/30 text-fuchsia-200 border border-fuchsia-700 px-4 py-1.5 rounded-full text-sm font-medium transition hover:bg-fuchsia-600/50"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recommended Posts Section */}
      <section>
        <h2 className="text-4xl font-extrabold mb-8 text-gray-100 border-b border-gray-800 pb-4">
          Recommended for You
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recommendations.map((item) => (
            <div
              key={item.post._id}
              className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex flex-col hover:border-cyan-500 transition-all duration-300 shadow-lg hover:shadow-cyan-500/30"
            >
              <h3 className="text-xl font-bold mb-1 text-cyan-400">
                {item.post.genre}
              </h3>

              <p className="text-gray-400 text-sm mb-4 flex-grow">
                {item.post.description.slice(0, 100)}...
              </p>

              {/* Tags */}
              <div className="mb-4 flex flex-wrap gap-2">
                {item.post.tags?.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="text-xs text-gray-500 mb-4 space-y-1 border-t border-gray-800 pt-3">
                <p>
                  <span className="font-semibold text-gray-300">Match Score:</span>{" "}
                  <span className="text-cyan-400">{item.score.toFixed(2)}</span>
                </p>
                <p>
                  <span className="font-semibold text-gray-300">Play Count:</span>{" "}
                  {item.post.playCount.toLocaleString()}
                </p>
                <p>
                  <span className="font-semibold text-gray-300">Return Rate:</span>{" "}
                  {item.post.returnRate}%
                </p>
              </div>

              {/* Call to Action Button */}
              <button className="w-full flex items-center justify-center bg-cyan-600 text-white font-bold py-2.5 rounded-lg mt-3 hover:bg-cyan-500 transition-colors duration-300 shadow-md shadow-cyan-600/40">
                View Game
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}