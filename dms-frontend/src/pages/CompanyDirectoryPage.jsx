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
  Button,
  Chip,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Tooltip,
  Divider,
  Stack,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ClearIcon from '@mui/icons-material/Clear';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { alpha, useTheme } from '@mui/material/styles';
import API from '../services/api';

// ————————————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————————————
const slugify = (name = '') =>
  name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

// Map of slug → pretty name
const companyFullNames = {
  'cv-asn': 'CV. Alam Subur Nusantara',
  'pt-ttu': 'PT. Tunggal Tunggul Unggul',
  'pt-ols': 'PT. Ostor Lumbanbanjar Sejahtera',
  'pt-olm': 'PT. Ostor Lumbanbanjar Makmur',
};

// Two high-level "folders" per company
const directories = [
  {
    key: 'qlola',
    label: 'Transaksi QLOLA',
    accent: '#60a5fa',
    icon: <FolderOpenIcon />,
    description: 'Tagihan pekerjaan yang dibayar lewat QLOLA.',
    docTypeFilter: 'tagihan_pekerjaan',
  },
  {
    key: 'rekap',
    label: 'Rekap',
    accent: '#fbbf24',
    icon: <DescriptionOutlinedIcon />,
    description: 'Laporan rekap otomatis (misalnya BBM) yang bersumber dari transaksi QLOLA.',
    docTypeFilter: null, // virtual folder, no direct doc_type
  },
];

// Files inside the Rekap folder
const REKAP_FILES = [
  {
    key: 'bbm',
    label: 'Rekap BBM',
    description: 'Semua transaksi BBM (BBM/solar) yang diambil dari Transaksi QLOLA.',
  },
];

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

function DirectoryCard({ dir, statLabel, onClick }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2.1, sm: 2.4 },
        borderRadius: 3,
        cursor: 'pointer',
        border: (t) =>
          `1px solid ${
            t.palette.mode === 'dark' ? 'rgba(51, 65, 85, 0.9)' : 'rgba(148, 163, 184, 0.55)'
          }`,
        background: (t) =>
          t.palette.mode === 'dark'
            ? 'radial-gradient(circle at top left, rgba(30, 41, 59, 0.92) 0, rgba(2, 6, 23, 0.98) 62%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.94) 0, rgba(238,242,255,0.92) 60%)',
        transition: 'transform 0.16s ease, box-shadow 0.22s ease, border-color 0.16s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark
            ? '0 18px 44px rgba(0, 0, 0, 0.55)'
            : '0 16px 42px rgba(148, 163, 184, 0.6)',
          '& .dir-blob': {
            transform: 'scale(1.04)',
            opacity: isDark ? 0.18 : 0.2,
          },
        },
      }}
    >
      {/* Accent blob */}
      <Box
        className="dir-blob"
        sx={{
          position: 'absolute',
          inset: '-45%',
          opacity: isDark ? 0.14 : 0.16,
          background: `radial-gradient(circle at top left, ${dir.accent} 0, transparent 62%)`,
          transform: 'scale(1.02)',
          transition: 'transform 0.18s ease, opacity 0.18s ease',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', display: 'flex', gap: 2, alignItems: 'center' }}>
        {/* Icon */}
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(dir.accent, isDark ? 0.22 : 0.2),
            color: isDark ? '#e5e7eb' : '#0b1025',
            flexShrink: 0,
            border: `1px solid ${alpha(dir.accent, isDark ? 0.32 : 0.22)}`,
          }}
        >
          {dir.icon}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                {dir.label}
              </Typography>
            </Box>

            <IconButton
              size="small"
              aria-label={`Buka ${dir.label}`}
              sx={{
                mt: 0.25,
                borderRadius: 999,
                border: (t) =>
                  `1px solid ${
                    t.palette.mode === 'dark'
                      ? 'rgba(148, 163, 184, 0.55)'
                      : 'rgba(148, 163, 184, 0.75)'
                  }`,
                backgroundColor: (t) =>
                  t.palette.mode === 'dark' ? 'rgba(2, 6, 23, 0.65)' : 'rgba(255,255,255,0.75)',
              }}
            >
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={statLabel}
              sx={{
                borderRadius: 999,
                backgroundColor: (t) =>
                  t.palette.mode === 'dark' ? 'rgba(2, 6, 23, 0.55)' : 'rgba(255,255,255,0.78)',
              }}
            />
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
}

export default function CompanyDirectoryPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { companyName, dirKey } = useParams();
  const navigate = useNavigate();

  const slug = slugify(companyName || '');
  const fullName = companyFullNames[slug] || slug.toUpperCase();
  const selectedDir = directories.find((d) => d.key === dirKey) || null;

  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docSearch, setDocSearch] = useState('');
  const [docSort, setDocSort] = useState('newest'); // 'newest' | 'oldest'

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      try {
        const res = await API.get('/documents/');
        const companyCode = slug.replace(/^pt-/, '').replace(/^cv-/, '');
        const filtered = (res.data || []).filter(
          (d) => d.archived && d.status === 'sudah_dibayar' && d.company === companyCode
        );
        setAllDocs(filtered);
      } catch (err) {
        console.error(err);
        setAllDocs([]);
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchDocs();
  }, [slug]);

  const companyCode = slug.replace(/^pt-/, '').replace(/^cv-/, '');

  const docsToDisplay = useMemo(() => {
    if (!selectedDir || !selectedDir.docTypeFilter) return [];
    return allDocs.filter((d) => d.doc_type === selectedDir.docTypeFilter);
  }, [allDocs, selectedDir]);

  const directoryCounts = useMemo(() => {
    const counts = {};
    directories.forEach((dir) => {
      if (dir.docTypeFilter) {
        counts[dir.key] = allDocs.filter((d) => d.doc_type === dir.docTypeFilter).length;
      } else {
        counts[dir.key] = 0;
      }
    });
    return counts;
  }, [allDocs]);

  const visibleDocs = useMemo(() => {
    if (!selectedDir || !selectedDir.docTypeFilter) return [];

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
      if (docSort === 'oldest') return aTime - bTime;
      return bTime - aTime;
    });

    return docs;
  }, [docsToDisplay, docSearch, docSort, selectedDir]);

  const handleDirectoryClick = (dir) => {
    navigate(`/directory/${slug}/${dir.key}`);
  };

  const handleBackToDirectories = () => {
    setDocSearch('');
    navigate(`/directory/${slug}`);
  };

  const handleSortToggle = (_event, value) => {
    if (value) setDocSort(value);
  };

  const pageBg = isDark
    ? 'radial-gradient(circle at top, #141a3a 0, #0f111a 52%, #050814 100%)'
    : 'radial-gradient(circle at top, #f4f8ff 0, #eaf2ff 44%, #dbeafe 100%)';

  const panelBg = isDark ? 'rgba(2, 6, 23, 0.68)' : 'rgba(255, 255, 255, 0.84)';

  const softBorder = (t) =>
    `1px solid ${t.palette.mode === 'dark' ? 'rgba(51, 65, 85, 0.9)' : 'rgba(148, 163, 184, 0.55)'}`;

  const summaryStatPrimary = loading
    ? 'Memuat…'
    : selectedDir
    ? selectedDir.key === 'rekap'
      ? `${REKAP_FILES.length} jenis rekap`
      : `${visibleDocs.length} dokumen`
    : `${allDocs.length} dokumen diarsip`;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1.5, sm: 2.5, md: 4 },
        py: { xs: 2.5, sm: 3.5, md: 4.5 },
        background: pageBg,
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Breadcrumbs
          separator=">"
          sx={{
            mb: 2,
            fontSize: { xs: '0.95rem', sm: '1.02rem' },
            '& a, & .MuiTypography-root': { fontWeight: 650 },
            overflowX: 'auto',
            pb: 0.5,
            '&::-webkit-scrollbar': { display: 'none' },
            '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
          }}
        >
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
          {selectedDir && <Typography color="text.primary">{selectedDir.label}</Typography>}
        </Breadcrumbs>

        <Box
          sx={{
            mb: 2.25,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0.2, mb: 0.6 }}>
              Arsip Dokumen
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 640 }}>
              {selectedDir
                ? selectedDir.key === 'rekap'
                  ? `Laporan rekap otomatis dari Transaksi QLOLA untuk ${fullName}.`
                  : `Dokumen ${selectedDir.label.toLowerCase()} untuk ${fullName}.`
                : `Pilih kategori untuk melihat dokumen yang sudah dibayar dan diarsipkan untuk ${fullName}.`}
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: softBorder,
              background: panelBg,
              backdropFilter: 'blur(16px)',
              minWidth: { xs: '100%', md: 340 },
              maxWidth: { xs: '100%', md: 420 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.12,
                    color: 'text.secondary',
                    display: 'block',
                    mb: 0.35,
                  }}
                >
                  {companyCode || '—'}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                  {fullName}
                </Typography>
                {selectedDir && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {selectedDir.label}
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                  border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.28 : 0.18)}`,
                }}
              >
                <FolderOpenIcon color="primary" />
              </Box>
            </Box>

            <Divider sx={{ my: 1.25, borderColor: isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)' }} />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip size="small" label={summaryStatPrimary} sx={{ borderRadius: 999 }} />
              {!selectedDir && <Chip size="small" label={`${directories.length} kategori`} sx={{ borderRadius: 999 }} />}
              {selectedDir && selectedDir.key !== 'rekap' && (
                <Chip
                  size="small"
                  label={loading ? 'Memuat…' : `${allDocs.length} total diarsip`}
                  sx={{ borderRadius: 999 }}
                />
              )}
              {selectedDir && selectedDir.key === 'rekap' && (
                <Chip
                  size="small"
                  label={loading ? 'Memuat…' : `${allDocs.length} dokumen sumber`}
                  sx={{ borderRadius: 999 }}
                />
              )}
            </Box>
          </Paper>
        </Box>

        {selectedDir?.docTypeFilter && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.6, md: 2 },
              borderRadius: 3,
              border: softBorder,
              background: panelBg,
              backdropFilter: 'blur(16px)',
              mb: 2.5,
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mb: 0.75,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 0.12,
                  }}
                >
                  Cari dokumen
                </Typography>
                <TextField
                  size="small"
                  placeholder="Cari kode / judul / deskripsi…"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: docSearch ? (
                      <InputAdornment position="end">
                        <Tooltip title="Bersihkan" arrow>
                          <IconButton size="small" onClick={() => setDocSearch('')}>
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      backgroundColor: (t) => (t.palette.mode === 'dark' ? 'rgba(2,6,23,0.55)' : '#f9fafb'),
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mb: 0.75,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 0.12,
                  }}
                >
                  Urutkan
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={docSort}
                  onChange={handleSortToggle}
                  aria-label="Urutkan berdasarkan tanggal"
                  sx={{
                    backgroundColor: (t) => (t.palette.mode === 'dark' ? 'rgba(2,6,23,0.55)' : '#f9fafb'),
                    borderRadius: 999,
                    '& .MuiToggleButton-root': {
                      border: 'none',
                      px: 1.5,
                      py: 0.45,
                      '&.Mui-selected': {
                        borderRadius: 999,
                        boxShadow: isDark
                          ? '0 0 0 1px rgba(129, 140, 248, 0.7)'
                          : '0 0 0 1px rgba(59, 130, 246, 0.6)',
                      },
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
              </Grid>

              <Grid item xs={12} md={2}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mb: 0.75,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 0.12,
                  }}
                >
                  Hasil
                </Typography>
                <Chip size="small" label={loading ? 'Memuat…' : `${visibleDocs.length} dokumen`} sx={{ borderRadius: 999 }} />
              </Grid>
            </Grid>
          </Paper>
        )}

        {!selectedDir && (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 750, mb: 1.25 }}>
              Kategori
            </Typography>
            <Grid container spacing={2.5}>
              {directories.map((dir) => {
                const count = directoryCounts[dir.key] || 0;
                const statLabel = dir.key === 'rekap' ? `${REKAP_FILES.length} jenis rekap` : `${count} dokumen`;

                return (
                  <Grid item xs={12} md={6} key={dir.key}>
                    <DirectoryCard dir={dir} statLabel={statLabel} onClick={() => handleDirectoryClick(dir)} />
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {selectedDir && (
          <Box sx={{ mt: 1.75 }}>
            <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ArrowBackIcon />}
                onClick={handleBackToDirectories}
                sx={{ borderRadius: 999, fontWeight: 650 }}
              >
                Kembali
              </Button>

              {selectedDir.key !== 'rekap' && (
                <Chip size="small" label={loading ? 'Memuat…' : `${visibleDocs.length} dokumen`} sx={{ borderRadius: 999 }} />
              )}
            </Box>

            {selectedDir.key === 'rekap' ? (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.25 }}>
                  Pilih jenis rekap
                </Typography>
                <Grid container spacing={2.5}>
                  {REKAP_FILES.map((rekap) => (
                    <Grid item xs={12} md={6} key={rekap.key}>
                      <Paper
                        elevation={0}
                        onClick={() => navigate(`/directory/${slug}/rekap/${rekap.key}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/directory/${slug}/rekap/${rekap.key}`);
                          }
                        }}
                        sx={{
                          p: 2.2,
                          borderRadius: 3,
                          cursor: 'pointer',
                          border: softBorder,
                          background: panelBg,
                          backdropFilter: 'blur(16px)',
                          transition: 'transform 0.16s ease, box-shadow 0.22s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: isDark ? '0 18px 44px rgba(0, 0, 0, 0.55)' : '0 16px 42px rgba(148, 163, 184, 0.55)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                          <Box
                            sx={{
                              width: 46,
                              height: 46,
                              borderRadius: 2.25,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: alpha('#60a5fa', isDark ? 0.22 : 0.18),
                              border: `1px solid ${alpha('#60a5fa', isDark ? 0.32 : 0.2)}`,
                            }}
                          >
                            <DescriptionOutlinedIcon />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 750, mb: 0.35 }}>
                                {rekap.label}
                              </Typography>
                              <ChevronRightRoundedIcon fontSize="small" />
                            </Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                              {rekap.description}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ) : loading ? (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 3,
                  border: softBorder,
                  background: panelBg,
                  backdropFilter: 'blur(16px)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Mengambil dokumen arsip…
                  </Typography>
                </Box>
              </Paper>
            ) : visibleDocs.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 3,
                  textAlign: 'center',
                  border: (t) =>
                    `1px dashed ${
                      t.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.55)' : 'rgba(148, 163, 184, 0.8)'
                    }`,
                  background: panelBg,
                  backdropFilter: 'blur(16px)',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.75 }}>
                  Belum ada dokumen di kategori ini
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto' }}>
                  Dokumen yang sudah diarsip untuk kategori ini akan muncul di sini.
                </Typography>
              </Paper>
            ) : (
              <Grid container spacing={2.25}>
                {visibleDocs.map((doc) => (
                  <Grid item xs={12} md={6} key={doc.id}>
                    <Paper
                      elevation={0}
                      onClick={() => navigate(`/directory/${slug}/${selectedDir.key}/preview/${doc.document_code}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/directory/${slug}/${selectedDir.key}/preview/${doc.document_code}`);
                        }
                      }}
                      sx={{
                        p: 2.2,
                        borderRadius: 3,
                        display: 'flex',
                        gap: 2,
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        border: softBorder,
                        background: panelBg,
                        backdropFilter: 'blur(16px)',
                        transition: 'transform 0.16s ease, box-shadow 0.22s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: isDark ? '0 18px 44px rgba(0, 0, 0, 0.55)' : '0 16px 42px rgba(148, 163, 184, 0.55)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: 2.25,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.14),
                          border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.32 : 0.2)}`,
                          flexShrink: 0,
                        }}
                      >
                        <DescriptionOutlinedIcon />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.35 }}>
                              {doc.document_code}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.6 }} noWrap>
                              {doc.title || '—'}
                            </Typography>
                          </Box>
                          <ChevronRightRoundedIcon fontSize="small" />
                        </Box>

                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
                          {formatDocType(doc.doc_type)} · {formatDate(doc.created_at)}
                        </Typography>

                        {doc.description ? (
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12, mt: 0.6 }} noWrap>
                            {doc.description}
                          </Typography>
                        ) : null}
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
