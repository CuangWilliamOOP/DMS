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
import PaymentProofTab from './PaymentProofTab';

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

/** Komponen carousel untuk menampilkan dokumen pendukung + (opsional) tab Bukti Pembayaran. */
export function ItemDocsPreview({
  itemDocs: initialItemDocs,
  mainDocumentId,
  userRole,
  mainDocStatus,
  sectionIndex,
  itemIndex,
  handleDeleteSupportingClick,
  onDocApproved,
  readOnly = false, // ← NEW: tampilan saja (sembunyikan tombol approve/hapus)
}) {
  // Helper: always sort by supporting_doc_sequence
  const sortBySeq = (arr = []) =>
    [...arr].sort((a, b) => a.supporting_doc_sequence - b.supporting_doc_sequence);

  const [docs, setDocs] = useState(initialItemDocs || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0); // track which doc is showing
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [docToApprove, setDocToApprove] = useState(null);
  const [activeTab, setActiveTab] = useState('supportingDocs');
  const prevDocsLength = React.useRef(0);

  // Use localStorage role when not provided (e.g., DocumentPreviewPage)
  const effectiveUserRole = userRole || localStorage.getItem('role');

  // sinkronisasi prop → state, always sorted
  useEffect(() => {
    setDocs(sortBySeq(initialItemDocs));
    // If docs grew and in editable context, jump to last
    if (
      !readOnly &&
      (effectiveUserRole === 'employee' || effectiveUserRole === 'admin') &&
      ['draft', 'belum_disetujui'].includes(mainDocStatus) &&
      (initialItemDocs?.length || 0) > prevDocsLength.current
    ) {
      setCurrentIndex((initialItemDocs?.length || 1) - 1);
    }
    prevDocsLength.current = initialItemDocs?.length || 0;
  }, [initialItemDocs, mainDocStatus, readOnly, effectiveUserRole]);

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

  if (docs.length === 0)
    return <Typography variant="body2">Tidak ada dokumen pendukung.</Typography>;

  const currentDoc = docs[currentIndex] || {};

  // helpers
  const getExt = (name = '') => name.split('.').pop().toLowerCase();
  const renderFilePreview = (url, doc) => {
    if (!url) return <Typography>Tidak ada file.</Typography>;

    const ext = getExt(url);
    const isImg = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

    if (isImg) {
      const base = (API?.defaults?.baseURL || '/api').replace(/\/$/, '');
      const previewBase = doc?.id ? `${base}/sdoc/${doc.id}/preview` : null;
      const sizes = '(max-width: 680px) 92vw, 640px';

      // small preview, full-res only on zoom
      const src = previewBase ? `${previewBase}?w=640&fmt=webp` : url;
      const srcSet = previewBase
        ? [
            `${previewBase}?w=480&fmt=webp 480w`,
            `${previewBase}?w=640&fmt=webp 640w`,
          ].join(', ')
        : undefined;

      return (
        <Box sx={{ textAlign: 'center' }}>
          <Zoom>
            <img
              src={src}
              srcSet={srcSet}
              sizes={sizes}
              data-zoom-src={doc.file}
              alt="Dokumen Pendukung"
              loading="lazy"
              decoding="async"
              style={{ maxWidth: '100%', maxHeight: 450, cursor: 'zoom-in' }}
            />
          </Zoom>
          <Box sx={{ mt: 1 }}>
            <Button size="small" href={doc.file} target="_blank" rel="noreferrer">
              Buka file asli
            </Button>
          </Box>
        </Box>
      );
    }

    if (ext === 'pdf') {
      const base = (API?.defaults?.baseURL || '/api').replace(/\/$/, '');
      const prev = `${base}/sdoc/${doc.id}/preview?w=640`;
      return (
        <Box sx={{ textAlign: 'center' }}>
          <Zoom>
            <img
              src={prev}
              srcSet={`${base}/sdoc/${doc.id}/preview?w=480 480w, ${base}/sdoc/${doc.id}/preview?w=640 640w, ${base}/sdoc/${doc.id}/preview?w=1200 1200w`}
              sizes="(max-width: 600px) 92vw, 800px"
              data-zoom-src={doc.file}        // fetch full PDF only on zoom/open
              alt="PDF"
              loading="lazy"
              decoding="async"
              style={{ maxWidth: '100%', maxHeight: 450, cursor: 'zoom-in', objectFit: 'contain' }}
            />
          </Zoom>
          <Box sx={{ mt: 1 }}>
            <Button size="small" href={doc.file} target="_blank" rel="noreferrer">
              Buka PDF asli
            </Button>
          </Box>
        </Box>
      );
    }
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
      {/* ───── TAB BUTTONS – keep visible in readOnly for viewing ───── */}
      {mainDocStatus === 'disetujui' && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            my: 2,
            px: 1,
          }}
        >
          <Button
            disableElevation
            variant="text"
            onClick={() => setActiveTab('supportingDocs')}
            sx={{
              flex: 1,
              fontWeight: 500,
              fontSize: '0.85rem',
              color: activeTab === 'supportingDocs' ? 'primary.main' : 'text.secondary',
              borderBottom: activeTab === 'supportingDocs' ? '2.2px solid' : '2.2px solid transparent',
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
            onClick={() => setActiveTab('paymentProof')}
            sx={{
              flex: 1,
              fontWeight: 500,
              fontSize: '0.85rem',
              color: activeTab === 'paymentProof' ? 'primary.main' : 'text.secondary',
              borderBottom: activeTab === 'paymentProof' ? '2.2px solid' : '2.2px solid transparent',
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
      )}

      {/* SINGLE conditional block */}
      {mainDocStatus !== 'disetujui' || activeTab === 'supportingDocs' ? (
        <>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
            Dokumen {activeIdx + 1}/{docs.length}  •  Total: {docs.length}
          </Typography>
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

          {renderFilePreview(currentDoc.file, currentDoc)}

          {/* actions – hidden in readOnly */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            {!readOnly && canEvaluateSupportingDoc(effectiveUserRole, currentDoc.status, mainDocStatus) && (
              <Button
                variant="contained"
                size="small"
                color="success"
                onClick={() => handleOpenApproveDialog(currentDoc)}
              >
                Setujui
              </Button>
            )}
            {!readOnly && canDeleteSupportingDoc(effectiveUserRole, mainDocStatus) && (
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
        </>
      ) : (
        <PaymentProofTab
          document={{ id: mainDocumentId }}
          sectionIndex={sectionIndex}
          itemIndex={itemIndex}
          readOnly={readOnly}
        />
      )}
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
