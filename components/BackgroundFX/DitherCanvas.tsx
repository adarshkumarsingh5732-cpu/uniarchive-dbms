import React, { useEffect, useRef } from 'react';
import { FXIntensity, FXAccent } from './types';

interface Props {
  intensity: FXIntensity;
  mouseReactive: boolean;
  accent: FXAccent;
  theme: 'dark' | 'light';
}

// 8x8 Bayer Matrix normalized from 0 to 63
const BAYER_8X8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
];

export const DitherCanvas: React.FC<Props> = ({ intensity, mouseReactive, accent, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    let animId: number;
    const PIXEL_SCALE = 4; // 1 dither dot = 4x4 screen pixels (authentic retro pixel scale)

    let bufWidth = 0;
    let bufHeight = 0;
    let imgData: ImageData | null = null;
    let data32: Uint32Array | null = null;

    // Intensity scaling
    const intensityFactor = intensity === 'high' ? 1.0 : intensity === 'medium' ? 0.65 : 0.35;

    // RGBA colors as 32-bit Little-Endian integers (0xAABBGGRR)
    const isDark = theme === 'dark';
    let dotColor32 = 0x22a1a1aa; // default faint grey dot

    if (accent === 'neon') {
      // #ccff00 in dark -> (r: 204, g: 255, b: 0), alpha: 0x28 or 0x44
      const alpha = isDark ? (intensity === 'high' ? 0x55 : 0x30) : 0x25;
      const r = isDark ? 204 : 77;
      const g = isDark ? 255 : 124;
      const b = isDark ? 0 : 15;
      dotColor32 = (alpha << 24) | (b << 16) | (g << 8) | r;
    } else if (accent === 'cyan') {
      const alpha = isDark ? (intensity === 'high' ? 0x55 : 0x30) : 0x25;
      const r = isDark ? 0 : 14;
      const g = isDark ? 240 : 116;
      const b = isDark ? 255 : 144;
      dotColor32 = (alpha << 24) | (b << 16) | (g << 8) | r;
    } else {
      const alpha = isDark ? 0x2e : 0x20;
      const val = isDark ? 180 : 60;
      dotColor32 = (alpha << 24) | (val << 16) | (val << 8) | val;
    }

    // Cursor position in buffer space
    let mouseX = -1000;
    let mouseY = -1000;
    let targetX = -1000;
    let targetY = -1000;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      bufWidth = Math.floor(w / PIXEL_SCALE);
      bufHeight = Math.floor(h / PIXEL_SCALE);

      canvas.width = bufWidth;
      canvas.height = bufHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      imgData = ctx.createImageData(bufWidth, bufHeight);
      data32 = new Uint32Array(imgData.data.buffer);
    };

    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseReactive) return;
      targetX = e.clientX / PIXEL_SCALE;
      targetY = e.clientY / PIXEL_SCALE;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    let pulse = 0;

    const render = () => {
      if (!imgData || !data32) return;

      if (mouseReactive) {
        mouseX += (targetX - mouseX) * 0.15;
        mouseY += (targetY - mouseY) * 0.15;
      }

      pulse += 0.02;

      const cx = bufWidth * 0.5;
      const cy = bufHeight * 0.5;
      const maxDist = Math.hypot(cx, cy);
      const cursorRadius = (intensity === 'high' ? 70 : 50);

      // Fast scan over downsampled buffer
      for (let y = 0; y < bufHeight; y++) {
        const rowOffset = y * bufWidth;
        const bayerRow = (y & 7) * 8;
        const dy = y - cy;

        for (let x = 0; x < bufWidth; x++) {
          const dx = x - cx;
          const distFromCenter = Math.hypot(dx, dy) / maxDist; // 0 at center, 1 at edge

          // Vignette gradient curve (quadratic falloff toward borders)
          let luminance = Math.pow(distFromCenter, 1.8) * 58 * intensityFactor;

          // Interactive cursor lighting crater: cursor illuminates/reveals nearby dither
          if (mouseReactive && mouseX > 0) {
            const mDist = Math.hypot(x - mouseX, y - mouseY);
            if (mDist < cursorRadius) {
              const mFactor = 1 - mDist / cursorRadius;
              luminance += mFactor * 32 * intensityFactor;
            }
          }

          // Bayer threshold comparison (0..63)
          const bayerThreshold = BAYER_8X8[bayerRow + (x & 7)];

          if (luminance > bayerThreshold) {
            data32[rowOffset + x] = dotColor32;
          } else {
            data32[rowOffset + x] = 0; // transparent
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

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
      style={{
        imageRendering: 'pixelated',
        willChange: 'transform',
      }}
    />
  );
};
