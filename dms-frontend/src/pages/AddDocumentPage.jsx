// src/pages/AddDocumentPage.jsx
import React from 'react';
import { Box } from '@mui/material';
import AddDocumentForm from '../components/AddDocumentForm';

function AddDocumentPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',   // center secara horizontal
        pt: 2,                  // padding top
      }}
    >
      <h2 style={{ marginBottom: '16px' }}>Tambah Dokumen</h2>
      <AddDocumentForm />
    </Box>
  );
}

export default AddDocumentPage;
