// ECLIPSE OTHELLO — 8x8 Reversi engine with positional + mobility Alpha-Beta AI

export type ReversiDisc = 0 | 1 | 2; // 1 = Black/Obsidian (human), 2 = Ivory/Gold (AI)
export type ReversiDifficulty = 'club' | 'tactician' | 'apex';

export interface ReversiMove {
  row: number;
  col: number;
  flips: Array<[number, number]>;
}

export interface ReversiState {
  board: ReversiDisc[][];
  turn: 1 | 2;
  winner: 0 | 1 | 2 | 'draw';
  lastMove: ReversiMove | null;
  passedLastTurn: boolean;
  blackCount: number;
  whiteCount: number;
}

const DIRS: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// Classic strategic Othello positional matrix (corners prized, X/C squares penalized)
const WEIGHTS = [
  [120, -25, 20, 8, 8, 20, -25, 120],
  [-25, -45, -4, -2, -2, -4, -45, -25],
  [20, -4, 15, 4, 4, 15, -4, 20],
  [8, -2, 4, 2, 2, 4, -2, 8],
  [8, -2, 4, 2, 2, 4, -2, 8],
  [20, -4, 15, 4, 4, 15, -4, 20],
  [-25, -45, -4, -2, -2, -4, -45, -25],
  [120, -25, 20, 8, 8, 20, -25, 120],
];

function countDiscs(board: ReversiDisc[][]): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 1) black++;
      else if (board[r][c] === 2) white++;
    }
  }
  return { black, white };
}

export function createInitialReversiState(): ReversiState {
  const board: ReversiDisc[][] = Array.from({ length: 8 }, () => Array<ReversiDisc>(8).fill(0));
  board[3][3] = 2;
  board[3][4] = 1;
  board[4][3] = 1;
  board[4][4] = 2;
  return {
    board,
    turn: 1,
    winner: 0,
    lastMove: null,
    passedLastTurn: false,
    blackCount: 2,
    whiteCount: 2,
  };
}

export function getReversiFlips(
  board: ReversiDisc[][],
  row: number,
  col: number,
  player: 1 | 2
): Array<[number, number]> {
  if (board[row][col] !== 0) return [];
  const opp: 1 | 2 = player === 1 ? 2 : 1;
  const allFlips: Array<[number, number]> = [];

  for (const [dr, dc] of DIRS) {
    const line: Array<[number, number]> = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opp) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }
    if (line.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === player) {
      allFlips.push(...line);
    }
  }
  return allFlips;
}

export function getLegalReversiMoves(board: ReversiDisc[][], player: 1 | 2): ReversiMove[] {
  const moves: ReversiMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] !== 0) continue;
      const flips = getReversiFlips(board, r, c, player);
      if (flips.length > 0) {
        moves.push({ row: r, col: c, flips });
      }
    }
  }
  return moves;
}

export function applyReversiMove(state: ReversiState, row: number, col: number): ReversiState {
  if (state.winner !== 0) return state;
  const flips = getReversiFlips(state.board, row, col, state.turn);
  if (flips.length === 0) return state;

  const board = state.board.map((r) => r.slice());
  board[row][col] = state.turn;
  for (const [fr, fc] of flips) {
    board[fr][fc] = state.turn;
  }

  const nextPlayer: 1 | 2 = state.turn === 1 ? 2 : 1;
  const nextMoves = getLegalReversiMoves(board, nextPlayer);
  const currentMoves = getLegalReversiMoves(board, state.turn);
  const { black, white } = countDiscs(board);

  let turn: 1 | 2 = nextPlayer;
  let passedLastTurn = false;
  let winner: ReversiState['winner'] = 0;

  if (nextMoves.length === 0) {
    if (currentMoves.length === 0) {
      winner = black > white ? 1 : white > black ? 2 : 'draw';
    } else {
      turn = state.turn;
      passedLastTurn = true;
    }
  }

  return {
    board,
    turn,
    winner,
    lastMove: { row, col, flips },
    passedLastTurn,
    blackCount: black,
    whiteCount: white,
  };
}

function evaluateReversi(board: ReversiDisc[][], ai: 1 | 2): number {
  const opp: 1 | 2 = ai === 1 ? 2 : 1;
  let posScore = 0;
  let aiDiscs = 0;
  let oppDiscs = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell === ai) {
        aiDiscs++;
        posScore += WEIGHTS[r][c];
      } else if (cell === opp) {
        oppDiscs++;
        posScore -= WEIGHTS[r][c];
      }
    }
  }

  const total = aiDiscs + oppDiscs;
  if (total === 64) {
    return (aiDiscs - oppDiscs) * 1000;
  }

  const aiMob = getLegalReversiMoves(board, ai).length;
  const oppMob = getLegalReversiMoves(board, opp).length;
  const mobilityWeight = total > 50 ? 4 : 11;
  const discWeight = total > 52 ? 12 : 1;

  return posScore + (aiMob - oppMob) * mobilityWeight + (aiDiscs - oppDiscs) * discWeight;
}

function alphabetaReversi(
  board: ReversiDisc[][],
  depth: number,
  alpha: number,
  beta: number,
  current: 1 | 2,
  ai: 1 | 2
): number {
  const moves = getLegalReversiMoves(board, current);
  const opp: 1 | 2 = current === 1 ? 2 : 1;

  if (depth === 0) return evaluateReversi(board, ai);

  if (moves.length === 0) {
    const oppMoves = getLegalReversiMoves(board, opp);
    if (oppMoves.length === 0) {
      const { black, white } = countDiscs(board);
      const diff = ai === 1 ? black - white : white - black;
      return diff * 10000;
    }
    return alphabetaReversi(board, depth - 1, alpha, beta, opp, ai);
  }

  // Sort corners first for better alpha-beta pruning
  moves.sort((a, b) => WEIGHTS[b.row][b.col] - WEIGHTS[a.row][a.col]);

  const maximizing = current === ai;
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const next = board.map((r) => r.slice());
      next[m.row][m.col] = current;
      for (const [fr, fc] of m.flips) next[fr][fc] = current;
      const val = alphabetaReversi(next, depth - 1, alpha, beta, opp, ai);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const next = board.map((r) => r.slice());
      next[m.row][m.col] = current;
      for (const [fr, fc] of m.flips) next[fr][fc] = current;
      const val = alphabetaReversi(next, depth - 1, alpha, beta, opp, ai);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

export function chooseReversiAIMove(
  state: ReversiState,
  difficulty: ReversiDifficulty = 'tactician',
  player: 1 | 2 = state.turn
): ReversiMove | null {
  const moves = getLegalReversiMoves(state.board, player);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const depth = difficulty === 'club' ? 1 : difficulty === 'tactician' ? 3 : 4;
  const opp: 1 | 2 = player === 1 ? 2 : 1;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    const next = state.board.map((r) => r.slice());
    next[m.row][m.col] = player;
    for (const [fr, fc] of m.flips) next[fr][fc] = player;
    const score = alphabetaReversi(next, depth - 1, -Infinity, Infinity, opp, player);
    const jitter = difficulty === 'club' ? (Math.random() - 0.5) * 35 : 0;
    if (score + jitter > bestScore) {
      bestScore = score + jitter;
      bestMove = m;
    }
  }
  return bestMove;
}
