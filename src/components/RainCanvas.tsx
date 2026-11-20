import { useEffect, useRef } from 'react';

interface RainCanvasProps {
  intensity?: 'subtle' | 'storm';
  active?: boolean;
  className?: string;
}

const DROP_COUNT = 85;

export function RainCanvas({ intensity = 'subtle', active = true, className = '' }: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Zero-GC pre-allocated typed arrays for rain streaks
    const xs = new Float32Array(DROP_COUNT);
    const ys = new Float32Array(DROP_COUNT);
    const speeds = new Float32Array(DROP_COUNT);
    const lengths = new Float32Array(DROP_COUNT);
    const alphas = new Float32Array(DROP_COUNT);

    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (let i = 0; i < DROP_COUNT; i++) {
        xs[i] = Math.random() * width;
        ys[i] = Math.random() * height;
        speeds[i] = (intensity === 'storm' ? 420 : 260) + Math.random() * 240;
        lengths[i] = (intensity === 'storm' ? 22 : 14) + Math.random() * 16;
        alphas[i] = (intensity === 'storm' ? 0.14 : 0.08) + Math.random() * 0.1;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let rafId = 0;
    let lastTime = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;

      const windX = intensity === 'storm' ? -55 : -24;

      for (let i = 0; i < DROP_COUNT; i++) {
        xs[i] += windX * dt;
        ys[i] += speeds[i] * dt;

        if (ys[i] > height + lengths[i]) {
          ys[i] = -lengths[i];
          xs[i] = Math.random() * (width + 120);
        }
        if (xs[i] < -20) {
          xs[i] = width + 20;
        }

        ctx.strokeStyle = `rgba(215, 224, 238, ${alphas[i].toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(xs[i], ys[i]);
        ctx.lineTo(xs[i] + windX * 0.035, ys[i] + lengths[i]);
        ctx.stroke();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [intensity, active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none block h-full w-full ${className}`}
    />
  );
}
