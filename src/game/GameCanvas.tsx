import { useCallback, useEffect, useRef, useState } from 'react';
import { DECK_MAP, type DeckId } from '../data/decks';
import { formatStopwatch } from '../utils/formatTime';
import { sound } from '../utils/sound';
import { BattleOverlay } from './BattleOverlay';
import {
  addFloatingText,
  calculateClearBonus,
  checkRoomTransition,
  createBattleRequest,
  createInitialGameState,
  finishRoomTransition,
  getCurrentRoom,
  getSwordHitbox,
  isBoxBlocked,
  resolveBattleAnswer,
  roomKeyOf,
  spawnParticles,
  startRoomTransition,
} from './engine';
import { getDirectionVector, renderGameFrame } from './sprites';
import { TouchControls } from './TouchControls';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ROOM_COLS,
  ROOM_ROWS,
  TILE_SIZE,
  type BattleOutcome,
  type BattleRequest,
  type Direction,
  type GameRunState,
} from './types';
import { WORLD_THEMES } from './worlds';

export interface GameEndSummary {
  deckId: DeckId;
  cleared: boolean;
  score: number;
  clearBonus: number;
  elapsedMs: number;
  correctCount: number;
  wrongCount: number;
  maxCombo: number;
  heartsLeft: number;
}

interface GameCanvasProps {
  deckId: DeckId;
  runNonce: number;
  onGameEnd: (summary: GameEndSummary) => void;
}

interface HudSnapshot {
  hearts: number;
  maxHearts: number;
  score: number;
  keys: number;
  combo: number;
  hasFlameSword: boolean;
  roomName: string;
  currentRx: number;
  currentRy: number;
  visitedKeys: string[];
  chestRoomKeys: string[];
  bossRoomKey: string;
  elapsedMs: number;
  toastText: string | null;
}

function buildHudSnapshot(state: GameRunState): HudSnapshot {
  const room = getCurrentRoom(state);
  const visitedKeys: string[] = [];
  const chestRoomKeys: string[] = [];
  let bossRoomKey = '2,0';

  for (const [key, r] of Object.entries(state.rooms)) {
    if (r.visited) visitedKeys.push(key);
    if (r.chests.some((c) => !c.opened)) chestRoomKeys.push(key);
    if (r.isBossRoom) bossRoomKey = key;
  }

  return {
    hearts: state.player.hearts,
    maxHearts: state.player.maxHearts,
    score: state.score,
    keys: state.player.keys,
    combo: state.combo,
    hasFlameSword: state.player.hasFlameSword,
    roomName: room.name,
    currentRx: state.currentRx,
    currentRy: state.currentRy,
    visitedKeys,
    chestRoomKeys,
    bossRoomKey,
    elapsedMs: state.elapsedMs,
    toastText: state.toast ? state.toast.text : null,
  };
}

export function GameCanvas({ deckId, runNonce, onGameEnd }: GameCanvasProps) {
  const theme = WORLD_THEMES[deckId];
  const deck = DECK_MAP[deckId];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameRunState>(createInitialGameState(deckId));
  const heldKeysRef = useRef<Set<string>>(new Set());
  const touchDirRef = useRef<Direction | null>(null);
  const lockedDoorNoticeCooldownRef = useRef<number>(0);
  const endedRef = useRef<boolean>(false);

  const [touchDir, setTouchDir] = useState<Direction | null>(null);
  const [activeBattle, setActiveBattle] = useState<BattleRequest | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(() => buildHudSnapshot(stateRef.current));

  // Re-initialize run when deckId or runNonce changes
  useEffect(() => {
    const initial = createInitialGameState(deckId);
    stateRef.current = initial;
    heldKeysRef.current.clear();
    touchDirRef.current = null;
    endedRef.current = false;
    setTouchDir(null);
    setActiveBattle(null);
    setHud(buildHudSnapshot(initial));
    sound.playStart();
  }, [deckId, runNonce]);

  const handleTouchDirChange = useCallback((dir: Direction | null) => {
    touchDirRef.current = dir;
    setTouchDir(dir);
  }, []);

  const triggerSwordAttack = useCallback(() => {
    const state = stateRef.current;
    if (state.status !== 'playing' || state.transition) return;
    if (state.player.attackCooldown > 0) return;

    state.player.attackTimer = 0.22;
    state.player.attackCooldown = 0.28;
    sound.playSword();
  }, []);

  const openBattle = useCallback((req: BattleRequest) => {
    const state = stateRef.current;
    state.status = 'battle';
    heldKeysRef.current.clear();
    touchDirRef.current = null;
    setTouchDir(null);
    setActiveBattle(req);
  }, []);

  const handleSubmitBattle = useCallback(
    (choice: number, speedBonus: number): BattleOutcome => {
      const state = stateRef.current;
      if (!activeBattle) {
        return {
          correct: false,
          speedBonus: 0,
          pointsAwarded: 0,
          defeatedTarget: false,
          message: '',
        };
      }
      const outcome = resolveBattleAnswer(state, activeBattle, choice, speedBonus);
      // Keep the world paused until the battle feedback overlay closes so the player sees the action resume
      if (state.status === 'playing') {
        state.status = 'battle';
      }
      if (outcome.correct) {
        if (activeBattle.source === 'chest' || outcome.defeatedTarget) {
          sound.playSecret();
        } else {
          sound.playCorrect();
        }
      } else {
        sound.playWrong();
      }
      setHud(buildHudSnapshot(state));
      return outcome;
    },
    [activeBattle],
  );

  const handleCompleteBattle = useCallback(() => {
    const state = stateRef.current;
    setActiveBattle(null);

    if (state.status === 'battle') {
      state.status = 'playing';
    }

    if (state.status === 'gameover' && !endedRef.current) {
      endedRef.current = true;
      onGameEnd({
        deckId,
        cleared: false,
        score: state.score,
        clearBonus: 0,
        elapsedMs: state.elapsedMs,
        correctCount: state.correctCount,
        wrongCount: state.wrongCount,
        maxCombo: state.maxCombo,
        heartsLeft: 0,
      });
    }
  }, [deckId, onGameEnd]);

  // Keyboard controls for movement and sword
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.status !== 'playing') return;

      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
      }

      if (key === ' ' || key === 'z' || key === 'enter') {
        if (!e.repeat) {
          triggerSwordAttack();
        }
        return;
      }

      if (
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)
      ) {
        heldKeysRef.current.add(key);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      heldKeysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [triggerSwordAttack]);

  // Main 60fps Game Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncAccum = 0;

    const getInputVector = (): { ix: number; iy: number; preferredDir: Direction | null } => {
      if (touchDirRef.current) {
        const v = getDirectionVector(touchDirRef.current);
        return { ix: v.dx, iy: v.dy, preferredDir: touchDirRef.current };
      }

      const keys = heldKeysRef.current;
      let ix = 0;
      let iy = 0;
      if (keys.has('arrowleft') || keys.has('a')) ix -= 1;
      if (keys.has('arrowright') || keys.has('d')) ix += 1;
      if (keys.has('arrowup') || keys.has('w')) iy -= 1;
      if (keys.has('arrowdown') || keys.has('s')) iy += 1;

      let preferredDir: Direction | null = null;
      if (iy < 0) preferredDir = 'up';
      else if (iy > 0) preferredDir = 'down';
      else if (ix < 0) preferredDir = 'left';
      else if (ix > 0) preferredDir = 'right';

      return { ix, iy, preferredDir };
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const state = stateRef.current;
      const timeSec = now / 1000;

      if (state.status === 'playing') {
        state.elapsedMs += dt * 1000;
      }

      if (state.shakeTimer > 0) {
        state.shakeTimer = Math.max(0, state.shakeTimer - dt);
      }
      if (state.toast) {
        state.toast.timer -= dt;
        if (state.toast.timer <= 0) state.toast = null;
      }
      if (lockedDoorNoticeCooldownRef.current > 0) {
        lockedDoorNoticeCooldownRef.current -= dt;
      }

      // Room scrolling transition
      if (state.status === 'playing' && state.transition) {
        state.transition.progress += dt / 0.24;
        if (state.transition.progress >= 1) {
          finishRoomTransition(state);
          setHud(buildHudSnapshot(state));
        }
      } else if (state.status === 'playing') {
        const room = getCurrentRoom(state);
        const { player } = state;

        // Timers
        if (player.attackTimer > 0) player.attackTimer = Math.max(0, player.attackTimer - dt);
        if (player.attackCooldown > 0) {
          player.attackCooldown = Math.max(0, player.attackCooldown - dt);
        }
        if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);

        // Player Movement
        const halfW = 9;
        const halfH = 9;
        const speed = 136;
        const { ix, iy, preferredDir } = getInputVector();

        let vx = ix;
        let vy = iy;
        if (vx !== 0 && vy !== 0) {
          const inv = 1 / Math.SQRT2;
          vx *= inv;
          vy *= inv;
        }
        vx = vx * speed + player.knockVx;
        vy = vy * speed + player.knockVy;

        // Dampen knockback
        player.knockVx *= Math.pow(0.001, dt);
        player.knockVy *= Math.pow(0.001, dt);
        if (Math.abs(player.knockVx) < 4) player.knockVx = 0;
        if (Math.abs(player.knockVy) < 4) player.knockVy = 0;

        if (preferredDir && player.attackTimer <= 0) {
          player.dir = preferredDir;
        }

        if (ix !== 0 || iy !== 0) {
          player.walkTimer += dt;
          if (player.walkTimer >= 0.14) {
            player.walkTimer = 0;
            player.walkFrame = (player.walkFrame + 1) % 2;
          }
        }

        // Move X with corner assist
        const nextX = player.x + vx * dt;
        if (!isBoxBlocked(room, nextX, player.y, halfW, halfH)) {
          player.x = nextX;
        } else if (ix !== 0 && iy === 0) {
          // Gentle vertical corner nudge
          for (const nudge of [-8, 8, -14, 14]) {
            if (!isBoxBlocked(room, nextX, player.y + nudge, halfW, halfH)) {
              player.y += Math.sign(nudge) * Math.min(Math.abs(nudge), 95 * dt);
              break;
            }
          }
        }

        // Move Y with corner assist
        const nextY = player.y + vy * dt;
        if (!isBoxBlocked(room, player.x, nextY, halfW, halfH)) {
          player.y = nextY;
        } else if (iy !== 0 && ix === 0) {
          for (const nudge of [-8, 8, -14, 14]) {
            if (!isBoxBlocked(room, player.x + nudge, nextY, halfW, halfH)) {
              player.x += Math.sign(nudge) * Math.min(Math.abs(nudge), 95 * dt);
              break;
            }
          }
        }

        // Check Locked Boss Door proximity ('L')
        for (let r = 0; r < ROOM_ROWS; r++) {
          for (let c = 0; c < ROOM_COLS; c++) {
            if (room.tiles[r][c] === 'L') {
              const lx = c * TILE_SIZE + TILE_SIZE / 2;
              const ly = r * TILE_SIZE + TILE_SIZE / 2;
              if (Math.hypot(player.x - lx, player.y - ly) < 30) {
                if (player.keys > 0) {
                  player.keys -= 1;
                  room.tiles[r][c] = ',';
                  sound.playSecret();
                  spawnParticles(state, lx, ly, '#FDE047', 22);
                  addFloatingText(state, lx - 12, ly - 14, 'オープン！', '#FDE047');
                  state.toast = {
                    text: '🔓 しんでんの とびらが ひらいた！ みぎの ボスのへやへ すすもう！',
                    timer: 3.6,
                  };
                  setHud(buildHudSnapshot(state));
                } else if (lockedDoorNoticeCooldownRef.current <= 0) {
                  lockedDoorNoticeCooldownRef.current = 2.4;
                  sound.playWrong();
                  state.toast = {
                    text: '🔒 かぎが ひつようだよ！ ひだりうえの へやの たからばこを あけよう！',
                    timer: 3.2,
                  };
                  setHud(buildHudSnapshot(state));
                }
              }
            }
          }
        }

        // Check Healing Fairy Spring ('F')
        if (player.hearts < player.maxHearts) {
          const pCol = Math.floor(player.x / TILE_SIZE);
          const pRow = Math.floor(player.y / TILE_SIZE);
          let nearSpring = false;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const rr = pRow + dr;
              const cc = pCol + dc;
              if (
                rr >= 0 &&
                rr < ROOM_ROWS &&
                cc >= 0 &&
                cc < ROOM_COLS &&
                room.tiles[rr][cc] === 'F'
              ) {
                nearSpring = true;
              }
            }
          }
          if (nearSpring) {
            player.hearts = player.maxHearts;
            sound.playSecret();
            spawnParticles(state, player.x, player.y, '#7DD3FC', 18);
            addFloatingText(state, player.x, player.y - 16, 'ぜんかいふく！', '#7DD3FC');
            state.toast = { text: '✨ いずみの ちからで ハートが ぜんかいふく！', timer: 3.0 };
            setHud(buildHudSnapshot(state));
          }
        }

        // Check Sword Interactions (bushes, chests, enemies)
        let battleTriggered: BattleRequest | null = null;

        if (player.attackTimer > 0) {
          const box = getSwordHitbox(player);

          // Cut bushes
          const minC = Math.max(0, Math.floor(box.x / TILE_SIZE));
          const maxC = Math.min(ROOM_COLS - 1, Math.floor((box.x + box.w) / TILE_SIZE));
          const minR = Math.max(0, Math.floor(box.y / TILE_SIZE));
          const maxR = Math.min(ROOM_ROWS - 1, Math.floor((box.y + box.h) / TILE_SIZE));

          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              if (room.tiles[r][c] === 'B') {
                room.tiles[r][c] = '.';
                const bx = c * TILE_SIZE + TILE_SIZE / 2;
                const by = r * TILE_SIZE + TILE_SIZE / 2;
                spawnParticles(state, bx, by, theme.palette.bushHighlight, 10);
                sound.playNextCard();
                if (Math.random() < 0.45) {
                  const dropKind =
                    player.hearts < player.maxHearts && Math.random() < 0.35
                      ? 'heart'
                      : 'rupeeGreen';
                  room.pickups.push({
                    id: `bush-${r}-${c}-${Math.floor(now)}`,
                    x: bx,
                    y: by,
                    kind: dropKind,
                    collected: false,
                    bobPhase: 0,
                  });
                }
              }
            }
          }

          // Slash enemy -> First-strike Math Battle!
          for (const enemy of room.enemies) {
            if (!enemy.alive) continue;
            const er = enemy.kind === 'boss' ? 20 : 12;
            const overlap =
              box.x < enemy.x + er &&
              box.x + box.w > enemy.x - er &&
              box.y < enemy.y + er &&
              box.y + box.h > enemy.y - er;
            if (overlap) {
              battleTriggered = createBattleRequest(state, {
                source: 'enemy',
                targetId: enemy.id,
                targetName: enemy.name,
                targetKind: enemy.kind,
                targetHp: enemy.hp,
                targetMaxHp: enemy.maxHp,
                firstStrike: true,
              });
              player.attackTimer = 0;
              break;
            }
          }

          // Slash / inspect chest -> Chest Math Quiz!
          if (!battleTriggered) {
            for (const chest of room.chests) {
              if (chest.opened) continue;
              const cx = chest.col * TILE_SIZE + TILE_SIZE / 2;
              const cy = chest.row * TILE_SIZE + TILE_SIZE / 2;
              const overlap =
                box.x < cx + 15 &&
                box.x + box.w > cx - 15 &&
                box.y < cy + 15 &&
                box.y + box.h > cy - 15;
              if (overlap) {
                battleTriggered = createBattleRequest(state, {
                  source: 'chest',
                  targetId: chest.id,
                  targetName: `たからばこ（${chest.label}）`,
                  targetKind: 'chest',
                  firstStrike: false,
                });
                player.attackTimer = 0;
                break;
              }
            }
          }
        }

        // Also allow bumping directly into a closed chest (when not invulnerable) to open it
        if (!battleTriggered && player.invulnTimer <= 0) {
          for (const chest of room.chests) {
            if (chest.opened) continue;
            const cx = chest.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = chest.row * TILE_SIZE + TILE_SIZE / 2;
            if (Math.hypot(player.x - cx, player.y - cy) < 28) {
              battleTriggered = createBattleRequest(state, {
                source: 'chest',
                targetId: chest.id,
                targetName: `たからばこ（${chest.label}）`,
                targetKind: 'chest',
                firstStrike: false,
              });
              break;
            }
          }
        }

        // Update Enemies AI & Contact Check
        for (const enemy of room.enemies) {
          if (!enemy.alive) continue;
          if (enemy.hurtTimer > 0) enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);

          enemy.aiTimer -= dt;
          if (enemy.aiTimer <= 0) {
            enemy.aiTimer = 0.8 + Math.random() * 1.1;
            if (enemy.kind === 'boss' && Math.random() < 0.65) {
              // Boss gently pursues player
              const dx = player.x - enemy.x;
              const dy = player.y - enemy.y;
              if (Math.abs(dx) > Math.abs(dy)) {
                enemy.vx = Math.sign(dx) * enemy.speed;
                enemy.vy = 0;
              } else {
                enemy.vx = 0;
                enemy.vy = Math.sign(dy) * enemy.speed;
              }
            } else {
              const dirs: Direction[] = ['up', 'down', 'left', 'right'];
              const pick = dirs[Math.floor(Math.random() * dirs.length)];
              const vec = getDirectionVector(pick);
              enemy.dir = pick;
              enemy.vx = vec.dx * enemy.speed;
              enemy.vy = vec.dy * enemy.speed;
            }
          }

          const er = enemy.kind === 'boss' ? 16 : 10;
          const enx = enemy.x + enemy.vx * dt;
          const eny = enemy.y + enemy.vy * dt;
          const insideSafe =
            enx > TILE_SIZE * 1.5 &&
            enx < CANVAS_WIDTH - TILE_SIZE * 1.5 &&
            eny > TILE_SIZE * 1.5 &&
            eny < CANVAS_HEIGHT - TILE_SIZE * 1.5;

          if (insideSafe && !isBoxBlocked(room, enx, eny, er, er)) {
            enemy.x = enx;
            enemy.y = eny;
          } else {
            enemy.vx = -enemy.vx;
            enemy.vy = -enemy.vy;
            enemy.aiTimer = 0.25;
          }

          // Contact with player triggers counter-battle
          if (!battleTriggered && player.invulnTimer <= 0) {
            const touchDist = enemy.kind === 'boss' ? 28 : 21;
            if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < touchDist) {
              battleTriggered = createBattleRequest(state, {
                source: 'enemy',
                targetId: enemy.id,
                targetName: enemy.name,
                targetKind: enemy.kind,
                targetHp: enemy.hp,
                targetMaxHp: enemy.maxHp,
                firstStrike: false,
              });
            }
          }
        }

        // Collect Pickups
        for (const pickup of room.pickups) {
          if (pickup.collected) continue;
          if (Math.hypot(player.x - pickup.x, player.y - pickup.y) < 22) {
            pickup.collected = true;
            if (pickup.kind === 'rupeeGreen') {
              state.score += 20;
              sound.playPickup();
              spawnParticles(state, pickup.x, pickup.y, '#4ADE80', 8);
              addFloatingText(state, pickup.x, pickup.y - 10, '+20', '#4ADE80');
            } else if (pickup.kind === 'rupeeBlue') {
              state.score += 50;
              sound.playPickup();
              spawnParticles(state, pickup.x, pickup.y, '#38BDF8', 10);
              addFloatingText(state, pickup.x, pickup.y - 10, '+50', '#38BDF8');
            } else if (pickup.kind === 'heart') {
              sound.playPickup();
              if (player.hearts < player.maxHearts) {
                player.hearts += 1;
                addFloatingText(state, pickup.x, pickup.y - 10, 'ハート+1', '#FB7185');
              } else {
                state.score += 30;
                addFloatingText(state, pickup.x, pickup.y - 10, '+30', '#FB7185');
              }
              spawnParticles(state, pickup.x, pickup.y, '#FB7185', 10);
            } else if (pickup.kind === 'tristar' && !endedRef.current) {
              endedRef.current = true;
              const clearBonus = calculateClearBonus(player.hearts);
              state.score += clearBonus;
              state.status = 'victory';
              sound.playVictory();
              spawnParticles(state, pickup.x, pickup.y, '#FDE047', 30);
              setHud(buildHudSnapshot(state));
              onGameEnd({
                deckId,
                cleared: true,
                score: state.score,
                clearBonus,
                elapsedMs: state.elapsedMs,
                correctCount: state.correctCount,
                wrongCount: state.wrongCount,
                maxCombo: state.maxCombo,
                heartsLeft: player.hearts,
              });
            }
          }
        }

        // Check Room Transition
        if (!battleTriggered && state.status === 'playing') {
          const exitDir = checkRoomTransition(state);
          if (exitDir) {
            startRoomTransition(state, exitDir);
          }
        }

        if (battleTriggered) {
          openBattle(battleTriggered);
        }
      }

      // Update particles and floating texts
      state.particles = state.particles.filter((pt) => {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.life -= dt;
        return pt.life > 0;
      });

      state.floatingTexts = state.floatingTexts.filter((ft) => {
        ft.y -= 28 * dt;
        ft.life -= dt;
        return ft.life > 0;
      });

      // Render Canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        renderGameFrame(ctx, state, theme.palette, timeSec);
      }

      // Sync React HUD at ~10Hz
      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.1) {
        hudSyncAccum = 0;
        setHud(buildHudSnapshot(state));
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [deckId, theme.palette, openBattle, onGameEnd]);

  return (
    <div className="zelda-play-shell">
      {/* Classic NES Zelda-inspired Top HUD */}
      <div className="zelda-hud">
        <div className="hud-minimap" aria-label="ダンジョンマップ">
          {[0, 1].map((ry) => (
            <div key={ry} className="minimap-row">
              {[0, 1, 2].map((rx) => {
                const key = roomKeyOf(rx, ry);
                const isHere = hud.currentRx === rx && hud.currentRy === ry;
                const visited = hud.visitedKeys.includes(key);
                const isBoss = key === hud.bossRoomKey;
                const hasChest = hud.chestRoomKeys.includes(key);
                return (
                  <div
                    key={key}
                    className={`minimap-cell ${visited ? 'is-visited' : ''} ${
                      isHere ? 'is-here' : ''
                    } ${isBoss ? 'is-boss' : ''}`}
                    title={isBoss ? 'ボスの へや' : undefined}
                  >
                    {isHere ? '●' : isBoss ? '👑' : hasChest && visited ? '■' : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="hud-center-info">
          <div className="hud-room-line">
            <span className="hud-deck-chip" style={{ backgroundColor: deck.color }}>
              {deck.shortName}
            </span>
            <span className="hud-room-name">{hud.roomName}</span>
          </div>
          <div className="hud-stats-line">
            <span className="hud-stat">💎 {hud.score}</span>
            <span className="hud-stat">🗝️ {hud.keys}</span>
            <span className="hud-stat mono-num">⏱ {formatStopwatch(hud.elapsedMs)}</span>
          </div>
        </div>

        <div className="hud-hearts-box" aria-label={`ライフ ${hud.hearts} / ${hud.maxHearts}`}>
          <div className="hud-hearts-label">LIFE</div>
          <div className="hud-hearts-row">
            {Array.from({ length: hud.maxHearts }).map((_, i) => (
              <span
                key={i}
                className={`hud-heart ${i < hud.hearts ? 'is-full' : 'is-empty'}`}
              >
                {i < hud.hearts ? '♥' : '♡'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Pixel Canvas Container */}
      <div className="zelda-canvas-frame">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="zelda-canvas"
        />

        {hud.toastText && (
          <div className="zelda-toast" role="status">
            {hud.toastText}
          </div>
        )}
      </div>

      {/* Smartphone & Desktop Touch Controls */}
      <TouchControls
        activeDir={touchDir}
        onDirChange={handleTouchDirChange}
        onAttack={triggerSwordAttack}
        hasFlameSword={hud.hasFlameSword}
      />

      {/* Math Battle Overlay */}
      {activeBattle && (
        <BattleOverlay
          request={activeBattle}
          combo={hud.combo}
          onSubmitAnswer={handleSubmitBattle}
          onComplete={handleCompleteBattle}
        />
      )}
    </div>
  );
}
