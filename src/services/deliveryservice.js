import supabase from '../config/supabaseclient';

export default class DeliveryService {
    constructor() {
        this.supabase = supabase;
    }

    /**
     * Fetch all delivery outcomes (newborns joined with mother info)
     */
    async getAllDeliveries() {
        try {
            // Fetch all newborns as the basis for "Delivery Events"
            const { data: babies, error: babyError } = await this.supabase
                .from('newborns')
                .select('*')
                .order('birth_date', { ascending: false });

            if (babyError) throw babyError;
            if (!babies || babies.length === 0) return [];

            const motherIds = [...new Set(babies.map(b => b.patient_id))];

            // Fetch mother basic info
            const { data: mothers, error: motherError } = await this.supabase
                .from('patient_basic_info')
                .select('id, first_name, last_name, barangay')
                .in('id', motherIds);

            if (motherError) throw motherError;

            // Fetch pregnancy risk levels
            const { data: pregnancy, error: pregError } = await this.supabase
                .from('pregnancy_info')
                .select('patient_id, risk_level, edd')
                .in('patient_id', motherIds);

            if (pregError) throw pregError;

            // Map everything together
            return babies.map(baby => {
                const mother = mothers?.find(m => m.id === baby.patient_id);
                const preg = pregnancy?.find(p => p.patient_id === baby.patient_id);

                return {
                    id: baby.id,
                    patientId: baby.patient_id,
                    patientName: mother ? `${mother.first_name} ${mother.last_name}` : 'Unknown',
                    barangay: mother?.barangay || 'N/A',
                    deliveryDate: baby.birth_date,
                    deliveryTime: baby.birth_time || '--:--',
                    deliveryType: baby.delivery_type || 'NSD',
                    gestationalAge: baby.gestational_age || 'N/A',
                    riskLevel: preg?.risk_level || 'Normal',
                    complications: baby.complications || 'None',
                    babyOutcome: baby.condition || 'Healthy',
                    babyGender: baby.gender || 'Unknown',
                    babyWeight: baby.birth_weight ? `${baby.birth_weight} kg` : 'N/A',
                    staff: baby.attending_staff || 'TBD',
                    facility: baby.facility || 'Facility',
                    apgar1: baby.apgar_1min,
                    apgar5: baby.apgar_5min,
                    postpartumDate: baby.postpartum_scheduled || 'N/A'
                };
            });
        } catch (err) {
            console.error('Error in getAllDeliveries:', err);
            return [];
        }
    }

    /**
     * Fetch patients expected to deliver soon (Nearest Due Date)
     */
    async getUpcomingDeliveries() {
        try {
            const { data, error } = await this.supabase
                .from('pregnancy_info')
                .select(`
                    id, 
                    patient_id, 
                    edd, 
                    risk_level, 
                    patient_basic_info (first_name, last_name, barangay)
                `)
                .eq('pregn_postp', 'Pregnant')
                .not('edd', 'is', null)
                .order('edd', { ascending: true });

            if (error) throw error;

            return data.map(p => ({
                patientId: p.patient_id,
                patientName: `${p.patient_basic_info.first_name} ${p.patient_basic_info.last_name}`,
                barangay: p.patient_basic_info.barangay,
                edd: p.edd,
                riskLevel: p.risk_level,
                status: 'Upcoming'
            }));
        } catch (err) {
            console.error('Error in getUpcomingDeliveries:', err);
            return [];
        }
    }

    /**
     * Get Stats for Delivery Outcomes
     */
    async getDeliveryStats() {
        try {
            const { data: babies, error } = await this.supabase
                .from('newborns')
                .select('delivery_type, complications, condition, patient_id');

            if (error) throw error;

            const total = babies.length;
            const nsd = babies.filter(b => b.delivery_type === 'NSD').length;
            const cs = babies.filter(b => b.delivery_type === 'CS').length;
            const complications = babies.filter(b => b.complications && b.complications !== 'None' && b.complications !== '').length;

            // Fetch high risk count from pregnancy_info joined with newborns
            const motherIds = [...new Set(babies.map(b => b.patient_id))];
            let highRiskCount = 0;
            if (motherIds.length > 0) {
                const { data: highRiskMothers } = await this.supabase
                    .from('pregnancy_info')
                    .select('patient_id')
                    .eq('risk_level', 'High Risk')
                    .in('patient_id', motherIds);
                highRiskCount = highRiskMothers?.length || 0;
            }

            return [
                { label: 'Total Deliveries', value: total, color: 'lilac' },
                { label: 'Normal vs CS', value: `${nsd} / ${cs}`, color: 'sage' },
                { label: 'Complications', value: complications, color: 'orange' },
                { label: 'High-Risk Deliveries', value: highRiskCount, color: 'rose' },
            ];
        } catch (err) {
            console.error('Error in getDeliveryStats:', err);
            return [
                { label: 'Total Deliveries', value: 0, color: 'lilac' },
                { label: 'Normal vs CS', value: '0 / 0', color: 'sage' },
                { label: 'Complications', value: 0, color: 'orange' },
                { label: 'High-Risk Deliveries', value: 0, color: 'rose' },
            ];
        }
    }

    /**
     * Search for mothers who are pregnant and ready for delivery record
     */
    async searchPregnantMothers(query) {
        try {
            const { data, error } = await this.supabase
                .from('patient_basic_info')
                .select(`
                    id, 
                    first_name, 
                    last_name, 
                    barangay,
                    pregnancy_info (risk_level, edd, pregn_postp)
                `)
                .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
                .limit(10);

            if (error) throw error;
            return data.map(p => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                barangay: p.barangay,
                riskLevel: p.pregnancy_info?.[0]?.risk_level || 'Normal',
                isPregnant: p.pregnancy_info?.[0]?.pregn_postp === 'Pregnant'
            }));
        } catch (err) {
            console.error('Error searching mothers:', err);
            return [];
        }
    }

    /**
     * Add a new delivery outcome record
     */
    async addDeliveryOutcome(formData) {
        try {
            const { data, error } = await this.supabase
                .from('newborns')
                .insert([{
                    patient_id: formData.patientId,
                    baby_name: formData.babyName || 'Newborn',
                    birth_date: formData.deliveryDate,
                    birth_time: formData.deliveryTime,
                    delivery_type: formData.deliveryType,
                    gestational_age: formData.gestationalAge,
                    complications: Array.isArray(formData.complications) ? formData.complications.join(', ') : formData.complications,
                    condition: formData.babyCondition,
                    gender: formData.babyGender,
                    birth_weight: parseFloat(formData.babyWeight),
                    attending_staff: formData.staff,
                    facility: formData.facility,
                    apgar_1min: parseInt(formData.apgar1),
                    apgar_5min: parseInt(formData.apgar5),
                    postpartum_scheduled: formData.postpartumDate,
                    notes: formData.notes
                }])
                .select();

            if (error) throw error;

            // Optionally update mother's status to 'Postpartum'
            await this.supabase
                .from('pregnancy_info')
                .update({ pregn_postp: 'Postpartum' })
                .eq('patient_id', formData.patientId);

            return data[0];
        } catch (err) {
            console.error('Error adding delivery outcome:', err);
            throw err;
        }
    }
}
