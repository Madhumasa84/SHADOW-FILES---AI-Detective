import type {
  CastlingRights,
  ChessGameStatus,
  ChessMove,
  ChessState,
  Piece,
  PieceColor,
  PieceType,
  PromotionType,
} from './types.ts';

const FILES = 'abcdefgh';

export function oppositeColor(color: PieceColor): PieceColor {
  return color === 'w' ? 'b' : 'w';
}

export function squareToCoords(sq: number): { row: number; col: number } {
  return { row: sq >> 3, col: sq & 7 };
}

export function coordsToSquare(row: number, col: number): number {
  return (row << 3) | col;
}

export function squareToAlgebraic(sq: number): string {
  const row = sq >> 3;
  const col = sq & 7;
  return `${FILES[col]}${8 - row}`;
}

export function algebraicToSquare(str: string): number {
  const col = FILES.indexOf(str[0]);
  const rank = Number(str[1]);
  return coordsToSquare(8 - rank, col);
}

export function getPositionKey(
  board: (Piece | null)[],
  turn: PieceColor,
  castling: CastlingRights,
  enPassantSquare: number | null
): string {
  let out = '';
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    out += p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '.';
  }
  const c =
    (castling.wK ? 'K' : '') +
    (castling.wQ ? 'Q' : '') +
    (castling.bK ? 'k' : '') +
    (castling.bQ ? 'q' : '');
  return `${out}_${turn}_${c || '-'}_${enPassantSquare ?? '-'}`;
}

export function createInitialChessState(): ChessState {
  const board: (Piece | null)[] = new Array(64).fill(null);
  const backRank: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  for (let col = 0; col < 8; col++) {
    board[coordsToSquare(0, col)] = { color: 'b', type: backRank[col] };
    board[coordsToSquare(1, col)] = { color: 'b', type: 'p' };
    board[coordsToSquare(6, col)] = { color: 'w', type: 'p' };
    board[coordsToSquare(7, col)] = { color: 'w', type: backRank[col] };
  }

  const castling: CastlingRights = { wK: true, wQ: true, bK: true, bQ: true };
  const key = getPositionKey(board, 'w', castling, null);

  return {
    board,
    turn: 'w',
    castling,
    enPassantSquare: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    history: [],
    positionCounts: { [key]: 1 },
    status: 'playing',
    winner: null,
    inCheck: false,
  };
}

export function findKingSquare(board: (Piece | null)[], color: PieceColor): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && p.type === 'k') return i;
  }
  return -1;
}

const KNIGHT_OFFSETS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

const BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const KING_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function isSquareAttacked(
  board: (Piece | null)[],
  sq: number,
  byColor: PieceColor
): boolean {
  const row = sq >> 3;
  const col = sq & 7;

  // Pawn attacks (a white pawn on row+1 attacks row; a black pawn on row-1 attacks row)
  const pawnFromRow = byColor === 'w' ? row + 1 : row - 1;
  if (pawnFromRow >= 0 && pawnFromRow < 8) {
    for (const dc of [-1, 1]) {
      const pc = col + dc;
      if (pc >= 0 && pc < 8) {
        const p = board[(pawnFromRow << 3) | pc];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
    }
  }

  // Knight attacks
  for (let i = 0; i < KNIGHT_OFFSETS.length; i++) {
    const nr = row + KNIGHT_OFFSETS[i][0];
    const nc = col + KNIGHT_OFFSETS[i][1];
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[(nr << 3) | nc];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  // Diagonal sliders (bishop / queen)
  for (let i = 0; i < BISHOP_DIRS.length; i++) {
    const dr = BISHOP_DIRS[i][0];
    const dc = BISHOP_DIRS[i][1];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[(r << 3) | c];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // Orthogonal sliders (rook / queen)
  for (let i = 0; i < ROOK_DIRS.length; i++) {
    const dr = ROOK_DIRS[i][0];
    const dc = ROOK_DIRS[i][1];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[(r << 3) | c];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // Adjacent king
  for (let i = 0; i < KING_OFFSETS.length; i++) {
    const kr = row + KING_OFFSETS[i][0];
    const kc = col + KING_OFFSETS[i][1];
    if (kr >= 0 && kr < 8 && kc >= 0 && kc < 8) {
      const p = board[(kr << 3) | kc];
      if (p && p.color === byColor && p.type === 'k') return true;
    }
  }

  return false;
}

export function isColorInCheck(board: (Piece | null)[], color: PieceColor): boolean {
  const kSq = findKingSquare(board, color);
  if (kSq < 0) return false;
  return isSquareAttacked(board, kSq, oppositeColor(color));
}

function applyMoveToBoardMutating(
  board: (Piece | null)[],
  move: ChessMove
): { capturedPiece: Piece | null; epCapturedSq: number } {
  const moving = board[move.from];
  let capturedPiece = board[move.to];
  let epCapturedSq = -1;

  board[move.from] = null;
  if (move.isEnPassant) {
    epCapturedSq = move.color === 'w' ? move.to + 8 : move.to - 8;
    capturedPiece = board[epCapturedSq];
    board[epCapturedSq] = null;
  }

  board[move.to] = move.promotion
    ? { color: move.color, type: move.promotion }
    : moving;

  if (move.isCastle) {
    const rankRow = move.color === 'w' ? 7 : 0;
    if (move.isCastle === 'K') {
      board[coordsToSquare(rankRow, 5)] = board[coordsToSquare(rankRow, 7)];
      board[coordsToSquare(rankRow, 7)] = null;
    } else {
      board[coordsToSquare(rankRow, 3)] = board[coordsToSquare(rankRow, 0)];
      board[coordsToSquare(rankRow, 0)] = null;
    }
  }

  return { capturedPiece, epCapturedSq };
}

function undoMoveOnBoardMutating(
  board: (Piece | null)[],
  move: ChessMove,
  capturedPiece: Piece | null,
  epCapturedSq: number
): void {
  if (move.isCastle) {
    const rankRow = move.color === 'w' ? 7 : 0;
    if (move.isCastle === 'K') {
      board[coordsToSquare(rankRow, 7)] = board[coordsToSquare(rankRow, 5)];
      board[coordsToSquare(rankRow, 5)] = null;
    } else {
      board[coordsToSquare(rankRow, 0)] = board[coordsToSquare(rankRow, 3)];
      board[coordsToSquare(rankRow, 3)] = null;
    }
  }

  board[move.from] = { color: move.color, type: move.piece };
  if (move.isEnPassant && epCapturedSq >= 0) {
    board[move.to] = null;
    board[epCapturedSq] = capturedPiece;
  } else {
    board[move.to] = capturedPiece;
  }
}

export function generateLegalMoves(
  state: Pick<ChessState, 'board' | 'turn' | 'castling' | 'enPassantSquare'>,
  capturesOnly = false
): ChessMove[] {
  const { board, turn, castling, enPassantSquare } = state;
  const enemy = oppositeColor(turn);
  const pseudo: ChessMove[] = [];
  const promoTypes: PromotionType[] = ['q', 'r', 'b', 'n'];

  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (!piece || piece.color !== turn) continue;
    const row = sq >> 3;
    const col = sq & 7;

    if (piece.type === 'p') {
      const dir = turn === 'w' ? -1 : 1;
      const startRow = turn === 'w' ? 6 : 1;
      const promoRow = turn === 'w' ? 0 : 7;
      const oneRow = row + dir;

      // Forward pushes
      if (!capturesOnly && oneRow >= 0 && oneRow < 8) {
        const oneSq = (oneRow << 3) | col;
        if (!board[oneSq]) {
          if (oneRow === promoRow) {
            for (const promo of promoTypes) {
              pseudo.push({ from: sq, to: oneSq, piece: 'p', color: turn, promotion: promo });
            }
          } else {
            pseudo.push({ from: sq, to: oneSq, piece: 'p', color: turn });
            if (row === startRow) {
              const twoSq = ((row + dir * 2) << 3) | col;
              if (!board[twoSq]) {
                pseudo.push({ from: sq, to: twoSq, piece: 'p', color: turn });
              }
            }
          }
        }
      }

      // Diagonal captures & en passant
      if (oneRow >= 0 && oneRow < 8) {
        for (const dc of [-1, 1]) {
          const nc = col + dc;
          if (nc < 0 || nc >= 8) continue;
          const targetSq = (oneRow << 3) | nc;
          const target = board[targetSq];
          if (target && target.color === enemy) {
            if (oneRow === promoRow) {
              for (const promo of promoTypes) {
                pseudo.push({
                  from: sq,
                  to: targetSq,
                  piece: 'p',
                  color: turn,
                  captured: target.type,
                  promotion: promo,
                });
              }
            } else {
              pseudo.push({
                from: sq,
                to: targetSq,
                piece: 'p',
                color: turn,
                captured: target.type,
              });
            }
          } else if (enPassantSquare !== null && targetSq === enPassantSquare) {
            pseudo.push({
              from: sq,
              to: targetSq,
              piece: 'p',
              color: turn,
              captured: 'p',
              isEnPassant: true,
            });
          }
        }
      }
    } else if (piece.type === 'n') {
      for (let i = 0; i < KNIGHT_OFFSETS.length; i++) {
        const nr = row + KNIGHT_OFFSETS[i][0];
        const nc = col + KNIGHT_OFFSETS[i][1];
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        const targetSq = (nr << 3) | nc;
        const target = board[targetSq];
        if (!target) {
          if (!capturesOnly) pseudo.push({ from: sq, to: targetSq, piece: 'n', color: turn });
        } else if (target.color === enemy) {
          pseudo.push({ from: sq, to: targetSq, piece: 'n', color: turn, captured: target.type });
        }
      }
    } else if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
      const dirs =
        piece.type === 'b'
          ? BISHOP_DIRS
          : piece.type === 'r'
          ? ROOK_DIRS
          : [...BISHOP_DIRS, ...ROOK_DIRS];
      for (let i = 0; i < dirs.length; i++) {
        const dr = dirs[i][0];
        const dc = dirs[i][1];
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const targetSq = (r << 3) | c;
          const target = board[targetSq];
          if (!target) {
            if (!capturesOnly) {
              pseudo.push({ from: sq, to: targetSq, piece: piece.type, color: turn });
            }
          } else {
            if (target.color === enemy) {
              pseudo.push({
                from: sq,
                to: targetSq,
                piece: piece.type,
                color: turn,
                captured: target.type,
              });
            }
            break;
          }
          r += dr;
          c += dc;
        }
      }
    } else if (piece.type === 'k') {
      for (let i = 0; i < KING_OFFSETS.length; i++) {
        const nr = row + KING_OFFSETS[i][0];
        const nc = col + KING_OFFSETS[i][1];
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        const targetSq = (nr << 3) | nc;
        const target = board[targetSq];
        if (!target) {
          if (!capturesOnly) pseudo.push({ from: sq, to: targetSq, piece: 'k', color: turn });
        } else if (target.color === enemy) {
          pseudo.push({ from: sq, to: targetSq, piece: 'k', color: turn, captured: target.type });
        }
      }

      // Castling
      if (!capturesOnly) {
        const homeRow = turn === 'w' ? 7 : 0;
        const kingHome = coordsToSquare(homeRow, 4);
        if (sq === kingHome && !isSquareAttacked(board, kingHome, enemy)) {
          const canK = turn === 'w' ? castling.wK : castling.bK;
          const canQ = turn === 'w' ? castling.wQ : castling.bQ;
          const rookKSq = coordsToSquare(homeRow, 7);
          const rookQSq = coordsToSquare(homeRow, 0);

          if (
            canK &&
            board[rookKSq]?.type === 'r' &&
            board[rookKSq]?.color === turn &&
            !board[coordsToSquare(homeRow, 5)] &&
            !board[coordsToSquare(homeRow, 6)] &&
            !isSquareAttacked(board, coordsToSquare(homeRow, 5), enemy) &&
            !isSquareAttacked(board, coordsToSquare(homeRow, 6), enemy)
          ) {
            pseudo.push({
              from: kingHome,
              to: coordsToSquare(homeRow, 6),
              piece: 'k',
              color: turn,
              isCastle: 'K',
            });
          }

          if (
            canQ &&
            board[rookQSq]?.type === 'r' &&
            board[rookQSq]?.color === turn &&
            !board[coordsToSquare(homeRow, 1)] &&
            !board[coordsToSquare(homeRow, 2)] &&
            !board[coordsToSquare(homeRow, 3)] &&
            !isSquareAttacked(board, coordsToSquare(homeRow, 3), enemy) &&
            !isSquareAttacked(board, coordsToSquare(homeRow, 2), enemy)
          ) {
            pseudo.push({
              from: kingHome,
              to: coordsToSquare(homeRow, 2),
              piece: 'k',
              color: turn,
              isCastle: 'Q',
            });
          }
        }
      }
    }
  }

  // Filter out moves that leave own king in check
  const legal: ChessMove[] = [];
  const scratch = board.slice();
  for (let i = 0; i < pseudo.length; i++) {
    const m = pseudo[i];
    const undo = applyMoveToBoardMutating(scratch, m);
    if (!isColorInCheck(scratch, turn)) {
      legal.push(m);
    }
    undoMoveOnBoardMutating(scratch, m, undo.capturedPiece, undo.epCapturedSq);
  }

  return legal;
}

export function isInsufficientMaterial(board: (Piece | null)[]): boolean {
  const minors: Array<{ color: PieceColor; type: PieceType; squareColor: number }> = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p || p.type === 'k') continue;
    if (p.type === 'p' || p.type === 'r' || p.type === 'q') return false;
    const row = sq >> 3;
    const col = sq & 7;
    minors.push({ color: p.color, type: p.type, squareColor: (row + col) & 1 });
  }
  if (minors.length <= 1) return true;
  if (
    minors.length === 2 &&
    minors[0].type === 'b' &&
    minors[1].type === 'b' &&
    minors[0].squareColor === minors[1].squareColor
  ) {
    return true;
  }
  return false;
}

function formatMoveSan(
  prevState: ChessState,
  move: ChessMove,
  allLegalFromPrev: ChessMove[],
  nextInCheck: boolean,
  nextStatus: ChessGameStatus
): string {
  const suffix = nextStatus === 'checkmate' ? '#' : nextInCheck ? '+' : '';
  if (move.isCastle === 'K') return `O-O${suffix}`;
  if (move.isCastle === 'Q') return `O-O-O${suffix}`;

  const toAlg = squareToAlgebraic(move.to);
  const fromAlg = squareToAlgebraic(move.from);
  const promoStr = move.promotion ? `=${move.promotion.toUpperCase()}` : '';

  if (move.piece === 'p') {
    if (move.captured) {
      return `${fromAlg[0]}x${toAlg}${promoStr}${suffix}`;
    }
    return `${toAlg}${promoStr}${suffix}`;
  }

  const pieceLetter = move.piece.toUpperCase();
  const ambiguous = allLegalFromPrev.filter(
    (other) =>
      other.from !== move.from &&
      other.to === move.to &&
      other.piece === move.piece &&
      other.color === move.color
  );

  let disambig = '';
  if (ambiguous.length > 0) {
    const sameFile = ambiguous.some((o) => (o.from & 7) === (move.from & 7));
    const sameRank = ambiguous.some((o) => (o.from >> 3) === (move.from >> 3));
    if (!sameFile) {
      disambig = fromAlg[0];
    } else if (!sameRank) {
      disambig = fromAlg[1];
    } else {
      disambig = fromAlg;
    }
  }

  const captureMark = move.captured ? 'x' : '';
  void prevState;
  return `${pieceLetter}${disambig}${captureMark}${toAlg}${suffix}`;
}

export function applyChessMove(state: ChessState, move: ChessMove): ChessState {
  const allLegal = generateLegalMoves(state);
  const nextBoard = state.board.slice();
  applyMoveToBoardMutating(nextBoard, move);

  const nextCastling: CastlingRights = { ...state.castling };
  if (move.piece === 'k') {
    if (move.color === 'w') {
      nextCastling.wK = false;
      nextCastling.wQ = false;
    } else {
      nextCastling.bK = false;
      nextCastling.bQ = false;
    }
  }
  // Rook moved or captured on home corner
  if (move.from === 63 || move.to === 63) nextCastling.wK = false;
  if (move.from === 56 || move.to === 56) nextCastling.wQ = false;
  if (move.from === 7 || move.to === 7) nextCastling.bK = false;
  if (move.from === 0 || move.to === 0) nextCastling.bQ = false;

  // En passant target square if pawn moved two ranks
  let nextEnPassant: number | null = null;
  if (move.piece === 'p' && Math.abs((move.to >> 3) - (move.from >> 3)) === 2) {
    nextEnPassant = (move.from + move.to) >> 1;
  }

  const nextTurn = oppositeColor(state.turn);
  const nextHalfMove = move.piece === 'p' || move.captured ? 0 : state.halfMoveClock + 1;
  const nextFullMove = state.turn === 'b' ? state.fullMoveNumber + 1 : state.fullMoveNumber;

  const posKey = getPositionKey(nextBoard, nextTurn, nextCastling, nextEnPassant);
  const nextPosCounts = {
    ...state.positionCounts,
    [posKey]: (state.positionCounts[posKey] ?? 0) + 1,
  };

  const nextInCheck = isColorInCheck(nextBoard, nextTurn);
  const nextLegalMoves = generateLegalMoves({
    board: nextBoard,
    turn: nextTurn,
    castling: nextCastling,
    enPassantSquare: nextEnPassant,
  });

  let nextStatus: ChessGameStatus = 'playing';
  let winner: PieceColor | null = null;

  if (nextLegalMoves.length === 0) {
    if (nextInCheck) {
      nextStatus = 'checkmate';
      winner = state.turn;
    } else {
      nextStatus = 'stalemate';
    }
  } else if (nextHalfMove >= 100) {
    nextStatus = 'draw_fifty';
  } else if (nextPosCounts[posKey] >= 3) {
    nextStatus = 'draw_repetition';
  } else if (isInsufficientMaterial(nextBoard)) {
    nextStatus = 'draw_insufficient';
  }

  const san = formatMoveSan(state, move, allLegal, nextInCheck, nextStatus);
  const recordedMove: ChessMove = { ...move, san };

  return {
    board: nextBoard,
    turn: nextTurn,
    castling: nextCastling,
    enPassantSquare: nextEnPassant,
    halfMoveClock: nextHalfMove,
    fullMoveNumber: nextFullMove,
    history: [...state.history, recordedMove],
    positionCounts: nextPosCounts,
    status: nextStatus,
    winner,
    inCheck: nextInCheck,
  };
}

export function replayMoves(moves: ChessMove[]): ChessState {
  let curr = createInitialChessState();
  for (const m of moves) {
    curr = applyChessMove(curr, m);
  }
  return curr;
}

const PIECE_MATERIAL_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export function computeCapturedAndMaterial(history: ChessMove[]): {
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  whiteAdvantage: number;
} {
  const capturedByWhite: PieceType[] = [];
  const capturedByBlack: PieceType[] = [];
  let whitePts = 0;
  let blackPts = 0;

  for (const m of history) {
    if (!m.captured) continue;
    if (m.color === 'w') {
      capturedByWhite.push(m.captured);
      whitePts += PIECE_MATERIAL_VALUES[m.captured];
    } else {
      capturedByBlack.push(m.captured);
      blackPts += PIECE_MATERIAL_VALUES[m.captured];
    }
  }

  const sortOrder: Record<PieceType, number> = { q: 5, r: 4, b: 3, n: 2, p: 1, k: 0 };
  capturedByWhite.sort((a, b) => sortOrder[b] - sortOrder[a]);
  capturedByBlack.sort((a, b) => sortOrder[b] - sortOrder[a]);

  return {
    capturedByWhite,
    capturedByBlack,
    whiteAdvantage: whitePts - blackPts,
  };
}
