import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, IconButton, Button } from "@mui/material";
import LinearProgress from "@mui/material/LinearProgress";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import { useDropzone } from "react-dropzone";

import API, { getPaymentProofs } from "../services/api";

function PaymentProofTab({ document, sectionIndex, itemIndex, readOnly = false }) {
  const [paymentProof, setPaymentProof] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // 🔒 Lock editing if main doc is archived / sudah_dibayar
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    API.get(`/documents/${document.id}/`)
      .then(({ data }) => setLocked(Boolean(data.archived) || data.status === 'sudah_dibayar'))
      .catch(() => {});
  }, [document.id]);
  const isReadOnly = readOnly || locked;

  const uploadBoxRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchPaymentProof = useCallback(async () => {
    const { data } = await getPaymentProofs(document.id);
    const proof = data.find(
      (p) => p.section_index === sectionIndex && p.item_index === itemIndex
    );
    setPaymentProof(proof || null);
  }, [document.id, sectionIndex, itemIndex]);

  useEffect(() => {
    fetchPaymentProof();
  }, [fetchPaymentProof]);

  // Paste handler for clipboard image support (disabled in readOnly)
  const handlePaste = useCallback(
    (e) => {
      if (isReadOnly) return;
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) setUploadedFile(file);
        }
      }
    },
    [isReadOnly]
  );

  // Focus the upload box on mount for paste shortcut support (only when editable)
  useEffect(() => {
    if (!isReadOnly && !paymentProof && uploadBoxRef.current) {
      uploadBoxRef.current.focus();
    }
  }, [paymentProof, isReadOnly]);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (isReadOnly) return;
      setUploadedFile(acceptedFiles[0]);
    },
    [isReadOnly]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png"], "application/pdf": [".pdf"] },
    disabled: isReadOnly,
  });

  const handleUpload = async () => {
    if (!uploadedFile) return;

    const formData = new FormData();
    formData.append("main_document", document.id);
    formData.append("section_index", sectionIndex);
    formData.append("item_index", itemIndex);
    formData.append("file", uploadedFile);

    setUploading(true);
    setProgress(0);
    try {
      await API.post("/payment-proofs/", formData, {
        onUploadProgress: (e) => {
          if (!e.total) return;
          setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      setUploadedFile(null);
      fetchPaymentProof();
    } catch (err) {
      alert("Gagal mengunggah bukti pembayaran.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!paymentProof || readOnly) return;
    if (!window.confirm("Hapus bukti pembayaran ini?")) return;
    try {
      await API.delete(`/payment-proofs/${paymentProof.id}/`);
      setPaymentProof(null);
    } catch (err) {
      alert("Gagal menghapus bukti pembayaran.");
      console.error(err);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const onReplaceFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    handleUpload();
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.mode === 'dark' ? '#23263d' : '#e7ecfb'}`,
        background: (t) => (t.palette.mode === 'dark' ? '#0f111a' : '#fff'),
      }}
    >
      {paymentProof ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              Bukti Pembayaran:
            </Typography>
            {!isReadOnly && (
              <>
                <Button size="small" variant="outlined" onClick={openFilePicker}>
                  Ganti Bukti
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={onReplaceFile}
                  hidden
                />
                <IconButton color="error" onClick={handleDelete} aria-label="Hapus bukti pembayaran">
                  <DeleteIcon />
                </IconButton>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
            <Zoom>
              <img
                src={`${(API?.defaults?.baseURL || '/api').replace(/\/$/, '')}/payment-proof/${paymentProof.id}/preview?w=640`}
                srcSet={`${(API?.defaults?.baseURL || '/api').replace(/\/$/, '')}/payment-proof/${paymentProof.id}/preview?w=480 480w, ${(API?.defaults?.baseURL || '/api').replace(/\/$/, '')}/payment-proof/${paymentProof.id}/preview?w=640 640w, ${(API?.defaults?.baseURL || '/api').replace(/\/$/, '')}/payment-proof/${paymentProof.id}/preview?w=1200 1200w`}
                sizes="(max-width: 600px) 92vw, 800px"
                data-zoom-src={`${(API?.defaults?.baseURL || '/api').replace(/\/$/, '')}/payment-proof/${paymentProof.id}/preview?w=1600`}
                alt="Preview Bukti Pembayaran"
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

          <Box sx={{ mt: 1, display: "flex", gap: 2, flexWrap: "wrap", color: "text.secondary" }}>
            {paymentProof?.identifier && (
              <Typography variant="caption"><strong>ID:</strong> {paymentProof.identifier}</Typography>
            )}
            {paymentProof?.uploaded_at && (
              <Typography variant="caption">
                <strong>Diunggah:</strong> {new Date(paymentProof.uploaded_at).toLocaleString("id-ID")}
              </Typography>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" variant="text" href={paymentProof?.file} target="_blank" rel="noreferrer">
              Buka di tab baru
            </Button>
            <Button size="small" variant="text" href={paymentProof?.file} download>
              Unduh
            </Button>
          </Box>
        </>
      ) : isReadOnly ? (
        <Typography sx={{ color: "text.secondary" }}>Tidak ada bukti pembayaran.</Typography>
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
              cursor: 'pointer',
              minHeight: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: (t) => (t.palette.mode === 'dark' ? '#0b0d14' : '#fafbfc'),
              transition: 'border-color .15s, background .15s',
            }}
            onPaste={handlePaste}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon style={{ marginRight: 8 }} />
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Seret & lepas gambar, <strong>Paste (Ctrl+V)</strong>, atau klik untuk pilih file.
            </Typography>
          </Box>

          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}

          {!paymentProof && uploadedFile && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2 }}>
              <Typography>{uploadedFile.name}</Typography>
              <IconButton color="error" onClick={() => setUploadedFile(null)} aria-label="Batalkan file">
                <DeleteIcon />
              </IconButton>
              <Button
                variant="contained"
                color="primary"
                disabled={!uploadedFile || uploading}
                onClick={handleUpload}
                sx={{ ml: 2 }}
              >
                Upload
              </Button>
            </Box>
          )}

          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
            JPG/PNG/PDF, maks. 5MB.
          </Typography>
        </>
      )}
    </Box>
  );
}

export default PaymentProofTab;
