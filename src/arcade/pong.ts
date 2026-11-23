export type PongDifficulty = 'rookie' | 'pro' | 'apex';

export interface PongParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface PongRipple {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
}

export interface PongWorld {
  width: number;
  height: number;
  difficulty: PongDifficulty;
  targetScore: number;
  playerScore: number;
  aiScore: number;
  playerY: number;
  aiY: number;
  playerVy: number;
  aiVy: number;
  paddleH: number;
  paddleW: number;
  playerX: number;
  aiX: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  ballRadius: number;
  ballTrail: Array<{ x: number; y: number }>;
  rally: number;
  bestRally: number;
  servePause: number;
  aiTargetY: number;
  particles: PongParticle[];
  ripples: PongRipple[];
  shake: number;
  status: 'playing' | 'won' | 'lost';
}

export interface PongInput {
  up: boolean;
  down: boolean;
  pointerY: number | null;
}

export interface PongStepEvents {
  paddleHit: boolean;
  wallHit: boolean;
  playerScored: boolean;
  aiScored: boolean;
  matchEnded: boolean;
}

const AI_PROFILE: Record<PongDifficulty, { speed: number; reaction: number; errorPx: number }> = {
  rookie: { speed: 340, reaction: 0.72, errorPx: 46 },
  pro: { speed: 465, reaction: 0.9, errorPx: 18 },
  apex: { speed: 590, reaction: 1.0, errorPx: 5 },
};

/**
 * Predicts exact Y coordinate where ball will cross aiX accounting for wall bounces.
 */
export function predictBallInterceptY(
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  targetX: number,
  height: number,
  radius: number
): number {
  if (ballVx <= 0) return height / 2;
  const time = (targetX - ballX) / ballVx;
  if (time <= 0) return ballY;

  const minY = radius + 12;
  const maxY = height - radius - 12;
  const span = maxY - minY;
  const raw = ballY + ballVy * time - minY;
  const period = span * 2;
  let mod = raw % period;
  if (mod < 0) mod += period;
  const folded = mod <= span ? mod : period - mod;
  return minY + folded;
}

function resetServe(world: PongWorld, towardPlayer: boolean): void {
  world.ballX = world.width / 2;
  world.ballY = world.height / 2;
  const baseSpeed = 410;
  const angle = (Math.random() * 0.56 - 0.28);
  world.ballVx = Math.cos(angle) * baseSpeed * (towardPlayer ? -1 : 1);
  world.ballVy = Math.sin(angle) * baseSpeed;
  world.ballTrail = [];
  world.rally = 0;
  world.servePause = 0.55;
  world.aiTargetY = world.height / 2;
}

export function createInitialPongWorld(
  difficulty: PongDifficulty = 'pro',
  width = 800,
  height = 480
): PongWorld {
  const world: PongWorld = {
    width,
    height,
    difficulty,
    targetScore: 7,
    playerScore: 0,
    aiScore: 0,
    playerY: height / 2,
    aiY: height / 2,
    playerVy: 0,
    aiVy: 0,
    paddleH: 92,
    paddleW: 12,
    playerX: 34,
    aiX: width - 34,
    ballX: width / 2,
    ballY: height / 2,
    ballVx: -410,
    ballVy: 90,
    ballRadius: 8,
    ballTrail: [],
    rally: 0,
    bestRally: 0,
    servePause: 0.4,
    aiTargetY: height / 2,
    particles: [],
    ripples: [],
    shake: 0,
    status: 'playing',
  };
  resetServe(world, false);
  return world;
}

function emitSparks(world: PongWorld, x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 190;
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.32 + Math.random() * 0.22,
      color,
    });
  }
  world.ripples.push({ x, y, radius: 6, alpha: 0.75, color });
}

export function stepPongWorld(world: PongWorld, input: PongInput, dtRaw: number): PongStepEvents {
  const events: PongStepEvents = {
    paddleHit: false,
    wallHit: false,
    playerScored: false,
    aiScored: false,
    matchEnded: false,
  };

  if (world.status !== 'playing') return events;
  const dt = Math.min(Math.max(dtRaw, 0), 0.04);

  world.shake = Math.max(0, world.shake - dt * 24);

  // Player paddle movement
  const prevPlayerY = world.playerY;
  const playerSpeed = 520;
  if (input.pointerY !== null) {
    world.playerY += (input.pointerY - world.playerY) * Math.min(1, dt * 20);
  } else {
    if (input.up) world.playerY -= playerSpeed * dt;
    if (input.down) world.playerY += playerSpeed * dt;
  }
  const halfH = world.paddleH / 2;
  world.playerY = Math.max(halfH + 12, Math.min(world.height - halfH - 12, world.playerY));
  world.playerVy = dt > 0 ? (world.playerY - prevPlayerY) / dt : 0;

  // Predictive AI paddle movement
  const profile = AI_PROFILE[world.difficulty];
  const prevAiY = world.aiY;
  if (world.ballVx > 0 && world.ballX > world.width * (1 - profile.reaction)) {
    const predicted = predictBallInterceptY(
      world.ballX,
      world.ballY,
      world.ballVx,
      world.ballVy,
      world.aiX - world.paddleW / 2 - world.ballRadius,
      world.height,
      world.ballRadius
    );
    // Smoothly track predicted intercept with subtle human-like offset seeded by rally
    const wobble = Math.sin(world.rally * 2.1 + world.playerScore) * profile.errorPx;
    world.aiTargetY = predicted + wobble;
  } else {
    world.aiTargetY = world.height / 2;
  }

  const dyAi = world.aiTargetY - world.aiY;
  const maxStep = profile.speed * dt;
  if (Math.abs(dyAi) <= maxStep) world.aiY = world.aiTargetY;
  else world.aiY += Math.sign(dyAi) * maxStep;
  world.aiY = Math.max(halfH + 12, Math.min(world.height - halfH - 12, world.aiY));
  world.aiVy = dt > 0 ? (world.aiY - prevAiY) / dt : 0;

  // Update visual particles & ripples
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.ripples.length - 1; i >= 0; i--) {
    const rp = world.ripples[i];
    rp.radius += 110 * dt;
    rp.alpha -= 1.6 * dt;
    if (rp.alpha <= 0) world.ripples.splice(i, 1);
  }

  if (world.servePause > 0) {
    world.servePause = Math.max(0, world.servePause - dt);
    return events;
  }

  // Ball trail & kinematics
  world.ballTrail.push({ x: world.ballX, y: world.ballY });
  if (world.ballTrail.length > 14) world.ballTrail.shift();

  world.ballX += world.ballVx * dt;
  world.ballY += world.ballVy * dt;

  // Top & bottom wall bounce
  if (world.ballY - world.ballRadius < 12) {
    world.ballY = 12 + world.ballRadius;
    world.ballVy = Math.abs(world.ballVy);
    events.wallHit = true;
    emitSparks(world, world.ballX, 12, '#94a3b8', 5);
  } else if (world.ballY + world.ballRadius > world.height - 12) {
    world.ballY = world.height - 12 - world.ballRadius;
    world.ballVy = -Math.abs(world.ballVy);
    events.wallHit = true;
    emitSparks(world, world.ballX, world.height - 12, '#94a3b8', 5);
  }

  // Player paddle collision (left)
  const pRight = world.playerX + world.paddleW / 2;
  if (
    world.ballVx < 0 &&
    world.ballX - world.ballRadius <= pRight &&
    world.ballX + world.ballRadius >= world.playerX - world.paddleW / 2 &&
    Math.abs(world.ballY - world.playerY) <= halfH + world.ballRadius
  ) {
    const offset = Math.max(-1, Math.min(1, (world.ballY - world.playerY) / halfH));
    const spin = Math.max(-0.22, Math.min(0.22, world.playerVy / 1400));
    const speed = Math.min(760, Math.hypot(world.ballVx, world.ballVy) * 1.055);
    const angle = Math.max(-1.05, Math.min(1.05, offset * 0.85 + spin));
    world.ballVx = Math.cos(angle) * speed;
    world.ballVy = Math.sin(angle) * speed;
    world.ballX = pRight + world.ballRadius + 1;
    world.rally += 1;
    world.bestRally = Math.max(world.bestRally, world.rally);
    world.shake = 3.2;
    events.paddleHit = true;
    emitSparks(world, pRight, world.ballY, '#d4a853', 10);
  }

  // AI paddle collision (right)
  const aLeft = world.aiX - world.paddleW / 2;
  if (
    world.ballVx > 0 &&
    world.ballX + world.ballRadius >= aLeft &&
    world.ballX - world.ballRadius <= world.aiX + world.paddleW / 2 &&
    Math.abs(world.ballY - world.aiY) <= halfH + world.ballRadius
  ) {
    const offset = Math.max(-1, Math.min(1, (world.ballY - world.aiY) / halfH));
    const spin = Math.max(-0.18, Math.min(0.18, world.aiVy / 1500));
    const speed = Math.min(760, Math.hypot(world.ballVx, world.ballVy) * 1.055);
    const angle = Math.max(-1.05, Math.min(1.05, offset * 0.85 + spin));
    world.ballVx = -Math.cos(angle) * speed;
    world.ballVy = Math.sin(angle) * speed;
    world.ballX = aLeft - world.ballRadius - 1;
    world.rally += 1;
    world.bestRally = Math.max(world.bestRally, world.rally);
    world.shake = 3.2;
    events.paddleHit = true;
    emitSparks(world, aLeft, world.ballY, '#60a5fa', 10);
  }

  // Scoring
  if (world.ballX < -18) {
    world.aiScore += 1;
    world.shake = 6;
    events.aiScored = true;
    if (world.aiScore >= world.targetScore) {
      world.status = 'lost';
      events.matchEnded = true;
    } else {
      resetServe(world, false);
    }
  } else if (world.ballX > world.width + 18) {
    world.playerScore += 1;
    world.shake = 6;
    events.playerScored = true;
    if (world.playerScore >= world.targetScore) {
      world.status = 'won';
      events.matchEnded = true;
    } else {
      resetServe(world, true);
    }
  }

  return events;
}
