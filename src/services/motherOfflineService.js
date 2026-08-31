import PatientService from './patientservice';
import {
  getNetworkStatus,
  loadMotherOfflineData,
  persistMotherOfflineData,
} from './notificationservice';

const isMotherRole = (role = '') => ['mother', 'patient'].includes(String(role).trim().toLowerCase());

export const loadMotherPatient = async (authUser) => {
  if (!authUser?.id || !isMotherRole(authUser.role)) return null;

  const networkStatus = await getNetworkStatus();
  const patientService = new PatientService();

  if (networkStatus.connected) {
    try {
      const patient = await patientService.getPatientById(authUser.id);
      if (patient) await persistMotherOfflineData(patient, authUser);
      return patient;
    } catch (error) {
      console.error('Online mother record refresh failed; using native offline data:', error);
    }
  }

  const offlineSnapshot = await loadMotherOfflineData();
  return offlineSnapshot?.user?.id === authUser.id ? offlineSnapshot.patient || null : null;
};
