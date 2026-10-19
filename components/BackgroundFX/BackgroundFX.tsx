import React from 'react';
import { FXConfig } from './types';
import { LightingCanvas } from './LightingCanvas';
import { DitherCanvas } from './DitherCanvas';
import { AsciiCanvas } from './AsciiCanvas';
import { ParallaxField } from './ParallaxField';
import { CyberdeckComposite } from './CyberdeckComposite';

interface Props {
  config: FXConfig;
  theme: 'dark' | 'light';
}

export const BackgroundFX: React.FC<Props> = ({ config, theme }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Structural 40px Grid Baseline (Original layout anchor) */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M40 0H0V40' fill='none' stroke='%23a1a1aa' stroke-width='1'/%3E%3C/svg%3E\")",
          backgroundSize: '40px 40px',
        }}
      />

      {/* Active Prototype Effect Layer */}
      {config.mode === 'lighting' && (
        <LightingCanvas
          intensity={config.intensity}
          mouseReactive={config.mouseReactive}
          accent={config.accent}
          theme={theme}
        />
      )}

      {config.mode === 'dither' && (
        <DitherCanvas
          intensity={config.intensity}
          mouseReactive={config.mouseReactive}
          accent={config.accent}
          theme={theme}
        />
      )}

      {config.mode === 'ascii' && (
        <AsciiCanvas
          intensity={config.intensity}
          mouseReactive={config.mouseReactive}
          accent={config.accent}
          theme={theme}
        />
      )}

      {config.mode === 'parallax' && (
        <ParallaxField
          intensity={config.intensity}
          mouseReactive={config.mouseReactive}
          accent={config.accent}
          theme={theme}
        />
      )}

      {config.mode === 'cyberdeck' && (
        <CyberdeckComposite
          intensity={config.intensity}
          mouseReactive={config.mouseReactive}
          accent={config.accent}
          theme={theme}
        />
      )}
    </div>
  );
};
