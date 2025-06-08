// File: src/components/ApprovedStamp.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';

function ApprovedStamp({ approvedAtString }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(255,0,0,0.2)',
        color: 'red',
        padding: '8px',
        border: '2px solid red',
        transform: 'rotate(-20deg)',
        fontWeight: 'bold',
      }}
    >
      <Typography variant="body1">APPROVED</Typography>
      {approvedAtString && (
        <Typography variant="caption" display="block">
          {approvedAtString}
        </Typography>
      )}
    </Box>
  );
}

export default ApprovedStamp;
