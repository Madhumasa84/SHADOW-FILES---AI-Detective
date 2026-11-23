export type PowerUpType = 'wide' | 'multi' | 'pierce' | 'slow';

export interface BreakoutBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  stuckToPaddle: boolean;
  trail: Array<{ x: number; y: number }>;
}

export interface BreakoutBrick {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  indestructible: boolean;
  tone: 'amber' | 'crimson' | 'emerald' | 'sapphire' | 'steel';
  points: number;
  hitFlash: number;
}

export interface BreakoutPowerUp {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: PowerUpType;
}

export interface BreakoutParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface BreakoutWorld {
  width: number;
  height: number;
  stage: number;
  maxStages: number;
  score: number;
  lives: number;
  combo: number;
  paddleX: number;
  paddleW: number;
  basePaddleW: number;
  paddleH: number;
  paddleY: number;
  wideTimer: number;
  pierceTimer: number;
  slowTimer: number;
  balls: BreakoutBall[];
  bricks: BreakoutBrick[];
  powerUps: BreakoutPowerUp[];
  particles: BreakoutParticle[];
  shake: number;
  status: 'playing' | 'won' | 'lost';
  nextEntityId: number;
}

export interface BreakoutInput {
  left: boolean;
  right: boolean;
  pointerX: number | null;
  launch: boolean;
}

export interface BreakoutStepEvents {
  brickHit: boolean;
  brickBroken: boolean;
  paddleHit: boolean;
  powerUpCollected: PowerUpType | null;
  lifeLost: boolean;
  stageCleared: boolean;
  gameOver: boolean;
  gameWon: boolean;
}

const STAGE_PATTERNS: string[][] = [
  // Stage 1: Art Deco Archway
  [
    '..AAAAAAA..',
    '.AACCCCCAA.',
    'AACEEEEECAA',
    'ACESS.SSECA',
    'A.CCCCCC..A',
  ],
  // Stage 2: Obsidian Vault
  [
    'SS.CCCCC.SS',
    'S.AEEEEA..S',
    'CCEEAAEECC.',
    '.A.CCCC.A..',
    'AA.SSSS.AA.',
    '..AAAAAA...',
  ],
  // Stage 3: Diamond Prism
  [
    '.....C.....',
    '....CEC....',
    '...CEAEC...',
    '..CEAAAEC..',
    '...CEAEC...',
    '....CEC....',
    '..S..C..S..',
  ],
  // Stage 4: Twin Citadels
  [
    'CCC..A..CCC',
    'CEC.AAA.CEC',
    'CSC.EAE.CSC',
    'AAA.CCC.AAA',
    'EEE..S..EEE',
    'AAAA...AAAA',
  ],
  // Stage 5: Midnight Crown
  [
    'C.C.C.C.C.C',
    'ECECECECECE',
    'SAAAAAAAAAS',
    'CC.EEEEE.CC',
    '.S.CCCCC.S.',
    'AAA.SSS.AAA',
  ],
];

const BRICK_COLORS: Record<BreakoutBrick['tone'], string> = {
  amber: '#d4a853',
  crimson: '#d64545',
  emerald: '#2fb886',
  sapphire: '#4a8fe7',
  steel: '#7d8a99',
};

function buildStageBricks(stage: number, width: number, startId: number): { bricks: BreakoutBrick[]; nextId: number } {
  const layout = STAGE_PATTERNS[(stage - 1) % STAGE_PATTERNS.length];
  const cols = layout[0].length;
  const padX = 36;
  const gap = 6;
  const usableW = width - padX * 2;
  const brickW = (usableW - gap * (cols - 1)) / cols;
  const brickH = 22;
  const topY = 66;

  const bricks: BreakoutBrick[] = [];
  let id = startId;

  for (let r = 0; r < layout.length; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = layout[r][c];
      if (ch === '.') continue;
      let tone: BreakoutBrick['tone'] = 'amber';
      let hp = 1;
      let indestructible = false;
      let points = 100;
      if (ch === 'A') {
        tone = 'amber';
        hp = 1;
        points = 100;
      } else if (ch === 'E') {
        tone = 'emerald';
        hp = 2;
        points = 180;
      } else if (ch === 'C') {
        tone = 'crimson';
        hp = stage >= 3 ? 3 : 2;
        points = 260;
      } else if (ch === 'S') {
        tone = 'steel';
        hp = 999;
        indestructible = true;
        points = 0;
      }
      bricks.push({
        id: id++,
        x: padX + c * (brickW + gap),
        y: topY + r * (brickH + gap),
        w: brickW,
        h: brickH,
        hp,
        maxHp: hp,
        indestructible,
        tone,
        points,
        hitFlash: 0,
      });
    }
  }

  return { bricks, nextId: id };
}

function makeStuckBall(paddleX: number, paddleY: number, id: number): BreakoutBall {
  return {
    id,
    x: paddleX,
    y: paddleY - 12,
    vx: 220,
    vy: -380,
    radius: 7,
    stuckToPaddle: true,
    trail: [],
  };
}

export function createInitialBreakoutWorld(width = 760, height = 540, stage = 1): BreakoutWorld {
  const paddleY = height - 42;
  const basePaddleW = 114;
  const { bricks, nextId } = buildStageBricks(stage, width, 10);
  return {
    width,
    height,
    stage,
    maxStages: STAGE_PATTERNS.length,
    score: 0,
    lives: 3,
    combo: 0,
    paddleX: width / 2,
    paddleW: basePaddleW,
    basePaddleW,
    paddleH: 13,
    paddleY,
    wideTimer: 0,
    pierceTimer: 0,
    slowTimer: 0,
    balls: [makeStuckBall(width / 2, paddleY, 1)],
    bricks,
    powerUps: [],
    particles: [],
    shake: 0,
    status: 'playing',
    nextEntityId: nextId,
  };
}

function spawnParticles(world: BreakoutWorld, x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 190;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.42 + Math.random() * 0.25,
      maxLife: 0.65,
      color,
      size: 2.5 + Math.random() * 3.5,
    });
  }
}

export function stepBreakoutWorld(
  world: BreakoutWorld,
  input: BreakoutInput,
  dtRaw: number
): BreakoutStepEvents {
  const events: BreakoutStepEvents = {
    brickHit: false,
    brickBroken: false,
    paddleHit: false,
    powerUpCollected: null,
    lifeLost: false,
    stageCleared: false,
    gameOver: false,
    gameWon: false,
  };

  if (world.status !== 'playing') return events;
  const dt = Math.min(Math.max(dtRaw, 0), 0.04);

  // Timers
  world.wideTimer = Math.max(0, world.wideTimer - dt);
  world.pierceTimer = Math.max(0, world.pierceTimer - dt);
  world.slowTimer = Math.max(0, world.slowTimer - dt);
  world.shake = Math.max(0, world.shake - dt * 28);

  const targetPaddleW = world.wideTimer > 0 ? Math.round(world.basePaddleW * 1.48) : world.basePaddleW;
  world.paddleW += (targetPaddleW - world.paddleW) * Math.min(1, dt * 12);

  // Paddle movement
  const paddleSpeed = 560;
  if (input.pointerX !== null) {
    world.paddleX += (input.pointerX - world.paddleX) * Math.min(1, dt * 24);
  } else {
    if (input.left) world.paddleX -= paddleSpeed * dt;
    if (input.right) world.paddleX += paddleSpeed * dt;
  }
  const halfP = world.paddleW / 2;
  world.paddleX = Math.max(halfP + 10, Math.min(world.width - halfP - 10, world.paddleX));

  // Decay brick hit flashes
  for (const brick of world.bricks) {
    if (brick.hitFlash > 0) brick.hitFlash = Math.max(0, brick.hitFlash - dt * 5);
  }

  // Launch stuck balls
  if (input.launch) {
    for (const ball of world.balls) {
      if (ball.stuckToPaddle) {
        ball.stuckToPaddle = false;
        const speed = 430 + world.stage * 22;
        const angle = -Math.PI / 2 + (Math.random() * 0.4 - 0.2);
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
      }
    }
  }

  const speedFactor = world.slowTimer > 0 ? 0.72 : 1;

  // Step balls
  const survivingBalls: BreakoutBall[] = [];
  for (const ball of world.balls) {
    if (ball.stuckToPaddle) {
      ball.x = world.paddleX;
      ball.y = world.paddleY - ball.radius - 3;
      survivingBalls.push(ball);
      continue;
    }

    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 10) ball.trail.shift();

    ball.x += ball.vx * speedFactor * dt;
    ball.y += ball.vy * speedFactor * dt;

    // Wall collisions
    if (ball.x - ball.radius < 10) {
      ball.x = 10 + ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius > world.width - 10) {
      ball.x = world.width - 10 - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.radius < 10) {
      ball.y = 10 + ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    // Paddle collision
    if (
      ball.vy > 0 &&
      ball.y + ball.radius >= world.paddleY &&
      ball.y - ball.radius <= world.paddleY + world.paddleH &&
      ball.x >= world.paddleX - halfP - ball.radius &&
      ball.x <= world.paddleX + halfP + ball.radius
    ) {
      const offset = (ball.x - world.paddleX) / halfP; // -1..1
      const clamped = Math.max(-0.92, Math.min(0.92, offset));
      const speed = Math.min(620, Math.hypot(ball.vx, ball.vy) * 1.015);
      const bounceAngle = -Math.PI / 2 + clamped * (Math.PI * 0.36);
      ball.vx = Math.cos(bounceAngle) * speed;
      ball.vy = Math.sin(bounceAngle) * speed;
      ball.y = world.paddleY - ball.radius - 1;
      world.combo = 0;
      events.paddleHit = true;
      spawnParticles(world, ball.x, world.paddleY, '#d4a853', 5);
    }

    // Brick collisions
    for (let i = world.bricks.length - 1; i >= 0; i--) {
      const b = world.bricks[i];
      const closestX = Math.max(b.x, Math.min(ball.x, b.x + b.w));
      const closestY = Math.max(b.y, Math.min(ball.y, b.y + b.h));
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      if (dx * dx + dy * dy <= ball.radius * ball.radius) {
        const shouldBounce = b.indestructible || world.pierceTimer <= 0;
        if (shouldBounce) {
          if (Math.abs(dx) > Math.abs(dy)) {
            ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
          } else {
            ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
          }
        }

        b.hitFlash = 1;
        events.brickHit = true;

        if (!b.indestructible) {
          b.hp -= world.pierceTimer > 0 ? 2 : 1;
          if (b.hp <= 0) {
            world.bricks.splice(i, 1);
            world.combo += 1;
            const multiplier = Math.min(4, 1 + Math.floor(world.combo / 4));
            world.score += b.points * multiplier;
            world.shake = Math.min(7, world.shake + 3);
            events.brickBroken = true;
            spawnParticles(world, b.x + b.w / 2, b.y + b.h / 2, BRICK_COLORS[b.tone], 11);

            // 20% power-up drop chance
            if (Math.random() < 0.2) {
              const pool: PowerUpType[] = ['wide', 'multi', 'pierce', 'slow'];
              const type = pool[Math.floor(Math.random() * pool.length)];
              world.powerUps.push({
                id: world.nextEntityId++,
                x: b.x + b.w / 2,
                y: b.y + b.h / 2,
                vy: 145,
                type,
              });
            }
          } else {
            spawnParticles(world, closestX, closestY, BRICK_COLORS[b.tone], 5);
          }
        } else {
          spawnParticles(world, closestX, closestY, '#cbd5e1', 4);
        }
        break;
      }
    }

    if (ball.y - ball.radius <= world.height + 16) {
      survivingBalls.push(ball);
    }
  }

  world.balls = survivingBalls;

  // Power-ups fall & collect
  for (let i = world.powerUps.length - 1; i >= 0; i--) {
    const p = world.powerUps[i];
    p.y += p.vy * dt;
    if (
      p.y + 12 >= world.paddleY &&
      p.y - 12 <= world.paddleY + world.paddleH &&
      p.x >= world.paddleX - halfP - 12 &&
      p.x <= world.paddleX + halfP + 12
    ) {
      events.powerUpCollected = p.type;
      world.score += 150;
      if (p.type === 'wide') world.wideTimer = 11;
      else if (p.type === 'pierce') world.pierceTimer = 8;
      else if (p.type === 'slow') world.slowTimer = 9;
      else if (p.type === 'multi') {
        const ref = world.balls[0];
        if (ref && world.balls.length < 5) {
          for (const delta of [-0.35, 0.35]) {
            const speed = Math.hypot(ref.vx, ref.vy) || 440;
            const ang = Math.atan2(ref.vy, ref.vx) + delta;
            world.balls.push({
              id: world.nextEntityId++,
              x: ref.x,
              y: ref.y,
              vx: Math.cos(ang) * speed,
              vy: Math.sin(ang) * speed,
              radius: ref.radius,
              stuckToPaddle: false,
              trail: [],
            });
          }
        }
      }
      world.powerUps.splice(i, 1);
    } else if (p.y > world.height + 24) {
      world.powerUps.splice(i, 1);
    }
  }

  // Update particles
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 260 * dt;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }

  // Check lost ball
  if (world.balls.length === 0) {
    world.lives -= 1;
    world.combo = 0;
    world.shake = 6;
    events.lifeLost = true;
    if (world.lives <= 0) {
      world.status = 'lost';
      events.gameOver = true;
    } else {
      world.balls = [makeStuckBall(world.paddleX, world.paddleY, world.nextEntityId++)];
    }
  }

  // Check stage clear
  const remainingBreakable = world.bricks.some((b) => !b.indestructible);
  if (!remainingBreakable && world.status === 'playing') {
    events.stageCleared = true;
    world.score += 500 * world.stage;
    if (world.stage >= world.maxStages) {
      world.status = 'won';
      events.gameWon = true;
    } else {
      world.stage += 1;
      const { bricks, nextId } = buildStageBricks(world.stage, world.width, world.nextEntityId);
      world.bricks = bricks;
      world.nextEntityId = nextId;
      world.powerUps = [];
      world.balls = [makeStuckBall(world.paddleX, world.paddleY, world.nextEntityId++)];
    }
  }

  return events;
}
