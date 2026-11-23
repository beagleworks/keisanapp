import { DECK_MAP, generateChoices, shuffleCards, type DeckId, type MathCard } from '../data/decks';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ROOM_COLS,
  ROOM_ROWS,
  TILE_SIZE,
  type ActiveEnemy,
  type BattleOutcome,
  type BattleRequest,
  type Direction,
  type GameRunState,
  type RoomState,
  type TileChar,
} from './types';
import { WORLD_THEMES } from './worlds';

export function roomKeyOf(rx: number, ry: number): string {
  return `${rx},${ry}`;
}

export function createInitialGameState(
  deckId: DeckId,
  rng: () => number = Math.random,
): GameRunState {
  const theme = WORLD_THEMES[deckId];
  const rooms: Record<string, RoomState> = {};

  for (const tpl of theme.rooms) {
    const key = roomKeyOf(tpl.rx, tpl.ry);
    const tiles: TileChar[][] = tpl.layout.map((rowStr) =>
      rowStr.split('').map((ch) => ch as TileChar),
    );
    const enemies: ActiveEnemy[] = tpl.enemies.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      x: e.col * TILE_SIZE + TILE_SIZE / 2,
      y: e.row * TILE_SIZE + TILE_SIZE / 2,
      vx: 0,
      vy: 0,
      dir: 'down',
      hp: e.hp,
      maxHp: e.hp,
      speed: e.speed,
      aiTimer: 0.4 + rng() * 0.8,
      hurtTimer: 0,
      alive: true,
    }));

    rooms[key] = {
      rx: tpl.rx,
      ry: tpl.ry,
      name: tpl.name,
      tiles,
      enemies,
      chests: tpl.chests.map((c) => ({ ...c, opened: false })),
      pickups: tpl.pickups.map((p, idx) => ({
        id: p.id,
        x: p.col * TILE_SIZE + TILE_SIZE / 2,
        y: p.row * TILE_SIZE + TILE_SIZE / 2,
        kind: p.kind,
        collected: false,
        bobPhase: idx * 1.4,
      })),
      visited: tpl.rx === theme.startRoom.rx && tpl.ry === theme.startRoom.ry,
      isBossRoom: Boolean(tpl.isBossRoom),
      bossDefeated: false,
    };
  }

  return {
    deckId,
    worldName: theme.worldName,
    rooms,
    currentRx: theme.startRoom.rx,
    currentRy: theme.startRoom.ry,
    player: {
      x: theme.startRoom.col * TILE_SIZE + TILE_SIZE / 2,
      y: theme.startRoom.row * TILE_SIZE + TILE_SIZE / 2,
      dir: 'up',
      hearts: 5,
      maxHearts: 5,
      keys: 0,
      hasFlameSword: false,
      walkFrame: 0,
      walkTimer: 0,
      attackTimer: 0,
      attackCooldown: 0,
      invulnTimer: 0,
      knockVx: 0,
      knockVy: 0,
    },
    score: 0,
    combo: 0,
    maxCombo: 0,
    correctCount: 0,
    wrongCount: 0,
    elapsedMs: 0,
    status: 'playing',
    toast: {
      text: `${theme.worldName}へ ようこそ！ たからばこで かぎを さがそう！`,
      timer: 3.6,
    },
    shakeTimer: 0,
    particles: [],
    floatingTexts: [],
    transition: null,
    questionQueue: shuffleCards(DECK_MAP[deckId].cards, rng),
    missedCards: [],
  };
}

export function getCurrentRoom(state: GameRunState): RoomState {
  return state.rooms[roomKeyOf(state.currentRx, state.currentRy)];
}

export function isTileSolid(tile: TileChar): boolean {
  return tile === '#' || tile === '~' || tile === 'B' || tile === 'T' || tile === 'L';
}

export function getTileAt(room: RoomState, col: number, row: number): TileChar {
  if (row < 0 || row >= ROOM_ROWS || col < 0 || col >= ROOM_COLS) {
    return '#';
  }
  return room.tiles[row][col];
}

export function isBoxBlocked(room: RoomState, x: number, y: number, halfW: number, halfH: number): boolean {
  const minCol = Math.floor((x - halfW) / TILE_SIZE);
  const maxCol = Math.floor((x + halfW) / TILE_SIZE);
  const minRow = Math.floor((y - halfH) / TILE_SIZE);
  const maxRow = Math.floor((y + halfH) / TILE_SIZE);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      // Allow moving slightly past room boundary through open doorway tiles
      if (row < 0 || row >= ROOM_ROWS || col < 0 || col >= ROOM_COLS) {
        continue;
      }
      if (isTileSolid(room.tiles[row][col])) {
        return true;
      }
      // Closed chests are solid blocks
      for (const chest of room.chests) {
        if (chest.col === col && chest.row === row) {
          return true;
        }
      }
    }
  }
  return false;
}

export function drawNextQuestion(
  state: GameRunState,
  rng: () => number = Math.random,
): MathCard {
  // Re-ask a missed card occasionally for active reinforcement
  if (state.missedCards.length > 0 && rng() < 0.45) {
    const missed = state.missedCards.shift()!;
    return missed;
  }

  if (state.questionQueue.length === 0) {
    state.questionQueue = shuffleCards(DECK_MAP[state.deckId].cards, rng);
  }
  return state.questionQueue.shift()!;
}

export function createBattleRequest(
  state: GameRunState,
  params: {
    source: 'enemy' | 'chest';
    targetId: string;
    targetName: string;
    targetKind: ActiveEnemy['kind'] | 'chest';
    targetHp?: number;
    targetMaxHp?: number;
    firstStrike: boolean;
  },
  rng: () => number = Math.random,
): BattleRequest {
  const card = drawNextQuestion(state, rng);
  const choices = generateChoices(card, 4, rng);
  return {
    ...params,
    roomKey: roomKeyOf(state.currentRx, state.currentRy),
    card,
    choices,
  };
}

export function spawnParticles(
  state: GameRunState,
  x: number,
  y: number,
  color: string,
  count: number,
  rng: () => number = Math.random,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rng() * 0.6;
    const speed = 45 + rng() * 95;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: 4 + Math.floor(rng() * 4),
      life: 0.45 + rng() * 0.25,
      maxLife: 0.7,
    });
  }
}

export function addFloatingText(
  state: GameRunState,
  x: number,
  y: number,
  text: string,
  color: string,
): void {
  state.floatingTexts.push({
    x,
    y,
    text,
    color,
    life: 1.0,
    maxLife: 1.0,
  });
}

/** Resolve the outcome of a math battle question and update game state */
export function resolveBattleAnswer(
  state: GameRunState,
  request: BattleRequest,
  chosenAnswer: number,
  speedBonus: number,
  rng: () => number = Math.random,
): BattleOutcome {
  const room = state.rooms[request.roomKey];
  const isCorrect = chosenAnswer === request.card.answer;

  if (!isCorrect) {
    state.combo = 0;
    state.wrongCount += 1;
    state.missedCards.push(request.card);
    state.player.hearts = Math.max(0, state.player.hearts - 1);
    state.player.invulnTimer = 1.4;
    state.shakeTimer = 0.28;

    // Gentle knockback away from facing direction
    const knockSpeed = 140;
    if (state.player.dir === 'up') state.player.knockVy = knockSpeed;
    if (state.player.dir === 'down') state.player.knockVy = -knockSpeed;
    if (state.player.dir === 'left') state.player.knockVx = knockSpeed;
    if (state.player.dir === 'right') state.player.knockVx = -knockSpeed;

    spawnParticles(state, state.player.x, state.player.y, '#EF4444', 10, rng);
    addFloatingText(state, state.player.x, state.player.y - 16, 'ダメージ！', '#FF6B6B');

    if (state.player.hearts <= 0) {
      state.status = 'gameover';
    } else {
      state.status = 'playing';
    }

    return {
      correct: false,
      speedBonus: 0,
      pointsAwarded: 0,
      defeatedTarget: false,
      message: `おしい！ こたえは ${request.card.answer} だよ`,
    };
  }

  // Correct answer!
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.correctCount += 1;
  const comboBonus = (state.combo - 1) * 20;
  const strikeBonus = request.firstStrike ? 30 : 0;
  const flameBonus = state.player.hasFlameSword ? 30 : 0;

  if (request.source === 'chest' && room) {
    const chest = room.chests.find((c) => c.id === request.targetId);
    let points = 200 + speedBonus + comboBonus;
    let msg = `たからばこを あけた！ +${points}てん`;

    if (chest && !chest.opened) {
      chest.opened = true;
      const cx = chest.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = chest.row * TILE_SIZE + TILE_SIZE / 2;
      spawnParticles(state, cx, cy, '#FACC15', 16, rng);

      if (chest.reward === 'key') {
        state.player.keys += 1;
        msg = '🗝️ しんでんの かぎを てにいれた！ ボスの とびらを あけよう！';
        addFloatingText(state, cx, cy - 16, 'かぎ GET!', '#FDE047');
      } else if (chest.reward === 'bigRupee') {
        points += 150;
        state.player.hearts = Math.min(state.player.maxHearts, state.player.hearts + 2);
        msg = `💎 ビッグルピー＆ハートかいふく！ +${points}てん`;
        addFloatingText(state, cx, cy - 16, `+${points}てん`, '#38BDF8');
      } else if (chest.reward === 'flameSword') {
        points += 100;
        state.player.hasFlameSword = true;
        msg = '🔥 ほのおの けんを てにいれた！ パワーアップ！';
        addFloatingText(state, cx, cy - 16, 'ほのおのけん!', '#FB923C');
      }
    }

    state.score += points;
    state.status = 'playing';
    state.toast = { text: msg, timer: 3.4 };

    return {
      correct: true,
      speedBonus,
      pointsAwarded: points,
      defeatedTarget: true,
      message: msg,
    };
  }

  // Enemy or Boss hit
  const enemy = room?.enemies.find((e) => e.id === request.targetId);
  if (!enemy || !enemy.alive) {
    state.status = 'playing';
    return {
      correct: true,
      speedBonus,
      pointsAwarded: 0,
      defeatedTarget: false,
      message: 'せいかい！',
    };
  }

  const isBoss = enemy.kind === 'boss';
  enemy.hp -= 1;
  enemy.hurtTimer = 0.45;
  state.shakeTimer = isBoss ? 0.3 : 0.16;

  let points = (isBoss ? 150 : 100) + speedBonus + comboBonus + strikeBonus + flameBonus;
  let defeated = false;
  let msg = `せいかい！ ${enemy.name}に ヒット！ +${points}てん`;

  spawnParticles(state, enemy.x, enemy.y, isBoss ? '#FACC15' : '#FFFFFF', isBoss ? 18 : 12, rng);

  if (enemy.hp <= 0) {
    enemy.alive = false;
    defeated = true;

    if (isBoss) {
      points += 500;
      room.bossDefeated = true;
      msg = `🎉 ${enemy.name}を たおした！ ひかりの トライスターを とろう！`;
      spawnParticles(state, enemy.x, enemy.y, '#FDE047', 28, rng);
      addFloatingText(state, enemy.x, enemy.y - 18, `+${points}てん!`, '#FDE047');

      // Spawn the iconic golden Tristar in the center of the boss room!
      room.pickups.push({
        id: 'tristar-goal',
        x: Math.floor(ROOM_COLS / 2) * TILE_SIZE + TILE_SIZE / 2,
        y: Math.floor(ROOM_ROWS / 2) * TILE_SIZE + TILE_SIZE / 2,
        kind: 'tristar',
        collected: false,
        bobPhase: 0,
      });
      state.toast = { text: '⭐ ひかりの トライスターが あらわれた！ さわって クリア！', timer: 4.5 };
    } else {
      msg = `せいかい！ ${enemy.name}を たおした！ +${points}てん`;
      addFloatingText(state, enemy.x, enemy.y - 14, `+${points}`, '#FDE047');

      // Drop loot: heart if player is injured, otherwise a rupee!
      const dropKind =
        state.player.hearts < state.player.maxHearts && rng() < 0.45 ? 'heart' : 'rupeeGreen';
      room.pickups.push({
        id: `drop-${enemy.id}-${Math.floor(rng() * 10000)}`,
        x: enemy.x,
        y: enemy.y,
        kind: dropKind,
        collected: false,
        bobPhase: 0,
      });
    }
  } else {
    // Boss survived hit: move boss back slightly so player doesn't instantly re-collide
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = Math.max(TILE_SIZE * 2.5, Math.min(CANVAS_WIDTH - TILE_SIZE * 2.5, enemy.x + (dx / len) * 64));
    const ny = Math.max(TILE_SIZE * 2.5, Math.min(CANVAS_HEIGHT - TILE_SIZE * 2.5, enemy.y + (dy / len) * 64));
    enemy.x = nx;
    enemy.y = ny;
    state.player.invulnTimer = 0.7;
    addFloatingText(state, enemy.x, enemy.y - 20, `あと ${enemy.hp}かい！`, '#FDE047');
    state.toast = { text: `${enemy.name}に ダメージ！ あと ${enemy.hp}かい あてよう！`, timer: 2.5 };
  }

  state.score += points;
  state.status = 'playing';

  return {
    correct: true,
    speedBonus,
    pointsAwarded: points,
    defeatedTarget: defeated,
    message: msg,
  };
}

export function getSwordHitbox(player: GameRunState['player']): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const reach = player.hasFlameSword ? 30 : 24;
  const thick = 22;
  switch (player.dir) {
    case 'up':
      return { x: player.x - thick / 2, y: player.y - 10 - reach, w: thick, h: reach };
    case 'down':
      return { x: player.x - thick / 2, y: player.y + 10, w: thick, h: reach };
    case 'left':
      return { x: player.x - 10 - reach, y: player.y - thick / 2, w: reach, h: thick };
    case 'right':
      return { x: player.x + 10, y: player.y - thick / 2, w: reach, h: thick };
  }
}

export function checkRoomTransition(state: GameRunState): Direction | null {
  const { player } = state;
  const margin = 8;

  if (player.x < margin && state.rooms[roomKeyOf(state.currentRx - 1, state.currentRy)]) {
    return 'left';
  }
  if (
    player.x > CANVAS_WIDTH - margin &&
    state.rooms[roomKeyOf(state.currentRx + 1, state.currentRy)]
  ) {
    return 'right';
  }
  if (player.y < margin && state.rooms[roomKeyOf(state.currentRx, state.currentRy - 1)]) {
    return 'up';
  }
  if (
    player.y > CANVAS_HEIGHT - margin &&
    state.rooms[roomKeyOf(state.currentRx, state.currentRy + 1)]
  ) {
    return 'down';
  }
  return null;
}

export function startRoomTransition(state: GameRunState, dir: Direction): void {
  const dRx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const dRy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  const toRx = state.currentRx + dRx;
  const toRy = state.currentRy + dRy;
  const dest = state.rooms[roomKeyOf(toRx, toRy)];
  if (!dest) return;

  state.transition = {
    fromRx: state.currentRx,
    fromRy: state.currentRy,
    toRx,
    toRy,
    dir,
    progress: 0,
  };
}

export function finishRoomTransition(state: GameRunState): void {
  const tr = state.transition;
  if (!tr) return;

  state.currentRx = tr.toRx;
  state.currentRy = tr.toRy;
  const room = getCurrentRoom(state);
  room.visited = true;

  const inset = TILE_SIZE * 1.15;
  if (tr.dir === 'right') state.player.x = inset;
  if (tr.dir === 'left') state.player.x = CANVAS_WIDTH - inset;
  if (tr.dir === 'down') state.player.y = inset;
  if (tr.dir === 'up') state.player.y = CANVAS_HEIGHT - inset;

  state.player.invulnTimer = Math.max(state.player.invulnTimer, 0.45);
  state.particles = [];
  state.floatingTexts = [];
  state.transition = null;

  if (room.isBossRoom && !room.bossDefeated) {
    const boss = room.enemies.find((e) => e.kind === 'boss' && e.alive);
    if (boss) {
      state.toast = {
        text: `⚡ ボス「${boss.name}」が あらわれた！ 3かい せいかいして たおそう！`,
        timer: 3.5,
      };
    }
  }
}

export function calculateClearBonus(hearts: number): number {
  return 500 + Math.max(0, hearts) * 100;
}

/** Compute monotonic wall-clock elapsed milliseconds for a run, independent of physics dt clamping. */
export function getRunElapsedMs(startMs: number, nowMs: number): number {
  return Math.max(0, nowMs - startMs);
}
