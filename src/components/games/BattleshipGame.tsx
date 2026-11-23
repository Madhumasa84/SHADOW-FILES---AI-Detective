import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Radar, Shuffle } from 'lucide-react';
import {
  BS_SIZE,
  BattleshipDifficulty,
  BattleshipState,
  computeProbabilityHeatmap,
  createInitialBattleshipState,
  executeAIShot,
  firePlayerShot,
  generateRandomFleet,
} from '../../arcade/battleship';
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

interface BattleshipGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const TIERS: Array<{ id: BattleshipDifficulty; label: string; desc: string }> = [
  { id: 'ensign', label: 'Ensign', desc: 'Mixed patrol fire' },
  { id: 'commander', label: 'Commander', desc: 'Bayesian target hunter' },
  { id: 'admiral', label: 'Admiral', desc: 'Parity + density solver' },
];

export function BattleshipGame({ backdropUrl, autoStart, onSwitchGame }: BattleshipGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [difficulty, setDifficulty] = useState<BattleshipDifficulty>('commander');
  const [state, setState] = useState<BattleshipState>(() => createInitialBattleshipState());
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('battleship'));
  const aiTimerRef = useRef<number | null>(null);

  useBodyGameState(phase);

  const clearTimer = useCallback(() => {
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
  }, []);

  const startFresh = useCallback(() => {
    clearTimer();
    setState(createInitialBattleshipState());
    setPhase('playing');
  }, [clearTimer]);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p));
  }, []);

  useNoirShortcuts({
    phase,
    onStart: startFresh,
    onTogglePause: togglePause,
    onToggleMute: () => setMuted((m) => !m),
  });

  useEffect(() => () => clearTimer(), [clearTimer]);

  const playerShipCells = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const s of state.playerShips) {
      for (const [r, c] of s.cells) map.set(`${r},${c}`, s.sunk);
    }
    return map;
  }, [state.playerShips]);

  const playerHeatmap = useMemo(() => {
    if (!showHeatmap) return null;
    const heat = computeProbabilityHeatmap(state.playerShots, state.aiShips);
    let maxVal = 1;
    for (let r = 0; r < BS_SIZE; r++) {
      for (let c = 0; c < BS_SIZE; c++) {
        if (heat[r][c] > maxVal) maxVal = heat[r][c];
      }
    }
    return { heat, maxVal };
  }, [showHeatmap, state.playerShots, state.aiShips]);

  const finishIfOver = useCallback(
    (next: BattleshipState) => {
      if (!next.winner) return;
      const outcome = next.winner === 'player' ? 'win' : 'loss';
      const accuracy = next.shotsFired > 0 ? Math.round((next.hitsLanded / next.shotsFired) * 100) : 0;
      playArcadeSfx(muted, outcome === 'win' ? 'win' : 'lose');
      setRecord(saveExtraGameOutcome('battleship', { outcome, score: accuracy }));
      setPhase('gameover');
    },
    [muted]
  );

  useEffect(() => {
    if (phase !== 'playing' || state.winner !== null || state.turn !== 'ai') return;
    clearTimer();
    aiTimerRef.current = window.setTimeout(() => {
      const res = executeAIShot(state, difficulty);
      setState(res.state);
      playArcadeSfx(
        muted,
        res.result === 'sunk' ? 'explosion' : res.result === 'hit' ? 'hit' : 'miss'
      );
      finishIfOver(res.state);
    }, 340);
    return clearTimer;
  }, [phase, state, difficulty, muted, clearTimer, finishIfOver]);

  const handleFire = (r: number, c: number) => {
    if (phase !== 'playing' || state.winner !== null || state.turn !== 'player') return;
    if (state.playerShots[r][c] !== 'empty') return;
    const res = firePlayerShot(state, r, c);
    setState(res.state);
    playArcadeSfx(
      muted,
      res.result === 'sunk' ? 'explosion' : res.result === 'hit' ? 'hit' : 'miss'
    );
    finishIfOver(res.state);
  };

  const handleShuffleFleet = () => {
    if (state.shotsFired > 0) return;
    setState((prev) => ({
      ...prev,
      playerShips: generateRandomFleet(),
      lastEvent: 'Fleet formation redeployed. Select enemy coordinates to open fire.',
    }));
    playArcadeSfx(muted, 'tap');
  };

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="IRON FLEET"
        subtitle="10×10 Naval Tactics · Bayesian Probability AI"
        eyebrow="Strategy & AI"
        description="Hunt five dark-water warships across dual sonar boards. Toggle the live Bayesian Probability Heatmap to visualize optimal targeting corridors while defending against Admiral-tier counterfire."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins}W – ${record.losses}L · Peak Accuracy ${record.bestScore}%`}
        ctaLabel="Deploy Fleet"
        onStart={startFresh}
        onSwitchGame={onSwitchGame}
      >
        <div className="flex flex-wrap gap-2.5">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDifficulty(t.id)}
              className={`border px-4 py-2 text-left transition ${
                difficulty === t.id
                  ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5D28A]'
                  : 'border-white/15 bg-[#0E1117]/80 text-[#CBD5E1] hover:border-white/30'
              }`}
            >
              <div className="text-xs font-semibold tracking-wider uppercase">{t.label}</div>
              <div className="text-[11px] text-[#94A3B8]">{t.desc}</div>
            </button>
          ))}
        </div>
      </NoirTitleScreen>
    );
  }

  const enemyAfloat = state.aiShips.filter((s) => !s.sunk).length;
  const playerAfloat = state.playerShips.filter((s) => !s.sunk).length;
  const accuracy = state.shotsFired > 0 ? Math.round((state.hitsLanded / state.shotsFired) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#060B10] text-[#ECEFF4]">
      <NoirGameHeader
        title="IRON FLEET"
        subtitle={`${difficulty.toUpperCase()} · SHOTS ${state.shotsFired} · ACCURACY ${accuracy}%`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={startFresh}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <div className="hidden items-center gap-3 font-mono text-xs sm:flex">
            <span className="text-[#F5D28A]">ENEMY AFLOAT: {enemyAfloat}/5</span>
            <span className="text-[#94A3B8]">YOUR FLEET: {playerAfloat}/5</span>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <p className="text-sm text-[#E2E8F0]">{state.lastEvent}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowHeatmap((v) => !v);
                playArcadeSfx(muted, 'hint');
              }}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap border px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition ${
                showHeatmap
                  ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-300'
                  : 'border-[#D4A853]/40 bg-[#D4A853]/10 text-[#F5D28A] hover:bg-[#D4A853]/20'
              }`}
            >
              <Radar className="h-3.5 w-3.5" />
              {showHeatmap ? 'Heatmap On' : 'Sonar Heatmap'}
            </button>
            {state.shotsFired === 0 && (
              <button
                type="button"
                onClick={handleShuffleFleet}
                className="inline-flex items-center gap-1.5 whitespace-nowrap border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium tracking-wider text-[#CBD5E1] uppercase transition hover:border-white/30"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Redeploy Fleet
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Enemy Sonar Target Board */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-[#D4A853] uppercase">
                <Crosshair className="h-3.5 w-3.5" />
                Enemy Waters (Click to Fire)
              </h2>
              <span className="font-mono text-[11px] text-[#94A3B8]">
                {state.turn === 'player' ? 'WEAPONS READY' : 'INCOMING SALVO'}
              </span>
            </div>
            <div className="border border-[#D4A853]/35 bg-[#08151E] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: BS_SIZE }, (_, r) =>
                  Array.from({ length: BS_SIZE }, (_, c) => {
                    const shot = state.playerShots[r][c];
                    const hRatio =
                      playerHeatmap && shot === 'empty'
                        ? playerHeatmap.heat[r][c] / playerHeatmap.maxVal
                        : 0;
                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        data-enemy-cell={`${r}-${c}`}
                        aria-label={`Fire at ${String.fromCharCode(65 + r)}${c + 1}`}
                        onClick={() => handleFire(r, c)}
                        disabled={shot !== 'empty' || state.turn !== 'player'}
                        className={`relative flex aspect-square items-center justify-center border text-xs transition ${
                          shot === 'sunk'
                            ? 'border-[#F87171]/80 bg-[#7F1D1D]/85'
                            : shot === 'hit'
                            ? 'border-[#F59E0B] bg-[#9A3412]/80'
                            : shot === 'miss'
                            ? 'border-white/10 bg-[#0F2331]/70'
                            : 'border-cyan-500/20 bg-[#0B1C28] hover:border-[#D4A853] hover:bg-[#132C3D]'
                        }`}
                        style={
                          hRatio > 0.08
                            ? {
                                backgroundColor: `rgba(16, 185, 129, ${(hRatio * 0.45).toFixed(2)})`,
                              }
                            : undefined
                        }
                      >
                        {shot === 'hit' && (
                          <span className="h-3 w-3 rounded-full bg-[#FBBF24] shadow-[0_0_10px_#F59E0B]" />
                        )}
                        {shot === 'sunk' && (
                          <span className="font-mono text-xs font-bold text-[#FECACA]">×</span>
                        )}
                        {shot === 'miss' && (
                          <span className="h-2 w-2 rounded-full bg-slate-400/60" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#94A3B8]">
              {state.aiShips.map((ship) => (
                <span
                  key={ship.id}
                  className={ship.sunk ? 'line-through text-[#F87171]/80' : 'text-[#CBD5E1]'}
                >
                  {ship.name} ({ship.length})
                </span>
              ))}
            </div>
          </section>

          {/* Player Fleet Board */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-mono text-xs tracking-[0.2em] text-[#94A3B8] uppercase">
                Your Fleet Sector
              </h2>
              <span className="font-mono text-[11px] text-[#94A3B8]">
                {playerAfloat} VESSELS ACTIVE
              </span>
            </div>
            <div className="border border-white/15 bg-[#09121A] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: BS_SIZE }, (_, r) =>
                  Array.from({ length: BS_SIZE }, (_, c) => {
                    const shot = state.aiShots[r][c];
                    const hasShip = playerShipCells.has(`${r},${c}`);
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`flex aspect-square items-center justify-center border ${
                          shot === 'sunk'
                            ? 'border-[#F87171]/80 bg-[#7F1D1D]/85'
                            : shot === 'hit'
                            ? 'border-[#F59E0B] bg-[#9A3412]/80'
                            : hasShip
                            ? 'border-[#D4A853]/45 bg-[#2B3748]'
                            : 'border-white/10 bg-[#0B1722]'
                        }`}
                      >
                        {shot === 'hit' && <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]" />}
                        {shot === 'sunk' && (
                          <span className="font-mono text-xs font-bold text-[#FECACA]">×</span>
                        )}
                        {shot === 'miss' && <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#94A3B8]">
              {state.playerShips.map((ship) => (
                <span
                  key={ship.id}
                  className={ship.sunk ? 'line-through text-[#F87171]/80' : 'text-[#D4A853]'}
                >
                  {ship.name} ({ship.length})
                </span>
              ))}
            </div>
          </section>
        </div>
      </main>

      {phase === 'paused' && (
        <NoirPauseModal
          title="IRON FLEET"
          onResume={() => setPhase('playing')}
          onRestart={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}

      {phase === 'gameover' && (
        <NoirOutcomeModal
          outcome={state.winner === 'player' ? 'win' : 'loss'}
          headline={state.winner === 'player' ? 'Enemy Armada Sunk' : 'Fleet Destroyed'}
          summary={`Fired ${state.shotsFired} salvos with ${accuracy}% hit accuracy against ${difficulty.toUpperCase()} AI.`}
          onPlayAgain={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
