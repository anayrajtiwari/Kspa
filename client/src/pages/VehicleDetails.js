import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

const VehicleDetails = () => {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Vehicle Details
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Vehicle details page coming soon...
      </Typography>
    </Box>
  );
};

export default VehicleDetails;