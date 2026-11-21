import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Flag, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX, Zap } from 'lucide-react';
import {
  createInitialRaceWorld,
  formatRaceTime,
  loadRacingRecords,
  saveRaceRecord,
  speedToKmh,
  stepRaceWorld,
  type RacingRecords,
} from '../racing/engine';
import { racingAudio } from '../racing/racingAudio';
import { renderRaceFrame } from '../racing/renderer';
import { CIRCUITS } from '../racing/track';
import type {
  CameraMode,
  CircuitDefinition,
  RaceInput,
  RaceSnapshot,
  RaceWorldState,
  RacingPhase,
} from '../racing/types';
import { NoirImage } from './NoirImage';

const RACING_BACKDROP_URL = '/src/assets/images/racing_midnight_circuit_1795262317862.jpg';

interface RacingGameProps {
  autoStart?: boolean;
  onSwitchGame: () => void;
}

interface HudReadout {
  rank: number;
  totalRacers: number;
  lap: number;
  totalLaps: number;
  elapsedMs: number;
  speedKmh: number;
  nitro: number;
  countdown: number;
  offTrack: boolean;
  boosting: boolean;
  drifting: boolean;
  progress: number;
}

function readHud(world: RaceWorldState): HudReadout {
  const player = world.racers.find((r) => r.isPlayer) ?? world.racers[0];
  return {
    rank: player.rank,
    totalRacers: world.racers.length,
    lap: player.lap,
    totalLaps: world.track.def.totalLaps,
    elapsedMs: world.elapsedMs,
    speedKmh: speedToKmh(player.speed),
    nitro: Math.round(player.nitro),
    countdown: Math.ceil(world.countdownRemaining),
    offTrack: player.offTrack,
    boosting: player.boosting,
    drifting: player.drifting,
    progress: Math.round(player.totalProgress),
  };
}

function ordinalRank(rank: number): string {
  if (rank === 1) return '1ST';
  if (rank === 2) return '2ND';
  if (rank === 3) return '3RD';
  return `${rank}TH`;
}

const CAMERA_MODES: CameraMode[] = ['chase', 'hood', 'topdown'];
const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'FRONT',
  hood: 'HOOD',
  topdown: 'TOP',
};

export function RacingGame({ autoStart = false, onSwitchGame }: RacingGameProps) {
  const [selectedCircuitId, setSelectedCircuitId] = useState<CircuitDefinition['id']>('obsidian-ring');
  const [phase, setPhase] = useState<RacingPhase>(() => (autoStart ? 'playing' : 'title'));
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState<boolean>(() => racingAudio.isMuted());
  const [records, setRecords] = useState<RacingRecords>(() => loadRacingRecords());
  const [finishSnapshot, setFinishSnapshot] = useState<RaceSnapshot | null>(null);
  const [lapBanner, setLapBanner] = useState<string | null>(null);
  const [hud, setHud] = useState<HudReadout>(() =>
    readHud(createInitialRaceWorld('obsidian-ring', autoStart))
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<RaceWorldState>(createInitialRaceWorld('obsidian-ring', autoStart));
  const phaseRef = useRef<RacingPhase>(phase);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const keysRef = useRef<Set<string>>(new Set());
  const touchInputRef = useRef<RaceInput>({
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
    boost: false,
  });

  phaseRef.current = phase;
  cameraModeRef.current = cameraMode;

  // Mirror state machine to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = phase === 'countdown' ? 'playing' : phase;
  }, [phase]);

  // Clear banner automatically
  useEffect(() => {
    if (!lapBanner) return;
    const t = window.setTimeout(() => setLapBanner(null), 1500);
    return () => window.clearTimeout(t);
  }, [lapBanner]);

  const clearInputs = useCallback(() => {
    keysRef.current.clear();
    touchInputRef.current = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      boost: false,
    };
  }, []);

  const startRace = useCallback(
    (circuitOverride?: CircuitDefinition['id']) => {
      const targetId = circuitOverride ?? selectedCircuitId;
      clearInputs();
      (document.activeElement as HTMLElement | null)?.blur?.();
      const fresh = createInitialRaceWorld(targetId, false);
      worldRef.current = fresh;
      setFinishSnapshot(null);
      setLapBanner(null);
      setHud(readHud(fresh));
      document.body.dataset.state = 'playing';
      setPhase('playing');
      racingAudio.playCountdownBeep(false);
    },
    [selectedCircuitId, clearInputs]
  );

  const handleToggleMute = useCallback(() => {
    const next = racingAudio.toggleMute();
    setMuted(next);
  }, []);

  const handleCycleCamera = useCallback(() => {
    setCameraMode((prev) => {
      const nextIdx = (CAMERA_MODES.indexOf(prev) + 1) % CAMERA_MODES.length;
      const next = CAMERA_MODES[nextIdx];
      cameraModeRef.current = next;
      return next;
    });
  }, []);

  // Keyboard listener (WASD, Arrows, Space Drift, Shift Nitro, C Camera, Esc/P Pause, R Restart, M Audio, Enter/Space on title)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startRace();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (phaseRef.current === 'playing') {
          e.preventDefault();
          clearInputs();
          setPhase('paused');
          return;
        }
        if (phaseRef.current === 'paused') {
          e.preventDefault();
          clearInputs();
          setPhase('playing');
          return;
        }
      }

      if (e.key === 'c' || e.key === 'C') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
          e.preventDefault();
          handleCycleCamera();
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
        return;
      }

      if ((e.key === 'r' || e.key === 'R') && (phaseRef.current === 'playing' || phaseRef.current === 'paused')) {
        e.preventDefault();
        startRace();
        return;
      }

      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key) &&
        phaseRef.current === 'playing'
      ) {
        e.preventDefault();
      }
      keysRef.current.add(e.key.toLowerCase());
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onBlur);
    };
  }, [startRace, clearInputs, handleToggleMute, handleCycleCamera]);

  // Isolated 60 FPS Simulation & Canvas Render Loop (mounted once while active)
  useEffect(() => {
    if (phase === 'title') return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
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
        const keys = keysRef.current;
        const touch = touchInputRef.current;
        const input: RaceInput = {
          throttle: keys.has('arrowup') || keys.has('w') || touch.throttle,
          brake: keys.has('arrowdown') || keys.has('s') || touch.brake,
          left: keys.has('arrowleft') || keys.has('a') || touch.left,
          right: keys.has('arrowright') || keys.has('d') || touch.right,
          drift: keys.has(' ') || touch.drift,
          boost: keys.has('shift') || touch.boost,
        };

        stepRaceWorld(world, input, rawDt);

        // One-shot procedural audio & discrete UI events
        if (world.events.countdownTick !== null) {
          racingAudio.playCountdownBeep(world.events.countdownTick === 0);
          setHud(readHud(world));
        }
        if (world.events.boostStart) {
          racingAudio.playBoost();
        }
        if (world.events.collision > 0) {
          racingAudio.playCollision(world.events.collision);
        }
        if (world.events.lapComplete) {
          const player = world.racers.find((r) => r.isPlayer);
          racingAudio.playLapChime();
          if (player) {
            setLapBanner(
              player.lap === world.track.def.totalLaps ? 'FINAL LAP' : `LAP ${player.lap}`
            );
          }
          setHud(readHud(world));
        }
        if (world.events.raceFinish && world.snapshot) {
          const snap = world.snapshot;
          racingAudio.playFinishFanfare(snap.playerRank === 1);
          setRecords(saveRaceRecord(snap));
          setFinishSnapshot(snap);
          setHud(readHud(world));
          document.body.dataset.state = 'gameover';
          setPhase('gameover');
        }

        // Throttle React HUD readout updates to ~10Hz
        hudTimer += rawDt;
        if (hudTimer >= 0.1) {
          hudTimer = 0;
          setHud(readHud(world));
        }
      }

      renderRaceFrame(ctx, world, width, height, cameraModeRef.current);
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [phase === 'title']);

  const setTouchKey = (key: keyof RaceInput, active: boolean) => {
    touchInputRef.current[key] = active;
  };

  // TITLE SCREEN
  if (phase === 'title') {
    const activeCircuit = CIRCUITS.find((c) => c.id === selectedCircuitId) ?? CIRCUITS[0];
    const bestLapForCircuit = records.bestLapByCircuit[activeCircuit.id];

    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#0B0D11] text-[#F2ECDC] select-none">
        <div className="absolute inset-0">
          <NoirImage
            src={RACING_BACKDROP_URL}
            alt="Rain-slicked midnight racing circuit with grand touring cars drifting around a lit chicane"
            className="h-full w-full object-cover object-center opacity-85"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#090B10]/96 via-[#0B0D12]/80 to-[#0B0D12]/25"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#090B10] via-transparent to-[#090B10]/65"
          />
        </div>

        <main className="relative z-10 flex h-full w-full flex-col justify-between px-6 py-6 sm:px-12 sm:py-9 lg:px-16">
          {/* Top quiet navigation bar */}
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
              4 CARS · 3 LAPS · {records.winsCount > 0 ? `${records.winsCount} WINS` : 'MIDNIGHT GRAND PRIX'}
            </div>
          </div>

          {/* Left negative-space hero lockup + circuit choice */}
          <div className="max-w-xl my-auto">
            <svg
              viewBox="0 0 460 142"
              className="w-full max-w-[440px] h-auto mb-5"
              role="img"
              aria-label="NIGHT CIRCUIT — Midnight Racing"
            >
              <g transform="translate(2, 10)" stroke="#D99B38" strokeWidth="1.6" fill="none">
                <path d="M4 18 L18 4 L48 4 L34 18 Z" />
                <path d="M22 18 L36 4" strokeOpacity="0.55" />
              </g>
              <text
                x="62"
                y="24"
                fill="#D99B38"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="11"
                letterSpacing="3.2"
                fontWeight="500"
              >
                NOIR STREET RACING
              </text>
              <text
                x="2"
                y="98"
                fill="#F4EFE4"
                fontFamily="Fraunces, Georgia, serif"
                fontSize="60"
                fontWeight="700"
                letterSpacing="-1"
              >
                NIGHT CIRCUIT
              </text>
              <line x1="4" y1="114" x2="410" y2="114" stroke="#2D3647" strokeWidth="1.2" />
              <text
                x="4"
                y="134"
                fill="#C7C0B0"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontSize="14.5"
              >
                Outdrive three rival drivers across rain-soaked city circuits.
              </text>
            </svg>

            {/* Circuit selector (interactive segmented buttons) */}
            <div className="mb-6">
              <div className="mb-2 text-xs font-mono-tabular text-[#98A2B3]">
                SELECT CIRCUIT
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                {CIRCUITS.map((c) => {
                  const active = c.id === selectedCircuitId;
                  const best = records.bestLapByCircuit[c.id];
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCircuitId(c.id)}
                      aria-pressed={active}
                      className={`rounded-md border px-4 py-3 text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#D99B38] bg-[#1B202B]/95 text-[#F4EFE4]'
                          : 'border-[#273041] bg-[#11151D]/85 text-[#B4BECE] hover:border-[#414F69]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold">{c.name}</span>
                        <span className="font-mono-tabular text-[11px] text-[#D99B38]">
                          {c.difficulty}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#98A2B3]">
                        {best !== undefined ? `Best Lap ${formatRaceTime(best)}` : `${c.totalLaps} Laps · 3 Rivals`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {bestLapForCircuit !== undefined && (
              <p className="mb-5 text-xs font-mono-tabular text-[#EBB556]">
                Track Record ({activeCircuit.name}): {formatRaceTime(bestLapForCircuit)}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                data-start="true"
                onClick={() => startRace()}
                className="inline-flex items-center gap-2.5 rounded-md bg-[#D99B38] px-6 py-3.5 text-sm font-semibold text-[#0C0E12] shadow-lg transition-transform duration-150 hover:bg-[#EBB556] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
                <span>Start Race</span>
              </button>

              <button
                type="button"
                onClick={onSwitchGame}
                className="inline-flex items-center rounded-md border border-[#354054] bg-[#131720]/90 px-5 py-3.5 text-sm font-medium text-[#ECE6D8] transition-colors duration-150 hover:border-[#D99B38]/60 hover:bg-[#1B202C] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Back to Game Select
              </button>
            </div>
          </div>

          {/* Bottom quiet control hint */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#202634] pt-4 text-xs text-[#9AA4B6]">
            <p className="font-mono-tabular">
              WASD / Arrows Drive · Space Drift · Shift Nitro · C Camera · Esc Pause · R Restart · M Audio
            </p>
            <p className="hidden sm:block text-[#828B9C]">Press Enter or Space to start</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0B0E14] text-[#F2ECDC] select-none">
      {/* Isolated Full-Viewport 60 FPS Canvas Container */}
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          data-testid="racing-canvas"
          data-camera={cameraMode}
          data-speed={hud.speedKmh}
          data-lap={hud.lap}
          data-rank={hud.rank}
          data-progress={hud.progress}
          className="block h-full w-full"
        />
      </div>

      {/* World-Matched Perimeter HUD (pointer-events-none wrapper, >= 85% clear viewport, zero backdrop-blur) */}
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
        {/* Top Row: Left Telemetry Cluster + Right Utility Controls */}
        <div className="flex items-start justify-between gap-4">
          {/* Position, Lap & Timer Cluster */}
          <div className="flex items-center gap-4 sm:gap-6 rounded-md border border-[#2C3547] bg-[#0D1017]/90 px-3.5 py-2 sm:px-5 sm:py-2.5 shadow-xl">
            <div>
              <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#98A2B3]">
                POS
              </div>
              <div className="font-display text-xl sm:text-2xl font-bold leading-none text-[#EBB556] font-mono-tabular">
                {ordinalRank(hud.rank)}
                <span className="text-xs font-normal text-[#8B95A7]">/{hud.totalRacers}</span>
              </div>
            </div>

            <div className="h-7 w-px bg-[#252D3D]" aria-hidden="true" />

            <div>
              <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#98A2B3]">
                LAP
              </div>
              <div className="font-display text-xl sm:text-2xl font-bold leading-none text-[#F4EFE4] font-mono-tabular">
                {hud.lap}
                <span className="text-xs font-normal text-[#8B95A7]">/{hud.totalLaps}</span>
              </div>
            </div>

            <div className="h-7 w-px bg-[#252D3D]" aria-hidden="true" />

            <div>
              <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#98A2B3]">
                TIME
              </div>
              <div className="font-mono-tabular text-base sm:text-lg font-semibold leading-tight text-[#ECE6D8]">
                {formatRaceTime(hud.elapsedMs)}
              </div>
            </div>
          </div>

          {/* Top-Right Compact Utility Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleCycleCamera();
              }}
              aria-label={`Switch camera view (current: ${CAMERA_LABELS[cameraMode]})`}
              title="Switch Camera View [C]"
              className="flex h-10 items-center gap-1.5 rounded-md border border-[#2C3547] bg-[#0D1017]/90 px-3 text-[11px] font-mono-tabular font-semibold text-[#EBB556] hover:border-[#D99B38]/70 hover:text-[#F4EFE4] transition-colors cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{CAMERA_LABELS[cameraMode]}</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleToggleMute();
              }}
              aria-label={muted ? 'Unmute racing audio' : 'Mute racing audio'}
              title="Toggle Audio [M]"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#2C3547] bg-[#0D1017]/90 text-[#C8D0DE] hover:border-[#D99B38]/60 hover:text-[#F4EFE4] transition-colors cursor-pointer"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-[#8D97A8]" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#D99B38]" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                startRace();
              }}
              aria-label="Restart race"
              title="Restart Race [R]"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#2C3547] bg-[#0D1017]/90 text-[#C8D0DE] hover:border-[#D99B38]/60 hover:text-[#F4EFE4] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                clearInputs();
                setPhase('paused');
              }}
              aria-label="Pause race"
              title="Pause [Esc / P]"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#2C3547] bg-[#0D1017]/90 text-[#C8D0DE] hover:border-[#D99B38]/60 hover:text-[#F4EFE4] transition-colors cursor-pointer"
            >
              <Pause className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Center-Top Countdown / Lap Callout (transient, never blocks center view) */}
        <div className="flex flex-col items-center justify-center">
          {hud.countdown > 0 && phase === 'playing' && (
            <div className="rounded-md border border-[#D99B38]/70 bg-[#0D1017]/92 px-7 py-3 text-center shadow-2xl">
              <div className="font-mono-tabular text-[10px] tracking-[0.22em] text-[#D99B38]">
                LIGHTS OUT
              </div>
              <div className="font-display text-5xl font-bold text-[#F4EFE4] font-mono-tabular">
                {hud.countdown}
              </div>
            </div>
          )}

          {lapBanner && hud.countdown === 0 && phase === 'playing' && (
            <div className="rounded-md border border-[#D99B38]/65 bg-[#0D1017]/92 px-6 py-2 text-center shadow-xl">
              <div className="font-display text-2xl font-bold tracking-wide text-[#EBB556]">
                {lapBanner}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Row: Speedometer & Nitro Gauge (Bottom-Right; Bottom-Left holds canvas Minimap) */}
        <div className="flex items-end justify-end">
          <div className="rounded-md border border-[#2C3547] bg-[#0D1017]/90 px-4 py-3 shadow-xl min-w-[168px] sm:min-w-[196px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono-tabular text-3xl sm:text-4xl font-bold leading-none text-[#F4EFE4]">
                {hud.speedKmh}
              </span>
              <span className="font-mono-tabular text-xs text-[#98A2B3]">KM/H</span>
            </div>

            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-mono-tabular">
                <span className="inline-flex items-center gap-1 text-[#D99B38]">
                  <Zap className="h-3 w-3" aria-hidden="true" />
                  <span>NITRO [SHIFT]</span>
                </span>
                <span className="text-[#C8D0DE]">{hud.nitro}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-sm bg-[#1A202D]">
                <div
                  className="h-full origin-left"
                  style={{
                    transform: `scaleX(${hud.nitro / 100})`,
                    backgroundColor: hud.boosting ? '#70C3FF' : '#D99B38',
                  }}
                />
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono-tabular text-[#8D97A8]">
              <span>
                {hud.boosting
                  ? 'BOOST ACTIVE'
                  : hud.drifting
                  ? 'DRIFT +NITRO'
                  : hud.offTrack
                  ? 'OFF TRACK'
                  : 'SPACE DRIFT'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Touch Controls for Mobile / Tablet Screens */}
      {phase === 'playing' && (
        <div className="fixed inset-x-0 bottom-3 z-20 flex items-end justify-between px-3 md:hidden pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onPointerDown={() => setTouchKey('left', true)}
              onPointerUp={() => setTouchKey('left', false)}
              onPointerLeave={() => setTouchKey('left', false)}
              onPointerCancel={() => setTouchKey('left', false)}
              aria-label="Steer left"
              className="flex h-14 w-14 items-center justify-center rounded-md border border-[#343F54] bg-[#10141D]/90 text-base font-bold text-[#F4EFE4] active:bg-[#D99B38] active:text-[#0C0E12]"
            >
              ◀
            </button>
            <button
              type="button"
              onPointerDown={() => setTouchKey('right', true)}
              onPointerUp={() => setTouchKey('right', false)}
              onPointerLeave={() => setTouchKey('right', false)}
              onPointerCancel={() => setTouchKey('right', false)}
              aria-label="Steer right"
              className="flex h-14 w-14 items-center justify-center rounded-md border border-[#343F54] bg-[#10141D]/90 text-base font-bold text-[#F4EFE4] active:bg-[#D99B38] active:text-[#0C0E12]"
            >
              ▶
            </button>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onPointerDown={() => setTouchKey('boost', true)}
              onPointerUp={() => setTouchKey('boost', false)}
              onPointerLeave={() => setTouchKey('boost', false)}
              onPointerCancel={() => setTouchKey('boost', false)}
              aria-label="Nitro boost"
              className="flex h-14 px-3.5 items-center justify-center rounded-md border border-[#D99B38]/70 bg-[#1B1710]/90 text-xs font-mono-tabular font-semibold text-[#EBB556] active:bg-[#D99B38] active:text-[#0C0E12]"
            >
              NITRO
            </button>
            <button
              type="button"
              onPointerDown={() => setTouchKey('throttle', true)}
              onPointerUp={() => setTouchKey('throttle', false)}
              onPointerLeave={() => setTouchKey('throttle', false)}
              onPointerCancel={() => setTouchKey('throttle', false)}
              aria-label="Accelerate"
              className="flex h-14 px-4 items-center justify-center rounded-md border border-[#343F54] bg-[#D99B38] text-xs font-semibold text-[#0C0E12] active:bg-[#EBB556]"
            >
              GAS
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {phase === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="race-pause-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/80 p-4"
        >
          <div className="w-full max-w-md rounded-md border border-[#2C3547] bg-[#12161F] p-6 shadow-2xl">
            <div className="font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              NIGHT CIRCUIT · PAUSED
            </div>
            <h2 id="race-pause-title" className="mt-1 font-display text-2xl font-bold text-[#F4EFE4]">
              Race Paused
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-3 border-y border-[#222938] py-4 text-center">
              <div>
                <div className="text-[11px] font-mono-tabular text-[#8D97A8]">POSITION</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#EBB556]">
                  {ordinalRank(hud.rank)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono-tabular text-[#8D97A8]">LAP</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {hud.lap}/{hud.totalLaps}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono-tabular text-[#8D97A8]">TIME</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {formatRaceTime(hud.elapsedMs)}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPhase('playing')}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#D99B38] px-4 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] transition-colors cursor-pointer"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Resume Race</span>
              </button>

              <button
                type="button"
                onClick={() => startRace()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#323C4F] bg-[#171C27] px-4 py-2.5 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Restart Race</span>
              </button>

              <button
                type="button"
                onClick={() => setPhase('title')}
                className="inline-flex items-center justify-center rounded-md border border-[#283040] bg-[#131720] px-4 py-2.5 text-sm font-medium text-[#B8C1D1] hover:text-[#F4EFE4] transition-colors cursor-pointer"
              >
                Circuit Select
              </button>

              <button
                type="button"
                onClick={onSwitchGame}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#283040] bg-[#10141C] px-4 py-2.5 text-sm font-medium text-[#9AA4B6] hover:text-[#F4EFE4] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Switch Game</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RACE FINISH / PODIUM MODAL */}
      {phase === 'gameover' && finishSnapshot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="race-finish-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/85 p-4"
        >
          <div className="w-full max-w-lg rounded-md border border-[#2E384B] bg-[#12161F] p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center gap-2 font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>CHECKERED FLAG · {finishSnapshot.circuitName.toUpperCase()}</span>
            </div>

            <h2
              id="race-finish-title"
              className="mt-1.5 font-display text-3xl font-bold text-[#F4EFE4]"
            >
              {finishSnapshot.playerRank === 1
                ? 'Midnight Victory — 1st Place'
                : finishSnapshot.playerRank <= 3
                ? `Podium Finish — ${ordinalRank(finishSnapshot.playerRank)} Place`
                : 'Race Complete — 4th Place'}
            </h2>

            {/* 3 Mastery Stat Tiles */}
            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#222A39] py-4">
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">TOTAL TIME</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {formatRaceTime(finishSnapshot.totalTimeMs)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">BEST LAP</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#EBB556]">
                  {finishSnapshot.bestLapMs !== null
                    ? formatRaceTime(finishSnapshot.bestLapMs)
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">TOP SPEED</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {finishSnapshot.topSpeedKmh} km/h
                </div>
              </div>
            </div>

            {/* Standings Table */}
            <div className="mt-4 space-y-1.5">
              {finishSnapshot.standings.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-center justify-between rounded border px-3 py-2 text-xs ${
                    row.isPlayer
                      ? 'border-[#D99B38]/60 bg-[#1F1C14] text-[#F4EFE4] font-semibold'
                      : 'border-[#232A38] bg-[#151A24] text-[#C5CCD8]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular w-7 text-[#D99B38]">
                      {ordinalRank(row.rank)}
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: row.primaryColor }}
                      aria-hidden="true"
                    />
                    <span>
                      #{row.number} {row.name}
                    </span>
                  </div>
                  <span className="font-mono-tabular text-[#9AA4B6]">
                    {row.finishTimeMs !== null ? formatRaceTime(row.finishTimeMs) : `Lap ${row.lap}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => startRace()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-[#D99B38] px-5 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Race Again</span>
              </button>

              <button
                type="button"
                onClick={onSwitchGame}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#333E52] bg-[#171C27] px-5 py-3 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Switch Game</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
