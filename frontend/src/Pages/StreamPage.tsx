import { useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

export default function StreamPage() {
  const { sessionId } = useParams();

  useEffect(() => {
    const fetchAndRedirect = async () => {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/sessions/${sessionId}/stream-token`,
        { withCredentials: true }
      );

      console.log("🎬 Stream token response:", res.data);
      const redirectUrl =
        `${import.meta.env.VITE_BACKEND_URL}${res.data.streamUrl}`;

      console.log("🔀 Redirecting to stream:", redirectUrl);

      // 🔥 THIS IS THE KEY
      window.location.replace(res.data.streamUrl);
    };

    fetchAndRedirect();
  }, [sessionId]);

  return (
    <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
      Connecting to stream…
    </div>
  );
}
