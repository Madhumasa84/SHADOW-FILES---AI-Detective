import { AnimatePresence, motion } from 'motion/react';
import type { NarrativeBeat } from '../game/camera';

interface CinematicCameraOverlayProps {
  beat: NarrativeBeat | null;
}

export function CinematicCameraOverlay({ beat }: CinematicCameraOverlayProps) {
  const isCrimson = beat?.vignetteStrength === 'crimson';
  const showLetterbox = Boolean(beat?.letterbox);

  return (
    <div
      aria-hidden="true"
      data-testid="cinematic-camera-overlay"
      data-beat-kind={beat?.kind ?? 'idle'}
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {/* Subtle Film-Noir Widescreen Letterbox Bars (only visible during transitions / narrative beats) */}
      <motion.div
        initial={false}
        animate={{ scaleY: showLetterbox ? 1 : 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: 'top center' }}
        className="absolute inset-x-0 top-0 h-4 sm:h-7 bg-[#06070A]"
      />
      <motion.div
        initial={false}
        animate={{ scaleY: showLetterbox ? 1 : 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: 'bottom center' }}
        className="absolute inset-x-0 bottom-0 h-4 sm:h-7 bg-[#06070A]"
      />

      {/* Dynamic Chiaroscuro Lens Vignette / Narrative Flash */}
      <AnimatePresence>
        {beat && (
          <motion.div
            key={`vig_${beat.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="absolute inset-0"
            style={{
              background: isCrimson
                ? 'radial-gradient(circle at center, transparent 48%, rgba(168, 38, 38, 0.28) 85%, rgba(8, 9, 12, 0.72) 100%)'
                : beat.vignetteStrength === 'tight'
                ? 'radial-gradient(circle at center, transparent 46%, rgba(8, 10, 14, 0.62) 100%)'
                : 'radial-gradient(circle at center, transparent 58%, rgba(8, 10, 14, 0.48) 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Non-blocking Noir Establishing Slate (top-center above safe fold) */}
      <AnimatePresence>
        {beat && (
          <motion.div
            key={beat.id}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 top-14 sm:top-16 -translate-x-1/2 px-3 w-full max-w-[92vw] sm:max-w-md flex justify-center"
          >
            <div
              className={`max-w-full rounded-md border px-3.5 py-2 sm:px-5 sm:py-2.5 text-center shadow-2xl ${
                isCrimson
                  ? 'border-[#C93B3B]/70 bg-[#190F12]/95'
                  : 'border-[#D99B38]/55 bg-[#10131B]/95'
              }`}
            >
              <div
                className={`font-mono-tabular text-[9px] sm:text-[10px] tracking-[0.18em] sm:tracking-[0.22em] uppercase truncate ${
                  isCrimson ? 'text-[#EC8C8C]' : 'text-[#D99B38]'
                }`}
              >
                {beat.kicker}
              </div>
              <div className="mt-0.5 font-display text-sm sm:text-lg font-semibold text-[#F4EFE4] truncate">
                {beat.headline}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
