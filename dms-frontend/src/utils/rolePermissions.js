// src/utils/rolePermissions.js

export const canEditDelete = (userRole, docStatus) => {
  // OWNER boleh hapus di semua status
  if (userRole === 'owner') return true;
  if (userRole === 'employee') return docStatus === 'draft';
  if (userRole === 'higher-up') return docStatus === 'rejected'; // tambahan
  return false;
};

export const canApprove = (userRole, docStatus) => {
  if (userRole === 'owner') return docStatus !== 'disetujui';
  if (userRole === 'higher-up') return docStatus === 'belum_disetujui';
  return false;
};

export const canDeleteSupportingDoc = (userRole, docStatus) => {
  // OWNER boleh hapus semua dok pendukung di status apapun
  if (userRole === 'owner') return true;
  if (userRole === 'employee') return docStatus === 'draft' || docStatus === "rejected";
  return false;
};

export const canEditMainDocument = (userRole, docStatus) => {
  if (userRole === 'owner') return true;
  if (userRole === 'employee') return docStatus === 'draft' || docStatus === "rejected";
  return false;
};

export const canEvaluateSupportingDoc = (userRole, sDocStatus, docStatus) => {
  // OWNER bisa approve/reject dok pendukung kecuali yg sudah disetujui
  if (userRole === 'owner') return sDocStatus !== 'disetujui';
  if (userRole === 'higher-up') return sDocStatus !== 'disetujui' && docStatus !== 'disetujui';
  return false;
};

export const canFinishDraft = (userRole, docStatus) => {
  return ['employee', 'owner'].includes(userRole) && docStatus === 'draft';
};