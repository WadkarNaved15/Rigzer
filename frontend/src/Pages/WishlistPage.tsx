import React, { useEffect, useState } from "react";
import axios from "axios";
import ExePost from "../components/Post/ExePost";

const WishlistPage = () => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWishlist = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/wishlist/mine`, {
          withCredentials: true,
        });

        setPosts(res.data);
        console.log("Wishlist posts:", res.data);
      } catch (err) {
        console.error("Failed to load wishlist posts:", err);
      } finally {
        setLoading(false);
      }
    };

    loadWishlist();
  }, []);

  if (loading) return <p className="text-center mt-10">Loading Wishlist...</p>;

  if (posts.length === 0)
    return (
      <p className="text-center mt-10 text-gray-500">
        No wishlisted posts.
      </p>
    );

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      {posts.map((post) => (
        <ExePost
          key={post._id}
          {...post}
        />
      ))}
    </div>
  );
};

export default WishlistPage;
