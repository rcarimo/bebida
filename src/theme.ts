export const colors = {
  bg: '#0E0F12',
  surface: '#1A1C22',
  surface2: '#262932',
  tile: '#2A2D36',
  border: '#3A3D46',
  text: '#F4F1EA',
  textSoft: '#D9D4CA',
  muted: '#B5AFA4',
  accent: '#F5B53D',
  accentDim: '#8A6A26',
  accentText: '#14110A',
  accentSoft: '#3A2E12',
  water: '#1F3A40',
  waterText: '#E6F6F8',
  danger: '#F28B6B',
};

export const radius = { sm: 12, md: 18, lg: 22, xl: 28 };

/** Cores rotativas para os botões de bebida na noite (a 1.ª é a mais destacada). */
export const tilePalette = [
  { bg: colors.accent, fg: colors.accentText },
  { bg: colors.tile, fg: colors.text },
  { bg: colors.tile, fg: colors.text },
  { bg: colors.water, fg: colors.waterText },
  { bg: colors.tile, fg: colors.text },
  { bg: colors.tile, fg: colors.text },
];
