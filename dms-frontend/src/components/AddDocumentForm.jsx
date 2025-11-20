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
  Slide,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ClearIcon from '@mui/icons-material/Clear';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { motion } from 'framer-motion';

const slideUp = (props) => <Slide {...props} direction="up" />;

function fileFromClipboardItem(item) {
  if (!item || item.kind !== 'file' || !item.type.startsWith('image/')) return null;

  const original = item.getAsFile();
  if (!original) return null;

  const rand = Math.random().toString(36).slice(2, 7);
  const ext = original.type.split('/')[1] || 'png';
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

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

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
    if (!uploadedFile) return;
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

  const handleClearFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  // Polling helper
  const startPolling = (id) => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await API.get(`/progress/${id}/`);
        if (typeof data.percent === 'number') {
          setPercent((p) => Math.max(p, data.percent));
        }
        const countLabel =
          data.total_items != null
            ? ` — ${data.current_item ?? 0}/${data.total_items} item`
            : '';
        if (data.stage) setStage(`${data.stage}${countLabel}`);
        if ((data.percent || 0) >= 100) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPercent(100);
          setStage('Selesai');
          setTimeout(() => setProgressOpen(false), 600);
          setTimeout(() => navigate('/home'), 900);
        }
      } catch {
        // ignore polling errors
      }
    }, 600);
  };

  React.useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    []
  );

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

      const res = await API.post('/parse-and-store/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Job-ID': id,
        },
        onUploadProgress: (evt) => {
          const u = evt.total
            ? Math.round((evt.loaded * 100) / (evt.total || 1))
            : null;
          setStage(
            u != null
              ? `Mengunggah berkas (${u}%)`
              : 'Mengunggah berkas'
          );
          // server drives percent; do not update here
        },
      });

      if (res.status === 202) {
        setSnackbarMessage('Unggahan diterima. Parsing berjalan.');
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('Error:', err);
      setSnackbarMessage('Gagal mengunggah dan memproses dokumen.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
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

  const handlePaste = React.useCallback(
    (e) => {
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
    },
    []
  );

  React.useEffect(() => {
    const node = dropRef.current;
    if (!node) return;
    node.addEventListener('paste', handlePaste);
    return () => node.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const isImage =
    file &&
    ['image/jpeg', 'image/png', 'image/jpg'].includes(file.type);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            borderRadius: 4,
            px: { xs: 2.2, md: 3 },
            py: { xs: 2.4, md: 3 },
            border: (t) =>
              `1px solid ${
                t.palette.mode === 'dark'
                  ? 'rgba(51, 65, 85, 0.9)'
                  : 'rgba(148, 163, 184, 0.7)'
              }`,
            background: (t) =>
              t.palette.mode === 'dark'
                ? 'radial-gradient(circle at top left, #27326a 0, #020617 58%)'
                : 'linear-gradient(135deg, #ffffff 0, #f3f4ff 40%, #e0f2fe 100%)',
            boxShadow: (t) =>
              t.palette.mode === 'dark'
                ? '0 22px 54px rgba(15, 23, 42, 0.95)'
                : '0 20px 52px rgba(148, 163, 184, 0.45)',
          }}
        >
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              alignItems="stretch"
            >
              {/* Left: metadata */}
              <Box sx={{ flexBasis: { md: '40%' }, minWidth: 260 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.12,
                    color: 'text.secondary',
                    mb: 1,
                  }}
                >
                  Informasi dokumen
                </Typography>

                <Stack spacing={2}>
                  <TextField
                    label="Judul Dokumen"
                    required
                    fullWidth
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isSubmitting}
                  />

                  <FormControl required fullWidth disabled={isSubmitting}>
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

                  <FormControl required fullWidth disabled>
                    <InputLabel>Jenis Dokumen</InputLabel>
                    <Select
                      value={docType}
                      label="Jenis Dokumen"
                      onChange={(e) => setDocType(e.target.value)}
                    >
                      {documentTypes.map((d) => (
                        <MenuItem key={d.value} value={d.value}>
                          {d.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Box sx={{ mt: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary' }}
                    >
                      Setelah diunggah, sistem akan membaca isi dokumen dan
                      membuat entri transaksi secara otomatis.
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Right: upload area */}
              <Box
                {...getRootProps()}
                ref={dropRef}
                onPaste={handlePaste}
                sx={{
                  flex: 1,
                  minHeight: 260,
                  borderRadius: 3,
                  border: '1.8px dashed',
                  borderColor: isDragActive
                    ? 'primary.main'
                    : 'rgba(148, 163, 184, 0.9)',
                  bgcolor: isDragActive
                    ? (isDark ? '#020617' : '#e0f2fe')
                    : (isDark ? 'rgba(15, 23, 42, 0.96)' : '#f9fafb'),
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2.5,
                  px: { xs: 2, sm: 2.5 },
                  py: { xs: 2.2, sm: 2.6 },
                  cursor: 'pointer',
                  transition:
                    'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: isDragActive
                    ? (isDark
                        ? '0 0 0 1px rgba(129, 140, 248, 0.9)'
                        : '0 0 0 1px rgba(37, 99, 235, 0.8)')
                    : 'none',
                }}
              >
                <input {...getInputProps()} />

                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    flex: 1,
                  }}
                >
                  {file ? (
                    <>
                      <Chip
                        label={file.name}
                        size="small"
                        sx={{
                          maxWidth: '100%',
                          mb: 1.2,
                          borderRadius: 999,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      />
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary' }}
                      >
                        Klik di mana saja untuk mengganti berkas.
                      </Typography>
                    </>
                  ) : (
                    <>
                      <motion.div
                        animate={{ y: [0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <CloudUploadIcon
                          sx={{ fontSize: 54, opacity: 0.9 }}
                        />
                      </motion.div>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          mt: 1.2,
                          fontWeight: 600,
                          letterSpacing: 0.1,
                        }}
                      >
                        {isDragActive
                          ? 'Lepaskan file di sini'
                          : 'Seret file ke sini atau klik untuk memilih'}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}
                      >
                        Anda juga bisa menempel (Ctrl+V) screenshot langsung di
                        area ini.
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', mt: 0.5 }}
                      >
                        Format: PDF, JPG, PNG, Word, Excel
                      </Typography>
                    </>
                  )}
                </Box>

                {file && (
                  <Box
                    sx={{
                      width: { xs: '100%', sm: 180 },
                      maxHeight: 180,
                      borderRadius: 2,
                      overflow: 'hidden',
                      bgcolor: isDark ? '#020617' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {isImage && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 2,
                          color: 'text.secondary',
                        }}
                      >
                        <InsertDriveFileOutlinedIcon sx={{ mb: 1 }} />
                        <Typography variant="caption">
                          Pratinjau tidak tersedia
                        </Typography>
                      </Box>
                    )}

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearFile();
                      }}
                      disabled={isSubmitting}
                      sx={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        bgcolor: 'rgba(15, 23, 42, 0.75)',
                        color: '#e5e7eb',
                        '&:hover': {
                          bgcolor: 'rgba(15, 23, 42, 0.95)',
                        },
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Stack>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                mt: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary' }}
              >
                Pastikan file sudah final. Dokumen yang diunggah akan
                langsung dianalisis dan dikirim ke alur persetujuan.
              </Typography>

              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                sx={{
                  px: 3.4,
                  py: 1.1,
                  borderRadius: 999,
                  fontWeight: 600,
                  textTransform: 'none',
                  background:
                    'linear-gradient(90deg, #2563eb 0%, #38bdf8 50%, #2563eb 100%)',
                  backgroundSize: '200%',
                  transition: 'background-position .4s',
                  '&:hover': {
                    backgroundPosition: 'right',
                  },
                }}
              >
                {isSubmitting ? 'Memproses…' : 'Proses GPT Vision'}
              </Button>
            </Box>
          </Box>

          {isSubmitting && !progressOpen && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderRadius: 4,
                bgcolor: isDark
                  ? 'rgba(15, 23, 42, 0.9)'
                  : 'rgba(255, 255, 255, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
              }}
            >
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Menyiapkan unggahan…
              </Typography>
            </Box>
          )}
        </Paper>
      </motion.div>

      <Backdrop
        open={progressOpen}
        sx={{
          color: '#fff',
          zIndex: (t) => t.zIndex.drawer + 2,
          flexDirection: 'column',
        }}
      >
        <Box position="relative" display="inline-flex">
          <CircularProgress
            variant="determinate"
            value={Math.min(100, percent)}
            size={96}
            thickness={4}
          />
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
            <Typography variant="subtitle1">
              {Math.max(
                0,
                Math.min(100, Math.round(percent))
              )}
              %
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ mt: 2 }}>{stage}</Typography>
      </Backdrop>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={slideUp}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default AddDocumentForm;
