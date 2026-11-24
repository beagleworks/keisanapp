export type DeckId = 'tashizan1' | 'tashizan2' | 'hikizan1' | 'hikizan2';

export type GameStageId = DeckId | 'mixed';

export const ALL_GAME_STAGE_IDS: readonly GameStageId[] = [
  'tashizan1',
  'tashizan2',
  'hikizan1',
  'hikizan2',
  'mixed',
] as const;

export type Operator = '+' | '-';

export interface MathCard {
  id: string;
  deckId: DeckId;
  left: number;
  right: number;
  operator: Operator;
  answer: number;
}

export interface DeckDefinition {
  id: DeckId;
  name: string;
  shortName: string;
  subtitle: string;
  description: string;
  color: string;
  colorDark: string;
  colorSoft: string;
  badgeText: string;
  sourceUrl: string;
  cards: MathCard[];
}

function makeCard(deckId: DeckId, left: number, operator: Operator, right: number): MathCard {
  const answer = operator === '+' ? left + right : left - right;
  return {
    id: `${deckId}-${left}${operator}${right}`,
    deckId,
    left,
    right,
    operator,
    answer,
  };
}

/**
 * たしざん1（10までのたしざん・大サイズ・45枚）
 * https://happylilac.net/kazu-tasizancard.html
 */
function buildTashizan1(): MathCard[] {
  const cards: MathCard[] = [];
  for (let left = 1; left <= 9; left++) {
    for (let right = 1; left + right <= 10; right++) {
      cards.push(makeCard('tashizan1', left, '+', right));
    }
  }
  return cards;
}

/**
 * たしざん2（くりあがりのあるたしざん・大サイズ・36枚）
 * https://happylilac.net/mu202007151250.html
 */
function buildTashizan2(): MathCard[] {
  const cards: MathCard[] = [];
  for (let left = 9; left >= 2; left--) {
    for (let right = 11 - left; right <= 9; right++) {
      cards.push(makeCard('tashizan2', left, '+', right));
    }
  }
  return cards;
}

/**
 * ひきざん1（10までのひきざん・大サイズ・45枚）
 * https://happylilac.net/kazu-hikizancard.html
 */
function buildHikizan1(): MathCard[] {
  const cards: MathCard[] = [];
  for (let left = 10; left >= 2; left--) {
    for (let right = 1; right < left; right++) {
      cards.push(makeCard('hikizan1', left, '-', right));
    }
  }
  return cards;
}

/**
 * ひきざん2（くりさがりのあるひきざん・大サイズ・36枚）
 * https://happylilac.net/mu202007151311.html
 */
function buildHikizan2(): MathCard[] {
  const cards: MathCard[] = [];
  for (let left = 11; left <= 18; left++) {
    for (let right = left - 9; right <= 9; right++) {
      cards.push(makeCard('hikizan2', left, '-', right));
    }
  }
  return cards;
}

export const DECKS: readonly DeckDefinition[] = [
  {
    id: 'tashizan1',
    name: 'たしざん 1',
    shortName: 'たし1',
    subtitle: '10までの たしざん',
    description: 'こたえが 10までに なる たしざん（45まい）',
    color: '#FF6B6B',
    colorDark: '#D94343',
    colorSoft: '#FFF0F0',
    badgeText: '＋',
    sourceUrl: 'https://happylilac.net/kazu-tasizancard.html',
    cards: buildTashizan1(),
  },
  {
    id: 'tashizan2',
    name: 'たしざん 2',
    shortName: 'たし2',
    subtitle: 'くりあがりの ある たしざん',
    description: 'こたえが 11〜18に なる たしざん（36まい）',
    color: '#FF9F43',
    colorDark: '#D97706',
    colorSoft: '#FFF6EB',
    badgeText: '＋',
    sourceUrl: 'https://happylilac.net/mu202007151250.html',
    cards: buildTashizan2(),
  },
  {
    id: 'hikizan1',
    name: 'ひきざん 1',
    shortName: 'ひき1',
    subtitle: '10までの ひきざん',
    description: '10までの かずから ひく ひきざん（45まい）',
    color: '#38A3F1',
    colorDark: '#1D74C4',
    colorSoft: '#EEF7FF',
    badgeText: '−',
    sourceUrl: 'https://happylilac.net/kazu-hikizancard.html',
    cards: buildHikizan1(),
  },
  {
    id: 'hikizan2',
    name: 'ひきざん 2',
    shortName: 'ひき2',
    subtitle: 'くりさがりの ある ひきざん',
    description: '11〜18から ひく ひきざん（36まい）',
    color: '#2EC4B6',
    colorDark: '#178F84',
    colorSoft: '#ECFBFA',
    badgeText: '−',
    sourceUrl: 'https://happylilac.net/mu202007151311.html',
    cards: buildHikizan2(),
  },
] as const;

export const DECK_MAP: Record<DeckId, DeckDefinition> = {
  tashizan1: DECKS[0],
  tashizan2: DECKS[1],
  hikizan1: DECKS[2],
  hikizan2: DECKS[3],
};

export const ALL_CARDS: readonly MathCard[] = DECKS.flatMap((deck) => deck.cards);

export function getCardsForStage(stageId: GameStageId): readonly MathCard[] {
  if (stageId === 'mixed') {
    return ALL_CARDS;
  }
  return DECK_MAP[stageId].cards;
}

/**
 * Build a shuffled question queue for a game stage.
 * For the comprehensive 'mixed' stage, interleaves randomized blocks from all 4 decks
 * so players reliably experience every operation type in a single run.
 */
export function buildStageQuestionQueue(
  stageId: GameStageId,
  rng: () => number = Math.random,
): MathCard[] {
  if (stageId !== 'mixed') {
    return shuffleCards(DECK_MAP[stageId].cards, rng);
  }

  const buckets = DECKS.map((deck) => shuffleCards(deck.cards, rng));
  const queue: MathCard[] = [];
  const maxLen = Math.max(...buckets.map((b) => b.length));

  for (let i = 0; i < maxLen; i++) {
    const round: MathCard[] = [];
    for (const bucket of buckets) {
      if (i < bucket.length) {
        round.push(bucket[i]);
      }
    }
    queue.push(...shuffleCards(round, rng));
  }

  return queue;
}

export function formatOperator(operator: Operator): string {
  return operator === '+' ? '＋' : '−';
}

export function formatExpression(card: MathCard): string {
  return `${card.left} ${formatOperator(card.operator)} ${card.right}`;
}

/** Fisher-Yates shuffle returning a new array */
export function shuffleCards<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Generate plausible 4-option multiple choices for game mode */
export function generateChoices(
  card: MathCard,
  count = 4,
  rng: () => number = Math.random,
): number[] {
  const minVal = card.deckId === 'tashizan2' ? 10 : 1;
  const maxVal = card.deckId === 'tashizan2' ? 19 : 10;

  const candidateOffsets = [-1, 1, -2, 2, -3, 3, -4, 4];
  const pool: number[] = [];

  for (const offset of candidateOffsets) {
    const v = card.answer + offset;
    if (v >= minVal && v <= maxVal && v !== card.answer) {
      pool.push(v);
    }
  }

  // Prefer close distractors (offset ±1, ±2) first, with slight randomness
  const close = shuffleCards(
    pool.filter((v) => Math.abs(v - card.answer) <= 2),
    rng,
  );
  const far = shuffleCards(
    pool.filter((v) => Math.abs(v - card.answer) > 2),
    rng,
  );

  const distractors: number[] = [];
  for (const v of [...close, ...far]) {
    if (distractors.length >= count - 1) break;
    if (!distractors.includes(v)) {
      distractors.push(v);
    }
  }

  // Fallback if range was very small
  for (let v = minVal; distractors.length < count - 1 && v <= maxVal + 5; v++) {
    if (v !== card.answer && !distractors.includes(v)) {
      distractors.push(v);
    }
  }

  return shuffleCards([card.answer, ...distractors], rng);
}
