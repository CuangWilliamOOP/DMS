// File: src/components/SettingsDialog.jsx

import React, { useState, useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  Typography,
  Box,
  FormControlLabel,
  FormControl,
  Avatar,
  MenuItem,
  Select,
  InputLabel,
  Stack,
  Chip,
} from "@mui/material";
import PaletteIcon from "@mui/icons-material/Palette";
import PersonIcon from "@mui/icons-material/Person";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";
import LockIcon from "@mui/icons-material/Lock";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { motion } from "framer-motion";
import { ColorModeContext } from "../theme/ColorModeProvider";
import API from "../services/api";
import ChangePasswordDialog from "./ChangePasswordDialog";

export default function PengaturanDialog({ open, onClose }) {
  const { mode, toggle: toggleMode } = useContext(ColorModeContext);
  const [notifEmail, setNotifEmail] = useState(
    localStorage.getItem("pref_notif_email") !== "false"
  );
  const [section, setSection] = useState("appearance"); // "appearance", "notifications", "security"
  const [changePassOpen, setChangePassOpen] = React.useState(false);

  const isDark = mode === "dark";

  const simpan = () => {
    localStorage.setItem("pref_notif_email", notifEmail);
    onClose();
  };

  // Animated icon wrapper
  const AnimatedIcon = ({ children }) => (
    <motion.div whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.92 }}>
      {children}
    </motion.div>
  );

  // Colored round icon used in the left-side nav
  const ColoredIcon = ({ icon, color }) => (
    <Avatar
      sx={{
        bgcolor: color,
        width: 34,
        height: 34,
        boxShadow: 2,
      }}
    >
      <AnimatedIcon>{icon}</AnimatedIcon>
    </Avatar>
  );

  const options = [
    { label: "15 menit", value: 15 },
    { label: "30 menit", value: 30 },
    { label: "1 jam", value: 60 },
    { label: "4 jam", value: 240 },
    { label: "Tidak pernah", value: 0 },
  ];

  /** Security tab → server-synced idle-timeout (single source of truth) */
  function KeamananTab() {
    const [idle, setIdle] = React.useState(60);

    React.useEffect(() => {
      API.get("/user-settings/").then(({ data }) =>
        setIdle(Number(data.idle_timeout))
      );
    }, []);

    const handleChange = (e) => {
      const v = Number(e.target.value);
      setIdle(v);
      API.put("/user-settings/", { idle_timeout: v }).catch(() => {});
    };

    return (
      <FormControl fullWidth sx={{ mt: 1 }}>
        <InputLabel id="idle-timeout-label">Auto-logout</InputLabel>
        <Select
          labelId="idle-timeout-label"
          value={idle}
          label="Auto-logout"
          onChange={handleChange}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  const handleThemeClick = (target) => {
    // target: "light" or "dark"
    toggleMode(target === "dark");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: (theme) => ({
          borderRadius: 4,
          backdropFilter: "blur(13px) saturate(160%)",
          background:
            theme.palette.mode === "dark"
              ? "linear-gradient(135deg, #0f111a 75%, #1b2240 100%)"
              : "linear-gradient(150deg, rgba(255,255,255,0.92) 55%, rgba(228,236,255,0.78) 100%)",
          boxShadow: "0 10px 36px 0 rgba(34,50,84,0.16)",
        }),
      }}
    >
      {/* HEADER */}
      <DialogTitle
        sx={{
          fontWeight: 700,
          textAlign: "center",
          p: 3,
          mb: 0.5,
          background: (theme) =>
            theme.palette.mode === "dark"
              ? "linear-gradient(87deg, #0f111a 0%, #1b2240 100%)"
              : "linear-gradient(87deg, #1976d2 0%, #42a5f5 100%)",
          color: "#fff",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: "0 3px 14px rgba(25,118,210,0.08)",
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            left: 18,
            top: 22,
            fontWeight: 400,
            fontSize: 17,
            opacity: 0.82,
          }}
        >
          <PersonIcon sx={{ fontSize: 26, opacity: 0.65 }} />
        </Box>
        Pengaturan
      </DialogTitle>

      {/* BODY */}
      <DialogContent
        dividers
        sx={{
          p: 0,
          background: (theme) =>
            theme.palette.mode === "dark" ? "#0f111a" : "transparent",
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2.5,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 3,
          }}
        >
          {/* LEFT NAV */}
          <Box
            sx={{
              width: { xs: "100%", sm: 230 },
              mb: { xs: 1.5, sm: 0 },
            }}
          >
            <List disablePadding>
              <ListItemButton
                selected={section === "appearance"}
                onClick={() => setSection("appearance")}
                sx={{
                  borderRadius: 2.5,
                  mb: 0.75,
                  "&.Mui-selected": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(123,31,162,0.18)"
                        : "rgba(123,31,162,0.06)",
                  },
                }}
              >
                <ListItemIcon>
                  <ColoredIcon icon={<PaletteIcon />} color="#7b1fa2" />
                </ListItemIcon>
                <ListItemText
                  primary="Tampilan"
                  secondary={isDark ? "Mode gelap" : "Mode terang"}
                />
              </ListItemButton>

              <ListItemButton
                selected={section === "notifications"}
                onClick={() => setSection("notifications")}
                sx={{
                  borderRadius: 2.5,
                  mb: 0.75,
                  "&.Mui-selected": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(96,165,250,0.18)"
                        : "rgba(59,130,246,0.06)",
                  },
                }}
              >
                <ListItemIcon>
                  <ColoredIcon icon={<NotificationsIcon />} color="#1d4ed8" />
                </ListItemIcon>
                <ListItemText
                  primary="Notifikasi"
                  secondary={notifEmail ? "Email aktif" : "Email dimatikan"}
                />
              </ListItemButton>

              <ListItemButton
                selected={section === "security"}
                onClick={() => setSection("security")}
                sx={{
                  borderRadius: 2.5,
                  mb: 0.75,
                  "&.Mui-selected": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(22,163,74,0.18)"
                        : "rgba(34,197,94,0.06)",
                  },
                }}
              >
                <ListItemIcon>
                  <ColoredIcon icon={<LockIcon />} color="#16a34a" />
                </ListItemIcon>
                <ListItemText primary="Keamanan" secondary="Auto-logout" />
              </ListItemButton>
            </List>
          </Box>

          {/* VERTICAL DIVIDER (desktop) */}
          <Divider
            orientation="vertical"
            flexItem
            sx={{
              display: { xs: "none", sm: "block" },
              opacity: 0.15,
            }}
          />

          {/* RIGHT CONTENT */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {section === "appearance" && (
              <Box sx={{ py: 1 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 0.5 }}
                >
                  Tampilan
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 2 }}
                >
                  Pilih tema aplikasi yang paling nyaman untuk mata Anda.
                </Typography>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                >
                  {/* Light mode card */}
                  <Box
                    onClick={() => handleThemeClick("light")}
                    sx={{
                      flex: 1,
                      p: 2,
                      borderRadius: 3,
                      cursor: "pointer",
                      border: isDark
                        ? "1px solid rgba(148,163,184,0.4)"
                        : "1px solid rgba(148,163,184,0.9)",
                      background: !isDark
                        ? "linear-gradient(135deg,#ffffff,#f3f4ff)"
                        : "rgba(15,23,42,0.6)",
                      boxShadow: !isDark
                        ? "0 10px 30px rgba(148,163,184,0.35)"
                        : "none",
                      position: "relative",
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: "#eff6ff", color: "#1d4ed8" }}>
                        <LightModeIcon />
                      </Avatar>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          Mode Terang
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", fontSize: 12 }}
                        >
                          Tampilan cerah, cocok untuk ruangan terang.
                        </Typography>
                      </Box>
                      {!isDark && (
                        <Chip
                          size="small"
                          color="primary"
                          label="Aktif"
                          sx={{ ml: "auto", borderRadius: 999 }}
                        />
                      )}
                    </Stack>
                  </Box>

                  {/* Dark mode card */}
                  <Box
                    onClick={() => handleThemeClick("dark")}
                    sx={{
                      flex: 1,
                      p: 2,
                      borderRadius: 3,
                      cursor: "pointer",
                      border: isDark
                        ? "1px solid rgba(129,140,248,0.7)"
                        : "1px solid rgba(148,163,184,0.6)",
                      background: isDark
                        ? "linear-gradient(135deg,#020617,#111827)"
                        : "linear-gradient(135deg,#0f172a,#111827)",
                      boxShadow: "0 14px 36px rgba(15,23,42,0.8)",
                      color: "#e5e7eb",
                      position: "relative",
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: "#020617", color: "#facc15" }}>
                        <DarkModeIcon />
                      </Avatar>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          Mode Gelap
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "rgba(209,213,219,0.85)",
                            fontSize: 12,
                          }}
                        >
                          Kontras rendah, nyaman digunakan malam hari.
                        </Typography>
                      </Box>
                      {isDark && (
                        <Chip
                          size="small"
                          color="primary"
                          label="Aktif"
                          sx={{ ml: "auto", borderRadius: 999 }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            )}

            {section === "notifications" && (
              <Box sx={{ py: 1 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 0.5 }}
                >
                  Notifikasi
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 2 }}
                >
                  Atur apakah Anda ingin menerima email ketika status dokumen
                  berubah.
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={notifEmail}
                      onChange={(e) => setNotifEmail(e.target.checked)}
                    />
                  }
                  label="Terima notifikasi email"
                />
              </Box>
            )}

            {section === "security" && (
              <Box sx={{ py: 1 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 0.5 }}
                >
                  Keamanan
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 2 }}
                >
                  Atur berapa lama aplikasi tetap aktif sebelum logout otomatis.
                </Typography>

                <KeamananTab />

                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => setChangePassOpen(true)}
                    sx={{ textTransform: "none", borderRadius: 2 }}
                  >
                    Ganti Password
                  </Button>
                </Box>

                <ChangePasswordDialog
                  open={changePassOpen}
                  onClose={() => setChangePassOpen(false)}
                />
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      {/* FOOTER */}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          Batal
        </Button>
        <Button
          onClick={simpan}
          variant="contained"
          sx={{
            textTransform: "none",
            borderRadius: 2,
            background: "linear-gradient(90deg, #1976d2, #7e57c2)",
          }}
        >
          Simpan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
