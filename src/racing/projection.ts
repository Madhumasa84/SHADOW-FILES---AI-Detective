import { normalizeAngle } from './engine.ts';
import type { BuiltTrack, CameraMode } from './types.ts';

export interface Camera3DConfig {
  mode: Exclude<CameraMode, 'topdown'>;
  x: number;
  y: number;
  angle: number;
  fwdX: number;
  fwdY: number;
  rightX: number;
  rightY: number;
  height: number;
  focal: number;
  horizonY: number;
  nearZ: number;
  farZ: number;
  viewW: number;
  viewH: number;
}

export interface CamPoint {
  cx: number; // Rightward offset in camera space
  cy: number; // World elevation above asphalt (0 = road)
  cz: number; // Forward depth from camera
}

export interface ScreenPoint {
  sx: number;
  sy: number;
  scale: number; // pixels per world unit at depth cz
  cz: number;
}

export interface TurnAdvisory {
  direction: 'left' | 'right' | 'none';
  severity: 'gentle' | 'sharp';
}

export function buildCamera3D(params: {
  mode: Exclude<CameraMode, 'topdown'>;
  playerX: number;
  playerY: number;
  camAngle: number;
  speedRatio: number;
  boosting: boolean;
  shakeX: number;
  shakeY: number;
  viewW: number;
  viewH: number;
}): Camera3DConfig {
  const {
    mode,
    playerX,
    playerY,
    camAngle,
    speedRatio,
    boosting,
    shakeX,
    shakeY,
    viewW,
    viewH,
  } = params;

  const fwdX = Math.cos(camAngle);
  const fwdY = Math.sin(camAngle);
  // Right-hand vector in (+X right, +Y down) world coordinates
  const rightX = -fwdY;
  const rightY = fwdX;

  const isHood = mode === 'hood';
  const backDist = isHood
    ? -6
    : 108 + speedRatio * 12 + (boosting ? 14 : 0);
  const height = isHood ? 24 : 46 + (boosting ? 2 : 0);

  // Dynamic FOV widens slightly at high speed / nitro for visceral speed sensation
  const baseFocalFactor = isHood ? 0.68 : 0.65;
  const fovStretch = 1 - speedRatio * 0.08 - (boosting ? 0.07 : 0);
  const focal = Math.max(320, Math.min(viewW, viewH * 1.65) * baseFocalFactor * fovStretch);

  const horizonBase = isHood ? 0.44 : 0.41;
  const horizonY = viewH * horizonBase + shakeY * 0.85;

  return {
    mode,
    x: playerX - fwdX * backDist + rightX * (shakeX * 0.25),
    y: playerY - fwdY * backDist + rightY * (shakeX * 0.25),
    angle: camAngle,
    fwdX,
    fwdY,
    rightX,
    rightY,
    height,
    focal,
    horizonY,
    nearZ: isHood ? 22 : 42,
    farZ: 2200,
    viewW,
    viewH,
  };
}

export function worldToCamera(
  cam: Camera3DConfig,
  wx: number,
  wy: number,
  worldElevation = 0
): CamPoint {
  const dx = wx - cam.x;
  const dy = wy - cam.y;
  return {
    cx: dx * cam.rightX + dy * cam.rightY,
    cy: worldElevation,
    cz: dx * cam.fwdX + dy * cam.fwdY,
  };
}

export function projectCameraPoint(cam: Camera3DConfig, pt: CamPoint): ScreenPoint | null {
  if (pt.cz < cam.nearZ) return null;
  const scale = cam.focal / pt.cz;
  return {
    sx: cam.viewW * 0.5 + pt.cx * scale,
    sy: cam.horizonY + (cam.height - pt.cy) * scale,
    scale,
    cz: pt.cz,
  };
}

export function projectWorldPoint(
  cam: Camera3DConfig,
  wx: number,
  wy: number,
  worldElevation = 0
): ScreenPoint | null {
  return projectCameraPoint(cam, worldToCamera(cam, wx, wy, worldElevation));
}

/**
 * Clips a 3D segment in camera space against the z = nearZ plane so road quads
 * and barriers passing directly beneath the camera never flip or invert.
 */
export function clipSegmentToNearPlane(
  a: CamPoint,
  b: CamPoint,
  nearZ: number
): [CamPoint, CamPoint] | null {
  const aIn = a.cz >= nearZ;
  const bIn = b.cz >= nearZ;
  if (!aIn && !bIn) return null;
  if (aIn && bIn) return [a, b];

  const denom = b.cz - a.cz;
  if (Math.abs(denom) < 1e-6) return null;
  const t = (nearZ - a.cz) / denom;
  const clipped: CamPoint = {
    cx: a.cx + (b.cx - a.cx) * t,
    cy: a.cy + (b.cy - a.cy) * t,
    cz: nearZ,
  };
  return aIn ? [a, clipped] : [clipped, b];
}

/**
 * Clips a 4-corner 3D quad (ordered around perimeter) against z >= nearZ
 * using Sutherland-Hodgman half-space clipping, returning a convex polygon in camera space.
 */
export function clipQuadToNearPlane(quad: CamPoint[], nearZ: number): CamPoint[] {
  const out: CamPoint[] = [];
  const n = quad.length;
  for (let i = 0; i < n; i++) {
    const curr = quad[i];
    const next = quad[(i + 1) % n];
    const currIn = curr.cz >= nearZ;
    const nextIn = next.cz >= nearZ;

    if (currIn) {
      out.push(curr);
    }
    if (currIn !== nextIn) {
      const denom = next.cz - curr.cz;
      if (Math.abs(denom) > 1e-6) {
        const t = (nearZ - curr.cz) / denom;
        out.push({
          cx: curr.cx + (next.cx - curr.cx) * t,
          cy: curr.cy + (next.cy - curr.cy) * t,
          cz: nearZ,
        });
      }
    }
  }
  return out;
}

/**
 * Computes relative heading of an opponent car compared to camera heading.
 * 0 = driving directly away from camera, +PI/2 = turning right across view,
 * -PI/2 = turning left across view, +-PI = oncoming.
 */
export function getRelativeCarYaw(carAngle: number, camAngle: number): number {
  return normalizeAngle(carAngle - camAngle);
}

/**
 * Evaluates upcoming spline curvature ahead of the player to warn about sharp corners
 * in front-view camera modes.
 */
export function computeTurnAdvisory(track: BuiltTrack, sampleIdx: number): TurnAdvisory {
  const { samples } = track;
  const count = samples.length;
  let sumCurve = 0;
  let peakAbs = 0;

  for (let offset = 5; offset <= 18; offset++) {
    const s = samples[(sampleIdx + offset) % count];
    sumCurve += s.curvature;
    const absC = Math.abs(s.curvature);
    if (absC > peakAbs) peakAbs = absC;
  }

  const avgCurve = sumCurve / 14;
  if (Math.abs(avgCurve) < 0.0014 && peakAbs < 0.0024) {
    return { direction: 'none', severity: 'gentle' };
  }

  // Positive curvature means angle increases clockwise -> right turn
  const direction = avgCurve >= 0 ? 'right' : 'left';
  const severity = peakAbs >= 0.0033 || Math.abs(avgCurve) >= 0.0023 ? 'sharp' : 'gentle';
  return { direction, severity };
}
