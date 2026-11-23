export type MinesweeperPreset = 'sector9' | 'district12' | 'vault16';

export interface MinesweeperConfig {
  id: MinesweeperPreset;
  label: string;
  rows: number;
  cols: number;
  mines: number;
}

export const MINESWEEPER_CONFIGS: Record<MinesweeperPreset, MinesweeperConfig> = {
  sector9: { id: 'sector9', label: '9×9 · 10 Mines', rows: 9, cols: 9, mines: 10 },
  district12: { id: 'district12', label: '12×12 · 22 Mines', rows: 12, cols: 12, mines: 22 },
  vault16: { id: 'vault16', label: '16×12 · 32 Mines', rows: 12, cols: 16, mines: 32 },
};

export interface MineCell {
  row: number;
  col: number;
  isMine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
  exploded?: boolean;
}

export interface MinesweeperHint {
  row: number;
  col: number;
  action: 'reveal' | 'flag';
  certain: boolean;
  reason: string;
}

export interface MinesweeperState {
  preset: MinesweeperPreset;
  rows: number;
  cols: number;
  mineCount: number;
  cells: MineCell[][];
  initialized: boolean;
  revealedSafe: number;
  flagsPlaced: number;
  status: 'playing' | 'won' | 'lost';
  hintsUsed: number;
}

export function createInitialMinesweeperState(preset: MinesweeperPreset = 'sector9'): MinesweeperState {
  const cfg = MINESWEEPER_CONFIGS[preset];
  const cells: MineCell[][] = Array.from({ length: cfg.rows }, (_, r) =>
    Array.from({ length: cfg.cols }, (_, c) => ({
      row: r,
      col: c,
      isMine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    }))
  );
  return {
    preset,
    rows: cfg.rows,
    cols: cfg.cols,
    mineCount: cfg.mines,
    cells,
    initialized: false,
    revealedSafe: 0,
    flagsPlaced: 0,
    status: 'playing',
    hintsUsed: 0,
  };
}

function getNeighbors(rows: number, cols: number, r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
    }
  }
  return out;
}

function cloneCells(cells: MineCell[][]): MineCell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell })));
}

function placeMinesSafely(
  cells: MineCell[][],
  rows: number,
  cols: number,
  mineCount: number,
  safeR: number,
  safeC: number
): void {
  const pool: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Keep clicked cell and its 3x3 neighborhood mine-free for a clean opening
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      pool.push([r, c]);
    }
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const count = Math.min(mineCount, pool.length);
  for (let i = 0; i < count; i++) {
    const [mr, mc] = pool[i];
    cells[mr][mc].isMine = true;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r][c].isMine) continue;
      let adj = 0;
      for (const [nr, nc] of getNeighbors(rows, cols, r, c)) {
        if (cells[nr][nc].isMine) adj += 1;
      }
      cells[r][c].adjacent = adj;
    }
  }
}

export function revealMinesweeperCell(state: MinesweeperState, row: number, col: number): MinesweeperState {
  if (state.status !== 'playing') return state;
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return state;

  const target = state.cells[row][col];
  if (target.revealed || target.flagged) return state;

  const cells = cloneCells(state.cells);
  let initialized = state.initialized;
  if (!initialized) {
    placeMinesSafely(cells, state.rows, state.cols, state.mineCount, row, col);
    initialized = true;
  }

  if (cells[row][col].isMine) {
    cells[row][col].exploded = true;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (cells[r][c].isMine) cells[r][c].revealed = true;
      }
    }
    return {
      ...state,
      cells,
      initialized,
      status: 'lost',
    };
  }

  // BFS flood-fill for zero-adjacent cells
  const queue: Array<[number, number]> = [[row, col]];
  let revealedSafe = state.revealedSafe;

  while (queue.length > 0) {
    const [cr, cc] = queue.shift()!;
    const cell = cells[cr][cc];
    if (cell.revealed || cell.flagged || cell.isMine) continue;
    cell.revealed = true;
    revealedSafe += 1;
    if (cell.adjacent === 0) {
      for (const [nr, nc] of getNeighbors(state.rows, state.cols, cr, cc)) {
        if (!cells[nr][nc].revealed && !cells[nr][nc].flagged) {
          queue.push([nr, nc]);
        }
      }
    }
  }

  const totalSafe = state.rows * state.cols - state.mineCount;
  const won = revealedSafe >= totalSafe;
  if (won) {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (cells[r][c].isMine) cells[r][c].flagged = true;
      }
    }
  }

  return {
    ...state,
    cells,
    initialized,
    revealedSafe,
    flagsPlaced: won ? state.mineCount : state.flagsPlaced,
    status: won ? 'won' : 'playing',
  };
}

export function toggleMinesweeperFlag(state: MinesweeperState, row: number, col: number): MinesweeperState {
  if (state.status !== 'playing') return state;
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return state;
  const target = state.cells[row][col];
  if (target.revealed) return state;

  const cells = cloneCells(state.cells);
  cells[row][col].flagged = !target.flagged;
  const flagsPlaced = state.flagsPlaced + (cells[row][col].flagged ? 1 : -1);

  return {
    ...state,
    cells,
    flagsPlaced,
  };
}

export function chordMinesweeperCell(state: MinesweeperState, row: number, col: number): MinesweeperState {
  if (state.status !== 'playing') return state;
  const cell = state.cells[row]?.[col];
  if (!cell || !cell.revealed || cell.adjacent === 0) return state;

  const neighbors = getNeighbors(state.rows, state.cols, row, col);
  let flaggedAround = 0;
  for (const [nr, nc] of neighbors) {
    if (state.cells[nr][nc].flagged) flaggedAround += 1;
  }
  if (flaggedAround !== cell.adjacent) return state;

  let next = state;
  for (const [nr, nc] of neighbors) {
    if (!next.cells[nr][nc].revealed && !next.cells[nr][nc].flagged) {
      next = revealMinesweeperCell(next, nr, nc);
      if (next.status !== 'playing') break;
    }
  }
  return next;
}

interface Constraint {
  cells: Set<string>;
  minesLeft: number;
  origin: [number, number];
}

function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

function parseKey(k: string): [number, number] {
  const [r, c] = k.split(',').map(Number);
  return [r, c];
}

/**
 * Constraint-Satisfaction (CSP) Logical Hint Solver:
 * 1) Single-clue rules: remaining mines === 0 -> all hidden neighbors safe;
 *    remaining mines === hidden neighbors -> all hidden neighbors are mines.
 * 2) Subset elimination between overlapping frontier clues:
 *    if A ⊂ B and mines(B) - mines(A) === 0 -> B\A are provably safe;
 *    if mines(B) - mines(A) === |B\A| -> B\A are provably mines.
 * 3) Lowest-risk probabilistic frontier cell fallback if board requires a guess.
 */
export function findMinesweeperHint(state: MinesweeperState): MinesweeperHint | null {
  if (state.status !== 'playing') return null;

  if (!state.initialized) {
    const r = Math.floor(state.rows / 2);
    const c = Math.floor(state.cols / 2);
    return {
      row: r,
      col: c,
      action: 'reveal',
      certain: true,
      reason: 'First click is always guaranteed safe — opening the center maximizes clear space.',
    };
  }

  const constraints: Constraint[] = [];

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.cells[r][c];
      if (!cell.revealed || cell.adjacent === 0) continue;

      const hidden = new Set<string>();
      let flagged = 0;
      for (const [nr, nc] of getNeighbors(state.rows, state.cols, r, c)) {
        const nb = state.cells[nr][nc];
        if (nb.flagged) flagged += 1;
        else if (!nb.revealed) hidden.add(keyOf(nr, nc));
      }

      if (hidden.size === 0) continue;
      const minesLeft = cell.adjacent - flagged;

      if (minesLeft === 0) {
        const [hr, hc] = parseKey(Array.from(hidden)[0]);
        return {
          row: hr,
          col: hc,
          action: 'reveal',
          certain: true,
          reason: `Clue (${r + 1},${c + 1}) already has all ${cell.adjacent} mines flagged — (${hr + 1},${hc + 1}) is 100% safe.`,
        };
      }

      if (minesLeft === hidden.size) {
        const [hr, hc] = parseKey(Array.from(hidden)[0]);
        return {
          row: hr,
          col: hc,
          action: 'flag',
          certain: true,
          reason: `Clue (${r + 1},${c + 1}) needs ${minesLeft} mine${minesLeft > 1 ? 's' : ''} in ${hidden.size} hidden tile${hidden.size > 1 ? 's' : ''} — (${hr + 1},${hc + 1}) must be a mine.`,
        };
      }

      if (minesLeft > 0) {
        constraints.push({ cells: hidden, minesLeft, origin: [r, c] });
      }
    }
  }

  // Subset elimination across pairs of constraints
  for (let i = 0; i < constraints.length; i++) {
    for (let j = 0; j < constraints.length; j++) {
      if (i === j) continue;
      const a = constraints[i];
      const b = constraints[j];
      if (a.cells.size >= b.cells.size) continue;

      let isSubset = true;
      for (const k of a.cells) {
        if (!b.cells.has(k)) {
          isSubset = false;
          break;
        }
      }
      if (!isSubset) continue;

      const diff: string[] = [];
      for (const k of b.cells) {
        if (!a.cells.has(k)) diff.push(k);
      }
      const diffMines = b.minesLeft - a.minesLeft;

      if (diffMines === 0 && diff.length > 0) {
        const [hr, hc] = parseKey(diff[0]);
        return {
          row: hr,
          col: hc,
          action: 'reveal',
          certain: true,
          reason: `Subset deduction between clues (${a.origin[0] + 1},${a.origin[1] + 1}) and (${b.origin[0] + 1},${b.origin[1] + 1}) proves (${hr + 1},${hc + 1}) is safe.`,
        };
      }

      if (diffMines === diff.length && diff.length > 0) {
        const [hr, hc] = parseKey(diff[0]);
        return {
          row: hr,
          col: hc,
          action: 'flag',
          certain: true,
          reason: `Subset deduction between clues (${a.origin[0] + 1},${a.origin[1] + 1}) and (${b.origin[0] + 1},${b.origin[1] + 1}) proves (${hr + 1},${hc + 1}) is a mine.`,
        };
      }
    }
  }

  // Fallback: compute lowest estimated mine risk among unrevealed unflagged cells
  const risk = new Map<string, number>();
  for (const con of constraints) {
    const p = con.minesLeft / con.cells.size;
    for (const k of con.cells) {
      risk.set(k, Math.max(risk.get(k) ?? 0, p));
    }
  }

  let bestCell: [number, number] | null = null;
  let lowestRisk = Infinity;

  const remainingUnrevealed: Array<[number, number]> = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (!state.cells[r][c].revealed && !state.cells[r][c].flagged) {
        remainingUnrevealed.push([r, c]);
      }
    }
  }

  const remainingMines = Math.max(0, state.mineCount - state.flagsPlaced);
  const ambientRisk =
    remainingUnrevealed.length > 0 ? remainingMines / remainingUnrevealed.length : 1;

  for (const [r, c] of remainingUnrevealed) {
    const k = keyOf(r, c);
    const cellRisk = risk.has(k) ? risk.get(k)! : ambientRisk;
    if (cellRisk < lowestRisk) {
      lowestRisk = cellRisk;
      bestCell = [r, c];
    }
  }

  if (!bestCell) return null;
  return {
    row: bestCell[0],
    col: bestCell[1],
    action: 'reveal',
    certain: false,
    reason: `No 100% deterministic tile exists — (${bestCell[0] + 1},${bestCell[1] + 1}) has the lowest mine probability (~${Math.round(lowestRisk * 100)}%).`,
  };
}
