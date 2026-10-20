import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getRoleConfig } from '../config/roleConfig';
import StaffPageLoader from '../components/Common/StaffPageLoader';

export default function ProtectedRoute({ pageKey, children }) {
  const { user, isAuthLoading } = useContext(AuthContext); 
  const location = useLocation();

  if (isAuthLoading) {
    return <StaffPageLoader message="Verifying session..." minHeight="100vh" />;
  }

  if (!user) {
    // Redirect to appropriate login page based on current path
    const isMotherView = location.pathname.startsWith('/mother-home');
    const redirectPath = isMotherView ? '/mother-login' : '/';
    return <Navigate to={redirectPath} replace state={{ from: location }} />;
  }
  const userRole = (user.role || 'user').toLowerCase();
  if (pageKey === 'mother' && !['mother', 'patient'].includes(userRole)) {
    return <Navigate to="/" replace />;
  }
  const config = getRoleConfig(userRole) || { allowedPages: [], redirect: '/' };

  if (!config.allowedPages.includes(pageKey)) {
    return <Navigate to={config.redirect} replace />;
  }

  return children;
}
