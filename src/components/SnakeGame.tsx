import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  createInitialSnakeWorld,
  enqueueSnakeDirection,
  loadSnakeRecords,
  saveSnakeRecord,
  stepSnakeWorld,
  type SnakeDir,
  type SnakeRecords,
  type SnakeSpeedMode,
  type SnakeWorld,
} from '../snake/engine';
import { NoirImage } from './NoirImage';

export const SNAKE_BACKDROP_URL =
  '/src/assets/images/game_snake_midnight_grid_1795285256805.jpg';

interface SnakeGameProps {
  autoStart?: boolean;
  onSwitchGame: () => void;
}

type SnakePhase = 'title' | 'playing' | 'paused' | 'gameover';

interface SnakeHud {
  score: number;
  length: number;
  combo: number;
  orbsEaten: number;
  bonusActive: boolean;
  deathReason: 'wall' | 'self' | 'full' | null;
}

function readSnakeHud(w: SnakeWorld): SnakeHud {
  return {
    score: w.score,
    length: w.segments.length,
    combo: w.combo,
    orbsEaten: w.orbsEaten,
    bonusActive: w.bonusOrb !== null,
    deathReason: w.deathReason,
  };
}

function playSnakeTone(muted: boolean, kind: 'eat' | 'bonus' | 'crash'): void {
  if (muted || typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    if (kind === 'eat') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (kind === 'bonus') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(780, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.18);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(64, now + 0.28);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    }
    setTimeout(() => ctx.close().catch(() => {}), 380);
  } catch {
    // Ignore autoplay errors
  }
}

function renderSnakeCanvas(
  ctx: CanvasRenderingContext2D,
  w: SnakeWorld,
  viewW: number,
  viewH: number
): void {
  ctx.fillStyle = '#090B10';
  ctx.fillRect(0, 0, viewW, viewH);

  const pad = Math.min(28, viewW * 0.04);
  const cellSize = Math.floor(
    Math.min((viewW - pad * 2) / w.cols, (viewH - pad * 2) / w.rows)
  );
  const boardW = cellSize * w.cols;
  const boardH = cellSize * w.rows;

  const shakeMag = w.shakeTrauma * w.shakeTrauma * 9;
  const sx = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
  const sy = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;

  const ox = Math.floor((viewW - boardW) * 0.5 + sx);
  const oy = Math.floor((viewH - boardH) * 0.5 + sy);

  // Arena floor
  ctx.fillStyle = '#0F131C';
  ctx.fillRect(ox, oy, boardW, boardH);

  // Crisp subtle grid lines
  ctx.strokeStyle = 'rgba(40, 49, 68, 0.42)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= w.cols; c++) {
    const gx = ox + c * cellSize + 0.5;
    ctx.moveTo(gx, oy);
    ctx.lineTo(gx, oy + boardH);
  }
  for (let r = 0; r <= w.rows; r++) {
    const gy = oy + r * cellSize + 0.5;
    ctx.moveTo(ox, gy);
    ctx.lineTo(ox + boardW, gy);
  }
  ctx.stroke();

  // Outer perimeter rail (gold-tinted when wrap is off, cool slate dashed when wrap is on)
  ctx.strokeStyle = w.wrapWalls ? 'rgba(112, 195, 255, 0.55)' : '#D99B38';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox - 1, oy - 1, boardW + 2, boardH + 2);

  // Regular glowing amber food orb
  const pulse = 0.88 + 0.12 * Math.sin(w.elapsedMs * 0.008);
  const fx = ox + (w.food.x + 0.5) * cellSize;
  const fy = oy + (w.food.y + 0.5) * cellSize;
  ctx.fillStyle = 'rgba(235, 181, 86, 0.22)';
  ctx.beginPath();
  ctx.arc(fx, fy, cellSize * 0.58 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#EBB556';
  ctx.beginPath();
  ctx.arc(fx, fy, cellSize * 0.34 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFF5D6';
  ctx.beginPath();
  ctx.arc(fx - cellSize * 0.09, fy - cellSize * 0.09, cellSize * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Timed blue-platinum Bonus Orb
  if (w.bonusOrb) {
    const bx = ox + (w.bonusOrb.x + 0.5) * cellSize;
    const by = oy + (w.bonusOrb.y + 0.5) * cellSize;
    const ratio = Math.max(0, w.bonusOrb.ttlMs / w.bonusOrb.maxTtlMs);
    ctx.strokeStyle = '#70C3FF';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(bx, by, cellSize * 0.46, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * ratio);
    ctx.stroke();

    ctx.fillStyle = '#70C3FF';
    ctx.beginPath();
    ctx.arc(bx, by, cellSize * 0.28 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Smoothly interpolated serpent body
  const t = w.isGameOver ? 1 : Math.min(1, w.stepAccumulatorMs / Math.max(1, w.stepIntervalMs));
  const len = w.segments.length;

  for (let i = len - 1; i >= 0; i--) {
    const curr = w.segments[i];
    const prev = w.prevSegments[Math.min(i, w.prevSegments.length - 1)] ?? curr;

    // Avoid interpolating across screen when wrapping walls
    const wrapped = Math.abs(curr.x - prev.x) > 1 || Math.abs(curr.y - prev.y) > 1;
    const ix = wrapped ? curr.x : prev.x + (curr.x - prev.x) * t;
    const iy = wrapped ? curr.y : prev.y + (curr.y - prev.y) * t;

    const px = ox + ix * cellSize;
    const py = oy + iy * cellSize;
    const inset = i === 0 ? 1.5 : 2.5 + (i / Math.max(1, len)) * 2.2;
    const sz = Math.max(6, cellSize - inset * 2);

    const ratio = 1 - i / Math.max(1, len);
    if (i === 0) {
      ctx.fillStyle = '#F5C45E';
    } else if (i % 2 === 0) {
      ctx.fillStyle = `rgb(${Math.round(168 + ratio * 55)}, ${Math.round(115 + ratio * 48)}, ${Math.round(38 + ratio * 22)})`;
    } else {
      ctx.fillStyle = `rgb(${Math.round(126 + ratio * 48)}, ${Math.round(86 + ratio * 38)}, ${Math.round(30 + ratio * 18)})`;
    }

    ctx.beginPath();
    ctx.roundRect(px + inset, py + inset, sz, sz, i === 0 ? 6 : 4);
    ctx.fill();

    // Crisp dark spine accent on body segments
    if (i > 0 && sz > 10) {
      ctx.fillStyle = 'rgba(11, 13, 18, 0.35)';
      ctx.fillRect(px + cellSize * 0.5 - 2, py + cellSize * 0.5 - 2, 4, 4);
    }

    // Glowing serpent eyes on head
    if (i === 0) {
      const cx = px + cellSize * 0.5;
      const cy = py + cellSize * 0.5;
      const eyeOffset = cellSize * 0.19;
      const fwdOffset = cellSize * 0.18;
      let e1x = cx;
      let e1y = cy;
      let e2x = cx;
      let e2y = cy;

      if (w.direction === 'right') {
        e1x = cx + fwdOffset;
        e1y = cy - eyeOffset;
        e2x = cx + fwdOffset;
        e2y = cy + eyeOffset;
      } else if (w.direction === 'left') {
        e1x = cx - fwdOffset;
        e1y = cy - eyeOffset;
        e2x = cx - fwdOffset;
        e2y = cy + eyeOffset;
      } else if (w.direction === 'up') {
        e1x = cx - eyeOffset;
        e1y = cy - fwdOffset;
        e2x = cx + eyeOffset;
        e2y = cy - fwdOffset;
      } else {
        e1x = cx - eyeOffset;
        e1y = cy + fwdOffset;
        e2x = cx + eyeOffset;
        e2y = cy + fwdOffset;
      }

      ctx.fillStyle = '#0C0E12';
      ctx.beginPath();
      ctx.arc(e1x, e1y, Math.max(2, cellSize * 0.09), 0, Math.PI * 2);
      ctx.arc(e2x, e2y, Math.max(2, cellSize * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Particle bursts
  for (let i = 0; i < w.particles.length; i++) {
    const p = w.particles[i];
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(ox + p.x * cellSize, oy + p.y * cellSize, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function SnakeGame({ autoStart = false, onSwitchGame }: SnakeGameProps) {
  const [speedMode, setSpeedMode] = useState<SnakeSpeedMode>('classic');
  const [wrapWalls, setWrapWalls] = useState<boolean>(false);
  const [phase, setPhase] = useState<SnakePhase>(() => (autoStart ? 'playing' : 'title'));
  const [muted, setMuted] = useState<boolean>(false);
  const [records, setRecords] = useState<SnakeRecords>(() => loadSnakeRecords());
  const [hud, setHud] = useState<SnakeHud>(() => readSnakeHud(createInitialSnakeWorld('classic', false)));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<SnakeWorld>(createInitialSnakeWorld('classic', false));
  const phaseRef = useRef<SnakePhase>(phase);
  const mutedRef = useRef<boolean>(muted);

  phaseRef.current = phase;
  mutedRef.current = muted;

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const startGame = useCallback(
    (spdOverride?: SnakeSpeedMode, wrapOverride?: boolean) => {
      const targetSpd = spdOverride ?? speedMode;
      const targetWrap = wrapOverride ?? wrapWalls;
      const fresh = createInitialSnakeWorld(targetSpd, targetWrap);
      worldRef.current = fresh;
      setHud(readSnakeHud(fresh));
      document.body.dataset.state = 'playing';
      setPhase('playing');
    },
    [speedMode, wrapWalls]
  );

  const steer = useCallback((dir: SnakeDir) => {
    if (phaseRef.current !== 'playing') return;
    enqueueSnakeDirection(worldRef.current, dir);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current === 'title') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (phaseRef.current === 'playing') {
          e.preventDefault();
          setPhase('paused');
        } else if (phaseRef.current === 'paused') {
          e.preventDefault();
          setPhase('playing');
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        setMuted((m) => !m);
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused' || phaseRef.current === 'gameover') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (phaseRef.current !== 'playing') return;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        steer('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        steer('down');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        steer('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        steer('right');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startGame, steer]);

  // Isolated 60 FPS Canvas Loop
  useEffect(() => {
    if (phase === 'title') return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!ctx) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;
    const syncSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);

    let rafId = 0;
    let lastTime = performance.now();
    let hudTimer = 0;

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      const world = worldRef.current;
      if (phaseRef.current === 'playing') {
        stepSnakeWorld(world, rawDt);

        if (world.events.ateFood) {
          playSnakeTone(mutedRef.current, 'eat');
          setHud(readSnakeHud(world));
        }
        if (world.events.ateBonus) {
          playSnakeTone(mutedRef.current, 'bonus');
          setHud(readSnakeHud(world));
        }
        if (world.events.crashed || world.isGameOver) {
          playSnakeTone(mutedRef.current, world.deathReason === 'full' ? 'bonus' : 'crash');
          setRecords(saveSnakeRecord(world.score, world.segments.length));
          setHud(readSnakeHud(world));
          document.body.dataset.state = 'gameover';
          setPhase('gameover');
        }

        hudTimer += rawDt;
        if (hudTimer >= 0.2) {
          hudTimer = 0;
          setHud(readSnakeHud(world));
        }
      }

      renderSnakeCanvas(ctx, world, width, height);
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [phase === 'title']);

  if (phase === 'title') {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#0B0D11] text-[#F2ECDC] select-none">
        <div className="absolute inset-0">
          <NoirImage
            src={SNAKE_BACKDROP_URL}
            alt="Glowing golden articulated serpent gliding across a midnight rain-slicked grid"
            className="h-full w-full object-cover object-center opacity-85"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#090B10]/96 via-[#0B0D12]/82 to-[#0B0D12]/25"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#090B10] via-transparent to-[#090B10]/65"
          />
        </div>

        <main className="relative z-10 flex h-full w-full flex-col justify-between px-6 py-6 sm:px-12 sm:py-9 lg:px-16">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onSwitchGame}
              className="inline-flex items-center gap-2 text-xs font-medium text-[#C5CCD8] hover:text-[#F4EFE4] transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Switch Game</span>
            </button>
            <div className="text-xs font-mono-tabular text-[#A9B3C4]">
              {records.bestScore > 0
                ? `BEST SCORE ${records.bestScore} · LONGEST ${records.bestLength}`
                : 'ARCADE REFLEX · COMBO MULTIPLIERS'}
            </div>
          </div>

          <div className="max-w-xl my-auto">
            <svg
              viewBox="0 0 460 106"
              className="w-full max-w-[430px] h-auto mb-3"
              role="img"
              aria-label="NEON VIPER — Midnight Arcade Snake"
            >
              <g transform="translate(2, 10)" stroke="#D99B38" strokeWidth="2.2" fill="none">
                <path d="M2 16 H16 V4 H30 V16 H44" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="46" cy="16" r="3" fill="#EBB556" stroke="none" />
              </g>
              <text
                x="62"
                y="22"
                fill="#D99B38"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="11"
                letterSpacing="3.2"
                fontWeight="500"
              >
                MIDNIGHT ARCADE CLASSIC
              </text>
              <text
                x="2"
                y="90"
                fill="#F4EFE4"
                fontFamily="Fraunces, Georgia, serif"
                fontSize="60"
                fontWeight="700"
                letterSpacing="-1"
              >
                NEON VIPER
              </text>
              <line x1="4" y1="103" x2="395" y2="103" stroke="#2D3647" strokeWidth="1.2" />
            </svg>
            <p className="mb-5 text-sm sm:text-base text-[#C7C0B0] leading-relaxed max-w-md">
              Chain amber orbs for 5× streaks and hunt timed bonus spheres across the grid.
            </p>

            <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <div className="mb-2 text-xs font-mono-tabular text-[#98A2B3]">SPEED</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['cruise', 'classic', 'turbo'] as SnakeSpeedMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSpeedMode(mode)}
                      aria-pressed={speedMode === mode}
                      className={`rounded-md border px-2 py-2.5 text-xs font-mono-tabular capitalize transition-colors cursor-pointer ${
                        speedMode === mode
                          ? 'border-[#D99B38] bg-[#1D222E] text-[#F4EFE4] font-semibold'
                          : 'border-[#273041] bg-[#11151D]/85 text-[#9AA4B6] hover:border-[#414F69]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-mono-tabular text-[#98A2B3]">ARENA WALLS</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWrapWalls(false)}
                    aria-pressed={!wrapWalls}
                    className={`rounded-md border px-3 py-2.5 text-xs font-mono-tabular transition-colors cursor-pointer ${
                      !wrapWalls
                        ? 'border-[#D99B38] bg-[#1D222E] text-[#F4EFE4] font-semibold'
                        : 'border-[#273041] bg-[#11151D]/85 text-[#9AA4B6] hover:border-[#414F69]'
                    }`}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    onClick={() => setWrapWalls(true)}
                    aria-pressed={wrapWalls}
                    className={`rounded-md border px-3 py-2.5 text-xs font-mono-tabular transition-colors cursor-pointer ${
                      wrapWalls
                        ? 'border-[#D99B38] bg-[#1D222E] text-[#F4EFE4] font-semibold'
                        : 'border-[#273041] bg-[#11151D]/85 text-[#9AA4B6] hover:border-[#414F69]'
                    }`}
                  >
                    Wrap
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                data-start="true"
                onClick={() => startGame()}
                className="inline-flex items-center gap-2.5 rounded-md bg-[#D99B38] px-6 py-3.5 text-sm font-semibold text-[#0C0E12] shadow-lg transition-transform duration-150 hover:bg-[#EBB556] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Zap className="h-4 w-4" aria-hidden="true" />
                <span>Start Arcade Run</span>
              </button>

              <button
                type="button"
                onClick={onSwitchGame}
                className="inline-flex items-center rounded-md border border-[#354054] bg-[#131720]/90 px-5 py-3.5 text-sm font-medium text-[#ECE6D8] transition-colors hover:border-[#D99B38]/60 hover:bg-[#1B202C] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Back to Game Select
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#202634] pt-4 text-xs text-[#9AA4B6]">
            <p className="font-mono-tabular">
              WASD / Arrow Keys Steer · Esc / P Pause · R Restart · M Audio
            </p>
            <p className="hidden sm:block text-[#828B9C]">Press Enter or Space to start</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#090B10] text-[#F2ECDC] select-none">
      {/* Compact Top Perimeter Bar */}
      <header className="z-20 flex items-center justify-between gap-4 border-b border-[#1E2432] bg-[#0E1118] px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={onSwitchGame}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A9B3C4] hover:text-[#F4EFE4] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Hub</span>
          </button>

          <div className="h-4 w-px bg-[#252D3D]" aria-hidden="true" />

          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">SCORE</span>
            <span className="font-mono-tabular text-lg sm:text-xl font-bold text-[#EBB556]">
              {hud.score}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">LENGTH</span>
            <span className="font-mono-tabular text-lg sm:text-xl font-bold text-[#F4EFE4]">
              {hud.length}
            </span>
          </div>

          <div className="hidden sm:flex items-baseline gap-2">
            <span className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">STREAK</span>
            <span className="font-mono-tabular text-base font-semibold text-[#70C3FF]">
              {hud.combo}×
            </span>
          </div>

          {hud.bonusActive && (
            <span className="hidden md:inline font-mono-tabular text-xs font-semibold text-[#70C3FF]">
              BONUS ORB ACTIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setMuted((m) => !m);
            }}
            aria-label={muted ? 'Unmute snake audio' : 'Mute snake audio'}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#131823] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4 text-[#D99B38]" aria-hidden="true" />}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              startGame();
            }}
            aria-label="Restart snake run"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#131823] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setPhase('paused');
            }}
            aria-label="Pause snake run"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#131823] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
          >
            <Pause className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Isolated 60 FPS Canvas Container */}
      <div ref={containerRef} className="relative flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          data-testid="snake-canvas"
          data-score={hud.score}
          data-length={hud.length}
          className="block h-full w-full"
        />
      </div>

      {/* Mobile Touch D-Pad */}
      {phase === 'playing' && (
        <div className="flex items-center justify-center gap-2 border-t border-[#1D2330] bg-[#0D1017] py-2.5 md:hidden">
          <button
            type="button"
            onPointerDown={() => steer('left')}
            aria-label="Turn left"
            className="flex h-12 w-12 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#F4EFE4] active:bg-[#D99B38] active:text-[#0C0E12]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onPointerDown={() => steer('up')}
            aria-label="Turn up"
            className="flex h-12 w-12 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#F4EFE4] active:bg-[#D99B38] active:text-[#0C0E12]"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onPointerDown={() => steer('down')}
            aria-label="Turn down"
            className="flex h-12 w-12 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#F4EFE4] active:bg-[#D99B38] active:text-[#0C0E12]"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onPointerDown={() => steer('right')}
            aria-label="Turn right"
            className="flex h-12 w-12 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#F4EFE4] active:bg-[#D99B38] active:text-[#0C0E12]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="snake-pause-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/80 p-4"
        >
          <div className="w-full max-w-sm rounded-md border border-[#2C3547] bg-[#12161F] p-6 shadow-2xl">
            <div className="font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              NEON VIPER · PAUSED
            </div>
            <h2 id="snake-pause-title" className="mt-1 font-display text-2xl font-bold text-[#F4EFE4]">
              Run Paused
            </h2>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPhase('playing')}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#D99B38] px-4 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] cursor-pointer"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Resume</span>
              </button>
              <button
                type="button"
                onClick={() => startGame()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#323C4F] bg-[#171C27] px-4 py-2.5 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Restart Run</span>
              </button>
              <button
                type="button"
                onClick={() => setPhase('title')}
                className="inline-flex items-center justify-center rounded-md border border-[#283040] bg-[#131720] px-4 py-2.5 text-sm font-medium text-[#B8C1D1] hover:text-[#F4EFE4] cursor-pointer"
              >
                Speed & Wall Setup
              </button>
              <button
                type="button"
                onClick={onSwitchGame}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#283040] bg-[#10141C] px-4 py-2.5 text-sm font-medium text-[#9AA4B6] hover:text-[#F4EFE4] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Switch Game</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {phase === 'gameover' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="snake-gameover-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/85 p-4"
        >
          <div className="w-full max-w-md rounded-md border border-[#2E384B] bg-[#12161F] p-6 shadow-2xl">
            <div className="flex items-center gap-2 font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {hud.deathReason === 'full'
                  ? 'PERFECT GRID CLEAR'
                  : hud.deathReason === 'wall'
                  ? 'WALL IMPACT'
                  : 'TAIL COLLISION'}
              </span>
            </div>
            <h2 id="snake-gameover-title" className="mt-1.5 font-display text-3xl font-bold text-[#F4EFE4]">
              {hud.deathReason === 'full' ? 'Arena Mastered' : 'Run Complete'}
            </h2>
            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#222A39] py-4">
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">SCORE</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">{hud.score}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">BEST</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#EBB556]">
                  {Math.max(records.bestScore, hud.score)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">LENGTH</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {hud.length}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => startGame()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-[#D99B38] px-5 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Play Again</span>
              </button>
              <button
                type="button"
                onClick={onSwitchGame}
                className="inline-flex items-center justify-center rounded-md border border-[#333E52] bg-[#171C27] px-5 py-3 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 whitespace-nowrap cursor-pointer"
              >
                Switch Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
