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
  IconButton,
  Tooltip,
  Breadcrumbs,
  Link,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import API from '../services/api';
import { useTheme } from '@mui/material/styles';
import { ItemDocsPreview } from '../components/DocumentTableParts';
import PaymentProofTab from '../components/PaymentProofTab';

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

const sortBySeq = (a = []) => [...a].sort(
  (x, y) => x.supporting_doc_sequence - y.supporting_doc_sequence
);

// ----- Subcomponent for per-item tab toggle -----
function PreviewTabs({ docsForRow, docId, docStatus, sectionIndex, itemIndex }) {
  const [tab, setTab] = useState('supportingDocs');
  return (
    <Box sx={{ my: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          my: 1,
          px: 1,
        }}
      >
        <Button
          disableElevation
          variant="text"
          onClick={() => setTab('supportingDocs')}
          sx={{
            flex: 1,
            fontWeight: 500,
            fontSize: "0.93rem",
            color: tab === 'supportingDocs' ? 'primary.main' : 'text.secondary',
            borderBottom: tab === 'supportingDocs' ? '2.2px solid' : '2.2px solid transparent',
            borderRadius: 0,
            mx: 1,
            py: 1,
            minWidth: 0,
            letterSpacing: 0,
            transition: 'color 0.14s, border-bottom 0.14s',
            background: 'none',
          }}
        >
          Dokumen Pendukung
        </Button>
        <Button
          disableElevation
          variant="text"
          onClick={() => setTab('paymentProof')}
          sx={{
            flex: 1,
            fontWeight: 500,
            fontSize: "0.93rem",
            color: tab === 'paymentProof' ? 'primary.main' : 'text.secondary',
            borderBottom: tab === 'paymentProof' ? '2.2px solid' : '2.2px solid transparent',
            borderRadius: 0,
            mx: 1,
            py: 1,
            minWidth: 0,
            letterSpacing: 0,
            transition: 'color 0.14s, border-bottom 0.14s',
            background: 'none',
          }}
        >
          Bukti Pembayaran
        </Button>
      </Box>
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
        />
      ) : (
        <PaymentProofTab
          document={{ id: docId }}
          sectionIndex={sectionIndex}
          itemIndex={itemIndex}
        />
      )}
    </Box>
  );
}

function LazyPreviewTabs(props) {
  const [visible, setVisible] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '300px' });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <div ref={ref}>{visible ? <PreviewTabs {...props} /> : <div style={{height:520}} />}</div>;
}

export default function DocumentPreviewPage() {
  const { companyName, dirKey, docCode } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const [doc, setDoc] = useState(null);
  const [support, setSupport] = useState([]);
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (!docCode) return;
    API.get(`/documents/by-code/${docCode}/`)
      .then((r) => {
        setDoc(r.data);
        return API.get('/supporting-docs/', {
          params: { main_document: r.data.id },
        });
      })
      .then((r) => setSupport(sortBySeq(r.data)))
      .catch(console.error);
  }, [docCode]);

  if (!doc) return <Typography sx={{ p: 4 }}>Loading…</Typography>;

  const grandTotal =
    doc.parsed_json?.find((s) => s.grand_total)?.grand_total ?? '-';

  const bgColor = isDark ? '#181c2f' : '#f6f7fb';

  return (
    <>
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
          px: { xs: 1, sm: 3, md: 6 },
          py: { xs: 3, sm: 6 },
          position: 'relative',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 880 }}>
          {/* --- Breadcrumb --- */}
          <Breadcrumbs
            sx={{
              fontSize: { xs: '1.05rem', sm: '1.13rem', md: '1.23rem' },
              mb: 3,
              '& a, & .MuiTypography-root': { fontWeight: 600 },
            }}
            separator=">"
          >
            <Link component={RouterLink} underline="hover" to="/directory">
              Direktori
            </Link>
            <Link component={RouterLink} underline="hover" to={`/directory/${companyName}`}>
              {(companyName || '').replace('-', ' ').toUpperCase()}
            </Link>
            <Link component={RouterLink} underline="hover" to={`/directory/${companyName}/${dirKey}`}>
              {(dirKey || '').toUpperCase()}
            </Link>
            <Typography color="text.primary">{docCode}</Typography>
          </Breadcrumbs>

          {/* --- Main Card --- */}
          <Paper
            elevation={4}
            sx={{
              p: { xs: 2, md: 4 },
              mb: 4,
              borderRadius: 5,
              background: isDark ? '#232949' : '#fff',
              boxShadow: isDark
                ? '0 2px 18px #191c3840'
                : '0 4px 22px #c7daff0f',
              fontFamily: '"Libre Franklin", Helvetica, Arial',
            }}
          >
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(`/directory/${companyName}/${dirKey}`)}
                sx={{
                  borderRadius: 3,
                  fontWeight: 600,
                  mb: 2,
                  background: isDark ? '#2b3255' : '#f7fafd',
                  '&:hover': { background: isDark ? '#222946' : '#e3e8fa' },
                }}
              >
                Kembali ke Folder
              </Button>
            </Box>
            <Typography align="center" variant="h6" fontWeight={700}>
              {doc.company?.toUpperCase() || '-'}
            </Typography>
            <Typography align="center" variant="subtitle2" sx={{ mb: 2.5 }}>
              {doc.title || '(Tanpa judul)'} &nbsp;|&nbsp; {indoDate(doc.created_at)}
            </Typography>

            {/* Basic facts */}
            <Table size="small" sx={{ mb: 2 }}>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ width: 170, fontWeight: 600, border: 'none' }}>
                    Kode dokumen
                  </TableCell>
                  <TableCell sx={{ border: 'none' }}>{doc.document_code}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, border: 'none' }}>
                    Disetujui oleh:
                  </TableCell>
                  <TableCell sx={{ border: 'none' }}>
                    {doc.approved_at ? (
                      <>Pak Subardi pada {indoDateTime(doc.approved_at)}</>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Rincian:
            </Typography>

            {/* --- Details per section --- */}
            {doc.parsed_json?.length ? (
              doc.parsed_json.map((section, i) => {
                if (!section.table) return null;
                const headerRow = section.table[0] || [];
                const payIdx = headerRow.indexOf('PAY_REF');
                return (
                  <Box key={i} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {String.fromCharCode(65 + i)}. {section.company || 'Section'}
                    </Typography>
                    <Box component="ul" sx={{ pl: 3, mt: 1 }}>
                      {section.table.slice(1).map((row, j) => {
                        const [, keterangan, dibayarKe, bank, pengiriman] = row;
                        const payRef =
                          payIdx !== -1 && row.length > payIdx
                            ? String(row[payIdx]).trim()
                            : '';
                        const docsForRow = support.filter(
                          (d) => d.section_index === i && d.row_index === j
                        );
                        return (
                          <Box component="li" key={j} sx={{ mb: 1 }}>
                            <Typography variant="body2">{keterangan}</Typography>
                            <Box component="ul" sx={{ pl: 2, fontSize: '0.93em', color: 'text.secondary' }}>
                              {dibayarKe?.trim() && (
                                <li>
                                  <strong>Dibayar ke:</strong> {dibayarKe}
                                </li>
                              )}
                              {bank?.trim() && (
                                <li>
                                  <strong>Bank:</strong> {bank}
                                </li>
                              )}
                              {pengiriman?.trim() && (
                                <li>
                                  <strong>Pengiriman:</strong> {pengiriman}
                                </li>
                              )}
                              {payRef && (
                                <li>
                                  <strong>Referensi Bayar:</strong> {payRef}
                                </li>
                              )}
                            </Box>
                            {/* --- Tabs for supporting/payment proof --- */}
                            <LazyPreviewTabs
                              docsForRow={docsForRow}
                              docId={doc.id}
                              docStatus={doc.status}
                              sectionIndex={i}
                              itemIndex={j}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })
            ) : (
              <Typography variant="body2" color="text.secondary">
                Tidak ada data.
              </Typography>
            )}

            <Divider sx={{ my: 4 }} />

            {/* --- Footer --- */}
            <Box sx={{ textAlign: 'right', lineHeight: 1.5 }}>
              <Typography variant="body2">
                TOTAL CEK YANG DIBUKA: Rp {grandTotal}
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </>
  );
}
