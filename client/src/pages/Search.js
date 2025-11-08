import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Chip,
  Pagination,
  CircularProgress,
  Paper,
  useTheme,
  useMediaQuery,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Drawer,
  IconButton,
} from '@mui/material';
import {
  Search,
  FilterList,
  ExpandMore,
  LocationOn,
  DirectionsCar,
  Star,
  Verified,
  FavoriteBorder,
  Compare,
  Sort,
  Clear,
} from '@mui/icons-material';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';

const Search = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [vehicles, setVehicles] = useState([]);
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  // Price range state
  const [priceRange, setPriceRange] = useState([0, 5000000]);

  // Initialize filters from URL params
  useEffect(() => {
    const initialFilters = {};
    for (const [key, value] of searchParams.entries()) {
      if (key === 'minPrice' || key === 'maxPrice') {
        initialFilters[key] = parseInt(value);
      } else {
        initialFilters[key] = value;
      }
    }
    setFilters(initialFilters);

    if (initialFilters.minPrice || initialFilters.maxPrice) {
      setPriceRange([initialFilters.minPrice || 0, initialFilters.maxPrice || 5000000]);
    }

    if (initialFilters.sort) {
      setSortBy(initialFilters.sort);
    }
  }, [searchParams]);

  // Fetch vehicles
  useEffect(() => {
    fetchVehicles();
  }, [searchParams, sortBy]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(searchParams.entries());
      params.sort = sortBy;
      params.page = params.page || 1;
      params.limit = 12;

      const response = await apiService.vehicles.getVehicles(params);
      setVehicles(response.data.vehicles);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (newFilters) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);

    // Update URL params
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value);
      }
    });

    setSearchParams(params);
  };

  const handleFilterChange = (field, value) => {
    if (field === 'priceRange') {
      updateFilters({
        minPrice: value[0],
        maxPrice: value[1],
      });
      setPriceRange(value);
    } else {
      updateFilters({ [field]: value });
    }
  };

  const handleClearFilters = () => {
    setFilters({});
    setPriceRange([0, 5000000]);
    setSearchParams({});
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    updateFilters({ sort: newSort });
  };

  const handlePageChange = (event, value) => {
    updateFilters({ page: value });
  };

  const getPriceLabel = (value) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    }
    return `₹${(value / 1000).toFixed(0)}K`;
  };

  const FilterPanel = () => (
    <Paper sx={{ p: 3, height: 'fit-content' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Filters
        </Typography>
        <Button
          size="small"
          onClick={handleClearFilters}
          startIcon={<Clear />}
        >
          Clear All
        </Button>
      </Box>

      {/* Price Range */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            Price Range
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Slider
            value={priceRange}
            onChange={(event, newValue) => setPriceRange(newValue)}
            onChangeCommitted={(event, newValue) => handleFilterChange('priceRange', newValue)}
            valueLabelDisplay="auto"
            valueLabelFormat={getPriceLabel}
            min={0}
            max={5000000}
            step={50000}
            marks={[
              { value: 0, label: '₹0' },
              { value: 1000000, label: '₹10L' },
              { value: 2000000, label: '₹20L' },
              { value: 5000000, label: '₹50L' },
            ]}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {getPriceLabel(priceRange[0])}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getPriceLabel(priceRange[1])}
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Make */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            Make
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControl fullWidth>
            <Select
              value={filters.make || ''}
              onChange={(e) => handleFilterChange('make', e.target.value)}
              displayEmpty
            >
              <MenuItem value="">All Makes</MenuItem>
              <MenuItem value="Maruti Suzuki">Maruti Suzuki</MenuItem>
              <MenuItem value="Hyundai">Hyundai</MenuItem>
              <MenuItem value="Tata">Tata</MenuItem>
              <MenuItem value="Mahindra">Mahindra</MenuItem>
              <MenuItem value="Honda">Honda</MenuItem>
              <MenuItem value="Toyota">Toyota</MenuItem>
              <MenuItem value="Kia">Kia</MenuItem>
              <MenuItem value="MG">MG</MenuItem>
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>

      {/* Fuel Type */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            Fuel Type
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {['petrol', 'diesel', 'cng', 'electric', 'hybrid'].map((fuel) => (
              <FormControlLabel
                key={fuel}
                control={
                  <Checkbox
                    checked={filters.fuel === fuel}
                    onChange={(e) => handleFilterChange('fuel', e.target.checked ? fuel : '')}
                  />
                }
                label={fuel.charAt(0).toUpperCase() + fuel.slice(1)}
              />
            ))}
          </FormGroup>
        </AccordionDetails>
      </Accordion>

      {/* Transmission */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            Transmission
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={filters.transmission === 'manual'}
                  onChange={(e) => handleFilterChange('transmission', e.target.checked ? 'manual' : '')}
                />
              }
              label="Manual"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={filters.transmission === 'automatic'}
                  onChange={(e) => handleFilterChange('transmission', e.target.checked ? 'automatic' : '')}
                />
              }
              label="Automatic"
            />
          </FormGroup>
        </AccordionDetails>
      </Accordion>

      {/* Body Type */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            Body Type
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {['sedan', 'suv', 'hatchback', 'muv', 'coupe'].map((bodyType) => (
              <FormControlLabel
                key={bodyType}
                control={
                  <Checkbox
                    checked={filters.bodyType === bodyType}
                    onChange={(e) => handleFilterChange('bodyType', e.target.checked ? bodyType : '')}
                  />
                }
                label={bodyType.charAt(0).toUpperCase() + bodyType.slice(1)}
              />
            ))}
          </FormGroup>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );

  if (loading && vehicles.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Filters Sidebar */}
        {!isMobile && (
          <Grid item xs={12} md={3}>
            <FilterPanel />
          </Grid>
        )}

        {/* Main Content */}
        <Grid item xs={12} md={9}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                Search Vehicles
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {pagination?.total || 0} vehicles found
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {/* Sort Dropdown */}
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  label="Sort By"
                >
                  <MenuItem value="newest">Newest First</MenuItem>
                  <MenuItem value="price_asc">Price: Low to High</MenuItem>
                  <MenuItem value="price_desc">Price: High to Low</MenuItem>
                  <MenuItem value="year_desc">Year: Newest First</MenuItem>
                  <MenuItem value="kilometers_asc">Kilometers: Low to High</MenuItem>
                  <MenuItem value="popular">Most Popular</MenuItem>
                </Select>
              </FormControl>

              {/* Mobile Filter Button */}
              {isMobile && (
                <IconButton
                  onClick={() => setFilterDrawerOpen(true)}
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <FilterList />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Active Filters */}
          {Object.keys(filters).length > 0 && (
            <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(filters).map(([key, value]) => {
                if (!value) return null;
                let label = value;
                if (key === 'minPrice') label = `Min: ₹${parseInt(value).toLocaleString()}`;
                if (key === 'maxPrice') label = `Max: ₹${parseInt(value).toLocaleString()}`;
                return (
                  <Chip
                    key={key}
                    label={label}
                    onDelete={() => handleFilterChange(key, '')}
                    size="small"
                  />
                );
              })}
            </Box>
          )}

          {/* Vehicle Grid */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : vehicles.length > 0 ? (
            <>
              <Grid container spacing={3}>
                {vehicles.map((vehicle) => (
                  <Grid item xs={12} sm={6} md={4} key={vehicle._id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ position: 'relative' }}>
                        <CardMedia
                          component="img"
                          height="200"
                          image={vehicle.media?.photos?.[0]?.url || '/api/placeholder/300/200'}
                          alt={vehicle.title}
                        />
                        {vehicle.featured?.isFeatured && (
                          <Chip
                            label="Featured"
                            size="small"
                            color="primary"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                            }}
                          />
                        )}
                      </Box>

                      <CardContent sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, lineHeight: 1.2 }}>
                          {vehicle.title}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                          <Chip
                            label={`${vehicle.specifications?.year}`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={vehicle.specifications?.fuel}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={vehicle.specifications?.transmission}
                            size="small"
                            variant="outlined"
                          />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Typography variant="h5" color="primary.main" sx={{ fontWeight: 700 }}>
                            ₹{vehicle.pricing?.listedPrice?.toLocaleString()}
                          </Typography>
                          {vehicle.pricing?.negotiable && (
                            <Chip label="Negotiable" size="small" variant="outlined" />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                            {vehicle.showroomId?.showroomInfo?.businessName}
                          </Typography>
                          {vehicle.showroomId?.verification?.documents?.length > 0 && (
                            <Verified sx={{ fontSize: 16, color: 'success.main' }} />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {vehicle.condition?.kilometers?.toLocaleString()} km
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            •
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {vehicle.condition?.owners} owner{vehicle.condition?.owners > 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </CardContent>

                      <CardActions sx={{ p: 2, pt: 0 }}>
                        <Button
                          component={Link}
                          to={`/vehicles/${vehicle._id}`}
                          variant="contained"
                          size="small"
                          sx={{ flexGrow: 1 }}
                        >
                          View Details
                        </Button>
                        <IconButton size="small">
                          <FavoriteBorder />
                        </IconButton>
                        <IconButton size="small">
                          <Compare />
                        </IconButton>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={pagination.pages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    color="primary"
                    size={isMobile ? 'small' : 'medium'}
                  />
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <DirectionsCar sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No vehicles found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Try adjusting your filters or search criteria
              </Typography>
              <Button variant="outlined" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Mobile Filter Drawer */}
      <Drawer
        anchor="left"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 300,
            p: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Filters</Typography>
          <IconButton onClick={() => setFilterDrawerOpen(false)}>
            <Clear />
          </IconButton>
        </Box>
        <FilterPanel />
      </Drawer>
    </Container>
  );
};

export default Search;