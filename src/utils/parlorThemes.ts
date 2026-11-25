export type ParlorThemeId = 'syndicate' | 'noir' | 'speakeasy' | 'manor';

export interface ParlorTheme {
  id: ParlorThemeId;
  name: string;
  subtitle: string;
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  accent: string;
  accentHover: string;
  accentText: string;
  crimson: string;
  glowColor: string;
  swatchColors: [string, string, string];
}

export const PARLOR_THEMES: Record<ParlorThemeId, ParlorTheme> = {
  syndicate: {
    id: 'syndicate',
    name: 'Noir Syndicate',
    subtitle: 'Midnight Navy & Gold',
    bgCanvas: '#070B14',
    bgSurface: '#0F1624',
    bgElevated: '#162035',
    accent: '#F59E0B',
    accentHover: '#FBBF24',
    accentText: '#070B14',
    crimson: '#DC2626',
    glowColor: 'rgba(220, 38, 38, 0.16)',
    swatchColors: ['#070B14', '#DC2626', '#F59E0B'],
  },
  noir: {
    id: 'noir',
    name: 'Velvet Noir',
    subtitle: 'Obsidian & Brass',
    bgCanvas: '#0B0D12',
    bgSurface: '#141821',
    bgElevated: '#1B212E',
    accent: '#E5A93C',
    accentHover: '#F0B84D',
    accentText: '#0B0D12',
    crimson: '#DC2626',
    glowColor: 'rgba(229, 169, 60, 0.14)',
    swatchColors: ['#0B0D12', '#141821', '#E5A93C'],
  },
  speakeasy: {
    id: 'speakeasy',
    name: 'Speakeasy 1928',
    subtitle: 'Mahogany & Gold',
    bgCanvas: '#110C0A',
    bgSurface: '#1C1411',
    bgElevated: '#261B17',
    accent: '#DDA15E',
    accentHover: '#E9B477',
    accentText: '#110C0A',
    crimson: '#B91C1C',
    glowColor: 'rgba(221, 161, 94, 0.16)',
    swatchColors: ['#110C0A', '#1C1411', '#DDA15E'],
  },
  manor: {
    id: 'manor',
    name: 'Moonlit Manor',
    subtitle: 'Indigo & Silver',
    bgCanvas: '#080C16',
    bgSurface: '#101726',
    bgElevated: '#172033',
    accent: '#93C5FD',
    accentHover: '#BFDBFE',
    accentText: '#080C16',
    crimson: '#E11D48',
    glowColor: 'rgba(147, 197, 253, 0.15)',
    swatchColors: ['#080C16', '#101726', '#93C5FD'],
  },
};
