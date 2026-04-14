import supabase from '../config/supabaseClient';
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
    const { data } = await this.supabase
      .from('staff_profiles')
      .select('full_name')
      .or('role.ilike.%midwife%,role.ilike.%doctor%');
    return data?.map(s => s.full_name) || [];
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

    if (patientData.bp && patientData.weight) {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
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
        next_appt_date: nextWeek, 
        next_appt_type: 'Follow-up Checkup',
        created_by: createdBy
      });
    }

    await this.smartSemesterScheduling({
      patientId, lmp: patientData.lmp, createdBy,
      maxPerDay: 30 
    });
  }

  async updatePatient(patientId, formData) {
    if (!patientId) throw new Error("Patient ID is required for updates");

    // 1. Update User Email
    const { error: err0 } = await this.supabase
      .from('users')
      .update({ email_address: formData.email })
      .eq('id', patientId);
    if (err0) throw err0;

    // 2. Update Basic Info
    const { error: err1 } = await this.supabase
      .from('patient_basic_info')
      .update({
        first_name: formData.firstName,
        middle_name: formData.middleName || null,
        last_name: formData.lastName,
        suffix: formData.suffix || null,
        date_of_birth: formData.dob,
        civil_status: formData.civilStatus || null,
        contact_no: formData.contactNumber,
        house_no: formData.address || '',
        municipality: formData.municipality,
        barangay: formData.station,
        province: formData.province,
        philhealthnumber: formData.philhealth || null,
        emergency_contact: {
          name: formData.emName || null,
          relationship: formData.emRel || null,
          phone: formData.emPhone || null,
          address: formData.emAddress || null
        }
      })
      .eq('id', patientId);
    if (err1) throw err1;

    // 3. Update Pregnancy Info
    const { error: err2 } = await this.supabase
      .from('pregnancy_info')
      .update({
        pregn_postp: formData.pregnancyStatus,
        lmd: formData.lmp,
        edd: formData.edd,
        pregnancy_type: formData.pregnancyType,
        place_of_delivery: formData.plannedDeliveryPlace,
        calculated_risk: formData.riskLevel || 'Normal',
        gravida: parseInt(formData.gravida) || 1,
        para: parseInt(formData.para) || 0,
        risk_factors: Array.isArray(formData.conditions) && formData.conditions.length > 0 
          ? formData.conditions.join(', ') : null
      })
      .eq('patient_id', patientId);
    if (err2) throw err2;

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

  async getPatientById(patientId) {
    const { data, error } = await this.supabase
      .from('patient_basic_info')
      .select(`
        *,
        users!inner(email_address),
        pregnancy_info(*),
        prenatal_visits(*)
      `)
      .eq('id', patientId)
      .single();

    if (error || !data) return null;

    const preg = Array.isArray(data.pregnancy_info) ? data.pregnancy_info[0] : data.pregnancy_info || {};
    const email = data.users?.email_address || 'N/A';

    return {
      ...data,
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      age: this.calculateAge(data.date_of_birth),
      station: data.barangay,
      phone: data.contact_no || 'N/A',
      email: email,
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

  async getVaccinationStats() {
    try {
      // 1. Total vaccination records administered (vaccine_records table)
      const { count: totalAdministered } = await this.supabase
        .from('vaccine_records')
        .select('*', { count: 'exact', head: true });

      // 2. Mothers pending vaccines: patients with pregnancy_info but NO vaccine_records
      const { data: allPatientIds } = await this.supabase
        .from('pregnancy_info')
        .select('patient_id');

      const { data: vaccinatedPatientIds } = await this.supabase
        .from('vaccine_records')
        .select('patient_id');

      const vaccinatedSet = new Set((vaccinatedPatientIds || []).map(v => v.patient_id));
      const mothersPending = (allPatientIds || []).filter(p => !vaccinatedSet.has(p.patient_id)).length;

      // 3. Newborns pending vaccines: newborns with no vaccine entry in vaccine_records
      const { data: allNewborns } = await this.supabase
        .from('newborns')
        .select('patient_id');

      const newbornMotherIds = [...new Set((allNewborns || []).map(n => n.patient_id).filter(Boolean))];
      let newbornsPending = 0;
      if (newbornMotherIds.length > 0) {
        const { data: newbornVaccRecords } = await this.supabase
          .from('vaccine_records')
          .select('patient_id')
          .in('patient_id', newbornMotherIds);
        const newbornVaccinatedSet = new Set((newbornVaccRecords || []).map(v => v.patient_id));
        newbornsPending = newbornMotherIds.filter(id => !newbornVaccinatedSet.has(id)).length;
      }

      // 4. Supplements distributed: sum all quantities from supplement_inventory records
      const { data: suppData } = await this.supabase
        .from('supplement_inventory')
        .select('quantity');
      const supplementsDistributed = (suppData || []).reduce((sum, row) => sum + (row.quantity ?? 0), 0);

      // 5. Low stock items: items below min_stock in both inventory tables
      const [vax, supp] = await Promise.all([
        inventoryService.getVaccineInventory(),
        inventoryService.getSupplementInventory()
      ]);
      const lowStockAlerts = [...vax, ...supp].filter(i => i.quantity < i.min_stock).length;

      return {
        totalAdministered: totalAdministered || 0,
        mothersPending,
        newbornsPending,
        supplementsDistributed,
        lowStockAlerts
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
}