import { ALL_GAME_STAGE_IDS, type DeckId, type GameStageId } from '../data/decks';

export type ScoreRank = 'S' | 'A' | 'B' | 'C';

export interface FlashcardRecord {
  bestTimeMs: number;
  clearCount: number;
  lastTimeMs: number;
  updatedAt: string;
}

export interface GameStageRecord {
  highScore: number;
  bestRank?: ScoreRank;
  cleared: boolean;
  clearCount: number;
  /** Optional legacy field retained for backward compatibility */
  bestTimeMs?: number;
}

export interface AppRecords {
  flashcards: Partial<Record<DeckId, FlashcardRecord>>;
  game: Partial<Record<GameStageId, GameStageRecord>>;
  soundEnabled: boolean;
}

const STORAGE_KEY = 'keisanapp-records-v1';

const DEFAULT_RECORDS: AppRecords = {
  flashcards: {},
  game: {},
  soundEnabled: true,
};

const RANK_ORDER: Record<ScoreRank, number> = {
  C: 1,
  B: 2,
  A: 3,
  S: 4,
};

export function calculateScoreRank(score: number, stageId: GameStageId): ScoreRank {
  if (stageId === 'mixed') {
    if (score >= 3200) return 'S';
    if (score >= 2400) return 'A';
    if (score >= 1600) return 'B';
    return 'C';
  }
  if (score >= 2500) return 'S';
  if (score >= 1900) return 'A';
  if (score >= 1300) return 'B';
  return 'C';
}

export function loadRecords(): AppRecords {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECORDS, flashcards: {}, game: {} };
    const parsed = JSON.parse(raw) as Partial<AppRecords>;
    return {
      flashcards: parsed.flashcards ?? {},
      game: parsed.game ?? {},
      soundEnabled: parsed.soundEnabled ?? true,
    };
  } catch {
    return { ...DEFAULT_RECORDS, flashcards: {}, game: {} };
  }
}

export function saveRecords(records: AppRecords): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

export function recordFlashcardClear(
  deckId: DeckId,
  elapsedMs: number,
): { records: AppRecords; isNewBest: boolean } {
  const records = loadRecords();
  const prev = records.flashcards[deckId];
  const isNewBest = !prev || elapsedMs < prev.bestTimeMs;

  records.flashcards[deckId] = {
    bestTimeMs: prev ? Math.min(prev.bestTimeMs, elapsedMs) : elapsedMs,
    clearCount: (prev?.clearCount ?? 0) + 1,
    lastTimeMs: elapsedMs,
    updatedAt: new Date().toISOString(),
  };

  saveRecords(records);
  return { records, isNewBest };
}

export function recordGameResult(
  stageId: GameStageId,
  score: number,
  cleared: boolean,
): { records: AppRecords; isNewHighScore: boolean; rank: ScoreRank } {
  const records = loadRecords();
  const prev = records.game[stageId];
  const isNewHighScore = !prev || score > prev.highScore;
  const rank = calculateScoreRank(score, stageId);

  const prevRank = prev?.bestRank;
  const bestRank =
    cleared && (!prevRank || RANK_ORDER[rank] > RANK_ORDER[prevRank]) ? rank : prevRank;

  records.game[stageId] = {
    highScore: prev ? Math.max(prev.highScore, score) : score,
    bestRank,
    cleared: Boolean(prev?.cleared || cleared),
    clearCount: (prev?.clearCount ?? 0) + (cleared ? 1 : 0),
  };

  saveRecords(records);
  return { records, isNewHighScore, rank };
}

/** Reset all saved game progress (high scores, ranks, clears) while preserving flashcard records */
export function resetGameRecords(): AppRecords {
  const records = loadRecords();
  records.game = {};
  saveRecords(records);
  return records;
}

export function getTotalGameHighScore(records: AppRecords): number {
  return ALL_GAME_STAGE_IDS.reduce(
    (sum, stageId) => sum + (records.game[stageId]?.highScore ?? 0),
    0,
  );
}

export function getClearedStageCount(records: AppRecords): number {
  return ALL_GAME_STAGE_IDS.filter((stageId) => records.game[stageId]?.cleared).length;
}

export function saveSoundEnabled(enabled: boolean): void {
  const records = loadRecords();
  records.soundEnabled = enabled;
  saveRecords(records);
}
