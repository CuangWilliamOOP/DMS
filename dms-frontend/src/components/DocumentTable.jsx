// File: src/components/DocumentTable.jsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

import {
  DeleteMainDocumentDialog,
  DeleteSupportingDocumentDialog,
  AttachSupportingDocumentDialog,
  AddSectionDialog,
  FinishDraftDialog,
  ApproveTagihanDialog,
  RejectReasonDialog,
  ReviseConfirmationDialog,
} from './Dialogs';

import { useDropzone } from 'react-dropzone';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AddIcon from '@mui/icons-material/Add';
import HelpIcon from '@mui/icons-material/Help';
import { Tooltip } from '@mui/material';
import API from '../services/api';
import {
  canEditMainDocument,
  canFinishDraft,
  canEditDelete,

} from '../utils/rolePermissions';

import {
  ItemDocsPreview,
  EditableTableCell,
  EditableInlineText,
} from './DocumentTableParts';

import MissingDocsDialog from './MissingDocsDialog';

function DocumentTable({ documents, refreshDocuments }) {
  const [expandedRows, setExpandedRows] = useState([]);
  const [itemDocsExpandedMap, setItemDocsExpandedMap] = useState({});
  const [supportingDocs, setSupportingDocs] = useState({});
  const [parsedSectionsMap, setParsedSectionsMap] = useState({});
  const [editDocId, setEditDocId] = useState(null);
  // Dialog states
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [confirmSupportingDialogOpen, setConfirmSupportingDialogOpen] = useState(false);
  const [supportingDocToDelete, setSupportingDocToDelete] = useState(null);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [attachDocMainId, setAttachDocMainId] = useState(null);
  const [attachDocCompany, setAttachDocCompany] = useState('');
  const [attachDocSectionIndex, setAttachDocSectionIndex] = useState(null);
  const [attachDocRowIndex, setAttachDocRowIndex] = useState(null);
  const [attachDocFiles, setAttachDocFiles] = useState([]);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState('PT. ALS');
  const [newSectionInitialSubtotal, setNewSectionInitialSubtotal] = useState('');
  const [confirmFinishDraftOpen, setConfirmFinishDraftOpen] = useState(false);
  const [docToFinish, setDocToFinish] = useState(null);
  const [missingDocsDialogOpen, setMissingDocsDialogOpen] = useState(false);
  const [missingItems, setMissingItems] = useState([]);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [docToApprove, setDocToApprove] = useState(null);
  const [unapprovedDocs, setUnapprovedDocs] = useState([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [docToReject, setDocToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogContent, setDialogContent] = useState('');
  const [confirmReviseOpen, setConfirmReviseOpen] = useState(false);
  const [docToRevise, setDocToRevise] = useState(null);

  const userRole = localStorage.getItem('role');
  const expandDocTypes = [
    'tagihan_pekerjaan',
    'pembayaran_pekerjaan',
    'ledger_lokasi',
    'penggantian_kas_kantor',
    'pembelian_sparepart',
    'biaya_pengeluaran_proyek',
  ];

  // Dropzone for attaching supporting docs
  const onDrop = useCallback((acceptedFiles) => {
    setAttachDocFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/msword': ['.doc', '.docx'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
    },
  });
  
  const openRejectDialog = (doc) => {
    setDocToReject(doc);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  async function handleRejectConfirm() {
    if (!docToReject) return;
    if (!rejectReason.trim()) {
      alert('Alasan penolakan harus diisi.');
      return;
    }
  
    try {
      await API.patch(`/documents/${docToReject.id}/`, {
        status: 'rejected',
        reject_comment: rejectReason,
      });
      alert('Dokumen berhasil ditolak.');
      refreshDocuments();
    } catch (error) {
      console.error('Gagal menolak dokumen:', error);
      alert('Terjadi kesalahan saat menolak dokumen.');
    } finally {
      setRejectDialogOpen(false);
      setDocToReject(null);
    }
  }
  
  
  function toggleRow(docId, docType) {
    if (!expandDocTypes.includes(docType)) return;
  
    if (expandedRows.includes(docId)) {
      setExpandedRows((prev) => prev.filter((id) => id !== docId));
      
      // Tambahan penting di sini
      setItemDocsExpandedMap((prev) => {
        const newState = { ...prev };
        Object.keys(newState).forEach((key) => {
          if (key.startsWith(`${docId}-`)) {
            delete newState[key];
          }
        });
        return newState;
      });
  
    } else {
      if (!supportingDocs[docId]) {
        API.get('/supporting-docs/', { params: { main_document: docId } })
          .then((res) => setSupportingDocs((old) => ({ ...old, [docId]: res.data })))
          .catch(console.error);
      }
      if (!parsedSectionsMap[docId]) {
        API.get(`/documents/${docId}/`)
          .then((res) =>
            setParsedSectionsMap((old) => ({ ...old, [docId]: res.data.parsed_json || [] }))
          )
          .catch(console.error);
      }
      setExpandedRows((prev) => [...prev, docId]);
      setEditDocId(docId);
    }
  }
  

  function handleToggleItemDocs(docId, sectionIndex, rowIndex) {
    const key = `${docId}-${sectionIndex}-${rowIndex}`;
    setItemDocsExpandedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleReviseRejectedDoc(doc) {
    setDocToRevise(doc);
    setConfirmReviseOpen(true);
  }

  async function handleReviseConfirm() {
    if (!docToRevise) return;
  
    try {
      await API.patch(`/documents/${docToRevise.id}/`, { status: 'belum_disetujui' });
      refreshDocuments();
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat memperbaiki dokumen.');
    } finally {
      setConfirmReviseOpen(false);
      setDocToRevise(null);
    }
  }
  
  // Add / remove rows and sections, update cells, subtotal, grand total...

  async function handleAddSectionRow(sectionIndex) {
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const section = oldSections[sectionIndex];
    if (!section || !Array.isArray(section.table)) return;
    const newRow = ['-', '-', '-', '-', '-'];
    const newTable = [...section.table, newRow];
    const newSection = { ...section, table: newTable };
    const newSections = [
      ...oldSections.slice(0, sectionIndex),
      newSection,
      ...oldSections.slice(sectionIndex + 1),
    ];
    try {
      await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: newSections }));
    } catch (error) {
      console.error(error);
      alert('Gagal menambahkan baris baru.');
    }
  }

  async function handleRemoveSectionRow(sectionIndex, rowIndex) {
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const section = oldSections[sectionIndex];
    if (!section || !Array.isArray(section.table)) return;
    const newTable = section.table.filter((_, idx) => idx !== rowIndex + 1);
    const newSection = { ...section, table: newTable };
    const newSections = [
      ...oldSections.slice(0, sectionIndex),
      newSection,
      ...oldSections.slice(sectionIndex + 1),
    ];
    try {
      await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: newSections }));
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus baris.');
    }
  }

  async function handleAddSectionConfirm() {
    setShowAddSectionDialog(false);
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const newSection = {
      company: newSectionName,
      table: [['No', 'KETERANGAN', 'DIBAYAR KE', 'BANK', 'PENGIRIMAN']],
      subtotal: newSectionInitialSubtotal || '',
    };
    const newSections = [...oldSections];
    if (newSections.length > 0 && newSections[newSections.length - 1].hasOwnProperty('grand_total')) {
      newSections.splice(newSections.length - 1, 0, newSection);
    } else {
      newSections.push(newSection);
    }
    try {
      await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: newSections }));
      alert('Section baru ditambahkan.');
    } catch (error) {
      console.error(error);
      alert('Gagal menambahkan section baru.');
    }
  }

  async function handleRemoveSection(sectionIndex) {
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const newSections = oldSections.filter((_, idx) => idx !== sectionIndex);
    try {
      await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: newSections }));
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus section.');
    }
  }

  async function handleUpdateCell(sectionIndex, rowIndex, cellIndex, newValue) {
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const section = oldSections[sectionIndex];
    if (!section || !Array.isArray(section.table)) return;
    const dataRowIndex = rowIndex + 1;
    if (!section.table[dataRowIndex]) return;
    const newTable = section.table.map((row, idx) =>
      idx === dataRowIndex
        ? row.map((cell, cIdx) => (cIdx === cellIndex ? newValue : cell))
        : row
    );
    const newSection = { ...section, table: newTable };
    const newSections = [
      ...oldSections.slice(0, sectionIndex),
      newSection,
      ...oldSections.slice(sectionIndex + 1),
    ];
    try {
      await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: newSections }));
    } catch (error) {
      console.error(error);
      alert('Gagal mengupdate nilai sel.');
    }
  }

  async function handleUpdateSubtotal(sectionIndex, newVal) {
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const section = oldSections[sectionIndex];
    if (!section) return;
    const newSection = { ...section, subtotal: newVal };
    const newSections = [
      ...oldSections.slice(0, sectionIndex),
      newSection,
      ...oldSections.slice(sectionIndex + 1),
    ];
    try {
      await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: newSections }));
    } catch (error) {
      console.error(error);
      alert('Gagal mengupdate subtotal.');
    }
  }

  async function handleUpdateGrandTotal(sectionIndex, newVal) {
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const section = oldSections[sectionIndex];
    if (!section || !section.hasOwnProperty('grand_total')) return;
    const newSection = { ...section, grand_total: newVal };
    const newSections = [
      ...oldSections.slice(0, sectionIndex),
      newSection,
      ...oldSections.slice(sectionIndex + 1),
    ];
    try {
      await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: newSections }));
    } catch (error) {
      console.error(error);
      alert('Gagal mengupdate grand total.');
    }
  }

  // Attach / delete supporting docs
  function handleAttachDocClick(docId, company, sectionIndex, rowIndex) {
    setAttachDocMainId(docId);
    setAttachDocCompany(company);
    setAttachDocSectionIndex(sectionIndex);
    setAttachDocRowIndex(rowIndex);
    setAttachDocFiles([]);
    setAttachDialogOpen(true);
  }

  async function handleAttachDocSubmit() {
    if (!attachDocMainId || attachDocFiles.length === 0) {
      alert('Lengkapi info dok pendukung terlebih dahulu!');
      return;
    }
    try {
      for (const file of attachDocFiles) {
        const formData = new FormData();
        formData.append('main_document', attachDocMainId);
        formData.append('file', file);
        formData.append('company_name', attachDocCompany);
        formData.append('section_index', attachDocSectionIndex);
        formData.append('row_index', attachDocRowIndex);
        await API.post('/supporting-docs/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      const res = await API.get('/supporting-docs/', {
        params: { main_document: attachDocMainId },
      });
      setSupportingDocs((old) => ({ ...old, [attachDocMainId]: res.data }));
      alert('Dokumen pendukung berhasil diupload!');
    } catch (err) {
      console.error(err);
      alert('Gagal mengupload dokumen pendukung.');
    } finally {
      setAttachDialogOpen(false);
    }
  }

  function handleDeleteClick(doc) {
    setDocToDelete(doc);
    setConfirmDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!docToDelete) return;
    try {
      await API.delete(`/documents/${docToDelete.id}/`);
      refreshDocuments();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus dokumen utama.');
    } finally {
      setConfirmDialogOpen(false);
      setDocToDelete(null);
    }
  }

  function handleDeleteSupportingClick(sdoc) {
    setSupportingDocToDelete(sdoc);
    setConfirmSupportingDialogOpen(true);
  }

  async function handleDeleteSupportingConfirm() {
    if (!supportingDocToDelete) return;
    try {
      await API.delete(`/supporting-docs/${supportingDocToDelete.id}/`);
      const mainId = supportingDocToDelete.main_document;
      setSupportingDocs((old) => ({
        ...old,
        [mainId]: (old[mainId] || []).filter((d) => d.id !== supportingDocToDelete.id),
      }));
      alert('Dokumen pendukung berhasil dihapus!');
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus dokumen pendukung.');
    } finally {
      setConfirmSupportingDialogOpen(false);
      setSupportingDocToDelete(null);
    }
  }

  function handleFinishDraftClick(doc) {
    setDocToFinish(doc);
    setConfirmFinishDraftOpen(true);
  }

  async function handleRejectDoc(doc, reason) {
    try {
      await API.patch(`/documents/${doc.id}/`, {
        status: 'rejected',
        reject_comment: reason,
      });
      alert('Dokumen berhasil ditolak!');
      refreshDocuments();
    } catch (error) {
      console.error('Error rejecting document:', error);
      alert('Gagal menolak dokumen.');
    }
  }
  

  async function handleFinishDraftConfirm() {
    if (!docToFinish) return;

    // fetch supporting docs & parsed sections if needed
    let sDocs = supportingDocs[docToFinish.id];
    if (!sDocs) {
      const res = await API.get('/supporting-docs/', { params: { main_document: docToFinish.id } });
      sDocs = res.data;
    }
    let parsed = parsedSectionsMap[docToFinish.id];
    if (!parsed) {
      const docRes = await API.get(`/documents/${docToFinish.id}/`);
      parsed = docRes.data.parsed_json || [];
    }

    const missing = [];
    parsed.forEach((section, sIdx) => {
      if (section.hasOwnProperty('grand_total')) return;
      const rows = section.table.slice(1);
      rows.forEach((rowData, rIdx) => {
        const docsForItem = sDocs.filter(
          (sd) => sd.section_index === sIdx && sd.row_index === rIdx
        );
        if (docsForItem.length === 0) {
          missing.push({
            sectionIndex: sIdx,
            rowIndex: rIdx,
            sectionName: section.company || 'Unknown',
            rowData,
          });
        }
      });
    });

    if (missing.length > 0) {
      setMissingItems(missing);
      setMissingDocsDialogOpen(true);
      setConfirmFinishDraftOpen(false);
      return;
    }

    try {
      await API.patch(`/documents/${docToFinish.id}/`, { status: 'belum_disetujui' });
      refreshDocuments();
      alert('Dokumen berhasil diselesaikan dan status menjadi Belum Disetujui.');
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menyelesaikan draf.');
    } finally {
      setConfirmFinishDraftOpen(false);
      setDocToFinish(null);
    }
  }

  function handleOpenApproveDialog(doc) {
    setDocToApprove(doc);
    let sDocs = supportingDocs[doc.id];
    if (!sDocs) {
      API.get('/supporting-docs/', { params: { main_document: doc.id } }).then((res) => {
        setUnapprovedDocs(res.data.filter((sd) => sd.status !== 'disetujui'));
      });
    } else {
      setUnapprovedDocs(sDocs.filter((sd) => sd.status !== 'disetujui'));
    }
    setConfirmApproveOpen(true);
  }

  async function handleConfirmApproveTagihan() {
    if (!docToApprove) return;
    try {
      await API.patch(`/documents/${docToApprove.id}/`, { status: 'disetujui' });
      refreshDocuments();
      alert(`Tagihan "${docToApprove.title}" berhasil disetujui!`);
    } catch (err) {
      console.error(err);
      alert('Gagal menyetujui tagihan.');
    } finally {
      setConfirmApproveOpen(false);
      setDocToApprove(null);
      setUnapprovedDocs([]);
    }
  }

  // Helpers for formatting
  function formatIndoDateTime(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('id-ID');
  }
  function formatDocType(value) {
    return value
      ? value
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : '';
  }
  function formatCompany(value) {
    return value ? value.toUpperCase() : '';
  }

  async function handleSetPaymentReference(doc, reference) {
    try {
      await API.patch(`/documents/${doc.id}/`, {
        status: 'sudah_dibayar',
        payment_reference: reference,
      });
      alert('Referensi pembayaran berhasil disimpan, dokumen sekarang statusnya "Sudah Dibayar"!');
      refreshDocuments(); // untuk merefresh tabel
    } catch (error) {
      console.error('Error menyimpan referensi pembayaran:', error);
      alert('Gagal menyimpan referensi pembayaran.');
    }
  }
  

  // Render each PT. section as a Paper card with coloured left bar,
  // and alternate row backgrounds in the table
  function renderCompanyTableSections(parsedData, docId, docStatus, docObj) {
    if (!Array.isArray(parsedData)) return null;

    return parsedData.map((section, sectionIndex) => {
      // Grand total
      if (section.hasOwnProperty('grand_total')) {
        return (
      <Box
        key={`grand-${sectionIndex}`}
        sx={{
          mt: 2,
          p: 1,
          border: '1px solid #ccc',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            GRAND TOTAL:
          </Typography>
          <EditableInlineText
            value={section.grand_total || ''}
            canEdit={canEditMainDocument(userRole, docStatus)}
            onChange={(newVal) => handleUpdateGrandTotal(sectionIndex, newVal)}
          />
        </Box>

        {/* Tombol Setujui Tagihan dan Tolak */}
        {userRole === 'higher-up' && docStatus === 'belum_disetujui' && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="success"
              onClick={() => handleOpenApproveDialog(docObj)}
            >
              Setujui Tagihan
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => openRejectDialog(docObj)}
            >
              Tolak
            </Button>

          </Box>
        )}

        {/* Tombol Tambah Referensi Pembayaran */}
        {userRole === 'higher-up' && docStatus === 'disetujui' && (
          <Button
            variant="contained"
            color="info"
            onClick={() => {
              const reference = prompt('Masukkan Referensi Pembayaran:');
              if (reference) handleSetPaymentReference(docObj, reference);
            }}
          >
            Masukkan Referensi Pembayaran
          </Button>
        )}

        {/* Tombol Hapus setelah dokumen ditolak */}
        {userRole === 'higher-up' && docStatus === 'rejected' && (
          <Button
            variant="contained"
            color="error"
            sx={{ ml: 1 }}
            onClick={() => handleDeleteClick(docObj)}
          >
            Hapus Dokumen
          </Button>
        )}

        {/* Tampilkan alasan penolakan hanya di tampilan employee */}
        {userRole === 'employee' && docStatus === 'rejected' && docObj.reject_comment && (
          <>
            <Tooltip title="Klik untuk lihat alasan penolakan">
              <IconButton
                color="error"
                size="small"
                onClick={() => {
                  setDialogContent(docObj.reject_comment);
                  setOpenDialog(true);
                }}
              >
                <HelpIcon />
              </IconButton>
            </Tooltip>

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
              <DialogTitle>Alasan Penolakan</DialogTitle>
              <DialogContent>
                <Typography>{dialogContent}</Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setOpenDialog(false)}>Tutup</Button>
              </DialogActions>
            </Dialog>
          </>
        )}

      </Box>

        );
      }

      const { company, table, subtotal } = section;
      const hasTable = Array.isArray(table) && table.length > 0;
      const headerRow = hasTable ? table[0] : [];
      const dataRows = hasTable ? table.slice(1) : [];

      return (
        <Paper
          key={`section-${sectionIndex}`}
          elevation={1}
          sx={{
            mt: 2,
            p: 2,
            borderLeft: '4px solid #1976d2',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {company || 'PT. UNKNOWN'}
            </Typography>
            {canEditMainDocument(userRole, docStatus) && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => handleRemoveSection(sectionIndex)}
              >
                Hapus Section
              </Button>
            )}
          </Box>

          {hasTable ? (
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  {headerRow.map((headerCell, i) => {
                    let cellWidth = '20%';
                    if (headerCell.toUpperCase() === 'NO') cellWidth = '5%';
                    else if (headerCell.toUpperCase() === 'KETERANGAN') cellWidth = '40%';
                    return (
                      <TableCell key={`header-${i}`} sx={{ fontWeight: 'bold', width: cellWidth }}>
                        {headerCell}
                      </TableCell>
                    );
                  })}
                  <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Aksi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dataRows.map((row, rowIndex) => {
                  const itemDocs = (supportingDocs[docId] || []).filter(
                    (sd) => sd.section_index === sectionIndex && sd.row_index === rowIndex
                  );
                  const expanded = !!itemDocsExpandedMap[`${docId}-${sectionIndex}-${rowIndex}`];

                  return (
                    <React.Fragment key={rowIndex}>
                      <TableRow
                        sx={{
                          backgroundColor: rowIndex % 2 === 0 ? 'white' : '#fafafa',
                        }}
                      >
                        {row.map((cell, cellIndex) => (
                          <EditableTableCell
                            key={cellIndex}
                            value={cell}
                            canEdit={canEditMainDocument(userRole, docStatus)}
                            onChangeValue={(newVal) =>
                              handleUpdateCell(sectionIndex, rowIndex, cellIndex, newVal)
                            }
                          />
                        ))}
                        <TableCell>
                          <Box sx={{ display: 'inline-flex', gap: 1 }}>
                            {canEditMainDocument(userRole, docStatus) && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() =>
                                  handleAttachDocClick(docId, company, sectionIndex, rowIndex)
                                }
                              >
                                Dok
                              </Button>
                            )}
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleToggleItemDocs(docId, sectionIndex, rowIndex)}
                            >
                              {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                            {canEditMainDocument(userRole, docStatus) && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveSectionRow(sectionIndex, rowIndex)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={headerRow.length + 1} sx={{ p: 0 }}>
                          <Collapse in={expanded} timeout="auto" unmountOnExit>
                            <Box sx={{ m: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                Dokumen Pendukung: {itemDocs.length}
                              </Typography>
                              <ItemDocsPreview
                                itemDocs={itemDocs}
                                userRole={userRole}
                                mainDocStatus={docStatus}
                                handleDeleteSupportingClick={handleDeleteSupportingClick}
                                onDocApproved={(updatedDoc) => {
                                  const mainDocId = updatedDoc.main_document;
                                  setSupportingDocs((old) => {
                                    const arr = old[mainDocId] || [];
                                    const newArr = arr.map((od) =>
                                      od.id === updatedDoc.id ? updatedDoc : od
                                    );
                                    return { ...old, [mainDocId]: newArr };
                                  });
                                }}
                              />
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
                {canEditMainDocument(userRole, docStatus) && (
                  <TableRow>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleAddSectionRow(sectionIndex)}
                        sx={{
                          background: 'linear-gradient(45deg, #42a5f5 30%, #2196f3 90%)',
                          color: '#fff',
                          borderRadius: '50%',
                          width: 28,
                          height: 28,
                          '&:hover': {
                            background: 'linear-gradient(45deg, #2196f3 30%, #1e88e5 90%)',
                          },
                        }}
                      >
                        <AddIcon fontSize="inherit" />
                      </IconButton>
                    </TableCell>
                    {headerRow.slice(1).map((_, idx) => (
                      <TableCell key={`empty-${idx}`} />
                    ))}
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2">Tidak ada data tabel GPT.</Typography>
          )}

          <Box sx={{ mt: 1, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Subtotal:
            </Typography>
            <EditableInlineText
              value={subtotal || ''}
              canEdit={canEditMainDocument(userRole, docStatus)}
              onChange={(newVal) => handleUpdateSubtotal(sectionIndex, newVal)}
            />
          </Box>
        </Paper>
      );
    });
  }

  return (
    <>
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>KODE</TableCell>
              <TableCell>NAMA</TableCell>
              <TableCell>PERUSAHAAN</TableCell>
              <TableCell>JENIS</TableCell>
              <TableCell>DIBUAT</TableCell>
              <TableCell>STATUS</TableCell>
              {/* Kolom Aksi hanya jika owner */}
              {userRole === 'owner' && <TableCell>Aksi</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc) => {
              const isExpanded = expandedRows.includes(doc.id);
              return (
                <React.Fragment key={doc.id}>
                  <TableRow>
                    <TableCell>
                      {expandDocTypes.includes(doc.doc_type) && (
                        <IconButton size="small" onClick={() => toggleRow(doc.id, doc.doc_type)}>
                          {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      )}
                    </TableCell>
                    <TableCell>{doc.document_code}</TableCell>
                    <TableCell>{doc.title}</TableCell>
                    <TableCell>{formatCompany(doc.company)}</TableCell>
                    <TableCell>{formatDocType(doc.doc_type)}</TableCell>
                    <TableCell>{formatIndoDateTime(doc.created_at)}</TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'inline-block',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '12px',
                          bgcolor:
                            doc.status === 'disetujui'
                              ? 'success.main'
                              : doc.status === 'belum_disetujui'
                              ? 'warning.main'
                              : doc.status === 'rejected'
                              ? 'error.main'
                              : doc.status === 'sudah_dibayar'
                              ? 'primary.main'
                              : 'grey.500',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          textAlign: 'center',
                        }}
                      >
                        {doc.status === 'disetujui'
                          ? 'Disetujui'
                          : doc.status === 'belum_disetujui'
                          ? 'Belum Disetujui'
                          : doc.status === 'rejected'
                          ? 'Ditolak'
                          : doc.status === 'sudah_dibayar'
                          ? 'Sudah Dibayar'
                          : 'Dalam Draf'}
                      </Box>
                    </TableCell>
                    {/* Tombol hapus hanya untuk owner */}
                    {userRole === 'owner' && (
                      <TableCell>
                        {canEditDelete(userRole, doc.status) && (
                          <IconButton color="error" onClick={() => handleDeleteClick(doc)}>
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    )}
                  </TableRow>

                  {/* ...ROW COLLAPSE & SECTION (TIDAK ADA PERUBAHAN) */}
                  {expandDocTypes.includes(doc.doc_type) && (
                    <TableRow>
                      <TableCell colSpan={userRole === 'owner' ? 8 : 7} sx={{ p: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ m: 2 }}>
                            {parsedSectionsMap[doc.id] && parsedSectionsMap[doc.id].length > 0 ? (
                              <>
                                {renderCompanyTableSections(
                                  parsedSectionsMap[doc.id],
                                  doc.id,
                                  doc.status,
                                  doc
                                )}
                                {canEditMainDocument(userRole, doc.status) && (
                                  <Box sx={{ textAlign: 'right', mt: 2 }}>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => {
                                        setEditDocId(doc.id);
                                        setNewSectionName('PT. ALS');
                                        setNewSectionInitialSubtotal('');
                                        setShowAddSectionDialog(true);
                                      }}
                                    >
                                      + Section
                                    </Button>
                                  </Box>
                                )}
                                {(canFinishDraft(userRole, doc.status) || (userRole === 'employee' && doc.status === 'rejected')) && (
                                  <Box sx={{ textAlign: 'right', mt: 3 }}>
                                    <Button
                                      variant="contained"
                                      color="primary"
                                      onClick={() => {
                                        if (doc.status === 'draft') handleFinishDraftClick(doc);
                                        else if (doc.status === 'rejected') handleReviseRejectedDoc(doc);
                                      }}
                                    >
                                      {doc.status === 'draft' ? 'Selesaikan Draft' : 'Perbaiki'}
                                    </Button>
                                    {/* Tombol hapus hanya ada saat status draft untuk employee */}
                                    {userRole === 'employee' && doc.status === 'draft' && (
                                      <Button variant="contained" color="error" sx={{ ml: 1 }} onClick={() => handleDeleteClick(doc)}>
                                        Hapus Draf
                                      </Button>
                                    )}
                                  </Box>
                                )}
                              </>
                            ) : (
                              <Typography variant="body2">
                                Tidak ada data GPT (parsed_json) untuk dokumen ini.
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {documents.length === 0 && (
              <TableRow>
                <TableCell colSpan={userRole === 'owner' ? 8 : 7} align="center">
                  Tidak ada data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <>
      <DeleteMainDocumentDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
      <DeleteSupportingDocumentDialog
        open={confirmSupportingDialogOpen}
        onClose={() => setConfirmSupportingDialogOpen(false)}
        onConfirm={handleDeleteSupportingConfirm}
      />
      <AttachSupportingDocumentDialog
        open={attachDialogOpen}
        onClose={() => setAttachDialogOpen(false)}
        company={attachDocCompany}
        sectionIndex={attachDocSectionIndex}
        rowIndex={attachDocRowIndex}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        files={attachDocFiles}
        onSubmit={handleAttachDocSubmit}
      />
      <AddSectionDialog
        open={showAddSectionDialog}
        onClose={() => setShowAddSectionDialog(false)}
        name={newSectionName}
        setName={setNewSectionName}
        subtotal={newSectionInitialSubtotal}
        setSubtotal={setNewSectionInitialSubtotal}
        onConfirm={handleAddSectionConfirm}
      />
      <FinishDraftDialog
        open={confirmFinishDraftOpen}
        onClose={() => setConfirmFinishDraftOpen(false)}
        onConfirm={handleFinishDraftConfirm}
      />
      <MissingDocsDialog
        open={missingDocsDialogOpen}
        onClose={() => setMissingDocsDialogOpen(false)}
        missingItems={missingItems}
      />
      <ApproveTagihanDialog
        open={confirmApproveOpen}
        onClose={() => setConfirmApproveOpen(false)}
        unapprovedDocs={unapprovedDocs}
        onConfirm={handleConfirmApproveTagihan}
      />

      <RejectReasonDialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        reason={rejectReason}
        setReason={setRejectReason}
        onConfirm={handleRejectConfirm}
      />
      <ReviseConfirmationDialog
        open={confirmReviseOpen}
        onClose={() => setConfirmReviseOpen(false)}
        onConfirm={handleReviseConfirm}
      />
    </>
    </>
  );
}

export default DocumentTable;