// src/components/Dialogs.jsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Box, Typography, TextField, Tooltip, List, ListItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { motion } from 'framer-motion';
import { useTheme } from '@mui/material/styles';

// Dialog Hapus Dokumen Utama
export const DeleteMainDocumentDialog = ({ open, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Konfirmasi Hapus</DialogTitle>
    <DialogContent>
      <DialogContentText>Yakin ingin menghapus dokumen ini?</DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit">Batal</Button>
      <Button onClick={onConfirm} color="error" variant="contained">Hapus</Button>
    </DialogActions>
  </Dialog>
);

// Dialog Hapus Dokumen Pendukung
export const DeleteSupportingDocumentDialog = ({ open, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Hapus Dokumen Pendukung</DialogTitle>
    <DialogContent>
      <DialogContentText>Apakah Anda yakin ingin menghapus dokumen pendukung ini?</DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit">Batal</Button>
      <Button onClick={onConfirm} color="error" variant="contained">Hapus</Button>
    </DialogActions>
  </Dialog>
);

// Dialog Tambah Dokumen Pendukung
export const AttachSupportingDocumentDialog = ({
  open, onClose, company, sectionIndex, rowIndex,
  getRootProps, getInputProps, isDragActive, files, onSubmit,
  onPaste
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle sx={{
        background: isDark ? 'linear-gradient(87deg, #283593 0%, #512da8 100%)' : 'linear-gradient(87deg, #1976d2 0%, #7e57c2 100%)',
        color: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        mb: 1,
        fontWeight: 700,
        fontSize: 18
      }}>
        Tambah Dokumen Pendukung
      </DialogTitle>
      <DialogContent sx={{
        background: isDark ? '#181a29' : '#fff',
        color: isDark ? '#e3e8ff' : undefined,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16
      }}>
        <DialogContentText sx={{ color: isDark ? '#bfc8e6' : undefined }}>
          Perusahaan: <strong>{company}</strong>, section <strong>{sectionIndex}</strong>, baris <strong>{rowIndex}</strong>
        </DialogContentText>
        <Box
          {...getRootProps()}
          onPaste={onPaste}
          sx={{
            mt: 2, p: 2, border: '3px dashed #90caf9', borderRadius: 2, textAlign: 'center',
            bgcolor: isDragActive ? (isDark ? '#23263a' : '#e3f2fd') : (isDark ? '#23263a' : '#fafafa'),
            cursor: 'pointer',
            color: isDark ? '#e3e8ff' : undefined
          }}
        >
          <input {...getInputProps()} />
          {isDragActive
            ? 'Lepaskan file di sini...'
            : 'Seret / klik / atau Ctrl-V untuk tempel gambar'}
        </Box>
        {files.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ color: isDark ? '#bfc8e6' : undefined }}>File yang akan diunggah:</Typography>
            {files.map((f, idx) => (
              <Typography key={idx} variant="body2" sx={{ color: isDark ? '#e3e8ff' : undefined }}>- {f.name}</Typography>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{
        background: isDark ? '#181a29' : '#fff',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        px: 3, pb: 2
      }}>
        <Button onClick={onClose} color="inherit" sx={{ borderRadius: 2, fontWeight: 600 }}>
          Batal
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={!files.length}
          sx={{
            borderRadius: 2,
            fontWeight: 600,
            background: isDark ? 'linear-gradient(90deg, #1976d2, #7e57c2)' : 'linear-gradient(90deg, #1976d2, #7e57c2)',
            color: '#fff',
            boxShadow: '0 3px 12px rgba(25,118,210,0.09)',
            '&:hover': {
              background: isDark
                ? 'linear-gradient(90deg, #1565c0, #512da8)'
                : 'linear-gradient(90deg, #1565c0, #7e57c2)'
            }
          }}
        >
          Unggah
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Dialog Tambah Section Baru
export const AddSectionDialog = ({ open, onClose, name, setName, subtotal, setSubtotal, onConfirm }) => (
  <Dialog open={open} onClose={onClose} fullWidth>
    <DialogTitle>Tambah Section Baru</DialogTitle>
    <DialogContent>
      <TextField fullWidth label="Nama PT (company)" value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }} />
      <TextField fullWidth label="Subtotal (opsional)" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} sx={{ mt: 2 }} />
      <DialogContentText sx={{ mt: 1 }}>
        Table header default: ["No", "KETERANGAN", "DIBAYAR KE", "BANK", "PENGIRIMAN"].
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit">Batal</Button>
      <Button onClick={onConfirm} variant="contained">Tambahkan</Button>
    </DialogActions>
  </Dialog>
);

// Dialog Konfirmasi Selesaikan Draft
export const FinishDraftDialog = ({ open, onClose, onConfirm }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const headerGradient = isDark
    ? 'linear-gradient(87deg, #283593 0%, #512da8 100%)'
    : 'linear-gradient(87deg, #1976d2 0%, #7e57c2 100%)';
  const headerText = '#fff';
  const dialogText = isDark ? '#bfc8e6' : '#344060';
  const buttonGradient = isDark
    ? 'linear-gradient(90deg, #283593, #7e57c2)'
    : 'linear-gradient(90deg, #1976d2, #7e57c2)';
  const buttonText = '#fff';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 0,
          boxShadow: '0 8px 36px 0 rgba(34,50,84,0.13)',
          background: isDark ? '#181a29' : '#fff',
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        p: 0,
        m: 0,
        background: headerGradient,
        color: headerText,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        minHeight: 54,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        mb: 0.5
      }}>
        <InfoOutlinedIcon sx={{ color: headerText, fontSize: 26, mr: 1.3, opacity: 0.95 }} />
        <Typography variant="h6" fontWeight={700} sx={{ color: headerText, fontSize: 18 }}>
          Konfirmasi Selesaikan Draft
        </Typography>
      </Box>

      <DialogContent sx={{ pt: 2 }}>
        <DialogContentText sx={{ color: dialogText, fontSize: 15.2 }}>
          Anda yakin ingin menyelesaikan Draf? Setelah draf selesai, Anda tidak dapat mengedit dokumen utama maupun dokumen pendukung.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ borderRadius: 2, fontWeight: 600 }}>
          Batal
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            borderRadius: 2,
            fontWeight: 600,
            background: buttonGradient,
            color: buttonText,
            boxShadow: '0 3px 12px rgba(25,118,210,0.09)',
            '&:hover': {
              background: isDark
                ? 'linear-gradient(90deg, #1565c0, #512da8)'
                : 'linear-gradient(90deg, #1565c0, #7e57c2)'
            }
          }}
        >
          Selesaikan
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Dialog Setujui Tagihan
export const ApproveTagihanDialog = ({ open, onClose, unapprovedDocs, onConfirm }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Color palette for dark/light mode
  const headerGradient = isDark
    ? 'linear-gradient(87deg, #283593 0%, #512da8 100%)'
    : 'linear-gradient(87deg, #1976d2 0%, #7e57c2 100%)';
  const headerText = '#fff';
  const listBg = isDark ? '#23263a' : '#f4f6fb';
  const listBorder = isDark ? '#3a4060' : '#d3defb';
  const itemBg = isDark ? '#181a29' : '#fff';
  const itemBorder = isDark ? '#2a2e44' : '#e0e6f0';
  const primaryText = isDark ? '#e3e8ff' : '#23305a';
  const dialogText = isDark ? '#bfc8e6' : '#344060';
  const iconColor = isDark ? '#90caf9' : '#1976d2';
  const headerIconColor = '#fff';
  const buttonGradient = isDark
    ? 'linear-gradient(90deg, #283593, #7e57c2)'
    : 'linear-gradient(90deg, #1976d2, #7e57c2)';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 0,
          boxShadow: '0 8px 36px 0 rgba(34,50,84,0.13)',
          background: isDark ? '#181a29' : '#fff',
        }
      }}
    >
      {/* Header - Blue gradient */}
      <Box sx={{
        p: 0,
        m: 0,
        background: headerGradient,
        color: headerText,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        minHeight: 54,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        mb: 0.5
      }}>
        <InfoOutlinedIcon sx={{ color: headerIconColor, fontSize: 26, mr: 1.3, opacity: 0.95 }} />
        <Typography variant="h6" fontWeight={700} sx={{ color: headerText, fontSize: 18 }}>
          Konfirmasi Setujui Tagihan
        </Typography>
      </Box>

      <DialogContent sx={{ pt: 2 }}>
        {unapprovedDocs.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: primaryText }}>
              Dokumen Pendukung Belum Disetujui:
            </Typography>
            <List sx={{
              bgcolor: listBg,
              borderRadius: 3,
              boxShadow: 1,
              p: 1,
              mb: 1,
              border: `1px solid ${listBorder}`,
              maxHeight: 220,
              overflowY: 'auto'
            }}>
              {unapprovedDocs.map((ud, idx) => (
                <motion.div
                  key={ud.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * idx }}
                >
                  <ListItem
                    sx={{
                      px: 1.4,
                      py: 0.7,
                      alignItems: 'flex-start',
                      borderRadius: 2,
                      mb: 0.5,
                      bgcolor: itemBg,
                      boxShadow: 0,
                      border: `1px solid ${itemBorder}`,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, mt: 0.4 }}>
                      <InfoOutlinedIcon sx={{ color: iconColor, fontSize: 20, opacity: 0.92 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            color: primaryText,
                            fontSize: 15.2,
                            letterSpacing: 0.04,
                            wordBreak: 'break-word',
                            textShadow: isDark ? '0 1px 0 rgba(20,20,30,0.10)' : '0 1px 0 rgba(248,248,248,0.10)'
                          }}
                        >
                          {ud.itemDescription}
                        </Typography>
                      }
                    />
                  </ListItem>
                  {idx < unapprovedDocs.length - 1 && (
                    <Divider variant="inset" sx={{ my: 0.3, ml: 4, mr: 0, borderColor: isDark ? '#2a2e44' : undefined }} />
                  )}
                </motion.div>
              ))}
            </List>
          </Box>
        )}
        <DialogContentText sx={{ color: dialogText, mb: 1.5 }}>
          Apakah Anda yakin ingin menyetujui tagihan ini? <strong>Tindakan ini tidak dapat dibatalkan.</strong>
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ borderRadius: 2, fontWeight: 600 }}>
          Batal
        </Button>
        <Tooltip title={unapprovedDocs.length ? "Semua dokumen pendukung harus disetujui dulu." : ""}>
          <span>
            <Button
              onClick={onConfirm}
              variant="contained"
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                background: isDark
                  ? 'linear-gradient(90deg, #43a047, #66bb6a)'
                  : 'linear-gradient(90deg, #43a047, #b2ff59)',
                color: '#fff',
                boxShadow: '0 3px 12px rgba(67,160,71,0.09)',
                '&:hover': {
                  background: isDark
                    ? 'linear-gradient(90deg, #388e3c, #43a047)'
                    : 'linear-gradient(90deg, #388e3c, #b2ff59)'
                }
              }}
              disabled={!!unapprovedDocs.length}
            >
              Setujui Tagihan
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

// Dialog Alasan Penolakan
export const RejectReasonDialog = ({ open, onClose, reason, setReason, onConfirm }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const headerGradient = isDark
    ? 'linear-gradient(87deg, #283593 0%, #512da8 100%)'
    : 'linear-gradient(87deg, #1976d2 0%, #7e57c2 100%)';
  const headerText = '#fff';
  const dialogText = isDark ? '#bfc8e6' : '#344060';
  const textFieldBg = isDark ? '#23263a' : '#f4f6fb';
  const textFieldColor = isDark ? '#e3e8ff' : undefined;
  const buttonGradient = isDark
    ? 'linear-gradient(90deg, #c62828 60%, #7e57c2 100%)'
    : 'linear-gradient(90deg, #f44336 60%, #7e57c2 100%)';
  const buttonText = '#fff';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 0,
          boxShadow: '0 8px 36px 0 rgba(34,50,84,0.13)',
          background: isDark ? '#181a29' : '#fff',
        }
      }}
    >
      {/* Header - Blue/Purple Gradient */}
      <Box sx={{
        p: 0,
        m: 0,
        background: headerGradient,
        color: headerText,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        minHeight: 54,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        mb: 0.5
      }}>
        <InfoOutlinedIcon sx={{ color: headerText, fontSize: 26, mr: 1.3, opacity: 0.95 }} />
        <Typography variant="h6" fontWeight={700} sx={{ color: headerText, fontSize: 18 }}>
          Alasan Penolakan Dokumen
        </Typography>
      </Box>

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" sx={{ color: dialogText, mb: 1.5, fontWeight: 500 }}>
          Mohon berikan alasan penolakan dokumen di bawah ini:
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="Alasan Penolakan"
          type="text"
          fullWidth
          multiline
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{
            background: textFieldBg,
            borderRadius: 2,
            color: textFieldColor,
            '& .MuiInputBase-input': {
              color: textFieldColor
            },
            '& .MuiInputLabel-root': {
              color: isDark ? '#bfc8e6' : undefined
            }
          }}
          InputLabelProps={{ style: { color: isDark ? '#bfc8e6' : undefined } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ borderRadius: 2, fontWeight: 600 }}>
          Batal
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          sx={{
            borderRadius: 2,
            fontWeight: 600,
            background: buttonGradient,
            color: buttonText
          }}
        >
          Tolak Dokumen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Dialog Konfirmasi Perbaikan Dokumen
export const ReviseConfirmationDialog = ({ open, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Konfirmasi Perbaikan Dokumen</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Anda yakin semua dokumen sudah benar? Setelah dikonfirmasi, dokumen akan kembali berstatus "Belum Disetujui".
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit">Batal</Button>
      <Button onClick={onConfirm} variant="contained" color="primary">Ya, Perbaiki</Button>
    </DialogActions>
  </Dialog>
);

/* --- Konfirmasi Selesaikan Pembayaran --- */
export const PaymentCompleteDialog = ({ open, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Konfirmasi Selesaikan Pembayaran</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Semua item sudah memiliki <strong>PAY_REF</strong>. Klik “Selesaikan” untuk menandai
        dokumen ini sebagai <em>Sudah Dibayar</em>. Tindakan ini tidak dapat dibatalkan.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit">Batal</Button>
      <Button onClick={onConfirm} variant="contained" color="success">Selesaikan</Button>
    </DialogActions>
  </Dialog>
);



/* -- NEW: dialog untuk input / edit PAY_REF per-item -- */
export const PaymentReferenceDialog = ({
  open,
  onClose,
  onSave,
  defaultValue = '',
}) => {
  const [refValue, setRefValue] = useState(defaultValue);

  const handleSave = () => {
    if (!refValue.trim()) {
      alert('Referensi pembayaran tidak boleh kosong.');
      return;
    }
    onSave(refValue.trim());
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Masukkan Referensi Pembayaran</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Isi nomor / kode referensi transfer untuk item ini.
        </DialogContentText>
        <TextField
          fullWidth
          autoFocus
          margin="dense"
          label="PAY_REF"
          value={refValue}
          onChange={(e) => setRefValue(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Batal
        </Button>
        <Button onClick={handleSave} variant="contained">
          Simpan
        </Button>
      </DialogActions>
    </Dialog>
  );
};
