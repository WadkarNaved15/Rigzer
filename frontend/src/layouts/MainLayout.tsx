import { Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Header } from "../components/Header";
import Billboard from "../components/Home/Billboard";
import UploadBox from "../components/Home/Upload";
import MessagingComponent from "../components/Home/Message";
import ArticleRecommendations from "../components/Articles/ArticleRecommendations";
import { ScrollRestoration } from "react-router-dom";

const ProfileCover = lazy(() => import("../components/Home/Profile"));

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canvasId } = useParams();

  const isProfilePage = location.pathname === "/profile";
  const isArticlePage = location.pathname.startsWith("/articles/");
  const isCreatePage = location.pathname === "/create";
  const isPostDetailsPage = location.pathname.startsWith("/post/");
    const isModelPost =
    isPostDetailsPage &&
    location.state?.post?.type === "model_post";

  const handleUploadClick = () => {
    navigate("/create");
  };

  const handleWishlist = () => {
    navigate("/wishlist");
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#191919]">
      <ScrollRestoration />
      <Header />

      <main className="w-full min-h-screen px-2 sm:px-4 lg:px-8 2xl:px-16 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 2xl:grid-cols-16 2xl:gap-x-12">

          {/* LEFT SIDEBAR */}
          <div className="lg:col-span-2 2xl:col-span-3 hidden lg:block">
            <div className="sticky top-20">
              <Suspense fallback={null}>
                <ProfileCover onOpenWishlist={handleWishlist} />
              </Suspense>
            </div>

            <div className="sticky top-[21rem]">
              <UploadBox onUploadClick={handleUploadClick} />
            </div>
          </div>

          {/* ========================= */}
          {/* ARTICLE PAGE */}
          {/* ========================= */}
          {isArticlePage ? (
            <>
              <div className="lg:col-span-7 2xl:col-span-9 flex flex-col items-stretch min-h-[80vh] w-full py-4">
                <Outlet />
              </div>

              <div className="lg:col-span-3 2xl:col-span-4 hidden lg:block">
                <div className="sticky top-20 space-y-6">
                  {canvasId && (
                    <ArticleRecommendations
                      currentCanvasId={canvasId}
                      onOpenArticle={(id) => navigate(`/articles/${id}`)}
                    />
                  )}
                </div>
              </div>
            </>
          ) : isCreatePage ? (
            /* ========================= */
            /* CREATE PAGE (Replace feed + tower) */
            /* ========================= */
            <div className="lg:col-span-10 2xl:col-span-13 flex justify-center min-h-[80vh] w-full 2xl:pl-8">
              <Outlet />
            </div>
          ) : isProfilePage || isModelPost ? (
            /* ========================= */
            /* PROFILE PAGE */
            /* ========================= */
            <div className="lg:col-span-6 2xl:col-span-13 flex flex-col items-center justify-start min-h-[80vh] w-full">
              <Outlet />
            </div>
          ) : (
            /* ========================= */
            /* HOME + WISHLIST */
            /* ========================= */
            <>
              {/* CENTER FEED (Home OR Wishlist) */}
              <div className="lg:col-span-6 2xl:col-span-8 flex flex-col items-center justify-start min-h-[80vh] w-full">
                <Outlet />
              </div>

              {/* BILLBOARD (remains same) */}
              <div className="lg:col-span-4 2xl:col-span-5 hidden lg:block">
                <div className="sticky top-20 h-[calc(100vh-5rem)]">
                  <Billboard />
                </div>
              </div>
            </>
          )}

        </div>
      </main>
      <MessagingComponent />
    </div>
  );
}

export default MainLayout;