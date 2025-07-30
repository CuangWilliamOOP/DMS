import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  CircularProgress,
  Grid,
  Paper,
  IconButton,
  Button,
  Fade,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import API from '../services/api';
import { useTheme } from '@mui/material/styles';

const companyFullNames = {
  'cv-asn': 'CV. Alam Subur Nusantara',
  'pt-ttu': 'PT. Tunggal Tunggul Unggul',
  'pt-ols': 'PT. OLS',
  'pt-olm': 'PT. OLM',
};

const directories = [
  {
    key: 'qlola',
    label: 'Transaksi QLOLA',
    color: '#90caf9',
    docTypeFilter: 'tagihan_pekerjaan',
  },
  {
    key: 'internal',
    label: 'Transaksi Internal',
    color: '#a5d6a7',
    docTypeFilter: 'tagihan_internal',
  },
  {
    key: 'lain',
    label: 'Dokumen Lain',
    color: '#ffcc80',
    docTypeFilter: 'lainnya',
  },
];

const breadcrumbSx = {
  mb: 3,
  fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.25rem' },
  '& a, & .MuiTypography-root': { fontWeight: 600 },
};

function CompanyDirectoryPage() {
  const { companyName, dirKey } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const slug = (companyName || '').toLowerCase().replace(/\./g, '');
  const fullName = companyFullNames[slug] || slug.toUpperCase();
  const selectedDir = directories.find((d) => d.key === dirKey) || null;

  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await API.get('/documents/');
        const filtered = res.data.filter(
          (d) => d.archived && d.status === 'sudah_dibayar' && d.company === slug.replace('pt-', '').replace('cv-', '')
        );
        setAllDocs(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [slug]);

  const docsToDisplay = selectedDir
    ? allDocs.filter((d) => d.doc_type === selectedDir.docTypeFilter)
    : [];

  const handleDelete = async (docId) => {
    if (window.confirm('Yakin ingin menghapus dokumen ini?')) {
      try {
        await API.delete(`/documents/${docId}/`);
        setAllDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));
        alert('Dokumen berhasil dihapus.');
      } catch (error) {
        console.error(error);
        alert('Terjadi kesalahan saat menghapus dokumen.');
      }
    }
  };

  // --- SOFT BACKGROUND, NO GRADIENT ---
  const bgColor = isDark ? '#1a2036' : '#f5f7fc';

  return (
    <>
      {/* --- FULL PAGE BACKGROUND --- */}
      <Box
        sx={{
          position: 'fixed',
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
          px: { xs: 1, sm: 3, md: 6 },
          py: { xs: 3, sm: 6 },
          mt:-10,
          position: 'relative',
        }}
      >
        {/* Breadcrumb */}
        <Breadcrumbs sx={breadcrumbSx} separator=">">
          <Link component={RouterLink} underline="hover" to="/directory">
            Direktori
          </Link>
          {selectedDir ? (
            <Link component={RouterLink} underline="hover" to={`/directory/${companyName}`}>
              {fullName}
            </Link>
          ) : (
            <Typography color="text.primary">{fullName}</Typography>
          )}
          {selectedDir && (
            <Typography color="text.primary">{selectedDir.label}</Typography>
          )}
        </Breadcrumbs>

        {/* --- Directory/Folders --- */}
        {!selectedDir && (
          <Grid container spacing={3}>
            {directories.map((dir, idx) => (
              <Grid item xs={12} sm={6} md={4} key={dir.key}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * idx, duration: 0.34 }}
                >
                  <Paper
                    elevation={2}
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderRadius: 3,
                      background: isDark ? '#22264a' : '#fff',
                      border: `2px solid ${dir.color}`,
                      boxShadow: isDark
                        ? '0 2px 12px 0 #16123b33'
                        : '0 4px 12px 0 #b2c6fc18',
                      transition: 'box-shadow 0.23s, transform 0.18s, border 0.2s',
                      '&:hover': {
                        boxShadow: isDark
                          ? '0 8px 32px #19163c44'
                          : '0 8px 36px #b9caf82c',
                        border: `2.7px solid ${dir.color}`,
                        transform: 'translateY(-4px) scale(1.025)',
                        background: isDark ? '#202241' : '#f8fafc',
                      },
                    }}
                    onClick={() =>
                      navigate(`/directory/${companyName}/${dir.key}`)
                    }
                  >
                    <FolderOpenIcon sx={{ fontSize: 56, color: dir.color }} />
                    <Typography
                      variant="subtitle1"
                      fontWeight="medium"
                      sx={{ mt: 2, fontSize: 19 }}
                    >
                      {dir.label}
                    </Typography>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        )}

        {/* --- Back button & Docs in this Folder --- */}
        {selectedDir && (
          <>
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(`/directory/${companyName}`)}
                sx={{
                  borderRadius: 3,
                  fontWeight: 600,
                  mb: 2,
                  background: isDark ? '#23294a' : '#f7fafd',
                  '&:hover': { background: isDark ? '#232846' : '#e8eefa' },
                }}
              >
                Kembali ke Daftar Direktori
              </Button>
            </Box>
            {loading ? (
              <CircularProgress sx={{ mt: 4 }} />
            ) : docsToDisplay.length === 0 ? (
              <Typography sx={{ mt: 3, color: 'text.secondary' }}>
                Tidak ada dokumen di folder ini.
              </Typography>
            ) : (
              <Grid container spacing={3}>
                {docsToDisplay.map((doc, idx) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={doc.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * idx, duration: 0.36 }}
                    >
                      <Paper
                        elevation={3}
                        sx={{
                          p: 3,
                          borderRadius: 4,
                          textAlign: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                          background: isDark ? '#25294c' : '#fff',
                          boxShadow: isDark
                            ? '0 2px 14px #1b1d2a33'
                            : '0 4px 18px #c7daff10',
                          transition: 'transform 0.15s, box-shadow 0.13s',
                          '&:hover': {
                            transform: 'translateY(-4px) scale(1.025)',
                            boxShadow: isDark
                              ? '0 10px 28px #25234633'
                              : '0 8px 36px #e3ecff16',
                          },
                        }}
                        onClick={() =>
                          navigate(`/directory/${companyName}/${selectedDir.key}/preview/${doc.document_code}`)
                        }
                      >
                        <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: 0.6 }}>
                          #{doc.document_code}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                          {new Date(doc.created_at).toLocaleDateString('id-ID')}
                        </Typography>
                        {/* Show delete only for owner */}
                        {localStorage.getItem('role') === 'owner' && (
                          <IconButton
                            sx={{ position: 'absolute', top: 9, right: 9, color: '#f55' }}
                            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                        <Box
                          sx={{
                            mt: 2,
                            px: 2,
                            py: 1,
                            background: isDark ? '#31365c' : '#f2f7ff',
                            borderRadius: 2,
                            fontWeight: 600,
                            fontSize: 15,
                            color: isDark ? '#90caf9' : '#1976d2',
                            boxShadow: '0 1px 4px #b3cfff09',
                          }}
                        >
                          Sudah Dibayar
                        </Box>
                      </Paper>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Box>
    </>
  );
}

export default CompanyDirectoryPage;
