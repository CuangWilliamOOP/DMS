import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useSearchParams } from 'react-router-dom';
import API from '../services/api';

function extractApiError(err, fallback) {
  const data = err?.response?.data;
  const errMsg = data?.error || data?.detail;
  const details = data?.details;

  if (typeof errMsg === 'string' && errMsg.trim()) {
    if (Array.isArray(details) && details.length) return `${errMsg} (${details.join(' • ')})`;
    return errMsg;
  }
  return fallback;
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const rid = (params.get('rid') || '').trim();
  const token = (params.get('token') || '').trim();

  const paramsOk = useMemo(() => !!rid && !!token, [rid, token]);
  const [linkState, setLinkState] = useState(paramsOk ? 'checking' : 'invalid'); // checking | valid | invalid

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!paramsOk) {
        setLinkState('invalid');
        return;
      }

      setLinkState('checking');
      setError('');

      try {
        await API.post('/auth/password/reset/validate/', { reset_id: rid, token });
        if (!cancelled) setLinkState('valid');
      } catch (err) {
        if (!cancelled) {
          setLinkState('invalid');
          setError(
            extractApiError(err, 'Link reset sudah tidak berlaku. Silakan minta link baru.')
          );
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [paramsOk, rid, token]);

  const linkOk = paramsOk && linkState === 'valid';

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!linkOk) {
      setError('Link reset sudah tidak berlaku. Silakan minta link baru.');
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
      await API.post('/auth/password/reset/confirm/', {
        reset_id: rid,
        token,
        new_password: newPassword,
      });
      setDone(true);
    } catch (err) {
      setError(extractApiError(err, 'Gagal reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        minWidth: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(120deg, #1976d2 0%, #42a5f5 50%, #7e57c2 100%)',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      <Paper
        elevation={7}
        sx={{
          px: 5,
          py: 6,
          borderRadius: 5,
          minWidth: 350,
          maxWidth: 420,
          bgcolor: 'rgba(255,255,255,0.90)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            mb: 2,
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1976d2 70%, #7e57c2 100%)',
            borderRadius: '50%',
          }}
        >
          <LockOutlinedIcon sx={{ color: '#fff', fontSize: 38 }} />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#23305A' }}>
          Reset Password
        </Typography>

        <Box component="form" onSubmit={submit} sx={{ width: '100%', mt: 2 }}>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            {paramsOk && linkState === 'checking' ? (
              <Alert severity="info">Memeriksa link reset…</Alert>
            ) : null}

            {!paramsOk ? (
              <Alert severity="error">Link reset tidak valid atau parameter tidak lengkap.</Alert>
            ) : null}

            {done ? (
              <Alert severity="success">
                Password berhasil di-reset. Silakan login dengan password baru.
              </Alert>
            ) : (
              <>
                <TextField
                  label="Password baru"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading || !linkOk}
                  fullWidth
                />
                <TextField
                  label="Konfirmasi password baru"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={loading || !linkOk}
                  fullWidth
                />

                <Button
                  variant="contained"
                  type="submit"
                  disabled={loading || !linkOk}
                  fullWidth
                  sx={{ py: 1.2, fontWeight: 700 }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Simpan Password'}
                </Button>
              </>
            )}

            {done ? (
              <Button
                variant="outlined"
                fullWidth
                onClick={() => window.location.replace('/login')}
              >
                Ke halaman login
              </Button>
            ) : null}
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
