import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCamera3D,
  clipQuadToNearPlane,
  clipSegmentToNearPlane,
  computeTurnAdvisory,
  getRelativeCarYaw,
  projectCameraPoint,
  projectWorldPoint,
  worldToCamera,
} from './projection.ts';
import { buildTrack, CIRCUITS } from './track.ts';

test('worldToCamera maps forward, right, and behind points accurately for heading East', () => {
  const cam = buildCamera3D({
    mode: 'chase',
    playerX: 100,
    playerY: 0,
    camAngle: 0, // Facing +X; right is +Y
    speedRatio: 0,
    boosting: false,
    shakeX: 0,
    shakeY: 0,
    viewW: 1280,
    viewH: 720,
  });

  // Player sits ahead of the chase camera at ~108 world units
  const playerCam = worldToCamera(cam, 100, 0, 0);
  assert.ok(playerCam.cz > 90 && playerCam.cz < 130, `expected player depth ~108, got ${playerCam.cz}`);
  assert.ok(Math.abs(playerCam.cx) < 1e-6);

  // Point to the driver's right (+Y) maps to positive cx
  const rightPt = worldToCamera(cam, 200, 50, 0);
  assert.ok(rightPt.cx > 49.9 && rightPt.cx < 50.1);
  assert.ok(rightPt.cz > playerCam.cz);
});

test('perspective projection shrinks distant points monotonically and culls behind-camera points', () => {
  const cam = buildCamera3D({
    mode: 'chase',
    playerX: 0,
    playerY: 0,
    camAngle: 0,
    speedRatio: 0.4,
    boosting: false,
    shakeX: 0,
    shakeY: 0,
    viewW: 1440,
    viewH: 900,
  });

  const near = projectWorldPoint(cam, 60, 40, 0);
  const far = projectWorldPoint(cam, 460, 40, 0);
  const behind = projectWorldPoint(cam, -300, 0, 0);

  assert.ok(near !== null && far !== null);
  assert.equal(behind, null);
  assert.ok(near.scale > far.scale, 'nearer objects must have larger screen scale');
  assert.ok(near.sy > far.sy, 'nearer ground points must appear lower on screen than distant ones');
  assert.ok(near.sx > far.sx, 'right-side lane converges toward screen center in the distance');
});

test('clipSegmentToNearPlane and clipQuadToNearPlane cleanly clip geometry straddling nearZ', () => {
  const clippedSeg = clipSegmentToNearPlane(
    { cx: -50, cy: 0, cz: -10 },
    { cx: 50, cy: 0, cz: 90 },
    10
  );
  assert.ok(clippedSeg !== null);
  assert.equal(clippedSeg[0].cz, 10);
  assert.equal(clippedSeg[1].cz, 90);
  // At t = (10 - (-10)) / (90 - (-10)) = 0.2 -> cx = -50 + 100 * 0.2 = -30
  assert.ok(Math.abs(clippedSeg[0].cx - -30) < 1e-6);

  const cam = buildCamera3D({
    mode: 'hood',
    playerX: 0,
    playerY: 0,
    camAngle: 0,
    speedRatio: 0,
    boosting: false,
    shakeX: 0,
    shakeY: 0,
    viewW: 1280,
    viewH: 720,
  });

  const quad = [
    { cx: -100, cy: 0, cz: -20 },
    { cx: 100, cy: 0, cz: -20 },
    { cx: 100, cy: 0, cz: 100 },
    { cx: -100, cy: 0, cz: 100 },
  ];
  const clippedQuad = clipQuadToNearPlane(quad, cam.nearZ);
  assert.equal(clippedQuad.length, 4);
  for (const pt of clippedQuad) {
    assert.ok(pt.cz >= cam.nearZ - 1e-6, 'all clipped vertices must lie on or in front of nearZ');
  }

  for (const pt of clippedQuad) {
    const sp = projectCameraPoint(cam, pt);
    assert.ok(sp !== null && Number.isFinite(sp.sx) && Number.isFinite(sp.sy));
  }
});

test('getRelativeCarYaw wraps cleanly and computeTurnAdvisory detects corners on Obsidian Ring', () => {
  assert.ok(Math.abs(getRelativeCarYaw(0.2, 0.2)) < 1e-6);
  assert.ok(getRelativeCarYaw(Math.PI * 1.9, 0.1) < 0);

  const track = buildTrack(CIRCUITS[0]);
  let foundRight = false;
  let foundStraight = false;
  for (let i = 0; i < track.samples.length; i++) {
    const adv = computeTurnAdvisory(track, i);
    if (adv.direction === 'right') foundRight = true;
    if (adv.direction === 'none') foundStraight = true;
  }
  assert.ok(foundRight, 'expected right-hand corners on clockwise Obsidian Ring');
  assert.ok(foundStraight, 'expected straight sections with no turn warning');
});
