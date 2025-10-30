import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

export function gradientBackground(theme: Theme) {
  const primaryLight = alpha(theme.palette.primary.light, theme.palette.mode === 'dark' ? 0.18 : 0.22);
  const accent = alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.16 : 0.2);

  return {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundImage: `linear-gradient(135deg, ${primaryLight} 0%, ${accent} 100%)`,
    backgroundColor: theme.palette.background.default,
  };
}

export function cardSurface(theme: Theme, { compact = false }: { compact?: boolean } = {}) {
  const borderColor = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.16);
  const background = alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.82 : 0.94);

  return {
    borderRadius: 28,
    padding: theme.spacing(compact ? 3 : 4.5),
    border: `1px solid ${borderColor}`,
    background,
    backdropFilter: 'blur(18px)',
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 30px 70px rgba(15, 23, 42, 0.35)'
        : '0 30px 80px rgba(13, 148, 136, 0.18)',
  };
}

export function heroSurface(theme: Theme) {
  const gradientStart = alpha(theme.palette.primary.main, 0.9);
  const gradientEnd = alpha(theme.palette.secondary.main, 0.9);

  return {
    borderRadius: 36,
    padding: theme.spacing(5),
    color: theme.palette.common.white,
    backgroundImage: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
    boxShadow: '0 40px 70px rgba(13, 148, 136, 0.45)',
  };
}

export function subtlePanel(theme: Theme) {
  return {
    borderRadius: 24,
    border: `1px solid ${alpha(theme.palette.primary.light, theme.palette.mode === 'dark' ? 0.3 : 0.18)}`,
    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.7 : 0.85),
    padding: theme.spacing(2.5),
  };
}

export function softBadge(theme: Theme, color: 'primary' | 'success' | 'warning' | 'info' | 'default' = 'default') {
  const palette =
    color === 'primary'
      ? theme.palette.primary
      : color === 'success'
        ? theme.palette.success
        : color === 'warning'
          ? theme.palette.warning
          : color === 'info'
            ? theme.palette.info
            : theme.palette.grey;

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    paddingInline: 12,
    paddingBlock: 6,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1,
    backgroundColor: alpha(palette.main, 0.16),
    color: palette.main,
  };
}
