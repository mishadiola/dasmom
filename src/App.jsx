import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

import Landing from './pages/Landing/Landing';
import Login from './pages/Login/Login';
import MotherLogin from './pages/MotherLogin/MotherLogin';

import MotherDashboard from './pages/MotherDashboard/MotherDashboard';
import UserAccount from './pages/MotherDashboard/UserAccount';
import UserSettings from './pages/MotherDashboard/UserSettings';
import MyVitals from './pages/MotherDashboard/MyVitals';
import MyAppointments from './pages/MotherDashboard/MyAppointments';
import UserVaccinations from './pages/MotherDashboard/UserVaccinations';
import PregnancyTips from './pages/MotherDashboard/PregnancyTips';
import TipDetailPage from './pages/MotherDashboard/TipDetailPage';
import PregnancyDeliveryInfo from './pages/MotherDashboard/PregnancyDeliveryInfo';

import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard/Dashboard';

import PatientsList from './pages/Patients/PatientsList';
import PatientProfile from './pages/Patients/PatientProfile';
import AddPatient from './pages/Patients/AddPatient';
import HighRiskCases from './pages/HighRisk/HighRiskCases';
import Analytics from './pages/Analytics/Analytics';
import PrenatalVisits from './pages/prenatal/PrenatalVisits';
import AddPrenatalVisit from './pages/Prenatal/AddPrenatalVisit';
import PostpartumRecords from './pages/Postpartum/PostpartumRecords';
import Vaccinations from './pages/Vaccinations/Vaccinations';
import DeliveryOutcomes from './pages/Deliveries/DeliveryOutcomes';
import NewbornTracking from './pages/Newborns/NewbornTracking';
import StationReports from './pages/Station/StationReports';
import Settings from './pages/Settings/Settings';
import Inventory from './pages/Inventory/Inventory';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* PUBLIC ROUTES */}
          <Route path="/" element={<Login />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/admin-login" element={<Login />} />
          <Route path="/mother-login" element={<MotherLogin />} />
          

          {/* DASHBOARD LAYOUT - ADMIN / STAFF */}
          <Route path="/dashboard" element={
            <ProtectedRoute pageKey="admin">
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<PatientsList />} />
            <Route path="patients/add" element={<AddPatient />} />
            <Route path="patients/:id" element={<PatientProfile />} />
            <Route path="high-risk" element={<HighRiskCases />} />
            <Route path="prenatal" element={<PrenatalVisits />} />
            <Route path="prenatal/add" element={<AddPrenatalVisit />} />
            <Route path="postpartum" element={<PostpartumRecords />} />
            <Route path="vaccinations" element={<Vaccinations />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="deliveries" element={<DeliveryOutcomes />} />
            <Route path="newborns" element={<NewbornTracking />} />
            <Route path="stations" element={<StationReports />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* DASHBOARD LAYOUT - MOTHER / PATIENT */}
          <Route path="/mother-home" element={
            <ProtectedRoute pageKey="mother">
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<MotherDashboard />} />
            <Route path="user-vaccinations" element={<UserVaccinations />} />
            <Route path="user-account" element={<UserAccount />} />
            <Route path="user-settings" element={<UserSettings />} />
            <Route path="user-vitals" element={<MyVitals />} />
            <Route path="user-appointments" element={<MyAppointments />} />
            <Route path="user-tips" element={<PregnancyTips />} />
            <Route path="user-tips/:id" element={<TipDetailPage />} />
            <Route path="user-delivery-info" element={<PregnancyDeliveryInfo />} />
          </Route>

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;