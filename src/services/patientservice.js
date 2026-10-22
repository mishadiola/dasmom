import supabase from '../config/supabaseclient';
import AuthService from './authservice';
import InventoryService from './inventoryservice';
import { isBatchExpired } from '../utils/inventoryUtils';
import { buildPregnancyHistory, getLatestPregnancyRecord, getPregnancyStatus } from '../utils/pregnancyUtils';
import { numberPrenatalVisitsChronologically } from '../utils/prenatalVisitNumbering';
import { formatMotherId, getFirstFourDigits } from '../utils/displayIds';
import { getAppointmentMetrics, getReportDateBounds, getVaccinationMetrics, isVaccinationCompleted } from '../utils/reportMetricUtils';

const inventoryService = new InventoryService();
const TIME_SLOTS_8TO4 = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', 
  '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', 
  '15:00', '15:30', '16:00'
];
const PRENATAL_VISIT_SCHEDULE = [
  { visitNumber: 1, startWeek: 8, endWeek: 13 },
  { visitNumber: 2, startWeek: 14, endWeek: 20 },
  { visitNumber: 3, startWeek: 21, endWeek: 27 },
  { visitNumber: 4, startWeek: 28, endWeek: 30 },
  { visitNumber: 5, startWeek: 31, endWeek: 34 },
  { visitNumber: 6, startWeek: 35, endWeek: 35 },
  { visitNumber: 7, startWeek: 36, endWeek: 36 },
  { visitNumber: 8, startWeek: 37, endWeek: 40 }
];
const authService = new AuthService();
const APP_URL = 'https://dasmom.vercel.app/';

const calculateVisitStatus = (visitDate) => {
  const today = new Date();
  const visit = new Date(visitDate);
  const diffTime = visit - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return 'Upcoming';
  if (diffDays === 0) return 'Waiting';
  return 'Completed';
};

const normalizeVisitStatus = (visit) => {
  if (visit.attended_date || visit.status === 'Attended') return 'Attended';
  if (visit.status === 'Cancelled' || visit.status === 'Missed') return visit.status;

  const visitDate = String(visit.visit_date || '').split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  return visitDate && visitDate < today ? 'Missed' : (visit.status || 'Scheduled');
};

const normalizeVaccinationStatus = (vaccination) => {
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

export default class PatientService {
  constructor() {
    this.supabase = supabase;
  }

  async sendMotherEmail(action, patientId) {
    const { data, error } = await this.supabase.functions.invoke('create-mother', {
      body: { action, patientId, appUrl: APP_URL }
    });

    if (error) throw error;
    return data;
  }

  
  async getCurrentUserId() {
    const user = await authService.getAuthUser();
    return user?.id || null;
  }

  async getCurrentUserAccess() {
    const currentUser = await authService.getAuthUser();
    let role = String(currentUser?.role || '').toLowerCase().replace(/_/g, ' ').trim();
    let stationId = null;

    if (!role && currentUser?.id) {
      const { data: userRow } = await this.supabase
        .from('users')
        .select('usertype')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (userRow?.usertype) {
        const { data: userTypeRow } = await this.supabase
          .from('user_type')
          .select('user_type')
          .eq('id', userRow.usertype)
          .maybeSingle();
        role = String(userTypeRow?.user_type || '').toLowerCase().replace(/_/g, ' ').trim();
      }
    }

    if (role === 'station staff') role = 'staff';

    if (currentUser?.id) {
      const { data } = await this.supabase
        .from('staff_profiles')
        .select('station_ass')
        .eq('id', currentUser?.id)
        .maybeSingle();

      stationId = data?.station_ass || null;
    }

    return { role, stationId, currentUser };
  }

  async getArchivedPatientIds() {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, is_archived')
      .eq('is_archived', true);

    if (error) throw error;

    return new Set(
      (data || [])
        .map((user) => user.id)
        .filter(Boolean)
    );
  }

  getArchiveStateFromPatient(patient) {
    return patient?.is_archived === true ? 'archived' : 'active';
  }

  async archivePatient(patientId) {
    const { error } = await this.supabase.rpc('set_patient_account_status', {
      p_patient_id: patientId,
      p_is_archived: true,
      p_is_deactivated: null
    });

    if (error) throw error;
    return true;
  }

  async restorePatient(patientId) {
    const { error } = await this.supabase.rpc('set_patient_account_status', {
      p_patient_id: patientId,
      p_is_archived: false,
      p_is_deactivated: null
    });

    if (error) throw error;
    return true;
  }

  getEarliestTodayOrFutureVisitDate(schedulePreview) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!Array.isArray(schedulePreview) || schedulePreview.length === 0) {
      return today.toISOString().split('T')[0];
    }

    const nextVisit = schedulePreview.find((visit) => {
      const visitDate = new Date(visit.date);
      return !Number.isNaN(visitDate.getTime()) && visitDate >= today;
    });

    return nextVisit ? nextVisit.date : today.toISOString().split('T')[0];
  }

  filterScheduleAfterToday(schedulePreview) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!Array.isArray(schedulePreview) || schedulePreview.length === 0) {
      return [];
    }

    return schedulePreview
      .filter((visit) => {
        if (!visit || !visit.date) return false;
        const visitDate = new Date(visit.date);
        return !Number.isNaN(visitDate.getTime()) && visitDate >= today;
      })
      .sort((left, right) => String(left.date).localeCompare(String(right.date)))
      .map((visit, index) => ({
        ...visit,
        visitNumber: index + 1
      }));
  }

  async getSuggestedReturningMothers() {
    try {
      const allPatients = await this.getAllPatients({ includeArchived: true });
      
      const { data: deliveries, error: err } = await this.supabase
        .from('deliveries')
        .select('mother_id, delivery_date')
        .order('delivery_date', { ascending: false });
        
      if (err) throw err;
      
      const latestDeliveryMap = new Map();
      const deliveryCountMap = new Map();
      
      (deliveries || []).forEach(d => {
        if (!d.mother_id) return;
        const count = deliveryCountMap.get(d.mother_id) || 0;
        deliveryCountMap.set(d.mother_id, count + 1);
        
        const existing = latestDeliveryMap.get(d.mother_id);
        if (!existing || new Date(d.delivery_date) > new Date(existing)) {
          latestDeliveryMap.set(d.mother_id, d.delivery_date);
        }
      });
      
      return allPatients
        .filter(p => {
          if (p.archiveStatus === 'active' || p.archiveStatus === 'missed_delivery') return false;
          if (!latestDeliveryMap.has(p.id)) return false;
          return true;
        })
        .map(p => ({
          id: p.id,
          name: p.name,
          age: p.age,
          dob: p.dob, // Wait, getAllPatients might not return dob directly. I need to make sure dob is returned.
          station: p.station,
          lastDelivery: latestDeliveryMap.get(p.id),
          previousPregnancies: deliveryCountMap.get(p.id) || 0
        }));
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async getAllPatients({ includeArchived = false } = {}) {
    try {
      const [
        archivedPatientIds,
        patientsResult,
        pregnanciesResult,
        visitsResult,
        deliveriesResult
      ] = await Promise.all([
        includeArchived ? Promise.resolve(new Set()) : this.getArchivedPatientIds(),
        this.supabase
          .from('patient_basic_info')
          .select('id, first_name, last_name, station_ass, municipality, date_of_birth, created_at, emergency_contact, stations:station_ass (station_name)')
          .order('created_at', { ascending: false }),
        this.supabase
          .from('pregnancy_info')
          .select('patient_id, lmd, edd, pregn_postp, pregnancy_type, gravida, para, miscarriage_info, created_at'),
        this.supabase
          .from('prenatal_visits')
          .select('patient_id, assigned_staff, visit_date, next_appt_date, status, risk_factors, calculated_risk, bp_systolic, bp_diastolic, weight_kg, height_cm, temp_c, pulse_bpm, resp_rate_cpm, fhr_bpm')
          .order('visit_date', { ascending: false }),
        this.supabase
          .from('deliveries')
          .select('mother_id, delivery_date')
          .order('delivery_date', { ascending: false })
      ]);

      const { data: patients, error: err1 } = patientsResult;
      if (err1) throw err1;

      const { data: pregnancies, error: err2 } = pregnanciesResult;
      if (err2) throw err2;

      const latestPregMap = new Map();
      const pregnanciesByPatient = new Map();
      (pregnancies || []).forEach(pgi => {
        if (!pgi.patient_id) return;
        const patientPregnancies = pregnanciesByPatient.get(pgi.patient_id) || [];
        patientPregnancies.push(pgi);
        pregnanciesByPatient.set(pgi.patient_id, patientPregnancies);
        latestPregMap.set(pgi.patient_id, getLatestPregnancyRecord(patientPregnancies));
      });

      // 3. Get prenatal visits and compute attended visit totals plus the next appointment reference.
      const { data: visits, error: err3 } = visitsResult;
      if (err3) throw err3;

      const nextApptMap = new Map();
      const attendedCountMap = new Map();
      const latestAttendedVisitMap = new Map();
      const heightByPatientMap = new Map();
      const assignedStaffMap = new Map();
      const visitsByPatientMap = new Map();
      (visits || []).forEach(v => {
        if (!v.patient_id) return;
        if (!visitsByPatientMap.has(v.patient_id)) {
          visitsByPatientMap.set(v.patient_id, []);
        }
        visitsByPatientMap.get(v.patient_id).push(v);
        if (Number(v.height_cm) > 0 && !heightByPatientMap.has(v.patient_id)) {
          heightByPatientMap.set(v.patient_id, v.height_cm);
        }
        if (v.status === 'Scheduled' && v.assigned_staff && !assignedStaffMap.has(v.patient_id)) {
          assignedStaffMap.set(v.patient_id, v.assigned_staff);
        }
        if (v.status === 'Attended') {
          const count = attendedCountMap.get(v.patient_id) || 0;
          attendedCountMap.set(v.patient_id, count + 1);
          if (v.next_appt_date && !nextApptMap.has(v.patient_id)) {
            nextApptMap.set(v.patient_id, v.next_appt_date);
          }

          const existing = latestAttendedVisitMap.get(v.patient_id);
          if (!existing || new Date(v.visit_date) > new Date(existing.visit_date)) {
            latestAttendedVisitMap.set(v.patient_id, v);
          }
        }
      });

      const { data: deliveries, error: err4 } = deliveriesResult;
      if (err4) throw err4;

  
      const deliveredPatients = new Map();
      (deliveries || []).forEach(d => {
        if (d.mother_id && d.delivery_date) {
          const existing = deliveredPatients.get(d.mother_id);
          if (!existing || new Date(d.delivery_date) > new Date(existing)) {
            deliveredPatients.set(d.mother_id, d.delivery_date);
          }
        }
      });

      const pgiMap = latestPregMap;

      const mapPatient = (p) => {
        const patientType = 'Mother';
        const pgi = pgiMap.get(p.id);
        const lmp = pgi?.lmd;
        const weeks = lmp ? this.calculateWeeks(lmp) : 0;
        const trimester = lmp ? this.getTrimesterFromWeek(weeks) : 0;

        const latestVisit = latestAttendedVisitMap.get(p.id);
        const riskAssessment = this.getPregnancyRisk(
          { ...p, height_cm: p.height_cm || heightByPatientMap.get(p.id) },
          pgi || {},
          latestVisit
        );

        // Documented health conditions determination across current pregnancy visits
        const patientVisits = visitsByPatientMap.get(p.id) || [];
        const deliveryDateStr = deliveredPatients.get(p.id);
        const deliveryTime = deliveryDateStr ? new Date(deliveryDateStr).getTime() : 0;
        const currentPregnancyVisits = deliveryTime > 0
          ? patientVisits.filter(v => v.visit_date && new Date(v.visit_date).getTime() > deliveryTime)
          : patientVisits;
        const visitsToInspect = currentPregnancyVisits.length > 0 ? currentPregnancyVisits : patientVisits;

        const conditionSet = new Set();
        const categorizedMap = new Map();

        const processVisitRiskFactors = (rf) => {
          if (!rf) return;
          const conds = this.getDocumentedHealthConditions(rf);
          conds.forEach(c => conditionSet.add(c));

          const categorizedList = this.getCategorizedHealthConditions(rf);
          categorizedList.forEach(item => {
            const key = `${item.category}:::${item.name.toLowerCase()}`;
            if (!categorizedMap.has(key)) {
              categorizedMap.set(key, item);
            }
          });
        };

        visitsToInspect.forEach(v => {
          processVisitRiskFactors(v.risk_factors);
        });

        if (latestVisit?.risk_factors) {
          processVisitRiskFactors(latestVisit.risk_factors);
        }

        const documentedConditions = Array.from(conditionSet);

        // Group categorized conditions by category
        const conditionsByCategory = {
          'Pre-existing Medical Conditions': [],
          'Pregnancy-Related Conditions': [],
          'Relevant Obstetric History': []
        };

        Array.from(categorizedMap.values()).forEach(item => {
          const cat = this.normalizeCategoryName(item.category);
          if (!conditionsByCategory[cat]) {
            conditionsByCategory[cat] = [];
          }
          if (!conditionsByCategory[cat].includes(item.name)) {
            conditionsByCategory[cat].push(item.name);
          }
        });

        const activeCategories = Object.entries(conditionsByCategory)
          .filter(([_, list]) => list.length > 0)
          .map(([category, conditions]) => ({ category, conditions }));

        const hasHealthConditions = activeCategories.length > 0 || documentedConditions.length > 0;
        const conditionDisplay = documentedConditions.join(', ') || (activeCategories.length > 0 ? 'Documented Conditions' : 'None Reported');
        const riskLevelDisplay = hasHealthConditions ? 'With Health Conditions' : 'None Reported';

        const rawNextAppt = nextApptMap.get(p.id) || null;
        let nextAppt = null;
        if (rawNextAppt) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const d = new Date(rawNextAppt);
          if (!Number.isNaN(d.getTime()) && d >= today) {
            nextAppt = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }
        }

        const pregnancyStatus = getPregnancyStatus(pgi).toLowerCase();
        const edd = pgi?.edd ? new Date(pgi.edd) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const isEddPassed = edd && !Number.isNaN(edd.getTime()) && edd < today;
        const daysOverdue = isEddPassed ? Math.ceil((today - edd) / (1000 * 60 * 60 * 24)) : 0;
        const isMissedDelivery = isEddPassed && daysOverdue > 7 && pregnancyStatus === 'pregnant';
        
        // Postpartum follow-up is the 42 days after the latest delivery.
        const deliveryDate = deliveredPatients.get(p.id) ? new Date(deliveredPatients.get(p.id)) : null;
        const postpartumDays = deliveryDate && !Number.isNaN(deliveryDate.getTime())
          ? Math.floor((today - deliveryDate) / (1000 * 60 * 60 * 24))
          : null;
        const hasDelivered = postpartumDays !== null && postpartumDays >= 0;
        const isPostpartum = hasDelivered && postpartumDays <= 42;
        
        const archiveState = archivedPatientIds.has(p.id) ? 'archived' : this.getArchiveStateFromPatient(p);

        // Determine archive status
        let archiveStatus = 'active';
        if (archiveState === 'archived') {
          archiveStatus = 'archived';
        } else if (isPostpartum) {
          archiveStatus = 'postpartum';
        } else if (hasDelivered) {
          archiveStatus = 'archived';
        } else if (isMissedDelivery) {
          archiveStatus = 'missed_delivery';
        } else if (pregnancyStatus !== 'pregnant') {
          archiveStatus = 'archived';
        }

        let rawEC = p.emergency_contact || {};
        if (typeof rawEC === 'string') {
          try {
            rawEC = JSON.parse(rawEC);
          } catch {
            rawEC = {};
          }
        }
        const emergencyContact = {
          name: rawEC.name || rawEC.full_name || rawEC.contact_name || '',
          relationship: rawEC.relationship || rawEC.relation || '',
          phone: rawEC.phone || rawEC.contact_no || rawEC.contact_number || rawEC.phone_number || '',
          address: rawEC.address || ''
        };

        return {
          id: p.id,
          stationId: p.station_ass,
          emergencyContact,
          emergency_contact: rawEC,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Patient',
          station: p.stations?.station_name || p.municipality || 'N/A',
          assignedStaffId: assignedStaffMap.get(p.id) || null,
          age: p.date_of_birth
            ? Math.floor((new Date() - new Date(p.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
            : null,
          trimester,
          weeks,
          risk: riskLevelDisplay,
          riskLevel: riskLevelDisplay,
          hasHealthConditions,
          documentedConditions,
          medicalConditions: documentedConditions,
          categorizedConditions: Array.from(categorizedMap.values()),
          conditionsByCategory,
          activeCategories,
          condition: conditionDisplay,
          conditionsList: documentedConditions,
          edd: pgi?.edd || null,
          lmp: pgi?.lmd || null,
          createdAt: p.created_at,
          nextAppt,
          totalVisits: attendedCountMap.get(p.id) || 0,
          riskFactors: documentedConditions,
          gravida: riskAssessment.gravida,
          pregnancyType: riskAssessment.pregnancyType,
          patientType,
          type: patientType,
          archiveStatus,
          pregnancyStatus,
          pregnancyOutcome: pgi?.miscarriage_info?.outcome || (pregnancyStatus === 'postpartum' ? 'Live Birth' : null),
          postpartumDays: isPostpartum ? postpartumDays : null,
          daysOverdue: isMissedDelivery ? daysOverdue : 0
        };
      };

      // Return all patients including postpartum and missed delivery,
      // but hide archived patients by default unless explicitly requested.
      return patients
        .filter((patient) => includeArchived || !archivedPatientIds.has(patient.id))
        .map(mapPatient)
        .filter(p => p && p.id && p.name !== 'Unknown Patient');
    } catch (error) {
      console.error('❌ getAllPatients:', error);
      return [];
    }
  }

  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age > 0 ? age.toString() : 'N/A';
  }

  /**
   * Determine BMI category (underweight, normal, overweight, obese)
   * BMI = weight(kg) / (height(m))^2
   */
  calculateBMICategory(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  }

  /**
   * Check if BMI category is high-risk
   */
  isBMIHighRisk(bmiCategory) {
    return bmiCategory === 'Underweight' || bmiCategory === 'Overweight' || bmiCategory === 'Obese';
  }

  /**
   * Parse blood pressure string and return systolic/diastolic
   */
  parseBP(bpString) {
    if (!bpString) return null;
    const match = bpString.match(/^(\d+)[/\s](\d+)$/);
    if (!match) return null;
    return {
      systolic: parseInt(match[1]),
      diastolic: parseInt(match[2])
    };
  }

  /**
   * Check if blood pressure indicates high-risk (hypertension or hypotension)
   * High-risk ranges for pregnancy:
   * - Hypertension: >= 140/90 mmHg
   * - Hypotension: < 90/60 mmHg
   */
  isBPHighRisk(systolic, diastolic) {
    if (!systolic || !diastolic) return false;
    const sys = parseInt(systolic);
    const dias = parseInt(diastolic);
    // Hypertension or Hypotension
    return (sys >= 140 || dias >= 90) || (sys < 90 || dias < 60);
  }

  /**
   * Get BP status description
   */
  getBPStatus(systolic, diastolic) {
    if (!systolic || !diastolic) return 'Unknown';
    const sys = parseInt(systolic);
    const dias = parseInt(diastolic);
    
    if (sys >= 140 || dias >= 90) {
      return 'Hypertension (High)';
    } else if (sys < 90 || dias < 60) {
      return 'Hypotension (Low)';
    }
    return 'Normal';
  }

  getPregnancyRisk(patient = {}, pregnancy = {}, visit = null) {
    const factors = [];
    const addFactor = (label) => {
      if (label && !factors.includes(label)) factors.push(label);
    };
    const age = patient.date_of_birth ? Number(this.calculateAge(patient.date_of_birth)) : null;
    const gravida = Number.parseInt(pregnancy.gravida, 10);
    const pregnancyType = String(pregnancy.pregnancy_type || '').toLowerCase();
    
    // Process existing saved risk factors text to ensure conditions from registration are preserved
    const riskText = String(visit?.risk_factors || '');
    const riskTextLower = riskText.toLowerCase();

    if (age !== null && (age < 18 || age > 35)) addFactor(`Age ${age}`);
    if (Number.isFinite(gravida) && gravida >= 3) addFactor(`Gravida ${gravida}`);
    const nonMultipleTypes = ['singleton', 'not yet determined', 'unknown', 'n/a', 'none', ''];
    if (pregnancyType && !nonMultipleTypes.includes(pregnancyType)) {
      addFactor('Multiple pregnancy');
    }

    const transientRiskPattern = /^(age\b|gravida\b|multiple pregnancy$|hypertension \(high\)$|hypotension \(low\)$|high bp$|overweight bmi$|underweight bmi$|obese bmi$|fever$|hypothermia$|abnormal (pulse|respiratory rate|fetal heart rate)$)/i;

    // Also add any other text that might be comma-separated in riskText but not None
    if (riskText) {
      riskText.split(',').map(s => s.trim()).forEach(f => {
        if (f && f.toLowerCase() !== 'none' && !transientRiskPattern.test(f) && !factors.some(existing => existing.toLowerCase() === f.toLowerCase())) {
          addFactor(f);
        }
      });
    }

    // Process known pre-existing conditions from text explicitly in case they were missed
    if (riskTextLower.includes('hypertension')) addFactor('Hypertension');
    if (riskTextLower.includes('diabetes')) addFactor('Diabetes');
    if (riskTextLower.includes('heart disease')) addFactor('Heart Disease');
    if (riskTextLower.includes('asthma')) addFactor('Asthma');
    if (riskTextLower.includes('anemia') || riskTextLower.includes('anaemia')) addFactor('Anemia');
    if (riskTextLower.includes('previous c-section') || riskTextLower.includes('c-section')) addFactor('Previous C-section');

    (patient.medicalConditions || []).forEach(condition => {
      const value = String(condition || '').trim();
      if (value && !transientRiskPattern.test(value)) addFactor(value);
    });

    if (this.isBPHighRisk(visit?.bp_systolic, visit?.bp_diastolic)) {
      addFactor(this.getBPStatus(visit?.bp_systolic, visit?.bp_diastolic));
    }

    const weight = Number(visit?.weight_kg);
    const height = Number(visit?.height_cm || patient.height_cm);
    if (weight > 0 && height > 0) {
      const bmiCategory = this.calculateBMICategory(weight, height);
      if (this.isBMIHighRisk(bmiCategory)) addFactor(`${bmiCategory} BMI`);
    }

    const hasValue = (val) => val !== null && val !== undefined && String(val).trim() !== '';

    if (hasValue(visit?.temp_c)) {
      const temperature = Number(visit.temp_c);
      if (Number.isFinite(temperature) && (temperature < 35.1 || temperature > 37.5)) {
        addFactor(temperature < 35.1 ? 'Hypothermia' : 'Fever');
      }
    }

    if (hasValue(visit?.pulse_bpm)) {
      const pulse = Number(visit.pulse_bpm);
      if (Number.isFinite(pulse) && (pulse < 60 || pulse > 100)) addFactor('Abnormal pulse');
    }

    if (hasValue(visit?.resp_rate_cpm)) {
      const respiratoryRate = Number(visit.resp_rate_cpm);
      if (Number.isFinite(respiratoryRate) && (respiratoryRate < 12 || respiratoryRate > 20)) {
        addFactor('Abnormal respiratory rate');
      }
    }

    if (hasValue(visit?.fhr_bpm)) {
      const fetalHeartRate = Number(visit.fhr_bpm);
      if (Number.isFinite(fetalHeartRate) && (fetalHeartRate < 110 || fetalHeartRate > 160)) {
        addFactor('Abnormal fetal heart rate');
      }
    }

    // Classify risk level based on gathered factors
    const highRiskConditions = ['Hypertension', 'Diabetes', 'Heart Disease', 'Previous C-section', 'Hypothermia', 'Fever', 'Abnormal pulse', 'Abnormal respiratory rate', 'Abnormal fetal heart rate', 'Multiple pregnancy'];
    
    let isHigh = false;
    let isMedium = false;
    
    for (const factor of factors) {
      const lower = factor.toLowerCase();
      if (
        highRiskConditions.some(h => lower.includes(h.toLowerCase())) || 
        lower.includes('age') || 
        lower.includes('gravida') ||
        lower.includes('high')
      ) {
        isHigh = true;
      } else if (lower.includes('asthma') || lower.includes('anemia') || lower.includes('medium')) {
        isMedium = true;
      } else {
        // Any other unrecognized factor defaults to High Risk
        isHigh = true; 
      }
    }

    if (factors.length >= 2) isHigh = true;
    
    let riskLevel = 'Low Risk';
    if (isHigh) riskLevel = 'High Risk';
    else if (isMedium) riskLevel = 'Medium Risk';

    return {
      isHighRisk: isHigh,
      riskLevel,
      riskFactors: factors,
      age: Number.isFinite(age) ? age : null,
      gravida: Number.isFinite(gravida) ? gravida : null,
      pregnancyType: pregnancy.pregnancy_type || 'Singleton',
    };
  }

  async getAllMidwives() {
    // Get all staff members (not specifically filtering by role)
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .select(`
        id,
        full_name,
        station_ass,
        stations:station_ass (station_name),
        users!inner(usertype),
        user_type!inner(user_type)
      `)
      .order('full_name');

    return error ? [] : (data || []);
  }

  async searchPatients(query) {
    const term = (query || '').trim();
    if (!term || term.length < 2) return [];

    const archivedPatientIds = await this.getArchivedPatientIds();
    const safeTerm = term.trim().replace(/%/g, '\\%');

    const applyStationFilter = baseQuery => baseQuery;

    // Search by first_name
    const firstNameQuery = applyStationFilter(this.supabase
      .from('patient_basic_info')
      .select('id, first_name, last_name, station_ass, province, blood_type, stations:station_ass (station_name)')
      .ilike('first_name', `%${safeTerm}%`)
      .order('created_at', { ascending: false })
      .limit(10));
    const { data: byFirstName, error: firstNameError } = await firstNameQuery;

    if (firstNameError) throw firstNameError;

    // Search by last_name
    const lastNameQuery = applyStationFilter(this.supabase
      .from('patient_basic_info')
      .select('id, first_name, last_name, station_ass, province, blood_type, stations:station_ass (station_name)')
      .ilike('last_name', `%${safeTerm}%`)
      .order('created_at', { ascending: false })
      .limit(10));
    const { data: byLastName, error: lastNameError } = await lastNameQuery;

    if (lastNameError) throw lastNameError;

    // Search by station label stored via stations relationship
    const stationQuery = applyStationFilter(this.supabase
      .from('patient_basic_info')
      .select('id, first_name, last_name, station_ass, province, blood_type, stations:station_ass (station_name)')
      .ilike('stations.station_name', `%${safeTerm}%`)
      .order('created_at', { ascending: false })
      .limit(10));
    const { data: byStation, error: stationError } = await stationQuery;

    if (stationError) throw stationError;

    let byId = [];
    const isIdSearch = /^mom/i.test(term) || /^\d+$/.test(term.replace(/\s+/g, ''));
    const digitsOnly = term.replace(/[^0-9]/g, '');

    if (isIdSearch) {
      const { data: recentPatients, error: idError } = await applyStationFilter(this.supabase
        .from('patient_basic_info')
        .select('id, first_name, last_name, station_ass, province, blood_type, stations:station_ass (station_name)')
        .order('created_at', { ascending: false })
        .limit(150));
      if (!idError && recentPatients) {
        const normQuery = term.toLowerCase().replace(/[\s-]+/g, '');
        for (const p of recentPatients) {
          const readableId = formatMotherId(p.id).toLowerCase().replace(/[\s-]+/g, '');
          const pDigits = getFirstFourDigits(p.id);
          if (
            readableId.includes(normQuery) ||
            (digitsOnly && digitsOnly.length >= 2 && pDigits.includes(digitsOnly)) ||
            p.id.toLowerCase().includes(term.toLowerCase())
          ) {
            byId.push(p);
          }
        }
      }
    }

    // Combine and deduplicate results
    const allPatients = [...(byFirstName || []), ...(byLastName || []), ...(byStation || []), ...byId];
    const uniquePatients = [];
    const seenIds = new Set();

    for (const patient of allPatients) {
      if (!seenIds.has(patient.id) && !archivedPatientIds.has(patient.id)) {
        seenIds.add(patient.id);
        uniquePatients.push(patient);
      }
    }

    const stationFallbackIds = [...new Set(
      uniquePatients
        .filter(patient => !patient.stations?.station_name && patient.station_ass)
        .map(patient => patient.station_ass)
    )];

    const stationNamesById = {};
    if (stationFallbackIds.length > 0) {
      const { data: stationRows, error: stationError } = await this.supabase
        .from('stations')
        .select('id, station_name')
        .in('id', stationFallbackIds);

      if (!stationError && stationRows) {
        stationRows.forEach(row => {
          if (row?.id && row?.station_name) {
            stationNamesById[row.id] = row.station_name;
          }
        });
      }
    }

    return uniquePatients.map(patient => {
      const stationName = patient.stations?.station_name || stationNamesById[patient.station_ass];
      return {
        id: patient.id,
        name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        blood_type: patient.blood_type || patient.bloodtype || null,
        station: stationName ? `${stationName}, ${patient.province || 'N/A'}` : (patient.province || 'N/A')
      };
    });
  }

  generateVisitSchedule(lmp, { visitCount = PRENATAL_VISIT_SCHEDULE.length, time = '09:00' } = {}) {
    if (!lmp) return [];
    const lmpDate = new Date(lmp);
    if (Number.isNaN(lmpDate.getTime())) return [];

    return PRENATAL_VISIT_SCHEDULE.slice(0, visitCount).map(visit => ({
      date: this.addWeeksToDate(lmpDate, visit.startWeek),
      week: visit.startWeek,
      visitNumber: visit.visitNumber,
      trimester: this.getTrimesterFromWeek(visit.startWeek),
      scheduled_time: `${time}:00`,
      type: 'Routine Prenatal'
    }));
  }

  generateSemesterSchedule(lmp) {
    if (!lmp) return [];
    const lmpDate = new Date(lmp);
    if (Number.isNaN(lmpDate.getTime())) return [];

    return PRENATAL_VISIT_SCHEDULE.map(visit => ({
        date: this.addWeeksToDate(lmpDate, visit.startWeek),
        week: visit.startWeek,
        visitNumber: visit.visitNumber,
        trimester: this.getTrimesterFromWeek(visit.startWeek),
        type: 'Routine Prenatal'
      }));
  }

  getTimeSlotFromIndex(index) {
    // 8am-4pm with 30-minute intervals = 16 slots
    const slots = [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00'
    ];
    return slots[index % slots.length];
  }

  dateTimeToTimestamp(dateStr, timeStr) {
    // dateStr: '2026-05-15', timeStr: '09:00'
    // Use UTC to avoid timezone conversion issues
    const [year, month, day] = dateStr.split('-');
    const [hours, minutes] = timeStr.split(':');
    const dt = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes)));
    return dt.toISOString();
  }

  async checkScheduleOverlap(visitDate, patientId = null, maxPerDay = 35) {
    if (!visitDate) return false;

    let query = this.supabase
      .from('prenatal_visits')
      .select('id', { count: 'exact', head: true })
      .eq('visit_date', visitDate);

    if (patientId) {
      query = query.neq('patient_id', patientId);
    }

    const { count, error } = await query;
    if (error) throw error;

    return (count || 0) >= maxPerDay;
  }

  async shiftPrenatalVisitsForInsertion(patientId, visits, insertionVisitNumber) {
    const visitsToShift = (visits || [])
      .filter(visit => visit.status === 'Scheduled' && Number(visit.visit_number) >= insertionVisitNumber)
      .sort((left, right) => Number(right.visit_number) - Number(left.visit_number));

    for (const visit of visitsToShift) {
      const { error } = await this.supabase
        .from('prenatal_visits')
        .update({ visit_number: Number(visit.visit_number) + 1 })
        .eq('id', visit.id)
        .eq('patient_id', patientId);

      if (error) throw error;
    }
  }

  async resequencePrenatalVisitNumbers(patientId) {
    const { data: visits, error } = await this.supabase
      .from('prenatal_visits')
      .select('id, visit_date, visit_number, created_at')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    if (!visits?.length) return;

    const numberedVisits = numberPrenatalVisitsChronologically(visits);
    const currentNumbers = new Map(visits.map(visit => [visit.id, Number(visit.visit_number)]));
    const changedVisits = numberedVisits.filter(visit =>
      currentNumbers.get(visit.id) !== visit.visit_number
    );
    if (!changedVisits.length) return;

    const temporaryBase = Math.max(...visits.map(visit => Number(visit.visit_number) || 0)) + visits.length + 1;
    for (const [index, visit] of changedVisits.entries()) {
      const { error: updateError } = await this.supabase
        .from('prenatal_visits')
        .update({ visit_number: temporaryBase + index + 1 })
        .eq('id', visit.id)
        .eq('patient_id', patientId);
      if (updateError) throw updateError;
    }
    for (const visit of changedVisits) {
      const { error: updateError } = await this.supabase
        .from('prenatal_visits')
        .update({ visit_number: visit.visit_number })
        .eq('id', visit.id)
        .eq('patient_id', patientId);
      if (updateError) throw updateError;
    }
  }

  async insertPrenatalSchedule(patientId, schedulePreview, createdBy, patientData = {}, maxPerDay = 35) {
    const validSchedule = Array.isArray(schedulePreview)
      ? schedulePreview
          .filter(v => v && v.date && !Number.isNaN(new Date(v.date).getTime()))
          .map(v => ({ ...v, date: new Date(v.date).toISOString().split('T')[0] }))
          .sort((left, right) => left.date.localeCompare(right.date))
      : [];

    if (validSchedule.length === 0) return;
    const requestedDates = new Set();
    for (const visit of validSchedule) {
      if (requestedDates.has(visit.date)) {
        throw new Error(`Only one prenatal visit can be scheduled on ${visit.date}.`);
      }
      requestedDates.add(visit.date);
    }

    const { data: existingVisits, error: existingVisitsError } = await this.supabase
      .from('prenatal_visits')
      .select('visit_date')
      .eq('patient_id', patientId)
      .eq('status', 'Scheduled')
      .in('visit_date', [...requestedDates]);
    if (existingVisitsError) throw existingVisitsError;
    const existingDates = new Set((existingVisits || []).map(visit => String(visit.visit_date).slice(0, 10)));
    const newSchedule = validSchedule.filter(visit => !existingDates.has(visit.date));
    if (newSchedule.length === 0) return;

    const { data: patientRecord, error: patientError } = await this.supabase
      .from('patient_basic_info')
      .select('station_ass')
      .eq('id', patientId)
      .single();
    if (patientError) throw patientError;

    // Check for daily capacity before inserting (auto-schedule uses 30 slots/day)
    for (const visit of newSchedule) {
      const isFull = await this.checkScheduleOverlap(visit.date, patientId, maxPerDay);
      if (isFull) {
        throw new Error(`Schedule conflict: ${visit.date} is already full (${maxPerDay} prenatal auto-schedule slots reached). Please choose a different date.`);
      }
    }

    const rows = newSchedule.map((visit, index) => {
      // Calculate next_appt_date: the following visit in the schedule
      const nextVisit = newSchedule[index + 1];
      const nextApptDate = nextVisit ? nextVisit.date : null;

      return {
        patient_id: patientId,
        created_by: createdBy,
        visit_date: visit.date,
        visit_number: index + 1,
        trimester: visit.trimester,
        gestational_age: `${visit.week}w`,
        next_appt_type: visit.type || 'Routine Prenatal',
        next_appt_date: nextApptDate,  // Points to next visit in schedule or null for last visit
        status: 'Scheduled',
        assigned_staff: patientData.retained_staff || null,
        assigned_station: patientRecord.station_ass,
        station_ass: null,
        created_at: new Date().toISOString()
      };
    });

    const { error } = await this.supabase.from('prenatal_visits').insert(rows);
    if (error) {
      console.error('Error inserting prenatal schedule:', error);
      throw error;
    }
    await this.resequencePrenatalVisitNumbers(patientId);
    console.log('✅ Inserted prenatal schedule:', rows);
  }

  async resequencePostpartumVisitNumbers(deliveryId) {
    const { data: visits, error } = await this.supabase
      .from('postpartum_visits')
      .select('id, scheduled_date, visit_number, created_at, status')
      .eq('delivery_id', deliveryId)
      .order('scheduled_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!visits?.length) return;

    let nextNumber = Math.max(1, Math.min(...visits.map(visit => Number(visit.visit_number) || 1)));
    const scheduledTargets = [];
    for (const visit of visits) {
      if (visit.status === 'Scheduled') {
        const targetNumber = nextNumber++;
        if (Number(visit.visit_number) !== targetNumber) {
          scheduledTargets.push({ ...visit, targetNumber });
        }
      } else {
        nextNumber = Math.max(nextNumber, Number(visit.visit_number) || 0) + 1;
      }
    }
    if (!scheduledTargets.length) return;

    const temporaryBase = Math.max(...visits.map(visit => Number(visit.visit_number) || 0)) + 10000;
    for (const [index, visit] of scheduledTargets.entries()) {
      const { error: updateError } = await this.supabase
        .from('postpartum_visits')
        .update({ visit_number: temporaryBase + index + 1 })
        .eq('id', visit.id)
        .eq('delivery_id', deliveryId);
      if (updateError) throw updateError;
    }
    for (const visit of scheduledTargets) {
      const { error: updateError } = await this.supabase
        .from('postpartum_visits')
        .update({ visit_number: visit.targetNumber })
        .eq('id', visit.id)
        .eq('delivery_id', deliveryId);
      if (updateError) throw updateError;
    }
  }

  async sendScheduledVisitNotification(visitType, visitId) {
    const { data, error } = await this.supabase.functions.invoke('visit-scheduled-email', {
      body: { visit_type: visitType, visit_id: visitId }
    });
    if (error) throw error;
    if (!data?.emailSent) {
      throw new Error(data?.error || 'The visit was saved, but its email notification was not sent.');
    }
    return data;
  }

  async rebalancePrenatalSchedule(patientId, lmp, attendedDate, maxPerDay = 35, pregnancyVisitIds = null, currentVisitId = null, previewOnly = false) {
    try {
      const lmpDate = new Date(lmp);
      if (Number.isNaN(lmpDate.getTime())) {
        throw new Error('Invalid LMP date for schedule rebalance');
      }

      const attendedDateOnly = attendedDate
        ? new Date(attendedDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      let futureVisitsQuery = this.supabase
        .from('prenatal_visits')
        .select('id, visit_number, visit_date')
        .eq('patient_id', patientId)
        .eq('status', 'Scheduled')
        .gt('visit_date', attendedDateOnly)
        .order('visit_date', { ascending: true });
      if (Array.isArray(pregnancyVisitIds)) {
        futureVisitsQuery = pregnancyVisitIds.length > 0
          ? futureVisitsQuery.in('id', pregnancyVisitIds)
          : null;
      }
      let futureVisits = [];
      if (futureVisitsQuery) {
        const { data, error: scheduledError } = await futureVisitsQuery;
        if (scheduledError) throw scheduledError;
        futureVisits = data || [];
      }

      const currentWeek = this.calculateWeeksAtDate(lmpDate, attendedDateOnly);
      const completedVisitNumber = this.getPrenatalVisitNumberForWeek(currentWeek);
      const remainingSchedule = PRENATAL_VISIT_SCHEDULE
        .filter(visit => visit.visitNumber > completedVisitNumber);
      let previousDate = attendedDateOnly;
      const schedule = [];

      for (let index = 0; index < futureVisits.length; index += 1) {
        const futureVisit = futureVisits[index];
        const visit = remainingSchedule[index];
        if (!visit) {
          schedule.push({ id: futureVisit.id, status: 'Cancelled' });
          continue;
        }

        const idealDate = new Date(this.addWeeksToDate(lmpDate, visit.startWeek));
        const earliestDate = new Date(this.addDaysToDate(previousDate, 7));
        const latestDate = new Date(this.addWeeksToDate(lmpDate, visit.endWeek));
        let scheduledDate = idealDate >= earliestDate ? idealDate : earliestDate;

        while (
          scheduledDate <= latestDate &&
          await this.checkScheduleOverlap(scheduledDate.toISOString().split('T')[0], patientId, maxPerDay)
        ) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        if (scheduledDate > latestDate) {
          schedule.push({ id: futureVisit.id, status: 'Cancelled' });
          continue;
        }

        const scheduledDateStr = scheduledDate.toISOString().split('T')[0];
        const actualWeek = this.calculateWeeksAtDate(lmpDate, scheduledDateStr);
        schedule.push({
          id: futureVisit.id,
          visitNumber: visit.visitNumber,
          date: scheduledDateStr,
          week: actualWeek,
          trimester: this.getTrimesterFromWeek(actualWeek),
          type: 'Routine Prenatal',
          status: 'Scheduled'
        });

        previousDate = scheduledDateStr;
      }

      const activeSchedule = schedule
        .filter(visit => visit.status !== 'Cancelled')
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((visit, index) => ({ ...visit, visitNumber: index + 1 }));
      const numberedById = new Map(activeSchedule.map(visit => [visit.id, visit.visitNumber]));
      const updates = schedule.map(visit => ({
        ...visit,
        ...(visit.status === 'Cancelled' ? {} : { visitNumber: numberedById.get(visit.id) }),
        nextApptDate: visit.status === 'Cancelled'
          ? null
          : activeSchedule.find((nextVisit, index) =>
              index > activeSchedule.findIndex(item => item.id === visit.id)
            )?.date || null
      }));
      if (previewOnly) {
        return {
          current: futureVisits,
          proposed: updates,
          futureVisitIds: futureVisits.map(visit => visit.id)
        };
      }
      const { error: rebalanceError } = await this.supabase.rpc('rebalance_prenatal_visits', {
        p_current_visit_id: currentVisitId,
        p_schedule: updates,
        p_future_visit_ids: futureVisits.map(visit => visit.id)
      });
      if (rebalanceError) throw rebalanceError;
      await this.resequencePrenatalVisitNumbers(patientId);

      console.log(`✅ Rebalanced prenatal schedule for patient ${patientId}, new schedule:`, updates);
    } catch (err) {
      console.error('Error rebalancing prenatal schedule:', err);
      throw err;
    }
  }

  async getPrenatalVisits({ includeArchived = false } = {}) {
  try {
    const archivedPatientIds = includeArchived ? new Set() : await this.getArchivedPatientIds();

    const { data, error } = await this.supabase
      .from('prenatal_visits')
      .select(`
        id, 
        visit_date, 
        attended_date,
        gestational_age, 
        bp_systolic, 
        bp_diastolic, 
        weight_kg, 
        patient_id, 
        status,
        next_appt_date,
        next_appt_type,
        visit_number,
        trimester,
        assigned_staff,
        performed_by,
        assigned_station,
        station_ass,
        reschedule_reason,
        calculated_risk,
        risk_factors,
        patient_basic_info!inner(first_name, last_name, middle_name, station_ass)
      `)
      .order('visit_date', { ascending: false });

    if (error) throw error;

    const assignedStaffByPatient = new Map();
    (data || []).forEach(visit => {
      if (visit.status === 'Scheduled' && visit.assigned_staff && !assignedStaffByPatient.has(visit.patient_id)) {
        assignedStaffByPatient.set(visit.patient_id, visit.assigned_staff);
      }
    });

    const staffIds = [...new Set((data || []).flatMap(visit => [visit.assigned_staff, visit.performed_by]).filter(Boolean))];
    const stationIds = [...new Set((data || []).flatMap(visit => [visit.assigned_station, visit.station_ass]).filter(Boolean))];
    const [{ data: profiles }, { data: stations }] = await Promise.all([
      staffIds.length
        ? this.supabase.from('staff_profiles').select('id, full_name').in('id', staffIds)
        : Promise.resolve({ data: [] }),
      stationIds.length
        ? this.supabase.from('stations').select('id, station_name').in('id', stationIds)
        : Promise.resolve({ data: [] })
    ]);
    const staffNameById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile.full_name]));
    const stationNameById = Object.fromEntries((stations || []).map(station => [station.id, station.station_name]));

    // Filter out postpartum patients
    return (data || []).map(visit => {
      const assignedStaffId = visit.assigned_staff
        || (visit.status === 'Scheduled' ? assignedStaffByPatient.get(visit.patient_id) : null)
        || null;

      return {
      id: visit.id,
      visit_date: visit.visit_date,
      visitDate: visit.visit_date,
      visitDateOnly: visit.visit_date,
      attendedDate: visit.attended_date,
      patientName: `${visit.patient_basic_info?.first_name || ''} ${visit.patient_basic_info?.middle_name ? visit.patient_basic_info.middle_name[0] + '. ' : ''}${visit.patient_basic_info?.last_name || ''}`.trim(),
      patientId: visit.patient_id,
      patientStationId: visit.patient_basic_info?.station_ass || null,
      ga: visit.gestational_age || 'N/A',
      bp: visit.bp_systolic && visit.bp_diastolic ? `${visit.bp_systolic}/${visit.bp_diastolic}` : 'N/A',
      weight: visit.weight_kg ? `${visit.weight_kg}kg` : 'N/A',
      status: normalizeVisitStatus(visit),
      type: visit.next_appt_type || '',
      nextApptDate: visit.next_appt_date,
      visitNumber: visit.visit_number,
      assignedStaffId,
      assignedStaff: staffNameById[assignedStaffId] || assignedStaffId,
      performedBy: staffNameById[visit.performed_by] || visit.performed_by || null,
      assignedStationId: visit.assigned_station,
      visitStationId: visit.station_ass,
      assignedStation: stationNameById[visit.assigned_station] || null,
      visitStation: stationNameById[visit.station_ass] || null,
      reschedule_reason: visit.reschedule_reason,
      trimester: visit.trimester,
      risk: visit.calculated_risk || 'Normal',
      riskFactors: visit.risk_factors || ''
      };
    }).filter(visit => {
      if (!includeArchived && archivedPatientIds.has(visit.patientId)) return false;
      // Filter out cancelled visits for the scheduling view
      if (visit.status === 'Cancelled') return false;
      if (visit.type.toLowerCase().includes('postpartum')) return false;
      return true;
    });
  } catch (error) {
    console.error('Error fetching prenatal visits:', error);
    return [];
  }
}

  async getAppointments(startDate, endDate, view = 'day', options = {}) {
  try {
    const { includeArchived = false } = options;
    const archivedPatientIds = includeArchived ? new Set() : await this.getArchivedPatientIds();

    let query = this.supabase
      .from('prenatal_visits')
      .select(`
        id, visit_date, next_appt_date, next_appt_type, patient_id, status, patient_basic_info!inner(first_name, last_name)
      `);

    const isValidDate = (value) => {
      return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
    };

    if (view === 'week' || view === 'month') {
      if (isValidDate(startDate) && isValidDate(endDate)) {
        query = query.gte('visit_date', startDate).lte('visit_date', endDate);
      } else {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('visit_date', today);
      }
    } else {
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('visit_date', today);
    }

    const { data, error } = await query.order('visit_date');

    if (error) throw error;

    // Filter out postpartum patients
    return (data || []).map(appointment => ({
      id: appointment.id,
      date: appointment.visit_date,
      patient: `${appointment.patient_basic_info?.first_name || ''} ${appointment.patient_basic_info?.last_name || ''}`.trim() || 'Unknown',
      patientId: appointment.patient_id,
      type: appointment.next_appt_type || 'Prenatal Checkup',
      risk: appointment.next_appt_type === 'Postpartum Visit' ? 'Postpartum' : 'Normal',
      nextAppt: appointment.next_appt_date,
      status: appointment.status
    })).filter(appointment => {
      if (!includeArchived && archivedPatientIds.has(appointment.patientId)) return false;
      if (appointment.status === 'Cancelled') return false;
      return true;
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }
}

  async updatePrenatalVisitStatus(visitId, updates) {
    const payload = { ...updates };
    if (payload.status === 'Attended') {
      return this.completePrenatalVisit(visitId, payload);
    }
    if (payload.status === 'Attended' && !payload.attended_date) {
      payload.attended_date = new Date().toISOString().split('T')[0];
    }
    if (payload.status !== 'Attended') {
      payload.attended_date = null;
    }

    const { data, error } = await this.supabase
      .from('prenatal_visits')
      .update(payload)
      .eq('id', visitId)
      .select();

    if (error) throw error;
    return data;
  }

  generateTimeSlot(patientId, visitDate) {
    const timeSlots = ['08:00 AM','08:30 AM','09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM'];
    if (!patientId || !visitDate) return timeSlots[0];
    
    let hash = 0;
    const str = patientId + visitDate;
    for (let i = 0; i < str.length; i++) {
        hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return timeSlots[Math.abs(hash) % timeSlots.length];
  }

  async resolveAssignedStaff({ requestedStaffId, currentUserId, role, stationId }) {
    const assignedStaffId = requestedStaffId || null;

    if (!assignedStaffId) return null;

    const { data: staffProfile, error } = await this.supabase
      .from('staff_profiles')
      .select('id, station_ass')
      .eq('id', assignedStaffId)
      .maybeSingle();

    if (error) throw error;
    if (!staffProfile) throw new Error('The selected assigned staff member was not found.');

    if (staffProfile.station_ass !== stationId) {
      throw new Error('The selected healthcare worker must belong to the patient\'s assigned station.');
    }

    return staffProfile.id;
  }

  async addPatient(patientData) {
    const { data: sessionData } = await this.supabase.auth.getSession();
    const staffSessionUser = sessionData?.session?.user;
    const createdBy = staffSessionUser?.id || null;
    if (!createdBy) throw new Error("No logged-in user");
    if (patientData.pregnancyStatus === 'Postpartum' && patientData.birthDate && !patientData.attending_staff) {
      throw new Error('Select the staff member who attended the delivery.');
    }

    const currentUser = await authService.getAuthUser();
    const normalizedRole = String(currentUser?.role || '').toLowerCase().replace(/_/g, ' ').trim();
    const currentUserRole = normalizedRole === 'station staff' ? 'staff' : normalizedRole;
    const enforceCurrentStation = currentUserRole === 'staff' || currentUserRole === 'cho personnel';

    let ownStationId = null;
    if (enforceCurrentStation) {
      const { data: currentStaffProfile } = await this.supabase
        .from('staff_profiles')
        .select('station_ass')
        .eq('id', currentUser.id)
        .maybeSingle();

      ownStationId = currentStaffProfile?.station_ass || null;
    }

    if (!patientData.station) throw new Error('Select the patient\'s assigned station.');
    const stationId = await authService.getOrCreateStationId(patientData.station);
    if (!stationId) throw new Error('Select a valid patient station.');
    const mayAssignAtSelectedStation = currentUserRole === 'admin' || stationId === ownStationId;

    const assignedStaff = currentUserRole === 'admin' || stationId === ownStationId
      ? await this.resolveAssignedStaff({
          requestedStaffId: mayAssignAtSelectedStation ? patientData.retained_staff : null,
          currentUserId: createdBy,
          role: currentUserRole,
          stationId: ownStationId || stationId
        })
      : null;

    const authUser = await authService.createUserAccount({
      email: patientData.email,
      password: patientData.password || 'mother123!',
      role: 'patient',
      metadata: {
        full_name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim(),
      },
      stationId
    });

    const { data: activeSession, error: activeSessionError } = await this.supabase.auth.getSession();
    const activeStaffId = activeSession?.session?.user?.id;
    if (activeSessionError || activeStaffId !== createdBy) {
      throw new Error('Your staff session expired while creating the patient. Please sign in again and retry.');
    }

    // Use the real UUID from the auth/public user record as the database ID.
    // The UI may still shorten this value to 4 digits for display only.
    const patientId = authUser.id;

    const { error: patientInsertError } = await this.supabase.from('patient_basic_info').insert({
      id: patientId,
      first_name: patientData.firstName,
      middle_name: patientData.middleName || null,
      last_name: patientData.lastName,
      suffix: patientData.suffix || null,
      date_of_birth: patientData.dob,
      civil_status: patientData.civilStatus || null,
      contact_no: patientData.contactNumber,
      house_no: patientData.address || '',
      municipality: patientData.municipality,
      station_ass: stationId,
      province: patientData.province,
      philhealthnumber: patientData.philhealth || null,
      blood_type: patientData.bloodType || null,
      created_by: createdBy,
      emergency_contact: {
        name: patientData.emName || null,
        relationship: patientData.emRel || null,
        phone: patientData.emPhone || null,
        address: patientData.emAddress || null
      }
    });

    if (patientInsertError) {
      console.error('Error inserting patient_basic_info:', patientInsertError);
      throw patientInsertError;
    }

    const pregnancyInfoId = patientData.pregnancyStatus === 'Postpartum' ? crypto.randomUUID() : null;
    try {
      const pregnancyPayload = {
        ...(pregnancyInfoId ? { id: pregnancyInfoId } : {}),
        patient_id: patientId,
        created_by: createdBy,
        pregn_postp: patientData.pregnancyStatus,
        lmd: patientData.pregnancyStatus === 'Postpartum' ? null : patientData.lmp,
        edd: patientData.pregnancyStatus === 'Postpartum' ? null : patientData.edd,
        pregnancy_type: patientData.pregnancyType,
        place_of_delivery: patientData.plannedDeliveryPlace,
        gravida: parseInt(patientData.gravida) || 1,
        para: parseInt(patientData.para) || 0
      };
      const { error: pregnancyError } = await this.supabase.from('pregnancy_info').insert(pregnancyPayload);
      if (pregnancyError) {
        console.error('Error inserting pregnancy_info:', pregnancyError);
        if (patientData.pregnancyStatus === 'Postpartum') throw pregnancyError;
      } else {
        console.log('✅ Inserted pregnancy_info for patient:', patientId);
      }
    } catch (error) {
      console.error('Error inserting pregnancy_info:', error);
      if (patientData.pregnancyStatus === 'Postpartum') throw error;
      // Don't throw - patient creation should still succeed
    }

    // If postpartum, create delivery and newborn records
    if (patientData.pregnancyStatus === 'Postpartum' && patientData.birthDate) {
      const { default: BabyService } = await import('./babyservices');
      const babyService = new BabyService();
      
      const deliveryData = {
        mother_id: patientId,
        pregnancy_id: pregnancyInfoId,
        delivery_date: patientData.birthDate,
        delivery_time: patientData.deliveryTime || '00:00',
        delivery_type: patientData.deliveryType || 'NSD',
        delivery_mode: patientData.deliveryMode || null,
        gestational_age: null,
        risk_level: 'Normal',
        complications: [],
        attending_staff: patientData.attending_staff || null,
        facility: patientData.plannedDeliveryPlace || 'Hospital',
        notes: null
      };

      const newbornData = {
        baby_name: patientData.babyName,
        gender: patientData.babyGender,
        birth_weight: patientData.babyWeight ? parseFloat(patientData.babyWeight) : null,
        birth_length: patientData.babyLength ? parseFloat(patientData.babyLength) : null,
        head_circumference: patientData.headCircumference ? parseFloat(patientData.headCircumference) : null,
        apgar_1min: patientData.apgar1 ? parseInt(patientData.apgar1) : null,
        apgar_5min: patientData.apgar5 ? parseInt(patientData.apgar5) : null,
        condition_at_birth: patientData.babyCondition || 'Healthy',
        risk_level: 'Normal'
      };

      const result = await babyService.recordDelivery(deliveryData, newbornData);
      console.log('✅ Created delivery and newborn records for postpartum patient:', result);

        try {
        // Schedule newborn vaccinations
          const vaccService = new VaccinationService();
          const newbornIds = result.newborn_ids || [];

          for (const newbornId of newbornIds) {
            await vaccService.scheduleNewbornVaccinations(newbornId, patientData.birthDate, createdBy);
          }

          console.log('✅ Scheduled vaccinations for eligible newborns');
        } catch (vaccinationError) {
          console.error('Warning: Delivery was recorded, but vaccination scheduling failed:', vaccinationError);
        }
    }

    let safeSchedulePreview = Array.isArray(patientData.schedulePreview)
      ? patientData.schedulePreview
          .filter(v => v && v.date && !Number.isNaN(new Date(v.date).getTime()))
          .map(v => ({ ...v, date: new Date(v.date).toISOString().split('T')[0] }))
      : [];

    // Skip prenatal visit scheduling for postpartum patients
    if (patientData.pregnancyStatus === 'Postpartum') {
      console.log('Skipping prenatal visit scheduling for postpartum patient');
      try {
        await this.sendMotherEmail('welcome', patientId);
      } catch (emailError) {
        console.error('Warning: postpartum patient was created but welcome email could not be sent:', emailError);
      }
      return await this.getPatientById(patientId);
    }

    if (patientData.firstVisitDate) {
      const today = new Date().toISOString().split('T')[0];
      const firstVisitDate = patientData.firstVisitDate ||
        (Array.isArray(patientData.schedulePreview) && patientData.schedulePreview.length > 0
          ? this.getEarliestTodayOrFutureVisitDate(patientData.schedulePreview)
          : today);
      
      safeSchedulePreview = this.filterScheduleAfterToday(
        Array.isArray(patientData.schedulePreview) ? patientData.schedulePreview : []
      );
      
      const nextScheduledVisit = safeSchedulePreview.find(v => {
        return v.date && new Date(v.date) > new Date(firstVisitDate);
      });
      const nextApptDate = nextScheduledVisit ? nextScheduledVisit.date : null;
      
      const bpMatch = patientData.bp ? patientData.bp.match(/^(\d+)[/\\s](\d+)$/) : null;
      const registrationRisk = this.getPregnancyRisk(
        { date_of_birth: patientData.dob, height_cm: patientData.height },
        { gravida: patientData.gravida, pregnancy_type: patientData.pregnancyType },
        {
          risk_factors: patientData.riskFactors,
          bp_systolic: bpMatch ? Number(bpMatch[1]) : null,
          bp_diastolic: bpMatch ? Number(bpMatch[2]) : null,
          weight_kg: patientData.weight,
          height_cm: patientData.height,
          temp_c: patientData.temp,
          pulse_bpm: patientData.pulse,
          resp_rate_cpm: patientData.respRate,
          fhr_bpm: patientData.fhr,
        }
      );
      
      // Use today's date as the actual visit date (when patient came in)
      const actualVisitDate = today;
      
      // Calculate gestational age based on LMP at today's date
      const weeksAtVisit = patientData.lmp ? this.calculateWeeks(patientData.lmp) : 0;
      const gaString = weeksAtVisit > 0 ? `${weeksAtVisit} weeks` : '1st visit';
      const visitNumberAtVisit = 1;
      
      const firstVisitRecord = {
        patient_id: patientId,
        visit_date: actualVisitDate,
        visit_number: visitNumberAtVisit,
        trimester: this.calculateTrimester(patientData.lmp),
        gestational_age: gaString,
        bp_systolic: bpMatch ? parseInt(bpMatch[1]) : null,
        bp_diastolic: bpMatch ? parseInt(bpMatch[2]) : null,
        weight_kg: patientData.weight ? parseFloat(patientData.weight) : null,
        height_cm: patientData.height ? parseFloat(patientData.height) : null,
        temp_c: patientData.temp ? parseFloat(patientData.temp) : null,
        pulse_bpm: patientData.pulse ? parseInt(patientData.pulse) : null,
        resp_rate_cpm: patientData.respRate ? parseInt(patientData.respRate) : null,
        fundal_height_cm: patientData.fundalHeight ? parseFloat(patientData.fundalHeight) : null,
        fhr_bpm: patientData.fhr ? parseInt(patientData.fhr) : null,
        fetal_movement: patientData.fetalMovement || null,
        presentation: patientData.presentation || null,
        tests_done: patientData.testsDone ? patientData.testsDone.split(',').map(s => s.trim()).filter(Boolean) : null,
        clinical_notes: patientData.visitNotes || 'Initial registration visit',
        next_appt_date: nextApptDate,  // CRITICAL: Set to first scheduled visit, not null
        next_appt_type: 'Follow-up Checkup',
        status: 'Attended',
        attended_date: new Date().toISOString(),
        assigned_staff: assignedStaff,
        assigned_station: stationId,
        station_ass: ownStationId,
        performed_by: createdBy,
        calculated_risk: registrationRisk.riskLevel,
        risk_factors: registrationRisk.riskFactors.join(', ') || null,
        created_by: createdBy
      };

      const { error: firstVisitError } = await this.supabase.from('prenatal_visits').insert(firstVisitRecord);
      if (firstVisitError) {
        console.error('Error inserting first prenatal visit record:', firstVisitError);
        throw firstVisitError;
      }
    }

    // Insert only the remaining visits from the schedule (visit 2-9)
    // because visit 1 is already inserted above
    if (safeSchedulePreview.length > 0) {
      await this.insertPrenatalSchedule(
        patientId,
        safeSchedulePreview,
        createdBy,
        { retained_staff: assignedStaff },
        30
      );
    } else {
      await this.resequencePrenatalVisitNumbers(patientId);
    }

    try {
      await this.sendMotherEmail('welcome', patientId);
    } catch (emailError) {
      console.error('Warning: patient was created but welcome email could not be sent:', emailError);
    }

    return await this.getPatientById(patientId);
  }

async getSlotCount(dateStr, timeSlot) {
  const { count } = await this.supabase
    .from('prenatal_visits')
    .select('*', { count: 'exact', head: true })
    .eq('visit_date', dateStr)
    .eq('scheduled_time', timeSlot);
  return count || 0;
}

  async getHighRiskStats({ includeArchived = false } = {}) {
    try {
      const patients = await this.getHighRiskPatients({ includeArchived });
      return { highRiskCount: patients.length };
    } catch (err) {
      console.error('Error fetching health conditions stats:', err);
      return { highRiskCount: 0 };
    }
  }

async getHighRiskPatients({ includeArchived = false, archivedPatientIds: providedArchivedPatientIds = null } = {}) {
  try {
    const [
      archivedPatientIds,
      deliveryResult,
      pregnancyResult,
      visitResult
    ] = await Promise.all([
      includeArchived
        ? Promise.resolve(new Set())
        : providedArchivedPatientIds
          ? Promise.resolve(providedArchivedPatientIds)
          : this.getArchivedPatientIds(),
      this.supabase
        .from('deliveries')
        .select('mother_id, delivery_date')
        .order('delivery_date', { ascending: false }),
      this.supabase
        .from('pregnancy_info')
        .select('patient_id, pregn_postp, pregnancy_type, gravida, lmd, created_at')
        .order('created_at', { ascending: false }),
      this.supabase
        .from('prenatal_visits')
        .select(`
          patient_id,
          visit_date,
          status,
          bp_systolic,
          bp_diastolic,
          temp_c,
          pulse_bpm,
          resp_rate_cpm,
          fhr_bpm,
          assigned_staff,
          next_appt_date,
          next_appt_type,
          weight_kg,
          height_cm,
          calculated_risk,
          risk_factors,
          gestational_age,
          patient_basic_info!inner(
            id,
            first_name,
            last_name,
            station_ass,
            municipality,
            date_of_birth,
            created_at,
            stations:station_ass(station_name)
          )
        `)
        .order('visit_date', { ascending: false })
    ]);

    const { data: deliveries, error: deliveryError } = deliveryResult;
    if (deliveryError) throw deliveryError;

    const latestDeliveryByPatient = new Map();
    (deliveries || []).forEach(d => {
      if (!d.mother_id || !d.delivery_date) return;
      const existing = latestDeliveryByPatient.get(d.mother_id);
      if (!existing || new Date(d.delivery_date) > new Date(existing)) {
        latestDeliveryByPatient.set(d.mother_id, d.delivery_date);
      }
    });

    const { data: pregnancies, error: pregnancyError } = pregnancyResult;
    if (pregnancyError) throw pregnancyError;

    const latestPregMap = new Map();
    (pregnancies || []).forEach(p => {
      if (!p.patient_id) return;
      const existing = latestPregMap.get(p.patient_id);
      const currentTime = new Date(p.created_at).getTime() || 0;
      const existingTime = existing ? new Date(existing.created_at).getTime() || 0 : 0;
      if (!existing || currentTime > existingTime) {
        latestPregMap.set(p.patient_id, p);
      }
    });

    const { data, error } = visitResult;

    if (error) throw error;

    const assignedStaffByPatient = new Map();
    const heightByPatientMap = new Map();
    const visitsByPatientMap = new Map();
    (data || []).forEach((visit) => {
      if (!visit.patient_id) return;
      if (!visitsByPatientMap.has(visit.patient_id)) {
        visitsByPatientMap.set(visit.patient_id, []);
      }
      visitsByPatientMap.get(visit.patient_id).push(visit);

      if (Number(visit.height_cm) > 0 && !heightByPatientMap.has(visit.patient_id)) {
        heightByPatientMap.set(visit.patient_id, visit.height_cm);
      }
      if (visit.status === 'Scheduled' && visit.assigned_staff && !assignedStaffByPatient.has(visit.patient_id)) {
        assignedStaffByPatient.set(visit.patient_id, visit.assigned_staff);
      }
    });

    const latestAttendedByPatient = new Map();
    (data || []).forEach((visit) => {
      if (!visit.patient_id || visit.status !== 'Attended') return;
      if (!includeArchived && archivedPatientIds.has(visit.patient_id)) return;
      const preg = latestPregMap.get(visit.patient_id);
      if (!preg || preg.pregn_postp?.toLowerCase() !== 'pregnant') return;
      const pregnancyStart = preg.lmd || preg.created_at;
      const latestDelivery = latestDeliveryByPatient.get(visit.patient_id);
      if (
        latestDelivery &&
        pregnancyStart &&
        new Date(latestDelivery).getTime() >= new Date(pregnancyStart).getTime()
      ) return;
      if (
        pregnancyStart &&
        visit.visit_date &&
        new Date(visit.visit_date).getTime() < new Date(pregnancyStart).getTime()
      ) return;

      if (!latestAttendedByPatient.has(visit.patient_id)) {
        latestAttendedByPatient.set(visit.patient_id, visit);
      }
    });

    return Array.from(latestAttendedByPatient.values()).map((visit) => {
      const patient = {
        ...(visit.patient_basic_info || {}),
        height_cm: visit.patient_basic_info?.height_cm || heightByPatientMap.get(visit.patient_id),
      };
      const pregnancy = latestPregMap.get(visit.patient_id) || {};

      const pregnancyStart = pregnancy.lmd || pregnancy.created_at;
      const patientVisits = (visitsByPatientMap.get(visit.patient_id) || [visit]).filter(v =>
        !pregnancyStart || !v.visit_date ||
        new Date(v.visit_date).getTime() >= new Date(pregnancyStart).getTime()
      );
      const conditionSet = new Set();
      const categorizedMap = new Map();

      const processVisitRiskFactors = (rf) => {
        if (!rf) return;
        const conds = this.getDocumentedHealthConditions(rf);
        conds.forEach(c => conditionSet.add(c));

        const categorizedList = this.getCategorizedHealthConditions(rf);
        categorizedList.forEach(item => {
          const key = `${item.category}:::${item.name.toLowerCase()}`;
          if (!categorizedMap.has(key)) {
            categorizedMap.set(key, item);
          }
        });
      };

      const processVisitVitals = (currentVisit) => {
        if (!this.isBPHighRisk(currentVisit.bp_systolic, currentVisit.bp_diastolic)) return;

        const condition = this.getBPStatus(currentVisit.bp_systolic, currentVisit.bp_diastolic);
        conditionSet.add(condition);
        const key = `Pregnancy-Related Conditions:::${condition.toLowerCase()}`;
        if (!categorizedMap.has(key)) {
          categorizedMap.set(key, {
            name: condition,
            category: 'Pregnancy-Related Conditions',
          });
        }
      };

      patientVisits.forEach(v => {
        processVisitRiskFactors(v.risk_factors);
        processVisitVitals(v);
      });
      processVisitRiskFactors(visit.risk_factors);
      processVisitVitals(visit);

      const documentedConditions = Array.from(conditionSet);

      const conditionsByCategory = {
        'Pre-existing Medical Conditions': [],
        'Pregnancy-Related Conditions': [],
        'Relevant Obstetric History': []
      };

      Array.from(categorizedMap.values()).forEach(item => {
        const cat = this.normalizeCategoryName(item.category);
        if (!conditionsByCategory[cat]) {
          conditionsByCategory[cat] = [];
        }
        if (!conditionsByCategory[cat].includes(item.name)) {
          conditionsByCategory[cat].push(item.name);
        }
      });

      const activeCategories = Object.entries(conditionsByCategory)
        .filter(([_, list]) => list.length > 0)
        .map(([category, conditions]) => ({ category, conditions }));

      const hasHealthConditions = activeCategories.length > 0 || documentedConditions.length > 0;
      const conditionDisplay = documentedConditions.join(', ') || (activeCategories.length > 0 ? 'Documented Conditions' : 'None Reported');

      const gestationalAge = visit.gestational_age ? parseInt(visit.gestational_age) || 0 : 0;
      const weeks = gestationalAge;
      let lmd = null;
      let edd = null;
      if (weeks > 0 && visit.visit_date) {
        lmd = new Date(visit.visit_date);
        lmd.setDate(lmd.getDate() - weeks * 7);
        edd = new Date(lmd);
        edd.setDate(edd.getDate() + 280);
      }

      const ageNum = this.calculateAge(patient.date_of_birth);

      return {
        id: patient.id || visit.patient_id,
        stationId: patient.station_ass,
        assignedStaffId: assignedStaffByPatient.get(visit.patient_id) || null,
        first_name: patient.first_name,
        last_name: patient.last_name,
        station: patient.stations?.station_name || patient.municipality || 'Unknown',
        municipality: patient.municipality,
        date_of_birth: patient.date_of_birth,
        age: ageNum,
        type: 'Mother',
        created_at: patient.created_at,
        riskLevel: hasHealthConditions ? 'Health Conditions Documented' : 'None Reported',
        hasHealthConditions,
        documentedConditions,
        activeCategories,
        conditionsByCategory,
        categorizedConditions: Array.from(categorizedMap.values()),
        condition: conditionDisplay,
        conditionsList: documentedConditions,
        risk_factors: visit.risk_factors,
        gravida: pregnancy.gravida || null,
        lmd: lmd ? lmd.toISOString().split('T')[0] : null,
        edd: edd ? edd.toISOString().split('T')[0] : null,
        bp: visit.bp_systolic && visit.bp_diastolic ? `${visit.bp_systolic}/${visit.bp_diastolic}` : null,
        bpSystolic: visit.bp_systolic || null,
        bpDiastolic: visit.bp_diastolic || null,
        isBPHighRisk: this.isBPHighRisk(visit.bp_systolic, visit.bp_diastolic),
        bpStatus: this.isBPHighRisk(visit.bp_systolic, visit.bp_diastolic)
          ? this.getBPStatus(visit.bp_systolic, visit.bp_diastolic)
          : null,
        weight_kg: visit.weight_kg || null,
        height_cm: visit.height_cm || null,
        pregnancyType: pregnancy.pregnancy_type || 'Singleton',
        isMultipleBirth: pregnancy.pregnancy_type && pregnancy.pregnancy_type.toLowerCase() !== 'singleton' && pregnancy.pregnancy_type.toLowerCase() !== 'undetermined',
        nextVisit: visit.next_appt_date
          ? new Date(visit.next_appt_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Initial',
        weeks,
      };
    }).filter(p => p.hasHealthConditions);
  } catch (err) {
    console.error('Error fetching patients with health conditions:', err);
    throw err;
  }
}

  async getLatestPrenatalVisit(patientId) {
  const { data, error } = await this.supabase
    .from('prenatal_visits')
    .select(`*
    `)
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}


  subscribeToHighRiskChanges(callback) {
    return this.supabase
      .channel('high-risk-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pregnancy_info' },
        (payload) => {
          console.log('🔔 Real-time change in pregnancy_info:', payload);
          callback(payload);
        }
      )
      .subscribe();
  }

  addWeeksToDate(date, weeks) {
    const d = new Date(date);
    d.setDate(d.getDate() + weeks * 7);
    return d.toISOString().split('T')[0];
  }

  addDaysToDate(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  calculateWeeksAtDate(lmp, targetDate) {
    if (!lmp || !targetDate) return 0;
    const lmpDate = new Date(lmp);
    const visitDate = new Date(targetDate);
    if (Number.isNaN(lmpDate.getTime()) || Number.isNaN(visitDate.getTime())) return 0;
    const diff = visitDate - lmpDate;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 7)));
  }

  getTrimesterFromWeek(week) {
    if (week < 14) return 1;
    if (week < 28) return 2;
    return 3;
  }

  getPrenatalVisitNumberForWeek(week) {
    const matchingVisit = PRENATAL_VISIT_SCHEDULE.find(
      visit => week >= visit.startWeek && week <= visit.endWeek
    );
    if (matchingVisit) return matchingVisit.visitNumber;
    return week < PRENATAL_VISIT_SCHEDULE[0].startWeek
      ? PRENATAL_VISIT_SCHEDULE[0].visitNumber
      : PRENATAL_VISIT_SCHEDULE[PRENATAL_VISIT_SCHEDULE.length - 1].visitNumber;
  }

  calculateWeeks(lmp) {
    if (!lmp) return 0;
    return Math.floor((new Date() - new Date(lmp)) / (1000 * 60 * 60 * 24 * 7));
  }

  calculateTrimester(lmp) {
    return this.getTrimesterFromWeek(this.calculateWeeks(lmp));
  }

  async findPatientByName(patientName) {
    try {
      const { data, error } = await this.supabase
        .from('patient_basic_info')
        .select('id')
        .ilike('first_name', `%${patientName.split(' ')[0]}%`)
        .limit(1);
      
      if (error) throw error;
      return data?.[0]?.id || null;
    } catch (err) {
      console.error('Error finding patient by name:', err);
      return null;
    }
  }

  async getPatientsByIds(patientIds) {
    try {
      const { data, error } = await this.supabase
        .from('patient_basic_info')
        .select('id, first_name, last_name, date_of_birth, station_ass')
        .in('id', patientIds);
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching patients by IDs:', err);
      return [];
    }
  }

  async getPatientById(patientId) {
    const [
      patientResult,
      userResult,
      pregnancyResult,
      visitsResult,
      supplementsResult,
      maternalVaccinationsResult,
      deliveriesResult,
      newbornsResult
    ] = await Promise.all([
      this.supabase
        .from('patient_basic_info')
        .select('*, stations:station_ass (station_name)')
        .eq('id', patientId)
        .maybeSingle(),
      this.supabase
        .from('users')
        .select('is_archived, is_deactivated, email_address')
        .eq('id', patientId)
        .maybeSingle(),
      this.supabase
        .from('pregnancy_info')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('prenatal_visits')
        .select(`
          *,
          staff_profiles:assigned_staff (
            id, full_name, station_ass,
            stations:station_ass (station_name)
          ),
          performed_staff:performed_by (
            id, full_name, station_ass,
            stations:station_ass (station_name)
          )
        `)
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false }),
      this.supabase
        .from('supplements')
        .select(`
          *,
          supplement_inventory (
            supplement_name,
            brand
          )
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('vaccinations')
        .select(`
          id, patient_id, vaccine_inventory_id, dose_number, scheduled_vaccination,
          vaccinated_date, status, notes, vaccinated_by, assigned_staff, station_ass,
          vaccine_inventory (vaccine_name, brand, unit, doses, batch, expiration_date),
          staff_profiles:assigned_staff (
            id, full_name, station_ass,
            stations:station_ass (station_name)
          )
        `)
        .eq('patient_id', patientId)
        .order('scheduled_vaccination', { ascending: true, nullsFirst: false }),
      this.supabase
        .from('deliveries')
        .select(`
          *,
          stations:station_ass (station_name),
          pregnancy_info!deliveries_pregnancy_id_fkey (place_of_delivery),
          staff_profiles!deliveries_attending_staff_fkey (
            id, full_name, station_ass,
            stations:station_ass (station_name)
          )
        `)
        .eq('mother_id', patientId)
        .order('delivery_date', { ascending: false }),
      this.supabase
        .from('newborns')
        .select(`
          *,
          vaccinations (
            id, vaccine_inventory_id, dose_number, notes, status, scheduled_vaccination, vaccinated_date,
            vaccinated_by, assigned_staff, station_ass,
            vaccine_inventory (vaccine_name, brand, unit, doses, batch, expiration_date),
            staff_profiles:assigned_staff (
              id, full_name, station_ass,
              stations:station_ass (station_name)
            )
          )
        `)
        .eq('mother_id', patientId)
        .order('created_at', { ascending: false })
    ]);

    const { data: patientData, error: patientError } = patientResult;
    if (patientError) throw patientError;
    if (!patientData) return null;

    const { data: userData, error: userError } = userResult;
    if (userError) throw userError;

    const { data: pregnancyData, error: pregnancyError } = pregnancyResult;
    if (pregnancyError) throw pregnancyError;

    const { data: visitsData, error: visitsError } = visitsResult;
    if (visitsError) throw visitsError;

    const { data: supplementsData, error: supplementsError } = supplementsResult;
    if (supplementsError) throw supplementsError;

    const { data: maternalVaccinationsData, error: maternalVaccinationsError } = maternalVaccinationsResult;
    if (maternalVaccinationsError) throw maternalVaccinationsError;

    const { data: deliveriesData, error: deliveriesError } = deliveriesResult;
    if (deliveriesError) throw deliveriesError;

    const { data: newbornsData, error: newbornsError } = newbornsResult;
    if (newbornsError) throw newbornsError;

    const deliveryIds = (deliveriesData || []).map(delivery => delivery.id);
    const [emailResult, postpartumVisitsResult] = await Promise.all([
      userData?.email_address
        ? Promise.resolve(null)
        : this.supabase.rpc('get_patient_email', { p_patient_id: patientId }),
      deliveryIds.length
        ? this.supabase
          .from('postpartum_visits')
          .select(`
            id, delivery_id, patient_id, visit_number, visit_type, scheduled_date, scheduled_at,
            status, attended_date, missed_reason, assigned_staff, assigned_station, station_ass,
            personnel_present, performed_by, created_by, assessment, notes,
            bp_systolic, bp_diastolic, weight_kg, temp_c, pulse_bpm, resp_rate_cpm,
            uterine_involution, lochia_assessment, perineal_or_wound_condition, pain_assessment,
            breast_assessment, breastfeeding_status, urination_and_bowel_status,
            mental_health_assessment, danger_signs, clinical_notes, advice_given,
            treatments_given, medications_review, family_planning_counseling,
            is_referred, referred_to, referral_reason, next_appt_date, next_appt_type,
            staff_profiles:assigned_staff (
              id, full_name, station_ass,
              stations:station_ass (station_name)
            ),
            performed_staff:performed_by (
              id, full_name, station_ass,
              stations:station_ass (station_name)
            )
          `)
          .in('delivery_id', deliveryIds)
          .order('scheduled_at', { ascending: true })
        : Promise.resolve({ data: [], error: null })
    ]);

    let patientEmail = userData?.email_address || null;
    if (emailResult?.error) throw emailResult.error;
    if (!patientEmail) patientEmail = emailResult?.data?.[0]?.email_address || null;

    const { data: postpartumVisitsData, error: postpartumVisitsError } = postpartumVisitsResult;
    if (postpartumVisitsError) throw postpartumVisitsError;

    const assignedStaffIds = [...new Set([
      patientData.retained_staff,
      ...(visitsData || []).flatMap(visit => [visit.assigned_staff, visit.performed_by, visit.retained_staff]),
      ...(supplementsData || []).flatMap(supplement => [supplement.administered_by, supplement.created_by]),
      ...(maternalVaccinationsData || []).flatMap(vaccination => [vaccination.assigned_staff, vaccination.vaccinated_by]),
      ...(newbornsData || []).flatMap(newborn => (newborn.vaccinations || []).map(vaccine => vaccine.assigned_staff)),
      ...(newbornsData || []).flatMap(newborn => (newborn.vaccinations || []).map(vaccine => vaccine.vaccinated_by)),
      ...(deliveriesData || []).map(delivery => delivery.attending_staff || delivery.assigned_staff),
      ...(postpartumVisitsData || []).flatMap(visit => [
        visit.assigned_staff,
        visit.personnel_present,
        visit.performed_by
      ])
    ].filter(Boolean))];

    const stationIds = [...new Set([
      ...(visitsData || []).flatMap(visit => [visit.assigned_station, visit.station_ass]),
      ...(supplementsData || []).map(supplement => supplement.station_ass),
      ...(maternalVaccinationsData || []).map(vaccination => vaccination.station_ass),
      ...(newbornsData || []).flatMap(newborn => (newborn.vaccinations || []).map(vaccination => vaccination.station_ass)),
      ...(deliveriesData || []).map(delivery => delivery.station_ass),
      ...(postpartumVisitsData || []).flatMap(visit => [visit.assigned_station, visit.station_ass])
    ].filter(Boolean))];

    let assignedStaffById = {};

    const registerStaffProfile = (sp) => {
      const profile = Array.isArray(sp) ? sp[0] : sp;
      if (!profile?.id && !profile?.full_name) return;
      const details = {
        name: profile.full_name || 'Healthcare Worker',
        station: profile.stations?.station_name || profile.station_name || 'Unassigned'
      };
      if (profile.id) assignedStaffById[profile.id] = details;
      if (profile.full_name) assignedStaffById[profile.full_name] = details;
    };

    // 1. Ingest embedded profiles directly returned by visit/delivery/vaccine queries
    (visitsData || []).forEach(v => {
      registerStaffProfile(v.staff_profiles);
      registerStaffProfile(v.performed_staff);
    });
    (postpartumVisitsData || []).forEach(pv => {
      registerStaffProfile(pv.staff_profiles);
      registerStaffProfile(pv.performed_staff);
    });
    (maternalVaccinationsData || []).forEach(mv => {
      registerStaffProfile(mv.staff_profiles);
    });
    (newbornsData || []).forEach(nb => {
      (nb.vaccinations || []).forEach(vac => registerStaffProfile(vac.staff_profiles));
    });
    (deliveriesData || []).forEach(d => {
      registerStaffProfile(d.staff_profiles);
    });

    // 2. Fetch any missing assigned staff from staff_profiles and stations in parallel
    const missingStaffIds = assignedStaffIds.filter(id => !assignedStaffById[id]);
    const [staffResult, stationsResult] = await Promise.all([
      missingStaffIds.length
        ? this.supabase
          .from('staff_profiles')
          .select('id, full_name, station_ass, stations:station_ass (station_name)')
          .in('id', missingStaffIds)
        : Promise.resolve({ data: [], error: null }),
      stationIds.length
        ? this.supabase.from('stations').select('id, station_name').in('id', stationIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (!staffResult?.error && staffResult?.data?.length) {
      staffResult.data.forEach(registerStaffProfile);
    }

    // 3. Fallback to get_assigned_staff_names RPC for any still-unmapped staff IDs
    const stillMissingStaffIds = assignedStaffIds.filter(id => !assignedStaffById[id]);
    if (stillMissingStaffIds.length > 0) {
      try {
        const { data: rpcStaff, error: rpcError } = await this.supabase
          .rpc('get_assigned_staff_names', { p_staff_ids: stillMissingStaffIds });

        if (!rpcError && rpcStaff?.length) {
          rpcStaff.forEach(profile => {
            if (profile.id) {
              assignedStaffById[profile.id] = {
                name: profile.full_name || 'Healthcare Worker',
                station: profile.station_name || 'Unassigned'
              };
            }
          });
        }
      } catch (err) {
        // RPC might not exist if migration is not yet applied
      }
    }

    const { data: visitStations } = stationsResult || {};
    const stationNameById = Object.fromEntries((visitStations || []).map(station => [station.id, station.station_name]));

    const preg = getLatestPregnancyRecord(pregnancyData || []) || {};
    const latestRecordedHeight = (visitsData || []).find(visit => Number(visit.height_cm) > 0)?.height_cm;
    const riskPatient = {
      ...patientData,
      height_cm: patientData.height_cm || latestRecordedHeight,
    };

    const normalizedVisits = (visitsData || []).map(visit => {
      const assignedStaffId = visit.assigned_staff || visit.retained_staff || patientData.retained_staff || null;
      
      // Calculate dynamic risk factors exactly like getAllPatients does
      const riskAssessment = this.getPregnancyRisk(riskPatient, preg, visit);
      
      return {
        ...visit,
        raw_risk_factors: visit.risk_factors,
        calculated_risk: riskAssessment.riskLevel,
        risk_factors: riskAssessment.riskFactors.join(', '),
        assigned_staff: assignedStaffId,
        status: normalizeVisitStatus(visit),
        assigned_staff_name: assignedStaffById[assignedStaffId]?.name || null,
        assigned_staff_station: assignedStaffById[assignedStaffId]?.station || null,
        performed_by_name: assignedStaffById[visit.performed_by]?.name || null,
        assigned_station_name: stationNameById[visit.assigned_station] || null,
        visit_station_name: stationNameById[visit.station_ass] || null
      };
    });

    // Find latest attended visit with the updated dynamic risk calculations
    const latestAttendedVisit = normalizedVisits.find(v => v.status === 'Attended') || null;

    const postpartumVisitsByDelivery = new Map();
    (postpartumVisitsData || []).forEach(visit => {
      const visits = postpartumVisitsByDelivery.get(visit.delivery_id) || [];
      visits.push({
        ...visit,
        assigned_staff_name: assignedStaffById[visit.assigned_staff]?.name || null,
        assigned_staff_station: assignedStaffById[visit.assigned_staff]?.station || null,
        personnel_present_name: assignedStaffById[visit.personnel_present]?.name || null,
        performed_by_name: assignedStaffById[visit.performed_by]?.name || null,
        created_by_name: assignedStaffById[visit.created_by]?.name || null,
        assigned_station_name: stationNameById[visit.assigned_station] || null,
        visit_station_name: stationNameById[visit.station_ass] || null,
        station_name: stationNameById[visit.assigned_station || visit.station_ass] || null
      });
      postpartumVisitsByDelivery.set(visit.delivery_id, visits);
    });

    const normalizedDeliveries = (deliveriesData || []).map(d => {
      const attendingProfile = Array.isArray(d.staff_profiles) ? d.staff_profiles[0] : d.staff_profiles;
      const staffLookup = assignedStaffById[d.attending_staff];
      return {
        id: d.id,
        mother_id: d.mother_id,
        pregnancy_id: d.pregnancy_id || null,
        attending_staff: d.attending_staff || null,
        assigned_staff: d.attending_staff || null,
        station_ass: d.station_ass || null,
        station: d.stations?.station_name || 'Unassigned',
        assigned_staff_name: attendingProfile?.full_name || staffLookup?.name || null,
        assigned_staff_station: attendingProfile?.stations?.station_name || staffLookup?.station || null,
        delivery_date: d.delivery_date,
        delivery_time: d.delivery_time,
        delivery_type: d.delivery_type,
        delivery_mode: d.delivery_mode,
        gestational_age: d.gestational_age,
        risk_level: d.risk_level,
        complications: d.complications,
        notes: d.notes,
        facility: d.pregnancy_info?.place_of_delivery || null,
        postpartum_visits: postpartumVisitsByDelivery.get(d.id) || []
      };
    });

    const deliveryDateById = new Map(normalizedDeliveries.map(delivery => [delivery.id, delivery.delivery_date]));
    const normalizedNewborns = (newbornsData || []).map(newborn => ({
      ...newborn,
      birth_date: newborn.birth_date || deliveryDateById.get(newborn.delivery_id) || null,
      condition: newborn.condition_at_birth || newborn.condition || null,
      vaccines: (newborn.vaccinations || []).map(vaccine => ({
        ...vaccine,
        newborn_id: newborn.id,
        vaccine_name: vaccine.vaccine_inventory?.vaccine_name || null,
        vaccine_inventory: vaccine.vaccine_inventory || null,
        status: normalizeVaccinationStatus(vaccine),
        recipient_type: 'Baby',
        recipient_name: newborn.baby_name || 'Newborn',
        administration_station_name: stationNameById[vaccine.station_ass] || null,
        assigned_staff: vaccine.assigned_staff || patientData.retained_staff || null,
        assigned_staff_name: assignedStaffById[vaccine.assigned_staff || patientData.retained_staff]?.name || null,
        assigned_staff_station: assignedStaffById[vaccine.assigned_staff || patientData.retained_staff]?.station || null,
        vaccinated_by_name: assignedStaffById[vaccine.vaccinated_by]?.name || null,
        vaccinated_by_station: assignedStaffById[vaccine.vaccinated_by]?.station || null
      }))
    }));
    const vaccinationRecords = [
      ...(maternalVaccinationsData || []).map(vaccination => ({
        ...vaccination,
        vaccine_name: vaccination.vaccine_inventory?.vaccine_name || null,
        status: normalizeVaccinationStatus(vaccination),
        recipient_type: 'Mother',
        recipient_name: `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() || 'Mother',
        administration_station_name: stationNameById[vaccination.station_ass] || null,
        assigned_staff_name: assignedStaffById[vaccination.assigned_staff]?.name || null,
        vaccinated_by_name: assignedStaffById[vaccination.vaccinated_by]?.name || null
      })),
      ...normalizedNewborns.flatMap(newborn => newborn.vaccines)
    ].sort((left, right) => {
      const leftDate = left.scheduled_vaccination || left.vaccinated_date || '';
      const rightDate = right.scheduled_vaccination || right.vaccinated_date || '';
      return leftDate.localeCompare(rightDate);
    });

    const pregnancyHistory = buildPregnancyHistory(
      pregnancyData || [],
      normalizedVisits,
      normalizedDeliveries,
      normalizedNewborns
    );
    const currentPregnancy = pregnancyHistory.find(pregnancy => pregnancy.isCurrent) || null;
    const currentVisits = (currentPregnancy?.visits && currentPregnancy.visits.length > 0)
      ? currentPregnancy.visits
      : normalizedVisits;

    const patientConditionsSet = new Set();
    const categorizedMap = new Map();
    (currentVisits || []).forEach(v => {
      const rawConds = this.getDocumentedHealthConditions(v.raw_risk_factors || v.risk_factors);
      const calcConds = this.getDocumentedHealthConditions(v.risk_factors);
      [...rawConds, ...calcConds].forEach(c => patientConditionsSet.add(c));

      const list1 = this.getCategorizedHealthConditions(v.raw_risk_factors || v.risk_factors);
      const list2 = this.getCategorizedHealthConditions(v.risk_factors);
      [...list1, ...list2].forEach(item => {
        const key = `${item.category}:::${item.name.toLowerCase()}`;
        if (!categorizedMap.has(key)) categorizedMap.set(key, item);
      });
    });
    const patientDocumentedConditions = Array.from(patientConditionsSet);

    const conditionsByCategory = {
      'Pre-existing Medical Conditions': [],
      'Pregnancy-Related Conditions': [],
      'Relevant Obstetric History': []
    };

    Array.from(categorizedMap.values()).forEach(item => {
      const cat = this.normalizeCategoryName(item.category);
      if (!conditionsByCategory[cat]) {
        conditionsByCategory[cat] = [];
      }
      if (!conditionsByCategory[cat].includes(item.name)) {
        conditionsByCategory[cat].push(item.name);
      }
    });

    const activeCategories = Object.entries(conditionsByCategory)
      .filter(([_, list]) => list.length > 0)
      .map(([category, conditions]) => ({ category, conditions }));

    const patientHasHealthConditions = activeCategories.length > 0 || patientDocumentedConditions.length > 0;

    // preg is already defined earlier
    let rawEmergencyContact = patientData.emergency_contact || {};
    if (typeof rawEmergencyContact === 'string') {
      try {
        rawEmergencyContact = JSON.parse(rawEmergencyContact);
      } catch {
        rawEmergencyContact = {};
      }
    }
    const emergencyContact = {
      name: rawEmergencyContact.name || rawEmergencyContact.full_name || rawEmergencyContact.contact_name || '',
      relationship: rawEmergencyContact.relationship || rawEmergencyContact.relation || '',
      phone: rawEmergencyContact.phone || rawEmergencyContact.contact_no || rawEmergencyContact.contact_number || rawEmergencyContact.phone_number || '',
      address: rawEmergencyContact.address || rawEmergencyContact.house_no || ''
    };

    const archiveStatus = userData?.is_archived ? 'archived' : 'active';

    return {
      ...patientData,
      emergencyContact,
      emergency_contact: rawEmergencyContact,
      isArchived: Boolean(userData?.is_archived),
      isDeactivated: Boolean(userData?.is_deactivated),
      archiveStatus,
      gmail: patientEmail,
      email: patientEmail,
      name: `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim(),
      age: this.calculateAge(patientData.date_of_birth),
      station: patientData.stations?.station_name || 'N/A',
      stationId: patientData.station_ass || null,
      height_cm: riskPatient.height_cm || null,
      phone: patientData.contact_no || 'N/A',
      address: patientData.house_no,
      dob: patientData.date_of_birth,
      civilStatus: patientData.civil_status,
      philhealth: patientData.philhealthnumber,
      bloodType: patientData.blood_type || patientData.bloodtype || 'Unknown',
      medicalConditions: patientDocumentedConditions,
      documentedConditions: patientDocumentedConditions,
      categorizedConditions: Array.from(categorizedMap.values()),
      conditionsByCategory,
      activeCategories,
      hasHealthConditions: patientHasHealthConditions,
      risk: patientHasHealthConditions ? 'With Health Conditions' : 'None Reported',
      riskLevel: patientHasHealthConditions ? 'With Health Conditions' : 'None Reported',
      gravida: preg.gravida || 0,
      para: preg.para || 0,
      miscarriageInfo: preg.miscarriage_info || null,
      pregnancyType: preg.pregnancy_type || 'Singleton',
      plannedDeliveryPlace: preg.place_of_delivery || null,
      lmp: preg.lmd || null,
      edd: preg.edd || null,
      trimester: this.calculateTrimester(preg.lmd),
      weeks: this.calculateWeeks(preg.lmd),

      visits: normalizedVisits,
      vaccines: vaccinationRecords,
      supplements: (supplementsData || []).map(s => ({
        id: s.id,
        supplement_name: s.supplement_inventory?.supplement_name || 'Unknown',
        supplement_inventory: s.supplement_inventory || null,
        dosage: s.dosage,
        start_date: s.start_date,
        end_date: s.end_date,
        created_at: s.created_at,
        status: s.status,
        notes: s.notes,
        administered_by: s.administered_by || s.created_by || null,
        administered_by_name: assignedStaffById[s.administered_by || s.created_by]?.name || null,
        station_ass: s.station_ass || null,
        service_station_name: stationNameById[s.station_ass] || null
      })),
      newborns: normalizedNewborns,
      deliveries: normalizedDeliveries,
      pregnancyHistory,
      currentPregnancy,
      pregnancyRecord: preg,
      pregnancyStatus: getPregnancyStatus(preg)
    };
  }

  async updatePatient(patientId, updateData) {
    try {
      const stationId = updateData.station
        ? await this.getStationIdByName(updateData.station)
        : null;
      if (updateData.station && !stationId) throw new Error('Select a valid station.');

      const { data: currentPatient, error: currentPatientError } = await this.supabase
        .from('patient_basic_info')
        .select('station_ass, first_name, last_name, date_of_birth, civil_status, blood_type, philhealthnumber, contact_no, house_no, municipality, emergency_contact')
        .eq('id', patientId)
        .single();
      if (currentPatientError) throw currentPatientError;

      let currentEmergencyContact = currentPatient.emergency_contact || {};
      if (typeof currentEmergencyContact === 'string') {
        try {
          currentEmergencyContact = JSON.parse(currentEmergencyContact);
        } catch {
          currentEmergencyContact = {};
        }
      }

      const hasEmergencyContactUpdate =
        updateData.emergency_contact_name !== undefined ||
        updateData.emergencyContactName !== undefined ||
        updateData.emergency_contact_relationship !== undefined ||
        updateData.emergencyContactRelationship !== undefined ||
        updateData.emergency_contact_phone !== undefined ||
        updateData.emergencyContactPhone !== undefined ||
        updateData.emergency_contact !== undefined ||
        updateData.emergencyContact !== undefined;

      const rawUpdatedContact = updateData.emergency_contact || updateData.emergencyContact || {};

      const resolveValue = (providedVal, fallbackVal) => {
        if (providedVal !== undefined) {
          return typeof providedVal === 'string' ? (providedVal.trim() || null) : providedVal;
        }
        return fallbackVal ?? null;
      };

      const resolvedEmergencyContact = hasEmergencyContactUpdate ? {
        name: resolveValue(
          updateData.emergency_contact_name ?? updateData.emergencyContactName ?? rawUpdatedContact.name ?? rawUpdatedContact.full_name,
          currentEmergencyContact.name || currentEmergencyContact.full_name
        ),
        relationship: resolveValue(
          updateData.emergency_contact_relationship ?? updateData.emergencyContactRelationship ?? rawUpdatedContact.relationship ?? rawUpdatedContact.relation,
          currentEmergencyContact.relationship || currentEmergencyContact.relation
        ),
        phone: resolveValue(
          updateData.emergency_contact_phone ?? updateData.emergencyContactPhone ?? rawUpdatedContact.phone ?? rawUpdatedContact.contact_no,
          currentEmergencyContact.phone || currentEmergencyContact.contact_no
        ),
        address: resolveValue(
          updateData.emergency_contact_address ?? rawUpdatedContact.address,
          currentEmergencyContact.address
        )
      } : currentEmergencyContact;

      const profilePayload = {
        first_name: updateData.first_name,
        last_name: updateData.last_name,
        date_of_birth: updateData.date_of_birth,
        civil_status: updateData.civil_status,
        blood_type: updateData.blood_type || updateData.bloodtype || null,
        philhealthnumber: updateData.philhealth,
        contact_no: updateData.phone,
        house_no: updateData.address,
        municipality: updateData.municipality,
        emergency_contact: resolvedEmergencyContact
      };

      const isEmergencyContactEqual = (a, b) => {
        const normA = a && typeof a === 'object' ? a : {};
        const normB = b && typeof b === 'object' ? b : {};
        return (normA.name || null) === (normB.name || null) &&
               (normA.relationship || null) === (normB.relationship || null) &&
               (normA.phone || null) === (normB.phone || null) &&
               (normA.address || null) === (normB.address || null);
      };

      const profileChanged = Object.entries(profilePayload).some(([key, value]) => {
        if (key === 'emergency_contact') {
          return !isEmergencyContactEqual(currentEmergencyContact, value);
        }
        return JSON.stringify(currentPatient[key] ?? null) !== JSON.stringify(value ?? null);
      });
      const stationChanged = stationId && stationId !== currentPatient.station_ass;
      let data = currentPatient;
      let profileUpdateSkipped = false;

      if (profileChanged) {
        const { data: updatedPatient, error } = await this.supabase
          .from('patient_basic_info')
          .update(profilePayload)
          .eq('id', patientId)
          .select()
          .single();

        if (error) {
          if (!stationChanged) throw error;
          profileUpdateSkipped = true;
        } else {
          data = updatedPatient;
        }
      }

      if (stationChanged) {
        const { error: stationError } = await this.supabase.rpc('set_patient_station', {
          p_patient_id: patientId,
          p_station_id: stationId
        });
        if (stationError) throw stationError;
      }

      const finalEmergencyContact = {
        name: resolvedEmergencyContact.name || '',
        relationship: resolvedEmergencyContact.relationship || '',
        phone: resolvedEmergencyContact.phone || '',
        address: resolvedEmergencyContact.address || null
      };

      return {
        ...data,
        emergencyContact: finalEmergencyContact,
        emergency_contact: resolvedEmergencyContact,
        station_ass: stationId || currentPatient.station_ass,
        profileUpdateSkipped
      };
    } catch (error) {
      console.error('Error updating patient:', error);
      throw error;
    }
  }

  async addExistingPregnancy(patientId, patientData, createdBy = null) {
    try {
      const resolvedCreatedBy = createdBy || (await this.getCurrentUserId());
      const currentUser = await authService.getAuthUser();
      const currentUserRole = String(currentUser?.role || '').toLowerCase().replace(/_/g, ' ').trim();
      const { data: patientProfile, error: patientProfileError } = await this.supabase
        .from('patient_basic_info')
        .select('station_ass')
        .eq('id', patientId)
        .maybeSingle();

      if (patientProfileError) throw patientProfileError;

      const { stationId: currentStationId } = await this.getCurrentUserAccess();
      const canAssignAtPatientStation = currentUserRole === 'admin'
        || currentStationId === patientProfile?.station_ass;
      const assignedStaff = canAssignAtPatientStation
        ? await this.resolveAssignedStaff({
            requestedStaffId: patientData.retained_staff,
            currentUserId: resolvedCreatedBy,
            role: currentUserRole,
            stationId: currentStationId || patientProfile?.station_ass || null
          })
        : null;

      const { data: latestPregnancy, error: latestErr } = await this.supabase
        .from('pregnancy_info')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr) throw latestErr;

      const parsedGravida = parseInt(patientData.gravida, 10);
      const parsedPara = parseInt(patientData.para, 10);

      const nextGravida = Number.isFinite(parsedGravida)
        ? parsedGravida
        : (latestPregnancy?.gravida ? Number(latestPregnancy.gravida) + 1 : 1);

      const nextPara = Number.isFinite(parsedPara)
        ? parsedPara
        : (latestPregnancy?.para ? Number(latestPregnancy.para) : 0);

      const { data: pregnancyRow, error: pregnancyError } = await this.supabase
        .from('pregnancy_info')
        .insert({
          patient_id: patientId,
          created_by: resolvedCreatedBy,
          pregn_postp: 'Pregnant',
          lmd: patientData.lmp || null,
          edd: patientData.edd || null,
          pregnancy_type: patientData.pregnancyType || 'Singleton',
          place_of_delivery: patientData.plannedDeliveryPlace || null,
          gravida: nextGravida,
          para: nextPara
        })
        .select()
        .single();

      if (pregnancyError) throw pregnancyError;

      const today = new Date().toISOString().split('T')[0];
      const schedulePreview = Array.isArray(patientData.schedulePreview)
        ? patientData.schedulePreview
            .filter(v => v && v.date && !Number.isNaN(new Date(v.date).getTime()))
            .map(v => ({ ...v, date: new Date(v.date).toISOString().split('T')[0] }))
        : [];

      const actualVisitDate = today;
      const bpMatch = patientData.bp ? patientData.bp.match(/^(\d+)[/\s](\d+)$/) : null;
      const weeksAtVisit = patientData.lmp ? this.calculateWeeks(patientData.lmp) : 0;
      const gaString = weeksAtVisit > 0 ? `${weeksAtVisit} weeks` : '1st visit';
      const visitNumberAtVisit = 1;

      const firstVisitRecord = {
        patient_id: patientId,
        visit_date: actualVisitDate,
        visit_number: visitNumberAtVisit,
        trimester: patientData.lmp ? this.calculateTrimester(patientData.lmp) : 1,
        gestational_age: gaString,
        bp_systolic: bpMatch ? parseInt(bpMatch[1], 10) : null,
        bp_diastolic: bpMatch ? parseInt(bpMatch[2], 10) : null,
        weight_kg: patientData.weight ? parseFloat(patientData.weight) : null,
        height_cm: patientData.height ? parseFloat(patientData.height) : null,
        temp_c: patientData.temp ? parseFloat(patientData.temp) : null,
        pulse_bpm: patientData.pulse ? parseInt(patientData.pulse, 10) : null,
        resp_rate_cpm: patientData.respRate ? parseInt(patientData.respRate, 10) : null,
        fundal_height_cm: patientData.fundalHeight ? parseFloat(patientData.fundalHeight) : null,
        fhr_bpm: patientData.fhr ? parseInt(patientData.fhr, 10) : null,
        fetal_movement: patientData.fetalMovement || null,
        presentation: patientData.presentation || null,
        tests_done: patientData.testsDone ? patientData.testsDone.split(',').map(s => s.trim()).filter(Boolean) : null,
        clinical_notes: patientData.visitNotes || 'Initial re-pregnancy assessment visit',
        next_appt_date: schedulePreview.find(visit => visit.date > actualVisitDate)?.date || null,
        next_appt_type: 'Follow-up Checkup',
        status: 'Attended',
        attended_date: new Date().toISOString(),
        assigned_staff: assignedStaff,
        assigned_station: patientProfile?.station_ass || null,
        station_ass: currentStationId || null,
        performed_by: resolvedCreatedBy,
        calculated_risk: patientData.riskLevel || 'Normal',
        risk_factors: patientData.riskFactors || null,
        created_by: resolvedCreatedBy
      };

      const { error: firstVisitError } = await this.supabase.from('prenatal_visits').insert(firstVisitRecord);
      if (firstVisitError) throw firstVisitError;

      const futureSchedule = this.filterScheduleAfterToday(schedulePreview);
      if (futureSchedule.length > 0) {
        await this.insertPrenatalSchedule(
          patientId,
          futureSchedule,
          resolvedCreatedBy,
          { retained_staff: assignedStaff },
          35
        );
      } else {
        await this.resequencePrenatalVisitNumbers(patientId);
      }

      try {
        await this.sendMotherEmail('new_pregnancy', patientId);
      } catch (emailError) {
        console.error('Warning: pregnancy was created but notification email could not be sent:', emailError);
      }

      return await this.getPatientById(patientId);
    } catch (error) {
      console.error('Error creating new pregnancy for existing patient:', error);
      throw error;
    }
  }

  async updatePregnancyStatus(patientId, status) {
    try {
      const { error } = await this.supabase
        .from('pregnancy_info')
        .update({ pregn_postp: status })
        .eq('patient_id', patientId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating pregnancy status:', error);
      throw error;
    }
  }

  async getAvailableStations() {
    const { data } = await this.supabase
      .from('stations')
      .select('station_name')
      .order('station_name', { ascending: true });

    return [...new Set(data?.map(s => s.station_name) || [])];
  }

  async completePrenatalVisit(visitId, payload, actualStationId = null) {
    const { data, error } = await this.supabase.rpc('complete_prenatal_visit', {
      p_visit_id: visitId,
      p_payload: payload,
      p_actual_station: actualStationId
    });
    if (error) throw error;
    if (data?.patient_id) {
      await this.resequencePrenatalVisitNumbers(data.patient_id);
    }
    return data;
  }

  async reassignPrenatalVisit(visitId, assignedStaffId) {
    let assignedStationId = null;
    if (assignedStaffId) {
      const { data: profile, error: profileError } = await this.supabase
        .from('staff_profiles')
        .select('station_ass')
        .eq('id', assignedStaffId)
        .single();
      if (profileError) throw profileError;
      assignedStationId = profile.station_ass;
    }

    const { data, error } = await this.supabase.rpc('assign_prenatal_visit', {
      p_visit_id: visitId,
      p_assigned_staff: assignedStaffId || null,
      p_assigned_station: assignedStationId
    });
    if (error) throw error;
    return data;
  }

  async getAssignableStaffByStationId(stationId) {
    if (!stationId) return [];
    const { data, error } = await this.supabase.rpc('get_assignable_staff', {
      p_station_id: stationId
    });
    if (error) throw error;
    return data || [];
  }

  async assignPatientPrenatalStaff(patientId, assignedStaffId) {
    const { data, error } = await this.supabase.rpc('assign_patient_prenatal_staff', {
      p_patient_id: patientId,
      p_assigned_staff: assignedStaffId
    });
    if (error) throw error;
    return data;
  }

  normalizeStationName(stationName) {
    return String(stationName || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '');
  }

  async getAllStations() {
    try {
      const { data, error } = await this.supabase
        .from('stations')
        .select('station_name')
        .order('station_name', { ascending: true });

      if (error) throw error;

      const stations = [...new Set(
        (data || [])
          .map(s => s.station_name)
          .filter(Boolean)
      )];

      return stations;
    } catch (error) {
      console.error('Error in getAllStations:', error);
      return [];
    }
  }

  async getStationIdByName(stationName) {
    const normalized = String(stationName || '').trim();
    if (!normalized) return null;

    const { data, error } = await this.supabase
      .from('stations')
      .select('id, station_name');

    if (error) throw error;

    const target = this.normalizeStationName(normalized);
    const matchedStation = (data || []).find((station) => {
      return this.normalizeStationName(station.station_name) === target;
    });

    return matchedStation?.id || null;
  }

  async getStaffByStation(station) {
    const normalized = station?.trim() || '';
    if (!normalized) return [];

    try {
      const stationId = await this.getStationIdByName(normalized);
      if (!stationId) return [];
      const { data, error } = await this.supabase.rpc('get_assignable_staff', {
        p_station_id: stationId
      });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting staff by station:', error);
      return [];
    }
  }

  async getDoctorsByStation(station) {
    return this.getStaffByStation(station);
  }

  async getRetainedStaff(station) {
    return this.getStaffByStation(station);
  }

  /**
   * BRIDGE METHODS FOR INVENTORY & STATS
   */
  async getVaccineInventory() {
    // Bridges to new InventoryService but returns mapped format expected by Dashboard/Vaccinations
    const data = await inventoryService.getVaccineInventory();
    return data.map(item => {
      // Calculate expiration status
      let expiryStatus = 'good';
      let daysUntilExpiry = null;
      if (item.expiration_date) {
        const today = new Date();
        const expiryDate = new Date(item.expiration_date);
        daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 0) {
          expiryStatus = 'expired';
        } else if (daysUntilExpiry <= 30) {
          expiryStatus = 'expiring-soon';
        } else if (daysUntilExpiry <= 90) {
          expiryStatus = 'expiring';
        }
      }
      
      // Combined status: match Inventory Management thresholds
      const percentage = (item.max_stock || item.min_stock * 5) ? Math.round((item.quantity / (item.max_stock || item.min_stock * 5)) * 100) : 0;
      let combinedStatus = 'ok';
      if (isBatchExpired(item.expiration_date)) {
        combinedStatus = 'expired';
      } else if (item.quantity <= 0) {
        combinedStatus = 'out';
      } else if (percentage <= 20) {
        combinedStatus = 'low';
      } else if (percentage <= 50) {
        combinedStatus = 'medium';
      }
      
      return {
        name: item.item_name,
        stock: item.quantity,
        unit: item.unit,
        min: item.min_stock || Math.floor(item.max_stock * 0.2),
        status: combinedStatus,
        expiration_date: item.expiration_date,
        days_until_expiry: daysUntilExpiry,
        expiry_status: expiryStatus,
        brand: item.brand,
        batch: item.batch
      };
    });
  }

  async getSupplementInventory() {
    const data = await inventoryService.getSupplementInventory();
    return data.map(item => {
      // Calculate expiration status
      let expiryStatus = 'good';
      let daysUntilExpiry = null;
      if (item.expiration_date) {
        const today = new Date();
        const expiryDate = new Date(item.expiration_date);
        daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 0) {
          expiryStatus = 'expired';
        } else if (daysUntilExpiry <= 30) {
          expiryStatus = 'expiring-soon';
        } else if (daysUntilExpiry <= 90) {
          expiryStatus = 'expiring';
        }
      }
      
      // Combined status: match Inventory Management thresholds
      const percentage = item.max_stock ? Math.round((item.quantity / item.max_stock) * 100) : 0;
      let combinedStatus = 'ok';
      if (isBatchExpired(item.expiration_date)) {
        combinedStatus = 'expired';
      } else if (item.quantity <= 0) {
        combinedStatus = 'out';
      } else if (percentage <= 20) {
        combinedStatus = 'low';
      } else if (percentage <= 50) {
        combinedStatus = 'medium';
      }
      
      return {
        id: item.id,
        name: item.item_name,
        stock: item.quantity,
      unit: item.unit || 'units',
      status: combinedStatus,
      expiration_date: item.expiration_date,
      days_until_expiry: daysUntilExpiry,
      expiry_status: expiryStatus,
      brand: item.brand,
      batch_number: item.batch_number,
      max_stock: item.max_stock
      };
    });
  }

  async getVaccinationRecords() {
    try {
      const { data, error } = await this.supabase
        .from('vaccinations')
        .select(`
          id,
          patient_id,
          vaccine_inventory_id,
          dose_number,
          scheduled_vaccination,
          vaccinated_date,
          status,
          created_by,
          notes,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching vaccination records:', err);
      return [];
    }
  }

  async getSupplementRecords() {
    try {
      const { data, error } = await this.supabase
        .from('supplements')
        .select(`
          id,
          patient_id,
          supplement_inventory_id,
          dosage,
          start_date,
          end_date,
          status,
          created_by,
          administered_by,
          station_ass,
          notes,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching supplement records:', err);
      return [];
    }
  }

  async addVaccinationRecord(record) {
    try {
      const { data, error } = await this.supabase
        .from('vaccinations')
        .insert([record])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (err) {
      console.error('Error adding vaccination record:', err);
      throw err;
    }
  }

  async addSupplementRecord(record) {
    try {
      const { data, error } = await this.supabase
        .from('supplements')
        .insert([record])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (err) {
      console.error('Error adding supplement record:', err);
      throw err;
    }
  }

  async getVaccinationStats() {
    try {
      // Get all vaccination records
      const { data: vaccRecords, error: vaccError } = await this.supabase
        .from('vaccinations')
        .select('newborn_id, status, vaccinated_date')
        .not('newborn_id', 'is', null);
      
      if (vaccError) throw vaccError;
      
      // Get all supplement records
      const { data: suppRecords, error: suppError } = await this.supabase
        .from('supplements')
        .select('patient_id, status, start_date');
      
      if (suppError) throw suppError;
      
      // Calculate statistics
      const totalAdministered = (vaccRecords || []).filter(r => r.status === 'Completed').length;
      const newbornsPending = (vaccRecords || []).filter(r => r.status === 'Pending' || r.status === 'Overdue').length;
      
      const supplementsDistributed = (suppRecords || []).filter(r => r.status === 'Ongoing').length;
      
      // Count low stock items from both tables
      const [vax, supp] = await Promise.all([
        inventoryService.getVaccineInventory(),
        inventoryService.getSupplementInventory()
      ]);
      
      const lowStock = [...vax, ...supp].filter(i => i.quantity < i.min_stock).length;
      
      return {
        totalAdministered,
        newbornsPending,
        supplementsDistributed,
        lowStockAlerts: lowStock
      };
    } catch (err) {
      console.error('Error fetching vaccination stats:', err);
      return {
        totalAdministered: 0,
        newbornsPending: 0,
        supplementsDistributed: 0,
        lowStockAlerts: 0
      };
    }
  }

  async recordVitals(patientId, vitals, supplements = []) {
    const createdBy = await this.getCurrentUserId();
    if (!createdBy) throw new Error('No logged-in user');
    const [patientContext, access] = await Promise.all([
      this.getPatientById(patientId),
      this.getCurrentUserAccess()
    ]);
    if (!patientContext) throw new Error('Patient not found');
    const latestRecordedHeight = [...(patientContext.visits || [])]
      .sort((left, right) => new Date(right.visit_date) - new Date(left.visit_date))
      .find(visit => Number(visit.height_cm) > 0)?.height_cm;
    const assignedStaff = (patientContext.visits || [])
      .find(visit => visit.status === 'Scheduled' && visit.assigned_staff)?.assigned_staff
      || (patientContext.visits || []).find(visit => visit.assigned_staff)?.assigned_staff
      || null;
    const serviceStation = access.stationId || vitals.station_ass || patientContext.station_ass;
    if (!serviceStation) throw new Error('Select a valid service station.');

    console.log('Recording vitals for patient', patientId, 'vitals:', vitals, 'supplements:', supplements);

    // Check if visit exists for this date
    const { data: existingVisit, error: existingVisitError } = await this.supabase
      .from('prenatal_visits')
      .select('id, status, visit_number')
      .eq('patient_id', patientId)
      .eq('visit_date', vitals.date)
      .maybeSingle();
    if (existingVisitError) throw existingVisitError;

    const visitData = {
      patient_id: patientId,
      created_by: createdBy,
      visit_date: vitals.date,
      bp_systolic: vitals.bpSystolic ? parseInt(vitals.bpSystolic) : null,
      bp_diastolic: vitals.bpDiastolic ? parseInt(vitals.bpDiastolic) : null,
      weight_kg: vitals.weight ? parseFloat(vitals.weight) : null,
      temp_c: vitals.temp ? parseFloat(vitals.temp) : null,
      pulse_bpm: vitals.pulse ? parseInt(vitals.pulse) : null,
      resp_rate_cpm: vitals.respRate ? parseInt(vitals.respRate) : null,
      fundal_height_cm: vitals.fundalHeight ? parseFloat(vitals.fundalHeight) : null,
      fhr_bpm: vitals.fhr ? parseInt(vitals.fhr) : null,
      fetal_movement: vitals.fetalMovement || null,
      presentation: vitals.presentation || null,
      clinical_notes: vitals.notes || null,
      height_cm: vitals.height ? parseFloat(vitals.height) : latestRecordedHeight || null,
      attended_date: new Date().toISOString(),
      status: 'Attended',
    };
    const riskAssessment = this.getPregnancyRisk(
      { ...patientContext, height_cm: visitData.height_cm || patientContext.height_cm || latestRecordedHeight },
      patientContext.currentPregnancy || patientContext.pregnancyRecord || {},
      {
        ...visitData,
        risk_factors: vitals.riskFactors || patientContext.medicalConditions?.join(', ') || null,
      }
    );
    visitData.calculated_risk = riskAssessment.riskLevel;
    visitData.risk_factors = riskAssessment.riskFactors.join(', ') || null;

    if (existingVisit && existingVisit.status === 'Scheduled') {
      await this.completePrenatalVisit(existingVisit.id, visitData);
    } else {
      const assignedStation = patientContext.stationId;
      const actualStation = serviceStation;
      const { count: visitCount } = await this.supabase
        .from('prenatal_visits')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patientId);
      const { error: visitError } = await this.supabase.from('prenatal_visits').insert({
        ...visitData,
        visit_number: (visitCount || 0) + 1,
        assigned_staff: assignedStaff,
        assigned_station: assignedStation,
        station_ass: actualStation,
        performed_by: createdBy
      });
      if (visitError) throw visitError;
      await this.resequencePrenatalVisitNumbers(patientId);
    }

    // Handle supplements
    let supplementStockById = null;
    for (const sup of (supplements || [])) {
      const amount = parseInt(sup.amount);
      if (amount <= 0) continue;

      if (!supplementStockById) {
        const inventory = await inventoryService.getSupplementInventory();
        supplementStockById = new Map(inventory.map(item => [item.id, item.quantity]));
      }

      const currentStock = supplementStockById.get(sup.id) || 0;
      if (currentStock < amount) throw new Error(`Insufficient stock for supplement`);

      // Insert supplement record
      const supData = {
        patient_id: patientId,
        supplement_inventory_id: sup.id,
        dosage: `${amount} ${sup.unit || 'units'}`,
        start_date: vitals.date,
        status: 'Completed',
        created_by: createdBy,
        administered_by: createdBy,
        station_ass: serviceStation,
      };

      const { error: supError } = await this.supabase.from('supplements').insert(supData);
      if (supError) throw supError;

      await inventoryService.updateInventoryQuantity('supplement_inventory', sup.id, currentStock - amount);
      supplementStockById.set(sup.id, currentStock - amount);
    }
  }

  async getStationPregnancyAgeReport() {
    try {
      const { role, stationId } = await this.getCurrentUserAccess();
      const isStationRestricted = role === 'staff';
      if (isStationRestricted && !stationId) return [];

      let patientsQuery = this.supabase
        .from('patient_basic_info')
        .select('id, first_name, last_name, date_of_birth, station_ass, municipality, stations:station_ass (station_name)');
      if (isStationRestricted) patientsQuery = patientsQuery.eq('station_ass', stationId);

      const { data: patients, error: patientsError } = await patientsQuery;
      if (patientsError) throw patientsError;
      const patientIds = (patients || []).map(patient => patient.id).filter(Boolean);
      if (patientIds.length === 0) return [];

      let deliveriesQuery = this.supabase
        .from('deliveries')
        .select('id, mother_id, station_ass, stations:station_ass (station_name), delivery_date, delivery_type, delivery_mode');
      if (isStationRestricted) deliveriesQuery = deliveriesQuery.in('mother_id', patientIds);
      let pregnanciesQuery = this.supabase
        .from('pregnancy_info')
        .select('id, patient_id, pregn_postp, miscarriage_info, created_at')
        .order('created_at', { ascending: false });
      if (isStationRestricted) pregnanciesQuery = pregnanciesQuery.in('patient_id', patientIds);
      let newbornsQuery = this.supabase
        .from('newborns')
        .select('id, mother_id, delivery_id, condition_at_birth');
      if (isStationRestricted) newbornsQuery = newbornsQuery.in('mother_id', patientIds);

      const [pregnancyResult, deliveryResult, newbornResult] = await Promise.all([
        pregnanciesQuery,
        deliveriesQuery,
        newbornsQuery
      ]);

      if (pregnancyResult.error) throw pregnancyResult.error;
      if (deliveryResult.error) throw deliveryResult.error;
      if (newbornResult.error) throw newbornResult.error;
      const pregnancies = pregnancyResult.data;
      const deliveries = deliveryResult.data;
      const newborns = newbornResult.data;

      const patientMap = new Map((patients || []).map(patient => [patient.id, patient]));
      const latestPregnancyMap = new Map();
      (pregnancies || []).forEach(pregnancy => {
        if (!pregnancy.patient_id || latestPregnancyMap.has(pregnancy.patient_id)) return;
        latestPregnancyMap.set(pregnancy.patient_id, pregnancy);
      });

      const calculateAgeAt = (dateOfBirth, eventDate) => {
        if (!dateOfBirth || !eventDate) return null;
        const birthDate = new Date(dateOfBirth);
        const date = new Date(eventDate);
        if (Number.isNaN(birthDate.getTime()) || Number.isNaN(date.getTime())) return null;
        let age = date.getFullYear() - birthDate.getFullYear();
        const birthdayPassed = date.getMonth() > birthDate.getMonth()
          || (date.getMonth() === birthDate.getMonth() && date.getDate() >= birthDate.getDate());
        if (!birthdayPassed) age -= 1;
        return age >= 0 ? age : null;
      };

      const getStation = patient => patient?.stations?.station_name || patient?.municipality || 'Unknown';
      const getRecord = ({ patientId, eventDate, deliveryType, outcome, source, id, stationName = null }) => {
        const patient = patientMap.get(patientId);
        if (!patient || !eventDate) return null;
        return {
          id,
          patientId,
          patientName: `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient',
          station: stationName || getStation(patient),
          age: calculateAgeAt(patient.date_of_birth, eventDate),
          eventDate,
          deliveryType: deliveryType || 'N/A',
          outcome,
          source
        };
      };

      const newbornsByDelivery = new Map();
      (newborns || []).forEach(newborn => {
        if (newborn.delivery_id) newbornsByDelivery.set(newborn.delivery_id, newborn);
      });

      const deliveryRecords = (deliveries || []).map(delivery => {
        const newborn = newbornsByDelivery.get(delivery.id);
        const type = delivery.delivery_type || delivery.delivery_mode || 'N/A';
        const normalizedType = type.toLowerCase();
        const outcome = normalizedType.includes('not applicable') || normalizedType === 'n/a'
          ? 'Unsuccessful'
          : newborn?.condition_at_birth?.toLowerCase() === 'stillbirth' ? 'Unsuccessful' : 'Successful';
        return getRecord({
          patientId: delivery.mother_id,
          eventDate: delivery.delivery_date,
          deliveryType: type,
          outcome,
          source: 'Delivery',
          id: `delivery-${delivery.id}`,
          stationName: delivery.stations?.station_name || 'Unassigned'
        });
      }).filter(Boolean);

      const miscarriageRecords = (pregnancies || [])
        .filter(pregnancy => pregnancy.miscarriage_info)
        .map(pregnancy => {
          const info = typeof pregnancy.miscarriage_info === 'string'
            ? (() => { try { return JSON.parse(pregnancy.miscarriage_info); } catch { return {}; } })()
            : pregnancy.miscarriage_info;
          return getRecord({
            patientId: pregnancy.patient_id,
            eventDate: info?.date || pregnancy.created_at,
            deliveryType: 'N/A',
            outcome: 'Unsuccessful',
            source: 'Pregnancy Outcome',
            id: `pregnancy-${pregnancy.id}`
          });
        }).filter(Boolean);

      const activePregnancyRecords = Array.from(latestPregnancyMap.values())
        .filter(pregnancy => String(pregnancy.pregn_postp || '').toLowerCase() === 'pregnant')
        .map(pregnancy => getRecord({
          patientId: pregnancy.patient_id,
          eventDate: pregnancy.created_at,
          deliveryType: 'N/A',
          outcome: 'Pending',
          source: 'Current Pregnancy',
          id: `current-${pregnancy.id}`
        })).filter(Boolean);

      return [...deliveryRecords, ...miscarriageRecords, ...activePregnancyRecords]
        .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
    } catch (error) {
      console.error('Error fetching station pregnancy age report:', error);
      throw error;
    }
  }

  getConditionName(item) {
    if (!item) return '';
    if (typeof item === 'object') return item.name || '';
    const str = String(item).trim();
    const match = str.match(/^(.*?)\s*\[(?:category:\s*)?([^\]]+)\]$/i);
    return match ? match[1].trim() : str;
  }

  getConditionCategory(item) {
    const parsed = this.parseCategorizedCondition(item);
    return parsed ? parsed.category : null;
  }

  normalizeCategoryName(catRaw) {
    if (!catRaw) return 'Pre-existing Medical Conditions';
    const catLower = String(catRaw).trim().toLowerCase();
    if (catLower.includes('pre-existing') || catLower.includes('preexisting')) {
      return 'Pre-existing Medical Conditions';
    } else if (catLower.includes('pregnancy-related') || catLower.includes('pregnancy related')) {
      return 'Pregnancy-Related Conditions';
    } else if (catLower.includes('obstetric') || catLower.includes('history')) {
      return 'Relevant Obstetric History';
    }
    return String(catRaw).trim();
  }

  parseCategorizedCondition(conditionInput) {
    if (!conditionInput) return null;
    if (typeof conditionInput === 'object') {
      return {
        name: conditionInput.name || '',
        category: this.normalizeCategoryName(conditionInput.category || 'Pre-existing Medical Conditions')
      };
    }
    const str = String(conditionInput).trim();
    if (!str || ['none', 'none reported', 'no documented conditions'].includes(str.toLowerCase())) return null;

    // Check bracket at end: "Asthma [Pre-existing Medical Conditions]"
    const bracketMatch = str.match(/^(.*?)\s*\[(?:category:\s*)?([^\]]+)\]$/i);
    if (bracketMatch) {
      const name = bracketMatch[1].trim();
      const catRaw = bracketMatch[2].trim();
      return { name, category: this.normalizeCategoryName(catRaw) };
    }

    // Check bracket at start: "[Pre-existing Medical Conditions] Asthma"
    const startBracketMatch = str.match(/^\[(?:category:\s*)?([^\]]+)\]\s*(.*)$/i);
    if (startBracketMatch) {
      const catRaw = startBracketMatch[1].trim();
      const name = startBracketMatch[2].trim();
      return { name, category: this.normalizeCategoryName(catRaw) };
    }

    // Check colon prefix: "Pre-existing Medical Conditions: Asthma"
    const colonMatch = str.match(/^(Pre-existing Medical Conditions|Pregnancy-Related Conditions|Relevant Obstetric History|Pre-existing|Pregnancy-Related|Relevant Obstetric):\s*(.*)$/i);
    if (colonMatch) {
      const catRaw = colonMatch[1].trim();
      const name = colonMatch[2].trim();
      return { name, category: this.normalizeCategoryName(catRaw) };
    }

    // Exclude non-condition patterns (vitals, demographics, pregnancy type)
    const nonConditionPatterns = [
      /^age\b/i,
      /^teenage/i,
      /^advanced maternal age/i,
      /^singleton/i,
      /^twins/i,
      /^multiple/i,
      /^(undetermined|not yet determined|unknown)(\s+pregnancy(\s+type)?)?$/i,
      /^pregnancy\s+type\b/i,
      /bmi$/i,
      /^(high|low|normal|elevated)\s+bp$/i,
      /^hypertension\s*\((high|low)\)$/i,
      /^hypotension/i,
      /^fever$/i,
      /^hypothermia$/i,
      /^abnormal (pulse|respiratory rate|fetal heart rate)$/i,
      /^(high|medium|low|normal)\s+risk$/i,
      /^risk\s+(level|classification|category)\b/i,
      /^gravida\b/i,
      /^para\b/i,
      /^none$/i,
      /^none reported$/i
    ];
    if (nonConditionPatterns.some(pattern => pattern.test(str))) {
      return null;
    }

    const obstetricHistory = [
      'previous c-section', 'previous c section', 'c-section', 'cesarean',
      'previous preterm birth', 'preterm birth', 'preterm delivery',
      'previous stillbirth', 'stillbirth',
      'previous miscarriage', 'miscarriage', 'recurrent miscarriage',
      'previous ectopic', 'ectopic pregnancy',
      'other relevant obstetric history', 'obstetric history'
    ];
    const pregnancyRelated = [
      'gestational hypertension', 'gestational diabetes', 'preeclampsia', 'pre-eclampsia',
      'eclampsia', 'anemia during pregnancy', 'anemia', 'anaemia', 'maternal anemia',
      'hyperemesis', 'placenta previa', 'placental abruption', 'oligohydramnios',
      'polyhydramnios', 'iugr', 'other pregnancy-related condition'
    ];
    const preExisting = [
      'chronic hypertension', 'pre-existing diabetes', 'diabetes', 'type 1 diabetes', 'type 2 diabetes',
      'heart disease', 'cardiac disease', 'asthma', 'thyroid', 'hypothyroidism', 'hyperthyroidism',
      'epilepsy', 'renal disease', 'kidney disease', 'autoimmune', 'lupus',
      'other pre-existing condition'
    ];

    const lower = str.toLowerCase();
    if (obstetricHistory.some(o => lower.includes(o))) return { name: str, category: 'Relevant Obstetric History' };
    if (pregnancyRelated.some(p => lower.includes(p))) return { name: str, category: 'Pregnancy-Related Conditions' };
    if (preExisting.some(pe => lower.includes(pe))) return { name: str, category: 'Pre-existing Medical Conditions' };
    return null;
  }

  getCategorizedHealthConditions(riskFactorsInput) {
    const rawFactors = this.getRiskFactors(riskFactorsInput);
    const parsedList = [];
    const seen = new Set();

    for (const factor of rawFactors) {
      const parsed = this.parseCategorizedCondition(factor);
      if (parsed && parsed.name && !seen.has(parsed.name.toLowerCase())) {
        seen.add(parsed.name.toLowerCase());
        parsedList.push(parsed);
      }
    }
    return parsedList;
  }

  getRiskFactors(riskFactorsInput) {
    if (!riskFactorsInput) return [];
    let factorList = [];
    if (Array.isArray(riskFactorsInput)) {
      factorList = riskFactorsInput;
    } else {
      const str = String(riskFactorsInput).trim();
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) factorList = parsed;
        else factorList = str.split(',');
      } catch {
        factorList = str.split(',');
      }
    }

    return factorList
      .map(item => (typeof item === 'object' && item !== null ? item.name : String(item || '').trim()))
      .filter(trimmed => trimmed && !['none', 'none reported'].includes(trimmed.toLowerCase()));
  }

  getDocumentedHealthConditions(riskFactorsInput) {
    if (!riskFactorsInput) return [];

    return this.getRiskFactors(riskFactorsInput)
      .filter(trimmed => {
        if (!trimmed) return false;
        const lower = trimmed.toLowerCase();

        // 1. Exclude "None", "None Reported", null/empty placeholders, and legacy risk labels
        if (
          lower === 'none' ||
          lower === 'none reported' ||
          lower === 'no documented conditions' ||
          lower === 'no conditions documented' ||
          lower === 'no conditions' ||
          lower === 'none recorded' ||
          lower === 'n/a' ||
          lower === 'normal' ||
          lower === 'healthy' ||
          lower === 'null' ||
          lower === 'undefined' ||
          lower === 'high risk' ||
          lower === 'medium risk' ||
          lower === 'low risk' ||
          lower === 'normal risk' ||
          lower === 'at risk' ||
          lower === 'risk'
        ) {
          return false;
        }

        // 2. Obstetric History alone must NOT count as an active health condition
        if (lower.includes('[relevant obstetric history]') || lower.includes('[category: relevant obstetric history]')) {
          return false;
        }

        // 2. Obstetric History alone must NOT count as an active health condition
        const obstetricPatterns = [
          /^previous c-section/i,
          /^previous c section/i,
          /^c-section/i,
          /^cesarean/i,
          /^previous preterm birth/i,
          /^preterm birth/i,
          /^previous stillbirth/i,
          /^stillbirth/i,
          /^previous miscarriage/i,
          /^miscarriage/i,
          /^other relevant obstetric history/i,
          /^obstetric history/i,
          /^gravida\b/i,
          /^para\b/i,
          /^g\d+\s*p\d+/i,
        ];
        if (obstetricPatterns.some(pattern => pattern.test(trimmed))) {
          return false;
        }

        // 3. Demographics, pregnancy type, vital sign measurements alone (do not count as documented medical conditions)
        const nonConditionPatterns = [
          /^age\b/i,
          /^teenage/i,
          /^advanced maternal age/i,
          /^singleton/i,
          /^twins/i,
          /^multiple/i,
          /^(undetermined|not yet determined|unknown)(\s+pregnancy(\s+type)?)?$/i,
          /^pregnancy\s+type\b/i,
          /bmi$/i,
          /^(high|low|normal|elevated)\s+bp$/i,
          /^hypertension\s*\((high|low)\)$/i,
          /^hypotension/i,
          /^fever$/i,
          /^hypothermia$/i,
          /^abnormal (pulse|respiratory rate|fetal heart rate)$/i,
          /^(high|medium|low|normal)\s+risk$/i,
          /^risk\s+(level|classification|category)\b/i,
        ];
        if (nonConditionPatterns.some(pattern => pattern.test(trimmed))) {
          return false;
        }

        return true;
      });
  }

  hasDocumentedHealthConditions(riskFactorsInput) {
    return this.getDocumentedHealthConditions(riskFactorsInput).length > 0;
  }

  async getStationReports(dateRange = 'quarterly') {
    try {
      const { role, stationId } = await this.getCurrentUserAccess();
      const isStationRestricted = role === 'staff';
      if (isStationRestricted && !stationId) return [];
      const reportBounds = getReportDateBounds(dateRange);
      const withinReportPeriod = (query, column) => reportBounds
        ? query.gte(column, reportBounds.startDate).lt(column, reportBounds.endDateExclusive)
        : query;
      const postpartumReportBounds = reportBounds && (() => {
        const end = new Date(`${reportBounds.endDateExclusive}T00:00:00`);
        end.setDate(end.getDate() + 42);
        return {
          ...reportBounds,
          endDateExclusive: [
            end.getFullYear(),
            String(end.getMonth() + 1).padStart(2, '0'),
            String(end.getDate()).padStart(2, '0')
          ].join('-')
        };
      })();
      const withinPostpartumReportPeriod = query => postpartumReportBounds
        ? query.gte('scheduled_date', postpartumReportBounds.startDate).lt('scheduled_date', postpartumReportBounds.endDateExclusive)
        : query;
      const vaccinationsWithinReportPeriod = query => {
        if (!reportBounds) return query;
        const { startDate, endDateExclusive } = reportBounds;
        return query.or([
          `and(vaccinated_date.gte.${startDate},vaccinated_date.lt.${endDateExclusive})`,
          `and(vaccinated_date.is.null,scheduled_vaccination.gte.${startDate},scheduled_vaccination.lt.${endDateExclusive})`,
          `and(vaccinated_date.is.null,scheduled_vaccination.is.null,created_at.gte.${startDate},created_at.lt.${endDateExclusive})`
        ].join(','));
      };

      let stationsQuery = this.supabase
        .from('stations')
        .select('id, station_name')
        .order('station_name', { ascending: true });
      if (isStationRestricted) stationsQuery = stationsQuery.eq('id', stationId);
      let patientsQuery = this.supabase
        .from('patient_basic_info')
        .select('id, station_ass, municipality, date_of_birth, stations:station_ass (station_name)');
      if (isStationRestricted) patientsQuery = patientsQuery.eq('station_ass', stationId);
      const [{ data: stationRows, error: stationError }, { data: patients, error: patientsError }] = await Promise.all([
        stationsQuery,
        patientsQuery
      ]);

      if (stationError) throw stationError;
      if (patientsError) throw patientsError;

      const allStations = [...new Set(stationRows?.map(s => s.station_name).filter(Boolean))];
      const patientIds = (patients || []).map(patient => patient.id).filter(Boolean);

      const getPatientStationLabel = patient =>
        patient.stations?.station_name || patient.municipality || 'Unknown';

      const stationMap = new Map();
      allStations.forEach(stationName => {
        stationMap.set(stationName, {
          id: stationName.toLowerCase().replace(/\s+/g, '-'),
          name: stationName,
          totalPatients: 0,
          highRisk: 0,
          withHealthConditions: 0,
          recentDeliveries: 0,
          vaccCoverage: 0,
          newborns: 0,
          suppCoverage: 0,
          riskStatus: 'Normal',
          alerts: [],
          trimester: { first: 0, second: 0, third: 0 },
          deliveryTypes: { nsd: 0, cs: 0 },
          complications: 0,
          lbwBabies: 0,
          nicuBabies: 0,
          newbornVaccCoverage: 0,
          totalPregnantPatients: 0,
          totalNewbornVaccinated: 0,
          totalSupplementsGiven: 0,
          totalVaccinations: 0,
          completedVaccinations: 0,
          missedAppointments: 0,
          appointmentsDue: 0,
          missedRate: 0
        });
      });

      (patients || []).forEach(patient => {
        const stationName = getPatientStationLabel(patient);
        if (!stationMap.has(stationName)) {
          stationMap.set(stationName, {
            id: stationName.toLowerCase().replace(/\s+/g, '-'),
            name: stationName,
            totalPatients: 0,
            highRisk: 0,
            withHealthConditions: 0,
            recentDeliveries: 0,
            vaccCoverage: 0,
            newborns: 0,
            suppCoverage: 0,
            riskStatus: 'Normal',
            alerts: [],
            trimester: { first: 0, second: 0, third: 0 },
            deliveryTypes: { nsd: 0, cs: 0 },
            complications: 0,
            lbwBabies: 0,
            nicuBabies: 0,
            newbornVaccCoverage: 0,
            totalPregnantPatients: 0,
            totalNewbornVaccinated: 0,
            totalSupplementsGiven: 0,
            totalVaccinations: 0,
            completedVaccinations: 0,
            missedAppointments: 0,
            appointmentsDue: 0,
            missedRate: 0
          });
        }
      });

      const emptyResult = { data: [], error: null };
      let pregnancyQuery = this.supabase
        .from('pregnancy_info')
        .select('patient_id, pregn_postp, pregnancy_type, gravida, lmd, edd, created_at')
        .order('created_at', { ascending: false });
      let visitsQuery = withinReportPeriod(
        this.supabase
          .from('prenatal_visits')
          .select('patient_id, visit_date, status, risk_factors, bp_systolic, bp_diastolic, temp_c, pulse_bpm, resp_rate_cpm, fhr_bpm, trimester')
          .order('visit_date', { ascending: false }),
        'visit_date'
      );
      let postpartumVisitsQuery = withinPostpartumReportPeriod(
        this.supabase
          .from('postpartum_visits')
          .select('patient_id, scheduled_date, status')
          .order('scheduled_date', { ascending: false })
      );
      if (isStationRestricted && patientIds.length > 0) {
        pregnancyQuery = pregnancyQuery.in('patient_id', patientIds);
        visitsQuery = visitsQuery.in('patient_id', patientIds);
        postpartumVisitsQuery = postpartumVisitsQuery.in('patient_id', patientIds);
      } else if (patientIds.length === 0) {
        pregnancyQuery = Promise.resolve(emptyResult);
        visitsQuery = Promise.resolve(emptyResult);
        postpartumVisitsQuery = Promise.resolve(emptyResult);
      }
      const [
        { data: pregnancies, error: pregError },
        { data: visits, error: visitsError },
        { data: postpartumVisits, error: postpartumVisitsError }
      ] = await Promise.all([
        pregnancyQuery,
        visitsQuery,
        postpartumVisitsQuery
      ]);

      if (pregError) throw pregError;
      if (visitsError) throw visitsError;
      if (postpartumVisitsError) throw postpartumVisitsError;

      const latestPregMap = new Map();
      (pregnancies || []).forEach(p => {
        if (!p.patient_id) return;
        const existing = latestPregMap.get(p.patient_id);
        const currentTime = new Date(p.created_at).getTime() || 0;
        const existingTime = existing ? new Date(existing.created_at).getTime() || 0 : 0;
        if (!existing || currentTime > existingTime) {
          latestPregMap.set(p.patient_id, p);
        }
      });

      const latestAttendedVisitMap = new Map();
      const patientVisitsMap = new Map();
      (visits || []).forEach(v => {
        if (!v.patient_id) return;
        if (!patientVisitsMap.has(v.patient_id)) {
          patientVisitsMap.set(v.patient_id, []);
        }
        patientVisitsMap.get(v.patient_id).push(v);
        if (v.status === 'Attended') {
          const existing = latestAttendedVisitMap.get(v.patient_id);
          if (!existing || new Date(v.visit_date) > new Date(existing.visit_date)) {
            latestAttendedVisitMap.set(v.patient_id, v);
          }
        }
      });

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1).toISOString().slice(0, 10);
      const lastDay = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      let deliveriesQuery = this.supabase
        .from('deliveries')
        .select('mother_id, station_ass, stations:station_ass (station_name), delivery_date, delivery_type, complications')
        .gte('delivery_date', firstDay)
        .lte('delivery_date', lastDay);
      if (isStationRestricted) deliveriesQuery = deliveriesQuery.eq('station_ass', stationId);
      let newbornsQuery = this.supabase
        .from('newborns')
        .select('id, mother_id, birth_weight, condition_at_birth, risk_level');
      let supplementsQuery = this.supabase
        .from('supplements')
        .select('patient_id, status');
      if (isStationRestricted && patientIds.length > 0) {
        newbornsQuery = newbornsQuery.in('mother_id', patientIds);
        supplementsQuery = supplementsQuery.in('patient_id', patientIds);
      } else if (patientIds.length === 0) {
        newbornsQuery = Promise.resolve(emptyResult);
        supplementsQuery = Promise.resolve(emptyResult);
      }
      const [{ data: deliveries, error: deliveriesError }, { data: newborns, error: newbornsError }, { data: supplements, error: suppError }] = await Promise.all([
        deliveriesQuery,
        newbornsQuery,
        supplementsQuery
      ]);
      if (deliveriesError) throw deliveriesError;
      if (newbornsError) throw newbornsError;
      if (suppError) throw suppError;

      const newbornIds = (newborns || []).map(newborn => newborn.id).filter(Boolean);
      const vaccinationQueries = [];
      if (patientIds.length > 0) {
        vaccinationQueries.push(vaccinationsWithinReportPeriod(
          this.supabase.from('vaccinations')
            .select('id, patient_id, newborn_id, status, vaccinated_date, scheduled_vaccination, created_at')
            .in('patient_id', patientIds)
        ));
      }
      if (newbornIds.length > 0) {
        vaccinationQueries.push(vaccinationsWithinReportPeriod(
          this.supabase.from('vaccinations')
            .select('id, patient_id, newborn_id, status, vaccinated_date, scheduled_vaccination, created_at')
            .in('newborn_id', newbornIds)
        ));
      }
      const vaccinationResults = await Promise.all(vaccinationQueries);
      const vaccinationError = vaccinationResults.find(result => result.error)?.error;
      if (vaccinationError) throw vaccinationError;
      const vaccinations = [...new Map(
        vaccinationResults.flatMap(result => result.data || []).map(vaccination => [vaccination.id, vaccination])
      ).values()];

      const completedSupplementsByPatient = new Set(
        (supplements || []).filter(supplement => supplement.status === 'Completed').map(supplement => supplement.patient_id)
      );
      const newbornsByMother = new Map();
      const newbornsById = new Map((newborns || []).map(newborn => [newborn.id, newborn]));
      (newborns || []).forEach(newborn => {
        const motherNewborns = newbornsByMother.get(newborn.mother_id) || [];
        motherNewborns.push(newborn);
        newbornsByMother.set(newborn.mother_id, motherNewborns);
      });
      const vaccinatedNewbornIds = new Set(
        vaccinations.filter(vaccination => vaccination.newborn_id && isVaccinationCompleted(vaccination)).map(vaccination => vaccination.newborn_id)
      );
      const patientById = new Map((patients || []).map(patient => [patient.id, patient]));
      const vaccinationsByStation = new Map();
      vaccinations.forEach(vaccination => {
        const newborn = newbornsById.get(vaccination.newborn_id);
        const patientId = vaccination.newborn_id ? newborn?.mother_id : vaccination.patient_id;
        const patient = patientById.get(patientId);
        const stationName = patient ? getPatientStationLabel(patient) : null;
        if (!stationName || !stationMap.has(stationName)) return;
        const stationVaccinations = vaccinationsByStation.get(stationName) || [];
        stationVaccinations.push(vaccination);
        vaccinationsByStation.set(stationName, stationVaccinations);
      });
      vaccinationsByStation.forEach((stationVaccinations, stationName) => {
        const metrics = getVaccinationMetrics(stationVaccinations, dateRange);
        Object.assign(stationMap.get(stationName), {
          totalVaccinations: metrics.totalVaccinations,
          completedVaccinations: metrics.completedVaccinations,
          vaccCoverage: metrics.vaccinationRate
        });
      });

      const appointmentsByStation = new Map();
      const addStationAppointments = (records, dateColumn) => records.forEach(record => {
        const patient = patientById.get(record.patient_id);
        const stationName = patient ? getPatientStationLabel(patient) : null;
        if (!stationName || !stationMap.has(stationName)) return;
        const stationAppointments = appointmentsByStation.get(stationName) || [];
        stationAppointments.push({ ...record, visit_date: record[dateColumn] || record.vaccinated_date });
        appointmentsByStation.set(stationName, stationAppointments);
      });
      addStationAppointments(visits || [], 'visit_date');
      addStationAppointments(postpartumVisits || [], 'scheduled_date');
      vaccinationsByStation.forEach((stationVaccinations, stationName) => {
        const stationAppointments = appointmentsByStation.get(stationName) || [];
        stationAppointments.push(...stationVaccinations.map(vaccination => ({
          ...vaccination,
          visit_date: vaccination.vaccinated_date || vaccination.scheduled_vaccination
        })));
        appointmentsByStation.set(stationName, stationAppointments);
      });
      appointmentsByStation.forEach((appointments, stationName) => {
        Object.assign(stationMap.get(stationName), getAppointmentMetrics(appointments, dateRange));
      });

      (patients || []).forEach(patient => {
        const stationName = getPatientStationLabel(patient);
        const station = stationMap.get(stationName);
        if (!station) return;

        const patientId = patient.id;
        const latestPreg = latestPregMap.get(patientId);
        const isPregnant = latestPreg && latestPreg.pregn_postp?.toLowerCase() === 'pregnant';

        if (isPregnant) {
          station.totalPregnantPatients++;
          if (latestPreg.lmd) {
            const weeks = this.calculateWeeks(latestPreg.lmd);
            const trimester = this.getTrimesterFromWeek(weeks);
            if (trimester === 1) station.trimester.first++;
            else if (trimester === 2) station.trimester.second++;
            else if (trimester === 3) station.trimester.third++;
          }
          const latestVisit = latestAttendedVisitMap.get(patientId);
          const riskAssessment = this.getPregnancyRisk(patient, latestPreg, latestVisit);
          if (riskAssessment.isHighRisk) station.highRisk++;

          // Documented health conditions check (pregnant patients with at least one documented health condition)
          const pVisits = patientVisitsMap.get(patientId) || [];
          const primaryVisit = pVisits[0] || latestVisit;
          let hasHealthCond = false;

          if (primaryVisit && primaryVisit.risk_factors) {
            const primaryRf = String(primaryVisit.risk_factors).trim();
            const primaryLower = primaryRf.toLowerCase();
            if (primaryLower === 'none reported' || primaryLower === 'none' || primaryLower === 'no documented conditions') {
              hasHealthCond = false;
            } else {
              hasHealthCond = this.hasDocumentedHealthConditions(primaryRf);
              if (!hasHealthCond) {
                // If primary visit had only vitals/demographics and not "None Reported", check other visits
                for (let vi = 1; vi < pVisits.length; vi++) {
                  if (pVisits[vi].risk_factors && this.hasDocumentedHealthConditions(pVisits[vi].risk_factors)) {
                    hasHealthCond = true;
                    break;
                  }
                }
              }
            }
          } else if (pVisits.length > 0) {
            for (const v of pVisits) {
              if (v.risk_factors && this.hasDocumentedHealthConditions(v.risk_factors)) {
                hasHealthCond = true;
                break;
              }
            }
          }

          if (hasHealthCond) {
            station.withHealthConditions++;
          }

          if (completedSupplementsByPatient.has(patientId)) station.totalSupplementsGiven++;
        }

        const patientNewborns = newbornsByMother.get(patientId) || [];
        station.newborns += patientNewborns.length;
        patientNewborns.forEach(n => {
          if (n.birth_weight && n.birth_weight < 2500) station.lbwBabies++;
          if (n.condition_at_birth?.toLowerCase().includes('nicu') || n.risk_level?.toLowerCase() === 'high') station.nicuBabies++;
          if (vaccinatedNewbornIds.has(n.id)) station.totalNewbornVaccinated++;
        });
      });

      (deliveries || []).forEach(delivery => {
        const station = stationMap.get(delivery.stations?.station_name);
        if (!station) return;
        station.recentDeliveries++;
        if (delivery.delivery_type?.toLowerCase() === 'nsd') station.deliveryTypes.nsd++;
        else if (delivery.delivery_type?.toLowerCase() === 'cs' || delivery.delivery_type?.toLowerCase() === 'cesarean') station.deliveryTypes.cs++;
        if (delivery.complications && delivery.complications.length > 0) station.complications++;
      });

      const stationsReport = Array.from(stationMap.values()).map(station => {
        station.totalPatients = station.totalPregnantPatients;
        station.withHealthConditions = station.withHealthConditions || 0;
        station.newbornVaccCoverage = station.newborns > 0
          ? Math.round((station.totalNewbornVaccinated / station.newborns) * 100)
          : 0;
        station.suppCoverage = station.totalPregnantPatients > 0
          ? Math.round((station.totalSupplementsGiven / station.totalPregnantPatients) * 100)
          : 0;
        const highRiskPercent = station.totalPregnantPatients > 0
          ? (station.highRisk / station.totalPregnantPatients) * 100
          : 0;
        if (highRiskPercent >= 30 || (station.totalVaccinations > 0 && station.vaccCoverage < 70)) {
          station.riskStatus = 'Critical';
          station.alerts = [];
          if (highRiskPercent >= 30) station.alerts.push(`High rate of health conditions: ${highRiskPercent.toFixed(0)}%`);
          if (station.vaccCoverage < 70) station.alerts.push(`Vaccination coverage critically low (${station.vaccCoverage}%)`);
          if (station.suppCoverage < 70) station.alerts.push(`Supplement coverage below 70%`);
        } else if (highRiskPercent >= 15 || (station.totalVaccinations > 0 && station.vaccCoverage < 80)) {
          station.riskStatus = 'Monitor';
          station.alerts = [];
          if (highRiskPercent >= 15) station.alerts.push(`${station.withHealthConditions} pregnancies with health conditions`);
          if (station.vaccCoverage < 80) station.alerts.push(`Vaccination coverage below 80%`);
        } else {
          station.riskStatus = 'Normal';
          station.alerts = [];
        }
        return station;
      });

      return stationsReport;
    } catch (error) {
      console.error('Error fetching station reports:', error);
      throw error;
    }
  }

  async getAnalyticsData() {
    try {
      const stationsQuery = this.supabase
        .from('stations')
        .select('station_name')
        .order('station_name', { ascending: true });
      const patientsQuery = this.supabase
        .from('patient_basic_info')
        .select('id, first_name, last_name, date_of_birth, municipality, stations:station_ass (station_name)');
      const pregnanciesQuery = this.supabase
        .from('pregnancy_info')
        .select('patient_id, pregn_postp, lmd, edd, created_at')
        .order('created_at', { ascending: false });
      const visitsQuery = this.supabase
        .from('prenatal_visits')
        .select('patient_id, visit_date, status, calculated_risk, risk_factors, trimester')
        .eq('status', 'Attended')
        .order('visit_date', { ascending: false });

      const [
        { data: stationRows, error: stationError },
        { data: patients, error: patientsError },
        { data: pregnancies, error: pregError },
        { data: visits, error: visitsError }
      ] = await Promise.all([stationsQuery, patientsQuery, pregnanciesQuery, visitsQuery]);
      if (stationError) throw stationError;
      const stations = [...new Set(stationRows?.map(s => s.station_name).filter(Boolean))];
      if (patientsError) throw patientsError;
      if (pregError) throw pregError;
      if (visitsError) throw visitsError;

      const latestPregMap = new Map();
      (pregnancies || []).forEach(p => {
        if (!p.patient_id) return;
        const existing = latestPregMap.get(p.patient_id);
        const currentTime = new Date(p.created_at).getTime() || 0;
        const existingTime = existing ? new Date(existing.created_at).getTime() || 0 : 0;
        if (!existing || currentTime > existingTime) {
          latestPregMap.set(p.patient_id, p);
        }
      });

      const latestAttendedVisitMap = new Map();
      (visits || []).forEach(v => {
        if (!v.patient_id) return;
        const existing = latestAttendedVisitMap.get(v.patient_id);
        if (!existing || new Date(v.visit_date) > new Date(existing.visit_date)) {
          latestAttendedVisitMap.set(v.patient_id, v);
        }
      });

      const analyticsData = [];
      const getPatientStationLabel = patient =>
        patient.stations?.station_name || patient.municipality || 'Unknown';

      (patients || []).forEach(patient => {
        const patientId = patient.id;
        const station = getPatientStationLabel(patient);
        const latestPreg = latestPregMap.get(patientId);
        const isPregnant = latestPreg && latestPreg.pregn_postp?.toLowerCase() === 'pregnant';

        if (isPregnant) {
          let age = 0;
          if (patient.date_of_birth) {
            const dob = new Date(patient.date_of_birth);
            const today = new Date();
            age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
              age--;
            }
          }

          let trimester = 1;
          if (latestPreg.lmd) {
            const weeks = this.calculateWeeks(latestPreg.lmd);
            trimester = this.getTrimesterFromWeek(weeks);
          }

          const latestVisit = latestAttendedVisitMap.get(patientId);
          const riskLevel = latestVisit?.calculated_risk || 'Normal';
          const riskFactors = latestVisit?.risk_factors || '';

          let condition = 'None';
          if (riskFactors) {
            const lower = riskFactors.toLowerCase();
            if (lower.includes('preeclampsia') || lower.includes('pre-eclampsia')) {
              condition = 'Preeclampsia';
            } else if (lower.includes('anemia')) {
              condition = 'Anemia';
            } else if (lower.includes('diabetes') || lower.includes('gestational')) {
              condition = 'Gestational Diabetes';
            }
          }

          analyticsData.push({
            id: patientId,
            name: `${patient.first_name} ${patient.last_name}`.trim(),
            age,
            station,
            trimester,
            riskLevel,
            condition,
            isTeenage: age < 20,
            dateAdded: new Date(latestPreg.created_at)
          });
        }
      });

      return {
        stations,
        data: analyticsData
      };
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      return {
        stations: [],
        data: []
      };
    }
  }

  async getNewbornPendingVaccinations() {
    try {
      const { data, error } = await this.supabase
        .from('newborns')
        .select(`
          id,
          baby_name,
          gender,
          deliveries!inner (delivery_date),
          patient_basic_info!mother_id (
            first_name,
            last_name
          ),
          vaccinations!inner (
            dose_number,
            scheduled_vaccination,
            vaccinated_date,
            vaccine_inventory (
              vaccine_name
            )
          )
        `)
        .is('vaccinations.vaccinated_date', null);

      if (error) throw error;

      const result = (data || []).map(newborn => {
        const mother = newborn.patient_basic_info;
        const pendingVaccs = newborn.vaccinations.filter(v => !v.vaccinated_date);
        return {
          id: newborn.id,
          babyName: newborn.baby_name || `Baby ${newborn.gender}`,
          motherName: `${mother.first_name || ''} ${mother.last_name || ''}`.trim(),
          birthDate: newborn.deliveries.delivery_date,
          pendingVaccines: pendingVaccs.map(v => `${v.vaccine_inventory?.vaccine_name || 'Unknown'} (Dose ${v.dose_number}) - ${v.scheduled_vaccination}`).join(', ')
        };
      }).filter(item => item.pendingVaccines); // only show if has pending

      return result.sort((a, b) => new Date(b.birthDate) - new Date(a.birthDate));
    } catch (error) {
      console.error('Error fetching newborn pending vaccinations:', error);
      return [];
    }
  }
}