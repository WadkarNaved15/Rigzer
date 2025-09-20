import { useState ,useEffect } from "react";
import { FaTimes } from "react-icons/fa";

interface FeedbackModalProps {
  isOpen: boolean;
  screenshot?: File | null;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen,screenshot, onClose }: FeedbackModalProps) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [category, setCategory] = useState("");
  const [feedback, setFeedback] = useState("");
  const [image, setImage] = useState<File | null>(screenshot || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

      useEffect(() => {
    // if screenshot changes (Ctrl+Shift+F), show it
    setImage(screenshot || null);
  }, [screenshot]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!category || !feedback.trim()) {
      setError("Please select a category and write your feedback.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
    formData.append("category", category);
    formData.append("message", feedback);
    if (image) formData.append("attachment", image);

    const res = await fetch(`${BACKEND_URL}/api/feedback`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setSuccess("Feedback submitted successfully!");
        setCategory("");
        setFeedback("");
        setTimeout(() => {
          onClose();
          setSuccess("");
        }, 1000);
      }
    } catch (err) {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[#0A1714] via-[#1F4D44] to-[#3D7A6E] 
                      text-white w-full max-w-lg rounded-xl shadow-2xl p-6 relative">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-300 hover:text-red-400 transition"
        >
          <FaTimes size={18} />
        </button>

        {/* Header */}
        <h2 className="text-xl font-semibold mb-2">Give Feedback</h2>
        <p className="text-sm text-gray-200 mb-4">
          Help us improve by sharing your thoughts. You can suggest features, report issues,
          or just tell us what you think about the app.
        </p>

        {/* Show messages */}
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        {success && <p className="text-green-400 text-sm mb-2">{success}</p>}

        {/* Category Select */}
        <label className="block text-sm font-medium mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full p-2 rounded-lg bg-[#0A1714]/80 border border-gray-500 
                     focus:ring-2 focus:ring-red-500 text-white text-sm mb-4"
        >
          <option value="">Please select a category</option>
          <option value="Feature Request">Feature Request</option>
          <option value="Bug Report">Bug Report</option>
          <option value="Purchase and Payment Issue">Purchase and Payment Issue</option>
          <option value="Other">Other</option>
        </select>

        {/* Image upload */}
<div className="mb-4">
  <label className="block text-sm font-medium mb-1">Attach image (optional)</label>
  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) setImage(file);
    }}
    className="block w-full text-sm text-gray-300
               file:mr-4 file:py-2 file:px-4
               file:rounded file:border-0
               file:text-sm file:font-semibold
               file:bg-red-500 file:text-white
               hover:file:bg-red-600"
  />

  {image && (
    <div className="mt-2">
      <img
        src={URL.createObjectURL(image)}
        alt="Selected attachment"
        className="max-h-40 rounded border"
      />
      <button
        type="button"
        className="text-xs text-red-400 mt-1 underline"
        onClick={() => setImage(null)}
      >
        Remove
      </button>
    </div>
  )}
</div>


        {/* Feedback textarea */}
        <label className="block text-sm font-medium mb-1">Feedback</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Write your feedback here..."
          className="w-full h-28 p-3 rounded-lg bg-[#0A1714]/80 border border-gray-500 
                     focus:ring-2 focus:ring-red-500 text-white text-sm resize-none mb-6"
        />

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-500 
                       hover:bg-gray-700/50 transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-500 text-white font-medium 
                       hover:bg-red-600 transition text-sm disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
