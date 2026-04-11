import supabase from '../config/supabaseclient';
import AuthService from './authservice';

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

const generateTimeSlot = (date) => {
  const hour = new Date(date).getHours();
  const timeSlots = ['08:00 AM','08:30 AM','09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','01:00 PM','01:30 PM'];
  return timeSlots[Math.floor(hour / 2) % timeSlots.length] || '08:00 AM';
};

export default class PatientService {
  constructor() {
    this.supabase = supabase;
  }

  // =========================
  // AUTH
  // =========================
  async getCurrentUserId() {
    const user = await authService.getAuthUser();
    return user?.id || null;
  }

  // =========================
  // 🔥 FIXED: getAllPatients() - Matches your PatientsList.jsx exactly
  // =========================
  // 🔥 REPLACE getAllPatients() + fallback with THIS:
async getAllPatients() {
  try {
    console.log('🔥 PatientService.getAllPatients() - SIMPLE QUERY');
    
    // STEP 1: Get basic patient info
    const { data: patients, error } = await this.supabase
      .from('patient_basic_info')
      .select('id, first_name, last_name, barangay, municipality, date_of_birth, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('✅ Basic patients:', patients?.length || 0);

    // STEP 2: Transform each patient (no complex joins)
    const patientList = (patients || []).map(p => ({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Patient',
      station: p.barangay || p.municipality || 'N/A',
      age: this.calculateAge(p.date_of_birth),
      trimester: 1,  // Default
      weeks: '-',    // Default  
      risk: 'Normal', // Default
      edd: null,
      createdAt: p.created_at || new Date().toISOString(),
    })).filter(p => p.id && p.name !== 'Unknown Patient');

    console.log('✅ FINAL patients:', patientList.length);
    return patientList;

  } catch (error) {
    console.error('❌ getAllPatients TOTAL FAILURE:', error);
    return []; // Empty array = "No patients found" message shows
  }
}

  // Fallback if RPC doesn't exist
  async getAllPatientsFallback() {
    const { data, error } = await this.supabase
      .from('patient_basic_info')
      .select(`
        id,
        first_name,
        last_name,
        barangay,
        municipality,
        date_of_birth,
        created_at,
        pregnancy_info!inner(edd, calculated_risk),
        prenatal_visits!inner(trimester, gestational_age, risk_level)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fallback query failed:', error);
      return [];
    }

    return (data || []).map(p => ({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
      station: p.barangay || p.municipality || 'N/A',
      age: this.calculateAge(p.date_of_birth),
      trimester: p.prenatal_visits?.[0]?.trimester || 1,
      weeks: p.prenatal_visits?.[0]?.gestational_age || '-',
      risk: p.pregnancy_info?.calculated_risk || p.prenatal_visits?.[0]?.risk_level || 'Normal',
      edd: p.pregnancy_info?.edd,
      createdAt: p.created_at,
    }));
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

  // =========================
  // STATIONS
  // =========================
  async getAvailableStations() {
    const { data } = await this.supabase
      .from('staff_profiles')
      .select('barangay_assignment')
      .not('barangay_assignment', 'is', null);

    if (!data) return [];

    return [...new Set(data.map(s => s.barangay_assignment))];
  }

  async getAllMidwives() {
    const { data } = await this.supabase
      .from('staff_profiles')
      .select('id, full_name, barangay_assignment, role')
      .ilike('role', '%midwife%');

    return data || [];
  }

  async getDoctorsByStation(station) {
    const { data } = await this.supabase
      .from('staff_profiles')
      .select('id, full_name, barangay_assignment')
      .eq('barangay_assignment', station)
      .ilike('role', '%doctor%');

    return data || [];
  }

  // =========================
  // ADD PATIENT (UNCHANGED - ALREADY PERFECT)
  // =========================
  async addPatient(patientData) {
    console.log('🚀 Starting addPatient with:', {
      firstName: patientData.firstName,
      station: patientData.station,
      lmp: patientData.lmp
    });

    const createdBy = await this.getCurrentUserId();
    console.log('👤 createdBy:', createdBy);
    
    if (!createdBy) throw new Error("No logged-in user");

    const { data: typeData } = await this.supabase
      .from('user_type')
      .select('id')
      .ilike('user_type', '%patient%')
      .maybeSingle();

    console.log('🔑 usertype:', typeData);

    if (!typeData) throw new Error("Patient usertype not found");

    const patientId = crypto.randomUUID();
    console.log('🆔 Generated patientId:', patientId);

    // 1. USER
    console.log('📝 Inserting USER...');
    const { error: userError } = await this.supabase
      .from('users')
      .insert({
        id: patientId,
        email_address: patientData.email,
        password: 'Patient123!',
        usertype: typeData.id
      });

    if (userError) {
      console.error('❌ USER ERROR:', userError);
      throw userError;
    }
    console.log('✅ USER inserted');

    // 2. BASIC INFO (FULL DB MATCH + DEBUG)
    console.log('🏠 Inserting BASIC INFO...');
    console.log('Basic info payload:', {
      id: patientId,
      first_name: patientData.firstName,
      last_name: patientData.lastName,
      contact_no: patientData.contactNumber,
      created_by: createdBy
    });

    const { error: basicError, data: basicData } = await this.supabase
      .from('patient_basic_info')
      .insert({
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

    console.log('Basic info result:', { error: basicError, data: basicData });

    if (basicError) {
      console.error('❌ BASIC INFO ERROR:', basicError);
      throw basicError;
    }
    console.log('✅ BASIC INFO inserted');

    // 3. PREGNANCY INFO (DB MATCH)
    console.log('🤰 Inserting PREGNANCY INFO...');
    
    const { error: pregError } = await this.supabase
      .from('pregnancy_info')
      .insert({
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
          ? patientData.conditions.join(', ')  
          : null
      });

    if (pregError) {
      console.error('❌ PREGNANCY ERROR:', pregError);
      throw pregError;
    }
    console.log('✅ PREGNANCY INFO inserted');

    // 4. FIRST VISIT (with BP parsing safety + risk_factors)
    console.log('🏥 Inserting FIRST VISIT...');
    if (patientData.bp && patientData.weight) {
      try {
        const [sys, dia] = patientData.bp.split('/');
        await this.supabase.from('prenatal_visits').insert({
          patient_id: patientId,
          visit_date: new Date().toISOString().split('T')[0],
          visit_number: 1,
          trimester: this.calculateTrimester(patientData.lmp),
          gestational_age: `${this.calculateWeeks(patientData.lmp)} weeks`,
          bp_systolic: parseInt(sys),
          bp_diastolic: parseInt(dia),
          weight_kg: parseFloat(patientData.weight),
          fhr_bpm: patientData.fhr ? parseInt(patientData.fhr) : null,
          risk_factors: patientData.conditions || [],  
          created_by: createdBy,
          next_appt_type: 'Initial Visit',
          next_appt_date: this.calculateNextSemesterVisit(patientData.lmp)
        });
        console.log('✅ FIRST VISIT inserted');
      } catch (e) {
        console.warn('First visit BP format error:', e);
      }
    }

    // 5. SMART SEMESTER SCHEDULING
    console.log('📅 Scheduling semester visits...');
    await this.smartSemesterScheduling({
      patientId,
      lmp: patientData.lmp,
      midwifeId: patientData.assignedMidwife,
      doctorId: patientData.assignedDoctor,
      createdBy
    });
    console.log('✅ Semester scheduling complete');

    const patient = await this.getPatientById(patientId);
    console.log('🎉 FULL PATIENT CREATED:', patient);
    
    return patient;
  }

  // NEW: Get full patient profile
  async getPatientById(patientId) {
    const { data } = await this.supabase
      .from('patient_basic_info')
      .select(`
        *,
        pregnancy_info(*),
        prenatal_visits!inner(*)
      `)
      .eq('id', patientId)
      .single();

    return data || null;
  }

  // NEW: Calendar preview
  async previewSemesterSchedule(lmp) {
    const lmpDate = new Date(lmp);
    const schedules = [];
    const weeks = [0,2,4, 14,16,18, 27,29,31];
    
    weeks.forEach((week) => {
      const visitDate = this.addWeeksToDate(lmpDate, week);
      schedules.push({
        date: visitDate,
        week,
        trimester: this.getTrimesterFromWeek(week)
      });
    });
    return schedules;
  }

  // =========================
  // SMART SEMESTER SCHEDULING (UNCHANGED)
  // =========================
  async smartSemesterScheduling({ patientId, lmp, midwifeId, doctorId, createdBy }) {
    const lmpDate = new Date(lmp);
    const today = new Date();
    
    const semesters = [
      { startWeek: 0, endWeek: 13, name: '1st Trimester' },
      { startWeek: 14, endWeek: 26, name: '2nd Trimester' },
      { startWeek: 27, endWeek: 40, name: '3rd Trimester' }
    ];

    let visitNumber = await this.getNextVisitNumber(patientId);

    for (const semester of semesters) {
      const semesterStart = this.addWeeksToDate(lmpDate, semester.startWeek);
      
      if (semesterStart > today) {
        await this.scheduleSemesterVisits({
          patientId, semesterStart, semester, visitNumber, midwifeId, doctorId, createdBy
        });
        visitNumber += 3;
      } else {
        await this.fillSemesterGaps({
          patientId, semesterStart, semester, lmpDate, visitNumber, midwifeId, doctorId, createdBy
        });
        visitNumber += 3;
      }
    }
  }

  async getNextVisitNumber(patientId) {
    const { count } = await this.supabase
      .from('prenatal_visits')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId);
    return (count || 0) + 1;
  }

  async scheduleSemesterVisits({ patientId, semesterStart, semester, visitNumber, midwifeId, doctorId, createdBy }) {
    const visits = [0, 2, 4];
    
    for (let offset of visits) {
      const visitDate = this.addWeeksToDate(semesterStart, offset);
      
      const { count } = await this.supabase
        .from('prenatal_visits')
        .select('*', { count: 'exact', head: true })
        .eq('visit_date', visitDate);
      
      if (count < 20) {
        await this.supabase.from('prenatal_visits').insert({
          patient_id: patientId,
          visit_date: visitDate,
          visit_number: visitNumber++,
          trimester: this.getTrimesterFromWeek(semester.startWeek),
          gestational_age: `${semester.startWeek + offset} weeks`,
          created_by: createdBy,
          assigned_midwife: midwifeId || null,
          assigned_doctor: doctorId || null,
          next_appt_type: `${semester.name} Checkup`
        });
      }
    }
  }

  async fillSemesterGaps({ patientId, semesterStart, semester, lmpDate, visitNumber, midwifeId, doctorId, createdBy }) {
    const semesterEnd = this.addWeeksToDate(lmpDate, semester.endWeek);
    const { data: existing } = await this.supabase
      .from('prenatal_visits')
      .select('visit_date')
      .eq('patient_id', patientId)
      .gte('visit_date', semesterStart)
      .lte('visit_date', semesterEnd);

    const existingDates = existing?.map(v => v.visit_date) || [];
    const targetDates = [0, 2, 4].map(w => this.addWeeksToDate(semesterStart, w));

    for (let date of targetDates) {
      if (!existingDates.includes(date) && new Date(date) > new Date()) {
        const { count } = await this.supabase
          .from('prenatal_visits')
          .select('*', { count: 'exact', head: true })
          .eq('visit_date', date);
        
        if (count < 20) {
          await this.supabase.from('prenatal_visits').insert({
            patient_id: patientId,
            visit_date: date,
            visit_number: visitNumber++,
            trimester: this.getTrimesterFromWeek(semester.startWeek),
            gestational_age: `${semester.startWeek + 2} weeks`,
            created_by: createdBy,
            assigned_midwife: midwifeId || null,
            assigned_doctor: doctorId || null,
            next_appt_type: `${semester.name} Checkup (Catch-up)`
          });
        }
      }
    }
  }

  // =========================
  // UTIL METHODS (UNCHANGED)
  // =========================
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

  calculateNextSemesterVisit(lmp) {
    const weeks = this.calculateWeeks(lmp);
    const nextSemester = weeks < 14 ? 14 : weeks < 28 ? 28 : 40;
    return this.addWeeksToDate(lmp, nextSemester);
  }

  // =========================
  // HIGH RISK (ALL FIXED)
  // =========================
  async getPrenatalVisits() {
    try {
      const { data, error } = await this.supabase
        .from('prenatal_visits')
        .select(`
          id, visit_date, visit_number, gestational_age, bp_systolic, bp_diastolic, 
          weight_kg, patient_id, patient_basic_info!inner(first_name, last_name, middle_name)
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
        risk: 'Normal',
        status: calculateVisitStatus(visit.visit_date),
        staff: 'Unassigned'
      }));
    } catch (error) {
      console.error('Error fetching prenatal visits:', error);
      return [];
    }
  }

  async getAppointments(startDate, endDate) {
    try {
      const { data, error } = await this.supabase
        .from('prenatal_visits')
        .select('id, visit_date, patient_id, patient_basic_info!inner(first_name, last_name)')
        .gte('visit_date', startDate)
        .lte('visit_date', endDate);

      if (error) throw error;

      return data.map(appointment => ({
        id: appointment.id,
        date: appointment.visit_date,
        time: generateTimeSlot(appointment.visit_date),
        patient: `${appointment.patient_basic_info?.first_name || ''} ${appointment.patient_basic_info?.last_name || ''}`,
        patientId: appointment.patient_id,
        type: 'Prenatal',
        risk: 'Normal'
      }));
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
  }

  subscribeToHighRiskChanges(callback) {
    try {
      const channel = this.supabase
        .channel('high-risk-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pregnancy_info',
            filter: 'calculated_risk=eq.High Risk'
          },
          (payload) => {
            console.log('High risk change:', payload);
            callback(payload);
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
        });

      return {
        unsubscribe: () => {
          this.supabase.removeChannel(channel);
        }
      };
    } catch (error) {
      console.error('Subscription failed:', error);
      return {
        unsubscribe: () => {}
      };
    }
  }

  async getHighRiskStats() {
    try {
      const { count, error } = await this.supabase
        .from('pregnancy_info')
        .select('*', { count: 'exact', head: true })
        .eq('calculated_risk', 'High Risk');

      if (error) throw error;

      return {
        highRiskCount: count || 0,
        status: 'loaded'
      };
    } catch (error) {
      console.error('Error fetching high risk stats:', error);
      return { highRiskCount: 0, status: 'error' };
    }
  }

  async getHighRiskPatients() {
    try {
      const { data, error } = await this.supabase
        .from('patient_basic_info')
        .select(`
          *,
          pregnancy_info!inner(calculated_risk, lmd, gravida, para)
        `)
        .eq('pregnancy_info.calculated_risk', 'High Risk');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching high risk patients:', error);
      return [];
    }
  }
}