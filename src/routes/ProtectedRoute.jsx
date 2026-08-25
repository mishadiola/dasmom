import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getRoleConfig } from '../config/roleConfig';

export default function ProtectedRoute({ pageKey, children }) {
  const { user, isAuthLoading } = useContext(AuthContext); 
  const location = useLocation();

  console.log('ProtectedRoute: checking access', { pageKey, user, isAuthLoading });

  if (isAuthLoading) {
    return null;
  }

  if (!user) {
    // Redirect to appropriate login page based on current path
    const isMotherView = location.pathname.startsWith('/mother-home');
    const redirectPath = isMotherView ? '/mother-login' : '/';
    console.log(`No user in context, redirecting to ${redirectPath}`);
    return <Navigate to={redirectPath} replace />;
  }
  const userRole = (user.role || 'user').toLowerCase();
  const config = getRoleConfig(userRole) || { allowedPages: [], redirect: '/' };

  if (!config.allowedPages.includes(pageKey)) {
    console.log(`Access denied for ${userRole} on ${pageKey}`);
    return <Navigate to={config.redirect} replace />;
  }

  return children;
}
