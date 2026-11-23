import React, { useCallback, useEffect, useState } from 'react';
import { Bomb, Flag, Lightbulb, Pickaxe } from 'lucide-react';
import {
  MINESWEEPER_CONFIGS,
  MinesweeperHint,
  MinesweeperPreset,
  MinesweeperState,
  chordMinesweeperCell,
  createInitialMinesweeperState,
  findMinesweeperHint,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from '../../arcade/minesweeper';
import { loadExtraRecord, saveExtraGameOutcome } from '../../arcade/records';
import { playArcadeSfx } from '../../arcade/sound';
import {
  NoirGameHeader,
  NoirOutcomeModal,
  NoirPauseModal,
  NoirScreenPhase,
  NoirTitleScreen,
  useBodyGameState,
  useNoirShortcuts,
} from './NoirGameShell';

interface MinesweeperGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-sky-300',
  2: 'text-emerald-300',
  3: 'text-amber-300',
  4: 'text-rose-400',
  5: 'text-purple-300',
  6: 'text-cyan-300',
  7: 'text-orange-300',
  8: 'text-slate-200',
};

export function MinesweeperGame({ backdropUrl, autoStart, onSwitchGame }: MinesweeperGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [preset, setPreset] = useState<MinesweeperPreset>('sector9');
  const [state, setState] = useState<MinesweeperState>(() => createInitialMinesweeperState('sector9'));
  const [flagMode, setFlagMode] = useState(false);
  const [hint, setHint] = useState<MinesweeperHint | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('minesweeper'));

  useBodyGameState(phase);

  const startFresh = useCallback(
    (nextPreset?: MinesweeperPreset) => {
      const target = nextPreset ?? preset;
      setPreset(target);
      setState(createInitialMinesweeperState(target));
      setHint(null);
      setElapsedSec(0);
      setPhase('playing');
    },
    [preset]
  );

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p));
  }, []);

  useNoirShortcuts({
    phase,
    onStart: () => startFresh(),
    onTogglePause: togglePause,
    onToggleMute: () => setMuted((m) => !m),
  });

  useEffect(() => {
    if (phase !== 'playing' || !state.initialized || state.status !== 'playing') return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, state.initialized, state.status]);

  const concludeIfEnded = useCallback(
    (next: MinesweeperState) => {
      if (next.status === 'playing') return;
      if (next.status === 'won') {
        playArcadeSfx(muted, 'win');
        setRecord(saveExtraGameOutcome('minesweeper', { outcome: 'win', timeSec: Math.max(1, elapsedSec) }));
      } else {
        playArcadeSfx(muted, 'explosion');
        setRecord(saveExtraGameOutcome('minesweeper', { outcome: 'loss' }));
      }
      setPhase('gameover');
    },
    [muted, elapsedSec]
  );

  const handleCellClick = (r: number, c: number) => {
    if (phase !== 'playing' || state.status !== 'playing') return;
    setHint(null);
    const cell = state.cells[r][c];

    if (cell.revealed) {
      const next = chordMinesweeperCell(state, r, c);
      if (next !== state) {
        setState(next);
        playArcadeSfx(muted, 'tap');
        concludeIfEnded(next);
      }
      return;
    }

    if (flagMode) {
      setState(toggleMinesweeperFlag(state, r, c));
      playArcadeSfx(muted, 'flip');
      return;
    }

    const next = revealMinesweeperCell(state, r, c);
    setState(next);
    playArcadeSfx(muted, next.status === 'lost' ? 'explosion' : 'tap');
    concludeIfEnded(next);
  };

  const handleContextMenu = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (phase !== 'playing' || state.status !== 'playing') return;
    setHint(null);
    setState(toggleMinesweeperFlag(state, r, c));
    playArcadeSfx(muted, 'flip');
  };

  const handleHint = () => {
    if (phase !== 'playing' || state.status !== 'playing') return;
    const deduced = findMinesweeperHint(state);
    if (deduced) {
      setHint(deduced);
      setState((prev) => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
      playArcadeSfx(muted, 'hint');
    }
  };

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="MINEFIELD NOIR"
        subtitle="Tactical Sweeper · CSP Logic Solver"
        eyebrow="Puzzles & Logic"
        description="Sweep dark-steel sectors with guaranteed-safe opening clicks, fast chord-revealing on satisfied numbers, and a built-in Constraint-Satisfaction (CSP) solver that proves safe tiles and mines."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins} Sectors Cleared${record.bestTimeSec ? ` · Best ${record.bestTimeSec}s` : ''}`}
        ctaLabel="Enter Sector"
        onStart={() => startFresh()}
        onSwitchGame={onSwitchGame}
      >
        <div className="flex flex-wrap gap-2.5">
          {(Object.keys(MINESWEEPER_CONFIGS) as MinesweeperPreset[]).map((key) => {
            const cfg = MINESWEEPER_CONFIGS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`border px-4 py-2 text-left transition ${
                  preset === key
                    ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5D28A]'
                    : 'border-white/15 bg-[#0E1117]/80 text-[#CBD5E1] hover:border-white/30'
                }`}
              >
                <div className="text-xs font-semibold tracking-wider uppercase">{cfg.label}</div>
              </button>
            );
          })}
        </div>
      </NoirTitleScreen>
    );
  }

  const minesRemaining = state.mineCount - state.flagsPlaced;

  return (
    <div className="flex min-h-screen flex-col bg-[#080B0F] text-[#ECEFF4]">
      <NoirGameHeader
        title="MINEFIELD NOIR"
        subtitle={`${MINESWEEPER_CONFIGS[preset].label} · ${elapsedSec}s`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={() => startFresh()}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <div className="hidden items-center gap-4 font-mono text-xs sm:flex">
            <span className="text-[#F5D28A]">MINES: {minesRemaining}</span>
            <span className="text-[#94A3B8]">TIME: {elapsedSec}s</span>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-3 py-5">
        {/* Controls strip */}
        <div className="mb-3 flex w-full max-w-[680px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFlagMode(false)}
              className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition ${
                !flagMode
                  ? 'border-[#D4A853] bg-[#D4A853]/18 text-[#F5D28A]'
                  : 'border-white/15 text-[#94A3B8] hover:text-white'
              }`}
            >
              <Pickaxe className="h-3.5 w-3.5" />
              Reveal
            </button>
            <button
              type="button"
              onClick={() => setFlagMode(true)}
              className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition ${
                flagMode
                  ? 'border-[#F87171] bg-[#F87171]/18 text-[#FCA5A5]'
                  : 'border-white/15 text-[#94A3B8] hover:text-white'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              Flag
            </button>
            <button
              type="button"
              onClick={handleHint}
              className="inline-flex items-center gap-1.5 border border-emerald-400/40 bg-emerald-500/12 px-3 py-1.5 text-xs font-medium tracking-wider text-emerald-300 uppercase transition hover:bg-emerald-500/20"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              CSP Hint
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {(Object.keys(MINESWEEPER_CONFIGS) as MinesweeperPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => startFresh(key)}
                className={`border px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${
                  preset === key
                    ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5D28A]'
                    : 'border-white/10 text-[#94A3B8] hover:text-white'
                }`}
              >
                {MINESWEEPER_CONFIGS[key].cols}×{MINESWEEPER_CONFIGS[key].rows}
              </button>
            ))}
          </div>
        </div>

        {hint && (
          <div className="mb-3 w-full max-w-[680px] border border-emerald-400/40 bg-emerald-950/35 px-3.5 py-2.5 text-xs text-[#E2E8F0]">
            <span className="font-mono font-semibold text-emerald-300 uppercase">
              {hint.action === 'flag' ? 'Deduced Mine' : hint.certain ? 'Provably Safe' : 'Best Risk'}
              :{' '}
            </span>
            {hint.reason}
          </div>
        )}

        {/* Minefield Grid */}
        <div className="w-full max-w-[680px] overflow-x-auto border-2 border-[#D4A853]/40 bg-[#0D1119] p-2.5 shadow-[0_24px_65px_rgba(0,0,0,0.8)]">
          <div
            className="mx-auto grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${state.cols}, minmax(0, 1fr))`,
              maxWidth: state.cols === 9 ? '420px' : state.cols === 12 ? '520px' : '640px',
            }}
          >
            {state.cells.map((row) =>
              row.map((cell) => {
                const isHint = hint?.row === cell.row && hint?.col === cell.col;
                return (
                  <button
                    key={`${cell.row}-${cell.col}`}
                    type="button"
                    data-mine-cell={`${cell.row}-${cell.col}`}
                    aria-label={`Row ${cell.row + 1} Col ${cell.col + 1}`}
                    onClick={() => handleCellClick(cell.row, cell.col)}
                    onContextMenu={(e) => handleContextMenu(e, cell.row, cell.col)}
                    className={`flex aspect-square items-center justify-center border font-mono text-xs font-bold transition sm:text-sm ${
                      cell.exploded
                        ? 'border-red-400 bg-red-700 text-white'
                        : cell.revealed
                        ? 'border-white/5 bg-[#090C12]'
                        : isHint
                        ? hint.action === 'flag'
                          ? 'border-rose-400 bg-rose-500/30 ring-2 ring-rose-300'
                          : 'border-emerald-300 bg-emerald-500/30 ring-2 ring-emerald-300'
                        : 'border-t-white/20 border-l-white/15 border-r-black/60 border-b-black/60 bg-gradient-to-br from-[#232A38] to-[#161B25] hover:from-[#2C3547] hover:to-[#1C2230]'
                    }`}
                  >
                    {cell.revealed ? (
                      cell.isMine ? (
                        <Bomb className="h-3.5 w-3.5 text-[#FCA5A5]" />
                      ) : cell.adjacent > 0 ? (
                        <span className={NUMBER_COLORS[cell.adjacent] ?? 'text-white'}>
                          {cell.adjacent}
                        </span>
                      ) : null
                    ) : cell.flagged ? (
                      <Flag className="h-3.5 w-3.5 text-[#F5D28A]" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-[#94A3B8]">
          Right-click (or toggle Flag mode) to mark mines · Click a satisfied number to chord-reveal neighbors.
        </p>
      </main>

      {phase === 'paused' && (
        <NoirPauseModal
          title="MINEFIELD NOIR"
          onResume={() => setPhase('playing')}
          onRestart={() => startFresh()}
          onSwitchGame={onSwitchGame}
        />
      )}

      {phase === 'gameover' && (
        <NoirOutcomeModal
          outcome={state.status === 'won' ? 'win' : 'loss'}
          headline={state.status === 'won' ? 'Sector Swept Clean' : 'Detonation Triggered'}
          summary={
            state.status === 'won'
              ? `Cleared all ${state.rows * state.cols - state.mineCount} safe tiles in ${elapsedSec}s.`
              : `Mine struck after clearing ${state.revealedSafe} safe tiles.`
          }
          onPlayAgain={() => startFresh()}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
