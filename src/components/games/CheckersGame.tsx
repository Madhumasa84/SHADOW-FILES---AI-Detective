import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Undo2 } from 'lucide-react';
import {
  CheckersDifficulty,
  CheckersMove,
  CheckersState,
  applyCheckersMove,
  chooseCheckersAIMove,
  createInitialCheckersState,
  getLegalCheckersMoves,
} from '../../arcade/checkers';
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

interface CheckersGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const TIERS: Array<{ id: CheckersDifficulty; label: string; desc: string }> = [
  { id: 'casual', label: 'Casual', desc: 'Depth-2 parlor AI' },
  { id: 'tactician', label: 'Tactician', desc: 'Depth-4 forced jumps' },
  { id: 'master', label: 'Master', desc: 'Depth-5 king-hunt AI' },
];

export function CheckersGame({ backdropUrl, autoStart, onSwitchGame }: CheckersGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [difficulty, setDifficulty] = useState<CheckersDifficulty>('tactician');
  const [state, setState] = useState<CheckersState>(() => createInitialCheckersState());
  const [history, setHistory] = useState<CheckersState[]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('checkers'));
  const aiTimerRef = useRef<number | null>(null);

  useBodyGameState(phase);

  const clearTimer = useCallback(() => {
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
  }, []);

  const startFresh = useCallback(() => {
    clearTimer();
    setState(createInitialCheckersState());
    setHistory([]);
    setSelected(null);
    setPhase('playing');
  }, [clearTimer]);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p));
  }, []);

  useNoirShortcuts({
    phase,
    onStart: startFresh,
    onTogglePause: togglePause,
    onToggleMute: () => setMuted((m) => !m),
  });

  useEffect(() => () => clearTimer(), [clearTimer]);

  const legalMoves = useMemo(
    () => (state.winner === null && state.turn === 'gold' ? getLegalCheckersMoves(state.board, 'gold') : []),
    [state]
  );

  const mustCapture = legalMoves.length > 0 && legalMoves[0].captures.length > 0;

  const selectableOrigins = useMemo(() => {
    const s = new Set<string>();
    for (const m of legalMoves) s.add(`${m.from[0]},${m.from[1]}`);
    return s;
  }, [legalMoves]);

  const selectedMoves = useMemo(() => {
    if (!selected) return [] as CheckersMove[];
    return legalMoves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1]);
  }, [legalMoves, selected]);

  const finishIfOver = useCallback(
    (next: CheckersState) => {
      if (next.winner === null) return;
      const outcome = next.winner === 'gold' ? 'win' : next.winner === 'obsidian' ? 'loss' : 'draw';
      playArcadeSfx(muted, outcome === 'win' ? 'win' : 'lose');
      setRecord(saveExtraGameOutcome('checkers', { outcome }));
      setPhase('gameover');
    },
    [muted]
  );

  useEffect(() => {
    if (phase !== 'playing' || state.winner !== null || state.turn !== 'obsidian') return;
    clearTimer();
    aiTimerRef.current = window.setTimeout(() => {
      const mv = chooseCheckersAIMove(state, difficulty);
      if (mv) {
        const next = applyCheckersMove(state, mv);
        setState(next);
        playArcadeSfx(muted, mv.captures.length > 0 ? 'capture' : 'tap');
        finishIfOver(next);
      }
    }, 380);
    return clearTimer;
  }, [phase, state, difficulty, muted, clearTimer, finishIfOver]);

  const handleSquareClick = (r: number, c: number) => {
    if (phase !== 'playing' || state.winner !== null || state.turn !== 'gold') return;

    // If clicking a valid destination for the currently selected piece
    const targetMove = selectedMoves.find((m) => m.to[0] === r && m.to[1] === c);
    if (targetMove) {
      setHistory((h) => [...h.slice(-24), state]);
      const next = applyCheckersMove(state, targetMove);
      setState(next);
      setSelected(null);
      playArcadeSfx(muted, targetMove.captures.length > 0 ? 'capture' : 'tap');
      finishIfOver(next);
      return;
    }

    // Otherwise select piece if it has legal moves
    if (selectableOrigins.has(`${r},${c}`)) {
      setSelected([r, c]);
      playArcadeSfx(muted, 'tap');
    } else {
      setSelected(null);
    }
  };

  const handleUndo = () => {
    if (phase !== 'playing' || history.length === 0) return;
    clearTimer();
    setState(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
    playArcadeSfx(muted, 'tap');
  };

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="NOIR DRAUGHTS"
        subtitle="8×8 Checkers · Mandatory Multi-Jump AI"
        eyebrow="Strategy & AI"
        description="Classic American Checkers on carved walnut and slate. Chain mandatory double- and triple-jumps, crown your kings on the back rank, and defeat a depth-5 Alpha-Beta adversary."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins}W – ${record.losses}L · Streak ${record.streak}`}
        ctaLabel="Start Match"
        onStart={startFresh}
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

  return (
    <div className="flex min-h-screen flex-col bg-[#090B0E] text-[#ECEFF4]">
      <NoirGameHeader
        title="NOIR DRAUGHTS"
        subtitle={`${difficulty.toUpperCase()} AI · GOLD ${state.goldCount} vs OBSIDIAN ${state.obsidianCount}`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={startFresh}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <span className="hidden font-mono text-xs text-[#F5D28A] sm:inline">
            {state.turn === 'gold'
              ? mustCapture
                ? 'FORCED CAPTURE'
                : 'YOUR MOVE'
              : 'AI CALCULATING'}
          </span>
        }
      />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-5">
        <div className="mb-3 flex w-full max-w-[520px] items-center justify-between gap-2">
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="text-[#F5D28A]">GOLD: {state.goldCount}</span>
            <span className="text-[#94A3B8]">OBSIDIAN: {state.obsidianCount}</span>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            className="inline-flex items-center gap-1.5 border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-medium tracking-wider text-[#CBD5E1] uppercase transition hover:border-white/30 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>

        <div className="w-full max-w-[520px] border-2 border-[#D4A853]/45 bg-[#2A1D15] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.8)] sm:p-3.5">
          <div className="grid grid-cols-8 border border-[#D4A853]/30">
            {Array.from({ length: 8 }, (_, r) =>
              Array.from({ length: 8 }, (_, c) => {
                const dark = (r + c) % 2 === 1;
                const piece = state.board[r][c];
                const isSelected = selected?.[0] === r && selected?.[1] === c;
                const canSelect = selectableOrigins.has(`${r},${c}`);
                const targetMove = selectedMoves.find((m) => m.to[0] === r && m.to[1] === c);
                const isPathHop = selectedMoves.some((m) =>
                  m.path.slice(0, -1).some(([pr, pc]) => pr === r && pc === c)
                );

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    data-cell={`${r}-${c}`}
                    aria-label={`Square ${r + 1},${c + 1}`}
                    onClick={() => handleSquareClick(r, c)}
                    className={`relative flex aspect-square items-center justify-center transition ${
                      dark
                        ? isSelected
                          ? 'bg-[#3D2D1F] ring-2 ring-inset ring-[#F5D28A]'
                          : targetMove
                          ? 'bg-[#1D4B3B] hover:bg-[#25604B]'
                          : 'bg-[#181B22]'
                        : 'bg-[#C8B89E]/85'
                    }`}
                  >
                    {piece && (
                      <span
                        className={`flex h-[76%] w-[76%] items-center justify-center rounded-full border-2 transition-transform ${
                          piece.owner === 'gold'
                            ? 'border-[#FDE68A]/80 bg-gradient-to-br from-[#F7D78C] via-[#C9912E] to-[#7D5310] text-[#1C1206]'
                            : 'border-[#64748B]/70 bg-gradient-to-br from-[#334155] via-[#111827] to-[#020617] text-[#E2E8F0]'
                        } ${canSelect && mustCapture ? 'ring-2 ring-[#F5D28A] animate-pulse' : ''} ${
                          isSelected ? 'scale-105' : ''
                        } shadow-[0_4px_10px_rgba(0,0,0,0.75)]`}
                      >
                        {piece.king ? (
                          <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <span className="h-[52%] w-[52%] rounded-full border border-white/25" />
                        )}
                      </span>
                    )}

                    {!piece && targetMove && (
                      <span
                        className={`h-3.5 w-3.5 rounded-full ${
                          targetMove.captures.length > 0
                            ? 'bg-[#F5D28A] shadow-[0_0_12px_rgba(245,210,138,0.9)]'
                            : 'bg-emerald-300/85'
                        }`}
                      />
                    )}
                    {!piece && !targetMove && isPathHop && (
                      <span className="h-2 w-2 rounded-full bg-[#F5D28A]/50" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </main>

      {phase === 'paused' && (
        <NoirPauseModal
          title="NOIR DRAUGHTS"
          onResume={() => setPhase('playing')}
          onRestart={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}

      {phase === 'gameover' && (
        <NoirOutcomeModal
          outcome={state.winner === 'gold' ? 'win' : state.winner === 'obsidian' ? 'loss' : 'draw'}
          headline={
            state.winner === 'gold'
              ? 'Board Cleared — Victory'
              : state.winner === 'obsidian'
              ? 'Obsidian Claims the Board'
              : 'Drawn Match'
          }
          summary={`Remaining pieces — Gold ${state.goldCount}, Obsidian ${state.obsidianCount}.`}
          onPlayAgain={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
