import React, { useEffect, useRef } from 'react';
import { FXIntensity, FXAccent } from './types';

interface Props {
  intensity: FXIntensity;
  mouseReactive: boolean;
  accent: FXAccent;
  theme: 'dark' | 'light';
}

const ACADEMIC_GLYPHS = [
  '·', '+', ':', '⁚', '×', '_', '/', '\\', '|', '~',
  'λ', '∫', '∂', '∑', 'π', '∆', '√', '∞', '≠',
  '0x', '[]', '{}', '->', '::',
];

const DECODE_WORDS = [
  'BACSE', 'BAMAT', 'SQL', 'DBMS', 'INDEX', 'JOIN', 'FK', 'PK',
  'SELECT', 'SCHEMA', 'CACHE', 'HASH', 'O(1)', 'O(logN)', 'TREE',
  '3NF', 'BCNF', 'ACID', 'QUERY', 'TRAN', 'VIEW', 'ASYNC'
];

interface Cell {
  baseChar: string;
  char: string;
  x: number;
  y: number;
  activeUntil: number;
  glow: number;
}

export const AsciiCanvas: React.FC<Props> = ({ intensity, mouseReactive, accent, theme }) => {
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

    const isDark = theme === 'dark';
    const accentColor =
      accent === 'cyan'
        ? (isDark ? '#00f0ff' : '#0e7490')
        : accent === 'monochrome'
        ? (isDark ? '#ffffff' : '#18181b')
        : (isDark ? '#ccff00' : '#4d7c0f');

    const dimColor = isDark ? '#71717a' : '#a1a1aa';

    const alphaMap: Record<FXIntensity, { base: number; hover: number }> = {
      subtle: { base: 0.08, hover: 0.45 },
      medium: { base: 0.14, hover: 0.70 },
      high: { base: 0.22, hover: 0.95 },
    };

    const alphas = alphaMap[intensity];

    // Grid config
    const cellW = 50;
    const cellH = 38;
    let cols = 0;
    let rows = 0;
    let grid: Cell[] = [];

    const initGrid = () => {
      cols = Math.ceil(width / cellW) + 1;
      rows = Math.ceil(height / cellH) + 1;
      grid = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const char = ACADEMIC_GLYPHS[Math.floor(Math.random() * ACADEMIC_GLYPHS.length)];
          grid.push({
            baseChar: char,
            char: char,
            x: c * cellW + cellW * 0.3,
            y: r * cellH + cellH * 0.7,
            activeUntil: 0,
            glow: 0,
          });
        }
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initGrid();
    };

    resize();
    window.addEventListener('resize', resize);

    let mouseX = -1000;
    let mouseY = -1000;
    let lastHoverCheck = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseReactive) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    let lastTime = performance.now();
    let driftY = 0;

    const render = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textBaseline = 'alphabetic';

      driftY += delta * 12;

      // Check mouse proximity to trigger character scramble / decoding
      const hoverRadius = intensity === 'high' ? 180 : 130;
      const canCheckHover = mouseReactive && (now - lastHoverCheck > 40);
      if (canCheckHover) {
        lastHoverCheck = now;
        for (let i = 0; i < grid.length; i++) {
          const cell = grid[i];
          const dist = Math.hypot(cell.x - mouseX, cell.y - mouseY);
          if (dist < hoverRadius) {
            cell.activeUntil = now + 900;
            cell.glow = 1.0;
            // Scramble glyph
            if (Math.random() > 0.4) {
              const word = DECODE_WORDS[Math.floor(Math.random() * DECODE_WORDS.length)];
              cell.char = Math.random() > 0.7 ? word : ACADEMIC_GLYPHS[Math.floor(Math.random() * ACADEMIC_GLYPHS.length)];
            }
          }
        }
      }

      // Draw all grid cells
      for (let i = 0; i < grid.length; i++) {
        const cell = grid[i];
        const isActive = cell.activeUntil > now;

        if (isActive) {
          // Fade glow
          cell.glow = Math.max(0, (cell.activeUntil - now) / 900);
          ctx.fillStyle = accentColor;
          ctx.globalAlpha = alphas.hover * cell.glow;
          ctx.fillText(cell.char, cell.x, cell.y);
        } else {
          // Reset char once deactivated
          if (cell.char !== cell.baseChar) {
            cell.char = cell.baseChar;
          }

          // Ambient subtle wave modulation
          const wave = Math.sin(cell.x * 0.01 + cell.y * 0.02 + driftY * 0.1);
          const ambientAlpha = alphas.base * (0.8 + wave * 0.3);

          ctx.fillStyle = dimColor;
          ctx.globalAlpha = ambientAlpha;
          ctx.fillText(cell.char, cell.x, cell.y);
        }
      }

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
