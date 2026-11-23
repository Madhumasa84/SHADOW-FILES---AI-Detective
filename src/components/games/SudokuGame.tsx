import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eraser, Lightbulb, Pencil, Undo2 } from 'lucide-react';
import {
  SudokuDifficulty,
  SudokuHint,
  SudokuState,
  createSudokuPuzzle,
  findSudokuHint,
  getSudokuBox,
  getSudokuCol,
  getSudokuConflicts,
  getSudokuRow,
  setSudokuCell,
  toggleSudokuNote,
  undoSudokuMove,
} from '../../arcade/sudoku';
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

interface SudokuGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const TIERS: Array<{ id: SudokuDifficulty; label: string; desc: string }> = [
  { id: 'novice', label: 'Novice', desc: '42 clues · smooth flow' },
  { id: 'detective', label: 'Detective', desc: '34 clues · crisp logic' },
  { id: 'mastermind', label: 'Mastermind', desc: '27 clues · deep deduction' },
];

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SudokuGame({ backdropUrl, autoStart, onSwitchGame }: SudokuGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>('detective');
  const [state, setState] = useState<SudokuState>(() => createSudokuPuzzle('detective'));
  const [selected, setSelected] = useState<number>(40);
  const [noteMode, setNoteMode] = useState(false);
  const [activeHint, setActiveHint] = useState<SudokuHint | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('sudoku'));

  useBodyGameState(phase);

  const startFresh = useCallback(
    (nextDiff?: SudokuDifficulty) => {
      const targetDiff = nextDiff ?? difficulty;
      setDifficulty(targetDiff);
      setState(createSudokuPuzzle(targetDiff));
      setSelected(40);
      setNoteMode(false);
      setActiveHint(null);
      setElapsedSec(0);
      setPhase('playing');
    },
    [difficulty]
  );

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p));
  }, []);

  useNoirShortcuts({
    phase,
    onStart: () => startFresh(),
    onTogglePause: togglePause,
    onToggleMute: () => setMuted((m) => !m),
    disableLetterHotkeys: true,
  });

  // Live timer while playing
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const conflicts = useMemo(() => getSudokuConflicts(state.values), [state.values]);

  const handleDigit = useCallback(
    (digit: number) => {
      if (phase !== 'playing' || state.status !== 'playing') return;
      if (state.given[selected]) return;
      setActiveHint(null);

      if (noteMode && digit !== 0) {
        const next = toggleSudokuNote(state, selected, digit);
        setState(next);
        playArcadeSfx(muted, 'tap');
        return;
      }

      const next = setSudokuCell(state, selected, digit);
      setState(next);
      if (next.status === 'won') {
        playArcadeSfx(muted, 'win');
        setRecord(saveExtraGameOutcome('sudoku', { outcome: 'win', timeSec: elapsedSec }));
        setPhase('gameover');
      } else if (digit !== 0 && digit !== state.solution[selected]) {
        playArcadeSfx(muted, 'error');
      } else {
        playArcadeSfx(muted, 'tap');
      }
    },
    [phase, state, selected, noteMode, muted, elapsedSec]
  );

  const handleUndo = useCallback(() => {
    if (phase !== 'playing' || state.history.length === 0) return;
    setState((prev) => undoSudokuMove(prev));
    setActiveHint(null);
    playArcadeSfx(muted, 'tap');
  }, [phase, state.history.length, muted]);

  const handleHint = useCallback(() => {
    if (phase !== 'playing' || state.status !== 'playing') return;
    const hint = findSudokuHint(state);
    if (hint) {
      setActiveHint(hint);
      setSelected(hint.index);
      setState((prev) => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
      playArcadeSfx(muted, 'hint');
    }
  }, [phase, state, muted]);

  const applyHint = useCallback(() => {
    if (!activeHint) return;
    const next = setSudokuCell(state, activeHint.index, activeHint.value);
    setState(next);
    setActiveHint(null);
    if (next.status === 'won') {
      playArcadeSfx(muted, 'win');
      setRecord(saveExtraGameOutcome('sudoku', { outcome: 'win', timeSec: elapsedSec }));
      setPhase('gameover');
    } else {
      playArcadeSfx(muted, 'flip');
    }
  }, [activeHint, state, muted, elapsedSec]);

  // Keyboard digits, arrows, notes, undo, hint
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        handleDigit(Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        handleDigit(0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => (s >= 9 ? s - 9 : s));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => (s < 72 ? s + 9 : s));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelected((s) => (s % 9 > 0 ? s - 1 : s));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelected((s) => (s % 9 < 8 ? s + 1 : s));
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setNoteMode((v) => !v);
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        handleHint();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleDigit, handleUndo, handleHint]);

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="VAULT SUDOKU"
        subtitle="9×9 Unique-Solution Logic Vault"
        eyebrow="Puzzles & Logic"
        description="Crack uniquely solvable 9×9 brass vault combinations. Toggle pencil notes, undo cleanly, or summon the Smart Logic Engine to explain Naked and Hidden Singles step by step."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins} Vaults Cracked${record.bestTimeSec ? ` · Best ${formatSec(record.bestTimeSec)}` : ''}`}
        ctaLabel="Open Vault"
        onStart={() => startFresh()}
        onSwitchGame={onSwitchGame}
      >
        <div className="flex flex-wrap gap-2.5">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDifficulty(t.id)}
              className={`border px-4 py-2 text-left transition ${
                difficulty === t.id
                  ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5D28A]'
                  : 'border-white/15 bg-[#0E1117]/80 text-[#CBD5E1] hover:border-white/30'
              }`}
            >
              <div className="text-xs font-semibold tracking-wider uppercase">{t.label}</div>
              <div className="text-[11px] text-[#94A3B8]">{t.desc}</div>
            </button>
          ))}
        </div>
      </NoirTitleScreen>
    );
  }

  const selRow = getSudokuRow(selected);
  const selCol = getSudokuCol(selected);
  const selBox = getSudokuBox(selected);
  const selVal = state.values[selected];

  const remainingCounts = new Array<number>(10).fill(9);
  for (const v of state.values) {
    if (v >= 1 && v <= 9) remainingCounts[v] -= 1;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#080A0E] text-[#ECEFF4]">
      <NoirGameHeader
        title="VAULT SUDOKU"
        subtitle={`${difficulty.toUpperCase()} · ${formatSec(elapsedSec)} · MISTAKES ${state.mistakes}`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={() => startFresh()}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <div className="hidden items-center gap-4 font-mono text-xs sm:flex">
            <span className="text-[#F5D28A]">{formatSec(elapsedSec)}</span>
            <span className="text-[#94A3B8]">MISTAKES {state.mistakes}</span>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-5 px-4 py-5 lg:flex-row lg:items-start lg:py-8">
        {/* 9x9 Grid */}
        <div className="w-full max-w-[468px]">
          <div className="border-2 border-[#D4A853]/55 bg-[#0F131C] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.8)]">
            <div className="grid grid-cols-9">
              {state.values.map((val, idx) => {
                const r = getSudokuRow(idx);
                const c = getSudokuCol(idx);
                const box = getSudokuBox(idx);
                const isSelected = idx === selected;
                const isHintCell = activeHint?.index === idx;
                const isPeer = !isSelected && (r === selRow || c === selCol || box === selBox);
                const isSameVal = selVal !== 0 && val === selVal && !isSelected;
                const isConflict = conflicts.has(idx);
                const isWrong = !state.given[idx] && val !== 0 && val !== state.solution[idx];

                const borderClasses = [
                  c % 3 === 2 && c !== 8 ? 'border-r-2 border-r-[#D4A853]/55' : 'border-r border-r-white/10',
                  r % 3 === 2 && r !== 8 ? 'border-b-2 border-b-[#D4A853]/55' : 'border-b border-b-white/10',
                ].join(' ');

                return (
                  <button
                    key={idx}
                    type="button"
                    data-sudoku-cell={idx}
                    aria-label={`Row ${r + 1} Column ${c + 1} ${val ? `value ${val}` : 'empty'}`}
                    onClick={() => setSelected(idx)}
                    className={`relative flex aspect-square items-center justify-center font-mono transition ${borderClasses} ${
                      isHintCell
                        ? 'bg-emerald-500/30 ring-2 ring-inset ring-emerald-300'
                        : isSelected
                        ? 'bg-[#D4A853]/28 ring-2 ring-inset ring-[#F5D28A]'
                        : isSameVal
                        ? 'bg-[#D4A853]/14'
                        : isPeer
                        ? 'bg-white/[0.045]'
                        : 'bg-[#0C1018]'
                    }`}
                  >
                    {val !== 0 ? (
                      <span
                        className={`text-lg font-semibold sm:text-xl ${
                          isConflict || isWrong
                            ? 'text-[#F87171]'
                            : state.given[idx]
                            ? 'text-[#F8FAFC]'
                            : 'text-[#F5D28A]'
                        }`}
                      >
                        {val}
                      </span>
                    ) : state.notes[idx].length > 0 ? (
                      <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-0.5 text-[8px] leading-none text-[#94A3B8] sm:text-[9px]">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <span key={n} className="flex items-center justify-center">
                            {state.notes[idx].includes(n) ? n : ''}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tactical Keypad & Smart Logic Hint Panel */}
        <div className="flex w-full max-w-[468px] flex-col gap-4 lg:w-72">
          {activeHint && (
            <div className="border border-emerald-400/45 bg-emerald-950/35 p-3.5 text-xs">
              <div className="font-mono text-[11px] font-semibold tracking-wider text-emerald-300 uppercase">
                {activeHint.technique}
              </div>
              <p className="mt-1 leading-relaxed text-[#E2E8F0]">{activeHint.reason}</p>
              <button
                type="button"
                onClick={applyHint}
                className="mt-2.5 bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[#06130E] uppercase transition hover:bg-emerald-300"
              >
                Place {activeHint.value}
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleDigit(n)}
                className="flex flex-col items-center justify-center border border-white/15 bg-[#121722] py-2.5 transition hover:border-[#D4A853]/60 hover:bg-[#192030]"
              >
                <span className="font-mono text-lg font-semibold text-[#F8FAFC]">{n}</span>
                <span className="font-mono text-[10px] text-[#94A3B8]">
                  {Math.max(0, remainingCounts[n])} left
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNoteMode((v) => !v)}
              className={`inline-flex items-center justify-center gap-1.5 border px-3 py-2 text-xs font-medium tracking-wider uppercase transition ${
                noteMode
                  ? 'border-[#D4A853] bg-[#D4A853]/20 text-[#F5D28A]'
                  : 'border-white/15 bg-white/[0.03] text-[#CBD5E1] hover:border-white/30'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Notes {noteMode ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => handleDigit(0)}
              className="inline-flex items-center justify-center gap-1.5 border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-medium tracking-wider text-[#CBD5E1] uppercase transition hover:border-white/30"
            >
              <Eraser className="h-3.5 w-3.5" />
              Erase
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={state.history.length === 0}
              className="inline-flex items-center justify-center gap-1.5 border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-medium tracking-wider text-[#CBD5E1] uppercase transition hover:border-white/30 disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={handleHint}
              className="inline-flex items-center justify-center gap-1.5 border border-[#D4A853]/45 bg-[#D4A853]/12 px-3 py-2 text-xs font-medium tracking-wider text-[#F5D28A] uppercase transition hover:bg-[#D4A853]/22"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Smart Hint
            </button>
          </div>

          <div className="flex items-center gap-1.5 pt-1 text-[11px]">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => startFresh(t.id)}
                className={`flex-1 border px-2 py-1.5 uppercase tracking-wider transition ${
                  difficulty === t.id
                    ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5D28A]'
                    : 'border-white/10 text-[#94A3B8] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </main>

      {phase === 'paused' && (
        <NoirPauseModal
          title="VAULT SUDOKU"
          onResume={() => setPhase('playing')}
          onRestart={() => startFresh()}
          onSwitchGame={onSwitchGame}
        />
      )}

      {phase === 'gameover' && (
        <NoirOutcomeModal
          outcome="win"
          headline="Vault Combination Cracked"
          summary={`Solved ${difficulty.toUpperCase()} grid in ${formatSec(elapsedSec)} with ${state.mistakes} mistake${state.mistakes === 1 ? '' : 's'} and ${state.hintsUsed} logic hint${state.hintsUsed === 1 ? '' : 's'}.`}
          onPlayAgain={() => startFresh()}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
