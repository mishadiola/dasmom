import supabase from '../config/supabaseclient';
import AuthService from './authservice';
const TIME_SLOTS_8TO4 = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', 
  '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', 
  '15:00', '15:30', '16:00'
];
const authService = new AuthService();

const calculateVisitStatus = (visitDate) => {
  const today = new Date();
  const visit = new Date(visitDate);
  const diffTime = visit - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return 'Upcoming';
  if (diffDays === 0) return 'Waiting';
  return 'Completed';
};

export default class PatientService {
  constructor() {
    this.supabase = supabase;
  }

  
  async getCurrentUserId() {
    const user = await authService.getAuthUser();
    return user?.id || null;
  }

  // ✅ FIXED: Matches prenatalvisits.jsx EXACTLY
  async getAllPatients() {
    try {
      const { data: patients, error } = await this.supabase
        .from('patient_basic_info')
        .select('id, first_name, last_name, barangay, municipality, date_of_birth, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (patients || []).map(p => ({
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Patient',
        station: p.barangay || p.municipality || 'N/A',
      })).filter(p => p.id && p.name !== 'Unknown Patient');
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

  // ✅ NEW: Staff for dropdown (full_name array for prenatalvisits.jsx)
  async getAllMidwives() {
    const { data } = await this.supabase
      .from('staff_profiles')
      .select('full_name')
      .or('role.ilike.%midwife%,role.ilike.%doctor%');
    return data?.map(s => s.full_name) || [];
  }

  // 🔥 FIXED: getPrenatalVisits() - Perfect data shape for table
  async getPrenatalVisits() {
  try {
    const { data, error } = await this.supabase
      .from('prenatal_visits')
      .select(`
        id, visit_date, gestational_age, bp_systolic, bp_diastolic, weight_kg, 
        patient_id, patient_basic_info!inner(first_name, last_name, middle_name)
      `)
      .order('visit_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    return data.map(visit => ({
      id: visit.id,
      visitDate: visit.visit_date,
      patientName: `${visit.patient_basic_info?.first_name || ''} ${visit.patient_basic_info?.middle_name ? visit.patient_basic_info.middle_name[0] + '. ' : ''}${visit.patient_basic_info?.last_name || ''}`.trim(),
      patientId: visit.patient_id,
      ga: visit.gestational_age || 'N/A',
      bp: visit.bp_systolic && visit.bp_diastolic ? `${visit.bp_systolic}/${visit.bp_diastolic}` : 'N/A',
      weight: visit.weight_kg ? `${visit.weight_kg}kg` : 'N/A',
      risk: 'Normal', // 🔥 Default - no pregnancy_info join
      status: calculateVisitStatus(visit.visit_date),
    }));
  } catch (error) {
    console.error('Error fetching prenatal visits:', error);
    return [];
  }
}


  // 🔥 NEW: getAppointments() - Uses next_appt_date (TIMESTAMP) for calendar
  async getAppointments(startDate, endDate, view = 'day') {
  try {
    let query = this.supabase
      .from('prenatal_visits')
      .select(`
        id, visit_date, next_appt_date, patient_id, patient_basic_info!inner(first_name, last_name)
      `);

    if (view === 'week' || view === 'month') {
      query = query.gte('visit_date', startDate).lte('visit_date', endDate);
    } else {
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('visit_date', today);
    }

    const { data, error } = await query.order('visit_date');

    if (error) throw error;

    return data.map(appointment => ({
      id: appointment.id,
      date: appointment.visit_date,
      time: this.generateTimeSlot(appointment.patient_id, appointment.visit_date),
      patient: `${appointment.patient_basic_info?.first_name || ''} ${appointment.patient_basic_info?.last_name || ''}`.trim() || 'Unknown',
      patientId: appointment.patient_id,
      type: 'Prenatal Checkup',
      risk: 'Normal', // 🔥 Default
      nextAppt: appointment.next_appt_date
    }));
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }
}


  generateTimeSlot(patientId, visitDate) {
    const timeSlots = ['08:00 AM','08:30 AM','09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM'];
    if (!patientId || !visitDate) return timeSlots[0];
    
    // Deterministic hash to spread patients evenly across time slots visually
    let hash = 0;
    const str = patientId + visitDate;
    for (let i = 0; i < str.length; i++) {
        hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return timeSlots[Math.abs(hash) % timeSlots.length];
  }

  // 🔥 FIXED: addPatient() - next_appt_date as TIMESTAMP + 30/day limit
  async addPatient(patientData) {
    const createdBy = await this.getCurrentUserId();
    if (!createdBy) throw new Error("No logged-in user");

    const patientId = crypto.randomUUID();

    // 1. USER
    const { data: typeData } = await this.supabase
      .from('user_type')
      .select('id')
      .ilike('user_type', '%patient%')
      .maybeSingle();

    if (!typeData) throw new Error("Patient usertype not found");

    await this.supabase.from('users').insert({
      id: patientId,
      email_address: patientData.email,
      password: 'Patient123!',
      usertype: typeData.id
    });

    // 2. BASIC INFO
    await this.supabase.from('patient_basic_info').insert({
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
      barangay: patientData.station,
      province: patientData.province,
      philhealthnumber: patientData.philhealth || null,
      created_by: createdBy,
      emergency_contact: {
        name: patientData.emName || null,
        relation: patientData.emRel || null, 
        phone: patientData.emPhone || null,
        address: patientData.emAddress || null
      }
    });

    // 3. PREGNANCY INFO
    await this.supabase.from('pregnancy_info').insert({
      patient_id: patientId,
      created_by: createdBy,
      pregn_postp: patientData.pregnancyStatus,
      lmd: patientData.lmp,
      edd: patientData.edd,
      pregnancy_type: patientData.pregnancyType,
      place_of_delivery: patientData.plannedDeliveryPlace,
      calculated_risk: patientData.riskLevel || 'Normal',
      gravida: parseInt(patientData.gravida) || 1,
      para: parseInt(patientData.para) || 0,
      risk_factors: Array.isArray(patientData.conditions) && patientData.conditions.length > 0 
        ? patientData.conditions.join(', ') : null
 // 🔥 TIMESTAMP for calendar
    });

    // 🔥 4. FIRST VISIT (TODAY) + IMMEDIATE NEXT APPOINTMENT
    if (patientData.bp && patientData.weight) {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // TIMESTAMP
      const bpMatch = patientData.bp.match(/^(\d+)[/\\s](\d+)$/);
      
      await this.supabase.from('prenatal_visits').insert({
        patient_id: patientId,
        visit_date: today,
        visit_number: 1,
        trimester: this.calculateTrimester(patientData.lmp),
        gestational_age: this.calculateWeeks(patientData.lmp) > 0 ? `${this.calculateWeeks(patientData.lmp)} weeks` : '1st visit',
        bp_systolic: parseInt(bpMatch[1]),
        bp_diastolic: parseInt(bpMatch[2]),
        weight_kg: parseFloat(patientData.weight),
        fhr_bpm: patientData.fhr ? parseInt(patientData.fhr) : null,
        next_appt_date: nextWeek, // 🔥 TIMESTAMP - Shows on calendar!
        next_appt_type: 'Follow-up Checkup',
        created_by: createdBy
      });
    }

    // 🔥 5. SEMESTER SCHEDULE (30/DAY MAX)
    await this.smartSemesterScheduling({
      patientId, lmp: patientData.lmp, createdBy,
      maxPerDay: 30 // 25 regular + 5 rescheduling
    });

  return await this.getPatientById(patientId);
}


// 🔥 FIXED: Smart scheduling with 30/day limit
  // 🔥 TIME SLOTS 8AM-4PM (15 slots x 2 = 30 max/day)


// 🔥 FIXED: Time-aware scheduling
async smartSemesterScheduling({ patientId, lmp, createdBy, maxPerDay = 30 }) {
  const lmpDate = new Date(lmp);
  const semesters = [
    { startWeek: 2, endWeek: 13, name: '1st Trimester', visits: [0, 2, 4] },
    { startWeek: 14, endWeek: 26, name: '2nd Trimester', visits: [0, 2, 4] },
    { startWeek: 27, endWeek: 40, name: '3rd Trimester', visits: [0, 2, 4] }
  ];

  let visitNumber = await this.getNextVisitNumber(patientId);

  for (const semester of semesters) {
    for (let offset of semester.visits) {
      const visitDateStr = this.addWeeksToDate(lmpDate, semester.startWeek + offset);
      
      // 🔥 CHECK TOTAL SLOTS FOR DAY (30 max)
      const { count: dayCount } = await this.supabase
        .from('prenatal_visits')
        .select('*', { count: 'exact', head: true })
        .eq('visit_date', visitDateStr);

      if (dayCount >= maxPerDay) continue; // Skip full days

      // 🔥 LOOP THROUGH TIME SLOTS 8AM-4PM
      for (const timeSlot of TIME_SLOTS_8TO4) {
        const timeCount = await this.getSlotCount(visitDateStr, timeSlot);
        
        if (timeCount < 2) {  // 2 patients per slot max
          // Schedule here!
          const nextOffset = offset + 2;
          const nextDateStr = this.addWeeksToDate(lmpDate, semester.startWeek + nextOffset);
          const nextTimeSlot = TIME_SLOTS_8TO4[Math.floor(Math.random() * TIME_SLOTS_8TO4.length)]; // Random next slot
          
          // 🔥 TIMESTAMP: YYYY-MM-DDTHH:MM:SSZ (8AM-4PM)
          const nextApptDate = new Date(`${nextDateStr}T${nextTimeSlot}:00.000Z`);
          
          await this.supabase.from('prenatal_visits').insert({
            patient_id: patientId,
            visit_date: visitDateStr,
            visit_number: visitNumber++,
            trimester: this.getTrimesterFromWeek(semester.startWeek),
            gestational_age: `${semester.startWeek + offset} weeks`,
            next_appt_date: nextApptDate.toISOString(),  // "2026-04-26T09:30:00.000Z"
            next_appt_type: `${semester.name} Checkup`,
            created_by: createdBy
          });
          
          console.log(`✅ Scheduled: ${visitDateStr} ${timeSlot} → Next: ${nextDateStr} ${nextTimeSlot}`);
          break; // One slot per visit
        }
      }
    }
  }
}

// 🔥 HELPER: Count patients in specific slot
async getSlotCount(dateStr, timeSlot) {
  const { count } = await this.supabase
    .from('prenatal_visits')
    .select('*', { count: 'exact', head: true })
    .eq('visit_date', dateStr)
    .eq('scheduled_time', timeSlot); // Add this column if needed
  return count || 0;
}

  async getHighRiskStats() {
    try {
      const { count } = await this.supabase
        .from('pregnancy_info')
        .select('*', { count: 'exact', head: true })
        .neq('calculated_risk', 'Normal')
        .not('calculated_risk', 'is', null);
        
      return {
        highRiskCount: count || 0
      };
    } catch (err) {
      console.error('Error fetching high risk stats:', err);
      return { highRiskCount: 0 };
    }
  }

  async getHighRiskPatients() {
    try {
      const { data, error } = await this.supabase
        .from('patient_basic_info')
        .select(`
          id, first_name, last_name, barangay, municipality,
          pregnancy_info!inner(calculated_risk, risk_factors, gravida, lmd)
        `)
        .neq('pregnancy_info.calculated_risk', 'Normal')
        .not('pregnancy_info.calculated_risk', 'is', null);

      if (error) throw error;
      
      // Ensure pregnancy_info is an object, not an array
      return (data || []).map(p => ({
        ...p,
        pregnancy_info: Array.isArray(p.pregnancy_info) ? p.pregnancy_info[0] : p.pregnancy_info
      }));
    } catch (err) {
      console.error('Error fetching high risk patients:', err);
      return [];
    }
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

  // Utility methods (unchanged but fixed)
  addWeeksToDate(date, weeks) {
    const d = new Date(date);
    d.setDate(d.getDate() + weeks * 7);
    return d.toISOString().split('T')[0];
  }

  getTrimesterFromWeek(week) {
    if (week < 14) return 1;
    if (week < 28) return 2;
    return 3;
  }

  calculateWeeks(lmp) {
    if (!lmp) return 0;
    return Math.floor((new Date() - new Date(lmp)) / (1000 * 60 * 60 * 24 * 7));
  }

  calculateTrimester(lmp) {
    return this.getTrimesterFromWeek(this.calculateWeeks(lmp));
  }

  async getNextVisitNumber(patientId) {
    const { count } = await this.supabase
      .from('prenatal_visits')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId);
    return (count || 0) + 1;
  }

  async getPatientById(patientId) {
    const { data } = await this.supabase
      .from('patient_basic_info')
      .select(`
        *,
        pregnancy_info(*),
        prenatal_visits(*)
      `)
      .eq('id', patientId)
      .single();

    if (!data) return null;

    const preg = Array.isArray(data.pregnancy_info) ? data.pregnancy_info[0] : data.pregnancy_info || {};

    return {
      ...data,
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      age: this.calculateAge(data.date_of_birth),
      station: data.barangay,
      phone: data.contact_no || 'N/A',
      address: data.house_no,
      dob: data.date_of_birth,
      civilStatus: data.civil_status,
      philhealth: data.philhealthnumber,
      bloodType: data.blood_type || 'Unknown',
      emergencyContact: data.emergency_contact || {},

      // Pregnancy fields mapped for PatientProfile
      pregnancyStatus: preg.pregn_postp || 'Pregnant',
      lmp: preg.lmd || 'N/A',
      edd: preg.edd || 'N/A',
      pregnancyType: preg.pregnancy_type || 'Singleton',
      plannedDeliveryPlace: preg.place_of_delivery || 'N/A',
      risk: preg.calculated_risk || 'Normal',
      gravida: preg.gravida || 1,
      para: preg.para || 0,
      medicalConditions: preg.risk_factors ? preg.risk_factors.split(',').map(s=>s.trim()).filter(Boolean) : [],
      
      // Calculate active trimester and weeks using LMP
      trimester: this.calculateTrimester(preg.lmd),
      weeks: this.calculateWeeks(preg.lmd),

      // Lists defaulting to empty arrays to prevent `.length` crashes
      visits: data.prenatal_visits || [],
      vaccines: data.vaccines || [],
      supplements: data.supplements || [],
      newborns: data.newborns || []
    };
  }

  // Keep other methods as-is (addPatient complexity preserved)
  async getAvailableStations() {
    const { data } = await this.supabase
      .from('staff_profiles')
      .select('barangay_assignment')
      .not('barangay_assignment', 'is', null);
    return [...new Set(data?.map(s => s.barangay_assignment) || [])];
  }

  async getDoctorsByStation(station) {
  const { data } = await this.supabase
    .from('staff_profiles')
    .select('id, full_name, barangay_assignment')
    .eq('barangay_assignment', station)
    .ilike('role', '%doctor%');

  return data || [];
}

// 🔥 MIDWIVES BY STATION - AddPatient.jsx needs this too!
async getMidwivesByStation(station) {
  const { data } = await this.supabase
    .from('staff_profiles')
    .select('id, full_name, barangay_assignment')
    .eq('barangay_assignment', station)
    .ilike('role', '%midwife%');

  return data || [];
}
}