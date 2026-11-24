import type { DeckId, MathCard } from '../data/decks';

export const ROOM_COLS = 15;
export const ROOM_ROWS = 11;
export const TILE_SIZE = 32;
export const CANVAS_WIDTH = ROOM_COLS * TILE_SIZE; // 480
export const CANVAS_HEIGHT = ROOM_ROWS * TILE_SIZE; // 352

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Tile symbols used in 15x11 room layouts:
 * '.' = walkable ground
 * ',' = decorated path tile (walkable)
 * '#' = solid wall / tree / rock
 * '~' = water / lava (impassable)
 * 'B' = cuttable bush (impassable until slashed)
 * 'T' = torch pillar (impassable, animated flame)
 * 'F' = healing fairy spring (walkable, restores full hearts)
 * 'L' = locked boss door (impassable until unlocked with key)
 */
export type TileChar = '.' | ',' | '#' | '~' | 'B' | 'T' | 'F' | 'L';

export type EnemyKind = 'slime' | 'octorok' | 'bat' | 'skeleton' | 'boss';

export type ChestReward = 'key' | 'bigRupee' | 'flameSword';

export interface EnemySpawn {
  id: string;
  kind: EnemyKind;
  name: string;
  col: number;
  row: number;
  hp: number;
  speed: number;
}

export interface ChestSpawn {
  id: string;
  col: number;
  row: number;
  reward: ChestReward;
  label: string;
}

export interface PickupSpawn {
  id: string;
  col: number;
  row: number;
  kind: 'rupeeGreen' | 'rupeeBlue' | 'heart';
}

export interface RoomTemplate {
  rx: number; // 0..2
  ry: number; // 0..1
  name: string;
  layout: readonly string[]; // 11 strings of length 15
  enemies: readonly EnemySpawn[];
  chests: readonly ChestSpawn[];
  pickups: readonly PickupSpawn[];
  isBossRoom?: boolean;
}

export interface WorldPalette {
  ground: string;
  groundAlt: string;
  path: string;
  pathDot: string;
  wall: string;
  wallHighlight: string;
  wallShadow: string;
  water: string;
  waterFoam: string;
  bush: string;
  bushHighlight: string;
  accent: string;
  bossPrimary: string;
  bossSecondary: string;
}

export interface WorldTheme {
  deckId: DeckId;
  worldName: string;
  subtitle: string;
  bossName: string;
  bossKindLabel: string;
  palette: WorldPalette;
  rooms: readonly RoomTemplate[];
  startRoom: { rx: number; ry: number; col: number; row: number };
}

export interface ActiveEnemy {
  id: string;
  kind: EnemyKind;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  hp: number;
  maxHp: number;
  speed: number;
  aiTimer: number;
  hurtTimer: number;
  alive: boolean;
}

export interface ActiveChest {
  id: string;
  col: number;
  row: number;
  reward: ChestReward;
  label: string;
  opened: boolean;
}

export interface ActivePickup {
  id: string;
  x: number;
  y: number;
  kind: 'rupeeGreen' | 'rupeeBlue' | 'heart' | 'tristar';
  collected: boolean;
  bobPhase: number;
}

export interface RoomState {
  rx: number;
  ry: number;
  name: string;
  tiles: TileChar[][];
  enemies: ActiveEnemy[];
  chests: ActiveChest[];
  pickups: ActivePickup[];
  visited: boolean;
  isBossRoom: boolean;
  bossDefeated: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface PlayerState {
  x: number;
  y: number;
  dir: Direction;
  hearts: number;
  maxHearts: number;
  keys: number;
  hasFlameSword: boolean;
  walkFrame: number;
  walkTimer: number;
  attackTimer: number;
  attackCooldown: number;
  invulnTimer: number;
  knockVx: number;
  knockVy: number;
}

export interface RoomTransition {
  fromRx: number;
  fromRy: number;
  toRx: number;
  toRy: number;
  dir: Direction;
  progress: number; // 0..1
}

export interface BattleRequest {
  source: 'enemy' | 'chest';
  roomKey: string;
  targetId: string;
  targetName: string;
  targetKind: EnemyKind | 'chest';
  targetHp?: number;
  targetMaxHp?: number;
  firstStrike: boolean;
  card: MathCard;
  choices: number[];
}

export interface BattleOutcome {
  correct: boolean;
  speedBonus: number;
  pointsAwarded: number;
  defeatedTarget: boolean;
  message: string;
}

export interface GameRunState {
  deckId: DeckId;
  worldName: string;
  rooms: Record<string, RoomState>;
  currentRx: number;
  currentRy: number;
  player: PlayerState;
  score: number;
  combo: number;
  maxCombo: number;
  correctCount: number;
  wrongCount: number;
  elapsedMs: number;
  status: 'playing' | 'battle' | 'victory' | 'gameover';
  toast: { text: string; timer: number } | null;
  shakeTimer: number;
  particles: Particle[];
  floatingTexts: FloatingText[];
  transition: RoomTransition | null;
  questionQueue: MathCard[];
  missedCards: MathCard[];
}
