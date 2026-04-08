export const COLORS = {
  // Brand
  deepTeal: '#0D4F4F',
  teal: '#14897A',
  crimson: '#DC143C',
  orange: '#E07B3A',

  // Text
  textPrimary: '#1a1a1a',
  textSecondary: '#555',
  textMuted: '#888',

  // UI
  cardBg: '#ffffff',
  pageBg: '#F4F5F0',
  border: 'rgba(0,0,0,0.08)',

  // Status
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',

  // Transparent
  overlay: 'rgba(0,0,0,0.45)',
};

export const FONTS = {
  family: 'System', // falls back to device system font (San Francisco / Roboto)
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    h1: 28,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 99,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
};
