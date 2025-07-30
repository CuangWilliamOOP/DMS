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
import LogoutIcon from "@mui/icons-material/Logout";
import { motion } from "framer-motion";
import { ColorModeContext } from "../theme/ColorModeProvider";
import API from "../services/api";

export default function PengaturanDialog({ open, onClose }) {
  const { mode, toggle } = useContext(ColorModeContext);
  const [notifEmail, setNotifEmail] = useState(
    localStorage.getItem("pref_notif_email") !== "false"
  );
  const [autoLogout, setAutoLogout] = useState(
    localStorage.getItem("pref_logout") || "30"
  );
  const [openSection, setOpenSection] = useState("appearance"); // "appearance", "notifications", "security"

  const simpan = () => {
    localStorage.setItem("pref_notif_email", notifEmail);
    localStorage.setItem("pref_logout", autoLogout);
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

  // Section gradient backgrounds
  const sectionBg = (light, dark) => (theme) =>
    theme.palette.mode === "light"
      ? light
      : dark || theme.palette.background.paper;

  // Section toggler
  const handleSection = (s) => setOpenSection(openSection === s ? "" : s);

  const options = [
    { label: "15 menit", value: 15 },
    { label: "30 menit", value: 30 },
    { label: "1 jam", value: 60 },
    { label: "4 jam", value: 240 },
    { label: "Tidak pernah", value: 0 },
  ];

  function KeamananTab() {
    const [idle, setIdle] = React.useState(60);

    React.useEffect(() => {
      API.get("/user-settings/").then(({ data }) => setIdle(data.idle_timeout));
    }, []);

    const handleChange = (e) => {
      const v = e.target.value;
      setIdle(v);
      API.put("/user-settings/", { idle_timeout: v });
    };

    return (
      <FormControl fullWidth sx={{ mt: 1 }}>
        <InputLabel>Auto-logout</InputLabel>
        <Select value={idle} label="Auto-logout" onChange={handleChange}>
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
        sx: {
          borderRadius: 4,
          backdropFilter: "blur(13px) saturate(160%)",
          background:
            "linear-gradient(150deg, rgba(255,255,255,0.90) 50%, rgba(224,224,255,0.75) 100%)",
          boxShadow: "0 10px 36px 0 rgba(34,50,84,0.16)",
        },
      }}
    >
      {/* ————————————————— HEADER ————————————————— */}
      <DialogTitle
        sx={{
          fontWeight: 700,
          textAlign: "center",
          p: 3,
          mb: 0.5,
          background: "linear-gradient(87deg, #1976d2 0%, #42a5f5 100%)",
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
      <DialogContent dividers sx={{ p: 0, background: "transparent" }}>
        {/* ============ TAMPILAN ============ */}
        <List disablePadding>
          <ListItemButton
            onClick={() => handleSection("appearance")}
            sx={{ bgcolor: openSection === "appearance" ? "rgba(123,31,162,0.05)" : "inherit" }}
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
          <Collapse in={openSection === "appearance"} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 8, py: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={mode === "dark"}
                    onChange={(e) => toggle(e.target.checked)}
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
            sx={{ bgcolor: openSection === "notifications" ? "rgba(198,40,40,0.05)" : "inherit" }}
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
          <Collapse in={openSection === "notifications"} timeout="auto" unmountOnExit>
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
            sx={{ bgcolor: openSection === "security" ? "rgba(46,125,50,0.07)" : "inherit" }}
          >
            <ListItemIcon>
              <ColoredIcon icon={<LogoutIcon />} color="#2e7d32" />
            </ListItemIcon>
            <ListItemText primary="Keamanan" secondary="Auto logout" />
            <ChevronRightIcon
              sx={{
                transform: openSection === "security" ? "rotate(90deg)" : "none",
                color: "#aaa",
              }}
            />
          </ListItemButton>
          <Collapse in={openSection === "security"} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 8, py: 1.5 }}>
              <FormControl component="fieldset">
                <FormLabel
                  component="legend"
                  sx={{ fontSize: 13, color: "text.secondary", mb: 0.5 }}
                >
                  Auto-logout (menit tanpa aktivitas)
                </FormLabel>
                <RadioGroup
                  row
                  value={autoLogout}
                  onChange={(e) => setAutoLogout(e.target.value)}
                >
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
              <KeamananTab />
            </Box>
          </Collapse>
        </List>
      </DialogContent>

      {/* ————————————————— FOOTER ————————————————— */}
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
