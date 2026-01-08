import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
const Tower = React.lazy(() => import("./Tower"));

type Face = "follow" | "reading";
interface BillboardProps {
  onOpenArticle: (canvasId: string) => void;
}
const Billboard: React.FC<BillboardProps> = ({ onOpenArticle }) => {
  const [activeSection, setActiveSection] = useState<Face>("follow");

  const toggleSection = useCallback(() => {
    setActiveSection((prev) => (prev === "follow" ? "reading" : "follow"));
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      toggleSection();
    }, 15000); // 15000ms = 15 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [toggleSection]);

  return (
    <>
      {/* Navigation Controls */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-lg font-bold dark:text-white capitalize">
          {activeSection}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={toggleSection}
            className="p-2 rounded-full bg-gray-100 dark:bg-[#252525] dark:text-white hover:bg-purple-600 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={toggleSection}
            className="p-2 rounded-full bg-gray-100 dark:bg-[#252525] dark:text-white hover:bg-purple-600 hover:text-white transition-colors"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      <div className="h-[80%] border-t border-purple-600 pt-2 dark:border-gray-200 transition-opacity duration-300">
        <Suspense fallback={<div className="text-center text-gray-400">Loading...</div>}>
          <Tower activeFace={activeSection} onOpenArticle={onOpenArticle} />
        </Suspense>
      </div>
    </>
  );
};

export default Billboard;
