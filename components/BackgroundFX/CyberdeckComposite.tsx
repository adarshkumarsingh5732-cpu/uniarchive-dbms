import React from 'react';
import { FXIntensity, FXAccent } from './types';
import { DitherCanvas } from './DitherCanvas';
import { LightingCanvas } from './LightingCanvas';
import { AsciiCanvas } from './AsciiCanvas';

interface Props {
  intensity: FXIntensity;
  mouseReactive: boolean;
  accent: FXAccent;
  theme: 'dark' | 'light';
}

export const CyberdeckComposite: React.FC<Props> = ({ intensity, mouseReactive, accent, theme }) => {
  // In composite mode, tune individual intensities so they layer harmoniously without visual clutter
  const compositeIntensity: FXIntensity = intensity === 'high' ? 'medium' : 'subtle';

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Base Layer: Dither Vignette */}
      <DitherCanvas
        intensity={compositeIntensity}
        mouseReactive={mouseReactive}
        accent={accent}
        theme={theme}
      />
      {/* Mid Layer: Sparse ASCII Constellation */}
      <AsciiCanvas
        intensity={compositeIntensity}
        mouseReactive={mouseReactive}
        accent={accent}
        theme={theme}
      />
      {/* Top Layer: Phosphor Cursor Reticle & Grid Intersections */}
      <LightingCanvas
        intensity={intensity}
        mouseReactive={mouseReactive}
        accent={accent}
        theme={theme}
      />
    </div>
  );
};
