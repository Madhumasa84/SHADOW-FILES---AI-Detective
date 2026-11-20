export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type WorkspaceTab = 'scenes' | 'interrogation' | 'board' | 'notebook';

export type ClueCategory = 'forensic' | 'document' | 'digital' | 'physical';

export type EmotionalState = 'composed' | 'guarded' | 'defensive' | 'rattled' | 'cooperative';

export interface SceneHotspot {
  id: string;
  clueId: string;
  label: string;
  /** Percentage 0-100 from left of scene image */
  x: number;
  /** Percentage 0-100 from top of scene image */
  y: number;
  /** Brief ambient observation shown on inspect before or after collection */
  inspectSummary: string;
  /** Detailed forensic reading shown in inspection panel */
  detailedExamination: string;
}

export interface CrimeLocation {
  id: string;
  name: string;
  floorLabel: string;
  shortDescription: string;
  atmosphereNote: string;
  imageUrl: string;
  hotspots: SceneHotspot[];
}

export interface Clue {
  id: string;
  code: string;
  title: string;
  category: ClueCategory;
  locationId: string;
  timestamp?: string;
  shortSummary: string;
  fullText: string;
  forensicNote: string;
  isRedHerring?: boolean;
  /** Related suspect IDs for notebook cross-referencing */
  relatedSuspectIds: string[];
  /** Default board coordinates (0-1000 x 0-620 canvas space) */
  defaultBoardPos: { x: number; y: number };
}

export interface SuspectTestimonyUnlock {
  id: string;
  title: string;
  summary: string;
  /** Clue IDs that, when presented or referenced in questioning, unlock this testimony */
  triggerClueIds: string[];
  /** Keywords that can also unlock it when player already holds at least one trigger clue */
  triggerKeywords: string[];
  /** Exact canonical line / point the suspect concedes */
  canonicalDisclosure: string;
}

export interface Suspect {
  id: string;
  name: string;
  role: string;
  age: number;
  portraitUrl: string;
  initialEmotion: EmotionalState;
  personality: string;
  background: string;
  claimedAlibi: string;
  apparentMotive: string;
  /** Facts this suspect genuinely knows and can discuss openly */
  accessibleKnowledge: string[];
  /** Private secrets they hide until pressed with specific evidence */
  privateSecrets: string[];
  /** Specific lies they tell initially */
  initialLies: string[];
  /** Facts this suspect DOES NOT KNOW and must never reveal */
  inaccessibleFacts: string[];
  /** True only for the actual culprit — never shown directly to client UI before verdict */
  isCulprit: boolean;
  /** Clue IDs that expose a contradiction in this suspect's statements */
  contradictionClueIds: string[];
  /** Suggested starting questions to help players begin interrogations */
  suggestedQuestions: string[];
  /** Unlockable testimonies backed by deterministic rules */
  unlockableTestimonies: SuspectTestimonyUnlock[];
  /** Opening greeting when entering the interrogation room */
  openingStatement: string;
}

export interface CanonicalContradiction {
  id: string;
  title: string;
  clueIds: [string, string];
  kind: 'contradiction' | 'motive' | 'forensic_link';
  deductionText: string;
  implicatedSuspectId: string;
  /** Explains why this pairing proves a key fact */
  proofNote: string;
}

export interface TimelineEvent {
  time: string;
  title: string;
  description: string;
  /** Clue IDs that reveal this event in the player's notebook */
  revealedByClueIds: string[];
  isCritical?: boolean;
}

export interface MotiveOption {
  id: string;
  label: string;
  description: string;
}

export interface CanonicalSolution {
  culpritId: string;
  motiveId: string;
  /** Core proving clues; player needs at least minRequiredProofClues from this set for full conviction */
  keyProofClueIds: string[];
  minRequiredProofClues: number;
  fullExplanation: string[];
  epilogueSolved: string;
  epilogueUnsupported: string;
  epilogueWrongSuspect: string;
}

export interface CasePreviewMeta {
  id: string;
  caseNumber: string;
  title: string;
  subtitle: string;
  playable: boolean;
  statusLabel: string;
  summary: string;
}

export interface CaseFile {
  id: string;
  caseNumber: string;
  title: string;
  subtitle: string;
  briefing: string;
  victimName: string;
  incidentDate: string;
  titleBackdropUrl: string;
  locations: CrimeLocation[];
  clues: Clue[];
  suspects: Suspect[];
  contradictions: CanonicalContradiction[];
  timeline: TimelineEvent[];
  motiveOptions: MotiveOption[];
  solution: CanonicalSolution;
}

export interface EvidenceLink {
  id: string;
  fromClueId: string;
  toClueId: string;
  status: 'confirmed' | 'speculation';
  contradictionId?: string;
  label: string;
  createdAt: number;
}

export interface InterrogationMessage {
  id: string;
  sender: 'detective' | 'suspect';
  text: string;
  presentedClueId?: string;
  emotionalState?: EmotionalState;
  mode?: 'ai' | 'scripted_fallback';
  unlockedTestimonyId?: string;
  contradictionFlag?: boolean;
  timestamp: number;
}

export interface InvestigationState {
  caseId: string;
  startedAt: number;
  elapsedSeconds: number;
  activeLocationId: string;
  visitedLocationIds: string[];
  discoveredClueIds: string[];
  questionedSuspectIds: string[];
  suspectEmotions: Record<string, EmotionalState>;
  unlockedTestimonyIds: string[];
  dialogueHistory: Record<string, InterrogationMessage[]>;
  boardPositions: Record<string, { x: number; y: number }>;
  evidenceLinks: EvidenceLink[];
  unlockedContradictionIds: string[];
  hintsUsed: number;
  accusationResult: AccusationResult | null;
}

export interface AccusationPayload {
  suspectId: string;
  motiveId: string;
  supportingClueIds: string[];
}

export type AccusationOutcome = 'solved' | 'unsupported' | 'wrong_suspect';

export interface AccusationResult {
  outcome: AccusationOutcome;
  rank: 'S' | 'A' | 'B' | 'C' | 'F';
  score: number;
  evidenceCoveragePct: number;
  contradictionsFound: number;
  totalContradictions: number;
  matchingProofCount: number;
  motiveCorrect: boolean;
  culpritCorrect: boolean;
  elapsedSeconds: number;
  submitted: AccusationPayload;
  verdictHeadline: string;
  verdictSummary: string;
}

export interface HintSuggestion {
  tier: 'observation' | 'lead' | 'deduction';
  title: string;
  body: string;
  recommendedTab: WorkspaceTab;
  targetLocationId?: string;
  targetSuspectId?: string;
}

export interface InterrogateApiRequest {
  caseId: string;
  suspectId: string;
  question: string;
  presentedClueId?: string | null;
  discoveredClueIds: string[];
  unlockedTestimonyIds: string[];
  history: Array<{ sender: 'detective' | 'suspect'; text: string; presentedClueId?: string }>;
}

export interface InterrogateApiResponse {
  reply: string;
  emotionalState: EmotionalState;
  mode: 'ai' | 'scripted_fallback';
  fallbackReason?: string;
  unlockedTestimonyId?: string;
  contradictionReacted: boolean;
}
