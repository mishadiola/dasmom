import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import PatientsList from './pages/Patients/PatientsList';
import PatientProfile from './pages/Patients/PatientProfile';
import PregnancyTracking from './pages/Pregnancy/PregnancyTracking';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<PatientsList />} />
          <Route path="patients/:id" element={<PatientProfile />} />
          <Route path="pregnancy" element={<PregnancyTracking />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
