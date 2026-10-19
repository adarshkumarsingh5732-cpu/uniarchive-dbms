export type EffectMode = 'none' | 'lighting' | 'dither' | 'ascii' | 'parallax' | 'cyberdeck';

export type FXIntensity = 'subtle' | 'medium' | 'high';

export type FXAccent = 'neon' | 'cyan' | 'monochrome';

export interface FXConfig {
  mode: EffectMode;
  intensity: FXIntensity;
  mouseReactive: boolean;
  accent: FXAccent;
}

export const DEFAULT_FX_CONFIG: FXConfig = {
  mode: 'lighting',
  intensity: 'subtle',
  mouseReactive: true,
  accent: 'neon',
};
