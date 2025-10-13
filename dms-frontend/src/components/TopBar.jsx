// File: src/components/TopBar.jsx

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import ShieldIcon from '@mui/icons-material/Shield';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { Link, useLocation } from 'react-router-dom';
import PengaturanDialog from './SettingsDialog';
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
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const nav = [
    { label: 'Beranda', to: '/home' },
    { label: 'Tambah Dokumen', to: '/add', roles: ['employee', 'owner'] },
    { label: 'Direktori', to: '/directory' },
  ];
  const canSee = (it) => !it.roles || it.roles.includes(role);
  const isActive = (to) =>
    to === '/directory' ? location.pathname.startsWith('/directory') : location.pathname === to;

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          background: 'linear-gradient(90deg,#1976d2 0%,#42a5f5 55%,#7e57c2 100%)',
          backdropFilter: 'blur(5px) saturate(180%)',
          boxShadow: '0 4px 18px rgba(34,50,84,0.09)',
        }}
      >
        <Toolbar sx={{ minHeight: 64, px: { xs: 2, sm: 3 }, gap: 2 }}>
          {/* Left: brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShieldIcon sx={{ fontSize: 33, color: '#fff', opacity: 0.92 }} />
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, letterSpacing: 1.2, color: '#fff' }}
            >
              TTU DMS
            </Typography>
          </Box>

          {/* Middle: top navigation (mobile-visible, horizontally scrollable) */}
          <Box sx={{ display: 'flex', gap: 1.2, ml: 1, overflowX: 'auto', flexWrap: 'nowrap' }}>
            {nav.filter(canSee).map((item) => (
              <Button
                key={item.to}
                component={Link}
                to={item.to}
                size="small"
                sx={{
                  color: '#fff',
                  fontWeight: isActive(item.to) ? 800 : 500,
                  letterSpacing: 0.3,
                  borderRadius: 2,
                  px: 1.5,
                  background: isActive(item.to) ? 'rgba(255,255,255,0.18)' : 'transparent',
                  '&:hover': { background: 'rgba(255,255,255,0.22)' },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          {/* Spacer then greeting */}
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center', minWidth: 140 }}>
            <Typography variant="subtitle1" sx={{ color: '#f0f6fa', fontWeight: 500 }}>
              {getGreeting()}, <b>{username}</b>
            </Typography>
          </Box>

          {/* Right: Settings + Profile + Logout */}
          <Tooltip title="Pengaturan">
            <IconButton
              onClick={() => setSettingsOpen(true)}
              sx={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
              size="large"
            >
              <SettingsRoundedIcon />
            </IconButton>
          </Tooltip>

          <Chip
            avatar={<Avatar sx={{ bgcolor: '#fff', color: '#7e57c2', fontWeight: 600 }}>{initial}</Avatar>}
            label={roleLabel}
            variant="outlined"
            sx={{
              ml: 1,
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.13)',
              '& .MuiAvatar-root': { width: 30, height: 30, fontSize: 19 },
            }}
          />
          <Tooltip title="Logout">
            <IconButton
              onClick={logout}
              sx={{
                ml: 1,
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                '&:hover': { background: 'rgba(234,67,53,0.23)', color: '#e53935' },
              }}
              size="large"
            >
              <LogoutIcon sx={{ fontSize: 26 }} />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <PengaturanDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
