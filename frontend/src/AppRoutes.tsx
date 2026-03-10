// src/AppRoutes.tsx
import { Routes, Route, useLocation,ScrollRestoration} from "react-router-dom";
import { Suspense, lazy } from "react";

// Pages
const Home = lazy(() => import("./Pages/Home"));
const Auth = lazy(() => import("./Pages/Auth"));
const ProfilePage = lazy(() => import("./components/Profile/NewProfile"));
const EditProfilePage = lazy(() => import("./Pages/EditProfile"));
const CreatePostPage = lazy(() => import("./Pages/CreatePostPage"));
const WishlistPage = lazy(() => import("./Pages/WishlistPage"));
const GameShowcase = lazy(() => import("./Pages/GameShowcase"));
const UploadGame = lazy(() => import("./Pages/UploadGame"));
const DevLogs = lazy(() => import("./Pages/DevLogs"));
const DevLogsView = lazy(() => import("./Pages/DevLogViewPage"));
const DevLogCanvas = lazy(() => import("./Pages/DevlogCanvas"));
const PostDetail = lazy(() => import("./Pages/PostDetail"));
const DevlogViewer = lazy(() => import("./Pages/DevlogViewer"));
const Puck = lazy(() => import("./Pages/Puck"));
const StreamPage = lazy(() => import("./Pages/StreamPage"));
const AdminPocketReview = lazy(() => import("./Pages/AdminPocketReview"));
import ForgotPassword from "./Pages/ForgotPassword";
import VerifyEmail from "./Pages/VerifyEmail";
import ResetPassword from "./Pages/ResetPassword";
// Components
import GameStatus from "./components/Home/PlayGame";
import { Header } from "./components/Header";
import Recommendations from "./components/Recommendations";
import RecommendationPosts from "./components/Home/RecommendationPost";
import PublisherForm from "./Pages/PublisherForm";
import ModelViewer from "./components/ModelViewer";
import GamePost from "./components/Home/GamePost";
import MainLayout from "./layouts/MainLayout";
import NotificationsPage from "./Pages/NotificationsPage";
import { useEffect } from "react";
import PostDetailsPage from "./Pages/PostDetailsPage";

export default function AppRoutes() {
  // const location = useLocation();
  // const state = location.state as { background?: Location };
  return (
    <>
      {/* <ScrollToTop /> */}
      <ScrollRestoration />
      <Suspense fallback={<div className="text-center mt-10">Loading...</div>}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/post/:postId" element={<PostDetailsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/stream/:sessionId" element={<StreamPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/publisher" element={<PublisherForm />} />
          <Route path="/createpost" element={<CreatePostPage />} />
          <Route path="/devlogs" element={<DevLogs />} />
          <Route path="/devlogs/view/:id" element={<DevLogsView />} />
          <Route path="/devlogCanvas" element={<DevLogCanvas />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/devlogviewer/:devlogId" element={<DevlogViewer />} />
          <Route path="/models" element={<ModelViewer />} />
          <Route path="/gameshow" element={<GameShowcase />} />
          <Route path="/gameupload" element={<UploadGame />} />
          <Route path="/games" element={<GamePost />} />
          <Route path="/puck" element={<Puck />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/recommendationsposts" element={<RecommendationPosts />} />

          {/* Admin Routes */}
          <Route path="/admin/pocket-review" element={<AdminPocketReview />} />
        </Routes>
      </Suspense>
    </>
  );
}