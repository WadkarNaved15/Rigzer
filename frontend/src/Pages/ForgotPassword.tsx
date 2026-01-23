import React, { useState } from "react";
import axios from "axios";
import { Mail, ArrowRight, Zap, ArrowLeft } from 'lucide-react';
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${BACKEND_URL}/api/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      // intentionally silent for security, but usually good to show success message regardless
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#c4b5fd] via-[#b177e0] to-[#dbc9f7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          
          {/* Logo and Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#c4b5fd] via-[#9d4edd] to-[#5b21b6] rounded-xl blur-xl opacity-20 animate-pulse"></div>
                <div className="relative bg-gradient-to-tr from-[#c4b5fd] via-[#9d4edd] to-[#5b21b6] p-4 rounded-xl">
                  <Zap className="h-12 w-12 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#c4b5fd] via-[#9d4edd] to-[#5b21b6] bg-clip-text text-transparent">
              Reset Access
            </h1>
            <p className="text-gray-600">
              {sent ? "Check your inbox!" : "Enter your email to receive a reset link."}
            </p>
          </div>

          {sent ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-purple-50 rounded-xl text-purple-700 text-sm">
                If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
              </div>
              <button
                onClick={() => navigate("/auth")}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 transition-all shadow-lg shadow-purple-500/20"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-xl text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Send Reset Link <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="w-full flex items-center justify-center text-sm font-medium text-gray-500 hover:text-purple-600 transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}