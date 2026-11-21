import test from 'node:test';
import assert from 'node:assert/strict';
import {
  algebraicToSquare,
  applyChessMove,
  createInitialChessState,
  generateLegalMoves,
} from './rules.ts';
import { chooseEngineMove, clampElo, getEloProfile } from './engine.ts';

function playUci(state: ReturnType<typeof createInitialChessState>, uci: string) {
  const from = algebraicToSquare(uci.slice(0, 2));
  const to = algebraicToSquare(uci.slice(2, 4));
  const promo = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined;
  const legal = generateLegalMoves(state);
  const found = legal.find((m) => m.from === from && m.to === to && (m.promotion ?? undefined) === promo);
  assert.ok(found, `Expected legal move ${uci}`);
  return applyChessMove(state, found);
}

test('Initial chess position has exactly 20 legal moves for White', () => {
  const state = createInitialChessState();
  const moves = generateLegalMoves(state);
  assert.equal(moves.length, 20);
  assert.equal(state.status, 'playing');
  assert.equal(state.inCheck, false);
});

test('Scholars Mate triggers checkmate with SAN Qxf7#', () => {
  let s = createInitialChessState();
  s = playUci(s, 'e2e4');
  s = playUci(s, 'e7e5');
  s = playUci(s, 'd1h5');
  s = playUci(s, 'b8c6');
  s = playUci(s, 'f1c4');
  s = playUci(s, 'g8f6');
  s = playUci(s, 'h5f7');

  assert.equal(s.status, 'checkmate');
  assert.equal(s.winner, 'w');
  assert.equal(s.inCheck, true);
  assert.equal(s.history[s.history.length - 1].san, 'Qxf7#');
});

test('En passant capture removes the opponent pawn cleanly', () => {
  let s = createInitialChessState();
  s = playUci(s, 'e2e4');
  s = playUci(s, 'a7a6');
  s = playUci(s, 'e4e5');
  s = playUci(s, 'd7d5');
  assert.equal(s.enPassantSquare, algebraicToSquare('d6'));
  s = playUci(s, 'e5d6');

  assert.equal(s.board[algebraicToSquare('d5')], null);
  assert.equal(s.board[algebraicToSquare('d6')]?.type, 'p');
  assert.equal(s.board[algebraicToSquare('d6')]?.color, 'w');
});

test('Kingside castling works when path is clear and unattacked', () => {
  let s = createInitialChessState();
  s = playUci(s, 'e2e4');
  s = playUci(s, 'e7e5');
  s = playUci(s, 'g1f3');
  s = playUci(s, 'b8c6');
  s = playUci(s, 'f1c4');
  s = playUci(s, 'f8c5');
  s = playUci(s, 'e1g1');

  assert.equal(s.board[algebraicToSquare('g1')]?.type, 'k');
  assert.equal(s.board[algebraicToSquare('f1')]?.type, 'r');
  assert.equal(s.history[s.history.length - 1].san, 'O-O');
});

test('Automated Elo profiles clamp to 500..3000 and high Elo finds mate-in-1 deterministically', () => {
  assert.equal(clampElo(120), 500);
  assert.equal(clampElo(3900), 3000);
  assert.equal(getEloProfile(500).searchDepth, 1);
  assert.ok(getEloProfile(3000).searchDepth >= 4);

  // Position right before Scholar's Mate (White to move -> Qxf7# is mate in 1)
  let s = createInitialChessState();
  s = playUci(s, 'e2e4');
  s = playUci(s, 'e7e5');
  s = playUci(s, 'd1h5');
  s = playUci(s, 'b8c6');
  s = playUci(s, 'f1c4');
  s = playUci(s, 'g8f6');

  const gmPick = chooseEngineMove(s, 2600);
  assert.ok(gmPick !== null);
  assert.equal(gmPick.move.from, algebraicToSquare('h5'));
  assert.equal(gmPick.move.to, algebraicToSquare('f7'));

  // Low Elo (500) and Max Elo (3000) both return valid legal moves from start
  const start = createInitialChessState();
  for (const elo of [500, 1200, 2000, 3000]) {
    const res = chooseEngineMove(start, elo);
    assert.ok(res !== null, `expected move at Elo ${elo}`);
    const after = applyChessMove(start, res.move);
    assert.equal(after.turn, 'b');
  }
});
