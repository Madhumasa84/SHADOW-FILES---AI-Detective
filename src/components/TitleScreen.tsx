import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CASE_ARCHIVE_PREVIEWS } from '../game/cases/midnightDisappearance';
import { NoirImage } from './NoirImage';
import { RainCanvas } from './RainCanvas';

interface TitleScreenProps {
  backdropUrl: string;
  hasSavedCase: boolean;
  savedClueCount: number;
  totalClues: number;
  onStartNewCase: () => void;
  onResumeCase: () => void;
}

export function TitleScreen({
  backdropUrl,
  hasSavedCase,
  savedClueCount,
  totalClues,
  onStartNewCase,
  onResumeCase,
}: TitleScreenProps) {
  const [showCases, setShowCases] = useState(false);

  // Enter / Space starts directly from Title Screen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showCases) {
        if (e.key === 'Escape') setShowCases(false);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        if (hasSavedCase) {
          onResumeCase();
        } else {
          onStartNewCase();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasSavedCase, onResumeCase, onStartNewCase, showCases]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#0A0C10]">
      {/* Full-bleed atmospheric noir key art backdrop */}
      <div className="absolute inset-0">
        <NoirImage
          src={backdropUrl}
          alt="Rain-soaked midnight skyline seen from the Obsidian Tower penthouse window"
          className="h-full w-full object-cover object-center"
        />
        {/* Measured contrast scrim anchored to calm left negative space */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#090B0F]/95 via-[#090B0F]/72 to-[#090B0F]/25"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#090B0F]/90 via-transparent to-[#090B0F]/45"
        />
      </div>

      {/* Subtle animated midnight rain canvas */}
      <div className="pointer-events-none absolute inset-0">
        <RainCanvas intensity="storm" />
      </div>

      {/* Main Left-Third Negative Space Composition */}
      <main className="relative z-10 flex h-full w-full max-w-[1440px] mx-auto flex-col justify-between px-6 py-8 sm:px-12 sm:py-12">
        {/* Top quiet archival stamp */}
        <div className="flex items-center justify-between text-xs text-[#98A2B3]">
          <span className="font-mono-tabular tracking-[0.18em] text-[#C4B9A2]">
            CASE ARCHIVE · OBSIDIAN TOWER DIVISION
          </span>
          <span className="hidden sm:inline font-mono-tabular text-[#98A2B3]">
            CASE 01 READY · 4 SUSPECTS · 3 SCENES
          </span>
        </div>

        {/* Center-left bespoke inline SVG Title Lockup & Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="my-auto max-w-xl"
        >
          {/* Bespoke Inline SVG Detective Crest & Title Emblem */}
          <svg
            viewBox="0 0 540 154"
            className="w-full max-w-[500px] h-auto mb-5"
            role="img"
            aria-label="SHADOW FILES — AI Detective"
          >
            {/* Subtle dossier hairline frame & magnifying prism emblem */}
            <g stroke="#D99B38" strokeWidth="1.4" fill="none">
              <circle cx="28" cy="28" r="16" strokeOpacity="0.9" />
              <circle cx="28" cy="28" r="9.5" strokeOpacity="0.45" />
              <line x1="39.5" y1="39.5" x2="50" y2="50" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="62" y1="28" x2="210" y2="28" strokeOpacity="0.35" />
            </g>
            <text
              x="70"
              y="22"
              fill="#D99B38"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="11"
              letterSpacing="3.4"
              fontWeight="500"
            >
              AI DETECTIVE INVESTIGATION
            </text>
            <text
              x="2"
              y="108"
              fill="#F3EDE0"
              fontFamily="Fraunces, Georgia, serif"
              fontSize="66"
              fontWeight="700"
              letterSpacing="-1.2"
            >
              SHADOW FILES
            </text>
            <line x1="4" y1="126" x2="430" y2="126" stroke="#2D3647" strokeWidth="1.2" />
            <text
              x="4"
              y="146"
              fill="#C7C0B0"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontSize="15"
              letterSpacing="0.6"
            >
              Case 01 — The Midnight Disappearance
            </text>
          </svg>

          <p className="mb-8 max-w-md text-sm sm:text-base leading-relaxed text-[#C9C3B6]">
            A founder vanishes from a locked 42nd-floor penthouse during a storm. Inspect three
            crime scenes, interrogate four AI-driven suspects, and expose the truth on the evidence
            board.
          </p>

          {/* Primary Menu Actions (<= 3 total) */}
          <div className="flex flex-wrap items-center gap-3.5">
            {hasSavedCase ? (
              <>
                <button
                  type="button"
                  data-start="true"
                  onClick={onResumeCase}
                  className="inline-flex items-center gap-3 rounded-md bg-[#D99B38] px-6 py-3.5 text-sm font-semibold text-[#0C0E12] shadow-lg transition-transform duration-150 hover:bg-[#EBB556] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Resume Investigation</span>
                  <span className="font-mono-tabular text-xs opacity-80">
                    ({savedClueCount}/{totalClues} Clues)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onStartNewCase}
                  className="inline-flex items-center rounded-md border border-[#354054] bg-[#131720]/90 px-5 py-3.5 text-sm font-medium text-[#ECE6D8] transition-colors duration-150 hover:border-[#D99B38]/60 hover:bg-[#1B202C] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  New Investigation
                </button>
              </>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={onStartNewCase}
                className="inline-flex items-center gap-2.5 rounded-md bg-[#D99B38] px-7 py-3.5 text-sm font-semibold text-[#0C0E12] shadow-lg transition-transform duration-150 hover:bg-[#EBB556] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open Case File</span>
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 8H12.5M9 4.5L12.5 8L9 11.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowCases(true)}
              className="inline-flex items-center rounded-md border border-[#2D3545] bg-[#11151D]/85 px-5 py-3.5 text-sm font-medium text-[#D6D0C2] transition-colors duration-150 hover:border-[#D99B38]/50 hover:text-[#F4EFE4] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Case Archive
            </button>
          </div>
        </motion.div>

        {/* Flat borderless single-line control hint */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#98A2B3]">
          <p className="font-mono-tabular tracking-wide">
            Click Inspect · Scroll Zoom · Drag Link Evidence · Esc Pause · M Audio
          </p>
          <p className="hidden md:block text-[#828C9E]">
            Press Enter or Space to begin
          </p>
        </div>
      </main>

      {/* Case Selection Modal */}
      {showCases && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-archive-heading"
          className="fixed inset-0 z-30 flex items-center justify-center bg-[#07090C]/85 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl rounded-lg border border-[#2B3343] bg-[#131720] p-6 sm:p-8 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#242C3A] pb-4">
              <div>
                <h2 id="case-archive-heading" className="font-display text-2xl font-semibold text-[#F2ECDC]">
                  Case Archive
                </h2>
                <p className="mt-1 text-sm text-[#98A2B3]">
                  Select an investigation dossier to open.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCases(false)}
                aria-label="Close case archive"
                className="rounded-md border border-[#2D3545] px-3 py-1.5 text-xs font-medium text-[#C9C3B6] hover:border-[#D99B38]/50 hover:text-[#F2ECDC] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {CASE_ARCHIVE_PREVIEWS.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border p-4 transition-colors ${
                    item.playable
                      ? 'border-[#394254] bg-[#181D27]'
                      : 'border-[#232A37] bg-[#11151C]/70 opacity-70'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-[#98A2B3] font-mono-tabular">
                      <span className={item.playable ? 'text-[#D99B38]' : 'text-[#7C8699]'}>
                        {item.caseNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.statusLabel}</span>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#F2ECDC]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#A3ADBD]">{item.subtitle}</p>
                    <p className="pt-1 text-sm text-[#C7C1B5] leading-relaxed">{item.summary}</p>
                  </div>

                  <div className="shrink-0">
                    {item.playable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCases(false);
                          if (hasSavedCase) onResumeCase();
                          else onStartNewCase();
                        }}
                        className="rounded-md bg-[#D99B38] px-4 py-2 text-xs font-semibold text-[#0C0E12] hover:bg-[#EBB556] whitespace-nowrap cursor-pointer"
                      >
                        {hasSavedCase ? 'Resume Case' : 'Investigate'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="rounded-md border border-[#2B3240] bg-[#141821] px-4 py-2 text-xs font-medium text-[#6B7486] whitespace-nowrap cursor-not-allowed"
                      >
                        Locked
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
