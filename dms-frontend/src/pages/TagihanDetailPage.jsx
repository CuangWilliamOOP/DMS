// fix(src/pages/TagihanDetailPage.jsx):
// • Tampilkan document_code di judul & ringkasan.
// • Gunakan format tanggal Indonesia lebih ringkas.
// • Perbaiki penulisan status (Ditolak, Sudah Dibayar). 

import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Button,
  Breadcrumbs,
  Link,
} from '@mui/material';
import API from '../services/api';
import { canApprove } from '../utils/rolePermissions';   // ⬅️ add
import { ApproveTagihanDialog } from '../components/Dialogs';

function TagihanDetailPage() {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [approveDlgOpen, setApproveDlgOpen] = useState(false);
  const [unapprovedDocs, setUnapprovedDocs] = useState([]);
  const userRole = localStorage.getItem('role'); // "employee" | "higher-up" | "owner"

  useEffect(() => {
    API.get(`/documents/${id}/`).then((res) => setDocument(res.data));
    API.get('/supporting-docs/', { params: { main_document: id } }).then((res) => setSupportingDocs(res.data));
  }, [id]);

  const handleFinishDraft = async () => {
    if (!document) return;
    if (supportingDocs.length === 0) {
      alert('Tambahkan minimal satu dokumen pendukung sebelum menyelesaikan draf.');
      return;
    }
    try {
      await API.patch(`/documents/${id}/`, { status: 'belum_disetujui' });
      alert('Draft diselesaikan — status kini "Belum Disetujui".');
      const updated = await API.get(`/documents/${id}/`);
      setDocument(updated.data);
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyelesaikan draft.');
    }
  };

  // ──  handle click on the green button ─────────────────────────────
  const handleOpenApprove = () => {
    const pending = supportingDocs.filter((d) => d.status !== 'disetujui');
    setUnapprovedDocs(pending);
    setApproveDlgOpen(true);        // always open the dialog – it will show a list if needed
  };
  // ──  called from the dialog when boss presses “Lanjutkan” ─────────
  const handleConfirmApprove = async () => {
    if (unapprovedDocs.length) {
      alert('Masih ada dokumen pendukung yang belum disetujui.');
      return;                       // block the approval
    }
    try {
      await API.patch(`/documents/${id}/`, { status: 'disetujui' });
      const refreshed = await API.get(`/documents/${id}/`);
      setDocument(refreshed.data);
      setApproveDlgOpen(false);
    } catch (err) {
      console.error(err);
      alert('Gagal menyetujui tagihan.');
    }
  };

  if (!document) return <div>Loading...</div>;

  const indoDate = (dt) => new Date(dt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const statusReadable = {
    draft: 'Dalam Draf',
    belum_disetujui: 'Belum Disetujui',
    disetujui: 'Disetujui',
    rejected: 'Ditolak',
    sudah_dibayar: 'Sudah Dibayar',
  }[document.status] || document.status;

  return (
    <Box sx={{ p: 2 }}>
      {/* Breadcrumb simple */}
      <Breadcrumbs sx={{ mb: 2 }} separator="/">
        <Link component={RouterLink} to="/home" underline="hover">Beranda</Link>
        <Typography>Detail Tagihan</Typography>
      </Breadcrumbs>

      <Typography variant="h5" gutterBottom>
        {document.document_code} — {document.title}
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1"><strong>Perusahaan:</strong> {document.company.toUpperCase()}</Typography>
        <Typography variant="subtitle1"><strong>Dibuat:</strong> {indoDate(document.created_at)}</Typography>
        <Typography variant="subtitle1"><strong>Deskripsi:</strong> {document.description || '-'}</Typography>
        <Typography variant="subtitle1"><strong>Status:</strong> {statusReadable}</Typography>
        {document.payment_reference && (
          <Typography variant="subtitle1"><strong>Referensi Pembayaran:</strong> {document.payment_reference}</Typography>
        )}
      </Box>

      <Typography variant="h6">Dokumen Pendukung</Typography>
      {supportingDocs.length === 0 ? (
        <Typography variant="body2">Belum ada dokumen pendukung.</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableBody>
              {supportingDocs.map((sd) => (
                <TableRow key={sd.id}>
                  <TableCell>{sd.title || 'Tidak ada judul'}</TableCell>
                  <TableCell><a href={sd.file} target="_blank" rel="noreferrer">Lihat File</a></TableCell>
                  <TableCell>{sd.status === 'disetujui' ? 'Disetujui' : 'Belum Disetujui'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {userRole === 'employee' && document.status === 'draft' && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" color="primary" onClick={handleFinishDraft}>
            Selesaikan Draft
          </Button>
        </Box>
      )}
      {canApprove(userRole, document.status) && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" color="success" onClick={handleOpenApprove}>
            Setujui Tagihan
          </Button>
        </Box>
      )}
      {/*  Dialog */}
      <ApproveTagihanDialog
        open={approveDlgOpen}
        onClose={() => setApproveDlgOpen(false)}
        unapprovedDocs={unapprovedDocs}
        onConfirm={handleConfirmApprove}
      />
    </Box>
  );
}

export default TagihanDetailPage;
