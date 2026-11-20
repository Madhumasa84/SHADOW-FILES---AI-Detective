import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  FileCheck2,
  FolderOpen,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { getSuspectPortraitCamera } from '../game/camera';
import type {
  CaseFile,
  Clue,
  EmotionalState,
  InterrogateApiResponse,
  InterrogationMessage,
  Suspect,
} from '../game/types';
import { NoirImage } from './NoirImage';

interface InterrogationRoomProps {
  caseFile: CaseFile;
  activeSuspectId: string;
  onSelectSuspect: (suspectId: string) => void;
  discoveredClueIds: string[];
  unlockedTestimonyIds: string[];
  suspectEmotions: Record<string, EmotionalState>;
  dialogueHistory: Record<string, InterrogationMessage[]>;
  onRecordTurn: (
    suspectId: string,
    detectiveMsg: InterrogationMessage,
    suspectMsg: InterrogationMessage
  ) => void;
}

const EMOTION_META: Record<EmotionalState, { label: string; toneClass: string }> = {
  composed: { label: 'Composed', toneClass: 'text-[#A6B4C8]' },
  guarded: { label: 'Guarded', toneClass: 'text-[#D9B675]' },
  defensive: { label: 'Defensive', toneClass: 'text-[#E59B56]' },
  rattled: { label: 'Rattled', toneClass: 'text-[#E67373]' },
  cooperative: { label: 'Cooperative', toneClass: 'text-[#6CC89B]' },
};

export function InterrogationRoom({
  caseFile,
  activeSuspectId,
  onSelectSuspect,
  discoveredClueIds,
  unlockedTestimonyIds,
  suspectEmotions,
  dialogueHistory,
  onRecordTurn,
}: InterrogationRoomProps) {
  const suspect: Suspect =
    caseFile.suspects.find((s) => s.id === activeSuspectId) ?? caseFile.suspects[0];
  const messages = dialogueHistory[suspect.id] ?? [];
  const emotion = suspectEmotions[suspect.id] ?? suspect.initialEmotion;

  const [questionInput, setQuestionInput] = useState('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [showEvidencePicker, setShowEvidencePicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<'ai' | 'scripted_fallback' | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [contradictionPulse, setContradictionPulse] = useState(false);

  const portraitCam = getSuspectPortraitCamera(emotion, contradictionPulse);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, suspect.id]);

  useEffect(() => {
    setErrorMsg(null);
    setSelectedEvidenceId(null);
    setShowEvidencePicker(false);
  }, [suspect.id]);

  const collectedClues: Clue[] = caseFile.clues.filter((c) => discoveredClueIds.includes(c.id));
  const selectedClue = selectedEvidenceId
    ? collectedClues.find((c) => c.id === selectedEvidenceId) ?? null
    : null;

  const submitQuestion = async (rawText: string, evidenceOverrideId?: string | null) => {
    const trimmed = rawText.trim();
    const clueToPresent = evidenceOverrideId !== undefined ? evidenceOverrideId : selectedEvidenceId;

    if (!trimmed && !clueToPresent) return;
    if (isSending) return;

    const finalQuestion =
      trimmed ||
      `Explain this piece of evidence: ${
        collectedClues.find((c) => c.id === clueToPresent)?.title ?? 'this clue'
      }.`;

    setIsSending(true);
    setErrorMsg(null);

    const now = Date.now();
    const detectiveMsg: InterrogationMessage = {
      id: `det_${now}`,
      sender: 'detective',
      text: finalQuestion,
      presentedClueId: clueToPresent ?? undefined,
      timestamp: now,
    };

    try {
      const res = await fetch('/api/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseFile.id,
          suspectId: suspect.id,
          question: finalQuestion,
          presentedClueId: clueToPresent,
          discoveredClueIds,
          unlockedTestimonyIds,
          history: messages.slice(-8).map((m) => ({
            sender: m.sender,
            text: m.text,
            presentedClueId: m.presentedClueId,
          })),
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Server returned ${res.status}`);
      }

      const data = (await res.json()) as InterrogateApiResponse;
      setLastMode(data.mode);
      if (data.mode === 'scripted_fallback') {
        setFallbackNotice(
          data.fallbackReason || 'Live AI service unavailable; running deterministic scripted dialogue.'
        );
      } else {
        setFallbackNotice(null);
      }

      const suspectMsg: InterrogationMessage = {
        id: `sus_${Date.now()}`,
        sender: 'suspect',
        text: data.reply,
        emotionalState: data.emotionalState,
        mode: data.mode,
        unlockedTestimonyId: data.unlockedTestimonyId,
        contradictionFlag: data.contradictionReacted,
        timestamp: Date.now(),
      };

      onRecordTurn(suspect.id, detectiveMsg, suspectMsg);
      if (data.contradictionReacted || data.unlockedTestimonyId) {
        setContradictionPulse(true);
        window.setTimeout(() => setContradictionPulse(false), 1100);
      }
      setQuestionInput('');
      setSelectedEvidenceId(null);
      setShowEvidencePicker(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to reach interrogation server. Please try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const unlockedForSuspect = suspect.unlockableTestimonies.filter((t) =>
    unlockedTestimonyIds.includes(t.id)
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0C0E12]">
      {/* Suspect Roster Strip */}
      <div className="shrink-0 border-b border-[#202633] bg-[#12161E] px-4 py-2.5 overflow-hidden">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-x-auto">
          {caseFile.suspects.map((s) => {
            const active = s.id === suspect.id;
            const sEmotion = suspectEmotions[s.id] ?? s.initialEmotion;
            const sUnlocked = s.unlockableTestimonies.filter((t) =>
              unlockedTestimonyIds.includes(t.id)
            ).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSuspect(s.id)}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-[#D99B38] bg-[#1E2431] text-[#F4EFE4]'
                    : 'border-[#252D3B] bg-[#141821] text-[#A8B2C2] hover:border-[#39455A] hover:text-[#ECE6D8]'
                }`}
              >
                <div className="h-9 w-9 overflow-hidden rounded border border-[#2F384A] shrink-0">
                  <NoirImage
                    src={s.portraitUrl}
                    alt={s.name}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold">{s.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-[#8D97A8]">
                    <span className={EMOTION_META[sEmotion].toneClass}>
                      {EMOTION_META[sEmotion].label}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {sUnlocked}/{s.unlockableTestimonies.length} Leads
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Suspect Dossier Portrait + Dialogue Transcript */}
      <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-[1440px] flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left Dossier Portrait Column */}
        <aside className="w-full lg:w-[320px] xl:w-[350px] shrink-0 max-h-[34vh] lg:max-h-none border-b lg:border-b-0 lg:border-r border-[#212735] bg-[#11151C] overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="flex lg:flex-col gap-4 items-start">
            <div
              data-testid="suspect-portrait-camera"
              data-camera-scale={portraitCam.scale.toFixed(2)}
              className="relative w-20 sm:w-24 lg:w-full aspect-[3/4] overflow-hidden rounded-md border border-[#2A3344] bg-[#0B0D11] shrink-0"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={suspect.id}
                  initial={{ opacity: 0, scale: 1.09 }}
                  animate={{
                    opacity: 1,
                    scale: portraitCam.scale,
                    y: portraitCam.y,
                    x: contradictionPulse ? [0, -3, 3, -1.5, 0] : 0,
                  }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1],
                    x: { duration: 0.32 },
                  }}
                  style={{ filter: `contrast(${portraitCam.contrast})` }}
                  className="h-full w-full will-change-transform"
                >
                  <NoirImage
                    src={suspect.portraitUrl}
                    alt={`Portrait of ${suspect.name}`}
                    className="h-full w-full object-cover object-top"
                  />
                </motion.div>
              </AnimatePresence>

              {/* Dynamic noir interrogation lamp vignette */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                style={{
                  opacity: portraitCam.vignetteOpacity,
                  background: contradictionPulse
                    ? 'radial-gradient(circle at 50% 35%, transparent 32%, rgba(168, 38, 38, 0.32) 78%, rgba(8, 9, 12, 0.92) 100%)'
                    : 'radial-gradient(circle at 50% 35%, transparent 40%, rgba(8, 10, 14, 0.85) 100%)',
                }}
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0B0D11]/95 via-[#0B0D11]/60 to-transparent"
              />
              <div className="hidden lg:block absolute bottom-3 left-3 right-3">
                <div className="font-mono-tabular text-[11px] text-[#D99B38]">
                  Demeanor · {EMOTION_META[emotion].label}
                </div>
                <h2 className="font-display text-xl font-semibold text-[#F4EFE4]">
                  {suspect.name}
                </h2>
                <p className="text-xs text-[#B6BFC9]">{suspect.role}</p>
              </div>
            </div>

            <div className="lg:hidden space-y-1 min-w-0">
              <div className={`font-mono-tabular text-xs ${EMOTION_META[emotion].toneClass}`}>
                Demeanor · {EMOTION_META[emotion].label}
              </div>
              <h2 className="font-display text-lg font-semibold text-[#F4EFE4]">
                {suspect.name}
              </h2>
              <p className="text-xs text-[#9FA9BA]">{suspect.role}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            <div>
              <div className="font-semibold text-[#D99B38] mb-1">Claimed Alibi</div>
              <p className="text-[#D4CEC1]">{suspect.claimedAlibi}</p>
            </div>
            <div className="border-t border-[#222938] pt-3">
              <div className="font-semibold text-[#B4BECE] mb-1">Background Profile</div>
              <p className="text-[#9FA9BA]">{suspect.background}</p>
            </div>
          </div>

          {/* Unlocked Key Testimonies */}
          <div className="border-t border-[#222938] pt-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#ECE6D8]">Recorded Disclosures</span>
              <span className="font-mono-tabular text-[#98A2B3]">
                {unlockedForSuspect.length}/{suspect.unlockableTestimonies.length}
              </span>
            </div>
            {unlockedForSuspect.length === 0 ? (
              <p className="text-xs text-[#858FA1]">
                Press {suspect.name.split(' ')[0]} with specific crime scene evidence to uncover
                hidden contradictions.
              </p>
            ) : (
              <div className="space-y-2">
                {unlockedForSuspect.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-md border border-[#4D9A76]/40 bg-[#12221B] p-3 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#7AD2A7]">
                      <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{t.title}</span>
                    </div>
                    <p className="text-xs text-[#C6DFD1] leading-relaxed">{t.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right Interrogation Chat & Evidence Confrontation Area */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0D1016]">
          {/* Clearly Labeled Fallback Banner (only shown if API fell back to scripted dialogue) */}
          {lastMode === 'scripted_fallback' && fallbackNotice && (
            <div
              role="status"
              className="shrink-0 flex items-center gap-2 border-b border-[#D99B38]/35 bg-[#1D1810] px-4 py-2 text-xs text-[#ECC378]"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>Scripted Dialogue Mode:</strong> {fallbackNotice}
              </span>
            </div>
          )}

          {/* Transcript History */}
          <div
            data-testid="interrogation-transcript"
            className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-4"
          >
            {messages.map((msg) => {
              const isDetective = msg.sender === 'detective';
              const presented = msg.presentedClueId
                ? caseFile.clues.find((c) => c.id === msg.presentedClueId)
                : null;
              const unlockedObj = msg.unlockedTestimonyId
                ? suspect.unlockableTestimonies.find((t) => t.id === msg.unlockedTestimonyId)
                : null;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className={`flex flex-col ${isDetective ? 'items-end' : 'items-start'}`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-mono-tabular text-[#8D97A8]">
                    <span>{isDetective ? 'Detective (You)' : suspect.name}</span>
                    {!isDetective && msg.emotionalState && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={EMOTION_META[msg.emotionalState].toneClass}>
                          {EMOTION_META[msg.emotionalState].label}
                        </span>
                      </>
                    )}
                    {!isDetective && msg.mode === 'scripted_fallback' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#D99B38]">Scripted Fallback</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-md border px-4 py-3 text-sm leading-relaxed ${
                      isDetective
                        ? 'border-[#3A455A] bg-[#1B2230] text-[#F2ECDC]'
                        : msg.contradictionFlag
                        ? 'border-[#C93B3B]/55 bg-[#1B1317] text-[#F3E9E6]'
                        : 'border-[#252D3C] bg-[#141821] text-[#E6E0D3]'
                    }`}
                  >
                    {presented && (
                      <div className="mb-2 flex items-center gap-1.5 border-b border-[#2F3A4D] pb-2 font-mono-tabular text-xs text-[#EBB556]">
                        <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          Presented Evidence: {presented.code} — {presented.title}
                        </span>
                      </div>
                    )}

                    <p>{msg.text}</p>

                    {msg.contradictionFlag && !isDetective && (
                      <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-[#C93B3B]/30 text-xs text-[#EC9595] font-medium">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Statement challenged by physical evidence</span>
                      </div>
                    )}

                    {unlockedObj && (
                      <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-[#4D9A76]/35 text-xs text-[#7AD2A7] font-medium">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>New Testimony Recorded: {unlockedObj.title}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {isSending && (
              <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#98A2B3]">
                <MessageSquare className="h-3.5 w-3.5 text-[#D99B38]" aria-hidden="true" />
                <span>{suspect.name} is considering your question…</span>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Suggested Inquiry Quick Prompts */}
          <div className="shrink-0 border-t border-[#1E2431] bg-[#10141B] px-4 py-2 sm:px-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[11px] font-mono-tabular text-[#7F8A9C] shrink-0">
                Suggested:
              </span>
              {suspect.suggestedQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={isSending}
                  onClick={() => submitQuestion(q)}
                  className="rounded border border-[#272F3F] bg-[#151A24] px-2.5 py-1 text-xs text-[#C8C2B5] hover:border-[#D99B38]/60 hover:text-[#F4EFE4] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Present Evidence Drawer */}
          {showEvidencePicker && (
            <div className="shrink-0 border-t border-[#283142] bg-[#131822] px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#EBB556]">
                  Select Collected Evidence to Confront {suspect.name}
                </span>
                <button
                  type="button"
                  onClick={() => setShowEvidencePicker(false)}
                  aria-label="Close evidence picker"
                  className="text-xs text-[#98A2B3] hover:text-[#F2ECDC] cursor-pointer"
                >
                  Close
                </button>
              </div>
              {collectedClues.length === 0 ? (
                <p className="text-xs text-[#8C96A8]">
                  You have not collected any physical clues yet. Inspect the crime scenes first.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {collectedClues.map((clue) => {
                    const picked = selectedEvidenceId === clue.id;
                    return (
                      <button
                        key={clue.id}
                        type="button"
                        onClick={() => {
                          setSelectedEvidenceId(picked ? null : clue.id);
                          setShowEvidencePicker(false);
                        }}
                        className={`rounded border p-2 text-left text-xs transition-colors cursor-pointer ${
                          picked
                            ? 'border-[#D99B38] bg-[#242A37] text-[#F4EFE4]'
                            : 'border-[#273040] bg-[#171C26] text-[#C8C2B5] hover:border-[#495772]'
                        }`}
                      >
                        <div className="font-mono-tabular text-[11px] text-[#D99B38]">
                          {clue.code}
                        </div>
                        <div className="font-medium truncate">{clue.title}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Natural-Language Question Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitQuestion(questionInput);
            }}
            className="shrink-0 border-t border-[#222836] bg-[#12161E] px-4 py-3 sm:px-6 space-y-2"
          >
            {errorMsg && (
              <div role="alert" className="text-xs text-[#EE8888]">
                {errorMsg}
              </div>
            )}

            {selectedClue && (
              <div className="flex items-center justify-between gap-2 rounded border border-[#D99B38]/55 bg-[#1D1912] px-3 py-1.5 text-xs text-[#F0C472]">
                <span className="truncate">
                  Attaching evidence: <strong>{selectedClue.code}</strong> — {selectedClue.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedEvidenceId(null)}
                  aria-label="Remove attached evidence"
                  className="text-[#C8B288] hover:text-[#FFF2D6] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEvidencePicker((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showEvidencePicker || selectedClue
                    ? 'border-[#D99B38] bg-[#D99B38]/15 text-[#F0C472]'
                    : 'border-[#2A3344] bg-[#171C26] text-[#C5CCD8] hover:border-[#D99B38]/50'
                }`}
              >
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Present Evidence</span>
                <span className="sm:hidden">Evidence</span>
              </button>

              <label htmlFor="interrogation-question" className="sr-only">
                Ask {suspect.name} a question
              </label>
              <input
                id="interrogation-question"
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder={`Ask ${suspect.name} anything in natural language…`}
                disabled={isSending}
                className="flex-1 min-w-0 rounded-md border border-[#2A3344] bg-[#0D1016] px-3.5 py-2.5 text-sm text-[#F2ECDC] placeholder-[#737E92] focus:border-[#D99B38] focus:outline-none"
              />

              <button
                type="submit"
                disabled={isSending || (!questionInput.trim() && !selectedEvidenceId)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#D99B38] px-4 py-2.5 text-xs font-semibold text-[#0C0E12] transition-colors hover:bg-[#EBB556] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ask</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
