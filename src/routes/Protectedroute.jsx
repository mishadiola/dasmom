import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext'; 

export default function ProtectedRoute({ pageKey, children }) {
  const { user } = useContext(AuthContext); 
  const location = useLocation();

  console.log('ProtectedRoute: checking access', { pageKey, user });

  if (!user) {
    // Redirect to appropriate login page based on current path
    const isMotherView = location.pathname.startsWith('/mother-home');
    const redirectPath = isMotherView ? '/mother-login' : '/';
    console.log(`No user in context, redirecting to ${redirectPath}`);
    return <Navigate to={redirectPath} replace />;
  }
  const roleConfig = {
    admin: { allowedPages: ['admin'], redirect: '/dashboard' },
    mother: { allowedPages: ['mother'], redirect: '/mother-home' },
    user: { allowedPages: [], redirect: '/' },
  };

  const userRole = user.role || 'user';
  const config = roleConfig[userRole] || roleConfig['user'];

  if (!config.allowedPages.includes(pageKey)) {
    console.log(`Access denied for ${userRole} on ${pageKey}`);
    return <Navigate to={config.redirect} replace />;
  }

  return children;
}
