import {
  algebraicToSquare,
  applyChessMove,
  generateLegalMoves,
  getPositionKey,
  isColorInCheck,
  oppositeColor,
} from './rules.ts';
import type { ChessMove, ChessRecords, ChessState, EloProfile, Piece, PieceColor, PieceType } from './types.ts';

export const MIN_ELO = 500;
export const MAX_ELO = 3000;
export const CHESS_RECORDS_KEY = 'shadow_files_midnight_gambit_records_v1';

export const ELO_PRESETS: Array<{ rating: number; label: string }> = [
  { rating: 500, label: 'Novice' },
  { rating: 1000, label: 'Club' },
  { rating: 1500, label: 'Tactician' },
  { rating: 2000, label: 'Master' },
  { rating: 2500, label: 'GM' },
  { rating: 3000, label: 'Engine' },
];

export function clampElo(rating: number): number {
  const rounded = Math.round(rating / 50) * 50;
  return Math.max(MIN_ELO, Math.min(MAX_ELO, rounded));
}

export function getEloProfile(rawRating: number): EloProfile {
  const rating = clampElo(rawRating);
  const t = (rating - MIN_ELO) / (MAX_ELO - MIN_ELO); // 0..1

  if (rating <= 750) {
    return {
      rating,
      title: 'Street Novice',
      persona: 'A. Mercer',
      summary: 'Plays loosely, occasionally overlooks tactics and hangs loose pieces.',
      searchDepth: 1,
      quiescenceDepth: 0,
      noiseCp: Math.round(280 - (rating - 500) * 0.45),
      blunderRate: 0.34 - (rating - 500) * 0.0005,
      bookChance: 0.1,
      timeBudgetMs: 90,
    };
  }
  if (rating <= 1150) {
    return {
      rating,
      title: 'Casual Club',
      persona: 'D. Callahan',
      summary: 'Spots simple captures and one-move threats with occasional positional slips.',
      searchDepth: 2,
      quiescenceDepth: 0,
      noiseCp: Math.round(145 - (rating - 800) * 0.2),
      blunderRate: 0.16 - (rating - 800) * 0.00025,
      bookChance: 0.35,
      timeBudgetMs: 130,
    };
  }
  if (rating <= 1550) {
    return {
      rating,
      title: 'Club Tactician',
      persona: 'N. Koval',
      summary: 'Develops cleanly, punishes hanging pieces, and hunts tactical forks.',
      searchDepth: 2,
      quiescenceDepth: 2,
      noiseCp: Math.round(68 - (rating - 1200) * 0.1),
      blunderRate: 0.05,
      bookChance: 0.6,
      timeBudgetMs: 180,
    };
  }
  if (rating <= 1950) {
    return {
      rating,
      title: 'Candidate Master',
      persona: 'S. Lindqvist',
      summary: 'Principled opening repertoire with sharp 3-ply tactical calculation.',
      searchDepth: 3,
      quiescenceDepth: 3,
      noiseCp: Math.round(28 - (rating - 1600) * 0.045),
      blunderRate: 0.015,
      bookChance: 0.78,
      timeBudgetMs: 240,
    };
  }
  if (rating <= 2450) {
    return {
      rating,
      title: 'Grandmaster',
      persona: 'V. Orlov',
      summary: 'Deep alpha-beta calculation, endgame technique, and unforgiving tactics.',
      searchDepth: 4,
      quiescenceDepth: 4,
      noiseCp: Math.round(10 * (1 - Math.min(1, (rating - 2000) / 500))),
      blunderRate: 0,
      bookChance: 0.9,
      timeBudgetMs: 320,
    };
  }
  return {
    rating,
    title: rating >= 2900 ? 'Apex Engine' : 'Super GM',
    persona: rating >= 2900 ? 'OBSIDIAN-3000' : 'M. Sokolov',
    summary:
      rating >= 2900
        ? 'Maximum automated calculation with iterative deepening, quiescence, and zero mercy.'
        : 'Elite tournament-strength search with crisp positional and tactical precision.',
    searchDepth: rating >= 2800 ? 5 : 4,
    quiescenceDepth: 5,
    noiseCp: Math.round(Math.max(0, (1 - t) * 18)),
    blunderRate: 0,
    bookChance: 0.96,
    timeBudgetMs: rating >= 2800 ? 440 : 370,
  };
}

// Piece base values in centipawns
const PIECE_CP: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 910,
  k: 20000,
};

// Piece-square tables from White's perspective (index 0 = a8, 63 = h1)
const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  12, 12, 22, 32, 32, 22, 12, 12,
  6, 6, 12, 27, 27, 12, 6, 6,
  0, 0, 4, 24, 24, 4, 0, 0,
  5, -4, -8, 2, 2, -8, -4, 5,
  5, 10, 10, -22, -22, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 2, 2, 0, -20, -40,
  -30, 4, 12, 16, 16, 12, 4, -30,
  -30, 6, 16, 22, 22, 16, 6, -30,
  -30, 2, 16, 22, 22, 16, 2, -30,
  -30, 6, 12, 16, 16, 12, 6, -30,
  -40, -20, 0, 6, 6, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const PST_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 6, 12, 12, 6, 0, -10,
  -10, 6, 8, 12, 12, 8, 6, -10,
  -10, 2, 12, 12, 12, 12, 2, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 6, 0, 0, 0, 0, 6, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK = [
  0, 0, 2, 6, 6, 2, 0, 0,
  6, 12, 12, 12, 12, 12, 12, 6,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 4, 10, 10, 4, 0, 0,
];

const PST_QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 6, 6, 6, 6, 0, -10,
  -5, 0, 6, 6, 6, 6, 0, -5,
  0, 0, 6, 6, 6, 6, 0, -5,
  -10, 5, 6, 6, 6, 6, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

const PST_KING_MID = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  18, 22, 0, 0, 0, 0, 22, 18,
  20, 32, 12, 0, 0, 12, 32, 20,
];

const PST_KING_END = [
  -40, -30, -20, -15, -15, -20, -30, -40,
  -25, -10, 0, 4, 4, 0, -10, -25,
  -18, 4, 18, 24, 24, 18, 4, -18,
  -15, 6, 24, 34, 34, 24, 6, -15,
  -15, 6, 24, 34, 34, 24, 6, -15,
  -18, 4, 18, 24, 24, 18, 4, -18,
  -25, -12, 0, 4, 4, 0, -12, -25,
  -40, -30, -20, -15, -15, -20, -30, -40,
];

function mirrorSq(sq: number): number {
  const row = sq >> 3;
  const col = sq & 7;
  return ((7 - row) << 3) | col;
}

/**
 * Evaluates a board position in centipawns from White's perspective (+ = White better).
 */
export function evaluateBoard(board: (Piece | null)[]): number {
  let score = 0;
  let wBishops = 0;
  let bBishops = 0;
  let nonPawnMaterial = 0;

  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p) continue;
    if (p.type !== 'p' && p.type !== 'k') {
      nonPawnMaterial += PIECE_CP[p.type];
    }
  }

  const isEndgame = nonPawnMaterial <= 2600;

  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p) continue;

    const idx = p.color === 'w' ? sq : mirrorSq(sq);
    let val = PIECE_CP[p.type];

    switch (p.type) {
      case 'p':
        val += PST_PAWN[idx];
        break;
      case 'n':
        val += PST_KNIGHT[idx];
        break;
      case 'b':
        val += PST_BISHOP[idx];
        if (p.color === 'w') wBishops++;
        else bBishops++;
        break;
      case 'r':
        val += PST_ROOK[idx];
        break;
      case 'q':
        val += PST_QUEEN[idx];
        break;
      case 'k':
        val += isEndgame ? PST_KING_END[idx] : PST_KING_MID[idx];
        break;
    }

    score += p.color === 'w' ? val : -val;
  }

  // Bishop pair bonus
  if (wBishops >= 2) score += 32;
  if (bBishops >= 2) score -= 32;

  return score;
}

// Compact opening book keyed by UCI move history prefix (e.g. "e2e4 e7e5")
const OPENING_BOOK: Record<string, string[]> = {
  '': ['e2e4', 'd2d4', 'c2c4', 'g1f3'],
  e2e4: ['e7e5', 'c7c5', 'e7e6', 'c7c6'],
  'e2e4 e7e5': ['g1f3', 'f1c4', 'b1c3'],
  'e2e4 e7e5 g1f3': ['b8c6', 'g8f6'],
  'e2e4 e7e5 g1f3 b8c6': ['f1b5', 'f1c4', 'd2d4'],
  'e2e4 e7e5 g1f3 b8c6 f1b5': ['a7a6', 'g8f6'],
  'e2e4 e7e5 g1f3 b8c6 f1c4': ['f8c5', 'g8f6'],
  'e2e4 c7c5': ['g1f3', 'b1c3'],
  'e2e4 c7c5 g1f3': ['d7d6', 'b8c6', 'e7e6'],
  'e2e4 c7c5 g1f3 d7d6': ['d2d4'],
  'e2e4 e7e6': ['d2d4'],
  'e2e4 e7e6 d2d4': ['d7d5'],
  'e2e4 c7c6': ['d2d4'],
  'e2e4 c7c6 d2d4': ['d7d5'],
  d2d4: ['d7d5', 'g8f6', 'e7e6'],
  'd2d4 d7d5': ['c2c4', 'g1f3', 'c1f4'],
  'd2d4 d7d5 c2c4': ['e7e6', 'c7c6', 'd5c4'],
  'd2d4 g8f6': ['c2c4', 'g1f3', 'c1f4'],
  'd2d4 g8f6 c2c4': ['e7e6', 'g7g6'],
  'd2d4 g8f6 c2c4 g7g6': ['b1c3', 'g1f3'],
  c2c4: ['e7e5', 'g8f6', 'c7c5'],
  g1f3: ['d7d5', 'g8f6', 'c7c5'],
};

function moveToUci(m: ChessMove): string {
  const files = 'abcdefgh';
  const f = `${files[m.from & 7]}${8 - (m.from >> 3)}`;
  const t = `${files[m.to & 7]}${8 - (m.to >> 3)}`;
  return `${f}${t}${m.promotion ?? ''}`;
}

function lookupBookMove(state: ChessState, legalMoves: ChessMove[]): ChessMove | null {
  if (state.history.length > 8) return null;
  const key = state.history.map(moveToUci).join(' ');
  const candidates = OPENING_BOOK[key];
  if (!candidates || candidates.length === 0) return null;

  const matched = candidates
    .map((uci) => {
      const from = algebraicToSquare(uci.slice(0, 2));
      const to = algebraicToSquare(uci.slice(2, 4));
      return legalMoves.find((m) => m.from === from && m.to === to);
    })
    .filter((m): m is ChessMove => Boolean(m));

  if (matched.length === 0) return null;
  return matched[Math.floor(Math.random() * matched.length)];
}

function scoreMoveOrdering(m: ChessMove, pvKey?: string): number {
  let score = 0;
  if (pvKey && moveToUci(m) === pvKey) return 100000;
  if (m.captured) {
    // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
    score += 10000 + PIECE_CP[m.captured] * 10 - PIECE_CP[m.piece];
  }
  if (m.promotion) {
    score += 9000 + PIECE_CP[m.promotion];
  }
  if (m.isCastle) {
    score += 450;
  }
  return score;
}

interface SearchContext {
  deadline: number;
  aborted: boolean;
  nodes: number;
  tt: Map<
    string,
    { depth: number; score: number; flag: 'exact' | 'lower' | 'upper'; bestUci?: string }
  >;
}

const MATE_SCORE = 100000;

function makeFastChild(
  board: (Piece | null)[],
  turn: PieceColor,
  castling: ChessState['castling'],
  move: ChessMove
): {
  board: (Piece | null)[];
  turn: PieceColor;
  castling: ChessState['castling'];
  enPassantSquare: number | null;
} {
  const nextBoard = board.slice();
  const moving = nextBoard[move.from];
  nextBoard[move.from] = null;
  if (move.isEnPassant) {
    const epCapSq = move.color === 'w' ? move.to + 8 : move.to - 8;
    nextBoard[epCapSq] = null;
  }
  nextBoard[move.to] = move.promotion
    ? { color: move.color, type: move.promotion }
    : moving;

  if (move.isCastle) {
    const rankRow = move.color === 'w' ? 7 : 0;
    if (move.isCastle === 'K') {
      nextBoard[(rankRow << 3) | 5] = nextBoard[(rankRow << 3) | 7];
      nextBoard[(rankRow << 3) | 7] = null;
    } else {
      nextBoard[(rankRow << 3) | 3] = nextBoard[(rankRow << 3) | 0];
      nextBoard[(rankRow << 3) | 0] = null;
    }
  }

  const nextCastling = { ...castling };
  if (move.piece === 'k') {
    if (move.color === 'w') {
      nextCastling.wK = false;
      nextCastling.wQ = false;
    } else {
      nextCastling.bK = false;
      nextCastling.bQ = false;
    }
  }
  if (move.from === 63 || move.to === 63) nextCastling.wK = false;
  if (move.from === 56 || move.to === 56) nextCastling.wQ = false;
  if (move.from === 7 || move.to === 7) nextCastling.bK = false;
  if (move.from === 0 || move.to === 0) nextCastling.bQ = false;

  const enPassantSquare =
    move.piece === 'p' && Math.abs((move.to >> 3) - (move.from >> 3)) === 2
      ? (move.from + move.to) >> 1
      : null;

  return {
    board: nextBoard,
    turn: oppositeColor(turn),
    castling: nextCastling,
    enPassantSquare,
  };
}

function quiescence(
  pos: Pick<ChessState, 'board' | 'turn' | 'castling' | 'enPassantSquare'>,
  alpha: number,
  beta: number,
  qDepth: number,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if ((ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) {
    ctx.aborted = true;
    return 0;
  }

  const sign = pos.turn === 'w' ? 1 : -1;
  const standPat = sign * evaluateBoard(pos.board);
  if (qDepth <= 0) return standPat;
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const captures = generateLegalMoves(pos, true);
  if (captures.length === 0) return standPat;
  captures.sort((a, b) => scoreMoveOrdering(b) - scoreMoveOrdering(a));

  for (let i = 0; i < captures.length; i++) {
    const child = makeFastChild(pos.board, pos.turn, pos.castling, captures[i]);
    const score = -quiescence(child, -beta, -alpha, qDepth - 1, ctx);
    if (ctx.aborted) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function negamax(
  pos: Pick<ChessState, 'board' | 'turn' | 'castling' | 'enPassantSquare'>,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  qDepth: number,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if ((ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) {
    ctx.aborted = true;
    return 0;
  }

  const origAlpha = alpha;
  const posKey = getPositionKey(pos.board, pos.turn, pos.castling, pos.enPassantSquare);
  const cached = ctx.tt.get(posKey);
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') return cached.score;
    if (cached.flag === 'lower') alpha = Math.max(alpha, cached.score);
    else if (cached.flag === 'upper') beta = Math.min(beta, cached.score);
    if (alpha >= beta) return cached.score;
  }

  const legal = generateLegalMoves(pos, false);
  if (legal.length === 0) {
    if (isColorInCheck(pos.board, pos.turn)) {
      return -MATE_SCORE + ply;
    }
    return 0; // Stalemate
  }

  if (depth <= 0) {
    return qDepth > 0
      ? quiescence(pos, alpha, beta, qDepth, ctx)
      : (pos.turn === 'w' ? 1 : -1) * evaluateBoard(pos.board);
  }

  const pvUci = cached?.bestUci;
  legal.sort((a, b) => scoreMoveOrdering(b, pvUci) - scoreMoveOrdering(a, pvUci));

  let bestScore = -Infinity;
  let bestUci: string | undefined;

  for (let i = 0; i < legal.length; i++) {
    const m = legal[i];
    const child = makeFastChild(pos.board, pos.turn, pos.castling, m);
    const score = -negamax(child, depth - 1, -beta, -alpha, ply + 1, qDepth, ctx);
    if (ctx.aborted) return 0;
    if (score > bestScore) {
      bestScore = score;
      bestUci = moveToUci(m);
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  const flag: 'exact' | 'lower' | 'upper' =
    bestScore <= origAlpha ? 'upper' : bestScore >= beta ? 'lower' : 'exact';
  if (ctx.tt.size < 20000) {
    ctx.tt.set(posKey, { depth, score: bestScore, flag, bestUci });
  }
  return bestScore;
}

export interface EngineMoveResult {
  move: ChessMove;
  evalWhiteCp: number;
  depthReached: number;
  fromBook: boolean;
}

/**
 * Selects a legal move calibrated to the human-chosen Elo rating (500..3000).
 */
export function chooseEngineMove(state: ChessState, rating: number): EngineMoveResult | null {
  const legal = generateLegalMoves(state, false);
  if (legal.length === 0) return null;
  if (legal.length === 1) {
    const next = applyChessMove(state, legal[0]);
    return {
      move: legal[0],
      evalWhiteCp: evaluateBoard(next.board),
      depthReached: 1,
      fromBook: false,
    };
  }

  const profile = getEloProfile(rating);

  // Use opening book probabilistically based on Elo rating
  if (Math.random() < profile.bookChance) {
    const bookMove = lookupBookMove(state, legal);
    if (bookMove) {
      const next = applyChessMove(state, bookMove);
      return {
        move: bookMove,
        evalWhiteCp: evaluateBoard(next.board),
        depthReached: 0,
        fromBook: true,
      };
    }
  }

  // Low-Elo intentional human-like blunder chance (avoids pure random nonsense, picks a suboptimal legal move)
  const ctx: SearchContext = {
    deadline: performance.now() + profile.timeBudgetMs,
    aborted: false,
    nodes: 0,
    tt: new Map(),
  };

  let scoredMoves: Array<{ move: ChessMove; score: number }> = legal.map((m) => ({
    move: m,
    score: -Infinity,
  }));
  let bestDepth = 1;

  // Iterative deepening from depth 1 up to profile.searchDepth within time budget
  for (let depth = 1; depth <= profile.searchDepth; depth++) {
    ctx.aborted = false;
    const roundScores: Array<{ move: ChessMove; score: number }> = [];

    // Order root moves from previous iteration
    const ordered =
      depth === 1
        ? [...legal].sort((a, b) => scoreMoveOrdering(b) - scoreMoveOrdering(a))
        : [...scoredMoves].sort((a, b) => b.score - a.score).map((x) => x.move);

    let alpha = -Infinity;
    const beta = Infinity;

    for (let i = 0; i < ordered.length; i++) {
      const m = ordered[i];
      const child = makeFastChild(state.board, state.turn, state.castling, m);
      const score = -negamax(
        child,
        depth - 1,
        -beta,
        -alpha,
        1,
        profile.quiescenceDepth,
        ctx
      );

      if (ctx.aborted && depth > 1) {
        break;
      }
      roundScores.push({ move: m, score });
      if (score > alpha) alpha = score;
    }

    if (!ctx.aborted && roundScores.length === legal.length) {
      scoredMoves = roundScores.sort((a, b) => b.score - a.score);
      bestDepth = depth;
      // Stop immediately if a forced mate is found
      if (scoredMoves[0].score > MATE_SCORE - 100) break;
    } else if (depth === 1 && roundScores.length > 0) {
      scoredMoves = roundScores.sort((a, b) => b.score - a.score);
      break;
    } else {
      break;
    }
  }

  // Apply Elo-calibrated noise & blunder selection (never drops a mate-in-1 above 1800 Elo)
  let chosen = scoredMoves[0];

  if (profile.blunderRate > 0 && scoredMoves.length > 2 && Math.random() < profile.blunderRate) {
    const poolEnd = Math.min(scoredMoves.length, Math.max(3, Math.ceil(scoredMoves.length * 0.65)));
    const pickIdx = 1 + Math.floor(Math.random() * (poolEnd - 1));
    chosen = scoredMoves[pickIdx];
  } else if (profile.noiseCp > 0) {
    const noisy = scoredMoves.map((entry) => {
      // Never obscure forced mates at 1800+ Elo
      if (profile.rating >= 1800 && entry.score > MATE_SCORE - 50) {
        return { ...entry, noisyScore: entry.score };
      }
      const jitter = (Math.random() * 2 - 1) * profile.noiseCp;
      return { ...entry, noisyScore: entry.score + jitter };
    });
    noisy.sort((a, b) => b.noisyScore - a.noisyScore);
    chosen = noisy[0];
  }

  const evalWhiteCp = state.turn === 'w' ? chosen.score : -chosen.score;
  return {
    move: chosen.move,
    evalWhiteCp,
    depthReached: bestDepth,
    fromBook: false,
  };
}

export function loadChessRecords(): ChessRecords {
  if (typeof window === 'undefined') {
    return { gamesPlayed: 0, wins: 0, draws: 0, losses: 0, highestEloBeaten: null };
  }
  try {
    const raw = window.localStorage.getItem(CHESS_RECORDS_KEY);
    if (!raw) return { gamesPlayed: 0, wins: 0, draws: 0, losses: 0, highestEloBeaten: null };
    const parsed = JSON.parse(raw) as Partial<ChessRecords>;
    return {
      gamesPlayed: typeof parsed.gamesPlayed === 'number' ? parsed.gamesPlayed : 0,
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      draws: typeof parsed.draws === 'number' ? parsed.draws : 0,
      losses: typeof parsed.losses === 'number' ? parsed.losses : 0,
      highestEloBeaten: typeof parsed.highestEloBeaten === 'number' ? parsed.highestEloBeaten : null,
    };
  } catch {
    return { gamesPlayed: 0, wins: 0, draws: 0, losses: 0, highestEloBeaten: null };
  }
}

export function saveChessRecord(
  outcome: 'win' | 'draw' | 'loss',
  opponentElo: number
): ChessRecords {
  const prev = loadChessRecords();
  const next: ChessRecords = {
    gamesPlayed: prev.gamesPlayed + 1,
    wins: prev.wins + (outcome === 'win' ? 1 : 0),
    draws: prev.draws + (outcome === 'draw' ? 1 : 0),
    losses: prev.losses + (outcome === 'loss' ? 1 : 0),
    highestEloBeaten:
      outcome === 'win'
        ? Math.max(prev.highestEloBeaten ?? 0, opponentElo)
        : prev.highestEloBeaten,
  };
  try {
    window.localStorage.setItem(CHESS_RECORDS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
  return next;
}
