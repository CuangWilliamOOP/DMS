// src/pages/AddDocumentPage.jsx
import React from 'react';
import { Box, Paper } from '@mui/material';
import AddDocumentForm from '../components/AddDocumentForm';

function AddDocumentPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',   // center secara horizontal
        pt: 2,   
        mt:-6               // padding top
      }}
    >
      <h2 style={{ marginBottom: '16px' }}>Tambah Dokumen</h2>

      {/* wider card */}
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', md: 960, lg: 1280 },   // ← grows on large screens
          p: { xs: 2, md: 4 },
          borderRadius: 3,
        }}
      >
        <AddDocumentForm />
      </Paper>
    </Box>
  );
}

export default AddDocumentPage;
