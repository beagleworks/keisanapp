import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS,
  buildStageQuestionQueue,
  DECK_MAP,
  DECKS,
  generateChoices,
  getCardsForStage,
  shuffleCards,
} from './decks';

describe('HappyLilac large-size math card decks', () => {
  it('contains all 4 decks with exact card counts', () => {
    expect(DECKS).toHaveLength(4);
    expect(DECK_MAP.tashizan1.cards).toHaveLength(45);
    expect(DECK_MAP.tashizan2.cards).toHaveLength(36);
    expect(DECK_MAP.hikizan1.cards).toHaveLength(45);
    expect(DECK_MAP.hikizan2.cards).toHaveLength(36);
    expect(ALL_CARDS).toHaveLength(162);
    expect(getCardsForStage('mixed')).toHaveLength(162);
  });

  it('tashizan1 matches HappyLilac large cards (10までのたしざん, 45 cards)', () => {
    const cards = DECK_MAP.tashizan1.cards;
    const exprs = cards.map((c) => `${c.left}+${c.right}=${c.answer}`);
    expect(exprs[0]).toBe('1+1=2');
    expect(exprs[4]).toBe('1+5=6');
    expect(exprs[9]).toBe('2+1=3');
    expect(exprs[exprs.length - 1]).toBe('9+1=10');

    expect(new Set(exprs).size).toBe(45);
    for (const c of cards) {
      expect(c.left).toBeGreaterThanOrEqual(1);
      expect(c.right).toBeGreaterThanOrEqual(1);
      expect(c.answer).toBe(c.left + c.right);
      expect(c.answer).toBeLessThanOrEqual(10);
    }
  });

  it('tashizan2 matches HappyLilac large cards (くりあがりのあるたしざん, 36 cards)', () => {
    const cards = DECK_MAP.tashizan2.cards;
    const exprs = cards.map((c) => `${c.left}+${c.right}=${c.answer}`);
    expect(exprs[0]).toBe('9+2=11');
    expect(exprs[7]).toBe('9+9=18');
    expect(exprs[8]).toBe('8+3=11');
    expect(exprs[exprs.length - 1]).toBe('2+9=11');

    expect(new Set(exprs).size).toBe(36);
    for (const c of cards) {
      expect(c.left).toBeGreaterThanOrEqual(2);
      expect(c.left).toBeLessThanOrEqual(9);
      expect(c.right).toBeGreaterThanOrEqual(2);
      expect(c.right).toBeLessThanOrEqual(9);
      expect(c.answer).toBe(c.left + c.right);
      expect(c.answer).toBeGreaterThanOrEqual(11);
      expect(c.answer).toBeLessThanOrEqual(18);
    }
  });

  it('hikizan1 matches HappyLilac large cards (10までのひきざん, 45 cards)', () => {
    const cards = DECK_MAP.hikizan1.cards;
    const exprs = cards.map((c) => `${c.left}-${c.right}=${c.answer}`);
    expect(exprs[0]).toBe('10-1=9');
    expect(exprs[8]).toBe('10-9=1');
    expect(exprs[9]).toBe('9-1=8');
    expect(exprs[exprs.length - 1]).toBe('2-1=1');

    expect(new Set(exprs).size).toBe(45);
    for (const c of cards) {
      expect(c.left).toBeGreaterThanOrEqual(2);
      expect(c.left).toBeLessThanOrEqual(10);
      expect(c.right).toBeGreaterThanOrEqual(1);
      expect(c.right).toBeLessThan(c.left);
      expect(c.answer).toBe(c.left - c.right);
      expect(c.answer).toBeGreaterThanOrEqual(1);
    }
  });

  it('hikizan2 matches HappyLilac large cards (くりさがりのあるひきざん, 36 cards)', () => {
    const cards = DECK_MAP.hikizan2.cards;
    const exprs = cards.map((c) => `${c.left}-${c.right}=${c.answer}`);
    expect(exprs[0]).toBe('11-2=9');
    expect(exprs[7]).toBe('11-9=2');
    expect(exprs[8]).toBe('12-3=9');
    expect(exprs[exprs.length - 1]).toBe('18-9=9');

    expect(new Set(exprs).size).toBe(36);
    for (const c of cards) {
      expect(c.left).toBeGreaterThanOrEqual(11);
      expect(c.left).toBeLessThanOrEqual(18);
      expect(c.right).toBeGreaterThanOrEqual(2);
      expect(c.right).toBeLessThanOrEqual(9);
      expect(c.answer).toBe(c.left - c.right);
      expect(c.answer).toBeGreaterThanOrEqual(2);
      expect(c.answer).toBeLessThanOrEqual(9);
    }
  });

  it('buildStageQuestionQueue for mixed stage includes all 162 unique cards and balances all 4 decks', () => {
    const queue = buildStageQuestionQueue('mixed');
    expect(queue).toHaveLength(162);
    expect(new Set(queue.map((c) => c.id)).size).toBe(162);

    // Every block of 4 cards in the first 36 rounds has 1 card from each of the 4 decks
    const firstFourDecks = new Set(queue.slice(0, 4).map((c) => c.deckId));
    expect(firstFourDecks.size).toBe(4);
  });

  it('shuffleCards returns a permutation without mutating the source array', () => {
    const source = DECK_MAP.tashizan1.cards;
    const beforeIds = source.map((c) => c.id);
    const shuffled = shuffleCards(source);

    expect(source.map((c) => c.id)).toEqual(beforeIds);
    expect(shuffled).toHaveLength(source.length);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(beforeIds));
  });

  it('generateChoices always produces 4 unique valid choices including the answer', () => {
    for (const deck of DECKS) {
      for (const card of deck.cards) {
        const choices = generateChoices(card, 4);
        expect(choices).toHaveLength(4);
        expect(new Set(choices).size).toBe(4);
        expect(choices).toContain(card.answer);
        for (const ch of choices) {
          expect(ch).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});
