// File: src/components/SideNav.jsx
// Perubahan: izinkan 'owner' juga melihat link Tambah Dokumen

import React, { useState } from 'react';
import {
  Drawer, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Box, Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AddBoxIcon from '@mui/icons-material/AddBox';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import { Link } from 'react-router-dom';
import PengaturanDialog from '../components/SettingsDialog';

function SideNav() {
  const userRole = localStorage.getItem('role'); // 'employee' | 'owner' | 'higher-up'
  const [dlgOpen, setDlgOpen] = useState(false);

  return (
    <Drawer
      variant="permanent"
      sx={{
        zIndex: (theme) => theme.zIndex.appBar - 1,
        '& .MuiDrawer-paper': { top: 0, height: '100vh', width: 200, boxSizing: 'border-box' }
      }}
    >
      <Toolbar />
      <List>
        {/* Beranda */}
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/home">
            <ListItemIcon><HomeIcon /></ListItemIcon>
            <ListItemText primary="Beranda" />
          </ListItemButton>
        </ListItem>

        {/* Tambah Dokumen – sekarang untuk employee *dan* owner */}
        {['employee', 'owner'].includes(userRole) && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/add">
              <ListItemIcon><AddBoxIcon /></ListItemIcon>
              <ListItemText primary="Tambah Dokumen" />
            </ListItemButton>
          </ListItem>
        )}

        {/* Direktori */}
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/directory">
            <ListItemIcon><FolderOpenIcon /></ListItemIcon>
            <ListItemText primary="Direktori" />
          </ListItemButton>
        </ListItem>

        {/* Menu lain - belum di-gatelin */}
        <ListItem disablePadding>
          <ListItemButton>
            <ListItemIcon><SearchIcon /></ListItemIcon>
            <ListItemText primary="Cari Dokumen" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => setDlgOpen(true)}>
            <ListItemIcon><SettingsIcon /></ListItemIcon>
            <ListItemText primary="Pengaturan" />
          </ListItemButton>
        </ListItem>
      </List>

      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">Dipersembahkan oleh skip5</Typography>
        <Typography variant="caption" color="text.secondary">Versi 1.0.6</Typography>
      </Box>
      <PengaturanDialog open={dlgOpen} onClose={() => setDlgOpen(false)} />
    </Drawer>
  );
}

export default SideNav;
