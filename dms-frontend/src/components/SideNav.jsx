// File: src/components/SideNav.jsx

import React, { useState } from "react";
import {
  Drawer,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  useTheme,
  Avatar,
  Tooltip,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import FolderSpecialRoundedIcon from "@mui/icons-material/FolderSpecialRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Link, useLocation } from "react-router-dom";
import PengaturanDialog from "../components/SettingsDialog";
import { motion } from "framer-motion";

const navItems = [
  {
    label: "Beranda",
    to: "/home",
    icon: <HomeIcon />,
    color: "#1976d2",
  },
  {
    label: "Tambah Dokumen",
    to: "/add",
    icon: <AddCircleRoundedIcon />,
    color: "#7b1fa2",
    roles: ["employee", "owner"],
  },
  {
    label: "Direktori",
    to: "/directory",
    icon: <FolderSpecialRoundedIcon />,
    color: "#388e3c",
  },
];

function SideNav() {
  const theme = useTheme();
  const userRole = localStorage.getItem("role");
  const [dlgOpen, setDlgOpen] = useState(false);
  const location = useLocation();
  const path = location.pathname;

  // Helper to check if the path matches a nav link
  const isActive = (to) => {
    if (to === "/home") return path === "/home";
    if (to === "/add") return path === "/add";
    if (to === "/directory") return path.startsWith("/directory");
    return false;
  };

  // Card background based on theme
  const drawerBg =
    theme.palette.mode === "dark"
      ? "linear-gradient(140deg, rgba(30,34,54,0.97) 80%, rgba(75,0,130,0.28))"
      : "linear-gradient(130deg, rgba(247,249,255,0.98) 60%, #e0e7ff 100%)";

  const textColor =
    theme.palette.mode === "dark" ? "#e3e3fa" : "#243366";

  const NavIcon = ({ icon, gradient }) => (
    <Avatar
      sx={{
        bgcolor: "transparent",
        background: gradient,
        width: 38,
        height: 38,
        boxShadow: 3,
      }}
      variant="rounded"
    >
      <motion.div whileHover={{ scale: 1.13 }} whileTap={{ scale: 0.92 }}>
        {icon}
      </motion.div>
    </Avatar>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        zIndex: (theme) => theme.zIndex.appBar - 1,
        "& .MuiDrawer-paper": {
          top: 0,
          height: "100vh",
          width: 218,
          boxSizing: "border-box",
          borderRight: 0,
          background: drawerBg,
          color: textColor,
          backdropFilter: "blur(13px) saturate(170%)",
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 2px 20px 0 #0005"
              : "0 4px 24px 0 #b8c6f95c",
          transition: "background 0.3s",
        },
      }}
    >
      <Toolbar />
      <List sx={{ pt: 1.5 }}>
        {navItems.map((item, idx) => {
          if (item.roles && !item.roles.includes(userRole)) return null;
          const active = isActive(item.to);
          return (
            <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={item.to ? Link : "button"}
                to={item.to}
                selected={active}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  my: 0.3,
                  position: "relative",
                  background: active ? "rgba(33,150,243,0.08)" : "none",
                  fontWeight: active ? 700 : 500,
                  '&:hover': {
                    background: "rgba(33,150,243,0.13)",
                  },
                }}
              >
                <ListItemIcon sx={{ color: item.color, minWidth: 44 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: active ? 700 : 500,
                    fontSize: 15,
                    color: active ? item.color : undefined,
                  }}
                />
                {active && (
                  <ChevronRightRoundedIcon
                    sx={{
                      color: item.color,
                      fontSize: 28,
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)"
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}

        {/* Pengaturan/Settings */}
        <ListItem disablePadding sx={{ mt: 1 }}>
          <ListItemButton
            onClick={() => setDlgOpen(true)}
            sx={{
              borderRadius: 2,
              mx: 1,
              color: theme.palette.mode === 'dark' ? '#e3e3fa' : '#243366',
              background: 'none',
              fontWeight: 700,
              '&:hover': {
                background: theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(33,150,243,0.06)',
              },
            }}
          >
            <ListItemIcon>
              <SettingsRoundedIcon sx={{ color: theme.palette.mode === 'dark' ? '#e3e3fa' : '#243366' }} />
            </ListItemIcon>
            <ListItemText
              primary="Pengaturan"
              primaryTypographyProps={{
                fontWeight: 700,
                fontSize: 15,
                color: theme.palette.mode === 'dark' ? '#e3e3fa' : '#243366',
              }}
            />
          </ListItemButton>
        </ListItem>
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {/* Footer / Version */}
      <Box
        sx={{
          px: 2,
          py: 2.5,
          mb: 0.5,
          textAlign: "left",
          color: theme.palette.mode === "dark" ? "#999" : "#6c73a7",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500, letterSpacing: 1 }}>
          Dipersembahkan oleh <b>skip5</b>
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 500 }}>
          Versi 1.0.6
        </Typography>
      </Box>
      <PengaturanDialog open={dlgOpen} onClose={() => setDlgOpen(false)} />
    </Drawer>
  );
}

export default SideNav;
