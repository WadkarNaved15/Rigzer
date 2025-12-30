import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type Asset = {
    url: string;
    type: "image" | "video";
    name?: string;
};

interface MediaViewerProps {
    assets: Asset[];
    startIndex: number;
    onClose: () => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({
    assets,
    startIndex,
    onClose,
}) => {
    const [currentIndex, setCurrentIndex] = useState(startIndex);

    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onEsc);
        return () => window.removeEventListener("keydown", onEsc);
    }, [onClose]);

    const goNext = () =>
        setCurrentIndex((i) => (i + 1) % assets.length);
    const goPrev = () =>
        setCurrentIndex((i) =>
            i === 0 ? assets.length - 1 : i - 1
        );

    return (
        <div
            className="
        fixed inset-0 z-50
        bg-black/90
        flex items-center justify-center
      "
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}


        >
            {/* CLOSE */}
            <button
                onClick={(e) => {
                    e.stopPropagation(); // 🔥 VERY IMPORTANT
                    onClose();
                }}
                className="absolute top-4 left-4 text-white"
            >
                <X size={28} />
            </button>

            {/* MEDIA */}
            <div
                className="max-w-[90vw] max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {assets[currentIndex].type === "video" ? (
                    <video
                        controls
                        autoPlay
                        className="max-h-[90vh] max-w-[90vw] object-contain"
                        src={assets[currentIndex].url}
                    />
                ) : (
                    <img
                        src={assets[currentIndex].url}
                        alt={assets[currentIndex].name}
                        className="max-h-[90vh] max-w-[90vw] object-contain"
                    />
                )}
            </div>

            {/* NAVIGATION */}
            {assets.length > 1 && (
                <>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            goPrev();
                        }}
                        className="absolute left-4 text-white"
                    >
                        <ChevronLeft size={32} />
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            goNext();
                        }}
                        className="absolute right-4 text-white"
                    >
                        <ChevronRight size={32} />
                    </button>
                </>
            )}
        </div>
    );
};

export default MediaViewer;
