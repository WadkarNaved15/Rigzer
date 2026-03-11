import { createBrowserRouter } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import AdminRoute from "./components/Routing/AdminRoutes";

// Pages
import Home from "./Pages/Home";
import Auth from "./Pages/Auth";
import ProfilePage from "./components/Profile/NewProfile";
import EditProfilePage from "./Pages/EditProfile";
import ProfilePageWrapper from "./components/Profile/ProfilePageWrapper";
import ArticleOverlay from "./Pages/ArticleView";
import CreatePostPage from "./Pages/CreatePostPage";
import WishlistPage from "./Pages/WishlistPage";
import GameShowcase from "./Pages/GameShowcase";
import UploadGame from "./Pages/UploadGame";
import DevLogs from "./Pages/DevLogs";
import DevLogsView from "./Pages/DevLogViewPage";
import DevLogCanvas from "./Pages/DevlogCanvas";
import DevlogViewer from "./Pages/DevlogViewer";
import AdminPocketDashboard from "./Pages/AdminPocketDashboard";
import PostModal from "./components/PostModal";
import PostDetailsPage from "./Pages/PostDetailsPage";
import Puck from "./Pages/Puck";
import StreamPage from "./Pages/StreamPage";
import ForgotPassword from "./Pages/ForgotPassword";
import VerifyEmail from "./Pages/VerifyEmail";
import ResetPassword from "./Pages/ResetPassword";
import NotificationsPage from "./Pages/NotificationsPage";
import PublisherForm from "./Pages/PublisherForm";

// Components as pages
import ModelViewer from "./components/ModelViewer";
import GamePost from "./components/Home/GamePost";
import Recommendations from "./components/Recommendations";
import RecommendationPosts from "./components/Home/RecommendationPost";

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/post/:postId", element: <PostDetailsPage /> },
      { path: "/profile/:username", element: <ProfilePageWrapper /> },
      { path: "/articles/:canvasId", element: <ArticleOverlay /> },
      { path: "/create", element: <PostModal/> },
      { path: "/wishlist", element: <WishlistPage /> },
      { path: "/notifications", element: <NotificationsPage /> },
    ],
  },

  { path: "/auth", element: <Auth /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/verify-email", element: <VerifyEmail /> },

  { path: "/stream/:sessionId", element: <StreamPage /> },
  { path: "/publisher", element: <PublisherForm /> },
  { path: "/createpost", element: <CreatePostPage /> },

  { path: "/devlogs", element: <DevLogs /> },
  { path: "/devlogs/view/:id", element: <DevLogsView /> },
  { path: "/devlogCanvas", element: <DevLogCanvas /> },
  { path: "/devlogviewer/:devlogId", element: <DevlogViewer /> },

  { path: "/models", element: <ModelViewer /> },
  { path: "/gameshow", element: <GameShowcase /> },
  { path: "/gameupload", element: <UploadGame /> },
  { path: "/games", element: <GamePost /> },

  { path: "/puck", element: <Puck /> },
  { path: "/recommendations", element: <Recommendations /> },
  { path: "/recommendationsposts", element: <RecommendationPosts /> },

  // ── Admin routes ───────────────────────────────────────────────────────────
  // AdminRoute checks:  not logged in → /login?next=…  |  not admin → 403 page
  // Real security is enforced by isAdmin middleware on every /api/admin/* and
  // /api/pockets/pending|review|eligibility endpoint — never trust this alone.
  {
    path: "/admin/pockets",
    element: (
      <AdminRoute>
        <AdminPocketDashboard />
      </AdminRoute>
    ),
  },
]);