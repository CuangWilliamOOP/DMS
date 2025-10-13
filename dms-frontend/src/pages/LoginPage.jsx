// File: src/pages/LoginPage.jsx

import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonIcon from '@mui/icons-material/Person';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/token/', { username, password });
      localStorage.setItem('accessToken', res.data.access);
      localStorage.setItem('refreshToken', res.data.refresh);
      localStorage.setItem('username', username);

      // Fetch user's group(s)
      const res2 = await API.get('/me/');
      // You can map the group to your app role logic here:
      let role = 'employee';
      if (res2.data.groups.includes('owner')) role = 'owner';
      else if (res2.data.groups.includes('boss')) role = 'higher-up';
      else if (res2.data.groups.includes('admin')) role = 'employee';

  localStorage.setItem('role', role);
  window.dispatchEvent(new Event("theme_update"));
  // Hard reload with cache-busting query to ensure latest bundle is used post-login
  window.location.replace(`/home?v=${Date.now()}`);
    } catch (err) {
      alert('Username atau password salah!');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        minWidth: '100vw',
        bgcolor: 'transparent',
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
          <LockOutlinedIcon sx={{ color: '#fff', fontSize: 38 }} />
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
          Selamat Datang
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: '#444', mb: 3, textAlign: 'center' }}
        >
          Silakan login untuk masuk ke sistem DMS PT. TTU.
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            fullWidth
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
                  >
                    {showPass ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            variant="contained"
            type="submit"
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
            Login
          </Button>
        </Box>
        <Box sx={{ mt: 4, textAlign: 'center', fontSize: 13, color: '#999' }}>
          © {new Date().getFullYear()} PT. TTU • skip5
        </Box>
      </Paper>
    </Box>
  );
}
