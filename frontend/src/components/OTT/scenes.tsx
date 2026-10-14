import { useId } from "react";

export type LibraryTheme = "forest" | "ember" | "rose" | "violet" | "lime";
export type LibraryScene = "knight" | "temple" | "hex" | "racer" | "field";

export interface LibraryGame {
  id: string;
  title: string;
  genre: string;
  hoursPlayed: number; // 0 => "Not played yet"
  theme: LibraryTheme;
  scene: LibraryScene;
  wide?: boolean; // spans two columns
  tall?: boolean; // spans two rows
}

export const THEMES: Record<LibraryTheme, string> = {
  forest: "bg-gradient-to-b from-[#1f6f63] via-[#1c4a47] to-[#0e1a1c]",
  ember: "bg-gradient-to-b from-[#a3202f] via-[#62151f] to-[#1a0c11]",
  rose: "bg-gradient-to-b from-[#e51a52] via-[#c2123f] to-[#8e0d31]",
  violet: "bg-gradient-to-b from-[#74299a] via-[#41195a] to-[#150c1d]",
  lime: "bg-gradient-to-b from-[#8cc61f] via-[#5f9615] to-[#2f5a0d]",
};

export const GOLD = "text-[#ecc98c]";

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

const PIXELS = [
  [24, 150], [60, 118], [96, 142], [132, 100], [168, 128], [204, 92],
  [240, 120], [276, 84], [330, 110], [372, 96], [48, 190], [150, 176],
];

const HEXES: [number, number, number][] = [
  [40, 150, 14], [96, 120, 12], [140, 175, 14], [198, 135, 12], [250, 180, 14], [320, 150, 12],
];

export function Scene({ scene }: { scene: LibraryScene }) {
  const gid = useId().replace(/:/g, "");

  const silhouette = (x: number, y: number) => (
    <g fill="#12080c" opacity="0.92">
      <circle cx={x} cy={y - 40} r="9" />
      <path d={`M${x - 16} ${y + 8} L${x - 12} ${y - 28} Q${x} ${y - 36} ${x + 12} ${y - 28} L${x + 16} ${y + 8} Z`} />
      <rect x={x + 26} y={y - 70} width="3" height={78} />
    </g>
  );

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 260"
      preserveAspectRatio="xMaxYMax slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id={`glow-${gid}`}>
          <stop offset="0%" stopColor="#ff9a2e" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ff7a1a" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {scene !== "racer" && (
        <>
          <circle cx="300" cy="105" r="95" fill={`url(#glow-${gid})`} />
          <circle cx="300" cy="105" r="30" fill="#f2831f" opacity={scene === "field" ? 0.7 : 0.95} />
        </>
      )}

      {scene === "knight" && (
        <>
          {PIXELS.map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="5" height="5" fill="#f2922a" opacity="0.85" />
          ))}
          {silhouette(300, 215)}
        </>
      )}

      {scene === "temple" && (
        <>
          <path d="M150 220 L225 150 L300 220 Z" fill="#12080c" opacity="0.8" />
          <path d="M250 220 L330 135 L410 220 Z" fill="#12080c" opacity="0.9" />
          {silhouette(285, 215)}
        </>
      )}

      {scene === "hex" && (
        <>
          {HEXES.map(([x, y, r], i) => (
            <polygon key={i} points={hexPoints(x, y, r)} fill="none" stroke="#ff6a3d" strokeWidth="1.5" opacity="0.55" />
          ))}
          {silhouette(310, 220)}
        </>
      )}

      {scene === "racer" && (
        <>
          <circle cx="200" cy="130" r="58" fill="#3fd0ae" opacity="0.85" />
          <path d="M165 260 L200 205 L235 260 Z" fill="#101016" opacity="0.9" />
        </>
      )}

      {scene === "field" && (
        <>
          <path d="M0 230 Q120 170 240 215 T400 200 V260 H0 Z" fill="#2f5a0d" opacity="0.7" />
          <path d="M0 250 Q140 205 260 240 T400 232 V260 H0 Z" fill="#1d3b08" opacity="0.8" />
        </>
      )}
    </svg>
  );
}

/**
 * Drifting sparks for the hero backdrop. Positions come from a golden-angle
 * spiral, so the layout is identical on every render (no Math.random, no
 * hydration mismatch) but still looks scattered.
 */
const GOLDEN_ANGLE = 2.399963;

export function Embers({ count = 30 }: { count?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 260"
      preserveAspectRatio="xMaxYMax slice"
      className="absolute inset-0 h-full w-full"
    >
      {Array.from({ length: count }, (_, i) => {
        const a = i * GOLDEN_ANGLE;
        const r = 28 + i * (170 / count);
        const x = 270 + r * Math.cos(a) * 0.9;
        const y = 120 + r * Math.sin(a) * 0.6;
        const size = 0.9 + (i % 4) * 0.55;
        const base = 0.25 + 0.5 * Math.abs(Math.sin(i * 1.7));
        return (
          <circle
            key={i}
            className="ember"
            cx={x.toFixed(1)}
            cy={y.toFixed(1)}
            r={size}
            fill="#ffb457"
            opacity={base.toFixed(2)}
            style={{ animationDelay: `${((i * 370) % 4200) / 1000}s` }}
          />
        );
      })}
    </svg>
  );
}