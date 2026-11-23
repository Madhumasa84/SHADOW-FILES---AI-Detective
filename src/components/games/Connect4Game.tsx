import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, Undo2 } from 'lucide-react';
import {
  C4Difficulty,
  C4State,
  C4_COLS,
  C4_ROWS,
  chooseC4AIMove,
  createInitialC4State,
  dropC4Disc,
  getDropRow,
} from '../../arcade/connect4';
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

interface Connect4GameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const DIFFICULTIES: Array<{ id: C4Difficulty; label: string; desc: string }> = [
  { id: 'street', label: 'Street', desc: 'Depth-2 tactical' },
  { id: 'master', label: 'Master', desc: 'Depth-4 minimax' },
  { id: 'grandmaster', label: 'Grandmaster', desc: 'Depth-6 alpha-beta' },
];

export function Connect4Game({ backdropUrl, autoStart, onSwitchGame }: Connect4GameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [difficulty, setDifficulty] = useState<C4Difficulty>('master');
  const [state, setState] = useState<C4State>(() => createInitialC4State());
  const [history, setHistory] = useState<C4State[]>([]);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [hintCol, setHintCol] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('connect4'));
  const aiTimerRef = useRef<number | null>(null);

  useBodyGameState(phase);

  const clearAiTimer = useCallback(() => {
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
  }, []);

  const startFresh = useCallback(() => {
    clearAiTimer();
    setState(createInitialC4State());
    setHistory([]);
    setHintCol(null);
    setPhase('playing');
  }, [clearAiTimer]);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p));
  }, []);

  useNoirShortcuts({
    phase,
    onStart: startFresh,
    onTogglePause: togglePause,
    onToggleMute: () => setMuted((m) => !m),
  });

  useEffect(() => () => clearAiTimer(), [clearAiTimer]);

  const finishIfOver = useCallback(
    (next: C4State) => {
      if (next.winner === 0) return false;
      const outcome = next.winner === 1 ? 'win' : next.winner === 2 ? 'loss' : 'draw';
      playArcadeSfx(muted, outcome === 'win' ? 'win' : 'lose');
      setRecord(saveExtraGameOutcome('connect4', { outcome }));
      setPhase('gameover');
      return true;
    },
    [muted]
  );

  // Trigger AI turn smoothly
  useEffect(() => {
    if (phase !== 'playing' || state.winner !== 0 || state.turn !== 2) return;
    clearAiTimer();
    aiTimerRef.current = window.setTimeout(() => {
      const col = chooseC4AIMove(state, difficulty, 2);
      if (col >= 0) {
        const next = dropC4Disc(state, col);
        setState(next);
        playArcadeSfx(muted, 'drop');
        finishIfOver(next);
      }
    }, 320);
    return clearAiTimer;
  }, [phase, state, difficulty, muted, clearAiTimer, finishIfOver]);

  const handleDrop = useCallback(
    (col: number) => {
      if (phase !== 'playing' || state.winner !== 0 || state.turn !== 1) return;
      if (getDropRow(state.board, col) === -1) return;
      setHintCol(null);
      setHistory((h) => [...h.slice(-20), state]);
      const next = dropC4Disc(state, col);
      setState(next);
      playArcadeSfx(muted, 'drop');
      finishIfOver(next);
    },
    [phase, state, muted, finishIfOver]
  );

  const handleUndo = () => {
    if (phase !== 'playing' || history.length === 0) return;
    clearAiTimer();
    const prev = history[history.length - 1];
    setState(prev);
    setHistory((h) => h.slice(0, -1));
    setHintCol(null);
    playArcadeSfx(muted, 'tap');
  };

  const handleHint = () => {
    if (phase !== 'playing' || state.turn !== 1 || state.winner !== 0) return;
    const col = chooseC4AIMove(state, 'grandmaster', 1);
    if (col >= 0) {
      setHintCol(col);
      playArcadeSfx(muted, 'hint');
    }
  };

  const isWinningCell = (r: number, c: number) =>
    state.winningCells.some(([wr, wc]) => wr === r && wc === c);

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="OBSIDIAN FOUR"
        subtitle="Connect Four · Alpha-Beta Minimax"
        eyebrow="Strategy & AI"
        description="Outwit a depth-6 Alpha-Beta engine across a brushed brass and obsidian cabinet. Control the center column, engineer double threats, and align four before the Syndicate locks the board."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins}W – ${record.losses}L · Best Streak ${record.bestStreak}`}
        ctaLabel="Enter Match"
        onStart={startFresh}
        onSwitchGame={onSwitchGame}
      >
        <div className="flex flex-wrap gap-2.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id)}
              className={`border px-4 py-2 text-left transition ${
                difficulty === d.id
                  ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5D28A]'
                  : 'border-white/15 bg-[#0E1117]/80 text-[#CBD5E1] hover:border-white/30'
              }`}
            >
              <div className="text-xs font-semibold tracking-wider uppercase">{d.label}</div>
              <div className="text-[11px] text-[#94A3B8]">{d.desc}</div>
            </button>
          ))}
        </div>
      </NoirTitleScreen>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#090B0F] text-[#ECEFF4]">
      <NoirGameHeader
        title="OBSIDIAN FOUR"
        subtitle={`${difficulty.toUpperCase()} AI · ${record.wins}W–${record.losses}L`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={startFresh}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <div className="hidden items-center gap-4 font-mono text-xs sm:flex">
            <span className={state.turn === 1 ? 'text-[#F5D28A]' : 'text-[#94A3B8]'}>
              {state.turn === 1 ? '● YOUR TURN' : '○ AI THINKING'}
            </span>
            <span className="text-[#94A3B8]">MOVE {state.movesCount}</span>
          </div>
        }
      />

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-6">
        <div className="mb-4 flex w-full max-w-[540px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4 text-xs font-medium tracking-wider uppercase">
            <span className="flex items-center gap-2 text-[#F5D28A]">
              <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-br from-[#F7D78C] to-[#B77F1F]" />
              You (Gold)
            </span>
            <span className="flex items-center gap-2 text-[#FCA5A5]">
              <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-br from-[#EF4444] to-[#7F1D1D]" />
              Syndicate (Crimson)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHint}
              disabled={state.turn !== 1 || state.winner !== 0}
              className="inline-flex items-center gap-1.5 whitespace-nowrap border border-[#D4A853]/35 bg-[#D4A853]/10 px-3 py-1.5 text-xs font-medium tracking-wider text-[#F5D28A] uppercase transition hover:bg-[#D4A853]/20 disabled:opacity-40"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Hint
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="inline-flex items-center gap-1.5 whitespace-nowrap border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-medium tracking-wider text-[#CBD5E1] uppercase transition hover:border-white/30 disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
          </div>
        </div>

        {/* Column drop indicators */}
        <div className="grid w-full max-w-[540px] grid-cols-7 gap-2 px-4 pb-2">
          {Array.from({ length: C4_COLS }, (_, col) => {
            const canDrop = state.turn === 1 && state.winner === 0 && getDropRow(state.board, col) !== -1;
            const isHint = hintCol === col;
            const isHover = hoverCol === col && canDrop;
            return (
              <button
                key={col}
                type="button"
                aria-label={`Drop disc in column ${col + 1}`}
                onMouseEnter={() => setHoverCol(col)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => handleDrop(col)}
                disabled={!canDrop}
                className="flex h-8 items-center justify-center transition"
              >
                <span
                  className={`h-6 w-6 rounded-full transition-all duration-150 ${
                    isHint
                      ? 'scale-110 bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)]'
                      : isHover
                      ? 'scale-100 bg-gradient-to-br from-[#F7D78C] to-[#B77F1F] shadow-[0_0_14px_rgba(212,168,83,0.65)]'
                      : 'scale-50 bg-white/10'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Cabinet Board */}
        <div className="w-full max-w-[540px] border-2 border-[#D4A853]/45 bg-gradient-to-b from-[#1A202C] via-[#121620] to-[#0B0E14] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.75)] sm:p-4">
          <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
            {Array.from({ length: C4_ROWS }, (_, r) =>
              Array.from({ length: C4_COLS }, (_, c) => {
                const disc = state.board[r][c];
                const win = isWinningCell(r, c);
                const isLast = state.lastMove?.row === r && state.lastMove?.col === c;
                const isHintTarget = hintCol === c && getDropRow(state.board, c) === r;
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    data-cell={`${r}-${c}`}
                    aria-label={`Row ${r + 1} Column ${c + 1}`}
                    onMouseEnter={() => setHoverCol(c)}
                    onMouseLeave={() => setHoverCol(null)}
                    onClick={() => handleDrop(c)}
                    className={`relative aspect-square rounded-full border transition-all duration-200 ${
                      win
                        ? 'border-[#FDE68A] ring-2 ring-[#FDE68A]/80'
                        : isHintTarget
                        ? 'border-emerald-400/70 bg-emerald-500/15'
                        : 'border-white/10 bg-[#07090D]'
                    } shadow-[inset_0_4px_10px_rgba(0,0,0,0.85)]`}
                  >
                    {disc === 1 && (
                      <span
                        className={`block h-full w-full rounded-full bg-gradient-to-br from-[#FDE68A] via-[#D4A853] to-[#8C5B12] shadow-[inset_0_2px_6px_rgba(255,255,255,0.45),0_2px_10px_rgba(212,168,83,0.4)] transition-transform duration-200 ${
                          isLast ? 'ring-2 ring-white/70' : ''
                        }`}
                      />
                    )}
                    {disc === 2 && (
                      <span
                        className={`block h-full w-full rounded-full bg-gradient-to-br from-[#F87171] via-[#C82828] to-[#580E0E] shadow-[inset_0_2px_6px_rgba(255,255,255,0.3),0_2px_10px_rgba(200,40,40,0.4)] transition-transform duration-200 ${
                          isLast ? 'ring-2 ring-white/70' : ''
                        }`}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Difficulty quick switch */}
        <div className="mt-5 flex items-center gap-2 text-xs">
          <span className="text-[#94A3B8] uppercase tracking-wider">AI Tier:</span>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDifficulty(d.id);
                startFresh();
              }}
              className={`border px-2.5 py-1 uppercase tracking-wider transition ${
                difficulty === d.id
                  ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5D28A]'
                  : 'border-white/10 text-[#94A3B8] hover:text-white'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </main>

      {phase === 'paused' && (
        <NoirPauseModal
          title="OBSIDIAN FOUR"
          onResume={() => setPhase('playing')}
          onRestart={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}

      {phase === 'gameover' && (
        <NoirOutcomeModal
          outcome={state.winner === 1 ? 'win' : state.winner === 2 ? 'loss' : 'draw'}
          headline={
            state.winner === 1
              ? 'Four Aligned — You Win'
              : state.winner === 2
              ? 'Syndicate Takes the Board'
              : 'Cabinet Full — Draw'
          }
          summary={`Completed in ${state.movesCount} drops against ${difficulty.toUpperCase()} AI.`}
          onPlayAgain={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
