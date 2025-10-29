
'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CssBaseline } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';

const STORAGE_KEY = 'theme';
const COLOR_SCHEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch (error) {
    return null;
  }
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia(COLOR_SCHEME_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function applyTheme(nextTheme: Theme) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(nextTheme);
  root.style.colorScheme = nextTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const hasUserPreferenceRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = getStoredTheme();

    if (stored) {
      hasUserPreferenceRef.current = true;
      setThemeState(stored);
      applyTheme(stored);
      return;
    }

    const initial = getSystemTheme();
    setThemeState(initial);
    applyTheme(initial);

    const media = window.matchMedia(COLOR_SCHEME_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      if (hasUserPreferenceRef.current) {
        return;
      }
      const next = event.matches ? 'dark' : 'light';
      setThemeState(next);
      applyTheme(next);
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    hasUserPreferenceRef.current = true;

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch (error) {
        // Ignore write errors (e.g., private mode or disabled storage)
      }
    }

    applyTheme(nextTheme);
  }, []);

  const contextValue = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme,
          primary: {
            main: '#0d9488',
            contrastText: theme === 'dark' ? '#0f172a' : '#ffffff',
          },
          secondary: {
            main: '#14b8a6',
          },
          background: {
            default: theme === 'dark' ? '#0f172a' : '#f8fafc',
            paper: theme === 'dark' ? '#0b1120' : '#ffffff',
          },
        },
        typography: {
          fontFamily: 'var(--font-inter), var(--font-myanmar), system-ui, sans-serif',
        },
        shape: {
          borderRadius: 16,
        },
        components: {
          MuiButton: {
            defaultProps: {
              disableElevation: true,
              variant: 'contained',
            },
          },
          MuiLink: {
            defaultProps: {
              underline: 'hover',
            },
          },
        },
      }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <AppRouterCacheProvider options={{ key: 'mui' }}>
        <MuiThemeProvider theme={muiTheme}>
          <CssBaseline enableColorScheme />
          {children}
        </MuiThemeProvider>
      </AppRouterCacheProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
