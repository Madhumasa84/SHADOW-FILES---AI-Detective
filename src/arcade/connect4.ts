// OBSIDIAN FOUR — Connect Four engine with depth-6 Alpha-Beta Minimax AI

export const C4_ROWS = 6;
export const C4_COLS = 7;

export type C4Disc = 0 | 1 | 2; // 0 = empty, 1 = human (amber gold), 2 = AI (obsidian/crimson)
export type C4Difficulty = 'street' | 'master' | 'grandmaster';

export interface C4State {
  board: C4Disc[][];
  turn: 1 | 2;
  winner: 0 | 1 | 2 | 'draw';
  winningCells: Array<[number, number]>;
  lastMove: { row: number; col: number; player: 1 | 2 } | null;
  movesCount: number;
}

const COL_ORDER = [3, 2, 4, 1, 5, 0, 6];

export function createInitialC4State(): C4State {
  return {
    board: Array.from({ length: C4_ROWS }, () => Array<C4Disc>(C4_COLS).fill(0)),
    turn: 1,
    winner: 0,
    winningCells: [],
    lastMove: null,
    movesCount: 0,
  };
}

export function getDropRow(board: C4Disc[][], col: number): number {
  if (col < 0 || col >= C4_COLS) return -1;
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

export function getValidC4Cols(board: C4Disc[][]): number[] {
  return COL_ORDER.filter((c) => board[0][c] === 0);
}

export function findC4WinningCells(board: C4Disc[][], player: 1 | 2): Array<[number, number]> {
  const dirs: Array<[number, number]> = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        const cells: Array<[number, number]> = [[r, c]];
        for (let step = 1; step < 4; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= C4_ROWS || nc < 0 || nc >= C4_COLS || board[nr][nc] !== player) {
            break;
          }
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return [];
}

export function dropC4Disc(state: C4State, col: number): C4State {
  if (state.winner !== 0) return state;
  const row = getDropRow(state.board, col);
  if (row === -1) return state;

  const board = state.board.map((r) => r.slice());
  board[row][col] = state.turn;
  const movesCount = state.movesCount + 1;

  const winCells = findC4WinningCells(board, state.turn);
  let winner: C4State['winner'] = 0;
  if (winCells.length === 4) {
    winner = state.turn;
  } else if (movesCount >= C4_ROWS * C4_COLS) {
    winner = 'draw';
  }

  return {
    board,
    turn: state.turn === 1 ? 2 : 1,
    winner,
    winningCells: winCells,
    lastMove: { row, col, player: state.turn },
    movesCount,
  };
}

function scoreWindow(w: C4Disc[], ai: 1 | 2, opp: 1 | 2): number {
  let aiCount = 0;
  let oppCount = 0;
  let emptyCount = 0;
  for (let i = 0; i < 4; i++) {
    if (w[i] === ai) aiCount++;
    else if (w[i] === opp) oppCount++;
    else emptyCount++;
  }
  if (aiCount === 4) return 10000;
  if (aiCount === 3 && emptyCount === 1) return 12;
  if (aiCount === 2 && emptyCount === 2) return 3;
  if (oppCount === 3 && emptyCount === 1) return -15;
  if (oppCount === 2 && emptyCount === 2) return -3;
  return 0;
}

function evaluateC4Board(board: C4Disc[][], ai: 1 | 2): number {
  const opp: 1 | 2 = ai === 1 ? 2 : 1;
  let score = 0;

  // Center control bonus
  for (let r = 0; r < C4_ROWS; r++) {
    if (board[r][3] === ai) score += 5;
    else if (board[r][3] === opp) score -= 5;
  }

  // Horizontal
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]], ai, opp);
    }
  }
  // Vertical
  for (let c = 0; c < C4_COLS; c++) {
    for (let r = 0; r <= C4_ROWS - 4; r++) {
      score += scoreWindow([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]], ai, opp);
    }
  }
  // Positive diagonal
  for (let r = 0; r <= C4_ROWS - 4; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      score += scoreWindow(
        [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]],
        ai,
        opp
      );
    }
  }
  // Negative diagonal
  for (let r = 0; r <= C4_ROWS - 4; r++) {
    for (let c = 3; c < C4_COLS; c++) {
      score += scoreWindow(
        [board[r][c], board[r + 1][c - 1], board[r + 2][c - 2], board[r + 3][c - 3]],
        ai,
        opp
      );
    }
  }
  return score;
}

function minimaxC4(
  board: C4Disc[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ai: 1 | 2
): number {
  const opp: 1 | 2 = ai === 1 ? 2 : 1;
  if (findC4WinningCells(board, ai).length === 4) return 100000 + depth * 100;
  if (findC4WinningCells(board, opp).length === 4) return -100000 - depth * 100;

  const valid = getValidC4Cols(board);
  if (valid.length === 0) return 0;
  if (depth === 0) return evaluateC4Board(board, ai);

  if (maximizing) {
    let best = -Infinity;
    for (const col of valid) {
      const row = getDropRow(board, col);
      board[row][col] = ai;
      const val = minimaxC4(board, depth - 1, alpha, beta, false, ai);
      board[row][col] = 0;
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const col of valid) {
      const row = getDropRow(board, col);
      board[row][col] = opp;
      const val = minimaxC4(board, depth - 1, alpha, beta, true, ai);
      board[row][col] = 0;
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

export function chooseC4AIMove(
  state: C4State,
  difficulty: C4Difficulty = 'master',
  aiPlayer: 1 | 2 = 2
): number {
  const valid = getValidC4Cols(state.board);
  if (valid.length === 0) return -1;
  if (valid.length === 1) return valid[0];

  const board = state.board.map((r) => r.slice());
  const opp: 1 | 2 = aiPlayer === 1 ? 2 : 1;

  // Immediate win check
  for (const col of valid) {
    const row = getDropRow(board, col);
    board[row][col] = aiPlayer;
    const isWin = findC4WinningCells(board, aiPlayer).length === 4;
    board[row][col] = 0;
    if (isWin) return col;
  }

  // Immediate block check
  for (const col of valid) {
    const row = getDropRow(board, col);
    board[row][col] = opp;
    const oppWins = findC4WinningCells(board, opp).length === 4;
    board[row][col] = 0;
    if (oppWins) return col;
  }

  const depth = difficulty === 'street' ? 2 : difficulty === 'master' ? 4 : 6;
  let bestCol = valid[0];
  let bestScore = -Infinity;

  for (const col of valid) {
    const row = getDropRow(board, col);
    board[row][col] = aiPlayer;
    const score = minimaxC4(board, depth - 1, -Infinity, Infinity, false, aiPlayer);
    board[row][col] = 0;
    const jitter = difficulty === 'street' ? (Math.random() - 0.5) * 14 : 0;
    if (score + jitter > bestScore) {
      bestScore = score + jitter;
      bestCol = col;
    }
  }
  return bestCol;
}
