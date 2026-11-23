import {
  ROOM_COLS,
  ROOM_ROWS,
  TILE_SIZE,
  type ActiveChest,
  type ActiveEnemy,
  type ActivePickup,
  type Direction,
  type GameRunState,
  type PlayerState,
  type RoomState,
  type TileChar,
  type WorldPalette,
} from './types';

function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: TileChar,
  col: number,
  row: number,
  palette: WorldPalette,
  timeSec: number,
  hasKey: boolean,
): void {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;

  // Base ground
  const isAlt = (col + row) % 2 === 0;
  drawPixelRect(ctx, x, y, TILE_SIZE, TILE_SIZE, isAlt ? palette.ground : palette.groundAlt);

  if (tile === '.') {
    // Subtle tiny grass/stone texture pixel
    if ((col * 7 + row * 13) % 5 === 0) {
      drawPixelRect(ctx, x + 6, y + 10, 4, 2, palette.groundAlt);
      drawPixelRect(ctx, x + 20, y + 22, 4, 2, palette.groundAlt);
    }
    return;
  }

  if (tile === ',') {
    drawPixelRect(ctx, x, y, TILE_SIZE, TILE_SIZE, palette.path);
    if ((col + row * 3) % 2 === 0) {
      drawPixelRect(ctx, x + 6, y + 6, 4, 4, palette.pathDot);
      drawPixelRect(ctx, x + 20, y + 18, 4, 4, palette.pathDot);
    } else {
      drawPixelRect(ctx, x + 16, y + 8, 4, 4, palette.pathDot);
      drawPixelRect(ctx, x + 8, y + 22, 4, 4, palette.pathDot);
    }
    return;
  }

  if (tile === '#') {
    // Classic NES Zelda beveled rock / tree block
    drawPixelRect(ctx, x, y, TILE_SIZE, TILE_SIZE, palette.wallShadow);
    drawPixelRect(ctx, x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 6, palette.wall);
    drawPixelRect(ctx, x + 4, y + 4, TILE_SIZE - 8, 8, palette.wallHighlight);
    drawPixelRect(ctx, x + 6, y + 14, 6, 6, palette.wallHighlight);
    drawPixelRect(ctx, x + 18, y + 16, 6, 6, palette.wallShadow);
    return;
  }

  if (tile === '~') {
    drawPixelRect(ctx, x, y, TILE_SIZE, TILE_SIZE, palette.water);
    const waveOffset = Math.floor(timeSec * 3 + col + row) % 4;
    drawPixelRect(ctx, x + 4 + waveOffset * 2, y + 8, 10, 3, palette.waterFoam);
    drawPixelRect(ctx, x + 14 - waveOffset * 2, y + 21, 10, 3, palette.waterFoam);
    return;
  }

  if (tile === 'F') {
    // Healing Fairy Spring
    drawPixelRect(ctx, x, y, TILE_SIZE, TILE_SIZE, '#38BDF8');
    drawPixelRect(ctx, x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, '#7DD3FC');
    const pulse = Math.sin(timeSec * 5 + col) > 0;
    drawPixelRect(ctx, x + 10, y + 10, 12, 12, pulse ? '#FFF7ED' : '#BAE6FD');
    drawPixelRect(ctx, x + 14, y + 6, 4, 4, '#F472B6');
    drawPixelRect(ctx, x + 14, y + 22, 4, 4, '#FDE047');
    return;
  }

  if (tile === 'B') {
    // Cuttable bush
    drawPixelRect(ctx, x + 4, y + 24, 24, 5, 'rgba(0,0,0,0.22)');
    drawPixelRect(ctx, x + 4, y + 6, 24, 20, palette.bush);
    drawPixelRect(ctx, x + 7, y + 4, 18, 16, palette.bush);
    drawPixelRect(ctx, x + 7, y + 7, 7, 6, palette.bushHighlight);
    drawPixelRect(ctx, x + 17, y + 9, 7, 5, palette.bushHighlight);
    drawPixelRect(ctx, x + 11, y + 15, 6, 5, palette.bushHighlight);
    return;
  }

  if (tile === 'T') {
    // Stone torch pedestal with flickering flame
    drawPixelRect(ctx, x + 6, y + 14, 20, 16, '#475569');
    drawPixelRect(ctx, x + 8, y + 16, 16, 10, '#64748B');
    const flicker = Math.floor(timeSec * 10 + col) % 2;
    drawPixelRect(ctx, x + 10, y + 4 + flicker, 12, 12, '#F97316');
    drawPixelRect(ctx, x + 12, y + 7 - flicker, 8, 8, '#FDE047');
    drawPixelRect(ctx, x + 14, y + 10, 4, 4, '#FFFFFF');
    return;
  }

  if (tile === 'L') {
    // Locked Boss Gate
    drawPixelRect(ctx, x, y, TILE_SIZE, TILE_SIZE, '#5C3A21');
    drawPixelRect(ctx, x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, '#92400E');
    drawPixelRect(ctx, x + 3, y + 7, TILE_SIZE - 6, 3, '#D97706');
    drawPixelRect(ctx, x + 3, y + 22, TILE_SIZE - 6, 3, '#D97706');
    // Keyhole plate
    const glow = hasKey && Math.floor(timeSec * 6) % 2 === 0;
    drawPixelRect(ctx, x + 10, y + 10, 12, 12, glow ? '#FEF08A' : '#FACC15');
    drawPixelRect(ctx, x + 14, y + 12, 4, 4, '#1E293B');
    drawPixelRect(ctx, x + 15, y + 16, 2, 4, '#1E293B');
  }
}

function drawChest(ctx: CanvasRenderingContext2D, chest: ActiveChest, timeSec: number): void {
  const x = chest.col * TILE_SIZE + 3;
  const y = chest.row * TILE_SIZE + 5;

  // Shadow
  drawPixelRect(ctx, x + 1, y + 20, 24, 5, 'rgba(0,0,0,0.28)');

  if (chest.opened) {
    drawPixelRect(ctx, x, y + 6, 26, 16, '#78350F');
    drawPixelRect(ctx, x + 2, y + 8, 22, 8, '#1E1B4B');
    drawPixelRect(ctx, x, y, 26, 7, '#B45309');
    drawPixelRect(ctx, x + 10, y + 12, 6, 4, '#FACC15');
    return;
  }

  // Closed golden-trimmed chest
  drawPixelRect(ctx, x, y + 2, 26, 20, '#78350F');
  drawPixelRect(ctx, x + 2, y + 4, 22, 16, '#B45309');
  drawPixelRect(ctx, x + 2, y + 4, 22, 6, '#D97706');
  // Gold trim
  drawPixelRect(ctx, x, y + 10, 26, 3, '#FACC15');
  drawPixelRect(ctx, x + 10, y + 8, 6, 7, '#FDE047');
  drawPixelRect(ctx, x + 12, y + 10, 2, 3, '#78350F');

  // Subtle sparkle on unopened chest
  if (Math.floor(timeSec * 4) % 2 === 0) {
    drawPixelRect(ctx, x + 21, y - 2, 4, 4, '#FEF08A');
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, pickup: ActivePickup, timeSec: number): void {
  if (pickup.collected) return;
  const bob = Math.sin(timeSec * 5 + pickup.bobPhase) * 2.5;
  const cx = Math.round(pickup.x);
  const cy = Math.round(pickup.y + bob);

  // Shadow
  drawPixelRect(ctx, cx - 6, Math.round(pickup.y) + 8, 12, 4, 'rgba(0,0,0,0.22)');

  if (pickup.kind === 'rupeeGreen' || pickup.kind === 'rupeeBlue') {
    const main = pickup.kind === 'rupeeGreen' ? '#22C55E' : '#38BDF8';
    const hi = pickup.kind === 'rupeeGreen' ? '#86EFAC' : '#BAE6FD';
    const dark = pickup.kind === 'rupeeGreen' ? '#15803D' : '#0369A1';
    drawPixelRect(ctx, cx - 3, cy - 9, 6, 3, dark);
    drawPixelRect(ctx, cx - 6, cy - 6, 12, 12, main);
    drawPixelRect(ctx, cx - 3, cy + 6, 6, 3, dark);
    drawPixelRect(ctx, cx - 3, cy - 5, 4, 8, hi);
    return;
  }

  if (pickup.kind === 'heart') {
    drawPixelRect(ctx, cx - 7, cy - 6, 6, 6, '#EF4444');
    drawPixelRect(ctx, cx + 1, cy - 6, 6, 6, '#EF4444');
    drawPixelRect(ctx, cx - 7, cy - 2, 14, 5, '#EF4444');
    drawPixelRect(ctx, cx - 5, cy + 3, 10, 3, '#DC2626');
    drawPixelRect(ctx, cx - 2, cy + 6, 4, 2, '#DC2626');
    drawPixelRect(ctx, cx - 5, cy - 4, 3, 3, '#FCA5A5');
    return;
  }

  // Iconic Golden Tristar (Stage Goal!)
  const pulse = 1 + Math.sin(timeSec * 7) * 0.14;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  // Outer aura
  ctx.fillStyle = 'rgba(253, 224, 71, 0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  // Triforce-inspired three golden triangles
  const tri = (tx: number, ty: number, size: number) => {
    ctx.beginPath();
    ctx.moveTo(tx, ty - size);
    ctx.lineTo(tx - size, ty + size * 0.75);
    ctx.lineTo(tx + size, ty + size * 0.75);
    ctx.closePath();
    ctx.fillStyle = '#FACC15';
    ctx.fill();
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  tri(0, -6, 7);
  tri(-7, 6, 7);
  tri(7, 6, 7);

  ctx.restore();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: ActiveEnemy,
  palette: WorldPalette,
  timeSec: number,
): void {
  if (!enemy.alive) return;
  const cx = Math.round(enemy.x);
  const cy = Math.round(enemy.y);
  const hop = Math.abs(Math.sin(timeSec * 6 + cx * 0.05)) * 3;
  const flash = enemy.hurtTimer > 0 && Math.floor(timeSec * 20) % 2 === 0;

  if (enemy.kind === 'boss') {
    // Giant Boss sprite (44x44)
    drawPixelRect(ctx, cx - 20, cy + 16, 40, 8, 'rgba(0,0,0,0.32)');
    const primary = flash ? '#FFFFFF' : palette.bossPrimary;
    const secondary = flash ? '#FEF08A' : palette.bossSecondary;
    const by = cy - hop;

    // Crown / Horns
    drawPixelRect(ctx, cx - 14, by - 24, 6, 8, secondary);
    drawPixelRect(ctx, cx - 3, by - 27, 6, 11, secondary);
    drawPixelRect(ctx, cx + 8, by - 24, 6, 8, secondary);

    // Body
    drawPixelRect(ctx, cx - 20, by - 16, 40, 32, '#1E293B');
    drawPixelRect(ctx, cx - 18, by - 14, 36, 28, primary);
    drawPixelRect(ctx, cx - 14, by - 12, 12, 8, 'rgba(255,255,255,0.28)');

    // Eyes
    drawPixelRect(ctx, cx - 12, by - 6, 8, 8, '#FFFFFF');
    drawPixelRect(ctx, cx + 4, by - 6, 8, 8, '#FFFFFF');
    drawPixelRect(ctx, cx - 9, by - 4, 4, 5, '#0F172A');
    drawPixelRect(ctx, cx + 7, by - 4, 4, 5, '#0F172A');

    // Mouth / Fangs
    drawPixelRect(ctx, cx - 10, by + 6, 20, 5, '#0F172A');
    drawPixelRect(ctx, cx - 7, by + 6, 4, 3, '#FFFFFF');
    drawPixelRect(ctx, cx + 3, by + 6, 4, 3, '#FFFFFF');

    // Boss HP Hearts bar above head
    for (let i = 0; i < enemy.maxHp; i++) {
      const hx = cx - (enemy.maxHp * 12) / 2 + i * 12 + 2;
      const hy = by - 37;
      drawPixelRect(ctx, hx, hy, 8, 7, i < enemy.hp ? '#EF4444' : '#334155');
      if (i < enemy.hp) {
        drawPixelRect(ctx, hx + 1, hy + 1, 2, 2, '#FCA5A5');
      }
    }
    return;
  }

  // Regular Enemy shadow
  drawPixelRect(ctx, cx - 10, cy + 9, 20, 5, 'rgba(0,0,0,0.25)');
  const ey = cy - hop;

  if (enemy.kind === 'slime') {
    const col = flash ? '#FFFFFF' : '#34D399';
    const dark = flash ? '#E2E8F0' : '#059669';
    drawPixelRect(ctx, cx - 11, ey - 6, 22, 16, dark);
    drawPixelRect(ctx, cx - 9, ey - 9, 18, 17, col);
    drawPixelRect(ctx, cx - 6, ey - 6, 5, 4, '#A7F3D0');
    drawPixelRect(ctx, cx - 6, ey - 1, 4, 4, '#0F172A');
    drawPixelRect(ctx, cx + 2, ey - 1, 4, 4, '#0F172A');
    return;
  }

  if (enemy.kind === 'octorok') {
    const col = flash ? '#FFFFFF' : '#EF4444';
    const dark = flash ? '#E2E8F0' : '#B91C1C';
    drawPixelRect(ctx, cx - 11, ey - 10, 22, 18, col);
    drawPixelRect(ctx, cx - 11, ey + 6, 5, 5, dark);
    drawPixelRect(ctx, cx - 2, ey + 6, 5, 5, dark);
    drawPixelRect(ctx, cx + 6, ey + 6, 5, 5, dark);
    drawPixelRect(ctx, cx - 7, ey - 6, 5, 5, '#FFFFFF');
    drawPixelRect(ctx, cx + 2, ey - 6, 5, 5, '#FFFFFF');
    drawPixelRect(ctx, cx - 5, ey - 5, 2, 3, '#0F172A');
    drawPixelRect(ctx, cx + 4, ey - 5, 2, 3, '#0F172A');
    drawPixelRect(ctx, cx - 3, ey + 1, 6, 4, '#FDE047');
    return;
  }

  if (enemy.kind === 'bat') {
    const flap = Math.floor(timeSec * 12) % 2 === 0;
    const col = flash ? '#FFFFFF' : '#7C3AED';
    drawPixelRect(ctx, cx - 6, ey - 6, 12, 12, col);
    if (flap) {
      drawPixelRect(ctx, cx - 15, ey - 10, 9, 8, '#5B21B6');
      drawPixelRect(ctx, cx + 6, ey - 10, 9, 8, '#5B21B6');
    } else {
      drawPixelRect(ctx, cx - 15, ey - 1, 9, 7, '#5B21B6');
      drawPixelRect(ctx, cx + 6, ey - 1, 9, 7, '#5B21B6');
    }
    drawPixelRect(ctx, cx - 4, ey - 3, 3, 3, '#FDE047');
    drawPixelRect(ctx, cx + 1, ey - 3, 3, 3, '#FDE047');
    return;
  }

  // Skeleton knight
  const bone = flash ? '#FEF08A' : '#F8FAFC';
  drawPixelRect(ctx, cx - 9, ey - 12, 18, 12, bone);
  drawPixelRect(ctx, cx - 6, ey - 8, 4, 4, '#0F172A');
  drawPixelRect(ctx, cx + 2, ey - 8, 4, 4, '#0F172A');
  drawPixelRect(ctx, cx - 7, ey, 14, 10, '#64748B');
  drawPixelRect(ctx, cx - 5, ey + 2, 10, 2, bone);
  drawPixelRect(ctx, cx - 5, ey + 6, 10, 2, bone);
}

function drawSword(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  cx: number,
  cy: number,
): void {
  if (player.attackTimer <= 0) return;

  const blade = player.hasFlameSword ? '#FB923C' : '#E2E8F0';
  const bladeHi = player.hasFlameSword ? '#FEF08A' : '#FFFFFF';
  const hilt = '#D97706';
  const len = player.hasFlameSword ? 26 : 20;

  if (player.dir === 'up') {
    drawPixelRect(ctx, cx - 3, cy - 12 - len, 6, len, blade);
    drawPixelRect(ctx, cx - 1, cy - 12 - len, 2, len, bladeHi);
    drawPixelRect(ctx, cx - 7, cy - 14, 14, 4, hilt);
  } else if (player.dir === 'down') {
    drawPixelRect(ctx, cx - 3, cy + 12, 6, len, blade);
    drawPixelRect(ctx, cx - 1, cy + 12, 2, len, bladeHi);
    drawPixelRect(ctx, cx - 7, cy + 10, 14, 4, hilt);
  } else if (player.dir === 'left') {
    drawPixelRect(ctx, cx - 12 - len, cy - 3, len, 6, blade);
    drawPixelRect(ctx, cx - 12 - len, cy - 1, len, 2, bladeHi);
    drawPixelRect(ctx, cx - 14, cy - 7, 4, 14, hilt);
  } else {
    drawPixelRect(ctx, cx + 12, cy - 3, len, 6, blade);
    drawPixelRect(ctx, cx + 12, cy - 1, len, 2, bladeHi);
    drawPixelRect(ctx, cx + 10, cy - 7, 4, 14, hilt);
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  timeSec: number,
): void {
  if (player.invulnTimer > 0 && Math.floor(timeSec * 18) % 2 === 0) {
    return;
  }

  const cx = Math.round(player.x);
  const cy = Math.round(player.y);
  const step = player.walkFrame % 2 === 0 ? 0 : 2;

  // Shadow
  drawPixelRect(ctx, cx - 10, cy + 9, 20, 5, 'rgba(0,0,0,0.28)');

  // Sword behind hero if swinging up
  if (player.dir === 'up') {
    drawSword(ctx, player, cx, cy);
  }

  // Boots
  drawPixelRect(ctx, cx - 7, cy + 7 - step, 5, 5, '#78350F');
  drawPixelRect(ctx, cx + 2, cy + 5 + step, 5, 5, '#78350F');

  // Green Tunic (iconic NES Link look!)
  drawPixelRect(ctx, cx - 9, cy - 3, 18, 12, '#16A34A');
  drawPixelRect(ctx, cx - 9, cy + 3, 18, 3, '#92400E'); // belt
  drawPixelRect(ctx, cx - 2, cy + 3, 4, 3, '#FACC15'); // buckle

  // Little wooden/gold shield on side
  if (player.dir !== 'up') {
    const sx = player.dir === 'left' ? cx - 12 : cx + 7;
    drawPixelRect(ctx, sx, cy - 1, 6, 9, '#B45309');
    drawPixelRect(ctx, sx + 1, cy + 1, 4, 5, '#FACC15');
  }

  // Head & Pointed Green Cap
  drawPixelRect(ctx, cx - 8, cy - 13, 16, 11, '#FDE68A'); // face
  drawPixelRect(ctx, cx - 9, cy - 16, 18, 6, '#15803D'); // cap base
  drawPixelRect(ctx, cx - 6, cy - 19, 12, 4, '#22C55E'); // cap tip

  // Hair & Eyes depending on facing direction
  if (player.dir === 'down') {
    drawPixelRect(ctx, cx - 8, cy - 11, 16, 2, '#D97706');
    drawPixelRect(ctx, cx - 5, cy - 8, 3, 3, '#0F172A');
    drawPixelRect(ctx, cx + 2, cy - 8, 3, 3, '#0F172A');
  } else if (player.dir === 'up') {
    drawPixelRect(ctx, cx - 8, cy - 12, 16, 9, '#15803D');
    drawPixelRect(ctx, cx - 6, cy - 10, 12, 4, '#D97706');
  } else if (player.dir === 'left') {
    drawPixelRect(ctx, cx - 6, cy - 8, 3, 3, '#0F172A');
    drawPixelRect(ctx, cx + 2, cy - 12, 6, 6, '#D97706');
  } else {
    drawPixelRect(ctx, cx + 3, cy - 8, 3, 3, '#0F172A');
    drawPixelRect(ctx, cx - 8, cy - 12, 6, 6, '#D97706');
  }

  // Sword in front for down/left/right
  if (player.dir !== 'up') {
    drawSword(ctx, player, cx, cy);
  }
}

export function renderRoomLayer(
  ctx: CanvasRenderingContext2D,
  room: RoomState,
  palette: WorldPalette,
  timeSec: number,
  hasKey: boolean,
  offsetX = 0,
  offsetY = 0,
): void {
  ctx.save();
  ctx.translate(Math.round(offsetX), Math.round(offsetY));

  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLS; col++) {
      drawTile(ctx, room.tiles[row][col], col, row, palette, timeSec, hasKey);
    }
  }

  for (const chest of room.chests) {
    drawChest(ctx, chest, timeSec);
  }

  for (const pickup of room.pickups) {
    drawPickup(ctx, pickup, timeSec);
  }

  for (const enemy of room.enemies) {
    drawEnemy(ctx, enemy, palette, timeSec);
  }

  ctx.restore();
}

export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  state: GameRunState,
  palette: WorldPalette,
  timeSec: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  if (state.shakeTimer > 0) {
    const mag = 5;
    ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
  }

  const hasKey = state.player.keys > 0;

  if (state.transition) {
    const tr = state.transition;
    const fromRoom = state.rooms[`${tr.fromRx},${tr.fromRy}`];
    const toRoom = state.rooms[`${tr.toRx},${tr.toRy}`];
    const p = tr.progress;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    let fromX = 0;
    let fromY = 0;
    let toX = 0;
    let toY = 0;

    if (tr.dir === 'right') {
      fromX = -w * p;
      toX = w * (1 - p);
    } else if (tr.dir === 'left') {
      fromX = w * p;
      toX = -w * (1 - p);
    } else if (tr.dir === 'down') {
      fromY = -h * p;
      toY = h * (1 - p);
    } else if (tr.dir === 'up') {
      fromY = h * p;
      toY = -h * (1 - p);
    }

    if (fromRoom) renderRoomLayer(ctx, fromRoom, palette, timeSec, hasKey, fromX, fromY);
    if (toRoom) renderRoomLayer(ctx, toRoom, palette, timeSec, hasKey, toX, toY);
    ctx.restore();
    return;
  }

  const room = state.rooms[`${state.currentRx},${state.currentRy}`];
  renderRoomLayer(ctx, room, palette, timeSec, hasKey);

  // Draw player
  drawPlayer(ctx, state.player, timeSec);

  // Draw particles
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    drawPixelRect(ctx, pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size, pt.color);
  }
  ctx.globalAlpha = 1;

  // Draw floating texts
  ctx.font = '900 14px "M PLUS Rounded 1c", sans-serif';
  ctx.textAlign = 'center';
  for (const ft of state.floatingTexts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
    ctx.fillStyle = '#0F172A';
    ctx.fillText(ft.text, Math.round(ft.x) + 1.5, Math.round(ft.y) + 1.5);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function getDirectionVector(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case 'up':
      return { dx: 0, dy: -1 };
    case 'down':
      return { dx: 0, dy: 1 };
    case 'left':
      return { dx: -1, dy: 0 };
    case 'right':
      return { dx: 1, dy: 0 };
  }
}
