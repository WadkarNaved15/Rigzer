import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Suspense, lazy } from 'react';
import CreatePostPage from './Pages/CreatePostPage';
import GameShowcase from './Pages/GameShowcase';
import TestModelUpload from './Pages/ModelUploads';
import ModelViewer from './components/ModelViewer';
import UploadGame from './Pages/UploadGame';
import GamePost from './components/Home/GamePost'
import FeedbackProvider from './context/FeedbackProvider';
import { SearchProvider } from './components/Home/SearchContext';  // ✅ FIX


// Lazy-loaded pages
const Home = lazy(() => import('./Pages/Home'));
const Auth = lazy(() => import('./Pages/Auth'));
const ProfilePage = lazy(() => import('./Pages/ProfilePage'));
// const Profile = lazy(() => import('./Pages/Profile'));
const EditProfilePage = lazy(() => import('./Pages/EditProfile'));
const GameStream = lazy(() => import('./Pages/GameStream'));
const DevLogs = lazy(() => import('./Pages/DevLogs'));
const DevLogsView = lazy(() => import('./Pages/DevLogViewPage'));
// const ExcaliDraw = lazy(() => import('./Pages/ExcaliDraw'))
// const CanvasEditor = lazy(() => import('./Pages/CanvasEditor'))

// const Game = lazy(() => import('./Pages/Game'));

// Optional / future pages (can also be lazy-loaded when needed)
// const UploadPage = lazy(() => import('./Pages/UploadPage'));
// const ExplorePage = lazy(() => import('./Pages/ExplorePage'));
// const GamePage = lazy(() => import('./Pages/GamePage'));
// const ModelTower = lazy(() => import('./components/ModelTower'));
// const Navbar = lazy(() => import('./components/Navbar'));

function App() {
  return (
    <SearchProvider>
    <GoogleOAuthProvider clientId="970893892840-8ecshtmle4kip6ps0bl7vbkg3nogl5od.apps.googleusercontent.com">
      <FeedbackProvider>
      <Router>
        {/* You can lazily load navbar too */}
        {/* <Suspense fallback={<div>Loading navbar...</div>}>
          <Navbar />
        </Suspense> */}
        <Suspense fallback={<div className="text-center mt-10">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/gamestream" element={<GameStream />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/createpost" element={<CreatePostPage />} />
            <Route path="/devlogs" element={<DevLogs />} />
            <Route path="/devlogs/view/:id" element={<DevLogsView />} />
            <Route path="/models" element={<ModelViewer/>} />
            <Route path="/gameshow" element={<GameShowcase />} />
            <Route path="/gameupload" element={<UploadGame />} />
            <Route path="/games" element={<GamePost/>} />
            {/* <Route path="/excalidraw" element={<ExcaliDraw/>} /> */}
            {/* <Route path="/canvas" element={<CanvasEditor/>} /> */}
            {/*<Route path="/game" element={<Game />} />
            <Route path="/profile" element={<Profile />} />*/}
            <Route path="/editprofile" element={<EditProfilePage />} /> 
            {/* Future routes */}
            {/* <Route path="/upload" element={<UploadPage />} />
            <Route path="/explore" element={<ExplorePage />} /> */}
          </Routes>
        </Suspense>
      </Router>
      </FeedbackProvider>
    </GoogleOAuthProvider>
    </SearchProvider>
  );
}

export default App;
