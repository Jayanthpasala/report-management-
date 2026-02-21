// Design tokens from Tactical Finance design system
export const colors = {
  background: {
    default: '#09090b',
    surface: '#18181b',
    overlay: '#27272a',
    elevated: '#1e1e22',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    muted: '#64748b',
    inverse: '#09090b',
  },
  brand: {
    primary: '#10b981',
    primaryDark: '#059669',
    secondary: '#7c3aed',
    accent: '#f43f5e',
  },
  status: {
    success: '#10b981',
    warning: '#fbbf24',
    error: '#f43f5e',
    info: '#3b82f6',
  },
  border: {
    default: '#27272a',
    light: '#3f3f46',
    focus: '#10b981',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const fonts = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    hero: 40,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
