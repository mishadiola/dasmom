import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RolePermissionProvider } from './context/RolePermissionContext';
import { ModalProvider } from './context/ModalContext';
import { LanguageProvider } from './context/LanguageContext';
import { SystemSettingsProvider } from './context/SystemSettingsContext';
import ProtectedRoute from './routes/ProtectedRoute';
import ErrorBoundary from './components/Common/ErrorBoundary';
import StaffPageLoader from './components/Common/StaffPageLoader';

const DashboardLayout = React.lazy(() => import('./layouts/DashboardLayout'));
const Landing = React.lazy(() => import('./pages/Landing/Landing'));
const MotherLogin = React.lazy(() => import('./pages/MotherLogin/MotherLogin'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const MotherDashboard = React.lazy(() => import('./pages/MotherDashboard/MotherDashboard'));
const UserAccount = React.lazy(() => import('./pages/MotherDashboard/UserAccount'));
const UserSettings = React.lazy(() => import('./pages/MotherDashboard/UserSettings'));
const MyVitals = React.lazy(() => import('./pages/MotherDashboard/MyVitals'));
const MyAppointments = React.lazy(() => import('./pages/MotherDashboard/MyAppointments'));
const UserVaccinations = React.lazy(() => import('./pages/MotherDashboard/UserVaccinations'));
const PregnancyTips = React.lazy(() => import('./pages/MotherDashboard/PregnancyTips'));
const TipDetailPage = React.lazy(() => import('./pages/MotherDashboard/TipDetailPage'));
const PregnancyDeliveryInfo = React.lazy(() => import('./pages/MotherDashboard/PregnancyDeliveryInfo'));

export default function AndroidMotherApp() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RolePermissionProvider>
          <LanguageProvider>
            <ModalProvider>
              <SystemSettingsProvider>
                <BrowserRouter>
                  <React.Suspense fallback={<StaffPageLoader />}>
                    <Routes>
                      <Route path="/" element={<Navigate to="/landing" replace />} />
                      <Route path="/landing" element={<Landing />} />
                      <Route path="/mother-login" element={<MotherLogin />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
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
                      <Route path="*" element={<Navigate to="/landing" replace />} />
                    </Routes>
                  </React.Suspense>
                </BrowserRouter>
              </SystemSettingsProvider>
            </ModalProvider>
          </LanguageProvider>
        </RolePermissionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
