import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampCameraPan,
  computeHotspotFocusTransform,
  getLocationTransitionPreset,
  getSuspectPortraitCamera,
  getWorkspaceCameraVariants,
} from './camera';

test('clampCameraPan keeps zoom <= 1 centered and strictly prevents black-edge reveal when zoomed', () => {
  assert.deepEqual(clampCameraPan(120, -80, 1, 1000, 560), { x: 0, y: 0 });
  assert.deepEqual(clampCameraPan(50, 50, 0.9, 1000, 560), { x: 0, y: 0 });

  // At 2x zoom on 1000x560, max pan is +/-500 horizontally and +/-280 vertically
  const clamped = clampCameraPan(999, -999, 2, 1000, 560);
  assert.equal(clamped.x, 500);
  assert.equal(clamped.y, -280);
});

test('computeHotspotFocusTransform dollies smoothly toward hotspot while clamping corner props safely', () => {
  // Center hotspot stays centered
  const center = computeHotspotFocusTransform(50, 50, 1000, 562, 1.72);
  assert.equal(center.zoom, 1.72);
  assert.equal(center.x, 0);
  assert.equal(center.y, 0);

  // Left-side vault hotspot (x: 19, y: 41) pans camera right (+x) and slightly down (+y)
  const vault = computeHotspotFocusTransform(19, 41, 1000, 562, 1.72);
  assert.ok(vault.x > 0, 'Left hotspot should shift scene right');
  assert.ok(vault.y > 0, 'Upper hotspot should shift scene down');
  assert.ok(vault.x <= ((1.72 - 1) * 1000) / 2, 'Must stay within right edge clamp');

  // Extreme corner hotspot on mobile viewport (390x220) never exceeds edge clamp
  const corner = computeHotspotFocusTransform(95, 95, 390, 220, 1.8);
  const maxX = ((1.8 - 1) * 390) / 2;
  const maxY = ((1.8 - 1) * 220) / 2;
  assert.ok(Math.abs(corner.x) <= maxX);
  assert.ok(Math.abs(corner.y) <= maxY);
});

test('getLocationTransitionPreset returns directional elevator camera presets across tower floors', () => {
  const down = getLocationTransitionPreset('penthouse-study', 'security-room');
  assert.equal(down.directionLabel, 'DESCENDING LIFT');
  assert.ok(down.enterY > 0);

  const up = getLocationTransitionPreset('underground-garage', 'penthouse-study');
  assert.equal(up.directionLabel, 'ASCENDING LIFT');
  assert.ok(up.enterY < 0);

  const opening = getLocationTransitionPreset(null, 'penthouse-study');
  assert.equal(opening.directionLabel, 'ESTABLISHING SHOT');
  assert.ok(opening.enterScale > 1);
});

test('getSuspectPortraitCamera increases lens tension cleanly across emotional escalation', () => {
  const composed = getSuspectPortraitCamera('composed', false);
  const defensive = getSuspectPortraitCamera('defensive', false);
  const rattled = getSuspectPortraitCamera('rattled', false);
  const contradicted = getSuspectPortraitCamera('defensive', true);

  assert.ok(defensive.scale > composed.scale);
  assert.ok(rattled.scale > defensive.scale);
  assert.ok(contradicted.scale >= rattled.scale);
  assert.ok(contradicted.vignetteOpacity > composed.vignetteOpacity);
});

test('getWorkspaceCameraVariants returns valid compositor-only transforms for every tab', () => {
  for (const tab of ['scenes', 'interrogation', 'board', 'notebook'] as const) {
    const v = getWorkspaceCameraVariants(tab);
    assert.equal(v.animate.opacity, 1);
    assert.equal(v.animate.scale, 1);
    assert.equal(v.animate.y, 0);
  }
});
