// NOIR DRAUGHTS — 8x8 American Checkers with mandatory multi-jump captures & Alpha-Beta AI

export type CheckersOwner = 'gold' | 'obsidian'; // gold = human (moves up), obsidian = AI (moves down)
export type CheckersDifficulty = 'casual' | 'tactician' | 'master';

export interface CheckersPiece {
  owner: CheckersOwner;
  king: boolean;
}

export interface CheckersMove {
  from: [number, number];
  to: [number, number];
  path: Array<[number, number]>; // intermediate + final squares
  captures: Array<[number, number]>;
  promotes: boolean;
}

export interface CheckersState {
  board: (CheckersPiece | null)[][];
  turn: CheckersOwner;
  winner: CheckersOwner | 'draw' | null;
  lastMove: CheckersMove | null;
  goldCount: number;
  obsidianCount: number;
  quietPlies: number;
}

export function createInitialCheckersState(): CheckersState {
  const board: (CheckersPiece | null)[][] = Array.from({ length: 8 }, () =>
    Array<CheckersPiece | null>(8).fill(null)
  );
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r][c] = { owner: 'obsidian', king: false };
        else if (r > 4) board[r][c] = { owner: 'gold', king: false };
      }
    }
  }
  return {
    board,
    turn: 'gold',
    winner: null,
    lastMove: null,
    goldCount: 12,
    obsidianCount: 12,
    quietPlies: 0,
  };
}

function getMoveDirs(piece: CheckersPiece): Array<[number, number]> {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  return piece.owner === 'gold'
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

function collectJumpSequences(
  board: (CheckersPiece | null)[][],
  r: number,
  c: number,
  piece: CheckersPiece,
  origin: [number, number],
  path: Array<[number, number]>,
  captures: Array<[number, number]>,
  results: CheckersMove[]
): void {
  const dirs = getMoveDirs(piece);
  let extended = false;

  for (const [dr, dc] of dirs) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + dr * 2;
    const lc = c + dc * 2;
    if (lr < 0 || lr >= 8 || lc < 0 || lc >= 8) continue;
    const mid = board[mr][mc];
    if (!mid || mid.owner === piece.owner) continue;
    if (board[lr][lc] !== null) continue;
    if (captures.some(([cr, cc]) => cr === mr && cc === mc)) continue;

    extended = true;
    const promotes =
      !piece.king &&
      ((piece.owner === 'gold' && lr === 0) || (piece.owner === 'obsidian' && lr === 7));

    // American Checkers: crowning ends the jump chain immediately
    const nextBoard = board.map((row) => row.slice());
    nextBoard[r][c] = null;
    nextBoard[mr][mc] = null;
    const movedPiece: CheckersPiece = { owner: piece.owner, king: piece.king || promotes };
    nextBoard[lr][lc] = movedPiece;

    const nextPath: Array<[number, number]> = [...path, [lr, lc]];
    const nextCaps: Array<[number, number]> = [...captures, [mr, mc]];

    if (promotes) {
      results.push({
        from: origin,
        to: [lr, lc],
        path: nextPath,
        captures: nextCaps,
        promotes: true,
      });
    } else {
      collectJumpSequences(nextBoard, lr, lc, movedPiece, origin, nextPath, nextCaps, results);
    }
  }

  if (!extended && captures.length > 0) {
    results.push({
      from: origin,
      to: [r, c],
      path,
      captures,
      promotes: false,
    });
  }
}

export function getLegalCheckersMoves(
  board: (CheckersPiece | null)[][],
  owner: CheckersOwner
): CheckersMove[] {
  const jumps: CheckersMove[] = [];
  const quiets: CheckersMove[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.owner !== owner) continue;
      collectJumpSequences(board, r, c, piece, [r, c], [], [], jumps);
    }
  }

  // Mandatory capture rule
  if (jumps.length > 0) return jumps;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.owner !== owner) continue;
      for (const [dr, dc] of getMoveDirs(piece)) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        if (board[nr][nc] !== null) continue;
        const promotes =
          !piece.king &&
          ((piece.owner === 'gold' && nr === 0) || (piece.owner === 'obsidian' && nr === 7));
        quiets.push({
          from: [r, c],
          to: [nr, nc],
          path: [[nr, nc]],
          captures: [],
          promotes,
        });
      }
    }
  }
  return quiets;
}

export function applyCheckersMove(state: CheckersState, move: CheckersMove): CheckersState {
  if (state.winner !== null) return state;
  const board = state.board.map((row) => row.slice());
  const piece = board[move.from[0]][move.from[1]];
  if (!piece || piece.owner !== state.turn) return state;

  board[move.from[0]][move.from[1]] = null;
  for (const [cr, cc] of move.captures) {
    board[cr][cc] = null;
  }
  board[move.to[0]][move.to[1]] = {
    owner: piece.owner,
    king: piece.king || move.promotes,
  };

  let goldCount = 0;
  let obsidianCount = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.owner === 'gold') goldCount++;
      else if (p?.owner === 'obsidian') obsidianCount++;
    }
  }

  const nextTurn: CheckersOwner = state.turn === 'gold' ? 'obsidian' : 'gold';
  const quietPlies = move.captures.length > 0 || !piece.king ? 0 : state.quietPlies + 1;
  const oppMoves = getLegalCheckersMoves(board, nextTurn);

  let winner: CheckersState['winner'] = null;
  if (goldCount === 0 || (nextTurn === 'gold' && oppMoves.length === 0)) {
    winner = 'obsidian';
  } else if (obsidianCount === 0 || (nextTurn === 'obsidian' && oppMoves.length === 0)) {
    winner = 'gold';
  } else if (quietPlies >= 60) {
    winner = 'draw';
  }

  return {
    board,
    turn: nextTurn,
    winner,
    lastMove: move,
    goldCount,
    obsidianCount,
    quietPlies,
  };
}

function evaluateCheckers(board: (CheckersPiece | null)[][], ai: CheckersOwner): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const sign = p.owner === ai ? 1 : -1;
      const base = p.king ? 185 : 100;
      const advance = p.king
        ? 0
        : p.owner === 'obsidian'
        ? r * 6
        : (7 - r) * 6;
      const centerBonus = c >= 2 && c <= 5 && r >= 2 && r <= 5 ? 10 : 0;
      const backRowGuard =
        !p.king && ((p.owner === 'obsidian' && r === 0) || (p.owner === 'gold' && r === 7)) ? 12 : 0;
      score += sign * (base + advance + centerBonus + backRowGuard);
    }
  }
  return score;
}

function alphabetaCheckers(
  board: (CheckersPiece | null)[][],
  depth: number,
  alpha: number,
  beta: number,
  turn: CheckersOwner,
  ai: CheckersOwner
): number {
  const moves = getLegalCheckersMoves(board, turn);
  if (moves.length === 0) {
    return turn === ai ? -100000 - depth * 100 : 100000 + depth * 100;
  }
  if (depth === 0) return evaluateCheckers(board, ai);

  const nextTurn: CheckersOwner = turn === 'gold' ? 'obsidian' : 'gold';
  moves.sort((a, b) => b.captures.length - a.captures.length || Number(b.promotes) - Number(a.promotes));

  if (turn === ai) {
    let best = -Infinity;
    for (const m of moves) {
      const next = board.map((row) => row.slice());
      const p = next[m.from[0]][m.from[1]]!;
      next[m.from[0]][m.from[1]] = null;
      for (const [cr, cc] of m.captures) next[cr][cc] = null;
      next[m.to[0]][m.to[1]] = { owner: p.owner, king: p.king || m.promotes };
      const val = alphabetaCheckers(next, depth - 1, alpha, beta, nextTurn, ai);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const next = board.map((row) => row.slice());
      const p = next[m.from[0]][m.from[1]]!;
      next[m.from[0]][m.from[1]] = null;
      for (const [cr, cc] of m.captures) next[cr][cc] = null;
      next[m.to[0]][m.to[1]] = { owner: p.owner, king: p.king || m.promotes };
      const val = alphabetaCheckers(next, depth - 1, alpha, beta, nextTurn, ai);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

export function chooseCheckersAIMove(
  state: CheckersState,
  difficulty: CheckersDifficulty = 'tactician'
): CheckersMove | null {
  const moves = getLegalCheckersMoves(state.board, state.turn);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const depth = difficulty === 'casual' ? 2 : difficulty === 'tactician' ? 4 : 5;
  const ai = state.turn;
  const opp: CheckersOwner = ai === 'gold' ? 'obsidian' : 'gold';

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    const next = state.board.map((row) => row.slice());
    const p = next[m.from[0]][m.from[1]]!;
    next[m.from[0]][m.from[1]] = null;
    for (const [cr, cc] of m.captures) next[cr][cc] = null;
    next[m.to[0]][m.to[1]] = { owner: p.owner, king: p.king || m.promotes };
    const score = alphabetaCheckers(next, depth - 1, -Infinity, Infinity, opp, ai);
    const jitter = difficulty === 'casual' ? (Math.random() - 0.5) * 45 : 0;
    if (score + jitter > bestScore) {
      bestScore = score + jitter;
      bestMove = m;
    }
  }
  return bestMove;
}
