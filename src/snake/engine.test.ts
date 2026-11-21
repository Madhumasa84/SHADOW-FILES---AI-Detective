import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSnakeWorld,
  enqueueSnakeDirection,
  stepSnakeGridTick,
} from './engine';

test('Snake spawns centered facing right and rejects immediate 180-degree reversal', () => {
  const w = createInitialSnakeWorld('classic', false, () => 0.5);
  assert.equal(w.segments.length, 4);
  assert.equal(w.direction, 'right');

  enqueueSnakeDirection(w, 'left');
  assert.equal(w.inputQueue.length, 0);

  enqueueSnakeDirection(w, 'down');
  enqueueSnakeDirection(w, 'left');
  assert.deepEqual(w.inputQueue, ['down', 'left']);
});

test('Eating food grows snake, increases score, and spawns food outside snake body', () => {
  const w = createInitialSnakeWorld('classic', false, () => 0.4);
  const head = w.segments[0];
  w.food = { x: head.x + 1, y: head.y };

  stepSnakeGridTick(w, () => 0.25);
  assert.equal(w.segments.length, 5);
  assert.equal(w.score, 10);
  assert.equal(w.events.ateFood, true);
  assert.equal(
    w.segments.some((s) => s.x === w.food.x && s.y === w.food.y),
    false
  );
});

test('Solid wall mode triggers crash at arena edge while wrap mode wraps cleanly', () => {
  const solid = createInitialSnakeWorld('classic', false, () => 0.2);
  solid.segments[0] = { x: solid.cols - 1, y: 5 };
  solid.direction = 'right';
  stepSnakeGridTick(solid, () => 0.2);
  assert.equal(solid.isGameOver, true);
  assert.equal(solid.deathReason, 'wall');

  const wrap = createInitialSnakeWorld('classic', true, () => 0.2);
  wrap.segments = [
    { x: wrap.cols - 1, y: 5 },
    { x: wrap.cols - 2, y: 5 },
    { x: wrap.cols - 3, y: 5 },
  ];
  wrap.direction = 'right';
  wrap.food = { x: 10, y: 10 };
  stepSnakeGridTick(wrap, () => 0.2);
  assert.equal(wrap.isGameOver, false);
  assert.equal(wrap.segments[0].x, 0);
});

test('Self-collision ends the run cleanly', () => {
  const w = createInitialSnakeWorld('classic', false, () => 0.3);
  w.segments = [
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 6, y: 6 },
    { x: 5, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 5 },
  ];
  w.direction = 'down';
  w.food = { x: 1, y: 1 };
  stepSnakeGridTick(w, () => 0.3);
  assert.equal(w.isGameOver, true);
  assert.equal(w.deathReason, 'self');
});
