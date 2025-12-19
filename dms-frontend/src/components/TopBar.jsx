// File: src/components/TopBar.jsx
// Unified top navigation bar (desktop + mobile), replaces separate SideNav.

import React, { useState, useContext } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import ShieldIcon from '@mui/icons-material/Shield';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import HomeIcon from '@mui/icons-material/Home';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import { Link, useLocation } from 'react-router-dom';
import PengaturanDialog from './SettingsDialog';
import { logout } from '../utils/auth';
import { ColorModeContext } from '../theme/ColorModeProvider';

// Shared nav config (was duplicated in SideNav) 
const navItems = [
  { label: 'Beranda', to: '/home', icon: <HomeIcon />, color: '#ffffff' },
  {
    label: 'Tambah Dokumen',
    to: '/add',
    icon: <AddCircleRoundedIcon />,
    color: '#ffe4ff',
    roles: ['employee', 'owner'],
  },
  {
    label: 'Direktori',
    to: '/directory',
    icon: <FolderSpecialRoundedIcon />,
    color: '#dcfce7',
  },
];

function isActivePath(pathname, to) {
  if (to === '/home') return pathname === '/home';
  if (to === '/add') return pathname === '/add';
  if (to === '/directory') return pathname.startsWith('/directory');
  return false;
}

// Custom greeting by hour + username :contentReference[oaicite:1]{index=1}
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
  const { mode, toggle: toggleMode } = useContext(ColorModeContext);
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navMenuEl, setNavMenuEl] = useState(null);   // mobile nav
  const [userMenuEl, setUserMenuEl] = useState(null); // avatar menu

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

  const initial = username ? username[0].toUpperCase() : '?';

  const nav = navItems;
  const canSee = (item) => !item.roles || item.roles.includes(role);
  const isActive = (to) => isActivePath(location.pathname, to);

  const handleToggleColorMode = () => {
    toggleMode(!(mode === 'dark'));
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          background:
            'linear-gradient(120deg,#1d4ed8 0%,#2563eb 40%,#7e57c2 100%)',
          backdropFilter: 'blur(5px) saturate(180%)',
          boxShadow: '0 4px 18px rgba(15,23,42,0.22)',
        }}
      >
        <Toolbar
          sx={{ minHeight: 64, px: { xs: 2, sm: 3 }, gap: { xs: 2, md: 1 } }}
        >
          {/* Brand / app identity */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShieldIcon sx={{ fontSize: 32, color: '#e0f2fe' }} />
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  color: '#f9fafb',
                  lineHeight: 1.1,
                }}
              >
                TTU DMS
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  color: 'rgba(226,232,240,0.9)',
                  fontSize: 11,
                }}
              >
                Document Management System
              </Typography>
            </Box>
          </Box>

          {/* Desktop nav in the center */}
          {isMdUp && (
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                justifyContent: 'flex-start',
                gap: 1,
              }}
            >
              {nav.filter(canSee).map((item) => {
                const active = isActive(item.to);
                return (
                  <Button
                    key={item.to}
                    component={Link}
                    to={item.to}
                    startIcon={item.icon}
                    disableElevation
                    sx={{
                      borderRadius: 999,
                      textTransform: 'none',
                      px: 1.8,
                      py: 0.6,
                      fontWeight: active ? 700 : 500,
                      fontSize: 14,
                      color: active
                        ? '#0f172a'
                        : 'rgba(241,245,249,0.95)',
                      backgroundColor: active
                        ? 'rgba(248,250,252,0.96)'
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: active
                          ? 'rgba(248,250,252,1)'
                          : 'rgba(15,23,42,0.18)',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Box>
          )}

          {/* Spacer for mobile (since nav is in menu) */}
          {!isMdUp && <Box sx={{ flexGrow: 1 }} />}

          {/* Greeting (hide on very small) */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              mr: 1,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                color: '#e5edff',
                fontWeight: 500,
                maxWidth: 220,
                textAlign: 'right',
              }}
            >
              {getGreeting()},{' '}
              <Box component="span" sx={{ fontWeight: 700 }}>
                {username}
              </Box>
            </Typography>
          </Box>

          {/* Theme toggle */}
          <Tooltip
            title={mode === 'dark' ? 'Mode terang' : 'Mode gelap'}
            arrow
          >
            <IconButton
              onClick={handleToggleColorMode}
              sx={{
                mr: 0.5,
                color: '#e5edff',
                backgroundColor: 'rgba(15,23,42,0.35)',
                '&:hover': {
                  backgroundColor: 'rgba(15,23,42,0.6)',
                },
              }}
              size="large"
            >
              {mode === 'dark' ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <DarkModeIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          {/* Avatar + role chip (opens user menu) */}
          <Chip
            onClick={(e) => setUserMenuEl(e.currentTarget)}
            avatar={
              <Avatar
                sx={{
                  bgcolor: '#f9fafb',
                  color: '#4f46e5',
                  fontWeight: 700,
                }}
              >
                {initial}
              </Avatar>
            }
            label={roleLabel || 'Profil'}
            variant="outlined"
            sx={{
              ml: 0.5,
              color: '#f9fafb',
              borderColor: 'rgba(248,250,252,0.6)',
              backgroundColor: 'rgba(15,23,42,0.35)',
              '& .MuiAvatar-root': { width: 30, height: 30, fontSize: 16 },
              '&:hover': {
                backgroundColor: 'rgba(15,23,42,0.55)',
              },
            }}
          />

          {/* Mobile nav trigger */}
          {!isMdUp && (
            <IconButton
              aria-label="Navigasi"
              onClick={(e) => setNavMenuEl(e.currentTarget)}
              sx={{
                ml: 0.5,
                color: '#f9fafb',
                backgroundColor: 'rgba(15,23,42,0.4)',
                '&:hover': {
                  backgroundColor: 'rgba(15,23,42,0.7)',
                },
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile navigation menu (all main nav items + pengaturan) */}
      <Menu
        anchorEl={navMenuEl}
        open={Boolean(navMenuEl)}
        onClose={() => setNavMenuEl(null)}
      >
        {nav.filter(canSee).map((item) => (
          <MenuItem
            key={item.to}
            component={Link}
            to={item.to}
            onClick={() => setNavMenuEl(null)}
            selected={isActive(item.to)}
          >
            <ListItemIcon sx={{ color: item.color }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setSettingsOpen(true);
            setNavMenuEl(null);
          }}
        >
          <ListItemIcon>
            <SettingsRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Pengaturan" />
        </MenuItem>
      </Menu>

      {/* User / profile menu */}
      <Menu
        anchorEl={userMenuEl}
        open={Boolean(userMenuEl)}
        onClose={() => setUserMenuEl(null)}
      >
        <MenuItem disabled sx={{ opacity: 0.9 }}>
          {username}
        </MenuItem>
        <MenuItem disabled sx={{ opacity: 0.75 }}>
          {roleLabel || '—'}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setSettingsOpen(true);
            setUserMenuEl(null);
          }}
        >
          <ListItemIcon>
            <SettingsRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Pengaturan" />
        </MenuItem>
        <MenuItem onClick={handleToggleColorMode}>
          <ListItemIcon>
            {mode === 'dark' ? (
              <LightModeIcon fontSize="small" />
            ) : (
              <DarkModeIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={mode === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (window.confirm('Logout sekarang?')) logout();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </MenuItem>
        <Divider />
        <MenuItem disabled>
          <ListItemText
            primaryTypographyProps={{ variant: 'caption' }}
            primary="TTU DMS · Versi 1.0.6"
          />
        </MenuItem>
      </Menu>

      <PengaturanDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
