import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import MotherLogin from './pages/MotherLogin/MotherLogin';
import MotherDashboard from './pages/MotherDashboard/MotherDashboard';
import UserAccount from './pages/MotherDashboard/UserAccount';
import UserSettings from './pages/MotherDashboard/UserSettings';
import MyVitals from './pages/MotherDashboard/MyVitals';
import MyAppointments from './pages/MotherDashboard/MyAppointments';
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
import ComingSoon from './pages/ComingSoon/ComingSoon';
import UserVaccinations from './pages/MotherDashboard/UserVaccinations';
import PregnancyTips from './pages/MotherDashboard/PregnancyTips';
import TipDetailPage from './pages/MotherDashboard/TipDetailPage';
import PregnancyDeliveryInfo from './pages/MotherDashboard/PregnancyDeliveryInfo';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MotherLogin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="user-home" element={<MotherDashboard />} />
          <Route path="user-account" element={<UserAccount />} />
          <Route path="user-settings" element={<UserSettings />} />
          <Route path="user-vitals" element={<MyVitals />} />
          <Route path="user-appointments" element={<MyAppointments />} />
          <Route path="user-tips" element={<PregnancyTips />} />
          <Route path="user-tips/:id" element={<TipDetailPage />} />
          <Route path="user-vaccinations" element={<UserVaccinations />} />
          <Route path="user-delivery-info" element={<PregnancyDeliveryInfo />} />
          <Route path="patients" element={<PatientsList />} />
          <Route path="patients/add" element={<AddPatient />} />
          <Route path="patients/:id" element={<PatientProfile />} />
          <Route path="high-risk" element={<HighRiskCases />} />
          <Route path="prenatal" element={<PrenatalVisits />} />
          <Route path="prenatal/add" element={<AddPrenatalVisit />} />
          <Route path="postpartum" element={<PostpartumRecords />} />
          <Route path="vaccinations" element={<Vaccinations />} />
          <Route path="deliveries" element={<DeliveryOutcomes />} />
          <Route path="newborns" element={<NewbornTracking />} />
          <Route path="barangay" element={<BarangayReports />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
