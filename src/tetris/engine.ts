export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface ActivePiece {
  type: TetrominoType;
  rotation: number; // 0..3
  row: number;
  col: number;
}

export interface TetrisWorld {
  cols: number;
  rows: number;
  board: (TetrominoType | null)[][];
  active: ActivePiece;
  hold: TetrominoType | null;
  holdUsedThisTurn: boolean;
  bag: TetrominoType[];
  nextQueue: TetrominoType[];
  score: number;
  lines: number;
  level: number;
  startLevel: number;
  combo: number;
  backToBack: boolean;
  dropAccumulatorMs: number;
  lockAccumulatorMs: number;
  isGameOver: boolean;
  lastCallout: string | null;
  lastCalloutTimerMs: number;
  clearFlashTimerMs: number;
  shakeTrauma: number;
  events: {
    moved: boolean;
    rotated: boolean;
    hardDropped: boolean;
    locked: boolean;
    linesCleared: number;
    gameOver: boolean;
  };
}

export interface TetrisRecords {
  bestScore: number;
  bestLines: number;
  gamesPlayed: number;
}

const TETRIS_STORAGE_KEY = 'midnight_noir_tetris_records_v1';

export const TETROMINO_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export const TETROMINO_COLORS: Record<
  TetrominoType,
  { fill: string; highlight: string; shadow: string }
> = {
  I: { fill: '#4FB8D9', highlight: '#9AE4FA', shadow: '#266B85' },
  O: { fill: '#EBB556', highlight: '#FCE1A6', shadow: '#9B6F21' },
  T: { fill: '#A26EE8', highlight: '#D5B8FF', shadow: '#5B3494' },
  S: { fill: '#4CC28A', highlight: '#9BF0C7', shadow: '#22754E' },
  Z: { fill: '#DE5858', highlight: '#F8A3A3', shadow: '#8C2727' },
  J: { fill: '#5784E8', highlight: '#A8C4FF', shadow: '#284999' },
  L: { fill: '#E58A42', highlight: '#FFC594', shadow: '#944F18' },
};

// Local [row, col] offsets inside a 4x4 bounding box for each rotation 0..3
const SHAPES: Record<TetrominoType, Array<Array<[number, number]>>> = {
  I: [
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  ],
  O: [
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  S: [
    [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  Z: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 2],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
  ],
  J: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
  ],
  L: [
    [
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  ],
};

export function getPieceCells(piece: ActivePiece): Array<[number, number]> {
  const shape = SHAPES[piece.type][((piece.rotation % 4) + 4) % 4];
  return shape.map(([dr, dc]) => [piece.row + dr, piece.col + dc]);
}

export function getPreviewShape(type: TetrominoType): Array<[number, number]> {
  return SHAPES[type][0];
}

export function shuffleBag(rng: () => number = Math.random): TetrominoType[] {
  const arr = [...TETROMINO_TYPES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function popFromQueue(world: { bag: TetrominoType[]; nextQueue: TetrominoType[] }, rng: () => number): TetrominoType {
  while (world.nextQueue.length < 4) {
    if (world.bag.length === 0) {
      world.bag = shuffleBag(rng);
    }
    world.nextQueue.push(world.bag.pop()!);
  }
  const piece = world.nextQueue.shift()!;
  if (world.bag.length === 0) {
    world.bag = shuffleBag(rng);
  }
  world.nextQueue.push(world.bag.pop()!);
  return piece;
}

export function getGravityMsForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(15, level));
  return Math.max(75, Math.round(780 * Math.pow(0.84, clamped - 1)));
}

export function canPlacePiece(
  board: (TetrominoType | null)[][],
  piece: ActivePiece
): boolean {
  const rows = board.length;
  const cols = board[0].length;
  const cells = getPieceCells(piece);
  for (const [r, c] of cells) {
    if (c < 0 || c >= cols || r >= rows) return false;
    if (r >= 0 && board[r][c] !== null) return false;
  }
  return true;
}

export function getGhostRow(board: (TetrominoType | null)[][], active: ActivePiece): number {
  let row = active.row;
  while (canPlacePiece(board, { ...active, row: row + 1 })) {
    row += 1;
  }
  return row;
}

export function createInitialTetrisWorld(
  startLevel = 1,
  rng: () => number = Math.random
): TetrisWorld {
  const cols = 10;
  const rows = 20;
  const board: (TetrominoType | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
  const bag = shuffleBag(rng);
  const nextQueue: TetrominoType[] = [];
  const stateBag = { bag, nextQueue };
  const firstType = popFromQueue(stateBag, rng);

  const clampedStart = Math.max(1, Math.min(12, Math.round(startLevel)));

  return {
    cols,
    rows,
    board,
    active: { type: firstType, rotation: 0, row: 0, col: 3 },
    hold: null,
    holdUsedThisTurn: false,
    bag: stateBag.bag,
    nextQueue: stateBag.nextQueue,
    score: 0,
    lines: 0,
    level: clampedStart,
    startLevel: clampedStart,
    combo: -1,
    backToBack: false,
    dropAccumulatorMs: 0,
    lockAccumulatorMs: 0,
    isGameOver: false,
    lastCallout: null,
    lastCalloutTimerMs: 0,
    clearFlashTimerMs: 0,
    shakeTrauma: 0,
    events: {
      moved: false,
      rotated: false,
      hardDropped: false,
      locked: false,
      linesCleared: 0,
      gameOver: false,
    },
  };
}

export function clearTetrisEvents(world: TetrisWorld): void {
  world.events.moved = false;
  world.events.rotated = false;
  world.events.hardDropped = false;
  world.events.locked = false;
  world.events.linesCleared = 0;
  world.events.gameOver = false;
}

export function moveTetrisPiece(world: TetrisWorld, dRow: number, dCol: number): boolean {
  if (world.isGameOver) return false;
  const candidate: ActivePiece = {
    ...world.active,
    row: world.active.row + dRow,
    col: world.active.col + dCol,
  };
  if (!canPlacePiece(world.board, candidate)) return false;

  world.active = candidate;
  if (dCol !== 0) {
    world.events.moved = true;
    world.lockAccumulatorMs = Math.max(0, world.lockAccumulatorMs - 140);
  }
  return true;
}

export function rotateTetrisPiece(world: TetrisWorld, dir: 1 | -1 = 1): boolean {
  if (world.isGameOver) return false;
  const nextRot = ((world.active.rotation + dir) % 4 + 4) % 4;
  const kicks: Array<[number, number]> =
    world.active.type === 'I'
      ? [
          [0, 0],
          [0, -1],
          [0, 1],
          [0, -2],
          [0, 2],
          [-1, 0],
        ]
      : [
          [0, 0],
          [0, -1],
          [0, 1],
          [-1, 0],
          [-1, -1],
          [-1, 1],
          [1, 0],
        ];

  for (const [dr, dc] of kicks) {
    const candidate: ActivePiece = {
      ...world.active,
      rotation: nextRot,
      row: world.active.row + dr,
      col: world.active.col + dc,
    };
    if (canPlacePiece(world.board, candidate)) {
      world.active = candidate;
      world.events.rotated = true;
      world.lockAccumulatorMs = Math.max(0, world.lockAccumulatorMs - 160);
      return true;
    }
  }
  return false;
}

export function holdTetrisPiece(
  world: TetrisWorld,
  rng: () => number = Math.random
): boolean {
  if (world.isGameOver || world.holdUsedThisTurn) return false;
  const currentType = world.active.type;
  const nextType = world.hold ?? popFromQueue(world, rng);
  world.hold = currentType;
  world.holdUsedThisTurn = true;
  world.active = { type: nextType, rotation: 0, row: 0, col: 3 };
  world.dropAccumulatorMs = 0;
  world.lockAccumulatorMs = 0;
  world.events.moved = true;
  if (!canPlacePiece(world.board, world.active)) {
    world.isGameOver = true;
    world.events.gameOver = true;
  }
  return true;
}

export function lockActivePiece(
  world: TetrisWorld,
  rng: () => number = Math.random
): void {
  const cells = getPieceCells(world.active);
  for (const [r, c] of cells) {
    if (r >= 0 && r < world.rows && c >= 0 && c < world.cols) {
      world.board[r][c] = world.active.type;
    }
  }

  // Detect and clear completed rows
  let cleared = 0;
  const remaining: (TetrominoType | null)[][] = [];
  for (let r = 0; r < world.rows; r++) {
    if (world.board[r].every((cell) => cell !== null)) {
      cleared += 1;
    } else {
      remaining.push(world.board[r]);
    }
  }

  while (remaining.length < world.rows) {
    remaining.unshift(Array.from({ length: world.cols }, () => null));
  }
  world.board = remaining;

  if (cleared > 0) {
    world.lines += cleared;
    world.combo += 1;
    const basePts = [0, 100, 300, 500, 800][cleared] ?? 800;
    const isTetris = cleared === 4;
    const b2bMult = isTetris && world.backToBack ? 1.5 : 1;
    const comboBonus = world.combo > 0 ? world.combo * 50 * world.level : 0;
    world.score += Math.round(basePts * world.level * b2bMult) + comboBonus;
    world.backToBack = isTetris;
    world.level = Math.min(15, world.startLevel + Math.floor(world.lines / 10));
    world.events.linesCleared = cleared;
    world.clearFlashTimerMs = 240;
    world.shakeTrauma = Math.max(world.shakeTrauma, cleared >= 4 ? 0.65 : 0.25);

    const names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'];
    const baseLabel = names[cleared] ?? 'CLEAR!';
    world.lastCallout = world.combo > 0 ? `${baseLabel} · ${world.combo + 1}× COMBO` : baseLabel;
    world.lastCalloutTimerMs = 1350;
  } else {
    world.combo = -1;
  }

  world.events.locked = true;

  // Spawn next tetromino
  const nextType = popFromQueue(world, rng);
  world.active = { type: nextType, rotation: 0, row: 0, col: 3 };
  world.holdUsedThisTurn = false;
  world.dropAccumulatorMs = 0;
  world.lockAccumulatorMs = 0;

  if (!canPlacePiece(world.board, world.active)) {
    world.isGameOver = true;
    world.events.gameOver = true;
    world.shakeTrauma = 0.7;
  }
}

export function hardDropTetrisPiece(
  world: TetrisWorld,
  rng: () => number = Math.random
): number {
  if (world.isGameOver) return 0;
  const targetRow = getGhostRow(world.board, world.active);
  const dropped = Math.max(0, targetRow - world.active.row);
  world.active.row = targetRow;
  world.score += dropped * 2;
  world.events.hardDropped = true;
  world.shakeTrauma = Math.max(world.shakeTrauma, 0.16);
  lockActivePiece(world, rng);
  return dropped;
}

export function softDropTetrisPiece(world: TetrisWorld): boolean {
  if (moveTetrisPiece(world, 1, 0)) {
    world.score += 1;
    world.dropAccumulatorMs = 0;
    return true;
  }
  return false;
}

export function stepTetrisWorld(
  world: TetrisWorld,
  rawDtSec: number,
  rng: () => number = Math.random
): void {
  const dt = Math.min(Math.max(rawDtSec, 0), 0.05);
  const dtMs = dt * 1000;

  world.shakeTrauma = Math.max(0, world.shakeTrauma - dt * 2.6);
  if (world.clearFlashTimerMs > 0) {
    world.clearFlashTimerMs = Math.max(0, world.clearFlashTimerMs - dtMs);
  }
  if (world.lastCalloutTimerMs > 0) {
    world.lastCalloutTimerMs = Math.max(0, world.lastCalloutTimerMs - dtMs);
    if (world.lastCalloutTimerMs === 0) {
      world.lastCallout = null;
    }
  }

  if (world.isGameOver) return;

  const grounded = !canPlacePiece(world.board, {
    ...world.active,
    row: world.active.row + 1,
  });

  if (grounded) {
    world.lockAccumulatorMs += dtMs;
    if (world.lockAccumulatorMs >= 420) {
      lockActivePiece(world, rng);
    }
    return;
  }

  world.lockAccumulatorMs = 0;
  world.dropAccumulatorMs += dtMs;
  const gravityMs = getGravityMsForLevel(world.level);
  while (world.dropAccumulatorMs >= gravityMs && !world.isGameOver) {
    world.dropAccumulatorMs -= gravityMs;
    if (!moveTetrisPiece(world, 1, 0)) {
      break;
    }
  }
}

export function loadTetrisRecords(): TetrisRecords {
  const fallback: TetrisRecords = { bestScore: 0, bestLines: 0, gamesPlayed: 0 };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(TETRIS_STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<TetrisRecords>;
    return {
      bestScore: typeof p.bestScore === 'number' ? p.bestScore : 0,
      bestLines: typeof p.bestLines === 'number' ? p.bestLines : 0,
      gamesPlayed: typeof p.gamesPlayed === 'number' ? p.gamesPlayed : 0,
    };
  } catch {
    return fallback;
  }
}

export function saveTetrisRecord(score: number, lines: number): TetrisRecords {
  const cur = loadTetrisRecords();
  const next: TetrisRecords = {
    bestScore: Math.max(cur.bestScore, score),
    bestLines: Math.max(cur.bestLines, lines),
    gamesPlayed: cur.gamesPlayed + 1,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(TETRIS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}
