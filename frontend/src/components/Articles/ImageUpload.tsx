import { useState, useRef, useId } from "react";
import { Upload, Loader } from "lucide-react";

type MediaType = "image" | "video";

interface ImageUploadProps {
  type: MediaType;
  onSelect: (file: File, previewUrl: string) => void;
  className?: string;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB

export default function ImageUpload({
  type,
  onSelect,
  className = "",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🔒 Type validation
    if (type === "image" && !file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    if (type === "video" && !file.type.startsWith("video/")) {
      setError("Please select a valid video file");
      return;
    }

    // 📏 Size validation
    if (type === "image" && file.size > MAX_IMAGE_SIZE) {
      setError("Image must be less than 5MB");
      return;
    }

    if (type === "video" && file.size > MAX_VIDEO_SIZE) {
      setError("Video must be less than 50MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const previewUrl = URL.createObjectURL(file);

      onSelect(file, previewUrl);

      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      console.error(err);
      setError("Failed to load media");
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={type === "image" ? "image/*" : "video/*"}
        onChange={handleSelect}
        className="hidden"
        id={inputId}
      />

      <label
        htmlFor={inputId}
        className={`flex items-center justify-center gap-2 px-4 py-2 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-[#AAAAAA] rounded-lg transition-all duration-300 cursor-pointer text-sm ${
          uploading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {uploading ? (
          <>
            <Loader size={16} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Upload size={16} />
            Upload {type === "image" ? "Image" : "Video"}
          </>
        )}
      </label>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
