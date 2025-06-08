// fix: /src/components/DocumentTableParts.jsx
// File ini menampung sub-komponen DocumentTable yang sebelumnya kepanjangan.
// Perubahan: Menambahkan prop "onDocApproved" di ItemDocsPreview untuk beri tahu parent
// bahwa dok pendukung telah disetujui, agar data di parent ikut ter-update.

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
  IconButton
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
      // PATCH ke server => status = "disetujui"
      const res = await API.patch(`/supporting-docs/${doc.id}/`, { status: 'disetujui' });
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
          Apakah Anda yakin ingin menyetujui dokumen pendukung <strong>{doc.title || '(Untitled)'}</strong>?
          Dokumen akan diberi cap "APPROVED" dan tidak dapat diubah lagi.
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

/** Cap "APPROVED" di atas dokumen */
export function ApprovedStamp({ approvedAtString }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        transform: 'rotate(-15deg)',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        padding: '8px 12px',
        border: '2px solid red',
        zIndex: 9999,
      }}
    >
      <Typography variant="h6" sx={{ color: 'red', fontWeight: 'bold', mb: 0 }}>
        APPROVED
      </Typography>
      {approvedAtString && (
        <Typography variant="caption" sx={{ color: 'red' }}>
          {approvedAtString}
        </Typography>
      )}
    </Box>
  );
}

/** Komponen carousel untuk menampilkan dokumen pendukung (gambar, PDF, Excel, dsb). */
export function ItemDocsPreview({
  itemDocs: initialItemDocs,
  userRole,
  mainDocStatus,
  handleDeleteSupportingClick,
  onDocApproved // (+) prop callback agar child kabari parent
}) {
  const [docs, setDocs] = useState(initialItemDocs || []);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setDocs(initialItemDocs || []);
  }, [initialItemDocs]);

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [docToApprove, setDocToApprove] = useState(null);

  const handleOpenApproveDialog = (doc) => {
    setDocToApprove(doc);
    setApprovalDialogOpen(true);
  };
  const handleCloseApproveDialog = () => {
    setApprovalDialogOpen(false);
    setDocToApprove(null);
  };

  /** Callback setelah dok pendukung disetujui */
  const refreshDocsAfterApprove = (updatedDoc) => {
    setApprovalDialogOpen(false);
    setDocToApprove(null);
    if (!updatedDoc) return;

    // 1) Update local state agar stempel langsung muncul
    setDocs((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));

    // 2) Beri tahu parent (kalau disediakan)
    if (onDocApproved) {
      onDocApproved(updatedDoc);
    }
  };

  // Pastikan currentIndex tidak melebihi jumlah doc
  useEffect(() => {
    if (currentIndex >= docs.length && docs.length > 0) {
      setCurrentIndex(docs.length - 1);
    }
  }, [docs, currentIndex]);

  if (docs.length === 0) {
    return <Typography variant="body2">Tidak ada dokumen pendukung.</Typography>;
  }

  const currentDoc = docs[currentIndex] || {};

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };
  const handleNext = () => {
    if (currentIndex < docs.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  function getFileExtension(filename = '') {
    const parts = filename.split('.');
    return parts[parts.length - 1].toLowerCase();
  }

  function renderFilePreview(fileUrl, docStatus, docApprovedAt) {
    if (!fileUrl) return <Typography>Tidak ada file.</Typography>;
    const ext = getFileExtension(fileUrl);
  
    return (
      <Box sx={{ position: 'relative' }}>
        {/* Render bergantung ekstensi */}
        {['png', 'jpg', 'jpeg'].includes(ext) && (
          <Box sx={{ textAlign: 'center' }}>
            <Zoom>
              <img
                src={fileUrl}
                alt="Dokumen Pendukung"
                style={{ maxWidth: '100%', maxHeight: '400px', cursor: 'zoom-in' }}
              />
            </Zoom>
          </Box>
        )}
        {ext === 'pdf' && (
          <iframe
            title="PDF Preview"
            src={fileUrl}
            style={{ width: '100%', height: '450px' }}
          />
        )}
        {['xls', 'xlsx'].includes(ext) && (
          <iframe
            title="Excel Preview"
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
            style={{ width: '100%', height: '450px', border: 'none' }}
          />
        )}
        {!['png', 'jpg', 'jpeg', 'pdf', 'xls', 'xlsx'].includes(ext) && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Preview tidak tersedia untuk jenis file ini.
          </Typography>
        )}
  
        {/* Stempel APPROVED jika status = disetujui + ada approved_at */}
        {docStatus === 'disetujui' && docApprovedAt && (
          <ApprovedStamp approvedAtString={docApprovedAt} />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, border: '1px solid #eee', p: 2, borderRadius: 2 }}>
      {/* Navigasi carousel */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <IconButton size="small" onClick={handlePrev} disabled={currentIndex === 0}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleNext}
          disabled={currentIndex === docs.length - 1}
        >
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>
      </Box>

      {renderFilePreview(currentDoc.file, currentDoc.status, currentDoc.approved_at)}

      {/* Tombol "Setujui" & "Hapus" */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 2, gap: 2 }}>
        {canEvaluateSupportingDoc(userRole, currentDoc.status, mainDocStatus) && (
          <Button
            variant="contained"
            size="small"
            color="success"
            onClick={() => handleOpenApproveDialog(currentDoc)}
          >
            Setujui
          </Button>
        )}
        {canDeleteSupportingDoc(userRole, mainDocStatus) && (
          <IconButton
            color="error"
            onClick={() => handleDeleteSupportingClick(currentDoc)}
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Box>

      {/* Dialog Approve */}
      <SupportingDocApproval
        open={approvalDialogOpen}
        onClose={handleCloseApproveDialog}
        doc={docToApprove}
        afterApprove={refreshDocsAfterApprove}
      />
    </Box>
  );
}

/** Sel tabel yang bisa di-klik lalu diedit inline */
export function EditableTableCell({ value, canEdit, onChangeValue }) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleCellClick = () => {
    if (canEdit) {
      setEditing(true);
    }
  };

  const handleBlur = () => {
    setEditing(false);
    if (tempValue !== value) {
      onChangeValue(tempValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setEditing(false);
      if (tempValue !== value) {
        onChangeValue(tempValue);
      }
    } else if (e.key === 'Escape') {
      setTempValue(value);
      setEditing(false);
    }
  };

  return (
    <td
      style={{
        whiteSpace: 'normal',
        wordWrap: 'break-word',
        cursor: canEdit ? 'pointer' : 'default',
        borderBottom: '1px solid rgba(224, 224, 224, 1)',
        padding: '8px',
      }}
      onClick={handleCellClick}
    >
      {editing ? (
        <TextField
          size="small"
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          variant="standard"
          fullWidth
        />
      ) : (
        value && value.trim() !== '' ? value : '-'
      )}
    </td>
  );
}

/** Teks inline yang bisa diedit, misalnya untuk subtotal / grand_total */
export function EditableInlineText({ value, canEdit, onChange }) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');

  const handleClick = () => {
    if (canEdit) {
      setEditing(true);
    }
  };

  const handleBlur = () => {
    setEditing(false);
    if (tempValue !== value) {
      onChange(tempValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setEditing(false);
      if (tempValue !== value) {
        onChange(tempValue);
      }
    } else if (e.key === 'Escape') {
      setTempValue(value);
      setEditing(false);
    }
  };

  if (!canEdit) {
    return (
      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
        {value}
      </Typography>
    );
  }

  return (
    <Box onClick={handleClick} sx={{ cursor: 'pointer' }}>
      {editing ? (
        <TextField
          size="small"
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          variant="standard"
          fullWidth
        />
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {value || '-'}
        </Typography>
      )}
    </Box>
  );
}
