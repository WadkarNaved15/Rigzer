import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const Tower = React.lazy(() => import("./Tower"));

type Face = "follow" | "reading" | "pockets";

const faces: Face[] = ["follow", "reading", "pockets"];

const Billboard: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeSection = faces[activeIndex];

  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % faces.length);
  }, []);

  const prev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + faces.length) % faces.length);
  }, []);

  /* =========================
     AUTO FLIP
  ========================= */

  useEffect(() => {
    intervalRef.current = setInterval(next, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [next]);

  const stopAuto = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resumeAuto = () => {
    intervalRef.current = setInterval(next, 15000);
  };

  return (
    <div
      className="flex flex-col h-full w-full dark:bg-[#191919] rounded-xl overflow-hidden"
      onMouseEnter={stopAuto}
      onMouseLeave={resumeAuto}
      onWheel={stopAuto}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-2 py-3">
        <h2 className="text-lg font-bold dark:text-white capitalize">
          {activeSection}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={prev}
            className="p-2 rounded-full bg-gray-100 dark:bg-[#252525] dark:text-white hover:bg-purple-600 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>

          <button
            onClick={next}
            className="p-2 rounded-full bg-gray-100 dark:bg-[#252525] dark:text-white hover:bg-purple-600 hover:text-white"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden border-t border-purple-600 dark:border-gray-200">
        <Suspense fallback={<div className="text-center text-gray-400 pt-10">Loading...</div>}>
          <Tower activeFace={activeSection} />
        </Suspense>
      </div>
    </div>
  );
};

export default React.memo(Billboard);