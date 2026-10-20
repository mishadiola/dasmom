import { isNewbornVaccinationEligible } from './pregnancyUtils.js';

const hasRecordedVitals = visit => [
    visit.weight_kg,
    visit.bp_systolic,
    visit.bp_diastolic,
    visit.pulse_bpm,
    visit.temp_c,
    visit.resp_rate_cpm,
    visit.fhr_bpm
].some(value => value !== null && value !== undefined && value !== '');

const visitDate = visit => visit.visit_date
    || visit.attended_date
    || visit.scheduled_at
    || visit.scheduled_date
    || null;

const dateOnly = value => {
    if (!value) return '';
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return text.split('T')[0];
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(parsed);
};

const uniqueVisits = visits => {
    const byId = new Map();
    visits.forEach(visit => {
        if (!visit) return;
        const key = visit.id || `${visitDate(visit) || ''}:${visit.visit_number || visit.visit_type || ''}`;
        byId.set(key, { ...byId.get(key), ...visit });
    });
    return [...byId.values()];
};

export const getMotherPostpartumVisits = (patient, queriedVisits = []) => {
    const deliveryVisits = (patient?.deliveries || [])
        .flatMap(delivery => delivery.postpartum_visits || []);
    return uniqueVisits([...queriedVisits, ...deliveryVisits]);
};

export const toPostpartumAppointment = (visit, today) => {
    const scheduledDate = visit.scheduled_date || dateOnly(visit.scheduled_at);
    const normalizedStatus = String(visit.status || '').toLowerCase();
    const status = ['attended', 'completed'].includes(normalizedStatus)
        ? 'Attended'
        : normalizedStatus === 'cancelled'
            ? 'Cancelled'
            : normalizedStatus === 'missed'
                ? 'Missed'
                : scheduledDate && scheduledDate < today
                    ? 'Missed'
                    : 'Scheduled';

    return {
        id: visit.id,
        date: visit.attended_date ? dateOnly(visit.attended_date) : scheduledDate,
        scheduledDate,
        attendedDate: visit.attended_date,
        time: '',
        type: 'Postpartum',
        visitName: visit.visit_type || 'Postpartum',
        status,
        assessment: visit.assessment,
        color: 'blue'
    };
};

const toVaccinationAppointment = (vaccination, recipientName = null) => ({
    id: vaccination.id,
    date: vaccination.scheduled_vaccination || vaccination.vaccinated_date,
    time: '',
    type: 'Vaccination',
    status: vaccination.status === 'Pending' ? 'Scheduled' : vaccination.status || 'Scheduled',
    staffName: vaccination.assigned_staff_name || vaccination.assigned_staff,
    staffStation: vaccination.assigned_staff_station || vaccination.administration_station_name,
    notes: [vaccination.vaccine_name || vaccination.vaccine_inventory?.vaccine_name || 'Vaccination', recipientName]
        .filter(Boolean)
        .join(' · '),
    color: 'yellow'
});

export const getMotherVaccinationAppointments = (patient, isPostpartum) => {
    const maternalAppointments = (patient?.vaccines || [])
        .filter(vaccination => vaccination.recipient_type === 'Mother')
        .filter(vaccination => vaccination.scheduled_vaccination || vaccination.vaccinated_date)
        .map(vaccination => toVaccinationAppointment(vaccination));
    const newborns = patient?.newborns?.length
        ? patient.newborns
        : patient?.currentPregnancy?.newborns || [];
    const newbornAppointments = isPostpartum
        ? newborns
            .filter(isNewbornVaccinationEligible)
            .flatMap(newborn => (newborn.vaccines || [])
                .filter(vaccination => vaccination.scheduled_vaccination || vaccination.vaccinated_date)
                .map(vaccination => toVaccinationAppointment(
                    vaccination,
                    newborn.baby_name || vaccination.recipient_name || 'Newborn'
                )))
        : [];

    return [...maternalAppointments, ...newbornAppointments];
};

const trimesterLabel = value => {
    const number = Number(String(value || '').match(/\d+/)?.[0]);
    if (number === 1) return '1st';
    if (number === 2) return '2nd';
    if (number === 3) return '3rd';
    return 'N/A';
};

const normalizeVitalVisit = (visit, stage, patient) => ({
    id: visit.id || `${stage}:${visitDate(visit)}`,
    date: visitDate(visit),
    stage,
    weight: visit.weight_kg,
    height: visit.height_cm || patient?.height_cm || null,
    bp: visit.bp_systolic && visit.bp_diastolic
        ? `${visit.bp_systolic}/${visit.bp_diastolic}`
        : null,
    bp_systolic: visit.bp_systolic,
    bp_diastolic: visit.bp_diastolic,
    pulse: visit.pulse_bpm,
    temp: visit.temp_c,
    resp_rate: visit.resp_rate_cpm,
    fhr: visit.fhr_bpm,
    notes: visit.clinical_notes || visit.notes || '',
    risk_factors: visit.risk_factors,
    trimester: stage === 'Postpartum' ? 'Postpartum' : trimesterLabel(visit.trimester)
});

export const getMotherVitalsData = patient => {
    const prenatalVisits = uniqueVisits([
        ...(patient?.visits || []),
        ...(patient?.pregnancyHistory || []).flatMap(pregnancy => pregnancy.visits || [])
    ])
        .filter(visit => visitDate(visit) && hasRecordedVitals(visit))
        .map(visit => normalizeVitalVisit(visit, 'Prenatal', patient));
    const postpartumVisits = uniqueVisits(
        (patient?.deliveries || []).flatMap(delivery => delivery.postpartum_visits || [])
    )
        .filter(visit => visitDate(visit) && hasRecordedVitals(visit))
        .map(visit => normalizeVitalVisit(visit, 'Postpartum', patient));
    const sortNewestFirst = (left, right) => new Date(right.date) - new Date(left.date);
    prenatalVisits.sort(sortNewestFirst);
    postpartumVisits.sort(sortNewestFirst);
    const visits = [...prenatalVisits, ...postpartumVisits].sort(sortNewestFirst);
    const status = String(
        patient?.pregnancyStatus
        || patient?.pregnancyRecord?.pregn_postp
        || patient?.pregnancyRecord?.status
        || ''
    ).trim().toLowerCase();
    const currentStage = status === 'pregnant'
        ? 'Prenatal'
        : status === 'postpartum' || (status !== 'pregnant' && (patient?.deliveries || []).length)
            ? 'Postpartum'
            : null;
    const stageVisits = currentStage === 'Prenatal'
        ? prenatalVisits
        : currentStage === 'Postpartum'
            ? postpartumVisits
            : visits;

    return {
        visits,
        chronological: [...visits].reverse(),
        current: stageVisits[0] || {},
        currentStage
    };
};
