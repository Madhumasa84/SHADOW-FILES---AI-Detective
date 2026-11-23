import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Grid2x2,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  continueEndless2048,
  createInitial2048State,
  load2048Records,
  move2048,
  save2048Progress,
  undo2048,
  type Direction2048,
  type GridSize2048,
  type Records2048,
  type State2048,
} from '../tiles2048/engine';
import { NoirImage } from './NoirImage';

export const TILES2048_BACKDROP_URL =
  '/src/assets/images/game_2048_obsidian_tiles_1795285260664.jpg';

interface Tiles2048GameProps {
  autoStart?: boolean;
  onSwitchGame: () => void;
}

type Phase2048 = 'title' | 'playing' | 'paused' | 'gameover';

function playTileAudio(muted: boolean, mergedMax: number, gameOver = false): void {
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

    if (gameOver) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
      setTimeout(() => ctx.close().catch(() => {}), 450);
      return;
    }

    const power = mergedMax > 0 ? Math.min(11, Math.log2(mergedMax)) : 0;
    const baseFreq = mergedMax > 0 ? 220 * Math.pow(1.09, power) : 165;
    osc.type = mergedMax >= 128 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (mergedMax > 0 ? 1.18 : 0.9), now + 0.09);
    gain.gain.setValueAtTime(mergedMax > 0 ? 0.08 : 0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
    setTimeout(() => ctx.close().catch(() => {}), 200);
  } catch {
    // Ignore autoplay errors
  }
}

function getTileStyle(value: number): { bg: string; text: string; border: string; glow?: string } {
  switch (value) {
    case 2:
      return { bg: '#1B212E', text: '#E6E1D6', border: '#2D3648' };
    case 4:
      return { bg: '#232B3B', text: '#F4EFE4', border: '#3A465C' };
    case 8:
      return { bg: '#3B2F22', text: '#F5D38E', border: '#6A5130' };
    case 16:
      return { bg: '#573B21', text: '#FFE0A3', border: '#8A5D2E' };
    case 32:
      return { bg: '#733424', text: '#FFF2DC', border: '#A84E35' };
    case 64:
      return { bg: '#8C2F27', text: '#FFF6E8', border: '#C9493E' };
    case 128:
      return { bg: '#9B7024', text: '#0D0F14', border: '#D9A441' };
    case 256:
      return { bg: '#B48228', text: '#0C0E12', border: '#EBB556' };
    case 512:
      return { bg: '#CC942D', text: '#0B0D11', border: '#F5C96B' };
    case 1024:
      return {
        bg: '#DFAA3A',
        text: '#090B0E',
        border: '#FCE09B',
        glow: '0 0 18px rgba(235, 181, 86, 0.35)',
      };
    default:
      return {
        bg: '#F4C659',
        text: '#090B0E',
        border: '#FFF0C2',
        glow: '0 0 26px rgba(244, 198, 89, 0.5)',
      };
  }
}

export function Tiles2048Game({ autoStart = false, onSwitchGame }: Tiles2048GameProps) {
  const [gridSize, setGridSize] = useState<GridSize2048>(4);
  const [phase, setPhase] = useState<Phase2048>(() => (autoStart ? 'playing' : 'title'));
  const [state, setState] = useState<State2048>(() => createInitial2048State(4));
  const [records, setRecords] = useState<Records2048>(() => load2048Records());
  const [muted, setMuted] = useState<boolean>(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const wonCountedRef = useRef<boolean>(false);

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const startNewGame = useCallback(
    (sizeOverride?: GridSize2048) => {
      const targetSize = sizeOverride ?? gridSize;
      setGridSize(targetSize);
      wonCountedRef.current = false;
      const fresh = createInitial2048State(targetSize);
      setState(fresh);
      document.body.dataset.state = 'playing';
      setPhase('playing');
    },
    [gridSize]
  );

  const applyDirection = useCallback(
    (dir: Direction2048) => {
      if (phase !== 'playing') return;
      const { state: next, moved } = move2048(state, dir);
      if (!moved) return;

      const justWon2048 = next.wonMilestone && !wonCountedRef.current;
      if (justWon2048) wonCountedRef.current = true;

      setState(next);
      playTileAudio(muted, next.lastMergedMax, next.isGameOver);
      const updatedRecords = save2048Progress(
        next.size,
        next.score,
        next.highestTile,
        next.isGameOver,
        justWon2048
      );
      setRecords(updatedRecords);

      if (next.isGameOver) {
        document.body.dataset.state = 'gameover';
        setPhase('gameover');
      }
    },
    [phase, muted, state]
  );

  const handleUndo = useCallback(() => {
    if (phase !== 'playing') return;
    setState((prev) => undo2048(prev));
  }, [phase]);

  const handleContinueEndless = useCallback(() => {
    setState((prev) => continueEndless2048(prev));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase === 'title') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (phase === 'playing') {
          e.preventDefault();
          setPhase('paused');
        } else if (phase === 'paused') {
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
        if (phase === 'playing' || phase === 'paused' || phase === 'gameover') {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (phase !== 'playing') return;

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        applyDirection('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        applyDirection('right');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        applyDirection('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        applyDirection('down');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, startNewGame, applyDirection, handleUndo]);

  const bestForGrid = gridSize === 4 ? records.bestScore4 : records.bestScore5;
  const displayBest = Math.max(bestForGrid, state.score);

  if (phase === 'title') {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#0B0D11] text-[#F2ECDC] select-none">
        <div className="absolute inset-0">
          <NoirImage
            src={TILES2048_BACKDROP_URL}
            alt="Beveled obsidian and brushed gold square puzzle tiles in a dark walnut tray"
            className="h-full w-full object-cover object-center opacity-85"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#090B10]/96 via-[#0B0D12]/84 to-[#0B0D12]/30"
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
              {records.highestTile > 0
                ? `HIGHEST TILE ${records.highestTile} · BEST ${Math.max(records.bestScore4, records.bestScore5).toLocaleString()}`
                : 'OBSIDIAN TILE PUZZLE · UNDO ENABLED'}
            </div>
          </div>

          <div className="max-w-xl my-auto">
            <svg
              viewBox="0 0 460 106"
              className="w-full max-w-[430px] h-auto mb-3"
              role="img"
              aria-label="MIDNIGHT 2048 — Obsidian Tile Merge"
            >
              <g transform="translate(2, 6)" stroke="#D99B38" strokeWidth="1.6" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="2" />
                <rect x="20" y="2" width="14" height="14" rx="2" fill="#D99B38" fillOpacity="0.24" />
                <rect x="2" y="20" width="14" height="14" rx="2" fill="#D99B38" fillOpacity="0.14" />
                <rect x="20" y="20" width="14" height="14" rx="2" />
              </g>
              <text
                x="50"
                y="22"
                fill="#D99B38"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="11"
                letterSpacing="3"
                fontWeight="500"
              >
                TACTICAL NUMBER PUZZLE
              </text>
              <text
                x="2"
                y="90"
                fill="#F4EFE4"
                fontFamily="Fraunces, Georgia, serif"
                fontSize="58"
                fontWeight="700"
                letterSpacing="-1"
              >
                MIDNIGHT 2048
              </text>
              <line x1="4" y1="103" x2="395" y2="103" stroke="#2D3647" strokeWidth="1.2" />
            </svg>
            <p className="mb-5 text-sm sm:text-base text-[#C7C0B0] leading-relaxed max-w-md">
              Slide matching obsidian tiles to forge the golden 2048 block and beyond.
            </p>

            <div className="mb-6">
              <div className="mb-2 text-xs font-mono-tabular text-[#98A2B3]">SELECT BOARD SIZE</div>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {([4, 5] as GridSize2048[]).map((sz) => {
                  const active = gridSize === sz;
                  const best = sz === 4 ? records.bestScore4 : records.bestScore5;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setGridSize(sz)}
                      aria-pressed={active}
                      className={`rounded-md border px-4 py-3 text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#D99B38] bg-[#1B202B]/95 text-[#F4EFE4]'
                          : 'border-[#273041] bg-[#11151D]/85 text-[#B4BECE] hover:border-[#414F69]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold">
                          {sz === 4 ? '4×4 Classic' : '5×5 Vault'}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-[#D99B38]">
                          {sz === 4 ? 'STANDARD' : 'EXTENDED'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#98A2B3] font-mono-tabular">
                        {best > 0 ? `Best ${best.toLocaleString()}` : sz === 4 ? 'Pure challenge' : 'Higher combos'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                data-start="true"
                onClick={() => startNewGame()}
                className="inline-flex items-center gap-2.5 rounded-md bg-[#D99B38] px-6 py-3.5 text-sm font-semibold text-[#0C0E12] shadow-lg transition-transform duration-150 hover:bg-[#EBB556] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Grid2x2 className="h-4 w-4" aria-hidden="true" />
                <span>Start Puzzle</span>
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
              Arrow Keys / WASD / Swipe Move · Z Undo (3 per run) · R Restart · Esc Pause
            </p>
            <p className="hidden sm:block text-[#828B9C]">Press Enter or Space to start</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0B0D11] text-[#F2ECDC] select-none"
      data-testid="game-2048"
      data-score={state.score}
      data-highest={state.highestTile}
    >
      {/* Top Perimeter Dock */}
      <header className="flex items-center justify-between gap-4 border-b border-[#1E2432] bg-[#10131B] px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onSwitchGame}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A9B3C4] hover:text-[#F4EFE4] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Hub</span>
          </button>
          <div className="h-4 w-px bg-[#242C3B]" aria-hidden="true" />
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[#F4EFE4] whitespace-nowrap">
            MIDNIGHT 2048
          </span>
          <span className="hidden sm:inline text-xs font-mono-tabular text-[#8E98AA]">
            {gridSize}×{gridSize} · Move {state.moves}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={state.undosRemaining <= 0 || state.history.length === 0}
            aria-label={`Undo move (${state.undosRemaining} left)`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#2C3547] bg-[#141924] px-3 text-xs font-mono-tabular font-medium text-[#ECE6D8] hover:border-[#D99B38]/65 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Undo2 className="h-3.5 w-3.5 text-[#D99B38]" aria-hidden="true" />
            <span>Undo ({state.undosRemaining})</span>
          </button>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4 text-[#D99B38]" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => startNewGame()}
            aria-label="Restart 2048"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setPhase('paused')}
            aria-label="Pause 2048"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#C8D0DE] hover:border-[#D99B38]/60 cursor-pointer"
          >
            <Pause className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Main Centered Board Stage */}
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-5 overflow-y-auto">
        {/* Score Strip */}
        <div className="grid w-full max-w-[468px] grid-cols-3 gap-3">
          <div className="rounded-md border border-[#252D3D] bg-[#12161F] px-4 py-2.5">
            <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">SCORE</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono-tabular text-xl sm:text-2xl font-bold text-[#F4EFE4]">
                {state.score.toLocaleString()}
              </span>
              {state.lastGain > 0 && (
                <span className="font-mono-tabular text-xs font-semibold text-[#EBB556]">
                  +{state.lastGain}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-md border border-[#252D3D] bg-[#12161F] px-4 py-2.5">
            <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">BEST</div>
            <div className="mt-0.5 font-mono-tabular text-xl sm:text-2xl font-bold text-[#EBB556]">
              {displayBest.toLocaleString()}
            </div>
          </div>

          <div className="rounded-md border border-[#252D3D] bg-[#12161F] px-4 py-2.5">
            <div className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#8E98AA]">PEAK TILE</div>
            <div className="mt-0.5 font-mono-tabular text-xl sm:text-2xl font-bold text-[#F4EFE4]">
              {state.highestTile}
            </div>
          </div>
        </div>

        {/* Obsidian Board Tray */}
        <div
          onTouchStart={(e) => {
            const t = e.touches[0];
            touchStartRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            if (!touchStartRef.current) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - touchStartRef.current.x;
            const dy = t.clientY - touchStartRef.current.y;
            touchStartRef.current = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
            if (Math.abs(dx) > Math.abs(dy)) {
              applyDirection(dx > 0 ? 'right' : 'left');
            } else {
              applyDirection(dy > 0 ? 'down' : 'up');
            }
          }}
          className="relative w-full max-w-[468px] aspect-square rounded-lg border border-[#2E3647] bg-[#131721] p-3 sm:p-3.5 shadow-2xl touch-none"
        >
          <div
            className="grid h-full w-full gap-2.5 sm:gap-3"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
            }}
          >
            {state.grid.map((row, r) =>
              row.map((cell, c) => {
                if (!cell) {
                  return (
                    <div
                      key={`empty-${r}-${c}`}
                      className="rounded-md border border-[#1E2533] bg-[#0D1017]"
                    />
                  );
                }
                const style = getTileStyle(cell.value);
                const digitCount = String(cell.value).length;
                const fontSizeClass =
                  gridSize === 5
                    ? digitCount >= 4
                      ? 'text-lg sm:text-xl'
                      : 'text-xl sm:text-2xl'
                    : digitCount >= 4
                    ? 'text-2xl sm:text-3xl'
                    : 'text-3xl sm:text-4xl';
                return (
                  <div
                    key={cell.id}
                    className={`flex items-center justify-center rounded-md border font-mono-tabular font-bold transition-transform duration-150 ${fontSizeClass} ${
                      cell.isMerged ? 'scale-[1.06]' : cell.isNew ? 'scale-[0.98]' : 'scale-100'
                    }`}
                    style={{
                      backgroundColor: style.bg,
                      color: style.text,
                      borderColor: style.border,
                      boxShadow: style.glow,
                    }}
                  >
                    {cell.value}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Accessible On-Screen Direction Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyDirection('left')}
            aria-label="Slide tiles left"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#ECE6D8] hover:border-[#D99B38] active:bg-[#D99B38] active:text-[#0C0E12] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => applyDirection('up')}
            aria-label="Slide tiles up"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#ECE6D8] hover:border-[#D99B38] active:bg-[#D99B38] active:text-[#0C0E12] transition-colors cursor-pointer"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => applyDirection('down')}
            aria-label="Slide tiles down"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#ECE6D8] hover:border-[#D99B38] active:bg-[#D99B38] active:text-[#0C0E12] transition-colors cursor-pointer"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => applyDirection('right')}
            aria-label="Slide tiles right"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2C3547] bg-[#141924] text-[#ECE6D8] hover:border-[#D99B38] active:bg-[#D99B38] active:text-[#0C0E12] transition-colors cursor-pointer"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </main>

      {/* 2048 Milestone Victory Modal */}
      {state.wonMilestone && !state.keepGoing && !state.isGameOver && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-2048-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/85 p-4"
        >
          <div className="w-full max-w-md rounded-md border border-[#D99B38]/70 bg-[#12161F] p-6 shadow-2xl">
            <div className="flex items-center gap-2 font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>MILESTONE REACHED</span>
            </div>
            <h2 id="win-2048-title" className="mt-1.5 font-display text-3xl font-bold text-[#F4EFE4]">
              2048 Forged
            </h2>
            <p className="mt-2 text-sm text-[#B8C1D1]">
              You forged the golden 2048 block in {state.moves} moves with a score of{' '}
              {state.score.toLocaleString()}.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleContinueEndless}
                className="inline-flex items-center justify-center rounded-md bg-[#D99B38] px-4 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] cursor-pointer"
              >
                Keep Going (Endless)
              </button>
              <button
                type="button"
                onClick={() => startNewGame()}
                className="inline-flex items-center justify-center rounded-md border border-[#323C4F] bg-[#171C27] px-4 py-2.5 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 cursor-pointer"
              >
                New Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-2048-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/80 p-4"
        >
          <div className="w-full max-w-sm rounded-md border border-[#2C3547] bg-[#12161F] p-6 shadow-2xl">
            <div className="font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              MIDNIGHT 2048 · PAUSED
            </div>
            <h2 id="pause-2048-title" className="mt-1 font-display text-2xl font-bold text-[#F4EFE4]">
              Puzzle Paused
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
                onClick={() => startNewGame()}
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
                Board Setup
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
          aria-labelledby="gameover-2048-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/85 p-4"
        >
          <div className="w-full max-w-md rounded-md border border-[#2E384B] bg-[#12161F] p-6 shadow-2xl">
            <div className="font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              NO MOVES REMAINING
            </div>
            <h2 id="gameover-2048-title" className="mt-1 font-display text-3xl font-bold text-[#F4EFE4]">
              Board Locked
            </h2>
            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#222A39] py-4">
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">SCORE</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {state.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">BEST</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#EBB556]">
                  {displayBest.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">PEAK TILE</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {state.highestTile}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => startNewGame()}
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
