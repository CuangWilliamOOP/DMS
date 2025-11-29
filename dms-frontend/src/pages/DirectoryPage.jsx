// File: src/pages/DirectoryPage.jsx

import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Stack,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import API from '../services/api'; // NEW: use live data 

// Static company metadata (UI-only; stats are filled dynamically)
const BASE_COMPANIES = [
  {
    code: 'asn',
    name: 'CV. ASN',
    type: 'CV',
    color: '#f97316',
    initials: 'ASN',
    city: 'Pekanbaru',
    segment: 'Kontraktor Alat Berat',
  },
  {
    code: 'ttu',
    name: 'PT. TTU',
    type: 'PT',
    color: '#3b82f6',
    initials: 'TTU',
    city: 'Pekanbaru',
    segment: 'Kontraktor Alat Berat',
  },
  {
    code: 'ols',
    name: 'PT. OLS',
    type: 'PT',
    color: '#22c55e',
    initials: 'OLS',
    city: 'Pekanbaru',
    segment: 'Perkebunan Kelapa Sawit',
  },
  {
    code: 'olm',
    name: 'PT. OLM',
    type: 'PT',
    color: '#a855f7',
    initials: 'OLM',
    city: 'Pekanbaru',
    segment: 'Perkebunan Kelapa Sawit',
  },
];

// Slug for routing: remove dots, collapse spaces to hyphen
const slugify = (name) =>
  name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatLastActivity(date) {
  if (!date) return '-';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

  if (diffDays <= 0) return 'Hari ini';
  if (diffDays === 1) return '1 hari lalu';
  if (diffDays < 7) return `${diffDays} hari lalu`;

  const weeks = Math.round(diffDays / 7);
  if (weeks <= 1) return '1 minggu lalu';
  return `${weeks} minggu lalu`;
}

function DirectoryPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const isDark = theme.palette.mode === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  // Dynamic company stats (start with zeros)
  const [companies, setCompanies] = useState(
    BASE_COMPANIES.map((c) => ({
      ...c,
      documentsCount: 0,
      lastActivity: null,
    }))
  );

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await API.get('/documents/'); // includes archived + status etc. 
        const docs = Array.isArray(res.data) ? res.data : [];

        // Only count docs that are archived + already paid (same as CompanyDirectoryPage) 
        const archivedDocs = docs.filter(
          (d) => d.archived && d.status === 'sudah_dibayar'
        );

        const statsByCompany = {};

        archivedDocs.forEach((doc) => {
          const code = (doc.company || '').toLowerCase(); // 'asn', 'ttu', etc. 
          if (!code) return;

          if (!statsByCompany[code]) {
            statsByCompany[code] = { count: 0, lastDate: null };
          }
          statsByCompany[code].count += 1;

          const ts =
            doc.archived_at ||
            doc.paid_at ||
            doc.updated_at ||
            doc.created_at;
          if (!ts) return;

          const dt = new Date(ts);
          if (!statsByCompany[code].lastDate || dt > statsByCompany[code].lastDate) {
            statsByCompany[code].lastDate = dt;
          }
        });

        setCompanies(
          BASE_COMPANIES.map((base) => {
            const stat = statsByCompany[base.code] || {
              count: 0,
              lastDate: null,
            };
            return {
              ...base,
              documentsCount: stat.count,
              lastActivity:
                stat.count === 0
                  ? 'Belum ada dokumen'
                  : formatLastActivity(stat.lastDate),
            };
          })
        );
      } catch (err) {
        console.error('Error fetching directory stats:', err);
        // On error, keep zeros and null lastActivity
      }
    };

    fetchStats();
  }, []);

  const totalCompanies = companies.length;
  const totalDocuments = companies.reduce(
    (sum, c) => sum + (c.documentsCount || 0),
    0
  );

  const filteredCompanies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return companies
      .filter((company) => {
        if (typeFilter !== 'all' && company.type !== typeFilter) return false;
        if (!term) return true;

        const haystack = [
          company.name,
          company.initials,
          company.city,
          company.segment,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, searchTerm, typeFilter]);

  const handleCompanyClick = (company) => {
    navigate(`/directory/${slugify(company.name)}`);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
  };

  const handleViewModeChange = (_event, newView) => {
    if (newView) setViewMode(newView);
  };

  const resultLabel =
    filteredCompanies.length === totalCompanies
      ? `${filteredCompanies.length} perusahaan`
      : `${filteredCompanies.length} dari ${totalCompanies} perusahaan`;

  const headerAccent = isDark
    ? 'rgba(90, 129, 255, 0.2)'
    : 'rgba(37, 99, 235, 0.08)';

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          px: { xs: 1.5, sm: 2, md: 4 },
          py: { xs: 3, md: 5 },
          pt: 1,
          position: 'relative',
        }}
      >
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Box
            sx={{
              maxWidth: 1100,
              mx: 'auto',
              mb: 3,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, mb: 0.5, letterSpacing: 0.1 }}
              >
                Direktori Perusahaan
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', maxWidth: 540 }}
              >
                Temukan seluruh dokumen yang sudah diselesaikan berdasarkan
                entitas perusahaan. Gunakan pencarian dan filter untuk
                menyempitkan hasil.
              </Typography>
            </Box>

            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1.2,
                borderRadius: 3,
                border: (t) =>
                  `1px solid ${
                    t.palette.mode === 'dark'
                      ? '#242b4f'
                      : 'rgba(148, 163, 184, 0.35)'
                  }`,
                background: (t) =>
                  t.palette.mode === 'dark'
                    ? 'radial-gradient(circle at top, #1d2a57 0, #060716 55%)'
                    : 'linear-gradient(135deg, #eef3ff 0, #fef6ff 70%)',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  textTransform: 'uppercase',
                  letterSpacing: 0.08,
                  color: 'text.secondary',
                }}
              >
                Ringkasan
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {totalCompanies}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    Perusahaan
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {totalDocuments}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    Dokumen diarsip
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        </motion.div>

        {/* Filters + tools */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.04 }}
        >
          <Box sx={{ maxWidth: 1100, mx: 'auto', mb: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.75, md: 2 },
                borderRadius: 3,
                border: (t) =>
                  `1px solid ${
                    t.palette.mode === 'dark'
                      ? '#242b4f'
                      : 'rgba(148, 163, 184, 0.35)'
                  }`,
                background: (t) =>
                  t.palette.mode === 'dark'
                    ? 'rgba(11, 15, 32, 0.95)'
                    : 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={{ xs: 1.75, md: 2 }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
              >
                {/* Search */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
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
                    Cari perusahaan
                  </Typography>
                  <TextField
                    placeholder="Nama, inisial, kota, atau segmen…"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: searchTerm ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setSearchTerm('')}
                            aria-label="Bersihkan pencarian"
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2.5,
                        backgroundColor: (t) =>
                          t.palette.mode === 'dark' ? '#050817' : '#f9fafb',
                      },
                    }}
                  />
                </Box>

                {/* Right side tools */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="flex-end"
                >
                  {/* Type filter chips */}
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mb: 0.5,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: 0.12,
                      }}
                    >
                      Filter
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip
                        size="small"
                        icon={<FilterAltOutlinedIcon sx={{ fontSize: 16 }} />}
                        label="Semua"
                        onClick={() => setTypeFilter('all')}
                        variant={
                          typeFilter === 'all' ? 'filled' : 'outlined'
                        }
                        sx={{
                          fontWeight: 500,
                          borderRadius: 999,
                          backgroundColor:
                            typeFilter === 'all' ? headerAccent : 'transparent',
                        }}
                      />
                      <Chip
                        size="small"
                        label="PT"
                        onClick={() => setTypeFilter('PT')}
                        variant={typeFilter === 'PT' ? 'filled' : 'outlined'}
                        sx={{
                          fontWeight: 500,
                          borderRadius: 999,
                          backgroundColor:
                            typeFilter === 'PT' ? headerAccent : 'transparent',
                        }}
                      />
                      <Chip
                        size="small"
                        label="CV"
                        onClick={() => setTypeFilter('CV')}
                        variant={typeFilter === 'CV' ? 'filled' : 'outlined'}
                        sx={{
                          fontWeight: 500,
                          borderRadius: 999,
                          backgroundColor:
                            typeFilter === 'CV' ? headerAccent : 'transparent',
                        }}
                      />
                    </Stack>
                  </Box>

                  {/* View toggle */}
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mb: 0.5,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: 0.12,
                      }}
                    >
                      Tampilan
                    </Typography>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={viewMode}
                      onChange={handleViewModeChange}
                      aria-label="Mode tampilan direktori"
                      sx={{
                        backgroundColor: (t) =>
                          t.palette.mode === 'dark' ? '#050817' : '#f9fafb',
                        borderRadius: 999,
                        '& .MuiToggleButton-root': {
                          border: 'none',
                          px: 1.5,
                          py: 0.4,
                          '&.Mui-selected': {
                            borderRadius: 999,
                            boxShadow: isDark
                              ? '0 0 0 1px rgba(129, 140, 248, 0.7)'
                              : '0 0 0 1px rgba(59, 130, 246, 0.6)',
                          },
                        },
                      }}
                    >
                      <ToggleButton value="grid" aria-label="Tampilan kartu">
                        <ViewModuleIcon fontSize="small" />
                      </ToggleButton>
                      <ToggleButton value="list" aria-label="Tampilan daftar">
                        <ViewListIcon fontSize="small" />
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {/* Clear button + result text */}
                  <Stack
                    direction="column"
                    spacing={0.5}
                    alignItems={isMdUp ? 'flex-end' : 'flex-start'}
                  >
                    <Tooltip title="Reset pencarian dan filter">
                      <IconButton
                        size="small"
                        onClick={handleClearFilters}
                        sx={{
                          alignSelf: isMdUp ? 'flex-end' : 'flex-start',
                          borderRadius: 999,
                          border: (t) =>
                            `1px solid ${
                              t.palette.mode === 'dark'
                                ? 'rgba(148, 163, 184, 0.5)'
                                : 'rgba(148, 163, 184, 0.8)'
                            }`,
                          p: 0.5,
                        }}
                      >
                        <ClearIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary' }}
                    >
                      {resultLabel}
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        </motion.div>

        {/* Results */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
        >
          <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
            {filteredCompanies.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 3,
                  border: (t) =>
                    `1px dashed ${
                      t.palette.mode === 'dark'
                        ? 'rgba(148, 163, 184, 0.6)'
                        : 'rgba(148, 163, 184, 0.8)'
                    }`,
                  backgroundColor: (t) =>
                    t.palette.mode === 'dark'
                      ? 'rgba(15, 23, 42, 0.9)'
                      : 'rgba(255, 255, 255, 0.95)',
                  textAlign: 'center',
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 0.5 }}
                >
                  Tidak ada perusahaan yang cocok
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', mb: 1.5 }}
                >
                  Coba kurangi kata kunci, pilih tipe perusahaan berbeda, atau
                  reset filter.
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleClearFilters}
                  sx={{
                    borderRadius: 999,
                    px: 2,
                    border: (t) =>
                      `1px solid ${
                        t.palette.mode === 'dark'
                          ? 'rgba(96, 165, 250, 0.7)'
                          : 'rgba(37, 99, 235, 0.8)'
                      }`,
                  }}
                >
                  <Typography
                    variant="button"
                    sx={{
                      fontSize: 11,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Reset filter
                  </Typography>
                </IconButton>
              </Paper>
            ) : viewMode === 'grid' ? (
              <Grid container spacing={2.5}>
                {filteredCompanies.map((company, index) => (
                  <Grid item xs={12} sm={6} md={3} key={company.name}>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.04 }}
                    >
                      <Paper
                        elevation={0}
                        onClick={() => handleCompanyClick(company)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCompanyClick(company);
                          }
                        }}
                        aria-label={`Buka direktori ${company.name}`}
                        sx={{
                          position: 'relative',
                          p: 2.2,
                          borderRadius: 3,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          border: (t) =>
                            `1px solid ${
                              t.palette.mode === 'dark'
                                ? 'rgba(51, 65, 85, 0.9)'
                                : 'rgba(148, 163, 184, 0.7)'
                            }`,
                          background: (t) =>
                            t.palette.mode === 'dark'
                              ? 'radial-gradient(circle at top left, #1e293b 0, #020617 60%)'
                              : 'linear-gradient(135deg, #f9fafb 0, #eef2ff 60%)',
                          '&:hover': {
                            boxShadow: (t) =>
                              t.palette.mode === 'dark'
                                ? '0 16px 40px rgba(15, 23, 42, 0.9)'
                                : '0 16px 42px rgba(148, 163, 184, 0.6)',
                            transform: 'translateY(-2px)',
                            '& .company-accent': {
                              transform: 'scale(1.05)',
                              opacity: 1,
                            },
                          },
                          transition:
                            'transform 0.18s ease, box-shadow 0.22s ease, border-color 0.18s ease',
                        }}
                      >
                        {/* Accent blob */}
                        <Box
                          className="company-accent"
                          sx={{
                            position: 'absolute',
                            inset: '-40%',
                            opacity: isDark ? 0.12 : 0.16,
                            background: `radial-gradient(circle at top, ${company.color} 0, transparent 60%)`,
                            transform: 'scale(1.02)',
                            transition:
                              'transform 0.18s ease, opacity 0.18s ease',
                            pointerEvents: 'none',
                          }}
                        />

                        <Box
                          sx={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.75,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1.5,
                            }}
                          >
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                border: `2px solid ${company.color}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 700, color: '#f9fafb' }}
                              >
                                {company.initials}
                              </Typography>
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="subtitle1"
                                noWrap
                                sx={{ fontWeight: 600 }}
                              >
                                {company.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'text.secondary',
                                  lineHeight: 1.3,
                                  display: 'block',
                                }}
                              >
                                {company.city} · {company.segment}
                              </Typography>
                            </Box>

                            <Chip
                              size="small"
                              label={company.type}
                              sx={{
                                fontWeight: 600,
                                fontSize: 11,
                                borderRadius: 999,
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                color: '#e5e7eb',
                                border: `1px solid ${company.color}`,
                              }}
                            />
                          </Box>

                          <Divider
                            sx={{
                              borderColor: 'rgba(148, 163, 184, 0.4)',
                              my: 0.5,
                            }}
                          />

                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-end',
                              justifyContent: 'space-between',
                              gap: 1.5,
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, lineHeight: 1.2 }}
                              >
                                {company.documentsCount} dokumen
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary', mt: 0.25 }}
                              >
                                Aktivitas terakhir:{' '}
                                {company.documentsCount
                                  ? company.lastActivity
                                  : 'Belum ada dokumen'}
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              sx={{
                                borderRadius: 999,
                                border:
                                  '1px solid rgba(148, 163, 184, 0.8)',
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              }}
                            >
                              <ArrowForwardIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                        </Box>
                      </Paper>
                    </motion.div>
                  </Grid>
                ))}
              </Grid>
            ) : (
              // List view
              <Stack spacing={1.5}>
                {filteredCompanies.map((company, index) => (
                  <motion.div
                    key={company.name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: index * 0.04 }}
                  >
                    <Paper
                      elevation={0}
                      onClick={() => handleCompanyClick(company)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCompanyClick(company);
                        }
                      }}
                      aria-label={`Buka direktori ${company.name}`}
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderRadius: 2.5,
                        cursor: 'pointer',
                        border: (t) =>
                          `1px solid ${
                            t.palette.mode === 'dark'
                              ? 'rgba(51, 65, 85, 0.9)'
                              : 'rgba(148, 163, 184, 0.7)'
                          }`,
                        backgroundColor: (t) =>
                          t.palette.mode === 'dark'
                            ? 'rgba(15, 23, 42, 0.98)'
                            : 'rgba(255, 255, 255, 0.98)',
                        '&:hover': {
                          backgroundColor: (t) =>
                            t.palette.mode === 'dark'
                              ? 'rgba(15, 23, 42, 1)'
                              : 'rgba(249, 250, 251, 1)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 2,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            minWidth: 0,
                          }}
                        >
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              backgroundColor: company.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: '#020617',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {company.initials}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="body1"
                              noWrap
                              sx={{ fontWeight: 600 }}
                            >
                              {company.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                lineHeight: 1.3,
                                display: 'block',
                              }}
                            >
                              {company.city} · {company.segment}
                            </Typography>
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            flexShrink: 0,
                          }}
                        >
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, lineHeight: 1.2 }}
                            >
                              {company.documentsCount} dokumen
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary' }}
                            >
                              {company.type} ·{' '}
                              {company.documentsCount
                                ? company.lastActivity
                                : 'Belum ada dokumen'}
                            </Typography>
                          </Box>
                          <IconButton
                            size="small"
                            sx={{
                              borderRadius: 999,
                              border:
                                '1px solid rgba(148, 163, 184, 0.8)',
                            }}
                          >
                            <ArrowForwardIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    </Paper>
                  </motion.div>
                ))}
              </Stack>
            )}
          </Box>
        </motion.div>
      </Box>
    </>
  );
}

export default DirectoryPage;
