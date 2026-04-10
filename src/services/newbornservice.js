import supabase from '../config/supabaseclient';

export default class NewbornService {
    constructor() {
        this.supabase = supabase;
    }

    /**
     * Get summary stats for newborn tracking dashboard cards
     * Returns: { totalNewborns, lowBirthWeight, highRisk, vaccinationsDue, missedFollowups }
     */
    async getNewbornStats() {
        try {
            // 1. Total newborns (all records)
            const { count: totalNewborns } = await this.supabase
                .from('newborns')
                .select('*', { count: 'exact', head: true });

            // 2. Low birth weight (< 2.5 kg)
            const { count: lowBirthWeight } = await this.supabase
                .from('newborns')
                .select('*', { count: 'exact', head: true })
                .lt('birth_weight', 2.5);

            // 3. High-risk newborns: babies whose condition is NICU/Special Care,
            //    OR whose mother has a 'High Risk' pregnancy record
            const { data: allBabies } = await this.supabase
                .from('newborns')
                .select('id, patient_id, condition');

            let highRiskCount = 0;
            if (allBabies && allBabies.length > 0) {
                // Babies in NICU or Special Care
                const nicuBabies = allBabies.filter(
                    b => b.condition && (b.condition === 'NICU' || b.condition === 'Special Care')
                );
                highRiskCount = nicuBabies.length;

                // Also count babies whose mother is high-risk
                const motherIds = [...new Set(allBabies.map(b => b.patient_id).filter(Boolean))];
                if (motherIds.length > 0) {
                    const { data: highRiskMothers } = await this.supabase
                        .from('pregnancy_info')
                        .select('patient_id')
                        .eq('risk_level', 'High Risk')
                        .in('patient_id', motherIds);

                    const hrMotherIds = new Set((highRiskMothers || []).map(m => m.patient_id));
                    // Add babies from high-risk mothers not already counted
                    const additionalHR = allBabies.filter(
                        b => hrMotherIds.has(b.patient_id) && 
                             !(b.condition === 'NICU' || b.condition === 'Special Care')
                    );
                    highRiskCount += additionalHR.length;
                }
            }

            // 4. Vaccinations due: count newborns that don't have a vaccine_records entry yet,
            //    OR count total pending vaccines for newborns
            let vaccinationsDue = 0;
            if (allBabies && allBabies.length > 0) {
                const babyMotherIds = [...new Set(allBabies.map(b => b.patient_id).filter(Boolean))];
                
                // Count mothers of newborns who have NO vaccine records at all
                if (babyMotherIds.length > 0) {
                    const { data: vaccRecords } = await this.supabase
                        .from('vaccine_records')
                        .select('patient_id')
                        .in('patient_id', babyMotherIds);

                    const mothersWithVacc = new Set((vaccRecords || []).map(v => v.patient_id));
                    vaccinationsDue = babyMotherIds.filter(id => !mothersWithVacc.has(id)).length;
                }

                // If none found via that method, use the total count as a rough indicator
                if (vaccinationsDue === 0) {
                    vaccinationsDue = allBabies.length;
                }
            }

            // 5. Missed follow-ups: newborns whose postpartum_scheduled date is in the past
            const todayStr = new Date().toISOString().split('T')[0];
            const { count: missedFollowups } = await this.supabase
                .from('newborns')
                .select('*', { count: 'exact', head: true })
                .lt('postpartum_scheduled', todayStr)
                .not('postpartum_scheduled', 'is', null);

            return {
                totalNewborns: totalNewborns || 0,
                lowBirthWeight: lowBirthWeight || 0,
                highRisk: highRiskCount,
                vaccinationsDue: vaccinationsDue,
                missedFollowups: missedFollowups || 0
            };
        } catch (err) {
            console.error('Error fetching newborn stats:', err);
            return {
                totalNewborns: 0,
                lowBirthWeight: 0,
                highRisk: 0,
                vaccinationsDue: 0,
                missedFollowups: 0
            };
        }
    }

    /**
     * Get all newborn records with mother info for the table
     */
    async getAllNewborns() {
        try {
            const { data: babies, error: babyError } = await this.supabase
                .from('newborns')
                .select('*')
                .order('birth_date', { ascending: false });

            if (babyError) throw babyError;
            if (!babies || babies.length === 0) return [];

            const motherIds = [...new Set(babies.map(b => b.patient_id).filter(Boolean))];

            // Fetch mother basic info
            const { data: mothers } = await this.supabase
                .from('patient_basic_info')
                .select('id, first_name, last_name, barangay')
                .in('id', motherIds);

            // Fetch pregnancy risk levels
            const { data: pregnancies } = await this.supabase
                .from('pregnancy_info')
                .select('patient_id, risk_level')
                .in('patient_id', motherIds);

            return babies.map(baby => {
                const mother = mothers?.find(m => m.id === baby.patient_id);
                const pregnancy = pregnancies?.find(p => p.patient_id === baby.patient_id);

                // Determine risk level for the baby
                let riskLevel = 'Normal';
                if (baby.condition === 'NICU' || baby.condition === 'Special Care') {
                    riskLevel = 'High';
                } else if (pregnancy?.risk_level === 'High Risk') {
                    riskLevel = 'High';
                } else if (baby.birth_weight && baby.birth_weight < 2.5) {
                    riskLevel = 'Monitor';
                } else if (pregnancy?.risk_level === 'Monitor') {
                    riskLevel = 'Monitor';
                }

                return {
                    id: baby.id,
                    babyName: baby.baby_name || 'Newborn',
                    motherId: baby.patient_id,
                    motherName: mother ? `${mother.first_name} ${mother.last_name}` : 'Unknown',
                    station: mother?.barangay || 'N/A',
                    birthDate: baby.birth_date || 'N/A',
                    gender: baby.gender || 'Unknown',
                    birthWeight: baby.birth_weight || 0,
                    length: baby.birth_length || 0,
                    headCirc: baby.head_circumference || 0,
                    gestationalAge: baby.gestational_age || 'N/A',
                    deliveryType: baby.delivery_type || 'NSD',
                    condition: baby.condition || 'Healthy',
                    riskLevel,
                    apgar1: baby.apgar_1min,
                    apgar5: baby.apgar_5min,
                    complications: baby.complications || 'None',
                    notes: baby.notes || '',
                    nextAppt: baby.postpartum_scheduled || '—',
                    vaccStatus: 'Pending',
                    suppStatus: 'Pending',
                    // Placeholder sub-records (will be empty until vaccination/supplement tracking is built)
                    vaccLog: [],
                    suppLog: [],
                    growthLog: [],
                    checkupLog: [],
                    alerts: this._generateAlerts(baby, riskLevel)
                };
            });
        } catch (err) {
            console.error('Error fetching all newborns:', err);
            return [];
        }
    }

    /**
     * Get quick stats for the sidebar (gender, delivery type, LBW, NICU breakdowns)
     */
    async getQuickStats() {
        try {
            const { data: babies } = await this.supabase
                .from('newborns')
                .select('gender, delivery_type, birth_weight, condition');

            if (!babies || babies.length === 0) {
                return { female: 0, male: 0, nsd: 0, cs: 0, lbw: 0, nicu: 0 };
            }

            return {
                female: babies.filter(b => b.gender === 'Female').length,
                male: babies.filter(b => b.gender === 'Male').length,
                nsd: babies.filter(b => b.delivery_type === 'NSD').length,
                cs: babies.filter(b => b.delivery_type === 'CS').length,
                lbw: babies.filter(b => b.birth_weight && b.birth_weight < 2.5).length,
                nicu: babies.filter(b => b.condition === 'NICU' || b.condition === 'Special Care').length
            };
        } catch (err) {
            console.error('Error fetching quick stats:', err);
            return { female: 0, male: 0, nsd: 0, cs: 0, lbw: 0, nicu: 0 };
        }
    }

    /**
     * Get alerts for newborns (NICU, low weight, complications)
     */
    async getNewbornAlerts() {
        try {
            const { data: babies } = await this.supabase
                .from('newborns')
                .select('id, baby_name, patient_id, condition, birth_weight, complications, birth_date')
                .order('birth_date', { ascending: false });

            if (!babies || babies.length === 0) return [];

            const alerts = [];

            babies.forEach(baby => {
                if (baby.condition === 'NICU' || baby.condition === 'Special Care') {
                    alerts.push({
                        text: `${baby.baby_name || 'Newborn'} is in ${baby.condition}`,
                        type: 'critical',
                        time: baby.birth_date
                    });
                }
                if (baby.birth_weight && baby.birth_weight < 2.5) {
                    alerts.push({
                        text: `${baby.baby_name || 'Newborn'} has low birth weight (${baby.birth_weight}kg)`,
                        type: 'warning',
                        time: baby.birth_date
                    });
                }
                if (baby.complications && baby.complications !== 'None' && baby.complications !== '') {
                    alerts.push({
                        text: `${baby.baby_name || 'Newborn'}: ${baby.complications}`,
                        type: 'critical',
                        time: baby.birth_date
                    });
                }
            });

            return alerts.slice(0, 10);
        } catch (err) {
            console.error('Error fetching newborn alerts:', err);
            return [];
        }
    }

    /**
     * Subscribe to real-time changes on the newborns table
     */
    subscribeToNewbornChanges(callback) {
        return this.supabase
            .channel('newborn-tracking-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'newborns' },
                (payload) => {
                    console.log('🔔 Real-time change in newborns:', payload);
                    callback(payload);
                }
            )
            .subscribe();
    }

    /**
     * Generate auto-alerts for a specific baby based on its data
     */
    _generateAlerts(baby, riskLevel) {
        const alerts = [];
        if (baby.condition === 'NICU') alerts.push('Baby is currently in NICU');
        if (baby.condition === 'Special Care') alerts.push('Baby requires special care monitoring');
        if (baby.birth_weight && baby.birth_weight < 2.5) alerts.push(`Low birth weight: ${baby.birth_weight}kg`);
        if (baby.complications && baby.complications !== 'None' && baby.complications !== '') {
            alerts.push(`Complications: ${baby.complications}`);
        }
        if (riskLevel === 'High') alerts.push('Mother classified as high-risk pregnancy');
        return alerts;
    }
}
