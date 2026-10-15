import React, { useState, useEffect, useContext } from 'react';
import {
    Users, Baby, AlertTriangle, CalendarCheck, TrendingUp,
    TrendingDown, Activity, Syringe, HeartPulse, MapPin,
    ChevronRight, Plus, FileText, Eye, Filter,
    CheckCircle2, XCircle, Circle, Dot, MoreHorizontal,
    ArrowUpRight, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/Dashboard.css';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import supabase from '../../config/supabaseclient';
import { AuthContext } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatters';
import StaffPageLoader from '../../components/Common/StaffPageLoader';

const authService = new AuthService();


/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const STAT_META = [
    { id: 1, label: 'Active Pregnant Patients', key: 'totalPatients', trend: 'up', sub: 'currently registered in system', icon: HeartPulse, color: 'rose', path: '/dashboard/patients' },
    { id: 2, label: 'Pregnancies with Health Conditions', key: 'highRisk', trend: 'up', sub: 'documented health conditions', icon: AlertTriangle, color: 'orange', path: '/dashboard/high-risk' },
    { id: 3, label: 'Newborn Records',        key: 'newborns',      trend: 'up', sub: 'birth outcomes',        icon: Baby, color: 'pink', path: '/dashboard/newborns' },
    { id: 4, label: 'Appointments Today',       key: 'apptToday',     trend: 'neutral', sub: 'scheduled today', icon: CalendarCheck, color: 'sage', path: '/dashboard/prenatal' },
];

const UPCOMING_APPTS = [];

const HIGH_RISK = [];

const VACCINE_STOCK = [
    { name: 'Tetanus Toxoid (TT)', stock: 12, min: 20, unit: 'vials', status: 'low' },
    { name: 'Hepa B (Newborn)', stock: 45, min: 30, unit: 'vials', status: 'ok' },
    { name: 'BCG', stock: 8, min: 20, unit: 'vials', status: 'critical' },
    { name: 'Iron Supplements', stock: 320, min: 100, unit: 'tablets', status: 'ok' },
    { name: 'Folic Acid', stock: 15, min: 100, unit: 'tablets', status: 'critical' },
    { name: 'Calcium Supplements', stock: 60, min: 50, unit: 'tablets', status: 'ok' },
];

const RECENT_DELIVERIES = [];

const MiniBar = ({ value, max, color }) => (
    <div className="mini-bar-track">
        <div
            className={`mini-bar-fill mini-bar-fill--${color}`}
            style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
    </div>
);

const TrimesterBadge = ({ weeks, isPostpartum }) => {
    if (isPostpartum) {
        return (
            <span className="tri-badge tri-badge--postpartum">
                Postpartum
            </span>
        );
    }
    if (weeks === null || weeks === undefined || weeks === '' || isNaN(weeks)) {
        return (
            <span className="tri-badge tri-badge--neutral">
                --
            </span>
        );
    }
    const safeWeeks = Math.max(0, parseInt(weeks) || 0);
    const tri = safeWeeks <= 12 ? 1 : safeWeeks <= 26 ? 2 : 3;
    return (
        <span className={`tri-badge tri-badge--${tri}`}>
            T{tri} · {safeWeeks}w
        </span>
    );
};

const HealthConditionsCell = ({ conditions }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const condList = Array.isArray(conditions)
        ? conditions.filter(c => Boolean(c) && c !== 'None Reported' && c !== 'None')
        : (typeof conditions === 'string' && conditions.trim() && conditions !== 'None Reported' && conditions !== 'None')
            ? conditions.split(',').map(s => s.trim()).filter(Boolean)
            : [];

    if (condList.length === 0) {
        return (
            <span className="condition-tag condition-tag--none">
                None Reported
            </span>
        );
    }

    const hasMore = condList.length > 2;
    const visibleConditions = isExpanded ? condList : condList.slice(0, 2);
    const remainingCount = condList.length - 2;

    const handleToggle = (e) => {
        e.stopPropagation();
        setIsExpanded(prev => !prev);
    };

    return (
        <div className={`conditions-cell ${isExpanded ? 'conditions-cell--expanded' : ''}`}>
            <div className="conditions-tags-wrap">
                {visibleConditions.map((cond, idx) => (
                    <span
                        key={`${cond}-${idx}`}
                        className={`condition-tag condition-tag--present ${idx >= 2 ? 'condition-tag--extra' : ''}`}
                    >
                        {cond}
                    </span>
                ))}
                {hasMore && (
                    <button
                        type="button"
                        className={`conditions-toggle-btn ${isExpanded ? 'conditions-toggle-btn--less' : ''}`}
                        onClick={handleToggle}
                        title={isExpanded ? 'Show fewer conditions' : `Show ${remainingCount} more condition${remainingCount > 1 ? 's' : ''}`}
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? 'Show Less' : `+${remainingCount} more`}
                    </button>
                )}
            </div>
        </div>
    );
};



const Dashboard = () => {
    const navigate = useNavigate();
    const {user} = useContext(AuthContext);
    const patientService = new PatientService();
    
    //const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [liveStats, setLiveStats] = useState({ totalPatients: 0, highRisk: 0, newborns: 0, apptToday: 0 });
    const [vaccineStock, setVaccineStock] = useState([]);
    const [loadingStock, setLoadingStock] = useState(true);
    const [todayAppts, setTodayAppts] = useState([]);
    const [healthSnapshot, setHealthSnapshot] = useState({ conditions: [], trimesterDist: [] });
    const [loadingHealth, setLoadingHealth] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            // ✅ Defend against timezone shifting when converting 'today' to ISO YYYY-MM-DD
            const now = new Date();
            const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            
            // Fetch health conditions / high risk stats using PatientService (matching Health Conditions page criteria)
            const archivedPatientIds = await patientService.getArchivedPatientIds();
            const [highRiskStats, highRiskPatients] = await Promise.all([
                patientService.getHighRiskStats(),
                patientService.getHighRiskPatients(),
            ]);

            const uniqueHealthConditionPatients = Array.from(
                new Map((highRiskPatients || []).map((p) => [p.id, p])).values()
            );

            const healthConditionCount = (highRiskPatients && highRiskPatients.length > 0)
                ? uniqueHealthConditionPatients.length
                : (highRiskStats?.highRiskCount ?? 0);
            
            // Build documented health conditions lookup using the Health Conditions page dataset
            const highRiskPatientMap = new Map();
            (highRiskPatients || []).forEach(p => {
                if (p.id) {
                    highRiskPatientMap.set(p.id, p);
                }
            });

            const [
                { data: patientRows },
                { data: newbornRows },
                { data: prenatalApptData },
                { data: postpartumApptData },
                { data: vaccinationApptData },
                { data: pregnancyData },
                { data: deliveriesData },
                { data: recentVisitsWithConditions }
            ] = await Promise.all([
                supabase.from('patient_basic_info').select('id, emergency_contact'),
                supabase.from('newborns').select('id, mother_id, baby_name'),
                supabase.from('prenatal_visits').select(`
                    id, visit_date, patient_id, created_at, status, next_appt_type, risk_factors, gestational_age, trimester,
                    patient_basic_info!inner ( 
                        id, first_name, last_name, station_ass, stations:station_ass (station_name), date_of_birth
                    )
                `).eq('visit_date', todayStr)
                  .neq('status', 'Cancelled')
                  .neq('status', 'Missed')
                  .order('created_at', { ascending: true }),
                supabase.from('postpartum_visits').select(`
                    id, patient_id, delivery_id, visit_type, visit_number, scheduled_date, scheduled_at, status, created_at
                `).neq('status', 'Cancelled')
                  .neq('status', 'Missed'),
                supabase.from('vaccinations').select(`
                    id, patient_id, newborn_id, scheduled_vaccination, status, notes, dose_number, created_at,
                    vaccine_inventory (vaccine_name)
                `).neq('status', 'Cancelled')
                  .neq('status', 'Missed')
                  .neq('status', 'cancelled')
                  .neq('status', 'missed'),
                supabase.from('pregnancy_info').select('patient_id, lmd, pregn_postp, created_at').order('created_at', { ascending: false }),
                supabase.from('deliveries').select('id, mother_id, delivery_date'),
                supabase.from('prenatal_visits').select('patient_id, risk_factors, visit_date').not('risk_factors', 'is', null).order('visit_date', { ascending: false })
            ]);

            const pregnantPatientIds = new Set((pregnancyData || []).filter(row => row.pregn_postp?.toLowerCase() === 'pregnant').map(row => row.patient_id).filter(Boolean));
            const activePatientIds = new Set(
                (patientRows || [])
                    .filter(row => !archivedPatientIds.has(row.id) && pregnantPatientIds.has(row.id))
                    .map(row => row.id)
            );
            const activeNewbornIds = new Set(
                (newbornRows || [])
                    .filter((row) => row.mother_id && !archivedPatientIds.has(row.mother_id))
                    .map((row) => row.id)
            );

            const isTodayMatch = (rawDate) => {
                if (!rawDate) return false;
                const dateStr = String(rawDate).slice(0, 10);
                if (dateStr === todayStr) return true;
                try {
                    const d = new Date(rawDate);
                    if (Number.isNaN(d.getTime())) return false;
                    const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                    return localDate === todayStr;
                } catch {
                    return false;
                }
            };

            const newbornToMotherMap = new Map((newbornRows || []).map(n => [n.id, n.mother_id]));

            const todayPrenatalFiltered = (prenatalApptData || []).filter(v => {
                if (!v.visit_date || archivedPatientIds.has(v.patient_id)) return false;
                return isTodayMatch(v.visit_date);
            });

            const todayPostpartumFiltered = (postpartumApptData || []).filter(v => {
                if (!v.patient_id || archivedPatientIds.has(v.patient_id)) return false;
                return isTodayMatch(v.scheduled_date || v.scheduled_at);
            });

            const todayVaccinationsFiltered = (vaccinationApptData || []).filter(v => {
                const pid = v.patient_id || newbornToMotherMap.get(v.newborn_id);
                if (!pid || archivedPatientIds.has(pid)) return false;
                return isTodayMatch(v.scheduled_vaccination);
            });

            // Populate patient basic info map for any non-prenatal appointments
            const patientInfoMap = new Map();
            todayPrenatalFiltered.forEach(v => {
                if (v.patient_id && v.patient_basic_info) {
                    patientInfoMap.set(v.patient_id, v.patient_basic_info);
                }
            });

            const missingPatientIds = [
                ...todayPostpartumFiltered.map(v => v.patient_id),
                ...todayVaccinationsFiltered.map(v => v.patient_id || newbornToMotherMap.get(v.newborn_id))
            ].filter(id => id && !patientInfoMap.has(id));

            if (missingPatientIds.length > 0) {
                const { data: morePatients } = await supabase
                    .from('patient_basic_info')
                    .select('id, first_name, last_name, station_ass, stations:station_ass (station_name), date_of_birth')
                    .in('id', [...new Set(missingPatientIds)]);
                (morePatients || []).forEach(p => {
                    patientInfoMap.set(p.id, p);
                });
            }

            // Create a map of patient_id to latest pregnancy info
            const pregMap = new Map();
            (pregnancyData || []).forEach(p => {
                if (p.patient_id && !pregMap.has(p.patient_id)) {
                    pregMap.set(p.patient_id, p);
                }
            });

            const patientVisitsMap = new Map();
            (recentVisitsWithConditions || []).forEach(v => {
                if (!v.patient_id) return;
                const list = patientVisitsMap.get(v.patient_id) || [];
                list.push(v);
                patientVisitsMap.set(v.patient_id, list);
            });

            const postpartumScheduledSet = new Set(todayPostpartumFiltered.map(v => v.patient_id).filter(Boolean));
            const vaccinationScheduledSet = new Set(todayVaccinationsFiltered.map(v => v.patient_id || newbornToMotherMap.get(v.newborn_id)).filter(Boolean));
            const deliveryMap = new Map();
            (deliveriesData || []).forEach(d => {
                if (d.mother_id && (!deliveryMap.has(d.mother_id) || new Date(d.delivery_date) > new Date(deliveryMap.get(d.mother_id)))) {
                    deliveryMap.set(d.mother_id, d.delivery_date);
                }
            });

            const getConditionsForPatient = (patientId, currentVisitRiskFactors = null) => {
                // 1. Retrieve from the Health Conditions page dataset
                if (highRiskPatientMap.has(patientId)) {
                    const hr = highRiskPatientMap.get(patientId);
                    if (Array.isArray(hr.conditionsList) && hr.conditionsList.length > 0) {
                        return hr.conditionsList;
                    }
                    if (hr.condition && hr.condition !== 'None Reported' && hr.condition !== 'None') {
                        const parsed = hr.condition.split(',').map(s => s.trim()).filter(Boolean);
                        if (parsed.length > 0) return parsed;
                    }
                }

                // 2. Fallback to documented risk factors evaluated through the same PatientService method
                if (currentVisitRiskFactors) {
                    const parsed = patientService.getDocumentedHealthConditions(currentVisitRiskFactors);
                    if (parsed.length > 0) return parsed;
                }

                // 3. Fallback to any past visits with documented conditions
                const pastVisits = patientVisitsMap.get(patientId) || [];
                for (const v of pastVisits) {
                    if (v.risk_factors) {
                        const parsed = patientService.getDocumentedHealthConditions(v.risk_factors);
                        if (parsed.length > 0) return parsed;
                    }
                }

                return [];
            };

            const classifyAppointmentType = ({
                sourceTable,
                storedType,
                notes,
                patientId,
                visitDate,
                pregInfo
            }) => {
                // 1. Direct explicit classification from stored appointment type or notes
                const text = String(storedType || notes || '').trim().toLowerCase();
                if (text.includes('postpartum') || text.includes('post-partum') || text.includes('postnatal')) {
                    return 'Postpartum';
                }
                if (text.includes('vaccin') || text.includes('immuniz') || text.includes('toxoid') || text.includes('dose') || text.includes('tt ') || text.includes('bcg') || text.includes('hepa')) {
                    return 'Vaccination';
                }
                if (text.includes('prenatal') || text.includes('antenatal') || text.includes('pre-natal') || text.includes('semester')) {
                    return 'Prenatal';
                }

                // 2. Direct table classification
                if (sourceTable === 'postpartum_visits') {
                    return 'Postpartum';
                }
                if (sourceTable === 'vaccinations') {
                    return 'Vaccination';
                }

                // 3. Older records with generic types (e.g. 'Checkup', 'Consultation', 'Follow-up Checkup', 'Follow-up')
                // Trace related scheduling records to determine correct classification
                if (postpartumScheduledSet.has(patientId)) {
                    return 'Postpartum';
                }
                if (vaccinationScheduledSet.has(patientId)) {
                    return 'Vaccination';
                }
                if (deliveryMap.has(patientId)) {
                    const deliveryDate = deliveryMap.get(patientId);
                    if (deliveryDate && visitDate && new Date(visitDate) >= new Date(deliveryDate)) {
                        return 'Postpartum';
                    }
                }
                if (pregInfo?.pregn_postp?.toLowerCase() === 'postpartum') {
                    return 'Postpartum';
                }

                return 'Prenatal';
            };

            const mappedPrenatal = todayPrenatalFiltered.map(v => {
                const info = v.patient_basic_info || patientInfoMap.get(v.patient_id) || {};
                const pregInfo = pregMap.get(v.patient_id) || {};

                let age = '?';
                if (info.date_of_birth) {
                    const bd = new Date(info.date_of_birth);
                    age = now.getFullYear() - bd.getFullYear();
                    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
                }

                let weeks = null;
                if (pregInfo.lmd) {
                    weeks = Math.max(0, Math.floor((now - new Date(pregInfo.lmd)) / (1000 * 60 * 60 * 24 * 7)));
                } else if (v.gestational_age) {
                    const parsedGa = parseInt(v.gestational_age);
                    if (!isNaN(parsedGa) && parsedGa > 0) weeks = parsedGa;
                }

                const type = classifyAppointmentType({
                    sourceTable: 'prenatal_visits',
                    storedType: v.next_appt_type,
                    notes: v.clinical_notes,
                    patientId: v.patient_id,
                    visitDate: v.visit_date,
                    pregInfo
                });

                const conditions = getConditionsForPatient(v.patient_id, v.risk_factors);

                return {
                    id: v.id,
                    patientId: v.patient_id,
                    name: `${info.first_name || ''} ${info.last_name || ''}`.trim() || 'Unknown',
                    station: info.stations?.station_name || 'N/A',
                    age: age,
                    weeks: type === 'Postpartum' ? null : weeks,
                    type: type,
                    conditions: conditions,
                    created_at: v.created_at
                };
            });

            const mappedPostpartum = todayPostpartumFiltered.map(v => {
                const info = patientInfoMap.get(v.patient_id) || {};
                let age = '?';
                if (info.date_of_birth) {
                    const bd = new Date(info.date_of_birth);
                    age = now.getFullYear() - bd.getFullYear();
                    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
                }

                const conditions = getConditionsForPatient(v.patient_id, null);

                return {
                    id: v.id,
                    patientId: v.patient_id,
                    name: `${info.first_name || ''} ${info.last_name || ''}`.trim() || 'Unknown',
                    station: info.stations?.station_name || 'N/A',
                    age: age,
                    weeks: null,
                    type: 'Postpartum',
                    conditions: conditions,
                    created_at: v.created_at || v.scheduled_at
                };
            });

            const mappedVaccinations = todayVaccinationsFiltered.map(v => {
                const patientId = v.patient_id || newbornToMotherMap.get(v.newborn_id);
                const info = patientInfoMap.get(patientId) || {};
                const pregInfo = pregMap.get(patientId) || {};

                let age = '?';
                if (info.date_of_birth) {
                    const bd = new Date(info.date_of_birth);
                    age = now.getFullYear() - bd.getFullYear();
                    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
                }

                let weeks = null;
                if (pregInfo.lmd && pregInfo.pregn_postp?.toLowerCase() === 'pregnant') {
                    weeks = Math.max(0, Math.floor((now - new Date(pregInfo.lmd)) / (1000 * 60 * 60 * 24 * 7)));
                }

                const conditions = getConditionsForPatient(patientId, null);

                return {
                    id: v.id,
                    patientId: patientId,
                    name: `${info.first_name || ''} ${info.last_name || ''}`.trim() || 'Unknown',
                    station: info.stations?.station_name || 'N/A',
                    age: age,
                    weeks: weeks,
                    type: 'Vaccination',
                    conditions: conditions,
                    created_at: v.created_at
                };
            });

            const allMappedAppts = [
                ...mappedPrenatal,
                ...mappedPostpartum,
                ...mappedVaccinations
            ];

            // Remove duplicates based on patient and appointment type (keep latest)
            const uniqueAppts = allMappedAppts.reduce((acc, current) => {
                const existingIndex = acc.findIndex(item => item.patientId ? (item.patientId === current.patientId && item.type === current.type) : item.name === current.name);
                if (existingIndex === -1) {
                    acc.push(current);
                } else {
                    const existingTime = new Date(acc[existingIndex].created_at || 0).getTime();
                    const currentTime = new Date(current.created_at || 0).getTime();
                    if (currentTime > existingTime) {
                        acc[existingIndex] = current;
                    }
                }
                return acc;
            }, []);

            setTodayAppts(uniqueAppts);

            setLiveStats({
                totalPatients: activePatientIds.size,
                highRisk: healthConditionCount,
                newborns: activeNewbornIds.size,
                apptToday: uniqueAppts.length,
            });

            // Fetch Vaccine Stock
            setLoadingStock(true);
            const stockData = await patientService.getVaccineInventory();
            setVaccineStock(stockData);
            setLoadingStock(false);

            // Fetch Health Snapshot Data
            setLoadingHealth(true);
            const [{ data: healthPrenatalVisits, error: visitsError }, { data: healthPregnancies, error: pregError }] = await Promise.all([
                supabase.from('prenatal_visits').select('patient_id, bp_systolic, bp_diastolic, risk_factors, calculated_risk'),
                supabase.from('pregnancy_info').select('patient_id, lmd, created_at').eq('pregn_postp', 'Pregnant').order('created_at', { ascending: false })
            ]);

            if (visitsError) console.error('Error fetching prenatal visits for health snapshot:', visitsError);
            if (pregError) console.error('Error fetching pregnancies for health snapshot:', pregError);

            console.log('Health snapshot data - prenatalVisits:', healthPrenatalVisits?.length || 0, 'pregnancies:', healthPregnancies?.length || 0);

            // Calculate health conditions
            let normalBP = 0, preEclampsia = 0, anaemia = 0, gestationalDiabetes = 0;
            const totalVisits = healthPrenatalVisits?.filter(visit => !archivedPatientIds.has(visit.patient_id)).length || 0;

            healthPrenatalVisits?.forEach(visit => {
                if (archivedPatientIds.has(visit.patient_id)) return;
                const sys = visit.bp_systolic;
                const dia = visit.bp_diastolic;
                
                // BP classification
                if (sys && dia) {
                    if (sys >= 140 || dia >= 90) {
                        preEclampsia++;
                    } else {
                        normalBP++;
                    }
                }

                // Check risk factors for other conditions
                if (visit.risk_factors) {
                    const riskFactors = Array.isArray(visit.risk_factors) ? visit.risk_factors : visit.risk_factors.split(',').map(s => s.trim());
                    if (riskFactors.includes('anemia') || riskFactors.includes('anaemia')) {
                        anaemia++;
                    }
                    if (riskFactors.includes('gestational diabetes') || riskFactors.includes('diabetes')) {
                        gestationalDiabetes++;
                    }
                }
            });

            const conditions = [
                { label: 'Normal BP', pct: totalVisits > 0 ? Math.round((normalBP / totalVisits) * 100) : 0, color: 'sage' },
                { label: 'Pre-eclampsia', pct: totalVisits > 0 ? Math.round((preEclampsia / totalVisits) * 100) : 0, color: 'rose' },
                { label: 'Anaemia', pct: totalVisits > 0 ? Math.round((anaemia / totalVisits) * 100) : 0, color: 'orange' },
                { label: 'Gestational Diabetes', pct: totalVisits > 0 ? Math.round((gestationalDiabetes / totalVisits) * 100) : 0, color: 'yellow' },
            ];

            // Calculate trimester distribution - count unique pregnant patients only
            let tri1 = 0, tri2 = 0, tri3 = 0;
            const currentDate = new Date();

            // Build map of latest pregnancy info per patient (first occurrence is latest due to ordering)
            const latestPregMap = new Map();
            (healthPregnancies || []).forEach(p => {
                if (archivedPatientIds.has(p.patient_id)) return;
                if (p.patient_id && !latestPregMap.has(p.patient_id)) {
                    latestPregMap.set(p.patient_id, p);
                }
            });

            // Count unique patients in each trimester
            latestPregMap.forEach(preg => {
                if (preg.lmd) {
                    const lmpDate = new Date(preg.lmd);
                    const weeks = Math.floor((currentDate - lmpDate) / (1000 * 60 * 60 * 24 * 7));
                    if (weeks <= 12) tri1++;
                    else if (weeks <= 26) tri2++;
                    else tri3++;
                }
            });

            const trimesterDist = [
                { label: '1st Trimester', count: tri1, color: 'tri1' },
                { label: '2nd Trimester', count: tri2, color: 'tri2' },
                { label: '3rd Trimester', count: tri3, color: 'tri3' },
            ];

            setHealthSnapshot({ conditions, trimesterDist });
            setLoadingHealth(false);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load dashboard stats:', err);
            setError(err);
            setLoadingStock(false);
            setLoadingHealth(false);
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchStats();
    }, []);



    const displayName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'User');
    const roleLabel = user?.role?.toUpperCase() || 'UNKNOWN';

    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    if (loading) {
        return (
            <StaffPageLoader 
                message="Loading dashboard overview..." 
                error={error} 
                onRetry={fetchStats} 
            />
        );
    }

    return (
        <div className="dashboard staff-page-ready">

            {/* ── Page Title ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-date">{today}</p>
                </div>
                <div className="page-header-empty"></div>
            </div>

            {/* ── Welcome Banner + Quick Actions ── */}
            <div className="welcome-banner">
                <div className="welcome-left">
                    <p className="welcome-greeting">Good day, {displayName} <span className="wave-emoji">👋</span></p>
                    <p className="welcome-sub">
                        You have <strong 
                            onClick={() => navigate('/dashboard/prenatal')}
                            style={{ cursor: 'pointer', textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if(e.key === 'Enter') navigate('/dashboard/prenatal') }}
                            aria-label="View today's appointments"
                        >
                            {liveStats.apptToday} appointments
                        </strong> today and <strong 
                            onClick={() => navigate('/dashboard/high-risk')}
                            style={{ cursor: 'pointer', textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if(e.key === 'Enter') navigate('/dashboard/high-risk') }}
                            aria-label="View patients with health conditions"
                        >
                            {liveStats.highRisk} patients with documented health conditions
                        </strong> requiring attention.
                    </p>
                </div>
                <div className="welcome-actions-panel">
                    <p className="welcome-actions-title">Quick Actions</p>
                    <div className="welcome-actions">
                        {[
                            { label: 'Register Pregnancy', icon: Plus, color: 'rose', path: '/dashboard/patients/add' },
                            { label: 'View Schedules', icon: CalendarCheck, color: 'sage', path: '/dashboard/prenatal', state: { openBooking: true } },
                            { label: 'Health Conditions', icon: AlertTriangle, color: 'blue', path: '/dashboard/high-risk' },
                            { label: 'Log Delivery', icon: Baby, color: 'pink', path: '/dashboard/deliveries', state: { openRecordDelivery: true } },
                            { label: 'Issue Vaccine', icon: Syringe, color: 'orange', path: '/dashboard/vaccinations', state: { openRecordVaccination: true } },
                            { label: 'Generate Report', icon: FileText, color: 'purple', path: '/dashboard/analytics' },
                        ].map(({ label, icon: Icon, color, path, state }) => (
                            <button key={label} className={`quick-btn quick-btn--${color}`} onClick={() => navigate(path, state ? { state } : undefined)}>
                                <Icon size={15} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="stats-grid">
                {STAT_META.map((s) => {
                    const value = liveStats[s.key] ?? 0;
                    const Icon = s.icon;
                    return (
                        <div 
                            key={s.id} 
                            className={`stat-card stat-card--${s.color}`}
                            onClick={() => navigate(s.path)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="stat-top">
                                <div className={`stat-icon stat-icon--${s.color}`}>
                                    <Icon size={20} />
                                </div>
                                <span className={`stat-trend stat-trend--${s.trend}`}>
                                    {s.trend === 'up' && <TrendingUp size={13} />}
                                    {s.trend === 'down' && <TrendingDown size={13} />}
                                    {'—'}
                                </span>
                            </div>
                            <div className="stat-value">{value}</div>
                            <div className="stat-label">{s.label}</div>
                            <div className="stat-sub">{s.sub}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Main 2-column grid ── */}
            <div className="dash-grid">

                {/* ── Left Column ── */}
                <div className="dash-col-left">

                    {/* UPCOMING APPOINTMENTS */}
                    <div className="card clickable-card" onClick={() => navigate('/dashboard/prenatal')}>
                        <div className="card-header">
                            <h2 className="card-title">
                                <CalendarCheck size={16} />
                                Today's Appointments
                                <span className="card-badge card-badge--blue">{liveStats.apptToday}</span>
                            </h2>
                            <button className="card-link" onClick={() => navigate('/dashboard/prenatal')}>View all <ChevronRight size={13} /></button>
                        </div>
                        <p className="card-description">Overview of patients scheduled to visit the clinic today.</p>
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Trimester</th>
                                        <th>Type</th>
                                        <th>Health Conditions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {todayAppts.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)'}}>
                                                No appointments scheduled for today.
                                            </td>
                                        </tr>
                                    ) : (
                                        todayAppts.map((a) => (
                                            <tr key={a.id} className="table-row">
                                                <td>
                                                    <div className="patient-cell">
                                                        <div className="patient-avatar">
                                                            {a.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                                        </div>
                                                        <div>
                                                            <p className="patient-name">{a.name}</p>
                                                            <p className="patient-meta">{a.station} · {a.age} yrs</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><TrimesterBadge weeks={a.weeks} isPostpartum={a.type === 'Postpartum'} /></td>
                                                <td>
                                                    <span className={`type-tag type-tag--${a.type.toLowerCase()}`}>
                                                        {a.type}
                                                    </span>
                                                </td>
                                                <td>
                                                    <HealthConditionsCell conditions={a.conditions} />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* VACCINE & SUPPLEMENT STOCK */}
                    <div className="card clickable-card" onClick={() => navigate('/dashboard/inventory')}>
                        <div className="card-header">
                            <h2 className="card-title">
                                <Syringe size={16} />Vaccine &amp; Supplement
                            </h2>
                            <button className="card-link" onClick={() => navigate('/dashboard/inventory')}>Manage <ChevronRight size={13} /></button>
                        </div>
                        <p className="card-description">Manage real-time inventory levels of vital supplements and vaccines.</p>
                        
                        {/* Stock Status Summary Cards */}
                        {!loadingStock && vaccineStock.length > 0 && (
                            <div className="stock-summary-cards">
                                <div className="stock-summary-card stock-summary--out">
                                    <span className="stock-summary-count">{vaccineStock.filter(v => v.status === 'out').length}</span>
                                    <span className="stock-summary-label">OUT OF STOCK</span>
                                </div>
                                <div className="stock-summary-card stock-summary--low">
                                    <span className="stock-summary-count">{vaccineStock.filter(v => v.status === 'low').length}</span>
                                    <span className="stock-summary-label">LOW STOCK</span>
                                </div>
                                <div className="stock-summary-card stock-summary--medium">
                                    <span className="stock-summary-count">{vaccineStock.filter(v => v.status === 'medium').length}</span>
                                    <span className="stock-summary-label">MEDIUM STOCK</span>
                                </div>
                                <div className="stock-summary-card stock-summary--ok">
                                    <span className="stock-summary-count">{vaccineStock.filter(v => v.status === 'ok').length}</span>
                                    <span className="stock-summary-label">NORMAL</span>
                                </div>
                            </div>
                        )}
                        
                        <div className="stock-list">
                            {loadingStock ? (
                                <div className="stock-loading">Loading inventory...</div>
                            ) : vaccineStock.length > 0 ? (
                                vaccineStock
                                    .sort((a, b) => {
                                        // Priority sort: Expired (-1) -> Out (0) → Low (1) → Medium (2) → Normal (3)
                                        const priority = { expired: -1, out: 0, low: 1, medium: 2, ok: 3 };
                                        return priority[a.status] - priority[b.status];
                                    })
                                    .slice(0, 5)
                                    .map((v, index) => (
                                    <div key={`${v.name}-${index}`} className={`stock-item stock-item--${v.status === 'expired' ? 'out' : v.status}`}>
                                        <div className="stock-info">
                                            <span className="stock-name">{v.name}</span>
                                            <div className="stock-bar-wrap">
                                                <MiniBar
                                                    value={v.stock}
                                                    max={Math.max(v.stock, v.min) * 1.5}
                                                    color={v.status === 'ok' ? 'sage' : v.status === 'medium' ? 'orange' : 'rose'}
                                                />
                                            </div>
                                        </div>
                                        <div className="stock-meta">
                                            <span className="stock-qty">{v.stock} {v.unit}</span>
                                            <span className={`stock-badge stock-badge--${v.status === 'expired' ? 'out' : v.status}`}>
                                                {v.status === 'expired' ? 'EXPIRED' : v.status === 'ok' ? 'Normal' : v.status === 'medium' ? 'Medium Stock' : v.status === 'low' ? 'Low Stock' : 'Out of Stock'}
                                            </span>
                                        </div>
                                        {v.expiration_date && (
                                            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                                {v.days_until_expiry < 0 
                                                  ? `Expired ${Math.abs(v.days_until_expiry)} days ago` 
                                                  : v.days_until_expiry <= 30 
                                                    ? `Expires in ${v.days_until_expiry} days` 
                                                    : `Expires: ${formatDate(v.expiration_date)}`}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="stock-empty">No inventory data available.</div>
                            )}
                        </div>
                    </div>

                </div>{/* end left col */}

                {/* ── Right Column ── */}
                <div className="dash-col-right">

                    {/* PATIENT OVERVIEW */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title"><Users size={16} />Patient Overview</h2>
                        </div>
                        <div className="patient-overview-list">
                            {loadingHealth ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                                    Loading...
                                </div>
                            ) : (
                                <>
                                    <div 
                                        className="po-row po-row--total" 
                                        onClick={() => navigate('/dashboard/patients')}
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard/patients'); }}
                                        role="button"
                                        aria-label="View Total Patients"
                                    >
                                        <span className="po-count">{liveStats.totalPatients}</span>
                                        <span className="po-label">Total Patients</span>
                                    </div>
                                    <div className="po-divider" />
                                    {healthSnapshot.trimesterDist.map(t => (
                                        <div 
                                            key={t.label} 
                                            className={`po-row po-row--${t.color}`}
                                            onClick={() => navigate(`/dashboard/patients?trimester=${t.label.charAt(0)}`)}
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/dashboard/patients?trimester=${t.label.charAt(0)}`); }}
                                            role="button"
                                            aria-label={`View ${t.label} patients`}
                                        >
                                            <span className="po-count">{t.count}</span>
                                            <span className="po-label">{t.label}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>

                </div>{/* end right col */}

            </div>{/* end dash-grid */}
        </div>
    );
};

export default Dashboard;
