import type { DeckId } from '../data/decks';
import type { RoomTemplate, WorldPalette, WorldTheme } from './types';

/**
 * Connected 3x2 room layout (3-tile-wide doorways at cols 6-8 & rows 4-6 for smooth kid-friendly navigation):
 *
 *  (0,0) かぎの へや  <──> (1,0) しんでん まえ  ══L══> (2,0) ボスの しんでん
 *     ^                       ^
 *     v                       v
 *  (0,1) はじまりの ひろば <──> (1,1) たからの もり <──> (2,1) ひみつの いずみ
 */

const ROOM_0_1_START_LAYOUT = [
  '######,,,######',
  '#.....,,,.....#',
  '#..B..,,,..B..#',
  '#.....,,,.....#',
  '#....,,,,,,,,,,',
  '#....,,,,,,,,,,',
  '#....,,,,,,,,,,',
  '#..B.......B..#',
  '#..~~.....~~..#',
  '#.............#',
  '###############',
] as const;

const ROOM_0_0_KEY_LAYOUT = [
  '###############',
  '#T...........T#',
  '#...##...##...#',
  '#.............#',
  '#...B...,,,,,,,',
  '#.......,,,,,,,',
  '#...B...,,,,,,,',
  '#.............#',
  '#..~~..,,,~~..#',
  '#......,,,....#',
  '######,,,######',
] as const;

const ROOM_1_1_TREASURE_LAYOUT = [
  '######,,,######',
  '#.....,,,.....#',
  '#..B..,,,..B..#',
  '#.....,,,.....#',
  ',,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,',
  '#..B..,,,..B..#',
  '#..~~.....~~..#',
  '#.............#',
  '###############',
] as const;

const ROOM_2_1_SPRING_LAYOUT = [
  '###############',
  '#T....~~~....T#',
  '#....~FFF~....#',
  '#.....,,,.....#',
  ',,,,,,,,,..B..#',
  ',,,,,,,,,.....#',
  ',,,,,,,,,..B..#',
  '#.............#',
  '#....B...B....#',
  '#.............#',
  '###############',
] as const;

const ROOM_1_0_GATE_LAYOUT = [
  '###############',
  '#T...........T#',
  '#...B.....B...#',
  '#.............#',
  ',,,,,,,,,,...##',
  ',,,,,,,,,,,,,,L',
  ',,,,,,,,,,...##',
  '#.............#',
  '#...B..,,,B...#',
  '#......,,,....#',
  '######,,,######',
] as const;

const ROOM_2_0_BOSS_LAYOUT = [
  '###############',
  '#T...........T#',
  '#.............#',
  '#.............#',
  '##...........##',
  ',,,...........#',
  '##...........##',
  '#.............#',
  '#.............#',
  '#T...........T#',
  '###############',
] as const;

function buildWorldRooms(
  enemyA: { kind: 'slime' | 'octorok' | 'bat' | 'skeleton'; name: string },
  enemyB: { kind: 'slime' | 'octorok' | 'bat' | 'skeleton'; name: string },
  bossName: string,
  roomNames: [string, string, string, string, string, string],
): RoomTemplate[] {
  return [
    {
      rx: 0,
      ry: 1,
      name: roomNames[0],
      layout: ROOM_0_1_START_LAYOUT,
      enemies: [
        { id: 'e-start-1', kind: enemyA.kind, name: enemyA.name, col: 10, row: 3, hp: 1, speed: 46 },
      ],
      chests: [],
      pickups: [
        { id: 'p-start-1', col: 3, row: 5, kind: 'rupeeGreen' },
        { id: 'p-start-2', col: 12, row: 7, kind: 'rupeeGreen' },
      ],
    },
    {
      rx: 0,
      ry: 0,
      name: roomNames[1],
      layout: ROOM_0_0_KEY_LAYOUT,
      enemies: [
        { id: 'e-key-1', kind: enemyA.kind, name: enemyA.name, col: 4, row: 5, hp: 1, speed: 50 },
        { id: 'e-key-2', kind: enemyB.kind, name: enemyB.name, col: 10, row: 3, hp: 1, speed: 54 },
      ],
      chests: [
        {
          id: 'c-key',
          col: 7,
          row: 2,
          reward: 'key',
          label: 'しんでんの かぎ',
        },
      ],
      pickups: [{ id: 'p-key-1', col: 12, row: 7, kind: 'rupeeGreen' }],
    },
    {
      rx: 1,
      ry: 1,
      name: roomNames[2],
      layout: ROOM_1_1_TREASURE_LAYOUT,
      enemies: [
        { id: 'e-mid-1', kind: enemyA.kind, name: enemyA.name, col: 5, row: 3, hp: 1, speed: 50 },
        { id: 'e-mid-2', kind: enemyB.kind, name: enemyB.name, col: 10, row: 7, hp: 1, speed: 54 },
      ],
      chests: [
        {
          id: 'c-rupee',
          col: 12,
          row: 2,
          reward: 'bigRupee',
          label: 'ビッグルピー',
        },
      ],
      pickups: [
        { id: 'p-mid-1', col: 7, row: 5, kind: 'rupeeBlue' },
        { id: 'p-mid-2', col: 2, row: 7, kind: 'rupeeGreen' },
      ],
    },
    {
      rx: 2,
      ry: 1,
      name: roomNames[3],
      layout: ROOM_2_1_SPRING_LAYOUT,
      enemies: [
        { id: 'e-spr-1', kind: enemyB.kind, name: enemyB.name, col: 4, row: 7, hp: 1, speed: 52 },
        { id: 'e-spr-2', kind: enemyA.kind, name: enemyA.name, col: 10, row: 5, hp: 1, speed: 50 },
      ],
      chests: [
        {
          id: 'c-sword',
          col: 12,
          row: 8,
          reward: 'flameSword',
          label: 'ほのおの けん',
        },
      ],
      pickups: [{ id: 'p-spr-1', col: 7, row: 8, kind: 'rupeeBlue' }],
    },
    {
      rx: 1,
      ry: 0,
      name: roomNames[4],
      layout: ROOM_1_0_GATE_LAYOUT,
      enemies: [
        { id: 'e-gate-1', kind: enemyB.kind, name: enemyB.name, col: 5, row: 3, hp: 1, speed: 56 },
        { id: 'e-gate-2', kind: enemyA.kind, name: enemyA.name, col: 10, row: 7, hp: 1, speed: 54 },
      ],
      chests: [],
      pickups: [
        { id: 'p-gate-1', col: 3, row: 7, kind: 'heart' },
        { id: 'p-gate-2', col: 11, row: 3, kind: 'rupeeBlue' },
      ],
    },
    {
      rx: 2,
      ry: 0,
      name: roomNames[5],
      layout: ROOM_2_0_BOSS_LAYOUT,
      enemies: [
        { id: 'e-boss', kind: 'boss', name: bossName, col: 9, row: 5, hp: 3, speed: 56 },
      ],
      chests: [],
      pickups: [],
      isBossRoom: true,
    },
  ];
}

const PALETTES: Record<DeckId, WorldPalette> = {
  tashizan1: {
    ground: '#70B85A',
    groundAlt: '#64AB4F',
    path: '#E7C98A',
    pathDot: '#D6B472',
    wall: '#2D6A35',
    wallHighlight: '#47944F',
    wallShadow: '#1B4421',
    water: '#3692D9',
    waterFoam: '#8BD3FF',
    bush: '#3F8E3B',
    bushHighlight: '#7CE065',
    accent: '#FFD166',
    bossPrimary: '#22C55E',
    bossSecondary: '#FACC15',
  },
  tashizan2: {
    ground: '#B96A4B',
    groundAlt: '#A85E41',
    path: '#E5B484',
    pathDot: '#CC9866',
    wall: '#6B2F23',
    wallHighlight: '#964736',
    wallShadow: '#421B14',
    water: '#F97316',
    waterFoam: '#FDE047',
    bush: '#9A4A28',
    bushHighlight: '#EA7B3C',
    accent: '#FF9F43',
    bossPrimary: '#EF4444',
    bossSecondary: '#FDE047',
  },
  hikizan1: {
    ground: '#5A89A8',
    groundAlt: '#4F7B99',
    path: '#C7DCE8',
    pathDot: '#A8C4D6',
    wall: '#27496D',
    wallHighlight: '#3E6E9E',
    wallShadow: '#162C45',
    water: '#2272B8',
    waterFoam: '#99E2FF',
    bush: '#2A7F8E',
    bushHighlight: '#67D5E0',
    accent: '#38BDF8',
    bossPrimary: '#06B6D4',
    bossSecondary: '#E0F2FE',
  },
  hikizan2: {
    ground: '#5A4F7A',
    groundAlt: '#50456E',
    path: '#9A8CC2',
    pathDot: '#8274AB',
    wall: '#2E2547',
    wallHighlight: '#4B3E70',
    wallShadow: '#1B152B',
    water: '#312E81',
    waterFoam: '#A78BFA',
    bush: '#4C3D7A',
    bushHighlight: '#9F86E8',
    accent: '#C084FC',
    bossPrimary: '#6366F1',
    bossSecondary: '#F472B6',
  },
};

export const WORLD_THEMES: Record<DeckId, WorldTheme> = {
  tashizan1: {
    deckId: 'tashizan1',
    worldName: 'みどりの もり',
    subtitle: 'たしざん 1 の しんでん',
    bossName: 'キングスライム',
    bossKindLabel: 'もりの ぬし',
    palette: PALETTES.tashizan1,
    startRoom: { rx: 0, ry: 1, col: 7, row: 7 },
    rooms: buildWorldRooms(
      { kind: 'slime', name: 'もりスライム' },
      { kind: 'octorok', name: 'あかオクタ' },
      'キングスライム',
      [
        'はじまりの ひろば',
        'かぎの もり',
        'たからの こうち',
        'ようせいの いずみ',
        'しんでん まえ',
        'キングの しんでん',
      ],
    ),
  },
  tashizan2: {
    deckId: 'tashizan2',
    worldName: 'あかい かざん',
    subtitle: 'たしざん 2 の しんでん',
    bossName: 'ファイアドラゴン',
    bossKindLabel: 'ほのおの ぬし',
    palette: PALETTES.tashizan2,
    startRoom: { rx: 0, ry: 1, col: 7, row: 7 },
    rooms: buildWorldRooms(
      { kind: 'bat', name: 'ファイアコウモリ' },
      { kind: 'slime', name: 'マグマスライム' },
      'ファイアドラゴン',
      [
        'かざんの ふもと',
        'かぎの どうくつ',
        'ほのおの ひろば',
        'いやしの おんせん',
        'りゅうの もん',
        'ドラゴンの す',
      ],
    ),
  },
  hikizan1: {
    deckId: 'hikizan1',
    worldName: 'みずの しんでん',
    subtitle: 'ひきざん 1 の しんでん',
    bossName: 'アクアゴーレム',
    bossKindLabel: 'みずの まもりがみ',
    palette: PALETTES.hikizan1,
    startRoom: { rx: 0, ry: 1, col: 7, row: 7 },
    rooms: buildWorldRooms(
      { kind: 'octorok', name: 'アクアオクタ' },
      { kind: 'slime', name: 'ぷるぷるスライム' },
      'アクアゴーレム',
      [
        'みずべの いりぐち',
        'かぎの さいだん',
        'しずくの へや',
        'ひみつの いずみ',
        'みずの とびら',
        'ゴーレムの ま',
      ],
    ),
  },
  hikizan2: {
    deckId: 'hikizan2',
    worldName: 'ほしの だんじょん',
    subtitle: 'ひきざん 2 の しんでん',
    bossName: 'あんこくナイト',
    bossKindLabel: 'だんじょんの おう',
    palette: PALETTES.hikizan2,
    startRoom: { rx: 0, ry: 1, col: 7, row: 7 },
    rooms: buildWorldRooms(
      { kind: 'skeleton', name: 'ほねナイト' },
      { kind: 'bat', name: 'シャドウコウモリ' },
      'あんこくナイト',
      [
        'ほしぞらの もん',
        'かぎの ほうもつこ',
        'ぎんがの ろうか',
        'ひかりの いずみ',
        'おうの とびら',
        'あんこくの ま',
      ],
    ),
  },
};
