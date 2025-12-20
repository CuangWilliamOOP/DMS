// File: src/pages/RekapPage.jsx

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Stack,
  Chip,
  Divider,
  TableContainer,
  TablePagination,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import API from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const slugify = (name = '') =>
  name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

const companyFullNames = {
  'cv-asn': 'CV. Alam Subur Nusantara',
  'pt-ttu': 'PT. Tunggal Tunggul Unggul',
  'pt-ols': 'PT. Ostor Lumbanbanjar Sejahtera',
  'pt-olm': 'PT. Ostor Lumbanbanjar Makmur',
};

const REKAP_LABELS = {
  bbm: 'Rekap BBM',
};

const formatIDR = (value) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0);

const toISODateLocal = (d) => {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const rangeLastDays = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: toISODateLocal(start), to: toISODateLocal(end) };
};

const rangeThisMonth = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISODateLocal(start), to: toISODateLocal(now) };
};

function RekapPage() {
  const { companyName, rekapKey } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const slug = slugify(companyName || '');
  const fullName = companyFullNames[slug] || (companyName || '').toUpperCase();
  const companyCode = slug.replace(/^pt-/, '').replace(/^cv-/, '');

  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [query, setQuery] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rekap, setRekap] = useState(null);

  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const rekapLabel = rekap?.rekap_label || REKAP_LABELS[rekapKey] || 'Rekap';

  const handleRowClick = (rowIndex) => {
    if (!rekap || !rekap.meta || !rekap.meta[rowIndex]) return;
    const { document_code, section_index, row_index, ref_code } = rekap.meta[rowIndex];

    if (!document_code) return;

    const params = new URLSearchParams();
    params.set('section', section_index);
    params.set('row', row_index);
    if (ref_code) params.set('ref', ref_code);

    navigate(
      `/directory/${slug}/qlola/preview/${document_code}?${params.toString()}`
    );
  };

  const fetchRekap = useCallback(
    async (q) => {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (q?.from) params.from = q.from;
        if (q?.to) params.to = q.to;

        const res = await API.get(`/rekap/${companyCode}/${rekapKey}/`, { params });
        setRekap(res.data);
      } catch (err) {
        console.error(err);
        const detail =
          err?.response?.data?.detail || 'Gagal memuat data rekap. Silakan coba lagi.';
        setError(detail);
        setRekap(null);
      } finally {
        setLoading(false);
      }
    },
    [companyCode, rekapKey]
  );

  useEffect(() => {
    fetchRekap(query);
  }, [fetchRekap, query.from, query.to]);

  const handleApply = () => {
    if (fromDraft && toDraft && fromDraft > toDraft) {
      setError("Tanggal 'Dari' tidak boleh setelah 'Sampai'.");
      return;
    }
    setQuery({ from: fromDraft, to: toDraft });
  };

  const handleResetFilters = () => {
    setFromDraft('');
    setToDraft('');
    setQuery({ from: '', to: '' });
    setError('');
    setTableSearch('');
  };

  const idxNominal = (rekap?.columns || []).findIndex(
    (c) => String(c).toLowerCase() === 'nominal'
  );
  const idxLiter = (rekap?.columns || []).findIndex(
    (c) => String(c).toLowerCase().includes('liter')
  );

  const rowItems = React.useMemo(() => {
    const rows = rekap?.rows || [];
    const term = tableSearch.trim().toLowerCase();

    const items = rows.map((row, idx) => ({ row, idx }));
    if (!term) return items;

    return items.filter(({ row }) =>
      (row || []).some((cell) => String(cell ?? '').toLowerCase().includes(term))
    );
  }, [rekap, tableSearch]);

  React.useEffect(() => {
    setPage(0);
  }, [tableSearch, rekap]);

  const paged = React.useMemo(() => {
    const start = page * rowsPerPage;
    return rowItems.slice(start, start + rowsPerPage);
  }, [rowItems, page, rowsPerPage]);

  const visibleAmount = React.useMemo(() => {
    if (!rowItems.length || idxNominal === -1) return 0;
    return rowItems.reduce((sum, { row }) => {
      const v = row?.[idxNominal];
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);
  }, [rowItems, idxNominal]);

  const formatCell = (cell, cIdx) => {
    if (cell === null || cell === undefined || cell === '') return '—';
    if (cIdx === idxNominal && typeof cell === 'number') return `Rp ${formatIDR(cell)}`;
    if (cIdx === idxLiter && typeof cell === 'number') return `${cell.toLocaleString('id-ID')} L`;
    return String(cell);
  };

  const handleBack = () => {
    navigate(`/directory/${slug}/rekap`);
  };

  const handleDownloadPdf = () => {
    if (!rekap || !rekap.rows || !rekap.rows.length) return;

    const doc = new jsPDF('l', 'pt', 'a4'); // landscape A4
    const marginLeft = 40;
    let currentY = 40;

    doc.setFontSize(14);
    doc.text(rekapLabel, marginLeft, currentY);

    doc.setFontSize(10);
    currentY += 18;
    const periodText =
      rekap.from || rekap.to
        ? `Periode: ${rekap.from || 'awal'} s/d ${rekap.to || 'sekarang'}`
        : 'Periode: semua waktu';
    doc.text(periodText, marginLeft, currentY);

    currentY += 14;
    const summaryText = `Total baris: ${rekap.total_rows || 0}   |   Total nominal: Rp ${formatIDR(
      rekap.total_amount || 0,
    )}`;
    doc.text(summaryText, marginLeft, currentY);

    const body = (rekap.rows || []).map((row) =>
      row.map((cell, idx) => {
        if (idx === rekap.columns.length - 1 && typeof cell === 'number') {
          return formatIDR(cell);
        }
        if (cell === null || cell === undefined) return '';
        return String(cell);
      }),
    );

    autoTable(doc, {
      head: [rekap.columns],
      body,
      startY: currentY + 20,
      styles: {
        fontSize: 8,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [36, 64, 147],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: isDark ? [20, 24, 48] : [245, 248, 255],
      },
      theme: 'striped',
    });

    const safeFrom = rekap.from || 'awal';
    const safeTo = rekap.to || 'sekarang';
    const fileName = `rekap-${rekap.rekap_key || rekapKey}-${companyCode}-${safeFrom}-${safeTo}.pdf`;
    doc.save(fileName);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1.5, sm: 3, md: 6 },
        py: { xs: 3, sm: 4 },
        background: (t) =>
          t.palette.mode === 'dark'
            ? '#050814'
            : 'radial-gradient(circle at top, #eef3ff 0, #dde7ff 45%, #c4d6ff 100%)',
      }}
    >
      <Breadcrumbs
        sx={{
          mb: 2.5,
          fontSize: { xs: '0.96rem', sm: '1.05rem', md: '1.15rem' },
          '& a, & .MuiTypography-root': { fontWeight: 600 },
        }}
        separator=">"
      >
        <Link component={RouterLink} underline="hover" to="/directory">
          Direktori
        </Link>
        <Link
          component={RouterLink}
          underline="hover"
          to={`/directory/${slug}`}
        >
          {fullName}
        </Link>
        <Link
          component={RouterLink}
          underline="hover"
          to={`/directory/${slug}/rekap`}
        >
          Rekap
        </Link>
        <Typography color="text.primary">{rekapLabel}</Typography>
      </Breadcrumbs>

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
            {rekapLabel}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', maxWidth: 520 }}
          >
            Laporan rekap otomatis dari transaksi QLOLA untuk {fullName}. Pilih
            periode waktu lalu tekan "Terapkan".
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleBack}
            startIcon={<ArrowBackIcon />}
            sx={{
              borderRadius: 999,
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: isDark ? '#171c3a' : '#f1f4ff',
              '&:hover': {
                backgroundColor: isDark ? '#1f2446' : '#e0e7ff',
              },
            }}
          >
            Kembali ke folder Rekap
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPdf}
            disabled={!rekap || !rekap.rows || !rekap.rows.length || loading}
            sx={{
              borderRadius: 999,
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            Download PDF
          </Button>
        </Stack>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: 3,
          border: (t) =>
            `1px solid ${t.palette.mode === 'dark' ? '#242b4b' : '#d4ddff'}`,
          background: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(10, 12, 18, 0.66)'
              : 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          {/* Left: date range + quick chips */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
            <TextField
              label="Dari tanggal"
              type="date"
              size="small"
              value={fromDraft}
              onChange={(e) => setFromDraft(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Sampai tanggal"
              type="date"
              size="small"
              value={toDraft}
              onChange={(e) => setToDraft(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label="7 hari"
                onClick={() => {
                  const r = rangeLastDays(7);
                  setFromDraft(r.from);
                  setToDraft(r.to);
                }}
              />
              <Chip
                size="small"
                label="30 hari"
                onClick={() => {
                  const r = rangeLastDays(30);
                  setFromDraft(r.from);
                  setToDraft(r.to);
                }}
              />
              <Chip
                size="small"
                label="Bulan ini"
                onClick={() => {
                  const r = rangeThisMonth();
                  setFromDraft(r.from);
                  setToDraft(r.to);
                }}
              />
            </Stack>
          </Stack>

          {/* Right: search + actions */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
            <TextField
              size="small"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Cari kode / keterangan / vendor…"
              sx={{ minWidth: { xs: '100%', sm: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: tableSearch ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setTableSearch('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />

            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                onClick={handleApply}
                disabled={loading}
                sx={{ borderRadius: 999, fontWeight: 700 }}
              >
                Terapkan
              </Button>
              <Button variant="text" onClick={handleResetFilters} disabled={loading}>
                Reset
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Paper
          sx={{
            p: 2,
            borderRadius: 3,
            border: (t) => `1px solid ${t.palette.error.light}`,
            mb: 2,
          }}
        >
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Paper>
      )}

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
            Mengambil data rekap…
          </Typography>
        </Box>
      ) : rekap && rekap.rows && rekap.rows.length > 0 ? (
        <Paper
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: (t) => `1px solid ${t.palette.mode === 'dark' ? '#242b4b' : '#d4ddff'}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2,
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {tableSearch
                  ? `${rowItems.length} dari ${rekap.total_rows} baris`
                  : `${rekap.total_rows} baris`}{' '}
                • total Rp {formatIDR(visibleAmount)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                Klik baris untuk membuka dokumen terkait (jika tersedia).
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={
                  rekap.from || rekap.to
                    ? `Periode: ${rekap.from || 'awal'} s/d ${rekap.to || 'sekarang'}`
                    : 'Periode: semua waktu'
                }
              />
            </Stack>
          </Box>

          <Divider sx={{ mb: 1.5 }} />

          <TableContainer sx={{ maxHeight: 560, borderRadius: 2 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {rekap.columns.map((col) => (
                    <TableCell key={col} sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {col}
                    </TableCell>
                  ))}
                  <TableCell sx={{ width: 52 }} />
                </TableRow>
              </TableHead>

              <TableBody>
                {paged.map(({ row, idx }) => {
                  const canOpen = !!rekap?.meta?.[idx]?.document_code;

                  return (
                    <TableRow
                      key={idx}
                      hover
                      onClick={() => {
                        if (canOpen) handleRowClick(idx);
                      }}
                      sx={{
                        cursor: canOpen ? 'pointer' : 'default',
                        '&:hover': {
                          backgroundColor: (t) =>
                            canOpen
                              ? t.palette.mode === 'dark'
                                ? 'rgba(59, 130, 246, 0.10)'
                                : 'rgba(59, 130, 246, 0.06)'
                              : undefined,
                        },
                      }}
                    >
                      {row.map((cell, cIdx) => {
                        const isNumeric = cIdx === idxNominal || cIdx === idxLiter;
                        const isLongText =
                          String(rekap.columns?.[cIdx] || '').toLowerCase() === 'keterangan';

                        return (
                          <TableCell
                            key={cIdx}
                            align={isNumeric ? 'right' : 'left'}
                            sx={{
                              whiteSpace: isLongText ? 'normal' : 'nowrap',
                              maxWidth: isLongText ? 520 : undefined,
                            }}
                          >
                            {formatCell(cell, cIdx)}
                          </TableCell>
                        );
                      })}

                      <TableCell align="right">
                        {canOpen ? (
                          <Tooltip title="Buka dokumen">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(idx);
                              }}
                            >
                              <ArrowForwardIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={rowItems.length}
            page={page}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Baris per halaman"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} dari ${count}`}
          />
        </Paper>
      ) : (
        <Paper
          sx={{
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            border: (t) =>
              `1px dashed ${t.palette.mode === 'dark' ? '#4b567f' : '#c9d4ff'}`,
            background: (t) =>
              t.palette.mode === 'dark' ? '#0b1021' : '#f8f9ff',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 0.75 }}
          >
            Belum ada data rekap untuk filter ini
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', maxWidth: 460, mx: 'auto' }}
          >
            Coba ubah periode tanggal, atau pastikan sudah ada transaksi QLOLA
            yang mengandung kata kunci BBM / solar.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default RekapPage;
