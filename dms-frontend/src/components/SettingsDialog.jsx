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
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Avatar,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PaletteIcon from "@mui/icons-material/Palette";
import PersonIcon from "@mui/icons-material/Person";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";
import LockIcon from "@mui/icons-material/Lock";
import LogoutIcon from "@mui/icons-material/Logout";
import { ColorModeContext } from "../theme/ColorModeProvider";

/**
 * Pengaturan (Settings) – pop‑up card dengan gaya mobile modern & warna‑warni.
 * Semua label berbahasa Indonesia.
 *
 * 2025‑07‑28 – FIXES
 * • Samakan warna latar pada mode gelap (semua blok pakai `theme.palette.background.paper`).
 * • Warna krem/hijau muda kini hanya di‑render di mode terang agar kontras terjaga.
 * • Nonaktifkan veil opacity MUI pada ListItemButton disabled → teks tetap terbaca di dark‑mode.
 */
export default function PengaturanDialog({ open, onClose }) {
  const { mode, toggle } = useContext(ColorModeContext);
  const [notifEmail, setNotifEmail] = useState(
    localStorage.getItem("pref_notif_email") !== "false"
  );
  const [autoLogout, setAutoLogout] = useState(
    localStorage.getItem("pref_logout") || "30"
  );

  const simpan = () => {
    localStorage.setItem("pref_notif_email", notifEmail);
    localStorage.setItem("pref_logout", autoLogout);
    onClose();
  };

  /* Helper avatar ber‑ikon */
  const ColoredIcon = ({ icon, color }) => (
    <Avatar sx={{ bgcolor: color, width: 32, height: 32 }}>{icon}</Avatar>
  );

  /**
   * Mengembalikan warna latar: terang di light‑mode, gelap netral di dark‑mode.
   * @param {string} lightColor – heksa 6‑digit untuk mode terang.
   */
  const sectionBg = (lightColor) => (theme) =>
    theme.palette.mode === "light" ? lightColor : theme.palette.background.paper;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 4 } }}
    >
      {/* ———————————————————————  HEADER  ——————————————————————— */}
      <DialogTitle
        sx={{ fontWeight: 700, textAlign: "center", bgcolor: "#1976d2", color: "#fff" }}
      >
        Pengaturan
      </DialogTitle>

      {/* ———————————————————————  BODY  ——————————————————————— */}
      <DialogContent dividers sx={{ p: 0 }}>
        {/* ============  TAMPAILAN & AKUN  ============ */}
        <List disablePadding sx={{ bgcolor: (t) => t.palette.background.paper }}>
          {/* —— Tampilan —— */}
          <ListItemButton>
            <ListItemIcon>
              <ColoredIcon icon={<PaletteIcon />} color="#7b1fa2" />
            </ListItemIcon>
            <ListItemText
              primary="Tampilan"
              secondary={mode === 'dark' ? "Mode Gelap" : "Mode Terang"}
            />
            <Switch
              edge="end"
              color="primary"
              checked={mode === 'dark'}
              onChange={(e) => toggle(e.target.checked)}
            />
          </ListItemButton>

          {/* Divider */}
          <Divider variant="inset" />

          {/* —— Sunting Profil —— */}
          <ListItemButton
            disabled
            sx={{ opacity: 1, "& .MuiTypography-root": { color: "text.disabled" } }}
          >
            <ListItemIcon>
              <ColoredIcon icon={<PersonIcon />} color="#0277bd" />
            </ListItemIcon>
            <ListItemText primary="Sunting Profil" secondary="Segera hadir" />
            <ChevronRightIcon sx={{ color: "text.disabled" }} />
          </ListItemButton>
          <Divider variant="inset" />

          {/* —— Ganti Kata Sandi —— */}
          <ListItemButton
            disabled
            sx={{ opacity: 1, "& .MuiTypography-root": { color: "text.disabled" } }}
          >
            <ListItemIcon>
              <ColoredIcon icon={<LockIcon />} color="#ef6c00" />
            </ListItemIcon>
            <ListItemText primary="Ganti Kata Sandi" secondary="Segera hadir" />
            <ChevronRightIcon sx={{ color: "text.disabled" }} />
          </ListItemButton>
        </List>

        {/* —— rule before notification —— */}
        <Divider variant="inset" sx={{ ml: 6 }} />

        {/* ============  NOTIFIKASI  ============ */}
        <Box sx={{ bgcolor: sectionBg("#fdf6e4"), py: 1.5, px: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ColoredIcon icon={<NotificationsIcon />} color="#c62828" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Notifikasi
            </Typography>
          </Box>
          <FormControlLabel
            sx={{ ml: 6 }}
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

        {/* —— rule before security —— */}
        <Divider variant="inset" sx={{ ml: 6 }} />

        {/* ============  KEAMANAN  ============ */}
        <Box sx={{ bgcolor: sectionBg("#e8f5e9"), py: 1.5, px: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ColoredIcon icon={<LogoutIcon />} color="#2e7d32" />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Keamanan
            </Typography>
          </Box>
          <FormControl component="fieldset" sx={{ ml: 6, mt: 1 }}>
            <FormLabel
              component="legend"
              sx={{ fontSize: 13, color: "text.secondary", mb: 0.5 }}
            >
              Auto‑logout (menit tanpa aktivitas)
            </FormLabel>
            <RadioGroup row value={autoLogout} onChange={(e) => setAutoLogout(e.target.value)}>
              {["15", "30", "60", "never"].map((v) => (
                <FormControlLabel
                  key={v}
                  value={v}
                  control={<Radio size="small" />}
                  label={v === "never" ? "Tidak" : v}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>

      {/* ———————————————————————  FOOTER  ——————————————————————— */}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: "none" }}>
          Batal
        </Button>
        <Button onClick={simpan} variant="contained" sx={{ textTransform: "none" }}>
          Simpan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
