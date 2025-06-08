// File: src/pages/HomePage.jsx

import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import API from '../services/api';
import DocumentTable from '../components/DocumentTable';
import SubHeaderTabs from '../components/SubHeaderTabs';

function HomePage() {
  const [documents, setDocuments] = useState([]);
  const [tabValue, setTabValue] = useState(0); // 0 => Belum Disetujui, 1 => Disetujui, 2 => Favorit (placeholder)

  useEffect(() => {
    fetchAllDocuments();
  }, []);

  const fetchAllDocuments = async () => {
    try {
      const res = await API.get('/documents/');
      setDocuments(res.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  // This logic filters documents by the chosen tab
  const getFilteredDocuments = () => {
    if (tabValue === 0) {
      return documents.filter(
        (doc) => !doc.archived && doc.status !== 'disetujui' && doc.status !== 'sudah_dibayar'
      );
    } else if (tabValue === 1) {
      return documents.filter((doc) => !doc.archived && doc.status === 'disetujui');
    }
    return [];
  };
  
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
      <Box sx={{ px: 2, pb: 2, pt: 0, mt: -6 }}>
      <SubHeaderTabs tabValue={tabValue} onTabChange={handleTabChange} />

      {/* DocumentTable expects a list of docs to display */}
      <DocumentTable
        documents={getFilteredDocuments()}
        refreshDocuments={fetchAllDocuments}
      />
    </Box>
  );
}

export default HomePage;
