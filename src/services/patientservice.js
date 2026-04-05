// services/patientService.js
/*
import supabase from '../config/supabaseclient';
import AuthService from './authservice';

const authService = new AuthService();

export default class PatientService {
  static async addPatient(formData) {
    try {
      const currentUser = authService.getUser();
      if (!currentUser) throw new Error("User not logged in");

      // 1. Get staff profile id
      const { data: staffProfile, error: staffError } = await supabase
        .from('staff_profiles')
        .select('id, full_name')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (staffError) throw staffError;
      if (!staffProfile) throw new Error("Staff profile not found");

      const createdBy = staffProfile.id;

      // 2. Insert new user (for patient)
      const { data: newUser, error: userError } = await supabase
        .from('Users')
        .insert([{ email_address: formData.email }])
        .select()
        .single();

      if (userError) throw userError;

      const patientId = newUser.id;

      // 3. Insert patient_basic_info
      const { error: basicInfoError } = await supabase
        .from('patient_basic_info')
        .insert([{
          id: patientId,
          first_name: formData.firstName,
          last_name: formData.lastName,
          suffix: formData.suffix,
          date_of_birth: formData.dob,
          bloodtype: formData.bloodType || '', // optional
          civil_status: formData.civilStatus,
          house_no: formData.address,
          barangay: formData.barangay,
          municipality: formData.municipality,
          province: formData.province,
          philhealthnumber: formData.philhealth,
          contact_no: formData.contactNumber,
          created_by: createdBy
        }]);

      if (basicInfoError) throw basicInfoError;

      // 4. Insert pregnancy_info
      const { error: pregError } = await supabase
        .from('pregnancy_info')
        .insert([{
          patient_id: patientId,
          created_by: createdBy,
          pregn_postp: formData.pregnancyStatus,
          lmd: formData.lmp,
          edd: formData.edd,
          pregnancy_type: formData.pregnancyType,
          place_of_delivery: formData.plannedDeliveryPlace
        }]);

      if (pregError) throw pregError;

      // 5. Insert initial prenatal visit (optional)
      if (formData.firstVisitDate || formData.weight || formData.bp) {
        const [systolic, diastolic] = formData.bp?.split('/') || [];
        const { error: prenatalError } = await supabase
          .from('prenatal_visits')
          .insert([{
            patient_id: patientId,
            created_by: createdBy,
            visit_date: formData.firstVisitDate,
            bp_systolic: systolic ? parseInt(systolic) : null,
            bp_diastolic: diastolic ? parseInt(diastolic) : null,
            weight_kg: formData.weight || null,
            fhr_bpm: formData.fhr || null,
            gestational_age: formData.gestationalAge || null
          }]);

        if (prenatalError) throw prenatalError;
      }

      return patientId;

    } catch (err) {
      console.error("PatientService.addPatient error:", err);
      throw err;
    }
  }
}
*/

// GET FULL PATIENT PROFILE
import supabase from '../config/supabaseclient';
import AuthService from './authservice';

const authService = new AuthService();

export default class PatientService {
  static async addPatient(formData) {
    try {
      const currentUser = authService.getUser();
      if (!currentUser) throw new Error("User not logged in");

      const { data: staffProfile, error: staffError } = await supabase
        .from('staff_profiles')
        .select('id, full_name')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (staffError) throw staffError;
      if (!staffProfile) throw new Error("Staff profile not found");

      const createdBy = staffProfile.id;

      const { data: newUser, error: userError } = await supabase
        .from('Users')
        .insert([{ email_address: formData.email }])
        .select()
        .single();

      if (userError) throw userError;

      const patientId = newUser.id;

      const { error: basicInfoError } = await supabase
        .from('patient_basic_info')
        .insert([{
          id: patientId,
          first_name: formData.firstName,
          last_name: formData.lastName,
          suffix: formData.suffix,
          date_of_birth: formData.dob,
          bloodtype: formData.bloodType || '', 
          civil_status: formData.civilStatus,
          house_no: formData.address,
          barangay: formData.barangay,
          municipality: formData.municipality,
          province: formData.province,
          philhealthnumber: formData.philhealth,
          contact_no: formData.contactNumber,
          created_by: createdBy
        }]);

      if (basicInfoError) throw basicInfoError;

      const { error: pregError } = await supabase
        .from('pregnancy_info')
        .insert([{
          patient_id: patientId,
          created_by: createdBy,
          pregn_postp: formData.pregnancyStatus,
          lmd: formData.lmp,
          edd: formData.edd,
          pregnancy_type: formData.pregnancyType,
          place_of_delivery: formData.plannedDeliveryPlace
        }]);

      if (pregError) throw pregError;

      if (formData.firstVisitDate || formData.weight || formData.bp) {
        const [systolic, diastolic] = formData.bp?.split('/') || [];
        const { error: prenatalError } = await supabase
          .from('prenatal_visits')
          .insert([{
            patient_id: patientId,
            created_by: createdBy,
            visit_date: formData.firstVisitDate,
            bp_systolic: systolic ? parseInt(systolic) : null,
            bp_diastolic: diastolic ? parseInt(diastolic) : null,
            weight_kg: formData.weight || null,
            fhr_bpm: formData.fhr || null,
            gestational_age: formData.gestationalAge || null
          }]);

        if (prenatalError) throw prenatalError;
      }

      return patientId;

    } catch (err) {
      console.error("PatientService.addPatient error:", err);
    throw err;
  }
}
  
static async getPatientById(patientId) {
    try {
      const { data: basic, error: basicError } = await supabase
        .from('patient_basic_info')
        .select('*')
        .eq('id', patientId)
        .single();

      if (basicError) throw basicError;

      const { data: pregnancy } = await supabase
        .from('pregnancy_info')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: visits } = await supabase
        .from('prenatal_visits')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false });

      const { data: vaccines } = await supabase
        .from('vaccinations')
        .select(`
          *,
          vaccine_inventory (vaccine_name)
        `)
        .eq('patient_id', patientId);

      const { data: supplements } = await supabase
        .from('supplements')
        .select(`
          *,
          supplement_inventory (supplement_name)
        `)
        .eq('patient_id', patientId);


      const fullName = `${basic.first_name} ${basic.last_name}`;

      const today = new Date();
      const dob = new Date(basic.date_of_birth);
      let age = today.getFullYear() - dob.getFullYear();

      const mapped = {
        id: `PT-${patientId}`,
        name: fullName,
        age,
        dob: basic.date_of_birth,
        barangay: basic.barangay,
        phone: basic.contact_no,
        emergencyContact: "N/A",
        risk: "Low",
        bloodType: basic.bloodtype || '-',

        gravida: '-',
        para: '-',
        abortions: '-',
        living: '-',
        pastPregnancies: [],
        conditions: [],

        lmp: pregnancy?.lmd,
        edd: pregnancy?.edd,
        trimester: '-',
        weeks: '-',

        issues: [],

        visits: (visits || []).map(v => ({
          date: v.visit_date,
          type: "Prenatal",
          bp: v.bp_systolic && v.bp_diastolic
            ? `${v.bp_systolic}/${v.bp_diastolic}`
            : '-',
          weight: v.weight_kg ? `${v.weight_kg} kg` : '-',
          fh: v.fundal_height_cm ? `${v.fundal_height_cm} cm` : '-',
          fht: v.fhr_bpm ? `${v.fhr_bpm} bpm` : '-',
          notes: v.clinical_notes || ''
        })),

        vaccines: (vaccines || []).map(v => ({
          name: v.vaccine_inventory?.vaccine_name || 'Unknown',
          date: v.date_administered,
          status: v.status
        })),

        supplements: (supplements || []).map(s => ({
          name: s.supplement_inventory?.supplement_name || 'Unknown',
          status: s.status
        }))
      };

      return mapped;

    } catch (err) {
      console.error("getPatientById error:", err);
      throw err;
    }
  }

  static async getAllPatients() {
    try {
      const { data, error } = await supabase
        .from('patient_basic_info')
        .select(`
          id,
          first_name,
          last_name,
          barangay,
          date_of_birth
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: pregnancies } = await supabase
        .from('pregnancy_info')
        .select('*');

      const { data: visits } = await supabase
        .from('prenatal_visits')
        .select('*');

      const mapped = (data || []).map(p => {
        const pregnancy = pregnancies?.find(pr => pr.patient_id === p.id);

        const patientVisits = visits?.filter(v => v.patient_id === p.id) || [];

        const latestVisit = patientVisits.sort(
          (a, b) => new Date(b.visit_date) - new Date(a.visit_date)
        )[0];

        const today = new Date();
        const dob = new Date(p.date_of_birth);
        const age = today.getFullYear() - dob.getFullYear();

        return {
          id: `PT-${p.id}`,
          name: `${p.first_name} ${p.last_name}`,
          barangay: p.barangay,
          age: age,

          trimester: this.calculateTrimester(pregnancy?.lmd),
          weeks: this.calculateWeeks(pregnancy?.lmd),

          risk: "Normal", 

          lastVisit: latestVisit
            ? this.formatRelativeDate(latestVisit.visit_date)
            : 'No visits',

          nextAppt: latestVisit?.next_appt_date || 'Not scheduled',

          status: "Active"
        };
      });

      return mapped;

    } catch (err) {
      console.error("getAllPatients error:", err);
      throw err;
    }
  }


  static calculateWeeks(lmp) {
    if (!lmp) return '-';
    const start = new Date(lmp);
    const now = new Date();
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 7));
    return diff;
  }

  static calculateTrimester(lmp) {
    const weeks = this.calculateWeeks(lmp);
    if (weeks === '-') return '-';

    if (weeks <= 12) return 1;
    if (weeks <= 27) return 2;
    return 3;
  }

  static formatRelativeDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }
}