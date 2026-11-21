export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface PlayingCard {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type HandOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | null;

export interface PlayerHand {
  cards: PlayingCard[];
  bet: number;
  doubled: boolean;
  stood: boolean;
  isSplitHand: boolean;
  outcome: HandOutcome;
  payout: number; // total chips returned to bankroll (including original stake)
}

export type BlackjackStage = 'betting' | 'player-turn' | 'settled';

export interface BlackjackState {
  shoe: PlayingCard[];
  bankroll: number;
  pendingBet: number;
  lastBet: number;
  stage: BlackjackStage;
  dealerCards: PlayingCard[];
  dealerRevealed: boolean;
  hands: PlayerHand[];
  activeHandIndex: number;
  roundSummary: string | null;
  roundNetDelta: number;
}

export interface BlackjackRecords {
  peakBankroll: number;
  handsWon: number;
  blackjacks: number;
  handsPlayed: number;
}

const BLACKJACK_STORAGE_KEY = 'midnight_noir_blackjack_records_v1';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createShuffledShoe(
  decks = 6,
  rng: () => number = Math.random
): PlayingCard[] {
  const shoe: PlayingCard[] = [];
  let seq = 1;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ id: `${d}-${suit}-${rank}-${seq++}`, suit, rank });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export function cardPointValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return Number(rank);
}

export function evaluateHand(cards: PlayingCard[]): {
  total: number;
  isSoft: boolean;
  isBust: boolean;
  isBlackjack: boolean;
  isPair: boolean;
} {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces += 1;
      total += 11;
    } else {
      total += cardPointValue(c.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  const isSoft = aces > 0 && total <= 21;
  const isBlackjack = cards.length === 2 && total === 21;
  const isPair =
    cards.length === 2 && cardPointValue(cards[0].rank) === cardPointValue(cards[1].rank);

  return {
    total,
    isSoft,
    isBust: total > 21,
    isBlackjack,
    isPair,
  };
}

export function createInitialBlackjackState(
  startingBankroll = 1000,
  rng: () => number = Math.random
): BlackjackState {
  return {
    shoe: createShuffledShoe(6, rng),
    bankroll: startingBankroll,
    pendingBet: Math.min(50, startingBankroll),
    lastBet: 50,
    stage: 'betting',
    dealerCards: [],
    dealerRevealed: false,
    hands: [],
    activeHandIndex: 0,
    roundSummary: null,
    roundNetDelta: 0,
  };
}

function drawCard(
  shoe: PlayingCard[],
  rng: () => number
): { card: PlayingCard; shoe: PlayingCard[] } {
  const working = shoe.length < 36 ? createShuffledShoe(6, rng) : shoe.slice();
  const card = working.pop()!;
  return { card, shoe: working };
}

export function addChipToBet(state: BlackjackState, amount: number): BlackjackState {
  if (state.stage !== 'betting') return state;
  const nextBet = Math.min(state.bankroll, state.pendingBet + amount);
  return { ...state, pendingBet: nextBet };
}

export function clearPendingBet(state: BlackjackState): BlackjackState {
  if (state.stage !== 'betting') return state;
  return { ...state, pendingBet: 0 };
}

export function setAllInBet(state: BlackjackState): BlackjackState {
  if (state.stage !== 'betting') return state;
  return { ...state, pendingBet: state.bankroll };
}

export function rebuyBankroll(state: BlackjackState, amount = 1000): BlackjackState {
  if (state.stage !== 'betting' && state.stage !== 'settled') return state;
  const nextBankroll = state.bankroll + amount;
  return {
    ...state,
    bankroll: nextBankroll,
    pendingBet: Math.min(50, nextBankroll),
    stage: 'betting',
    dealerCards: [],
    dealerRevealed: false,
    hands: [],
    activeHandIndex: 0,
    roundSummary: null,
    roundNetDelta: 0,
  };
}

function resolveDealerAndSettle(
  state: BlackjackState,
  rng: () => number
): BlackjackState {
  let shoe = state.shoe;
  const dealerCards = state.dealerCards.slice();
  const anyLiveHand = state.hands.some((h) => !evaluateHand(h.cards).isBust);

  // Dealer draws until total >= 17 (stands on all 17s) if any player hand hasn't busted
  if (anyLiveHand) {
    while (evaluateHand(dealerCards).total < 17) {
      const drawn = drawCard(shoe, rng);
      shoe = drawn.shoe;
      dealerCards.push(drawn.card);
    }
  }

  const dealerEval = evaluateHand(dealerCards);
  let totalReturned = 0;
  let totalStaked = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let blackjacks = 0;

  const settledHands: PlayerHand[] = state.hands.map((hand) => {
    totalStaked += hand.bet;
    const ev = evaluateHand(hand.cards);
    const naturalBj = ev.isBlackjack && !hand.isSplitHand;
    let outcome: HandOutcome;
    let payout = 0;

    if (ev.isBust) {
      outcome = 'bust';
      payout = 0;
      losses += 1;
    } else if (naturalBj && !dealerEval.isBlackjack) {
      outcome = 'blackjack';
      payout = Math.floor(hand.bet * 2.5); // 3:2 natural blackjack payout
      wins += 1;
      blackjacks += 1;
    } else if (dealerEval.isBlackjack && !naturalBj) {
      outcome = 'lose';
      payout = 0;
      losses += 1;
    } else if (dealerEval.isBust || ev.total > dealerEval.total) {
      outcome = 'win';
      payout = hand.bet * 2;
      wins += 1;
    } else if (ev.total === dealerEval.total) {
      outcome = 'push';
      payout = hand.bet;
      pushes += 1;
    } else {
      outcome = 'lose';
      payout = 0;
      losses += 1;
    }

    totalReturned += payout;
    return {
      ...hand,
      stood: true,
      outcome,
      payout,
    };
  });

  const nextBankroll = state.bankroll + totalReturned;
  const netDelta = totalReturned - totalStaked;

  let summary = 'House Wins';
  if (blackjacks > 0 && losses === 0) {
    summary = 'Blackjack! Pays 3:2';
  } else if (wins > 0 && losses === 0) {
    summary = dealerEval.isBust ? 'Dealer Busts — You Win' : 'You Win the Hand';
  } else if (pushes > 0 && wins === 0 && losses === 0) {
    summary = 'Push — Bet Returned';
  } else if (wins > 0 && losses > 0) {
    summary = netDelta >= 0 ? 'Split Result — Ahead' : 'Split Result — Behind';
  } else if (settledHands.every((h) => h.outcome === 'bust')) {
    summary = 'Bust — Over 21';
  } else if (dealerEval.isBlackjack) {
    summary = 'Dealer Blackjack';
  }

  return {
    ...state,
    shoe,
    bankroll: nextBankroll,
    stage: 'settled',
    dealerCards,
    dealerRevealed: true,
    hands: settledHands,
    roundSummary: summary,
    roundNetDelta: netDelta,
  };
}

function advanceOrSettle(state: BlackjackState, rng: () => number): BlackjackState {
  for (let i = state.activeHandIndex + 1; i < state.hands.length; i++) {
    const h = state.hands[i];
    if (!h.stood && !evaluateHand(h.cards).isBust) {
      return { ...state, activeHandIndex: i };
    }
  }
  return resolveDealerAndSettle(state, rng);
}

export function dealNewHand(
  state: BlackjackState,
  rng: () => number = Math.random
): BlackjackState {
  const bet = Math.min(state.pendingBet, state.bankroll);
  if (bet <= 0) return state;

  let shoe = state.shoe;
  const p1 = drawCard(shoe, rng);
  shoe = p1.shoe;
  const d1 = drawCard(shoe, rng);
  shoe = d1.shoe;
  const p2 = drawCard(shoe, rng);
  shoe = p2.shoe;
  const d2 = drawCard(shoe, rng);
  shoe = d2.shoe;

  const playerHand: PlayerHand = {
    cards: [p1.card, p2.card],
    bet,
    doubled: false,
    stood: false,
    isSplitHand: false,
    outcome: null,
    payout: 0,
  };

  const nextState: BlackjackState = {
    ...state,
    shoe,
    bankroll: state.bankroll - bet,
    lastBet: bet,
    stage: 'player-turn',
    dealerCards: [d1.card, d2.card],
    dealerRevealed: false,
    hands: [playerHand],
    activeHandIndex: 0,
    roundSummary: null,
    roundNetDelta: 0,
  };

  const pEval = evaluateHand(playerHand.cards);
  const dEval = evaluateHand(nextState.dealerCards);
  if (pEval.isBlackjack || dEval.isBlackjack) {
    return resolveDealerAndSettle(nextState, rng);
  }

  return nextState;
}

export function hitActiveHand(
  state: BlackjackState,
  rng: () => number = Math.random
): BlackjackState {
  if (state.stage !== 'player-turn') return state;
  const active = state.hands[state.activeHandIndex];
  if (!active || active.stood) return state;

  const drawn = drawCard(state.shoe, rng);
  const updatedCards = [...active.cards, drawn.card];
  const ev = evaluateHand(updatedCards);

  const hands = state.hands.map((h, idx) =>
    idx === state.activeHandIndex
      ? { ...h, cards: updatedCards, stood: ev.isBust || ev.total === 21 }
      : h
  );

  const next: BlackjackState = { ...state, shoe: drawn.shoe, hands };
  if (ev.isBust || ev.total === 21) {
    return advanceOrSettle(next, rng);
  }
  return next;
}

export function standActiveHand(
  state: BlackjackState,
  rng: () => number = Math.random
): BlackjackState {
  if (state.stage !== 'player-turn') return state;
  const hands = state.hands.map((h, idx) =>
    idx === state.activeHandIndex ? { ...h, stood: true } : h
  );
  return advanceOrSettle({ ...state, hands }, rng);
}

export function canDoubleDown(state: BlackjackState): boolean {
  if (state.stage !== 'player-turn') return false;
  const active = state.hands[state.activeHandIndex];
  if (!active) return false;
  return active.cards.length === 2 && state.bankroll >= active.bet;
}

export function doubleDownActiveHand(
  state: BlackjackState,
  rng: () => number = Math.random
): BlackjackState {
  if (!canDoubleDown(state)) return state;
  const active = state.hands[state.activeHandIndex];
  const drawn = drawCard(state.shoe, rng);

  const hands = state.hands.map((h, idx) =>
    idx === state.activeHandIndex
      ? {
          ...h,
          cards: [...h.cards, drawn.card],
          bet: h.bet * 2,
          doubled: true,
          stood: true,
        }
      : h
  );

  return advanceOrSettle(
    {
      ...state,
      shoe: drawn.shoe,
      bankroll: state.bankroll - active.bet,
      hands,
    },
    rng
  );
}

export function canSplitHand(state: BlackjackState): boolean {
  if (state.stage !== 'player-turn') return false;
  if (state.hands.length >= 2) return false; // clean single split keeps table uncluttered
  const active = state.hands[state.activeHandIndex];
  if (!active) return false;
  return evaluateHand(active.cards).isPair && state.bankroll >= active.bet;
}

export function splitActiveHand(
  state: BlackjackState,
  rng: () => number = Math.random
): BlackjackState {
  if (!canSplitHand(state)) return state;
  const active = state.hands[state.activeHandIndex];
  let shoe = state.shoe;
  const drawA = drawCard(shoe, rng);
  shoe = drawA.shoe;
  const drawB = drawCard(shoe, rng);
  shoe = drawB.shoe;

  const handA: PlayerHand = {
    cards: [active.cards[0], drawA.card],
    bet: active.bet,
    doubled: false,
    stood: false,
    isSplitHand: true,
    outcome: null,
    payout: 0,
  };

  const handB: PlayerHand = {
    cards: [active.cards[1], drawB.card],
    bet: active.bet,
    doubled: false,
    stood: false,
    isSplitHand: true,
    outcome: null,
    payout: 0,
  };

  return {
    ...state,
    shoe,
    bankroll: state.bankroll - active.bet,
    hands: [handA, handB],
    activeHandIndex: 0,
  };
}

export function prepareNextBettingRound(state: BlackjackState): BlackjackState {
  const defaultBet = state.bankroll > 0 ? Math.min(state.lastBet, state.bankroll) : 0;
  return {
    ...state,
    pendingBet: defaultBet,
    stage: 'betting',
    dealerCards: [],
    dealerRevealed: false,
    hands: [],
    activeHandIndex: 0,
    roundSummary: null,
    roundNetDelta: 0,
  };
}

export function loadBlackjackRecords(): BlackjackRecords {
  const fallback: BlackjackRecords = {
    peakBankroll: 1000,
    handsWon: 0,
    blackjacks: 0,
    handsPlayed: 0,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(BLACKJACK_STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<BlackjackRecords>;
    return {
      peakBankroll: typeof p.peakBankroll === 'number' ? p.peakBankroll : 1000,
      handsWon: typeof p.handsWon === 'number' ? p.handsWon : 0,
      blackjacks: typeof p.blackjacks === 'number' ? p.blackjacks : 0,
      handsPlayed: typeof p.handsPlayed === 'number' ? p.handsPlayed : 0,
    };
  } catch {
    return fallback;
  }
}

export function saveBlackjackSettlement(state: BlackjackState): BlackjackRecords {
  const cur = loadBlackjackRecords();
  let wonDelta = 0;
  let bjDelta = 0;
  for (const h of state.hands) {
    if (h.outcome === 'win' || h.outcome === 'blackjack') wonDelta += 1;
    if (h.outcome === 'blackjack') bjDelta += 1;
  }
  const next: BlackjackRecords = {
    peakBankroll: Math.max(cur.peakBankroll, state.bankroll),
    handsWon: cur.handsWon + wonDelta,
    blackjacks: cur.blackjacks + bjDelta,
    handsPlayed: cur.handsPlayed + state.hands.length,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BLACKJACK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}
