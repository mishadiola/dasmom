import supabase from '../config/supabaseclient';
import AuthService from './authservice';
import InventoryService from './inventoryservice';

const inventoryService = new InventoryService();
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

  async getAllPatients() {
  try {
    // 1. Get all patients
    const { data: patients, error: err1 } = await this.supabase
      .from('patient_basic_info')
      .select('id, first_name, last_name, barangay, municipality, date_of_birth, created_at')
      .order('created_at', { ascending: false });

    if (err1) throw err1;

    // 2. Get all pregnancies
    const { data: pregnancies, error: err2 } = await this.supabase
      .from('pregnancy_info')
      .select('patient_id, lmd, edd, calculated_risk, risk_factors');
    if (err2) throw err2;

    // 3. Get all upcoming next_appt_date entries from prenatal_visits
    const today = new Date().toISOString().split('T')[0];
    const { data: visits, error: err3 } = await this.supabase
      .from('prenatal_visits')
      .select('patient_id, next_appt_date')
      .not('next_appt_date', 'is', null)
      .gte('next_appt_date', today)
      .order('next_appt_date', { ascending: true });
    if (err3) throw err3;

    // 4. Build map: patient_id → earliest upcoming next_appt_date
    const nextApptMap = new Map();
    (visits || []).forEach(v => {
      if (v.patient_id && v.next_appt_date) {
        // Since ordered ascending, first occurrence = nearest upcoming date
        if (!nextApptMap.has(v.patient_id)) {
          nextApptMap.set(v.patient_id, v.next_appt_date);
        }
      }
    });

    // 5. Build a map: patient_id → pregnancy
    const pgiMap = new Map();
    (pregnancies || []).forEach(pgi => {
      if (pgi.patient_id) pgiMap.set(pgi.patient_id, pgi);
    });

    // 6. Map patients + their pregnancy + next appointment
    const mapPatient = (p) => {
      const pgi = pgiMap.get(p.id) || {};
      const lmp = pgi.lmd;
      const weeks = lmp ? this.calculateWeeks(lmp) : 0;
      const trimester = lmp ? this.getTrimesterFromWeek(weeks) : 1;

      const risk = (() => {
        const r = (pgi.calculated_risk || '').toLowerCase();
        if (r.includes('high')) return 'High';
        if (r.includes('monitor')) return 'Monitor';
        return 'Normal';
      })();

      // Format next appointment date
      const rawNextAppt = nextApptMap.get(p.id) || null;
      let nextAppt = null;
      if (rawNextAppt) {
        const d = new Date(rawNextAppt);
        nextAppt = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      return {
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Patient',
        station: p.barangay || p.municipality || 'N/A',
        age: p.date_of_birth
          ? Math.floor((new Date() - new Date(p.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
          : null,
        trimester,
        weeks,
        risk,
        edd: pgi.edd || null,
        createdAt: p.created_at,
        nextAppt,
      };
    };

    return patients
      .map(mapPatient)
      .filter(p => p.id && p.name !== 'Unknown Patient');
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

  async getAllMidwives() {
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .select('id, full_name, barangay_assignment, role')
      .ilike('role', '%midwife%')
      .order('full_name');

    return error ? [] : (data || []);
  }

  async searchPatients(query) {
    const term = (query || '').trim();
    if (!term || term.length < 2) return [];

    const safeTerm = encodeURIComponent(term.trim().replace(/%/g, '\\%'));

    const { data: patients, error } = await this.supabase
      .from('patient_basic_info')
      .select(`
        id,
        first_name,
        last_name,
        barangay,
        province
      `)
      .or(
        `first_name.ilike.%${safeTerm}%,
         last_name.ilike.%${safeTerm}%,
         barangay.ilike.%${safeTerm}%`
          .replace(/\s+/g, '')
      )
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return (patients || []).map(patient => ({
      id: patient.id,
      name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
      station: `${patient.barangay || 'No Barangay'}, ${patient.province || 'N/A'}`
    }));
  }

  generateVisitSchedule(lmp, { visitCount = 9, time = '09:00' } = {}) {
    if (!lmp) return [];
    const lmpDate = new Date(lmp);
    if (Number.isNaN(lmpDate.getTime())) return [];

    const weekOffsets = [4, 8, 12, 16, 20, 24, 28, 32, 36].slice(0, visitCount);

    return weekOffsets.map((weeks, index) => ({
      date: this.addWeeksToDate(lmpDate, weeks),
      week: weeks,
      visitNumber: index + 1,
      trimester: this.getTrimesterFromWeek(weeks),
      scheduled_time: `${time}:00`,
      type: 'Routine Prenatal'
    }));
  }

  generateSemesterSchedule(lmp, { time = '09:00' } = {}) {
    if (!lmp) return [];
    const lmpDate = new Date(lmp);
    if (Number.isNaN(lmpDate.getTime())) return [];

    const semesters = [
      { startWeek: 2, endWeek: 13, name: '1st Trimester', visits: [0, 2, 4] },
      { startWeek: 14, endWeek: 26, name: '2nd Trimester', visits: [0, 2, 4] },
      { startWeek: 27, endWeek: 40, name: '3rd Trimester', visits: [0, 2, 4] }
    ];

    let visitNumber = 1;
    const schedule = [];

    for (const semester of semesters) {
      for (let offset of semester.visits) {
        const week = semester.startWeek + offset;
        schedule.push({
          date: this.addWeeksToDate(lmpDate, week),
          week: week,
          visitNumber: visitNumber++,
          trimester: this.getTrimesterFromWeek(week),
          scheduled_time: `${time}:00`,
          type: 'Routine Prenatal'
        });
      }
    }

    return schedule;
  }

  async insertPrenatalSchedule(patientId, schedulePreview, createdBy, patientData = {}) {
    if (!Array.isArray(schedulePreview) || schedulePreview.length === 0) return;

    const rows = schedulePreview.map((visit, index) => ({
      patient_id: patientId,
      created_by: createdBy,
      visit_date: visit.date,
      visit_number: index + 2,
      trimester: visit.trimester,
      gestational_age: `${visit.week}w`,
      scheduled_time: visit.scheduled_time,
      next_appt_type: visit.type || 'Routine Prenatal',
      status: 'Scheduled',
      assigned_midwife: patientData.assignedMidwife || null,
      assigned_doctor: patientData.assignedDoctor || null,
      bhw_assigned: createdBy,
      created_at: new Date().toISOString()
    }));

    const { error } = await this.supabase.from('prenatal_visits').insert(rows);
    if (error) {
      console.error('Error inserting prenatal schedule:', error);
    }
  }

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
      risk: 'Normal', 
      status: calculateVisitStatus(visit.visit_date),
    }));
  } catch (error) {
    console.error('Error fetching prenatal visits:', error);
    return [];
  }
}

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
      risk: 'Normal', 
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
    
    let hash = 0;
    const str = patientId + visitDate;
    for (let i = 0; i < str.length; i++) {
        hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return timeSlots[Math.abs(hash) % timeSlots.length];
  }

  async addPatient(patientData) {
    const createdBy = await this.getCurrentUserId();
    if (!createdBy) throw new Error("No logged-in user");

    const patientId = crypto.randomUUID();

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
    });

    if (patientData.firstVisitDate) {
      const today = new Date().toISOString().split('T')[0];
      const firstVisitDate = patientData.firstVisitDate || today;
      const firstVisitTime = patientData.firstVisitTime ? `${patientData.firstVisitTime}:00` : '09:00:00';
      const upcomingSchedule = Array.isArray(patientData.schedulePreview) ? patientData.schedulePreview : [];
      const nextApptDate = upcomingSchedule.find(v => new Date(v.date) > new Date(firstVisitDate))?.date || null;
      const bpMatch = patientData.bp ? patientData.bp.match(/^(\d+)[/\\s](\d+)$/) : null;

      await this.supabase.from('prenatal_visits').insert({
        patient_id: patientId,
        visit_date: firstVisitDate,
        visit_number: 1,
        trimester: this.calculateTrimester(patientData.lmp),
        gestational_age: patientData.gestationalAge || (this.calculateWeeks(patientData.lmp) > 0 ? `${this.calculateWeeks(patientData.lmp)} weeks` : '1st visit'),
        bp_systolic: bpMatch ? parseInt(bpMatch[1]) : null,
        bp_diastolic: bpMatch ? parseInt(bpMatch[2]) : null,
        weight_kg: patientData.weight ? parseFloat(patientData.weight) : null,
        temp_c: patientData.temp ? parseFloat(patientData.temp) : null,
        pulse_bpm: patientData.pulse ? parseInt(patientData.pulse) : null,
        resp_rate_cpm: patientData.respRate ? parseInt(patientData.respRate) : null,
        fundal_height_cm: patientData.fundalHeight ? parseFloat(patientData.fundalHeight) : null,
        fhr_bpm: patientData.fhr ? parseInt(patientData.fhr) : null,
        fetal_movement: patientData.fetalMovement || null,
        presentation: patientData.presentation || null,
        tests_done: patientData.testsDone ? patientData.testsDone.split(',').map(s => s.trim()).filter(Boolean) : null,
        supplements_given: patientData.supplementsGiven || null,
        clinical_notes: patientData.visitNotes || 'Initial registration visit',
        next_appt_date: nextApptDate,
        next_appt_type: 'Follow-up Checkup',
        scheduled_time: firstVisitTime,
        status: 'Attended',
        attended_date: new Date().toISOString(),
        assigned_midwife: patientData.assignedMidwife || null,
        assigned_doctor: patientData.assignedDoctor || null,
        bhw_assigned: createdBy,
        created_by: createdBy
      });
    }

    if (patientData.supplementRecords && patientData.supplementRecords.length > 0) {
      const records = patientData.supplementRecords.map(record => ({
        ...record,
        patient_id: patientId,
        created_by: createdBy
      }));
      const { error: suppError } = await this.supabase.from('supplements').insert(records);
      if (suppError) {
        console.error('Error inserting supplements:', suppError);
      }
    }

    if (Array.isArray(patientData.schedulePreview) && patientData.schedulePreview.length) {
      await this.insertPrenatalSchedule(patientId, patientData.schedulePreview, createdBy, patientData);
    } else {
      await this.smartSemesterScheduling({
        patientId, lmp: patientData.lmp, createdBy,
        maxPerDay: 30
      });
    }

    return await this.getPatientById(patientId);
  }

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
      
      const { count: dayCount } = await this.supabase
        .from('prenatal_visits')
        .select('*', { count: 'exact', head: true })
        .eq('visit_date', visitDateStr);

      if (dayCount >= maxPerDay) continue; 

      for (const timeSlot of TIME_SLOTS_8TO4) {
        const timeCount = await this.getSlotCount(visitDateStr, timeSlot);
        
        if (timeCount < 2) {  
          const nextOffset = offset + 2;
          const nextDateStr = this.addWeeksToDate(lmpDate, semester.startWeek + nextOffset);
          const nextTimeSlot = TIME_SLOTS_8TO4[Math.floor(Math.random() * TIME_SLOTS_8TO4.length)]; 
          
          const nextApptDate = new Date(`${nextDateStr}T${nextTimeSlot}:00.000Z`);
          
          await this.supabase.from('prenatal_visits').insert({
            patient_id: patientId,
            visit_date: visitDateStr,
            visit_number: visitNumber++,
            trimester: this.getTrimesterFromWeek(semester.startWeek),
            gestational_age: `${semester.startWeek + offset} weeks`,
            next_appt_date: nextApptDate.toISOString(),  
            next_appt_type: `${semester.name} Checkup`,
            created_by: createdBy
          });
          
          console.log(`✅ Scheduled: ${visitDateStr} ${timeSlot} → Next: ${nextDateStr} ${nextTimeSlot}`);
          break;
        }
      }
    }
  }
}

async getSlotCount(dateStr, timeSlot) {
  const { count } = await this.supabase
    .from('prenatal_visits')
    .select('*', { count: 'exact', head: true })
    .eq('visit_date', dateStr)
    .eq('scheduled_time', timeSlot);
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
        id,
        first_name,
        last_name,
        barangay,
        municipality,
        pregnancy_info (
          calculated_risk,
          risk_factors,
          gravida,
          lmd,
          edd
        ),
        prenatal_visits (
          visit_date,
          status,
          bp_systolic,
          bp_diastolic,
          next_appt_date,
          next_appt_type
        )
      `)
      .neq('pregnancy_info.calculated_risk', 'Normal')
      .not('pregnancy_info.calculated_risk', 'is', null);

    if (error) throw error;

    const result = (data || []).map(p => {
      const preg =
        Array.isArray(p.pregnancy_info)
          ? p.pregnancy_info[0] || {}
          : p.pregnancy_info || {};

      // Only pick latest ATTENDED visit
      let latestAttended = null;
      if (p.prenatal_visits && Array.isArray(p.prenatal_visits)) {
        const attendedVisits = p.prenatal_visits
          .filter(v => v.status === 'Attended' && v.visit_date);

        if (attendedVisits.length > 0) {
          attendedVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
          latestAttended = attendedVisits[0];
        }
      }

      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        barangay: p.barangay,
        municipality: p.municipality,
        pregnancy_info: {
          calculated_risk: preg.calculated_risk || 'Normal',
          risk_factors: preg.risk_factors || null,
          gravida: preg.gravida || 0,
          lmd: preg.lmd || null,
          edd: preg.edd || null,
        },
        // Put latest ATTENDED visit fields on the patient
        bp_systolic: latestAttended?.bp_systolic || null,
        bp_diastolic: latestAttended?.bp_diastolic || null,
        next_appt_date: latestAttended?.next_appt_date || null,
        next_appt_type: latestAttended?.next_appt_type || null,
      };
    });

    return result;
  } catch (err) {
    console.error('Error fetching high risk patients:', err);
    return [];
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
        .select('id, first_name, last_name, date_of_birth, barangay')
        .in('id', patientIds);
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching patients by IDs:', err);
      return [];
    }
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

      pregnancyStatus: preg.pregn_postp || 'Pregnant',
      lmp: preg.lmd || 'N/A',
      edd: preg.edd || 'N/A',
      pregnancyType: preg.pregnancy_type || 'Singleton',
      plannedDeliveryPlace: preg.place_of_delivery || 'N/A',
      risk: preg.calculated_risk || 'Normal',
      gravida: preg.gravida || 1,
      para: preg.para || 0,
      medicalConditions: preg.risk_factors ? preg.risk_factors.split(',').map(s=>s.trim()).filter(Boolean) : [],
      
      trimester: this.calculateTrimester(preg.lmd),
      weeks: this.calculateWeeks(preg.lmd),

      visits: data.prenatal_visits || [],
      vaccines: data.vaccines || [],
      supplements: data.supplements || [],
      newborns: data.newborns || []
    };
  }

  async updatePatient(patientId, updateData) {
    try {
      const { data, error } = await this.supabase
        .from('patient_basic_info')
        .update({
          first_name: updateData.first_name,
          last_name: updateData.last_name,
          date_of_birth: updateData.date_of_birth,
          age: updateData.age,
          civil_status: updateData.civil_status,
          blood_type: updateData.blood_type,
          philhealthnumber: updateData.philhealth,
          contact_no: updateData.phone,
          house_no: updateData.address,
          barangay: updateData.station,
          municipality: updateData.municipality,
          emergency_contact: {
            name: updateData.emergency_contact_name,
            relationship: updateData.emergency_contact_relationship,
            phone: updateData.emergency_contact_phone
          }
        })
        .eq('id', patientId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating patient:', error);
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

  async getMidwivesByStation(station) {
    const { data } = await this.supabase
      .from('staff_profiles')
      .select('id, full_name, barangay_assignment')
      .eq('barangay_assignment', station)
      .ilike('role', '%midwife%');

    return data || [];
  }

  /**
   * BRIDGE METHODS FOR INVENTORY & STATS
   */
  async getVaccineInventory() {
    // Bridges to new InventoryService but returns mapped format expected by Dashboard/Vaccinations
    const data = await inventoryService.getVaccineInventory();
    return data.map(item => ({
      name: item.item_name,
      stock: item.quantity,
      unit: item.unit,
      min: item.min_stock,
      status: item.quantity <= 0 ? 'critical' : item.quantity < item.min_stock ? 'low' : 'ok'
    }));
  }

  async getSupplementInventory() {
    const data = await inventoryService.getSupplementInventory();
    return data.map(item => ({
      id: item.id,
      name: item.item_name,
      stock: item.quantity,
      unit: item.unit || 'units',
    }));
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
          date_administered,
          next_due_date,
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
        .select('patient_id, status, date_administered');
      
      if (vaccError) throw vaccError;
      
      // Get all supplement records
      const { data: suppRecords, error: suppError } = await this.supabase
        .from('supplements')
        .select('patient_id, status, start_date');
      
      if (suppError) throw suppError;
      
      // Get patient information to distinguish mothers vs newborns
      const { data: patients, error: patientError } = await this.supabase
        .from('patient_basic_info')
        .select('id, date_of_birth');
      
      if (patientError) throw patientError;
      
      const patientMap = new Map((patients || []).map(p => [p.id, p]));
      const today = new Date();
      
      // Calculate statistics
      const totalAdministered = (vaccRecords || []).filter(r => r.status === 'Completed').length;
      
      // Count mothers vs newborns with pending vaccinations
      const mothersPending = (vaccRecords || []).filter(r => {
        const patient = patientMap.get(r.patient_id);
        if (!patient) return false;
        
        const age = today.getFullYear() - new Date(patient.date_of_birth).getFullYear();
        const isMother = age >= 18; // Assume 18+ as mothers
        
        return isMother && (r.status === 'Pending' || r.status === 'Overdue');
      }).length;
      
      const newbornsPending = (vaccRecords || []).filter(r => {
        const patient = patientMap.get(r.patient_id);
        if (!patient) return false;
        
        const age = today.getFullYear() - new Date(patient.date_of_birth).getFullYear();
        const isNewborn = age < 1; // Assume < 1 year as newborns
        
        return isNewborn && (r.status === 'Pending' || r.status === 'Overdue');
      }).length;
      
      const supplementsDistributed = (suppRecords || []).filter(r => r.status === 'Ongoing').length;
      
      // Count low stock items from both tables
      const [vax, supp] = await Promise.all([
        inventoryService.getVaccineInventory(),
        inventoryService.getSupplementInventory()
      ]);
      
      const lowStock = [...vax, ...supp].filter(i => i.quantity < i.min_stock).length;
      
      return {
        totalAdministered,
        mothersPending,
        newbornsPending,
        supplementsDistributed,
        lowStockAlerts: lowStock
      };
    } catch (err) {
      console.error('Error fetching vaccination stats:', err);
      return {
        totalAdministered: 0,
        mothersPending: 0,
        newbornsPending: 0,
        supplementsDistributed: 0,
        lowStockAlerts: 0
      };
    }
  }

  async recordVitals(patientId, vitals, supplements) {
    const createdBy = await this.getCurrentUserId();
    if (!createdBy) throw new Error('No logged-in user');

    // Check if visit exists for this date
    const { data: existingVisit } = await this.supabase
      .from('prenatal_visits')
      .select('id')
      .eq('patient_id', patientId)
      .eq('visit_date', vitals.date)
      .maybeSingle();

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
      status: 'Attended',
      attended_date: new Date().toISOString(),
    };

    if (existingVisit) {
      // Update existing
      const { error: visitError } = await this.supabase
        .from('prenatal_visits')
        .update(visitData)
        .eq('id', existingVisit.id);
      if (visitError) throw visitError;
    } else {
      // Insert new
      const { error: visitError } = await this.supabase.from('prenatal_visits').insert(visitData);
      if (visitError) throw visitError;
    }

    // Handle supplements
    for (const sup of supplements) {
      const amount = parseInt(sup.amount);
      if (amount <= 0) continue;

      // Check stock
      const currentStock = await inventoryService.getSupplementInventory().then(data => data.find(i => i.id === sup.id)?.quantity || 0);
      if (currentStock < amount) throw new Error(`Insufficient stock for supplement`);

      // Insert supplement record
      const supData = {
        patient_id: patientId,
        supplement_inventory_id: sup.id,
        dosage: `${amount} ${sup.unit || 'units'}`,
        start_date: vitals.date,
        status: 'Completed',
        created_by: createdBy,
      };

      const { error: supError } = await this.supabase.from('supplements').insert(supData);
      if (supError) throw supError;

      await inventoryService.updateInventoryQuantity('supplement_inventory', sup.id, currentStock - amount);
    }
  }
}