/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AccusationModal } from './components/AccusationModal';
import { BLACKJACK_BACKDROP_URL, BlackjackGame } from './components/BlackjackGame';
import { CaseResultScreen } from './components/CaseResultScreen';
import { CHESS_BACKDROP_URL, ChessGame } from './components/ChessGame';
import { CinematicCameraOverlay } from './components/CinematicCameraOverlay';
import { CrimeSceneView } from './components/CrimeSceneView';
import { DetectiveNotebook } from './components/DetectiveNotebook';
import { EvidenceBoard } from './components/EvidenceBoard';
import { GameLauncher, type LaunchableGameId } from './components/GameLauncher';
import { HintModal } from './components/HintModal';
import { InterrogationRoom } from './components/InterrogationRoom';
import { PauseModal } from './components/PauseModal';
import { RacingGame } from './components/RacingGame';
import { SNAKE_BACKDROP_URL, SnakeGame } from './components/SnakeGame';
import { TETRIS_BACKDROP_URL, TetrisGame } from './components/TetrisGame';
import { TILES2048_BACKDROP_URL, Tiles2048Game } from './components/Tiles2048Game';
import { TitleScreen } from './components/TitleScreen';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { loadBlackjackRecords, type BlackjackRecords } from './blackjack/engine';
import { loadChessRecords } from './chess/engine';
import type { ChessRecords } from './chess/types';
import { loadRacingRecords, type RacingRecords } from './racing/engine';
import { loadSnakeRecords, type SnakeRecords } from './snake/engine';
import { loadTetrisRecords, type TetrisRecords } from './tetris/engine';
import { load2048Records, type Records2048 } from './tiles2048/engine';
import {
  getLocationTransitionPreset,
  getWorkspaceCameraVariants,
  type NarrativeBeat,
} from './game/camera';
import { MIDNIGHT_DISAPPEARANCE_CASE } from './game/cases/midnightDisappearance';
import {
  STORAGE_KEY_PREFIX,
  collectClue,
  createInitialInvestigationState,
  deserializeInvestigationState,
  evaluateAccusation,
  getContextualHint,
  linkEvidenceClues,
  moveBoardCard,
  recordInterrogationTurn,
  removeEvidenceLink,
  serializeInvestigationState,
  visitLocation,
} from './game/engine';
import type {
  AccusationPayload,
  GamePhase,
  HintSuggestion,
  InterrogationMessage,
  InvestigationState,
  WorkspaceTab,
} from './game/types';
import { noirAudio } from './utils/audio';

const ACTIVE_CASE = MIDNIGHT_DISAPPEARANCE_CASE;
const SAVE_KEY = `${STORAGE_KEY_PREFIX}${ACTIVE_CASE.id}`;
const RACING_BACKDROP_URL = '/src/assets/images/racing_midnight_circuit_1795262317862.jpg';

type SelectedGame = 'hub' | LaunchableGameId;

function loadSavedState(): InvestigationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return deserializeInvestigationState(raw, ACTIVE_CASE);
  } catch {
    return null;
  }
}

function getInitialSelectedGame(): SelectedGame {
  if (typeof window === 'undefined') return 'hub';
  const params = new URLSearchParams(window.location.search);
  const game = params.get('game');
  if (
    game === 'racing' ||
    game === 'chess' ||
    game === '2048' ||
    game === 'snake' ||
    game === 'tetris' ||
    game === 'blackjack'
  ) {
    return game;
  }
  if (game === 'detective' || params.get('autostart') === '1') return 'detective';
  return 'hub';
}

function getAutoStartFor(target: LaunchableGameId): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('game') === target && params.get('autostart') === '1';
}

export default function App() {
  const [selectedGame, setSelectedGame] = useState<SelectedGame>(() => getInitialSelectedGame());
  const [racingAutoStart] = useState<boolean>(() => getAutoStartFor('racing'));
  const [chessAutoStart] = useState<boolean>(() => getAutoStartFor('chess'));
  const [tiles2048AutoStart] = useState<boolean>(() => getAutoStartFor('2048'));
  const [snakeAutoStart] = useState<boolean>(() => getAutoStartFor('snake'));
  const [tetrisAutoStart] = useState<boolean>(() => getAutoStartFor('tetris'));
  const [blackjackAutoStart] = useState<boolean>(() => getAutoStartFor('blackjack'));

  const [racingRecords, setRacingRecords] = useState<RacingRecords>(() => loadRacingRecords());
  const [chessRecords, setChessRecords] = useState<ChessRecords>(() => loadChessRecords());
  const [records2048, setRecords2048] = useState<Records2048>(() => load2048Records());
  const [snakeRecords, setSnakeRecords] = useState<SnakeRecords>(() => loadSnakeRecords());
  const [tetrisRecords, setTetrisRecords] = useState<TetrisRecords>(() => loadTetrisRecords());
  const [blackjackRecords, setBlackjackRecords] = useState<BlackjackRecords>(() =>
    loadBlackjackRecords()
  );

  const [savedSnapshot, setSavedSnapshot] = useState<InvestigationState | null>(() =>
    loadSavedState()
  );

  const [phase, setPhase] = useState<GamePhase>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const g = params.get('game');
      if (params.get('autostart') === '1' && (!g || g === 'detective')) {
        return 'playing';
      }
    }
    return 'title';
  });

  const [state, setState] = useState<InvestigationState>(() => {
    const existing = loadSavedState();
    return existing ?? createInitialInvestigationState(ACTIVE_CASE);
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('scenes');
  const [activeSuspectId, setActiveSuspectId] = useState<string>(ACTIVE_CASE.suspects[0].id);
  const [muted, setMuted] = useState<boolean>(false);
  const [activeHint, setActiveHint] = useState<HintSuggestion | null>(null);
  const [showAccusation, setShowAccusation] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [narrativeBeat, setNarrativeBeat] = useState<NarrativeBeat | null>(null);

  const beatTimerRef = useRef<number | null>(null);

  const triggerNarrativeBeat = useCallback((beat: Omit<NarrativeBeat, 'id'>) => {
    if (beatTimerRef.current !== null) {
      window.clearTimeout(beatTimerRef.current);
    }
    const id = `beat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setNarrativeBeat({ ...beat, id });
    beatTimerRef.current = window.setTimeout(() => {
      setNarrativeBeat(null);
      beatTimerRef.current = null;
    }, beat.durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (beatTimerRef.current !== null) {
        window.clearTimeout(beatTimerRef.current);
      }
    };
  }, []);

  // Mirror game state machine to document.body.dataset.state for hub & detective mode
  useEffect(() => {
    if (selectedGame === 'hub') {
      document.body.dataset.state = 'title';
    } else if (selectedGame === 'detective') {
      document.body.dataset.state = phase;
    }
  }, [selectedGame, phase]);

  // Persist investigation state whenever playing or completed
  useEffect(() => {
    if (selectedGame !== 'detective' || phase === 'title') return;
    try {
      window.localStorage.setItem(SAVE_KEY, serializeInvestigationState(state));
      setSavedSnapshot(state);
    } catch {
      // Ignore storage quota errors
    }
  }, [state, phase, selectedGame]);

  // Elapsed timer ticks once per second only during active detective play
  useEffect(() => {
    if (selectedGame !== 'detective' || phase !== 'playing') return;
    const timer = window.setInterval(() => {
      setState((prev) => ({
        ...prev,
        elapsedSeconds: prev.elapsedSeconds + 1,
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, selectedGame]);

  // Auto-clear brief toast notifications
  useEffect(() => {
    if (!toastText) return;
    const t = window.setTimeout(() => setToastText(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastText]);

  // Silence detective ambient audio on pause/gameover or when outside detective mode
  useEffect(() => {
    if (selectedGame !== 'detective' || phase === 'paused' || phase === 'gameover' || phase === 'title') {
      noirAudio.pauseAmbience();
    } else if (phase === 'playing') {
      noirAudio.resumeAmbienceIfEnabled();
    }
  }, [phase, selectedGame]);

  useEffect(() => {
    return () => {
      noirAudio.stopRainAmbience();
    };
  }, []);

  const handleReturnToHub = useCallback(() => {
    noirAudio.pauseAmbience();
    setActiveHint(null);
    setShowAccusation(false);
    setPhase('title');
    setSavedSnapshot(loadSavedState());
    setRacingRecords(loadRacingRecords());
    setChessRecords(loadChessRecords());
    setRecords2048(load2048Records());
    setSnakeRecords(loadSnakeRecords());
    setTetrisRecords(loadTetrisRecords());
    setBlackjackRecords(loadBlackjackRecords());
    document.body.dataset.state = 'title';
    setSelectedGame('hub');
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = noirAudio.toggleMute();
    setMuted(nextMuted);
  }, []);

  // Global detective keyboard shortcuts: Esc / P to pause/resume, M to toggle audio
  useEffect(() => {
    if (selectedGame !== 'detective') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        if (activeHint) {
          setActiveHint(null);
          return;
        }
        if (showAccusation) {
          setShowAccusation(false);
          return;
        }
        if (phase === 'playing') {
          setPhase('paused');
        } else if (phase === 'paused') {
          setPhase('playing');
        }
        return;
      }

      if (typing) return;

      if (e.key === 'p' || e.key === 'P') {
        if (phase === 'playing' && !activeHint && !showAccusation) {
          setPhase('paused');
        } else if (phase === 'paused') {
          setPhase('playing');
        }
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedGame, phase, activeHint, showAccusation, handleToggleMute]);

  const handleStartNewCase = useCallback(() => {
    const fresh = createInitialInvestigationState(ACTIVE_CASE);
    setState(fresh);
    setActiveTab('scenes');
    setActiveSuspectId(ACTIVE_CASE.suspects[0].id);
    setActiveHint(null);
    setShowAccusation(false);
    document.body.dataset.state = 'playing';
    setPhase('playing');
    noirAudio.playCameraTransition();
    noirAudio.startRainAmbience();
    const openingLoc = ACTIVE_CASE.locations[0];
    if (openingLoc) {
      triggerNarrativeBeat({
        kind: 'location',
        kicker: `${ACTIVE_CASE.caseNumber} · ${openingLoc.floorLabel}`,
        headline: openingLoc.name,
        durationMs: 1150,
        letterbox: true,
        vignetteStrength: 'tight',
      });
    }
  }, [triggerNarrativeBeat]);

  const handleResumeCase = useCallback(() => {
    const loaded = loadSavedState();
    if (loaded) {
      setState(loaded);
      if (loaded.accusationResult) {
        document.body.dataset.state = 'gameover';
        setPhase('gameover');
        return;
      }
    }
    document.body.dataset.state = 'playing';
    setPhase('playing');
    noirAudio.playCameraTransition();
    noirAudio.startRainAmbience();
    const activeLoc =
      ACTIVE_CASE.locations.find((l) => l.id === (loaded?.activeLocationId ?? '')) ??
      ACTIVE_CASE.locations[0];
    if (activeLoc) {
      triggerNarrativeBeat({
        kind: 'location',
        kicker: 'RESUMING INVESTIGATION',
        headline: activeLoc.name,
        durationMs: 950,
        letterbox: true,
        vignetteStrength: 'normal',
      });
    }
  }, [triggerNarrativeBeat]);

  const handleSelectTab = useCallback(
    (tab: WorkspaceTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      if (tab === 'interrogation') {
        noirAudio.playCameraTransition();
        const s = ACTIVE_CASE.suspects.find((item) => item.id === activeSuspectId);
        triggerNarrativeBeat({
          kind: 'interrogation',
          kicker: 'INTERROGATION CHAMBER',
          headline: s?.name ?? 'Suspect Questioning',
          durationMs: 850,
          letterbox: true,
          vignetteStrength: 'tight',
        });
      } else {
        noirAudio.playClick();
      }
    },
    [activeTab, activeSuspectId, triggerNarrativeBeat]
  );

  const handleSelectLocation = useCallback(
    (locationId: string) => {
      if (locationId === state.activeLocationId) return;
      const preset = getLocationTransitionPreset(state.activeLocationId, locationId);
      const nextLoc = ACTIVE_CASE.locations.find((l) => l.id === locationId);
      noirAudio.playCameraTransition();
      setState((prev) => visitLocation(prev, locationId));
      if (nextLoc) {
        triggerNarrativeBeat({
          kind: 'location',
          kicker: `${preset.directionLabel} · ${nextLoc.floorLabel}`,
          headline: nextLoc.name,
          durationMs: 900,
          letterbox: true,
          vignetteStrength: 'tight',
        });
      }
    },
    [state.activeLocationId, triggerNarrativeBeat]
  );

  const handleCollectClue = useCallback((clueId: string) => {
    setState((prev) => {
      const { state: next, newlyCollected } = collectClue(prev, ACTIVE_CASE, clueId);
      if (newlyCollected) {
        noirAudio.playClueDiscover();
        const clue = ACTIVE_CASE.clues.find((c) => c.id === clueId);
        if (clue) {
          setToastText(`Logged ${clue.code}: ${clue.title}`);
        }
      }
      return next;
    });
  }, []);

  const handleMoveBoardCard = useCallback((clueId: string, x: number, y: number) => {
    setState((prev) => moveBoardCard(prev, clueId, x, y));
  }, []);

  const handleLinkClues = useCallback(
    (fromClueId: string, toClueId: string) => {
      let outcome: {
        matchedTitle?: string;
        duplicate?: boolean;
        status?: 'confirmed' | 'speculation';
      } = {};

      setState((prev) => {
        const res = linkEvidenceClues(prev, ACTIVE_CASE, fromClueId, toClueId);
        if (res.duplicate) {
          outcome = { duplicate: true };
          return prev;
        }
        if (res.matchedContradiction) {
          noirAudio.playContradictionSting();
          outcome = {
            status: 'confirmed',
            matchedTitle: res.matchedContradiction.title,
          };
          triggerNarrativeBeat({
            kind: 'contradiction',
            kicker: 'CONTRADICTION EXPOSED',
            headline: res.matchedContradiction.title,
            durationMs: 1200,
            letterbox: true,
            vignetteStrength: 'crimson',
          });
        } else if (res.createdLink) {
          noirAudio.playLinkSnap();
          outcome = { status: 'speculation' };
        }
        return res.state;
      });

      return outcome;
    },
    [triggerNarrativeBeat]
  );

  const handleRemoveLink = useCallback((linkId: string) => {
    noirAudio.playClick();
    setState((prev) => removeEvidenceLink(prev, linkId));
  }, []);

  const handleRecordInterrogation = useCallback(
    (suspectId: string, detectiveMsg: InterrogationMessage, suspectMsg: InterrogationMessage) => {
      if (suspectMsg.contradictionFlag || suspectMsg.unlockedTestimonyId) {
        noirAudio.playContradictionSting();
        const suspect = ACTIVE_CASE.suspects.find((s) => s.id === suspectId);
        const unlocked = suspect?.unlockableTestimonies.find(
          (t) => t.id === suspectMsg.unlockedTestimonyId
        );
        triggerNarrativeBeat({
          kind: 'contradiction',
          kicker: unlocked ? 'KEY TESTIMONY UNLOCKED' : 'STATEMENT CHALLENGED',
          headline: unlocked?.title ?? `${suspect?.name ?? 'Suspect'} Rattled`,
          durationMs: 1150,
          letterbox: true,
          vignetteStrength: 'crimson',
        });
      } else {
        noirAudio.playClick();
      }
      setState((prev) => recordInterrogationTurn(prev, suspectId, detectiveMsg, suspectMsg));
    },
    [triggerNarrativeBeat]
  );

  const handleOpenHint = useCallback(() => {
    noirAudio.playClick();
    const suggestion = getContextualHint(ACTIVE_CASE, state);
    setState((prev) => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
    setActiveHint(suggestion);
  }, [state]);

  const handleFollowHint = useCallback(
    (hint: HintSuggestion) => {
      setActiveHint(null);
      if (hint.targetLocationId && hint.targetLocationId !== state.activeLocationId) {
        handleSelectLocation(hint.targetLocationId);
      }
      if (hint.targetSuspectId) {
        setActiveSuspectId(hint.targetSuspectId);
      }
      handleSelectTab(hint.recommendedTab);
    },
    [handleSelectLocation, handleSelectTab, state.activeLocationId]
  );

  const handleSubmitAccusation = useCallback(
    (payload: AccusationPayload) => {
      const result = evaluateAccusation(ACTIVE_CASE, state, payload);
      setState((prev) => ({
        ...prev,
        accusationResult: result,
      }));
      setShowAccusation(false);
      document.body.dataset.state = 'gameover';
      setPhase('gameover');
      noirAudio.playVerdict(result.outcome === 'solved');
      triggerNarrativeBeat({
        kind: 'verdict',
        kicker: `${ACTIVE_CASE.caseNumber} · FINAL VERDICT`,
        headline: result.outcome === 'solved' ? 'Warrant Executed' : 'Case Concluded',
        durationMs: 1100,
        letterbox: true,
        vignetteStrength: result.outcome === 'solved' ? 'tight' : 'crimson',
      });
    },
    [state, triggerNarrativeBeat]
  );

  const hasDetectiveProgress =
    !!savedSnapshot &&
    (savedSnapshot.discoveredClueIds.length > 0 ||
      savedSnapshot.questionedSuspectIds.length > 0) &&
    !savedSnapshot.accusationResult;

  if (selectedGame === 'hub') {
    return (
      <GameLauncher
        backdrops={{
          detective: ACTIVE_CASE.titleBackdropUrl,
          racing: RACING_BACKDROP_URL,
          chess: CHESS_BACKDROP_URL,
          '2048': TILES2048_BACKDROP_URL,
          snake: SNAKE_BACKDROP_URL,
          tetris: TETRIS_BACKDROP_URL,
          blackjack: BLACKJACK_BACKDROP_URL,
        }}
        hasSavedCase={hasDetectiveProgress}
        savedClueCount={savedSnapshot?.discoveredClueIds.length ?? 0}
        totalClues={ACTIVE_CASE.clues.length}
        racingRecords={racingRecords}
        chessRecords={chessRecords}
        records2048={records2048}
        snakeRecords={snakeRecords}
        tetrisRecords={tetrisRecords}
        blackjackRecords={blackjackRecords}
        onSelectGame={(game) => {
          if (game === 'detective') {
            setPhase('title');
          }
          setSelectedGame(game);
        }}
      />
    );
  }

  if (selectedGame === 'racing') {
    return <RacingGame autoStart={racingAutoStart} onSwitchGame={handleReturnToHub} />;
  }

  if (selectedGame === 'chess') {
    return <ChessGame autoStart={chessAutoStart} onSwitchGame={handleReturnToHub} />;
  }

  if (selectedGame === '2048') {
    return <Tiles2048Game autoStart={tiles2048AutoStart} onSwitchGame={handleReturnToHub} />;
  }

  if (selectedGame === 'snake') {
    return <SnakeGame autoStart={snakeAutoStart} onSwitchGame={handleReturnToHub} />;
  }

  if (selectedGame === 'tetris') {
    return <TetrisGame autoStart={tetrisAutoStart} onSwitchGame={handleReturnToHub} />;
  }

  if (selectedGame === 'blackjack') {
    return <BlackjackGame autoStart={blackjackAutoStart} onSwitchGame={handleReturnToHub} />;
  }

  if (phase === 'title') {
    return (
      <TitleScreen
        backdropUrl={ACTIVE_CASE.titleBackdropUrl}
        hasSavedCase={hasDetectiveProgress}
        savedClueCount={savedSnapshot?.discoveredClueIds.length ?? 0}
        totalClues={ACTIVE_CASE.clues.length}
        onStartNewCase={handleStartNewCase}
        onResumeCase={handleResumeCase}
        onSwitchGame={handleReturnToHub}
      />
    );
  }

  if (phase === 'gameover' && state.accusationResult) {
    return (
      <>
        <CaseResultScreen
          caseFile={ACTIVE_CASE}
          result={state.accusationResult}
          onPlayAgain={handleStartNewCase}
          onReturnTitle={() => {
            document.body.dataset.state = 'title';
            setPhase('title');
          }}
        />
        <CinematicCameraOverlay beat={narrativeBeat} />
      </>
    );
  }

  const workspaceVariants = getWorkspaceCameraVariants(activeTab);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0C0E12]">
      <WorkspaceHeader
        caseTitle={ACTIVE_CASE.title}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        cluesFound={state.discoveredClueIds.length}
        totalClues={ACTIVE_CASE.clues.length}
        contradictionsFound={state.unlockedContradictionIds.length}
        totalContradictions={ACTIVE_CASE.contradictions.length}
        elapsedSeconds={state.elapsedSeconds}
        muted={muted}
        onToggleMute={handleToggleMute}
        onOpenHint={handleOpenHint}
        onOpenAccusation={() => {
          noirAudio.playClick();
          setShowAccusation(true);
        }}
        onOpenPause={() => {
          noirAudio.playClick();
          setPhase('paused');
        }}
      />

      <main className="relative flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={workspaceVariants.initial}
            animate={workspaceVariants.animate}
            exit={workspaceVariants.exit}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="h-full w-full will-change-transform"
          >
            {activeTab === 'scenes' && (
              <CrimeSceneView
                caseFile={ACTIVE_CASE}
                activeLocationId={state.activeLocationId}
                discoveredClueIds={state.discoveredClueIds}
                onSelectLocation={handleSelectLocation}
                onCollectClue={handleCollectClue}
                onOpenOnBoard={() => handleSelectTab('board')}
              />
            )}

            {activeTab === 'interrogation' && (
              <InterrogationRoom
                caseFile={ACTIVE_CASE}
                activeSuspectId={activeSuspectId}
                onSelectSuspect={(id) => {
                  noirAudio.playClick();
                  setActiveSuspectId(id);
                }}
                discoveredClueIds={state.discoveredClueIds}
                unlockedTestimonyIds={state.unlockedTestimonyIds}
                suspectEmotions={state.suspectEmotions}
                dialogueHistory={state.dialogueHistory}
                onRecordTurn={handleRecordInterrogation}
              />
            )}

            {activeTab === 'board' && (
              <EvidenceBoard
                caseFile={ACTIVE_CASE}
                discoveredClueIds={state.discoveredClueIds}
                boardPositions={state.boardPositions}
                evidenceLinks={state.evidenceLinks}
                unlockedContradictionIds={state.unlockedContradictionIds}
                onMoveCard={handleMoveBoardCard}
                onLinkClues={handleLinkClues}
                onRemoveLink={handleRemoveLink}
                onGoToScenes={() => handleSelectTab('scenes')}
              />
            )}

            {activeTab === 'notebook' && (
              <DetectiveNotebook
                caseFile={ACTIVE_CASE}
                state={state}
                onJumpToLocation={(locId) => {
                  handleSelectLocation(locId);
                  handleSelectTab('scenes');
                }}
                onJumpToSuspect={(suspectId) => {
                  setActiveSuspectId(suspectId);
                  handleSelectTab('interrogation');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Restrained bottom-right discovery notification */}
        {toastText && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed bottom-5 right-5 z-30 rounded-md border border-[#D99B38]/65 bg-[#151922] px-4 py-2.5 text-xs font-medium text-[#F4EFE4] shadow-xl"
          >
            {toastText}
          </div>
        )}
      </main>

      {/* Non-blocking Film-Noir Camera Letterbox & Establishing Slate Overlay */}
      <CinematicCameraOverlay beat={narrativeBeat} />

      {activeHint && (
        <HintModal
          hint={activeHint}
          hintsUsed={state.hintsUsed}
          onClose={() => setActiveHint(null)}
          onFollowLead={handleFollowHint}
        />
      )}

      {showAccusation && (
        <AccusationModal
          caseFile={ACTIVE_CASE}
          discoveredClueIds={state.discoveredClueIds}
          onCancel={() => setShowAccusation(false)}
          onSubmitAccusation={handleSubmitAccusation}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          cluesFound={state.discoveredClueIds.length}
          totalClues={ACTIVE_CASE.clues.length}
          contradictionsFound={state.unlockedContradictionIds.length}
          totalContradictions={ACTIVE_CASE.contradictions.length}
          elapsedSeconds={state.elapsedSeconds}
          onResume={() => setPhase('playing')}
          onRestart={handleStartNewCase}
          onReturnTitle={() => {
            document.body.dataset.state = 'title';
            setPhase('title');
          }}
          onSwitchGame={handleReturnToHub}
        />
      )}
    </div>
  );
}
