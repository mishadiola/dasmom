import supabase from '../config/supabaseclient';
import AuthService from './authservice';

const authService = new AuthService();
export default class PatientService {
  constructor() {
    this.supabase = supabase;
  }

  // barangay
  async getAvailableBarangays() {
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

  async getDoctorsByBarangay(barangay) {
    const { data, error } = await this.supabase
      .from('staff_profiles')
      .select('id, full_name, barangay_assignment')
      .eq('barangay_assignment', barangay)
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
      console.log('✅ Found patient usertype:', patientUserTypeId);

      // patient acc
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
      console.log('✅ users record created:', patientId);
        const createdBy = authService.getAuthUser()?.id || null;
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
          barangay: patientData.barangay,
          province: patientData.province,
          philhealthnumber: patientData.philhealth || null,
          created_by: createdBy,
        });

      if (basicError) throw basicError;
      console.log('✅ patient_basic_info created');

      // pregnancy_info
      const { error: pregError } = await this.supabase
        .from('pregnancy_info')
        .insert({
          patient_id: patientId,
          created_by: createdBy,
          pregn_postp: patientData.pregnancyStatus,
          lmd: patientData.lmp,
          edd: patientData.edd,
          pregnancy_type: patientData.pregnancyType,
          place_of_delivery: patientData.plannedDeliveryPlace
        });

      if (pregError) throw pregError;
      console.log('✅ pregnancy_info created');

      // scheduling na may limit
      await this.autoScheduleVisitsOldStyle({
        patientId,
        lmp: patientData.lmp,
        barangay: patientData.barangay,
        bhwAssigned: patientData.bhwAssigned,
        midwifeId: patientData.assignedMidwife,
        doctorId: patientData.assignedDoctor,
        createdBy
      });

      console.log('🎉 COMPLETE: users + patient + visits!');
      const fullPatient = await this.getPatientById(patientId);
      console.log('👶 New patient profile:', fullPatient);
      return fullPatient;

    } catch (error) {
      console.error('💥 addPatient FAILED:', error);
      throw new Error(`Failed to add patient: ${error.message}`);
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
        if (visitWeek > 40) break;  // ✅ Original break condition

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

  // ----------------- ✅ 35 MAX SLOTS + IF/ELSE -----------------
  async bookVisitIfSlotAvailable(visitData, barangay) {
    // Count existing visits for this date
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

    const { data: pregnancy } = await this.supabase
      .from('pregnancy_info')
      .select('*')
      .eq('patient_id', patientId)
      .single();

    const { data: visits } = await this.supabase
      .from('prenatal_visits')
      .select('*')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: true });

    return {
      id: basic.id,
      name: `${basic.first_name} ${basic.middle_name || ''} ${basic.last_name} ${basic.suffix || ''}`.trim(),
      firstName: basic.first_name,
      lastName: basic.last_name,
      dob: basic.date_of_birth,
      age: this.calculateAge(basic.date_of_birth),
      phone: basic.contact_no,
      barangay: basic.barangay,
      municipality: basic.municipality,
      province: basic.province,
      emergencyContact: basic.emergency_contact || 'N/A',
      bloodType: basic.blood_type || 'N/A',
      philhealth: basic.philhealthnumber,
      risk: pregnancy?.risk_level || 'Low', 
      
      pregnancyStatus: pregnancy?.pregn_postp,
      lmp: pregnancy?.lmd,
      edd: pregnancy?.edd,
      pregnancyType: pregnancy?.pregnancy_type,
      plannedDeliveryPlace: pregnancy?.place_of_delivery,
      
      visits: visits || [],
      vaccines: [],
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
      .select('*')
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
        barangay: basic.barangay || '',
        municipality: basic.municipality || '',
        bloodType: basic.blood_type || 'N/A',
        philhealth: basic.philhealthnumber || '',
        risk: pregnancy?.risk_level || 'Normal',
        trimester: pregnancy ? this.calculateTrimester(pregnancy.lmd) : 1,
        weeks: pregnancy ? this.calculateGestationalWeeks(pregnancy.lmd) : 0,
        lmp: pregnancy?.lmd || '',
        edd: pregnancy?.edd || '',
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


}
