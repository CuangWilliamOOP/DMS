// File: src/components/SubHeaderTabs.jsx

import React from 'react';
import { Paper, Tabs, Tab, Badge } from '@mui/material';

const badgeSx = {
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
};

function SubHeaderTabs({
  tabValue,
  onTabChange,
  pendingCount = 0,
  unpaidCount = 0,
  favoriteCount = 0,
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
            <Badge badgeContent={pendingCount} color="error" sx={badgeSx}>
              Dokumen&nbsp;Belum&nbsp;Disetujui
            </Badge>
          }
        />
        <Tab
          label={
            <Badge badgeContent={unpaidCount} color="error" sx={badgeSx}>
              Dokumen&nbsp;Belum&nbsp;Dibayar
            </Badge>
          }
        />
        <Tab
          label={
            <Badge badgeContent={favoriteCount} color="secondary" sx={badgeSx}>
              Favorit
            </Badge>
          }
        />
      </Tabs>
    </Paper>
  );
}

export default SubHeaderTabs;
