// src/layouts/MainLayout.jsx
import React from 'react';
import { Box, Toolbar } from '@mui/material';
import TopBar from '../components/TopBar';
import SideNav from '../components/SideNav';

function MainLayout({ children }) {
  return (
    <Box sx={{ display: 'flex' }}>
      <TopBar />
      <SideNav />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          mt: '64px',         // ruang di atas (AppBar fixed)
          marginLeft: '200px' // ruang di kiri (Drawer lebar 200px)
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

export default MainLayout;
