import React from 'react';
import { Box, Typography } from '@mui/material';

const Dashboard = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Dashboard page coming soon...
      </Typography>
    </Box>
  );
};

export default Dashboard;