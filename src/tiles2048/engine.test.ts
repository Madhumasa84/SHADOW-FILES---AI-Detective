import test from 'node:test';
import assert from 'node:assert/strict';
import {
  continueEndless2048,
  createInitial2048State,
  hasValidMoves2048,
  move2048,
  undo2048,
  type State2048,
  type Tile2048,
} from './engine';

function makeCustomState(values: number[][]): State2048 {
  let id = 1;
  let highest = 0;
  const grid: (Tile2048 | null)[][] = values.map((row, r) =>
    row.map((val, c) => {
      if (val === 0) return null;
      if (val > highest) highest = val;
      return { id: id++, value: val, row: r, col: c };
    })
  );
  return {
    size: values.length as 4 | 5,
    grid,
    score: 0,
    moves: 0,
    highestTile: highest,
    nextTileId: id,
    wonMilestone: false,
    keepGoing: false,
    isGameOver: false,
    undosRemaining: 3,
    history: [],
    lastGain: 0,
    lastMergedMax: 0,
  };
}

test('Initial 2048 board spawns exactly 2 tiles on empty grid', () => {
  const s = createInitial2048State(4, () => 0.1);
  const tiles = s.grid.flat().filter(Boolean);
  assert.equal(tiles.length, 2);
  assert.equal(s.score, 0);
  assert.equal(s.isGameOver, false);
});

test('Slide left merges equal pairs once per move without double-merging', () => {
  const start = makeCustomState([
    [2, 2, 4, 0],
    [2, 2, 2, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  const { state: next, moved } = move2048(start, 'left', () => 0.5);
  assert.equal(moved, true);
  // Row 0: [2,2,4,0] -> [4,4,0,0] (NOT [8,0,0,0]!)
  assert.equal(next.grid[0][0]?.value, 4);
  assert.equal(next.grid[0][1]?.value, 4);
  // Row 1: [2,2,2,2] -> [4,4,0,0]
  assert.equal(next.grid[1][0]?.value, 4);
  assert.equal(next.grid[1][1]?.value, 4);
  assert.equal(next.score, 12);
});

test('Reaching 2048 triggers milestone win and allows endless continuation', () => {
  const start = makeCustomState([
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  const { state: won } = move2048(start, 'left', () => 0.2);
  assert.equal(won.highestTile, 2048);
  assert.equal(won.wonMilestone, true);
  assert.equal(won.score, 2048);

  const endless = continueEndless2048(won);
  const { moved } = move2048(endless, 'right', () => 0.2);
  assert.equal(moved, true);
});

test('Undo restores previous board and decrements remaining undos', () => {
  const start = makeCustomState([
    [4, 4, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const { state: movedState } = move2048(start, 'left', () => 0.1);
  assert.equal(movedState.score, 8);
  const undone = undo2048(movedState);
  assert.equal(undone.score, 0);
  assert.equal(undone.undosRemaining, 2);
  assert.equal(undone.grid[0][0]?.value, 4);
  assert.equal(undone.grid[0][1]?.value, 4);
});

test('Full board with no adjacent equal tiles detects game over accurately', () => {
  const locked = makeCustomState([
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 64],
  ]);
  assert.equal(hasValidMoves2048(locked.grid), false);
});
