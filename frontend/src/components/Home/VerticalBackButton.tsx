import { useLocation, Link } from "react-router-dom";
import { useEffect, useState, RefObject } from "react";

interface VerticalBackButtonProps {
  sidebarRef: RefObject<HTMLDivElement | null>;
  centerRef: RefObject<HTMLDivElement | null>;
}

function VerticalBackButton({ sidebarRef, centerRef }: VerticalBackButtonProps) {
  const location = useLocation();
  const [leftPos, setLeftPos] = useState<number | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (sidebarRef.current && centerRef.current) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect();
        const centerRect = centerRef.current.getBoundingClientRect();
        // True midpoint of the gap between sidebar right edge and center column left edge
        const mid = (sidebarRect.right + centerRect.left) / 2;
        setLeftPos(mid);
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("load", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("load", updatePosition);
    };
  }, [sidebarRef, centerRef]);

  if (location.pathname === "/") return null;
  if (leftPos === null) return null;

  const text = "BACKTOFEED".split("");

  return (
    <Link
      to="/"
      style={{
        // translateX(-50%) centers the button on the midpoint pixel
        left: leftPos,
        transform: "translateX(-50%)",
      }}
      className="
        hidden lg:flex
        fixed
        top-[35vh]
        z-50

        flex-col items-center
        gap-1
        px-3 py-6
        rounded-xl

        bg-white/90 dark:bg-[#1f1f1f]/90
        backdrop-blur-md
        border border-gray-200 dark:border-white/10

        shadow-lg hover:shadow-xl
        hover:-translate-y-1
        transition-all duration-300
      "
    >
      {text.map((letter, i) => (
        <span
          key={i}
          className="text-sm font-bold text-gray-700 dark:text-gray-200"
        >
          {letter}
        </span>
      ))}
    </Link>
  );
}

export default VerticalBackButton;