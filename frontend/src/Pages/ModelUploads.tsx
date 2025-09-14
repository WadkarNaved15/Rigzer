import React, { useState } from "react";

// ✅ Add type for custom element so TS doesn’t complain
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": any;
    }
  }
}

const TestModelUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a .glb or .gltf file first");
      return;
    }
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("model", file);

    try {
      const response = await fetch(`${BACKEND_URL}/api/compression`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Upload failed");
      }

      // Backend returns the path → use it for preview
      setPreviewUrl(`${BACKEND_URL}/${data.path}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-xl">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        Test 3D Model Upload & Compression
      </h2>

      <input
        type="file"
        accept=".glb,.gltf"
        onChange={handleFileChange}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload & Compress"}
      </button>

      {error && <p className="text-red-500 mt-3">{error}</p>}

      {previewUrl && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
            Compressed Model Preview:
          </h3>
          <model-viewer
            src={previewUrl}
            alt="Compressed 3D Model"
            auto-rotate
            autoplay
            disable-zoom
            style={{ width: "100%", height: "400px", background: "transparent" }}
            draco-decoder-path="https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
          >
          </model-viewer>

        </div>
      )}
    </div>
  );
};

export default TestModelUpload;
