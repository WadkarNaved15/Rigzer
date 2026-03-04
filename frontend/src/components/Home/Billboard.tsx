import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
const Tower = React.lazy(() => import("./Tower"));

type Face = "follow" | "reading";
const Billboard: React.FC = () => {
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
  <div className="flex flex-col h-full w-full dark:bg-[#191919] rounded-xl overflow-hidden">
    
    {/* Header */}
    <div className="flex items-center justify-between px-2 py-3">
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

    {/* Content */}
    <div className="flex-1 overflow-hidden border-t border-purple-600 dark:border-gray-200">
      <Suspense fallback={<div className="text-center text-gray-400">Loading...</div>}>
        <Tower activeFace={activeSection}/>
      </Suspense>
    </div>
  </div>
);
};

export default Billboard;
