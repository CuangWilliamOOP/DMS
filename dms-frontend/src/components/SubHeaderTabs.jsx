// File: src/components/SubHeaderTabs.jsx
import React from 'react';
import { Tabs, Tab, Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

function SubHeaderTabs({ tabValue, onTabChange, pendingCount, unpaidCount }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));

  const pendingLabel = isSmDown ? 'Belum Disetujui' : 'DOKUMEN BELUM DISETUJUI';
  const unpaidLabel = isSmDown ? 'Belum Dibayar' : 'DOKUMEN BELUM DIBAYAR';
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs
        value={tabValue}
        onChange={onTabChange}
        variant={isSmDown ? 'scrollable' : 'fullWidth'}
        scrollButtons={isSmDown ? 'auto' : false}
        allowScrollButtonsMobile
        textColor="inherit"
        TabIndicatorProps={{
          sx: {
            height: 3,
            borderRadius: 999,
            backgroundColor: isDark ? 'rgba(255,255,255,0.85)' : 'primary.main',
          },
        }}
        sx={{
          '& .MuiTab-root': {
            fontSize: isSmDown ? 12 : 13,
            px: isSmDown ? 1.25 : 2,
            minWidth: isSmDown ? 'auto' : 0,
            whiteSpace: 'nowrap',
            color: isDark ? 'rgba(255,255,255,0.62)' : 'rgba(15,23,42,0.70)',
            fontWeight: 600,
          },
          '& .MuiTab-root.Mui-selected': {
            color: isDark ? '#fff' : '#0f172a',
            fontWeight: 800,
          },
        }}
      >
        <Tab
          value={0}
          label={
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span>{pendingLabel}</span>
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
              <span>{unpaidLabel}</span>
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
