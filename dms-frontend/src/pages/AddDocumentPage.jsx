// src/pages/AddDocumentPage.jsx
import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddDocumentForm from '../components/AddDocumentForm';

function AddDocumentPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const bgColor = isDark ? '#050817' : '#f4f5ff';

  return (
    <>
      {/* Background wash */}
      <Box
        sx={{
          position: 'absolute',
          zIndex: -1,
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: bgColor,
          transition: 'background 0.3s',
        }}
      />

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          px: { xs: 1.5, sm: 3, md: 6 },
          py: { xs: 3, sm: 5 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 1100 }}>
          {/* Page header */}
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, mb: 0.5, letterSpacing: 0.1 }}
              >
                Tambah Dokumen
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', maxWidth: 540 }}
              >
                Unggah tagihan atau dokumen proyek, lalu sistem akan membaca,
                mem-parsing, dan mengarsipkan dokumen secara otomatis.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Chip
                size="small"
                label="1 · Isi data"
                sx={{ borderRadius: 999 }}
              />
              <Chip
                size="small"
                label="2 · Unggah berkas"
                sx={{ borderRadius: 999 }}
              />
              <Chip
                size="small"
                label="3 · Proses & arsip"
                sx={{ borderRadius: 999 }}
              />
            </Stack>
          </Box>

          <AddDocumentForm />
        </Box>
      </Box>
    </>
  );
}

export default AddDocumentPage;
