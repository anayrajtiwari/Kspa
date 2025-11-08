import React from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Link,
  Divider,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  Facebook,
  Twitter,
  Instagram,
  LinkedIn,
  YouTube,
  Email,
  Phone,
  LocationOn,
  DirectionsCar,
} from '@mui/icons-material';

const Footer = () => {
  const theme = useTheme();

  const footerSections = [
    {
      title: 'Company',
      links: [
        { text: 'About Us', href: '/about' },
        { text: 'How it Works', href: '/how-it-works' },
        { text: 'Careers', href: '/careers' },
        { text: 'Press', href: '/press' },
        { text: 'Blog', href: '/blog' },
      ],
    },
    {
      title: 'For Showrooms',
      links: [
        { text: 'Register Showroom', href: '/register?userType=showroom' },
        { text: 'Showroom Dashboard', href: '/showroom-features' },
        { text: 'Pricing Plans', href: '/pricing' },
        { text: 'Success Stories', href: '/success-stories' },
        { text: 'Support', href: '/showroom-support' },
      ],
    },
    {
      title: 'For Customers',
      links: [
        { text: 'Search Vehicles', href: '/search' },
        { text: 'Compare Cars', href: '/compare' },
        { text: 'Sell Your Car', href: '/sell-car' },
        { text: 'Financing Options', href: '/financing' },
        { text: 'Insurance', href: '/insurance' },
      ],
    },
    {
      title: 'Support',
      links: [
        { text: 'Help Center', href: '/help' },
        { text: 'Safety Center', href: '/safety' },
        { text: 'Terms of Service', href: '/terms' },
        { text: 'Privacy Policy', href: '/privacy' },
        { text: 'Contact Us', href: '/contact' },
      ],
    },
  ];

  const socialLinks = [
    { icon: <Facebook />, href: '#', label: 'Facebook' },
    { icon: <Twitter />, href: '#', label: 'Twitter' },
    { icon: <Instagram />, href: '#', label: 'Instagram' },
    { icon: <LinkedIn />, href: '#', label: 'LinkedIn' },
    { icon: <YouTube />, href: '#', label: 'YouTube' },
  ];

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: theme.palette.grey[900],
        color: 'white',
        mt: 'auto',
      }}
    >
      {/* Main Footer Content */}
      <Box sx={{ py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {/* Company Info */}
            <Grid item xs={12} md={4}>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <DirectionsCar sx={{ fontSize: 32, color: 'primary.main' }} />
                  <Typography variant="h5" component="div" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    Kspa
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 2, color: 'grey.300' }}>
                  India's trusted car sales broker platform connecting local showrooms with customers nationwide.
                  Find your perfect vehicle from verified dealerships at competitive prices.
                </Typography>
              </Box>

              {/* Contact Info */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Contact Us
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Phone sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="body2" color="grey.300">
                      +91 98765 43210
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Email sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="body2" color="grey.300">
                      support@kspa.com
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <LocationOn sx={{ fontSize: 18, color: 'primary.main', mt: 0.5 }} />
                    <Typography variant="body2" color="grey.300">
                      123, Business Park, Sector 12, Gurgaon, Haryana 122001
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Social Media */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Follow Us
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {socialLinks.map((social) => (
                    <IconButton
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{
                        color: 'grey.400',
                        '&:hover': {
                          color: 'primary.main',
                          backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        },
                      }}
                      aria-label={social.label}
                    >
                      {social.icon}
                    </IconButton>
                  ))}
                </Box>
              </Box>
            </Grid>

            {/* Footer Links */}
            {footerSections.map((section) => (
              <Grid item xs={12} sm={6} md={2} key={section.title}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  {section.title}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {section.links.map((link) => (
                    <Link
                      key={link.text}
                      href={link.href}
                      color="grey.300"
                      underline="hover"
                      sx={{
                        fontSize: '0.875rem',
                        '&:hover': {
                          color: 'primary.main',
                        },
                      }}
                    >
                      {link.text}
                    </Link>
                  ))}
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Bottom Bar */}
      <Divider sx={{ backgroundColor: 'grey.800' }} />
      <Box sx={{ py: 3 }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
            }}
          >
            <Typography variant="body2" color="grey.400">
              © 2024 Kspa Car Broker Platform. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Link
                href="/terms"
                color="grey.400"
                underline="hover"
                sx={{ fontSize: '0.875rem' }}
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                color="grey.400"
                underline="hover"
                sx={{ fontSize: '0.875rem' }}
              >
                Privacy Policy
              </Link>
              <Link
                href="/cookies"
                color="grey.400"
                underline="hover"
                sx={{ fontSize: '0.875rem' }}
              >
                Cookie Policy
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Footer;