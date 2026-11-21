import { buildTrack, getCircuitById, projectPointToTrack } from './track.ts';
import type {
  AiPolicy,
  BuiltTrack,
  CircuitDefinition,
  Particle,
  RaceInput,
  RaceSnapshot,
  RaceWorldState,
  RacerState,
  SkidMark,
} from './types.ts';

export const BEST_LAP_STORAGE_KEY = 'shadow_files_night_circuit_records_v1';

export interface RacingRecords {
  bestLapByCircuit: Partial<Record<CircuitDefinition['id'], number>>;
  winsCount: number;
}

const PARTICLE_POOL_SIZE = 160;
const SKID_POOL_SIZE = 260;

// Tuned arcade-sim handling parameters (px/s & rad/s)
const BASE_MAX_SPEED = 590;
const BOOST_MAX_SPEED = 780;
const REVERSE_MAX_SPEED = -170;
const ACCEL_RATE = 430;
const BOOST_ACCEL_RATE = 680;
const BRAKE_RATE = 640;
const DRAG_COAST = 155;
const OFFTRACK_DRAG = 320;
const CAR_RADIUS = 19;

export function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function speedToKmh(speedPxPerSec: number): number {
  return Math.max(0, Math.round(Math.abs(speedPxPerSec) * 0.42));
}

export function formatRaceTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function createEmptyParticles(): Particle[] {
  return Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0.4,
    size: 2,
    color: '#EBB556',
  }));
}

function createEmptySkids(): SkidMark[] {
  return Array.from({ length: SKID_POOL_SIZE }, () => ({
    active: false,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    alpha: 0,
  }));
}

function spawnParticle(
  world: RaceWorldState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  size: number,
  maxLife: number,
  color: string
): void {
  const p = world.particles[world.particleCursor];
  world.particleCursor = (world.particleCursor + 1) % world.particles.length;
  p.active = true;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.size = size;
  p.life = maxLife;
  p.maxLife = maxLife;
  p.color = color;
}

function spawnSkid(
  world: RaceWorldState,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  alpha: number
): void {
  const s = world.skids[world.skidCursor];
  world.skidCursor = (world.skidCursor + 1) % world.skids.length;
  s.active = true;
  s.x1 = x1;
  s.y1 = y1;
  s.x2 = x2;
  s.y2 = y2;
  s.alpha = alpha;
}

function createGridRacers(track: BuiltTrack): RacerState[] {
  const count = track.samples.length;

  const roster: Array<{
    id: string;
    name: string;
    number: string;
    isPlayer: boolean;
    primaryColor: string;
    accentColor: string;
    gridBackSamples: number;
    gridLateral: number;
    aiPolicy?: AiPolicy;
    aiPreferredOffset: number;
    aiSkill: number;
  }> = [
    {
      id: 'ai-cobalt',
      name: 'V. Moretti',
      number: '18',
      isPlayer: false,
      primaryColor: '#2E5B9A',
      accentColor: '#9AC5FF',
      gridBackSamples: 3,
      gridLateral: -34,
      aiPolicy: 'apex_hugger',
      aiPreferredOffset: -24,
      aiSkill: 0.94,
    },
    {
      id: 'ai-crimson',
      name: 'K. Solis',
      number: '07',
      isPlayer: false,
      primaryColor: '#A93232',
      accentColor: '#F39B9B',
      gridBackSamples: 5,
      gridLateral: 34,
      aiPolicy: 'late_braker',
      aiPreferredOffset: 24,
      aiSkill: 0.91,
    },
    {
      id: 'ai-silver',
      name: 'H. Vance',
      number: '29',
      isPlayer: false,
      primaryColor: '#69778A',
      accentColor: '#DCE4F0',
      gridBackSamples: 7,
      gridLateral: -34,
      aiPolicy: 'top_speed',
      aiPreferredOffset: 0,
      aiSkill: 0.87,
    },
    {
      id: 'player',
      name: 'You',
      number: '42',
      isPlayer: true,
      primaryColor: '#D99B38',
      accentColor: '#FFF0C2',
      gridBackSamples: 9,
      gridLateral: 34,
      aiPreferredOffset: 0,
      aiSkill: 1,
    },
  ];

  return roster.map((entry, idx) => {
    const sampleIdx = (count - entry.gridBackSamples) % count;
    const sample = track.samples[sampleIdx];
    const x = sample.x + sample.nx * entry.gridLateral;
    const y = sample.y + sample.ny * entry.gridLateral;
    const angle = Math.atan2(sample.ty, sample.tx);

    return {
      id: entry.id,
      name: entry.name,
      number: entry.number,
      isPlayer: entry.isPlayer,
      primaryColor: entry.primaryColor,
      accentColor: entry.accentColor,
      x,
      y,
      vx: 0,
      vy: 0,
      angle,
      speed: 0,
      angularVelocity: 0,
      steerAngle: 0,
      drifting: false,
      braking: false,
      boosting: false,
      nitro: 55,
      offTrack: false,
      trackSampleIdx: sampleIdx,
      lateralOffset: entry.gridLateral,
      lap: 1,
      nextCheckpoint: 0,
      lapStartTime: 0,
      bestLapMs: null,
      totalProgress: -entry.gridBackSamples * (track.totalLength / count),
      finished: false,
      finishTimeMs: null,
      rank: idx + 1,
      hitFlash: 0,
      aiPolicy: entry.aiPolicy,
      aiPreferredOffset: entry.aiPreferredOffset,
      aiSkill: entry.aiSkill,
    };
  });
}

export function createInitialRaceWorld(
  circuitId: CircuitDefinition['id'] = 'obsidian-ring',
  skipCountdown = false
): RaceWorldState {
  const circuit = getCircuitById(circuitId);
  const track = buildTrack(circuit);
  const racers = createGridRacers(track);
  const player = racers.find((r) => r.isPlayer) ?? racers[0];

  return {
    track,
    racers,
    countdownRemaining: skipCountdown ? 0 : 2.6,
    elapsedMs: 0,
    camera: {
      x: player.x,
      y: player.y,
      angle: player.angle,
      steerSway: 0,
      zoom: 1,
      shakeTrauma: 0,
    },
    hitstopTimer: 0,
    topSpeedKmh: 0,
    finished: false,
    snapshot: null,
    particles: createEmptyParticles(),
    particleCursor: 0,
    skids: createEmptySkids(),
    skidCursor: 0,
    lastLapNotified: 1,
    events: {
      collision: 0,
      boostStart: false,
      lapComplete: false,
      raceFinish: false,
      countdownTick: null,
    },
  };
}

function computeAiInput(
  racer: RacerState,
  world: RaceWorldState,
  playerProgress: number
): RaceInput {
  const { track, racers } = world;
  const count = track.samples.length;
  const lookAheadSteps = racer.aiPolicy === 'late_braker' ? 8 : racer.aiPolicy === 'apex_hugger' ? 10 : 12;
  const targetIdx = (racer.trackSampleIdx + lookAheadSteps) % count;
  const farIdx = (racer.trackSampleIdx + lookAheadSteps + 9) % count;

  const targetSample = track.samples[targetIdx];
  const farSample = track.samples[farIdx];

  // Dynamic racing line based on policy + nearby car avoidance
  let desiredOffset = racer.aiPreferredOffset;
  if (racer.aiPolicy === 'apex_hugger') {
    const curveSign = Math.sign(targetSample.curvature);
    if (Math.abs(targetSample.curvature) > 0.0005) {
      desiredOffset = curveSign * (track.def.roadHalfWidth * 0.42);
    }
  }

  for (const other of racers) {
    if (other.id === racer.id) continue;
    const dx = other.x - racer.x;
    const dy = other.y - racer.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 110) {
      const fwdDot = dx * Math.cos(racer.angle) + dy * Math.sin(racer.angle);
      if (fwdDot > -10) {
        // Swerve cleanly around slower traffic
        desiredOffset += other.lateralOffset > racer.lateralOffset ? -42 : 42;
      }
    }
  }

  const maxLane = track.def.roadHalfWidth * 0.65;
  desiredOffset = Math.max(-maxLane, Math.min(maxLane, desiredOffset));

  const aimX = targetSample.x + targetSample.nx * desiredOffset;
  const aimY = targetSample.y + targetSample.ny * desiredOffset;
  const desiredAngle = Math.atan2(aimY - racer.y, aimX - racer.x);
  const angleError = normalizeAngle(desiredAngle - racer.angle);

  // Corner speed estimation
  const aheadCurve = Math.max(
    Math.abs(targetSample.curvature),
    Math.abs(farSample.curvature)
  );
  const cornerBrakeFactor = racer.aiPolicy === 'late_braker' ? 185 : 230;
  let desiredSpeed = BASE_MAX_SPEED * racer.aiSkill;

  // Subtle fair rubber-banding so battles stay engaging without feeling unfair
  const gapToPlayer = racer.totalProgress - playerProgress;
  if (gapToPlayer > 520) {
    desiredSpeed *= 0.91;
  } else if (gapToPlayer < -650) {
    desiredSpeed *= 1.07;
  }

  if (aheadCurve > 0.00075) {
    desiredSpeed = Math.max(285, desiredSpeed - aheadCurve * cornerBrakeFactor * 160);
  }

  const wantBoost =
    aheadCurve < 0.00045 &&
    Math.abs(angleError) < 0.14 &&
    racer.nitro > 45 &&
    gapToPlayer < 160;

  return {
    throttle: racer.speed < desiredSpeed,
    brake: racer.speed > desiredSpeed + 75,
    left: angleError < -0.055,
    right: angleError > 0.055,
    drift: Math.abs(angleError) > 0.42 && racer.speed > 340,
    boost: wantBoost,
  };
}

function advanceCheckpointsAndLaps(
  racer: RacerState,
  prevIdx: number,
  currIdx: number,
  track: BuiltTrack,
  elapsedMs: number
): { completedLap: boolean; justFinished: boolean } {
  if (racer.finished) return { completedLap: false, justFinished: false };

  const count = track.samples.length;
  // Detect forward delta modulo count
  let delta = currIdx - prevIdx;
  if (delta < -count / 2) delta += count;
  if (delta > count / 2) delta -= count;

  // Ignore backward crossings for checkpoint progression
  if (delta <= 0) return { completedLap: false, justFinished: false };

  const gates = track.checkpointIndices; // [q1, q2, q3, 0]
  const targetGate = gates[racer.nextCheckpoint];

  const crossedGate = (gate: number): boolean => {
    for (let step = 1; step <= delta; step++) {
      if ((prevIdx + step) % count === gate) return true;
    }
    return false;
  };

  if (crossedGate(targetGate)) {
    if (racer.nextCheckpoint < gates.length - 1) {
      racer.nextCheckpoint += 1;
      return { completedLap: false, justFinished: false };
    } else {
      // Crossed Start/Finish after hitting all 3 sector checkpoints!
      const lapDuration = elapsedMs - racer.lapStartTime;
      if (lapDuration > 2500) {
        if (racer.bestLapMs === null || lapDuration < racer.bestLapMs) {
          racer.bestLapMs = lapDuration;
        }
      }
      racer.lapStartTime = elapsedMs;
      racer.nextCheckpoint = 0;

      if (racer.lap >= track.def.totalLaps) {
        racer.finished = true;
        racer.finishTimeMs = elapsedMs;
        return { completedLap: true, justFinished: true };
      } else {
        racer.lap += 1;
        return { completedLap: true, justFinished: false };
      }
    }
  }

  return { completedLap: false, justFinished: false };
}

function updateRacerPhysics(
  racer: RacerState,
  input: RaceInput,
  dt: number,
  world: RaceWorldState
): void {
  const { track } = world;
  const prevX = racer.x;
  const prevY = racer.y;
  const prevSampleIdx = racer.trackSampleIdx;

  // Nitro activation & recharge
  const wasBoosting = racer.boosting;
  const canBoost = input.boost && racer.nitro > 4 && racer.speed > 90;
  racer.boosting = canBoost;
  if (racer.boosting) {
    racer.nitro = Math.max(0, racer.nitro - 36 * dt);
    if (!wasBoosting && racer.isPlayer) {
      world.events.boostStart = true;
    }
  } else {
    // Passive slow regen + drift bonus
    const regen = racer.drifting && Math.abs(racer.speed) > 190 ? 22 : 4.5;
    racer.nitro = Math.min(100, racer.nitro + regen * dt);
  }

  // Forward / reverse acceleration
  const maxSpd = racer.boosting ? BOOST_MAX_SPEED : BASE_MAX_SPEED;
  racer.braking = input.brake && racer.speed > 30;

  if (racer.boosting) {
    racer.speed += BOOST_ACCEL_RATE * dt;
  } else if (input.throttle) {
    racer.speed += ACCEL_RATE * dt;
  } else if (input.brake) {
    if (racer.speed > 0) {
      racer.speed -= BRAKE_RATE * dt;
    } else {
      racer.speed -= ACCEL_RATE * 0.55 * dt;
    }
  } else {
    // Natural rolling drag
    if (Math.abs(racer.speed) <= DRAG_COAST * dt) {
      racer.speed = 0;
    } else {
      racer.speed -= Math.sign(racer.speed) * DRAG_COAST * dt;
    }
  }

  // Off-track runoff resistance
  if (racer.offTrack && !racer.boosting) {
    const capOffTrack = BASE_MAX_SPEED * 0.58;
    if (racer.speed > capOffTrack) {
      racer.speed = Math.max(capOffTrack, racer.speed - OFFTRACK_DRAG * dt);
    }
  }

  // Clamp forward/reverse speed
  const softCap = racer.isPlayer ? maxSpd : maxSpd * 0.97;
  if (racer.speed > softCap) {
    racer.speed += (softCap - racer.speed) * Math.min(1, dt * 4.5);
  }
  if (racer.speed < REVERSE_MAX_SPEED) {
    racer.speed = REVERSE_MAX_SPEED;
  }

  // Steering & drift dynamics
  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  racer.steerAngle += (steerInput * 0.55 - racer.steerAngle) * Math.min(1, dt * 14);
  racer.drifting = input.drift && Math.abs(steerInput) > 0 && Math.abs(racer.speed) > 180;

  const speedFactor = Math.min(1, Math.abs(racer.speed) / 145);
  const reverseSign = racer.speed >= -5 ? 1 : -1;
  const turnRate = racer.drifting ? 3.05 : 2.38;
  racer.angle = normalizeAngle(racer.angle + steerInput * turnRate * speedFactor * reverseSign * dt);

  // Blend velocity vector toward heading (higher grip when normal, lateral slip when drifting)
  const headingX = Math.cos(racer.angle);
  const headingY = Math.sin(racer.angle);
  const targetVx = headingX * racer.speed;
  const targetVy = headingY * racer.speed;
  const lateralGrip = racer.drifting ? 3.4 : racer.offTrack ? 5.2 : 9.5;
  const blend = Math.min(1, lateralGrip * dt);

  racer.vx += (targetVx - racer.vx) * blend;
  racer.vy += (targetVy - racer.vy) * blend;

  racer.x += racer.vx * dt;
  racer.y += racer.vy * dt;

  // Project onto track & enforce outer safety barriers smoothly
  const proj = projectPointToTrack(track, racer.x, racer.y, prevSampleIdx);
  racer.trackSampleIdx = proj.sampleIndex;
  racer.lateralOffset = proj.lateralOffset;

  const roadEdge = track.def.roadHalfWidth;
  const barrierLimit = roadEdge + track.def.shoulderWidth - CAR_RADIUS;
  racer.offTrack = Math.abs(proj.lateralOffset) > roadEdge;

  if (Math.abs(proj.lateralOffset) > barrierLimit) {
    const sign = Math.sign(proj.lateralOffset);
    racer.x = proj.sample.x + proj.sample.nx * (sign * barrierLimit);
    racer.y = proj.sample.y + proj.sample.ny * (sign * barrierLimit);
    racer.lateralOffset = sign * barrierLimit;

    // Slide velocity along track tangent on barrier scrape
    const tangentSpeed = racer.vx * proj.sample.tx + racer.vy * proj.sample.ty;
    racer.vx = proj.sample.tx * tangentSpeed * 0.78;
    racer.vy = proj.sample.ty * tangentSpeed * 0.78;
    racer.speed = Math.max(-90, tangentSpeed * 0.78);

    if (Math.abs(tangentSpeed) > 150) {
      racer.hitFlash = 0.65;
      if (racer.isPlayer) {
        world.camera.shakeTrauma = Math.min(1, world.camera.shakeTrauma + 0.35);
        world.events.collision = Math.max(world.events.collision, 0.55);
      }
      for (let i = 0; i < 6; i++) {
        spawnParticle(
          world,
          racer.x + proj.sample.nx * sign * 10,
          racer.y + proj.sample.ny * sign * 10,
          -proj.sample.nx * sign * (70 + Math.random() * 110) + (Math.random() - 0.5) * 60,
          -proj.sample.ny * sign * (70 + Math.random() * 110) + (Math.random() - 0.5) * 60,
          2.2,
          0.26,
          '#FFD27A'
        );
      }
    }
  }

  // Check boost pads on road
  for (const pad of track.def.boostPads) {
    const idxDiff = Math.abs(racer.trackSampleIdx - pad.sampleIndex);
    const wrappedDiff = Math.min(idxDiff, track.samples.length - idxDiff);
    if (wrappedDiff <= 2 && Math.abs(racer.lateralOffset - pad.lateralOffset) < pad.width * 0.95) {
      racer.nitro = Math.min(100, racer.nitro + 30 * dt);
      racer.speed = Math.max(racer.speed, BASE_MAX_SPEED * 1.15);
      if (racer.isPlayer) {
        world.events.boostStart = true;
      }
    }
  }

  // Emit skid marks & drift/boost particles
  if (racer.drifting || (racer.braking && racer.speed > 260)) {
    const rearX = racer.x - headingX * 14;
    const rearY = racer.y - headingY * 14;
    const prevRearX = prevX - headingX * 14;
    const prevRearY = prevY - headingY * 14;
    const perpX = -headingY * 8;
    const perpY = headingX * 8;
    spawnSkid(world, prevRearX + perpX, prevRearY + perpY, rearX + perpX, rearY + perpY, 0.34);
    spawnSkid(world, prevRearX - perpX, prevRearY - perpY, rearX - perpX, rearY - perpY, 0.34);

    if (Math.random() < 0.65) {
      spawnParticle(
        world,
        rearX + (Math.random() - 0.5) * 14,
        rearY + (Math.random() - 0.5) * 14,
        -racer.vx * 0.15 + (Math.random() - 0.5) * 40,
        -racer.vy * 0.15 + (Math.random() - 0.5) * 40,
        4.2,
        0.38,
        'rgba(195, 206, 224, 0.55)'
      );
    }
  }

  if (racer.boosting) {
    const tailX = racer.x - headingX * 20;
    const tailY = racer.y - headingY * 20;
    spawnParticle(
      world,
      tailX + (Math.random() - 0.5) * 6,
      tailY + (Math.random() - 0.5) * 6,
      -headingX * (150 + Math.random() * 90),
      -headingY * (150 + Math.random() * 90),
      3.8,
      0.2,
      Math.random() > 0.4 ? '#F5B544' : '#70C3FF'
    );
  }

  // Checkpoint & lap progression
  const { completedLap, justFinished } = advanceCheckpointsAndLaps(
    racer,
    prevSampleIdx,
    racer.trackSampleIdx,
    track,
    world.elapsedMs
  );

  if (racer.isPlayer) {
    const kmh = speedToKmh(racer.speed);
    if (kmh > world.topSpeedKmh) world.topSpeedKmh = kmh;
    if (completedLap && !justFinished) {
      world.events.lapComplete = true;
    }
    if (justFinished) {
      world.events.raceFinish = true;
    }
  }

  // Update continuous progress for accurate live ranking
  const sAlongLap = track.samples[racer.trackSampleIdx].s;
  // Handle cars still behind start line before lap 1 starts
  const effectiveS =
    racer.lap === 1 && racer.nextCheckpoint === 0 && sAlongLap > track.totalLength * 0.75
      ? sAlongLap - track.totalLength
      : sAlongLap;

  if (racer.finished && racer.finishTimeMs !== null) {
    racer.totalProgress =
      (track.def.totalLaps + 2) * track.totalLength - racer.finishTimeMs * 0.01;
  } else {
    racer.totalProgress = (racer.lap - 1) * track.totalLength + effectiveS;
  }

  if (racer.hitFlash > 0) {
    racer.hitFlash = Math.max(0, racer.hitFlash - dt * 4.5);
  }
}

function resolveCarCollisions(world: RaceWorldState): void {
  const { racers } = world;
  const minDist = CAR_RADIUS * 2.02;

  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i];
      const b = racers[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.001 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) * 0.52;

        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
          const impulse = -velAlongNormal * 0.65;
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;

          a.speed *= 0.94;
          b.speed *= 0.94;
          a.hitFlash = 0.85;
          b.hitFlash = 0.85;

          const impact = Math.min(1, Math.abs(velAlongNormal) / 280);
          if (a.isPlayer || b.isPlayer) {
            world.camera.shakeTrauma = Math.min(1, world.camera.shakeTrauma + 0.28 + impact * 0.35);
            world.events.collision = Math.max(world.events.collision, 0.4 + impact * 0.6);
            if (impact > 0.45) {
              world.hitstopTimer = 0.032;
            }
          }

          const midX = (a.x + b.x) * 0.5;
          const midY = (a.y + b.y) * 0.5;
          for (let k = 0; k < 8; k++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 140;
            spawnParticle(
              world,
              midX,
              midY,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              2.3,
              0.28,
              '#FFE08A'
            );
          }
        }
      }
    }
  }
}

function updateRankings(world: RaceWorldState): void {
  const sorted = [...world.racers].sort((a, b) => b.totalProgress - a.totalProgress);
  sorted.forEach((r, idx) => {
    r.rank = idx + 1;
  });
}

function buildRaceSnapshot(world: RaceWorldState): RaceSnapshot {
  const sorted = [...world.racers].sort((a, b) => a.rank - b.rank);
  const player = world.racers.find((r) => r.isPlayer) ?? world.racers[0];

  return {
    circuitId: world.track.def.id,
    circuitName: world.track.def.name,
    playerRank: player.rank,
    totalRacers: world.racers.length,
    totalTimeMs: Math.round(player.finishTimeMs ?? world.elapsedMs),
    bestLapMs: player.bestLapMs !== null ? Math.round(player.bestLapMs) : null,
    topSpeedKmh: world.topSpeedKmh,
    standings: sorted.map((r) => ({
      id: r.id,
      name: r.name,
      number: r.number,
      isPlayer: r.isPlayer,
      rank: r.rank,
      primaryColor: r.primaryColor,
      finishTimeMs: r.finishTimeMs !== null ? Math.round(r.finishTimeMs) : null,
      lap: r.lap,
    })),
  };
}

export function stepRaceWorld(
  world: RaceWorldState,
  playerInput: RaceInput,
  rawDt: number
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);

  // Reset per-frame one-shot events
  world.events.collision = 0;
  world.events.boostStart = false;
  world.events.lapComplete = false;
  world.events.raceFinish = false;
  world.events.countdownTick = null;

  // Tick particles & camera shake in real dt even during hitstop
  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
  }

  world.camera.shakeTrauma = Math.max(0, world.camera.shakeTrauma - dt * 2.2);

  // Countdown phase before GO!
  if (world.countdownRemaining > 0) {
    const prevCeil = Math.ceil(world.countdownRemaining);
    world.countdownRemaining = Math.max(0, world.countdownRemaining - dt);
    const nextCeil = Math.ceil(world.countdownRemaining);
    if (nextCeil !== prevCeil) {
      world.events.countdownTick = nextCeil;
    }
    // Smoothly frame the player car on the starting grid
    const player = world.racers.find((r) => r.isPlayer) ?? world.racers[0];
    world.camera.x += (player.x - world.camera.x) * Math.min(1, dt * 6);
    world.camera.y += (player.y - world.camera.y) * Math.min(1, dt * 6);
    const countdownAngDiff = normalizeAngle(player.angle - world.camera.angle);
    world.camera.angle = normalizeAngle(world.camera.angle + countdownAngDiff * Math.min(1, dt * 8));
    world.camera.steerSway += (0 - world.camera.steerSway) * Math.min(1, dt * 6);
    return;
  }

  if (world.hitstopTimer > 0) {
    world.hitstopTimer = Math.max(0, world.hitstopTimer - dt);
    return;
  }

  if (!world.finished) {
    world.elapsedMs += dt * 1000;
  }

  const player = world.racers.find((r) => r.isPlayer) ?? world.racers[0];

  for (const racer of world.racers) {
    const input = racer.isPlayer
      ? racer.finished
        ? computeAiInput(racer, world, player.totalProgress) // Cruise smoothly after crossing checkered flag
        : playerInput
      : computeAiInput(racer, world, player.totalProgress);
    updateRacerPhysics(racer, input, dt, world);
  }

  resolveCarCollisions(world);
  updateRankings(world);

  // Smooth chase camera with forward velocity lead & subtle dynamic speed zoom
  const leadX = player.vx * 0.26;
  const leadY = player.vy * 0.26;
  const targetCamX = player.x + leadX;
  const targetCamY = player.y + leadY;
  const speedRatio = Math.min(1, Math.abs(player.speed) / BOOST_MAX_SPEED);
  const targetZoom = 1.04 - speedRatio * 0.22;

  world.camera.x += (targetCamX - world.camera.x) * Math.min(1, dt * 7.5);
  world.camera.y += (targetCamY - world.camera.y) * Math.min(1, dt * 7.5);
  world.camera.zoom += (targetZoom - world.camera.zoom) * Math.min(1, dt * 4.5);

  // Smooth front-view heading follow (slightly looser during drift so rear quarter kicks out visibly)
  const angleError = normalizeAngle(player.angle - world.camera.angle);
  const angleStiffness = player.drifting ? 5.2 : 9.6;
  world.camera.angle = normalizeAngle(
    world.camera.angle + angleError * Math.min(1, dt * angleStiffness)
  );
  world.camera.steerSway += (player.steerAngle - world.camera.steerSway) * Math.min(1, dt * 7.5);

  if (player.finished && !world.finished) {
    world.finished = true;
    world.snapshot = buildRaceSnapshot(world);
  }
}

export function loadRacingRecords(): RacingRecords {
  if (typeof window === 'undefined') {
    return { bestLapByCircuit: {}, winsCount: 0 };
  }
  try {
    const raw = window.localStorage.getItem(BEST_LAP_STORAGE_KEY);
    if (!raw) return { bestLapByCircuit: {}, winsCount: 0 };
    const parsed = JSON.parse(raw) as Partial<RacingRecords>;
    return {
      bestLapByCircuit: parsed.bestLapByCircuit ?? {},
      winsCount: typeof parsed.winsCount === 'number' ? parsed.winsCount : 0,
    };
  } catch {
    return { bestLapByCircuit: {}, winsCount: 0 };
  }
}

export function saveRaceRecord(snapshot: RaceSnapshot): RacingRecords {
  const existing = loadRacingRecords();
  const next: RacingRecords = {
    bestLapByCircuit: { ...existing.bestLapByCircuit },
    winsCount: existing.winsCount + (snapshot.playerRank === 1 ? 1 : 0),
  };
  if (snapshot.bestLapMs !== null) {
    const prevBest = existing.bestLapByCircuit[snapshot.circuitId];
    if (prevBest === undefined || snapshot.bestLapMs < prevBest) {
      next.bestLapByCircuit[snapshot.circuitId] = snapshot.bestLapMs;
    }
  }
  try {
    window.localStorage.setItem(BEST_LAP_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
  return next;
}
