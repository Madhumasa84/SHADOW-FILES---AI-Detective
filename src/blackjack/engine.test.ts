import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialBlackjackState,
  dealNewHand,
  doubleDownActiveHand,
  evaluateHand,
  splitActiveHand,
  standActiveHand,
  type PlayingCard,
} from './engine';

function c(rank: PlayingCard['rank'], suit: PlayingCard['suit'] = 'spades'): PlayingCard {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

test('Hand evaluator scores soft Aces, hard Ace demotions, natural blackjacks, and busts accurately', () => {
  const soft17 = evaluateHand([c('A'), c('6')]);
  assert.equal(soft17.total, 17);
  assert.equal(soft17.isSoft, true);

  const hard12 = evaluateHand([c('A'), c('A'), c('10')]);
  assert.equal(hard12.total, 12);
  assert.equal(hard12.isSoft, false);
  assert.equal(hard12.isBust, false);

  const bj = evaluateHand([c('A'), c('K')]);
  assert.equal(bj.total, 21);
  assert.equal(bj.isBlackjack, true);

  const bust = evaluateHand([c('K'), c('Q'), c('5')]);
  assert.equal(bust.total, 25);
  assert.equal(bust.isBust, true);
});

test('Natural blackjack pays 3:2 immediately when dealer does not have blackjack', () => {
  const base = createInitialBlackjackState(1000, () => 0.1);
  base.pendingBet = 100;
  // Pop order from end of shoe: p1, d1, p2, d2
  base.shoe = [
    ...base.shoe.slice(0, 60),
    c('9', 'clubs'),   // d2
    c('K', 'hearts'),  // p2
    c('7', 'diamonds'), // d1
    c('A', 'spades'),  // p1
  ];

  const settled = dealNewHand(base, () => 0.1);
  assert.equal(settled.stage, 'settled');
  assert.equal(settled.hands[0].outcome, 'blackjack');
  assert.equal(settled.bankroll, 1150);
  assert.equal(settled.roundNetDelta, 150);
});

test('Double down doubles stake, draws one card, and settles against dealer', () => {
  const base = createInitialBlackjackState(1000, () => 0.2);
  base.pendingBet = 100;
  base.shoe = [
    ...base.shoe.slice(0, 60),
    c('10', 'spades'), // double draw -> player gets 21
    c('10', 'clubs'),  // d2 (dealer 18)
    c('6', 'hearts'),  // p2 (player 11)
    c('8', 'diamonds'), // d1
    c('5', 'spades'),  // p1
  ];

  const dealt = dealNewHand(base, () => 0.2);
  assert.equal(dealt.stage, 'player-turn');
  const doubled = doubleDownActiveHand(dealt, () => 0.2);
  assert.equal(doubled.stage, 'settled');
  assert.equal(doubled.hands[0].bet, 200);
  assert.equal(doubled.hands[0].outcome, 'win');
  assert.equal(doubled.bankroll, 1200);
});

test('Splitting a pair produces two independent playable hands and deducts second stake', () => {
  const base = createInitialBlackjackState(1000, () => 0.3);
  base.pendingBet = 100;
  base.shoe = [
    ...base.shoe.slice(0, 60),
    c('9', 'clubs'),   // dealer draw if needed
    c('10', 'hearts'), // split hand B 2nd card -> 18
    c('K', 'spades'),  // split hand A 2nd card -> 18
    c('7', 'clubs'),   // d2 -> dealer 17
    c('8', 'hearts'),  // p2
    c('10', 'diamonds'), // d1
    c('8', 'spades'),  // p1
  ];

  const dealt = dealNewHand(base, () => 0.3);
  const split = splitActiveHand(dealt, () => 0.3);
  assert.equal(split.hands.length, 2);
  assert.equal(split.bankroll, 800);

  const afterFirstStand = standActiveHand(split, () => 0.3);
  assert.equal(afterFirstStand.stage, 'player-turn');
  assert.equal(afterFirstStand.activeHandIndex, 1);

  const settled = standActiveHand(afterFirstStand, () => 0.3);
  assert.equal(settled.stage, 'settled');
  assert.equal(settled.hands[0].outcome, 'win');
  assert.equal(settled.hands[1].outcome, 'win');
  assert.equal(settled.bankroll, 1200);
});

test('Splitting Aces that immediately draw 21 auto-stands and settles without requiring manual Stand', () => {
  const base = createInitialBlackjackState(1000, () => 0.4);
  base.pendingBet = 100;
  base.shoe = [
    ...base.shoe.slice(0, 60),
    c('K', 'hearts'),   // split hand B draw -> A+K = 21
    c('Q', 'spades'),   // split hand A draw -> A+Q = 21
    c('8', 'clubs'),    // d2 -> dealer 18
    c('A', 'hearts'),   // p2
    c('10', 'diamonds'), // d1
    c('A', 'spades'),   // p1
  ];

  const dealt = dealNewHand(base, () => 0.4);
  assert.equal(dealt.stage, 'player-turn');
  const split = splitActiveHand(dealt, () => 0.4);
  assert.equal(split.stage, 'settled');
  assert.equal(split.hands.length, 2);
  assert.equal(split.hands[0].outcome, 'win');
  assert.equal(split.hands[1].outcome, 'win');
  assert.equal(split.bankroll, 1200);
});
