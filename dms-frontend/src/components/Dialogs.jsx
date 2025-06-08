// src/components/Dialogs.jsx
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Box, Typography, TextField } from '@mui/material';

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
export const AttachSupportingDocumentDialog = ({ open, onClose, company, sectionIndex, rowIndex, getRootProps, getInputProps, isDragActive, files, onSubmit }) => (
  <Dialog open={open} onClose={onClose} fullWidth>
    <DialogTitle>Tambah Dokumen Pendukung</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Perusahaan: <strong>{company}</strong>, section <strong>{sectionIndex}</strong>, baris <strong>{rowIndex}</strong>
      </DialogContentText>
      <Box
        {...getRootProps()}
        sx={{
          mt: 2, p: 2, border: '3px dashed #90caf9', borderRadius: 2, textAlign: 'center',
          bgcolor: isDragActive ? '#e3f2fd' : '#fafafa', cursor: 'pointer'
        }}
      >
        <input {...getInputProps()} />
        {isDragActive ? 'Lepaskan file di sini...' : 'Seret & lepaskan file di sini, atau klik'}
      </Box>
      {files.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">File yang akan diunggah:</Typography>
          {files.map((f, idx) => (
            <Typography key={idx} variant="body2">- {f.name}</Typography>
          ))}
        </Box>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit">Batal</Button>
      <Button onClick={onSubmit} variant="contained" disabled={!files.length}>Unggah</Button>
    </DialogActions>
  </Dialog>
);

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
export const FinishDraftDialog = ({ open, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle><Typography variant="h6" color="red">Perhatian!</Typography></DialogTitle>
    <DialogContent>
      <DialogContentText>
        Anda yakin ingin menyelesaikan Draf? Setelah draf selesai, Anda tidak dapat mengedit dokumen utama maupun dokumen pendukung.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit">Batal</Button>
      <Button onClick={onConfirm} variant="contained" color="primary">Selesaikan</Button>
    </DialogActions>
  </Dialog>
);

// Dialog Setujui Tagihan
export const ApproveTagihanDialog = ({ open, onClose, unapprovedDocs, onConfirm }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Konfirmasi Setujui Tagihan</DialogTitle>
    <DialogContent>
      {unapprovedDocs.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">Dokumen Pendukung Belum Disetujui:</Typography>
          <ul>
            {unapprovedDocs.map((ud) => (
              <li key={ud.id}>{ud.title || '(Untitled)'} - Status: {ud.status}</li>
            ))}
          </ul>
        </Box>
      )}
      <DialogContentText>Apakah Anda yakin ingin menyetujui tagihan ini? <strong>Tindakan ini tidak dapat dibatalkan.</strong></DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="inherit">Batal</Button>
      <Button onClick={onConfirm} variant="contained" color="success">Lanjutkan</Button>
    </DialogActions>
  </Dialog>
);

// Dialog Alasan Penolakan
export const RejectReasonDialog = ({ open, onClose, reason, setReason, onConfirm }) => (
  <Dialog open={open} onClose={onClose} fullWidth>
    <DialogTitle>Alasan Penolakan Dokumen</DialogTitle>
    <DialogContent>
      <TextField
        autoFocus margin="dense" label="Alasan Penolakan"
        type="text" fullWidth multiline minRows={3}
        value={reason} onChange={(e) => setReason(e.target.value)}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Batal</Button>
      <Button onClick={onConfirm} variant="contained" color="error">Tolak Dokumen</Button>
    </DialogActions>
  </Dialog>
);

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
