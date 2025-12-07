// src/components/Recommendations.tsx
import React, { useMemo, useState } from "react";
import gamesJson from "../data/gameData.json";
import {
  Game,
  getRecommendationsForGame,
  getRecommendationsForUserPref,
  Recommendation,
} from "../utils/recommender";

const gamesData = gamesJson as Game[];

export const Recommendations: React.FC = () => {
  const [selected, setSelected] = useState<string>(gamesData[0]?.game_id ?? "");
  const [topK, setTopK] = useState<number>(3);

  const options = gamesData.map((g) => ({ id: g.game_id, title: g.title }));

  const recs: Recommendation[] = useMemo(() => {
    if (!selected) return [];
    return getRecommendationsForGame(selected, gamesData, topK);
  }, [selected, topK]);

  const userPrefRecs: Recommendation[] = useMemo(() => {
    const pref = {
      tags: ["Horror", "Pixel Art"],
      engine: "Godot",
      avg_session: 300,
      return_rate: 0.35,
    };
    return getRecommendationsForUserPref(pref, gamesData, 4);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Content-based Recommender — Test UI (TypeScript)</h2>

      <div style={{ marginBottom: 12 }}>
        <label>
          Choose a game:&nbsp;
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>

        <label style={{ marginLeft: 12 }}>
          Top K:&nbsp;
          <input
            type="number"
            value={topK}
            min={1}
            max={10}
            onChange={(e) => setTopK(Number(e.target.value))}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        <div>
          <h3>Recommendations for selected game</h3>
          <ol>
            {recs.map((r) => (
              <li key={r.game_id}>
                <strong>{r.title}</strong> — score: {r.score.toFixed(3)}
              </li>
            ))}
            {recs.length === 0 && <li>No recommendations found.</li>}
          </ol>
        </div>

        <div>
          <h3>Example: Based on user prefs (Horror + Pixel Art + Godot)</h3>
          <ol>
            {userPrefRecs.map((r) => (
              <li key={r.game_id}>
                <strong>{r.title}</strong> — score: {r.score.toFixed(3)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Recommendations;
