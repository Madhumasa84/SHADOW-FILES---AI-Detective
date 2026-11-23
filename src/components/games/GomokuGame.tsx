import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, Undo2 } from 'lucide-react';
import {
  GOMOKU_SIZE,
  GomokuDifficulty,
  GomokuState,
  chooseGomokuAIMove,
  createInitialGomokuState,
  placeGomokuStone,
} from '../../arcade/gomoku';
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

interface GomokuGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const TIERS: Array<{ id: GomokuDifficulty; label: string; desc: string }> = [
  { id: 'club', label: 'Club', desc: 'Pattern threat AI' },
  { id: 'master', label: 'Master', desc: 'Fork & open-four engine' },
  { id: 'grandmaster', label: 'Grandmaster', desc: '2-ply threat lookahead' },
];

const STAR_POINTS = new Set(['3,3', '3,11', '7,7', '11,3', '11,11']);

export function GomokuGame({ backdropUrl, autoStart, onSwitchGame }: GomokuGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [difficulty, setDifficulty] = useState<GomokuDifficulty>('master');
  const [state, setState] = useState<GomokuState>(() => createInitialGomokuState());
  const [history, setHistory] = useState<GomokuState[]>([]);
  const [hintPoint, setHintPoint] = useState<[number, number] | null>(null);
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('gomoku'));
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
    setState(createInitialGomokuState());
    setHistory([]);
    setHintPoint(null);
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

  const finishIfOver = useCallback(
    (next: GomokuState) => {
      if (next.winner === 0) return;
      const outcome = next.winner === 1 ? 'win' : next.winner === 2 ? 'loss' : 'draw';
      playArcadeSfx(muted, outcome === 'win' ? 'win' : 'lose');
      setRecord(saveExtraGameOutcome('gomoku', { outcome }));
      setPhase('gameover');
    },
    [muted]
  );

  useEffect(() => {
    if (phase !== 'playing' || state.winner !== 0 || state.turn !== 2) return;
    clearTimer();
    aiTimerRef.current = window.setTimeout(() => {
      const mv = chooseGomokuAIMove(state, difficulty, 2);
      if (mv) {
        const next = placeGomokuStone(state, mv[0], mv[1]);
        setState(next);
        playArcadeSfx(muted, 'drop');
        finishIfOver(next);
      }
    }, 300);
    return clearTimer;
  }, [phase, state, difficulty, muted, clearTimer, finishIfOver]);

  const handlePlace = (r: number, c: number) => {
    if (phase !== 'playing' || state.winner !== 0 || state.turn !== 1) return;
    if (state.board[r][c] !== 0) return;
    setHintPoint(null);
    setHistory((h) => [...h.slice(-24), state]);
    const next = placeGomokuStone(state, r, c);
    setState(next);
    playArcadeSfx(muted, 'drop');
    finishIfOver(next);
  };

  const handleUndo = () => {
    if (phase !== 'playing' || history.length === 0) return;
    clearTimer();
    setState(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setHintPoint(null);
    playArcadeSfx(muted, 'tap');
  };

  const handleHint = () => {
    if (phase !== 'playing' || state.winner !== 0 || state.turn !== 1) return;
    const mv = chooseGomokuAIMove(state, 'grandmaster', 1);
    if (mv) {
      setHintPoint(mv);
      playArcadeSfx(muted, 'hint');
    }
  };

  const isWinCell = (r: number, c: number) =>
    state.winningLine.some(([wr, wc]) => wr === r && wc === c);

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="FIVE IN A ROW"
        subtitle="15×15 Gomoku · Threat-Space Pattern AI"
        eyebrow="Strategy & AI"
        description="Place obsidian stones across a lacquered mahogany Goban. Forge unstoppable double-threes and open-fours while blocking a ruthless pattern-recognition AI."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins}W – ${record.losses}L · Best Streak ${record.bestStreak}`}
        ctaLabel="Place First Stone"
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
        title="FIVE IN A ROW"
        subtitle={`${difficulty.toUpperCase()} AI · MOVE ${state.movesCount}`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={startFresh}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <span className="hidden font-mono text-xs text-[#F5D28A] sm:inline">
            {state.turn === 1 ? 'OBSIDIAN (YOU)' : 'IVORY AI'}
          </span>
        }
      />

      <main className="flex flex-1 flex-col items-center justify-center px-3 py-4">
        <div className="mb-3 flex w-full max-w-[560px] items-center justify-between gap-2">
          <div className="flex items-center gap-4 text-xs tracking-wider uppercase">
            <span className="flex items-center gap-2 text-[#F8FAFC]">
              <span className="h-3 w-3 rounded-full border border-[#D4A853]/50 bg-[#121620]" />
              You (Obsidian)
            </span>
            <span className="flex items-center gap-2 text-[#E5DEC9]">
              <span className="h-3 w-3 rounded-full bg-[#F2E9D5]" />
              AI (Ivory)
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

        {/* Lacquered Mahogany 15x15 Goban */}
        <div className="w-full max-w-[560px] border-2 border-[#D4A853]/50 bg-gradient-to-br from-[#6E4927] via-[#57371B] to-[#3E2612] p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.85)] sm:p-4">
          <div className="grid grid-cols-15">
            {Array.from({ length: GOMOKU_SIZE }, (_, r) =>
              Array.from({ length: GOMOKU_SIZE }, (_, c) => {
                const stone = state.board[r][c];
                const isLast = state.lastMove?.[0] === r && state.lastMove?.[1] === c;
                const isWin = isWinCell(r, c);
                const isStar = STAR_POINTS.has(`${r},${c}`);
                const isHint = hintPoint?.[0] === r && hintPoint?.[1] === c;

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    data-cell={`${r}-${c}`}
                    aria-label={`Intersection ${r + 1},${c + 1}`}
                    onClick={() => handlePlace(r, c)}
                    className="group relative flex aspect-square items-center justify-center"
                  >
                    {/* Grid lines */}
                    <span
                      className={`pointer-events-none absolute top-1/2 h-[1px] bg-[#1C1108]/65 ${
                        c === 0 ? 'left-1/2 right-0' : c === GOMOKU_SIZE - 1 ? 'left-0 right-1/2' : 'inset-x-0'
                      }`}
                    />
                    <span
                      className={`pointer-events-none absolute left-1/2 w-[1px] bg-[#1C1108]/65 ${
                        r === 0 ? 'top-1/2 bottom-0' : r === GOMOKU_SIZE - 1 ? 'top-0 bottom-1/2' : 'inset-y-0'
                      }`}
                    />

                    {isStar && stone === 0 && (
                      <span className="pointer-events-none relative z-10 h-1.5 w-1.5 rounded-full bg-[#1C1108]/80" />
                    )}

                    {stone === 0 && isHint && (
                      <span className="relative z-20 h-[62%] w-[62%] rounded-full border-2 border-emerald-300 bg-emerald-400/45 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                    )}

                    {stone === 0 && !isHint && state.turn === 1 && state.winner === 0 && (
                      <span className="relative z-10 h-[66%] w-[66%] rounded-full bg-black/0 transition group-hover:bg-black/35" />
                    )}

                    {stone === 1 && (
                      <span
                        className={`relative z-20 h-[84%] w-[84%] rounded-full bg-gradient-to-br from-[#374151] via-[#111827] to-[#020617] shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${
                          isWin ? 'ring-2 ring-[#FDE68A]' : isLast ? 'ring-2 ring-[#D4A853]' : ''
                        }`}
                      />
                    )}
                    {stone === 2 && (
                      <span
                        className={`relative z-20 h-[84%] w-[84%] rounded-full bg-gradient-to-br from-[#FFFFFF] via-[#F2E9D5] to-[#B7A688] shadow-[0_2px_6px_rgba(0,0,0,0.65)] ${
                          isWin ? 'ring-2 ring-[#FDE68A]' : isLast ? 'ring-2 ring-[#D4A853]' : ''
                        }`}
                      />
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
          title="FIVE IN A ROW"
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
              ? 'Five Aligned — Victory'
              : state.winner === 2
              ? 'Ivory Completes Five'
              : 'Board Full — Draw'
          }
          summary={`Match resolved in ${state.movesCount} stones against ${difficulty.toUpperCase()} AI.`}
          onPlayAgain={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
