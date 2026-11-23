import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PongDifficulty,
  PongInput,
  PongWorld,
  createInitialPongWorld,
  stepPongWorld,
} from '../../arcade/pong';
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

interface PongGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const LOGICAL_W = 800;
const LOGICAL_H = 480;

const TIERS: Array<{ id: PongDifficulty; label: string; desc: string }> = [
  { id: 'rookie', label: 'Rookie', desc: 'Relaxed tracking' },
  { id: 'pro', label: 'Pro', desc: 'Trajectory predictor' },
  { id: 'apex', label: 'Apex', desc: 'Precision intercept AI' },
];

function renderPongCanvas(ctx: CanvasRenderingContext2D, world: PongWorld) {
  ctx.save();
  if (world.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }

  // Midnight slate velvet table
  const grad = ctx.createRadialGradient(
    world.width / 2,
    world.height / 2,
    40,
    world.width / 2,
    world.height / 2,
    world.width * 0.65
  );
  grad.addColorStop(0, '#131B29');
  grad.addColorStop(1, '#070A10');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, world.width, world.height);

  // Outer brass rails
  ctx.strokeStyle = 'rgba(212, 168, 83, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, world.width - 20, world.height - 20);

  // Center court dashed divider & emblem circle
  ctx.strokeStyle = 'rgba(212, 168, 83, 0.22)';
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(world.width / 2, 14);
  ctx.lineTo(world.width / 2, world.height - 14);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(world.width / 2, world.height / 2, 54, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle court scores
  ctx.fillStyle = 'rgba(248, 250, 252, 0.14)';
  ctx.font = '700 72px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(world.playerScore), world.width * 0.28, world.height * 0.26);
  ctx.fillText(String(world.aiScore), world.width * 0.72, world.height * 0.26);

  // Impact ripples
  for (const rp of world.ripples) {
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
    ctx.strokeStyle = rp.color;
    ctx.globalAlpha = Math.max(0, rp.alpha);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Player paddle (warm brass)
  const pGrad = ctx.createLinearGradient(
    world.playerX - world.paddleW / 2,
    world.playerY - world.paddleH / 2,
    world.playerX + world.paddleW / 2,
    world.playerY + world.paddleH / 2
  );
  pGrad.addColorStop(0, '#FDE68A');
  pGrad.addColorStop(1, '#B77F1F');
  ctx.fillStyle = pGrad;
  ctx.shadowColor = 'rgba(212, 168, 83, 0.55)';
  ctx.shadowBlur = 12;
  ctx.fillRect(
    world.playerX - world.paddleW / 2,
    world.playerY - world.paddleH / 2,
    world.paddleW,
    world.paddleH
  );

  // AI paddle (sapphire steel)
  const aGrad = ctx.createLinearGradient(
    world.aiX - world.paddleW / 2,
    world.aiY - world.paddleH / 2,
    world.aiX + world.paddleW / 2,
    world.aiY + world.paddleH / 2
  );
  aGrad.addColorStop(0, '#93C5FD');
  aGrad.addColorStop(1, '#2563EB');
  ctx.fillStyle = aGrad;
  ctx.shadowColor = 'rgba(96, 165, 250, 0.55)';
  ctx.shadowBlur = 12;
  ctx.fillRect(
    world.aiX - world.paddleW / 2,
    world.aiY - world.paddleH / 2,
    world.paddleW,
    world.paddleH
  );
  ctx.shadowBlur = 0;

  // Ball trail
  for (let i = 0; i < world.ballTrail.length; i++) {
    const pt = world.ballTrail[i];
    const f = (i + 1) / world.ballTrail.length;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, world.ballRadius * f * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(212, 168, 83, ${f * 0.35})`;
    ctx.fill();
  }

  // Ball
  ctx.beginPath();
  ctx.arc(world.ballX, world.ballY, world.ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFDF5';
  ctx.shadowColor = '#F5D28A';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Sparks
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function PongGame({ backdropUrl, autoStart, onSwitchGame }: PongGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [difficulty, setDifficulty] = useState<PongDifficulty>('pro');
  const [hud, setHud] = useState({
    playerScore: 0,
    aiScore: 0,
    rally: 0,
    bestRally: 0,
    won: false,
  });
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('pong'));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<PongWorld>(createInitialPongWorld('pro', LOGICAL_W, LOGICAL_H));
  const inputRef = useRef<PongInput>({ up: false, down: false, pointerY: null });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useBodyGameState(phase);

  const startFresh = useCallback(
    (nextDiff?: PongDifficulty) => {
      const target = nextDiff ?? difficulty;
      setDifficulty(target);
      worldRef.current = createInitialPongWorld(target, LOGICAL_W, LOGICAL_H);
      inputRef.current = { up: false, down: false, pointerY: null };
      setHud({ playerScore: 0, aiScore: 0, rally: 0, bestRally: 0, won: false });
      setPhase('playing');
    },
    [difficulty]
  );

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p));
  }, []);

  useNoirShortcuts({
    phase,
    onStart: () => startFresh(),
    onTogglePause: togglePause,
    onToggleMute: () => setMuted((m) => !m),
  });

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        inputRef.current.up = true;
        inputRef.current.pointerY = null;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        inputRef.current.down = true;
        inputRef.current.pointerY = null;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') inputRef.current.up = false;
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputRef.current.down = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let rafId = 0;
    let lastTime = performance.now();
    let hudTick = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;

      const world = worldRef.current;
      const events = stepPongWorld(world, inputRef.current, dt);

      if (events.paddleHit) playArcadeSfx(mutedRef.current, 'hit');
      else if (events.wallHit) playArcadeSfx(mutedRef.current, 'tap');
      if (events.playerScored) playArcadeSfx(mutedRef.current, 'powerup');
      if (events.aiScored) playArcadeSfx(mutedRef.current, 'error');

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) renderPongCanvas(ctx, world);
      }

      hudTick += dt;
      if (hudTick >= 0.08 || events.playerScored || events.aiScored || events.matchEnded) {
        hudTick = 0;
        setHud({
          playerScore: world.playerScore,
          aiScore: world.aiScore,
          rally: world.rally,
          bestRally: world.bestRally,
          won: world.status === 'won',
        });
      }

      if (events.matchEnded) {
        const won = world.status === 'won';
        playArcadeSfx(mutedRef.current, won ? 'win' : 'lose');
        setRecord(
          saveExtraGameOutcome('pong', {
            outcome: won ? 'win' : 'loss',
            score: world.bestRally,
          })
        );
        setPhase('gameover');
        return;
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [phase]);

  const handlePointerMove = (clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = LOGICAL_H / rect.height;
    inputRef.current.pointerY = (clientY - rect.top) * scaleY;
  };

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="VELVET PONG"
        subtitle="60 FPS Spin Table Tennis · Predictive Intercept AI"
        eyebrow="Arcade & Action"
        description="First to 7 wins on a midnight slate arena. Impart velocity spin with moving paddle strikes against an AI that calculates multi-bounce wall reflections in real time."
        backdropUrl={backdropUrl}
        statsLine={`${record.wins}W – ${record.losses}L · Longest Rally ${record.bestScore}`}
        ctaLabel="Serve First Ball"
        onStart={() => startFresh()}
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

  return (
    <div className="flex min-h-screen flex-col bg-[#07090D] text-[#ECEFF4]">
      <NoirGameHeader
        title="VELVET PONG"
        subtitle={`${difficulty.toUpperCase()} AI · FIRST TO 7`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={() => startFresh()}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <div className="hidden items-center gap-4 font-mono text-xs sm:flex">
            <span className="text-[#F5D28A]">YOU {hud.playerScore}</span>
            <span className="text-[#93C5FD]">AI {hud.aiScore}</span>
            <span className="text-[#94A3B8]">RALLY {hud.rally}</span>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-3 py-4">
        <div className="mb-2.5 flex w-full max-w-[800px] items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-4">
            <span className="text-[#F5D28A]">YOU: {hud.playerScore}</span>
            <span className="text-[#93C5FD]">AI: {hud.aiScore}</span>
            <span className="text-[#94A3B8]">RALLY {hud.rally} · BEST {hud.bestRally}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => startFresh(t.id)}
                className={`border px-2 py-0.5 text-[11px] uppercase tracking-wider transition ${
                  difficulty === t.id
                    ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5D28A]'
                    : 'border-white/10 text-[#94A3B8] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={LOGICAL_W}
          height={LOGICAL_H}
          onMouseMove={(e) => handlePointerMove(e.clientY)}
          onTouchMove={(e) => {
            if (e.touches[0]) handlePointerMove(e.touches[0].clientY);
          }}
          className="w-full max-w-[800px] cursor-ns-resize border border-[#D4A853]/40 bg-[#080B12] shadow-[0_24px_70px_rgba(0,0,0,0.85)] touch-none"
        />

        <p className="mt-2.5 text-xs text-[#94A3B8]">
          Control left brass paddle with Mouse, Touch, W/S, or Up/Down Arrow Keys
        </p>
      </main>

      {phase === 'paused' && (
        <NoirPauseModal
          title="VELVET PONG"
          onResume={() => setPhase('playing')}
          onRestart={() => startFresh()}
          onSwitchGame={onSwitchGame}
        />
      )}

      {phase === 'gameover' && (
        <NoirOutcomeModal
          outcome={hud.won ? 'win' : 'loss'}
          headline={hud.won ? 'Match Point — Victory' : 'AI Takes the Set'}
          summary={`Final Score ${hud.playerScore}–${hud.aiScore} against ${difficulty.toUpperCase()} AI · Longest Rally: ${hud.bestRally} hits.`}
          onPlayAgain={() => startFresh()}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
