import { BrowserRouter as Router } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { UsersProvider } from "./context/UsersContext";
import { FollowProvider } from "./context/FollowContext";
import { FeedProvider } from "./context/FeedContext";
import { ChatProvider } from "./context/ChatContext";
import FeedbackProvider from "./context/FeedbackProvider";
import { NotificationProvider } from "./context/Notifications";
import { SocketProvider } from "./context/SocketContext";
import { UIProvider } from "./context/UIContext";
import { useUser } from "./context/user";
import { SearchProvider } from "./components/Home/SearchContext";
import { PublishedArticlesProvider } from "./context/PublishedArticleContext";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
// import AppRoutes from "./AppRoutes";
const queryClient = new QueryClient();
function App() {
  const { user } = useUser();
  return (
    <QueryClientProvider client={queryClient}>
      <UIProvider>
        <SocketProvider userId={user?._id}>
            <FollowProvider>
              <ChatProvider>
                <UsersProvider>
                  <NotificationProvider>
                    <SearchProvider>
                      <PublishedArticlesProvider>
                        <GoogleOAuthProvider clientId="970893892840-8ecshtmle4kip6ps0bl7vbkg3nogl5od.apps.googleusercontent.com">
                          <FeedProvider>
                            <FeedbackProvider>
                              <>
                                <ToastContainer />
                                <RouterProvider router={router} />
                              </>
                            </FeedbackProvider>
                          </FeedProvider>
                        </GoogleOAuthProvider>
                      </PublishedArticlesProvider>
                    </SearchProvider>
                  </NotificationProvider>
                </UsersProvider>
              </ChatProvider>
            </FollowProvider>
        </SocketProvider>
      </UIProvider>
    </QueryClientProvider>
  );
}

export default App;
