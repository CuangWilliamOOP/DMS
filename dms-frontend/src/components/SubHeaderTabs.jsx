// File: src/components/SubHeaderTabs.jsx

import React from 'react';
import { Paper, Tabs, Tab, Badge } from '@mui/material';

function SubHeaderTabs({
  tabValue,
  onTabChange,
  pendingCount = 0,
  approvedCount = 0,
}) {
  return (
      <Paper sx={{ px: 1, pb: 1, mb: 2, pt: 0 }}>
      <Tabs
        value={tabValue}
        onChange={onTabChange}
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab
          label={
            <Badge
              badgeContent={pendingCount}
              color="error"
              sx={{
                '& .MuiBadge-badge': {
                  /* 16 × 16 px round pill */
                  width: 16,
                  height: 16,
                  minWidth: 16,
                  fontSize: '0.55rem',
                  lineHeight: '16px',
                  borderRadius: '50%',
                  padding: 0,
                  top: -6,
                  right: -6,
                },
              }}
            >
              Dokumen&nbsp;Belum&nbsp;Disetujui
            </Badge>
          }
        />
        <Tab
          label={
            <Badge
              badgeContent={approvedCount}
              color="error" // red
              sx={{
                '& .MuiBadge-badge': {
                  width: 16,
                  height: 16,
                  minWidth: 16,
                  fontSize: '0.55rem',
                  lineHeight: '16px',
                  borderRadius: '50%',
                  padding: 0,
                  top: -6,
                  right: -6,
                },
              }}
            >
              Dokumen&nbsp;belum&nbsp;dibayar
            </Badge>
          }
        />
        <Tab label="Favorit" />
      </Tabs>
    </Paper>
  );
}

export default SubHeaderTabs;
