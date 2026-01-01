import { useState, useRef } from 'react';
import { Upload, Loader } from 'lucide-react';


interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  className?: string;
}

export default function ImageUpload({ onUploadComplete, className = '' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

    //   const { error: uploadError } = await supabase.storage
    //     .from('blog-images')
    //     .upload(filePath, file);

    //   if (uploadError) throw uploadError;

    //   const { data: { publicUrl } } = supabase.storage
    //     .from('blog-images')
    //     .getPublicUrl(filePath);

    //   onUploadComplete(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
        id="image-upload"
      />
      <label
        htmlFor="image-upload"
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
