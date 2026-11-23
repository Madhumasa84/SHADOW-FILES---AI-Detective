import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Crown,
  Flag,
  Lightbulb,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { chessAudio } from '../chess/chessAudio';
import {
  ELO_PRESETS,
  MAX_ELO,
  MIN_ELO,
  chooseEngineMove,
  clampElo,
  evaluateBoard,
  getEloProfile,
  loadChessRecords,
  saveChessRecord,
} from '../chess/engine';
import {
  applyChessMove,
  computeCapturedAndMaterial,
  createInitialChessState,
  findKingSquare,
  generateLegalMoves,
  replayMoves,
  squareToAlgebraic,
} from '../chess/rules';
import type {
  ChessMove,
  ChessRecords,
  ChessState,
  PieceColor,
  PromotionType,
} from '../chess/types';
import { ChessPieceIcon } from './ChessPieces';
import { NoirImage } from './NoirImage';

export const CHESS_BACKDROP_URL = '/src/assets/images/chess_noir_gambit_1795275910510.jpg';

interface ChessGameProps {
  autoStart?: boolean;
  onSwitchGame: () => void;
}

type SidePreference = 'w' | 'b' | 'random';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function formatEvalLabel(cp: number): string {
  if (Math.abs(cp) >= 90000) {
    return cp > 0 ? '+M' : '-M';
  }
  const pawns = cp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

function evalToWhiteBarPercent(cp: number): number {
  const clamped = Math.max(-900, Math.min(900, cp));
  return Math.round(50 + (clamped / 900) * 44);
}

export function ChessGame({ autoStart = false, onSwitchGame }: ChessGameProps) {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'paused'>(() =>
    autoStart ? 'playing' : 'setup'
  );
  const [selectedElo, setSelectedElo] = useState<number>(1500);
  const [sidePref, setSidePref] = useState<SidePreference>('w');
  const [humanColor, setHumanColor] = useState<PieceColor>('w');
  const [flipped, setFlipped] = useState<boolean>(false);
  const [state, setState] = useState<ChessState>(() => createInitialChessState());
  const [selectedSq, setSelectedSq] = useState<number | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: number; to: number } | null>(null);
  const [hintMove, setHintMove] = useState<{ from: number; to: number } | null>(null);
  const [evalCp, setEvalCp] = useState<number>(0);
  const [engineThinking, setEngineThinking] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => chessAudio.isMuted());
  const [records, setRecords] = useState<ChessRecords>(() => loadChessRecords());

  const moveLogEndRef = useRef<HTMLDivElement | null>(null);
  const recordedGameRef = useRef<boolean>(false);
  const profile = useMemo(() => getEloProfile(selectedElo), [selectedElo]);

  // Mirror state machine to document.body.dataset.state
  useEffect(() => {
    if (phase === 'setup') {
      document.body.dataset.state = 'title';
    } else if (state.status !== 'playing') {
      document.body.dataset.state = 'gameover';
    } else if (phase === 'paused') {
      document.body.dataset.state = 'paused';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [phase, state.status]);

  // Auto-scroll move history
  useEffect(() => {
    moveLogEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [state.history.length]);

  const legalMoves = useMemo(
    () => (state.status === 'playing' ? generateLegalMoves(state) : []),
    [state]
  );

  const selectedDestinations = useMemo(() => {
    if (selectedSq === null) return new Map<number, ChessMove[]>();
    const map = new Map<number, ChessMove[]>();
    for (const m of legalMoves) {
      if (m.from === selectedSq) {
        const list = map.get(m.to) ?? [];
        list.push(m);
        map.set(m.to, list);
      }
    }
    return map;
  }, [legalMoves, selectedSq]);

  const startNewMatch = useCallback(
    (eloOverride?: number, sideOverride?: SidePreference) => {
      const elo = clampElo(eloOverride ?? selectedElo);
      const pref = sideOverride ?? sidePref;
      const resolvedColor: PieceColor =
        pref === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : pref;

      recordedGameRef.current = false;
      setSelectedElo(elo);
      setHumanColor(resolvedColor);
      setFlipped(resolvedColor === 'b');
      setState(createInitialChessState());
      setSelectedSq(null);
      setPendingPromotion(null);
      setHintMove(null);
      setEvalCp(0);
      setEngineThinking(false);
      setPhase('playing');
      chessAudio.playMove();
    },
    [selectedElo, sidePref]
  );

  const commitMove = useCallback(
    (move: ChessMove, evalOverride?: number) => {
      const next = applyChessMove(state, move);
      setState(next);
      setEvalCp(evalOverride !== undefined ? evalOverride : evaluateBoard(next.board));
      if (next.status !== 'playing') {
        chessAudio.playGameOver(next.winner === humanColor);
      } else if (next.inCheck) {
        chessAudio.playCheck();
      } else if (move.captured) {
        chessAudio.playCapture();
      } else {
        chessAudio.playMove();
      }
      setSelectedSq(null);
      setPendingPromotion(null);
      setHintMove(null);
    },
    [state, humanColor]
  );

  // Record finished match outcome once per game
  useEffect(() => {
    if (phase === 'setup' || state.status === 'playing' || recordedGameRef.current) return;
    recordedGameRef.current = true;
    const outcome =
      state.winner === null ? 'draw' : state.winner === humanColor ? 'win' : 'loss';
    setRecords(saveChessRecord(outcome, profile.rating));
  }, [phase, state.status, state.winner, humanColor, profile.rating]);

  // Trigger automated opponent move whenever it's the engine's turn and match is active
  useEffect(() => {
    if (phase !== 'playing' || state.status !== 'playing') {
      setEngineThinking(false);
      return;
    }
    if (state.turn === humanColor) {
      setEngineThinking(false);
      return;
    }

    setEngineThinking(true);
    const delayMs = profile.rating >= 2200 ? 220 : 320;
    const timer = window.setTimeout(() => {
      const result = chooseEngineMove(state, profile.rating);
      setEngineThinking(false);
      if (result) {
        commitMove(result.move, result.evalWhiteCp);
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      setEngineThinking(false);
    };
  }, [phase, state, humanColor, profile.rating, commitMove]);

  const handleToggleMute = useCallback(() => {
    setMuted(chessAudio.toggleMute());
  }, []);

  // Keyboard shortcuts: Esc/P pause (or cancel promotion), M mute, Enter/Space start on setup
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;

      if (phase === 'setup') {
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewMatch();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (pendingPromotion) {
          e.preventDefault();
          setPendingPromotion(null);
          return;
        }
        if (state.status === 'playing') {
          e.preventDefault();
          setPhase((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        }
        return;
      }

      if ((e.key === 'p' || e.key === 'P') && !pendingPromotion && state.status === 'playing') {
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setPhase((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, pendingPromotion, state.status, startNewMatch, handleToggleMute]);

  const handleSquareClick = (sq: number) => {
    if (phase !== 'playing' || state.status !== 'playing' || engineThinking) return;
    if (state.turn !== humanColor) return;

    // Clicking a highlighted destination executes the move (or opens promotion chooser)
    const matchingMoves = selectedDestinations.get(sq);
    if (matchingMoves && matchingMoves.length > 0) {
      if (matchingMoves.some((m) => m.promotion)) {
        setPendingPromotion({ from: matchingMoves[0].from, to: sq });
        return;
      }
      commitMove(matchingMoves[0]);
      return;
    }

    // Selecting one of the human's own pieces
    const piece = state.board[sq];
    if (piece && piece.color === humanColor) {
      setSelectedSq((prev) => (prev === sq ? null : sq));
      return;
    }

    setSelectedSq(null);
  };

  const handlePromotionSelect = (promo: PromotionType) => {
    if (!pendingPromotion) return;
    const match = legalMoves.find(
      (m) =>
        m.from === pendingPromotion.from &&
        m.to === pendingPromotion.to &&
        m.promotion === promo
    );
    if (match) {
      commitMove(match);
    } else {
      setPendingPromotion(null);
    }
  };

  const handleUndo = () => {
    if (engineThinking || state.history.length === 0) return;
    // Undo back to the human's turn (usually 2 plies, or 1 if human just moved / game ended on human move)
    let targetLen = state.history.length - 1;
    while (targetLen > 0) {
      const probe = replayMoves(state.history.slice(0, targetLen));
      if (probe.turn === humanColor) break;
      targetLen--;
    }
    const rewound = replayMoves(state.history.slice(0, targetLen));
    recordedGameRef.current = false;
    setState(rewound);
    setEvalCp(evaluateBoard(rewound.board));
    setSelectedSq(null);
    setPendingPromotion(null);
    setHintMove(null);
    chessAudio.playMove();
  };

  const handleHint = () => {
    if (engineThinking || state.status !== 'playing' || state.turn !== humanColor) return;
    const suggestion = chooseEngineMove(state, 2400);
    if (suggestion) {
      setHintMove({ from: suggestion.move.from, to: suggestion.move.to });
      setSelectedSq(suggestion.move.from);
      chessAudio.playMove();
    }
  };

  const handleResign = () => {
    if (state.status !== 'playing') return;
    const opponentColor: PieceColor = humanColor === 'w' ? 'b' : 'w';
    setState((prev) => ({
      ...prev,
      status: 'resigned',
      winner: opponentColor,
    }));
    chessAudio.playGameOver(false);
  };

  // SETUP / RATING SELECTION SCREEN
  if (phase === 'setup') {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0B0D11] text-[#F2ECDC] flex flex-col select-none">
        <div className="fixed inset-0 z-0">
          <NoirImage
            src={CHESS_BACKDROP_URL}
            alt="Carved obsidian and brushed brass Staunton chess set illuminated by an amber lamp beside a rainy midnight skyline"
            className="h-full w-full object-cover object-center opacity-80"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#090B10]/96 via-[#0B0D12]/86 to-[#0B0D12]/35"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#090B10] via-transparent to-[#090B10]/70"
          />
        </div>

        <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1320px] flex-col justify-between px-6 py-6 sm:px-12 sm:py-9">
          {/* Top quiet nav */}
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
              {records.gamesPlayed > 0
                ? `${records.wins}W · ${records.draws}D · ${records.losses}L${
                    records.highestEloBeaten ? ` · BEST WIN ${records.highestEloBeaten} ELO` : ''
                  }`
                : 'AUTOMATED ELO 500–3000 · OFFLINE ENGINE'}
            </div>
          </div>

          {/* Left-anchored setup column */}
          <div className="my-auto max-w-xl py-6">
            <div className="font-mono-tabular text-xs tracking-[0.22em] text-[#D99B38]">
              AUTOMATED NOIR CHESS · ELO 500 TO 3000
            </div>
            <h1 className="mt-2 font-display text-4xl sm:text-6xl font-bold tracking-tight text-[#F4EFE4]">
              MIDNIGHT GAMBIT
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-[#C7C0B0] leading-relaxed">
              Dial in your opponent&apos;s exact automated strength from a 500-rated street novice to
              a ruthless 3000 Elo calculation engine.
            </p>

            {/* Automated Elo Rating Chooser (500 to 3000) */}
            <div className="mt-6 rounded-lg border border-[#2A3345] bg-[#11151E]/92 p-5 shadow-2xl">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono-tabular tracking-[0.16em] text-[#98A2B3]">
                    AUTOMATED OPPONENT RATING
                  </div>
                  <div className="mt-1 flex items-baseline gap-2.5">
                    <span
                      data-testid="selected-elo-readout"
                      className="font-display text-3xl sm:text-4xl font-bold text-[#EBB556] font-mono-tabular"
                    >
                      {profile.rating}
                    </span>
                    <span className="font-mono-tabular text-xs text-[#9AA4B6]">ELO</span>
                    <span className="text-sm font-medium text-[#F4EFE4]">
                      · {profile.title}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-mono-tabular text-[#8D97A8]">OPPONENT</div>
                  <div className="text-xs font-semibold text-[#E6E0D3]">{profile.persona}</div>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="chess-elo-slider" className="sr-only">
                  Choose automated opponent Elo rating from 500 to 3000
                </label>
                <input
                  id="chess-elo-slider"
                  type="range"
                  min={MIN_ELO}
                  max={MAX_ELO}
                  step={50}
                  value={selectedElo}
                  onChange={(e) => setSelectedElo(clampElo(Number(e.target.value)))}
                  className="w-full accent-[#D99B38] cursor-pointer"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono-tabular text-[#8D97A8]">
                  <span>500</span>
                  <span>1250</span>
                  <span>2000</span>
                  <span>3000</span>
                </div>
              </div>

              {/* 6 Quick Rating Presets */}
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {ELO_PRESETS.map((preset) => {
                  const active = profile.rating === preset.rating;
                  return (
                    <button
                      key={preset.rating}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedElo(preset.rating)}
                      className={`rounded border px-2 py-2 text-center transition-colors cursor-pointer ${
                        active
                          ? 'border-[#D99B38] bg-[#221D14] text-[#F4EFE4]'
                          : 'border-[#252E3F] bg-[#0D1118] text-[#AAB4C6] hover:border-[#42506A] hover:text-[#F4EFE4]'
                      }`}
                    >
                      <div className="font-mono-tabular text-xs font-bold">{preset.rating}</div>
                      <div className="text-[10px] text-[#8E98A9] truncate">{preset.label}</div>
                    </button>
                  );
                })}
              </div>

              <p className="mt-3.5 text-xs text-[#AEB7C7] leading-relaxed">{profile.summary}</p>

              {/* Side Chooser */}
              <div className="mt-4 border-t border-[#222A3A] pt-4">
                <div className="mb-2 text-[11px] font-mono-tabular tracking-[0.14em] text-[#98A2B3]">
                  PLAY AS
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'w', label: 'White (First)' },
                      { id: 'b', label: 'Black' },
                      { id: 'random', label: 'Random' },
                    ] as const
                  ).map((opt) => {
                    const active = sidePref === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSidePref(opt.id)}
                        className={`rounded border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#D99B38] bg-[#221D14] text-[#F4EFE4]'
                            : 'border-[#252E3F] bg-[#0D1118] text-[#B4BECE] hover:border-[#42506A]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                data-start="true"
                onClick={() => startNewMatch()}
                className="inline-flex items-center gap-2.5 rounded-md bg-[#D99B38] px-6 py-3.5 text-sm font-semibold text-[#0C0E12] shadow-lg transition-transform duration-150 hover:bg-[#EBB556] active:scale-[0.98] whitespace-nowrap cursor-pointer"
              >
                <Crown className="h-4 w-4" aria-hidden="true" />
                <span>Start Match ({profile.rating} Elo)</span>
              </button>

              <button
                type="button"
                onClick={onSwitchGame}
                className="inline-flex items-center rounded-md border border-[#354054] bg-[#131720]/90 px-5 py-3.5 text-sm font-medium text-[#ECE6D8] transition-colors hover:border-[#D99B38]/60 hover:bg-[#1B202C] whitespace-nowrap cursor-pointer"
              >
                Back to Game Select
              </button>
            </div>
          </div>

          <div className="border-t border-[#202634] pt-4 text-xs text-[#9AA4B6] flex flex-wrap items-center justify-between gap-2">
            <span>Full FIDE rules · Castling, En Passant, Promotion, Undo &amp; Tactical Hints</span>
            <span className="font-mono-tabular text-[#828B9C]">100% Local Engine · Zero API Keys</span>
          </div>
        </main>
      </div>
    );
  }

  // ACTIVE CHESS MATCH WORKSPACE
  const lastMove = state.history.length > 0 ? state.history[state.history.length - 1] : null;
  const checkedKingSq = state.inCheck ? findKingSquare(state.board, state.turn) : -1;
  const { capturedByWhite, capturedByBlack, whiteAdvantage } = computeCapturedAndMaterial(
    state.history
  );

  const opponentColor: PieceColor = humanColor === 'w' ? 'b' : 'w';
  const opponentCaptured = opponentColor === 'w' ? capturedByWhite : capturedByBlack;
  const humanCaptured = humanColor === 'w' ? capturedByWhite : capturedByBlack;
  const opponentLead = opponentColor === 'w' ? whiteAdvantage : -whiteAdvantage;
  const humanLead = humanColor === 'w' ? whiteAdvantage : -whiteAdvantage;

  const whiteBarPct = evalToWhiteBarPercent(evalCp);
  const displayRows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const displayCols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const movePairs: Array<{ moveNumber: number; white?: ChessMove; black?: ChessMove }> = [];
  for (let i = 0; i < state.history.length; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: state.history[i],
      black: state.history[i + 1],
    });
  }

  const gameOverHeadline =
    state.status === 'checkmate'
      ? state.winner === humanColor
        ? `Checkmate — You Beat ${profile.rating} Elo`
        : `Checkmate — ${profile.persona} Wins`
      : state.status === 'resigned'
      ? `Resigned — ${profile.persona} Wins`
      : state.status === 'stalemate'
      ? 'Draw by Stalemate'
      : state.status === 'draw_repetition'
      ? 'Draw by Threefold Repetition'
      : state.status === 'draw_fifty'
      ? 'Draw by 50-Move Rule'
      : 'Draw by Insufficient Material';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0B0D11] text-[#F2ECDC] select-none">
      {/* Compact Noir Top Bar */}
      <header className="flex items-center justify-between gap-3 border-b border-[#1E2432] bg-[#10141C] px-4 py-2.5 sm:px-6 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onSwitchGame}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B8C2D4] hover:text-[#F4EFE4] transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Switch Game</span>
          </button>

          <div className="h-4 w-px bg-[#252D3D]" aria-hidden="true" />

          <div className="min-w-0">
            <span className="font-display text-base sm:text-lg font-bold text-[#F4EFE4]">
              MIDNIGHT GAMBIT
            </span>
            <span className="ml-2.5 hidden md:inline font-mono-tabular text-xs text-[#D99B38]">
              VS {profile.persona.toUpperCase()} ({profile.rating} ELO)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="inline-flex items-center gap-1.5 rounded border border-[#2C3547] bg-[#151A24] px-3 py-1.5 text-xs font-medium text-[#E6E0D3] hover:border-[#D99B38]/65 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#D99B38]" aria-hidden="true" />
            <span>Rating ({profile.rating})</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Unmute chess audio' : 'Mute chess audio'}
            title="Toggle Audio [M]"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#2C3547] bg-[#151A24] text-[#C8D0DE] hover:border-[#D99B38]/65 transition-colors cursor-pointer"
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5 text-[#8D97A8]" aria-hidden="true" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-[#D99B38]" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPhase('paused')}
            disabled={state.status !== 'playing'}
            aria-label="Pause chess match"
            title="Pause [Esc / P]"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#2C3547] bg-[#151A24] text-[#C8D0DE] hover:border-[#D99B38]/65 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Main 2-Column Workspace */}
      <main className="mx-auto flex w-full max-w-[1320px] flex-1 min-h-0 flex-col lg:flex-row items-center lg:items-stretch justify-center gap-4 lg:gap-7 p-3 sm:p-5 overflow-y-auto lg:overflow-hidden">
        {/* Left / Center: Eval Bar + 8x8 Chessboard */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 shrink-0">
          {/* Vertical Centipawn Evaluation Bar */}
          <div
            className="hidden sm:flex flex-col items-center justify-between h-[min(76vh,640px)] w-6 rounded overflow-hidden border border-[#283142] bg-[#171B24] relative"
            aria-label={`Position evaluation ${formatEvalLabel(evalCp)}`}
          >
            <div
              className="w-full bg-[#ECE5D7] transition-all duration-300"
              style={{
                height: `${flipped ? whiteBarPct : 100 - whiteBarPct}%`,
                backgroundColor: flipped ? '#ECE5D7' : '#181C26',
              }}
            />
            <div
              className="w-full flex-1 transition-all duration-300"
              style={{
                backgroundColor: flipped ? '#181C26' : '#ECE5D7',
              }}
            />
            <span className="pointer-events-none absolute top-1.5 font-mono-tabular text-[9px] font-bold text-[#D99B38]">
              {formatEvalLabel(evalCp)}
            </span>
          </div>

          {/* Framed 8x8 Walnut & Parchment Board */}
          <div className="rounded-lg border-2 border-[#2A3345] bg-[#151923] p-2 sm:p-2.5 shadow-2xl">
            <div
              data-testid="chess-board"
              data-elo={profile.rating}
              data-turn={state.turn}
              data-status={state.status}
              data-moves={state.history.length}
              className="grid grid-cols-8 grid-rows-8 h-[min(78vw,74vh,640px)] w-[min(78vw,74vh,640px)] overflow-hidden rounded-sm border border-[#1A1510]"
            >
              {displayRows.map((row, visualRowIdx) =>
                displayCols.map((col, visualColIdx) => {
                  const sq = (row << 3) | col;
                  const alg = squareToAlgebraic(sq);
                  const piece = state.board[sq];
                  const isLight = (row + col) % 2 === 0;
                  const isSelected = selectedSq === sq;
                  const isLastFrom = lastMove?.from === sq;
                  const isLastTo = lastMove?.to === sq;
                  const isHint = hintMove?.from === sq || hintMove?.to === sq;
                  const isKingChecked = checkedKingSq === sq;
                  const destMoves = selectedDestinations.get(sq);
                  const isLegalDest = Boolean(destMoves && destMoves.length > 0);
                  const isCaptureDest = Boolean(
                    isLegalDest && (piece !== null || destMoves?.some((m) => m.isEnPassant))
                  );

                  let bgColor = isLight ? '#CBB99B' : '#4C3A2C';
                  if (isLastFrom || isLastTo) {
                    bgColor = isLight ? '#D4B66A' : '#85652B';
                  }
                  if (isHint) {
                    bgColor = isLight ? '#8DB8D8' : '#325A7A';
                  }
                  if (isSelected) {
                    bgColor = isLight ? '#E0BC5F' : '#A67A27';
                  }

                  const coordColor = isLight ? '#5A4634' : '#C9B89C';

                  return (
                    <button
                      key={sq}
                      type="button"
                      data-square={alg}
                      onClick={() => handleSquareClick(sq)}
                      aria-label={`Square ${alg}${
                        piece
                          ? `, ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type.toUpperCase()}`
                          : ''
                      }${isLegalDest ? ', legal move' : ''}`}
                      style={{ backgroundColor: bgColor }}
                      className="relative flex items-center justify-center p-1 sm:p-1.5 transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F5C45E] cursor-pointer"
                    >
                      {/* Check Crimson Halo */}
                      {isKingChecked && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(232,58,58,0.85)_0%,rgba(190,26,26,0.35)_62%,transparent_100%)]"
                        />
                      )}

                      {/* Rank coordinate on left edge */}
                      {visualColIdx === 0 && (
                        <span
                          aria-hidden="true"
                          style={{ color: coordColor }}
                          className="pointer-events-none absolute left-1 top-0.5 font-mono-tabular text-[10px] font-bold leading-none opacity-85"
                        >
                          {8 - row}
                        </span>
                      )}

                      {/* File coordinate on bottom edge */}
                      {visualRowIdx === 7 && (
                        <span
                          aria-hidden="true"
                          style={{ color: coordColor }}
                          className="pointer-events-none absolute bottom-0.5 right-1 font-mono-tabular text-[10px] font-bold leading-none opacity-85"
                        >
                          {FILES[col]}
                        </span>
                      )}

                      {/* Piece SVG */}
                      {piece && (
                        <span className="relative z-10 h-full w-full pointer-events-none">
                          <ChessPieceIcon type={piece.type} color={piece.color} />
                        </span>
                      )}

                      {/* Legal quiet-move dot */}
                      {isLegalDest && !isCaptureDest && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute z-20 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-[#0C0E12]/42 ring-1 ring-[#F4EFE4]/35"
                        />
                      )}

                      {/* Legal capture corner ring */}
                      {isCaptureDest && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-1 z-20 rounded-full border-[3px] border-[#0C0E12]/55 ring-1 ring-[#F5C45E]/70"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Tactical Panel: Opponent, Moves, Player & Controls */}
        <aside className="flex w-full max-w-[640px] lg:w-[340px] flex-col justify-between gap-3 rounded-lg border border-[#222A3A] bg-[#12161F] p-4 min-h-0">
          {/* Top: Automated Opponent Dossier */}
          <div className="rounded-md border border-[#252E3F] bg-[#0E121A] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      opponentColor === 'w'
                        ? 'bg-[#F5EFE2] border border-[#8E7A56]'
                        : 'bg-[#1D2330] border border-[#D99B38]'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-display text-sm font-bold text-[#F4EFE4]">
                    {profile.persona}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#9AA4B6]">{profile.title}</div>
              </div>

              <div className="text-right">
                <div className="font-mono-tabular text-base font-bold text-[#EBB556]">
                  {profile.rating}
                </div>
                <div className="font-mono-tabular text-[10px] text-[#8E98A9]">
                  {engineThinking ? 'THINKING…' : 'ELO RATING'}
                </div>
              </div>
            </div>

            {/* Opponent Captured Pieces */}
            <div className="mt-2.5 flex min-h-[20px] items-center justify-between gap-2 border-t border-[#1D2433] pt-2">
              <div className="flex flex-wrap items-center gap-0.5">
                {opponentCaptured.length === 0 ? (
                  <span className="text-[11px] text-[#697385]">No captures</span>
                ) : (
                  opponentCaptured.map((pt, idx) => (
                    <span key={`${pt}-${idx}`} className="h-4 w-4">
                      <ChessPieceIcon type={pt} color={humanColor} />
                    </span>
                  ))
                )}
              </div>
              {opponentLead > 0 && (
                <span className="font-mono-tabular text-xs font-semibold text-[#D99B38]">
                  +{opponentLead}
                </span>
              )}
            </div>
          </div>

          {/* Middle: Scrollable Algebraic Move Log */}
          <div className="flex flex-1 flex-col min-h-[140px] lg:min-h-0 rounded-md border border-[#202838] bg-[#0D1017] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1D2433] px-3.5 py-2 text-[11px] font-mono-tabular text-[#8E98A9]">
              <span>MOVE SHEET (SAN)</span>
              <span>
                {state.status !== 'playing'
                  ? 'FINAL'
                  : state.inCheck
                  ? 'CHECK!'
                  : state.turn === humanColor
                  ? 'YOUR TURN'
                  : 'OPPONENT TURN'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 font-mono-tabular text-xs space-y-1">
              {movePairs.length === 0 ? (
                <p className="py-6 text-center text-[#6F798B]">
                  {humanColor === 'w'
                    ? 'Select any White piece to open the game.'
                    : 'Opponent is preparing the opening move…'}
                </p>
              ) : (
                movePairs.map((pair) => (
                  <div
                    key={pair.moveNumber}
                    className="grid grid-cols-[36px_1fr_1fr] items-center rounded px-1.5 py-1 odd:bg-[#131823]/70"
                  >
                    <span className="text-[#727C8E]">{pair.moveNumber}.</span>
                    <span className="text-[#F2ECDC] font-medium">{pair.white?.san ?? ''}</span>
                    <span className="text-[#C5CCD8] font-medium">{pair.black?.san ?? ''}</span>
                  </div>
                ))
              )}
              <div ref={moveLogEndRef} />
            </div>
          </div>

          {/* Bottom: Human Player Card + Tactical Controls */}
          <div className="space-y-3">
            <div className="rounded-md border border-[#252E3F] bg-[#0E121A] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      humanColor === 'w'
                        ? 'bg-[#F5EFE2] border border-[#8E7A56]'
                        : 'bg-[#1D2330] border border-[#D99B38]'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-display text-sm font-bold text-[#F4EFE4]">
                    You ({humanColor === 'w' ? 'White' : 'Black'})
                  </span>
                </div>
                {state.turn === humanColor && state.status === 'playing' && (
                  <span className="font-mono-tabular text-[10px] font-semibold text-[#EBB556]">
                    {state.inCheck ? 'IN CHECK' : 'TO MOVE'}
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex min-h-[20px] items-center justify-between gap-2 border-t border-[#1D2433] pt-2">
                <div className="flex flex-wrap items-center gap-0.5">
                  {humanCaptured.length === 0 ? (
                    <span className="text-[11px] text-[#697385]">No captures</span>
                  ) : (
                    humanCaptured.map((pt, idx) => (
                      <span key={`${pt}-${idx}`} className="h-4 w-4">
                        <ChessPieceIcon type={pt} color={opponentColor} />
                      </span>
                    ))
                  )}
                </div>
                {humanLead > 0 && (
                  <span className="font-mono-tabular text-xs font-semibold text-[#D99B38]">
                    +{humanLead}
                  </span>
                )}
              </div>
            </div>

            {/* Compact Action Buttons */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={engineThinking || state.history.length === 0}
                className="flex flex-col items-center justify-center gap-1 rounded border border-[#283142] bg-[#151A24] py-2 text-[11px] text-[#D8DFEC] hover:border-[#D99B38]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={handleHint}
                disabled={engineThinking || state.status !== 'playing' || state.turn !== humanColor}
                className="flex flex-col items-center justify-center gap-1 rounded border border-[#283142] bg-[#151A24] py-2 text-[11px] text-[#D8DFEC] hover:border-[#D99B38]/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Lightbulb className="h-3.5 w-3.5 text-[#EBB556]" aria-hidden="true" />
                <span>Hint</span>
              </button>

              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="flex flex-col items-center justify-center gap-1 rounded border border-[#283142] bg-[#151A24] py-2 text-[11px] text-[#D8DFEC] hover:border-[#D99B38]/60 transition-colors cursor-pointer"
              >
                <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Flip</span>
              </button>

              <button
                type="button"
                onClick={state.status === 'playing' ? handleResign : () => startNewMatch()}
                className="flex flex-col items-center justify-center gap-1 rounded border border-[#283142] bg-[#151A24] py-2 text-[11px] text-[#D8DFEC] hover:border-[#D99B38]/60 transition-colors cursor-pointer"
              >
                {state.status === 'playing' ? (
                  <>
                    <Flag className="h-3.5 w-3.5 text-[#E06868]" aria-hidden="true" />
                    <span>Resign</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 text-[#EBB556]" aria-hidden="true" />
                    <span>Rematch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Pawn Promotion Picker Modal */}
      {pendingPromotion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="promotion-dialog-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/80 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-[#2E384B] bg-[#12161F] p-5 shadow-2xl">
            <div className="font-mono-tabular text-[11px] tracking-[0.18em] text-[#D99B38]">
              PAWN PROMOTION
            </div>
            <h2 id="promotion-dialog-title" className="mt-1 font-display text-xl font-bold text-[#F4EFE4]">
              Choose Promotion Piece
            </h2>
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              {(['q', 'r', 'b', 'n'] as PromotionType[]).map((promo) => (
                <button
                  key={promo}
                  type="button"
                  onClick={() => handlePromotionSelect(promo)}
                  aria-label={`Promote to ${
                    promo === 'q' ? 'Queen' : promo === 'r' ? 'Rook' : promo === 'b' ? 'Bishop' : 'Knight'
                  }`}
                  className="flex flex-col items-center gap-1.5 rounded-md border border-[#2B3446] bg-[#171C27] p-3 hover:border-[#D99B38] transition-colors cursor-pointer"
                >
                  <span className="h-11 w-11">
                    <ChessPieceIcon type={promo} color={humanColor} />
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[#D4DBE8]">
                    {promo === 'q' ? 'Queen' : promo === 'r' ? 'Rook' : promo === 'b' ? 'Bishop' : 'Knight'}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPendingPromotion(null)}
              className="mt-3 w-full rounded border border-[#283040] bg-[#10141C] py-2 text-xs font-medium text-[#9AA4B6] hover:text-[#F4EFE4] transition-colors cursor-pointer"
            >
              Cancel [Esc]
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {phase === 'paused' && state.status === 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chess-pause-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/80 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#2E384B] bg-[#12161F] p-6 shadow-2xl">
            <div className="font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              MIDNIGHT GAMBIT · PAUSED
            </div>
            <h2 id="chess-pause-title" className="mt-1 font-display text-2xl font-bold text-[#F4EFE4]">
              Match Paused
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-3 border-y border-[#222A3A] py-4 text-center">
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">OPPONENT</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#EBB556]">
                  {profile.rating}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">MOVES</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {Math.ceil(state.history.length / 2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">EVAL</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {formatEvalLabel(evalCp)}
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
                <span>Resume Match</span>
              </button>

              <button
                type="button"
                onClick={() => startNewMatch()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#323C4F] bg-[#171C27] px-4 py-2.5 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Restart Match</span>
              </button>

              <button
                type="button"
                onClick={() => setPhase('setup')}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#323C4F] bg-[#171C27] px-4 py-2.5 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span>Change Opponent Elo (500–3000)</span>
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

      {/* Match Over Summary Modal */}
      {state.status !== 'playing' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chess-gameover-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/82 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#2E384B] bg-[#12161F] p-6 shadow-2xl">
            <div className="flex items-center gap-2 font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>MATCH CONCLUDED · {profile.rating} ELO</span>
            </div>
            <h2
              id="chess-gameover-title"
              className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-[#F4EFE4]"
            >
              {gameOverHeadline}
            </h2>

            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#222A3A] py-4 text-center">
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">OPPONENT</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#EBB556]">
                  {profile.rating}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">MOVES</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {Math.ceil(state.history.length / 2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular text-[#8D97A8]">BEST WIN</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-[#F4EFE4]">
                  {records.highestEloBeaten ?? '—'}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => startNewMatch()}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#D99B38] px-4 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Rematch ({profile.rating} Elo)</span>
              </button>

              <button
                type="button"
                onClick={() => setPhase('setup')}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#323C4F] bg-[#171C27] px-4 py-2.5 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span>Change Opponent Elo (500–3000)</span>
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
    </div>
  );
}
