// src/layouts/MainLayout.jsx
import React from 'react';
import { Box, Toolbar } from '@mui/material';
import TopBar from '../components/TopBar';

function MainLayout({ children }) {
  return (
    <Box sx={{ display: 'flex' }}>
      <TopBar />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: { xs: 1.5, md: 2 }, minHeight: '100vh', bgcolor: (t)=> t.palette.mode==='dark' ? '#0f111a' : '#eaf2ff' }}
      >
        <Toolbar sx={{ minHeight: 64 }} />
        {children}
      </Box>
    </Box>
  );
}

export default MainLayout;
