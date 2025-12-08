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
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
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
  'pt-ols': 'PT. OLS',
  'pt-olm': 'PT. OLM',
};

// Two high-level "folders" per company
const directories = [
  {
    key: 'qlola',
    label: 'Transaksi QLOLA',
    color: '#90caf9',
    docTypeFilter: 'tagihan_pekerjaan',
  },
  {
    key: 'rekap',
    label: 'Rekap',
    color: '#fbbf24',
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

  // Normalize the slug param to be safe (mirrors DirectoryPage)
  const slug = slugify(companyName || '');
  const fullName = companyFullNames[slug] || slug.toUpperCase();
  const selectedDir = directories.find((d) => d.key === dirKey) || null;

  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docSearch, setDocSearch] = useState('');
  const [docSort, setDocSort] = useState('newest'); // 'newest' | 'oldest'

  // Fetch archived, sudah_dibayar documents for this company
  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
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
    if (slug) {
      fetchDocs();
    }
  }, [slug]);

  // Docs to show for the current directory (only for real doc folders)
  const docsToDisplay = useMemo(() => {
    if (!selectedDir || !selectedDir.docTypeFilter) return [];
    return allDocs.filter((d) => d.doc_type === selectedDir.docTypeFilter);
  }, [allDocs, selectedDir]);

  // Count per directory (Rekap will always be 0, since it's virtual)
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

  // Apply search + sort for document view
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
      if (docSort === 'oldest') {
        return aTime - bTime;
      }
      return bTime - aTime; // newest first
    });

    return docs;
  }, [docsToDisplay, docSearch, docSort, selectedDir]);

  const handleDirectoryClick = (dir) => {
    navigate(`/directory/${slug}/${dir.key}`);
  };

  const handleBackToDirectories = () => {
    navigate(`/directory/${slug}`);
  };

  const handleSortToggle = (_event, value) => {
    if (value) {
      setDocSort(value);
    }
  };

  const companyCode = slug.replace(/^pt-/, '').replace(/^cv-/, '');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1.5, sm: 3, md: 6 },
        py: { xs: 3, sm: 4 },
      }}
    >
      {/* Breadcrumbs */}
      <Breadcrumbs sx={breadcrumbSx} separator=">">
        <Link component={RouterLink} underline="hover" color="inherit" to="/directory">
          Direktori
        </Link>
        <Typography color="text.primary">{fullName}</Typography>
        {selectedDir && <Typography color="text.primary">{selectedDir.label}</Typography>}
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
            {selectedDir ? (
              selectedDir.key === 'rekap'
                ? `Laporan rekap otomatis dari Transaksi QLOLA untuk ${fullName}.`
                : `Dokumen ${selectedDir.label.toLowerCase()} untuk ${fullName}.`
            ) : (
              `Pilih jenis transaksi untuk melihat dokumen yang sudah dibayar dan diarsipkan untuk ${fullName}.`
            )}
          </Typography>
        </Box>

        {/* Summary + search/sort (only for real document folders) */}
        {(!selectedDir || selectedDir.key !== 'rekap') && (
          <Paper
            elevation={0}
            sx={{
              px: 2.2,
              py: 1.4,
              borderRadius: 3,
              border: (t) =>
                `1px solid ${t.palette.mode === 'dark' ? '#28325b' : '#cbd5ff'}`,
              minWidth: 260,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Box>
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
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mb: 0.25 }}
                  >
                    {fullName}
                  </Typography>
                </Box>
                <FolderOpenIcon color="primary" />
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                <Chip
                  size="small"
                  label={
                    selectedDir
                      ? `${visibleDocs.length} dokumen`
                      : `${allDocs.length} dokumen diarsip`
                  }
                />
                {!selectedDir && (
                  <Chip
                    size="small"
                    label={`${directories.length} kategori`}
                  />
                )}
              </Box>

              {selectedDir && (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    size="small"
                    placeholder="Cari kode / judul…"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ flex: 1, minWidth: 140 }}
                  />
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={docSort}
                    onChange={handleSortToggle}
                    aria-label="Urutkan berdasarkan tanggal"
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
              )}
            </Box>
          </Paper>
        )}
      </Box>

      {/* No directory yet: show directory picker */}
      {!selectedDir && (
        <Grid container spacing={3}>
          {directories.map((dir) => {
            const count = directoryCounts[dir.key] || 0;
            return (
              <Grid item xs={12} sm={6} md={4} key={dir.key}>
                <Paper
                  onClick={() => handleDirectoryClick(dir)}
                  role="button"
                  tabIndex={0}
                  sx={{
                    p: 2.4,
                    borderRadius: 3,
                    cursor: 'pointer',
                    border: (t) =>
                      `1px solid ${
                        t.palette.mode === 'dark' ? '#2b355c' : '#d5defe'
                      }`,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: dir.color,
                      }}
                    >
                      <FolderOpenIcon sx={{ color: '#0b1025' }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
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
                          : 'Laporan rekap otomatis (misalnya BBM) yang bersumber dari transaksi QLOLA.'}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${count} dokumen`}
                        sx={{ borderRadius: 999 }}
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Directory selected */}
      {selectedDir && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<ArrowBackIcon />}
              onClick={handleBackToDirectories}
              sx={{ borderRadius: 999, fontWeight: 600 }}
            >
              Kembali ke daftar kategori
            </Button>
          </Box>

          {selectedDir.key === 'rekap' ? (
            // Rekap folder view
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 1.5 }}
              >
                Pilih jenis rekap:
              </Typography>
              <Grid container spacing={3}>
                {REKAP_FILES.map((rekap) => (
                  <Grid item xs={12} sm={6} md={4} key={rekap.key}>
                    <Paper
                      onClick={() =>
                        navigate(`/directory/${slug}/rekap/${rekap.key}`)
                      }
                      role="button"
                      tabIndex={0}
                      sx={{
                        p: 2.4,
                        borderRadius: 3,
                        cursor: 'pointer',
                        border: (t) =>
                          `1px solid ${
                            t.palette.mode === 'dark' ? '#2b355c' : '#d5defe'
                          }`,
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#e5ecff',
                          }}
                        >
                          <DescriptionOutlinedIcon />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600, mb: 0.25 }}
                          >
                            {rekap.label}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary' }}
                          >
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
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 0.75 }}
              >
                Belum ada dokumen di kategori ini
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', maxWidth: 460, mx: 'auto' }}
              >
                Dokumen yang sudah diarsip untuk kategori ini akan muncul di
                sini.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {visibleDocs.map((doc) => (
                <Grid item xs={12} md={6} key={doc.id}>
                  <Paper
                    sx={{
                      p: 2.4,
                      borderRadius: 3,
                      display: 'flex',
                      gap: 2,
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      navigate(
                        `/directory/${slug}/${selectedDir.key}/preview/${doc.document_code}`
                      )
                    }
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#e5ecff',
                      }}
                    >
                      <DescriptionOutlinedIcon />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, mb: 0.4 }}
                      >
                        {doc.document_code}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mb: 0.5 }}
                      >
                        {doc.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', fontSize: 12 }}
                      >
                        {formatDocType(doc.doc_type)} · {formatDate(doc.created_at)}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
