// FIVE IN A ROW — 15x15 Gomoku engine with Threat-Space Pattern Heuristic AI

export const GOMOKU_SIZE = 15;
export type GomokuStone = 0 | 1 | 2; // 1 = Obsidian (human), 2 = Ivory (AI)
export type GomokuDifficulty = 'club' | 'master' | 'grandmaster';

export interface GomokuState {
  board: GomokuStone[][];
  turn: 1 | 2;
  winner: 0 | 1 | 2 | 'draw';
  winningLine: Array<[number, number]>;
  lastMove: [number, number] | null;
  movesCount: number;
}

const AXES: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function createInitialGomokuState(): GomokuState {
  return {
    board: Array.from({ length: GOMOKU_SIZE }, () => Array<GomokuStone>(GOMOKU_SIZE).fill(0)),
    turn: 1,
    winner: 0,
    winningLine: [],
    lastMove: null,
    movesCount: 0,
  };
}

export function findGomokuWinFrom(
  board: GomokuStone[][],
  row: number,
  col: number,
  player: 1 | 2
): Array<[number, number]> {
  for (const [dr, dc] of AXES) {
    const line: Array<[number, number]> = [[row, col]];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (
        r >= 0 &&
        r < GOMOKU_SIZE &&
        c >= 0 &&
        c < GOMOKU_SIZE &&
        board[r][c] === player
      ) {
        if (sign === -1) line.unshift([r, c]);
        else line.push([r, c]);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 5) return line.slice(0, 5);
  }
  return [];
}

export function placeGomokuStone(state: GomokuState, row: number, col: number): GomokuState {
  if (state.winner !== 0) return state;
  if (row < 0 || row >= GOMOKU_SIZE || col < 0 || col >= GOMOKU_SIZE) return state;
  if (state.board[row][col] !== 0) return state;

  const board = state.board.map((r) => r.slice());
  board[row][col] = state.turn;
  const movesCount = state.movesCount + 1;
  const winLine = findGomokuWinFrom(board, row, col, state.turn);

  let winner: GomokuState['winner'] = 0;
  if (winLine.length >= 5) winner = state.turn;
  else if (movesCount >= GOMOKU_SIZE * GOMOKU_SIZE) winner = 'draw';

  return {
    board,
    turn: state.turn === 1 ? 2 : 1,
    winner,
    winningLine: winLine,
    lastMove: [row, col],
    movesCount,
  };
}

function evaluatePointForPlayer(
  board: GomokuStone[][],
  row: number,
  col: number,
  player: 1 | 2
): number {
  let total = 0;
  let openThrees = 0;
  let fours = 0;

  for (const [dr, dc] of AXES) {
    let count = 1;
    let openEnds = 0;

    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (
        r >= 0 &&
        r < GOMOKU_SIZE &&
        c >= 0 &&
        c < GOMOKU_SIZE &&
        board[r][c] === player
      ) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
      if (r >= 0 && r < GOMOKU_SIZE && c >= 0 && c < GOMOKU_SIZE && board[r][c] === 0) {
        openEnds++;
      }
    }

    if (count >= 5) return 2_000_000;
    if (count === 4 && openEnds === 2) {
      total += 220_000;
      fours++;
    } else if (count === 4 && openEnds === 1) {
      total += 32_000;
      fours++;
    } else if (count === 3 && openEnds === 2) {
      total += 18_000;
      openThrees++;
    } else if (count === 3 && openEnds === 1) {
      total += 1_400;
    } else if (count === 2 && openEnds === 2) {
      total += 900;
    } else if (count === 2 && openEnds === 1) {
      total += 160;
    } else if (count === 1 && openEnds === 2) {
      total += 40;
    }
  }

  // Fork bonuses (Double-Three or Four+Three are unstoppable threats)
  if (fours >= 2 || (fours >= 1 && openThrees >= 1)) total += 180_000;
  else if (openThrees >= 2) total += 65_000;

  return total;
}

function getCandidateCells(board: GomokuStone[][]): Array<[number, number]> {
  const hasAny = board.some((r) => r.some((c) => c !== 0));
  if (!hasAny) return [[7, 7]];

  const seen = new Set<string>();
  const candidates: Array<[number, number]> = [];
  for (let r = 0; r < GOMOKU_SIZE; r++) {
    for (let c = 0; c < GOMOKU_SIZE; c++) {
      if (board[r][c] === 0) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= GOMOKU_SIZE || nc < 0 || nc >= GOMOKU_SIZE) continue;
          if (board[nr][nc] !== 0) continue;
          const key = `${nr},${nc}`;
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push([nr, nc]);
          }
        }
      }
    }
  }
  return candidates;
}

export function chooseGomokuAIMove(
  state: GomokuState,
  difficulty: GomokuDifficulty = 'master',
  aiPlayer: 1 | 2 = state.turn
): [number, number] | null {
  const candidates = getCandidateCells(state.board);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const opp: 1 | 2 = aiPlayer === 1 ? 2 : 1;
  const board = state.board.map((r) => r.slice());

  const scored = candidates.map(([r, c]) => {
    const attack = evaluatePointForPlayer(board, r, c, aiPlayer);
    const defend = evaluatePointForPlayer(board, r, c, opp);
    const centerBias = 14 - (Math.abs(r - 7) + Math.abs(c - 7));
    // Slight defense weight ensures we always block imminent opponent threats
    const score = Math.max(attack, defend * 0.94) + attack * 0.18 + defend * 0.16 + centerBias;
    return { r, c, score, attack, defend };
  });

  scored.sort((a, b) => b.score - a.score);

  // Instant win or mandatory block
  if (scored[0].attack >= 2_000_000 || scored[0].defend >= 2_000_000) {
    return [scored[0].r, scored[0].c];
  }

  if (difficulty === 'club') {
    const top = scored.slice(0, Math.min(3, scored.length));
    const pick = top[Math.floor(Math.random() * top.length)];
    return [pick.r, pick.c];
  }

  if (difficulty === 'master') {
    return [scored[0].r, scored[0].c];
  }

  // Grandmaster: 2-ply lookahead on top 8 threat candidates
  const topCandidates = scored.slice(0, Math.min(8, scored.length));
  let bestMove: [number, number] = [topCandidates[0].r, topCandidates[0].c];
  let bestVal = -Infinity;

  for (const cand of topCandidates) {
    board[cand.r][cand.c] = aiPlayer;
    const replies = getCandidateCells(board);
    let worstOppThreat = 0;
    for (const [rr, rc] of replies) {
      const oppScore = evaluatePointForPlayer(board, rr, rc, opp);
      if (oppScore > worstOppThreat) worstOppThreat = oppScore;
    }
    board[cand.r][cand.c] = 0;

    const totalVal = cand.score - worstOppThreat * 0.55;
    if (totalVal > bestVal) {
      bestVal = totalVal;
      bestMove = [cand.r, cand.c];
    }
  }

  return bestMove;
}
