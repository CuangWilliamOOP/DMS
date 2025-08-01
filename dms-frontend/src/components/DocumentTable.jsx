// File: src/components/DocumentTable.jsx
import React, { useState, useCallback, useEffect } from 'react';
import {Paper,Table,TableBody,TableCell,TableContainer,TableHead,TableRow,IconButton,Collapse,Box,Typography,Dialog,DialogTitle,DialogContent,DialogContentText,
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
  PaymentReferenceDialog, 
  PaymentCompleteDialog,
} from './Dialogs';

import { useDropzone } from 'react-dropzone';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AddIcon from '@mui/icons-material/Add';
import HelpIcon from '@mui/icons-material/Help';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
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
import { useTheme } from '@mui/material/styles';

function DocumentTable({ documents, refreshDocuments }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
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
  const [payDlgOpen, setPayDlgOpen]  = useState(false);
  const [payDlgDefault, setPayDlgDefault] = useState('');
  const [payCtx, setPayCtx] = useState(null); // {docId, sectionIndex, rowIndex, refCode}
  const [payDoneDlgOpen, setPayDoneDlgOpen] = useState(false);
  // 🔝 state hooks (near other dialog states)
  const [payDoneDoc,     setPayDoneDoc]     = useState(null);


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

  const hasMissingPayRef = useCallback(
    (id) => {
      const sections = parsedSectionsMap[id] || [];
      for (const sec of sections) {
        /* ⇢ ignore summary-only sections */
        if (!sec.table || sec.hasOwnProperty('grand_total')) continue;
  
        const headers = sec.table[0] || [];
        const payIdx  = headers.indexOf('PAY_REF');
        if (payIdx === -1) return true;
  
        const rows = sec.table.slice(1);
        if (
          rows.some((r) => {
            /* skip rows that are entirely blank (optional) */
            const meaningful = r.some((v, i) => i !== payIdx && String(v || '').trim());
            if (!meaningful) return false;
            const val = r[payIdx];
            return !val || !String(val).trim();
          })
        )
          return true;
      }
      return false;
    },
    [parsedSectionsMap]
  );
  

  async function handleRejectConfirm() {
    if (!docToReject) return;
    if (!rejectReason.trim()) {
      // alert('Alasan penolakan harus diisi.');
      return;
    }
  
    try {
      await API.patch(`/documents/${docToReject.id}/`, {
        status: 'rejected',
        reject_comment: rejectReason,
      });
      // alert('Dokumen berhasil ditolak.');
      refreshDocuments();
    } catch (error) {
      console.error('Gagal menolak dokumen:', error);
      // alert('Terjadi kesalahan saat menolak dokumen.');
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
      // alert('Terjadi kesalahan saat memperbaiki dokumen.');
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
      const res = await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      const updated = res.data.parsed_json || [];
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: updated }));
    } catch (error) {
      console.error(error);
      // alert('Gagal menambahkan baris baru.');
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
      const res = await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      const updated = res.data.parsed_json || [];
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: updated }));
    } catch (error) {
      console.error(error);
      // alert('Gagal menghapus baris.');
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
      const res = await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      const updated = res.data.parsed_json || [];
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: updated }));
      // alert('Section baru ditambahkan.');
    } catch (error) {
      console.error(error);
      // alert('Gagal menambahkan section baru.');
    }
  }

  async function handleRemoveSection(sectionIndex) {
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const newSections = oldSections.filter((_, idx) => idx !== sectionIndex);
    try {
      const res = await API.patch(`/documents/${editDocId}/`, { parsed_json: newSections });
      const updated = res.data.parsed_json || [];
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: updated }));
    } catch (error) {
      console.error(error);
      // alert('Gagal menghapus section.');
    }
  }

  async function handleUpdateCell(sectionIndex, rowIndex, cellIndex, newValue) {
    if (!editDocId || !parsedSectionsMap[editDocId]) return;
    const oldSections = parsedSectionsMap[editDocId];
    const section = oldSections[sectionIndex];
    if (!section || !Array.isArray(section.table)) return;
    const dataRowIndex = rowIndex + 1;
    if (!section.table[dataRowIndex]) return;

    // Step 1: Update the value locally
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

    // Step 2: Instantly recalculate totals in local state (optimistic UI)
    const recalcedSections = recalcTotals(JSON.parse(JSON.stringify(newSections)));
    setParsedSectionsMap((old) => ({ ...old, [editDocId]: recalcedSections }));

    // Step 3: Send PATCH to backend using recalculated values
    try {
      const res = await API.patch(`/documents/${editDocId}/`, { parsed_json: recalcedSections });
      const updated = res.data.parsed_json || [];
      // Step 4: After backend responds, update state with backend’s "true" result
      setParsedSectionsMap((old) => ({ ...old, [editDocId]: updated }));
    } catch (error) {
      console.error(error);
      // (Optional) Could add a toast/error popup here and revert the UI if PATCH fails
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
      // alert('Gagal mengupdate subtotal.');
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
      // alert('Gagal mengupdate grand total.');
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
    
    // Get the existing REF_CODE for this item
    const currentRefCode = parsedSectionsMap[attachDocMainId][attachDocSectionIndex].table[attachDocRowIndex + 1].slice(-1)[0];
  
    try {
      for (const file of attachDocFiles) {
        const formData = new FormData();
        formData.append('main_document', attachDocMainId);
        formData.append('file', file);
        formData.append('company_name', attachDocCompany);
        formData.append('section_index', attachDocSectionIndex);
        formData.append('row_index', attachDocRowIndex);
        formData.append('item_ref_code', currentRefCode);  // <-- ADD THIS LINE
        
        await API.post('/supporting-docs/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      const res = await API.get('/supporting-docs/', {
        params: { main_document: attachDocMainId },
      });
      setSupportingDocs((old) => ({ ...old, [attachDocMainId]: res.data }));
    } catch (err) {
      console.error(err);
      // alert('Gagal mengupload dokumen pendukung.');
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
    } catch (error) {
      console.error(error);
      // alert('Gagal menghapus dokumen utama.');
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
      // alert('Dokumen pendukung berhasil dihapus!');
    } catch (err) {
      console.error(err);
      // alert('Gagal menghapus dokumen pendukung.');
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
      // alert('Dokumen berhasil ditolak!');
      refreshDocuments();
    } catch (error) {
      console.error('Error rejecting document:', error);
      // alert('Gagal menolak dokumen.');
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
      // alert('Dokumen berhasil diselesaikan dan status menjadi Belum Disetujui.');
    } catch (error) {
      console.error(error);
      // alert('Terjadi kesalahan saat menyelesaikan draf.');
    } finally {
      setConfirmFinishDraftOpen(false);
      setDocToFinish(null);
    }
  }

  async function handleOpenApproveDialog(doc) {
    // 1️⃣  Open dialog & ensure data is loaded
    setDocToApprove(doc);
  
    let sDocs = supportingDocs[doc.id];
    if (!sDocs) {
      try {
        const res = await API.get('/supporting-docs/', { params: { main_document: doc.id } });
        sDocs = res.data;
        setSupportingDocs((old) => ({ ...old, [doc.id]: sDocs }));
      } catch (err) {
        console.error('Error fetching supporting docs', err);
        sDocs = [];
      }
    }
  
    let parsed = parsedSectionsMap[doc.id];
    if (!parsed) {
      try {
        const res = await API.get(`/documents/${doc.id}/`);
        parsed = res.data.parsed_json || [];
        setParsedSectionsMap((old) => ({ ...old, [doc.id]: parsed }));
      } catch (err) {
        console.error('Error fetching parsed_json', err);
        parsed = [];
      }
    }
  
    // 2️⃣  Build human‑readable list of unapproved docs with section, row, and numbering
    const unapproved = (sDocs || [])
      .filter((sd) => sd.status !== 'disetujui')
      .map((sd) => {
        let sectionName = 'Unknown';
        let rowNo = '-';
        let docNum = '';
        if (sd.section_index != null && sd.row_index != null) {
          const section = parsed[sd.section_index];
          sectionName = section?.company || 'Unknown';
          rowNo = sd.row_index + 1; // +1 to be human-readable
          const docsForItem = (sDocs || []).filter(
            x => x.section_index === sd.section_index && x.row_index === sd.row_index
          ).sort((a, b) => a.supporting_doc_sequence - b.supporting_doc_sequence);
          const index = docsForItem.findIndex(x => x.id === sd.id);
          docNum = `Dokumen ${index + 1}/${docsForItem.length}`;
        }
        return { ...sd, itemDescription: `${sectionName} no. ${rowNo}: ${docNum}` };
      });
  
    // 3️⃣  Show dialog
    setUnapprovedDocs(unapproved);
    setConfirmApproveOpen(true);
  }
  

  async function handleConfirmApproveTagihan() {
    if (!docToApprove) return;
    try {
      await API.patch(`/documents/${docToApprove.id}/`, { status: 'disetujui' });
      refreshDocuments();
      // alert(`Tagihan "${docToApprove.title}" berhasil disetujui!`);
    } catch (err) {
      console.error(err);
      // alert('Gagal menyetujui tagihan.');
    } finally {
      setConfirmApproveOpen(false);
      setDocToApprove(null);
      setUnapprovedDocs([]);
    }
  }

  /* ——— helper to turn a clipboard item into a File object ——— */
  function fileFromClipboardItem(item) {
    if (!item || item.kind !== "file" || !item.type.startsWith("image/")) return null;
    const original = item.getAsFile();
    if (!original) return null;
    const rand = Math.random().toString(36).slice(2, 7);          // 5-char id
    const ext  = original.type.split("/")[1] || "png";
    return new File([original], `image_${rand}.${ext}`, { type: original.type });
  }

  /* ——— paste ⇒ push into attachDocFiles ——— */
  const handlePaste = useCallback((e) => {
    const { items } = e.clipboardData || {};
    if (!items?.length) return;
    const pasted = [];
    for (const it of items) {
      const f = fileFromClipboardItem(it);
      if (f) pasted.push(f);
    }
    if (pasted.length) {
      setAttachDocFiles((prev) => [...prev, ...pasted]);
      e.preventDefault();                              // stop the browser’s default paste
    }
  }, []);

  // Helpers for formatting
  function formatIndoDateTime(dateString) {
    if (!dateString) return '';
    const dt = new Date(dateString);
    const date = dt.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const time = dt.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return `${date}, ${time}`;
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

  function openPayDialog({ docId, sectionIndex, rowIndex, row, headers }) {
    const refCode  = row[row.length - 1];   
    const payIdx   = headers.indexOf('PAY_REF');
    const current  = payIdx !== -1 && row.length > payIdx ? row[payIdx] : '';
    setPayCtx({ docId, sectionIndex, rowIndex, refCode });
    setPayDlgDefault(current);
    setPayDlgOpen(true);
  }

  async function handleSavePayRef(newRef) {
    if (!payCtx) return;
  
    const { docId, refCode, sectionIndex, rowIndex } = payCtx;
  
    try {
      /* ───── 1️⃣  Persist to backend ───── */
      await API.patch(`/documents/${docId}/`, {
        item_payment_refs: { [refCode]: newRef },
      });
  
      /* ───── 2️⃣  Update local cache ───── */
      setParsedSectionsMap((old) => {
        const sections = [...(old[docId] || [])];
        const section  = sections[sectionIndex];
        if (!section) return old;
  
        const headers = section.table[0];
        let payIdx    = headers.indexOf('PAY_REF');
  
        /* — add PAY_REF column if it didn’t exist — */
        if (payIdx === -1) {
          headers.push('PAY_REF');
          payIdx = headers.length - 1;
  
          /* pad **all** existing rows so r[payIdx] is defined */
          section.table.slice(1).forEach((r) => {
            while (r.length <= payIdx) r.push('');
          });
        }
  
        /* ensure the specific row is long enough, then write the value */
        const row = section.table[rowIndex + 1];
        while (row.length <= payIdx) row.push('');
        row[payIdx] = newRef;
  
        return { ...old, [docId]: sections };
      });
  
      // alert('Referensi pembayaran tersimpan.');
    } catch (err) {
      console.error(err);
      // alert('Gagal menyimpan referensi pembayaran.');
    } finally {
      setPayDlgOpen(false);
      setPayCtx(null);
    }
  }
  

  async function handleSetPaymentReference(doc, reference) {
    try {
      await API.patch(`/documents/${doc.id}/`, {
        status: 'sudah_dibayar',
        payment_reference: reference,
      });
      // alert('Referensi pembayaran berhasil disimpan, dokumen sekarang statusnya "Sudah Dibayar"!');
      refreshDocuments(); // untuk merefresh tabel
    } catch (error) {
      console.error('Error menyimpan referensi pembayaran:', error);
      // alert('Gagal menyimpan referensi pembayaran.');
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
          <Typography variant="subtitle1">{section.grand_total || '-'}</Typography>
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
        {userRole === 'employee' && docStatus === 'disetujui' && (
          <Box sx={{ display:'flex', justifyContent:'flex-end', mt:3 }}>
            <Button
              variant="contained"
              color="success"
              disabled={docStatus !== 'disetujui' || hasMissingPayRef(docObj.id)}
              onClick={() => { setPayDoneDoc(docObj); setPayDoneDlgOpen(true); }}
            >
              Selesaikan Pembayaran
            </Button>
          </Box>
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
                  {headerRow
                    .filter((h) => h.toUpperCase() !== 'REF_CODE')
                    .map((headerCell, i) => {
                      let cellWidth = '20%';
                      if (headerCell.toUpperCase() === 'NO') cellWidth = '5%';
                      else if (headerCell.toUpperCase() === 'KETERANGAN') cellWidth = '40%';
                      // no need for REF_CODE width
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
                  const itemDocs = (supportingDocs[docId] || [])
  .filter((sd) => sd.section_index === sectionIndex && sd.row_index === rowIndex)
  .sort((a, b) => a.supporting_doc_sequence - b.supporting_doc_sequence);
                  const expanded = !!itemDocsExpandedMap[`${docId}-${sectionIndex}-${rowIndex}`];
                  const role = localStorage.getItem('role');
                  const docStatus = docObj.status;
                  const canRowToggle = ['owner', 'higher-up', 'employee'].includes(role) && !['draft', 'rejected'].includes(docStatus);

                  return (
                    <React.Fragment key={rowIndex}>
                      <TableRow
                        hover
                        sx={{ cursor: canRowToggle ? 'pointer' : 'default' }}
                        onClick={canRowToggle ? () => handleToggleItemDocs(docId, sectionIndex, rowIndex) : undefined}
                      >
                        {row.map((cell, cellIndex) => {
                          const isRefCodeColumn = headerRow[cellIndex]?.toUpperCase() === 'REF_CODE';
                          if (isRefCodeColumn) return null;
                          return (
                            <EditableTableCell
                              key={cellIndex}
                              value={cell}
                              canEdit={!isRefCodeColumn && canEditMainDocument(userRole, docStatus)} // REF_CODE non-editable
                              onChangeValue={(newVal) =>
                                handleUpdateCell(sectionIndex, rowIndex, cellIndex, newVal)
                              }
                            />
                          );
                        })}
                        <TableCell>
                          <Box sx={{ display: 'inline-flex', gap: 1 }}>
                            {canEditMainDocument(userRole, docStatus) && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAttachDocClick(docId, company, sectionIndex, rowIndex);
                                }}
                              >
                                Dok
                              </Button>
                            )}
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleItemDocs(docId, sectionIndex, rowIndex);
                              }}
                            >
                              {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                            {canEditMainDocument(userRole, docStatus) && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSectionRow(sectionIndex, rowIndex);
                                }}
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
                              {/* NEW header — shows current position + total */}
                              <ItemDocsPreview
                                key={row.id}
                                itemRefCode={row[row.length - 1]} // assuming last cell is item_ref_code (REF_CODE)
                                mainDocumentId={docId}
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
                              {userRole === 'employee' && docStatus === 'disetujui' && (
                                <Box sx={{ mt: 2, textAlign: 'right' }}>
                                  {(() => {
                                    const payIdx = headerRow.indexOf('PAY_REF');
                                    const payVal =
                                      payIdx !== -1 && row.length > payIdx ? (row[payIdx] || '').trim() : '';
                                    return payVal ? (
                                      <Typography variant="body2">
                                        <strong>PAY_REF:</strong> {payVal}
                                      </Typography>
                                    ) : (
                                      <Button
                                        variant="contained"
                                        size="small"
                                        color="info"
                                        onClick={() =>
                                          openPayDialog({ docId, sectionIndex, rowIndex, row, headers: headerRow })
                                        }
                                      >
                                        Masukkan Referensi Pembayaran
                                      </Button>
                                    );
                                  })()}
                                </Box>
                              )}
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
            <Typography variant="body2">{subtotal || '-'}</Typography>
          </Box>
        </Paper>
      );
    });
  }

  // Helper to turn '5.200.000' → 5200000 (supports empty/null)
  function idrToInt(text) {
    if (!text) return 0;
    return parseInt(String(text).replace(/[^\d]/g, ''), 10) || 0;
  }

  // Helper to turn 5200000 → '5.200.000'
  function intToIdr(num) {
    return num.toLocaleString('id-ID');
  }

  // JS version of backend recalc_totals
  function recalcTotals(parsed) {
    let grand = 0;
    parsed.forEach(sec => {
      const tbl = sec.table || [];
      if (!tbl.length) return;
      const headers = tbl[0];
      const idx = headers.indexOf('PENGIRIMAN');
      if (idx === -1) return;
      const subtotal = tbl.slice(1).reduce((acc, row) => acc + idrToInt(row[idx]), 0);
      sec.subtotal = intToIdr(subtotal);
      grand += subtotal;
    });
    // update or append grand_total object
    const gt_str = intToIdr(grand);
    if (parsed.length && parsed[parsed.length - 1].grand_total !== undefined) {
      parsed[parsed.length - 1].grand_total = gt_str;
    } else {
      parsed.push({ grand_total: gt_str });
    }
    return parsed;
  }

  function statusProps(status) {
    switch (status) {
      case "draft":
        return {
          icon: <EditNoteOutlinedIcon sx={{ color: "#7986a1", fontSize: 22, mr: 1 }} />,
          label: "Dalam Draf",
          color: "#90a4ae",
          bgcolor: "rgba(120,140,170,0.11)"
        };
      case "belum_disetujui":
        return {
          icon: <PendingActionsOutlinedIcon sx={{ color: "#fbc02d", fontSize: 22, mr: 1 }} />,
          label: "Belum Disetujui",
          color: "#b28900",
          bgcolor: "rgba(255, 193, 7, 0.12)"
        };
      case "disetujui":
        return {
          icon: <TaskAltOutlinedIcon sx={{ color: "#43a047", fontSize: 22, mr: 1 }} />,
          label: "Disetujui",
          color: "#388e3c",
          bgcolor: "rgba(76, 175, 80, 0.11)"
        };
      case "rejected":
        return {
          icon: <HighlightOffOutlinedIcon sx={{ color: "#e53935", fontSize: 22, mr: 1 }} />,
          label: "Ditolak",
          color: "#e53935",
          bgcolor: "rgba(229, 57, 53, 0.11)"
        };
      case "sudah_dibayar":
        return {
          icon: <PaidOutlinedIcon sx={{ color: "#1976d2", fontSize: 22, mr: 1 }} />,
          label: "Sudah Dibayar",
          color: "#1976d2",
          bgcolor: "rgba(33, 150, 243, 0.09)"
        };
      default:
        return {
          icon: <EditNoteOutlinedIcon sx={{ color: "#b0b0b0", fontSize: 22, mr: 1 }} />,
          label: status,
          color: "#aaa",
          bgcolor: "rgba(160,160,160,0.09)"
        };
    }
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
                  <TableRow
                    hover
                    onClick={() => toggleRow(doc.id, doc.doc_type)}
                    sx={{
                      cursor: expandDocTypes.includes(doc.doc_type) ? 'pointer' : 'default',
                      '&:hover': {
                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                      },
                    }}
                  >
                    <TableCell>
                      {expandDocTypes.includes(doc.doc_type) && (
                        <IconButton size="small" onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(doc.id, doc.doc_type);
                        }}>
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
                      {(() => {
                        const { icon, label, color, bgcolor } = statusProps(doc.status);
                        return (
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 1.5,
                              py: 0.6,
                              borderRadius: '16px',
                              bgcolor,
                              color,
                              fontWeight: 700,
                              fontSize: '0.92rem',
                              letterSpacing: 0.2,
                              boxShadow: '0 1px 4px #c7d6e018',
                            }}
                          >
                            {icon}
                            {label}
                          </Box>
                        );
                      })()}
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
        onPaste={handlePaste}        /* 👈  new */
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

      <PaymentReferenceDialog
        open={payDlgOpen}
        onClose={() => setPayDlgOpen(false)}
        defaultValue={payDlgDefault}
        onSave={handleSavePayRef}
      />

      <PaymentCompleteDialog
        open={payDoneDlgOpen}
        onClose={() => setPayDoneDlgOpen(false)}
        onConfirm={async () => {
          if (!payDoneDoc) return;
          try {
            await API.patch(`/documents/${payDoneDoc.id}/`, { status: 'sudah_dibayar' });
            refreshDocuments();
            // alert('Status berubah menjadi “Sudah Dibayar”.');
          } catch (err) {
            console.error(err);
            // alert('Gagal menyelesaikan pembayaran.');
          } finally {
            setPayDoneDlgOpen(false);
            setPayDoneDoc(null);
          }
        }}
      />
    </>
    </>
  );
}

export default DocumentTable;