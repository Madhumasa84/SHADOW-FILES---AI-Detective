import type {
  CaseFile,
  EmotionalState,
  InterrogateApiRequest,
  InterrogateApiResponse,
  Suspect,
} from './types.ts';

const VALID_EMOTIONS: EmotionalState[] = [
  'composed',
  'guarded',
  'defensive',
  'rattled',
  'cooperative',
];

export interface RawAiInterrogationOutput {
  reply?: string;
  emotionalState?: string;
  unlockedTestimonyId?: string | null;
  contradictionReacted?: boolean;
}

/**
 * Computes which unlockable testimonies the player is legitimately eligible to trigger
 * on this specific turn based strictly on deterministic evidence/keyword rules.
 */
export function getEligibleTestimonyIds(
  suspect: Suspect,
  req: InterrogateApiRequest
): string[] {
  const lower = req.question.toLowerCase();
  const eligible: string[] = [];

  for (const t of suspect.unlockableTestimonies) {
    const presentedMatches =
      !!req.presentedClueId &&
      req.discoveredClueIds.includes(req.presentedClueId) &&
      t.triggerClueIds.includes(req.presentedClueId);

    const hasSupportingClue = t.triggerClueIds.some((id) =>
      req.discoveredClueIds.includes(id)
    );
    const keywordMatches =
      hasSupportingClue &&
      t.triggerKeywords.some((kw) => lower.includes(kw.toLowerCase()));

    if (presentedMatches || keywordMatches) {
      eligible.push(t.id);
    }
  }

  return eligible;
}

/**
 * Builds a strict, character-isolated system instruction for Gemini.
 * Notice: NEVER passes the canonical solution or inaccessible facts as things the suspect knows.
 */
export function buildInterrogationSystemPrompt(
  caseFile: CaseFile,
  suspect: Suspect,
  req: InterrogateApiRequest
): string {
  const eligibleIds = getEligibleTestimonyIds(suspect, req);
  const eligibleTestimonies = suspect.unlockableTestimonies.filter((t) =>
    eligibleIds.includes(t.id)
  );

  const presentedClue = req.presentedClueId
    ? caseFile.clues.find(
        (c) => c.id === req.presentedClueId && req.discoveredClueIds.includes(c.id)
      )
    : undefined;

  const lines: string[] = [
    `You are roleplaying as ${suspect.name} (${suspect.role}, age ${suspect.age}) inside a noir detective mystery game ("${caseFile.title}").`,
    `STRICT CANONICAL RULES — NEVER VIOLATE:`,
    `1. Stay 100% in character. Reply in 2 to 4 sharp, atmospheric noir sentences. No markdown, no stage directions in asterisks, no meta-commentary.`,
    `2. NEVER invent new evidence, new suspects, new locations, or new timeline timestamps that contradict your character file.`,
    `3. NEVER confess to kidnapping, abducting, or harming Julian Vance, and NEVER name the true culprit definitively.`,
    `4. You ONLY know the facts listed under ACCESSIBLE KNOWLEDGE below. You MUST NOT reference or reveal any fact listed under INACCESSIBLE FACTS.`,
    ``,
    `PERSONALITY: ${suspect.personality}`,
    `BACKGROUND: ${suspect.background}`,
    `CLAIMED ALIBI: ${suspect.claimedAlibi}`,
    ``,
    `ACCESSIBLE KNOWLEDGE (facts you know):`,
    ...suspect.accessibleKnowledge.map((k) => `- ${k}`),
    ``,
    `INITIAL LIES / DEFENSES (maintain these unless confronted with qualifying evidence):`,
    ...suspect.initialLies.map((l) => `- ${l}`),
    ``,
    `INACCESSIBLE FACTS (you do NOT know these — never mention them):`,
    ...suspect.inaccessibleFacts.map((f) => `- ${f}`),
  ];

  if (presentedClue) {
    lines.push(
      ``,
      `EVIDENCE PRESENTED BY DETECTIVE RIGHT NOW:`,
      `- ${presentedClue.code}: ${presentedClue.title} — ${presentedClue.shortSummary}`,
      `- Details shown to you: ${presentedClue.fullText}`
    );
  }

  if (eligibleTestimonies.length > 0) {
    lines.push(
      ``,
      `QUALIFYING DISCLOSURES UNLOCKED BY THIS QUESTION/EVIDENCE (you may concede ONE of these in character and set unlockedTestimonyId accordingly):`,
      ...eligibleTestimonies.map(
        (t) => `- ID "${t.id}": ${t.canonicalDisclosure}`
      )
    );
  } else {
    lines.push(
      ``,
      `NO NEW SECRET DISCLOSURE IS UNLOCKED ON THIS TURN. Keep unlockedTestimonyId as null and do NOT volunteer hidden confessions or unprompted alibi breaks.`
    );
  }

  lines.push(
    ``,
    `Return strict JSON matching the schema with fields: reply (string), emotionalState (one of composed, guarded, defensive, rattled, cooperative), unlockedTestimonyId (string from eligible IDs or null), contradictionReacted (boolean).`
  );

  return lines.join('\n');
}

const SPOILER_CONFESSION_PATTERNS: RegExp[] = [
  /i kidnapped julian/i,
  /i abducted julian/i,
  /i put julian in the trunk/i,
  /i drugged julian and took him/i,
  /i hid him at (my|the) (coastal )?boathouse/i,
  /okay,? i admit it,? i did it/i,
  /i am the culprit/i,
];

/**
 * Post-validates model output against deterministic mystery constraints so Gemini
 * can never leak forbidden spoilers, invent unauthorized unlocks, or break state.
 */
export function validateInterrogationOutput(
  caseFile: CaseFile,
  suspect: Suspect,
  req: InterrogateApiRequest,
  raw: RawAiInterrogationOutput
): InterrogateApiResponse {
  const eligibleIds = getEligibleTestimonyIds(suspect, req);

  const emotion: EmotionalState = VALID_EMOTIONS.includes(raw.emotionalState as EmotionalState)
    ? (raw.emotionalState as EmotionalState)
    : suspect.initialEmotion;

  // Enforce deterministic gating on unlocked testimonies
  let unlockedTestimonyId: string | undefined;
  if (raw.unlockedTestimonyId && eligibleIds.includes(raw.unlockedTestimonyId)) {
    unlockedTestimonyId = raw.unlockedTestimonyId;
  } else if (
    eligibleIds.length > 0 &&
    req.presentedClueId &&
    req.discoveredClueIds.includes(req.presentedClueId)
  ) {
    // Presenting the exact triggering clue deterministically unlocks its testimony
    unlockedTestimonyId = eligibleIds[0];
  }

  let reply = (raw.reply ?? '').trim();
  if (!reply) {
    reply =
      'I have nothing further to add to my statement, Detective. Bring real proof if you want to challenge me.';
  }

  // Block accidental premature confession / canonical solution leak
  const leaksConfession = SPOILER_CONFESSION_PATTERNS.some((rx) => rx.test(reply));
  // Block accidental mention of the boathouse (which is epilogue-only!)
  const leaksEpilogue = /\bboathouse\b/i.test(reply);
  // Block non-culprit suspects from leaking facts marked inaccessible
  const leaksThermalBeforeDiscovery =
    suspect.id === 'aris-thorne' &&
    !req.discoveredClueIds.includes('ev_usb_dongle') &&
    /\bthermal\s+(backup|usb|drive|camera)\b/i.test(reply);

  if (leaksConfession || leaksEpilogue || leaksThermalBeforeDiscovery) {
    const eligibleTestimony = unlockedTestimonyId
      ? suspect.unlockableTestimonies.find((t) => t.id === unlockedTestimonyId)
      : undefined;
    reply = eligibleTestimony
      ? eligibleTestimony.canonicalDisclosure
      : 'You are reaching well beyond the facts, Detective. I will not entertain wild theories without hard evidence—speak to my counsel if you intend to accuse me.';
  }

  const presentedContradicts =
    !!req.presentedClueId &&
    req.discoveredClueIds.includes(req.presentedClueId) &&
    suspect.contradictionClueIds.includes(req.presentedClueId);

  return {
    reply,
    emotionalState: emotion,
    mode: 'local',
    unlockedTestimonyId,
    contradictionReacted: Boolean(raw.contradictionReacted || presentedContradicts),
  };
}
