import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialTetrisWorld,
  getGhostRow,
  hardDropTetrisPiece,
  holdTetrisPiece,
  rotateTetrisPiece,
  shuffleBag,
  TETROMINO_TYPES,
} from './engine';

test('7-Bag randomizer always yields a complete permutation of all 7 tetrominoes', () => {
  const bag = shuffleBag(() => 0.42);
  assert.equal(bag.length, 7);
  assert.deepEqual([...bag].sort(), [...TETROMINO_TYPES].sort());
});

test('Hard drop lands active piece at ghost row, awards drop score, and spawns next piece', () => {
  const w = createInitialTetrisWorld(1, () => 0.3);
  const initialType = w.active.type;
  const ghostRow = getGhostRow(w.board, w.active);
  assert.ok(ghostRow >= 16);

  const dropped = hardDropTetrisPiece(w, () => 0.3);
  assert.equal(dropped, ghostRow);
  assert.ok(w.score >= dropped * 2);

  // At least 4 filled cells on bottom rows belonging to the initial piece
  const filled = w.board.flat().filter((cell) => cell === initialType).length;
  assert.equal(filled, 4);
});

test('Completing a full row clears it, awards line score, and increments lines count', () => {
  const w = createInitialTetrisWorld(1, () => 0.2);
  // Fill bottom row except columns 3..6, then drop a horizontal I piece
  for (let c = 0; c < w.cols; c++) {
    if (c < 3 || c > 6) {
      w.board[w.rows - 1][c] = 'J';
    }
  }
  w.active = { type: 'I', rotation: 0, row: 0, col: 3 };
  hardDropTetrisPiece(w, () => 0.2);

  assert.equal(w.lines, 1);
  assert.equal(w.events.linesCleared, 1);
  assert.ok(w.score >= 100);
  // Bottom row should now be completely empty
  assert.equal(w.board[w.rows - 1].every((cell) => cell === null), true);
});

test('Hold piece swaps cleanly and locks hold until next piece drop', () => {
  const w = createInitialTetrisWorld(1, () => 0.6);
  const first = w.active.type;
  const swapped = holdTetrisPiece(w, () => 0.6);
  assert.equal(swapped, true);
  assert.equal(w.hold, first);
  assert.equal(w.holdUsedThisTurn, true);

  // Second hold in the same drop must be rejected
  assert.equal(holdTetrisPiece(w, () => 0.6), false);
});

test('Rotation succeeds with wall kicks next to left and right edges', () => {
  const w = createInitialTetrisWorld(1, () => 0.5);
  w.active = { type: 'T', rotation: 1, row: 5, col: -1 };
  const ok = rotateTetrisPiece(w, 1);
  assert.equal(ok, true);
  assert.ok(w.active.col >= 0);
});

test('Starting at Level 9 advances to Level 10 after 10 lines cleared and sets locked event', () => {
  const w = createInitialTetrisWorld(9, () => 0.2);
  assert.equal(w.level, 9);
  w.lines = 9;
  for (let c = 0; c < w.cols; c++) {
    if (c < 3 || c > 6) {
      w.board[w.rows - 1][c] = 'J';
    }
  }
  w.active = { type: 'I', rotation: 0, row: 0, col: 3 };
  hardDropTetrisPiece(w, () => 0.2);

  assert.equal(w.lines, 10);
  assert.equal(w.level, 10);
  assert.equal(w.events.locked, true);
});
