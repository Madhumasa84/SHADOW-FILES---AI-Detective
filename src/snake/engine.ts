export type SnakeDir = 'up' | 'down' | 'left' | 'right';
export type SnakeSpeedMode = 'cruise' | 'classic' | 'turbo';

export interface GridPoint {
  x: number;
  y: number;
}

export interface BonusOrb {
  x: number;
  y: number;
  ttlMs: number;
  maxTtlMs: number;
}

export interface SnakeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface SnakeWorld {
  cols: number;
  rows: number;
  speedMode: SnakeSpeedMode;
  wrapWalls: boolean;
  segments: GridPoint[];
  prevSegments: GridPoint[];
  direction: SnakeDir;
  inputQueue: SnakeDir[];
  food: GridPoint;
  bonusOrb: BonusOrb | null;
  score: number;
  orbsEaten: number;
  combo: number;
  comboTimerMs: number;
  stepIntervalMs: number;
  stepAccumulatorMs: number;
  elapsedMs: number;
  isGameOver: boolean;
  deathReason: 'wall' | 'self' | 'full' | null;
  shakeTrauma: number;
  particles: SnakeParticle[];
  events: {
    ateFood: boolean;
    ateBonus: boolean;
    crashed: boolean;
  };
}

export interface SnakeRecords {
  bestScore: number;
  bestLength: number;
  gamesPlayed: number;
}

const SNAKE_STORAGE_KEY = 'midnight_noir_snake_records_v1';

export const SNAKE_BASE_STEP_MS: Record<SnakeSpeedMode, number> = {
  cruise: 155,
  classic: 112,
  turbo: 78,
};

export function isOppositeDir(a: SnakeDir, b: SnakeDir): boolean {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

export function trySpawnOpenCell(
  cols: number,
  rows: number,
  occupied: GridPoint[],
  rng: () => number = Math.random
): GridPoint | null {
  const taken = new Set(occupied.map((p) => `${p.x},${p.y}`));
  const open: GridPoint[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!taken.has(`${x},${y}`)) {
        open.push({ x, y });
      }
    }
  }
  if (open.length === 0) return null;
  return open[Math.floor(rng() * open.length)];
}

export function spawnOpenCell(
  cols: number,
  rows: number,
  occupied: GridPoint[],
  rng: () => number = Math.random
): GridPoint {
  return trySpawnOpenCell(cols, rows, occupied, rng) ?? { x: 0, y: 0 };
}

export function createInitialSnakeWorld(
  speedMode: SnakeSpeedMode = 'classic',
  wrapWalls = false,
  rng: () => number = Math.random
): SnakeWorld {
  const cols = 24;
  const rows = 18;
  // Spawn centered facing right with wide open runway ahead
  const startY = Math.floor(rows / 2);
  const startX = 7;
  const segments: GridPoint[] = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
    { x: startX - 3, y: startY },
  ];

  const food = spawnOpenCell(cols, rows, segments, rng);

  return {
    cols,
    rows,
    speedMode,
    wrapWalls,
    segments,
    prevSegments: segments.map((s) => ({ ...s })),
    direction: 'right',
    inputQueue: [],
    food,
    bonusOrb: null,
    score: 0,
    orbsEaten: 0,
    combo: 1,
    comboTimerMs: 0,
    stepIntervalMs: SNAKE_BASE_STEP_MS[speedMode],
    stepAccumulatorMs: 0,
    elapsedMs: 0,
    isGameOver: false,
    deathReason: null,
    shakeTrauma: 0,
    particles: [],
    events: {
      ateFood: false,
      ateBonus: false,
      crashed: false,
    },
  };
}

export function enqueueSnakeDirection(world: SnakeWorld, nextDir: SnakeDir): void {
  if (world.isGameOver) return;
  const lastPlanned =
    world.inputQueue.length > 0 ? world.inputQueue[world.inputQueue.length - 1] : world.direction;
  if (nextDir === lastPlanned || isOppositeDir(lastPlanned, nextDir)) return;
  if (world.inputQueue.length < 2) {
    world.inputQueue.push(nextDir);
  }
}

function addBurst(
  world: SnakeWorld,
  gx: number,
  gy: number,
  color: string,
  count: number,
  rng: () => number
): void {
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    const spd = 1.6 + rng() * 4.2;
    world.particles.push({
      x: gx + 0.5,
      y: gy + 0.5,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.42,
      maxLife: 0.42,
      color,
      size: 2.5 + rng() * 2.5,
    });
  }
  if (world.particles.length > 96) {
    world.particles.splice(0, world.particles.length - 96);
  }
}

export function stepSnakeGridTick(
  world: SnakeWorld,
  rng: () => number = Math.random
): void {
  if (world.isGameOver) return;

  if (world.inputQueue.length > 0) {
    const next = world.inputQueue.shift()!;
    if (!isOppositeDir(world.direction, next)) {
      world.direction = next;
    }
  }

  world.prevSegments = world.segments.map((s) => ({ ...s }));

  const head = world.segments[0];
  let nx = head.x;
  let ny = head.y;
  if (world.direction === 'up') ny -= 1;
  else if (world.direction === 'down') ny += 1;
  else if (world.direction === 'left') nx -= 1;
  else nx += 1;

  if (world.wrapWalls) {
    nx = (nx + world.cols) % world.cols;
    ny = (ny + world.rows) % world.rows;
  } else if (nx < 0 || nx >= world.cols || ny < 0 || ny >= world.rows) {
    world.isGameOver = true;
    world.deathReason = 'wall';
    world.shakeTrauma = 0.85;
    world.events.crashed = true;
    addBurst(world, head.x, head.y, '#E85D5D', 18, rng);
    return;
  }

  const willEatFood = nx === world.food.x && ny === world.food.y;
  const willEatBonus =
    world.bonusOrb !== null && nx === world.bonusOrb.x && ny === world.bonusOrb.y;

  // Tail vacates on non-eating tick so moving into the tail's previous cell is legal
  const checkLength = willEatFood || willEatBonus ? world.segments.length : world.segments.length - 1;
  for (let i = 0; i < checkLength; i++) {
    if (world.segments[i].x === nx && world.segments[i].y === ny) {
      world.isGameOver = true;
      world.deathReason = 'self';
      world.shakeTrauma = 0.85;
      world.events.crashed = true;
      addBurst(world, nx, ny, '#E85D5D', 18, rng);
      return;
    }
  }

  world.segments.unshift({ x: nx, y: ny });

  if (willEatFood) {
    world.orbsEaten += 1;
    world.combo = world.comboTimerMs > 0 ? Math.min(5, world.combo + 1) : 1;
    world.comboTimerMs = 4500;
    world.score += 10 * world.combo;
    world.events.ateFood = true;
    world.shakeTrauma = Math.max(world.shakeTrauma, 0.22);
    addBurst(world, nx, ny, '#F5C45E', 12, rng);

    const occupied = [...world.segments];
    if (world.bonusOrb) occupied.push({ x: world.bonusOrb.x, y: world.bonusOrb.y });
    const nextFood = trySpawnOpenCell(world.cols, world.rows, occupied, rng);
    if (!nextFood) {
      // Player filled the entire grid!
      world.isGameOver = true;
      world.deathReason = 'full';
      world.bonusOrb = null;
      return;
    }
    world.food = nextFood;

    // Every 5th orb spawns a timed golden bonus orb worth 3x points
    if (world.orbsEaten % 5 === 0 && !world.bonusOrb) {
      const bonusPos = trySpawnOpenCell(
        world.cols,
        world.rows,
        [...world.segments, world.food],
        rng
      );
      if (bonusPos) {
        world.bonusOrb = {
          x: bonusPos.x,
          y: bonusPos.y,
          ttlMs: 6500,
          maxTtlMs: 6500,
        };
      }
    }

    // Gentle speed progression
    const base = SNAKE_BASE_STEP_MS[world.speedMode];
    const minStep = Math.max(54, base - 38);
    world.stepIntervalMs = Math.max(minStep, base - world.orbsEaten * 1.4);
  } else if (willEatBonus) {
    world.score += 35 * world.combo;
    world.comboTimerMs = 5200;
    world.bonusOrb = null;
    world.events.ateBonus = true;
    world.shakeTrauma = Math.max(world.shakeTrauma, 0.35);
    addBurst(world, nx, ny, '#70C3FF', 16, rng);
  } else {
    world.segments.pop();
  }
}

export function stepSnakeWorld(
  world: SnakeWorld,
  rawDtSec: number,
  rng: () => number = Math.random
): void {
  const dt = Math.min(Math.max(rawDtSec, 0), 0.05);
  const dtMs = dt * 1000;

  world.events.ateFood = false;
  world.events.ateBonus = false;
  world.events.crashed = false;
  world.shakeTrauma = Math.max(0, world.shakeTrauma - dt * 2.4);

  // Update visual particles even right after crash
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      world.particles.splice(i, 1);
    }
  }

  if (world.isGameOver) return;

  world.elapsedMs += dtMs;

  if (world.comboTimerMs > 0) {
    world.comboTimerMs = Math.max(0, world.comboTimerMs - dtMs);
    if (world.comboTimerMs === 0) {
      world.combo = 1;
    }
  }

  if (world.bonusOrb) {
    world.bonusOrb.ttlMs -= dtMs;
    if (world.bonusOrb.ttlMs <= 0) {
      world.bonusOrb = null;
    }
  }

  world.stepAccumulatorMs += dtMs;
  while (world.stepAccumulatorMs >= world.stepIntervalMs && !world.isGameOver) {
    world.stepAccumulatorMs -= world.stepIntervalMs;
    stepSnakeGridTick(world, rng);
  }
}

export function loadSnakeRecords(): SnakeRecords {
  const fallback: SnakeRecords = { bestScore: 0, bestLength: 4, gamesPlayed: 0 };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(SNAKE_STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<SnakeRecords>;
    return {
      bestScore: typeof p.bestScore === 'number' ? p.bestScore : 0,
      bestLength: typeof p.bestLength === 'number' ? p.bestLength : 4,
      gamesPlayed: typeof p.gamesPlayed === 'number' ? p.gamesPlayed : 0,
    };
  } catch {
    return fallback;
  }
}

export function saveSnakeRecord(score: number, length: number): SnakeRecords {
  const cur = loadSnakeRecords();
  const next: SnakeRecords = {
    bestScore: Math.max(cur.bestScore, score),
    bestLength: Math.max(cur.bestLength, length),
    gamesPlayed: cur.gamesPlayed + 1,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SNAKE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}
