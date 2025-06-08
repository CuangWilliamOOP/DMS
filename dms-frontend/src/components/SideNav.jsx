// File: src/components/SideNav.jsx
// fix(src/components/SideNav.jsx): remove "Tambah Dokumen" for boss, rename "Tambah Direktori" to "Direktori"

import React from 'react';
import {
  Drawer,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AddBoxIcon from '@mui/icons-material/AddBox';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';

// Import Link dari react-router-dom
import { Link } from 'react-router-dom';

function SideNav() {
  // Ambil role user (employee / higher-up) dari local storage
  const userRole = localStorage.getItem('role'); // "employee" | "higher-up" | null

  return (
    <Drawer
      variant="permanent"
      sx={{
        zIndex: (theme) => theme.zIndex.appBar - 1,
        '& .MuiDrawer-paper': {
          top: 0,
          height: '100vh',
          width: 200,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar sx={{ minHeight: '48px' }} />  
      <List>
        {/* Beranda */}
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/home">
            <ListItemIcon><HomeIcon /></ListItemIcon>
            <ListItemText primary="Beranda" />
          </ListItemButton>
        </ListItem>

        {/* Tambah Dokumen */}
        {userRole === 'employee' && (
          <ListItem disablePadding>
            <ListItemButton component={Link} to="/add">
              <ListItemIcon><AddBoxIcon /></ListItemIcon>
              <ListItemText primary="Tambah Dokumen" />
            </ListItemButton>
          </ListItem>
        )}

        {/* Rename: "Tambah Direktori" → "Direktori" */}
        <ListItem disablePadding>
          <ListItemButton component={Link} to="/directory">
            <ListItemIcon><FolderOpenIcon /></ListItemIcon>
            <ListItemText primary="Direktori" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton>
            <ListItemIcon><SearchIcon /></ListItemIcon>
            <ListItemText primary="Cari Dokumen" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton>
            <ListItemIcon><SettingsIcon /></ListItemIcon>
            <ListItemText primary="Pengaturan" />
          </ListItemButton>
        </ListItem>
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Dipersembahkan oleh skip5
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Versi 1.0.5
        </Typography>
      </Box>
    </Drawer>
  );
}

export default SideNav;
