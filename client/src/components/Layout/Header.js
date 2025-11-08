import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
  Avatar,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  DirectionsCar,
  Phone,
  Email,
  LocationOn,
  AccountCircle,
  Notifications,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Header = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleProfileMenuOpen = (event) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleLogout = async () => {
    await logout();
    handleProfileMenuClose();
    handleMobileMenuClose();
  };

  const menuItems = [
    { text: 'Home', path: '/' },
    { text: 'Search Vehicles', path: '/search' },
    { text: 'Compare', path: '/compare' },
    ...(isAuthenticated
      ? [
          { text: 'Dashboard', path: '/dashboard' },
          { text: 'Messages', path: '/messages' },
          { text: 'Appointments', path: '/appointments' },
        ]
      : []),
  ];

  return (
    <>
      <AppBar position="fixed" elevation={2}>
        <Toolbar sx={{ backgroundColor: 'white', color: 'text.primary' }}>
          {/* Logo */}
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{
              flexGrow: 1,
              textDecoration: 'none',
              color: 'primary.main',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <DirectionsCar />
            Kspa
          </Typography>

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {menuItems.map((item) => (
                <Button
                  key={item.text}
                  component={Link}
                  to={item.path}
                  sx={{
                    color: 'text.primary',
                    fontWeight: 500,
                    '&:hover': {
                      color: 'primary.main',
                      backgroundColor: 'transparent',
                    },
                  }}
                >
                  {item.text}
                </Button>
              ))}

              {!isAuthenticated ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/login')}
                    sx={{ borderColor: 'primary.main', color: 'primary.main' }}
                  >
                    Login
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/register')}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  >
                    Register
                  </Button>
                </>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* Notifications */}
                  <IconButton color="inherit">
                    <Badge badgeContent={0} color="error">
                      <Notifications />
                    </Badge>
                  </IconButton>

                  {/* Profile Menu */}
                  <IconButton
                    onClick={handleProfileMenuOpen}
                    sx={{ p: 0 }}
                  >
                    <Avatar
                      src={user?.profile?.photo}
                      alt={user?.profile?.name}
                      sx={{ width: 32, height: 32 }}
                    >
                      {user?.profile?.name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                  </IconButton>

                  <Menu
                    anchorEl={profileMenuAnchor}
                    open={Boolean(profileMenuAnchor)}
                    onClose={handleProfileMenuClose}
                    PaperProps={{
                      elevation: 0,
                      sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                        mt: 1.5,
                        '&:before': {
                          content: '""',
                          display: 'block',
                          position: 'absolute',
                          top: 0,
                          right: 14,
                          width: 10,
                          height: 10,
                          bgcolor: 'background.paper',
                          transform: 'translateY(-50%) rotate(45deg)',
                          zIndex: 0,
                        },
                      },
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                  >
                    <MenuItem onClick={() => { navigate('/dashboard'); handleProfileMenuClose(); }}>
                      <AccountCircle sx={{ mr: 2 }} /> Dashboard
                    </MenuItem>
                    <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
                      <AccountCircle sx={{ mr: 2 }} /> Profile
                    </MenuItem>
                    {user?.userType === 'showroom' && (
                      <MenuItem onClick={() => { navigate('/my-listings'); handleProfileMenuClose(); }}>
                        <DirectionsCar sx={{ mr: 2 }} /> My Listings
                      </MenuItem>
                    )}
                    <MenuItem onClick={handleLogout}>
                      <AccountCircle sx={{ mr: 2 }} /> Logout
                    </MenuItem>
                  </Menu>
                </Box>
              )}
            </Box>
          )}

          {/* Mobile Menu */}
          {isMobile && (
            <>
              {!isAuthenticated ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate('/login')}
                    sx={{ borderColor: 'primary.main', color: 'primary.main' }}
                  >
                    Login
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => navigate('/register')}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  >
                    Register
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton color="inherit">
                    <Badge badgeContent={0} color="error">
                      <Notifications />
                    </Badge>
                  </IconButton>
                  <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0 }}>
                    <Avatar
                      src={user?.profile?.photo}
                      alt={user?.profile?.name}
                      sx={{ width: 32, height: 32 }}
                    >
                      {user?.profile?.name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                  </IconButton>
                  <IconButton
                    color="inherit"
                    onClick={handleMobileMenuOpen}
                  >
                    <MenuIcon />
                  </IconButton>

                  <Menu
                    anchorEl={profileMenuAnchor}
                    open={Boolean(profileMenuAnchor)}
                    onClose={handleProfileMenuClose}
                  >
                    <MenuItem onClick={() => { navigate('/dashboard'); handleProfileMenuClose(); }}>
                      Dashboard
                    </MenuItem>
                    <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
                      Profile
                    </MenuItem>
                    <MenuItem onClick={handleLogout}>Logout</MenuItem>
                  </Menu>
                </Box>
              )}

              {/* Mobile Navigation Menu */}
              <Menu
                anchorEl={mobileMenuAnchor}
                open={Boolean(mobileMenuAnchor)}
                onClose={handleMobileMenuClose}
                PaperProps={{
                  style: {
                    width: 250,
                  },
                }}
              >
                {menuItems.map((item) => (
                  <MenuItem
                    key={item.text}
                    onClick={() => {
                      navigate(item.path);
                      handleMobileMenuClose();
                    }}
                  >
                    {item.text}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* Top Info Bar */}
      <Box
        sx={{
          backgroundColor: 'primary.main',
          color: 'white',
          py: 0.5,
          display: { xs: 'none', sm: 'block' },
        }}
      >
        <Box className="container" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 3, fontSize: '0.875rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Phone fontSize="small" />
              <span>+91 98765 43210</span>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Email fontSize="small" />
              <span>support@kspa.com</span>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}>
            <LocationOn fontSize="small" />
            <span>Serving all major cities in India</span>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default Header;