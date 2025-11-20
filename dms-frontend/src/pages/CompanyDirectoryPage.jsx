// File: src/pages/CompanyDirectoryPage.jsx

import React, { useEffect, useMemo, useState } from 'react';
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
  Chip,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
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
  mb: 2.5,
  fontSize: { xs: '0.96rem', sm: '1.05rem', md: '1.15rem' },
  '& a, & .MuiTypography-root': { fontWeight: 600 },
};

const formatDocType = (value) =>
  value
    ? value
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : '';

const formatDate = (dt) =>
  dt
    ? new Date(dt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

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
  const [docSearch, setDocSearch] = useState('');
  const [docSort, setDocSort] = useState('newest'); // 'newest' | 'oldest'

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

  const directoryCounts = useMemo(() => {
    const counts = {};
    directories.forEach((dir) => {
      counts[dir.key] = allDocs.filter((d) => d.doc_type === dir.docTypeFilter).length;
    });
    return counts;
  }, [allDocs]);

  const visibleDocs = useMemo(() => {
    if (!selectedDir) return [];
    const term = docSearch.trim().toLowerCase();

    let docs = docsToDisplay;

    if (term) {
      docs = docs.filter((doc) => {
        const code = (doc.document_code || '').toLowerCase();
        const title = (doc.title || '').toLowerCase();
        const desc = (doc.description || '').toLowerCase();
        return code.includes(term) || title.includes(term) || desc.includes(term);
      });
    }

    docs = [...docs].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (docSort === 'oldest') {
        return aTime - bTime;
      }
      return bTime - aTime; // newest first
    });

    return docs;
  }, [docsToDisplay, docSearch, docSort, selectedDir]);

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

  const companyCode = slug.replace(/^pt-/, '').replace(/^cv-/, '').toUpperCase();
  const hasOwnerRole = localStorage.getItem('role') === 'owner';

  const highlight = isDark ? '#8fb1ff' : '#1e5bb8';

  const handleSortToggle = (_event, value) => {
    if (value) setDocSort(value);
  };

  const handleDirectoryClick = (dir) => {
    navigate(`/directory/${slug}/${dir.key}`);
  };

  const handleBackToDirectories = () => {
    navigate(`/directory/${slug}`);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1.5, sm: 3, md: 6 },
        py: { xs: 3, sm: 4 },
        mt: 0,
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

      {/* Page header */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Arsip Dokumen
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', maxWidth: 520 }}
          >
            {selectedDir
              ? `Dokumen ${selectedDir.label.toLowerCase()} untuk ${fullName}.`
              : `Pilih jenis transaksi untuk melihat dokumen yang sudah dibayar dan diarsipkan untuk ${fullName}.`}
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            px: 2.2,
            py: 1.4,
            borderRadius: 3,
            border: (t) =>
              `1px solid ${
                t.palette.mode === 'dark' ? '#28325b' : '#cbd5ff'
              }`,
            background: (t) =>
              t.palette.mode === 'dark'
                ? 'radial-gradient(circle at top left, #27326a 0, #060716 60%)'
                : 'linear-gradient(135deg, #eef3ff 0, #fdf7ff 70%)',
            minWidth: 220,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              textTransform: 'uppercase',
              letterSpacing: 0.12,
              color: 'text.secondary',
            }}
          >
            {companyCode}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.25 }}>
            {fullName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.75 }}>
            <Chip
              size="small"
              label={
                selectedDir
                  ? `${visibleDocs.length} dokumen`
                  : `${allDocs.length} dokumen diarsip`
              }
              sx={{
                borderRadius: 999,
                fontWeight: 600,
                bgcolor: isDark ? '#151a32' : '#e4efff',
                color: isDark ? '#c3d4ff' : '#174a9c',
              }}
            />
            {!selectedDir && (
              <Chip
                size="small"
                label={`${directories.length} kategori`}
                sx={{
                  borderRadius: 999,
                  bgcolor: isDark ? '#151824' : '#f3e9ff',
                }}
              />
            )}
          </Box>
        </Paper>
      </Box>

      {/* No directory yet: show directory picker */}
      {!selectedDir && (
        <Grid container spacing={3}>
          {directories.map((dir, index) => {
            const count = directoryCounts[dir.key] || 0;
            return (
              <Grid item xs={12} sm={4} key={dir.key}>
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index, duration: 0.25 }}
                >
                  <Paper
                    onClick={() => handleDirectoryClick(dir)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDirectoryClick(dir);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Buka kategori ${dir.label}`}
                    sx={{
                      p: 2.6,
                      borderRadius: 3,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      background: (t) =>
                        t.palette.mode === 'dark' ? '#171a2f' : '#ffffff',
                      border: (t) =>
                        `1px solid ${
                          t.palette.mode === 'dark' ? '#2a3259' : '#dde4ff'
                        }`,
                      boxShadow: (t) =>
                        t.palette.mode === 'dark'
                          ? '0 18px 40px rgba(0,0,0,0.8)'
                          : '0 18px 42px rgba(15,35,95,0.22)',
                      transition:
                        'transform 0.18s ease, box-shadow 0.2s ease, border-color 0.18s ease, background 0.18s ease',
                      '&:before': {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(circle at top left, ${dir.color}33, transparent 60%)`,
                        opacity: 0.8,
                        pointerEvents: 'none',
                      },
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: (t) =>
                          t.palette.mode === 'dark'
                            ? '0 26px 60px rgba(0,0,0,0.95)'
                            : '0 26px 60px rgba(15,35,95,0.3)',
                        borderColor: dir.color,
                      },
                      '&:focus-visible': {
                        outline: `3px solid ${dir.color}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 1.75,
                          backgroundColor: dir.color,
                          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.4)',
                        }}
                      >
                        <FolderOpenIcon
                          sx={{
                            fontSize: 30,
                            color: isDark ? '#0b1025' : '#05264d',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, mb: 0.5 }}
                      >
                        {dir.label}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mb: 1.5 }}
                      >
                        {dir.key === 'qlola'
                          ? 'Tagihan pekerjaan yang dibayar lewat QLOLA.'
                          : dir.key === 'internal'
                          ? 'Transaksi internal / reimbursement yang sudah dibayar.'
                          : 'Dokumen lain yang sudah selesai dan diarsip.'}
                      </Typography>
                      <Chip
                        size="small"
                        label={
                          count
                            ? `${count} dokumen tersimpan`
                            : 'Belum ada dokumen'
                        }
                        sx={{
                          borderRadius: 999,
                          fontWeight: 500,
                          bgcolor: isDark ? '#101326' : '#f1f5ff',
                          color: isDark ? '#e5edff' : '#1e293b',
                        }}
                      />
                    </Box>
                  </Paper>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Directory selected: show document list */}
      {selectedDir && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<ArrowBackIcon />}
              onClick={handleBackToDirectories}
              sx={{
                borderRadius: 999,
                fontWeight: 600,
                mb: 2,
                background: isDark ? '#171c3a' : '#f7f9ff',
                '&:hover': {
                  background: isDark ? '#1b2145' : '#edf2ff',
                },
              }}
            >
              Kembali ke daftar kategori
            </Button>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 3,
              border: (t) =>
                `1px solid ${
                  t.palette.mode === 'dark' ? '#242b4b' : '#d4ddff'
                }`,
              background: (t) =>
                t.palette.mode === 'dark' ? '#0f1427' : '#ffffff',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 2,
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 260 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 0.5 }}
                >
                  {selectedDir.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary' }}
                >
                  Menampilkan {visibleDocs.length} dari {docsToDisplay.length}{' '}
                  dokumen yang sudah dibayar.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  alignItems: 'center',
                }}
              >
                <TextField
                  size="small"
                  placeholder="Cari kode, judul, atau catatan…"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  sx={{
                    minWidth: 220,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 999,
                      background: (t) =>
                        t.palette.mode === 'dark' ? '#050817' : '#f9fafb',
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: docSearch ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setDocSearch('')}
                          aria-label="Bersihkan pencarian"
                        >
                          ×
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />

                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={docSort}
                  onChange={handleSortToggle}
                  aria-label="Urutkan berdasarkan tanggal"
                  sx={{
                    '& .MuiToggleButton-root': {
                      px: 1.5,
                      borderRadius: 999,
                    },
                  }}
                >
                  <ToggleButton value="newest" aria-label="Terbaru dulu">
                    <SortIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    Terbaru
                  </ToggleButton>
                  <ToggleButton value="oldest" aria-label="Terlama dulu">
                    Terlama
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>
          </Paper>

          {loading ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
              }}
            >
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Mengambil dokumen arsip…
              </Typography>
            </Box>
          ) : visibleDocs.length === 0 ? (
            <Paper
              sx={{
                p: 4,
                borderRadius: 3,
                textAlign: 'center',
                border: (t) =>
                  `1px dashed ${
                    t.palette.mode === 'dark' ? '#4b567f' : '#c9d4ff'
                  }`,
                background: (t) =>
                  t.palette.mode === 'dark' ? '#0b1021' : '#f8f9ff',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.75 }}>
                Belum ada dokumen di kategori ini
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', maxWidth: 460, mx: 'auto' }}
              >
                Dokumen akan muncul di sini setelah statusnya{' '}
                <Box component="span" sx={{ fontWeight: 600 }}>
                  sudah dibayar
                </Box>{' '}
                dan diarsip untuk {fullName}.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2.5}>
              {visibleDocs.map((doc, index) => (
                <Grid
                  item
                  xs={12}
                  md={6}
                  key={doc.id || doc.document_code || index}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * index, duration: 0.25 }}
                  >
                    <Paper
                      className="doc-card"
                      sx={{
                        p: 2.4,
                        borderRadius: 3,
                        position: 'relative',
                        cursor: 'pointer',
                        border: (t) =>
                          `1px solid ${
                            t.palette.mode === 'dark'
                              ? '#2b355c'
                              : '#d5defe'
                          }`,
                        background: (t) =>
                          t.palette.mode === 'dark'
                            ? 'radial-gradient(circle at top left, #27326a 0, #050817 60%)'
                            : 'linear-gradient(135deg, #f9fafb 0, #eef2ff 80%)',
                        boxShadow: (t) =>
                          t.palette.mode === 'dark'
                            ? '0 20px 46px rgba(0,0,0,0.95)'
                            : '0 18px 42px rgba(15,35,95,0.25)',
                        transition:
                          'transform 0.18s ease, box-shadow 0.2s ease, border-color 0.18s ease',
                        '&:hover': {
                          transform: 'translateY(-3px)',
                          boxShadow: (t) =>
                            t.palette.mode === 'dark'
                              ? '0 26px 60px rgba(0,0,0,0.98)'
                              : '0 24px 60px rgba(15,35,95,0.32)',
                          borderColor: highlight,
                        },
                        '&:focus-visible': {
                          outline: '3px solid',
                          outlineColor: highlight,
                          outlineOffset: 2,
                        },
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Buka ${doc.document_code}`}
                      onClick={() =>
                        navigate(
                          `/directory/${slug}/${selectedDir.key}/preview/${doc.document_code}`
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(
                            `/directory/${slug}/${selectedDir.key}/preview/${doc.document_code}`
                          );
                        }
                      }}
                    >
                      {/* Delete button (owner only) */}
                      {hasOwnerRole && (
                        <IconButton
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: '#f97373',
                            backgroundColor: isDark ? '#111322' : '#ffffff',
                            '&:hover': {
                              backgroundColor: isDark ? '#191d33' : '#fee2e2',
                            },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc.id);
                          }}
                          aria-label="Hapus dokumen"
                        >
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 2,
                        }}
                      >
                        <Box
                          sx={{
                            width: 46,
                            height: 58,
                            borderRadius: 1.5,
                            background: isDark ? '#0b1021' : '#ffffff',
                            boxShadow: '0 10px 24px rgba(15,23,42,0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            flexShrink: 0,
                          }}
                        >
                          {/* Paper icon with subtle folded corner */}
                          <DescriptionOutlinedIcon
                            sx={{
                              fontSize: 30,
                              color: isDark ? '#9ca3ff' : '#4b5563',
                            }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              width: 18,
                              height: 18,
                              borderTopRightRadius: 6,
                              borderBottomLeftRadius: 20,
                              background: highlight,
                            }}
                          />
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700,
                              mb: 0.4,
                              color: isDark ? '#e5edff' : '#111827',
                            }}
                            noWrap
                            title={doc.title || doc.document_code}
                          >
                            {doc.title || '(Tanpa judul)'}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              mb: 0.4,
                              color: 'text.secondary',
                              fontFamily: 'monospace',
                              letterSpacing: 0.3,
                            }}
                          >
                            #{doc.document_code}
                          </Typography>

                          <Box
                            sx={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 1,
                              alignItems: 'center',
                              mb: 0.75,
                            }}
                          >
                            <Chip
                              size="small"
                              label={formatDocType(doc.doc_type)}
                              sx={{
                                borderRadius: 999,
                                height: 22,
                                fontSize: 11,
                                bgcolor: isDark ? '#101326' : '#e5edff',
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary' }}
                            >
                              {formatDate(doc.created_at)}
                            </Typography>
                          </Box>

                          {doc.description && (
                            <Typography
                              variant="body2"
                              sx={{
                                color: isDark ? '#e5e7eb' : '#374151',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {doc.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
