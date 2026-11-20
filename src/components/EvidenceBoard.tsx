import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Link2, Sparkles, Trash2 } from 'lucide-react';
import type { CaseFile, EvidenceLink } from '../game/types';

interface EvidenceBoardProps {
  caseFile: CaseFile;
  discoveredClueIds: string[];
  boardPositions: Record<string, { x: number; y: number }>;
  evidenceLinks: EvidenceLink[];
  unlockedContradictionIds: string[];
  onMoveCard: (clueId: string, x: number, y: number) => void;
  onLinkClues: (fromClueId: string, toClueId: string) => {
    matchedTitle?: string;
    duplicate?: boolean;
    status?: 'confirmed' | 'speculation';
  };
  onRemoveLink: (linkId: string) => void;
  onGoToScenes: () => void;
}

const BOARD_WIDTH = 1040;
const BOARD_HEIGHT = 650;
const CARD_WIDTH = 196;
const CARD_HEIGHT = 96;

export function EvidenceBoard({
  caseFile,
  discoveredClueIds,
  boardPositions,
  evidenceLinks,
  unlockedContradictionIds,
  onMoveCard,
  onLinkClues,
  onRemoveLink,
  onGoToScenes,
}: EvidenceBoardProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'confirmed' | 'speculation' | 'info';
    text: string;
  } | null>(null);

  const draggingRef = useRef<{
    clueId: string;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  const discoveredClues = caseFile.clues.filter((c) => discoveredClueIds.includes(c.id));

  const getBoardCoords = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 100, y: 100 };
    const scaleX = BOARD_WIDTH / rect.width;
    const scaleY = BOARD_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, clueId: string) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const pos = boardPositions[clueId] ?? { x: 80, y: 80 };
    const pt = getBoardCoords(e.clientX, e.clientY);
    draggingRef.current = {
      clueId,
      offsetX: pt.x - pos.x,
      offsetY: pt.y - pos.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const pt = getBoardCoords(e.clientX, e.clientY);
    const nextX = pt.x - draggingRef.current.offsetX;
    const nextY = pt.y - draggingRef.current.offsetY;
    draggingRef.current.moved = true;
    onMoveCard(draggingRef.current.clueId, nextX, nextY);
  };

  const handleCardPointerUp = () => {
    draggingRef.current = null;
  };

  const handleLinkButtonClick = (clueId: string) => {
    if (!linkSourceId) {
      setLinkSourceId(clueId);
      const clue = caseFile.clues.find((c) => c.id === clueId);
      setFeedbackBanner({
        tone: 'info',
        text: `Selected ${clue?.code ?? ''} (${clue?.title ?? ''}). Click "Link" on a second clue card to connect them.`,
      });
      return;
    }

    if (linkSourceId === clueId) {
      setLinkSourceId(null);
      setFeedbackBanner(null);
      return;
    }

    const result = onLinkClues(linkSourceId, clueId);
    setLinkSourceId(null);

    if (result.duplicate) {
      setFeedbackBanner({
        tone: 'info',
        text: 'Those two clues are already connected on your board.',
      });
    } else if (result.status === 'confirmed' && result.matchedTitle) {
      setFeedbackBanner({
        tone: 'confirmed',
        text: `Confirmed Breakthrough: ${result.matchedTitle}`,
      });
    } else {
      setFeedbackBanner({
        tone: 'speculation',
        text: 'Recorded as Player Speculation. Try pairing clues that directly contradict an alibi or share forensic proof.',
      });
    }
  };

  const unlockedContradictions = caseFile.contradictions.filter((c) =>
    unlockedContradictionIds.includes(c.id)
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0C0E12]">
      {/* Board Toolbar */}
      <div className="shrink-0 border-b border-[#202633] bg-[#12161E] px-4 py-2.5">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-[#ECE6D8]">Detective Evidence Pinboard</span>
            <span className="hidden sm:inline text-[#8D97A8]">
              Drag cards to arrange · Click Connect on two cards to test a contradiction
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-tabular">
            <span className="flex items-center gap-1.5 text-[#E87A7A]">
              <span className="inline-block h-0.5 w-4 bg-[#C93B3B]" aria-hidden="true" />
              Confirmed ({unlockedContradictions.length}/{caseFile.contradictions.length})
            </span>
            <span className="flex items-center gap-1.5 text-[#C5CCD8]">
              <span
                className="inline-block h-0.5 w-4 border-t border-dashed border-[#8E9AB0]"
                aria-hidden="true"
              />
              Speculation ({evidenceLinks.filter((l) => l.status === 'speculation').length})
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Status Strip */}
      {feedbackBanner && (
        <div
          role="status"
          className={`shrink-0 flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${
            feedbackBanner.tone === 'confirmed'
              ? 'border-[#C93B3B]/45 bg-[#221316] text-[#F5C2C2]'
              : feedbackBanner.tone === 'speculation'
              ? 'border-[#333D52] bg-[#161B26] text-[#C5CCD8]'
              : 'border-[#D99B38]/40 bg-[#1E1911] text-[#F0C472]'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedbackBanner.tone === 'confirmed' ? (
              <Sparkles className="h-3.5 w-3.5 text-[#E87A7A]" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{feedbackBanner.text}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setFeedbackBanner(null);
              setLinkSourceId(null);
            }}
            className="text-xs underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split: Pinboard Canvas + Deductions Rail */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
        {/* Draggable Board Canvas */}
        <div className="flex-1 min-h-[400px] overflow-auto bg-[#0E1117] p-4">
          {discoveredClues.length === 0 ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-[#2A3344] bg-[#12161E] p-8 text-center">
              <Link2 className="h-8 w-8 text-[#D99B38]/70 mb-3" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold text-[#F2ECDC]">
                Your Evidence Board Is Empty
              </h2>
              <p className="mt-2 max-w-md text-sm text-[#9FA9BA]">
                Inspect the three crime scenes and collect clues first. Every collected document,
                log, and physical item pins here automatically.
              </p>
              <button
                type="button"
                onClick={onGoToScenes}
                className="mt-5 rounded-md bg-[#D99B38] px-5 py-2.5 text-xs font-semibold text-[#0C0E12] hover:bg-[#EBB556] cursor-pointer"
              >
                Explore Crime Scenes
              </button>
            </div>
          ) : (
            <div
              ref={boardRef}
              data-testid="evidence-board-canvas"
              className="relative mx-auto rounded-lg border border-[#272F3F] bg-[#131720] shadow-inner overflow-hidden"
              style={{
                width: `${BOARD_WIDTH}px`,
                height: `${BOARD_HEIGHT}px`,
                backgroundImage:
                  'radial-gradient(rgba(217, 155, 56, 0.08) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              {/* SVG String Connections Layer (pin-to-pin curved detective yarn) */}
              <svg
                width={BOARD_WIDTH}
                height={BOARD_HEIGHT}
                className="pointer-events-none absolute inset-0 z-30"
                aria-hidden="true"
              >
                {evidenceLinks.map((link) => {
                  const posA = boardPositions[link.fromClueId];
                  const posB = boardPositions[link.toClueId];
                  if (!posA || !posB) return null;
                  const x1 = posA.x + CARD_WIDTH / 2;
                  const y1 = posA.y + 15;
                  const x2 = posB.x + CARD_WIDTH / 2;
                  const y2 = posB.y + 15;
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2 + 22;
                  const confirmed = link.status === 'confirmed';

                  return (
                    <g key={link.id}>
                      <path
                        d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                        fill="none"
                        stroke={confirmed ? '#D64545' : '#8A96AE'}
                        strokeWidth={confirmed ? 2.5 : 1.75}
                        strokeDasharray={confirmed ? undefined : '6 5'}
                        strokeOpacity={confirmed ? 0.94 : 0.7}
                      />
                      <circle cx={x1} cy={y1} r="4.5" fill={confirmed ? '#E55A5A' : '#9AA6BC'} />
                      <circle cx={x2} cy={y2} r="4.5" fill={confirmed ? '#E55A5A' : '#9AA6BC'} />
                    </g>
                  );
                })}
              </svg>

              {/* Draggable Clue Cards */}
              {discoveredClues.map((clue) => {
                const pos = boardPositions[clue.id] ?? clue.defaultBoardPos;
                const isSource = linkSourceId === clue.id;
                const isConfirmedNode = evidenceLinks.some(
                  (l) =>
                    l.status === 'confirmed' &&
                    (l.fromClueId === clue.id || l.toClueId === clue.id)
                );

                return (
                  <div
                    key={clue.id}
                    onPointerDown={(e) => handleCardPointerDown(e, clue.id)}
                    onPointerMove={handleCardPointerMove}
                    onPointerUp={handleCardPointerUp}
                    onPointerCancel={handleCardPointerUp}
                    style={{
                      transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                      width: `${CARD_WIDTH}px`,
                      minHeight: `${CARD_HEIGHT}px`,
                    }}
                    className={`absolute top-0 left-0 rounded-md border p-3 shadow-md select-none cursor-grab active:cursor-grabbing transition-colors ${
                      isSource
                        ? 'z-20 border-[#EBB556] bg-[#231F16]'
                        : isConfirmedNode
                        ? 'z-10 border-[#C93B3B]/75 bg-[#1B1518]'
                        : 'z-10 border-[#2D3648] bg-[#181D27] hover:border-[#495772]'
                    }`}
                  >
                    {/* Brass Pushpin Visual */}
                    <div
                      aria-hidden="true"
                      className={`mx-auto mb-1.5 h-2.5 w-2.5 rounded-full border ${
                        isConfirmedNode
                          ? 'border-[#FFB5B5] bg-[#C93B3B]'
                          : 'border-[#F3D295] bg-[#D99B38]'
                      }`}
                    />

                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tabular">
                      <span className="text-[#D99B38] font-semibold">{clue.code}</span>
                      <span className="text-[#8E98AA]">{clue.timestamp ?? clue.category}</span>
                    </div>

                    <div className="mt-0.5 text-xs font-semibold text-[#F2ECDC] leading-snug">
                      {clue.title}
                    </div>

                    <p className="mt-1 line-clamp-2 text-[11px] text-[#A4AEBE] leading-snug">
                      {clue.shortSummary}
                    </p>

                    <div className="mt-2 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleLinkButtonClick(clue.id)}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                          isSource
                            ? 'border-[#EBB556] bg-[#D99B38] text-[#0C0E12]'
                            : linkSourceId
                            ? 'border-[#D99B38]/70 bg-[#232937] text-[#F0C472] hover:bg-[#D99B38] hover:text-[#0C0E12]'
                            : 'border-[#2E384A] bg-[#12161E] text-[#B8C2D2] hover:border-[#D99B38]/60 hover:text-[#F2ECDC]'
                        }`}
                      >
                        <Link2 className="h-3 w-3" aria-hidden="true" />
                        <span>
                          {isSource
                            ? 'Cancel'
                            : linkSourceId
                            ? `Link with ${clue.code}`
                            : `Connect ${clue.code}`}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Deductions & Active Connections Panel */}
        <aside className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#222836] bg-[#11151C] overflow-y-auto p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#F2ECDC]">
                Unlocked Deductions
              </h2>
              <span className="font-mono-tabular text-xs text-[#D99B38]">
                {unlockedContradictions.length}/{caseFile.contradictions.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#98A2B3]">
              Verified contradictions strengthen your case before you formally accuse a suspect.
            </p>
          </div>

          {unlockedContradictions.length === 0 ? (
            <div className="rounded-md border border-[#252C3A] bg-[#161B24] p-4 text-xs text-[#9FA9BA] leading-relaxed">
              No confirmed contradictions unlocked yet. Connect two clues that expose an alibi lie,
              explain how the vault opened, or trace the midnight escape.
            </div>
          ) : (
            <div className="space-y-3">
              {unlockedContradictions.map((con) => {
                const cA = caseFile.clues.find((c) => c.id === con.clueIds[0]);
                const cB = caseFile.clues.find((c) => c.id === con.clueIds[1]);
                return (
                  <div
                    key={con.id}
                    className="rounded-md border border-[#C93B3B]/45 bg-[#1B1316] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F09A9A]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{con.title}</span>
                    </div>
                    <div className="font-mono-tabular text-[11px] text-[#C89C9C]">
                      {cA?.code} + {cB?.code}
                    </div>
                    <p className="text-xs text-[#E4D8D5] leading-relaxed">{con.deductionText}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Board Strings List (allows removing speculation strings cleanly) */}
          <div className="border-t border-[#222938] pt-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-[#D6D0C2]">
              Active Connections ({evidenceLinks.length})
            </h3>
            {evidenceLinks.length === 0 ? (
              <p className="text-xs text-[#848FA2]">No strings pinned yet.</p>
            ) : (
              <div className="space-y-2">
                {evidenceLinks.map((link) => {
                  const cA = caseFile.clues.find((c) => c.id === link.fromClueId);
                  const cB = caseFile.clues.find((c) => c.id === link.toClueId);
                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between gap-2 rounded border border-[#262E3D] bg-[#161B24] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono-tabular text-[11px] text-[#D99B38]">
                          {cA?.code} ↔ {cB?.code}
                        </div>
                        <div className="truncate text-[#C9C3B6]">
                          {link.status === 'confirmed' ? 'Verified · ' : 'Speculation · '}
                          {link.label}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveLink(link.id)}
                        aria-label={`Remove link between ${cA?.code} and ${cB?.code}`}
                        className="rounded p-1 text-[#8E98AA] hover:bg-[#242B3A] hover:text-[#F09A9A] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
