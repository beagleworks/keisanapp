import type { GameStageId, MathCard } from '../data/decks';

export const ROOM_COLS = 15;
export const ROOM_ROWS = 11;
export const TILE_SIZE = 32;
export const CANVAS_WIDTH = ROOM_COLS * TILE_SIZE; // 480
export const CANVAS_HEIGHT = ROOM_ROWS * TILE_SIZE; // 352

export type Direction = 'up' | 'down' | 'left' | 'right';

export type RoomExitKind = 'none' | 'open' | 'locked';

export interface RoomExits {
  up: RoomExitKind;
  down: RoomExitKind;
  left: RoomExitKind;
  right: RoomExitKind;
}

export type RoomRole = 'start' | 'key' | 'treasure' | 'spring' | 'gate' | 'boss';

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

export type EnemyKind = 'slime' | 'octorok' | 'bat' | 'skeleton' | 'goldenSlime' | 'boss';

export type ChestReward = 'key' | 'bigRupee' | 'flameSword';

export interface EnemyArchetype {
  kind: Exclude<EnemyKind, 'boss' | 'goldenSlime'>;
  name: string;
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
  stageId: GameStageId;
  stageNumber: number;
  badgeName: string;
  shortBadge: string;
  badgeColor: string;
  worldName: string;
  subtitle: string;
  bossName: string;
  bossHp: number;
  palette: WorldPalette;
  enemyPool: readonly EnemyArchetype[];
  roomNames: Record<RoomRole, string>;
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
  kind: 'rupeeGreen' | 'rupeeBlue' | 'rupeeGold' | 'heart' | 'tristar';
  collected: boolean;
  bobPhase: number;
}

export interface RoomState {
  rx: number;
  ry: number;
  role: RoomRole;
  name: string;
  exits: RoomExits;
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

export interface ClearBonusBreakdown {
  stageClear: number;
  lifeBonus: number;
  noMissBonus: number;
  allChestsBonus: number;
  allEnemiesBonus: number;
  total: number;
}

export interface GameRunState {
  stageId: GameStageId;
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
  status: 'playing' | 'battle' | 'victory' | 'gameover';
  toast: { text: string; timer: number } | null;
  shakeTimer: number;
  particles: Particle[];
  floatingTexts: FloatingText[];
  transition: RoomTransition | null;
  questionQueue: MathCard[];
  missedCards: MathCard[];
}
