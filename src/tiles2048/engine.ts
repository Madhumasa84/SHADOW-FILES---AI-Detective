export type Direction2048 = 'up' | 'down' | 'left' | 'right';
export type GridSize2048 = 4 | 5;

export interface Tile2048 {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
}

export interface Snapshot2048 {
  grid: (Tile2048 | null)[][];
  score: number;
  moves: number;
  highestTile: number;
}

export interface State2048 {
  size: GridSize2048;
  grid: (Tile2048 | null)[][];
  score: number;
  moves: number;
  highestTile: number;
  nextTileId: number;
  wonMilestone: boolean;
  keepGoing: boolean;
  isGameOver: boolean;
  undosRemaining: number;
  history: Snapshot2048[];
  lastGain: number;
  lastMergedMax: number;
}

export interface Records2048 {
  bestScore4: number;
  bestScore5: number;
  highestTile: number;
  gamesPlayed: number;
  wins2048: number;
}

const STORAGE_KEY_2048 = 'midnight_noir_2048_records_v1';

function createEmptyGrid(size: GridSize2048): (Tile2048 | null)[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function cloneGrid(grid: (Tile2048 | null)[][]): (Tile2048 | null)[][] {
  return grid.map((row) =>
    row.map((cell) => (cell ? { ...cell, isNew: false, isMerged: false } : null))
  );
}

export function getEmptyCells(grid: (Tile2048 | null)[][]): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!grid[r][c]) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

export function spawnRandomTile(
  state: State2048,
  rng: () => number = Math.random
): State2048 {
  const empty = getEmptyCells(state.grid);
  if (empty.length === 0) return state;

  const chosen = empty[Math.floor(rng() * empty.length)];
  const value = rng() < 0.9 ? 2 : 4;
  const nextGrid = state.grid.map((row) => row.slice());
  nextGrid[chosen.row][chosen.col] = {
    id: state.nextTileId,
    value,
    row: chosen.row,
    col: chosen.col,
    isNew: true,
    isMerged: false,
  };

  return {
    ...state,
    grid: nextGrid,
    nextTileId: state.nextTileId + 1,
    highestTile: Math.max(state.highestTile, value),
  };
}

export function createInitial2048State(
  size: GridSize2048 = 4,
  rng: () => number = Math.random
): State2048 {
  let state: State2048 = {
    size,
    grid: createEmptyGrid(size),
    score: 0,
    moves: 0,
    highestTile: 0,
    nextTileId: 1,
    wonMilestone: false,
    keepGoing: false,
    isGameOver: false,
    undosRemaining: 3,
    history: [],
    lastGain: 0,
    lastMergedMax: 0,
  };
  state = spawnRandomTile(state, rng);
  state = spawnRandomTile(state, rng);
  return state;
}

export function hasValidMoves2048(grid: (Tile2048 | null)[][]): boolean {
  const n = grid.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = grid[r][c];
      if (!cell) return true;
      if (r + 1 < n && grid[r + 1][c]?.value === cell.value) return true;
      if (c + 1 < n && grid[r][c + 1]?.value === cell.value) return true;
    }
  }
  return false;
}

function slideLineLeft(
  line: (Tile2048 | null)[],
  startTileId: number
): {
  result: (Tile2048 | null)[];
  moved: boolean;
  gain: number;
  mergedMax: number;
  nextTileId: number;
} {
  const size = line.length;
  const compact: Tile2048[] = [];
  for (let i = 0; i < size; i++) {
    const cell = line[i];
    if (cell) compact.push({ ...cell, isNew: false, isMerged: false });
  }

  const merged: (Tile2048 | null)[] = [];
  let gain = 0;
  let mergedMax = 0;
  let nextTileId = startTileId;
  let i = 0;
  while (i < compact.length) {
    if (i + 1 < compact.length && compact[i].value === compact[i + 1].value) {
      const val = compact[i].value * 2;
      gain += val;
      if (val > mergedMax) mergedMax = val;
      merged.push({
        id: nextTileId++,
        value: val,
        row: 0,
        col: 0,
        isNew: false,
        isMerged: true,
      });
      i += 2;
    } else {
      merged.push(compact[i]);
      i += 1;
    }
  }

  while (merged.length < size) {
    merged.push(null);
  }

  let moved = false;
  for (let idx = 0; idx < size; idx++) {
    const prev = line[idx];
    const curr = merged[idx];
    if ((prev === null) !== (curr === null)) {
      moved = true;
      break;
    }
    if (prev && curr && (prev.id !== curr.id || prev.value !== curr.value)) {
      moved = true;
      break;
    }
  }

  return { result: merged, moved, gain, mergedMax, nextTileId };
}

export function move2048(
  state: State2048,
  direction: Direction2048,
  rng: () => number = Math.random
): { state: State2048; moved: boolean } {
  if (state.isGameOver) return { state, moved: false };
  if (state.wonMilestone && !state.keepGoing) return { state, moved: false };

  const n = state.size;
  const nextGrid = createEmptyGrid(n);
  let movedAny = false;
  let totalGain = 0;
  let maxMerged = 0;
  let nextTileId = state.nextTileId;

  for (let idx = 0; idx < n; idx++) {
    const line: (Tile2048 | null)[] = [];
    for (let step = 0; step < n; step++) {
      if (direction === 'left') line.push(state.grid[idx][step]);
      else if (direction === 'right') line.push(state.grid[idx][n - 1 - step]);
      else if (direction === 'up') line.push(state.grid[step][idx]);
      else line.push(state.grid[n - 1 - step][idx]);
    }

    const slid = slideLineLeft(line, nextTileId);
    nextTileId = slid.nextTileId;
    if (slid.moved) movedAny = true;
    totalGain += slid.gain;
    if (slid.mergedMax > maxMerged) maxMerged = slid.mergedMax;

    for (let step = 0; step < n; step++) {
      const tile = slid.result[step];
      let r = 0;
      let c = 0;
      if (direction === 'left') {
        r = idx;
        c = step;
      } else if (direction === 'right') {
        r = idx;
        c = n - 1 - step;
      } else if (direction === 'up') {
        r = step;
        c = idx;
      } else {
        r = n - 1 - step;
        c = idx;
      }
      nextGrid[r][c] = tile ? { ...tile, row: r, col: c } : null;
    }
  }

  if (!movedAny) {
    return { state, moved: false };
  }

  const prevSnapshot: Snapshot2048 = {
    grid: cloneGrid(state.grid),
    score: state.score,
    moves: state.moves,
    highestTile: state.highestTile,
  };

  let highest = state.highestTile;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = nextGrid[r][c]?.value ?? 0;
      if (v > highest) highest = v;
    }
  }

  let updated: State2048 = {
    ...state,
    grid: nextGrid,
    score: state.score + totalGain,
    moves: state.moves + 1,
    highestTile: highest,
    nextTileId,
    history: [...state.history.slice(-2), prevSnapshot],
    lastGain: totalGain,
    lastMergedMax: maxMerged,
  };

  updated = spawnRandomTile(updated, rng);

  const reached2048 = updated.highestTile >= 2048;
  const gameOver = !hasValidMoves2048(updated.grid);

  return {
    moved: true,
    state: {
      ...updated,
      wonMilestone: state.wonMilestone || reached2048,
      isGameOver: gameOver,
    },
  };
}

export function undo2048(state: State2048): State2048 {
  if (state.undosRemaining <= 0 || state.history.length === 0) return state;
  const prev = state.history[state.history.length - 1];
  return {
    ...state,
    grid: cloneGrid(prev.grid),
    score: prev.score,
    moves: prev.moves,
    highestTile: prev.highestTile,
    undosRemaining: state.undosRemaining - 1,
    history: state.history.slice(0, -1),
    isGameOver: false,
    lastGain: 0,
    lastMergedMax: 0,
  };
}

export function continueEndless2048(state: State2048): State2048 {
  return {
    ...state,
    keepGoing: true,
  };
}

export function load2048Records(): Records2048 {
  const fallback: Records2048 = {
    bestScore4: 0,
    bestScore5: 0,
    highestTile: 0,
    gamesPlayed: 0,
    wins2048: 0,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_2048);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Records2048>;
    return {
      bestScore4: typeof parsed.bestScore4 === 'number' ? parsed.bestScore4 : 0,
      bestScore5: typeof parsed.bestScore5 === 'number' ? parsed.bestScore5 : 0,
      highestTile: typeof parsed.highestTile === 'number' ? parsed.highestTile : 0,
      gamesPlayed: typeof parsed.gamesPlayed === 'number' ? parsed.gamesPlayed : 0,
      wins2048: typeof parsed.wins2048 === 'number' ? parsed.wins2048 : 0,
    };
  } catch {
    return fallback;
  }
}

export function save2048Progress(
  size: GridSize2048,
  score: number,
  highestTile: number,
  justFinished = false,
  justWon2048 = false
): Records2048 {
  const current = load2048Records();
  const next: Records2048 = {
    bestScore4: size === 4 ? Math.max(current.bestScore4, score) : current.bestScore4,
    bestScore5: size === 5 ? Math.max(current.bestScore5, score) : current.bestScore5,
    highestTile: Math.max(current.highestTile, highestTile),
    gamesPlayed: current.gamesPlayed + (justFinished ? 1 : 0),
    wins2048: current.wins2048 + (justWon2048 ? 1 : 0),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_2048, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}
