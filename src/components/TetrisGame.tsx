import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Layers,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  RotateCw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  clearTetrisEvents,
  createInitialTetrisWorld,
  getGhostRow,
  getPieceCells,
  getPreviewShape,
  hardDropTetrisPiece,
  holdTetrisPiece,
  loadTetrisRecords,
  moveTetrisPiece,
  rotateTetrisPiece,
  saveTetrisRecord,
  softDropTetrisPiece,
  stepTetrisWorld,
  TETROMINO_COLORS,
  type TetrisRecords,
  type TetrisWorld,
  type TetrominoType,
} from '../tetris/engine';
import { NoirImage } from './NoirImage';

export const TETRIS_BACKDROP_URL =
  '/src/assets/images/game_tetris_noir_blocks_1795285368692.jpg';

interface TetrisGameProps {
  autoStart?: boolean;
  onSwitchGame: () => void;
}

type TetrisPhase = 'title' | 'playing' | 'paused' | 'gameover';

interface TetrisHud {
  score: number;
  lines: number;
  level: number;
  hold: TetrominoType | null;
  nextQueue: TetrominoType[];
  callout: string | null;
}

function readTetrisHud(w: TetrisWorld): TetrisHud {
  return {
    score: w.score,
    lines: w.lines,
    level: w.level,
    hold: w.hold,
    nextQueue: w.nextQueue.slice(0, 3),
    callout: w.lastCallout,
  };
}

function playTetrisSfx(
  muted: boolean,
  kind: 'move' | 'rotate' | 'drop' | 'clear' | 'tetris' | 'gameover'
): void {
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

    if (kind === 'move') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, now);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (kind === 'rotate') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.06);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.075);
    } else if (kind === 'drop') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (kind === 'clear') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(587, now + 0.06);
      gain.gain.setValueAtTime(0.085, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (kind === 'tetris') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.07);
      osc.frequency.setValueAtTime(784, now + 0.14);
      osc.frequency.setValueAtTime(1046, now + 0.21);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(78, now + 0.35);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }
    setTimeout(() => ctx.close().catch(() => {}), 450);
  } catch {
    // Ignore autoplay errors
  }
}

function drawFacetedBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: TetrominoType,
  alpha = 1
): void {
  const palette = TETROMINO_COLORS[type];
  const pad = 1;
  const bx = x + pad;
  const by = y + pad;
  const bs = size - pad * 2;
  const bevel = Math.max(2.5, bs * 0.16);

  ctx.save();
  ctx.globalAlpha = alpha;

  // Main face
  ctx.fillStyle = palette.fill;
  ctx.fillRect(bx, by, bs, bs);

  // Top & left bright bevel
  ctx.fillStyle = palette.highlight;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + bs, by);
  ctx.lineTo(bx + bs - bevel, by + bevel);
  ctx.lineTo(bx + bevel, by + bevel);
  ctx.lineTo(bx + bevel, by + bs - bevel);
  ctx.lineTo(bx, by + bs);
  ctx.closePath();
  ctx.fill();

  // Bottom & right dark bevel
  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  ctx.moveTo(bx + bs, by);
  ctx.lineTo(bx + bs, by + bs);
  ctx.lineTo(bx, by + bs);
  ctx.lineTo(bx + bevel, by + bs - bevel);
  ctx.lineTo(bx + bs - bevel, by + bs - bevel);
  ctx.lineTo(bx + bs - bevel, by + bevel);
  ctx.closePath();
  ctx.fill();

  // Subtle center jewel sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(bx + bevel, by + bevel, bs - bevel * 2, (bs - bevel * 2) * 0.35);

  ctx.restore();
}

function renderTetrisCanvas(
  ctx: CanvasRenderingContext2D,
  w: TetrisWorld,
  viewW: number,
  viewH: number
): void {
  ctx.fillStyle = '#0A0D13';
  ctx.fillRect(0, 0, viewW, viewH);

  const pad = 14;
  const cell = Math.floor(Math.min((viewW - pad * 2) / w.cols, (viewH - pad * 2) / w.rows));
  const boardW = cell * w.cols;
  const boardH = cell * w.rows;

  const shakeMag = w.shakeTrauma * w.shakeTrauma * 7;
  const sx = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
  const sy = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;

  const ox = Math.floor((viewW - boardW) * 0.5 + sx);
  const oy = Math.floor((viewH - boardH) * 0.5 + sy);

  // Well background
  ctx.fillStyle = '#0F131D';
  ctx.fillRect(ox, oy, boardW, boardH);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(42, 52, 72, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= w.cols; c++) {
    const gx = ox + c * cell + 0.5;
    ctx.moveTo(gx, oy);
    ctx.lineTo(gx, oy + boardH);
  }
  for (let r = 0; r <= w.rows; r++) {
    const gy = oy + r * cell + 0.5;
    ctx.moveTo(ox, gy);
    ctx.lineTo(ox + boardW, gy);
  }
  ctx.stroke();

  // Locked blocks
  for (let r = 0; r < w.rows; r++) {
    for (let c = 0; c < w.cols; c++) {
      const t = w.board[r][c];
      if (t) {
        drawFacetedBlock(ctx, ox + c * cell, oy + r * cell, cell, t, 1);
      }
    }
  }

  // Ghost landing outline
  if (!w.isGameOver) {
    const ghostRow = getGhostRow(w.board, w.active);
    const ghostCells = getPieceCells({ ...w.active, row: ghostRow });
    const palette = TETROMINO_COLORS[w.active.type];
    ctx.strokeStyle = palette.fill;
    ctx.lineWidth = 1.6;
    for (const [r, c] of ghostCells) {
      if (r < 0) continue;
      ctx.fillStyle = 'rgba(244, 239, 228, 0.05)';
      ctx.fillRect(ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4);
      ctx.strokeRect(ox + c * cell + 2.5, oy + r * cell + 2.5, cell - 5, cell - 5);
    }

    // Active falling piece
    const activeCells = getPieceCells(w.active);
    for (const [r, c] of activeCells) {
      if (r < 0) continue;
      drawFacetedBlock(ctx, ox + c * cell, oy + r * cell, cell, w.active.type, 1);
    }
  }

  // Line-clear gold flash overlay
  if (w.clearFlashTimerMs > 0) {
    const alpha = (w.clearFlashTimerMs / 240) * 0.22;
    ctx.fillStyle = `rgba(235, 181, 86, ${alpha.toFixed(3)})`;
    ctx.fillRect(ox, oy, boardW, boardH);
  }

  // Art-deco brass frame border
  ctx.strokeStyle = '#D99B38';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox - 1, oy - 1, boardW + 2, boardH + 2);
}

function MiniPiecePreview({ type, muted = false }: { type: TetrominoType | null; muted?: boolean }) {
  if (!type) {
    return (
      <div className="flex h-14 w-full items-center justify-center text-[11px] font-mono-tabular text-[#677286]">
        EMPTY
      </div>
    );
  }
  const cells = getPreviewShape(type);
  const palette = TETROMINO_COLORS[type];
  const minR = Math.min(...cells.map(([r]) => r));
  const maxR = Math.max(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const w = maxC - minC + 1;
  const h = maxR - minR + 1;

  return (
    <div className={`flex h-14 w-full items-center justify-center ${muted ? 'opacity-45' : ''}`}>
      <svg width={w * 16} height={h * 16} viewBox={`0 0 ${w * 16} ${h * 16}`} aria-label={`${type} piece`}>
        {cells.map(([r, c], i) => (
          <g key={i} transform={`translate(${(c - minC) * 16}, ${(r - minR) * 16})`}>
            <rect x="1" y="1" width="14" height="14" rx="1.5" fill={palette.fill} />
            <rect x="1" y="1" width="14" height="3" fill={palette.highlight} fillOpacity="0.6" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function TetrisGame({ autoStart = false, onSwitchGame }: TetrisGameProps) {
  const [startLevel, setStartLevel] = useState<number>(1);
  const [phase, setPhase] = useState<TetrisPhase>(() => (autoStart ? 'playing' : 'title'));
  const [muted, setMuted] = useState<boolean>(false);
  const [records, setRecords] = useState<TetrisRecords>(() => loadTetrisRecords());
  const [hud, setHud] = useState<TetrisHud>(() => readTetrisHud(createInitialTetrisWorld(1)));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<TetrisWorld>(createInitialTetrisWorld(1));
  const phaseRef = useRef<TetrisPhase>(phase);
  const mutedRef = useRef<boolean>(muted);

  phaseRef.current = phase;
  mutedRef.current = muted;

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const flushEvents = useCallback((w: TetrisWorld) => {
    if (w.events.linesCleared >= 4) {
      playTetrisSfx(mutedRef.current, 'tetris');
    } else if (w.events.linesCleared > 0) {
      playTetrisSfx(mutedRef.current, 'clear');
    } else if (w.events.hardDropped) {
      playTetrisSfx(mutedRef.current, 'drop');
    } else if (w.events.rotated) {
      playTetrisSfx(mutedRef.current, 'rotate');
    } else if (w.events.moved) {
      playTetrisSfx(mutedRef.current, 'move');
    }

    if (w.events.gameOver) {
      playTetrisSfx(mutedRef.current, 'gameover');
      setRecords(saveTetrisRecord(w.score, w.lines));
      document.body.dataset.state = 'gameover';
      setPhase('gameover');
    }
    clearTetrisEvents(w);
    setHud(readTetrisHud(w));
  }, []);

  const startGame = useCallback(
    (lvlOverride?: number) => {
      const targetLevel = lvlOverride ?? startLevel;
      const fresh = createInitialTetrisWorld(targetLevel);
      worldRef.current = fresh;
      setHud(readTetrisHud(fresh));
      document.body.dataset.state = 'playing';
      setPhase('playing');
    },
    [startLevel]
  );

  const actLeft = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    moveTetrisPiece(worldRef.current, 0, -1);
    flushEvents(worldRef.current);
  }, [flushEvents]);

  const actRight = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    moveTetrisPiece(worldRef.current, 0, 1);
    flushEvents(worldRef.current);
  }, [flushEvents]);

  const actSoftDrop = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    softDropTetrisPiece(worldRef.current);
    flushEvents(worldRef.current);
  }, [flushEvents]);

  const actHardDrop = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    hardDropTetrisPiece(worldRef.current);
    flushEvents(worldRef.current);
  }, [flushEvents]);

  const actRotate = useCallback(
    (dir: 1 | -1) => {
      if (phaseRef.current !== 'playing') return;
      rotateTetrisPiece(worldRef.current, dir);
      flushEvents(worldRef.current);
    },
    [flushEvents]
  );

  const actHold = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    holdTetrisPiece(worldRef.current);
    flushEvents(worldRef.current);
  }, [flushEvents]);

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

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        actLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        actRight();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        actSoftDrop();
      } else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        actRotate(1);
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        actRotate(-1);
      } else if (e.key === ' ') {
        e.preventDefault();
        actHardDrop();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') {
        e.preventDefault();
        actHold();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startGame, actLeft, actRight, actSoftDrop, actHardDrop, actRotate, actHold]);

  // Isolated 60 FPS Canvas Loop
  useEffect(() => {
    if (phase === 'title') return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!ctx) return;

    let width = container.clientWidth || 360;
    let height = container.clientHeight || 680;
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
        stepTetrisWorld(world, rawDt);
        if (world.events.linesCleared > 0 || world.events.locked || world.events.gameOver) {
          flushEvents(world);
        } else {
          hudTimer += rawDt;
          if (hudTimer >= 0.25) {
            hudTimer = 0;
            setHud(readTetrisHud(world));
          }
        }
      }

      renderTetrisCanvas(ctx, world, width, height);
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [phase === 'title', flushEvents]);

  if (phase === 'title') {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#0B0D11] text-[#F2ECDC] select-none">
        <div className="absolute inset-0">
          <NoirImage
            src={TETRIS_BACKDROP_URL}
            alt="Faceted amber, sapphire, and crimson geometric glass blocks stacked inside an art-deco steel frame"
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
                ? `BEST SCORE ${records.bestScore.toLocaleString()} · ${records.bestLines} LINES`
                : '7-BAG RANDOMIZER · WALL KICKS · HOLD & GHOST'}
            </div>
          </div>

          <div className="max-w-xl my-auto">
            <svg
              viewBox="0 0 460 104"
              className="w-full max-w-[440px] h-auto mb-3"
              role="img"
              aria-label="STACKLINE NOIR — Falling Block Puzzle"
            >
              <g transform="translate(2, 6)" stroke="#D99B38" strokeWidth="1.5" fill="#D99B38" fillOpacity="0.22">
                <rect x="0" y="12" width="12" height="12" rx="1.5" />
                <rect x="13" y="12" width="12" height="12" rx="1.5" />
                <rect x="26" y="12" width="12" height="12" rx="1.5" />
                <rect x="13" y="0" width="12" height="12" rx="1.5" fillOpacity="0.55" />
              </g>
              <text
                x="52"
                y="20"
                fill="#D99B38"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="11"
                letterSpacing="3"
                fontWeight="500"
              >
                ARCADE FALLING BLOCKS
              </text>
              <text
                x="2"
                y="88"
                fill="#F4EFE4"
                fontFamily="Fraunces, Georgia, serif"
                fontSize="54"
                fontWeight="700"
                letterSpacing="-1"
              >
                STACKLINE NOIR
              </text>
              <line x1="4" y1="101" x2="410" y2="101" stroke="#2D3647" strokeWidth="1.2" />
            </svg>
            <p className="mb-5 text-sm sm:text-base text-[#C7C0B0] leading-relaxed max-w-md">
              Clear four-row Tetrises with ghost landing, piece hold, and escalating speed.
            </p>

            <div className="mb-6 max-w-md">
              <div className="mb-2 text-xs font-mono-tabular text-[#98A2B3]">STARTING LEVEL</div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { level: 1, label: 'Level 1', desc: 'Steady' },
                  { level: 5, label: 'Level 5', desc: 'Brisk' },
                  { level: 9, label: 'Level 9', desc: 'Expert' },
                ].map((opt) => (
                  <button
                    key={opt.level}
                    type="button"
                    onClick={() => setStartLevel(opt.level)}
                    aria-pressed={startLevel === opt.level}
                    className={`rounded-md border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      startLevel === opt.level
                        ? 'border-[#D99B38] bg-[#1B202B]/95 text-[#F4EFE4]'
                        : 'border-[#273041] bg-[#11151D]/85 text-[#A9B3C4] hover:border-[#414F69]'
                    }`}
                  >
                    <div className="font-mono-tabular text-sm font-semibold">{opt.label}</div>
                    <div className="text-[11px] text-[#8E98AA]">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                data-start="true"
                onClick={() => startGame()}
                className="inline-flex items-center gap-2.5 rounded-md bg-[#D99B38] px-6 py-3.5 text-sm font-semibold text-[#0C0E12] shadow-lg transition-transform duration-150 hover:bg-[#EBB556] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span>Start Stacking</span>
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
              ←/→ Move · ↑/X Rotate · ↓ Soft Drop · Space Hard Drop · C/Shift Hold · Esc Pause
            </p>
            <p className="hidden sm:block text-[#828B9C]">Press Enter or Space to start</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0A0D13] text-[#F2ECDC] select-none">
      {/* Top Bar */}
      <header className="z-20 flex items-center justify-between gap-4 border-b border-[#1E2432] bg-[#0F131C] px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onSwitchGame}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A9B3C4] hover:text-[#F4EFE4] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Hub</span>
          </button>
          <div className="h-4 w-px bg-[#252D3D]" aria-hidden="true" />
          <span className="font-display text-base font-bold text-[#F4EFE4] whitespace-nowrap">
            STACKLINE NOIR
          </span>
          {hud.callout && (
            <span className="font-mono-tabular text-xs font-bold tracking-wider text-[#EBB556]">
              {hud.callout}
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
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
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
            aria-label="Restart Tetris"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
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
            aria-label="Pause Tetris"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
          >
            <Pause className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Compact Mobile HUD Strip (< sm) so Score, Level, Lines, Hold & Next are always visible */}
      <div
        data-testid="tetris-mobile-hud"
        className="flex sm:hidden items-center justify-between gap-2 border-b border-[#1D2330] bg-[#10141C] px-3 py-1.5 shrink-0"
      >
        <div className="flex items-center gap-3 font-mono-tabular">
          <div>
            <div className="text-[9px] tracking-[0.14em] text-[#8E98AA]">SCORE</div>
            <div className="text-sm font-bold text-[#EBB556] leading-tight">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[9px] tracking-[0.14em] text-[#8E98AA]">LVL</div>
            <div className="text-sm font-bold text-[#F4EFE4] leading-tight">{hud.level}</div>
          </div>
          <div>
            <div className="text-[9px] tracking-[0.14em] text-[#8E98AA]">LINES</div>
            <div className="text-sm font-bold text-[#F4EFE4] leading-tight">{hud.lines}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono-tabular text-[10px]">
          <div className="flex items-center gap-1.5 rounded border border-[#252D3D] bg-[#141924] px-2 py-1">
            <span className="text-[#8E98AA]">HOLD</span>
            <span className="font-bold text-[#F4EFE4]">{hud.hold ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded border border-[#252D3D] bg-[#141924] px-2 py-1">
            <span className="text-[#8E98AA]">NEXT</span>
            <span className="font-bold text-[#EBB556]">{hud.nextQueue[0] ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Center 3-Column Arcade Stage: Hold+Stats | 10x20 Well | Next Queue */}
      <main className="mx-auto flex w-full max-w-[920px] flex-1 min-h-0 items-stretch justify-center gap-4 sm:gap-6 px-3 py-2 sm:px-6 sm:py-4">
        {/* Left Dock: Hold + Score/Level/Lines */}
        <aside className="hidden sm:flex w-[164px] shrink-0 flex-col gap-3">
          <div className="rounded-md border border-[#252D3D] bg-[#12161F] p-3">
            <div className="flex items-center justify-between text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">
              <span>HOLD</span>
              <span>[C]</span>
            </div>
            <div className="mt-1">
              <MiniPiecePreview type={hud.hold} />
            </div>
          </div>

          <div className="rounded-md border border-[#252D3D] bg-[#12161F] p-3.5 space-y-3">
            <div>
              <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">SCORE</div>
              <div className="mt-0.5 font-mono-tabular text-xl font-bold text-[#EBB556]">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div className="h-px bg-[#202736]" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] font-mono-tabular tracking-[0.14em] text-[#8E98AA]">LEVEL</div>
                <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#F4EFE4]">{hud.level}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular tracking-[0.14em] text-[#8E98AA]">LINES</div>
                <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#F4EFE4]">{hud.lines}</div>
              </div>
            </div>
            <div className="h-px bg-[#202736]" />
            <div>
              <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">BEST</div>
              <div className="mt-0.5 font-mono-tabular text-sm font-semibold text-[#C5CCD8]">
                {Math.max(records.bestScore, hud.score).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-auto rounded-md border border-[#1E2432] bg-[#0E1118] p-3 text-[11px] font-mono-tabular text-[#8A94A6] leading-relaxed">
            ←/→ Slide
            <br />
            ↑ Rotate CW
            <br />
            Space Hard Drop
            <br />
            C Hold Piece
          </div>
        </aside>

        {/* Center Isolated 10x20 Well Canvas */}
        <div ref={containerRef} className="relative flex-1 min-h-0 max-w-[420px]">
          <canvas
            ref={canvasRef}
            data-testid="tetris-canvas"
            data-score={hud.score}
            data-lines={hud.lines}
            data-level={hud.level}
            data-hold={hud.hold ?? ''}
            className="block h-full w-full"
          />
        </div>

        {/* Right Dock: Next Queue */}
        <aside className="hidden sm:flex w-[148px] shrink-0 flex-col gap-3">
          <div className="rounded-md border border-[#252D3D] bg-[#12161F] p-3">
            <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA] mb-2">
              NEXT UP
            </div>
            <div className="flex flex-col divide-y divide-[#1E2433]">
              {hud.nextQueue.map((piece, idx) => (
                <div key={`${piece}-${idx}`} className="py-1.5">
                  <MiniPiecePreview type={piece} muted={idx > 0} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile Touch Controls */}
      {phase === 'playing' && (
        <div className="flex items-center justify-between gap-2 border-t border-[#1D2330] bg-[#0E1118] px-3 py-2 sm:hidden">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={actLeft}
              aria-label="Move left"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#F4EFE4]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={actSoftDrop}
              aria-label="Soft drop"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#F4EFE4]"
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={actRight}
              aria-label="Move right"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#F4EFE4]"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={actHold}
              aria-label="Hold piece"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#D99B38]"
            >
              <Repeat2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => actRotate(1)}
              aria-label="Rotate piece"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#151A25] text-[#F4EFE4]"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={actHardDrop}
              aria-label="Hard drop"
              className="flex h-11 px-3 items-center justify-center rounded-md bg-[#D99B38] text-xs font-semibold text-[#0C0E12]"
            >
              DROP
            </button>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tetris-pause-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/80 p-4"
        >
          <div className="w-full max-w-sm rounded-md border border-[#2C3547] bg-[#12161F] p-6 shadow-2xl">
            <div className="font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              STACKLINE NOIR · PAUSED
            </div>
            <h2 id="tetris-pause-title" className="mt-1 font-display text-2xl font-bold text-[#F4EFE4]">
              Game Paused
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
                <span>Restart</span>
              </button>
              <button
                type="button"
                onClick={() => setPhase('title')}
                className="inline-flex items-center justify-center rounded-md border border-[#283040] bg-[#131720] px-4 py-2.5 text-sm font-medium text-[#B8C1D1] hover:text-[#F4EFE4] cursor-pointer"
              >
                Level Select
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
          aria-labelledby="tetris-gameover-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/85 p-4"
        >
          <div className="w-full max-w-md rounded-md border border-[#2E384B] bg-[#12161F] p-6 shadow-2xl">
            <div className="flex items-center gap-2 font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>TOWER TOPPED OUT</span>
            </div>
            <h2 id="tetris-gameover-title" className="mt-1.5 font-display text-3xl font-bold text-[#F4EFE4]">
              Session Over
            </h2>
            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#222A39] py-4">
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">SCORE</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">BEST</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#EBB556]">
                  {Math.max(records.bestScore, hud.score).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">LINES</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {hud.lines}
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
