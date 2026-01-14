import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, IconButton, Button } from '@mui/material';
import LinearProgress from '@mui/material/LinearProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import { useDropzone } from 'react-dropzone';

import API from '../services/api';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const getExt = (url = '') => {
  const clean = String(url).split('?')[0];
  return clean.includes('.') ? clean.split('.').pop().toLowerCase() : '';
};

const withV = (u, v) => {
  if (!u) return u;
  if (!v) return u;
  return u.includes('?') ? `${u}&v=${v}` : `${u}?v=${v}`;
};

export default function PaymentProofTab({
  document,
  sectionIndex,
  itemIndex,
  readOnly = false,
  onProofChanged, // optional callback(docId) from parent to refresh cache
}) {
  const docId = document?.id;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofs, setProofs] = useState([]);
  const [idx, setIdx] = useState(0);

  // 🔒 Lock editing if main doc is archived / sudah_dibayar
  const [locked, setLocked] = useState(false);

  const prevLenRef = useRef(0);
  const uploadBoxRef = useRef(null);
  const fileInputRef = useRef(null);

  const base = useMemo(() => (API?.defaults?.baseURL || '/api').replace(/\/$/, ''), []);

  const isReadOnly = Boolean(readOnly || locked);

  const loadProofs = useCallback(async () => {
    if (docId === undefined || docId === null) return;
    setLoading(true);
    try {
      const res = await API.get('/payment-proofs/', {
        params: {
          main_document: docId,
          section_index: sectionIndex,
          item_index: itemIndex,
        },
      });

      const list = Array.isArray(res.data) ? res.data : [];
      // Backend already filters, but keep this as a safe fallback.
      const filtered = list.filter(
        (p) => p.section_index === sectionIndex && p.item_index === itemIndex
      );

      const sorted = [...filtered].sort((a, b) => {
        const sa = Number(a.payment_proof_sequence || 0);
        const sb = Number(b.payment_proof_sequence || 0);
        if (sa !== sb) return sa - sb;
        return Number(a.id || 0) - Number(b.id || 0);
      });

      setProofs(sorted);
    } catch (e) {
      console.error('Failed to load payment proofs:', e);
      setProofs([]);
    } finally {
      setLoading(false);
    }
  }, [docId, sectionIndex, itemIndex]);

  // fetch lock state
  useEffect(() => {
    if (docId === undefined || docId === null) return;
    API.get(`/documents/${docId}/`)
      .then(({ data }) => setLocked(Boolean(data?.archived) || data?.status === 'sudah_dibayar'))
      .catch(() => {});
  }, [docId]);

  useEffect(() => {
    loadProofs();
  }, [loadProofs]);

  // keep idx valid
  useEffect(() => {
    if (idx >= proofs.length && proofs.length > 0) setIdx(proofs.length - 1);
    if (proofs.length === 0) setIdx(0);
  }, [proofs, idx]);

  // if new proofs were added, jump to the last one (editable contexts)
  useEffect(() => {
    if (!isReadOnly && proofs.length > prevLenRef.current) {
      setIdx(Math.max(0, proofs.length - 1));
    }
    prevLenRef.current = proofs.length;
  }, [proofs.length, isReadOnly]);

  // Focus dropzone on mount for paste support
  useEffect(() => {
    if (!isReadOnly && proofs.length === 0 && uploadBoxRef.current) {
      uploadBoxRef.current.focus();
    }
  }, [proofs.length, isReadOnly]);

  const axiosErrText = (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;

    if (data) {
      if (typeof data === 'string') return data;
      if (data.detail) return String(data.detail);

      if (typeof data === 'object') {
        try {
          return Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join(' | ');
        } catch {
          // fall through
        }
      }
    }

    if (status) return `HTTP ${status}`;
    return err?.message || 'Unknown error';
  };

  const uploadFiles = useCallback(
    async (files = []) => {
      if (isReadOnly) return;
      if (docId === undefined || docId === null) return;

      const arr = Array.from(files || []).filter(Boolean);
      if (arr.length === 0) return;

      // client-side validation (skip invalid, but keep going)
      const allowed = [];
      for (const f of arr) {
        if (f.size > MAX_BYTES) {
          alert(`File terlalu besar (maks 5MB): ${f.name}`);
          continue;
        }
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
          alert(`Format tidak didukung: ${f.name}`);
          continue;
        }
        allowed.push(f);
      }
      if (allowed.length === 0) return;

      setUploading(true);

      const failures = [];
      let successCount = 0;

      // IMPORTANT: sequential uploads (avoid backend sequence collisions)
      for (const file of allowed) {
        const formData = new FormData();
        formData.append('main_document', docId);
        formData.append('section_index', sectionIndex);
        formData.append('item_index', itemIndex);
        formData.append('file', file);

        try {
          // Do NOT set Content-Type manually for multipart
          await API.post('/payment-proofs/', formData);
          successCount += 1;
        } catch (err) {
          failures.push({ file, err, msg: axiosErrText(err) });
        }
      }

      // Always refresh UI even if some uploads failed
      await loadProofs();
      if (typeof onProofChanged === 'function') onProofChanged(docId);

      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (failures.length) {
        console.error('Some payment proof uploads failed:', failures);

        const lines = failures
          .slice(0, 6)
          .map((f) => `- ${f.file.name}: ${f.msg}`)
          .join('\n');

        alert(
          successCount > 0
            ? `Sebagian file gagal diunggah:\n${lines}`
            : `Gagal mengunggah bukti pembayaran:\n${lines}`
        );
      }
    },
    [docId, isReadOnly, itemIndex, loadProofs, onProofChanged, sectionIndex]
  );

  const handlePaste = useCallback(
    (e) => {
      if (isReadOnly) return;
      const items = e.clipboardData?.items || [];
      const pasted = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) pasted.push(f);
        }
      }
      if (pasted.length) {
        e.preventDefault();
        uploadFiles(pasted);
      }
    },
    [isReadOnly, uploadFiles]
  );

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (isReadOnly) return;
      uploadFiles(acceptedFiles);
    },
    [isReadOnly, uploadFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    disabled: isReadOnly || uploading,
  });

  const openFilePicker = () => fileInputRef.current?.click();

  const onFilesPicked = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    uploadFiles(files);
  };

  const handleDeleteCurrent = async () => {
    const current = proofs[idx];
    if (!current?.id) return;
    if (isReadOnly) return;
    if (!window.confirm('Hapus bukti pembayaran ini?')) return;

    setUploading(true);
    try {
      await API.delete(`/payment-proofs/${current.id}/`);
      await loadProofs();
      if (typeof onProofChanged === 'function') onProofChanged(docId);
    } catch (err) {
      console.error('Delete payment proof failed:', err);
      alert('Gagal menghapus bukti pembayaran.');
    } finally {
      setUploading(false);
    }
  };

  const renderPreview = (proof) => {
    if (!proof?.file) return <Typography variant="body2">Tidak ada file.</Typography>;

    const v = proof?.uploaded_at ? new Date(proof.uploaded_at).getTime() : null;
    const ext = getExt(proof.file);
    const isPdf = ext === 'pdf';

    const previewBase = `${base}/payment-proof/${proof.id}/preview`;
    const src = withV(`${previewBase}?w=640`, v);

    // Zoom must always be an image URL
    const zoomSrc = isPdf ? withV(`${previewBase}?w=1600`, v) : withV(proof.file, v);

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
        <Zoom>
          <img
            src={src}
            srcSet={`${withV(`${previewBase}?w=480`, v)} 480w, ${withV(
              `${previewBase}?w=640`,
              v
            )} 640w, ${withV(`${previewBase}?w=1200`, v)} 1200w`}
            sizes="(max-width: 600px) 92vw, 800px"
            data-zoom-src={zoomSrc}
            alt={isPdf ? 'Preview PDF' : 'Bukti Pembayaran'}
            loading="lazy"
            decoding="async"
            style={{
              maxWidth: '100%',
              maxHeight: 420,
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
              cursor: 'zoom-in',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          />
        </Zoom>
      </Box>
    );
  };

  const current = proofs[idx];

  // Your requested “base ID + -1..x” display:
  // - baseIdentifier = first proof identifier for that item
  // - show baseIdentifier-<n> when multiple proofs exist
  const baseIdentifier = proofs?.[0]?.identifier || current?.identifier;
  const displayIdentifier =
    proofs.length > 1 && baseIdentifier ? `${baseIdentifier}-${idx + 1}` : current?.identifier;

  const currentFileV = current?.uploaded_at
    ? withV(current?.file, new Date(current.uploaded_at).getTime())
    : current?.file;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.mode === 'dark' ? '#23263d' : '#e7ecfb'}`,
        background: (t) => (t.palette.mode === 'dark' ? '#0f111a' : '#fff'),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Bukti Pembayaran:
        </Typography>

        {!isReadOnly && (
          <>
            <Button size="small" variant="outlined" onClick={openFilePicker} disabled={uploading}>
              GANTI BUKTI
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              multiple
              onChange={onFilesPicked}
              hidden
            />

            {proofs.length > 0 && (
              <IconButton
                color="error"
                onClick={handleDeleteCurrent}
                aria-label="Hapus bukti pembayaran"
                disabled={uploading}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </>
        )}
      </Box>

      {uploading && (
        <Box sx={{ mt: 0.5, mb: 1.5 }}>
          <LinearProgress />
        </Box>
      )}

      {loading ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Memuat...
        </Typography>
      ) : proofs.length === 0 ? (
        isReadOnly ? (
          <Typography sx={{ color: 'text.secondary' }}>Tidak ada bukti pembayaran.</Typography>
        ) : (
          <>
            <Box
              {...getRootProps()}
              ref={uploadBoxRef}
              tabIndex={0}
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : '#aaa',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                minHeight: 140,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: (t) => (t.palette.mode === 'dark' ? '#0b0d14' : '#fafbfc'),
                transition: 'border-color .15s, background .15s',
                opacity: uploading ? 0.6 : 1,
              }}
              onPaste={handlePaste}
            >
              <input {...getInputProps()} />
              <CloudUploadIcon style={{ marginRight: 8 }} />
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Seret & lepas file, <strong>Paste (Ctrl+V)</strong> (gambar), atau klik untuk pilih file.
              </Typography>
            </Box>

            <Typography
              variant="caption"
              sx={{ mt: 1, display: 'block', color: 'text.secondary' }}
            >
              JPG/PNG/PDF, maks. 5MB.
            </Typography>
          </>
        )
      ) : (
        <>
          {/* Outer carousel controls (only when >1 proof) */}
          {proofs.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <IconButton
                size="small"
                onClick={() => setIdx((p) => Math.max(0, p - 1))}
                disabled={idx === 0}
              >
                <ArrowBackIosNewIcon fontSize="small" />
              </IconButton>

              <Typography variant="subtitle2" sx={{ alignSelf: 'center' }}>
                Bukti {idx + 1}/{proofs.length}
              </Typography>

              <IconButton
                size="small"
                onClick={() => setIdx((p) => Math.min(proofs.length - 1, p + 1))}
                disabled={idx === proofs.length - 1}
              >
                <ArrowForwardIosIcon fontSize="small" />
              </IconButton>
            </Box>
          )}

          {renderPreview(current)}

          {/* Meta + actions row (matches your screenshot layout) */}
          <Box
            sx={{
              mt: 1,
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              color: 'text.secondary',
              alignItems: 'center',
            }}
          >
            {displayIdentifier && (
              <Typography variant="caption">
                <strong>ID:</strong> {displayIdentifier}
              </Typography>
            )}
            {current?.uploaded_at && (
              <Typography variant="caption">
                <strong>Diunggah:</strong> {new Date(current.uploaded_at).toLocaleString('id-ID')}
              </Typography>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Button size="small" variant="text" href={currentFileV} target="_blank" rel="noreferrer">
              Buka di tab baru
            </Button>
            <Button size="small" variant="text" href={currentFileV} download>
              Unduh
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
