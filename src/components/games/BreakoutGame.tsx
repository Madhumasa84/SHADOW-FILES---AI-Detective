import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BreakoutInput,
  BreakoutWorld,
  PowerUpType,
  createInitialBreakoutWorld,
  stepBreakoutWorld,
} from '../../arcade/breakout';
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

interface BreakoutGameProps {
  backdropUrl: string;
  autoStart?: boolean;
  onSwitchGame: () => void;
}

const LOGICAL_W = 760;
const LOGICAL_H = 540;

const TONE_PALETTE = {
  amber: { fill: '#D4A853', top: '#FBE6A2', edge: '#8C6214' },
  crimson: { fill: '#C93838', top: '#FCA5A5', edge: '#6E1414' },
  emerald: { fill: '#22A87A', top: '#86EFAC', edge: '#0E5B42' },
  sapphire: { fill: '#3B82F6', top: '#93C5FD', edge: '#1D4ED8' },
  steel: { fill: '#64748B', top: '#CBD5E1', edge: '#334155' },
};

const POWERUP_META: Record<PowerUpType, { label: string; color: string }> = {
  wide: { label: 'WIDE', color: '#D4A853' },
  multi: { label: '3×', color: '#38BDF8' },
  pierce: { label: 'PIERCE', color: '#F87171' },
  slow: { label: 'SLOW', color: '#34D399' },
};

function renderBreakoutCanvas(ctx: CanvasRenderingContext2D, world: BreakoutWorld) {
  ctx.save();
  if (world.shake > 0.2) {
    const sx = (Math.random() - 0.5) * world.shake;
    const sy = (Math.random() - 0.5) * world.shake;
    ctx.translate(sx, sy);
  }

  // Atmospheric dark chamber background
  const bg = ctx.createLinearGradient(0, 0, 0, world.height);
  bg.addColorStop(0, '#0D121D');
  bg.addColorStop(1, '#06080D');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, world.width, world.height);

  // Subtle architectural grid lines
  ctx.strokeStyle = 'rgba(212, 168, 83, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 40; x < world.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }
  for (let y = 40; y < world.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }

  // Brass border frame
  ctx.strokeStyle = 'rgba(212, 168, 83, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, world.width - 16, world.height - 12);

  // Bricks
  for (const b of world.bricks) {
    const pal = TONE_PALETTE[b.tone];
    ctx.fillStyle = b.hitFlash > 0.2 ? '#FFFFFF' : pal.fill;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // Top beveled specular highlight
    ctx.fillStyle = pal.top;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 4);
    ctx.globalAlpha = 1;

    // Bottom edge shadow
    ctx.fillStyle = pal.edge;
    ctx.fillRect(b.x, b.y + b.h - 3, b.w, 3);

    // Crack lines on damaged multi-hit bricks
    if (!b.indestructible && b.hp < b.maxHp) {
      ctx.strokeStyle = 'rgba(10, 12, 18, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.28, b.y + 2);
      ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.55);
      ctx.lineTo(b.x + b.w * 0.72, b.y + b.h - 2);
      ctx.stroke();
    }
  }

  // Power-up capsules
  for (const p of world.powerUps) {
    const meta = POWERUP_META[p.type];
    ctx.fillStyle = '#0D1119';
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2;
    ctx.fillRect(p.x - 24, p.y - 10, 48, 20);
    ctx.strokeRect(p.x - 24, p.y - 10, 48, 20);
    ctx.fillStyle = meta.color;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.label, p.x, p.y + 0.5);
  }

  // Paddle with brass gradient & glow
  const px = world.paddleX - world.paddleW / 2;
  const pGrad = ctx.createLinearGradient(px, world.paddleY, px, world.paddleY + world.paddleH);
  pGrad.addColorStop(0, world.pierceTimer > 0 ? '#FCA5A5' : '#FDE68A');
  pGrad.addColorStop(1, world.pierceTimer > 0 ? '#B91C1C' : '#9E6E1B');
  ctx.fillStyle = pGrad;
  ctx.fillRect(px, world.paddleY, world.paddleW, world.paddleH);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, world.paddleY, world.paddleW, world.paddleH);

  // Balls & motion trails
  for (const ball of world.balls) {
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const frac = (i + 1) / ball.trail.length;
      ctx.beginPath();
      ctx.arc(t.x, t.y, ball.radius * frac * 0.85, 0, Math.PI * 2);
      ctx.fillStyle =
        world.pierceTimer > 0
          ? `rgba(248, 113, 113, ${frac * 0.35})`
          : `rgba(212, 168, 83, ${frac * 0.35})`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = world.pierceTimer > 0 ? '#FCA5A5' : '#FFFDF5';
    ctx.shadowColor = world.pierceTimer > 0 ? '#EF4444' : '#D4A853';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Shatter particles
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // Launch prompt when ball is docked
  if (world.balls.some((b) => b.stuckToPaddle)) {
    ctx.fillStyle = 'rgba(245, 210, 138, 0.9)';
    ctx.font = '600 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLICK OR PRESS SPACE TO LAUNCH', world.width / 2, world.paddleY - 34);
  }

  ctx.restore();
}

export function BreakoutGame({ backdropUrl, autoStart, onSwitchGame }: BreakoutGameProps) {
  const [phase, setPhase] = useState<NoirScreenPhase>(autoStart ? 'playing' : 'title');
  const [hud, setHud] = useState({
    score: 0,
    lives: 3,
    stage: 1,
    combo: 0,
    wide: false,
    pierce: false,
    slow: false,
    won: false,
  });
  const [muted, setMuted] = useState(false);
  const [record, setRecord] = useState(() => loadExtraRecord('breakout'));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<BreakoutWorld>(createInitialBreakoutWorld(LOGICAL_W, LOGICAL_H, 1));
  const inputRef = useRef<BreakoutInput>({ left: false, right: false, pointerX: null, launch: false });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useBodyGameState(phase);

  const startFresh = useCallback(() => {
    worldRef.current = createInitialBreakoutWorld(LOGICAL_W, LOGICAL_H, 1);
    inputRef.current = { left: false, right: false, pointerX: null, launch: false };
    setHud({
      score: 0,
      lives: 3,
      stage: 1,
      combo: 0,
      wide: false,
      pierce: false,
      slow: false,
      won: false,
    });
    setPhase('playing');
  }, []);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'paused' : p === 'paused' ? 'playing' : p));
  }, []);

  useNoirShortcuts({
    phase,
    onStart: startFresh,
    onTogglePause: togglePause,
    onToggleMute: () => setMuted((m) => !m),
  });

  // Keyboard paddle & launch controls
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        inputRef.current.left = true;
        inputRef.current.pointerX = null;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        inputRef.current.right = true;
        inputRef.current.pointerX = null;
      } else if (e.key === ' ') {
        e.preventDefault();
        inputRef.current.launch = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputRef.current.left = false;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase]);

  // 60 FPS animation loop
  useEffect(() => {
    if (phase !== 'playing') return;
    let rafId = 0;
    let lastTime = performance.now();
    let hudTick = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;

      const world = worldRef.current;
      const events = stepBreakoutWorld(world, inputRef.current, dt);
      inputRef.current.launch = false;

      if (events.brickBroken) playArcadeSfx(mutedRef.current, 'hit');
      else if (events.brickHit || events.paddleHit) playArcadeSfx(mutedRef.current, 'tap');
      if (events.powerUpCollected) playArcadeSfx(mutedRef.current, 'powerup');
      if (events.lifeLost) playArcadeSfx(mutedRef.current, 'error');

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) renderBreakoutCanvas(ctx, world);
      }

      hudTick += dt;
      if (hudTick >= 0.08 || events.gameOver || events.gameWon || events.stageCleared) {
        hudTick = 0;
        setHud({
          score: world.score,
          lives: world.lives,
          stage: world.stage,
          combo: world.combo,
          wide: world.wideTimer > 0,
          pierce: world.pierceTimer > 0,
          slow: world.slowTimer > 0,
          won: world.status === 'won',
        });
      }

      if (events.gameOver || events.gameWon) {
        playArcadeSfx(mutedRef.current, events.gameWon ? 'win' : 'lose');
        setRecord(
          saveExtraGameOutcome('breakout', {
            outcome: events.gameWon ? 'win' : 'loss',
            score: world.score,
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

  const handlePointerMove = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_W / rect.width;
    inputRef.current.pointerX = (clientX - rect.left) * scaleX;
  };

  if (phase === 'title') {
    return (
      <NoirTitleScreen
        title="PRISM BREAKER"
        subtitle="60 FPS Art-Deco Brick Breaker · 5 Stages"
        eyebrow="Arcade & Action"
        description="Shatter five architectural stained-glass stages with precision paddle deflection, multi-hit crystal prisms, Wide/Multi-Ball/Pierce/Slow power-ups, and tactile impact physics."
        backdropUrl={backdropUrl}
        statsLine={`High Score ${record.bestScore.toLocaleString()} · Clears ${record.wins}`}
        ctaLabel="Launch Prism"
        onStart={startFresh}
        onSwitchGame={onSwitchGame}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#07090D] text-[#ECEFF4]">
      <NoirGameHeader
        title="PRISM BREAKER"
        subtitle={`STAGE ${hud.stage}/5 · HIGH ${Math.max(record.bestScore, hud.score).toLocaleString()}`}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onPause={togglePause}
        onRestart={startFresh}
        onSwitchGame={onSwitchGame}
        rightSlot={
          <div className="hidden items-center gap-4 font-mono text-xs sm:flex">
            <span className="text-[#F5D28A]">SCORE {hud.score.toLocaleString()}</span>
            <span className="text-[#CBD5E1]">LIVES {hud.lives}</span>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-3 py-4">
        <div className="mb-2.5 flex w-full max-w-[760px] flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <div className="flex items-center gap-4">
            <span className="text-[#F5D28A]">STAGE {hud.stage}/5</span>
            <span className="text-[#E2E8F0]">SCORE {hud.score.toLocaleString()}</span>
            <span className="text-[#94A3B8]">LIVES {'●'.repeat(Math.max(0, hud.lives))}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] uppercase">
            {hud.wide && <span className="text-[#F5D28A]">WIDE ACTIVE</span>}
            {hud.pierce && <span className="text-[#FCA5A5]">PIERCE ACTIVE</span>}
            {hud.slow && <span className="text-emerald-300">SLOW ACTIVE</span>}
            {hud.combo >= 3 && <span className="text-sky-300">{hud.combo}× CHAIN</span>}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={LOGICAL_W}
          height={LOGICAL_H}
          onMouseMove={(e) => handlePointerMove(e.clientX)}
          onTouchMove={(e) => {
            if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
          }}
          onClick={() => {
            inputRef.current.launch = true;
          }}
          className="w-full max-w-[760px] cursor-pointer border border-[#D4A853]/40 bg-[#080B12] shadow-[0_24px_70px_rgba(0,0,0,0.85)] touch-none"
        />

        <p className="mt-2.5 text-xs text-[#94A3B8]">
          Move with Mouse, Touch, or A/D / Arrow Keys · Click or Space to launch
        </p>
      </main>

      {phase === 'paused' && (
        <NoirPauseModal
          title="PRISM BREAKER"
          onResume={() => setPhase('playing')}
          onRestart={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}

      {phase === 'gameover' && (
        <NoirOutcomeModal
          outcome={hud.won ? 'win' : 'loss'}
          headline={hud.won ? 'All Five Stages Shattered' : 'Run Ended'}
          summary={`Final Score: ${hud.score.toLocaleString()} · Reached Stage ${hud.stage} of 5.`}
          onPlayAgain={startFresh}
          onSwitchGame={onSwitchGame}
        />
      )}
    </div>
  );
}
