// File: src/components/SubHeaderTabs.jsx
import React from 'react';
import { Tabs, Tab, Box } from '@mui/material';

function SubHeaderTabs({ tabValue, onTabChange, pendingCount, unpaidCount }) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs
        value={tabValue}
        onChange={onTabChange}
        variant="fullWidth"             // equal width
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab
          value={0}
          label={
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span>DOKUMEN BELUM DISETUJUI</span>
              {pendingCount > 0 && (
                <Box
                  sx={{
                    ml: 1,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: '#e53935',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
                >
                  {pendingCount}
                </Box>
              )}
            </Box>
          }
        />
        <Tab
          value={1}
          label={
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span>DOKUMEN BELUM DIBAYAR</span>
              {unpaidCount > 0 && (
                <Box
                  sx={{
                    ml: 1,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: '#e53935',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
                >
                  {unpaidCount}
                </Box>
              )}
            </Box>
          }
        />

        <Tab
          value={2}
          label={
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span>PETA KEBUN</span>
            </Box>
          }
        />
      </Tabs>
    </Box>
  );
}

export default SubHeaderTabs;
