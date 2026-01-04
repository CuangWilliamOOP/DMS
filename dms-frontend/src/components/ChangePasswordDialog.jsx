// File: src/components/ChangePasswordDialog.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';

import API from '../services/api';
import { logout } from '../utils/auth';

function extractApiError(err, fallback) {
  const data = err?.response?.data;

  const errMsg = data?.error || data?.detail;
  const details = data?.details;

  if (typeof errMsg === 'string' && errMsg.trim()) {
    if (Array.isArray(details) && details.length) {
      // one-line compact detail
      return `${errMsg} (${details.join(' • ')})`;
    }
    return errMsg;
  }
  return fallback;
}

export default function ChangePasswordDialog({ open, onClose }) {
  const [stage, setStage] = useState('idle'); // 'idle' | 'otp' | 'success'
  const [loading, setLoading] = useState(false);

  const [challengeId, setChallengeId] = useState('');
  const [destination, setDestination] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [error, setError] = useState('');

  const otpMinutes = useMemo(() => {
    const s = Number(expiresIn || 0);
    const m = Math.ceil((s || 300) / 60);
    return Number.isFinite(m) && m > 0 ? m : 5;
  }, [expiresIn]);

  const reset = () => {
    setStage('idle');
    setLoading(false);
    setChallengeId('');
    setDestination('');
    setExpiresIn(0);
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError('');
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/password/start/', {});
      setChallengeId(data.challenge_id);
      setDestination(data.destination);
      setExpiresIn(data.expires_in);
      setOtp('');
      setStage('otp');
    } catch (err) {
      setError(extractApiError(err, 'Gagal mengirim OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmChange = async () => {
    setError('');

    if (!challengeId) {
      setError('Challenge ID tidak ditemukan. Silakan kirim OTP ulang.');
      return;
    }
    if ((otp || '').trim().length !== 6) {
      setError('OTP harus 6 digit.');
      return;
    }
    if (!newPassword) {
      setError('Password baru wajib diisi.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Konfirmasi password tidak sama.');
      return;
    }

    setLoading(true);
    try {
      await API.post('/auth/password/confirm/', {
        challenge_id: challengeId,
        otp,
        new_password: newPassword,
      });

      setStage('success');
    } catch (err) {
      setError(extractApiError(err, 'Gagal mengganti password.'));
    } finally {
      setLoading(false);
    }
  };

  const canSendOtp = !loading;
  const canConfirm =
    !loading &&
    stage === 'otp' &&
    (otp || '').trim().length === 6 &&
    !!newPassword &&
    newPassword === confirmNewPassword;

  const handleClose = () => {
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Ganti Password</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {stage === 'idle' ? (
            <Alert severity="info">
              Untuk keamanan, kami akan mengirim OTP ke WhatsApp yang terdaftar.
            </Alert>
          ) : null}

          {stage === 'otp' && destination ? (
            <Alert severity="info">
              OTP dikirim ke WhatsApp <b>{destination}</b>. Berlaku sekitar{' '}
              <b>{otpMinutes} menit</b>.
            </Alert>
          ) : null}

          {stage === 'success' ? (
            <Alert severity="success">
              Password berhasil diubah. Demi keamanan, silakan login ulang.
            </Alert>
          ) : null}

          {stage !== 'success' ? (
            <>
              <Button
                variant="outlined"
                onClick={startOtp}
                disabled={!canSendOtp}
              >
                {loading && stage === 'idle' ? (
                  <CircularProgress size={18} />
                ) : stage === 'otp' ? (
                  'Kirim ulang OTP'
                ) : (
                  'Kirim OTP'
                )}
              </Button>

              {stage === 'otp' ? (
                <>
                  <TextField
                    label="Kode OTP"
                    value={otp}
                    onChange={(e) => {
                      const cleaned = (e.target.value || '')
                        .replace(/\D/g, '')
                        .slice(0, 6);
                      setOtp(cleaned);
                    }}
                    inputProps={{
                      inputMode: 'numeric',
                      pattern: '\\d*',
                      maxLength: 6,
                    }}
                    helperText="6 digit"
                    disabled={loading}
                    fullWidth
                  />

                  <TextField
                    label="Password baru"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    fullWidth
                  />

                  <TextField
                    label="Konfirmasi password baru"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={loading}
                    fullWidth
                  />

                  <Typography variant="caption" color="text.secondary">
                    Catatan: jika server menolak password (terlalu pendek/umum),
                    pesan validasi akan muncul.
                  </Typography>
                </>
              ) : null}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Klik “Login ulang” untuk keluar dan masuk kembali menggunakan
              password baru.
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          Tutup
        </Button>

        {stage === 'otp' ? (
          <Button
            onClick={confirmChange}
            variant="contained"
            disabled={!canConfirm}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Simpan'}
          </Button>
        ) : null}

        {stage === 'success' ? (
          <Button
            onClick={() => logout()}
            variant="contained"
            color="primary"
          >
            Login ulang
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
