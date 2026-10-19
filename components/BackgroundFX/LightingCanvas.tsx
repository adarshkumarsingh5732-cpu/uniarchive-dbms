import React, { useEffect, useRef } from 'react';
import { FXIntensity, FXAccent } from './types';

interface Props {
  intensity: FXIntensity;
  mouseReactive: boolean;
  accent: FXAccent;
  theme: 'dark' | 'light';
}

export const LightingCanvas: React.FC<Props> = ({ intensity, mouseReactive, accent, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Alpha / intensity multipliers
    const alphaMap: Record<FXIntensity, number> = {
      subtle: 0.25,
      medium: 0.5,
      high: 0.85,
    };
    const baseAlpha = alphaMap[intensity];

    // Colors
    const isDark = theme === 'dark';
    const accentHex =
      accent === 'cyan'
        ? (isDark ? '#00f0ff' : '#0e7490')
        : accent === 'monochrome'
        ? (isDark ? '#d4d4d8' : '#3f3f46')
        : (isDark ? '#ccff00' : '#4d7c0f');

    const gridColor = isDark ? 'rgba(161, 161, 170, 0.08)' : 'rgba(113, 113, 122, 0.12)';

    // Cursor state with lerp
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 3;
    let targetX = mouseX;
    let targetY = mouseY;
    let hasMoved = false;
    let lastMoveTime = Date.now();

    // Scanline & Radar state
    let scanY = 0;
    let radarAngle = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseReactive) return;
      targetX = e.clientX;
      targetY = e.clientY;
      hasMoved = true;
      lastMoveTime = Date.now();
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Render loop
    let lastTime = performance.now();

    const render = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Smooth pointer lerp
      if (mouseReactive && hasMoved) {
        mouseX += (targetX - mouseX) * 0.1;
        mouseY += (targetY - mouseY) * 0.1;
      }

      // Check idle (if idle > 2.5s, gently drift or pulse)
      const isIdle = !mouseReactive || (Date.now() - lastMoveTime > 2500);
      if (isIdle && !prefersReducedMotion) {
        radarAngle += delta * 0.6;
        // subtle hover float around center
        targetX = width / 2 + Math.cos(radarAngle * 0.8) * (width * 0.2);
        targetY = height / 3 + Math.sin(radarAngle * 0.7) * (height * 0.15);
        mouseX += (targetX - mouseX) * 0.05;
        mouseY += (targetY - mouseY) * 0.05;
      }

      // 1. Draw horizontal CRT phosphor scanline sweep
      if (!prefersReducedMotion) {
        scanY = (scanY + delta * 90) % height;
        ctx.fillStyle = accentHex;
        ctx.globalAlpha = baseAlpha * 0.12;
        ctx.fillRect(0, scanY, width, 1.5);
      }

      // 2. Grid Intersections & Spotlight
      const gridSize = 40;
      const radius = intensity === 'high' ? 280 : intensity === 'medium' ? 220 : 160;

      const minCol = Math.max(0, Math.floor((mouseX - radius) / gridSize));
      const maxCol = Math.min(Math.floor(width / gridSize), Math.ceil((mouseX + radius) / gridSize));
      const minRow = Math.max(0, Math.floor((mouseY - radius) / gridSize));
      const maxRow = Math.min(Math.floor(height / gridSize), Math.ceil((mouseY + radius) / gridSize));

      ctx.strokeStyle = accentHex;
      ctx.fillStyle = accentHex;
      ctx.lineWidth = 1;

      for (let c = minCol; c <= maxCol; c++) {
        for (let r = minRow; r <= maxRow; r++) {
          const gx = c * gridSize;
          const gy = r * gridSize;
          const dist = Math.hypot(gx - mouseX, gy - mouseY);

          if (dist < radius) {
            const falloff = 1 - dist / radius; // 1 at center, 0 at edge
            const cellAlpha = falloff * falloff * baseAlpha;

            // Highlight intersection with a micro cross '+'
            ctx.globalAlpha = cellAlpha * 0.7;
            const arm = 3;
            ctx.beginPath();
            ctx.moveTo(gx - arm, gy);
            ctx.lineTo(gx + arm, gy);
            ctx.moveTo(gx, gy - arm);
            ctx.lineTo(gx, gy + arm);
            ctx.stroke();

            // Connect nearby grid lines when very close to cursor
            if (falloff > 0.6) {
              ctx.globalAlpha = cellAlpha * 0.25;
              ctx.beginPath();
              ctx.moveTo(gx, gy);
              ctx.lineTo(gx + gridSize, gy);
              ctx.moveTo(gx, gy);
              ctx.lineTo(gx, gy + gridSize);
              ctx.stroke();
            }
          }
        }
      }

      // 3. Phosphor Reticle at Cursor Position
      ctx.globalAlpha = baseAlpha * 0.55;
      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 1;

      // Small central reticle
      const reticleSize = 8;
      ctx.beginPath();
      ctx.moveTo(mouseX - reticleSize, mouseY);
      ctx.lineTo(mouseX + reticleSize, mouseY);
      ctx.moveTo(mouseX, mouseY - reticleSize);
      ctx.lineTo(mouseX, mouseY + reticleSize);
      ctx.stroke();

      // Outer concentric ring 1
      const ring1 = 45;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, ring1, 0, Math.PI * 2);
      ctx.stroke();

      // Segmented ring 2 with ticks
      const ring2 = intensity === 'high' ? 140 : 100;
      ctx.globalAlpha = baseAlpha * 0.3;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, ring2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // Coordinate readout next to reticle
      ctx.globalAlpha = baseAlpha * 0.65;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        `X:${Math.round(mouseX).toString().padStart(4, '0')} Y:${Math.round(mouseY).toString().padStart(4, '0')}`,
        mouseX + 16,
        mouseY - 12
      );

      ctx.globalAlpha = 1.0;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [intensity, mouseReactive, accent, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ willChange: 'transform' }}
    />
  );
};
