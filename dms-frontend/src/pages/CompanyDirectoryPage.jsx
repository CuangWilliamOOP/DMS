import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  CircularProgress,
  Grid,
  Paper,
  IconButton,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import API from '../services/api';
import { useTheme } from '@mui/material/styles';

const companyFullNames = {
  'cv-asn': 'CV. Alam Subur Nusantara',
  'pt-ttu': 'PT. Tunggal Tunggul Unggul',
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
  {
    key: 'internal',
    label: 'Transaksi Internal',
    color: '#a5d6a7',
    docTypeFilter: 'tagihan_internal',
  },
  {
    key: 'lain',
    label: 'Dokumen Lain',
    color: '#ffcc80',
    docTypeFilter: 'lainnya',
  },
];

// shared breadcrumb style
const breadcrumbSx = {
  mb: 3,
  fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.25rem' },
  '& a, & .MuiTypography-root': { fontWeight: 500 },
};

function CompanyDirectoryPage() {
  const { companyName, dirKey } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const slug = (companyName || '').toLowerCase().replace(/\./g, '');
  const fullName = companyFullNames[slug] || slug.toUpperCase();
  const companyCode = companyCodes[slug] || slug;

  const selectedDir = directories.find((d) => d.key === dirKey) || null;

  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await API.get('/documents/');
        const filtered = res.data.filter(
          (d) => d.archived && d.status === 'sudah_dibayar' && d.company === companyCode,
        );
        setAllDocs(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [companyCode]);

  const docsToDisplay = selectedDir
    ? allDocs.filter((d) => d.doc_type === selectedDir.docTypeFilter)
    : [];

  const handleDelete = async (docId) => {
    if (window.confirm('Yakin ingin menghapus dokumen ini?')) {
      try {
        await API.delete(`/documents/${docId}/`);
        setAllDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));
        alert('Dokumen berhasil dihapus.');
      } catch (error) {
        console.error(error);
        alert('Terjadi kesalahan saat menghapus dokumen.');
      }
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, mt: -6}}>
      <Breadcrumbs sx={breadcrumbSx} separator=">">
        {/* root */}
        <Link component={RouterLink} underline="hover" to="/directory">
          Direktori
        </Link>
        {/* company – link only when a folder or file is open */}
        {selectedDir ? (
          <Link component={RouterLink} underline="hover" to={`/directory/${companyName}`}>
            {fullName}
          </Link>
        ) : (
          <Typography color="text.primary">{fullName}</Typography>
        )}
        {/* folder segment – visible only inside a folder */}
        {selectedDir && (
          <Typography color="text.primary">{selectedDir.label}</Typography>
        )}
      </Breadcrumbs>

      {!selectedDir && (
        <Grid container spacing={3}>
          {directories.map((dir, idx) => (
            <Grid item xs={12} sm={6} md={4} key={dir.key}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx, duration: 0.35 }}
              >
                <Paper
                  elevation={2}
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderRadius: 2,
                    transition: 'box-shadow 0.3s, transform 0.3s',
                    '&:hover': { boxShadow: 6, transform: 'translateY(-5px)' },
                  }}
                  onClick={() => navigate(`/directory/${companyName}/${dir.key}`)}
                >
                  <FolderOpenIcon sx={{ fontSize: 60, color: dir.color }} />
                  <Typography variant="subtitle1" fontWeight="medium" sx={{ mt: 1 }}>
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
                bgcolor: isDark ? 'background.paper' : '#f5f5f5',
                color: isDark ? 'text.primary' : 'inherit',
              }}
              onClick={() => navigate(`/directory/${companyName}`)}
            >
              <ArrowBackIcon fontSize="small" />
              <Typography variant="body2">Kembali ke Daftar Direktori</Typography>
            </Paper>
          </Box>

          {loading ? (
            <CircularProgress />
          ) : (
            <Grid container spacing={3}>
              {docsToDisplay.map((doc, idx) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={doc.id}>
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * idx, duration: 0.35 }}>
                    <Paper elevation={2} sx={{ p: 2, position: 'relative', textAlign: 'center', cursor: 'pointer' }} onClick={() =>
                      navigate(`/directory/${companyName}/${selectedDir.key}/preview/${doc.document_code}`)
                    }>
                      <Typography variant="subtitle1">#{doc.document_code}</Typography>
                      <Typography variant="body2">
                        {new Date(doc.created_at).toLocaleDateString('id-ID')}
                      </Typography>
                      {localStorage.getItem('role') === 'owner' && (
                        <IconButton sx={{ position: 'absolute', top: 8, right: 8 }} color="error" onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}>
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Paper>
                  </motion.div>
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
