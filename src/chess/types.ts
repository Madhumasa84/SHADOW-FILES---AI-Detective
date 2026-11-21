export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionType = 'q' | 'r' | 'b' | 'n';

export interface Piece {
  color: PieceColor;
  type: PieceType;
}

export interface CastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface ChessMove {
  from: number; // 0..63 (0 = a8, 63 = h1)
  to: number;
  piece: PieceType;
  color: PieceColor;
  captured?: PieceType;
  promotion?: PromotionType;
  isEnPassant?: boolean;
  isCastle?: 'K' | 'Q';
  san?: string;
}

export type ChessGameStatus =
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'draw_fifty'
  | 'draw_insufficient'
  | 'draw_repetition'
  | 'resigned';

export interface ChessState {
  board: (Piece | null)[]; // length 64
  turn: PieceColor;
  castling: CastlingRights;
  enPassantSquare: number | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  history: ChessMove[];
  positionCounts: Record<string, number>;
  status: ChessGameStatus;
  winner: PieceColor | null; // null on draw or playing
  inCheck: boolean;
}

export interface EloProfile {
  rating: number; // 500..3000
  title: string;
  persona: string;
  summary: string;
  searchDepth: number;
  quiescenceDepth: number;
  noiseCp: number;
  blunderRate: number;
  bookChance: number;
  timeBudgetMs: number;
}

export interface ChessRecords {
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  highestEloBeaten: number | null;
}
