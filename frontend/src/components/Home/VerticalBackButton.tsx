import { useLocation, Link } from "react-router-dom";

function VerticalBackButton() {
  const location = useLocation();

  if (location.pathname === "/") return null;

  const text = "BACKTOFEED".split("");

  return (
    <Link
      to="/"
      className="
        hidden lg:flex
        absolute
        left-[calc(100%/12*2)]
        xl:left-[calc(100%/12*2)]
        2xl:left-[calc(100%/16*3)]
        top-[30vh]
        -translate-x-1/2
        z-40
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