// File: src/pages/TagihanDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
} from '@mui/material';
import API from '../services/api';

function TagihanDetailPage() {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [supportingDocs, setSupportingDocs] = useState([]);

  const userRole = localStorage.getItem('role'); // "employee" or "higher-up"

  useEffect(() => {
    API.get(`/documents/${id}/`).then((res) => {
      setDocument(res.data);
    });
    API.get('/supporting-docs/', { params: { main_document: id } }).then((res) => {
      setSupportingDocs(res.data);
    });
  }, [id]);

  const handleFinishDraft = async () => {
    if (!document) return;

    if (supportingDocs.length === 0) {
      alert('Tambahkan minimal satu dokumen pendukung sebelum menyelesaikan draf.');
      return;
    }

    const formData = new FormData();
    formData.append('status', 'belum_disetujui');

    try {
      await API.patch(`/documents/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert('Dokumen berhasil diselesaikan dan status berubah menjadi Belum Disetujui.');

      const updatedDoc = await API.get(`/documents/${id}/`);
      setDocument(updatedDoc.data);
    } catch (error) {
      alert('Terjadi kesalahan saat menyelesaikan draft.');
      console.error('Error:', error);
    }
  };

  if (!document) return <div>Loading...</div>;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Detail Tagihan: {document.title}
      </Typography>
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1"><strong>Perusahaan:</strong> {document.company}</Typography>
        <Typography variant="subtitle1"><strong>Dibuat:</strong> {new Date(document.created_at).toLocaleString()}</Typography>
        <Typography variant="subtitle1"><strong>Deskripsi:</strong> {document.description}</Typography>
        <Typography variant="subtitle1"><strong>Status:</strong> {document.status === 'draft' ? 'Dalam Draf' : document.status === 'belum_disetujui' ? 'Belum Disetujui' : 'Disetujui'}</Typography>
      </Box>

      <Typography variant="h6">Dokumen Pendukung</Typography>
      {supportingDocs.length === 0 ? (
        <Typography variant="body2">Belum ada dokumen pendukung.</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableBody>
              {supportingDocs.map((sd) => (
                <TableRow key={sd.id}>
                  <TableCell>{sd.title || 'Tidak ada judul'}</TableCell>
                  <TableCell>
                    <a href={sd.file} target="_blank" rel="noreferrer">Lihat File</a>
                  </TableCell>
                  <TableCell>{sd.status === 'disetujui' ? 'Disetujui' : 'Belum Disetujui'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Button to finish draft */}
      {userRole === 'employee' && document.status === 'draft' && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" color="primary" onClick={handleFinishDraft}>
            Selesaikan draf
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default TagihanDetailPage;
