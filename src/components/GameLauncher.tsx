import { Car, Search } from 'lucide-react';
import { formatRaceTime, type RacingRecords } from '../racing/engine';
import { NoirImage } from './NoirImage';
import { RainCanvas } from './RainCanvas';

interface GameLauncherProps {
  detectiveBackdropUrl: string;
  racingBackdropUrl: string;
  hasSavedCase: boolean;
  savedClueCount: number;
  totalClues: number;
  racingRecords: RacingRecords;
  onSelectDetective: () => void;
  onSelectRacing: () => void;
}

export function GameLauncher({
  detectiveBackdropUrl,
  racingBackdropUrl,
  hasSavedCase,
  savedClueCount,
  totalClues,
  racingRecords,
  onSelectDetective,
  onSelectRacing,
}: GameLauncherProps) {
  const bestObsidian = racingRecords.bestLapByCircuit['obsidian-ring'];
  const bestHarbor = racingRecords.bestLapByCircuit['harbor-chicane'];
  const fastestBestLap =
    bestObsidian !== undefined && bestHarbor !== undefined
      ? Math.min(bestObsidian, bestHarbor)
      : bestObsidian ?? bestHarbor;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0B0D11] text-[#F2ECDC] flex flex-col">
      {/* Subtle atmospheric rain over deep noir canvas */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-35">
        <RainCanvas intensity="subtle" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-1 flex-col justify-center px-5 py-8 sm:px-10 sm:py-12">
        {/* Editorial Collection Lockup */}
        <header className="mb-8 sm:mb-10 max-w-2xl">
          <div className="font-mono-tabular text-xs tracking-[0.22em] text-[#D99B38]">
            MIDNIGHT NOIR COLLECTION · TWO PLAYABLE EXPERIENCES
          </div>
          <h1 className="mt-2 font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#F4EFE4] text-balance">
            Choose Your Game
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[#B6BECA] leading-relaxed">
            Step into a locked-room detective investigation or hit the rain-slicked midnight racing
            circuit against three rival drivers.
          </p>
        </header>

        {/* Two Balanced Side-by-Side Game Showcase Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Game 1: SHADOW FILES — Detective Mystery */}
          <section
            aria-labelledby="game-card-detective"
            className="group flex flex-col overflow-hidden rounded-lg border border-[#242C3B] bg-[#12161F] transition-colors duration-200 hover:border-[#D99B38]/65"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#090B0E]">
              <NoirImage
                src={detectiveBackdropUrl}
                alt="Rain-soaked midnight skyline seen from the Obsidian Tower penthouse window"
                className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#12161F] via-[#12161F]/25 to-transparent"
              />
            </div>

            <div className="flex flex-1 flex-col justify-between p-6 sm:p-7">
              <div>
                <div className="text-xs font-mono-tabular text-[#D99B38]">
                  Detective Mystery · 3 Crime Scenes · 4 Suspects
                </div>
                <h2
                  id="game-card-detective"
                  className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-[#F4EFE4]"
                >
                  SHADOW FILES
                </h2>
                <p className="mt-2.5 text-sm text-[#C3C9D4] leading-relaxed">
                  Investigate the Midnight Disappearance across Obsidian Tower. Examine physical
                  evidence, interrogate suspects, link contradictions on the pinboard, and make your
                  final accusation.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#202735] pt-5">
                <span className="text-xs font-mono-tabular text-[#98A2B3]">
                  {hasSavedCase
                    ? `Saved Case · ${savedClueCount}/${totalClues} Clues Logged`
                    : 'Case 01 Ready · 16 Clues'}
                </span>

                <button
                  type="button"
                  onClick={onSelectDetective}
                  className="inline-flex items-center gap-2 rounded-md bg-[#D99B38] px-5 py-2.5 text-sm font-semibold text-[#0C0E12] transition-colors hover:bg-[#EBB556] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span>Play Detective Mystery</span>
                </button>
              </div>
            </div>
          </section>

          {/* Game 2: NIGHT CIRCUIT — Midnight Racing */}
          <section
            aria-labelledby="game-card-racing"
            className="group flex flex-col overflow-hidden rounded-lg border border-[#242C3B] bg-[#12161F] transition-colors duration-200 hover:border-[#D99B38]/65"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#090B0E]">
              <NoirImage
                src={racingBackdropUrl}
                alt="Grand touring cars drifting around a rain-slicked midnight racing circuit"
                className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#12161F] via-[#12161F]/25 to-transparent"
              />
            </div>

            <div className="flex flex-1 flex-col justify-between p-6 sm:p-7">
              <div>
                <div className="text-xs font-mono-tabular text-[#D99B38]">
                  Circuit Racing · 2 Tracks · 3 AI Opponents
                </div>
                <h2
                  id="game-card-racing"
                  className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-[#F4EFE4]"
                >
                  NIGHT CIRCUIT
                </h2>
                <p className="mt-2.5 text-sm text-[#C3C9D4] leading-relaxed">
                  Battle three rival drivers over three rain-drenched laps. Carve apexes, hold
                  handbrake drifts to charge nitro boost, hit trackside boost pads, and chase the
                  checkered flag.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#202735] pt-5">
                <span className="text-xs font-mono-tabular text-[#98A2B3]">
                  {fastestBestLap !== undefined
                    ? `Best Lap ${formatRaceTime(fastestBestLap)} · ${racingRecords.winsCount} Wins`
                    : 'Obsidian Ring & Harbor Chicane'}
                </span>

                <button
                  type="button"
                  onClick={onSelectRacing}
                  className="inline-flex items-center gap-2 rounded-md bg-[#D99B38] px-5 py-2.5 text-sm font-semibold text-[#0C0E12] transition-colors hover:bg-[#EBB556] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Car className="h-4 w-4" aria-hidden="true" />
                  <span>Play Midnight Racing</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-8 text-xs text-[#7E8798]">
          Switch freely between both games anytime from the title screen or pause menu.
        </footer>
      </main>
    </div>
  );
}
