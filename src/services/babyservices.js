import supabase from '../config/supabaseclient';
import AuthService from './authservice';
import PatientService from './patientservice';

class BabyService {
  constructor() {
    this.authService = new AuthService();
    this.patientService = new PatientService();
  }

  async getCurrentUserId() {
    const user = await this.authService.getAuthUser();
    return user?.id || null;
  }

 async searchPregnantMothers(query) {
  try {
    const term = (query || '').trim();
    if (!term || term.length < 2) return [];

    const safeTerm = encodeURIComponent(term.trim().replace(/%/g, '\\%'));

    const { data: patients, error } = await supabase
      .from('patient_basic_info')
      .select(`
        id,
        first_name,
        last_name,
        barangay,
        province,
        pregnancy_info (
          id,
          calculated_risk,
          pregn_postp,
          edd
        )
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

    return (patients || []).map(patient => {
      const preg = Array.isArray(patient.pregnancy_info)
        ? patient.pregnancy_info[0]
        : patient.pregnancy_info;

      return {
        id: patient.id,
        name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        station: `${patient.barangay || 'No Barangay'}, ${patient.province || 'N/A'}`,
        riskLevel: preg?.calculated_risk || 'Normal',
        isPregnant: !!preg?.id
      };
    });
  } catch (error) {
    console.error('Error in searchPregnantMothers:', error);
    return [];
  }
}

  async getAllDeliveries() {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id,
          delivery_date,
          delivery_time,
          delivery_type,
          delivery_mode,
          gestational_age,
          risk_level,
          complications,
          facility,
          postpartum_visit_date,
          notes,
          created_at,
          patient_basic_info!deliveries_mother_id_fkey (
            id,
            first_name,
            last_name,
            barangay
          ),
          newborns (
            id,
            gender,
            birth_weight,
            birth_length,
            head_circumference,
            apgar_1min,
            apgar_5min,
            condition_at_birth,
            risk_level
          ),
          staff_profiles!deliveries_attending_staff_fkey (
            full_name
          )
        `)
        .order('delivery_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(d => {
        const newborn = Array.isArray(d.newborns) ? d.newborns[0] : d.newborns;
        const staff = Array.isArray(d.staff_profiles) ? d.staff_profiles[0] : d.staff_profiles;
        return {
          id: d.id,
          patientId: d.patient_basic_info?.id || '',
          patientName: `${d.patient_basic_info?.first_name || ''} ${d.patient_basic_info?.last_name || ''}`.trim(),
          station: d.patient_basic_info?.barangay || 'N/A',
          deliveryDate: d.delivery_date,
          deliveryTime: d.delivery_time,
          deliveryType: d.delivery_type,
          deliveryMode: d.delivery_mode || 'N/A',
          gestationalAge: d.gestational_age || 'N/A',
          riskLevel: d.risk_level || 'Normal',
          complications: Array.isArray(d.complications) && d.complications.length ? d.complications.join(', ') : 'None',
          babyOutcome: newborn?.condition_at_birth || 'Healthy',
          babyGender: newborn?.gender || 'N/A',
          birthWeight: newborn?.birth_weight || null,
          birthLength: newborn?.birth_length || null,
          headCircumference: newborn?.head_circumference || null,
          apgar1: newborn?.apgar_1min || null,
          apgar5: newborn?.apgar_5min || null,
          staff: staff?.full_name || 'Unassigned',
          facility: d.facility || 'N/A',
          postpartumVisitDate: d.postpartum_visit_date || null,
          notes: d.notes || ''
        };
      });
    } catch (error) {
      console.error('Error in getAllDeliveries:', error);
      return [];
    }
  }

  async recordDelivery(deliveryData, newbornData) {
    const createdBy = await this.getCurrentUserId();
    if (!createdBy) throw new Error('No logged-in user');

    const complications = Array.isArray(deliveryData.complications)
      ? deliveryData.complications.filter(c => c && c !== 'None')
      : [];

    const deliveryPayload = {
      mother_id: deliveryData.mother_id,
      delivery_date: deliveryData.delivery_date,
      delivery_time: deliveryData.delivery_time || '00:00',
      delivery_type: deliveryData.delivery_type,
      delivery_mode: deliveryData.delivery_mode || null,
      gestational_age: deliveryData.gestational_age || null,
      risk_level: deliveryData.risk_level || 'Normal',
      complications,
      attending_staff: deliveryData.attending_staff || null,
      facility: deliveryData.facility || null,
      postpartum_visit_date: deliveryData.postpartum_visit_date || null,
      notes: deliveryData.notes || null,
      created_by: createdBy
    };

    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .insert([deliveryPayload])
      .select('id')
      .single();

    if (deliveryError) throw deliveryError;

    const { error: newbornError } = await supabase
      .from('newborns')
      .insert([{
        delivery_id: delivery.id,
        mother_id: deliveryData.mother_id,
        baby_name: newbornData.baby_name || null,
        gender: newbornData.gender,
        birth_weight: newbornData.birth_weight || null,
        birth_length: newbornData.birth_length || null,
        head_circumference: newbornData.head_circumference || null,
        apgar_1min: newbornData.apgar_1min || null,
        apgar_5min: newbornData.apgar_5min || null,
        condition_at_birth: newbornData.condition_at_birth || 'Healthy',
        risk_level: newbornData.risk_level || 'Normal',
        created_by: createdBy
      }]);

    if (newbornError) throw newbornError;

    return { delivery_id: delivery.id };
  }

  async getDeliveryStats() {
    try {
      const deliveries = await this.getAllDeliveries();

      const totalDeliveries = deliveries.length;
      const nsdCount = deliveries.filter(d => d.deliveryType === 'NSD').length;
      const csCount = deliveries.filter(d => d.deliveryType === 'CS').length;
      const complicationCount = deliveries.filter(d => d.complications && d.complications !== 'None').length;
      const highRiskCount = deliveries.filter(d => d.riskLevel === 'High Risk' || d.riskLevel === 'High').length;

      return [
        {
          label: 'Total Deliveries',
          value: totalDeliveries,
          color: 'lilac'
        },
        {
          label: 'Normal vs CS',
          value: `${nsdCount} / ${csCount}`,
          color: 'sage'
        },
        {
          label: 'Complications',
          value: complicationCount,
          color: 'orange'
        },
        {
          label: 'High-Risk Deliveries',
          value: highRiskCount,
          color: 'rose'
        }
      ];
    }
    catch (error) {
      console.error('Error in getDeliveryStats:', error);
      return [
        { label: 'Total Deliveries', value: 0, color: 'lilac' },
        { label: 'Normal vs CS', value: '0 / 0', color: 'sage' },
        { label: 'Complications', value: 0, color: 'orange' },
        { label: 'High-Risk Deliveries', value: 0, color: 'rose' }
      ];
    }
  }

async getStations() 
{
    try {
        const { data, error } = await supabase
            .from('staff_profiles')
            .select('barangay_assignment')
            .not('barangay_assignment', 'is', null)
            .order('barangay_assignment');
        
        if (error) throw error;
        
        return ['All Stations', ...new Set(data?.map(s => s.barangay_assignment).filter(Boolean))];
    } catch (error) {
        console.error('Error loading stations:', error);
        return ['Main Clinic'];
    }
}


async getStaffForStation(station) {
    try {
        const { data, error } = await supabase
            .from('staff_profiles')
            .select('id, full_name, role, barangay_assignment')
            .in('role', ['Midwife', 'Doctor'])
            .or(`role.eq.Midwife,role.ilike.%OB%`)
            .or(
                `barangay_assignment.ilike.%${station.split(',')[0]}%,
                 barangay_assignment.eq.${station.split(',')[0]}`
            )
            .order('full_name');
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting staff for station:', error);
        return [];
    }
}

/**
 * Get detailed postpartum records for mothers
 */
async getPostpartumRecords() {
    try {
        const { data: deliveries, error } = await supabase
            .from('deliveries')
            .select(`
                id, 
                mother_id, 
                delivery_date, 
                delivery_type, 
                complications, 
                postpartum_visit_date,
                notes,
                patient_basic_info!deliveries_mother_id_fkey (
                    id, first_name, last_name, barangay
                ),
                newborns (
                    id, condition_at_birth, risk_level
                )
            `)
            .order('delivery_date', { ascending: false });

        if (error) throw error;

        // Also check high-risk status from pregnancy_info
        const motherIds = [...new Set(deliveries.map(d => d.mother_id))];
        const { data: pregInfo } = await supabase
            .from('pregnancy_info')
            .select('patient_id, pregn_postp, calculated_risk')
            .in('patient_id', motherIds);

        const pregMap = new Map(pregInfo?.map(p => [p.patient_id, p]) || []);
        const today = new Date();

        return (deliveries || []).map(d => {
            const mother = d.patient_basic_info;
            const newborns = Array.isArray(d.newborns) ? d.newborns : [d.newborns].filter(Boolean);
            const preg = pregMap.get(d.mother_id) || {};
            
            const deliveryDate = new Date(d.delivery_date);
            const diffTime = Math.abs(today - deliveryDate);
            const daysPP = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Determine recovery status
            const hasComplications = (d.complications && d.complications.length > 0) || 
                                   newborns.some(b => b.condition_at_birth === 'NICU');
            
            let recoveryStatus = 'Normal';
            if (hasComplications) recoveryStatus = 'Complication';
            else if (preg.calculated_risk === 'High Risk' || preg.calculated_risk === 'High') recoveryStatus = 'Monitoring';

            // Determine follow-up status
            let followUpStatus = 'Upcoming';
            if (d.postpartum_visit_date) {
                const fuDate = new Date(d.postpartum_visit_date);
                if (fuDate < today) followUpStatus = 'Missed';
            }

            return {
                id: d.id,
                patientId: mother?.id || '',
                name: `${mother?.first_name || ''} ${mother?.last_name || ''}`.trim(),
                station: mother?.barangay || 'N/A',
                deliveryDate: d.delivery_date,
                deliveryType: d.delivery_type || 'NSD',
                daysPostpartum: daysPP,
                babyOutcome: newborns?.[0]?.condition_at_birth || 'Healthy',
                recoveryStatus,
                progress: Math.min(100, Math.round((daysPP / 42) * 100)),
                lastCheckup: 'N/A', // Potentially join with visits table
                nextFollowUp: d.postpartum_visit_date || 'TBD',
                followUpStatus,
                complications: d.complications && d.complications.length > 0 ? d.complications.join(', ') : 'None'
            };
        });
    } catch (error) {
        console.error('Error in getPostpartumRecords:', error);
        return [];
    }
}

/**
 * Get summary stats for postpartum dashboard
 */
async getPostpartumStats() {
    try {
        const records = await this.getPostpartumRecords();
        const today = new Date();
        
        const recent = records.filter(r => r.daysPostpartum <= 42).length;
        const due = records.filter(r => r.followUpStatus === 'Upcoming' && r.nextFollowUp !== 'TBD').length;
        const missed = records.filter(r => r.followUpStatus === 'Missed').length;
        const complications = records.filter(r => r.recoveryStatus === 'Complication').length;
        const recovered = records.filter(r => r.daysPostpartum > 42 && r.recoveryStatus === 'Normal').length;

        // Calculate station distribution
        const stationMap = {};
        records.forEach(r => {
            const stationName = r.station || 'Unknown';
            if (!stationMap[stationName]) stationMap[stationName] = { name: stationName, total: 0, recovered: 0 };
            stationMap[stationName].total++;
            if (r.daysPostpartum > 42 && r.recoveryStatus === 'Normal') stationMap[stationName].recovered++;
        });

        return {
            summary: [
                { label: 'Recent Deliveries (42 days)', value: recent,         color: 'lilac',  icon: 'Baby' },
                { label: 'Due for Postpartum Visit',     value: due,            color: 'pink',   icon: 'Calendar' },
                { label: 'With Complications',           value: complications,  color: 'rose',   icon: 'AlertTriangle' },
            ],
            stationRecovery: Object.values(stationMap).sort((a, b) => b.total - a.total)
        };
    } catch (error) {
        console.error('Error in getPostpartumStats:', error);
        return { summary: [], stationRecovery: [] };
    }
}
}

export default new BabyService();