import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Backdrop,
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
  Alert,
  Paper,
  Chip,
  Slide
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { motion } from 'framer-motion';

const slideUp = (props) => <Slide {...props} direction="up" />;

function fileFromClipboardItem(item) {
  if (!item || item.kind !== "file" || !item.type.startsWith("image/")) return null;

  const original = item.getAsFile();
  if (!original) return null;

  // ⇢ build "image_<5randomchars>.<ext>"
  const rand = Math.random().toString(36).slice(2, 7);      // 5 alphanum chars
  const ext  = original.type.split("/")[1] || "png";
  const name = `image_${rand}.${ext}`;

  return new File([original], name, { type: original.type });
}

function AddDocumentForm() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  // Form fields
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [docType, setDocType] = useState('tagihan_pekerjaan');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Submission/loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Progress polling state
  const [jobId, setJobId] = useState(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState('Menyiapkan');
  const pollRef = React.useRef(null);

  // Snackbar state (for success/error messages)
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success'); // 'success' | 'error' | 'warning' | 'info'

  // Config: Company & Document type
  const companies = [
    { value: 'ttu', label: 'TTU (Tunggul Tunggal Unggul)' },
    { value: 'asn', label: 'ASN (Alam Subur Nusantara)' },
    { value: 'olm', label: 'OLM (Ostor Lumbanbanjar Makmur)' },
    { value: 'ols', label: 'OLS (Ostor Lumbanbanjar Sejahtera)' },
  ];

  const documentTypes = [
    { value: 'tagihan_pekerjaan', label: 'Tagihan Pekerjaan' },
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

  // Start/stop polling helper
  const startPolling = (id) => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await API.get(`/progress/${id}/`);
        if (typeof data.percent === 'number') setPercent((p) => Math.max(p, data.percent));
        const countLabel = (data.total_items != null)
          ? ` — ${data.current_item ?? 0}/${data.total_items} item`
          : '';
        if (data.stage) setStage(`${data.stage}${countLabel}`);
        if ((data.percent || 0) >= 100) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // ignore polling errors
      }
    }, 600);
  };

  React.useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('company', company);
    formData.append('doc_type', docType);
    if (file) formData.append('file', file);

    try {
      const id = crypto.randomUUID();
      setJobId(id);
      setProgressOpen(true);
      setPercent(1);
      setStage('Mengunggah berkas');
      startPolling(id);

      const response = await API.post('/parse-and-store/', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Job-ID': id },
        onUploadProgress: (evt) => {
          const u = evt.total ? Math.round((evt.loaded * 100) / evt.total) : null;
          setStage(u != null ? `Mengunggah berkas (${u}%)` : 'Mengunggah berkas');
          // do not call setPercent() here; server drives %
        },
      });

      // On success:
      setSnackbarMessage(`Dokumen berhasil diupload & diproses! ID: ${response.data.document_id}`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

  // Navigate after a brief delay so user sees the snackbar
  setPercent(100);
  setStage('Selesai');
  setTimeout(() => setProgressOpen(false), 800);
      setTimeout(() => {
        navigate('/home');
      }, 1500);

    } catch (err) {
      // On failure:
      console.error('Error:', err);
      setSnackbarMessage('Gagal mengunggah dan memproses dokumen.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      // Clear poller on failure to avoid stray interval
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
  setProgressOpen(false);

    } finally {
      setIsSubmitting(false);
    }
  };

  const dropRef = React.useRef(null);

  const handlePaste = React.useCallback((e) => {
    const { items } = e.clipboardData || {};
    if (!items?.length) return;

    for (const it of items) {
      const pastedFile = fileFromClipboardItem(it);
      if (pastedFile) {
        setFile(pastedFile);
        setPreviewUrl(URL.createObjectURL(pastedFile));
        e.preventDefault();
        break;
      }
    }
  }, []);

  React.useEffect(() => {
    const node = dropRef.current;
    if (!node) return;
    node.addEventListener("paste", handlePaste);
    return () => node.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={2} sx={{
          p: 4,
          display: 'flex',
          gap: 4,
          borderRadius: 3,
          width: '100%',
          maxWidth: { xs: 1, md: 1100 },
          position: 'relative'
        }}>
          {/* Dropzone for file upload */}
          <Box
            {...getRootProps()}
            ref={dropRef}          // 👈 add this
            onPaste={handlePaste}  // 👈 optional fallback (works in most browsers)
            sx={{
              flex: 1,
              height: 420,
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: isDragActive
                ? (isDark ? 'primary.dark' : '#e3f2fd')
                : (isDark ? 'background.paper' : '#fafafa'),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all .25s ease',
              '&:hover': {
                boxShadow: 4,
                borderColor: 'primary.main',
              },
            }}
          >
            <input {...getInputProps()} disabled={isSubmitting} />
            {file ? (
              <>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2, display: 'flex', alignItems: 'center' }}>
                  {file.name}
                  {file.type && (
                    <Chip
                      label={file.type.split('/')[1]?.toUpperCase()}
                      size="small"
                      color="primary"
                      sx={{ ml: 1 }}
                    />
                  )}
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
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <CloudUploadIcon sx={{ fontSize: 60, color: '#90caf9' }} />
              </motion.div>
            )}
            {!file && (
              <Box sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                mt: 2,
              }}>
                <Typography
                  variant="h6"
                  color="textSecondary"
                  sx={{
                    fontWeight: 500,
                    letterSpacing: 0.15,
                    textAlign: "center",
                    mb: 0.5,
                    width: "100%",
                  }}
                >
                  {isDragActive
                    ? 'Lepaskan file di sini!'
                    : 'Seret file, klik, atau Ctrl+V untuk tempel gambar'}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: "center", opacity: 0.72 }}
                >
                  Format: PDF, JPG, PNG, Word, Excel
                </Typography>
              </Box>
            )}
          </Box>

          {/* Form fields */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Informasi Dokumen
            </Typography>
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
            <FormControl required disabled>
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
            <Button
              type="submit"
              variant="contained"
              sx={{
                mt: 3,
                py: 1.5,
                fontWeight: 600,
                textTransform: 'none',
                background:
                  'linear-gradient(90deg, #1976d2 0%, #45a1ff 50%, #1976d2 100%)',
                backgroundSize: '200%',
                transition: 'background-position .4s',
                '&:hover': { backgroundPosition: 'right' },
              }}
              disabled={isSubmitting}
            >
              Proses GPT Vision
            </Button>
          </Box>
          {isSubmitting && !progressOpen && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(255,255,255,.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 3,
                zIndex: 10,
              }}
            >
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Memproses dokumen…
              </Typography>
            </Box>
          )}
        </Paper>
      </motion.div>
      {/* Progress overlay */}
      <Backdrop
        open={progressOpen}
        sx={{ color: '#fff', zIndex: (t) => t.zIndex.drawer + 2, flexDirection: 'column' }}
      >
        <Box position="relative" display="inline-flex">
          <CircularProgress variant="determinate" value={Math.min(100, percent)} size={96} thickness={4} />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="subtitle1">{Math.max(0, Math.min(100, Math.round(percent)))}%</Typography>
          </Box>
        </Box>
        <Typography sx={{ mt: 2 }}>{stage}</Typography>
      </Backdrop>
      {/* Snackbar for success/error messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={slideUp}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default AddDocumentForm;
