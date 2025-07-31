// fix(src/components/MissingDocsDialog.jsx): New dialog to show items missing supporting docs

import React from 'react';
import {
  Dialog,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  ListItemIcon,
  Box,
  useTheme
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { motion } from 'framer-motion';

/**
 * Props:
 * - open: boolean -> apakah dialog terbuka
 * - onClose: func -> dipanggil saat user menutup dialog
 * - missingItems: array of objects -> daftar item yang belum punya dok pendukung
 *    Tiap objek { sectionIndex, rowIndex, sectionName, rowData (array of cell values) }
 */
function MissingDocsDialog({ open, onClose, missingItems = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Color palette for dark/light mode
  const headerGradient = isDark
    ? 'linear-gradient(87deg, #283593 0%, #512da8 100%)'
    : 'linear-gradient(87deg, #1976d2 0%, #7e57c2 100%)';
  const headerText = isDark ? '#fff' : '#fff';
  const listBg = isDark ? '#23263a' : '#f4f6fb';
  const listBorder = isDark ? '#3a4060' : '#d3defb';
  const itemBg = isDark ? '#181a29' : '#fff';
  const itemBorder = isDark ? '#2a2e44' : '#e0e6f0';
  const primaryText = isDark ? '#e3e8ff' : '#23305a';
  const secondaryText = isDark ? '#bfc8e6' : theme.palette.text.secondary;
  const buttonGradient = isDark
    ? 'linear-gradient(90deg, #283593, #7e57c2)'
    : 'linear-gradient(90deg, #1976d2, #7e57c2)';
  const buttonText = '#fff';
  const iconColor = isDark ? '#90caf9' : '#1976d2';
  const headerIconColor = isDark ? '#fff' : '#fff';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
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
        <InfoOutlinedIcon sx={{ color: headerIconColor, fontSize: 28, mr: 1.3, opacity: 0.95 }} />
        <Typography variant="h6" fontWeight={700} sx={{ color: headerText, fontSize: 18 }}>
          Perhatian
        </Typography>
      </Box>

      {/* Body */}
      <Box sx={{ px: 3, pt: 2, pb: 0.7 }}>
        <Typography sx={{ color: primaryText, mb: 2, fontSize: 15.2, fontWeight: 500 }}>
          Sebelum menyelesaikan draft, lengkapi dokumen pendukung berikut:
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
          {missingItems.length > 0 ? missingItems.map((item, idx) => {
            const { sectionName, rowIndex, rowData } = item;
            return (
              <motion.div
                key={sectionName + (rowIndex + 1)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * idx }}
              >
                <ListItem
                  sx={{
                    px: 1.3,
                    py: 0.65,
                    borderRadius: 2,
                    mb: 0.5,
                    bgcolor: itemBg,
                    border: `1px solid ${itemBorder}`,
                    boxShadow: 0,
                    fontWeight: 600,
                    fontSize: 15,
                    alignItems: 'flex-start'
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.3 }}>
                    <InfoOutlinedIcon sx={{ color: iconColor, fontSize: 19, opacity: 0.88 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={600} color={primaryText}>
                        {sectionName ? `${sectionName} no. ${rowIndex + 1}` : `Item #${rowIndex + 1}`}
                      </Typography>
                    }
                    secondary={
                      rowData && rowData[1] ? (
                        <Typography variant="caption" sx={{ color: secondaryText }}>
                          {`Keterangan: ${rowData[1]}`}
                        </Typography>
                      ) : null
                    }
                  />
                </ListItem>
              </motion.div>
            );
          }) : (
            <Typography variant="body2" sx={{ color: secondaryText, py: 2 }}>
              Tidak ada item yang terdeteksi (seharusnya dialog ini tidak muncul).
            </Typography>
          )}
        </List>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
          <Button
            variant="contained"
            onClick={onClose}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              fontWeight: 600,
              background: buttonGradient,
              color: buttonText,
              boxShadow: "0 3px 12px rgba(25,118,210,0.09)"
            }}
          >
            OK
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

export default MissingDocsDialog;
