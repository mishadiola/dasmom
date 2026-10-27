import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import {
    Users, Baby, AlertTriangle, CalendarCheck, TrendingUp,
    TrendingDown, Activity, Syringe, HeartPulse, MapPin,
    ChevronRight, ChevronDown, ChevronUp, Plus, FileText, Eye, Filter,
    CheckCircle2, XCircle, Circle, Dot, MoreHorizontal,
    ArrowUpRight, Star, Smartphone, Download, QrCode
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/Dashboard.css';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import supabase from '../../config/supabaseclient';
import { AuthContext } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatters';
import { useDefaultStation } from '../../hooks/useDefaultStation';
import { useRolePermissions } from '../../context/RolePermissionContext';
import { getUpcomingEddSchedule } from '../../services/eddScheduleService';

const authService = new AuthService();
const APK_DOWNLOAD_URL = 'https://hcrpdvizautiuwgmfcqc.supabase.co/storage/v1/object/public/dasmom-apk/app-release.apk';


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
    const { hasPermission, loading: permissionsLoading } = useRolePermissions();
    const patientService = useMemo(() => new PatientService(), []);

    const [availableStations, setAvailableStations] = useState([]);
    useEffect(() => {
        const fetchStations = async () => {
            try {
                const data = await patientService.getAllStations();
                setAvailableStations(data || []);
            } catch (err) {
                console.error('Error fetching stations:', err);
            }
        };
        fetchStations();
    }, [patientService]);

    const {
        assignedStation,
        isStationStaff,
        canViewOtherStations,
        availableStations: permittedStations,
        matchStation
    } = useDefaultStation({
        permissionKey: [
            'prenatal.schedule.view.other_station',
            'postpartum.schedule.view.other_station',
            'vaccine.schedule.view.other_station',
            'patient.view.other_station'
        ],
        allStations: availableStations,
        isArray: false
    });

    const [selectedStation, setSelectedStation] = useState(() => (
        isStationStaff && assignedStation ? assignedStation : 'All'
    ));
    const userHasChangedStationRef = useRef(false);

    useEffect(() => {
        if (!userHasChangedStationRef.current && isStationStaff && assignedStation) {
            setSelectedStation(prev => (prev !== 'All' ? prev : assignedStation));
        }
    }, [isStationStaff, assignedStation]);
    
    //const [user, setUser] = useState(null);
    const [liveStats, setLiveStats] = useState({ totalPatients: 0, highRisk: 0, newborns: 0, apptToday: 0 });
    const [vaccineStock, setVaccineStock] = useState([]);
    const [loadingStock, setLoadingStock] = useState(true);
    const [stockError, setStockError] = useState(null);
    const [todayAppts, setTodayAppts] = useState([]);
    const [loadingAppointments, setLoadingAppointments] = useState(true);
    const [appointmentError, setAppointmentError] = useState(null);
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [overviewError, setOverviewError] = useState(null);
    const [loadingNewborns, setLoadingNewborns] = useState(true);
    const [newbornError, setNewbornError] = useState(null);
    const [loadingHighRisk, setLoadingHighRisk] = useState(true);
    const [highRiskError, setHighRiskError] = useState(null);
    const [healthSnapshot, setHealthSnapshot] = useState({ trimesterDist: [] });
    const [eddSchedule, setEddSchedule] = useState([]);
    const [loadingEddSchedule, setLoadingEddSchedule] = useState(true);
    const [eddScheduleError, setEddScheduleError] = useState(null);
    const isFetchingStats = useRef(false);
    const dashboardRequestQueue = useRef(Promise.resolve());
    const enqueueDashboardRequest = useCallback(task => {
        const queuedRequest = dashboardRequestQueue.current.then(task, task);
        dashboardRequestQueue.current = queuedRequest.then(() => undefined, () => undefined);
        return queuedRequest;
    }, []);

    const [visibleApptCount, setVisibleApptCount] = useState(10);

    const displayedAppointments = useMemo(() => {
        if (!selectedStation || selectedStation === 'All') return todayAppts;
        return todayAppts.filter(a => matchStation(a.station, selectedStation));
    }, [todayAppts, selectedStation, matchStation]);

    const displayedApptCount = displayedAppointments.length;

    // Reset visible appointment count to 10 when selected station changes
    useEffect(() => {
        setVisibleApptCount(10);
    }, [selectedStation]);

    const visibleAppointments = useMemo(() => {
        return displayedAppointments.slice(0, visibleApptCount);
    }, [displayedAppointments, visibleApptCount]);

    const fetchStats = useCallback(async () => {
        if (isFetchingStats.current) return;
        isFetchingStats.current = true;
        setLoadingAppointments(true);
        setAppointmentError(null);
        return enqueueDashboardRequest(async () => {
            try {
            const now = new Date();
            const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);

            const [
                { data: prenatalApptData, error: prenatalError },
                { data: postpartumApptData, error: postpartumError },
                { data: vaccinationApptData, error: vaccinationError }
            ] = await Promise.all([
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
                    id, patient_id, delivery_id, visit_type, visit_number, scheduled_date, scheduled_at, status, created_at,
                    delivery:deliveries!postpartum_visits_delivery_id_fkey (
                        mother_id,
                        patient_basic_info!deliveries_mother_id_fkey (
                            id, first_name, last_name, station_ass, stations:station_ass (station_name), date_of_birth
                        )
                    )
                `).or(`scheduled_date.eq.${todayStr},and(scheduled_date.is.null,scheduled_at.gte.${todayStart.toISOString()},scheduled_at.lt.${tomorrowStart.toISOString()})`)
                  .neq('status', 'Cancelled')
                  .neq('status', 'Missed'),
                supabase.from('vaccinations').select(`
                    id, patient_id, newborn_id, scheduled_vaccination, status, notes, dose_number, created_at,
                    vaccine_inventory (vaccine_name)
                `).eq('scheduled_vaccination', todayStr)
                  .neq('status', 'Cancelled')
                  .neq('status', 'Missed')
                  .neq('status', 'cancelled')
                  .neq('status', 'missed')
            ]);

            if (prenatalError) throw prenatalError;
            if (postpartumError) throw postpartumError;
            if (vaccinationError) throw vaccinationError;

            const getPostpartumPatientId = visit =>
                visit.delivery?.mother_id || visit.delivery?.patient_basic_info?.id || visit.patient_id;

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

            const linkedNewbornIds = [...new Set(
                (vaccinationApptData || [])
                    .filter(v => !v.patient_id && v.newborn_id)
                    .map(v => v.newborn_id)
            )];
            const newbornToMotherMap = new Map();
            if (linkedNewbornIds.length > 0) {
                const { data: newbornRows, error: newbornError } = await supabase
                    .from('newborns')
                    .select('id, mother_id')
                    .in('id', linkedNewbornIds);
                if (newbornError) throw newbornError;
                (newbornRows || []).forEach(newborn => newbornToMotherMap.set(newborn.id, newborn.mother_id));
            }

            const todayPrenatalFiltered = (prenatalApptData || []).filter(v => {
                if (!v.visit_date) return false;
                return isTodayMatch(v.visit_date);
            });

            const todayPostpartumFiltered = (postpartumApptData || []).filter(v => {
                const patientId = getPostpartumPatientId(v);
                if (!patientId) return false;
                return isTodayMatch(v.scheduled_date || v.scheduled_at);
            });

            const todayVaccinationsFiltered = (vaccinationApptData || []).filter(v => {
                const pid = v.patient_id || newbornToMotherMap.get(v.newborn_id);
                if (!pid) return false;
                return isTodayMatch(v.scheduled_vaccination);
            });

            const appointmentPatientIds = [...new Set([
                ...todayPrenatalFiltered.map(v => v.patient_id),
                ...todayPostpartumFiltered.map(getPostpartumPatientId),
                ...todayVaccinationsFiltered.map(v => v.patient_id || newbornToMotherMap.get(v.newborn_id))
            ].filter(Boolean))];

            let pregnancyData = [];
            let deliveriesData = [];
            let recentVisitsWithConditions = [];
            if (appointmentPatientIds.length > 0) {
                const [
                    { data: pregnancies, error: pregnancyError },
                    { data: deliveries, error: deliveriesError },
                    { data: visits, error: visitsError }
                ] = await Promise.all([
                    supabase.from('pregnancy_info')
                        .select('patient_id, lmd, pregn_postp, created_at')
                        .in('patient_id', appointmentPatientIds)
                        .order('created_at', { ascending: false }),
                    supabase.from('deliveries')
                        .select('id, mother_id, delivery_date')
                        .in('mother_id', appointmentPatientIds),
                    supabase.from('prenatal_visits')
                        .select('patient_id, risk_factors, visit_date, bp_systolic, bp_diastolic, calculated_risk')
                        .in('patient_id', appointmentPatientIds)
                        .order('visit_date', { ascending: false })
                ]);
                if (pregnancyError) throw pregnancyError;
                if (deliveriesError) throw deliveriesError;
                if (visitsError) throw visitsError;
                pregnancyData = pregnancies || [];
                deliveriesData = deliveries || [];
                recentVisitsWithConditions = visits || [];
            }

            // Populate patient basic info map for any non-prenatal appointments
            const patientInfoMap = new Map();
            todayPrenatalFiltered.forEach(v => {
                if (v.patient_id && v.patient_basic_info) {
                    patientInfoMap.set(v.patient_id, v.patient_basic_info);
                }
            });
            todayPostpartumFiltered.forEach(visit => {
                const patient = visit.delivery?.patient_basic_info;
                if (patient?.id) patientInfoMap.set(patient.id, patient);
            });

            const missingPatientIds = [
                ...todayPostpartumFiltered.map(getPostpartumPatientId),
                ...todayVaccinationsFiltered.map(v => v.patient_id || newbornToMotherMap.get(v.newborn_id))
            ].filter(id => id && !patientInfoMap.has(id));

            if (missingPatientIds.length > 0) {
                const { data: morePatients, error: patientInfoError } = await supabase
                    .from('patient_basic_info')
                    .select('id, first_name, last_name, station_ass, stations:station_ass (station_name), date_of_birth')
                    .in('id', [...new Set(missingPatientIds)]);
                if (patientInfoError) throw patientInfoError;
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

            const postpartumScheduledSet = new Set(todayPostpartumFiltered.map(getPostpartumPatientId).filter(Boolean));
            const vaccinationScheduledSet = new Set(todayVaccinationsFiltered.map(v => v.patient_id || newbornToMotherMap.get(v.newborn_id)).filter(Boolean));
            const deliveryMap = new Map();
            (deliveriesData || []).forEach(d => {
                if (d.mother_id && (!deliveryMap.has(d.mother_id) || new Date(d.delivery_date) > new Date(deliveryMap.get(d.mother_id)))) {
                    deliveryMap.set(d.mother_id, d.delivery_date);
                }
            });

            const getConditionsForPatient = (patientId, currentVisitRiskFactors = null) => {
                if (currentVisitRiskFactors) {
                    const parsed = patientService.getDocumentedHealthConditions(currentVisitRiskFactors);
                    if (parsed.length > 0) return parsed;
                }

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

            const mappedPostpartum = todayPostpartumFiltered
                .filter(v => patientInfoMap.has(getPostpartumPatientId(v)))
                .map(v => {
                    const patientId = getPostpartumPatientId(v);
                    const info = patientInfoMap.get(patientId);
                    let age = '?';
                    if (info.date_of_birth) {
                        const bd = new Date(info.date_of_birth);
                        age = now.getFullYear() - bd.getFullYear();
                        if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
                    }

                    const conditions = getConditionsForPatient(patientId, null);

                    return {
                        id: v.id,
                        patientId,
                        name: `${info.first_name || ''} ${info.last_name || ''}`.trim(),
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

            setLiveStats(previous => ({ ...previous, apptToday: uniqueAppts.length }));
            setLoadingAppointments(false);
        } catch (err) {
            console.error('Failed to load dashboard appointments:', err);
            setAppointmentError(err);
            setLoadingAppointments(false);
            } finally {
                isFetchingStats.current = false;
            }
        });
    }, [enqueueDashboardRequest, patientService]);
    
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        let active = true;
        const loadOverview = async () => {
            setLoadingOverview(true);
            setOverviewError(null);
            setLoadingNewborns(true);
            setNewbornError(null);
            try {
                const { data, error: overviewLoadError } = await supabase.rpc('get_dashboard_overview');
                if (overviewLoadError) throw overviewLoadError;
                if (!data) throw new Error('Dashboard overview returned no data.');
                if (!active) return;
                setLiveStats(previous => ({
                    ...previous,
                    totalPatients: Number(data.totalPatients) || 0,
                    newborns: Number(data.totalNewborns) || 0
                }));
                setHealthSnapshot({
                    trimesterDist: data.trimesterDist || []
                });
            } catch (overviewLoadError) {
                console.error('Failed to load dashboard patient overview:', overviewLoadError);
                if (active) {
                    setOverviewError(overviewLoadError);
                    setNewbornError(overviewLoadError);
                }
            } finally {
                if (active) {
                    setLoadingOverview(false);
                    setLoadingNewborns(false);
                }
            }
        };
        enqueueDashboardRequest(loadOverview);
        return () => { active = false; };
    }, [enqueueDashboardRequest]);

    useEffect(() => {
        let active = true;
        const loadHighRiskCount = async () => {
            setLoadingHighRisk(true);
            setHighRiskError(null);
            try {
                const patients = await patientService.getHighRiskPatients();
                if (active) setLiveStats(previous => ({ ...previous, highRisk: patients.length }));
            } catch (loadError) {
                console.error('Failed to load dashboard health-condition count:', loadError);
                if (active) setHighRiskError(loadError);
            } finally {
                if (active) setLoadingHighRisk(false);
            }
        };
        enqueueDashboardRequest(loadHighRiskCount);
        return () => { active = false; };
    }, [enqueueDashboardRequest, patientService]);

    useEffect(() => {
        let active = true;
        const loadInventory = async () => {
            setLoadingStock(true);
            setStockError(null);
            try {
                const stockData = await patientService.getVaccineInventory();
                if (active) setVaccineStock(stockData);
            } catch (loadError) {
                console.error('Failed to load dashboard inventory:', loadError);
                if (active) setStockError(loadError);
            } finally {
                if (active) setLoadingStock(false);
            }
        };
        enqueueDashboardRequest(loadInventory);
        return () => { active = false; };
    }, [enqueueDashboardRequest, patientService]);

    useEffect(() => {
        if (permissionsLoading) return undefined;
        let active = true;
        const loadEddSchedule = async () => {
            setLoadingEddSchedule(true);
            setEddScheduleError(null);
            if (!hasPermission('edd.schedule.view.own_station')
                && !hasPermission('edd.schedule.view.other_station')) {
                setEddSchedule([]);
                setLoadingEddSchedule(false);
                return;
            }
            try {
                const access = await patientService.getCurrentUserAccess();
                const todayDate = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Manila',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(new Date());
                const endDate = new Date(`${todayDate}T00:00:00.000Z`);
                endDate.setUTCDate(endDate.getUTCDate() + 30);
                const rows = await getUpcomingEddSchedule({
                    startDate: todayDate,
                    endDate: endDate.toISOString().slice(0, 10),
                    stationId: access?.stationId || null,
                    includeOtherStations: hasPermission('edd.schedule.view.other_station')
                });
                if (active) setEddSchedule(rows);
            } catch (loadError) {
                console.error('Failed to load the upcoming EDD schedule:', loadError);
                if (active) setEddScheduleError(loadError);
            } finally {
                if (active) setLoadingEddSchedule(false);
            }
        };
        enqueueDashboardRequest(loadEddSchedule);
        return () => { active = false; };
    }, [enqueueDashboardRequest, hasPermission, patientService, permissionsLoading]);



    const displayName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'User');
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

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
                            {displayedApptCount} appointments
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
                            { label: 'Generate Report', icon: FileText, color: 'purple', path: ['staff', 'station staff'].includes(String(user?.role || '').toLowerCase()) ? '/dashboard/stations' : '/dashboard/analytics' },
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
                    const value = s.key === 'apptToday' ? displayedApptCount : (liveStats[s.key] ?? 0);
                    const isStatLoading = s.key === 'apptToday'
                        ? loadingAppointments
                        : s.key === 'highRisk'
                            ? loadingHighRisk
                            : s.key === 'newborns'
                                ? loadingNewborns
                                : loadingOverview;
                    const statError = s.key === 'apptToday'
                        ? appointmentError
                        : s.key === 'highRisk'
                            ? highRiskError
                            : s.key === 'newborns'
                                ? newbornError
                                : overviewError;
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
                            <div className="stat-value" title={statError?.message || undefined}>
                                {isStatLoading ? '...' : statError ? '—' : value}
                            </div>
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
                        <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
                            <h2 className="card-title">
                                <CalendarCheck size={16} />
                                Today's Appointments
                                <span className="card-badge card-badge--blue">{displayedApptCount}</span>
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                {permittedStations.length > 0 && (
                                    <select
                                        className="st-station-filter-select"
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            borderRadius: '6px',
                                            border: '1px solid #e2e8f0',
                                            background: '#fff',
                                            cursor: (isStationStaff && !canViewOtherStations) ? 'default' : 'pointer'
                                        }}
                                        value={isStationStaff && !canViewOtherStations ? (assignedStation || 'All') : selectedStation}
                                        disabled={isStationStaff && !canViewOtherStations}
                                        onChange={e => {
                                            userHasChangedStationRef.current = true;
                                            setSelectedStation(e.target.value);
                                        }}
                                        aria-label="Filter today's appointments by station"
                                    >
                                        {(!isStationStaff || canViewOtherStations) && (
                                            <option value="All">All Stations</option>
                                        )}
                                        {permittedStations.map(stationName => (
                                            <option key={stationName} value={stationName}>
                                                {stationName}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <button className="card-link" onClick={() => navigate('/dashboard/prenatal')}>View all <ChevronRight size={13} /></button>
                            </div>
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
                                    {loadingAppointments ? (
                                        <tr>
                                            <td colSpan="4" className="dashboard-section-loading">Loading today's appointments...</td>
                                        </tr>
                                    ) : appointmentError ? (
                                        <tr>
                                            <td colSpan="4" className="dashboard-section-error">
                                                Could not load appointments: {appointmentError.message || 'Please try again.'}
                                                <button type="button" className="card-link" onClick={event => { event.stopPropagation(); fetchStats(); }}>Retry</button>
                                            </td>
                                        </tr>
                                    ) : displayedAppointments.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" style={{textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)'}}>
                                                No appointments scheduled for today{selectedStation !== 'All' ? ` in ${selectedStation}` : ''}.
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleAppointments.map((a) => (
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

                        {displayedApptCount > 10 && (
                            <div className="dash-appt-footer" onClick={e => e.stopPropagation()}>
                                <span className="dash-appt-count-indicator">
                                    Showing {visibleAppointments.length} of {displayedApptCount} appointments
                                </span>
                                <button
                                    type="button"
                                    className="dash-appt-show-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (visibleApptCount < displayedApptCount) {
                                            setVisibleApptCount(prev => prev + 10);
                                        } else {
                                            setVisibleApptCount(10);
                                        }
                                    }}
                                >
                                    {visibleApptCount < displayedApptCount ? (
                                        <>
                                            <span>Show More</span>
                                            <ChevronDown size={14} />
                                        </>
                                    ) : (
                                        <>
                                            <span>Show Less</span>
                                            <ChevronUp size={14} />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
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
                            ) : stockError ? (
                                <div className="stock-empty">Could not load inventory: {stockError.message || 'Please try again.'}</div>
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
                            {loadingOverview ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                                    Loading patient overview...
                                </div>
                            ) : overviewError ? (
                                <div className="dashboard-section-error" role="alert">
                                    Could not load patient overview: {overviewError.message || 'Please try again.'}
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

                    <div
                        className="card clickable-card edd-dashboard-card"
                        onClick={() => navigate('/dashboard/prenatal?tab=edd')}
                        onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') navigate('/dashboard/prenatal?tab=edd');
                        }}
                        role="link"
                        tabIndex={0}
                        aria-label="Open the EDD calendar in Visits and Scheduling"
                    >
                        <div className="card-header">
                            <h2 className="card-title"><CalendarCheck size={16} />Upcoming Estimated Due Dates</h2>
                            <span className="card-badge card-badge--blue">{loadingEddSchedule ? '...' : eddSchedule.length}</span>
                        </div>
                        <p className="card-description">Estimated from LMP. Showing due dates from today through the next 30 days.</p>
                        <div className="table-wrap">
                            {permissionsLoading || loadingEddSchedule ? (
                                <div className="dashboard-section-loading">Loading upcoming EDDs...</div>
                            ) : !hasPermission('edd.schedule.view.own_station')
                                && !hasPermission('edd.schedule.view.other_station') ? (
                                <div className="dashboard-section-error">You do not have permission to view EDD schedules.</div>
                            ) : eddScheduleError ? (
                                <div className="dashboard-section-error" role="alert">
                                    Could not load EDD schedule: {eddScheduleError.message || 'Please try again.'}
                                </div>
                            ) : eddSchedule.length === 0 ? (
                                <div className="dashboard-section-loading">No EDDs are due in the next 30 days.</div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Patient</th><th>Station</th><th>EDD</th></tr>
                                    </thead>
                                    <tbody>
                                        {eddSchedule.slice(0, 8).map(row => (
                                            <tr key={row.id} className="table-row">
                                                <td>{row.patientName}</td>
                                                <td>{row.stationName}</td>
                                                <td>{formatDate(row.edd)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* MOTHER APP DOWNLOAD CARD */}
                    <div className="card mother-app-card">
                        <div className="mother-app-header">
                            <div className="mother-app-icon-badge">
                                <Smartphone size={18} />
                            </div>
                            <div className="mother-app-title-group">
                                <h2 className="card-title">DASMOM+ Mother App</h2>
                                <span className="mother-app-badge">Android APK</span>
                            </div>
                        </div>

                        <p className="mother-app-desc">
                            Help mothers access their appointments, health records, and vaccination updates.
                        </p>

                        <div className="mother-app-body">
                            <div className="mother-app-actions">
                                <a 
                                    href={APK_DOWNLOAD_URL}
                                    download="dasmom-mother-app.apk"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-download-apk"
                                >
                                    <Download size={15} />
                                    <span>Download APK</span>
                                </a>
                            </div>

                            {/* QR Code slot ready for future generation */}
                            <div className="mother-app-qr-slot">
                                <div className="qr-slot-placeholder" title="QR Code direct mobile scanner coming soon">
                                    <QrCode size={15} className="qr-slot-icon" />
                                    <span className="qr-slot-text">QR code coming soon</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>{/* end right col */}

            </div>{/* end dash-grid */}
        </div>
    );
};

export default Dashboard;
