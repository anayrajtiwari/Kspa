import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search,
  DirectionsCar,
  Star,
  LocationOn,
  Verified,
  TrendingUp,
  Speed,
  Security,
  Support,
  ArrowForward,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';

const Home = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [searchData, setSearchData] = useState({
    make: '',
    model: '',
    fuel: '',
    transmission: '',
    minPrice: '',
    maxPrice: '',
    location: '',
  });

  const [trendingVehicles, setTrendingVehicles] = useState([]);
  const [popularMakes, setPopularMakes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    try {
      // Fetch trending vehicles
      const trendingResponse = await apiService.search.getTrending();
      setTrendingVehicles(trendingResponse.data.trendingVehicles?.slice(0, 6) || []);

      // Fetch popular makes
      setPopularMakes(trendingResponse.data.popularMakes?.slice(0, 8) || []);
    } catch (error) {
      console.error('Failed to fetch home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (field) => (event) => {
    setSearchData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSearch = () => {
    const searchParams = new URLSearchParams();
    Object.entries(searchData).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });

    // Navigate to search page with filters
    window.location.href = `/search?${searchParams.toString()}`;
  };

  const features = [
    {
      icon: <Verified />,
      title: 'Verified Showrooms',
      description: 'All our partner showrooms are verified and trusted to ensure quality service.',
    },
    {
      icon: <TrendingUp />,
      title: 'Best Prices',
      description: 'Compare prices from multiple showrooms and get the best deals on your dream car.',
    },
    {
      icon: <Speed />,
      title: 'Quick Search',
      description: 'Find your perfect vehicle quickly with our advanced search and filtering options.',
    },
    {
      icon: <Security />,
      title: 'Secure Platform',
      description: 'Your data and transactions are protected with enterprise-grade security.',
    },
    {
      icon: <Support />,
      title: '24/7 Support',
      description: 'Our dedicated support team is always here to help you with any queries.',
    },
  ];

  const stats = [
    { number: '1000+', label: 'Verified Showrooms' },
    { number: '10,000+', label: 'Active Listings' },
    { number: '50,000+', label: 'Happy Customers' },
    { number: '20+', label: 'Cities Covered' },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h2" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
                Find Your Perfect Car with Trusted Local Showrooms
              </Typography>
              <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, lineHeight: 1.6 }}>
                Connect with verified local showrooms, compare prices, and make informed decisions.
                Your dream car is just a search away.
              </Typography>

              {/* Quick Search */}
              <Paper
                elevation={8}
                sx={{
                  p: { xs: 2, md: 3 },
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  color: 'text.primary',
                }}
              >
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Quick Search
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Make</InputLabel>
                      <Select
                        value={searchData.make}
                        onChange={handleSearchChange('make')}
                        label="Make"
                      >
                        <MenuItem value="">All Makes</MenuItem>
                        <MenuItem value="Maruti Suzuki">Maruti Suzuki</MenuItem>
                        <MenuItem value="Hyundai">Hyundai</MenuItem>
                        <MenuItem value="Tata">Tata</MenuItem>
                        <MenuItem value="Mahindra">Mahindra</MenuItem>
                        <MenuItem value="Honda">Honda</MenuItem>
                        <MenuItem value="Toyota">Toyota</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Max Price (₹)"
                      value={searchData.maxPrice}
                      onChange={handleSearchChange('maxPrice')}
                      placeholder="e.g., 1000000"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Fuel Type</InputLabel>
                      <Select
                        value={searchData.fuel}
                        onChange={handleSearchChange('fuel')}
                        label="Fuel Type"
                      >
                        <MenuItem value="">All Types</MenuItem>
                        <MenuItem value="petrol">Petrol</MenuItem>
                        <MenuItem value="diesel">Diesel</MenuItem>
                        <MenuItem value="cng">CNG</MenuItem>
                        <MenuItem value="electric">Electric</MenuItem>
                        <MenuItem value="hybrid">Hybrid</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      onClick={handleSearch}
                      sx={{
                        height: '100%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        py: 1.5,
                      }}
                      endIcon={<Search />}
                    >
                      Search
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <img
                  src="/api/placeholder/600/400"
                  alt="Hero Car"
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: '16px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box sx={{ py: 6, backgroundColor: 'grey.50' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index} textAlign="center">
                <Typography variant="h3" component="div" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {stat.number}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {stat.label}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 8 }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h3" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
              Why Choose Kspa?
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              We make car buying simple, transparent, and trustworthy with our innovative platform
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', width: 64, height: 64 }}>
                      {feature.icon}
                    </Avatar>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Trending Vehicles */}
      <Box sx={{ py: 8, backgroundColor: 'grey.50' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h3" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
              Trending Vehicles
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Popular vehicles chosen by our customers
            </Typography>
          </Box>

          {!loading && trendingVehicles.length > 0 ? (
            <Grid container spacing={4}>
              {trendingVehicles.map((vehicle) => (
                <Grid item xs={12} sm={6} md={4} key={vehicle._id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardMedia
                      component="img"
                      height="200"
                      image={vehicle.media?.photos?.[0]?.url || '/api/placeholder/300/200'}
                      alt={vehicle.title}
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {vehicle.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {vehicle.specifications?.year} • {vehicle.specifications?.fuel} • {vehicle.specifications?.transmission}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700 }}>
                          ₹{vehicle.pricing?.listedPrice?.toLocaleString()}
                        </Typography>
                        {vehicle.pricing?.negotiable && (
                          <Chip label="Negotiable" size="small" variant="outlined" />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {vehicle.showroomId?.showroomInfo?.businessName}
                        </Typography>
                        {vehicle.showroomId?.verification?.documents?.length > 0 && (
                          <Verified sx={{ fontSize: 16, color: 'success.main' }} />
                        )}
                      </Box>
                    </CardContent>
                    <CardActions>
                      <Button
                        component={Link}
                        to={`/vehicles/${vehicle._id}`}
                        variant="contained"
                        fullWidth
                        endIcon={<ArrowForward />}
                      >
                        View Details
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box textAlign="center">
              <Typography variant="body1" color="text.secondary">
                Loading trending vehicles...
              </Typography>
            </Box>
          )}

          <Box textAlign="center" mt={4}>
            <Button
              component={Link}
              to="/search"
              variant="outlined"
              size="large"
              endIcon={<ArrowForward />}
            >
              View All Vehicles
            </Button>
          </Box>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Container maxWidth="md" textAlign="center">
          <Typography variant="h3" component="h2" sx={{ fontWeight: 700, mb: 3 }}>
            Ready to Find Your Perfect Car?
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
            Join thousands of satisfied customers who found their dream cars through Kspa
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              component={Link}
              to="/search"
              variant="contained"
              size="large"
              sx={{
                backgroundColor: 'white',
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'grey.100',
                },
              }}
              endIcon={<Search />}
            >
              Search Vehicles
            </Button>
            <Button
              component={Link}
              to="/register"
              variant="outlined"
              size="large"
              sx={{
                borderColor: 'white',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
              endIcon={<ArrowForward />}
            >
              Register Now
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;