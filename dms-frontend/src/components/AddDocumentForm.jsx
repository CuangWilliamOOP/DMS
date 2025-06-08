import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

function AddDocumentForm() {
  const navigate = useNavigate();

  // Form fields
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [docType, setDocType] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Submission/loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Snackbar state (for success/error messages)
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success'); // 'success' | 'error' | 'warning' | 'info'

  // Config: Company & Document type
  const companies = [
    { value: 'ttu', label: 'TTU (Tunggal Tunggu Unggul)' },
    { value: 'asn', label: 'ASN (Alam Subur Nusantara)' },
  ];
  const documentTypes = [
    { value: 'ledger_lokasi', label: 'Ledger per Lokasi' },
    { value: 'tagihan_pekerjaan', label: 'Tagihan Pekerjaan (BAPP)' },
    { value: 'pembayaran_pekerjaan', label: 'Pembayaran Pekerjaan (BAPP)' },
    { value: 'pembelian_sparepart', label: 'Pembelian Sparepart' },
    { value: 'penggantian_kas_kantor', label: 'Penggantian Kas Kantor' },
    { value: 'biaya_pengeluaran_proyek', label: 'Biaya Pengeluaran Proyek' },
  ];

  // Handle file drop
  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    setFile(uploadedFile);
    setPreviewUrl(URL.createObjectURL(uploadedFile));
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/msword': ['.doc', '.docx'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
    },
  });

  // Clear file from form
  const handleClearFile = () => {
    setFile(null);
    setPreviewUrl(null);
  };

  // Snackbar close
  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('company', company);
    formData.append('doc_type', docType);
    formData.append('description', description);
    if (file) formData.append('file', file);

    try {
      const response = await API.post('/parse-and-store/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // On success:
      setSnackbarMessage(`Dokumen berhasil diupload & diproses! ID: ${response.data.document_id}`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      // Navigate after a brief delay so user sees the snackbar
      setTimeout(() => {
        navigate('/home');
      }, 1500);

    } catch (err) {
      // On failure:
      console.error('Error:', err);
      setSnackbarMessage('Gagal mengunggah dan memproses dokumen.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 4, width: '100%', maxWidth: '900px', p: 2 }}>
        {/* Dropzone for file upload */}
        <Box
          {...getRootProps()}
          sx={{
            flex: 1,
            height: 400,
            border: '3px dashed #90caf9',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: isDragActive ? '#e3f2fd' : '#fafafa',
            cursor: 'pointer',
            flexDirection: 'column',
            transition: 'background-color 0.3s ease',
            '&:hover': {
              bgcolor: '#e3f2fd',
            },
          }}
        >
          <input {...getInputProps()} disabled={isSubmitting} />
          {file ? (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
                {file.name}
              </Typography>
              <IconButton color="error" onClick={handleClearFile} disabled={isSubmitting}>
                <ClearIcon />
              </IconButton>
              {previewUrl && ['image/jpeg', 'image/png', 'image/jpg'].includes(file.type) && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{ width: '100%', maxHeight: 180, marginTop: 10, borderRadius: 8 }}
                />
              )}
            </>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 60, color: '#90caf9', mb: 1 }} />
              <Typography variant="h6" color="textSecondary">
                {isDragActive ? 'Lepaskan file di sini!' : 'Seret file ke sini atau klik untuk unggah'}
              </Typography>
            </>
          )}
        </Box>

        {/* Form fields */}
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="Judul Dokumen"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
          />
          <FormControl required disabled={isSubmitting}>
            <InputLabel>Perusahaan</InputLabel>
            <Select
              value={company}
              label="Perusahaan"
              onChange={(e) => setCompany(e.target.value)}
            >
              {companies.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl required disabled={isSubmitting}>
            <InputLabel>Jenis Dokumen</InputLabel>
            <Select
              value={docType}
              label="Jenis Dokumen"
              onChange={(e) => setDocType(e.target.value)}
            >
              {documentTypes.map((dt) => (
                <MenuItem key={dt.value} value={dt.value}>
                  {dt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Deskripsi (Opsional)"
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
          />

          {isSubmitting ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="textSecondary">
                Tunggu, sistem sedang memproses dokumen...
              </Typography>
            </Box>
          ) : (
            <Button type="submit" variant="contained" sx={{ mt: 2 }}>
              Proses GPT Vision
            </Button>
          )}
        </Box>
      </Box>

      {/* Snackbar for success/error messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default AddDocumentForm;
