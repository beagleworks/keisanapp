import { describe, expect, it } from 'vitest';
import { DECKS } from '../data/decks';
import {
  calculateClearBonus,
  createBattleRequest,
  createInitialGameState,
  isTileSolid,
  resolveBattleAnswer,
  roomKeyOf,
} from './engine';
import { ROOM_COLS, ROOM_ROWS, type TileChar } from './types';
import { WORLD_THEMES } from './worlds';

describe('Zelda-style game worlds and engine', () => {
  it('all 4 worlds have valid 15x11 room layouts and valid spawns', () => {
    for (const deck of DECKS) {
      const theme = WORLD_THEMES[deck.id];
      expect(theme.rooms).toHaveLength(6);

      for (const room of theme.rooms) {
        expect(room.layout).toHaveLength(ROOM_ROWS);
        for (const line of room.layout) {
          expect(line).toHaveLength(ROOM_COLS);
        }

        // Enemies and pickups should spawn on walkable tiles
        for (const enemy of room.enemies) {
          const tile = room.layout[enemy.row][enemy.col] as TileChar;
          expect(isTileSolid(tile)).toBe(false);
        }
        for (const pickup of room.pickups) {
          const tile = room.layout[pickup.row][pickup.col] as TileChar;
          expect(isTileSolid(tile)).toBe(false);
        }
        for (const chest of room.chests) {
          const tile = room.layout[chest.row][chest.col] as TileChar;
          expect(isTileSolid(tile)).toBe(false);
        }
      }

      // Start position is walkable
      const startRoom = theme.rooms.find(
        (r) => r.rx === theme.startRoom.rx && r.ry === theme.startRoom.ry,
      )!;
      expect(
        isTileSolid(startRoom.layout[theme.startRoom.row][theme.startRoom.col] as TileChar),
      ).toBe(false);
    }
  });

  it('has aligned doorways between connected rooms and a key chest before the locked boss door', () => {
    const theme = WORLD_THEMES.tashizan1;
    const byKey = Object.fromEntries(theme.rooms.map((r) => [roomKeyOf(r.rx, r.ry), r]));

    // (0,1) North <-> (0,0) South
    for (const col of [6, 7, 8]) {
      expect(byKey['0,1'].layout[0][col]).toBe(',');
      expect(byKey['0,0'].layout[ROOM_ROWS - 1][col]).toBe(',');
    }
    // (0,1) East <-> (1,1) West
    for (const row of [4, 5, 6]) {
      expect(byKey['0,1'].layout[row][ROOM_COLS - 1]).toBe(',');
      expect(byKey['1,1'].layout[row][0]).toBe(',');
    }
    // (1,0) East locked door 'L' <-> (2,0) West open ','
    expect(byKey['1,0'].layout[5][ROOM_COLS - 1]).toBe('L');
    expect(byKey['2,0'].layout[5][0]).toBe(',');

    // Key chest exists in room (0,0)
    expect(byKey['0,0'].chests.some((c) => c.reward === 'key')).toBe(true);
  });

  it('resolves chest key quiz, enemy battle, wrong answer knockback, and 3-hit boss defeat', () => {
    const state = createInitialGameState('tashizan1', () => 0.1);

    // 1. Open key chest in room (0,0)
    state.currentRx = 0;
    state.currentRy = 0;
    const chestReq = createBattleRequest(
      state,
      {
        source: 'chest',
        targetId: 'c-key',
        targetName: 'たからばこ',
        targetKind: 'chest',
        firstStrike: false,
      },
      () => 0.1,
    );
    const chestRes = resolveBattleAnswer(state, chestReq, chestReq.card.answer, 40, () => 0.1);
    expect(chestRes.correct).toBe(true);
    expect(state.player.keys).toBe(1);
    expect(state.score).toBeGreaterThan(0);

    // 2. Wrong answer damages player and resets combo
    const wrongReq = createBattleRequest(
      state,
      {
        source: 'enemy',
        targetId: 'e-key-1',
        targetName: 'もりスライム',
        targetKind: 'slime',
        targetHp: 1,
        targetMaxHp: 1,
        firstStrike: true,
      },
      () => 0.1,
    );
    const wrongChoice = wrongReq.choices.find((c) => c !== wrongReq.card.answer)!;
    const wrongRes = resolveBattleAnswer(state, wrongReq, wrongChoice, 0, () => 0.1);
    expect(wrongRes.correct).toBe(false);
    expect(state.player.hearts).toBe(4);
    expect(state.combo).toBe(0);
    expect(state.missedCards).toContain(wrongReq.card);

    // 3. Defeat boss in 3 correct hits -> spawns golden Tristar!
    state.currentRx = 2;
    state.currentRy = 0;
    for (let hit = 1; hit <= 3; hit++) {
      const bossReq = createBattleRequest(
        state,
        {
          source: 'enemy',
          targetId: 'e-boss',
          targetName: 'キングスライム',
          targetKind: 'boss',
          targetHp: 4 - hit,
          targetMaxHp: 3,
          firstStrike: true,
        },
        () => 0.1,
      );
      const bossRes = resolveBattleAnswer(state, bossReq, bossReq.card.answer, 30, () => 0.1);
      expect(bossRes.correct).toBe(true);
      expect(bossRes.defeatedTarget).toBe(hit === 3);
    }

    const bossRoom = state.rooms['2,0'];
    expect(bossRoom.bossDefeated).toBe(true);
    expect(bossRoom.pickups.some((p) => p.kind === 'tristar')).toBe(true);
    expect(calculateClearBonus(4)).toBe(900);
  });
});
