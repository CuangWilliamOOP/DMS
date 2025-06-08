// fix(src/components/MissingDocsDialog.jsx): New dialog to show items missing supporting docs

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography
} from '@mui/material';

/**
 * Props:
 * - open: boolean -> apakah dialog terbuka
 * - onClose: func -> dipanggil saat user menutup dialog
 * - missingItems: array of objects -> daftar item yang belum punya dok pendukung
 *    Tiap objek { sectionIndex, rowIndex, sectionName, rowData (array of cell values) }
 */
function MissingDocsDialog({ open, onClose, missingItems = [] }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ color: 'red', fontWeight: 'bold' }}>
          Perhatian!
        </Typography>
      </DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Beberapa item belum dilengkapi dokumen pendukung. Silakan lengkapi terlebih dahulu sebelum menyelesaikan draf.
        </DialogContentText>

        {missingItems.length > 0 ? (
          <List dense>
            {missingItems.map((item, idx) => {
              const { sectionIndex, rowIndex, sectionName, rowData } = item;
              const keteranganCell = rowData[1] || '-'; // kolom ke-2 misalnya "KETERANGAN"

              return (
                <ListItem key={idx} sx={{ mb: 1, p: 0 }}>
                  <ListItemText
                    primary={`[Section: ${sectionName || 'Unknown'}] Row #${rowIndex + 1}`}
                    secondary={`Keterangan: ${keteranganCell}`}
                  />
                </ListItem>
              );
            })}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Tidak ada item yang terdeteksi (seharusnya dialog ini tidak muncul).
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MissingDocsDialog;
