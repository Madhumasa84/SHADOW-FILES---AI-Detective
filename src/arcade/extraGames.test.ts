import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseC4AIMove,
  createInitialC4State,
  dropC4Disc,
} from './connect4';
import {
  applyReversiMove,
  chooseReversiAIMove,
  createInitialReversiState,
  getLegalReversiMoves,
} from './reversi';
import {
  applyCheckersMove,
  chooseCheckersAIMove,
  createInitialCheckersState,
  getLegalCheckersMoves,
  type CheckersPiece,
} from './checkers';
import {
  computeProbabilityHeatmap,
  createInitialBattleshipState,
  executeAIShot,
  firePlayerShot,
  generateRandomFleet,
} from './battleship';
import {
  chooseGomokuAIMove,
  createInitialGomokuState,
  placeGomokuStone,
} from './gomoku';
import {
  countSudokuSolutions,
  createSudokuPuzzle,
  findSudokuHint,
  setSudokuCell,
} from './sudoku';
import {
  createInitialMinesweeperState,
  findMinesweeperHint,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from './minesweeper';
import {
  appendCipherLetter,
  createInitialCipherState,
  evaluateCipherGuess,
  recommendCipherGuess,
  submitCipherGuess,
} from './cipher';
import { createInitialBreakoutWorld, stepBreakoutWorld } from './breakout';
import {
  createInitialPongWorld,
  predictBallInterceptY,
  stepPongWorld,
} from './pong';

test('Connect4: AI takes immediate winning drop and blocks human 3-in-a-row', () => {
  let state = createInitialC4State();
  // Human plays 0, 1, 2 on bottom row -> AI must block column 3
  state = dropC4Disc(state, 0); // P1
  state = dropC4Disc(state, 6); // P2
  state = dropC4Disc(state, 1); // P1
  state = dropC4Disc(state, 6); // P2
  state = dropC4Disc(state, 2); // P1
  const aiBlock = chooseC4AIMove(state, 'grandmaster', 2);
  assert.equal(aiBlock, 3, 'AI should block immediate horizontal 4-in-a-row at col 3');

  // If AI already has 3 in col 6, AI takes immediate win at col 6
  let winState = createInitialC4State();
  winState = dropC4Disc(winState, 0); // P1
  winState = dropC4Disc(winState, 6); // P2
  winState = dropC4Disc(winState, 1); // P1
  winState = dropC4Disc(winState, 6); // P2
  winState = dropC4Disc(winState, 4); // P1
  winState = dropC4Disc(winState, 6); // P2
  winState = dropC4Disc(winState, 2); // P1
  const aiWin = chooseC4AIMove(winState, 'grandmaster', 2);
  assert.equal(aiWin, 6, 'AI should immediately complete vertical 4-in-a-row at col 6');
});

test('Reversi: opening has 4 legal moves, flips opponent disc, and AI chooses a legal reply', () => {
  const init = createInitialReversiState();
  const moves = getLegalReversiMoves(init.board, 1);
  assert.equal(moves.length, 4);
  const afterP1 = applyReversiMove(init, moves[0].row, moves[0].col);
  assert.equal(afterP1.blackCount, 4);
  assert.equal(afterP1.whiteCount, 1);
  assert.equal(afterP1.turn, 2);

  const aiMove = chooseReversiAIMove(afterP1, 'tactician', 2);
  assert.ok(aiMove !== null);
  const afterAI = applyReversiMove(afterP1, aiMove!.row, aiMove!.col);
  assert.equal(afterAI.turn, 1);
});

test('Checkers: enforces mandatory jumps, King promotion, and valid AI move', () => {
  const board: (CheckersPiece | null)[][] = Array.from({ length: 8 }, () =>
    Array<CheckersPiece | null>(8).fill(null)
  );
  board[2][1] = { owner: 'gold', king: false };
  board[1][2] = { owner: 'obsidian', king: false };
  board[5][6] = { owner: 'gold', king: false };

  const moves = getLegalCheckersMoves(board, 'gold');
  assert.equal(moves.length, 1, 'Mandatory jump must filter out quiet moves');
  assert.equal(moves[0].captures.length, 1);
  assert.equal(moves[0].promotes, true, 'Landing on row 0 promotes gold piece to King');

  const state = createInitialCheckersState();
  const firstMoves = getLegalCheckersMoves(state.board, 'gold');
  const next = applyCheckersMove(state, firstMoves[0]);
  assert.equal(next.turn, 'obsidian');
  const aiMove = chooseCheckersAIMove(next, 'tactician');
  assert.ok(aiMove !== null);
});

test('Battleship: generates valid non-overlapping 17-cell fleet and spikes heatmap around hits', () => {
  const fleet = generateRandomFleet();
  assert.equal(fleet.length, 5);
  const seen = new Set<string>();
  for (const s of fleet) {
    for (const [r, c] of s.cells) {
      assert.ok(r >= 0 && r < 10 && c >= 0 && c < 10);
      seen.add(`${r},${c}`);
    }
  }
  assert.equal(seen.size, 17, '5+4+3+3+2 ships must occupy 17 unique squares');

  let st = createInitialBattleshipState();
  const targetShipCell = st.aiShips[0].cells[0];
  const fired = firePlayerShot(st, targetShipCell[0], targetShipCell[1]);
  assert.equal(fired.result, 'hit');
  st = fired.state;

  const heat = computeProbabilityHeatmap(st.playerShots, st.aiShips);
  // Adjacent un-shot cell to the hit must have higher density than far corner
  const [hr, hc] = targetShipCell;
  const neighbors = [
    [hr - 1, hc],
    [hr + 1, hc],
    [hr, hc - 1],
    [hr, hc + 1],
  ].filter(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10 && st.playerShots[r][c] === 'empty');
  const maxAdjHeat = Math.max(...neighbors.map(([r, c]) => heat[r][c]));
  assert.ok(maxAdjHeat > 20, 'Bayesian heatmap must strongly weight orthogonal neighbors of live hits');

  const aiReply = executeAIShot(st, 'admiral');
  assert.equal(aiReply.state.turn, 'player');
});

test('Gomoku: detects 5-in-a-row win and AI blocks open-four threat', () => {
  let state = createInitialGomokuState();
  for (let c = 5; c <= 8; c++) {
    state = placeGomokuStone(state, 7, c); // P1 builds 4 in a row
    state = placeGomokuStone(state, 0, (c - 5) * 3); // P2 scattered stones (no winning line)
  }
  // Now simulate P2 facing P1's open 4-in-a-row
  const block = chooseGomokuAIMove({ ...state, turn: 2 }, 'grandmaster', 2);
  assert.ok(block !== null);
  assert.equal(block![0], 7);
  assert.ok(block![1] === 4 || block![1] === 9, 'AI must block open 4 at (7,4) or (7,9)');

  // Completing 5 triggers win
  const won = placeGomokuStone(state, 7, 9);
  assert.equal(won.winner, 1);
  assert.equal(won.winningLine.length, 5);
});

test('Sudoku: generates uniquely solvable puzzle and Smart Logic Hint matches true solution', () => {
  const puzzle = createSudokuPuzzle('novice');
  assert.equal(puzzle.solution.length, 81);
  assert.equal(countSudokuSolutions(puzzle.values, 2), 1, 'Generated Sudoku must have exactly 1 solution');

  const hint = findSudokuHint(puzzle);
  assert.ok(hint !== null);
  assert.equal(hint!.value, puzzle.solution[hint!.index], 'Hint must equal exact unique solution digit');

  const updated = setSudokuCell(puzzle, hint!.index, hint!.value);
  assert.equal(updated.values[hint!.index], hint!.value);
  assert.equal(updated.mistakes, 0);
});

test('Minesweeper: first click is guaranteed safe and CSP hint deduces provable cells', () => {
  let state = createInitialMinesweeperState('sector9');
  state = revealMinesweeperCell(state, 4, 4);
  assert.equal(state.status, 'playing', 'First click must never detonate a mine');
  assert.equal(state.cells[4][4].revealed, true);
  assert.equal(state.cells[4][4].adjacent, 0, '3x3 opening safety guarantees 0 adjacent mines at center');

  // Find an unrevealed cell to test flag toggling
  let targetCell: [number, number] | null = null;
  for (let r = 0; r < 9 && !targetCell; r++) {
    for (let c = 0; c < 9 && !targetCell; c++) {
      if (!state.cells[r][c].revealed) targetCell = [r, c];
    }
  }
  assert.ok(targetCell !== null, 'Some cells must remain unrevealed after first click');
  const flagged = toggleMinesweeperFlag(state, targetCell![0], targetCell![1]);
  assert.equal(flagged.flagsPlaced, 1);

  const hint = findMinesweeperHint(state);
  assert.ok(hint !== null);
  assert.ok(hint!.row >= 0 && hint!.row < 9 && hint!.col >= 0 && hint!.col < 9);
});

test('Cipher Vault: accurately scores duplicate letters and Shannon-entropy hint narrows lexicon', () => {
  // Target: BRASS, Guess: SASSY -> S(0) present, A(1) present, S(2) absent (S(3) is correct!), S(3) correct, Y(4) absent
  const evalDup = evaluateCipherGuess('SASSY', 'BRASS');
  assert.deepEqual(evalDup, ['present', 'present', 'absent', 'correct', 'absent']);

  let state = createInitialCipherState(false, 'VAULT');
  for (const ch of 'SLATE') state = appendCipherLetter(state, ch);
  state = submitCipherGuess(state);
  assert.equal(state.rows.length, 1);
  assert.equal(state.status, 'playing');

  const hint = recommendCipherGuess(state);
  assert.ok(hint !== null);
  assert.equal(hint!.word.length, 5);
  assert.ok(hint!.remainingCount >= 1);

  for (const ch of 'VAULT') state = appendCipherLetter(state, ch);
  state = submitCipherGuess(state);
  assert.equal(state.status, 'won');
});

test('Prism Breaker (Breakout): launches ball, moves cleanly, and shatters brick on collision', () => {
  const world = createInitialBreakoutWorld(760, 540, 1);
  const initialBricks = world.bricks.length;
  assert.ok(initialBricks > 20);

  stepBreakoutWorld(world, { left: false, right: false, pointerX: null, launch: true }, 0.016);
  assert.equal(world.balls[0].stuckToPaddle, false);

  // Place ball directly below first breakable brick moving upward
  const target = world.bricks.find((b) => !b.indestructible && b.hp === 1)!;
  world.balls[0].x = target.x + target.w / 2;
  world.balls[0].y = target.y + target.h + world.balls[0].radius + 2;
  world.balls[0].vx = 0;
  world.balls[0].vy = -450;

  const ev = stepBreakoutWorld(world, { left: false, right: false, pointerX: null, launch: false }, 0.016);
  assert.equal(ev.brickBroken, true);
  assert.ok(world.score > 0);
  assert.equal(world.bricks.length, initialBricks - 1);
});

test('Velvet Pong: predictive trajectory intercept accounts for wall bounces and awards points', () => {
  const intercept = predictBallInterceptY(100, 240, 400, 0, 700, 480, 8);
  assert.equal(intercept, 240, 'Horizontal ball should intercept at same Y');

  const world = createInitialPongWorld('apex', 800, 480);
  world.servePause = 0;
  world.ballX = 795;
  world.ballY = 240;
  world.ballVx = 420;
  world.ballVy = 0;
  world.aiY = 60; // AI out of position

  let scored = false;
  for (let i = 0; i < 3; i++) {
    const ev = stepPongWorld(world, { up: false, down: false, pointerY: null }, 0.03);
    if (ev.playerScored) scored = true;
  }
  assert.equal(scored, true);
  assert.equal(world.playerScore, 1);
});
