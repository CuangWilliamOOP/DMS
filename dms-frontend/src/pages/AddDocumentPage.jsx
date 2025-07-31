// src/pages/AddDocumentPage.jsx
import React from 'react';
import { Box, Paper, Typography, Fade } from '@mui/material';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import AddDocumentForm from '../components/AddDocumentForm';
import { useTheme } from '@mui/material/styles';

export default function AddDocumentPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <>
      {/* FULL-PAGE BACKGROUND */}
      <Box
        sx={{
          position: "fixed",
          zIndex: -1,
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: isDark ? "#181c2f" : "#f5f7fb",
          transition: "background 0.3s",
        }}
      />

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          px: 2,
          pt: { xs: 7, md: 10 },
        }}
      >
        <Fade in timeout={550}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: 2.5,
              mt: { xs: 1, md: 2 }
            }}
          >
            <Box
              sx={{
                mb: 1,
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: "linear-gradient(135deg,#1976d2 60%,#7e57c2 100%)",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 18px rgba(34,50,84,0.10)'
              }}
            >
              <NoteAddOutlinedIcon sx={{ color: "#fff", fontSize: 40 }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                letterSpacing: 0.8,
                color: isDark ? "#fff" : "#1d2342",
                mb: 0.5
              }}
            >
              Tambah Dokumen
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: isDark ? "#b8bbcc" : "#666b7b",
                maxWidth: 520,
                textAlign: "center"
              }}
            >
              Unggah tagihan baru
            </Typography>
          </Box>
        </Fade>

        <Fade in timeout={650}>
          <Paper
            elevation={5}
            sx={{
              width: '100%',
              maxWidth: { xs: '100%', sm: 540, md: 740, lg: 980 },
              p: { xs: 2, sm: 3, md: 4 },
              borderRadius: 4,
              boxShadow: isDark
                ? '0 6px 28px #151b3055'
                : '0 6px 28px #bdd2f344',
              background: isDark ? "#232949" : "#fff",
              mt: 2,
              mb: 5,
            }}
          >
            <AddDocumentForm />
          </Paper>
        </Fade>
      </Box>
    </>
  );
}
