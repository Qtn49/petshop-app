'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

function drawTinyPaw(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#D4905A';
  ctx.beginPath();
  ctx.arc(0, 6, 8, 0, Math.PI * 2);
  ctx.fill();
  const toes = [
    [-6, -6],
    [-2, -10],
    [2, -10],
    [6, -6],
  ];
  toes.forEach(([tx, ty]) => {
    ctx.beginPath();
    ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export default function InlineLoader({ label, size = 80 }: { label?: string; size?: number }) {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = size;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const paws = [
      { opacity: 0, scale: 0.5 },
      { opacity: 0, scale: 0.5 },
      { opacity: 0, scale: 0.5 },
    ];
    const s = canvasSize / 80;
    const positions = [
      { x: 18 * s, y: 50 * s },
      { x: 40 * s, y: 42 * s },
      { x: 62 * s, y: 50 * s },
    ];

    const gctx = gsap.context(() => {
      gsap
        .timeline({ repeat: -1 })
        .to(paws, {
          opacity: 1,
          scale: 1,
          duration: 0.35,
          stagger: 0.22,
          ease: 'back.out(2)',
        })
        .to(paws, { opacity: 0, scale: 0.5, duration: 0.45, stagger: 0.06, delay: 0.15 });
    });

    let rafId = 0;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      positions.forEach((p, i) => drawTinyPaw(ctx, p.x, p.y, paws[i].scale, paws[i].opacity));
    };
    loop();

    cleanupRef.current = () => {
      cancelAnimationFrame(rafId);
      gctx.revert();
    };

    return () => {
      cleanupRef.current?.();
      gsap.killTweensOf(paws);
    };
  }, [size, mounted]);

  if (!mounted) return null;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <canvas ref={canvasRef} className="block shrink-0" width={size} height={size} aria-hidden />
      {label ? <span className="text-xs text-slate-600">{label}</span> : null}
    </div>
  );
}
