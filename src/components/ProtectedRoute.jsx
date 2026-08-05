import { Navigate } from 'react-router-dom';
import { useEffect, useState, useContext } from 'react';
import AuthService from '../services/authservice';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children, pageKey }) => {
    const authService = new AuthService();
    const { user, isAuthLoading } = useContext(AuthContext);

    if (isAuthLoading) return <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="set-spinner" /></div>;
    if (!user) return <Navigate to="/" />;
    if (!authService.accessCheck(user, pageKey)) return <Navigate to="/unauthorized" />;
    return children;
};

export default ProtectedRoute;