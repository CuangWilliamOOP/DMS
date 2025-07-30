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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import API from '../services/api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ErrorBoundary from '../components/ErrorBoundary';
import TransactionReportPDF from '../pdf/TransactionReportPDF';
import { ItemDocsPreview } from '../components/DocumentTableParts';

/* Helpers */
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

export default function DocumentPreviewPage() {
  const { companyName, dirKey, docCode } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [support, setSupport] = useState([]);
  const reportRef = React.useRef(null);

  useEffect(() => {
    if (!docCode) return;
    /* 1️⃣  look the document up by its code */
    API.get(`/documents/by-code/${docCode}/`)
      .then((r) => {
        setDoc(r.data);
        /* 2️⃣  now fetch its supporting docs using the real numeric id */
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

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, display: 'flex', justifyContent: 'center' }}>
      {/* --- BREADCRUMB --- */}
      <Breadcrumbs
        sx={{
          position: 'absolute',
          top: 24,
          left: 24,
          fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.25rem' },
          '& a, & .MuiTypography-root': { fontWeight: 500 },
        }}
        separator=">"
      >
        <Link component={RouterLink} underline="hover" to="/directory">
          Direktori
        </Link>
        <Link component={RouterLink} underline="hover" to={`/directory/${companyName}`}>
          {companyName?.replace('-', ' ').toUpperCase()}
        </Link>
        <Link component={RouterLink} underline="hover" to={`/directory/${companyName}/${dirKey}`}>
          {dirKey?.toUpperCase()}
        </Link>
        <Typography color="text.primary">{docCode}</Typography>
      </Breadcrumbs>

      <Paper
        elevation={3}
        sx={{ p: 4, width: '100%', maxWidth: 830, fontFamily: '"Libre Franklin", Helvetica, Arial' }}
      >
        <Box sx={{ mb: 2 }}>
          <IconButton onClick={() => navigate(`/directory/${companyName}/${dirKey}`)}>
            <ArrowBackIcon />
          </IconButton>
        </Box>
        <Typography align="center" variant="h6" fontWeight="700">
          PT. TUNGGAL TUNGGUL UNGGUL
        </Typography>
        <Typography align="center" variant="subtitle2" sx={{ mb: 3 }}>
          Laporan Transaksi QLOLA tanggal {indoDate(doc.created_at)}
        </Typography>

        {/* Company header (static) */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', lineHeight: 1.5, mb: 3 }}>
          <Typography variant="body2">
            Alamat: Jl. Lokomotif no 31, Sekip,
            <br />
            Lima Puluh, Pekanbaru, Riau
            <br />
            Email: <a href="mailto:alamsuburnusantara@gmail.com">alamsuburnusantara@gmail.com</a>
            <br />
            Phone: +62&nbsp;811&nbsp;751&nbsp;969
          </Typography>
        </Box>

        {/* Basic facts */}
        <Table size="small" sx={{ mb: 3 }}>
          <TableBody>
            <TableRow>
              <TableCell sx={{ width: 170, fontWeight: 600, border: 'none' }}>
                Kode dokumen
              </TableCell>
              <TableCell sx={{ border: 'none' }}>{doc.document_code}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, border: 'none' }}>
                Disetujui oleh:{' '}
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

        <Typography variant="subtitle2" fontWeight="600" gutterBottom>
          Rincian:
        </Typography>

        {/* ---------- DETAILS PER SECTION ---------- */}
        {doc.parsed_json?.length ? (
          doc.parsed_json.map((section, i) => {
            if (!section.table) return null; // skip summary-only sections

            const headerRow = section.table[0] || [];
            const payIdx = headerRow.indexOf('PAY_REF');

            return (
              <Box key={i} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="600">
                  {String.fromCharCode(65 + i)}. {section.company || 'Section'}
                </Typography>

                <Box component="ul" sx={{ pl: 3, mt: 1 }}>
                  {section.table.slice(1).map((row, j) => {
                    const [, keterangan, dibayarKe, bank, pengiriman] = row;
                    const payRef =
                      payIdx !== -1 && row.length > payIdx
                        ? String(row[payIdx]).trim()
                        : '';

                    // 🔍 supporting docs for this row
                    const docsForRow = support.filter(
                      (d) => d.section_index === i && d.row_index === j
                    );

                    return (
                      <Box component="li" key={j} sx={{ mb: 1 }}>
                        <Typography variant="body2">{keterangan}</Typography>
                        <Box component="ul" sx={{ pl: 2, fontSize: '0.9em' }}>
                          {dibayarKe.trim() && (
                            <li>
                              <strong>Dibayar ke:</strong> {dibayarKe}
                            </li>
                          )}
                          {bank.trim() && (
                            <li>
                              <strong>Bank:</strong> {bank}
                            </li>
                          )}
                          {pengiriman.trim() && (
                            <li>
                              <strong>Pengiriman:</strong> {pengiriman}
                            </li>
                          )}
                          {payRef && (
                            <li>
                              <strong>Referensi&nbsp;Bayar:</strong> {payRef}
                            </li>
                          )}
                        </Box>

                        {/* Dokumen pendukung (carousel) */}
                        {docsForRow.length > 0 && (
                          <ItemDocsPreview
                            itemDocs={docsForRow}
                            readOnly // hide approve / delete buttons
                          />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })
        ) : (
          <Typography variant="body2">Tidak ada data.</Typography>
        )}

        <Divider sx={{ my: 4 }} />

        {/* ---------- FOOTER ---------- */}
        <Box sx={{ textAlign: 'right', lineHeight: 1.5 }}>
          <Typography variant="body2">
            TOTAL CEK YANG DIBUKA: Rp {grandTotal}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
