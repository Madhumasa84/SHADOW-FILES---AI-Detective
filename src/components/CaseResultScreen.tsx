import { motion } from 'motion/react';
import { CheckCircle2, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { formatElapsedTime } from '../game/engine';
import type { AccusationResult, CaseFile } from '../game/types';
import { NoirImage } from './NoirImage';

interface CaseResultScreenProps {
  caseFile: CaseFile;
  result: AccusationResult;
  onPlayAgain: () => void;
  onReturnTitle: () => void;
  onSwitchGame?: () => void;
}

export function CaseResultScreen({
  caseFile,
  result,
  onPlayAgain,
  onReturnTitle,
  onSwitchGame,
}: CaseResultScreenProps) {
  const culprit = caseFile.suspects.find((s) => s.id === caseFile.solution.culpritId);
  const accused = caseFile.suspects.find((s) => s.id === result.submitted.suspectId);
  const isSolved = result.outcome === 'solved';
  const isUnsupported = result.outcome === 'unsupported';

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[#0A0C10] px-4 py-8 sm:px-8 sm:py-12">
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-4xl space-y-8"
      >
        {/* Verdict Hero Card */}
        <section
          className={`rounded-lg border p-6 sm:p-8 ${
            isSolved
              ? 'border-[#4D9A76]/55 bg-[#101A16]'
              : isUnsupported
              ? 'border-[#D99B38]/55 bg-[#1B1710]'
              : 'border-[#C93B3B]/55 bg-[#1B1114]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-mono-tabular text-xs">
                {isSolved ? (
                  <CheckCircle2 className="h-4 w-4 text-[#6CC89B]" aria-hidden="true" />
                ) : isUnsupported ? (
                  <ShieldAlert className="h-4 w-4 text-[#EBB556]" aria-hidden="true" />
                ) : (
                  <XCircle className="h-4 w-4 text-[#E67373]" aria-hidden="true" />
                )}
                <span
                  className={
                    isSolved
                      ? 'text-[#6CC89B]'
                      : isUnsupported
                      ? 'text-[#EBB556]'
                      : 'text-[#E67373]'
                  }
                >
                  {caseFile.caseNumber} · FINAL VERDICT
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F5EFE2]">
                {result.verdictHeadline}
              </h1>
            </div>

            <div className="text-right">
              <div className="font-mono-tabular text-xs text-[#98A2B3]">DETECTIVE RANK</div>
              <div className="font-display text-5xl font-bold text-[#EBB556] font-mono-tabular">
                {result.rank}
              </div>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm sm:text-base text-[#DDD7CA] leading-relaxed">
            {result.verdictSummary}
          </p>

          {/* Performance Metrics Strip */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[#2A3242]/70 pt-5">
            <div className="rounded-md border border-[#283142] bg-[#12161E]/90 p-3.5">
              <div className="text-[11px] font-mono-tabular text-[#8F99AB]">CASE SCORE</div>
              <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#F4EFE4]">
                {result.score}/100
              </div>
            </div>
            <div className="rounded-md border border-[#283142] bg-[#12161E]/90 p-3.5">
              <div className="text-[11px] font-mono-tabular text-[#8F99AB]">EVIDENCE COVERAGE</div>
              <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#F4EFE4]">
                {result.evidenceCoveragePct}%
              </div>
            </div>
            <div className="rounded-md border border-[#283142] bg-[#12161E]/90 p-3.5">
              <div className="text-[11px] font-mono-tabular text-[#8F99AB]">CONTRADICTIONS</div>
              <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#F4EFE4]">
                {result.contradictionsFound}/{result.totalContradictions}
              </div>
            </div>
            <div className="rounded-md border border-[#283142] bg-[#12161E]/90 p-3.5">
              <div className="text-[11px] font-mono-tabular text-[#8F99AB]">TIME ELAPSED</div>
              <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#F4EFE4]">
                {formatElapsedTime(result.elapsedSeconds)}
              </div>
            </div>
          </div>
        </section>

        {/* Your Submission vs Canonical Truth */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {culprit && (
            <div className="rounded-lg border border-[#262E3D] bg-[#131720] p-5 space-y-3">
              <div className="font-mono-tabular text-xs text-[#D99B38]">TRUE CULPRIT</div>
              <div className="aspect-[3/4] w-full overflow-hidden rounded border border-[#2C3547]">
                <NoirImage
                  src={culprit.portraitUrl}
                  alt={culprit.name}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-[#F2ECDC]">
                  {culprit.name}
                </h2>
                <p className="text-xs text-[#9EA8B8]">{culprit.role}</p>
              </div>
              <div className="border-t border-[#242C3A] pt-2.5 text-xs text-[#C8C2B5] space-y-1">
                <div>
                  Your Accused:{' '}
                  <strong className={result.culpritCorrect ? 'text-[#7AD2A7]' : 'text-[#EE8888]'}>
                    {accused?.name ?? 'Unknown'}
                  </strong>
                </div>
                <div>
                  Motive Match:{' '}
                  <strong className={result.motiveCorrect ? 'text-[#7AD2A7]' : 'text-[#EE8888]'}>
                    {result.motiveCorrect ? 'Verified' : 'Mismatch'}
                  </strong>
                </div>
                <div>
                  Key Proof Submitted:{' '}
                  <strong className="font-mono-tabular text-[#EBB556]">
                    {result.matchingProofCount}/{caseFile.solution.minRequiredProofClues} required
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Full Evidentiary Breakdown */}
          <div className="md:col-span-2 rounded-lg border border-[#262E3D] bg-[#131720] p-6 space-y-4">
            <div>
              <div className="font-mono-tabular text-xs text-[#D99B38]">
                CANONICAL CASE RECONSTRUCTION
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold text-[#F4EFE4]">
                How the Evidence Proves the Truth
              </h2>
            </div>

            <ol className="space-y-3.5 text-sm text-[#D8D2C5] leading-relaxed">
              {caseFile.solution.fullExplanation.map((step, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 border-b border-[#202736] pb-3 last:border-b-0 last:pb-0"
                >
                  <span className="font-mono-tabular text-xs font-semibold text-[#D99B38] pt-0.5 shrink-0">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pb-6">
          {onSwitchGame && (
            <button
              type="button"
              onClick={onSwitchGame}
              className="rounded-md border border-[#2E384B] bg-[#151A24] px-5 py-3 text-xs font-medium text-[#D6D0C2] hover:border-[#D99B38]/60 hover:text-[#F4EFE4] cursor-pointer"
            >
              Switch Game
            </button>
          )}
          <button
            type="button"
            onClick={onReturnTitle}
            className="rounded-md border border-[#2E384B] bg-[#151A24] px-5 py-3 text-xs font-medium text-[#D6D0C2] hover:border-[#D99B38]/60 hover:text-[#F4EFE4] cursor-pointer"
          >
            Return to Title
          </button>
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 rounded-md bg-[#D99B38] px-6 py-3 text-xs font-semibold text-[#0C0E12] hover:bg-[#EBB556] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Investigate Again</span>
          </button>
        </div>
      </motion.main>
    </div>
  );
}
