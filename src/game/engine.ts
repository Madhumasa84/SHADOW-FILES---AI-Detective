import type {
  AccusationPayload,
  AccusationResult,
  CanonicalContradiction,
  CaseFile,
  EmotionalState,
  EvidenceLink,
  HintSuggestion,
  InterrogationMessage,
  InvestigationState,
} from './types';

export const STORAGE_KEY_PREFIX = 'shadow_files_save_v1_';

export function createInitialInvestigationState(caseFile: CaseFile, now = Date.now()): InvestigationState {
  const firstLocation = caseFile.locations[0]?.id ?? '';
  const suspectEmotions: Record<string, EmotionalState> = {};
  const dialogueHistory: Record<string, InterrogationMessage[]> = {};
  const boardPositions: Record<string, { x: number; y: number }> = {};

  for (const suspect of caseFile.suspects) {
    suspectEmotions[suspect.id] = suspect.initialEmotion;
    dialogueHistory[suspect.id] = [
      {
        id: `opening_${suspect.id}`,
        sender: 'suspect',
        text: suspect.openingStatement,
        emotionalState: suspect.initialEmotion,
        timestamp: now,
      },
    ];
  }

  for (const clue of caseFile.clues) {
    boardPositions[clue.id] = { ...clue.defaultBoardPos };
  }

  return {
    caseId: caseFile.id,
    startedAt: now,
    elapsedSeconds: 0,
    activeLocationId: firstLocation,
    visitedLocationIds: firstLocation ? [firstLocation] : [],
    discoveredClueIds: [],
    questionedSuspectIds: [],
    suspectEmotions,
    unlockedTestimonyIds: [],
    dialogueHistory,
    boardPositions,
    evidenceLinks: [],
    unlockedContradictionIds: [],
    hintsUsed: 0,
    accusationResult: null,
  };
}

export function visitLocation(state: InvestigationState, locationId: string): InvestigationState {
  const visited = state.visitedLocationIds.includes(locationId)
    ? state.visitedLocationIds
    : [...state.visitedLocationIds, locationId];
  return {
    ...state,
    activeLocationId: locationId,
    visitedLocationIds: visited,
  };
}

export function collectClue(
  state: InvestigationState,
  caseFile: CaseFile,
  clueId: string
): { state: InvestigationState; newlyCollected: boolean } {
  const validClue = caseFile.clues.find((c) => c.id === clueId);
  if (!validClue) {
    return { state, newlyCollected: false };
  }
  if (state.discoveredClueIds.includes(clueId)) {
    return { state, newlyCollected: false };
  }
  return {
    newlyCollected: true,
    state: {
      ...state,
      discoveredClueIds: [...state.discoveredClueIds, clueId],
    },
  };
}

export function findMatchingContradiction(
  caseFile: CaseFile,
  clueA: string,
  clueB: string
): CanonicalContradiction | undefined {
  return caseFile.contradictions.find((c) => {
    const [first, second] = c.clueIds;
    return (first === clueA && second === clueB) || (first === clueB && second === clueA);
  });
}

export function linkEvidenceClues(
  state: InvestigationState,
  caseFile: CaseFile,
  fromClueId: string,
  toClueId: string,
  now = Date.now()
): {
  state: InvestigationState;
  createdLink: EvidenceLink | null;
  matchedContradiction: CanonicalContradiction | null;
  duplicate: boolean;
} {
  if (fromClueId === toClueId) {
    return { state, createdLink: null, matchedContradiction: null, duplicate: false };
  }
  if (
    !state.discoveredClueIds.includes(fromClueId) ||
    !state.discoveredClueIds.includes(toClueId)
  ) {
    return { state, createdLink: null, matchedContradiction: null, duplicate: false };
  }

  const alreadyLinked = state.evidenceLinks.some(
    (link) =>
      (link.fromClueId === fromClueId && link.toClueId === toClueId) ||
      (link.fromClueId === toClueId && link.toClueId === fromClueId)
  );
  if (alreadyLinked) {
    return { state, createdLink: null, matchedContradiction: null, duplicate: true };
  }

  const match = findMatchingContradiction(caseFile, fromClueId, toClueId);
  const newLink: EvidenceLink = {
    id: `link_${fromClueId}_${toClueId}_${now}`,
    fromClueId,
    toClueId,
    status: match ? 'confirmed' : 'speculation',
    contradictionId: match?.id,
    label: match ? match.title : 'Player Speculation',
    createdAt: now,
  };

  const unlockedContradictionIds =
    match && !state.unlockedContradictionIds.includes(match.id)
      ? [...state.unlockedContradictionIds, match.id]
      : state.unlockedContradictionIds;

  return {
    state: {
      ...state,
      evidenceLinks: [...state.evidenceLinks, newLink],
      unlockedContradictionIds,
    },
    createdLink: newLink,
    matchedContradiction: match ?? null,
    duplicate: false,
  };
}

export function removeEvidenceLink(state: InvestigationState, linkId: string): InvestigationState {
  const remaining = state.evidenceLinks.filter((l) => l.id !== linkId);
  return {
    ...state,
    evidenceLinks: remaining,
  };
}

export function moveBoardCard(
  state: InvestigationState,
  clueId: string,
  x: number,
  y: number
): InvestigationState {
  const clampedX = Math.max(16, Math.min(920, Math.round(x)));
  const clampedY = Math.max(16, Math.min(580, Math.round(y)));
  return {
    ...state,
    boardPositions: {
      ...state.boardPositions,
      [clueId]: { x: clampedX, y: clampedY },
    },
  };
}

export function recordInterrogationTurn(
  state: InvestigationState,
  suspectId: string,
  detectiveMsg: InterrogationMessage,
  suspectMsg: InterrogationMessage
): InvestigationState {
  const prevHistory = state.dialogueHistory[suspectId] ?? [];
  const questionedSuspectIds = state.questionedSuspectIds.includes(suspectId)
    ? state.questionedSuspectIds
    : [...state.questionedSuspectIds, suspectId];

  const unlockedTestimonyIds =
    suspectMsg.unlockedTestimonyId &&
    !state.unlockedTestimonyIds.includes(suspectMsg.unlockedTestimonyId)
      ? [...state.unlockedTestimonyIds, suspectMsg.unlockedTestimonyId]
      : state.unlockedTestimonyIds;

  const nextEmotion = suspectMsg.emotionalState ?? state.suspectEmotions[suspectId] ?? 'composed';

  return {
    ...state,
    questionedSuspectIds,
    suspectEmotions: {
      ...state.suspectEmotions,
      [suspectId]: nextEmotion,
    },
    unlockedTestimonyIds,
    dialogueHistory: {
      ...state.dialogueHistory,
      [suspectId]: [...prevHistory, detectiveMsg, suspectMsg],
    },
  };
}

export function getContextualHint(caseFile: CaseFile, state: InvestigationState): HintSuggestion {
  // Tier 1: Unvisited crime scenes
  const unvisitedLocation = caseFile.locations.find(
    (loc) => !state.visitedLocationIds.includes(loc.id)
  );
  if (unvisitedLocation && state.discoveredClueIds.length >= 3) {
    return {
      tier: 'observation',
      title: `Explore ${unvisitedLocation.name}`,
      body: `You haven't inspected ${unvisitedLocation.name} (${unvisitedLocation.floorLabel}) yet. Vital physical and digital records are waiting there.`,
      recommendedTab: 'scenes',
      targetLocationId: unvisitedLocation.id,
    };
  }

  // Tier 1b: Missing clues in current or other locations
  for (const loc of caseFile.locations) {
    const missingHotspot = loc.hotspots.find(
      (hs) => !state.discoveredClueIds.includes(hs.clueId)
    );
    if (missingHotspot && state.discoveredClueIds.length < 10) {
      return {
        tier: 'observation',
        title: `Unexamined Lead in ${loc.name}`,
        body: `Inspect the "${missingHotspot.label}" inside ${loc.name}. Toggle Evidence Highlight [H] if the room shadows hide it.`,
        recommendedTab: 'scenes',
        targetLocationId: loc.id,
      };
    }
  }

  // Tier 2: Pairable contradictions ready on the Evidence Board
  const readyContradiction = caseFile.contradictions.find(
    (con) =>
      !state.unlockedContradictionIds.includes(con.id) &&
      state.discoveredClueIds.includes(con.clueIds[0]) &&
      state.discoveredClueIds.includes(con.clueIds[1])
  );
  if (readyContradiction) {
    const clueA = caseFile.clues.find((c) => c.id === readyContradiction.clueIds[0]);
    const clueB = caseFile.clues.find((c) => c.id === readyContradiction.clueIds[1]);
    return {
      tier: 'deduction',
      title: 'Evidence Board Match Available',
      body: `On the Evidence Board, try linking ${clueA?.code} (${clueA?.title}) with ${clueB?.code} (${clueB?.title}) to expose a major breakthrough.`,
      recommendedTab: 'board',
    };
  }

  // Tier 2b: Unquestioned suspects or unused confrontation evidence
  const unquestionedSuspect = caseFile.suspects.find(
    (s) => !state.questionedSuspectIds.includes(s.id)
  );
  if (unquestionedSuspect) {
    return {
      tier: 'lead',
      title: `Question ${unquestionedSuspect.name}`,
      body: `You haven't interrogated ${unquestionedSuspect.name} (${unquestionedSuspect.role}) yet. Ask about their timeline and present conflicting evidence.`,
      recommendedTab: 'interrogation',
      targetSuspectId: unquestionedSuspect.id,
    };
  }

  // Tier 3: Ready to press culprit or make final accusation
  const remainingClue = caseFile.clues.find((c) => !state.discoveredClueIds.includes(c.id));
  if (remainingClue) {
    const loc = caseFile.locations.find((l) => l.id === remainingClue.locationId);
    return {
      tier: 'lead',
      title: `Remaining Evidence in ${loc?.name ?? 'Tower'}`,
      body: `One more piece of evidence (${remainingClue.code}) remains uncollected in ${loc?.name ?? 'the tower'}. Check every hotspot thoroughly.`,
      recommendedTab: 'scenes',
      targetLocationId: remainingClue.locationId,
    };
  }

  return {
    tier: 'deduction',
    title: 'Ready for Formal Accusation',
    body: 'Compare who had both Executive Key ADM-04, access to platinum-cure silicone, a charcoal cashmere coat, and a 00:06 garage exit. Open "Make Accusation" when ready.',
    recommendedTab: 'board',
  };
}

export function evaluateAccusation(
  caseFile: CaseFile,
  state: InvestigationState,
  payload: AccusationPayload
): AccusationResult {
  const { solution } = caseFile;
  const culpritCorrect = payload.suspectId === solution.culpritId;
  const motiveCorrect = payload.motiveId === solution.motiveId;

  const uniqueSubmittedClues = Array.from(new Set(payload.supportingClueIds));
  const matchingProofCount = uniqueSubmittedClues.filter((id) =>
    solution.keyProofClueIds.includes(id)
  ).length;

  const evidenceCoveragePct = Math.round(
    (state.discoveredClueIds.length / Math.max(1, caseFile.clues.length)) * 100
  );
  const contradictionsFound = state.unlockedContradictionIds.length;
  const totalContradictions = caseFile.contradictions.length;

  let outcome: AccusationResult['outcome'];
  let verdictHeadline: string;
  let verdictSummary: string;

  if (!culpritCorrect) {
    outcome = 'wrong_suspect';
    verdictHeadline = 'Wrongful Accusation — The True Culprit Escaped';
    verdictSummary = solution.epilogueWrongSuspect;
  } else if (!motiveCorrect || matchingProofCount < solution.minRequiredProofClues) {
    outcome = 'unsupported';
    verdictHeadline = 'Right Suspect, Insufficient Proof';
    verdictSummary = solution.epilogueUnsupported;
  } else {
    outcome = 'solved';
    verdictHeadline = 'Case Solved — Warrant Executed';
    verdictSummary = solution.epilogueSolved;
  }

  // Deterministic transparent scoring out of 100
  const culpritPoints = culpritCorrect ? 35 : 0;
  const motivePoints = motiveCorrect ? 15 : 0;
  const proofPoints = Math.min(20, Math.round((matchingProofCount / Math.max(1, solution.minRequiredProofClues)) * 20));
  const coveragePoints = Math.round((evidenceCoveragePct / 100) * 15);
  const contradictionPoints = Math.round(
    (contradictionsFound / Math.max(1, totalContradictions)) * 15
  );
  const hintPenalty = Math.min(10, state.hintsUsed * 2);

  const rawScore =
    outcome === 'wrong_suspect'
      ? Math.min(35, Math.max(0, coveragePoints + contradictionPoints - hintPenalty))
      : Math.max(0, Math.min(100, culpritPoints + motivePoints + proofPoints + coveragePoints + contradictionPoints - hintPenalty));

  let rank: AccusationResult['rank'] = 'F';
  if (outcome === 'solved') {
    if (rawScore >= 92) rank = 'S';
    else if (rawScore >= 82) rank = 'A';
    else if (rawScore >= 70) rank = 'B';
    else rank = 'C';
  } else if (outcome === 'unsupported') {
    rank = 'C';
  }

  return {
    outcome,
    rank,
    score: rawScore,
    evidenceCoveragePct,
    contradictionsFound,
    totalContradictions,
    matchingProofCount,
    motiveCorrect,
    culpritCorrect,
    elapsedSeconds: state.elapsedSeconds,
    submitted: {
      ...payload,
      supportingClueIds: uniqueSubmittedClues,
    },
    verdictHeadline,
    verdictSummary,
  };
}

export function serializeInvestigationState(state: InvestigationState): string {
  return JSON.stringify(state);
}

export function deserializeInvestigationState(
  raw: string | null,
  caseFile: CaseFile
): InvestigationState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<InvestigationState>;
    if (!parsed || parsed.caseId !== caseFile.id) {
      return null;
    }
    const base = createInitialInvestigationState(caseFile);
    const validClueIds = new Set(caseFile.clues.map((c) => c.id));
    const validLocIds = new Set(caseFile.locations.map((l) => l.id));
    const validContradictionIds = new Set(caseFile.contradictions.map((c) => c.id));

    return {
      ...base,
      ...parsed,
      activeLocationId:
        parsed.activeLocationId && validLocIds.has(parsed.activeLocationId)
          ? parsed.activeLocationId
          : base.activeLocationId,
      visitedLocationIds: Array.isArray(parsed.visitedLocationIds)
        ? parsed.visitedLocationIds.filter((id) => validLocIds.has(id))
        : base.visitedLocationIds,
      discoveredClueIds: Array.isArray(parsed.discoveredClueIds)
        ? parsed.discoveredClueIds.filter((id) => validClueIds.has(id))
        : [],
      unlockedContradictionIds: Array.isArray(parsed.unlockedContradictionIds)
        ? parsed.unlockedContradictionIds.filter((id) => validContradictionIds.has(id))
        : [],
      evidenceLinks: Array.isArray(parsed.evidenceLinks) ? parsed.evidenceLinks : [],
      dialogueHistory: {
        ...base.dialogueHistory,
        ...(parsed.dialogueHistory ?? {}),
      },
      suspectEmotions: {
        ...base.suspectEmotions,
        ...(parsed.suspectEmotions ?? {}),
      },
      boardPositions: {
        ...base.boardPositions,
        ...(parsed.boardPositions ?? {}),
      },
    };
  } catch {
    return null;
  }
}

export function formatElapsedTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
