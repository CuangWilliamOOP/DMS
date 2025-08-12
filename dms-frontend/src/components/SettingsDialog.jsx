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
  Collapse,
  MenuItem,
  Select,
  InputLabel,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PaletteIcon from "@mui/icons-material/Palette";
import PersonIcon from "@mui/icons-material/Person";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";
import LockIcon from "@mui/icons-material/Lock";
import { motion } from "framer-motion";
import { ColorModeContext } from "../theme/ColorModeProvider";
import API from "../services/api";

export default function PengaturanDialog({ open, onClose }) {
  const { mode, toggle: toggleMode } = useContext(ColorModeContext);
  const [notifEmail, setNotifEmail] = useState(
    localStorage.getItem("pref_notif_email") !== "false"
  );
  const [openSection, setOpenSection] = useState("appearance"); // "appearance", "notifications", "security"

  const simpan = async () => {
    // Persist local-only preferences
    localStorage.setItem("pref_notif_email", notifEmail);
    onClose();
  };

  // Animated icon wrapper
  const AnimatedIcon = ({ children }) => (
    <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.92 }}>
      {children}
    </motion.div>
  );

  // Helper avatar
  const ColoredIcon = ({ icon, color }) => (
    <Avatar sx={{ bgcolor: color, width: 34, height: 34, boxShadow: 2 }}>
      <AnimatedIcon>{icon}</AnimatedIcon>
    </Avatar>
  );

  // Section toggler
  const handleSection = (s) => setOpenSection(openSection === s ? "" : s);

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
      API.get("/user-settings/").then(({ data }) => setIdle(Number(data.idle_timeout)));
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
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
      {/* ————————————————— HEADER ————————————————— */}
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

      {/* ————————————————— BODY ————————————————— */}
      <DialogContent
        dividers
        sx={{
          p: 0,
          background: (theme) =>
            theme.palette.mode === "dark" ? "#0f111a" : "transparent",
        }}
      >
        {/* ============ TAMPILAN ============ */}
        <List disablePadding>
          <ListItemButton
            onClick={() => handleSection("appearance")}
            aria-expanded={openSection === "appearance"}
            aria-controls="settings-appearance"
            sx={{
              bgcolor: (theme) =>
                openSection === "appearance"
                  ? theme.palette.mode === "dark"
                    ? "rgba(100,75,180,0.13)"
                    : "rgba(123,31,162,0.05)"
                  : "inherit",
            }}
          >
            <ListItemIcon>
              <ColoredIcon icon={<PaletteIcon />} color="#7b1fa2" />
            </ListItemIcon>
            <ListItemText
              primary="Tampilan"
              secondary={mode === "dark" ? "Mode Gelap" : "Mode Terang"}
            />
            <ChevronRightIcon
              sx={{
                transform: openSection === "appearance" ? "rotate(90deg)" : "none",
                color: "#aaa",
              }}
            />
          </ListItemButton>
          <Collapse id="settings-appearance" in={openSection === "appearance"} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 8, py: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={mode === "dark"}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      // Keep compatibility with current context API
                      toggleMode(checked);
                      try {
                        await API.put("/user-settings/", {
                          theme_mode: checked ? "dark" : "light",
                        });
                      } catch {}
                      window.dispatchEvent(new Event("theme_update"));
                    }}
                  />
                }
                label="Aktifkan mode gelap"
              />
            </Box>
          </Collapse>
          <Divider variant="inset" />

          {/* ============ NOTIFIKASI ============ */}
          <ListItemButton
            onClick={() => handleSection("notifications")}
            aria-expanded={openSection === "notifications"}
            aria-controls="settings-notifications"
            sx={{
              bgcolor: (theme) =>
                openSection === "notifications"
                  ? theme.palette.mode === "dark"
                    ? "rgba(180,60,60,0.13)"
                    : "rgba(198,40,40,0.05)"
                  : "inherit",
            }}
          >
            <ListItemIcon>
              <ColoredIcon icon={<NotificationsIcon />} color="#c62828" />
            </ListItemIcon>
            <ListItemText primary="Notifikasi" secondary="Pengaturan Email" />
            <ChevronRightIcon
              sx={{
                transform: openSection === "notifications" ? "rotate(90deg)" : "none",
                color: "#aaa",
              }}
            />
          </ListItemButton>
          <Collapse id="settings-notifications" in={openSection === "notifications"} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 8, py: 1.5 }}>
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
          </Collapse>
          <Divider variant="inset" />

          {/* ============ KEAMANAN ============ */}
          <ListItemButton
            onClick={() => handleSection("security")}
            aria-expanded={openSection === "security"}
            aria-controls="settings-security"
            sx={{
              bgcolor: (theme) =>
                openSection === "security"
                  ? theme.palette.mode === "dark"
                    ? "rgba(46,125,50,0.13)"
                    : "rgba(46,125,50,0.07)"
                  : "inherit",
            }}
          >
            <ListItemIcon>
              <ColoredIcon icon={<LockIcon />} color="#2e7d32" />
            </ListItemIcon>
            <ListItemText primary="Keamanan" secondary="Auto logout" />
            <ChevronRightIcon
              sx={{
                transform: openSection === "security" ? "rotate(90deg)" : "none",
                color: "#aaa",
              }}
            />
          </ListItemButton>
          <Collapse id="settings-security" in={openSection === "security"} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 8, py: 1.5 }}>
              {/* Single source of truth: Select that PUTs to /user-settings/ */}
              <KeamananTab />
            </Box>
          </Collapse>
        </List>
      </DialogContent>

      {/* ————————————————— FOOTER ————————————————— */}
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>
          Batal
        </Button>
        <Button
          onClick={simpan}
          variant="contained"
          sx={{ textTransform: "none", borderRadius: 2, background: "linear-gradient(90deg, #1976d2, #7e57c2)" }}
        >
          Simpan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
