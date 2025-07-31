// File: src/pages/HomePage.jsx

import React, { useEffect, useState } from 'react';
import { Box, Paper, Divider } from '@mui/material';
import API from '../services/api';
import DocumentTable from '../components/DocumentTable';
import SubHeaderTabs from '../components/SubHeaderTabs';
import { useTheme } from '@mui/material/styles';
import { motion } from "framer-motion";

function HomePage() {
  const [documents, setDocuments] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const theme = useTheme();

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

  const handleTabChange = (event, newValue) => setTabValue(newValue);

  const pendingCount = documents.filter(
    (d) =>
      !d.archived &&
      (d.status === 'belum_disetujui' || d.status === 'draft')
  ).length;

  const unpaidCount = documents.filter(
    (d) =>
      !d.archived &&
      d.status === 'disetujui'
  ).length;

  // Background gradient (adapts to dark mode)
  const bgGradient =
    theme.palette.mode === "dark"
      ? "linear-gradient(120deg, #181a29 60%, #283e6d 100%)"
      : "linear-gradient(120deg, #e3f0fd 60%, #e1d8f3 100%)";

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
          background: theme.palette.mode === 'dark'
            ? '#181a29'
            : '#e3f0fd',
          transition: 'background 0.3s',
        }}
      />
      {/* --- FOREGROUND CONTENT --- */}
      <Box
        sx={{
          minHeight: "100vh",
          width: "100%",
          px: { xs: 0, sm: 2, md: 4 },
          py: 5,
          mt: -10,
          position: 'relative',
        }}
      >
        {/* Tabs */}
        <Paper
          elevation={2}
          sx={{
            mt: 3,
            px: { xs: 0, sm: 2 },
            pt: 1.5,
            pb: 2,
            mb: 2,
            borderRadius: 4,
            background:
              theme.palette.mode === "dark"
                ? "rgba(34, 46, 80, 0.86)"
                : "rgba(255,255,255,0.89)",
            boxShadow:
              theme.palette.mode === "dark"
                ? "0 1px 10px 0 #24224a2e"
                : "0 2px 16px 0 #d1e2ff1c",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <SubHeaderTabs
            tabValue={tabValue}
            onTabChange={handleTabChange}
            pendingCount={pendingCount}
            unpaidCount={unpaidCount}
          />
        </Paper>

        <Box sx={{ height: 18 }} />

        <Divider
          sx={{
            maxWidth: "1100px",
            margin: "0 auto",
            borderColor: theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.10)"
              : "rgba(0,0,0,0.10)",
            borderBottomWidth: 1.5,
            borderRadius: 8,
            opacity: 0.7,
            mb: 2,
          }}
        />

        {/* DocumentTable Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.25 }}
        >
          <Paper
            elevation={6}
            sx={{
              p: { xs: 1, sm: 3 },
              borderRadius: 5,
              background:
                theme.palette.mode === "dark"
                  ? "linear-gradient(120deg, #1c2341 70%, #19162e 100%)"
                  : "linear-gradient(120deg, #fff 75%, #ecf3ff 100%)",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 6px 36px 0 #000c"
                  : "0 4px 24px 0 #b8c6f955",
              maxWidth: "1200px",
              margin: "0 auto",
            }}
          >
            <DocumentTable
              documents={getFilteredDocuments()}
              refreshDocuments={fetchAllDocuments}
            />
          </Paper>
        </motion.div>
      </Box>
    </>
  );
}

export default HomePage;
