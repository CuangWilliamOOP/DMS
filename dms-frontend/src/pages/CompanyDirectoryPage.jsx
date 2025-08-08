// File: src/pages/CompanyDirectoryPage.jsx

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
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import API from '../services/api';
import { useTheme } from '@mui/material/styles';

// ————————————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————————————
const slugify = (name = '') =>
  name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

// Map of slug → pretty name
const companyFullNames = {
  'cv-asn': 'CV. Alam Subur Nusantara',
  'pt-ttu': 'PT. Tunggal Tunggul Unggul',
  'pt-ols': 'PT. OLS',
  'pt-olm': 'PT. OLM',
};

const directories = [
  { key: 'qlola', label: 'Transaksi QLOLA', color: '#90caf9', docTypeFilter: 'tagihan_pekerjaan' },
  { key: 'internal', label: 'Transaksi Internal', color: '#a5d6a7', docTypeFilter: 'tagihan_internal' },
  { key: 'lain', label: 'Dokumen Lain', color: '#ffcc80', docTypeFilter: 'lainnya' },
];

const breadcrumbSx = {
  mb: 3,
  fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.25rem' },
  '& a, & .MuiTypography-root': { fontWeight: 600 },
};

export default function CompanyDirectoryPage() {
  const { companyName, dirKey } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Normalize the slug param to be safe (mirrors DirectoryPage)
  const slug = slugify(companyName || '');
  const fullName = companyFullNames[slug] || slug.toUpperCase();
  const selectedDir = directories.find((d) => d.key === dirKey) || null;

  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await API.get('/documents/');
        const companyCode = slug.replace(/^pt-/, '').replace(/^cv-/, '');
        const filtered = res.data.filter(
          (d) => d.archived && d.status === 'sudah_dibayar' && d.company === companyCode
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

  // Consistent black-leaning dark background (matches DirectoryPage)
  const bgColor = isDark ? '#181a29' : '#f5f7fc';

  return (
    <>
      {/* Full-page background */}
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
          mt: -10,
          position: 'relative',
        }}
      >
        {/* Breadcrumb */}
        <Breadcrumbs sx={breadcrumbSx} separator=">">
          <Link component={RouterLink} underline="hover" to="/directory">
            Direktori
          </Link>
          {selectedDir ? (
            <Link component={RouterLink} underline="hover" to={`/directory/${slug}`}>
              {fullName}
            </Link>
          ) : (
            <Typography color="text.primary">{fullName}</Typography>
          )}
          {selectedDir && (
            <Typography color="text.primary">{selectedDir.label}</Typography>
          )}
        </Breadcrumbs>

        {/* Directory tiles */}
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
                    className="dir-card"
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderRadius: 3,
                      background: isDark ? '#1b1f36' : '#fff',
                      border: `2px solid ${dir.color}`,
                      boxShadow: isDark
                        ? '0 2px 12px 0 #16123b33'
                        : '0 4px 12px 0 #b2c6fc18',
                      transition: 'box-shadow 0.23s, transform 0.18s, border 0.2s, background 0.18s',
                      '&:hover': {
                        boxShadow: isDark ? '0 8px 32px #19163c44' : '0 8px 36px #b9caf82c',
                        border: `2.7px solid ${dir.color}`,
                        transform: 'translateY(-4px) scale(1.025)',
                        background: isDark ? '#181c2f' : '#f8fafc',
                      },
                      '&:focus-visible': {
                        outline: `3px solid ${dir.color}`,
                        outlineOffset: 2,
                      },
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Buka folder ${dir.label}`}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/directory/${slug}/${dir.key}`)}
                    onClick={() => navigate(`/directory/${slug}/${dir.key}`)}
                  >
                    <FolderOpenIcon sx={{ fontSize: 56, color: dir.color }} />
                    <Typography variant="subtitle1" fontWeight="medium" sx={{ mt: 2, fontSize: 19 }}>
                      {dir.label}
                    </Typography>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Back button & docs grid */}
        {selectedDir && (
          <>
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(`/directory/${slug}`)}
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
                        elevation={7}
                        className="doc-card"
                        sx={{
                          p: 3,
                          borderRadius: '22px',
                          minHeight: 210,
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: isDark ? '#232949' : '#fff',
                          border: '1.5px solid #edf0fa',
                          boxShadow: isDark ? '0 10px 32px 0 #0a0d1e88' : '0 10px 32px 0 #b6c9f344',
                          position: 'relative',
                          transition: 'box-shadow 0.18s, transform 0.17s, background 0.18s',
                          '&:hover': {
                            boxShadow: isDark ? '0 18px 48px 0 #0a0d1ea8' : '0 18px 48px 0 #b6c9f355',
                            transform: 'translateY(-3px) scale(1.018)',
                            background: isDark ? '#202542' : '#fdfefe',
                          },
                          '&:focus-visible': {
                            outline: '3px solid #7e9be6',
                            outlineOffset: 2,
                          },
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Buka ${doc.document_code}`}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') &&
                          navigate(`/directory/${slug}/${selectedDir.key}/preview/${doc.document_code}`)}
                        onClick={() =>
                          navigate(`/directory/${slug}/${selectedDir.key}/preview/${doc.document_code}`)
                        }
                      >
                        <Box
                          sx={{
                            mb: 2,
                            width: 54,
                            height: 66,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                          }}
                        >
                          {/* Paper icon with a fake folded corner effect */}
                          <Box
                            sx={{
                              position: 'absolute',
                              width: 54,
                              height: 66,
                              borderRadius: '8px 16px 12px 12px',
                              background: isDark ? '#1e2340' : '#f8fafc',
                              border: '1.2px solid #e3e6f3',
                              zIndex: 1,
                            }}
                          />
                          <DescriptionOutlinedIcon
                            sx={{ fontSize: 44, color: '#7e9be6', zIndex: 2, position: 'relative' }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              right: 4,
                              top: 3,
                              width: 18,
                              height: 18,
                              background: 'linear-gradient(135deg,#f2f3fa 60%,#e3e7fc 100%)',
                              borderTopRightRadius: '6px',
                              clipPath: 'polygon(100% 0,0 100%,100% 100%)',
                              border: '1.5px solid #dde1f3',
                              borderLeft: 'none',
                              borderBottom: 'none',
                              zIndex: 3,
                            }}
                          />
                        </Box>
                        <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: 0.7, mb: 0.8, color: isDark ? '#e6ecff' : '#232849' }}>
                          #{doc.document_code}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                          {new Date(doc.created_at).toLocaleDateString('id-ID')}
                        </Typography>
                        <Box
                          sx={{
                            px: 2,
                            py: 1,
                            background: isDark ? '#1a2142' : '#f5f8ff',
                            borderRadius: 2.7,
                            fontWeight: 700,
                            fontSize: 15,
                            color: '#3688d6',
                            mt: 1,
                            boxShadow: '0 1px 4px #b3cfff10',
                          }}
                        >
                          Sudah Dibayar
                        </Box>
                        {localStorage.getItem('role') === 'owner' && (
                          <IconButton
                            sx={{ position: 'absolute', top: 9, right: 9, color: '#f55' }}
                            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                            aria-label="Hapus dokumen"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
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
