import { useCallback, useEffect, useMemo, useState } from 'react';
import { Delete, Lightbulb, Shield } from 'lucide-react';
import {
  CIPHER_MAX_ATTEMPTS,
  CipherHint,
  CipherState,
  LetterStatus,
  appendCipherLetter,
  backspaceCipherLetter,
  createInitialCipherState,
  getKeyboardStatuses,
  getRemainingCandidates,
  recommendCipherGuess,
  submitCipherGuess,
} from '../../arcade/cipher';
import { loadExtraRecord, saveExtraGameOutcome } from '../../arcade/records';
import { playArcadeSfx } from '../../arcade/sound';
import {
  NoirGameHeader,
  NoirOutcomeModal,
  NoirPauseModal,
  NoirScreenPhase,
  NoirTitleScreen,
  useBodyGameState,
  useNoirShortcuts,
} from './NoirGameShell';

interface CipherGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

function tileStyle(status: LetterStatus): string {
  switch (status) {
    case 'correct':
      return 'border-emerald-400 bg-emerald-700/85 text-white';
    case 'present':
      return 'border-[#D4A853] bg-[#A3741C]/85 text-white';
    case 'absent':
      return 'border-white/10 bg-[#1B212E] text-[#94A3B8]';
    default:
      return 'border-white/15 bg-[#0D1119] text-[#F8FAFC]';
  }
}

export function CipherGame({ backdropUrl, autoStart, onSwitchGame }: CipherGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [hardMode, setHardMode] = useState(false);
  const [state, setState] = useState<CipherState>(() => createInitialCipherState(false));
  const [hint, setHint] = useState<CipherHint | null>(null);
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('cipher'));

  useBodyGameState(phase);

  const startFresh = useCallback(
    (nextHard?: boolean) => {
      const hm = nextHard ?? hardMode;
      setHardMode(hm);
      setState(createInitialCipherState(hm));
      setHint(null);
      setPhase('playing');
    },
    [hardMode]
  );

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p));
  }, []);

  useNoirShortcuts({
    phase,
    onStart: () => startFresh(),
    onTogglePause: togglePause,
    onToggleMute: () => setMuted((m) => !m),
    disableLetterHotkeys: true,
  });

  const keyStatuses = useMemo(() => getKeyboardStatuses(state.rows), [state.rows]);
  const remainingCount = useMemo(() => getRemainingCandidates(state.rows).length, [state.rows]);

  const handleSubmit = useCallback(() => {
    if (phase !== 'playing' || state.status !== 'playing') return;
    const next = submitCipherGuess(state);
    setState(next);
    if (next.error) {
      playArcadeSfx(muted, 'error');
      return;
    }
    setHint(null);
    if (next.status === 'won') {
      playArcadeSfx(muted, 'win');
      const score = (CIPHER_MAX_ATTEMPTS - next.rows.length + 1) * 200;
      setRecord(saveExtraGameOutcome('cipher', { outcome: 'win', score }));
      setPhase('gameover');
    } else if (next.status === 'lost') {
      playArcadeSfx(muted, 'lose');
      setRecord(saveExtraGameOutcome('cipher', { outcome: 'loss' }));
      setPhase('gameover');
    } else {
      playArcadeSfx(muted, 'flip');
    }
  }, [phase, state, muted]);

  const handleLetter = useCallback(
    (ch: string) => {
      if (phase !== 'playing' || state.status !== 'playing') return;
      setState((prev) => appendCipherLetter(prev, ch));
      playArcadeSfx(muted, 'tap');
    },
    [phase, state.status, muted]
  );

  const handleBackspace = useCallback(() => {
    if (phase !== 'playing' || state.status !== 'playing') return;
    setState((prev) => backspaceCipherLetter(prev));
    playArcadeSfx(muted, 'tap');
  }, [phase, state.status, muted]);

  const handleEntropyHint = () => {
    if (phase !== 'playing' || state.status !== 'playing') return;
    const rec = recommendCipherGuess(state);
    if (rec) {
      setHint(rec);
      setState((prev) => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
      playArcadeSfx(muted, 'hint');
    }
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleLetter(e.key.toUpperCase());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleSubmit, handleBackspace, handleLetter]);

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="CIPHER VAULT"
        subtitle="5-Letter Deduction · Shannon Entropy Engine"
        eyebrow="Puzzles & Logic"
        description="Break the 5-letter syndicate passcode in six attempts. Features full physical & tactile keyboard support, optional Hard Mode, and an Information-Entropy Hint Engine that ranks optimal guesses by bits of information gained."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins} Codes Broken · Streak ${record.streak} (Best ${record.bestStreak})`}
        ctaLabel="Decrypt Code"
        onStart={() => startFresh()}
        onSwitchGame={onSwitchGame}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHardMode((v) => !v)}
            className={`inline-flex items-center gap-2 border px-4 py-2 text-xs font-medium tracking-wider uppercase transition ${
              hardMode
                ? 'border-[#D4A853] bg-[#D4A853]/18 text-[#F5D28A]'
                : 'border-white/15 bg-[#0E1117]/80 text-[#CBD5E1]'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            Hard Mode: {hardMode ? 'On' : 'Off'}
          </button>
        </div>
      </NoirTitleScreen>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#080A0F] text-[#ECEFF4]">
      <NoirGameHeader
        title="CIPHER VAULT"
        subtitle={`${hardMode ? 'HARD MODE · ' : ''}ATTEMPT ${Math.min(state.rows.length + 1, CIPHER_MAX_ATTEMPTS)}/${CIPHER_MAX_ATTEMPTS}`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={() => startFresh()}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <span className="hidden font-mono text-xs text-[#94A3B8] sm:inline">
            {remainingCount} LEXICON CANDIDATES
          </span>
        }
      />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-5">
        <div className="mb-3 flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleEntropyHint}
            className="inline-flex items-center gap-1.5 border border-[#D4A853]/45 bg-[#D4A853]/12 px-3 py-1.5 text-xs font-medium tracking-wider text-[#F5D28A] uppercase transition hover:bg-[#D4A853]/22"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Entropy Hint
          </button>
          <span className="font-mono text-xs text-[#94A3B8]">
            STREAK: <strong className="text-[#F5D28A]">{record.streak}</strong>
          </span>
        </div>

        {hint && (
          <div className="mb-3 flex w-full items-center justify-between gap-3 border border-emerald-400/40 bg-emerald-950/35 px-3.5 py-2.5 text-xs">
            <div>
              <span className="font-mono font-semibold text-emerald-300 uppercase">
                Optimal Probe: {hint.word}
              </span>
              <p className="mt-0.5 text-[#CBD5E1]">{hint.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setState((prev) => ({ ...prev, currentInput: hint.word, error: null }));
                playArcadeSfx(muted, 'tap');
              }}
              className="shrink-0 bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[#06130E] uppercase hover:bg-emerald-300"
            >
              Fill
            </button>
          </div>
        )}

        {state.error && (
          <p role="alert" className="mb-2 text-xs font-medium text-[#FCA5A5]">
            {state.error}
          </p>
        )}

        {/* 6x5 Mechanical Split-Flap Grid */}
        <div className="grid w-full max-w-[330px] grid-rows-6 gap-2">
          {Array.from({ length: CIPHER_MAX_ATTEMPTS }, (_, r) => {
            const submitted = state.rows[r];
            const isActive = r === state.rows.length && state.status === 'playing';
            const word = submitted ? submitted.guess : isActive ? state.currentInput : '';
            return (
              <div key={r} className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }, (_, c) => {
                  const ch = word[c] ?? '';
                  const st: LetterStatus = submitted ? submitted.statuses[c] : 'empty';
                  return (
                    <div
                      key={c}
                      data-cipher-tile={`${r}-${c}`}
                      className={`flex aspect-square items-center justify-center border-2 font-mono text-2xl font-bold uppercase transition-all duration-300 ${tileStyle(st)} ${
                        isActive && ch ? 'border-[#D4A853]/75' : ''
                      }`}
                    >
                      {ch}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Tactile QWERTY Keyboard */}
        <div className="mt-6 flex w-full flex-col gap-1.5">
          {KEY_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
              {row.map((key) => {
                const isAction = key === 'ENTER' || key === 'BACK';
                const status = isAction ? 'empty' : keyStatuses[key] ?? 'empty';
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={key === 'BACK' ? 'Backspace' : key}
                    onClick={() => {
                      if (key === 'ENTER') handleSubmit();
                      else if (key === 'BACK') handleBackspace();
                      else handleLetter(key);
                    }}
                    className={`flex h-11 items-center justify-center border font-mono text-xs font-semibold uppercase transition active:scale-95 ${
                      isAction ? 'px-2.5 sm:px-3.5 text-[11px]' : 'flex-1 max-w-[44px]'
                    } ${
                      status === 'correct'
                        ? 'border-emerald-400 bg-emerald-700 text-white'
                        : status === 'present'
                        ? 'border-[#D4A853] bg-[#A3741C] text-white'
                        : status === 'absent'
                        ? 'border-white/5 bg-[#121620] text-[#64748B]'
                        : 'border-white/15 bg-[#1B2230] text-[#F1F5F9] hover:border-[#D4A853]/60'
                    }`}
                  >
                    {key === 'BACK' ? <Delete className="h-4 w-4" /> : key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </main>

      {phase === 'paused' && (
        <NoirPauseModal
          title="CIPHER VAULT"
          onResume={() => setPhase('playing')}
          onRestart={() => startFresh()}
          onSwitchGame={onSwitchGame}
        />
      )}

      {phase === 'gameover' && (
        <NoirOutcomeModal
          outcome={state.status === 'won' ? 'win' : 'loss'}
          headline={
            state.status === 'won'
              ? `Vault Cracked: ${state.target}`
              : `Passcode Was ${state.target}`
          }
          summary={
            state.status === 'won'
              ? `Decrypted in ${state.rows.length} of ${CIPHER_MAX_ATTEMPTS} attempts.`
              : 'All six attempts exhausted. Reset to decrypt a fresh syndicate vault code.'
          }
          onPlayAgain={() => startFresh()}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
