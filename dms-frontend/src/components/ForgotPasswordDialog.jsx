import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import API from '../services/api';

function extractApiError(err, fallback) {
  const msg = err?.response?.data?.error || err?.response?.data?.detail;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

export default function ForgotPasswordDialog({ open, onClose, initialValue }) {
  const username = useMemo(() => (initialValue || '').trim(), [initialValue]);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('idle'); // 'idle' | 'sent'
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setStage('idle');
      setError('');
    }
  }, [open]);

  const sendLink = async () => {
    setError('');

    if (!username) {
      setError('Isi username dulu di halaman login, lalu klik "Lupa password?"');
      return;
    }

    setLoading(true);
    try {
      await API.post('/auth/password/reset/start/', { identifier: username });
      setStage('sent');
    } catch (err) {
      setError(extractApiError(err, 'Gagal mengirim link reset.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Lupa Password</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {stage === 'sent' ? (
            <Alert severity="success">
              Jika akun terdaftar, link reset sudah dikirim ke email terdaftar. Link berlaku singkat (± 5 menit).
            </Alert>
          ) : (
            <Alert severity="info">
              Kami akan mengirim link reset password ke <b>email yang terdaftar</b> untuk akun ini.
              Link berlaku singkat (± 5 menit).
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            Username: <b>{username || '—'}</b>
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Tutup
        </Button>

        {stage !== 'sent' ? (
          <Button
            onClick={sendLink}
            variant="contained"
            disabled={loading || !username}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Kirim Link Reset'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
