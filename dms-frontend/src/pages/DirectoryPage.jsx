import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, TextField, InputAdornment } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';



const companies = [
  { name: 'CV. ASN', type: 'CV', color: '#ffcc80', initials: 'ASN' },
  { name: 'PT. TTU', type: 'PT', color: '#90caf9', initials: 'TTU' },
  { name: 'PT. OLS', type: 'PT', color: '#a5d6a7', initials: 'OLS' },
  { name: 'PT. OLM', type: 'PT', color: '#ce93d8', initials: 'OLM' },
];

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

  const groupedCompanies = filteredCompanies.reduce((groups, company) => {
    const type = company.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(company);
    return groups;
  }, {});

  return (
  <Box sx={{ flexGrow: 1, px: { xs: 2, sm: 4 }, pb: 4, pt: -2, mt: -8}}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
        Direktori Dokumen
      </Typography>

      <TextField
        placeholder="Cari Perusahaan..."
        variant="outlined"
        fullWidth
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 4 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {Object.entries(groupedCompanies).map(([type, comps]) => (
        <Box key={type} sx={{ mb: 5 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            {type}
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
                    onClick={() => handleClick(company.name)}
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderRadius: 3,
                      boxShadow: 3,
                      transition: '0.3s',
                      '&:hover': {
                        boxShadow: 8,
                        bgcolor: company.color,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        bgcolor: company.color,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
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
  );
}

export default DirectoryPage;
