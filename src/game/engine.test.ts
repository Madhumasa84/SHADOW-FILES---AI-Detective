import test from 'node:test';
import assert from 'node:assert/strict';
import { MIDNIGHT_DISAPPEARANCE_CASE } from './cases/midnightDisappearance';
import {
  collectClue,
  createInitialInvestigationState,
  deserializeInvestigationState,
  evaluateAccusation,
  getContextualHint,
  linkEvidenceClues,
  moveBoardCard,
  removeEvidenceLink,
  serializeInvestigationState,
  visitLocation,
} from './engine';
import {
  buildInterrogationSystemPrompt,
  getEligibleTestimonyIds,
  validateInterrogationOutput,
} from './interrogationGuard';
import { generateScriptedInterrogationReply } from './scriptedDialogue';

test('Case 01 satisfies all canonical mystery structural requirements', () => {
  const c = MIDNIGHT_DISAPPEARANCE_CASE;
  assert.equal(c.suspects.length, 4, 'Must have 4 suspects');
  assert.equal(c.locations.length, 3, 'Must have 3 explorable locations');
  assert.ok(c.clues.length >= 15, 'Must have at least 15 discoverable clues');
  assert.ok(c.contradictions.length >= 3, 'Must have at least 3 contradictions');

  const culprits = c.suspects.filter((s) => s.isCulprit);
  assert.equal(culprits.length, 1, 'Exactly one canonical culprit');
  assert.equal(culprits[0].id, c.solution.culpritId);

  // Every hotspot maps to a real clue and every clue has a hotspot
  const clueIds = new Set(c.clues.map((cl) => cl.id));
  const hotspotClueIds = new Set(
    c.locations.flatMap((loc) => loc.hotspots.map((hs) => hs.clueId))
  );
  assert.equal(hotspotClueIds.size, clueIds.size);
  for (const id of hotspotClueIds) {
    assert.ok(clueIds.has(id), `Hotspot clue ${id} must exist`);
  }

  // Every contradiction references valid clues
  for (const con of c.contradictions) {
    assert.ok(clueIds.has(con.clueIds[0]), `Contradiction clueA ${con.clueIds[0]} exists`);
    assert.ok(clueIds.has(con.clueIds[1]), `Contradiction clueB ${con.clueIds[1]} exists`);
  }
});

test('Clue collection deduplicates and persists across serialize/deserialize round-trip', () => {
  const c = MIDNIGHT_DISAPPEARANCE_CASE;
  let state = createInitialInvestigationState(c, 1000);

  const first = collectClue(state, c, 'ev_vault_log');
  assert.equal(first.newlyCollected, true);
  assert.deepEqual(first.state.discoveredClueIds, ['ev_vault_log']);

  const duplicate = collectClue(first.state, c, 'ev_vault_log');
  assert.equal(duplicate.newlyCollected, false);
  assert.equal(duplicate.state.discoveredClueIds.length, 1);

  const invalid = collectClue(first.state, c, 'nonexistent_clue');
  assert.equal(invalid.newlyCollected, false);

  state = visitLocation(first.state, 'security-room');
  state = moveBoardCard(state, 'ev_vault_log', 240, 180);

  const raw = serializeInvestigationState(state);
  const restored = deserializeInvestigationState(raw, c);
  assert.ok(restored);
  assert.deepEqual(restored.discoveredClueIds, ['ev_vault_log']);
  assert.equal(restored.activeLocationId, 'security-room');
  assert.deepEqual(restored.boardPositions['ev_vault_log'], { x: 240, y: 180 });
});

test('Evidence board distinguishes confirmed contradictions from speculation and prevents duplicates', () => {
  const c = MIDNIGHT_DISAPPEARANCE_CASE;
  let state = createInitialInvestigationState(c, 1000);
  state = collectClue(state, c, 'ev_keycard_log').state;
  state = collectClue(state, c, 'ev_cctv_gap').state;
  state = collectClue(state, c, 'ev_scotch_glass').state;

  // Confirmed contradiction pair
  const confirmed = linkEvidenceClues(state, c, 'ev_keycard_log', 'ev_cctv_gap', 2000);
  assert.ok(confirmed.createdLink);
  assert.equal(confirmed.createdLink.status, 'confirmed');
  assert.equal(confirmed.matchedContradiction?.id, 'con_b1_alibi');
  assert.deepEqual(confirmed.state.unlockedContradictionIds, ['con_b1_alibi']);

  // Reverse order duplicate is blocked
  const dup = linkEvidenceClues(confirmed.state, c, 'ev_cctv_gap', 'ev_keycard_log', 2001);
  assert.equal(dup.duplicate, true);
  assert.equal(dup.createdLink, null);

  // Unrelated pair creates speculation link without unlocking contradiction
  const spec = linkEvidenceClues(confirmed.state, c, 'ev_keycard_log', 'ev_scotch_glass', 2002);
  assert.ok(spec.createdLink);
  assert.equal(spec.createdLink.status, 'speculation');
  assert.equal(spec.matchedContradiction, null);

  // Removing link works cleanly
  const afterRemove = removeEvidenceLink(spec.state, spec.createdLink.id);
  assert.equal(afterRemove.evidenceLinks.length, 1);
});

test('Interrogation guard blocks inaccessible facts, unauthorized unlocks, and premature confessions', () => {
  const c = MIDNIGHT_DISAPPEARANCE_CASE;
  const aris = c.suspects.find((s) => s.id === 'aris-thorne')!;

  const reqNoEvidence = {
    caseId: c.id,
    suspectId: 'aris-thorne',
    question: 'Did you take Julian to the boathouse?',
    discoveredClueIds: ['ev_scotch_glass'],
    unlockedTestimonyIds: [],
    history: [],
  };

  // Eligible testimonies should be empty without qualifying clues
  assert.deepEqual(getEligibleTestimonyIds(aris, reqNoEvidence), []);

  // System prompt explicitly forbids inaccessible facts
  const prompt = buildInterrogationSystemPrompt(c, aris, reqNoEvidence);
  assert.ok(prompt.includes('INACCESSIBLE FACTS'));
  assert.ok(prompt.includes('NO NEW SECRET DISCLOSURE IS UNLOCKED'));

  // Post-validator blocks fabricated confession, boathouse spoiler, and unauthorized testimony unlock
  const guarded = validateInterrogationOutput(c, aris, reqNoEvidence, {
    reply: 'Okay, I admit it, I kidnapped Julian and hid him at my coastal boathouse!',
    emotionalState: 'rattled',
    unlockedTestimonyId: 'test_aris_b1_admit',
    contradictionReacted: false,
  });

  assert.equal(guarded.unlockedTestimonyId, undefined, 'Must strip unauthorized unlock');
  assert.equal(/boathouse|kidnapped/i.test(guarded.reply), false, 'Must block confession spoiler');

  // Presenting qualifying evidence DOES unlock the testimony
  const reqWithKeycard = {
    caseId: c.id,
    suspectId: 'aris-thorne',
    question: 'Explain why your badge entered B1 Security at 23:36.',
    presentedClueId: 'ev_keycard_log',
    discoveredClueIds: ['ev_keycard_log'],
    unlockedTestimonyIds: [],
    history: [],
  };
  assert.ok(getEligibleTestimonyIds(aris, reqWithKeycard).includes('test_aris_b1_admit'));

  // Scripted fallback also responds accurately and labels fallback mode
  const fallback = generateScriptedInterrogationReply(c, reqWithKeycard, 'No API key');
  assert.equal(fallback.mode, 'scripted_fallback');
  assert.equal(fallback.unlockedTestimonyId, 'test_aris_b1_admit');
  assert.equal(fallback.contradictionReacted, true);
});

test('Accusation evaluation produces solved, unsupported, and wrong_suspect outcomes deterministically', () => {
  const c = MIDNIGHT_DISAPPEARANCE_CASE;
  let state = createInitialInvestigationState(c, 1000);
  for (const clue of c.clues) {
    state = collectClue(state, c, clue.id).state;
  }
  state = linkEvidenceClues(state, c, 'ev_keycard_log', 'ev_cctv_gap', 2000).state;
  state = linkEvidenceClues(state, c, 'ev_vault_log', 'ev_silicone_dust', 2001).state;
  state = linkEvidenceClues(state, c, 'ev_usb_dongle', 'ev_parking_receipt', 2002).state;
  state = linkEvidenceClues(state, c, 'ev_balcony_latch', 'ev_cashmere_tag', 2003).state;
  state = linkEvidenceClues(state, c, 'ev_deleted_draft', 'ev_zurich_wire', 2004).state;

  // 1. Perfect solved accusation
  const solved = evaluateAccusation(c, state, {
    suspectId: 'aris-thorne',
    motiveId: 'motive_embezzlement_prototype',
    supportingClueIds: ['ev_keycard_log', 'ev_cctv_gap', 'ev_vault_log', 'ev_zurich_wire'],
  });
  assert.equal(solved.outcome, 'solved');
  assert.equal(solved.rank, 'S');
  assert.equal(solved.score, 100);

  // 2. Right suspect, weak evidence -> unsupported
  const unsupported = evaluateAccusation(c, state, {
    suspectId: 'aris-thorne',
    motiveId: 'motive_embezzlement_prototype',
    supportingClueIds: ['ev_scotch_glass', 'ev_sedative_vial'],
  });
  assert.equal(unsupported.outcome, 'unsupported');
  assert.equal(unsupported.culpritCorrect, true);

  // 3. Wrong suspect -> wrong_suspect
  const wrong = evaluateAccusation(c, state, {
    suspectId: 'elena-rostova',
    motiveId: 'motive_spurned_engagement',
    supportingClueIds: ['ev_sedative_vial', 'ev_keycard_log'],
  });
  assert.equal(wrong.outcome, 'wrong_suspect');
  assert.equal(wrong.culpritCorrect, false);
});

test('Contextual hint system guides player across scenes, evidence board, and interrogations', () => {
  const c = MIDNIGHT_DISAPPEARANCE_CASE;
  let state = createInitialInvestigationState(c, 1000);

  const hint1 = getContextualHint(c, state);
  assert.equal(hint1.recommendedTab, 'scenes');

  // Collect all clues so board match hint triggers
  for (const clue of c.clues) {
    state = collectClue(state, c, clue.id).state;
  }
  state = visitLocation(state, 'security-room');
  state = visitLocation(state, 'underground-garage');

  const hint2 = getContextualHint(c, state);
  assert.equal(hint2.recommendedTab, 'board');
  assert.equal(hint2.tier, 'deduction');
});
