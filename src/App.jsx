import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import PrenatalVisits from './pages/Prenatal/PrenatalVisits';
import AddPrenatalVisit from './pages/Prenatal/AddPrenatalVisit';
import PostpartumRecords from './pages/Postpartum/PostpartumRecords';
import Vaccinations from './pages/Vaccinations/Vaccinations';
import DeliveryOutcomes from './pages/Deliveries/DeliveryOutcomes';
import NewbornTracking from './pages/Newborns/NewbornTracking';
import BarangayReports from './pages/Barangay/BarangayReports';
import Settings from './pages/Settings/Settings';
import PregnancyResources from './pages/Resources/PregnancyResources';

import AuthService from './services/authservice';
import './App.css';

const authService = new AuthService();


// 🔐 GLOBAL PROTECTED ROUTE (CLEAN + FLEXIBLE)
const ProtectedRoute = ({ children, pageKey }) => {
  const user = authService.getUser();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!authService.accessCheck(user, pageKey)) {
    authService.logout();
    return <Navigate to="/" replace />;
  }

  return children;
};


function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC */}
        <Route path="/" element={<Login />} />
        <Route path="/mother-login" element={<MotherLogin />} />

        {/* DASHBOARD LAYOUT */}
        <Route path="/dashboard" element={<DashboardLayout />}>

          {/* 🟣 MOTHER / PATIENT ROUTES */}
          <Route
            path="mother-home"
            element={
              <ProtectedRoute pageKey="mother">
                <MotherDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="user-vaccinations"
            element={
              <ProtectedRoute pageKey="mother">
                <UserVaccinations />
              </ProtectedRoute>
            }
          />

          <Route
            path="user-account"
            element={
              <ProtectedRoute pageKey="mother">
                <UserAccount />
              </ProtectedRoute>
            }
          />

          <Route
            path="user-settings"
            element={
              <ProtectedRoute pageKey="mother">
                <UserSettings />
              </ProtectedRoute>
            }
          />

          <Route
            path="user-vitals"
            element={
              <ProtectedRoute pageKey="mother">
                <MyVitals />
              </ProtectedRoute>
            }
          />

          <Route
            path="user-appointments"
            element={
              <ProtectedRoute pageKey="mother">
                <MyAppointments />
              </ProtectedRoute>
            }
          />

          <Route
            path="user-tips"
            element={
              <ProtectedRoute pageKey="mother">
                <PregnancyTips />
              </ProtectedRoute>
            }
          />

          <Route
            path="user-tips/:id"
            element={
              <ProtectedRoute pageKey="mother">
                <TipDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="user-delivery-info"
            element={
              <ProtectedRoute pageKey="mother">
                <PregnancyDeliveryInfo />
              </ProtectedRoute>
            }
          />

          {/* 🔵 ADMIN / STAFF ROUTES */}
          <Route
            index
            element={
              <ProtectedRoute pageKey="admin">
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="patients"
            element={
              <ProtectedRoute pageKey="admin">
                <PatientsList />
              </ProtectedRoute>
            }
          />

          <Route
            path="patients/add"
            element={
              <ProtectedRoute pageKey="admin">
                <AddPatient />
              </ProtectedRoute>
            }
          />

          <Route
            path="patients/:id"
            element={
              <ProtectedRoute pageKey="admin">
                <PatientProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="high-risk"
            element={
              <ProtectedRoute pageKey="admin">
                <HighRiskCases />
              </ProtectedRoute>
            }
          />

          <Route
            path="prenatal"
            element={
              <ProtectedRoute pageKey="admin">
                <PrenatalVisits />
              </ProtectedRoute>
            }
          />

          <Route
            path="prenatal/add"
            element={
              <ProtectedRoute pageKey="admin">
                <AddPrenatalVisit />
              </ProtectedRoute>
            }
          />

          <Route
            path="postpartum"
            element={
              <ProtectedRoute pageKey="admin">
                <PostpartumRecords />
              </ProtectedRoute>
            }
          />

          <Route
            path="vaccinations"
            element={
              <ProtectedRoute pageKey="admin">
                <Vaccinations />
              </ProtectedRoute>
            }
          />

          <Route
            path="deliveries"
            element={
              <ProtectedRoute pageKey="admin">
                <DeliveryOutcomes />
              </ProtectedRoute>
            }
          />

          <Route
            path="newborns"
            element={
              <ProtectedRoute pageKey="admin">
                <NewbornTracking />
              </ProtectedRoute>
            }
          />

          <Route
            path="barangay"
            element={
              <ProtectedRoute pageKey="admin">
                <BarangayReports />
              </ProtectedRoute>
            }
          />

          <Route
            path="analytics"
            element={
              <ProtectedRoute pageKey="admin">
                <Analytics />
              </ProtectedRoute>
            }
          />

          <Route
            path="resources"
            element={
              <ProtectedRoute pageKey="admin">
                <PregnancyResources />
              </ProtectedRoute>
            }
          />

          <Route
            path="settings"
            element={
              <ProtectedRoute pageKey="admin">
                <Settings />
              </ProtectedRoute>
            }
          />

        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;