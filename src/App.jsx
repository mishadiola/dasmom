import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { RolePermissionProvider } from './context/RolePermissionContext';
import { PermissionBoundary } from './context/RolePermissionContext';
import { ModalProvider } from './context/ModalContext';
import { LanguageProvider } from './context/LanguageContext';
import { SystemSettingsProvider } from './context/SystemSettingsContext';
import ProtectedRoute from './routes/ProtectedRoute';
import ErrorBoundary from './components/Common/ErrorBoundary';

import Landing from './pages/Landing/Landing';
import Login from './pages/Login/Login';
import MotherLogin from './pages/MotherLogin/MotherLogin';
import ResetPassword from './pages/ResetPassword';

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
import PrenatalVisits from './pages/Prenatal/PrenatalVisits';
import AddPrenatalVisit from './pages/Prenatal/AddPrenatalVisit';
import PostpartumRecords from './pages/Postpartum/PostpartumRecords';
import AddPostpartumVisit from './pages/Postpartum/AddPostpartumVisit';
import Vaccinations from './pages/Vaccinations/Vaccinations';
import DeliveryOutcomes from './pages/Deliveries/DeliveryOutcomes';
import NewbornTracking from './pages/Newborns/NewbornTracking';
import Analytics from './pages/Analytics/Analytics';
import StationReports from './pages/Station/StationReports';
import Settings from './pages/Settings/Settings';
import Inventory from './pages/Inventory/Inventory';

import './App.css';

function AnalyticsTracker() {
  const location = useLocation();

  React.useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: `${location.pathname}${location.search}${location.hash}`,
      });
    }
  }, [location]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <RolePermissionProvider>
      <LanguageProvider>
      <ModalProvider>
      <SystemSettingsProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AnalyticsTracker />
            <Routes>

          {/* PUBLIC ROUTES */}
          <Route path="/" element={<Login />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/staff-login" element={<Login />} />
          <Route path="/admin-login" element={<Login />} />
          <Route path="/mother-login" element={<MotherLogin />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          

          {/* DASHBOARD LAYOUT - ADMIN / STAFF */}
          <Route path="/dashboard" element={
            <ProtectedRoute pageKey="dashboard">
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="patients" element={
              <PermissionBoundary anyOf={['patient.view.own_station', 'patient.view.other_station']}>
                <PatientsList />
              </PermissionBoundary>
            } />
            <Route path="patients/add" element={
              <PermissionBoundary anyOf={['patient.register.own_station', 'patient.register.other_station']}>
                <AddPatient />
              </PermissionBoundary>
            } />
            <Route path="patients/:id" element={
              <PermissionBoundary anyOf={['patient.view.own_station', 'patient.view.other_station']}>
                <PatientProfile />
              </PermissionBoundary>
            } />
            <Route path="high-risk" element={<HighRiskCases />} />
            <Route path="prenatal" element={
              <PermissionBoundary anyOf={['prenatal.schedule.view.own_station', 'prenatal.schedule.view.other_station']}>
                <PrenatalVisits />
              </PermissionBoundary>
            } />
            <Route path="prenatal/add/:patientId" element={
              <PermissionBoundary anyOf={['prenatal.record.own_station', 'prenatal.record.other_station', 'prenatal.record.other_station_at_own_station']}>
                <AddPrenatalVisit />
              </PermissionBoundary>
            } />
            <Route path="postpartum" element={
              <PermissionBoundary anyOf={['postpartum.schedule.view.own_station', 'postpartum.schedule.view.other_station']}>
                <PostpartumRecords />
              </PermissionBoundary>
            } />
            <Route path="postpartum/add/:patientId" element={
              <PermissionBoundary anyOf={['postpartum.record.own_station', 'postpartum.record.other_station']}>
                <AddPostpartumVisit />
              </PermissionBoundary>
            } />
            <Route path="vaccinations" element={
              <PermissionBoundary anyOf={['vaccine.schedule.view.own_station', 'vaccine.schedule.view.other_station']}>
                <Vaccinations />
              </PermissionBoundary>
            } />
            <Route path="inventory" element={
              <PermissionBoundary anyOf={['inventory.main.view', 'inventory.station.view.own_station', 'inventory.station.view.other_station']}>
                <Inventory />
              </PermissionBoundary>
            } />
            <Route path="deliveries" element={
              <PermissionBoundary anyOf={['delivery.view.own_station', 'delivery.view.other_station']}>
                <DeliveryOutcomes />
              </PermissionBoundary>
            } />
            <Route path="newborns" element={
              <PermissionBoundary anyOf={['newborn.view.own_station', 'newborn.view.other_station']}>
                <NewbornTracking />
              </PermissionBoundary>
            } />
            <Route path="stations" element={
              <ProtectedRoute pageKey="reports">
                <StationReports />
              </ProtectedRoute>
            } />
            <Route path="analytics" element={
              <ProtectedRoute pageKey="analytics">
                <Analytics />
              </ProtectedRoute>
            } />
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
          </ErrorBoundary>
        </BrowserRouter>
      </SystemSettingsProvider>
        </ModalProvider>
      </LanguageProvider>
      </RolePermissionProvider>
    </AuthProvider>
  );
}

export default App;