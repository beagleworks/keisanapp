import { describe, expect, it } from 'vitest';
import { ALL_GAME_STAGE_IDS } from '../data/decks';
import { calculateScoreRank, recordFlashcardClear, recordGameResult, resetGameRecords } from '../utils/storage';
import {
  calculateClearBonusBreakdown,
  createBattleRequest,
  createInitialGameState,
  isTileSolid,
  resolveBattleAnswer,
  roomKeyOf,
  unlockDoorAt,
} from './engine';
import { generateRandomDungeon, GRID_COLS, GRID_ROWS } from './generator';
import { ROOM_COLS, ROOM_ROWS, TILE_SIZE, type Direction } from './types';
import { WORLD_THEMES } from './worlds';

/** Deterministic PRNG (Mulberry32) for reproducible fuzz testing */
function makeSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Random dungeon generator and game engine (all 5 stages)', () => {
  it('generates 100% valid, solvable, aligned dungeons across 100 random seeds and all 5 stages', () => {
    const startCoordsSeen = new Set<string>();
    const bossCoordsSeen = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const stageId = ALL_GAME_STAGE_IDS[i % ALL_GAME_STAGE_IDS.length];
      const rng = makeSeededRng(1000 + i * 97);
      const dungeon = generateRandomDungeon(stageId, rng);
      const roomList = Object.values(dungeon.rooms);

      expect(roomList).toHaveLength(GRID_COLS * GRID_ROWS);

      const roles = new Set(roomList.map((r) => r.role));
      expect(roles).toEqual(new Set(['start', 'key', 'treasure', 'spring', 'gate', 'boss']));

      const startRoom = dungeon.rooms[roomKeyOf(dungeon.startRx, dungeon.startRy)];
      const bossRoom = roomList.find((r) => r.role === 'boss')!;
      const gateRoom = roomList.find((r) => r.role === 'gate')!;
      const keyRoom = roomList.find((r) => r.role === 'key')!;

      startCoordsSeen.add(roomKeyOf(startRoom.rx, startRoom.ry));
      bossCoordsSeen.add(roomKeyOf(bossRoom.rx, bossRoom.ry));

      // Verify start tile is walkable
      expect(isTileSolid(startRoom.tiles[dungeon.startRow][dungeon.startCol])).toBe(false);

      // Verify every room dimensions and spawn walkability
      for (const room of roomList) {
        expect(room.tiles).toHaveLength(ROOM_ROWS);
        for (const row of room.tiles) {
          expect(row).toHaveLength(ROOM_COLS);
        }
        for (const enemy of room.enemies) {
          const col = Math.floor(enemy.x / TILE_SIZE);
          const row = Math.floor(enemy.y / TILE_SIZE);
          expect(isTileSolid(room.tiles[row][col])).toBe(false);
        }
        for (const chest of room.chests) {
          expect(isTileSolid(room.tiles[chest.row][chest.col])).toBe(false);
        }
        for (const pickup of room.pickups) {
          const col = Math.floor(pickup.x / TILE_SIZE);
          const row = Math.floor(pickup.y / TILE_SIZE);
          expect(isTileSolid(room.tiles[row][col])).toBe(false);
        }
      }

      // Boss room has exactly 1 entrance connecting from Gate Room via a locked door ('L')
      const bossOpenDirs = (['up', 'down', 'left', 'right'] as Direction[]).filter(
        (d) => bossRoom.exits[d] === 'open',
      );
      expect(bossOpenDirs).toHaveLength(1);

      const gateLockedDirs = (['up', 'down', 'left', 'right'] as Direction[]).filter(
        (d) => gateRoom.exits[d] === 'locked',
      );
      expect(gateLockedDirs).toHaveLength(1);

      // Verify 'L' tile exists on the exact border of gateRoom
      let lockedTilesCount = 0;
      for (const row of gateRoom.tiles) {
        for (const tile of row) {
          if (tile === 'L') lockedTilesCount++;
        }
      }
      expect(lockedTilesCount).toBe(1);

      // BFS from Start through open exits must reach all 5 non-boss rooms (including Key & Gate) without entering Boss
      const visited = new Set<string>([roomKeyOf(startRoom.rx, startRoom.ry)]);
      const queue = [startRoom];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const neighbors: { dir: Direction; rx: number; ry: number }[] = [
          { dir: 'up', rx: cur.rx, ry: cur.ry - 1 },
          { dir: 'down', rx: cur.rx, ry: cur.ry + 1 },
          { dir: 'left', rx: cur.rx - 1, ry: cur.ry },
          { dir: 'right', rx: cur.rx + 1, ry: cur.ry },
        ];
        for (const nb of neighbors) {
          if (cur.exits[nb.dir] !== 'open') continue;
          const k = roomKeyOf(nb.rx, nb.ry);
          if (!visited.has(k)) {
            visited.add(k);
            queue.push(dungeon.rooms[k]);
          }
        }
      }
      expect(visited.size).toBe(5);
      expect(visited.has(roomKeyOf(keyRoom.rx, keyRoom.ry))).toBe(true);
      expect(visited.has(roomKeyOf(gateRoom.rx, gateRoom.ry))).toBe(true);
      expect(visited.has(roomKeyOf(bossRoom.rx, bossRoom.ry))).toBe(false);
      expect(keyRoom.chests.some((c) => c.reward === 'key')).toBe(true);
    }

    // Confirm genuine route/room randomization across seeds
    expect(startCoordsSeen.size).toBeGreaterThanOrEqual(4);
    expect(bossCoordsSeen.size).toBe(4);
  });

  it('unlockDoorAt clears the locked tile and opens the matching room exit', () => {
    const state = createInitialGameState('tashizan1', makeSeededRng(42));
    const gateRoom = Object.values(state.rooms).find((r) => r.role === 'gate')!;

    let lockCol = -1;
    let lockRow = -1;
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        if (gateRoom.tiles[r][c] === 'L') {
          lockCol = c;
          lockRow = r;
        }
      }
    }
    expect(lockCol).toBeGreaterThanOrEqual(0);
    unlockDoorAt(gateRoom, lockCol, lockRow);

    expect(gateRoom.tiles[lockRow][lockCol]).toBe(',');
    const remainingLockedExits = Object.values(gateRoom.exits).filter((e) => e === 'locked');
    expect(remainingLockedExits).toHaveLength(0);
  });

  it('resolves Stage 5 (mixed) 4-HP boss defeat, chest key quiz, and full clear bonus breakdown', () => {
    const rng = makeSeededRng(12345);
    const state = createInitialGameState('mixed', rng);

    expect(WORLD_THEMES.mixed.bossHp).toBe(4);

    // Open all chests across the dungeon
    for (const room of Object.values(state.rooms)) {
      state.currentRx = room.rx;
      state.currentRy = room.ry;
      for (const chest of room.chests) {
        const req = createBattleRequest(
          state,
          {
            source: 'chest',
            targetId: chest.id,
            targetName: chest.label,
            targetKind: 'chest',
            firstStrike: false,
          },
          rng,
        );
        const res = resolveBattleAnswer(state, req, req.card.answer, 40, rng);
        expect(res.correct).toBe(true);
      }
    }
    expect(state.player.keys).toBe(1);
    expect(state.player.hasFlameSword).toBe(true);

    // Defeat Stage 5 boss in 4 hits
    const bossRoom = Object.values(state.rooms).find((r) => r.role === 'boss')!;
    const boss = bossRoom.enemies[0];
    state.currentRx = bossRoom.rx;
    state.currentRy = bossRoom.ry;

    for (let hit = 1; hit <= 4; hit++) {
      const req = createBattleRequest(
        state,
        {
          source: 'enemy',
          targetId: boss.id,
          targetName: boss.name,
          targetKind: 'boss',
          targetHp: boss.hp,
          targetMaxHp: boss.maxHp,
          firstStrike: true,
        },
        rng,
      );
      const res = resolveBattleAnswer(state, req, req.card.answer, 35, rng);
      expect(res.correct).toBe(true);
      expect(res.defeatedTarget).toBe(hit === 4);
    }

    expect(bossRoom.bossDefeated).toBe(true);
    expect(bossRoom.pickups.some((p) => p.kind === 'tristar')).toBe(true);

    const breakdown = calculateClearBonusBreakdown(state);
    expect(breakdown.stageClear).toBe(800);
    expect(breakdown.lifeBonus).toBe(500);
    expect(breakdown.noMissBonus).toBe(400);
    expect(breakdown.allChestsBonus).toBe(300);
    expect(breakdown.total).toBeGreaterThanOrEqual(2000);
  });

  it('computes score ranks and resets game records without erasing flashcard records', () => {
    expect(calculateScoreRank(2600, 'tashizan1')).toBe('S');
    expect(calculateScoreRank(2000, 'tashizan1')).toBe('A');
    expect(calculateScoreRank(1400, 'tashizan1')).toBe('B');
    expect(calculateScoreRank(900, 'tashizan1')).toBe('C');
    expect(calculateScoreRank(3300, 'mixed')).toBe('S');

    // Mock window.localStorage in node test environment
    const store = new Map<string, string>();
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    };

    try {
      recordFlashcardClear('tashizan1', 30000);
      recordGameResult('tashizan1', 2650, true);
      recordGameResult('mixed', 3400, true);

      const afterReset = resetGameRecords();
      expect(afterReset.game).toEqual({});
      expect(afterReset.flashcards.tashizan1?.bestTimeMs).toBe(30000);
    } finally {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  });
});
