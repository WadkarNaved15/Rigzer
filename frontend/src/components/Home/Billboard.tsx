import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
const Tower = React.lazy(() => import("./Tower"));

type Face = "follow" | "posts" | "reading" | "projects";
interface BillboardProps {
  onOpenArticle: (canvasId: string) => void;
}
const Billboard: React.FC<BillboardProps> = ({ onOpenArticle }) => {
  const [activeSection, setActiveSection] = useState<Face>("follow");
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [angle, setAngle] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//   if (activeFace !== currentFace) {
//     const from = faces.indexOf(currentFace);
//     const to = faces.indexOf(activeFace);
//     let step = (to - from + faces.length) % faces.length; // always forward
//     setAngle(prev => prev - step * 90);                   // minus because your cube uses -90 steps
//     setCurrentFace(activeFace);
//   }
// }, [activeFace]);

  // ✅ Memoize sections so they're not rebuilt every render
const sections = useMemo(
  () => [
    {
      id: "follow",
      title: "Follow",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-white">
            Stay updated with my latest game-dev insights and tutorials.
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button className="bg-purple-600 ml-24 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              Subscribe
            </button>
          </div>
        </div>
      ),
    },

    {
      id: "posts",
      title: "Posts",
      content: (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="border-b pb-4">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=64&h=64&q=80"
                  alt={`Author ${i + 1}`}
                  className="w-8 h-8 rounded-full"
                />
                <span className="font-semibold">Author {i + 1}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-200">
                Sample post content {i + 1} showing layout and readability.
              </p>
            </div>
          ))}
        </div>
      ),
    },

    {
      id: "reading",
      title: "Reading",
      content: (
        <div className="space-y-3">
          {["Game Physics", "AI in Games", "Shader Programming"].map(
            (topic, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-2 text-gray-600 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer"
              >
                <i className="fas fa-fire text-orange-500"></i>
                <span>{topic}</span>
              </div>
            )
          )}
        </div>
      ),
    },

    {
      id: "projects",
      title: "Projects",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-white">
            Explore my open-source experiments & indie games.
          </p>
          <ul className="list-disc pl-5 text-gray-600 dark:text-white">
            <li>Voxel Sandbox</li>
            <li>Roguelike Toolkit</li>
            <li>WebGL Racer</li>
          </ul>
        </div>
      ),
    },
  ],
  []
);


  // ✅ Scroll Loop Effect
  // useEffect(() => {
  //   const scroll = scrollRef.current;
  //   if (!scroll) return;

  //   const scrollWidth = scroll.scrollWidth / 3;
  //   const midpoint = scrollWidth * 1.5;
  //   scroll.scrollLeft = scrollWidth; // Start in middle

  //   const handleScroll = () => {
  //     if (scroll.scrollLeft >= midpoint) {
  //       scroll.scrollLeft -= scrollWidth;
  //     } else if (scroll.scrollLeft <= scrollWidth / 2) {
  //       scroll.scrollLeft += scrollWidth;
  //     }
  //   };

  //   scroll.addEventListener("scroll", handleScroll);
  //   return () => scroll.removeEventListener("scroll", handleScroll);
  // }, []);

  // ✅ Memoized drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current!.offsetLeft);
    setScrollLeft(scrollRef.current!.scrollLeft);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current!.offsetLeft;
      scrollRef.current!.scrollLeft = scrollLeft - (x - startX) * 2;
    },
    [isDragging, scrollLeft, startX]
  );

const handleClick = useCallback((e: React.MouseEvent, id: Face) => {
  if (isDragging) {
    e.preventDefault();
    return;
  }
  setActiveSection(id);

  // scroll that button into view
  const btn = (e.target as HTMLElement).closest("button");
  btn?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
}, [isDragging]);


  return (
    // <div className="h-full bg-gray-100 dark:bg-black shadow-2xl rounded-lg p-6">
    <>
      <div
        className="relative overflow-hidden mb-6 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <div
          ref={scrollRef}
          className="flex overflow-x-hidden"
          style={{ scrollBehavior: isDragging ? "auto" : "smooth" }}
        >
          {[...sections, ...sections, ...sections].map((section, index) => (
            <button
              key={`${section.id}-${index}`}
              onClick={(e) => handleClick(e, section.id as Face)}
              className={`flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap transition-colors mr-4 ${
                activeSection === section.id
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[80%] border-t border-purple-600 pt-2 dark:border-gray-200 transition-opacity duration-300">
        <Suspense fallback={<div className="text-center text-gray-400">Loading section...</div>}>
          <Tower activeFace={activeSection}  onOpenArticle={onOpenArticle}/>
        </Suspense>
      </div>
      </>
    // </div>
  );
};

export default Billboard;
