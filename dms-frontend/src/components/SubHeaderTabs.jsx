// File: src/components/SubHeaderTabs.jsx
import React from 'react';
import { Tabs, Tab, Box, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

function SubHeaderTabs({ tabValue, onTabChange, pendingCount, unpaidCount }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const indicatorColor = isDark ? '#60a5fa' : '#1d4ed8';

  const TabLabel = ({ text, count }) => (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        component="span"
        sx={{
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {text}
      </Box>
      {count > 0 && (
        <Chip
          label={count}
          size="small"
          sx={{
            height: 18,
            minWidth: 22,
            px: 0.5,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            bgcolor: isDark
              ? 'rgba(148, 163, 184, 0.4)'
              : 'rgba(15, 23, 42, 0.08)',
          }}
        />
      )}
    </Box>
  );

  return (
    <Box sx={{ px: { xs: 0.5, sm: 1 } }}>
      <Tabs
        value={tabValue}
        onChange={onTabChange}
        variant="fullWidth"
        textColor="inherit"
        TabIndicatorProps={{
          style: {
            height: 3,
            borderRadius: 999,
            backgroundColor: indicatorColor,
          },
        }}
        sx={{
          minHeight: 0,
          '& .MuiTabs-flexContainer': {
            gap: { xs: 0, sm: 0.5 },
          },
          '& .MuiTab-root': {
            minHeight: 0,
            py: 1,
            px: 1,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 13,
            color: isDark
              ? 'rgba(226,232,240,0.8)'
              : 'rgba(15,23,42,0.7)',
          },
          '& .MuiTab-root.Mui-selected': {
            color: isDark ? '#f9fafb' : '#0f172a',
            fontWeight: 600,
          },
        }}
      >
        <Tab
          value={0}
          disableRipple
          label={<TabLabel text="Belum disetujui" count={pendingCount} />}
        />
        <Tab
          value={1}
          disableRipple
          label={<TabLabel text="Belum dibayar" count={unpaidCount} />}
        />
      </Tabs>
    </Box>
  );
}

export default SubHeaderTabs;
