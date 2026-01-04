// File: src/pages/LoginPage.jsx

import React, { useMemo, useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonIcon from '@mui/icons-material/Person';
import SmsOutlinedIcon from '@mui/icons-material/SmsOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import API from '../services/api';

function extractApiError(err, fallback) {
  const msg = err?.response?.data?.error || err?.response?.data?.detail;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

export default function LoginPage() {
  const [stage, setStage] = useState('creds'); // 'creds' | 'otp'

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [challengeId, setChallengeId] = useState('');
  const [destination, setDestination] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isOtpStage = stage === 'otp';
  const otpMinutes = useMemo(() => {
    const s = Number(expiresIn || 0);
    const m = Math.ceil((s || 300) / 60);
    return Number.isFinite(m) && m > 0 ? m : 5;
  }, [expiresIn]);

  const resetToCreds = () => {
    setStage('creds');
    setChallengeId('');
    setDestination('');
    setExpiresIn(0);
    setOtp('');
    setError('');
  };

  const startOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login/start/', {
        username: (username || '').trim(),
        password,
      });
      setChallengeId(data.challenge_id);
      setDestination(data.destination);
      setExpiresIn(data.expires_in);
      setOtp('');
      setStage('otp');
    } catch (err) {
      setError(extractApiError(err, 'Username atau password salah!'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login/verify/', {
        challenge_id: challengeId,
        otp,
      });

      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);
      localStorage.setItem('username', data.username || username);
      localStorage.setItem('role', data.role || 'employee');
      if (Array.isArray(data.groups)) {
        localStorage.setItem('groups', JSON.stringify(data.groups));
      }

      window.dispatchEvent(new Event('theme_update'));
      // Hard reload with cache-busting query to ensure latest bundle is used post-login
      window.location.replace(`/home?v=${Date.now()}`);
    } catch (err) {
      setError(extractApiError(err, 'OTP salah.'));
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login/start/', {
        username: (username || '').trim(),
        password,
      });
      setChallengeId(data.challenge_id);
      setDestination(data.destination);
      setExpiresIn(data.expires_in);
      setOtp('');
      setStage('otp');
    } catch (err) {
      setError(extractApiError(err, 'Gagal mengirim OTP.'));
      resetToCreds();
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !loading &&
    (isOtpStage
      ? (otp || '').trim().length === 6 && !!challengeId
      : (username || '').trim().length > 0 && (password || '').length > 0);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        minWidth: '100vw',
        bgcolor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(120deg, #1976d2 0%, #42a5f5 50%, #7e57c2 100%)',
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
          maxWidth: 380,
          backdropFilter: 'blur(16px) saturate(180%)',
          bgcolor: 'rgba(255,255,255,0.82)',
          boxShadow: '0 8px 36px 0 rgba(34,50,84,0.14)',
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
            boxShadow: '0 4px 18px rgba(34,50,84,0.08)',
          }}
        >
          {isOtpStage ? (
            <SmsOutlinedIcon sx={{ color: '#fff', fontSize: 38 }} />
          ) : (
            <LockOutlinedIcon sx={{ color: '#fff', fontSize: 38 }} />
          )}
        </Box>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            letterSpacing: 1,
            mb: 0.5,
            color: '#23305A',
          }}
        >
          {isOtpStage ? 'Verifikasi OTP' : 'Selamat Datang'}
        </Typography>

        <Typography variant="body2" sx={{ color: '#444', mb: 3, textAlign: 'center' }}>
          {isOtpStage
            ? 'Masukkan kode OTP yang dikirim ke WhatsApp Anda.'
            : 'Silakan login untuk masuk ke sistem DMS PT. TTU.'}
        </Typography>

        {error ? (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {isOtpStage && destination ? (
          <Alert severity="info" sx={{ width: '100%', mb: 2 }}>
            OTP dikirim ke WhatsApp <b>{destination}</b>. Berlaku sekitar <b>{otpMinutes} menit</b>.
          </Alert>
        ) : null}

        <Box
          component="form"
          onSubmit={isOtpStage ? verifyOtp : startOtp}
          sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            fullWidth
            disabled={isOtpStage || loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon color="primary" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Password"
            variant="outlined"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            disabled={isOtpStage || loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon color="primary" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPass((s) => !s)}
                    edge="end"
                    size="small"
                    disabled={isOtpStage || loading}
                  >
                    {showPass ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {isOtpStage ? (
            <TextField
              label="Kode OTP"
              variant="outlined"
              value={otp}
              onChange={(e) => {
                const cleaned = (e.target.value || '').replace(/\D/g, '').slice(0, 6);
                setOtp(cleaned);
              }}
              required
              fullWidth
              disabled={loading}
              inputProps={{ inputMode: 'numeric', pattern: '\\d*', maxLength: 6 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SmsOutlinedIcon color="primary" />
                  </InputAdornment>
                ),
              }}
              helperText="6 digit"
            />
          ) : null}

          <Button
            variant="contained"
            type="submit"
            disabled={!canSubmit}
            sx={{
              py: 1.3,
              mt: 1,
              fontWeight: 600,
              fontSize: '1.08rem',
              borderRadius: 2,
              background: 'linear-gradient(90deg, #1976d2, #7e57c2)',
              boxShadow: '0 4px 12px rgba(34,50,84,0.10)',
              letterSpacing: 1,
            }}
            fullWidth
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : isOtpStage ? (
              'Verifikasi'
            ) : (
              'Kirim OTP'
            )}
          </Button>

          {isOtpStage ? (
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Button
                variant="text"
                onClick={resendOtp}
                disabled={loading}
                sx={{ flex: 1, fontWeight: 600 }}
              >
                Kirim ulang OTP
              </Button>
              <Button
                variant="text"
                onClick={resetToCreds}
                disabled={loading}
                sx={{ flex: 1, fontWeight: 600 }}
              >
                Ganti akun
              </Button>
            </Box>
          ) : null}
        </Box>

        <Box sx={{ mt: 4, textAlign: 'center', fontSize: 13, color: '#999' }}>
          © {new Date().getFullYear()} PT. TTU • skip5
        </Box>
      </Paper>
    </Box>
  );
}
