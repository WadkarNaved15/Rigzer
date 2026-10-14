import { LIBRARY_GAMES } from "./gameData";
import { GOLD, Scene, THEMES, type LibraryGame } from "./scenes";

export type { LibraryGame, LibraryScene, LibraryTheme } from "./scenes";

interface GameLibraryProps {
  games?: LibraryGame[];
  onSelect?: (game: LibraryGame) => void;
  className?: string;
}

function GameCard({
  game,
  onSelect,
  animationIndex = 0,
}: {
  game: LibraryGame;
  onSelect?: (g: LibraryGame) => void;
  animationIndex?: number;
}) {
  return (
    <article
      style={{ animationDelay: `${animationIndex * 55}ms` }}
      className={`
        group relative isolate overflow-hidden
        rounded-[28px] border border-white/5 h-full
        ${THEMES[game.theme]}
        ${game.wide ? "sm:col-span-2" : ""}
        ${game.tall ? "sm:row-span-2" : ""}
        game-tile-enter
      `}
    >
      <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.04]">
        <Scene scene={game.scene} />
      </div>

      {/* Art title */}
      <div className="absolute inset-x-0 top-[40%] px-6 text-center">
        <h3
          className={`mx-auto max-w-[80%] text-2xl sm:text-3xl font-black leading-[1.05] tracking-tight ${GOLD} drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]`}
        >
          {game.title}
        </h3>
        <span className="mx-auto mt-3 block h-[3px] w-24 rounded-full bg-orange-500/90" />
      </div>

      {/* Whole tile is the hit target */}
      <button
        type="button"
        onClick={() => onSelect?.(game)}
        aria-label={`Open ${game.title}`}
        className="absolute inset-0 z-10 rounded-[28px] outline-none ring-inset transition-shadow focus-visible:ring-2 focus-visible:ring-[#ecc98c] group-hover:shadow-[inset_0_0_0_1px_rgba(236,201,140,0.35)]"
      />
    </article>
  );
}

export default function GameLibrary({ games = LIBRARY_GAMES, onSelect, className = "" }: GameLibraryProps) {
  return (
    <section aria-label="Game library" className={`w-full py-4 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[250px] sm:auto-rows-[270px] grid-flow-dense gap-4">
        {games.map((game, index) => (
          <GameCard key={game.id} game={game} onSelect={onSelect} animationIndex={index} />
        ))}
      </div>
    </section>
  );
}