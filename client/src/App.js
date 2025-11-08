import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './contexts/AuthContext';

// Layout components
import Layout from './components/Layout/Layout';
import PublicLayout from './components/Layout/PublicLayout';

// Page components
import Home from './pages/Home';
import Search from './pages/Search';
import VehicleDetails from './pages/VehicleDetails';
import Compare from './pages/Compare';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import VerifyEmail from './pages/Auth/VerifyEmail';
import Dashboard from './pages/Dashboard/Dashboard';
import MyListings from './pages/Showroom/MyListings';
import AddVehicle from './pages/Showroom/AddVehicle';
import EditVehicle from './pages/Showroom/EditVehicle';
import Messages from './pages/Messages/Messages';
import Conversation from './pages/Messages/Conversation';
import Appointments from './pages/Appointments/Appointments';
import Profile from './pages/Profile/Profile';
import Subscription from './pages/Subscription/Subscription';
import NotFound from './pages/NotFound';

// Protected route component
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Public route component (redirects to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="vehicles/:id" element={<VehicleDetails />} />
        <Route path="compare" element={<Compare />} />
      </Route>

      {/* Auth routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route path="dashboard" element={<Dashboard />} />

        {/* Customer routes */}
        <Route path="profile" element={<Profile />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:conversationId" element={<Conversation />} />
        <Route path="appointments" element={<Appointments />} />

        {/* Showroom routes */}
        <Route
          path="my-listings"
          element={
            <ProtectedRoute requiredRole="showroom">
              <MyListings />
            </ProtectedRoute>
          }
        />
        <Route
          path="add-vehicle"
          element={
            <ProtectedRoute requiredRole="showroom">
              <AddVehicle />
            </ProtectedRoute>
          }
        />
        <Route
          path="edit-vehicle/:id"
          element={
            <ProtectedRoute requiredRole="showroom">
              <EditVehicle />
            </ProtectedRoute>
          }
        />
        <Route
          path="subscription"
          element={
            <ProtectedRoute requiredRole="showroom">
              <Subscription />
            </ProtectedRoute>
          }
        />

        {/* Admin routes (if needed) */}
        <Route
          path="admin/*"
          element={
            <ProtectedRoute requiredRole="admin">
              {/* Admin routes would go here */}
              <div>Admin Dashboard</div>
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;