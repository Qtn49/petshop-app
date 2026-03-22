'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';

type AnimationFn = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onReady: () => void
) => () => void;

function setupHiDPICanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return { w, h, dpr };
}

function drawPawShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  opacity: number,
  color = '#D4905A'
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [
    [-10, -8],
    [-4, -14],
    [4, -14],
    [10, -8],
  ];
  toes.forEach(([tx, ty]) => {
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawPawPrints(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onReady: () => void
): () => void {
  let { w, h } = setupHiDPICanvas(canvas, ctx);
  const paws: { x: number; y: number; opacity: number; scale: number }[] = [];
  const count = 8;
  const startX = w * 0.15;
  const startY = h * 0.35;
  const stepX = (w * 0.7) / (count - 1);
  const stepY = (h * 0.25) / (count - 1);
  for (let i = 0; i < count; i++) {
    const flip = i % 2 === 0 ? 1 : -1;
    paws.push({
      x: startX + i * stepX + flip * 20,
      y: startY + i * stepY,
      opacity: 0,
      scale: 0.3,
    });
  }

  let rafId = 0;
  const gctx = gsap.context(() => {
    gsap.timeline({ repeat: -1 })
      .to(paws, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        stagger: 0.25,
        ease: 'back.out(2)',
      })
      .to(paws, { opacity: 0, duration: 0.5, delay: 0.3 });
  });

  const loop = () => {
    rafId = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, w, h);
    paws.forEach((p) => drawPawShape(ctx, p.x, p.y, p.scale, p.opacity));
  };
  loop();

  setTimeout(() => onReady(), 200);

  const onResize = () => {
    ({ w, h } = setupHiDPICanvas(canvas, ctx));
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    gctx.revert();
  };
}

type Fish = {
  x: number;
  y: number;
  speed: number;
  color: string;
  size: number;
  direction: number;
  tailPhase: number;
};

function drawFishTank(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onReady: () => void
): () => void {
  let { w, h } = setupHiDPICanvas(canvas, ctx);
  const colors = ['#FB923C', '#22C55E', '#F59E0B', '#EC4899', '#06B6D4'];
  const fish: Fish[] = [];
  for (let i = 0; i < 7; i++) {
    fish.push({
      x: Math.random() * w,
      y: 80 + Math.random() * (h * 0.5),
      speed: 1 + Math.random() * 2,
      color: colors[i % colors.length],
      size: 20 + Math.random() * 20,
      direction: Math.random() > 0.5 ? 1 : -1,
      tailPhase: Math.random() * Math.PI * 2,
    });
  }
  type Bubble = { x: number; y: number; r: number; speed: number; opacity: number };
  const bubbles: Bubble[] = Array.from({ length: 25 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 2 + Math.random() * 4,
    speed: 0.5 + Math.random() * 1.5,
    opacity: 0.3 + Math.random() * 0.4,
  }));

  const fade = { alpha: 0 };
  const gctx = gsap.context(() => {
    gsap.to(fade, { alpha: 1, duration: 0.6, ease: 'power2.out' });
  });

  let rafId = 0;
  let t = 0;
  const loop = () => {
    rafId = requestAnimationFrame(loop);
    t += 0.016;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = fade.alpha;

    bubbles.forEach((b) => {
      b.y -= b.speed;
      if (b.y < -10) {
        b.y = h + 10;
        b.x = Math.random() * w;
      }
      ctx.strokeStyle = `rgba(147, 197, 253, ${b.opacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    });

    for (let s = 0; s < 3; s++) {
      const bx = (w / 4) * (s + 1);
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, h);
      const sway = Math.sin(t * 2 + s) * 25;
      ctx.bezierCurveTo(bx + sway, h * 0.7, bx - sway * 0.5, h * 0.45, bx + sway * 0.3, h * 0.25);
      ctx.stroke();
    }

    fish.forEach((f) => {
      f.x += f.speed * f.direction;
      f.tailPhase += 0.15;
      if (f.x < -f.size * 2 || f.x > w + f.size * 2) f.direction *= -1;

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.direction, 1);
      const tw = Math.sin(f.tailPhase) * 4;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, f.size * 0.6, f.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-f.size * 0.55, 0);
      ctx.lineTo(-f.size - tw, -f.size * 0.25);
      ctx.lineTo(-f.size - tw, f.size * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(f.size * 0.35, -f.size * 0.08, f.size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath();
      ctx.arc(f.size * 0.38, -f.size * 0.08, f.size * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  };
  loop();
  setTimeout(() => onReady(), 200);

  const onResize = () => {
    ({ w, h } = setupHiDPICanvas(canvas, ctx));
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    gctx.revert();
  };
}

type FloatItem = {
  x: number;
  y: number;
  rotation: number;
  rotationSpeed: number;
  floatSpeed: number;
  opacity: number;
  size: number;
  shape: 0 | 1 | 2;
  color: string;
  phase: number;
};

function drawBone(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#D4905A';
  ctx.beginPath();
  ctx.arc(-s * 0.4, 0, s * 0.25, 0, Math.PI * 2);
  ctx.arc(s * 0.4, 0, s * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-s * 0.35, -s * 0.12, s * 0.7, s * 0.24);
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * s * 0.4, Math.sin(a + Math.PI / 4) * s * 0.4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFloatingBones(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onReady: () => void
): () => void {
  let { w, h } = setupHiDPICanvas(canvas, ctx);
  const colors = ['#D4905A', '#E8536A', '#D97706', '#C97F3C'];
  const items: FloatItem[] = [];
  for (let i = 0; i < 15; i++) {
    items.push({
      x: Math.random() * w,
      y: h + Math.random() * 200,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.04,
      floatSpeed: 0.8 + Math.random() * 1.2,
      opacity: 0,
      size: 18 + Math.random() * 22,
      shape: (i % 3) as 0 | 1 | 2,
      color: colors[i % colors.length],
      phase: Math.random() * Math.PI * 2,
    });
  }

  let time = 0;
  let rafId = 0;
  const gctx = gsap.context(() => {
    gsap.to(items, {
      opacity: 1,
      duration: 0.8,
      stagger: 0.08,
      ease: 'power2.out',
    });
  });

  const loop = () => {
    rafId = requestAnimationFrame(loop);
    time += 0.016;
    ctx.clearRect(0, 0, w, h);
    items.forEach((it) => {
      it.y -= it.floatSpeed;
      it.rotation += it.rotationSpeed;
      it.x += Math.sin(time * 0.5 + it.phase) * 0.5;
      if (it.y < -60) {
        it.y = h + 40;
        it.x = Math.random() * w;
        it.opacity = Math.min(1, it.opacity);
      }
      const fadeBottom = it.y > h - 100 ? (it.y - (h - 100)) / 100 : 1;
      const fadeTop = it.y < 120 ? it.y / 120 : 1;
      const op = it.opacity * fadeBottom * fadeTop;
      ctx.globalAlpha = op;
      if (it.shape === 0) drawBone(ctx, it.x, it.y, it.size, it.rotation);
      else if (it.shape === 1) drawPawShape(ctx, it.x, it.y, it.size / 24, 1, it.color);
      else drawStar(ctx, it.x, it.y, it.size * 0.4, it.rotation);
      ctx.globalAlpha = 1;
    });
  };
  loop();
  setTimeout(() => onReady(), 200);

  const onResize = () => {
    ({ w, h } = setupHiDPICanvas(canvas, ctx));
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    gctx.revert();
  };
}

function drawHeartbeat(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onReady: () => void
): () => void {
  let { w, h } = setupHiDPICanvas(canvas, ctx);
  const state = { progress: 0 };
  const paw = { scale: 1 };
  const gctx = gsap.context(() => {
    gsap.to(state, {
      progress: 1,
      duration: 1.8,
      repeat: -1,
      ease: 'none',
    });
    gsap.to(paw, {
      scale: 1.2,
      duration: 0.4,
      yoyo: true,
      repeat: -1,
      ease: 'power2.inOut',
    });
  });

  const seg = 40;
  const buildWaypoints = (width: number, height: number) => {
    const c = height * 0.42;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const x = width * 0.08 + t * width * 0.84;
      let y = c;
      if (t < 0.15) y = c;
      else if (t < 0.22) y = c - 15;
      else if (t < 0.28) y = c + 10;
      else if (t < 0.35) y = c - 45;
      else if (t < 0.42) y = c + 25;
      else if (t < 0.5) y = c - 12;
      else y = c;
      pts.push({ x, y });
    }
    return pts;
  };

  let rafId = 0;
  const loop = () => {
    rafId = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, w, h);
    const cyNow = h * 0.42;
    const waypoints = buildWaypoints(w, h);
    const totalLen = waypoints.length - 1;
    const prog = state.progress;
    const endIdx = Math.floor(prog * totalLen);
    const grad = ctx.createLinearGradient(w * 0.08, cyNow, w * 0.92, cyNow);
    grad.addColorStop(0, '#F9A8D4');
    grad.addColorStop(1, '#FB923C');

    ctx.save();
    ctx.filter = 'blur(6px)';
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i <= endIdx; i++) ctx.lineTo(waypoints[i].x, waypoints[i].y);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i <= endIdx; i++) ctx.lineTo(waypoints[i].x, waypoints[i].y);
    if (endIdx < totalLen && prog * totalLen > endIdx) {
      const frac = prog * totalLen - endIdx;
      const nx = waypoints[endIdx].x + (waypoints[endIdx + 1].x - waypoints[endIdx].x) * frac;
      const ny = waypoints[endIdx].y + (waypoints[endIdx + 1].y - waypoints[endIdx].y) * frac;
      ctx.lineTo(nx, ny);
    }
    ctx.stroke();

    const cx = w * 0.5;
    drawPawShape(ctx, cx, cyNow, paw.scale * 1.2, 1, '#E8536A');
  };
  loop();
  setTimeout(() => onReady(), 200);

  const onResize = () => {
    ({ w, h } = setupHiDPICanvas(canvas, ctx));
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    gctx.revert();
  };
}

function drawTinyIcon(
  ctx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  r: number
) {
  ctx.save();
  ctx.translate(x, y);
  const s = r * 0.4;
  ctx.fillStyle = 'rgba(30, 58, 95, 0.85)';
  if (kind === 0) {
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(-s * 1.4, -s * 0.4);
    ctx.lineTo(-s * 1.4, s * 0.4);
    ctx.fill();
  } else if (kind === 1) {
    drawPawShape(ctx, 0, 0, 0.06, 1, '#D4905A');
  } else if (kind === 2) {
    drawBone(ctx, 0, 0, s * 1.2, 0);
  } else {
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.3);
    ctx.lineTo(0, -s * 0.5);
    ctx.lineTo(s, s * 0.3);
    ctx.fill();
  }
  ctx.restore();
}

function drawBubbles(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onReady: () => void
): () => void {
  let { w, h } = setupHiDPICanvas(canvas, ctx);
  type Bub = {
    x: number;
    y: number;
    r: number;
    speed: number;
    icon: number;
    opacity: number;
    wobble: number;
  };
  const bubbles: Bub[] = Array.from({ length: 12 }, (_, i) => ({
    x: Math.random() * w,
    y: h + Math.random() * h * 0.5,
    r: 25 + Math.random() * 30,
    speed: 0.5 + Math.random() * 1.5,
    icon: i % 4,
    opacity: 0,
    wobble: Math.random() * Math.PI * 2,
  }));

  let time = 0;
  let rafId = 0;
  const gctx = gsap.context(() => {
    gsap.to(bubbles, { opacity: 0.95, duration: 0.6, stagger: 0.06, ease: 'power2.out' });
  });

  const loop = () => {
    rafId = requestAnimationFrame(loop);
    time += 0.016;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h));
    g.addColorStop(0, '#ECFDF5');
    g.addColorStop(1, '#F0FDFA');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    bubbles.forEach((b) => {
      b.y -= b.speed;
      b.x += Math.sin(time * 0.8 + b.wobble) * 0.8;
      if (b.y < -b.r * 2) {
        b.y = h + b.r;
        b.x = Math.random() * w;
      }
      ctx.save();
      ctx.globalAlpha = b.opacity;
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.45)';
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      drawTinyIcon(ctx, b.icon, b.x, b.y, b.r);
      ctx.restore();
    });
  };
  loop();
  setTimeout(() => onReady(), 200);

  const onResize = () => {
    ({ w, h } = setupHiDPICanvas(canvas, ctx));
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    gctx.revert();
  };
}

function drawStarfield(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  onReady: () => void
): () => void {
  let { w, h } = setupHiDPICanvas(canvas, ctx);
  const warm = ['#D97706', '#F59E0B', '#FDE68A', '#FB923C'];
  type P = {
    x: number;
    y: number;
    size: number;
    twinklePhase: number;
    twinkleSpeed: number;
    type: number;
  };
  const parts: P[] = [];
  for (let i = 0; i < 80; i++) {
    const r = Math.random();
    parts.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 1 + Math.random() * 3,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.04,
      type: r < 0.7 ? 0 : r < 0.9 ? 1 : 2,
    });
  }

  const pawScale = { s: 1 };
  const gctx = gsap.context(() => {
    gsap.to(pawScale, {
      s: 1.05,
      duration: 2,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  });

  let rafId = 0;
  const loop = () => {
    rafId = requestAnimationFrame(loop);
    ctx.fillStyle = '#1C1008';
    ctx.fillRect(0, 0, w, h);

    parts.forEach((p) => {
      p.twinklePhase += p.twinkleSpeed;
      const op = 0.3 + 0.7 * Math.abs(Math.sin(p.twinklePhase));
      ctx.fillStyle = warm[Math.floor(Math.abs(p.x + p.y)) % warm.length];
      ctx.globalAlpha = op;
      if (p.type === 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 1) {
        drawPawShape(ctx, p.x, p.y, (p.size / 8) * 0.15, op, warm[1]);
      } else {
        drawBone(ctx, p.x, p.y, p.size * 3, 0);
      }
      ctx.globalAlpha = 1;
    });

    const cx = w * 0.5;
    const cy = h * 0.42;
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#D97706';
    drawPawShape(ctx, cx, cy, pawScale.s * 4, 1, '#D97706');
    ctx.restore();
  };
  loop();
  setTimeout(() => onReady(), 200);

  const onResize = () => {
    ({ w, h } = setupHiDPICanvas(canvas, ctx));
  };
  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    gctx.revert();
  };
}

const ANIMATIONS: { fn: AnimationFn; bg: string; label: string; textColor: string }[] = [
  { fn: drawPawPrints, bg: '#FFF8F0', label: 'Loading...', textColor: '#D97706' },
  { fn: drawFishTank, bg: '#EFF6FF', label: 'Just a moment...', textColor: '#D97706' },
  { fn: drawFloatingBones, bg: '#FFF5F0', label: 'Fetching data...', textColor: '#D97706' },
  { fn: drawHeartbeat, bg: '#FFF0F5', label: 'Almost there...', textColor: '#E8536A' },
  { fn: drawBubbles, bg: '#F0FDFA', label: 'Getting ready...', textColor: '#0D9488' },
  { fn: drawStarfield, bg: '#1C1008', label: 'Loading your shop...', textColor: '#FDE68A' },
];

export default function PageLoader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pickedIndex, setPickedIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Step 1: Mark as mounted on client only
  useEffect(() => {
    setMounted(true);
  }, []);

  // Step 2: Pick random animation + show loader on route change
  // Only runs on client (inside useEffect)
  useEffect(() => {
    if (!mounted) return;
    const index = Math.floor(Math.random() * ANIMATIONS.length);
    setPickedIndex(index);
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [pathname, mounted]);

  // Step 3: Run canvas animation when visible + index ready
  useEffect(() => {
    if (!visible || !mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    cleanupRef.current?.();
    gsap.killTweensOf('*');

    const picked = ANIMATIONS[pickedIndex];
    const onReady = () => setTimeout(() => setVisible(false), 800);
    cleanupRef.current = picked.fn(canvas, ctx, onReady);

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      gsap.killTweensOf('*');
    };
  }, [visible, pickedIndex, mounted]);

  // Server render: nothing (prevents hydration mismatch)
  if (!mounted) return null;
  if (!visible) return null;

  const picked = ANIMATIONS[pickedIndex];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-end pb-16"
      style={{ backgroundColor: picked.bg }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center gap-3 pointer-events-none">
        <p className="text-sm font-medium italic" style={{ color: picked.textColor }}>
          {picked.label}
        </p>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-amber-400"
              style={{ animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
