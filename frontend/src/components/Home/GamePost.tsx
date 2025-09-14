import React, { useEffect, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const GamePosts: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/games`);
        const data = await res.json();
        if (data.success) {
          setGames(data.games);
        }
      } catch (err) {
        console.error("Error fetching games:", err);
      }
    };

    fetchGames();
  }, []);

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100 p-8">
      <h2 className="text-4xl font-bold text-center text-teal-400 mb-10">
        Discover Awesome Games
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {games.map((game) => (
          <div
            key={game._id}
            className="bg-gray-900 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-800"
          >
            {game.coverImageUrl && (
              <img
                src={game.coverImageUrl}
                alt={game.title}
                className="w-full h-48 object-cover rounded-t-xl"
              />
            )}
            <div className="p-5 flex flex-col justify-between h-full">
              <div>
                <h3 className="text-xl font-bold text-teal-300 mb-2">
                  {game.title}
                </h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                  {game.description}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mt-2">
                  Uploaded by:{" "}
                  <b className="text-gray-400">
                    {game.createdBy?.username || "Unknown"}
                  </b>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GamePosts;