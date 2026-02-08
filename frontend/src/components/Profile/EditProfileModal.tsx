import { X, Camera, Check } from "lucide-react";
import { useState, useRef, ChangeEvent, useCallback } from "react";
import Cropper from "react-easy-crop"; // Import the cropper
import axios from "axios";
import { getCroppedImage } from "../../utils/cropImage";
import { useUser } from "../../context/user";

interface EditProfileModalProps {
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
  const { user, refreshUser } = useUser();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
  // States for the image adjustment UI
  const [editingImage, setEditingImage] = useState<{ url: string; type: 'avatar' | 'banner' } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  if (!user) return null;

  const [form, setForm] = useState({
    username: user.username || "",
    bio: user.bio || "",
    avatar: user.avatar || null,
    banner: user.banner || null,
    twitter: user.socials?.twitter || "",
    instagram: user.socials?.instagram || "",
    youtube: user.socials?.youtube || "",
    steam: user.socials?.steam || "",
    discord: user.socials?.discord || "",
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setEditingImage({ url: reader.result as string, type });
      });
      reader.readAsDataURL(file);
    }
  };
  const uploadToS3 = async (file: Blob, type: "avatar" | "banner") => {

  const res = await axios.post(`${BACKEND_URL}/api/upload/presigned-url`, {
    fileName: `${type}.jpg`,
    fileType: file.type,
    category: "image",
  });

  await axios.put(res.data.uploadUrl, file, {
    headers: { "Content-Type": file.type },
  });

  return res.data.fileUrl as string;
};

  const onCropComplete = useCallback((_: any, clippedPixels: any) => {
    setCroppedAreaPixels(clippedPixels);
  }, []);

  const applyCrop = async () => {
  if (!editingImage || !croppedAreaPixels) return;

  try {
    const croppedBlob = await getCroppedImage(
      editingImage.url,
      croppedAreaPixels
    );

    const uploadedUrl = await uploadToS3(
      croppedBlob,
      editingImage.type
    );

    setForm((prev) => ({
      ...prev,
      [editingImage.type]: uploadedUrl,
    }));

    setEditingImage(null);
    setZoom(1);
  } catch (err) {
    console.error("Image upload failed", err);
  }
};

  const saveProfile = async () => {
  try {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    await axios.patch(
      `${BACKEND_URL}/api/me`,
      {
        username: form.username,
        bio: form.bio,
        avatar: form.avatar,
        banner: form.banner,
        socials: {
          twitter: form.twitter,
          instagram: form.instagram,
          youtube: form.youtube,
          steam: form.steam,
          discord: form.discord,
        },
      },
      { withCredentials: true }
    );

    await refreshUser();
    onClose();
  } catch (err) {
    console.error("Update failed", err);
  }
};


  return (
    <div className="fixed inset-0 z-[100] bg-[#5b7083]/40 backdrop-blur-[2px] flex items-center justify-center p-4">

      {/* CROPPER OVERLAY - This shows up when an image is picked */}
      {editingImage && (
        <div className="absolute inset-0 z-[110] bg-black flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black z-20">
            <button onClick={() => setEditingImage(null)} className="text-white"><X /></button>
            <h2 className="text-white font-bold">Edit Media</h2>
            <button onClick={applyCrop} className="bg-white text-black px-4 py-1 rounded-full font-bold">Apply</button>
          </div>
          <div className="relative flex-1 bg-[#191919]">
            <Cropper
              image={editingImage.url}
              crop={crop}
              zoom={zoom}
              aspect={editingImage.type === 'banner' ? 3 / 1 : 1 / 1}
              cropShape={editingImage.type === 'avatar' ? 'round' : 'rect'}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="p-8 bg-black">
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      )}

      <div className="bg-black w-full max-w-[600px] h-full max-h-[90vh] rounded-2xl overflow-hidden flex flex-col border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-white/10">
          <div className="flex items-center gap-8">
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-xl font-bold text-white">Edit profile</h2>
          </div>
          <button onClick={saveProfile} className="bg-white text-black px-4 py-1.5 rounded-full font-bold text-sm">Save</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Banner */}
          <div className="relative mb-20">
            <div className="h-40 bg-zinc-800 relative">
              {form.banner && <img src={form.banner} className="w-full h-full object-cover" alt="Banner" />}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <button onClick={() => bannerInputRef.current?.click()} className="p-3 bg-black/50 rounded-full hover:bg-black/70 border border-white/20">
                  <Camera className="text-white w-6 h-6" />
                </button>
              </div>
              <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleFileChange(e, 'banner')} />
            </div>

            {/* Avatar */}
            <div className="absolute -bottom-16 left-4">
              <div className="w-32 h-32 rounded-full border-4 border-black bg-zinc-900 overflow-hidden relative">
                {form.avatar && <img src={form.avatar} className="w-full h-full object-cover" alt="Avatar" />}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <button onClick={() => avatarInputRef.current?.click()} className="p-2 bg-black/50 rounded-full hover:bg-black/70 border border-white/20">
                    <Camera className="text-white w-5 h-5" />
                  </button>
                </div>
              </div>
              <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} />
            </div>
          </div>

          {/* Rest of the Fields (Same as before) */}
          <div className="p-4 pt-0 space-y-6">
            <div className="group border border-zinc-800 rounded p-2 focus-within:border-blue-500">
              <label className="text-xs text-zinc-500">Name</label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full bg-transparent text-white outline-none" />
            </div>
            {/* Add Bio and Social inputs here... */}
            <div className="px-4 space-y-6 pb-10">
              {/* Bio, Social Links, etc. */}
              <h3 className="text-zinc-500 font-bold text-sm uppercase tracking-widest pt-4">Social Links</h3>
              <div className="grid grid-cols-1 gap-4">
                {['twitter', 'instagram', 'youtube', 'steam', 'discord'].map((id) => (
                  <div key={id} className="group border border-zinc-700 rounded-md p-2 focus-within:border-blue-500">
                    <label className="block text-xs text-zinc-500 capitalize">{id} URL</label>
                    <input
                      type="text"
                      value={(form as any)[id]}
                      onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                      className="w-full bg-transparent text-white outline-none pt-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;