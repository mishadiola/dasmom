import supabase from '../config/supabaseclient';
import { calculateEDD } from '../utils/pregnancyUtils';

const dateOnly = value => String(value || '').slice(0, 10);

const addDays = (value, days) => {
    const date = new Date(`${dateOnly(value)}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

const getManilaToday = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(new Date());

export const getUpcomingEddSchedule = async ({
    startDate = getManilaToday(),
    endDate,
    stationId = null,
    includeOtherStations = false
} = {}) => {
    const rangeEnd = endDate || addDays(startDate, 30);
    if (rangeEnd < startDate) {
        throw new Error('The EDD schedule end date cannot be before its start date.');
    }

    if (!includeOtherStations && !stationId) {
        throw new Error('Your assigned station could not be verified for the EDD schedule.');
    }

    const firstLmpDate = addDays(startDate, -280);
    const lastLmpDate = addDays(rangeEnd, -280);
    const { data: pregnancies, error: pregnancyError } = await supabase
        .from('pregnancy_info')
        .select('id, patient_id, lmd, pregn_postp, created_at')
        .eq('pregn_postp', 'Pregnant')
        .gte('lmd', firstLmpDate)
        .lte('lmd', lastLmpDate)
        .order('created_at', { ascending: false });

    if (pregnancyError) throw pregnancyError;

    const latestPregnancyByPatient = new Map();
    (pregnancies || []).forEach(pregnancy => {
        if (pregnancy.patient_id && !latestPregnancyByPatient.has(pregnancy.patient_id)) {
            latestPregnancyByPatient.set(pregnancy.patient_id, pregnancy);
        }
    });

    const pregnancyRows = [...latestPregnancyByPatient.values()];
    if (pregnancyRows.length === 0) return [];

    let patientQuery = supabase
        .from('patient_basic_info')
        .select('id, first_name, last_name, station_ass, stations:station_ass (station_name)')
        .in('id', pregnancyRows.map(pregnancy => pregnancy.patient_id));

    if (!includeOtherStations) {
        patientQuery = patientQuery.eq('station_ass', stationId);
    }

    const { data: patients, error: patientError } = await patientQuery;
    if (patientError) throw patientError;

    const patientById = new Map((patients || []).map(patient => [patient.id, patient]));
    return pregnancyRows
        .map(pregnancy => {
            const patient = patientById.get(pregnancy.patient_id);
            if (!patient || !pregnancy.lmd) return null;

            const edd = calculateEDD(`${dateOnly(pregnancy.lmd)}T00:00:00.000Z`);
            if (Number.isNaN(edd.getTime())) return null;
            const eddDate = edd.toISOString().slice(0, 10);
            if (eddDate < startDate || eddDate > rangeEnd) return null;

            return {
                id: pregnancy.id,
                patientId: pregnancy.patient_id,
                patientName: `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown patient',
                stationId: patient.station_ass,
                stationName: patient.stations?.station_name || 'Unassigned',
                lmp: dateOnly(pregnancy.lmd),
                edd: eddDate
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.edd.localeCompare(right.edd) || left.patientName.localeCompare(right.patientName));
};
