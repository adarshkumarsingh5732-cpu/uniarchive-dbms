import React, { useEffect, useRef, useState } from 'react';
import { FXIntensity, FXAccent } from './types';

interface Props {
  intensity: FXIntensity;
  mouseReactive: boolean;
  accent: FXAccent;
  theme: 'dark' | 'light';
}

export const ParallaxField: React.FC<Props> = ({ intensity, mouseReactive, accent, theme }) => {
  const isDark = theme === 'dark';

  const accentColorClass =
    accent === 'cyan'
      ? (isDark ? 'text-uni-cyan border-uni-cyan' : 'text-cyan-700 border-cyan-700')
      : accent === 'monochrome'
      ? (isDark ? 'text-zinc-400 border-zinc-400' : 'text-zinc-600 border-zinc-600')
      : (isDark ? 'text-uni-neon border-uni-neon' : 'text-lime-700 border-lime-700');

  const opacityMap: Record<FXIntensity, { deep: string; mid: string; hud: string }> = {
    subtle: { deep: 'opacity-[0.04]', mid: 'opacity-[0.08]', hud: 'opacity-[0.18]' },
    medium: { deep: 'opacity-[0.07]', mid: 'opacity-[0.15]', hud: 'opacity-[0.35]' },
    high:   { deep: 'opacity-[0.12]', mid: 'opacity-[0.25]', hud: 'opacity-[0.55]' },
  };

  const opacities = opacityMap[intensity];

  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0, scrollPct: 0 });

  useEffect(() => {
    let animId: number;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const scrollPct = Math.round((scrollY / maxScroll) * 100);

      setCoords(prev => ({ ...prev, scrollPct }));
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseReactive) return;
      // Normalized between -1 and 1
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;

      setCoords(prev => ({
        ...prev,
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
      }));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    onScroll();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const loop = () => {
      if (mouseReactive && !prefersReducedMotion) {
        currentMouseX += (targetMouseX - currentMouseX) * 0.08;
        currentMouseY += (targetMouseY - currentMouseY) * 0.08;
      } else {
        currentMouseX = 0;
        currentMouseY = 0;
      }

      const scrollY = window.scrollY || window.pageYOffset;

      if (layer1Ref.current) {
        const l1Y = -(scrollY * 0.08) + currentMouseX * -10;
        const l1X = currentMouseX * -12;
        layer1Ref.current.style.transform = `translate3d(${l1X}px, ${l1Y}px, 0)`;
      }

      if (layer2Ref.current) {
        const l2Y = -(scrollY * 0.22) + currentMouseY * -24;
        const l2X = currentMouseX * -28;
        layer2Ref.current.style.transform = `translate3d(${l2X}px, ${l2Y}px, 0)`;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [mouseReactive]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden font-mono select-none">
      {/* Layer 1: Deep Blueprint Plane (Slowest) */}
      <div
        ref={layer1Ref}
        className={`absolute -inset-24 ${opacities.deep} transition-opacity duration-300`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cpath d='M160 0H0V160' fill='none' stroke='%23a1a1aa' stroke-width='1.5'/%3E%3Cpath d='M80 0H0V80' fill='none' stroke='%23a1a1aa' stroke-dasharray='2,6' stroke-width='1'/%3E%3C/svg%3E\")",
          backgroundSize: '160px 160px',
          willChange: 'transform',
        }}
      >
        {/* Major Coordinate Labels floating in space */}
        <div className="absolute top-20 left-16 text-xs text-uni-muted font-bold tracking-widest">[SEC 01 // NORTH]</div>
        <div className="absolute top-96 left-80 text-xs text-uni-muted font-bold tracking-widest">[DATUM +00.00]</div>
        <div className="absolute top-[800px] left-24 text-xs text-uni-muted font-bold tracking-widest">[ZONE B-SCHEMATIC]</div>
        <div className="absolute top-[1200px] left-96 text-xs text-uni-muted font-bold tracking-widest">[GRID-ORIGIN: 3NF]</div>
      </div>

      {/* Layer 2: Midground Technical Markers (Medium speed) */}
      <div
        ref={layer2Ref}
        className={`absolute -inset-32 ${opacities.mid} transition-opacity duration-300`}
        style={{ willChange: 'transform' }}
      >
        {/* Floating crosshairs & slot tags */}
        <div className="absolute top-40 right-48 flex items-center gap-2">
          <span className="text-xl font-bold">+</span>
          <span className="text-[10px] tracking-wider border border-current px-1.5 py-0.5">[SLOT: A1]</span>
        </div>
        <div className="absolute top-72 left-1/3 flex items-center gap-2">
          <span className="text-xl font-bold">+</span>
          <span className="text-[10px] tracking-wider border border-current px-1.5 py-0.5">[INDEX: BTREE]</span>
        </div>
        <div className="absolute top-[500px] right-1/4 flex items-center gap-2">
          <span className="text-xl font-bold">+</span>
          <span className="text-[10px] tracking-wider border border-current px-1.5 py-0.5">[CSE2003]</span>
        </div>
        <div className="absolute top-[900px] left-1/4 flex items-center gap-2">
          <span className="text-xl font-bold">+</span>
          <span className="text-[10px] tracking-wider border border-current px-1.5 py-0.5">[MAT2007]</span>
        </div>

        {/* Alignment corner brackets */}
        <div className="absolute top-48 left-12 w-6 h-6 border-t-2 border-l-2 border-current" />
        <div className="absolute top-[650px] right-16 w-6 h-6 border-b-2 border-r-2 border-current" />
        <div className="absolute top-[1100px] left-40 w-6 h-6 border-b-2 border-l-2 border-current" />
      </div>

      {/* Layer 3: Fixed Screen HUD Corners */}
      <div className={`absolute inset-0 p-4 pointer-events-none flex flex-col justify-between ${opacities.hud} transition-opacity duration-300`}>
        <div className="flex justify-between items-start text-[10px] tracking-wider">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 ${accentColorClass.includes('neon') ? 'bg-uni-neon' : accentColorClass.includes('cyan') ? 'bg-uni-cyan' : 'bg-uni-contrast'}`} />
            <span>SYS_COORD: {coords.x.toString().padStart(4, '0')} : {coords.y.toString().padStart(4, '0')}</span>
          </div>
          <div>
            DEPTH: 3-TIER // PARALLAX
          </div>
        </div>

        <div className="flex justify-between items-end text-[10px] tracking-wider">
          <div>
            SCROLL: {coords.scrollPct}% // PROJECTION: ORTHO
          </div>
          <div>
            STATUS: ACTIVE // CAD_MODE
          </div>
        </div>
      </div>
    </div>
  );
};
