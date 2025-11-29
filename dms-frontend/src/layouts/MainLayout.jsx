// src/layouts/MainLayout.jsx
// Updated layout: TopBar now owns all navigation; no SideNav.

import React from 'react';
import { Box, Toolbar } from '@mui/material';
import TopBar from '../components/TopBar';

function MainLayout({ children }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar />
      <Box
        component="main"
        id="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, md: 2 },
          minHeight: '100vh',
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? '#0f111a' : '#eaf2ff',
        }}
      >
        {/* Offset so content starts below fixed TopBar */}
        <Toolbar sx={{ minHeight: 64 }} />
        {children}
      </Box>
    </Box>
  );
}

export default MainLayout;
