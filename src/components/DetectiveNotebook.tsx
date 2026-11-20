import { useState } from 'react';
import { CheckCircle2, Clock, FileText, MapPin, Users } from 'lucide-react';
import type { CaseFile, InvestigationState } from '../game/types';
import { NoirImage } from './NoirImage';

interface DetectiveNotebookProps {
  caseFile: CaseFile;
  state: InvestigationState;
  onJumpToLocation: (locationId: string) => void;
  onJumpToSuspect: (suspectId: string) => void;
}

type NotebookSubTab = 'clues' | 'suspects' | 'timeline';

export function DetectiveNotebook({
  caseFile,
  state,
  onJumpToLocation,
  onJumpToSuspect,
}: DetectiveNotebookProps) {
  const [subTab, setSubTab] = useState<NotebookSubTab>('clues');

  const discoveredClues = caseFile.clues.filter((c) => state.discoveredClueIds.includes(c.id));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0C0E12]">
      {/* Sub-navigation bar */}
      <div className="shrink-0 border-b border-[#202633] bg-[#12161E] px-4 py-2.5">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-md bg-[#161B24] p-1 border border-[#242C3A]">
            <button
              type="button"
              onClick={() => setSubTab('clues')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                subTab === 'clues'
                  ? 'bg-[#D99B38] text-[#0C0E12] font-semibold'
                  : 'text-[#B4BECE] hover:text-[#F2ECDC]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Evidence Log ({discoveredClues.length}/{caseFile.clues.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('suspects')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                subTab === 'suspects'
                  ? 'bg-[#D99B38] text-[#0C0E12] font-semibold'
                  : 'text-[#B4BECE] hover:text-[#F2ECDC]'
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Suspects ({state.questionedSuspectIds.length}/{caseFile.suspects.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('timeline')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                subTab === 'timeline'
                  ? 'bg-[#D99B38] text-[#0C0E12] font-semibold'
                  : 'text-[#B4BECE] hover:text-[#F2ECDC]'
              }`}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reconstructed Timeline</span>
            </button>
          </div>

          <div className="text-xs font-mono-tabular text-[#98A2B3]">
            Scenes Visited {state.visitedLocationIds.length}/{caseFile.locations.length} ·
            Testimonies {state.unlockedTestimonyIds.length}
          </div>
        </div>
      </div>

      {/* Notebook Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1200px] space-y-6">
          {/* Case Briefing Strip */}
          <section className="rounded-md border border-[#242C3A] bg-[#131720] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular text-[#D99B38]">
              <span>{caseFile.caseNumber} · ACTIVE DOSSIER</span>
              <span className="text-[#98A2B3]">{caseFile.incidentDate}</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold text-[#F4EFE4]">
              {caseFile.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[#C8C2B5] leading-relaxed">
              {caseFile.briefing}
            </p>
          </section>

          {subTab === 'clues' && (
            <section className="space-y-4">
              {/* Unresolved Location Leads */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {caseFile.locations.map((loc) => {
                  const found = loc.hotspots.filter((h) =>
                    state.discoveredClueIds.includes(h.clueId)
                  ).length;
                  const complete = found === loc.hotspots.length;
                  return (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-[#242C3A] bg-[#141821] p-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#ECE6D8]">
                          <MapPin className="h-3.5 w-3.5 text-[#D99B38] shrink-0" aria-hidden="true" />
                          <span className="truncate">{loc.name}</span>
                        </div>
                        <div className="mt-1 font-mono-tabular text-xs text-[#98A2B3]">
                          {found}/{loc.hotspots.length} clues · {complete ? 'Cleared' : 'Open leads'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onJumpToLocation(loc.id)}
                        className="rounded border border-[#2F384A] bg-[#19202D] px-3 py-1.5 text-xs font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 whitespace-nowrap cursor-pointer"
                      >
                        Visit
                      </button>
                    </div>
                  );
                })}
              </div>

              {discoveredClues.length === 0 ? (
                <div className="rounded-md border border-[#242C3A] bg-[#131720] p-8 text-center text-sm text-[#98A2B3]">
                  No clues logged yet. Return to Crime Scenes to collect evidence.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {discoveredClues.map((clue) => {
                    const loc = caseFile.locations.find((l) => l.id === clue.locationId);
                    return (
                      <article
                        key={clue.id}
                        className="rounded-md border border-[#262E3D] bg-[#141821] p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular text-[#98A2B3]">
                          <span className="text-[#D99B38] font-semibold">{clue.code}</span>
                          <span>
                            {loc?.name}
                            {clue.timestamp ? ` · ${clue.timestamp}` : ''}
                          </span>
                        </div>
                        <h3 className="font-display text-base font-semibold text-[#F2ECDC]">
                          {clue.title}
                        </h3>
                        <p className="text-xs text-[#D8D2C5] leading-relaxed">{clue.fullText}</p>
                        <p className="pt-1 border-t border-[#222937] text-xs text-[#9FA9BA] leading-relaxed">
                          <strong className="text-[#C8C2B5]">Forensic Note:</strong>{' '}
                          {clue.forensicNote}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {subTab === 'suspects' && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {caseFile.suspects.map((s) => {
                const questioned = state.questionedSuspectIds.includes(s.id);
                const unlocked = s.unlockableTestimonies.filter((t) =>
                  state.unlockedTestimonyIds.includes(t.id)
                );
                return (
                  <article
                    key={s.id}
                    className="rounded-md border border-[#262E3D] bg-[#141821] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-12 overflow-hidden rounded border border-[#2D3648] shrink-0">
                          <NoirImage
                            src={s.portraitUrl}
                            alt={s.name}
                            className="h-full w-full object-cover object-top"
                          />
                        </div>
                        <div>
                          <h3 className="font-display text-lg font-semibold text-[#F2ECDC]">
                            {s.name}
                          </h3>
                          <p className="text-xs text-[#9FA9BA]">{s.role}</p>
                          <p className="mt-0.5 font-mono-tabular text-[11px] text-[#D99B38]">
                            {questioned ? 'Questioned' : 'Not yet questioned'} ·{' '}
                            {unlocked.length}/{s.unlockableTestimonies.length} disclosures
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onJumpToSuspect(s.id)}
                        className="rounded border border-[#2F384A] bg-[#19202D] px-3 py-1.5 text-xs font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 whitespace-nowrap cursor-pointer"
                      >
                        Interrogate
                      </button>
                    </div>

                    <p className="text-xs text-[#C8C2B5] leading-relaxed">
                      <strong className="text-[#ECE6D8]">Alibi:</strong> {s.claimedAlibi}
                    </p>

                    {unlocked.length > 0 && (
                      <div className="space-y-1.5 border-t border-[#222937] pt-2.5">
                        {unlocked.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-start gap-2 text-xs text-[#8AD5AE]"
                          >
                            <CheckCircle2
                              className="h-3.5 w-3.5 mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              <strong>{t.title}:</strong> {t.summary}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          )}

          {subTab === 'timeline' && (
            <section className="rounded-md border border-[#252D3B] bg-[#141821] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-[#F2ECDC]">
                  Chronological Reconstruction (22:15 – 00:08)
                </h2>
                <span className="font-mono-tabular text-xs text-[#98A2B3]">
                  Events unlock as you collect matching evidence
                </span>
              </div>

              <ol className="divide-y divide-[#222937]">
                {caseFile.timeline.map((evt) => {
                  const revealed = evt.revealedByClueIds.some((id) =>
                    state.discoveredClueIds.includes(id)
                  );
                  return (
                    <li
                      key={`${evt.time}_${evt.title}`}
                      className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-5 py-3.5"
                    >
                      <span className="w-28 shrink-0 font-mono-tabular text-xs font-semibold text-[#D99B38]">
                        {evt.time}
                      </span>
                      {revealed ? (
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold text-[#F2ECDC]">
                            {evt.title}
                          </div>
                          <p className="text-xs text-[#C4BEB2] leading-relaxed">
                            {evt.description}
                          </p>
                        </div>
                      ) : (
                        <div className="text-xs text-[#6F798B] italic">
                          Unverified time window — inspect more evidence to reconstruct this event.
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
