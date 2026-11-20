import { BookOpen, Compass, Lightbulb, Link2, Pause, Scale, Users, Volume2, VolumeX } from 'lucide-react';
import { formatElapsedTime } from '../game/engine';
import type { WorkspaceTab } from '../game/types';

interface WorkspaceHeaderProps {
  caseTitle: string;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  cluesFound: number;
  totalClues: number;
  contradictionsFound: number;
  totalContradictions: number;
  elapsedSeconds: number;
  muted: boolean;
  onToggleMute: () => void;
  onOpenHint: () => void;
  onOpenAccusation: () => void;
  onOpenPause: () => void;
}

const TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof Compass }> = [
  { id: 'scenes', label: 'Crime Scenes', icon: Compass },
  { id: 'interrogation', label: 'Interrogation', icon: Users },
  { id: 'board', label: 'Evidence Board', icon: Link2 },
  { id: 'notebook', label: 'Notebook', icon: BookOpen },
];

export function WorkspaceHeader({
  caseTitle,
  activeTab,
  onSelectTab,
  cluesFound,
  totalClues,
  contradictionsFound,
  totalContradictions,
  elapsedSeconds,
  muted,
  onToggleMute,
  onOpenHint,
  onOpenAccusation,
  onOpenPause,
}: WorkspaceHeaderProps) {
  return (
    <header className="shrink-0 border-b border-[#252C3A] bg-[#10131A] px-3 py-2 sm:px-5 sm:py-2.5">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left: Case Wordmark & Quiet Tabular Telemetry */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="font-display text-sm sm:text-lg font-semibold text-[#F2ECDC] whitespace-nowrap shrink-0">
              {caseTitle}
            </span>
          </div>
          <div
            aria-label="Investigation progress"
            className="hidden xl:flex items-center gap-2.5 text-xs text-[#98A2B3] font-mono-tabular whitespace-nowrap shrink-0"
          >
            <span>
              Clues <strong className="text-[#EBB556] font-semibold">{cluesFound}/{totalClues}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Links <strong className="text-[#ECE6D8] font-semibold">{contradictionsFound}/{totalContradictions}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatElapsedTime(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Center: Workspace Mode Switcher */}
        <nav
          aria-label="Investigation workspace"
          className="order-3 sm:order-2 flex w-full sm:w-auto items-center justify-between sm:justify-start gap-1 rounded-md bg-[#161B24] p-1 border border-[#232A37] overflow-x-auto"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={(e) => {
                  onSelectTab(tab.id);
                  e.currentTarget.blur();
                }}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded px-2 py-1.5 sm:px-3 text-[11px] sm:text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#D99B38] text-[#0C0E12] font-semibold'
                    : 'text-[#B5BECD] hover:bg-[#1E2430] hover:text-[#F2ECDC]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Primary Verdict Action & Compact Utility Icon Controls */}
        <div className="order-2 sm:order-3 flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              onOpenAccusation();
              e.currentTarget.blur();
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#C93B3B]/70 bg-[#C93B3B]/15 px-3.5 py-1.5 text-xs font-semibold text-[#F4D0D0] transition-colors duration-150 hover:bg-[#C93B3B] hover:text-[#FFF8F6] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Make Accusation</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              onOpenHint();
              e.currentTarget.blur();
            }}
            aria-label="Request investigation hint"
            title="Investigation Hint"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#28303F] bg-[#161B24] text-[#D99B38] transition-colors hover:border-[#D99B38]/60 hover:bg-[#1E2431] cursor-pointer"
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              onToggleMute();
              e.currentTarget.blur();
            }}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#28303F] bg-[#161B24] text-[#C5CCD8] transition-colors hover:border-[#D99B38]/60 hover:text-[#F2ECDC] cursor-pointer"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              onOpenPause();
              e.currentTarget.blur();
            }}
            aria-label="Pause investigation"
            title="Pause [Esc / P]"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#28303F] bg-[#161B24] text-[#C5CCD8] transition-colors hover:border-[#D99B38]/60 hover:text-[#F2ECDC] cursor-pointer"
          >
            <Pause className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
