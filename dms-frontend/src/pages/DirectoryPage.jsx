// File: src/pages/DirectoryPage.jsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

// ————————————————————————————————————————————————————————————
// Source data (unchanged)
// ————————————————————————————————————————————————————————————
const companies = [
  { name: 'CV. ASN', type: 'CV', color: '#ffcc80', initials: 'ASN' },
  { name: 'PT. TTU', type: 'PT', color: '#90caf9', initials: 'TTU' },
  { name: 'PT. OLS', type: 'PT', color: '#a5d6a7', initials: 'OLS' },
  { name: 'PT. OLM', type: 'PT', color: '#ce93d8', initials: 'OLM' },
];

// Safer slug for routing: remove dots, collapse spaces/dashes
const slugify = (name) =>
  name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

function DirectoryPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCompanies, setFilteredCompanies] = useState(companies);

  useEffect(() => {
    setFilteredCompanies(
      companies.filter((company) =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm]);

  const handleClick = (companyName) => {
    navigate(`/directory/${slugify(companyName)}`);
  };

  const groupedCompanies = filteredCompanies.reduce((groups, company) => {
    const type = company.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(company);
    return groups;
  }, {});

  return (
    <>
      {/* Fixed background to keep strong black contrast in dark mode */}
      <Box
        sx={{
          position: 'fixed',
          zIndex: -1,
          inset: 0,
          background: isDark ? '#181a29' : '#eaf2ff',
          transition: 'background .3s',
        }}
      />

      <Box sx={{ flexGrow: 1, px: { xs: 2, sm: 4 }, pb: 4, pt: -2, mt: -8 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
          Direktori Dokumen
        </Typography>

        {/* Search input: compact, with clear button, readable in dark mode */}
        <TextField
          placeholder="Cari Perusahaan..."
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            mb: 4,
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              background: (t) => (t.palette.mode === 'dark' ? '#111423' : '#fff'),
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')}>
                  ✕
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {filteredCompanies.length === 0 && (
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>
            Tidak ada perusahaan yang cocok.
          </Typography>
        )}

        {Object.entries(groupedCompanies).map(([type, comps]) => (
          <Box key={type} sx={{ mb: 5 }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              {type}
              <Box
                component="span"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 2,
                  fontSize: 12,
                  fontWeight: 700,
                  bgcolor: (t) => (t.palette.mode === 'dark' ? '#0f1324' : '#eef3ff'),
                  color: (t) => (t.palette.mode === 'dark' ? '#8fb1ff' : '#3688d6'),
                  border: (t) => `1px solid ${t.palette.mode === 'dark' ? '#263057' : '#dbe6ff'}`,
                }}
              >
                {comps.length}
              </Box>
            </Typography>

            <Grid container spacing={3}>
              {comps.map((company, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index, duration: 0.4 }}
                  >
                    <Paper
                      elevation={3}
                      className="company-card"
                      onClick={() => handleClick(company.name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(company.name)}
                      aria-label={`Buka ${company.name}`}
                      sx={{
                        p: 3,
                        textAlign: 'center',
                        cursor: 'pointer',
                        borderRadius: 3,
                        background: (t) => (t.palette.mode === 'dark' ? '#1b1f36' : '#fff'),
                        border: (t) => `1px solid ${t.palette.mode === 'dark' ? '#2a2f58' : '#e7ecfb'}`,
                        boxShadow: (t) =>
                          t.palette.mode === 'dark' ? '0 6px 22px #0009' : '0 8px 24px #b8c6f933',
                        transition:
                          'transform .18s ease, box-shadow .22s ease, border-color .18s ease, background .18s ease',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: (t) =>
                            t.palette.mode === 'dark' ? '0 12px 36px #000c' : '0 14px 40px #b8c6f94a',
                          borderColor: company.color,
                          background: (t) => (t.palette.mode === 'dark' ? '#181c2f' : '#f8faff'),
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          bgcolor: company.color,
                          borderRadius: '50%',
                          border: (t) => `3px solid ${t.palette.mode === 'dark' ? '#2f365f' : '#e6edff'}`,
                          boxShadow: '0 6px 18px rgba(0,0,0,.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mx: 'auto',
                          mb: 2,
                          transition: 'transform .18s ease, border-color .18s ease',
                          '.company-card:hover &': { borderColor: company.color },
                        }}
                      >
                        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'white' }}>
                          {company.initials}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                        {company.name}
                      </Typography>
                    </Paper>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Box>
    </>
  );
}

export default DirectoryPage;
