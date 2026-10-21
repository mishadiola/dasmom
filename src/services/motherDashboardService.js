import supabase from '../config/supabaseclient';
import {
  buildPregnancyHistory,
  getLatestPregnancyRecord,
  getPregnancyStatus
} from '../utils/pregnancyUtils';
import PatientService from './patientservice';
import { isAndroidApp } from './secureStorage';

const normalizeVisitStatus = visit => {
  if (visit.attended_date || visit.status === 'Attended') return 'Attended';
  if (visit.status === 'Cancelled' || visit.status === 'Missed') return visit.status;
  const visitDate = String(visit.visit_date || '').split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  return visitDate && visitDate < today ? 'Missed' : (visit.status || 'Scheduled');
};

const normalizeVaccinationStatus = vaccination => {
  const status = String(vaccination.status || '').trim().toLowerCase();
  if (vaccination.vaccinated_date || status === 'completed') return 'Completed';
  if (status === 'missed' || status === 'overdue') return 'Missed';
  if (status === 'cancelled') return 'Cancelled';
  const scheduledDate = String(vaccination.scheduled_vaccination || '').split('T')[0];
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (scheduledDate && scheduledDate < todayDate) return 'Missed';
  return vaccination.status || 'Pending';
};

export async function getMotherDashboardData(patientId) {
  if (isAndroidApp()) {
    return new PatientService().getPatientById(patientId);
  }

  const [
    patientResult,
    pregnancyResult,
    visitsResult,
    maternalVaccinationsResult,
    deliveriesResult,
    postpartumVisitsResult,
    newbornsResult
  ] = await Promise.all([
    supabase
      .from('patient_basic_info')
      .select('id, first_name, last_name, station_ass, stations:station_ass (station_name)')
      .eq('id', patientId)
      .maybeSingle(),
    supabase
      .from('pregnancy_info')
      .select('id, patient_id, pregn_postp, lmd, edd, created_at, miscarriage_info')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('prenatal_visits')
      .select(`
        id, patient_id, visit_date, next_appt_type, next_appt_date, status, attended_date,
        weight_kg, bp_systolic, bp_diastolic, temp_c, assigned_staff,
        staff_profiles:assigned_staff (
          id, full_name, station_ass,
          stations:station_ass (station_name)
        )
      `)
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false }),
    supabase
      .from('vaccinations')
      .select(`
        id, patient_id, scheduled_vaccination, vaccinated_date, status, assigned_staff, vaccinated_by,
        station_ass, vaccine_inventory (vaccine_name),
        staff_profiles:assigned_staff (
          id, full_name, station_ass,
          stations:station_ass (station_name)
        ),
        stations:station_ass (station_name)
      `)
      .eq('patient_id', patientId)
      .order('scheduled_vaccination', { ascending: true, nullsFirst: false }),
    supabase
      .from('deliveries')
      .select('id, mother_id, pregnancy_id, delivery_date')
      .eq('mother_id', patientId)
      .order('delivery_date', { ascending: false }),
    supabase
      .from('postpartum_visits')
      .select(`
        id, delivery_id, patient_id, visit_number, visit_type, scheduled_date, scheduled_at,
        status, attended_date, assessment, notes, clinical_notes, assigned_staff, assigned_station, station_ass,
        weight_kg, bp_systolic, bp_diastolic, pulse_bpm, temp_c, resp_rate_cpm,
        staff_profiles:assigned_staff (
          id, full_name, station_ass,
          stations:station_ass (station_name)
        ),
        assigned_station_info:stations!postpartum_visits_assigned_station_fkey (station_name),
        station_info:stations!postpartum_visits_station_ass_fkey (station_name)
      `)
      .eq('patient_id', patientId)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('newborns')
      .select(`
        id, mother_id, delivery_id, baby_name, condition_at_birth,
        vaccinations (
          id, newborn_id, vaccine_inventory_id, dose_number, scheduled_vaccination, vaccinated_date,
          status, notes, vaccinated_by, assigned_staff, station_ass,
          vaccine_inventory (vaccine_name),
          staff_profiles:assigned_staff (
            id, full_name, station_ass,
            stations:station_ass (station_name)
          ),
          stations:station_ass (station_name)
        )
      `)
      .eq('mother_id', patientId)
      .order('created_at', { ascending: false })
  ]);

  const results = [
    patientResult,
    pregnancyResult,
    visitsResult,
    maternalVaccinationsResult,
    deliveriesResult,
    postpartumVisitsResult,
    newbornsResult
  ];
  const failedResult = results.find(result => result.error);
  if (failedResult?.error) throw failedResult.error;
  if (!patientResult.data) return null;

  const patientData = patientResult.data;
  const pregnancyData = pregnancyResult.data || [];
  const staffDetails = profile => {
    const staff = Array.isArray(profile) ? profile[0] : profile;
    return staff ? {
      name: staff.full_name || null,
      station: staff.stations?.station_name || null
    } : { name: null, station: null };
  };
  const normalizedVisits = (visitsResult.data || []).map(visit => {
    const staff = staffDetails(visit.staff_profiles);
    return {
      ...visit,
      assigned_staff_name: staff.name,
      assigned_staff_station: staff.station,
      status: normalizeVisitStatus(visit)
    };
  });

  const postpartumVisitsByDelivery = new Map();
  (postpartumVisitsResult.data || []).forEach(visit => {
    const staff = staffDetails(visit.staff_profiles);
    const postpartumVisits = postpartumVisitsByDelivery.get(visit.delivery_id) || [];
    postpartumVisits.push({
      ...visit,
      assigned_staff_name: staff.name,
      assigned_staff_station: staff.station,
      assigned_station_name: visit.assigned_station_info?.station_name || null,
      station_name: visit.assigned_station_info?.station_name
        || visit.station_info?.station_name
        || null
    });
    postpartumVisitsByDelivery.set(visit.delivery_id, postpartumVisits);
  });
  const deliveries = (deliveriesResult.data || []).map(delivery => ({
    ...delivery,
    postpartum_visits: postpartumVisitsByDelivery.get(delivery.id) || []
  }));

  const newborns = (newbornsResult.data || []).map(newborn => ({
    ...newborn,
    condition: newborn.condition_at_birth || null,
    vaccines: (newborn.vaccinations || []).map(vaccine => {
      const staff = staffDetails(vaccine.staff_profiles);
      return {
        ...vaccine,
        vaccine_name: vaccine.vaccine_inventory?.vaccine_name || null,
        status: normalizeVaccinationStatus(vaccine),
        recipient_type: 'Baby',
        recipient_name: newborn.baby_name || 'Newborn',
        administration_station_name: vaccine.stations?.station_name || null,
        assigned_staff: vaccine.assigned_staff || null,
        assigned_staff_name: staff.name,
        assigned_staff_station: staff.station
      };
    })
  }));

  const maternalVaccinations = (maternalVaccinationsResult.data || []).map(vaccination => {
    const staff = staffDetails(vaccination.staff_profiles);
    return {
      ...vaccination,
      vaccine_name: vaccination.vaccine_inventory?.vaccine_name || null,
      status: normalizeVaccinationStatus(vaccination),
      recipient_type: 'Mother',
      recipient_name: `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() || 'Mother',
      administration_station_name: vaccination.stations?.station_name || null,
      assigned_staff_name: staff.name
    };
  });
  const vaccines = [
    ...maternalVaccinations,
    ...newborns.flatMap(newborn => newborn.vaccines)
  ].sort((left, right) => {
    const leftDate = left.scheduled_vaccination || left.vaccinated_date || '';
    const rightDate = right.scheduled_vaccination || right.vaccinated_date || '';
    return leftDate.localeCompare(rightDate);
  });
  const pregnancyHistory = buildPregnancyHistory(
    pregnancyData,
    normalizedVisits,
    deliveries,
    newborns
  );
  const currentPregnancy = pregnancyHistory.find(pregnancy => pregnancy.isCurrent) || null;
  const latestPregnancy = getLatestPregnancyRecord(pregnancyData) || {};

  return {
    station: patientData.stations?.station_name || 'N/A',
    pregnancyStatus: getPregnancyStatus(latestPregnancy),
    pregnancyRecord: latestPregnancy,
    currentPregnancy,
    deliveries,
    newborns,
    vaccines
  };
}
