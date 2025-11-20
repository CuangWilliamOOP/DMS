// File: src/pages/DocumentPreviewPage.jsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Breadcrumbs,
  Link,
  Button,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import API from '../services/api';
import { useTheme } from '@mui/material/styles';
import { ItemDocsPreview } from '../components/DocumentTableParts';
import PaymentProofTab from '../components/PaymentProofTab';

// ----- Helpers ---------------------------------------------------------

const indoDate = (dt) =>
  dt
    ? new Date(dt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '-';

const indoDateTime = (dt) =>
  dt
    ? new Date(dt).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const sortBySeq = (arr = []) =>
  [...arr].sort((a, b) => a.supporting_doc_sequence - b.supporting_doc_sequence);

const DOC_TYPE_LABELS = {
  ledger_lokasi: 'Ledger per Lokasi',
  tagihan_pekerjaan: 'Tagihan Pekerjaan (BAPP)',
  pembayaran_pekerjaan: 'Pembayaran Pekerjaan (BAPP)',
  pembelian_sparepart: 'Pembelian Sparepart',
  penggantian_kas_kantor: 'Penggantian Kas Kantor',
  biaya_pengeluaran_proyek: 'Biaya Pengeluaran Proyek',
};

const STATUS_LABELS = {
  draft: 'Draft',
  belum_disetujui: 'Belum Disetujui',
  disetujui: 'Disetujui',
  rejected: 'Ditolak',
  sudah_dibayar: 'Sudah Dibayar',
};

const STATUS_CHIP_STYLES = {
  draft: { bg: 'rgba(148, 163, 184, 0.18)', color: '#475569' },
  belum_disetujui: { bg: 'rgba(250, 204, 21, 0.22)', color: '#854d0e' },
  disetujui: { bg: 'rgba(34, 197, 94, 0.22)', color: '#166534' },
  rejected: { bg: 'rgba(248, 113, 113, 0.24)', color: '#b91c1c' },
  sudah_dibayar: { bg: 'rgba(59, 130, 246, 0.24)', color: '#1d4ed8' },
};

const COMPANY_NAME_BY_SLUG = {
  'cv-asn': 'CV. Alam Subur Nusantara',
  'pt-ttu': 'PT. Tunggal Tunggul Unggul',
  'pt-ols': 'PT. OLS',
  'pt-olm': 'PT. OLM',
};

const COMPANY_NAME_BY_CODE = {
  ttu: 'PT. Tunggal Tunggul Unggul',
  asn: 'CV. Alam Subur Nusantara',
  ols: 'PT. OLS',
  olm: 'PT. OLM',
};

// ----- Per-row tabs (Dokumen Pendukung / Bukti Pembayaran) -------------

function PreviewTabs({ docsForRow, docId, docStatus, sectionIndex, itemIndex }) {
  const [tab, setTab] = useState('supportingDocs');

  return (
    <Box sx={{ mt: 1.75 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mb: 1.25,
          px: 0.5,
          borderRadius: 999,
          backgroundColor: 'rgba(15, 23, 42, 0.04)',
        }}
      >
        <Button
          disableElevation
          size="small"
          variant="text"
          onClick={() => setTab('supportingDocs')}
          sx={{
            flex: 1,
            fontWeight: 500,
            fontSize: '0.85rem',
            textTransform: 'none',
            borderRadius: 999,
            px: 1.25,
            py: 0.6,
            minWidth: 0,
            ...(tab === 'supportingDocs'
              ? {
                  backgroundColor: 'rgba(37, 99, 235, 0.12)',
                  color: 'primary.main',
                }
              : {
                  color: 'text.secondary',
                }),
          }}
        >
          Dokumen Pendukung
        </Button>
        <Button
          disableElevation
          size="small"
          variant="text"
          onClick={() => setTab('paymentProof')}
          sx={{
            flex: 1,
            fontWeight: 500,
            fontSize: '0.85rem',
            textTransform: 'none',
            borderRadius: 999,
            px: 1.25,
            py: 0.6,
            minWidth: 0,
            ...(tab === 'paymentProof'
              ? {
                  backgroundColor: 'rgba(37, 99, 235, 0.12)',
                  color: 'primary.main',
                }
              : {
                  color: 'text.secondary',
                }),
          }}
        >
          Bukti Pembayaran
        </Button>
      </Stack>

      {tab === 'supportingDocs' ? (
        <ItemDocsPreview
          itemDocs={docsForRow}
          mainDocumentId={docId}
          userRole="preview"
          mainDocStatus={docStatus}
          sectionIndex={sectionIndex}
          itemIndex={itemIndex}
          handleDeleteSupportingClick={() => {}}
          onDocApproved={() => {}}
          readOnly
        />
      ) : (
        <PaymentProofTab
          document={{ id: docId }}
          sectionIndex={sectionIndex}
          itemIndex={itemIndex}
          readOnly
        />
      )}
    </Box>
  );
}

function LazyPreviewTabs(props) {
  const [visible, setVisible] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? <PreviewTabs {...props} /> : <div style={{ height: 420 }} />}
    </div>
  );
}

// ----- Page component ---------------------------------------------------

export default function DocumentPreviewPage() {
  const { companyName, dirKey, docCode } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [doc, setDoc] = useState(null);
  const [support, setSupport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!docCode) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    API.get(`/documents/by-code/${docCode}/`)
      .then((res) => {
        if (cancelled) return null;
        const document = res.data;
        setDoc(document);
        return API.get('/supporting-docs/', {
          params: { main_document: document.id },
        });
      })
      .then((res) => {
        if (!res || cancelled) return;
        setSupport(sortBySeq(res.data || []));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError('Gagal memuat dokumen.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [docCode]);

  if (loading || !doc) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Memuat tampilan dokumen…
          </Typography>
          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </Box>
    );
  }

  const grandTotal =
    doc.parsed_json?.find((s) => s.grand_total)?.grand_total ?? '-';

  const bgColor = isDark ? '#050817' : '#f4f5ff';

  const slug = (companyName || '').toLowerCase();
  const companyFromSlug = COMPANY_NAME_BY_SLUG[slug];
  const companyFromCode =
    COMPANY_NAME_BY_CODE[(doc.company || '').toLowerCase()];
  const companyLabel =
    companyFromSlug ||
    companyFromCode ||
    (doc.company ? doc.company.toUpperCase() : '-');

  const docTypeLabel = DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type;
  const statusLabel = STATUS_LABELS[doc.status] || doc.status;
  const statusStyle =
    STATUS_CHIP_STYLES[doc.status] || STATUS_CHIP_STYLES.draft;

  return (
    <>
      {/* Background wash */}
      <Box
        sx={{
          position: 'absolute',
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
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          px: { xs: 1.5, sm: 3, md: 6 },
          py: { xs: 3, sm: 5 },
          position: 'relative',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 1100 }}>
          {/* Breadcrumb + back */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              mb: 3,
            }}
          >
            <Breadcrumbs
              sx={{
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
                to={`/directory/${companyName}`}
              >
                {(companyName || '').replace('-', ' ').toUpperCase()}
              </Link>
              <Link
                component={RouterLink}
                underline="hover"
                to={`/directory/${companyName}/${dirKey}`}
              >
                {(dirKey || '').toUpperCase()}
              </Link>
              <Typography color="text.primary">{docCode}</Typography>
            </Breadcrumbs>

            <Button
              variant="outlined"
              size="small"
              color="primary"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/directory/${companyName}/${dirKey}`)}
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
              Kembali ke folder
            </Button>
          </Box>

          {/* Main preview card */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3.25 },
              mb: 4,
              borderRadius: 4,
              border: (t) =>
                `1px solid ${
                  t.palette.mode === 'dark'
                    ? 'rgba(51, 65, 85, 0.9)'
                    : 'rgba(148, 163, 184, 0.7)'
                }`,
              background: (t) =>
                t.palette.mode === 'dark'
                  ? 'radial-gradient(circle at top left, #27326a 0, #050817 60%)'
                  : 'linear-gradient(135deg, #ffffff 0, #eef2ff 60%)',
              boxShadow: (t) =>
                t.palette.mode === 'dark'
                  ? '0 24px 52px rgba(15, 23, 42, 0.95)'
                  : '0 22px 50px rgba(148, 163, 184, 0.45)',
            }}
          >
            {/* Header row */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 3,
                mb: 2.5,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="overline"
                  sx={{
                    letterSpacing: 0.12,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  Dokumen {docTypeLabel}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    mb: 0.5,
                    lineHeight: 1.25,
                  }}
                >
                  {doc.title || '(Tanpa judul)'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {companyLabel} · {indoDate(doc.created_at)}
                </Typography>
              </Box>

              <Stack spacing={1.2} alignItems="flex-end">
                <Chip
                  size="small"
                  label={`#${doc.document_code}`}
                  sx={{
                    borderRadius: 999,
                    fontWeight: 600,
                    backgroundColor: 'rgba(15, 23, 42, 0.08)',
                    color: isDark ? '#e5edff' : '#111827',
                  }}
                />
                <Chip
                  size="small"
                  label={statusLabel}
                  sx={{
                    borderRadius: 999,
                    fontWeight: 600,
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.color,
                  }}
                />
                <Box sx={{ textAlign: 'right', mt: 0.5 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', textTransform: 'uppercase' }}
                  >
                    Total cek yang dibuka
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, lineHeight: 1.1 }}
                  >
                    Rp {grandTotal}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Meta table */}
            <Table
              size="small"
              sx={{
                mb: 3,
                '& td': { borderBottom: 'none', py: 0.6 },
              }}
            >
              <TableBody>
                <TableRow>
                  <TableCell sx={{ width: 180, fontWeight: 600 }}>
                    Perusahaan
                  </TableCell>
                  <TableCell>{companyLabel}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Dibuat</TableCell>
                  <TableCell>{indoDateTime(doc.created_at)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>
                    Disetujui oleh
                  </TableCell>
                  <TableCell>
                    {doc.approved_at ? (
                      <>Pak Subardi pada {indoDateTime(doc.approved_at)}</>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Divider sx={{ my: 2.5 }} />

            {/* Rincian */}
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 1.5, letterSpacing: 0.1 }}
            >
              Rincian transaksi
            </Typography>

            {doc.parsed_json?.length ? (
              doc.parsed_json.map((section, sectionIndex) => {
                if (!section.table) return null;
                const headerRow = section.table[0] || [];
                const payIdx = headerRow.indexOf('PAY_REF');
                const rows = section.table.slice(1);

                return (
                  <Box key={sectionIndex} sx={{ mb: 3 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        borderStyle: 'dashed',
                        borderColor: 'rgba(148, 163, 184, 0.7)',
                        backgroundColor: isDark ? '#020617' : '#f9fafb',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 1.5,
                          mb: 1.5,
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600 }}
                        >
                          {String.fromCharCode(65 + sectionIndex)}.{' '}
                          {section.company || 'Section'}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${rows.length} baris`}
                          sx={{
                            borderRadius: 999,
                            fontSize: '0.75rem',
                            backgroundColor: 'rgba(148, 163, 184, 0.18)',
                            color: 'text.secondary',
                          }}
                        />
                      </Box>

                      <Stack spacing={1.5}>
                        {rows.map((row, rowIndex) => {
                          const [, keterangan, dibayarKe, bank, pengiriman] =
                            row;
                          const payRef =
                            payIdx !== -1 && row.length > payIdx
                              ? String(row[payIdx]).trim()
                              : '';
                          const docsForRow = support.filter(
                            (d) =>
                              d.section_index === sectionIndex &&
                              d.row_index === rowIndex
                          );

                          return (
                            <Box
                              key={rowIndex}
                              sx={{
                                p: 1.75,
                                borderRadius: 2.5,
                                border: (t) =>
                                  `1px solid ${
                                    t.palette.mode === 'dark'
                                      ? 'rgba(51, 65, 85, 0.95)'
                                      : 'rgba(203, 213, 225, 0.9)'
                                  }`,
                                backgroundColor: (t) =>
                                  t.palette.mode === 'dark'
                                    ? 'rgba(15, 23, 42, 0.96)'
                                    : 'rgba(255, 255, 255, 0.98)',
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 1.5,
                                  mb: 0.75,
                                }}
                              >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    {keterangan || '(Tanpa keterangan)'}
                                  </Typography>
                                </Box>
                                <Chip
                                  size="small"
                                  label={`Baris ${rowIndex + 1}`}
                                  sx={{
                                    borderRadius: 999,
                                    fontSize: '0.75rem',
                                    backgroundColor:
                                      'rgba(248, 250, 252, 0.9)',
                                  }}
                                />
                              </Box>

                              <Box
                                sx={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 1.5,
                                  mt: 0.25,
                                  color: 'text.secondary',
                                  fontSize: '0.85rem',
                                }}
                              >
                                {dibayarKe?.trim() && (
                                  <Box>
                                    <Typography
                                      component="span"
                                      sx={{ fontWeight: 500 }}
                                    >
                                      Dibayar ke:{' '}
                                    </Typography>
                                    <Typography component="span">
                                      {dibayarKe}
                                    </Typography>
                                  </Box>
                                )}
                                {bank?.trim() && (
                                  <Box>
                                    <Typography
                                      component="span"
                                      sx={{ fontWeight: 500 }}
                                    >
                                      Bank:{' '}
                                    </Typography>
                                    <Typography component="span">
                                      {bank}
                                    </Typography>
                                  </Box>
                                )}
                                {pengiriman?.trim() && (
                                  <Box>
                                    <Typography
                                      component="span"
                                      sx={{ fontWeight: 500 }}
                                    >
                                      Pengiriman:{' '}
                                    </Typography>
                                    <Typography component="span">
                                      {pengiriman}
                                    </Typography>
                                  </Box>
                                )}
                                {payRef && (
                                  <Box>
                                    <Typography
                                      component="span"
                                      sx={{ fontWeight: 500 }}
                                    >
                                      Referensi bayar:{' '}
                                    </Typography>
                                    <Typography component="span">
                                      {payRef}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>

                              {/* Tabs for supporting docs / payment proof */}
                              <LazyPreviewTabs
                                docsForRow={docsForRow}
                                docId={doc.id}
                                docStatus={doc.status}
                                sectionIndex={sectionIndex}
                                itemIndex={rowIndex}
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                    </Paper>
                  </Box>
                );
              })
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  mt: 1,
                  p: 2.5,
                  borderRadius: 3,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(148, 163, 184, 0.8)',
                  backgroundColor: isDark ? '#020617' : '#f9fafb',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Tidak ada data rincian untuk dokumen ini.
                </Typography>
              </Paper>
            )}

            <Divider sx={{ mt: 3, mb: 1.5 }} />

            {/* Footer total */}
            <Box sx={{ textAlign: 'right', lineHeight: 1.6 }}>
              <Typography variant="body2">
                TOTAL CEK YANG DIBUKA:{' '}
                <Box component="span" sx={{ fontWeight: 700 }}>
                  Rp {grandTotal}
                </Box>
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </>
  );
}
