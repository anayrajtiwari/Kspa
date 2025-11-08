import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Divider,
  Alert,
  CircularProgress,
  useTheme,
  Tab,
  Tabs,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Phone,
  Lock,
  DirectionsCar,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const Login = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, googleLogin, isLoading, error, clearError } = useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState({
    identifier: '', // email or phone
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show message from URL params (e.g., after email verification)
  const [message, setMessage] = useState('');

  useEffect(() => {
    const msg = searchParams.get('message');
    if (msg) {
      setMessage(msg);
    }
  }, [searchParams]);

  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [tabValue]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setFormData({ identifier: '', password: '' });
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await login(formData);
      if (result.success) {
        const redirectTo = searchParams.get('redirect') || '/dashboard';
        navigate(redirectTo);
      }
    } catch (error) {
      // Error handling is done in the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // In a real app, you would implement Google OAuth
      toast.info('Google login will be available soon!');
    } catch (error) {
      toast.error('Google login failed');
    }
  };

  const handlePhoneLogin = async () => {
    if (!formData.identifier) {
      toast.error('Please enter your phone number');
      return;
    }

    // Redirect to phone verification page
    navigate(`/verify-phone?phone=${encodeURIComponent(formData.identifier)}`);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 2,
          }}
        >
          {/* Logo and Title */}
          <Box textAlign="center" mb={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
              <DirectionsCar sx={{ fontSize: 40, color: 'primary.main' }} />
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                Kspa
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to your account to continue
            </Typography>
          </Box>

          {/* Message Alert */}
          {message && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setMessage('')}>
              {message}
            </Alert>
          )}

          {/* Login Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={handleTabChange} centered>
              <Tab label="Email Login" />
              <Tab label="Phone Login" />
            </Tabs>
          </Box>

          {/* Email Login Form */}
          {tabValue === 0 && (
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Email Address"
                name="identifier"
                type="email"
                value={formData.identifier}
                onChange={handleChange}
                required
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ textAlign: 'right', mt: 1, mb: 2 }}>
                <Button
                  component={Link}
                  to="/forgot-password"
                  variant="text"
                  size="small"
                  sx={{ textTransform: 'none' }}
                >
                  Forgot Password?
                </Button>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isSubmitting || isLoading}
                sx={{ mb: 2, py: 1.5 }}
              >
                {isSubmitting || isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          )}

          {/* Phone Login */}
          {tabValue === 1 && (
            <Box>
              <TextField
                fullWidth
                label="Phone Number"
                name="identifier"
                type="tel"
                value={formData.identifier}
                onChange={handleChange}
                margin="normal"
                placeholder="+91 98765 43210"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handlePhoneLogin}
                disabled={!formData.identifier || isLoading}
                sx={{ mb: 2, py: 1.5 }}
              >
                Send OTP
              </Button>

              <Typography variant="body2" color="text.secondary" textAlign="center">
                We'll send a verification code to your phone number
              </Typography>
            </Box>
          )}

          {/* Social Login */}
          <Box sx={{ mt: 3 }}>
            <Divider>
              <Typography variant="body2" color="text.secondary">
                OR CONTINUE WITH
              </Typography>
            </Divider>

            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleGoogleLogin}
              sx={{ mt: 2, py: 1.5 }}
            >
              <Box component="img" src="/google-icon.png" alt="Google" sx={{ width: 20, height: 20, mr: 1 }} />
              Continue with Google
            </Button>
          </Box>

          {/* Register Link */}
          <Box textAlign="center" mt={3}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Button
                component={Link}
                to="/register"
                variant="text"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Sign Up
              </Button>
            </Typography>
          </Box>

          {/* Register as Showroom */}
          <Box textAlign="center" mt={1}>
            <Button
              component={Link}
              to="/register?userType=showroom"
              variant="text"
              size="small"
              sx={{ textTransform: 'none' }}
            >
              Register your showroom
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;