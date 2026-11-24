import { shuffleCards, type GameStageId } from '../data/decks';
import {
  ROOM_COLS,
  ROOM_ROWS,
  TILE_SIZE,
  type ActiveChest,
  type ActiveEnemy,
  type ActivePickup,
  type Direction,
  type RoomExits,
  type RoomRole,
  type RoomState,
  type TileChar,
} from './types';
import { WORLD_THEMES } from './worlds';

export const GRID_COLS = 3;
export const GRID_ROWS = 2;

interface GridCoord {
  rx: number;
  ry: number;
}

const OPPOSITE_DIR: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DIR_DELTAS: readonly { dir: Direction; dx: number; dy: number }[] = [
  { dir: 'up', dx: 0, dy: -1 },
  { dir: 'down', dx: 0, dy: 1 },
  { dir: 'left', dx: -1, dy: 0 },
  { dir: 'right', dx: 1, dy: 0 },
];

export function gridKey(rx: number, ry: number): string {
  return `${rx},${ry}`;
}

function getNeighbors(c: GridCoord): { coord: GridCoord; dir: Direction }[] {
  const out: { coord: GridCoord; dir: Direction }[] = [];
  for (const { dir, dx, dy } of DIR_DELTAS) {
    const nx = c.rx + dx;
    const ny = c.ry + dy;
    if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
      out.push({ coord: { rx: nx, ry: ny }, dir });
    }
  }
  return out;
}

function createEmptyExits(): RoomExits {
  return { up: 'none', down: 'none', left: 'none', right: 'none' };
}

function pickOne<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Generate a connected 3x2 room topology with:
 * - Random Boss Room at one of the 4 corners
 * - Random adjacent Gate Room connected via a single locked door ('L')
 * - Connected spanning tree + optional shortcut loop among the 5 non-boss rooms
 * - Random Start, Key, Treasure, and Fairy Spring assignments (all reachable before the locked door)
 */
function generateTopology(rng: () => number): {
  roles: Record<string, RoomRole>;
  exitsByRoom: Record<string, RoomExits>;
  startCoord: GridCoord;
} {
  const corners: GridCoord[] = [
    { rx: 0, ry: 0 },
    { rx: 2, ry: 0 },
    { rx: 0, ry: 1 },
    { rx: 2, ry: 1 },
  ];
  const bossCoord = pickOne(corners, rng);
  const bossKey = gridKey(bossCoord.rx, bossCoord.ry);

  const bossNeighbors = getNeighbors(bossCoord);
  const gateChoice = pickOne(bossNeighbors, rng);
  const gateCoord = gateChoice.coord;
  const gateKey = gridKey(gateCoord.rx, gateCoord.ry);

  const exitsByRoom: Record<string, RoomExits> = {};
  for (let ry = 0; ry < GRID_ROWS; ry++) {
    for (let rx = 0; rx < GRID_COLS; rx++) {
      exitsByRoom[gridKey(rx, ry)] = createEmptyExits();
    }
  }

  // Gate -> Boss is locked; Boss -> Gate is open so player isn't trapped inside
  const gateToBossDir = OPPOSITE_DIR[gateChoice.dir];
  exitsByRoom[gateKey][gateToBossDir] = 'locked';
  exitsByRoom[bossKey][gateChoice.dir] = 'open';

  // Randomized DFS spanning tree over the 5 non-boss rooms
  const visited = new Set<string>([gateKey]);
  const stack: GridCoord[] = [gateCoord];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const unvisitedNeighbors = shuffleCards(
      getNeighbors(cur).filter(({ coord }) => {
        const k = gridKey(coord.rx, coord.ry);
        return k !== bossKey && !visited.has(k);
      }),
      rng,
    );

    if (unvisitedNeighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = unvisitedNeighbors[0];
    const curKey = gridKey(cur.rx, cur.ry);
    const nextKey = gridKey(next.coord.rx, next.coord.ry);

    exitsByRoom[curKey][next.dir] = 'open';
    exitsByRoom[nextKey][OPPOSITE_DIR[next.dir]] = 'open';
    visited.add(nextKey);
    stack.push(next.coord);
  }

  // Randomly add 1 extra loop edge among non-boss rooms (~70% chance) for nonlinear variety
  if (rng() < 0.7) {
    const candidateEdges: { a: GridCoord; b: GridCoord; dir: Direction }[] = [];
    for (let ry = 0; ry < GRID_ROWS; ry++) {
      for (let rx = 0; rx < GRID_COLS; rx++) {
        const aKey = gridKey(rx, ry);
        if (aKey === bossKey) continue;
        for (const { coord: b, dir } of getNeighbors({ rx, ry })) {
          const bKey = gridKey(b.rx, b.ry);
          if (bKey === bossKey) continue;
          if (aKey < bKey && exitsByRoom[aKey][dir] === 'none') {
            candidateEdges.push({ a: { rx, ry }, b, dir });
          }
        }
      }
    }
    if (candidateEdges.length > 0) {
      const extra = pickOne(candidateEdges, rng);
      const aKey = gridKey(extra.a.rx, extra.a.ry);
      const bKey = gridKey(extra.b.rx, extra.b.ry);
      exitsByRoom[aKey][extra.dir] = 'open';
      exitsByRoom[bKey][OPPOSITE_DIR[extra.dir]] = 'open';
    }
  }

  // Compute BFS distance from gate among non-boss rooms to place Start at an interesting distance
  const distFromGate: Record<string, number> = { [gateKey]: 0 };
  const bfsQueue: GridCoord[] = [gateCoord];
  while (bfsQueue.length > 0) {
    const cur = bfsQueue.shift()!;
    const ck = gridKey(cur.rx, cur.ry);
    for (const { coord: nb, dir } of getNeighbors(cur)) {
      const nk = gridKey(nb.rx, nb.ry);
      if (nk === bossKey) continue;
      if (exitsByRoom[ck][dir] === 'open' && distFromGate[nk] === undefined) {
        distFromGate[nk] = distFromGate[ck] + 1;
        bfsQueue.push(nb);
      }
    }
  }

  const nonGateNonBoss: GridCoord[] = [];
  for (let ry = 0; ry < GRID_ROWS; ry++) {
    for (let rx = 0; rx < GRID_COLS; rx++) {
      const k = gridKey(rx, ry);
      if (k !== bossKey && k !== gateKey) {
        nonGateNonBoss.push({ rx, ry });
      }
    }
  }

  const farRooms = nonGateNonBoss.filter((c) => (distFromGate[gridKey(c.rx, c.ry)] ?? 0) >= 2);
  const startCoord = pickOne(farRooms.length > 0 ? farRooms : nonGateNonBoss, rng);
  const startKey = gridKey(startCoord.rx, startCoord.ry);

  const remaining = shuffleCards(
    nonGateNonBoss.filter((c) => gridKey(c.rx, c.ry) !== startKey),
    rng,
  );

  const roles: Record<string, RoomRole> = {
    [bossKey]: 'boss',
    [gateKey]: 'gate',
    [startKey]: 'start',
    [gridKey(remaining[0].rx, remaining[0].ry)]: 'key',
    [gridKey(remaining[1].rx, remaining[1].ry)]: 'treasure',
    [gridKey(remaining[2].rx, remaining[2].ry)]: 'spring',
  };

  return { roles, exitsByRoom, startCoord };
}

/** Build a 15x11 room tile matrix with aligned doorways, connecting roads, and varied interior decor */
function buildRoomTiles(
  role: RoomRole,
  exits: RoomExits,
  rng: () => number,
): { tiles: TileChar[][]; reservedForRoads: Set<string> } {
  const tiles: TileChar[][] = Array.from({ length: ROOM_ROWS }, () =>
    Array.from({ length: ROOM_COLS }, () => '.' as TileChar),
  );
  const reservedForRoads = new Set<string>();

  const markRoad = (col: number, row: number) => {
    if (col < 0 || col >= ROOM_COLS || row < 0 || row >= ROOM_ROWS) return;
    tiles[row][col] = ',';
    reservedForRoads.add(`${col},${row}`);
  };

  // 1. Solid perimeter walls
  for (let col = 0; col < ROOM_COLS; col++) {
    tiles[0][col] = '#';
    tiles[ROOM_ROWS - 1][col] = '#';
  }
  for (let row = 0; row < ROOM_ROWS; row++) {
    tiles[row][0] = '#';
    tiles[row][ROOM_COLS - 1] = '#';
  }

  const centerCol = Math.floor(ROOM_COLS / 2); // 7
  const centerRow = Math.floor(ROOM_ROWS / 2); // 5

  // 2. Reserve central 3x3 hub (walkable)
  for (let r = centerRow - 1; r <= centerRow + 1; r++) {
    for (let c = centerCol - 1; c <= centerCol + 1; c++) {
      reservedForRoads.add(`${c},${r}`);
      if (role !== 'boss') {
        tiles[r][c] = ',';
      }
    }
  }

  // 3. Carve exits & straight connecting roads from center to every exit
  if (exits.up !== 'none') {
    if (exits.up === 'locked' || role === 'boss') {
      tiles[0][centerCol] = exits.up === 'locked' ? 'L' : ',';
      reservedForRoads.add(`${centerCol},0`);
      for (let r = 1; r <= centerRow; r++) markRoad(centerCol, r);
    } else {
      for (let c = centerCol - 1; c <= centerCol + 1; c++) {
        for (let r = 0; r <= centerRow; r++) markRoad(c, r);
      }
    }
  }

  if (exits.down !== 'none') {
    if (exits.down === 'locked' || role === 'boss') {
      tiles[ROOM_ROWS - 1][centerCol] = exits.down === 'locked' ? 'L' : ',';
      reservedForRoads.add(`${centerCol},${ROOM_ROWS - 1}`);
      for (let r = centerRow; r < ROOM_ROWS - 1; r++) markRoad(centerCol, r);
    } else {
      for (let c = centerCol - 1; c <= centerCol + 1; c++) {
        for (let r = centerRow; r < ROOM_ROWS; r++) markRoad(c, r);
      }
    }
  }

  if (exits.left !== 'none') {
    if (exits.left === 'locked' || role === 'boss') {
      tiles[centerRow][0] = exits.left === 'locked' ? 'L' : ',';
      reservedForRoads.add(`0,${centerRow}`);
      for (let c = 1; c <= centerCol; c++) markRoad(c, centerRow);
    } else {
      for (let r = centerRow - 1; r <= centerRow + 1; r++) {
        for (let c = 0; c <= centerCol; c++) markRoad(c, r);
      }
    }
  }

  if (exits.right !== 'none') {
    if (exits.right === 'locked' || role === 'boss') {
      tiles[centerRow][ROOM_COLS - 1] = exits.right === 'locked' ? 'L' : ',';
      reservedForRoads.add(`${ROOM_COLS - 1},${centerRow}`);
      for (let c = centerCol; c < ROOM_COLS - 1; c++) markRoad(c, centerRow);
    } else {
      for (let r = centerRow - 1; r <= centerRow + 1; r++) {
        for (let c = centerCol; c < ROOM_COLS; c++) markRoad(c, r);
      }
    }
  }

  // Boss room: grand torch arena with open combat floor
  if (role === 'boss') {
    tiles[1][1] = 'T';
    tiles[1][ROOM_COLS - 2] = 'T';
    tiles[ROOM_ROWS - 2][1] = 'T';
    tiles[ROOM_ROWS - 2][ROOM_COLS - 2] = 'T';
    return { tiles, reservedForRoads };
  }

  // Helper to place decoration safely without touching roads, perimeter, or exit corridors
  const tryPlace = (col: number, row: number, tile: TileChar) => {
    if (col <= 0 || col >= ROOM_COLS - 1 || row <= 0 || row >= ROOM_ROWS - 1) return;
    if (reservedForRoads.has(`${col},${row}`)) return;
    if (tiles[row][col] !== '.') return;
    tiles[row][col] = tile;
  };

  // Spring room: guaranteed healing fairy spring ('F') in a randomized open corner quadrant
  if (role === 'spring') {
    const quadrants = shuffleCards(
      [
        { c: 3, r: 2 },
        { c: 11, r: 2 },
        { c: 3, r: 8 },
        { c: 11, r: 8 },
      ],
      rng,
    );
    const chosen = quadrants[0];
    // Place sparkling healing spring tiles accessible from the main floor
    tiles[chosen.r][chosen.c] = 'F';
    tiles[chosen.r][chosen.c - 1] = '~';
    tiles[chosen.r][chosen.c + 1] = '~';
    reservedForRoads.add(`${chosen.c},${chosen.r}`);
    reservedForRoads.add(`${chosen.c},${chosen.r === 2 ? 3 : 7}`);
    // Corner torches for magical atmosphere
    tryPlace(1, 1, 'T');
    tryPlace(ROOM_COLS - 2, 1, 'T');
  }

  // Choose a random interior decor motif for variety every run
  const motif = Math.floor(rng() * 4);
  if (motif === 0) {
    // Twin ponds + scattered bushes
    tryPlace(2, 2, '~');
    tryPlace(3, 2, '~');
    tryPlace(11, 8, '~');
    tryPlace(12, 8, '~');
    tryPlace(3, 7, 'B');
    tryPlace(4, 7, 'B');
    tryPlace(10, 3, 'B');
    tryPlace(11, 3, 'B');
  } else if (motif === 1) {
    // Four pillars + corner torches + bushes
    tryPlace(1, 1, 'T');
    tryPlace(ROOM_COLS - 2, 1, 'T');
    tryPlace(4, 3, '#');
    tryPlace(10, 3, '#');
    tryPlace(4, 7, '#');
    tryPlace(10, 7, '#');
    tryPlace(2, 5, 'B');
    tryPlace(12, 5, 'B');
  } else if (motif === 2) {
    // Lush bush garden (lots of cuttable bushes for bonus rupees!)
    const bushSpots: [number, number][] = [
      [2, 2],
      [3, 2],
      [11, 2],
      [12, 2],
      [2, 8],
      [3, 8],
      [11, 8],
      [12, 8],
      [4, 3],
      [10, 7],
    ];
    for (const [c, r] of bushSpots) {
      if (rng() < 0.72) tryPlace(c, r, 'B');
    }
  } else {
    // Torch hall + water accents + bushes
    tryPlace(1, 1, 'T');
    tryPlace(ROOM_COLS - 2, 1, 'T');
    tryPlace(1, ROOM_ROWS - 2, 'T');
    tryPlace(ROOM_COLS - 2, ROOM_ROWS - 2, 'T');
    tryPlace(3, 3, 'B');
    tryPlace(11, 3, 'B');
    tryPlace(3, 7, 'B');
    tryPlace(11, 7, 'B');
    tryPlace(2, 8, '~');
    tryPlace(12, 2, '~');
  }

  return { tiles, reservedForRoads };
}

/** Return all walkable interior coordinates reachable via BFS from the room center (7,5) */
function findReachableInteriorCells(tiles: TileChar[][]): { col: number; row: number }[] {
  const startC = Math.floor(ROOM_COLS / 2);
  const startR = Math.floor(ROOM_ROWS / 2);
  const seen = new Set<string>([`${startC},${startR}`]);
  const queue: { col: number; row: number }[] = [{ col: startC, row: startR }];
  const result: { col: number; row: number }[] = [];

  const walkable = (t: TileChar) => t === '.' || t === ',' || t === 'F';

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (
      cur.col >= 2 &&
      cur.col <= ROOM_COLS - 3 &&
      cur.row >= 2 &&
      cur.row <= ROOM_ROWS - 3 &&
      tiles[cur.row][cur.col] !== 'F'
    ) {
      result.push(cur);
    }

    for (const { dx, dy } of DIR_DELTAS) {
      const nc = cur.col + dx;
      const nr = cur.row + dy;
      const k = `${nc},${nr}`;
      if (
        nc >= 1 &&
        nc < ROOM_COLS - 1 &&
        nr >= 1 &&
        nr < ROOM_ROWS - 1 &&
        !seen.has(k) &&
        walkable(tiles[nr][nc])
      ) {
        seen.add(k);
        queue.push({ col: nc, row: nr });
      }
    }
  }

  return result;
}

export interface GeneratedDungeon {
  rooms: Record<string, RoomState>;
  startRx: number;
  startRy: number;
  startCol: number;
  startRow: number;
}

export function generateRandomDungeon(
  stageId: GameStageId,
  rng: () => number = Math.random,
): GeneratedDungeon {
  const theme = WORLD_THEMES[stageId];
  const { roles, exitsByRoom, startCoord } = generateTopology(rng);
  const rooms: Record<string, RoomState> = {};

  const centerCol = Math.floor(ROOM_COLS / 2);
  const centerRow = Math.floor(ROOM_ROWS / 2);

  // Pick one non-start, non-boss room to feature a rare Golden Slime (+250 bonus pts!)
  const goldenEligibleRoles: RoomRole[] = ['key', 'treasure', 'spring', 'gate'];
  const goldenRoomRole = rng() < 0.75 ? pickOne(goldenEligibleRoles, rng) : null;

  for (let ry = 0; ry < GRID_ROWS; ry++) {
    for (let rx = 0; rx < GRID_COLS; rx++) {
      const key = gridKey(rx, ry);
      const role = roles[key];
      const exits = exitsByRoom[key];
      const { tiles, reservedForRoads } = buildRoomTiles(role, exits, rng);

      const reachable = shuffleCards(findReachableInteriorCells(tiles), rng);
      const occupied = new Set<string>();

      // Reserve player spawn center in Start Room
      if (role === 'start') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            occupied.add(`${centerCol + dc},${centerRow + dr}`);
          }
        }
      }

      // Helper to claim a free reachable cell (optionally preferring off-road cells for chests!)
      const takeCell = (preferOffRoad = false): { col: number; row: number } => {
        if (preferOffRoad) {
          const offRoad = reachable.find(
            (c) => !occupied.has(`${c.col},${c.row}`) && !reservedForRoads.has(`${c.col},${c.row}`),
          );
          if (offRoad) {
            occupied.add(`${offRoad.col},${offRoad.row}`);
            return offRoad;
          }
        }
        const anyFree = reachable.find((c) => !occupied.has(`${c.col},${c.row}`));
        if (anyFree) {
          occupied.add(`${anyFree.col},${anyFree.row}`);
          return anyFree;
        }
        return { col: centerCol, row: centerRow };
      };

      const chests: ActiveChest[] = [];
      const enemies: ActiveEnemy[] = [];
      const pickups: ActivePickup[] = [];

      // Place role-specific chest (always off-road so it never blocks a corridor!)
      if (role === 'key') {
        const spot = takeCell(true);
        chests.push({
          id: 'c-key',
          col: spot.col,
          row: spot.row,
          reward: 'key',
          label: 'しんでんの かぎ',
          opened: false,
        });
      } else if (role === 'treasure') {
        const spot = takeCell(true);
        chests.push({
          id: 'c-rupee',
          col: spot.col,
          row: spot.row,
          reward: 'bigRupee',
          label: 'ビッグルピー',
          opened: false,
        });
      } else if (role === 'spring') {
        const spot = takeCell(true);
        chests.push({
          id: 'c-sword',
          col: spot.col,
          row: spot.row,
          reward: 'flameSword',
          label: 'ほのおの けん',
          opened: false,
        });
      }

      // Place Enemies
      if (role === 'boss') {
        enemies.push({
          id: 'e-boss',
          kind: 'boss',
          name: theme.bossName,
          x: centerCol * TILE_SIZE + TILE_SIZE / 2,
          y: centerRow * TILE_SIZE + TILE_SIZE / 2,
          vx: 0,
          vy: 0,
          dir: 'down',
          hp: theme.bossHp,
          maxHp: theme.bossHp,
          speed: stageId === 'mixed' ? 60 : 56,
          aiTimer: 0.6,
          hurtTimer: 0,
          alive: true,
        });
      } else {
        const enemyCount = role === 'start' ? 1 : 2;
        for (let i = 0; i < enemyCount; i++) {
          const spot = takeCell(false);
          const isGolden = role === goldenRoomRole && i === 0;
          const arch = pickOne(theme.enemyPool, rng);

          enemies.push({
            id: `e-${role}-${i}`,
            kind: isGolden ? 'goldenSlime' : arch.kind,
            name: isGolden ? 'ゴールデンスライム' : arch.name,
            x: spot.col * TILE_SIZE + TILE_SIZE / 2,
            y: spot.row * TILE_SIZE + TILE_SIZE / 2,
            vx: 0,
            vy: 0,
            dir: 'down',
            hp: 1,
            maxHp: 1,
            speed: isGolden ? 64 : 48 + Math.floor(rng() * 10),
            aiTimer: 0.4 + rng() * 0.8,
            hurtTimer: 0,
            alive: true,
          });
        }

        // Place randomized Rupees & occasional Heart / Gold Rupee
        const pickupCount = role === 'treasure' ? 3 : 2;
        for (let i = 0; i < pickupCount; i++) {
          const spot = takeCell(false);
          let kind: ActivePickup['kind'] = 'rupeeGreen';
          const roll = rng();
          if (role === 'gate' && i === 0) {
            kind = 'heart';
          } else if (roll < 0.16) {
            kind = 'rupeeGold';
          } else if (roll < 0.52) {
            kind = 'rupeeBlue';
          }
          pickups.push({
            id: `p-${role}-${i}`,
            x: spot.col * TILE_SIZE + TILE_SIZE / 2,
            y: spot.row * TILE_SIZE + TILE_SIZE / 2,
            kind,
            collected: false,
            bobPhase: i * 1.4,
          });
        }
      }

      rooms[key] = {
        rx,
        ry,
        role,
        name: theme.roomNames[role],
        exits,
        tiles,
        enemies,
        chests,
        pickups,
        visited: role === 'start',
        isBossRoom: role === 'boss',
        bossDefeated: false,
      };
    }
  }

  return {
    rooms,
    startRx: startCoord.rx,
    startRy: startCoord.ry,
    startCol: centerCol,
    startRow: centerRow,
  };
}
