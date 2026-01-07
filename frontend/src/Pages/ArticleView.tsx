import { useEffect, useState } from "react";
import ReadOnlyCanvas from "../components/Articles/ReadOnlyCanvas";

interface Props {
  canvasId: string;
  onClose: () => void;
}

export default function ArticleOverlay({ canvasId, onClose }: Props) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`http://localhost:5000/api/article/${canvasId}`)
      .then(res => res.json())
      .then(setData);
  }, [canvasId]);

  if (!data) {
    return (
      <div className="h-[80vh] flex items-center justify-center text-[#888]">
        Loading article...
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-50 bg-black/60 text-white px-3 py-1 rounded"
      >
        ← Back
      </button>

      <ReadOnlyCanvas data={data} />
    </div>
  );
}
