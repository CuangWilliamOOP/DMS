import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, Button, IconButton } from "@mui/material";
import { useDropzone } from "react-dropzone";
import API, { uploadPaymentProof, getPaymentProofs } from "../services/api";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import DeleteIcon from "@mui/icons-material/Delete";

function PaymentProofTab({ document, sectionIndex, itemIndex, onProofChanged }) {
  const [paymentProof, setPaymentProof] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const uploadBoxRef = useRef(null);

  const fetchPaymentProof = useCallback(async () => {
    const { data } = await getPaymentProofs(document.id);
    const proof = data.find(
      (p) => p.section_index === sectionIndex && p.item_index === itemIndex
    );
    setPaymentProof(proof);
  }, [document.id, sectionIndex, itemIndex]);

  useEffect(() => {
    fetchPaymentProof();
  }, [fetchPaymentProof]);

  // --- Paste handler for clipboard image support ---
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setUploadedFile(file);
        }
      }
    }
  }, []);

  // Focus the upload box on mount for paste shortcut support
  useEffect(() => {
    if (!paymentProof && uploadBoxRef.current) {
      uploadBoxRef.current.focus();
    }
  }, [paymentProof]);

  const onDrop = useCallback((acceptedFiles) => {
    setUploadedFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png"],
    },
  });

  const handleUpload = async () => {
    if (!uploadedFile) return;

    const formData = new FormData();
    formData.append("main_document", document.id);
    formData.append("section_index", sectionIndex);
    formData.append("item_index", itemIndex);
    formData.append("file", uploadedFile);

    await uploadPaymentProof(formData);
    setUploadedFile(null);
    fetchPaymentProof();
    onProofChanged && onProofChanged(document.id);
  };

  const handleDelete = async () => {
    if (!paymentProof) return;
    try {
      await API.delete(`/payment-proofs/${paymentProof.id}/`);
      setPaymentProof(null);
      onProofChanged && onProofChanged(document.id);
    } catch (err) {
      alert("Gagal menghapus bukti pembayaran.");
      console.error(err);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
        {paymentProof ? (
        <Box sx={{ mb: 2 }}>
            {/* Header row: label left, delete right */}
            <Box sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
            width: "100%"
            }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                Bukti Pembayaran
                {paymentProof.identifier && (
                <span style={{
                    fontSize: 13,
                    color: "#7b7c8c",
                    marginLeft: 10,
                    fontWeight: 400,
                    letterSpacing: 0.5
                }}>
                    ({paymentProof.identifier})
                </span>
                )}
            </Typography>
            <IconButton color="error" onClick={handleDelete}>
                <DeleteIcon />
            </IconButton>
            </Box>
            {/* Centered image */}
            <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Zoom>
                <img
                src={paymentProof.file}
                alt="Payment Proof"
                style={{
                    maxWidth: "100%",
                    maxHeight: 400,
                    cursor: "zoom-in",
                    display: "block"
                }}
                />
            </Zoom>
            </Box>
        </Box>
        ) : (
        <Box
          {...getRootProps()}
          ref={uploadBoxRef}
          tabIndex={0}
          onPaste={handlePaste}
          onMouseEnter={() => {
            if (uploadBoxRef.current) uploadBoxRef.current.focus();
          }}
          sx={{
            border: "2px dashed #aaa",
            borderRadius: 2,
            p: 4,
            textAlign: "center",
            cursor: "pointer",
            minHeight: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#fafbfc",
            outline: "none",
          }}
        >
          <input {...getInputProps()} />
          <Button
            variant="contained"
            component="span"
            sx={{ fontWeight: 600, borderRadius: 2, px: 4 }}
            tabIndex={-1}
          >
            Upload Bukti Pembayaran
          </Button>
        </Box>
      )}

      {!paymentProof && uploadedFile && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2 }}>
          <Typography>{uploadedFile.name}</Typography>
          <IconButton color="error" onClick={() => setUploadedFile(null)}>
            <DeleteIcon />
          </IconButton>
          <Button
            variant="contained"
            color="primary"
            disabled={!uploadedFile}
            onClick={handleUpload}
            sx={{ ml: 2 }}
          >
            Upload
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default PaymentProofTab;
