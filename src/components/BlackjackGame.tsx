import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Coins,
  Pause,
  Play,
  RotateCcw,
  Spade,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  addChipToBet,
  canDoubleDown,
  canSplitHand,
  clearPendingBet,
  createInitialBlackjackState,
  dealNewHand,
  doubleDownActiveHand,
  evaluateHand,
  hitActiveHand,
  loadBlackjackRecords,
  prepareNextBettingRound,
  rebuyBankroll,
  saveBlackjackSettlement,
  setAllInBet,
  splitActiveHand,
  standActiveHand,
  type BlackjackRecords,
  type BlackjackState,
  type PlayingCard,
  type Suit,
} from '../blackjack/engine';
import { NoirImage } from './NoirImage';

export const BLACKJACK_BACKDROP_URL =
  '/src/assets/images/game_blackjack_velvet_table_1795285257735.jpg';

interface BlackjackGameProps {
  autoStart?: boolean;
  onSwitchGame: () => void;
}

type BlackjackPhase = 'title' | 'playing' | 'paused';

const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

function playBlackjackAudio(muted: boolean, kind: 'chip' | 'deal' | 'win' | 'lose'): void {
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

    if (kind === 'chip') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.045);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (kind === 'deal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (kind === 'win') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.07);
      osc.frequency.setValueAtTime(659, now + 0.14);
      gain.gain.setValueAtTime(0.085, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(185, now);
      osc.frequency.exponentialRampToValueAtTime(98, now + 0.24);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    }
    setTimeout(() => ctx.close().catch(() => {}), 360);
  } catch {
    // Ignore autoplay errors
  }
}

function CardView({ card, faceDown = false, compact = false, index = 0 }: { card: PlayingCard; faceDown?: boolean; compact?: boolean; index?: number }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const glyph = SUIT_GLYPH[card.suit];
  const overlap = index > 0 ? (compact ? '-22px' : '10px') : '0px';

  if (faceDown) {
    return (
      <div
        aria-label="Face-down dealer card"
        className="relative flex h-[126px] w-[88px] sm:h-[144px] sm:w-[100px] shrink-0 items-center justify-center rounded-lg border border-[#D99B38]/65 bg-[#121722] shadow-2xl"
        style={{ marginLeft: overlap }}
      >
        <div className="flex h-[calc(100%-12px)] w-[calc(100%-12px)] items-center justify-center rounded border border-[#D99B38]/40 bg-[#171E2C]">
          <svg viewBox="0 0 40 56" className="h-10 w-8" aria-hidden="true">
            <rect x="4" y="4" width="32" height="48" rx="2" fill="none" stroke="#D99B38" strokeWidth="1.2" strokeOpacity="0.55" />
            <polygon points="20,12 30,28 20,44 10,28" fill="none" stroke="#D99B38" strokeWidth="1.4" />
            <circle cx="20" cy="28" r="3" fill="#D99B38" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label={`${card.rank} of ${card.suit}`}
      className="relative flex h-[126px] w-[88px] sm:h-[144px] sm:w-[100px] shrink-0 flex-col justify-between rounded-lg border border-[#D5CCB8] bg-[#F7F3E9] p-2 sm:p-2.5 shadow-2xl select-none"
      style={{
        marginLeft: overlap,
        color: isRed ? '#B82626' : '#141821',
      }}
    >
      <div className="flex flex-col items-start leading-none">
        <span className="font-mono-tabular text-base sm:text-lg font-bold tracking-tight">
          {card.rank}
        </span>
        <span className="text-sm sm:text-base leading-none">{glyph}</span>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="text-3xl sm:text-4xl opacity-90">{glyph}</span>
      </div>

      <div className="flex flex-col items-end leading-none rotate-180">
        <span className="font-mono-tabular text-base sm:text-lg font-bold tracking-tight">
          {card.rank}
        </span>
        <span className="text-sm sm:text-base leading-none">{glyph}</span>
      </div>
    </div>
  );
}

const CHIPS = [
  { value: 10, bg: '#2B3A52', ring: '#7CA3D9' },
  { value: 25, bg: '#1D4D3B', ring: '#5CC99A' },
  { value: 100, bg: '#1A1E28', ring: '#D99B38' },
  { value: 500, bg: '#5B222A', ring: '#E87373' },
];

export function BlackjackGame({ autoStart = false, onSwitchGame }: BlackjackGameProps) {
  const [phase, setPhase] = useState<BlackjackPhase>(() => (autoStart ? 'playing' : 'title'));
  const [state, setState] = useState<BlackjackState>(() => createInitialBlackjackState(1000));
  const [records, setRecords] = useState<BlackjackRecords>(() => loadBlackjackRecords());
  const [muted, setMuted] = useState<boolean>(false);

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const applySettlementCheck = useCallback(
    (next: BlackjackState) => {
      if (next.stage === 'settled') {
        const updated = saveBlackjackSettlement(next);
        setRecords(updated);
        playBlackjackAudio(muted, next.roundNetDelta >= 0 ? 'win' : 'lose');
      }
      return next;
    },
    [muted]
  );

  const enterTable = useCallback(() => {
    document.body.dataset.state = 'playing';
    setPhase('playing');
  }, []);

  const handleAddChip = useCallback(
    (amount: number) => {
      playBlackjackAudio(muted, 'chip');
      setState((prev) => addChipToBet(prev, amount));
    },
    [muted]
  );

  const handleDeal = useCallback(() => {
    playBlackjackAudio(muted, 'deal');
    setState((prev) => applySettlementCheck(dealNewHand(prev)));
  }, [muted, applySettlementCheck]);

  const handleHit = useCallback(() => {
    playBlackjackAudio(muted, 'deal');
    setState((prev) => applySettlementCheck(hitActiveHand(prev)));
  }, [muted, applySettlementCheck]);

  const handleStand = useCallback(() => {
    setState((prev) => applySettlementCheck(standActiveHand(prev)));
  }, [applySettlementCheck]);

  const handleDouble = useCallback(() => {
    playBlackjackAudio(muted, 'chip');
    setState((prev) => applySettlementCheck(doubleDownActiveHand(prev)));
  }, [muted, applySettlementCheck]);

  const handleSplit = useCallback(() => {
    playBlackjackAudio(muted, 'chip');
    setState((prev) => splitActiveHand(prev));
  }, [muted]);

  const handleNextRound = useCallback(() => {
    setState((prev) => prepareNextBettingRound(prev));
  }, []);

  const handleDealSameBet = useCallback(() => {
    playBlackjackAudio(muted, 'deal');
    setState((prev) => {
      const prepared = prepareNextBettingRound(prev);
      if (prepared.pendingBet <= 0) return prepared;
      return applySettlementCheck(dealNewHand(prepared));
    });
  }, [muted, applySettlementCheck]);

  const handleResetSession = useCallback(() => {
    setState(createInitialBlackjackState(1000));
    setPhase('playing');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          enterTable();
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

      if (phase !== 'playing') return;

      if (state.stage === 'betting' && (e.key === 'Enter' || e.key === ' ')) {
        if (state.pendingBet > 0) {
          e.preventDefault();
          handleDeal();
        }
      } else if (state.stage === 'player-turn') {
        if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          handleHit();
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleStand();
        } else if ((e.key === 'd' || e.key === 'D') && canDoubleDown(state)) {
          e.preventDefault();
          handleDouble();
        }
      } else if (state.stage === 'settled' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (state.bankroll > 0) handleNextRound();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, state, enterTable, handleDeal, handleHit, handleStand, handleDouble, handleNextRound]);

  if (phase === 'title') {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#0B0D11] text-[#F2ECDC] select-none">
        <div className="absolute inset-0">
          <NoirImage
            src={BLACKJACK_BACKDROP_URL}
            alt="Luxury dark emerald felt blackjack table with obsidian and gold casino chips under a brass lamp"
            className="h-full w-full object-cover object-center opacity-85"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#090B10]/96 via-[#0B0D12]/84 to-[#0B0D12]/25"
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
              PEAK BANKROLL ${records.peakBankroll.toLocaleString()} · {records.handsWon} HANDS WON
            </div>
          </div>

          <div className="max-w-xl my-auto">
            <svg
              viewBox="0 0 460 106"
              className="w-full max-w-[430px] h-auto mb-3"
              role="img"
              aria-label="VELVET 21 — High-Stakes Noir Blackjack"
            >
              <g transform="translate(4, 8)" stroke="#D99B38" strokeWidth="1.5" fill="none">
                <rect x="0" y="2" width="18" height="24" rx="2" />
                <rect x="12" y="6" width="18" height="24" rx="2" fill="#0B0D11" />
                <text x="17" y="22" fill="#D99B38" stroke="none" fontSize="12" fontFamily="serif">
                  ♠
                </text>
              </g>
              <text
                x="46"
                y="22"
                fill="#D99B38"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="11"
                letterSpacing="3.2"
                fontWeight="500"
              >
                6-DECK NOIR CASINO TABLE
              </text>
              <text
                x="2"
                y="90"
                fill="#F4EFE4"
                fontFamily="Fraunces, Georgia, serif"
                fontSize="60"
                fontWeight="700"
                letterSpacing="-1"
              >
                VELVET 21
              </text>
              <line x1="4" y1="103" x2="390" y2="103" stroke="#2D3647" strokeWidth="1.2" />
            </svg>
            <p className="mb-5 text-sm sm:text-base text-[#C7C0B0] leading-relaxed max-w-md">
              Blackjack pays 3:2. Hit, stand, double down, or split pairs against the house.
            </p>

            <div className="mb-6 grid grid-cols-3 gap-3 max-w-md border-y border-[#232A38] py-3.5 text-xs font-mono-tabular">
              <div>
                <div className="text-[#8E98AA]">STARTING STACK</div>
                <div className="mt-1 text-base font-bold text-[#EBB556]">$1,000</div>
              </div>
              <div>
                <div className="text-[#8E98AA]">BLACKJACK PAYS</div>
                <div className="mt-1 text-base font-bold text-[#F4EFE4]">3 : 2</div>
              </div>
              <div>
                <div className="text-[#8E98AA]">DEALER RULE</div>
                <div className="mt-1 text-base font-bold text-[#F4EFE4]">STANDS 17</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                data-start="true"
                onClick={enterTable}
                className="inline-flex items-center gap-2.5 rounded-md bg-[#D99B38] px-6 py-3.5 text-sm font-semibold text-[#0C0E12] shadow-lg transition-transform duration-150 hover:bg-[#EBB556] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Spade className="h-4 w-4" aria-hidden="true" />
                <span>Take Your Seat</span>
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
              H Hit · S Stand · D Double Down · Enter Deal / Next Hand · Esc Pause
            </p>
            <p className="hidden sm:block text-[#828B9C]">Press Enter or Space to sit down</p>
          </div>
        </main>
      </div>
    );
  }

  const dealerVisibleCards = state.dealerRevealed
    ? state.dealerCards
    : state.dealerCards.slice(0, 1);
  const dealerEval = evaluateHand(dealerVisibleCards);
  const activeHand = state.hands[state.activeHandIndex];
  const allowDouble = canDoubleDown(state);
  const allowSplit = canSplitHand(state);

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0A1310] text-[#F2ECDC] select-none"
      data-testid="blackjack-table"
      data-bankroll={state.bankroll}
      data-stage={state.stage}
    >
      {/* Top Perimeter Dock */}
      <header className="z-20 flex items-center justify-between gap-4 border-b border-[#1E332B] bg-[#0B1612] px-4 py-2.5 sm:px-8">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={onSwitchGame}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A9B8B2] hover:text-[#F4EFE4] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Hub</span>
          </button>
          <div className="h-4 w-px bg-[#20382F]" aria-hidden="true" />
          <span className="font-display text-base sm:text-lg font-bold text-[#F4EFE4] whitespace-nowrap">
            VELVET 21
          </span>
          <span className="hidden md:inline text-xs font-mono-tabular text-[#89A096]">
            6-Deck Shoe · {state.shoe.length} Cards Left
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono-tabular tracking-[0.16em] text-[#89A096]">
              BANKROLL
            </span>
            <span className="font-mono-tabular text-lg sm:text-xl font-bold text-[#EBB556]">
              ${state.bankroll.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#243E34] bg-[#10201A] text-[#C8D5D0] hover:border-[#D99B38]/65 cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4 text-[#D99B38]" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setPhase('paused')}
              aria-label="Pause Blackjack"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#243E34] bg-[#10201A] text-[#C8D5D0] hover:border-[#D99B38]/65 cursor-pointer"
            >
              <Pause className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Felt Casino Table Surface */}
      <main
        className="relative flex flex-1 flex-col justify-between overflow-y-auto px-4 py-5 sm:px-10 sm:py-6"
        style={{
          background:
            'radial-gradient(ellipse at 50% 25%, #16362A 0%, #0E241C 56%, #081410 100%)',
        }}
      >
        {/* Subtle Gold Table Arc Rule Inscription */}
        <div
          aria-hidden="true"
          className="pointer-events-none mx-auto mb-1 text-center font-mono-tabular text-[11px] tracking-[0.26em] text-[#D99B38]/45"
        >
          BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON ALL 17s
        </div>

        {/* Dealer Hand Zone */}
        <section className="flex flex-col items-center justify-center min-h-[168px]">
          <div className="mb-2.5 flex items-center gap-3 text-xs font-mono-tabular text-[#B6C7C0]">
            <span className="tracking-[0.18em]">DEALER</span>
            {state.dealerCards.length > 0 && (
              <span className="font-semibold text-[#F4EFE4]">
                {state.dealerRevealed
                  ? `${dealerEval.total}${dealerEval.isBust ? ' BUST' : ''}`
                  : `${dealerEval.total} + ?`}
              </span>
            )}
          </div>

          {state.dealerCards.length > 0 ? (
            <div className="flex items-center justify-center">
              {state.dealerCards.map((card, idx) => (
                <CardView
                  key={card.id}
                  card={card}
                  index={idx}
                  compact={state.dealerCards.length >= 5}
                  faceDown={!state.dealerRevealed && idx === 1}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-[126px] w-[88px] sm:h-[144px] sm:w-[100px] items-center justify-center rounded-lg border border-dashed border-[#D99B38]/30 text-[11px] font-mono-tabular text-[#87A196]">
              SHOE
            </div>
          )}
        </section>

        {/* Center Settlement Banner */}
        <div className="my-3 flex min-h-[44px] items-center justify-center">
          {state.roundSummary && (
            <div className="rounded-md border border-[#D99B38]/65 bg-[#0C1713]/95 px-5 py-2 text-center shadow-xl">
              <span className="font-display text-lg font-bold text-[#F4EFE4]">
                {state.roundSummary}
              </span>
              <span
                className={`ml-3 font-mono-tabular text-sm font-semibold ${
                  state.roundNetDelta > 0
                    ? 'text-[#66DF9F]'
                    : state.roundNetDelta < 0
                    ? 'text-[#F07A7A]'
                    : 'text-[#C8D4CE]'
                }`}
              >
                {state.roundNetDelta > 0
                  ? `+$${state.roundNetDelta.toLocaleString()}`
                  : state.roundNetDelta < 0
                  ? `-$${Math.abs(state.roundNetDelta).toLocaleString()}`
                  : '$0'}
              </span>
            </div>
          )}
        </div>

        {/* Player Hands Zone */}
        <section className="flex flex-wrap items-center justify-center gap-8 min-h-[178px]">
          {state.hands.length > 0 ? (
            state.hands.map((hand, idx) => {
              const ev = evaluateHand(hand.cards);
              const isActive = state.stage === 'player-turn' && idx === state.activeHandIndex;
              return (
                <div
                  key={idx}
                  className={`flex flex-col items-center rounded-lg px-4 py-3 transition-colors ${
                    isActive
                      ? 'border border-[#D99B38]/80 bg-[#0B1B15]/70'
                      : 'border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {hand.cards.map((card, cIdx) => (
                      <CardView
                        key={card.id}
                        card={card}
                        index={cIdx}
                        compact={hand.cards.length >= 5}
                      />
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center gap-3 text-xs font-mono-tabular">
                    <span className="font-bold text-[#F4EFE4]">
                      {ev.isSoft && !ev.isBlackjack
                        ? `${ev.total - 10} / ${ev.total}`
                        : ev.total}
                    </span>
                    <span className="text-[#D99B38]">BET ${hand.bet.toLocaleString()}</span>
                    {hand.outcome && (
                      <span
                        className={`uppercase font-semibold ${
                          hand.outcome === 'blackjack' || hand.outcome === 'win'
                            ? 'text-[#66DF9F]'
                            : hand.outcome === 'push'
                            ? 'text-[#C8D4CE]'
                            : 'text-[#F07A7A]'
                        }`}
                      >
                        {hand.outcome}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex h-[112px] w-[112px] flex-col items-center justify-center rounded-full border-2 border-[#D99B38]/55 bg-[#0C1D16]/75 shadow-inner">
                <span className="text-[10px] font-mono-tabular tracking-[0.18em] text-[#98B2A7]">
                  WAGER
                </span>
                <span className="mt-0.5 font-mono-tabular text-2xl font-bold text-[#EBB556]">
                  ${state.pendingBet.toLocaleString()}
                </span>
              </div>
              <p className="mt-2.5 text-xs text-[#9BB0A7]">
                Select chips below to set your wager, then deal.
              </p>
            </div>
          )}
        </section>

        {/* Bottom Action & Chip Dock */}
        <footer className="mx-auto mt-4 w-full max-w-2xl rounded-lg border border-[#223B31] bg-[#0B1713]/95 p-4 shadow-2xl">
          {state.stage === 'betting' && (
            <div className="flex flex-col gap-4">
              {state.bankroll === 0 ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-[#C8D4CE]">
                    Your chip stack is empty. Reload $1,000 from the house cage to keep playing.
                  </p>
                  <button
                    type="button"
                    onClick={() => setState((prev) => rebuyBankroll(prev, 1000))}
                    className="inline-flex items-center gap-2 rounded-md bg-[#D99B38] px-5 py-2.5 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] whitespace-nowrap cursor-pointer"
                  >
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    <span>Rebuy $1,000</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    {CHIPS.map((chip) => {
                      const disabled = state.pendingBet + chip.value > state.bankroll;
                      return (
                        <button
                          key={chip.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleAddChip(chip.value)}
                          aria-label={`Add $${chip.value} chip`}
                          className="flex h-12 w-12 items-center justify-center rounded-full border-2 font-mono-tabular text-xs font-bold text-[#F4EFE4] shadow-md transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                          style={{
                            backgroundColor: chip.bg,
                            borderColor: chip.ring,
                          }}
                        >
                          +${chip.value}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setState((prev) => setAllInBet(prev))}
                      className="rounded-md border border-[#324D42] bg-[#12241D] px-3 py-2 text-xs font-mono-tabular font-semibold text-[#EBB556] hover:border-[#D99B38] cursor-pointer"
                    >
                      All-In
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => clearPendingBet(prev))}
                      className="rounded-md border border-[#2B4339] bg-[#0F1E18] px-3 py-2 text-xs font-mono-tabular text-[#A5B8B0] hover:text-[#F4EFE4] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-[#1C322A] pt-3">
                    <div className="font-mono-tabular text-xs text-[#9BB0A7]">
                      CURRENT WAGER:{' '}
                      <span className="font-bold text-[#EBB556]">
                        ${state.pendingBet.toLocaleString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={state.pendingBet <= 0}
                      onClick={handleDeal}
                      className="inline-flex items-center gap-2 rounded-md bg-[#D99B38] px-6 py-2.5 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                      <Spade className="h-4 w-4" aria-hidden="true" />
                      <span>Deal Hand</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {state.stage === 'player-turn' && activeHand && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleHit}
                className="min-w-[110px] rounded-md bg-[#D99B38] px-5 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] cursor-pointer"
              >
                Hit [H]
              </button>
              <button
                type="button"
                onClick={handleStand}
                className="min-w-[110px] rounded-md border border-[#3B594D] bg-[#142A21] px-5 py-3 text-sm font-semibold text-[#F4EFE4] hover:border-[#D99B38] cursor-pointer"
              >
                Stand [S]
              </button>
              <button
                type="button"
                disabled={!allowDouble}
                onClick={handleDouble}
                className="min-w-[118px] rounded-md border border-[#2C463C] bg-[#10211A] px-4 py-3 text-sm font-medium text-[#EBB556] hover:border-[#D99B38] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                Double [D]
              </button>
              {allowSplit && (
                <button
                  type="button"
                  onClick={handleSplit}
                  className="min-w-[100px] rounded-md border border-[#2C463C] bg-[#10211A] px-4 py-3 text-sm font-medium text-[#70C3FF] hover:border-[#70C3FF] cursor-pointer"
                >
                  Split Pair
                </button>
              )}
            </div>
          )}

          {state.stage === 'settled' && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {state.bankroll > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={handleDealSameBet}
                    className="inline-flex items-center gap-2 rounded-md bg-[#D99B38] px-6 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] whitespace-nowrap cursor-pointer"
                  >
                    <Spade className="h-4 w-4" aria-hidden="true" />
                    <span>Deal Again (${Math.min(state.lastBet, state.bankroll)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextRound}
                    className="inline-flex items-center gap-2 rounded-md border border-[#344F44] bg-[#13261E] px-5 py-3 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38] whitespace-nowrap cursor-pointer"
                  >
                    Change Bet
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setState((prev) => rebuyBankroll(prev, 1000))}
                  className="inline-flex items-center gap-2 rounded-md bg-[#D99B38] px-6 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] whitespace-nowrap cursor-pointer"
                >
                  <Coins className="h-4 w-4" aria-hidden="true" />
                  <span>Bankrupt — Rebuy $1,000</span>
                </button>
              )}
            </div>
          )}
        </footer>
      </main>

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bj-pause-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#06080C]/80 p-4"
        >
          <div className="w-full max-w-sm rounded-md border border-[#2C3547] bg-[#12161F] p-6 shadow-2xl">
            <div className="font-mono-tabular text-[11px] tracking-[0.2em] text-[#D99B38]">
              VELVET 21 · PAUSED
            </div>
            <h2 id="bj-pause-title" className="mt-1 font-display text-2xl font-bold text-[#F4EFE4]">
              Table Paused
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[#222938] py-3.5 text-center font-mono-tabular">
              <div>
                <div className="text-[10px] text-[#8D97A8]">BANKROLL</div>
                <div className="mt-1 text-lg font-bold text-[#EBB556]">
                  ${state.bankroll.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#8D97A8]">PEAK STACK</div>
                <div className="mt-1 text-lg font-bold text-[#F4EFE4]">
                  ${Math.max(records.peakBankroll, state.bankroll).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPhase('playing')}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#D99B38] px-4 py-3 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] cursor-pointer"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Resume Table</span>
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#323C4F] bg-[#171C27] px-4 py-2.5 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Reset Bankroll ($1,000)</span>
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
    </div>
  );
}
