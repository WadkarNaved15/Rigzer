import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import NormalPostDetails from "./NormalPostDetails";
import DevlogPostDetails from "./DevlogPostDetails";
import PostDetail from "./PostDetail";
import CircleLoader from "../components/Loader/CircleLoader";

const PostDetailsPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  // 👇 get post from navigation state
  const initialPost = location.state?.post || null;

  const [post, setPost] = useState<any>(initialPost);
  const [loading, setLoading] = useState(!initialPost);

  useEffect(() => {
    // If post already exists (came from feed), don't fetch
    if (initialPost) return;

    if (!postId) return;

    const fetchPost = async () => {
      try {
        const res = await axios.get(
          `${BACKEND_URL}/api/posts/${postId}`,
          { withCredentials: true }
        );
        setPost(res.data);
      } catch (err) {
        console.error("Failed to fetch post:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  if (loading) return <CircleLoader />;
  if (!post) return <div>Post not found</div>;

  const handleBack = () => {
    navigate(-1);
  };

  if (post.type === "model_post") {
    return <PostDetail post={post} onClose={handleBack} />;
  }

  if (post.type === "devlog_post") {
    return (
      <DevlogPostDetails
        post={post}
        BACKEND_URL={BACKEND_URL}
        onClose={handleBack}
      />
    );
  }

  return (
    <NormalPostDetails
      post={post}
      BACKEND_URL={BACKEND_URL}
      onClose={handleBack}
    />
  );
};

export default PostDetailsPage;