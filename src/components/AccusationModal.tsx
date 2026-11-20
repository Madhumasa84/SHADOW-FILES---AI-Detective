import { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, Scale } from 'lucide-react';
import type { AccusationPayload, CaseFile } from '../game/types';
import { NoirImage } from './NoirImage';

interface AccusationModalProps {
  caseFile: CaseFile;
  discoveredClueIds: string[];
  onCancel: () => void;
  onSubmitAccusation: (payload: AccusationPayload) => void;
}

export function AccusationModal({
  caseFile,
  discoveredClueIds,
  onCancel,
  onSubmitAccusation,
}: AccusationModalProps) {
  const [suspectId, setSuspectId] = useState<string>('');
  const [motiveId, setMotiveId] = useState<string>('');
  const [supportingClueIds, setSupportingClueIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const collectedClues = caseFile.clues.filter((c) => discoveredClueIds.includes(c.id));

  const toggleClue = (clueId: string) => {
    setValidationError(null);
    setSupportingClueIds((prev) => {
      if (prev.includes(clueId)) {
        return prev.filter((id) => id !== clueId);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, clueId];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspectId) {
      setValidationError('Select the prime suspect before issuing a warrant.');
      return;
    }
    if (!motiveId) {
      setValidationError('Select the motive explaining why Julian Vance disappeared.');
      return;
    }
    if (supportingClueIds.length < 2) {
      setValidationError('Attach at least 2 collected pieces of supporting evidence (up to 4).');
      return;
    }
    onSubmitAccusation({
      suspectId,
      motiveId,
      supportingClueIds,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="accusation-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#07090C]/85 p-4"
    >
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16 }}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-[#394152] bg-[#131720] shadow-2xl"
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-[#242C3A] px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#E07676]">
              <Scale className="h-4 w-4" aria-hidden="true" />
              <span>FORMAL ARREST WARRANT · CASE RESOLUTION</span>
            </div>
            <h2
              id="accusation-modal-title"
              className="mt-1 font-display text-2xl font-semibold text-[#F4EFE4]"
            >
              Present Your Final Accusation
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[#2D3648] px-3 py-1.5 text-xs font-medium text-[#C8C2B5] hover:text-[#F2ECDC] cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Step 1: Prime Suspect */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-[#D99B38]">
              1. Name the Prime Suspect
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {caseFile.suspects.map((s) => {
                const picked = suspectId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSuspectId(s.id);
                      setValidationError(null);
                    }}
                    aria-pressed={picked}
                    className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors cursor-pointer ${
                      picked
                        ? 'border-[#D99B38] bg-[#211E17] text-[#F4EFE4]'
                        : 'border-[#273040] bg-[#171C26] text-[#C4BEB2] hover:border-[#414F68]'
                    }`}
                  >
                    <div className="h-12 w-10 overflow-hidden rounded border border-[#2D3648] shrink-0">
                      <NoirImage
                        src={s.portraitUrl}
                        alt={s.name}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{s.name}</div>
                      <div className="truncate text-xs text-[#98A2B3]">{s.role}</div>
                    </div>
                    {picked && <Check className="h-4 w-4 text-[#EBB556] shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Step 2: Motive */}
          <fieldset className="space-y-2.5">
            <legend className="text-xs font-semibold text-[#D99B38]">
              2. Establish the Primary Motive
            </legend>
            <div className="space-y-2">
              {caseFile.motiveOptions.map((m) => {
                const picked = motiveId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMotiveId(m.id);
                      setValidationError(null);
                    }}
                    aria-pressed={picked}
                    className={`w-full rounded-md border p-3 text-left transition-colors cursor-pointer ${
                      picked
                        ? 'border-[#D99B38] bg-[#211E17] text-[#F4EFE4]'
                        : 'border-[#273040] bg-[#171C26] text-[#C8C2B5] hover:border-[#414F68]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{m.label}</span>
                      {picked && <Check className="h-4 w-4 text-[#EBB556] shrink-0" aria-hidden="true" />}
                    </div>
                    <p className="mt-1 text-xs text-[#9EA8B8] leading-relaxed">{m.description}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Step 3: Supporting Evidence */}
          <fieldset className="space-y-2.5">
            <div className="flex items-center justify-between">
              <legend className="text-xs font-semibold text-[#D99B38]">
                3. Attach Supporting Forensic Evidence (Select 2 to 4)
              </legend>
              <span className="font-mono-tabular text-xs text-[#98A2B3]">
                {supportingClueIds.length}/4 selected
              </span>
            </div>

            {collectedClues.length < 2 ? (
              <div className="rounded-md border border-[#C93B3B]/45 bg-[#1E1316] p-4 text-xs text-[#F0B2B2]">
                You have collected only {collectedClues.length} clue(s). Gather at least 2 clues
                from the crime scenes before issuing a formal accusation.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {collectedClues.map((clue) => {
                  const picked = supportingClueIds.includes(clue.id);
                  const disabled = !picked && supportingClueIds.length >= 4;
                  return (
                    <button
                      key={clue.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleClue(clue.id)}
                      aria-pressed={picked}
                      className={`rounded-md border p-2.5 text-left text-xs transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        picked
                          ? 'border-[#D99B38] bg-[#231F16] text-[#F4EFE4]'
                          : 'border-[#273040] bg-[#161B24] text-[#C8C2B5] hover:border-[#414F68]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-mono-tabular text-[11px] text-[#D99B38]">
                        <span>{clue.code}</span>
                        <span>{picked ? 'Attached' : clue.timestamp ?? clue.category}</span>
                      </div>
                      <div className="mt-0.5 font-semibold text-[#ECE6D8]">{clue.title}</div>
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-[#98A2B3]">
                        {clue.shortSummary}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        </div>

        {/* Footer with Validation & Submit */}
        <div className="shrink-0 border-t border-[#242C3A] bg-[#10141C] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {validationError ? (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-[#EE8888]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{validationError}</span>
              </p>
            ) : (
              <p className="text-xs text-[#98A2B3]">
                Issuing a warrant concludes the active investigation and reveals the case verdict.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-[#2D3648] bg-[#171C26] px-4 py-2 text-xs font-medium text-[#C8C2B5] hover:text-[#F2ECDC] cursor-pointer"
            >
              Return to Investigation
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#C93B3B] px-5 py-2 text-xs font-semibold text-[#FFF8F6] hover:bg-[#DD4848] cursor-pointer"
            >
              Issue Arrest Warrant
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
