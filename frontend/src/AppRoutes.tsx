import { Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";

// Pages
const Home = lazy(() => import("./Pages/Home"));
const Auth = lazy(() => import("./Pages/Auth"));
const ProfilePage = lazy(() => import("./Pages/ProfilePage"));
const EditProfilePage = lazy(() => import("./Pages/EditProfile"));
const CreatePostPage = lazy(() => import("./Pages/CreatePostPage"));
const WishlistPage = lazy(() => import("./Pages/WishlistPage"));
const GameShowcase = lazy(() => import("./Pages/GameShowcase"));
const UploadGame = lazy(() => import("./Pages/UploadGame"));
const DevLogs = lazy(() => import("./Pages/DevLogs"));
const DevLogsView = lazy(() => import("./Pages/DevLogViewPage"));
const DevLogCanvas = lazy(() => import("./Pages/DevlogCanvas"));
const DevlogViewer = lazy(() => import("./Pages/DevlogViewer"));
const Puck = lazy(() => import("./Pages/Puck"));

// Components
import GameStatus from "./components/Home/PlayGame";
import Recommendations from "./components/Recommendations";
import RecommendationPosts from "./components/Home/RecommendationPost";
import ModelViewer from "./components/ModelViewer";
import GamePost from "./components/Home/GamePost";

// 🔥 NEW
const PostDetail = lazy(() => import("./Pages/PostDetail"));

export default function AppRoutes() {
  const location = useLocation();
  const state = location.state as { background?: Location };

  return (
    <>
      {/* MAIN ROUTES */}
      <Suspense fallback={<div className="text-center mt-10">Loading...</div>}>
        <Routes location={state?.background || location}>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/stream" element={<GameStatus />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/editprofile" element={<EditProfilePage />} />
          <Route path="/createpost" element={<CreatePostPage />} />
          <Route path="/devlogs" element={<DevLogs />} />
          <Route path="/devlogs/view/:id" element={<DevLogsView />} />
          <Route path="/devlogCanvas" element={<DevLogCanvas />} />
          <Route path="/devlogviewer/:devlogId" element={<DevlogViewer />} />
          <Route path="/models" element={<ModelViewer />} />
          <Route path="/gameshow" element={<GameShowcase />} />
          <Route path="/gameupload" element={<UploadGame />} />
          <Route path="/games" element={<GamePost />} />
          <Route path="/puck" element={<Puck />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/recommendationsposts" element={<RecommendationPosts />} />
        </Routes>
      </Suspense>

      {/* MODAL ROUTES (X-style) */}
      {state?.background && (
        <Suspense fallback={null}>
          <Routes>
            {/* <Route path="/post/:id" element={<PostDetail />} /> */}
          </Routes>
        </Suspense>
      )}
    </>
  );
}
