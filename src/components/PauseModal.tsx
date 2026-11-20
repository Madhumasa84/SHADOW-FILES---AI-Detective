import { motion } from 'motion/react';
import { formatElapsedTime } from '../game/engine';

interface PauseModalProps {
  cluesFound: number;
  totalClues: number;
  contradictionsFound: number;
  totalContradictions: number;
  elapsedSeconds: number;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function PauseModal({
  cluesFound,
  totalClues,
  contradictionsFound,
  totalContradictions,
  elapsedSeconds,
  onResume,
  onRestart,
  onReturnTitle,
}: PauseModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07090C]/85 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-md rounded-lg border border-[#323C50] bg-[#131720] p-6 shadow-2xl space-y-5"
      >
        <div>
          <div className="font-mono-tabular text-xs text-[#D99B38]">INVESTIGATION PAUSED</div>
          <h2 id="pause-modal-title" className="mt-1 font-display text-2xl font-semibold text-[#F4EFE4]">
            Case File On Hold
          </h2>
          <p className="mt-1 text-xs text-[#98A2B3]">
            Your progress is automatically saved to this browser.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded border border-[#262E3D] bg-[#171C26] p-3">
            <div className="font-mono-tabular text-[11px] text-[#8E98AA]">CLUES</div>
            <div className="mt-1 font-mono-tabular text-lg font-semibold text-[#F2ECDC]">
              {cluesFound}/{totalClues}
            </div>
          </div>
          <div className="rounded border border-[#262E3D] bg-[#171C26] p-3">
            <div className="font-mono-tabular text-[11px] text-[#8E98AA]">LINKS</div>
            <div className="mt-1 font-mono-tabular text-lg font-semibold text-[#F2ECDC]">
              {contradictionsFound}/{totalContradictions}
            </div>
          </div>
          <div className="rounded border border-[#262E3D] bg-[#171C26] p-3">
            <div className="font-mono-tabular text-[11px] text-[#8E98AA]">TIME</div>
            <div className="mt-1 font-mono-tabular text-lg font-semibold text-[#F2ECDC]">
              {formatElapsedTime(elapsedSeconds)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-md bg-[#D99B38] px-4 py-2.5 text-sm font-semibold text-[#0C0E12] hover:bg-[#EBB556] cursor-pointer"
          >
            Resume Investigation
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-md border border-[#2E384B] bg-[#171C26] px-4 py-2.5 text-sm font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 cursor-pointer"
          >
            Restart Case From Beginning
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full rounded-md border border-[#252D3C] bg-transparent px-4 py-2.5 text-sm font-medium text-[#A6B0C2] hover:text-[#F2ECDC] cursor-pointer"
          >
            Return to Title Screen
          </button>
        </div>
      </motion.div>
    </div>
  );
}
