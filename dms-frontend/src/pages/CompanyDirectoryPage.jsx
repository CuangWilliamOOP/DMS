import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  CircularProgress,
  Grid,
  Paper,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { motion } from 'framer-motion';
import API from '../services/api';

const companyFullNames = {
  'cv-asn': 'CV. Alam Subur Nusantara',
  'pt-ttu': 'PT. Tunggal Tunggu Unggul',
  'pt-ols': 'PT. OLS',
  'pt-olm': 'PT. OLM',
};

const companyCodes = {
  'cv-asn': 'asn',
  'pt-ttu': 'ttu',
  'pt-ols': 'ols',
  'pt-olm': 'olm',
};

const directories = [
  {
    key: 'qlola',
    label: 'Transaksi QLOLA',
    color: '#90caf9',
    docTypeFilter: 'tagihan_pekerjaan',
  },
];

function CompanyDirectoryPage() {
  const { companyName } = useParams();
  const slug = (companyName || '').toLowerCase().replace(/\./g, '');
  const fullName = companyFullNames[slug] || slug.toUpperCase();
  const companyCode = companyCodes[slug] || slug;

  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDir, setSelectedDir] = useState(null);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await API.get('/documents/');
        const filtered = res.data.filter(
          (doc) => doc.archived && doc.status === 'sudah_dibayar' && doc.company === companyCode
        );
        setAllDocs(filtered);
      } catch (err) {
        console.error('Error fetching documents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [companyCode]);

  const docsToDisplay = selectedDir
    ? allDocs.filter((d) => d.doc_type === selectedDir.docTypeFilter)
    : [];

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, mt:-6 }}>
      <Breadcrumbs separator=">" sx={{ mb: 2 }}>
        <Link component={RouterLink} underline="hover" color="inherit" to="/directory">
          Direktori
        </Link>
        <Typography color="text.primary">{fullName}</Typography>
        {selectedDir && <Typography color="text.primary">{selectedDir.label}</Typography>}
      </Breadcrumbs>

      <Typography variant="h4" sx={{ fontWeight: 'bold', textAlign: 'center', mb: 3 }}>
        {fullName}
      </Typography>

      {!selectedDir && (
        <Grid container spacing={3} justifyContent="center">
          {directories.map((dir, idx) => (
            <Grid item xs={12} sm={6} md={3} key={dir.key}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx, duration: 0.4 }}
              >
                <Paper
                  elevation={3}
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderRadius: 3,
                    boxShadow: 3,
                    transition: '0.3s',
                    '&:hover': { boxShadow: 8, bgcolor: dir.color },
                  }}
                  onClick={() => setSelectedDir(dir)}
                >
                  <FolderOpenIcon sx={{ fontSize: 60, color: dir.color }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'medium', mt: 1 }}>
                    {dir.label}
                  </Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}

      {selectedDir && (
        <>
          <Box sx={{ mb: 2 }}>
            <Paper
              sx={{
                px: 2,
                py: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                bgcolor: '#f5f5f5',
              }}
              onClick={() => setSelectedDir(null)}
            >
              <ArrowBackIcon fontSize="small" />
              <Typography variant="body2">Kembali ke Daftar Direktori</Typography>
            </Paper>
          </Box>
          {loading ? (
            <CircularProgress />
          ) : (
            <Grid container spacing={3}>
              {docsToDisplay.map((doc) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={doc.id}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderRadius: 2,
                      transition: 'box-shadow 0.3s, transform 0.3s',
                      '&:hover': {
                        boxShadow: 6,
                        transform: 'translateY(-5px)',
                      },
                    }}
                    onClick={() => window.open(doc.file, '_blank')}
                  >
                    <Box sx={{ fontSize: 50, color: '#42a5f5', mb: 1 }}>📄</Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      #{doc.document_code}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(doc.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}

export default CompanyDirectoryPage;
