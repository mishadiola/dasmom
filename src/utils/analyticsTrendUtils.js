export const buildPregnancyRiskTrend = ({
    patients,
    pregnancies,
    visits,
    selectedPatientIds,
    weeks,
    getRiskAssessment
}) => {
    const latestPregnancyByPatient = new Map();
    pregnancies.forEach(pregnancy => {
        if (!pregnancy.patient_id) return;
        const current = latestPregnancyByPatient.get(pregnancy.patient_id);
        if (!current || new Date(pregnancy.created_at) > new Date(current.created_at)) {
            latestPregnancyByPatient.set(pregnancy.patient_id, pregnancy);
        }
    });

    const latestAttendedVisitByPatient = new Map();
    visits.forEach(visit => {
        if (!visit.patient_id || visit.status !== 'Attended') return;
        const current = latestAttendedVisitByPatient.get(visit.patient_id);
        if (!current || new Date(visit.visit_date) > new Date(current.visit_date)) {
            latestAttendedVisitByPatient.set(visit.patient_id, visit);
        }
    });

    const totalVal = weeks.map(() => 0);
    const highRiskVal = weeks.map(() => 0);

    patients.forEach(patient => {
        if (!selectedPatientIds.has(patient.id)) return;
        const pregnancy = latestPregnancyByPatient.get(patient.id);
        if (String(pregnancy?.pregn_postp || '').toLowerCase() !== 'pregnant') return;

        const createdAt = new Date(pregnancy.created_at);
        if (Number.isNaN(createdAt.getTime())) return;
        const index = weeks.findIndex(week => createdAt >= week.start && createdAt < week.end);
        if (index < 0) return;

        totalVal[index]++;
        if (getRiskAssessment(
            patient,
            pregnancy,
            latestAttendedVisitByPatient.get(patient.id)
        ).isHighRisk) {
            highRiskVal[index]++;
        }
    });

    return { totalVal, highRiskVal };
};
