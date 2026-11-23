import test from 'node:test';
import assert from 'node:assert/strict';
import { CIRCUITS, buildTrack, projectPointToTrack } from './track';
import {
  createInitialRaceWorld,
  formatRaceTime,
  speedToKmh,
  stepRaceWorld,
} from './engine';
import type { RaceInput } from './types';

const IDLE_INPUT: RaceInput = {
  throttle: false,
  brake: false,
  left: false,
  right: false,
  drift: false,
  boost: false,
};

const FULL_THROTTLE: RaceInput = {
  throttle: true,
  brake: false,
  left: false,
  right: false,
  drift: false,
  boost: false,
};

test('Both closed racing circuits build smoothly with valid arc length and projection', () => {
  for (const def of CIRCUITS) {
    const track = buildTrack(def);
    assert.equal(track.samples.length, 240);
    assert.ok(track.totalLength > 5000, `${def.name} should be a full-length circuit`);
    assert.equal(track.checkpointIndices.length, 4);

    // Projecting sample #40 offset +30px along normal recovers lateralOffset ~30
    const s = track.samples[40];
    const proj = projectPointToTrack(track, s.x + s.nx * 30, s.y + s.ny * 30, 38);
    assert.equal(proj.sampleIndex, 40);
    assert.ok(Math.abs(proj.lateralOffset - 30) < 1.5);
  }
});

test('Player car accelerates cleanly, survives idle start, and consumes nitro when boosting', () => {
  const world = createInitialRaceWorld('obsidian-ring', true);
  const player = world.racers.find((r) => r.isPlayer)!;
  const startX = player.x;
  const startY = player.y;
  const startNitro = player.nitro;

  // Idle survival check: 2 seconds with zero input produces zero NaN and stays on track
  for (let i = 0; i < 60; i++) {
    stepRaceWorld(world, IDLE_INPUT, 1 / 30);
  }
  assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
  assert.equal(player.offTrack, false);

  // Accelerate for 1.5s then trigger boost
  for (let i = 0; i < 45; i++) {
    stepRaceWorld(world, FULL_THROTTLE, 1 / 30);
  }
  const distMoved = Math.hypot(player.x - startX, player.y - startY);
  assert.ok(distMoved > 220, 'Player car should accelerate briskly down opening straight');
  assert.ok(speedToKmh(player.speed) > 120);

  const nitroBeforeBoost = player.nitro;
  for (let i = 0; i < 20; i++) {
    stepRaceWorld(world, { ...FULL_THROTTLE, boost: true }, 1 / 30);
  }
  assert.ok(player.nitro < nitroBeforeBoost, 'Boost should consume nitro charge');
  assert.ok(player.nitro <= startNitro + 20);
});

test('All 3 AI opponents race autonomously around the track and maintain valid ranks 1..4', () => {
  const world = createInitialRaceWorld('harbor-chicane', true);
  const initialPositions = world.racers.map((r) => ({ id: r.id, x: r.x, y: r.y }));

  // Simulate 10 seconds at 30Hz
  for (let i = 0; i < 300; i++) {
    stepRaceWorld(world, FULL_THROTTLE, 1 / 30);
  }

  for (const r of world.racers) {
    if (r.isPlayer) continue;
    const orig = initialPositions.find((p) => p.id === r.id)!;
    const moved = Math.hypot(r.x - orig.x, r.y - orig.y);
    assert.ok(moved > 500, `AI opponent ${r.name} must drive along the track`);
    assert.ok(r.totalProgress > 1200, `AI opponent ${r.name} must make forward lap progress`);
  }

  const ranks = world.racers.map((r) => r.rank).sort((a, b) => a - b);
  assert.deepEqual(ranks, [1, 2, 3, 4], 'Ranks must always be a clean permutation of 1..4');
});

test('Reverse crossing of Start/Finish does not falsely increment lap count or progress on Lap 2', () => {
  const world = createInitialRaceWorld('obsidian-ring', true);
  const player = world.racers.find((r) => r.isPlayer)!;
  assert.equal(player.lap, 1);

  // Reverse for 2 seconds behind start line on Lap 1
  for (let i = 0; i < 60; i++) {
    stepRaceWorld(world, { ...IDLE_INPUT, brake: true }, 1 / 30);
  }
  assert.equal(player.lap, 1, 'Reversing across finish line must not award a lap');

  // Simulate being nudged behind start line at start of Lap 2 (nextCheckpoint === 0)
  player.lap = 2;
  player.nextCheckpoint = 0;
  const nearEndSample = world.track.samples[world.track.samples.length - 5];
  player.x = nearEndSample.x;
  player.y = nearEndSample.y;
  player.trackSampleIdx = world.track.samples.length - 5;
  player.speed = 0;
  stepRaceWorld(world, IDLE_INPUT, 1 / 30);
  assert.ok(
    player.totalProgress < world.track.totalLength * 1.1,
    `Lap 2 behind start line must not jump ahead by ~1 full lap (got ${player.totalProgress} vs len ${world.track.totalLength})`
  );
});

test('formatRaceTime formats milliseconds cleanly to MM:SS.t', () => {
  assert.equal(formatRaceTime(0), '00:00.0');
  assert.equal(formatRaceTime(65420), '01:05.4');
});
