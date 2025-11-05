import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { getTheme } from './theme';

const ThemeModeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    return saved || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => getTheme(mode), [mode]);

  const value = useMemo(() => ({ mode, toggleTheme }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
