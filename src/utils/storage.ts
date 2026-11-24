import type { DeckId } from '../data/decks';

export interface FlashcardRecord {
  bestTimeMs: number;
  clearCount: number;
  lastTimeMs: number;
  updatedAt: string;
}

export interface GameStageRecord {
  highScore: number;
  bestTimeMs: number;
  cleared: boolean;
  clearCount: number;
}

export interface AppRecords {
  flashcards: Partial<Record<DeckId, FlashcardRecord>>;
  game: Partial<Record<DeckId, GameStageRecord>>;
  soundEnabled: boolean;
}

const STORAGE_KEY = 'keisanapp-records-v1';

const DEFAULT_RECORDS: AppRecords = {
  flashcards: {},
  game: {},
  soundEnabled: true,
};

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
  deckId: DeckId,
  score: number,
  elapsedMs: number,
  cleared: boolean,
): { records: AppRecords; isNewHighScore: boolean } {
  const records = loadRecords();
  const prev = records.game[deckId];
  const isNewHighScore = !prev || score > prev.highScore;

  records.game[deckId] = {
    highScore: prev ? Math.max(prev.highScore, score) : score,
    bestTimeMs: cleared
      ? prev && prev.cleared
        ? Math.min(prev.bestTimeMs, elapsedMs)
        : elapsedMs
      : (prev?.bestTimeMs ?? 0),
    cleared: Boolean(prev?.cleared || cleared),
    clearCount: (prev?.clearCount ?? 0) + (cleared ? 1 : 0),
  };

  saveRecords(records);
  return { records, isNewHighScore };
}

export function saveSoundEnabled(enabled: boolean): void {
  const records = loadRecords();
  records.soundEnabled = enabled;
  saveRecords(records);
}
