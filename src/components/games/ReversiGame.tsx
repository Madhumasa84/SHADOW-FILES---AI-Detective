import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lightbulb, Undo2 } from 'lucide-react';
import {
  ReversiDifficulty,
  ReversiState,
  applyReversiMove,
  chooseReversiAIMove,
  createInitialReversiState,
  getLegalReversiMoves,
} from '../../arcade/reversi';
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

interface ReversiGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const TIERS: Array<{ id: ReversiDifficulty; label: string; desc: string }> = [
  { id: 'club', label: 'Club', desc: 'Greedy mobility' },
  { id: 'tactician', label: 'Tactician', desc: '3-ply corner search' },
  { id: 'apex', label: 'Apex', desc: '4-ply endgame solver' },
];

export function ReversiGame({ backdropUrl, autoStart, onSwitchGame }: ReversiGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [difficulty, setDifficulty] = useState<ReversiDifficulty>('tactician');
  const [state, setState] = useState<ReversiState>(() => createInitialReversiState());
  const [history, setHistory] = useState<ReversiState[]>([]);
  const [hintSquare, setHintSquare] = useState<[number, number] | null>(null);
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('reversi'));
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
    setState(createInitialReversiState());
    setHistory([]);
    setHintSquare(null);
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
    () => (state.winner === 0 && state.turn === 1 ? getLegalReversiMoves(state.board, 1) : []),
    [state]
  );

  const legalMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of legalMoves) m.set(`${mv.row},${mv.col}`, mv.flips.length);
    return m;
  }, [legalMoves]);

  const finishIfOver = useCallback(
    (next: ReversiState) => {
      if (next.winner === 0) return;
      const outcome = next.winner === 1 ? 'win' : next.winner === 2 ? 'loss' : 'draw';
      playArcadeSfx(muted, outcome === 'win' ? 'win' : 'lose');
      setRecord(saveExtraGameOutcome('reversi', { outcome, score: next.blackCount }));
      setPhase('gameover');
    },
    [muted]
  );

  useEffect(() => {
    if (phase !== 'playing' || state.winner !== 0 || state.turn !== 2) return;
    clearTimer();
    aiTimerRef.current = window.setTimeout(() => {
      const mv = chooseReversiAIMove(state, difficulty, 2);
      if (mv) {
        const next = applyReversiMove(state, mv.row, mv.col);
        setState(next);
        playArcadeSfx(muted, 'flip');
        finishIfOver(next);
      }
    }, 360);
    return clearTimer;
  }, [phase, state, difficulty, muted, clearTimer, finishIfOver]);

  const handleCellClick = (r: number, c: number) => {
    if (phase !== 'playing' || state.winner !== 0 || state.turn !== 1) return;
    if (!legalMap.has(`${r},${c}`)) return;
    setHintSquare(null);
    setHistory((h) => [...h.slice(-24), state]);
    const next = applyReversiMove(state, r, c);
    setState(next);
    playArcadeSfx(muted, 'flip');
    finishIfOver(next);
  };

  const handleUndo = () => {
    if (phase !== 'playing' || history.length === 0) return;
    clearTimer();
    setState(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setHintSquare(null);
    playArcadeSfx(muted, 'tap');
  };

  const handleHint = () => {
    if (phase !== 'playing' || state.winner !== 0 || state.turn !== 1) return;
    const mv = chooseReversiAIMove(state, 'apex', 1);
    if (mv) {
      setHintSquare([mv.row, mv.col]);
      playArcadeSfx(muted, 'hint');
    }
  };

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="ECLIPSE OTHELLO"
        subtitle="8×8 Reversi · Mobility & Corner AI"
        eyebrow="Strategy & AI"
        description="Command the emerald felt table in classic Reversi. Sacrifice early discs for mobility, lock down the four corners, and out-calculate an Alpha-Beta opponent."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins}W – ${record.losses}L · High Discs ${record.bestScore}`}
        ctaLabel="Take the Table"
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

  const totalDiscs = state.blackCount + state.whiteCount;
  const blackPct = totalDiscs > 0 ? Math.round((state.blackCount / totalDiscs) * 100) : 50;

  return (
    <div className="flex min-h-screen flex-col bg-[#080B0E] text-[#ECEFF4]">
      <NoirGameHeader
        title="ECLIPSE OTHELLO"
        subtitle={`${difficulty.toUpperCase()} AI · ${state.blackCount}–${state.whiteCount}`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={startFresh}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <div className="hidden items-center gap-3 font-mono text-xs sm:flex">
            <span className={state.turn === 1 ? 'text-[#F5D28A]' : 'text-[#94A3B8]'}>
              {state.turn === 1 ? 'OBSIDIAN (YOU)' : 'IVORY AI THINKING'}
            </span>
          </div>
        }
      />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-5">
        <div className="mb-3 flex w-full max-w-[520px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4 font-mono text-sm">
            <span className="flex items-center gap-2 text-[#F8FAFC]">
              <span className="h-3.5 w-3.5 rounded-full border border-[#D4A853]/60 bg-[#11151E]" />
              You: <strong>{state.blackCount}</strong>
            </span>
            <span className="flex items-center gap-2 text-[#F5D28A]">
              <span className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-[#FFFDF7] to-[#D4C5A3]" />
              AI: <strong>{state.whiteCount}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHint}
              disabled={state.turn !== 1 || state.winner !== 0}
              className="inline-flex items-center gap-1.5 border border-[#D4A853]/35 bg-[#D4A853]/10 px-3 py-1.5 text-xs font-medium tracking-wider text-[#F5D28A] uppercase transition hover:bg-[#D4A853]/20 disabled:opacity-40"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Hint
            </button>
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
        </div>

        {/* Advantage bar */}
        <div className="mb-3 h-1.5 w-full max-w-[520px] overflow-hidden bg-[#E5DEC9]/25">
          <div
            className="h-full bg-[#D4A853] transition-all duration-300"
            style={{ width: `${blackPct}%` }}
          />
        </div>

        {state.passedLastTurn && (
          <p className="mb-2 text-xs tracking-wider text-[#F5D28A] uppercase">
            No legal moves for opponent — turn passed automatically.
          </p>
        )}

        {/* Emerald Velvet 8x8 Board */}
        <div className="w-full max-w-[520px] border-2 border-[#D4A853]/45 bg-[#0A261E] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.8)] sm:p-3.5">
          <div className="grid grid-cols-8 gap-1 bg-[#061813] p-1">
            {Array.from({ length: 8 }, (_, r) =>
              Array.from({ length: 8 }, (_, c) => {
                const cell = state.board[r][c];
                const flipCount = legalMap.get(`${r},${c}`);
                const isLegal = flipCount !== undefined;
                const isLast = state.lastMove?.row === r && state.lastMove?.col === c;
                const isHint = hintSquare?.[0] === r && hintSquare?.[1] === c;

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    data-cell={`${r}-${c}`}
                    aria-label={`Row ${r + 1} Column ${c + 1}${isLegal ? ` legal move flips ${flipCount}` : ''}`}
                    onClick={() => handleCellClick(r, c)}
                    disabled={!isLegal}
                    className={`relative flex aspect-square items-center justify-center transition ${
                      isHint
                        ? 'bg-emerald-500/35 ring-2 ring-emerald-300'
                        : isLegal
                        ? 'bg-[#104032] hover:bg-[#175744] cursor-pointer'
                        : 'bg-[#0C3126]'
                    }`}
                  >
                    {cell === 1 && (
                      <span
                        className={`h-[78%] w-[78%] rounded-full border border-[#D4A853]/40 bg-gradient-to-br from-[#2B3345] via-[#131722] to-[#05070B] shadow-[0_3px_8px_rgba(0,0,0,0.75)] transition-transform duration-300 ${
                          isLast ? 'ring-2 ring-[#D4A853]' : ''
                        }`}
                      />
                    )}
                    {cell === 2 && (
                      <span
                        className={`h-[78%] w-[78%] rounded-full border border-[#D4A853]/50 bg-gradient-to-br from-[#FFFDF7] via-[#EFE6D2] to-[#B9A782] shadow-[0_3px_8px_rgba(0,0,0,0.65)] transition-transform duration-300 ${
                          isLast ? 'ring-2 ring-[#D4A853]' : ''
                        }`}
                      />
                    )}
                    {cell === 0 && isLegal && (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#D4A853]/70 shadow-[0_0_8px_rgba(212,168,83,0.6)]" />
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
          title="ECLIPSE OTHELLO"
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
              ? 'Table Conquered'
              : state.winner === 2
              ? 'Ivory Prevails'
              : 'Even Split'
          }
          summary={`Final disc count: Obsidian ${state.blackCount} — Ivory ${state.whiteCount}.`}
          onPlayAgain={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
