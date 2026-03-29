/**
 * Marbleized texture patterns for backgrounds
 * These can be used with ImageBackground or as LinearGradient configurations
 */

export const MARBLE_TEXTURES = {
  lightBlue: {
    gradientColors: ['#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6'] as const,
    gradientLocations: [0, 0.3, 0.7, 1] as const,
  },
  navyBlue: {
    gradientColors: ['#1E3A5F', '#2C5282', '#1E3A5F', '#0F172A'] as const,
    gradientLocations: [0, 0.4, 0.7, 1] as const,
  },
  teal: {
    gradientColors: ['#E0F2F1', '#B2DFDB', '#80CBC4', '#4DB6AC'] as const,
    gradientLocations: [0, 0.3, 0.7, 1] as const,
  },
  gold: {
    gradientColors: ['#F8FCFF', '#ECF6FF', '#DDEEFF', '#CDE4FB'] as const,
    gradientLocations: [0, 0.28, 0.72, 1] as const,
  },
  purple: {
    gradientColors: ['#EDE7F6', '#D1C4E9', '#B39DDB', '#9575CD'] as const,
    gradientLocations: [0, 0.3, 0.7, 1] as const,
  },
  green: {
    gradientColors: ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784'] as const,
    gradientLocations: [0, 0.3, 0.7, 1] as const,
  },
  white: {
    gradientColors: ['#FFFFFF', '#F2F8FF', '#E3F0FB', '#F8FCFF'] as const,
    gradientLocations: [0, 0.28, 0.72, 1] as const,
  },
  darkBlue: {
    gradientColors: ['#0A1628', '#0F2744', '#1A3A5F', '#244B7A'] as const,
    gradientLocations: [0, 0.3, 0.7, 1] as const,
  },
};

export type MarbleTextureName = keyof typeof MARBLE_TEXTURES;

export function getMarbleGradient(textureName: MarbleTextureName) {
  return MARBLE_TEXTURES[textureName];
}
