// fix(src/components/DocumentTableParts.jsx): remove UI "APPROVED" stamp overlay
// • Deleted <ApprovedStamp/> component
// • Deleted its conditional render inside renderFilePreview()
// 
// NOTE: purely visual stamp now handled by backend‑embedded watermark, so no UI overlay needed.

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
} from '@mui/material';
import API from '../services/api';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { canEvaluateSupportingDoc, canDeleteSupportingDoc } from '../utils/rolePermissions';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

/** Dialog untuk Approve Dokumen Pendukung */
export function SupportingDocApproval({ open, onClose, doc, afterApprove }) {
  const [loading, setLoading] = useState(false);

  if (!doc) return null;

  const handleApprove = async () => {
    try {
      setLoading(true);
      const res = await API.patch(`/supporting-docs/${doc.id}/`, {
        status: 'disetujui',
      });
      if (afterApprove) afterApprove(res.data);
      onClose();
    } catch (error) {
      alert('Gagal menyetujui dokumen pendukung.');
      console.error('Error approving supporting doc:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Setujui Dokumen Pendukung</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Apakah Anda yakin ingin menyetujui dokumen pendukung{' '}
          <strong>{doc.title || '(Untitled)'}</strong>? Dokumen akan distempel "APPROVED" dan
          tidak dapat diubah lagi.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Batal
        </Button>
        <Button onClick={handleApprove} variant="contained" color="primary" disabled={loading}>
          {loading ? 'Menyetujui...' : 'Setujui'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Komponen carousel untuk menampilkan dokumen pendukung (gambar, PDF, Excel, dsb). */
export function ItemDocsPreview({
  itemDocs: initialItemDocs,
  userRole,
  mainDocStatus,
  handleDeleteSupportingClick,
  onDocApproved,
}) {
  const [docs, setDocs] = useState(initialItemDocs || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0); // track which doc is showing
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [docToApprove, setDocToApprove] = useState(null);

  // sinkronisasi prop → state
  useEffect(() => {
    setDocs(initialItemDocs || []);
  }, [initialItemDocs]);

  // Pastikan currentIndex valid
  useEffect(() => {
    if (currentIndex >= docs.length && docs.length > 0) {
      setCurrentIndex(docs.length - 1);
    }
  }, [docs, currentIndex]);

  // Keep activeIdx in sync with currentIndex (for non-Swiper usage)
  useEffect(() => {
    setActiveIdx(currentIndex);
  }, [currentIndex]);

  const handleOpenApproveDialog = (doc) => {
    setDocToApprove(doc);
    setApprovalDialogOpen(true);
  };
  const handleCloseApproveDialog = () => {
    setApprovalDialogOpen(false);
    setDocToApprove(null);
  };
  const refreshDocsAfterApprove = (updatedDoc) => {
    if (!updatedDoc) return;
    setDocs((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    if (onDocApproved) onDocApproved(updatedDoc);
  };

  const handlePrev = () => currentIndex > 0 && setCurrentIndex((p) => p - 1);
  const handleNext = () => currentIndex < docs.length - 1 && setCurrentIndex((p) => p + 1);

  if (docs.length === 0) return <Typography variant="body2">Tidak ada dokumen pendukung.</Typography>;

  const currentDoc = docs[currentIndex] || {};

  // helpers
  const getExt = (name = '') => name.split('.').pop().toLowerCase();
  const renderFilePreview = (url) => {
    if (!url) return <Typography>Tidak ada file.</Typography>;
    const ext = getExt(url);
    if (['png', 'jpg', 'jpeg'].includes(ext)) {
      return (
        <Box sx={{ textAlign: 'center' }}>
          <Zoom>
            <img
              src={url}
              alt="Dokumen Pendukung"
              style={{ maxWidth: '100%', maxHeight: 400, cursor: 'zoom-in' }}
            />
          </Zoom>
        </Box>
      );
    }
    if (ext === 'pdf')
      return <iframe title="PDF" src={url} style={{ width: '100%', height: 450 }} />;
    if (['xls', 'xlsx'].includes(ext))
      return (
        <iframe
          title="Excel"
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
          style={{ width: '100%', height: 450, border: 'none' }}
        />
      );
    return <Typography>Preview tidak tersedia.</Typography>;
  };

  return (
    <Box sx={{ mt: 1, border: '1px solid #eee', p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
        Dokumen {activeIdx + 1}/{docs.length} &nbsp;•&nbsp;Total: {docs.length}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <IconButton size="small" onClick={handlePrev} disabled={currentIndex === 0}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleNext} disabled={currentIndex === docs.length - 1}>
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>
      </Box>

      {renderFilePreview(currentDoc.file)}

      {/* Aksi Approve / Delete */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 2, gap: 2 }}>
        {canEvaluateSupportingDoc(userRole, currentDoc.status, mainDocStatus) && (
          <Button variant="contained" size="small" color="success" onClick={() => handleOpenApproveDialog(currentDoc)}>
            Setujui
          </Button>
        )}
        {canDeleteSupportingDoc(userRole, mainDocStatus) && (
          <IconButton color="error" onClick={() => handleDeleteSupportingClick(currentDoc)}>
            <DeleteIcon />
          </IconButton>
        )}
      </Box>

      <SupportingDocApproval
        open={approvalDialogOpen}
        onClose={handleCloseApproveDialog}
        doc={docToApprove}
        afterApprove={refreshDocsAfterApprove}
      />
    </Box>
  );
}

/** Sel tabel yang bisa di‑klik lalu diedit inline */
export function EditableTableCell({ value, canEdit, onChangeValue }) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const handleCellClick = () => canEdit && setEditing(true);
  const commitChange = () => {
    setEditing(false);
    if (tempValue !== value) onChangeValue(tempValue);
  };
  return (
    <td
      style={{ whiteSpace: 'normal', wordWrap: 'break-word', cursor: canEdit ? 'pointer' : 'default', borderBottom: '1px solid rgba(224,224,224,1)', padding: 8 }}
      onClick={handleCellClick}
    >
      {editing ? (
        <TextField
          size="small"
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={commitChange}
          onKeyDown={(e) => (e.key === 'Enter' ? commitChange() : e.key === 'Escape' && setEditing(false))}
          variant="standard"
          fullWidth
        />
      ) : (
        value && value.trim() !== '' ? value : '-'
      )}
    </td>
  );
}

/** Teks inline yang bisa diedit */
export function EditableInlineText({ value, canEdit, onChange }) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');
  const commit = () => {
    setEditing(false);
    if (tempValue !== value) onChange(tempValue);
  };
  if (!canEdit)
    return <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{value}</Typography>;
  return (
    <Box onClick={() => setEditing(true)} sx={{ cursor: 'pointer' }}>
      {editing ? (
        <TextField
          size="small"
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => (e.key === 'Enter' ? commit() : e.key === 'Escape' && setEditing(false))}
          variant="standard"
          fullWidth
        />
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{value || '-'}</Typography>
      )}
    </Box>
  );
}
