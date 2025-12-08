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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
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

function RekapPage() {
  const { companyName, rekapKey } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const slug = slugify(companyName || '');
  const fullName = companyFullNames[slug] || (companyName || '').toUpperCase();
  const companyCode = slug.replace(/^pt-/, '').replace(/^cv-/, '');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rekap, setRekap] = useState(null);

  const rekapLabel = rekap?.rekap_label || REKAP_LABELS[rekapKey] || 'Rekap';

  const handleRowClick = (rowIndex) => {
    if (!rekap || !rekap.meta || !rekap.meta[rowIndex]) return;
    const { document_code, section_index, row_index } = rekap.meta[rowIndex];

    if (!document_code) return;

    navigate(
      `/directory/${slug}/qlola/preview/${document_code}?section=${section_index}&row=${row_index}`
    );
  };

  const fetchRekap = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

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
  }, [companyCode, rekapKey, fromDate, toDate]);

  useEffect(() => {
    fetchRekap();
  }, [fetchRekap]);

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
              ? 'radial-gradient(circle at top left, #27326a 0, #060716 60%)'
              : 'linear-gradient(135deg, #eef3ff 0, #fdf7ff 70%)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2}>
            <TextField
              label="Dari tanggal"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Sampai tanggal"
              type="date"
              size="small"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              onClick={fetchRekap}
              disabled={loading}
              sx={{ borderRadius: 999, fontWeight: 600 }}
            >
              Terapkan
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              disabled={loading}
            >
              Reset
            </Button>
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
            border: (t) =>
              `1px solid ${t.palette.mode === 'dark' ? '#242b4b' : '#d4ddff'}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {rekap.total_rows} baris, total nominal Rp {formatIDR(rekap.total_amount || 0)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Periode:{' '}
              {rekap.from || rekap.to
                ? `${rekap.from || 'awal'} s/d ${rekap.to || 'sekarang'}`
                : 'semua waktu'}
            </Typography>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                {rekap.columns.map((col) => (
                  <TableCell
                    key={col}
                    sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rekap.rows.map((row, idx) => (
                <TableRow
                  key={idx}
                  hover
                  sx={{ cursor: rekap.meta && rekap.meta[idx] ? 'pointer' : 'default' }}
                  onClick={() => handleRowClick(idx)}
                >
                  {row.map((cell, cIdx) => (
                    <TableCell key={cIdx}>
                      {cIdx === rekap.columns.length - 1 && typeof cell === 'number'
                        ? formatIDR(cell)
                        : cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
