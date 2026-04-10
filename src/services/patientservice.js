import supabase from '../config/supabaseclient';
import AuthService from './authservice';

const authService = new AuthService();
export default class PatientService {
  constructor() {
    this.supabase = supabase;
  }

  // barangay
  async getAvailableStations() {
    try {
      const { data, error } = await this.supabase
        .from('staff_profiles')
        .select('barangay_assignment')
        .not('barangay_assignment', 'is', null)
        .order('barangay_assignment');

      if (error) return ['Brgy. 1', 'Brgy. 2', 'Brgy. 3'];
      return [...new Set(data.map(s => s.barangay_assignment).filter(Boolean))].sort();
    } catch (err) {
      return ['Brgy. 1', 'Brgy. 2', 'Brgy. 3'];
    }
  }

  async getAllMidwives() {
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .select('id, full_name, barangay_assignment, role')
      .ilike('role', '%midwife%')
      .order('full_name');
    return error ? [] : (data || []);
  }

  async getDoctorsByStation(station) {
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .select('id, full_name, barangay_assignment')
      .eq('barangay_assignment', station)
      .ilike('role', '%doctor%')
      .order('full_name');
    return error ? [] : (data || []);
  }

  //patient creation + scheduling
  async addPatient(patientData, createdBy) {
    try {
      console.log('🔄 Creating patient + visits...');

      const { data: userTypeData, error: typeError } = await this.supabase
        .from('user_type')
        .select('id')
        .ilike('user_type', '%patient%')
        .limit(1);

      if (typeError || !userTypeData?.length) {
        throw new Error('No patient usertype found in user_type table');
      }

      const patientUserTypeId = userTypeData[0].id;

      // 1. Create User Account
      const patientId = crypto.randomUUID();
      const { error: userError } = await this.supabase
        .from('users')
        .insert({
          id: patientId,
          email_address: patientData.email,
          password: 'Patient123!',  
          usertype: patientUserTypeId  
        });

      if (userError) throw userError;

      // 2. Patient Basic Info
      const { error: basicError } = await this.supabase
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
          emergency_contact: JSON.stringify({
            name: patientData.emName,
            relationship: patientData.emRel,
            phone: patientData.emPhone,
            address: patientData.emAddress
          }),
          created_by: createdBy,
        });

      if (basicError) throw basicError;

      // 3. Pregnancy Info
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
          risk_level: patientData.riskLevel || 'Normal',
          gravida: parseInt(patientData.gravida) || 1,
          para: parseInt(patientData.para) || 0,
          clinical_notes: JSON.stringify({
            conditions: patientData.conditions,
            other: patientData.otherConditions
          })
        });

      if (pregError) throw pregError;

      // 4. Initial Vitals as First Visit
      if (patientData.bp && patientData.weight) {
        await this.supabase.from('prenatal_visits').insert({
          patient_id: patientId,
          visit_date: patientData.firstVisitDate || new Date().toISOString().split('T')[0],
          visit_number: 1,
          trimester: this.calculateTrimester(patientData.lmp),
          gestational_age: patientData.gestationalAge,
          bp: patientData.bp,
          weight: patientData.weight,
          height: patientData.height,
          fht: patientData.fhr,
          created_by: createdBy,
          notes: 'Initial registration vitals',
          assigned_midwife: patientData.assignedMidwife || null,
          assigned_doctor: patientData.assignedDoctor || null
        });
      }

      // 5. Auto Scheduling
      await this.autoScheduleVisitsOldStyle({
        patientId,
        lmp: patientData.lmp,
        barangay: patientData.station,
        bhwAssigned: patientData.bhwAssigned,
        midwifeId: patientData.assignedMidwife,
        doctorId: patientData.assignedDoctor,
        createdBy
      });

      return await this.getPatientById(patientId);
    } catch (error) {
      console.error('💥 addPatient FAILED:', error);
      throw error;
    }
  }

  async autoScheduleVisitsOldStyle({ patientId, lmp, barangay, bhwAssigned, midwifeId, doctorId, createdBy }) {
    const lmpDate = new Date(lmp);
    const today = new Date();
    const diffDays = Math.ceil(Math.abs(today - lmpDate) / (1000 * 60 * 60 * 24));
    const currentWeeks = Math.floor(diffDays / 7);

    const semesters = 4;
    const visitsPerSemester = 3;
    let visitsCreated = 0;

    console.log(`📅 OLD STYLE: ${currentWeeks}w → scheduling (max 35/day)`);

    for (let semester = 0; semester < semesters; semester++) {
      const trimesterLength = 13;
      const spacing = Math.floor(trimesterLength / visitsPerSemester);

      const semesterStart = semester * trimesterLength;

      for (let visit = 1; visit <= visitsPerSemester; visit++) {
        const visitWeek = semesterStart + (visit * spacing);
        if (visitWeek > 40) break;  

        const visitDate = this.addWeeksToDate(lmpDate, visitWeek);
        const visitNumber = (semester * 3) + visit;
        const trimester = Math.ceil(visitWeek / 13);

        const visitData = {
          patient_id: patientId,
          created_by: createdBy,
          visit_date: visitDate,
          visit_number: visitNumber,
          trimester,
          gestational_age: `${visitWeek}w 0d`,
          next_appt_type: 'Routine Prenatal',
          bhw_assigned: createdBy,
          assigned_midwife: midwifeId || null,
          assigned_doctor: doctorId || null,
          created_at: new Date().toISOString()
        };

        const success = await this.bookVisitIfSlotAvailable(visitData, barangay);
        if (success) visitsCreated++;
      }
    }

    console.log(`✅ ${visitsCreated} visits scheduled!`);
  }

  async bookVisitIfSlotAvailable(visitData, barangay) {
    const { count } = await this.supabase
      .from('prenatal_visits')
      .select('*', { count: 'exact', head: true })
      .eq('visit_date', visitData.visit_date);

    if (count >= 35) {
      console.warn(`❌ MAX SLOTS (35/${count}): ${visitData.visit_date}`);
      return false;  
    } 
    else if (count < 35) {
      const { error } = await this.supabase.from('prenatal_visits').insert(visitData);
      if (error) {
        console.error('Insert failed:', error);
        return false;
      }
      console.log(`✅ Booked (${count + 1}/35): ${visitData.visit_date}`);
      return true;
    }
  }

  addWeeksToDate(date, weeks) {
    const result = new Date(date);
    result.setDate(result.getDate() + weeks * 7);
    return result.toISOString().split('T')[0];
  }

  async getPatientById(patientId) {
    try {
      const { data: basic } = await this.supabase
        .from('patient_basic_info')
        .select('*')
        .eq('id', patientId)
        .single();

      if (!basic) return null;

      const [pregnancyRes, visitsRes, vaccineRes, supplementRes, newbornsRes] = await Promise.all([
        this.supabase.from('pregnancy_info').select('*').eq('patient_id', patientId).single(),
        this.supabase.from('prenatal_visits').select('*').eq('patient_id', patientId).order('visit_date', { ascending: true }),
        this.supabase.from('vaccine_records').select('*').eq('patient_id', patientId).order('date_administered', { ascending: false }),
        this.supabase.from('supplement_records').select('*').eq('patient_id', patientId).order('date_given', { ascending: false }),
        this.supabase.from('newborns').select('*').eq('patient_id', patientId).order('birth_date', { ascending: false })
      ]);

      const pregnancy = pregnancyRes.data;
      const visits = visitsRes.data || [];
      const vaccines = vaccineRes.data || [];
      const supplements = supplementRes.data || [];
      const newborns = newbornsRes.data || [];

      // Parse Emergency Contact
      let emContact = { name: 'N/A', relationship: '', phone: '', address: '' };
      try {
        if (basic.emergency_contact) {
          emContact = typeof basic.emergency_contact === 'string' ? JSON.parse(basic.emergency_contact) : basic.emergency_contact;
        }
      } catch (e) { console.error('Error parsing emContact', e); }

      // Parse Clinical Notes (Conditions)
      let clinicalNotes = { conditions: [], other: '' };
      try {
        if (pregnancy?.clinical_notes) {
          clinicalNotes = typeof pregnancy.clinical_notes === 'string' ? JSON.parse(pregnancy.clinical_notes) : pregnancy.clinical_notes;
        }
      } catch (e) { console.error('Error parsing clinicalNotes', e); }

      return {
        id: basic.id,
        name: `${basic.first_name} ${basic.middle_name || ''} ${basic.last_name} ${basic.suffix || ''}`.trim(),
        firstName: basic.first_name,
        lastName: basic.last_name,
        dob: basic.date_of_birth,
        age: this.calculateAge(basic.date_of_birth),
        phone: basic.contact_no,
        station: basic.barangay,
        address: basic.house_no,
        municipality: basic.municipality,
        province: basic.province,
        civilStatus: basic.civil_status,
        philhealth: basic.philhealthnumber,
        bloodType: basic.blood_type || 'N/A',
        emergencyContact: emContact,
        
        risk: pregnancy?.risk_level || 'Normal',
        pregnancyStatus: pregnancy?.pregn_postp,
        lmp: pregnancy?.lmd,
        edd: pregnancy?.edd,
        pregnancyType: pregnancy?.pregnancy_type,
        plannedDeliveryPlace: pregnancy?.place_of_delivery,
        gravida: pregnancy?.gravida,
        para: pregnancy?.para,
        medicalConditions: clinicalNotes.conditions || [],
        otherMedicalNotes: clinicalNotes.other || '',
        
        visits: visits,
        vaccines: vaccines,
        supplements: supplements,
        newborns: newborns,
        trimester: this.calculateTrimester(pregnancy?.lmd),
        weeks: this.calculateGestationalWeeks(pregnancy?.lmd)
      };
    } catch (error) {
      console.error('Error fetching patient:', error);
      return null;
    }
  }

  calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  async getAllPatients() {
    try {
      const { data: basics } = await this.supabase
        .from('patient_basic_info')
        .select('*, created_at')
        .order('last_name', { ascending: true });

      if (!basics || basics.length === 0) return [];

      const patientIds = basics.map(b => b.id);

      const { data: pregnancies } = await this.supabase
        .from('pregnancy_info')
        .select('*')
        .in('patient_id', patientIds);

      const { data: visits } = await this.supabase
        .from('prenatal_visits')
        .select('patient_id, visit_date, next_appt_type')
        .in('patient_id', patientIds)
        .order('visit_date', { ascending: true });

      const patients = basics.map(basic => {
        const pregnancy = pregnancies?.find(p => p.patient_id === basic.id);
        const patientVisits = visits?.filter(v => v.patient_id === basic.id) || [];
        const nextVisit = patientVisits[0];

        return {
          id: basic.id,
          name: `${basic.first_name} ${basic.middle_name || ''} ${basic.last_name}${basic.suffix ? `, ${basic.suffix}` : ''}`.trim(),
          firstName: basic.first_name,
          lastName: basic.last_name,
          dob: basic.date_of_birth,
          age: this.calculateAge(basic.date_of_birth),
          phone: basic.contact_no || '',
          station: basic.barangay || '',
          municipality: basic.municipality || '',
          bloodType: basic.blood_type || 'N/A',
          philhealth: basic.philhealthnumber || '',
          risk: pregnancy?.risk_level || 'Normal',
          trimester: pregnancy ? this.calculateTrimester(pregnancy.lmd) : 1,
          weeks: pregnancy ? this.calculateGestationalWeeks(pregnancy.lmd) : 0,
          lmp: pregnancy?.lmd || '',
          edd: pregnancy?.edd || '',
          createdAt: basic.created_at,
          nextAppt: nextVisit ? nextVisit.visit_date : '-',
          nextApptType: nextVisit?.next_appt_type || 'Routine'
        };
      });

      return patients;
    } 
    catch (error) {
      console.error('Error fetching patients list:', error);
      return [];
    }
  }

  calculateTrimester(lmp) {
    if (!lmp) return 1;
    const lmpDate = new Date(lmp);
    const today = new Date();
    const diffDays = Math.ceil(Math.abs(today - lmpDate) / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    if (weeks < 13) return 1;
    if (weeks < 27) return 2;
    return 3;
  }

  calculateGestationalWeeks(lmp) {
    if (!lmp) return 0;
    const lmpDate = new Date(lmp);
    const today = new Date();
    const diffDays = Math.ceil(Math.abs(today - lmpDate) / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7);
  }

  async getHighRiskStats() {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const { count: totalHighRisk } = await this.supabase
        .from('pregnancy_info')
        .select('*', { count: 'exact', head: true })
        .eq('risk_level', 'High Risk');

      const { data: todayVisits } = await this.supabase
        .from('prenatal_visits')
        .select('patient_id')
        .eq('visit_date', todayStr);
      
      const todayPatientIds = (todayVisits || []).map(v => v.patient_id);
      let criticalTodayCount = 0;
      if (todayPatientIds.length > 0) {
        const { count } = await this.supabase
          .from('pregnancy_info')
          .select('id', { count: 'exact', head: true })
          .in('patient_id', todayPatientIds)
          .eq('risk_level', 'High Risk');
        criticalTodayCount = count || 0;
      }

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const { count: missedCount } = await this.supabase
        .from('prenatal_visits')
        .select('*', { count: 'exact', head: true })
        .lt('visit_date', todayStr)
        .gte('visit_date', lastWeek.toISOString().split('T')[0])
        .eq('status', 'Pending'); 

      return {
        totalHighRisk: totalHighRisk || 0,
        criticalToday: criticalTodayCount,
        missedFollowups: missedCount || 0,
        needsImmediate: (totalHighRisk || 0) > 10 ? 3 : 0 
      };
    } catch (err) {
      console.error('Error fetching high risk stats:', err);
      return { totalHighRisk: 0, criticalToday: 0, missedFollowups: 0, needsImmediate: 0 };
    }
  }

  async getHighRiskPatients() {
    try {
      const { data: pregData } = await this.supabase
        .from('pregnancy_info')
        .select('patient_id, risk_level, lmd, edd, clinical_notes')
        .neq('risk_level', 'Normal');

      if (!pregData || pregData.length === 0) return [];

      const pids = pregData.map(p => p.patient_id);

      const { data: basicData } = await this.supabase
        .from('patient_basic_info')
        .select('id, first_name, last_name, barangay')
        .in('id', pids);

      const { data: allVisits } = await this.supabase
        .from('prenatal_visits')
        .select('*')
        .in('patient_id', pids)
        .order('visit_date', { ascending: false });

      return pregData.map(p => {
        const basic = basicData?.find(b => b.id === p.patient_id);
        const patientVisits = allVisits?.filter(v => v.patient_id === p.patient_id) || [];
        const lastVisit = patientVisits.find(v => new Date(v.visit_date) <= new Date());
        const nextVisit = patientVisits.find(v => new Date(v.visit_date) > new Date());

        const clinicalNotes = typeof p.clinical_notes === 'string' ? JSON.parse(p.clinical_notes || '{}') : p.clinical_notes;
        const conditions = clinicalNotes?.conditions || [];
        const otherNotes = clinicalNotes?.other || '';
        
        return {
          id: p.patient_id,
          name: basic ? `${basic.first_name} ${basic.last_name}` : 'Unknown',
          station: basic?.barangay || 'N/A',
          riskLevel: p.risk_level,
          edd: p.edd || 'TBD',
          weeks: this.calculateGestationalWeeks(p.lmd),
          trimester: this.calculateTrimester(p.lmd),
          condition: conditions.length > 0 ? conditions.join(', ') : (otherNotes || 'High Risk'),
          bp: lastVisit?.bp || '120/80',
          lastVisit: lastVisit?.visit_date || 'N/A',
          nextVisit: nextVisit?.visit_date || 'Pending',
          status: nextVisit ? 'Scheduled' : 'Needs Schedule'
        };
      });
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

  async getVaccinationStats() {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const { count: totalVaccines } = await this.supabase
        .from('vaccine_records')
        .select('*', { count: 'exact', head: true });

      const { count: mothersPending } = await this.supabase
        .from('prenatal_visits')
        .select('*', { count: 'exact', head: true })
        .gte('visit_date', todayStr)
        .ilike('next_appt_type', '%vaccine%');

      const { count: supplementsCount } = await this.supabase
        .from('supplement_records')
        .select('*', { count: 'exact', head: true });

      const { data: stockItems } = await this.supabase
        .from('inventory')
        .select('quantity, threshold');
      
      const lowStockCount = (stockItems || []).filter(item => item.quantity <= (item.threshold || 10)).length;

      return {
        totalAdministered: totalVaccines || 0,
        mothersPending: mothersPending || 0,
        newbornsPending: 0, 
        supplementsDistributed: supplementsCount || 0,
        lowStockAlerts: lowStockCount || 0
      };
    } catch (err) {
      console.error('Error fetching vaccination stats:', err);
      return { totalAdministered: 0, mothersPending: 0, newbornsPending: 0, supplementsDistributed: 0, lowStockAlerts: 0 };
    }
  }

  async getVaccineInventory() {
    try {
      const { data, error } = await this.supabase
        .from('inventory')
        .select('*')
        .order('item_name');

      if (error) throw error;

      return (data || []).map(item => ({
        name: item.item_name,
        stock: item.quantity,
        min: item.threshold || 20,
        unit: item.unit || 'vials',
        status: item.quantity <= (item.threshold || 20) ? 'low' : 'ok'
      }));
    } catch (err) {
      console.error('Error fetching vaccine inventory:', err);
      return [];
    }
  }
}
