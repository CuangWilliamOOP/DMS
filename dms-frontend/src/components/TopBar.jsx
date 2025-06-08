// File: src/components/TopBar.jsx
import React from 'react';
import { AppBar, Toolbar, Typography, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Fungsi sederhana untuk menentukan sapaan sesuai jam
function getGreeting() {
  const now = new Date();
  const hour = now.getHours();

  if (hour < 10) {
    return 'Selamat Pagi';
  } else if (hour < 14) {
    return 'Selamat Siang';
  } else if (hour < 18) {
    return 'Selamat Sore';
  } else {
    return 'Selamat Malam';
  }
}

function TopBar() {
  const navigate = useNavigate();

  // Klik Logout => kembali ke halaman login
  const handleLogout = () => {
    // Di sini Anda bisa menambahkan logika clear session/token, dsb.
    navigate('/login');
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1, // Pastikan AppBar di atas Drawer
      }}
    >
      <Toolbar sx={{ bgcolor: '#1976d2' }}>
        {/* Bagian kiri: Judul DMS */}
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          DMS
        </Typography>

        {/* Bagian tengah: sapaan */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
            {getGreeting()}
          </Typography>
        </Box>

        {/* Bagian kanan: tombol Logout */}
        <Button variant="contained" color="inherit" onClick={handleLogout}>
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
}

export default TopBar;
