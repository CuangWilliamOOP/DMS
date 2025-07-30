// File: src/components/TopBar.jsx

import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Chip,
  Avatar,
  IconButton,
  useTheme,
  Tooltip,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import ShieldIcon from '@mui/icons-material/Shield';
import { logout } from '../utils/auth';

// Custom greeting by hour + username
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 10) return 'Selamat Pagi';
  if (hour < 14) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

export default function TopBar() {
  const theme = useTheme();
  const username = localStorage.getItem('username') || 'Pengguna';
  const role = localStorage.getItem('role') || '';
  const roleLabel =
    role === 'owner'
      ? 'Owner'
      : role === 'higher-up'
      ? 'Pimpinan'
      : role === 'employee'
      ? 'Karyawan'
      : '';

  // Just first letter for avatar
  const initial = username ? username[0].toUpperCase() : '?';

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 55%, #7e57c2 100%)',
        backdropFilter: 'blur(5px) saturate(180%)',
        boxShadow: '0 4px 18px rgba(34,50,84,0.09)',
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: { xs: 2, sm: 3 } }}>
        {/* Left: Logo & Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShieldIcon sx={{ fontSize: 33, color: '#fff', mr: 0.2, opacity: 0.92 }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              letterSpacing: 1.2,
              color: '#fff',
              textShadow: '0 1px 6px rgba(44,58,90,0.12)',
            }}
          >
            TTU DMS
          </Typography>
        </Box>

        {/* Middle: Greeting */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', minWidth: 140 }}>
          <Typography
            variant="subtitle1"
            sx={{
              color: '#f0f6fa',
              fontWeight: 500,
              fontSize: { xs: '1.08rem', sm: '1.16rem' },
              textShadow: '0 1px 8px rgba(25,118,210,0.10)',
            }}
          >
            {getGreeting()}, <b>{username}</b>
          </Typography>
        </Box>

        {/* Right: Profile + Logout */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            avatar={
              <Avatar sx={{ bgcolor: '#fff', color: '#7e57c2', fontWeight: 600 }}>
                {initial}
              </Avatar>
            }
            label={roleLabel}
            variant="outlined"
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.4)',
              fontWeight: 500,
              fontSize: '1em',
              background: 'rgba(255,255,255,0.13)',
              pr: 1.2,
              '& .MuiAvatar-root': { width: 30, height: 30, fontSize: 19 },
            }}
          />
          <Tooltip title="Logout">
            <IconButton
              onClick={logout}
              sx={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                ml: 1,
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'rgba(234,67,53,0.23)',
                  color: '#e53935',
                  transform: 'scale(1.08)',
                  boxShadow: '0 2px 8px rgba(229,57,53,0.13)',
                },
              }}
              size="large"
            >
              <LogoutIcon sx={{ fontSize: 26 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
