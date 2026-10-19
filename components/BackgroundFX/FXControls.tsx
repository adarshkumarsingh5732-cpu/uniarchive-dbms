import React, { useState } from 'react';
import { FXConfig, EffectMode, FXIntensity, FXAccent, DEFAULT_FX_CONFIG } from './types';
import { Sparkles, X, ChevronUp, Eye, Sliders, Zap, Check } from 'lucide-react';

interface Props {
  config: FXConfig;
  onChange: (config: FXConfig) => void;
}

const EFFECT_DESCRIPTIONS: Record<EffectMode, { title: string; subtitle: string; tech: string }> = {
  none: {
    title: 'Standard Grid (Default)',
    subtitle: 'Flat 40px SVG pattern with no dynamic canvas or animation.',
    tech: 'Pure SVG background data-URI • 0% CPU • Zero drawcalls',
  },
  lighting: {
    title: 'CRT Phosphor Spotlight',
    subtitle: 'Cursor-following oscilloscope reticle + grid intersection illumination + CRT scanline.',
    tech: 'Canvas 2D • Proximity math • Dual-ring reticle • 60 FPS',
  },
  dither: {
    title: '8x8 Bayer Ordered Dither',
    subtitle: 'Authentic 1-bit Macintosh/Game Boy hardware dither vignette & cursor lighting crater.',
    tech: 'Downsampled buffer (1/4 res) • Bitwise 32-bit pixel array • ~0.4ms/frame',
  },
  ascii: {
    title: 'Sparse Academic Matrix',
    subtitle: 'Relational algebra, calculus & CS keywords drifting in an ambient constellation.',
    tech: 'JetBrains Mono • Proximity decode trigger • Staggered wave oscillation',
  },
  parallax: {
    title: 'Multilayer Blueprint HUD',
    subtitle: '3-plane architectural coordinate grid reacting to scroll velocity and mouse tilt.',
    tech: 'CSS translate3d • Lerped damping • Zero repaint layout reflow',
  },
  cyberdeck: {
    title: 'Cyberdeck Hybrid',
    subtitle: 'Harmonized composite of Bayer dither vignette, ASCII constellation, and phosphor reticle.',
    tech: 'Multi-pass rendering • Auto-tuned intensity layers',
  },
};

export const FXControls: React.FC<Props> = ({ config, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const update = (patch: Partial<FXConfig>) => {
    onChange({ ...config, ...patch });
  };

  const currentDesc = EFFECT_DESCRIPTIONS[config.mode];

  return (
    <div className="fixed bottom-20 right-3 md:bottom-3 md:right-3 z-40 font-mono select-none">
      {/* Minimized Pill - Small, subtle, non-intrusive */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-uni-panel/90 backdrop-blur-md border border-uni-border hover:border-uni-neon text-uni-muted hover:text-uni-contrast px-2 py-1 md:px-2.5 md:py-1 flex items-center gap-1.5 text-[11px] md:text-xs shadow-sm hover:shadow-hard-neon transition-all opacity-60 hover:opacity-100 cursor-pointer"
          aria-label="Open background effects panel"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-uni-neon" />
          <span className="font-bold text-uni-contrast tracking-wider">FX</span>
          <span className="hidden sm:inline text-uni-neon uppercase font-bold text-[10px]">
            {config.mode === 'none' ? 'OFF' : config.mode}
          </span>
          <ChevronUp size={12} className="text-uni-muted" />
        </button>
      )}

      {/* Expanded Control Modal / Drawer */}
      {isOpen && (
        <div className="w-[calc(100vw-1.5rem)] max-w-sm sm:w-84 max-h-[80vh] overflow-y-auto bg-uni-panel/98 backdrop-blur-xl border-2 border-uni-border shadow-hard-neon p-3.5 sm:p-4 text-uni-text transition-all animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-uni-border pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-uni-neon" />
              <span className="font-display font-bold text-sm uppercase text-uni-contrast tracking-tight">
                Background FX Prototype
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-uni-muted hover:text-uni-alert transition-colors p-1"
              aria-label="Close FX control panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Mode Selector Buttons */}
          <div className="mb-4">
            <label className="text-[10px] text-uni-muted font-bold tracking-wider uppercase mb-1.5 block">
              Effect Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['none', 'lighting', 'dither', 'ascii', 'parallax', 'cyberdeck'] as EffectMode[]).map((mode) => {
                const isActive = config.mode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => update({ mode })}
                    className={`px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-all text-center ${
                      isActive
                        ? 'bg-uni-neon text-uni-black border-uni-neon shadow-hard-neon'
                        : 'bg-uni-dark/80 text-uni-muted border-uni-border hover:border-uni-contrast hover:text-uni-contrast'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Detail Card */}
          <div className="bg-uni-dark border border-uni-border p-2.5 mb-3.5">
            <div className="flex items-center justify-between text-xs font-bold text-uni-contrast mb-1">
              <span>{currentDesc.title}</span>
              <span className="text-[9px] text-uni-neon border border-uni-neon px-1">ACTIVE</span>
            </div>
            <p className="text-[11px] text-uni-muted leading-relaxed mb-2">
              {currentDesc.subtitle}
            </p>
            <div className="text-[9px] text-uni-cyan/90 border-t border-uni-border/60 pt-1.5 flex items-center gap-1">
              <span>⚡</span>
              <span className="truncate">{currentDesc.tech}</span>
            </div>
          </div>

          {/* Settings Section (Disabled if mode is 'none') */}
          {config.mode !== 'none' && (
            <div className="space-y-3 border-t border-uni-border pt-3">
              {/* Intensity */}
              <div>
                <div className="flex justify-between items-center text-[10px] text-uni-muted font-bold tracking-wider uppercase mb-1.5">
                  <span>Intensity</span>
                  <span className="text-uni-contrast">{config.intensity}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['subtle', 'medium', 'high'] as FXIntensity[]).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => update({ intensity: lvl })}
                      className={`py-1 text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        config.intensity === lvl
                          ? 'bg-uni-contrast text-uni-black border-uni-contrast'
                          : 'bg-uni-dark border-uni-border text-uni-muted hover:text-uni-contrast'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color & Mouse Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-uni-muted font-bold tracking-wider uppercase mb-1 block">
                    Accent
                  </label>
                  <div className="flex gap-1">
                    {(['neon', 'cyan', 'monochrome'] as FXAccent[]).map((acc) => {
                      const isActive = config.accent === acc;
                      const colorBadge =
                        acc === 'neon'
                          ? 'bg-[#ccff00]'
                          : acc === 'cyan'
                          ? 'bg-[#00f0ff]'
                          : 'bg-[#d4d4d8]';
                      return (
                        <button
                          key={acc}
                          onClick={() => update({ accent: acc })}
                          className={`flex-1 py-1 text-[9px] font-bold uppercase border flex items-center justify-center gap-1 transition-all ${
                            isActive
                              ? 'border-uni-contrast text-uni-contrast bg-uni-dark'
                              : 'border-uni-border text-uni-muted hover:border-uni-contrast'
                          }`}
                          title={acc}
                        >
                          <span className={`w-2 h-2 rounded-full ${colorBadge}`} />
                          <span className="hidden sm:inline">{acc[0].toUpperCase()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-uni-muted font-bold tracking-wider uppercase mb-1 block">
                    Mouse Tracking
                  </label>
                  <button
                    onClick={() => update({ mouseReactive: !config.mouseReactive })}
                    className={`w-full py-1 text-[10px] font-bold uppercase border transition-all flex items-center justify-center gap-1.5 ${
                      config.mouseReactive
                        ? 'border-uni-neon text-uni-neon bg-uni-dark'
                        : 'border-uni-border text-uni-muted'
                    }`}
                  >
                    {config.mouseReactive ? <Check size={12} /> : null}
                    <span>{config.mouseReactive ? 'Active' : 'Locked'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-3 pt-2.5 border-t border-uni-border flex justify-between items-center text-[10px] text-uni-muted">
            <span>Saved to localStorage</span>
            <button
              onClick={() => update(DEFAULT_FX_CONFIG)}
              className="hover:text-uni-contrast underline cursor-pointer"
            >
              Reset Default
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
