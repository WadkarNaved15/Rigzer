import { BrowserRouter as Router } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { UsersProvider } from "./context/UsersContext";
import { FeedProvider } from "./context/FeedContext";
import FeedbackProvider from "./context/FeedbackProvider";
import { SocketProvider } from "./context/SocketContext";
import { useUser } from "./context/user";
import { SearchProvider } from "./components/Home/SearchContext";
import { PublishedArticlesProvider } from "./context/PublishedArticleContext";
import AppRoutes from "./AppRoutes";

function App() {
  const { user } = useUser();
  return (
    <SocketProvider userId={user?._id}>
      <UsersProvider>
        <SearchProvider>
          <PublishedArticlesProvider>
          <GoogleOAuthProvider clientId="970893892840-8ecshtmle4kip6ps0bl7vbkg3nogl5od.apps.googleusercontent.com">
            <FeedProvider>
              <FeedbackProvider>
                <Router>
                  <ToastContainer />
                  <AppRoutes />
                </Router>
              </FeedbackProvider>
            </FeedProvider>
          </GoogleOAuthProvider>
          </PublishedArticlesProvider>
        </SearchProvider>
      </UsersProvider>
    </SocketProvider>
  );
}

export default App;
