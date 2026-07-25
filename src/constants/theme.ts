export const colors = {
  ink: '#17211B',
  forest: '#173E2B',
  forestSoft: '#2F6348',
  grass: '#4E8B5B',
  orange: '#F26B3A',
  orangeDark: '#D95026',
  gold: '#F5BE4F',
  cream: '#F7F2E8',
  paper: '#FFFCF7',
  white: '#FFFFFF',
  muted: '#6D766F',
  line: '#E4DED2',
  paleGreen: '#E5EFE6',
  paleOrange: '#FDE9DF',
  error: '#B54234',
  shadow: '#102D20',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
};

