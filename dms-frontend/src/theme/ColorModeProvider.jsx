import React, { createContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import API from '../services/api';

export const ColorModeContext = createContext({ toggle: () => {}, mode: 'light' });

export default function ColorModeProvider({ children }) {
  const [mode, setMode] = useState('light');

  useEffect(() => {
    const fetchTheme = () => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        API.get('/user-settings/')
          .then(({ data }) => {
            if (data.theme_mode) setMode(data.theme_mode);
          })
          .catch(() => {});
      } else {
        setMode('light');
      }
    };

    fetchTheme();
    window.addEventListener("theme_update", fetchTheme);
    return () => window.removeEventListener("theme_update", fetchTheme);
  }, []);

  const toggleMode = (toDark) => {
    const next = toDark ? "dark" : "light";
    setMode(next);
    API.put('/user-settings/', { theme_mode: next }).catch(() => {});
  };

  const colorMode = useMemo(
    () => ({
      mode,
      toggle: toggleMode,
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
