import React, { useEffect } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { NoirImage } from '../NoirImage';

export type NoirScreenPhase = 'title' | 'playing' | 'paused' | 'gameover';

export function useBodyGameState(phase: NoirScreenPhase) {
  useEffect(() => {
    document.body.dataset.state = phase;
    return () => {
      delete document.body.dataset.state;
    };
  }, [phase]);
}

export function useNoirShortcuts(options: {
  phase: NoirScreenPhase;
  onStart?: () => void;
  onTogglePause?: () => void;
  onToggleMute?: () => void;
  disableLetterHotkeys?: boolean;
}) {
  const { phase, onStart, onTogglePause, onToggleMute, disableLetterHotkeys } = options;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const isInteractive =
        tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (phase === 'title') {
        if ((e.key === 'Enter' || e.key === ' ') && !isInteractive && onStart) {
          e.preventDefault();
          onStart();
        }
        return;
      }

      if (e.key === 'Escape' && (phase === 'playing' || phase === 'paused') && onTogglePause) {
        e.preventDefault();
        onTogglePause();
        return;
      }

      if (disableLetterHotkeys || isInteractive) return;

      if ((e.key === 'p' || e.key === 'P') && (phase === 'playing' || phase === 'paused') && onTogglePause) {
        e.preventDefault();
        onTogglePause();
      } else if ((e.key === 'm' || e.key === 'M') && onToggleMute) {
        e.preventDefault();
        onToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, onStart, onTogglePause, onToggleMute, disableLetterHotkeys]);
}

interface NoirTitleScreenProps {
  title: string;
  subtitle: string;
  eyebrow: string;
  description: string;
  backdropUrl: string;
  statsLine?: string;
  ctaLabel?: string;
  onStart: () => void;
  onSwitchGame: () => void;
  children?: React.ReactNode;
}

export function NoirTitleScreen({
  title,
  subtitle,
  eyebrow,
  description,
  backdropUrl,
  statsLine,
  ctaLabel = 'Begin Match',
  onStart,
  onSwitchGame,
  children,
}: NoirTitleScreenProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0A0C10] text-[#ECEFF4]">
      <div className="absolute inset-0">
        <NoirImage
          src={backdropUrl}
          alt={title}
          fallbackTitle={title}
          className="h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0C10] via-[#0A0C10]/70 to-[#0A0C10]/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0C10]/90 via-[#0A0C10]/55 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col justify-between px-6 py-8 md:px-12 md:py-12">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onSwitchGame}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 border border-white/15 bg-[#0E1117]/80 px-3.5 py-2 text-xs font-medium tracking-wider text-[#D0D7E2] uppercase transition hover:border-[#D4A853]/60 hover:text-[#F5D28A]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Switch Game
          </button>
          <span className="font-mono text-xs tracking-[0.22em] text-[#D4A853] uppercase">
            {eyebrow}
          </span>
        </div>

        <div className="my-auto max-w-2xl py-8">
          <p className="font-mono text-xs tracking-[0.28em] text-[#D4A853]/90 uppercase">
            {subtitle}
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-[#F8FAFC] sm:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#CBD5E1] sm:text-base">
            {description}
          </p>

          {children ? <div className="mt-6">{children}</div> : null}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 bg-[#D4A853] px-7 py-3.5 text-sm font-semibold tracking-wider text-[#0B0D11] uppercase transition hover:bg-[#E2BA6A] active:scale-[0.99]"
            >
              <Play className="h-4 w-4 fill-current" />
              {ctaLabel}
            </button>
            {statsLine ? (
              <span className="font-mono text-xs tracking-wide text-[#94A3B8]">{statsLine}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-[#94A3B8]">
          <span>Press Enter or Space to start</span>
          <span>100% Local Engine · Instant Play</span>
        </div>
      </div>
    </div>
  );
}

interface NoirGameHeaderProps {
  title: string;
  subtitle?: string;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSwitchGame: () => void;
  rightSlot?: React.ReactNode;
}

export function NoirGameHeader({
  title,
  subtitle,
  muted,
  onToggleMute,
  onPause,
  onRestart,
  onSwitchGame,
  rightSlot,
}: NoirGameHeaderProps) {
  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0C0F15]/92 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onSwitchGame}
          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-medium tracking-wider text-[#D0D7E2] uppercase transition hover:border-[#D4A853]/60 hover:text-[#F5D28A]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Switch Game
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-base font-semibold tracking-wide text-[#F8FAFC] sm:text-lg">
            {title}
          </h1>
          {subtitle ? (
            <p className="hidden truncate text-[11px] tracking-wider text-[#94A3B8] uppercase sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {rightSlot}
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          title={muted ? 'Unmute (M)' : 'Mute (M)'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-white/[0.03] text-[#CBD5E1] transition hover:border-[#D4A853]/60 hover:text-[#F5D28A]"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onRestart}
          aria-label="Restart game"
          title="Restart"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-white/[0.03] text-[#CBD5E1] transition hover:border-[#D4A853]/60 hover:text-[#F5D28A]"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onPause}
          aria-label="Pause game"
          title="Pause (Esc)"
          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 border border-[#D4A853]/40 bg-[#D4A853]/10 px-3 py-1.5 text-xs font-medium tracking-wider text-[#F5D28A] uppercase transition hover:bg-[#D4A853]/20"
        >
          <Pause className="h-3.5 w-3.5" />
          Pause
        </button>
      </div>
    </header>
  );
}

interface NoirPauseModalProps {
  title: string;
  onResume: () => void;
  onRestart: () => void;
  onSwitchGame: () => void;
}

export function NoirPauseModal({
  title,
  onResume,
  onRestart,
  onSwitchGame,
}: NoirPauseModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} paused`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm border border-[#D4A853]/35 bg-[#0F131B] p-6 shadow-2xl">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[#D4A853] uppercase">
          Match Paused
        </p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-[#F8FAFC]">{title}</h2>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full bg-[#D4A853] px-4 py-2.5 text-xs font-semibold tracking-wider text-[#0B0D11] uppercase transition hover:bg-[#E2BA6A]"
          >
            Resume Match
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-medium tracking-wider text-[#E2E8F0] uppercase transition hover:border-[#D4A853]/50"
          >
            Restart Fresh
          </button>
          <button
            type="button"
            onClick={onSwitchGame}
            className="w-full border border-white/10 px-4 py-2.5 text-xs font-medium tracking-wider text-[#94A3B8] uppercase transition hover:border-white/25 hover:text-[#F8FAFC]"
          >
            Switch Game
          </button>
        </div>
      </div>
    </div>
  );
}

interface NoirOutcomeModalProps {
  outcome: 'win' | 'loss' | 'draw';
  headline: string;
  summary: string;
  onPlayAgain: () => void;
  onSwitchGame: () => void;
}

export function NoirOutcomeModal({
  outcome,
  headline,
  summary,
  onPlayAgain,
  onSwitchGame,
}: NoirOutcomeModalProps) {
  const accent =
    outcome === 'win'
      ? 'text-[#D4A853] border-[#D4A853]/45'
      : outcome === 'loss'
      ? 'text-[#F87171] border-[#F87171]/35'
      : 'text-[#94A3B8] border-white/20';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className={`w-full max-w-md border bg-[#0F131B] p-6 shadow-2xl ${accent}`}>
        <p className="font-mono text-[11px] tracking-[0.25em] uppercase">
          {outcome === 'win' ? 'Victory' : outcome === 'loss' ? 'Match Concluded' : 'Stalemate'}
        </p>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-[#F8FAFC]">{headline}</h2>
        <p className="mt-2 text-sm text-[#CBD5E1]">{summary}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 whitespace-nowrap bg-[#D4A853] px-4 py-2.5 text-xs font-semibold tracking-wider text-[#0B0D11] uppercase transition hover:bg-[#E2BA6A]"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onSwitchGame}
            className="flex-1 whitespace-nowrap border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-medium tracking-wider text-[#E2E8F0] uppercase transition hover:border-[#D4A853]/50"
          >
            Switch Game
          </button>
        </div>
      </div>
    </div>
  );
}
