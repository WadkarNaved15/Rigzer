import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const Tower = React.lazy(() => import("./Tower"));

type Face = "follow" | "reading";

const Billboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Face>("follow");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const toggleSection = useCallback(() => {
    setActiveSection((prev) => (prev === "follow" ? "reading" : "follow"));
  }, []);

  /* =========================
     AUTO FLIP
  ========================= */

  useEffect(() => {
    intervalRef.current = setInterval(toggleSection, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [toggleSection]);

  /* =========================
     PAUSE / RESUME AUTO FLIP
  ========================= */

  const stopAuto = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const resumeAuto = () => {
    intervalRef.current = setInterval(toggleSection, 15000);
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
            onClick={toggleSection}
            className="p-2 rounded-full bg-gray-100 dark:bg-[#252525] dark:text-white hover:bg-purple-600 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>

          <button
            onClick={toggleSection}
            className="p-2 rounded-full bg-gray-100 dark:bg-[#252525] dark:text-white hover:bg-purple-600 hover:text-white"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {/* CONTENT */}

      <div className="flex-1 overflow-hidden border-t border-purple-600 dark:border-gray-200">
        <Suspense
          fallback={
            <div className="text-center text-gray-400 pt-10">
              Loading...
            </div>
          }
        >
          <Tower activeFace={activeSection} />
        </Suspense>
      </div>
    </div>
  );
};

export default React.memo(Billboard);