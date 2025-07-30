import React, { createContext, useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';

export const ColorModeContext = createContext({ toggle: () => {}, mode: 'light' });

export default function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(
    localStorage.getItem('pref_dark') === 'true' ? 'dark' : 'light'
  );

  const colorMode = useMemo(
    () => ({
      mode,
      toggle: (toDark) => {
        const next = toDark ? 'dark' : 'light';
        setMode(next);
        localStorage.setItem('pref_dark', next === 'dark');
      },
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: '#1976d2' },
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
