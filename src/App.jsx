import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
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
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
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
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
