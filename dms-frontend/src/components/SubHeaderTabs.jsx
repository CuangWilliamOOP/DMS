// File: src/components/SubHeaderTabs.jsx

import React from 'react';
import { Paper, Tabs, Tab } from '@mui/material';

function SubHeaderTabs({ tabValue, onTabChange }) {
  return (
      <Paper sx={{ px: 1, pb: 1, mb: 2, pt: 0 }}>
      <Tabs
        value={tabValue}
        onChange={onTabChange}
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab label="Dokumen Belum Disetujui" />
        <Tab label="Dokumen yang sudah disetujui" /> 
        <Tab label="Favorit" />
      </Tabs>
    </Paper>
  );
}

export default SubHeaderTabs;
