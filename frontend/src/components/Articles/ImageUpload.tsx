import { useState, useRef, useId } from 'react';
import { Upload, Loader } from 'lucide-react';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  className?: string;
}

export default function ImageUpload({ onUploadComplete, className = '' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onUploadComplete(base64);
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };

      reader.onerror = () => {
        setError('Failed to read image file');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image loading failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load image');
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id={inputId}
      />
      <label
        htmlFor={inputId}
        className={`flex items-center justify-center gap-2 px-4 py-2 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] text-[#AAAAAA] rounded-lg transition-all duration-300 cursor-pointer text-sm ${
          uploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {uploading ? (
          <>
            <Loader size={16} className="animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload size={16} />
            Upload Image
          </>
        )}
      </label>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
