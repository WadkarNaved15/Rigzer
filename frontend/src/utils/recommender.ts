// src/utils/recommender.ts
export type Game = {
  game_id: string;
  title: string;
  tags?: string[];
  engine?: string;
  build_type?: string;
  completion_rate?: number; // 0..1
  avg_session?: number; // seconds
  rage_quit?: number; // 0..1
  return_rate?: number; // 0..1
  // add more fields later
};

export type Vocab = {
  tags: string[];
  engines: string[];
  buildTypes: string[];
};

export type NumericMaxes = {
  completion_rate: number;
  avg_session: number;
  rage_quit: number;
  return_rate: number;
};

export type Recommendation = {
  game_id: string;
  title: string;
  score: number;
};

export type UserPref = {
  tags?: string[];
  engine?: string;
  build_type?: string;
  completion_rate?: number;
  avg_session?: number;
  rage_quit?: number;
  return_rate?: number;
};

// Build vocabulary sets from dataset
export function buildVocab(games: Game[]): Vocab {
  const tagsSet = new Set<string>();
  const enginesSet = new Set<string>();
  const buildTypesSet = new Set<string>();

  games.forEach((g) => {
    (g.tags || []).forEach((t) => tagsSet.add(t));
    if (g.engine) enginesSet.add(g.engine);
    if (g.build_type) buildTypesSet.add(g.build_type);
  });

  return {
    tags: Array.from(tagsSet),
    engines: Array.from(enginesSet),
    buildTypes: Array.from(buildTypesSet),
  };
}

// Encoders
function encodeTags(tags: string[], allTags: string[]): number[] {
  return allTags.map((t) => (tags && tags.includes(t) ? 1 : 0));
}
function encodeCategorical(value: string | undefined, allValues: string[]): number[] {
  return allValues.map((v) => (value === v ? 1 : 0));
}

// Normalizer for numeric features
function normalizeNumber(value: number | undefined, maxValue: number | undefined): number {
  if (!maxValue || maxValue === 0) return 0;
  const val = value ?? 0;
  return Math.max(0, Math.min(1, val / maxValue));
}

// Build numeric maxima for normalization
export function computeNumericMaxes(games: Game[]): NumericMaxes {
  const maxes: NumericMaxes = {
    completion_rate: 1,
    avg_session: 0,
    rage_quit: 1,
    return_rate: 1,
  };
  games.forEach((g) => {
    if (g.avg_session && g.avg_session > (maxes.avg_session || 0)) {
      maxes.avg_session = g.avg_session;
    }
  });
  if (!maxes.avg_session || maxes.avg_session === 0) maxes.avg_session = 1;
  return maxes;
}

// Build vector for a game
export function buildVector(game: Game, vocab: Vocab, numericMaxes: NumericMaxes): number[] {
  const tagVec = encodeTags(game.tags || [], vocab.tags);
  const engineVec = encodeCategorical(game.engine, vocab.engines);
  const buildTypeVec = encodeCategorical(game.build_type, vocab.buildTypes);

  const completion = normalizeNumber(game.completion_rate, numericMaxes.completion_rate);
  const avgSession = normalizeNumber(game.avg_session, numericMaxes.avg_session);
  const rageQuit = normalizeNumber(game.rage_quit, numericMaxes.rage_quit);
  const returnRate = normalizeNumber(game.return_rate, numericMaxes.return_rate);

  return [...tagVec, ...engineVec, ...buildTypeVec, completion, avgSession, rageQuit, returnRate];
}

// Cosine similarity
export function cosineSimilarity(A: number[], B: number[]): number {
  if (!A || !B || A.length !== B.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < A.length; i++) {
    dot += A[i] * B[i];
    magA += A[i] * A[i];
    magB += B[i] * B[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Generate recommendations for a given game id
export function getRecommendationsForGame(targetGameId: string, games: Game[], topK = 5): Recommendation[] {
  const vocab = buildVocab(games);
  const numericMaxes = computeNumericMaxes(games);

  const vectors = new Map<string, number[]>();
  games.forEach((g) => {
    vectors.set(g.game_id, buildVector(g, vocab, numericMaxes));
  });

  const targetVec = vectors.get(targetGameId);
  if (!targetVec) return [];

  const results: Recommendation[] = games
    .filter((g) => g.game_id !== targetGameId)
    .map((g) => {
      const v = vectors.get(g.game_id)!;
      return {
        game_id: g.game_id,
        title: g.title,
        score: cosineSimilarity(targetVec, v),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return results;
}

// Generate recommendations based on pseudo user preferences
export function getRecommendationsForUserPref(pref: UserPref, games: Game[], topK = 6): Recommendation[] {
  const vocab = buildVocab(games);
  const numericMaxes = computeNumericMaxes(games);

  const userPseudo: Game = {
    game_id: "user_pref",
    title: "User Pref",
    tags: pref.tags ?? [],
    engine: pref.engine ?? "",
    build_type: pref.build_type ?? "",
    completion_rate: pref.completion_rate ?? 0.6,
    avg_session: pref.avg_session ?? numericMaxes.avg_session / 4,
    rage_quit: pref.rage_quit ?? 0.2,
    return_rate: pref.return_rate ?? 0.3,
  };

  const userVec = buildVector(userPseudo, vocab, numericMaxes);

  const results: Recommendation[] = games
    .map((g) => {
      const gv = buildVector(g, vocab, numericMaxes);
      return {
        game_id: g.game_id,
        title: g.title,
        score: cosineSimilarity(userVec, gv),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return results;
}
