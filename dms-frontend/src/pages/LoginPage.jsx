// File: src/pages/LoginPage.jsx

import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
  
    if (username === 'admin123' && password === '1234') {
      localStorage.setItem('role', 'employee');
      navigate('/home');
    } else if (username === 'boss' && password === '4321') {
      localStorage.setItem('role', 'higher-up');
      navigate('/home');
    } else if (username === 'owner' && password === '0000') {
      localStorage.setItem('role', 'owner');
      navigate('/home');
    } else {
      alert('Username atau password salah!');
    }
  };
  

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '400px',
        margin: '0 auto',
        mt: 4
      }}
    >
      <Typography variant="h5" gutterBottom>
        Login
      </Typography>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <TextField
          label="Username"
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <TextField
          label="Password"
          variant="outlined"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button variant="contained" color="primary" type="submit">
          Login
        </Button>
      </Box>
    </Box>
  );
}

export default LoginPage;
