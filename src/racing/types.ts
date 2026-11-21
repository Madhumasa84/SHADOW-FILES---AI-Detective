export type RacingPhase = 'title' | 'countdown' | 'playing' | 'paused' | 'gameover';
export type CameraMode = 'chase' | 'hood' | 'topdown';

export interface Vec2 {
  x: number;
  y: number;
}

export interface TrackSample {
  x: number;
  y: number;
  tx: number; // Unit tangent X
  ty: number; // Unit tangent Y
  nx: number; // Unit right-hand normal X
  ny: number; // Unit right-hand normal Y
  s: number; // Cumulative arc length from start/finish
  curvature: number; // Signed curvature for AI corner braking
}

export interface BoostPad {
  sampleIndex: number;
  lateralOffset: number; // Signed pixels from centerline
  length: number;
  width: number;
}

export interface CircuitDefinition {
  id: 'obsidian-ring' | 'harbor-chicane';
  name: string;
  subtitle: string;
  difficulty: 'Standard' | 'Technical';
  totalLaps: number;
  roadHalfWidth: number;
  shoulderWidth: number;
  controlPoints: Vec2[];
  boostPads: BoostPad[];
}

export interface BuiltTrack {
  def: CircuitDefinition;
  samples: TrackSample[];
  totalLength: number;
  checkpointIndices: number[]; // 4 sequential gate sample indices around the loop
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export type AiPolicy = 'apex_hugger' | 'late_braker' | 'top_speed';

export interface RacerState {
  id: string;
  name: string;
  number: string;
  isPlayer: boolean;
  primaryColor: string;
  accentColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // Heading radians
  speed: number; // Forward speed px/s
  angularVelocity: number;
  steerAngle: number;
  drifting: boolean;
  braking: boolean;
  boosting: boolean;
  nitro: number; // 0..100
  offTrack: boolean;
  trackSampleIdx: number;
  lateralOffset: number;
  lap: number; // 1-indexed current lap
  nextCheckpoint: number; // 0..3
  lapStartTime: number;
  bestLapMs: number | null;
  totalProgress: number; // Continuous score for live rank sorting
  finished: boolean;
  finishTimeMs: number | null;
  rank: number; // 1..4
  hitFlash: number; // 0..1 visual bump flash
  // AI-only traits
  aiPolicy?: AiPolicy;
  aiPreferredOffset: number;
  aiSkill: number;
}

export interface RaceInput {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  boost: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface SkidMark {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

export interface RaceSnapshot {
  circuitId: CircuitDefinition['id'];
  circuitName: string;
  playerRank: number;
  totalRacers: number;
  totalTimeMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  standings: Array<{
    id: string;
    name: string;
    number: string;
    isPlayer: boolean;
    rank: number;
    primaryColor: string;
    finishTimeMs: number | null;
    lap: number;
  }>;
}

export interface RaceWorldState {
  track: BuiltTrack;
  racers: RacerState[];
  countdownRemaining: number; // seconds before GO
  elapsedMs: number;
  camera: {
    x: number;
    y: number;
    angle: number;
    steerSway: number;
    zoom: number;
    shakeTrauma: number;
  };
  hitstopTimer: number;
  topSpeedKmh: number;
  finished: boolean;
  snapshot: RaceSnapshot | null;
  particles: Particle[];
  particleCursor: number;
  skids: SkidMark[];
  skidCursor: number;
  lastLapNotified: number;
  events: {
    collision: number;
    boostStart: boolean;
    lapComplete: boolean;
    raceFinish: boolean;
    countdownTick: number | null;
  };
}
