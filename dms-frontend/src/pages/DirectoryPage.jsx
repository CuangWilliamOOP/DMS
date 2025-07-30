import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';

const companies = [
  { name: 'CV. ASN', type: 'CV', color: '#ffb86c', initials: 'ASN', gradient: 'linear-gradient(135deg,#ffd8b3,#ffb86c 80%)' },
  { name: 'PT. TTU', type: 'PT', color: '#7ab8f7', initials: 'TTU', gradient: 'linear-gradient(135deg,#d0e4fc,#7ab8f7 80%)' },
  { name: 'PT. OLS', type: 'PT', color: '#8edcbb', initials: 'OLS', gradient: 'linear-gradient(135deg,#c9f2e1,#8edcbb 80%)' },
  { name: 'PT. OLM', type: 'PT', color: '#c99de8', initials: 'OLM', gradient: 'linear-gradient(135deg,#f3e0fb,#c99de8 80%)' },
];

const typeColors = {
  CV: '#f7c873',
  PT: '#90caf9',
};

function DirectoryPage() {
  const navigate = useNavigate();
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
    navigate(`/directory/${companyName.toLowerCase().replace(/\s+/g, '-')}`);
  };

  // Group by type
  const groupedCompanies = filteredCompanies.reduce((groups, company) => {
    const type = company.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(company);
    return groups;
  }, {});

  return (
    <>
      {/* --- FULL PAGE GRADIENT BACKGROUND --- */}
      <Box
        sx={{
          position: 'fixed',
          zIndex: -1,
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg,#1c213a 60%,#292145 100%)'
              : 'linear-gradient(135deg,#f6f9fe 60%,#efe5fa 100%)',
          transition: 'background 0.3s',
        }}
      />
      {/* --- FOREGROUND CONTENT --- */}
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          mt: -10,
          px: { xs: 1, sm: 3, md: 6 },
          py: { xs: 3, sm: 6 },
          position: 'relative',
        }}
      >
        {/* Title */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            letterSpacing: 0.3,
            mb: 3,
            color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#222'),
          }}
        >
          Direktori Dokumen
        </Typography>

        {/* Search */}
        <Paper
          elevation={2}
          sx={{
            maxWidth: 420,
            mb: 4,
            p: 1.3,
            borderRadius: 3,
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(34,46,80,0.89)'
                : 'rgba(255,255,255,0.96)',
            boxShadow:
              '0 2px 12px 0 rgba(33,150,243,0.07)',
          }}
        >
          <TextField
            placeholder="Cari Perusahaan…"
            variant="standard"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="primary" />
                </InputAdornment>
              ),
              disableUnderline: true,
              sx: { fontSize: 18, pl: 1, color: 'inherit' },
            }}
            sx={{
              fontWeight: 500,
              bgcolor: 'transparent',
              '& input': { bgcolor: 'transparent', fontSize: 18 },
            }}
          />
        </Paper>

        {/* Grouped Company List */}
        <Box>
          {Object.entries(groupedCompanies).map(([type, comps]) => (
            <Box key={type} sx={{ mb: 5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Chip
                  icon={<BusinessIcon />}
                  label={type}
                  sx={{
                    fontWeight: 700,
                    fontSize: 17,
                    color: (theme) =>
                      theme.palette.mode === 'dark' ? '#222242' : '#fff',
                    background: typeColors[type] || '#bdbdbd',
                    mr: 1.5,
                    px: 1.5,
                    py: 0.5,
                    letterSpacing: 0.3,
                    borderRadius: 2,
                    boxShadow: '0 1px 4px 0 #6661',
                  }}
                />
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: 'text.secondary', opacity: 0.75, ml: 1 }}
                >
                  {comps.length} perusahaan
                </Typography>
              </Box>
              <Grid container spacing={3}>
                {comps.map((company, index) => (
                  <Grid item xs={12} sm={6} md={3} key={company.name}>
                    <motion.div
                      initial={{ opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.07 * index, duration: 0.34 }}
                    >
                      <Paper
                        elevation={4}
                        onClick={() => handleClick(company.name)}
                        sx={{
                          p: 3,
                          cursor: 'pointer',
                          borderRadius: 4,
                          boxShadow: (theme) =>
                            theme.palette.mode === 'dark'
                              ? '0 4px 22px #21164a33'
                              : '0 2px 12px #b9caf822',
                          textAlign: 'center',
                          background: company.gradient,
                          transition: 'box-shadow 0.18s, transform 0.16s',
                          '&:hover': {
                            boxShadow: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '0 8px 40px #19163c66'
                                : '0 8px 38px #b9caf822',
                            transform: 'translateY(-4px) scale(1.035)',
                          },
                          minHeight: 200,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Box
                          sx={{
                            width: 76,
                            height: 76,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.24)',
                            border: '2.5px solid #fff4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 1.5,
                            boxShadow: '0 1px 6px #b5aaff28',
                            transition: 'background 0.22s',
                          }}
                        >
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 800,
                              letterSpacing: 2,
                              color: '#222',
                              textShadow: '0 1px 4px #fff5',
                            }}
                          >
                            {company.initials}
                          </Typography>
                        </Box>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            fontSize: 20,
                            color: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '#242849'
                                : '#222',
                          }}
                        >
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
      </Box>
    </>
  );
}

export default DirectoryPage;
