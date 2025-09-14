import React, { useState } from "react";

const UploadGame: React.FC = () => {
  const [gameFile, setGameFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileUrls, setFileUrls] = useState<{ gameZipUrl?: string; coverImageUrl?: string }>({});

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const handleUpload = async () => {
    if (!gameFile || !coverImage) {
      alert("Please select both game zip and cover image!");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("gameZip", gameFile);
    formData.append("coverImage", coverImage);

    try {
      const res = await fetch(`${BACKEND_URL}/api/gameupload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setFileUrls(data);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed!");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Upload Game</h2>
      <div>
        <label>Game Zip File:</label>
        <input type="file" accept=".zip" onChange={(e) => setGameFile(e.target.files?.[0] || null)} />
      </div>

      <div>
        <label>Cover Image:</label>
        <input type="file" accept="image/*" onChange={(e) => setCoverImage(e.target.files?.[0] || null)} />
      </div>

      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload"}
      </button>

      {fileUrls.coverImageUrl && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Uploaded Successfully 🎉</h3>
          <p>Game File: {fileUrls.gameZipUrl}</p>
          <img src={fileUrls.coverImageUrl} alt="Game Cover" style={{ width: "200px", borderRadius: "8px" }} />
        </div>
      )}
    </div>
  );
};

export default UploadGame;
