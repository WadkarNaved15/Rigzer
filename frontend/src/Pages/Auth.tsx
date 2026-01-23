import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, Zap, User, Eye, EyeOff } from 'lucide-react';
import { GoogleOAuthProvider } from "@react-oauth/google";
import { saveAccount } from "../utils/accountRegistry.js";
import { useNavigate, useLocation } from "react-router-dom";
import axios from 'axios';
import { useUser } from "../context/user.js";

type AuthMode = 'login' | 'signup';

function Auth() {
  const { login, user, loading } = useUser();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"; // Ensure this is set in your .env file
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const addMode = searchParams.get("add") === "true";

  const navigate = useNavigate();

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  useEffect(() => {
    if (user && !loading && !addMode) {
      navigate("/"); // normal redirect for logged-in users
    }
    // ✅ if addMode is true, we do NOT redirect
  }, [user, loading, addMode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Example: Check if passwords match during signup
      if (mode === 'signup' && formData.password !== formData.confirmPassword) {
        alert("Passwords do not match.");
        return; // Stop further processing
      }
      if (mode === 'login') {
        const response = await axios.post(
          `${BACKEND_URL}/api/auth/login`,
          {
            emailOrUsername: formData.email,
            password: formData.password
          },
          {
            withCredentials: true // ✅ correct placement
          }
        );

        console.log(response.data);
        if (response.status === 200) {
          const user = response.data.user;

          saveAccount({
            userId: user._id,
            username: user.username,
            avatar: user.avatar
          });

          login(user);
          navigate("/");
        }

      } else {
        const response = await axios.post(`${BACKEND_URL}/api/auth/register`, {
          username: formData.username,
          email: formData.email,
          password: formData.password
        },
          { withCredentials: true }
        );
        if (response.status === 200) {
          const user = response.data.user;

          saveAccount({
            userId: user._id,
            username: user.username,
            avatar: user.avatar
          });

          login(user);
          navigate("/");
        }

      }
      // Here you would typically send the formData to your backend API
      console.log("Form data submitted:", formData);

      // Reset form data or perform other actions after successful submission
      setFormData({ username: '', email: '', password: '', confirmPassword: '' });


    } catch (error) {
      console.error("Submission error:", error);
      alert("An error occurred during submission.");
    } finally {
      setIsLoading(false);
    }
  };


  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google`;
  };

  const toggleMode = () => {
    setMode(prev => prev === 'login' ? 'signup' : 'login');
    setFormData({ username: '', email: '', password: '', confirmPassword: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#c4b5fd] via-[#b177e0] to-[#dbc9f7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          {/* Logo and Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#c4b5fd] via-[#9d4edd] to-[#5b21b6]rounded-xl blur-xl opacity-20 animate-pulse"></div>
                <div className="relative bg-gradient-to-tr  from-[#c4b5fd] via-[#9d4edd] to-[#5b21b6] p-4 rounded-xl">
                  <Zap className="h-12 w-12 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#c4b5fd] via-[#9d4edd] to-[#5b21b6] bg-clip-text text-transparent">
              GameSocial
            </h1>
            <p className="text-gray-600">Where Developers Connect & Games Shine!</p>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-purple-500" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                    placeholder="Choose a username"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-purple-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-purple-500" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-purple-500" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-purple-500 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm font-medium text-purple-600 hover:text-purple-500"
                >
                  Forgot password?
                </button>

              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-xl text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign in' : 'Sign up'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
            <GoogleOAuthProvider clientId="970893892840-8ecshtmle4kip6ps0bl7vbkg3nogl5od.apps.googleusercontent.com">
              <button
                onClick={handleGoogleLogin}
                type="button"
                className="w-full flex items-center justify-center py-2.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all"
              >
                <img
                  src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"
                  alt="Google"
                  className="h-5 w-auto"
                />
                <span className="ml-2 text-gray-700">Continue with Google</span>
              </button>
            </GoogleOAuthProvider>
          </form>

          <p className="text-center text-sm text-gray-500">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={toggleMode}
              className="font-medium text-purple-600 hover:text-purple-500"
            >
              {mode === 'login' ? 'Create one now' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Auth;