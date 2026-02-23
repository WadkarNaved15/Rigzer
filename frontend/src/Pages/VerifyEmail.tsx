import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { saveAccount } from "../utils/accountRegistry.js";
import { useUser } from "../context/user";

function VerifyEmail() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useUser();

  const searchParams = new URLSearchParams(location.search);
  const email = searchParams.get("email");

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!email) {
    navigate("/auth");
    return null;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/verify-email`,
        { email, otp },
        { withCredentials: true }
      );

      const user = response.data.user;
          saveAccount({
            userId: user._id,
            username: user.username,
            avatar: user.avatar
          });

          login(user);
          navigate("/");
      login(user); // 🔥 store in context

      navigate("/");

    } catch (err: any) {
      setError(
        err.response?.data?.error || "Verification failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-[#c4b5fd] via-[#b177e0] to-[#dbc9f7] p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-center text-purple-700">
          Verify Your Email
        </h2>

        <p className="text-sm text-gray-600 text-center">
          We sent a 6-digit OTP to <strong>{email}</strong>
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP"
            required
            className="w-full text-center text-lg tracking-widest py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 transition disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <button
          onClick={() => navigate("/auth")}
          className="w-full text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default VerifyEmail;