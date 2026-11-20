import { motion } from 'motion/react';
import { Lightbulb } from 'lucide-react';
import type { HintSuggestion } from '../game/types';

interface HintModalProps {
  hint: HintSuggestion;
  hintsUsed: number;
  onClose: () => void;
  onFollowLead: (hint: HintSuggestion) => void;
}

export function HintModal({ hint, hintsUsed, onClose, onFollowLead }: HintModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hint-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#07090C]/80 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-md rounded-lg border border-[#343E52] bg-[#131720] p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#D99B38]">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span>INVESTIGATION HINT · {hint.tier.toUpperCase()}</span>
          </div>
          <span className="font-mono-tabular text-xs text-[#8C96A8]">
            Hints used: {hintsUsed}
          </span>
        </div>

        <h2 id="hint-modal-title" className="font-display text-xl font-semibold text-[#F4EFE4]">
          {hint.title}
        </h2>

        <p className="text-sm text-[#CFC9BC] leading-relaxed">{hint.body}</p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#2D3648] bg-[#171C26] px-4 py-2 text-xs font-medium text-[#C8C2B5] hover:text-[#F2ECDC] cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onFollowLead(hint)}
            className="rounded-md bg-[#D99B38] px-4 py-2 text-xs font-semibold text-[#0C0E12] hover:bg-[#EBB556] cursor-pointer"
          >
            Go to Lead
          </button>
        </div>
      </motion.div>
    </div>
  );
}
