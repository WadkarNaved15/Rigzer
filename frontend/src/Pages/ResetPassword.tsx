import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Lock, Zap, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/auth/reset-password`, {
        token,
        newPassword: password
      });
      setIsSuccess(true);
      setTimeout(() => navigate("/auth?add=true"), 3000);
    } catch (err) {
      setError("Invalid or expired reset link. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#c4b5fd] via-[#b177e0] to-[#dbc9f7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          
          <div className="text-center space-y-3">
            <div className="flex justify-center items-center">
              <div className="bg-gradient-to-tr from-[#c4b5fd] via-[#9d4edd] to-[#5b21b6] p-4 rounded-xl shadow-lg">
                <Zap className="h-12 w-12 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#c4b5fd] via-[#9d4edd] to-[#5b21b6] bg-clip-text text-transparent">
              New Password
            </h1>
            <p className="text-gray-600">Set a strong password for your account.</p>
          </div>

          {!token ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center">
              Invalid reset link.
            </div>
          ) : isSuccess ? (
            <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <p className="text-lg font-medium text-gray-800">Password Updated!</p>
              <p className="text-sm text-gray-500">Redirecting you to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 text-sm bg-red-50 border border-red-100 text-red-600 rounded-xl">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-gray-50 focus:bg-white"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                  <input
                    type="password"
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-gray-50 focus:bg-white"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}