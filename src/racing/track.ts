import type { BuiltTrack, CircuitDefinition, TrackSample, Vec2 } from './types.ts';

export const CIRCUITS: CircuitDefinition[] = [
  {
    id: 'obsidian-ring',
    name: 'Obsidian Ring',
    subtitle: 'Sweeping Midnight Expressway · 3 Laps',
    difficulty: 'Standard',
    totalLaps: 3,
    roadHalfWidth: 108,
    shoulderWidth: 52,
    // Clockwise closed loop in world coordinates (~3200 x 2100 arena)
    controlPoints: [
      { x: 0, y: 0 },
      { x: 640, y: -15 },
      { x: 1220, y: 40 },
      { x: 1580, y: 310 },
      { x: 1540, y: 760 },
      { x: 1180, y: 1040 },
      { x: 760, y: 920 },
      { x: 430, y: 1180 },
      { x: -120, y: 1320 },
      { x: -740, y: 1240 },
      { x: -1160, y: 940 },
      { x: -1240, y: 460 },
      { x: -940, y: 110 },
      { x: -480, y: -10 },
    ],
    boostPads: [
      { sampleIndex: 18, lateralOffset: -24, length: 92, width: 34 },
      { sampleIndex: 118, lateralOffset: 22, length: 92, width: 34 },
      { sampleIndex: 198, lateralOffset: 0, length: 92, width: 34 },
    ],
  },
  {
    id: 'harbor-chicane',
    name: 'Harbor Chicane',
    subtitle: 'Technical Waterfront Circuit · 3 Laps',
    difficulty: 'Technical',
    totalLaps: 3,
    roadHalfWidth: 98,
    shoulderWidth: 46,
    controlPoints: [
      { x: 0, y: 0 },
      { x: 660, y: 0 },
      { x: 1120, y: 180 },
      { x: 1320, y: 580 },
      { x: 960, y: 820 },
      { x: 640, y: 610 },
      { x: 340, y: 860 },
      { x: 120, y: 1260 },
      { x: -420, y: 1360 },
      { x: -960, y: 1140 },
      { x: -1160, y: 740 },
      { x: -820, y: 470 },
      { x: -1060, y: 150 },
      { x: -580, y: -20 },
    ],
    boostPads: [
      { sampleIndex: 16, lateralOffset: 0, length: 88, width: 32 },
      { sampleIndex: 132, lateralOffset: -20, length: 88, width: 32 },
      { sampleIndex: 214, lateralOffset: 18, length: 88, width: 32 },
    ],
  },
];

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function buildTrack(circuit: CircuitDefinition, targetSamples = 240): BuiltTrack {
  const pts = circuit.controlPoints;
  const n = pts.length;
  const densePerSeg = 24;
  const raw: Vec2[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let j = 0; j < densePerSeg; j++) {
      raw.push(catmullRom(p0, p1, p2, p3, j / densePerSeg));
    }
  }

  // Arc-length table over dense polygon
  const cumLen: number[] = [0];
  let totalLength = 0;
  for (let i = 1; i <= raw.length; i++) {
    const prev = raw[i - 1];
    const curr = raw[i % raw.length];
    totalLength += Math.hypot(curr.x - prev.x, curr.y - prev.y);
    cumLen.push(totalLength);
  }

  // Resample evenly by arc length
  const evenPts: Vec2[] = [];
  let cursor = 0;
  for (let k = 0; k < targetSamples; k++) {
    const targetDist = (k / targetSamples) * totalLength;
    while (cursor < raw.length - 1 && cumLen[cursor + 1] < targetDist) {
      cursor++;
    }
    const segLen = Math.max(1e-5, cumLen[cursor + 1] - cumLen[cursor]);
    const frac = (targetDist - cumLen[cursor]) / segLen;
    const a = raw[cursor];
    const b = raw[(cursor + 1) % raw.length];
    evenPts.push({
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
    });
  }

  // Compute tangents, right normals, and signed curvature
  const samples: TrackSample[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < targetSamples; i++) {
    const prev = evenPts[(i - 1 + targetSamples) % targetSamples];
    const curr = evenPts[i];
    const next = evenPts[(i + 1) % targetSamples];

    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    // Right-hand normal in screen coords (+X right, +Y down)
    const nx = -ty;
    const ny = tx;

    // Angle change across neighbor segments for AI corner-speed planning
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const a1 = Math.atan2(v1y, v1x);
    const a2 = Math.atan2(v2y, v2x);
    let dAngle = a2 - a1;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    const stepDist = totalLength / targetSamples;
    const curvature = dAngle / Math.max(1, stepDist);

    const margin = circuit.roadHalfWidth + circuit.shoulderWidth + 80;
    if (curr.x - margin < minX) minX = curr.x - margin;
    if (curr.x + margin > maxX) maxX = curr.x + margin;
    if (curr.y - margin < minY) minY = curr.y - margin;
    if (curr.y + margin > maxY) maxY = curr.y + margin;

    samples.push({
      x: curr.x,
      y: curr.y,
      tx,
      ty,
      nx,
      ny,
      s: (i / targetSamples) * totalLength,
      curvature,
    });
  }

  const checkpointIndices = [
    Math.floor(targetSamples * 0.25),
    Math.floor(targetSamples * 0.5),
    Math.floor(targetSamples * 0.75),
    0,
  ];

  return {
    def: circuit,
    samples,
    totalLength,
    checkpointIndices,
    bounds: { minX, maxX, minY, maxY },
  };
}

export function getCircuitById(id: CircuitDefinition['id']): CircuitDefinition {
  return CIRCUITS.find((c) => c.id === id) ?? CIRCUITS[0];
}

export function projectPointToTrack(
  track: BuiltTrack,
  x: number,
  y: number,
  hintIdx?: number
): { sampleIndex: number; lateralOffset: number; distanceSq: number; sample: TrackSample } {
  const { samples } = track;
  const count = samples.length;

  let bestIdx = 0;
  let bestDistSq = Infinity;

  if (hintIdx !== undefined && hintIdx >= 0 && hintIdx < count) {
    // Fast local window search (+/- 22 samples)
    const window = 22;
    for (let offset = -window; offset <= window; offset++) {
      const idx = (hintIdx + offset + count) % count;
      const s = samples[idx];
      const dx = x - s.x;
      const dy = y - s.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = idx;
      }
    }
    // Fallback full scan if far from hint (e.g., teleport/huge jump)
    if (bestDistSq > 480 * 480) {
      for (let i = 0; i < count; i++) {
        const s = samples[i];
        const dx = x - s.x;
        const dy = y - s.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = i;
        }
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      const s = samples[i];
      const dx = x - s.x;
      const dy = y - s.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }
  }

  const sample = samples[bestIdx];
  const lateralOffset = (x - sample.x) * sample.nx + (y - sample.y) * sample.ny;
  return {
    sampleIndex: bestIdx,
    lateralOffset,
    distanceSq: bestDistSq,
    sample,
  };
}
