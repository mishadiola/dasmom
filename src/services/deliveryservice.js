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
            const { data, error } = await this.supabase
                .from('deliveries')
                .select(`
                    id, mother_id, station_ass, delivery_date, delivery_time, delivery_type,
                    delivery_mode, gestational_age, risk_level, complications,
                    postpartum_visit_date, attending_staff,
                    stations:station_ass (station_name),
                    pregnancy_info!deliveries_pregnancy_id_fkey (place_of_delivery),
                    patient_basic_info!deliveries_mother_id_fkey (first_name, last_name),
                    staff_profiles!deliveries_attending_staff_fkey (full_name),
                    newborns (gender, birth_weight, apgar_1min, apgar_5min, condition_at_birth)
                `)
                .order('delivery_date', { ascending: false });

            if (error) throw error;
            return (data || []).map(delivery => {
                const baby = Array.isArray(delivery.newborns) ? delivery.newborns[0] : delivery.newborns;
                const staff = Array.isArray(delivery.staff_profiles) ? delivery.staff_profiles[0] : delivery.staff_profiles;
                return {
                    id: delivery.id,
                    patientId: delivery.mother_id,
                    patientName: `${delivery.patient_basic_info?.first_name || ''} ${delivery.patient_basic_info?.last_name || ''}`.trim() || 'Unknown',
                    stationId: delivery.station_ass,
                    station: delivery.stations?.station_name || 'Unassigned',
                    deliveryDate: delivery.delivery_date,
                    deliveryTime: delivery.delivery_time || '--:--',
                    deliveryType: delivery.delivery_type || 'N/A',
                    deliveryMode: delivery.delivery_mode || 'N/A',
                    gestationalAge: delivery.gestational_age || 'N/A',
                    riskLevel: delivery.risk_level || 'Normal',
                    complications: delivery.complications || [],
                    babyOutcome: baby?.condition_at_birth || 'Healthy',
                    babyGender: baby?.gender || 'Unknown',
                    babyWeight: baby?.birth_weight ? `${baby.birth_weight} kg` : 'N/A',
                    staff: staff?.full_name || 'Unassigned',
                    attendingStaffId: delivery.attending_staff,
                    facility: delivery.pregnancy_info?.place_of_delivery || 'N/A',
                    apgar1: baby?.apgar_1min,
                    apgar5: baby?.apgar_5min,
                    postpartumDate: delivery.postpartum_visit_date || 'N/A'
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
                    patient_basic_info (first_name, last_name, station_ass, stations:station_ass (station_name))
                `)
                .eq('pregn_postp', 'Pregnant')
                .not('edd', 'is', null)
                .order('edd', { ascending: true });

            if (error) throw error;

            return data.map(p => ({
                patientId: p.patient_id,
                patientName: `${p.patient_basic_info?.first_name || ''} ${p.patient_basic_info?.last_name || ''}`.trim(),
                stationId: p.patient_basic_info?.station_ass || null,
                station: p.patient_basic_info?.stations?.station_name || 'N/A',
                edd: p.edd,
                riskLevel: 'Not assessed',
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
                    station_ass,
                    stations:station_ass (station_name),
                    pregnancy_info (edd, pregn_postp)
                `)
                .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
                .limit(10);

            if (error) throw error;
            return data.map(p => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                stationId: p.station_ass || null,
                station: p.stations?.station_name || 'N/A',
                riskLevel: 'Not assessed',
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
            const { data: authData, error: authError } = await this.supabase.auth.getUser();
            if (authError) throw authError;
            if (!formData.stationId) throw new Error('A delivery station is required.');

            const { data: delivery, error } = await this.supabase
                .from('deliveries')
                .insert({
                    mother_id: formData.patientId,
                    station_ass: formData.stationId,
                    delivery_date: formData.deliveryDate,
                    delivery_time: formData.deliveryTime || '00:00',
                    delivery_type: formData.deliveryType,
                    gestational_age: formData.gestationalAge || null,
                    risk_level: formData.riskLevel || 'Normal',
                    complications: Array.isArray(formData.complications) ? formData.complications : [],
                    attending_staff: formData.attendingStaffId || formData.staffId || null,
                    postpartum_visit_date: formData.postpartumDate || null,
                    notes: formData.notes || null,
                    created_by: authData.user?.id || null
                })
                .select('id')
                .single();

            if (error) throw error;

            const { error: newbornError } = await this.supabase.from('newborns').insert({
                delivery_id: delivery.id,
                mother_id: formData.patientId,
                baby_name: formData.babyName || null,
                gender: formData.babyGender,
                birth_weight: formData.babyWeight ? Number(formData.babyWeight) : null,
                birth_length: formData.babyLength ? Number(formData.babyLength) : null,
                apgar_1min: formData.apgar1 ? Number(formData.apgar1) : null,
                apgar_5min: formData.apgar5 ? Number(formData.apgar5) : null,
                condition_at_birth: formData.babyCondition || 'Healthy',
                created_by: authData.user?.id || null
            });
            if (newbornError) throw newbornError;

            // Optionally update mother's status to 'Postpartum'
            await this.supabase
                .from('pregnancy_info')
                .update({ pregn_postp: 'Postpartum' })
                .eq('patient_id', formData.patientId);

            return delivery;
        } catch (err) {
            console.error('Error adding delivery outcome:', err);
            throw err;
        }
    }
}
