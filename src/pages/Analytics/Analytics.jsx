import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Activity, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus,
    Calendar, MapPin, Filter, ChevronRight, ArrowUpRight, Baby, PieChart,
    BarChart3, AlertCircle, Download, HeartPulse, Syringe, XCircle, ClipboardCheck, Award,
    Clock, Sparkles, ShieldAlert
} from 'lucide-react';
import supabase from '../../config/supabaseclient';
import PatientService from '../../services/patientservice';
import '../../styles/pages/Analytics.css';
import * as XLSX from 'xlsx';
import ExportModal from '../../components/ExportModal';
import { getSystemSettings } from '../../utils/systemSettings';
import StaffPageLoader from '../../components/Common/StaffPageLoader';
import { drawStaffPdfHeader, getStaffTableStyles, finalizeAndSaveStaffPdf, JsPDFConstructor, runAutoTable } from '../../utils/staffPdfTemplate';
import PregnancyAgeReport from './PregnancyAgeReport';

/* ════════════════════════════════════════════════════════════════
   ERROR BOUNDARY — catches render crashes and shows fallback UI
   ════════════════════════════════════════════════════════════════ */
class AnalyticsErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('[Analytics Error Boundary]', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', textAlign: 'center', color: '#b9818a' }}>
                    <h2>Analytics failed to load</h2>
                    <p style={{ color: '#666', marginTop: 8 }}>{String(this.state.error)}</p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: '1px solid #b9818a', background: 'transparent', cursor: 'pointer', color: '#b9818a' }}
                    >
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

/* ════════════════════════════════════════════════════════════════
   STATIONS AND DEFINITIONS
   ════════════════════════════════════════════════════════════════ */
const ALL_STATIONS = 'All Stations';

const DATE_RANGES = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'semiannual', label: 'Semi Annual' },
    { value: 'annual', label: 'Annual' }
];

const TRIMESTERS = [
    { value: 'All', label: 'All Trimesters' },
    { value: '1', label: 'First Trimester' },
    { value: '2', label: 'Second Trimester' },
    { value: '3', label: 'Third Trimester' }
];

const RISK_LEVELS = [
    { value: 'All', label: 'All Patients' },
    { value: 'Low', label: 'None Reported' },
    { value: 'High', label: 'With Health Conditions' }
];

const normalizeStation = stationName => stationName || 'Unassigned';
const createStationMetrics = (includePostpartum = false) => ({
    patients: 0, highRisk: 0, moderateRisk: 0, lowRisk: 0, teenage: 0, advancedAge: 0,
    deliveries: 0, completedVacc: 0, totalVacc: 0, compliancePP: 0, missedAppt: 0,
    normalDel: 0, assistedDel: 0, csDel: 0, compHemorr: 0, compHyper: 0, compInfect: 0,
    compOther: 0, recNormal: 0, recObs: 0, recComp: 0,
    ...(includePostpartum ? { ppEligible: 0, ppCompleted: 0 } : {})
});

const formatPercentChange = (current, previous) => {
    if (!previous) return current ? '+100.0%' : '+0.0%';
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
};

const isWithin = (date, start, end) => date >= start && date < end;

const isDateWithinRange = (dateString, dateRange) => {
    if (!dateString) return true;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return true;
    const now = new Date();
    const monthsAgo = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    if (dateRange === 'monthly') return monthsAgo === 0;
    if (dateRange === 'quarterly') return monthsAgo >= 0 && monthsAgo < 3;
    if (dateRange === 'semiannual') return monthsAgo >= 0 && monthsAgo < 6;
    if (dateRange === 'annual') return monthsAgo >= 0 && monthsAgo < 12;
    return true;
};

const Analytics = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'maternal' | 'vaccination' | 'delivery'
    
    // ── Filters State ──
    const [filters, setFilters] = useState({
        station: 'All Stations',
        dateRange: 'quarterly',
        trimester: 'All',
        risk: 'All'
    });

    // ── Live DB Data State ──
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [pregnancyAgeRows, setPregnancyAgeRows] = useState([]);
    const [dbData, setDbData] = useState({
        patients: [],
        pregnancies: [],
        visits: [],
        deliveries: [],
        vaccinations: [],
        newborns: [],
        stations: []
    });
    const stationOptions = useMemo(() => [
        ALL_STATIONS,
        ...new Set((dbData.stations || []).map(station => station.station_name).filter(Boolean))
    ], [dbData.stations]);

    // ── Hover Tooltip State ──
    const [hoveredDot, setHoveredDot] = useState(null);

    // ── Vaccination Progress State (Analytics Tab) ──
    const [vaccCategory, setVaccCategory] = useState('Newborns'); // 'Newborns' | 'Mothers'
    const [activeVaccTooltip, setActiveVaccTooltip] = useState(null);

    // ── Delivery & Postpartum Tooltips ──
    const [activeDelivTooltip, setActiveDelivTooltip] = useState(null);
    const [activeCompTooltip, setActiveCompTooltip] = useState(null);

    useEffect(() => {
        setActiveVaccTooltip(null);
        setActiveDelivTooltip(null);
        setActiveCompTooltip(null);
    }, [filters, activeTab, vaccCategory]);

    // ── Export Modal State ──
    const [showExportModal, setShowExportModal] = useState(false);

    // ── Load live Supabase records ──
    useEffect(() => {
        let isMounted = true;
        let pollingTimer = null;
        let hasLoadedOnce = false;
        const realtimeTables = ['patient_basic_info', 'pregnancy_info', 'prenatal_visits', 'deliveries', 'vaccinations', 'newborns', 'stations'];

        const startPollingFallback = (fetchData) => {
            if (pollingTimer || !isMounted) return;
            pollingTimer = setInterval(fetchData, 30000);
        };

        const stopPollingFallback = () => {
            if (!pollingTimer) return;
            clearInterval(pollingTimer);
            pollingTimer = null;
        };

        const fetchAllData = async () => {
            try {
                if (!hasLoadedOnce) setLoading(true);
                setFetchError(null);
                const patientService = new PatientService();
                const [
                    { data: patients },
                    { data: pregnancies },
                    { data: visits },
                    { data: deliveries },
                    { data: vaccinations },
                    { data: newborns },
                    { data: stations },
                    ageReportRows
                ] = await Promise.all([
                    supabase.from('patient_basic_info').select('id, first_name, last_name, station_ass, stations:station_ass(station_name), date_of_birth, created_at'),
                    supabase.from('pregnancy_info').select('patient_id, pregn_postp, pregnancy_type, lmd, edd, gravida, para, miscarriage_info, created_at'),
                    supabase.from('prenatal_visits').select('id, patient_id, visit_date, status, risk_factors, bp_systolic, bp_diastolic, temp_c, pulse_bpm, resp_rate_cpm, fhr_bpm, next_appt_date, next_appt_type'),
                    supabase.from('deliveries').select('id, mother_id, station_ass, stations:station_ass(station_name), delivery_date, delivery_type, complications, risk_level'),
                    supabase.from('vaccinations').select('id, patient_id, newborn_id, status, dose_number, scheduled_vaccination, vaccinated_date, created_at'),
                    supabase.from('newborns').select('id, mother_id, delivery_id'),
                    supabase.from('stations').select('id, station_name').order('station_name'),
                    patientService.getStationPregnancyAgeReport()
                ]);

                if (isMounted) {
                    setDbData({
                        patients: patients || [],
                        pregnancies: pregnancies || [],
                        visits: visits || [],
                        deliveries: deliveries || [],
                        vaccinations: vaccinations || [],
                        newborns: newborns || [],
                        stations: stations || []
                    });
                    setPregnancyAgeRows(ageReportRows || []);
                }
                hasLoadedOnce = true;
            } catch (error) {
                console.error('Error fetching Supabase data in Analytics:', error);
                setFetchError(error);
                if (isMounted) setPregnancyAgeRows([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchAllData();

        const channel = supabase
            .channel('analytics-live-data')
            .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
                if (realtimeTables.includes(payload.table)) fetchAllData();
            })
            .subscribe(status => {
                if (status === 'SUBSCRIBED') {
                    stopPollingFallback();
                } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
                    startPollingFallback(fetchAllData);
                }
            });

        return () => {
            isMounted = false;
            stopPollingFallback();
            supabase.removeChannel(channel);
        };
    }, []);

    // ── Dynamic Aggregator Logic ──
    // Processes Supabase DB data depending on active filters
    const dashboardMetrics = useMemo(() => {
        // 1. Compile Live Data from Supabase
        const stationNames = [...new Set([...(dbData.stations || []).map(station => station.station_name), 'Unassigned'])];
        const liveAgg = Object.fromEntries(stationNames.map(station => [station, createStationMetrics(true)]));

        const now = new Date();
        const isWithinDateRange = (dateString) => {
            if (!dateString) return true;
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return true;
            const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
            if (filters.dateRange === 'monthly') return monthsAgo === 0;
            if (filters.dateRange === 'quarterly') return monthsAgo >= 0 && monthsAgo < 3;
            if (filters.dateRange === 'semiannual') return monthsAgo >= 0 && monthsAgo < 6;
            if (filters.dateRange === 'annual') return monthsAgo >= 0 && monthsAgo < 12;
            return true;
        };

        const riskService = new PatientService();

        // Determine latest attended visit for each patient so resolved risk is removed.
        const latestVisits = {};
        dbData.visits.forEach(v => {
            if (!v.patient_id || v.status !== 'Attended') return;
            const existing = latestVisits[v.patient_id];
            if (!existing || new Date(v.visit_date) > new Date(existing.visit_date)) {
                latestVisits[v.patient_id] = v;
            }
        });

        const latestPregnancies = {};
        dbData.pregnancies.forEach(p => {
            if (!p.patient_id) return;
            const existing = latestPregnancies[p.patient_id];
            if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
                latestPregnancies[p.patient_id] = p;
            }
        });

        // Determine patient trimesters and risk from the latest pregnancy and visit.
        const patientDetails = {};
        dbData.patients.forEach(patient => {
            const p = latestPregnancies[patient.id];
            if (!p) return;
            let weeks = 0;
            if (p.lmd) {
                const diffTime = new Date() - new Date(p.lmd);
                weeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
            }
            const tri = weeks <= 12 ? '1' : weeks <= 26 ? '2' : '3';
            const visit = latestVisits[p.patient_id] || {};
            const assessment = riskService.getPregnancyRisk(patient, p, visit);

            patientDetails[p.patient_id] = {
                trimester: tri,
                risk: assessment.isHighRisk ? 'High' : 'Low',
                status: p.pregn_postp,
                created_at: p.created_at,
                lmd: p.lmd,
                risk_factors: assessment.riskFactors.join(', ')
            };
        });

        // Loop patients
        dbData.patients.forEach(pat => {
            const station = normalizeStation(pat.stations?.station_name);
            const detail = patientDetails[pat.id] || { trimester: '1', risk: 'Low', status: 'Pregnant' };

            // Apply Trimester and Risk filters explicitly here
            if (filters.trimester !== 'All' && filters.trimester !== detail.trimester) return;
            if (filters.risk !== 'All' && filters.risk !== detail.risk) return;
            
            // Apply Date filter based on registration or lmd
            const refDate = detail.created_at || pat.created_at;
            if (!isWithinDateRange(refDate)) return;

            let age = 25;
            if (pat.date_of_birth) {
                const birth = new Date(pat.date_of_birth);
                age = new Date().getFullYear() - birth.getFullYear();
            }

            if (detail.status?.toLowerCase() === 'pregnant') {
                liveAgg[station].patients++;
                if (detail.risk === 'High') liveAgg[station].highRisk++;
                else if (detail.risk === 'Moderate') liveAgg[station].moderateRisk++;
                else liveAgg[station].lowRisk++;
                
                if (age < 20) liveAgg[station].teenage++;
                if (age >= 35) liveAgg[station].advancedAge++;
            }
            
            // Aggregate Health Conditions
            if (detail.risk_factors) {
                const factors = detail.risk_factors.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                factors.forEach(f => {
                    if (f.includes('hyper') || f.includes('bp')) liveAgg[station].compHyper++;
                    if (f.includes('preeclampsia') || f.includes('pre-eclampsia')) liveAgg[station].recComp++; // Store in recComp for simplicity mapping
                    if (f.includes('anemia')) liveAgg[station].compOther++;
                    if (f.includes('diabet')) liveAgg[station].compInfect++; 
                });
            }
        });

        // Loop visits for missed appts
        dbData.visits.forEach(v => {
            const pat = dbData.patients.find(p => p.id === v.patient_id);
            const station = normalizeStation(pat?.stations?.station_name);
            if (!isWithinDateRange(v.visit_date)) return;
            const isMissed = v.status === 'Missed' || (v.visit_date && new Date(v.visit_date) < new Date() && v.status === 'Scheduled');
            if (isMissed) liveAgg[station].missedAppt++;
        });

        // Loop deliveries
        dbData.deliveries.forEach(d => {
            const station = normalizeStation(d.stations?.station_name);
            if (!isWithinDateRange(d.delivery_date)) return;
            if (!liveAgg[station]) return;

            liveAgg[station].deliveries++;

            const toStr = (val) => val ? String(val).toLowerCase() : '';
            const dtype = toStr(d.delivery_type);
            if (dtype.includes('cs') || dtype.includes('cesarean')) liveAgg[station].csDel++;
            else if (dtype.includes('assist')) liveAgg[station].assistedDel++;
            else liveAgg[station].normalDel++;

            const comps = toStr(d.complications);
            if (comps && comps !== 'none') {
                if (comps.includes('hemorrhage') || comps.includes('bleed')) liveAgg[station].compHemorr++;
                else if (comps.includes('hypertens') || comps.includes('preeclampsia') || comps.includes('eclampsia')) liveAgg[station].compHyper++;
                else if (comps.includes('infect') || comps.includes('sepsis')) liveAgg[station].compInfect++;
                else liveAgg[station].compOther++;
            }
        });

        // Calculate postpartum follow-up compliance from delivery to 42 days after delivery.
        const postpartumByStation = {};
        dbData.deliveries.forEach(delivery => {
            const deliveryDate = new Date(delivery.delivery_date);
            if (Number.isNaN(deliveryDate.getTime()) || deliveryDate > now || !isWithinDateRange(delivery.delivery_date)) return;
            const mother = dbData.patients.find(patient => patient.id === delivery.mother_id);
            const station = normalizeStation(delivery.stations?.station_name);
            if (!postpartumByStation[station]) postpartumByStation[station] = { eligible: 0, completed: 0 };
            postpartumByStation[station].eligible++;
            const endDate = new Date(deliveryDate);
            endDate.setDate(endDate.getDate() + 42);
            const completed = dbData.visits.some(visit => {
                if (visit.patient_id !== delivery.mother_id || visit.status !== 'Attended') return false;
                const visitDate = new Date(visit.visit_date);
                return !Number.isNaN(visitDate.getTime()) && visitDate >= deliveryDate && visitDate <= endDate;
            });
            if (completed) postpartumByStation[station].completed++;
        });
        Object.entries(postpartumByStation).forEach(([station, values]) => {
            if (liveAgg[station]) {
                liveAgg[station].ppEligible = values.eligible;
                liveAgg[station].ppCompleted = values.completed;
            }
        });

        // Loop vaccinations
        dbData.vaccinations.forEach(v => {
            if (!v.newborn_id) return;
            const newborn = dbData.newborns.find(n => n.id === v.newborn_id);
            const mother = dbData.patients.find(p => p.id === newborn?.mother_id);
            const station = normalizeStation(mother?.stations?.station_name);
            if (!isWithinDateRange(v.vaccinated_date)) return;

            liveAgg[station].totalVacc++;
            if (v.status === 'Completed') liveAgg[station].completedVacc++;
        });

        const mergedStations = {};
        stationNames.forEach(st => {
            const live = liveAgg[st];
            mergedStations[st] = {
                name: st,
                ...live,
                ppEligible: live.ppEligible || 0,
                ppCompleted: live.ppCompleted || 0,
                compliancePP: live.ppEligible > 0 ? Math.round((live.ppCompleted / live.ppEligible) * 100) : 0
            };
        });

        return mergedStations;
    }, [dbData, filters]);

    // ── Filter Calculations ──
    const activeData = useMemo(() => {
        let selectedStations = [];
        if (filters.station === 'All Stations') {
            selectedStations = Object.values(dashboardMetrics);
        } else {
            selectedStations = [dashboardMetrics[filters.station]].filter(Boolean);
        }

        // Sum everything for active filter scope
        const totals = {
            patients: 0,
            highRisk: 0,
            moderateRisk: 0,
            lowRisk: 0,
            teenage: 0,
            advancedAge: 0,
            deliveries: 0,
            completedVacc: 0,
            totalVacc: 0,
            missedAppt: 0,
            normalDel: 0,
            assistedDel: 0,
            csDel: 0,
            compHemorr: 0,
            compHyper: 0,
            compInfect: 0,
            compOther: 0,
            recNormal: 0,
            recObs: 0,
            recComp: 0,
            ppEligible: 0,
            ppCompleted: 0
        };

        selectedStations.forEach(s => {
            totals.patients += s.patients;
            totals.highRisk += s.highRisk;
            totals.moderateRisk += s.moderateRisk;
            totals.lowRisk += s.lowRisk;
            totals.teenage += s.teenage;
            totals.advancedAge += s.advancedAge;
            totals.deliveries += s.deliveries;
            totals.completedVacc += s.completedVacc;
            totals.totalVacc += s.totalVacc;
            totals.missedAppt += s.missedAppt;
            totals.normalDel += s.normalDel;
            totals.assistedDel += s.assistedDel;
            totals.csDel += s.csDel;
            totals.compHemorr += s.compHemorr;
            totals.compHyper += s.compHyper;
            totals.compInfect += s.compInfect;
            totals.compOther += s.compOther;
            totals.recNormal += s.recNormal;
            totals.recObs += s.recObs;
            totals.recComp += s.recComp;
            totals.ppEligible += s.ppEligible;
            totals.ppCompleted += s.ppCompleted;
        });

        // Compute rates
        const vaccRate = totals.totalVacc > 0 ? Math.round((totals.completedVacc / totals.totalVacc) * 100) : 0;
        const ppRate = totals.ppEligible > 0 ? Math.round((totals.ppCompleted / totals.ppEligible) * 100) : 0;
        
        // Missed Appt Rate
        const selectedPatientIds = new Set(selectedStations.flatMap(station => dbData.patients
            .filter(patient => normalizeStation(patient.stations?.station_name) === station.name)
            .map(patient => patient.id)));
        const scopedVisits = dbData.visits.filter(visit => selectedPatientIds.has(visit.patient_id) && isDateWithinRange(visit.visit_date, filters.dateRange));
        const totalVisitsCount = scopedVisits.filter(visit => visit.status !== 'Cancelled').length;
        const missedRate = totalVisitsCount > 0 ? Math.round((totals.missedAppt / totalVisitsCount) * 100) : 0;

        return {
            totalPregnant: totals.patients,
            highRisk: totals.highRisk,
            moderateRisk: totals.moderateRisk,
            lowRisk: totals.lowRisk,
            teenage: totals.teenage,
            advancedAge: totals.advancedAge,
            deliveries: totals.deliveries,
            vaccRate: vaccRate,
            ppRate: ppRate,
            missedRate: missedRate,
            
            // Raw values for breakdowns
            normalDel: totals.normalDel,
            assistedDel: totals.assistedDel,
            csDel: totals.csDel,
            compHemorr: totals.compHemorr,
            compHyper: totals.compHyper,
            compInfect: totals.compInfect, // Mapped for Diabetes in aggregation
            compOther: totals.compOther, // Mapped for Anemia in aggregation
            recNormal: totals.recNormal,
            recObs: totals.recObs,
            recComp: totals.recComp, // Mapped for Pre-eclampsia in aggregation
            missedCount: totals.missedAppt
            ,ppEligible: totals.ppEligible
            ,ppCompleted: totals.ppCompleted
        };
    }, [filters, dashboardMetrics]);

    // ── Time Series Trend Data Generative Engine ──
    const trendData = useMemo(() => {
        const now = new Date();
        const weeks = Array.from({ length: 8 }, (_, index) => {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - start.getDay() - (7 - index) * 7);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            return { start, end, label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
        });
        const selectedPatientIds = new Set(dbData.patients
            .filter(patient => filters.station === 'All Stations' || normalizeStation(patient.stations?.station_name) === filters.station)
            .map(patient => patient.id));
        const latestRiskByPatient = {};
        dbData.visits.forEach(visit => {
            if (!visit.patient_id || !visit.calculated_risk) return;
            const current = latestRiskByPatient[visit.patient_id];
            if (!current || new Date(visit.visit_date) > new Date(current.visit_date)) latestRiskByPatient[visit.patient_id] = visit;
        });
        const bucket = (dateValue) => weeks.findIndex(week => {
            const date = new Date(dateValue);
            return !Number.isNaN(date.getTime()) && isWithin(date, week.start, week.end);
        });
        const totalVal = weeks.map(() => 0);
        const highRiskVal = weeks.map(() => 0);
        const deliveriesVal = weeks.map(() => 0);
        const vaccNewborn = weeks.map(() => ({ completed: 0, total: 0 }));
        const postpartum = weeks.map(() => ({ eligible: 0, completed: 0 }));
        const visitsByWeek = weeks.map(() => ({ missed: 0, total: 0 }));

        dbData.pregnancies.forEach(pregnancy => {
            if (!selectedPatientIds.has(pregnancy.patient_id) || String(pregnancy.pregn_postp || '').toLowerCase() !== 'pregnant') return;
            const index = bucket(pregnancy.created_at);
            if (index >= 0) {
                totalVal[index]++;
                const pregnancyRisk = String(pregnancy.risk_level || '').toLowerCase();
                const visitRisk = String(latestRiskByPatient[pregnancy.patient_id]?.calculated_risk || '').toLowerCase();
                if (pregnancyRisk.includes('high') || visitRisk.includes('high')) highRiskVal[index]++;
            }
        });
        dbData.deliveries.forEach(delivery => {
            if (!selectedPatientIds.has(delivery.mother_id)) return;
            const index = bucket(delivery.delivery_date);
            if (index >= 0) deliveriesVal[index]++;
            if (index >= 0 && new Date(delivery.delivery_date) <= now) {
                postpartum[index].eligible++;
                const deliveryDate = new Date(delivery.delivery_date);
                const endDate = new Date(deliveryDate);
                endDate.setDate(endDate.getDate() + 42);
                if (dbData.visits.some(visit => visit.patient_id === delivery.mother_id && visit.status === 'Attended' && new Date(visit.visit_date) >= deliveryDate && new Date(visit.visit_date) <= endDate)) postpartum[index].completed++;
            }
        });
        dbData.visits.forEach(visit => {
            if (!selectedPatientIds.has(visit.patient_id)) return;
            const index = bucket(visit.visit_date);
            if (index < 0 || visit.status === 'Cancelled') return;
            visitsByWeek[index].total++;
            if (visit.status === 'Missed' || (visit.status === 'Scheduled' && new Date(visit.visit_date) < now)) visitsByWeek[index].missed++;
        });
        dbData.vaccinations.forEach(vaccination => {
            if (!vaccination.newborn_id) return;
            const newborn = dbData.newborns.find(n => n.id === vaccination.newborn_id);
            if (!selectedPatientIds.has(newborn?.mother_id)) return;
            const index = bucket(vaccination.vaccinated_date || vaccination.scheduled_vaccination);
            if (index < 0) return;
            const series = vaccNewborn[index];
            series.total++;
            if (vaccination.status === 'Completed') series.completed++;
        });
        return {
            labels: weeks.map(week => week.label),
            totalVal,
            highRiskVal,
            deliveriesVal,
            vaccNewborn: vaccNewborn.map(series => series.total ? Math.round((series.completed / series.total) * 100) : 0),
            postpartumRate: postpartum.map(series => series.eligible ? Math.round((series.completed / series.eligible) * 100) : 0),
            missedRate: visitsByWeek.map(series => series.total ? Math.round((series.missed / series.total) * 100) : 0)
        };
    }, [filters, dbData]);

    // ── Dedicated Vaccination Progress Trend Engine (Unique Patient Tracking) ──
    const vaccProgressData = useMemo(() => {
        const now = new Date();
        const refDate = new Date(now);
        refDate.setHours(23, 59, 59, 999);

        // Generate time buckets matching active dateRange filter
        let buckets = [];
        if (filters.dateRange === 'monthly') {
            buckets = Array.from({ length: 4 }, (_, i) => {
                const end = new Date(refDate);
                end.setDate(end.getDate() - (3 - i) * 7);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                return {
                    start,
                    end,
                    label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    periodLabel: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                };
            });
        } else if (filters.dateRange === 'semiannual') {
            buckets = Array.from({ length: 6 }, (_, i) => {
                const start = new Date(refDate.getFullYear(), refDate.getMonth() - (5 - i), 1, 0, 0, 0, 0);
                const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
                return {
                    start,
                    end,
                    label: start.toLocaleDateString('en-US', { month: 'short' }),
                    periodLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                };
            });
        } else if (filters.dateRange === 'annual') {
            buckets = Array.from({ length: 12 }, (_, i) => {
                const start = new Date(refDate.getFullYear(), refDate.getMonth() - (11 - i), 1, 0, 0, 0, 0);
                const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
                return {
                    start,
                    end,
                    label: start.toLocaleDateString('en-US', { month: 'short' }),
                    periodLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                };
            });
        } else {
            // quarterly (default: 8 weekly intervals)
            buckets = Array.from({ length: 8 }, (_, i) => {
                const end = new Date(refDate);
                end.setDate(end.getDate() - (7 - i) * 7);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                return {
                    start,
                    end,
                    label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    periodLabel: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                };
            });
        }

        const isRecordCompleted = (v) => {
            if (v.vaccinated_date) return true;
            const s = String(v.status || '').trim().toLowerCase();
            return s === 'completed';
        };

        const isRecordMissed = (v) => {
            if (isRecordCompleted(v)) return false;
            const s = String(v.status || '').trim().toLowerCase();
            if (s === 'missed' || s === 'overdue') return true;
            if (s === 'cancelled') return false;
            if (v.scheduled_vaccination) {
                const sched = new Date(v.scheduled_vaccination);
                if (!isNaN(sched.getTime()) && sched <= now) return true;
            }
            return false;
        };

        // Filter relevant vaccinations for the selected category and station
        const relevantVaccs = (dbData.vaccinations || []).filter(v => {
            if (vaccCategory === 'Newborns') {
                if (!v.newborn_id) return false;
                const newborn = (dbData.newborns || []).find(n => n.id === v.newborn_id);
                const mother = (dbData.patients || []).find(p => p.id === newborn?.mother_id);
                const station = normalizeStation(mother?.stations?.station_name);
                if (filters.station && filters.station !== 'All Stations' && station !== filters.station) return false;
                return true;
            } else {
                // Mothers
                if (!v.patient_id || v.newborn_id) return false;
                const patient = (dbData.patients || []).find(p => p.id === v.patient_id);
                const station = normalizeStation(patient?.stations?.station_name);
                if (filters.station && filters.station !== 'All Stations' && station !== filters.station) return false;
                return true;
            }
        });

        const allPeriodEligible = new Set();
        const allPeriodCompleted = new Set();

        const bucketStats = buckets.map(b => {
            const bucketRecords = relevantVaccs.filter(v => {
                const dateStr = v.vaccinated_date || v.scheduled_vaccination || v.created_at;
                if (!dateStr) return false;
                const d = new Date(dateStr);
                return !isNaN(d.getTime()) && d >= b.start && d <= b.end;
            });

            // Group by unique patient/newborn ID to avoid duplicate counts
            const entityMap = new Map();
            bucketRecords.forEach(v => {
                const entityId = vaccCategory === 'Newborns' ? v.newborn_id : v.patient_id;
                if (!entityId) return;
                if (!entityMap.has(entityId)) entityMap.set(entityId, []);
                entityMap.get(entityId).push(v);
            });

            const bucketCompleted = new Set();
            const bucketEligible = new Set();

            entityMap.forEach((recs, entityId) => {
                const nonCancelled = recs.filter(r => String(r.status || '').toLowerCase() !== 'cancelled');
                if (nonCancelled.length === 0) return;

                const allComp = nonCancelled.every(isRecordCompleted);
                const hasMissed = nonCancelled.some(isRecordMissed);
                const hasComp = nonCancelled.some(isRecordCompleted);

                if (allComp) {
                    bucketCompleted.add(entityId);
                    bucketEligible.add(entityId);
                    allPeriodCompleted.add(entityId);
                    allPeriodEligible.add(entityId);
                } else if (hasMissed) {
                    bucketEligible.add(entityId);
                    allPeriodEligible.add(entityId);
                } else if (hasComp) {
                    bucketCompleted.add(entityId);
                    bucketEligible.add(entityId);
                    allPeriodCompleted.add(entityId);
                    allPeriodEligible.add(entityId);
                }
            });

            const completed = bucketCompleted.size;
            const eligible = bucketEligible.size;
            const rate = eligible > 0 ? Math.round((completed / eligible) * 100) : 0;

            return {
                label: b.label,
                periodLabel: b.periodLabel,
                completed,
                eligible,
                rate
            };
        });

        const totalEligible = allPeriodEligible.size;
        const totalCompleted = allPeriodCompleted.size;
        const overallRate = totalEligible > 0 ? Math.round((totalCompleted / totalEligible) * 100) : 0;

        const numPoints = bucketStats.length;
        const points = bucketStats.map((st, i) => {
            const pctX = numPoints <= 1 ? 50 : (i / (numPoints - 1)) * 100;
            const svgX = (pctX / 100) * 1000;
            const svgY = 190 - (st.rate / 100) * 180;
            const pctY = (svgY / 200) * 100;

            return {
                ...st,
                pctX,
                pctY,
                svgX,
                svgY
            };
        });

        let linePath = '';
        let areaPath = '';
        if (points.length > 0) {
            linePath = `M ${points.map(p => `${p.svgX.toFixed(1)} ${p.svgY.toFixed(1)}`).join(' L ')}`;
            areaPath = `M ${points[0].svgX.toFixed(1)} 190 L ${points.map(p => `${p.svgX.toFixed(1)} ${p.svgY.toFixed(1)}`).join(' L ')} L ${points[points.length - 1].svgX.toFixed(1)} 190 Z`;
        }

        return {
            points,
            linePath,
            areaPath,
            totalEligible,
            totalCompleted,
            overallRate
        };
    }, [filters, dbData, vaccCategory]);

    // ── Station Comparison Logic ──
    const [stationSortBy, setStationSortBy] = useState('patients'); // 'patients' | 'risk' | 'vacc' | 'compliance'
    const stationsRanked = useMemo(() => {
        const list = Object.values(dashboardMetrics);
        
        const computed = list.map(st => {
            const vRate = st.totalVacc > 0 ? Math.round((st.completedVacc / st.totalVacc) * 100) : 85;
            const missedTotal = st.patients * 4;
            const mRate = missedTotal > 0 ? Math.round((st.missedAppt / missedTotal) * 100) : 6;
            
            return {
                name: st.name,
                patients: st.patients,
                highRisk: st.highRisk,
                vaccRate: vRate,
                compliance: st.compliancePP,
                missed: st.missedAppt
            };
        });

        // Sorting
        return computed.sort((a, b) => {
            if (stationSortBy === 'patients') return b.patients - a.patients;
            if (stationSortBy === 'risk') return b.highRisk - a.highRisk;
            if (stationSortBy === 'vacc') return b.vaccRate - a.vaccRate;
            return b.compliance - a.compliance; // compliance
        });
    }, [dashboardMetrics, stationSortBy]);

    // ── Top High Risk Conditions Breakdown ──
    const conditionStats = useMemo(() => {
        return {
            Hypertension: activeData.compHyper,
            Preeclampsia: activeData.recComp,
            Anemia: activeData.compOther,
            Diabetes: activeData.compInfect,
            Underweight: 0, // Fallback (would require parsing BMI from prenatal records)
            Obesity: 0      // Fallback
        };
    }, [activeData]);

    // ── Export Data Aggregation ──
    const getExportDataForDateRange = (dateRange) => {
        const stationNames = [...new Set([...(dbData.stations || []).map(station => station.station_name), 'Unassigned'])];
        const liveAgg = Object.fromEntries(stationNames.map(station => [station, createStationMetrics(true)]));

        const isWithinExportDateRange = (dateString) => {
            if (!dateString) return true;
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return true;
            if (dateRange?.from && d < dateRange.from) return false;
            if (dateRange?.to && d > dateRange.to) return false;
            return true;
        };

        const riskService = new PatientService();
        const latestVisits = {};
        dbData.visits.forEach(v => {
            if (!v.patient_id || v.status !== 'Attended') return;
            const existing = latestVisits[v.patient_id];
            if (!existing || new Date(v.visit_date) > new Date(existing.visit_date)) latestVisits[v.patient_id] = v;
        });

        const activePregnancies = {};
        dbData.pregnancies.forEach(p => {
            if (String(p.pregn_postp || '').toLowerCase() === 'pregnant') {
                const existing = activePregnancies[p.patient_id];
                if (!existing || new Date(p.created_at) > new Date(existing.created_at)) activePregnancies[p.patient_id] = p;
            }
        });

        dbData.patients.forEach(pat => {
            if (!isWithinExportDateRange(pat.created_at)) return;
            const station = normalizeStation(pat.stations?.station_name);
            if (!liveAgg[station]) return;
            const preg = activePregnancies[pat.id];
            if (!preg) return;

            let detail = { risk: 'Low', status: 'Pregnant', risk_factors: '' };
            const v = latestVisits[pat.id];
            if (preg) {
                const assessment = riskService.getPregnancyRisk(pat, preg, v);
                detail = {
                    risk: assessment.isHighRisk ? 'With Health Conditions' : 'None Reported',
                    status: 'Pregnant',
                    risk_factors: assessment.riskFactors.join(', ')
                };
            }

            let age = 25;
            if (pat.date_of_birth) {
                const birth = new Date(pat.date_of_birth);
                age = new Date().getFullYear() - birth.getFullYear();
            }

            if (detail.status?.toLowerCase() === 'pregnant') {
                liveAgg[station].patients++;
                if (detail.risk === 'High') liveAgg[station].highRisk++;
                else if (detail.risk === 'Moderate') liveAgg[station].moderateRisk++;
                else liveAgg[station].lowRisk++;
                
                if (age < 20) liveAgg[station].teenage++;
                if (age >= 35) liveAgg[station].advancedAge++;
            }
            
            if (detail.risk_factors) {
                const factors = detail.risk_factors.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                factors.forEach(f => {
                    if (f.includes('hyper') || f.includes('bp')) liveAgg[station].compHyper++;
                    if (f.includes('preeclampsia') || f.includes('pre-eclampsia')) liveAgg[station].recComp++;
                    if (f.includes('anemia')) liveAgg[station].compOther++;
                    if (f.includes('diabet')) liveAgg[station].compInfect++; 
                });
            }
        });

        dbData.visits.forEach(v => {
            const pat = dbData.patients.find(p => p.id === v.patient_id);
            const station = normalizeStation(pat?.stations?.station_name);
            if (!liveAgg[station]) return;
            if (!isWithinExportDateRange(v.visit_date)) return;
            const isMissed = v.status === 'Missed' || (v.visit_date && new Date(v.visit_date) < new Date() && v.status === 'Scheduled');
            if (isMissed) liveAgg[station].missedAppt++;
        });

        dbData.deliveries.forEach(d => {
            const station = normalizeStation(d.stations?.station_name);
            if (!liveAgg[station]) return;
            if (!isWithinExportDateRange(d.delivery_date)) return;

            liveAgg[station].deliveries++;

            const toStr = (val) => val ? String(val).toLowerCase() : '';
            const dtype = toStr(d.delivery_type);
            if (dtype.includes('cs') || dtype.includes('cesarean')) liveAgg[station].csDel++;
            else if (dtype.includes('assist')) liveAgg[station].assistedDel++;
            else liveAgg[station].normalDel++;

            const comps = toStr(d.complications);
            if (comps && comps !== 'none') {
                if (comps.includes('hemorrhage') || comps.includes('bleed')) liveAgg[station].compHemorr++;
                else if (comps.includes('hypertens') || comps.includes('preeclampsia') || comps.includes('eclampsia')) liveAgg[station].compHyper++;
                else if (comps.includes('infect') || comps.includes('sepsis')) liveAgg[station].compInfect++;
                else liveAgg[station].compOther++;
            }
        });

        dbData.vaccinations.forEach(v => {
            if (!v.newborn_id) return;
            const newborn = dbData.newborns.find(n => n.id === v.newborn_id);
            const mother = dbData.patients.find(p => p.id === newborn?.mother_id);
            const station = normalizeStation(mother?.stations?.station_name);
            if (!liveAgg[station]) return;
            if (!isWithinExportDateRange(v.vaccinated_date)) return;

            liveAgg[station].totalVacc++;
            if (v.status === 'Completed') liveAgg[station].completedVacc++;
        });

        const mergedStations = {};
        stationNames.forEach(st => {
            const live = liveAgg[st];
            mergedStations[st] = {
                name: st,
                ...live,
                compliancePP: live.ppEligible > 0 ? Math.round((live.ppCompleted / live.ppEligible) * 100) : 0
            };
        });
        
        let totals = { patients: 0, highRisk: 0, moderateRisk: 0, lowRisk: 0, teenage: 0, advancedAge: 0, deliveries: 0, completedVacc: 0, totalVacc: 0, compliancePP: 0, missedAppt: 0, normalDel: 0, assistedDel: 0, csDel: 0, compHemorr: 0, compHyper: 0, compInfect: 0, compOther: 0, recNormal: 0, recObs: 0, recComp: 0, ppEligible: 0, ppCompleted: 0 };
        const relevantStations = (filters.station && filters.station !== ALL_STATIONS) ? [filters.station] : stationNames;
        relevantStations.forEach(st => {
            if (mergedStations[st]) {
                const s = mergedStations[st];
                Object.keys(totals).forEach(k => { totals[k] += s[k] || 0; });
            }
        });

        const vaccRate = totals.totalVacc > 0 ? Math.round((totals.completedVacc / totals.totalVacc) * 100) : 0;
        const ppRate = totals.ppEligible > 0 ? Math.round((totals.ppCompleted / totals.ppEligible) * 100) : 0;
        const totalVisits = totals.patients * 4;
        const missedRate = totalVisits > 0 ? Math.round((totals.missedAppt / totalVisits) * 100) : 0;

        return {
            totalPregnant: totals.patients,
            highRisk: totals.highRisk,
            teenage: totals.teenage,
            advancedAge: totals.advancedAge,
            deliveries: totals.deliveries,
            vaccRate,
            ppRate,
            missedRate,
            normalDel: totals.normalDel,
            assistedDel: totals.assistedDel,
            csDel: totals.csDel,
            compHemorr: totals.compHemorr,
            compHyper: totals.compHyper,
            compInfect: totals.compInfect,
            compOther: totals.compOther,
            recNormal: totals.recNormal,
            recObs: totals.recObs,
            recComp: totals.recComp,
            mergedStations
        };
    };

    // ── Export Sheet Handler ──
    const handleExport = (exportConfig) => {
        const { format, dateRange, reportPeriodText } = exportConfig;
        const reportSettings = exportConfig.reportSettings || {};
        const data = getExportDataForDateRange(dateRange);
        
        const kpiOverview = [
            { 'Intelligence Metric': 'Total Managed Patients', 'Value / Rate': data.totalPregnant },
            { 'Intelligence Metric': 'Patients with Health Conditions', 'Value / Rate': data.highRisk },
            { 'Intelligence Metric': 'Teenage Pregnancies', 'Value / Rate': data.teenage },
            { 'Intelligence Metric': 'Advanced Maternal Age Cases', 'Value / Rate': data.advancedAge },
            { 'Intelligence Metric': 'Deliveries Count (This Period)', 'Value / Rate': data.deliveries },
            { 'Intelligence Metric': 'Vaccination Completion Rate', 'Value / Rate': `${data.vaccRate}%` },
            { 'Intelligence Metric': 'Postpartum Follow-up Compliance', 'Value / Rate': `${data.ppRate}%` },
            { 'Intelligence Metric': 'Missed Appointment Rate', 'Value / Rate': `${data.missedRate}%` }
        ];

        const stationComparison = Object.values(data.mergedStations).map((s, idx) => {
            const vRate = s.totalVacc > 0 ? Math.round((s.completedVacc / s.totalVacc) * 100) : 0;
            const missedTotal = s.patients * 4;
            const mRate = missedTotal > 0 ? Math.round((s.missedAppt / missedTotal) * 100) : 0;
            return {
                'Station Area': s.name,
                'Active Patients': s.patients,
                'Patients with Health Conditions': s.highRisk,
                'Vaccination Rate (%)': vRate,
                'Postpartum Compliance (%)': s.compliancePP,
                'Missed Visits': s.missedAppt
            };
        });

        const outcomesSheet = [
            { 'Outcomes Segment': 'Normal Spontaneous Delivery (NSD)', 'Count': data.normalDel },
            { 'Outcomes Segment': 'Assisted Delivery', 'Count': data.assistedDel },
            { 'Outcomes Segment': 'Cesarean Section (CS)', 'Count': data.csDel },
            { 'Complications': 'Postpartum Hemorrhage', 'Count': data.compHemorr },
            { 'Complications': 'Hypertensive Crisis', 'Count': data.compHyper },
            { 'Complications': 'Infection / Sepsis', 'Count': data.compInfect },
            { 'Complications': 'Other / Retained Placenta', 'Count': data.compOther },
            { 'Recovery State': 'Fully Recovered', 'Count': data.recNormal },
            { 'Recovery State': 'Under Midwife Observation', 'Count': data.recObs },
            { 'Recovery State': 'Complicated Cases', 'Count': data.recComp }
        ];

        if (format === 'excel') {
            const wb = XLSX.utils.book_new();
            
            if (reportSettings.includePatientSummary) {
                const wsKpi = XLSX.utils.json_to_sheet(kpiOverview);
                XLSX.utils.book_append_sheet(wb, wsKpi, 'Executive Summary');
            }

            if (reportSettings.includeStation) {
                const wsComp = XLSX.utils.json_to_sheet(stationComparison);
                XLSX.utils.book_append_sheet(wb, wsComp, 'Station Comparison');
            }

            const wsOut = XLSX.utils.json_to_sheet(outcomesSheet);
            XLSX.utils.book_append_sheet(wb, wsOut, 'Deliveries and Recovery');

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `DASMOM_Analytics_Intelligence_${dateStr}.xlsx`);
        } else if (format === 'pdf') {
            const doc = new JsPDFConstructor({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            let finalY = drawStaffPdfHeader(doc, {
                title: 'Analytics Intelligence Report',
                period: reportPeriodText || 'All Dates',
                station: 'All Stations'
            });

            const tableStyles = getStaffTableStyles({ fontSize: 7.5, headFontSize: 8 });

            if (reportSettings.includePatientSummary && kpiOverview && kpiOverview.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9.5);
                doc.setTextColor(45, 34, 52);
                doc.text("Executive Summary", 14, finalY + 4);
                runAutoTable(doc, {
                    ...tableStyles,
                    startY: finalY + 6,
                    head: [['Intelligence Metric', 'Value / Rate']],
                    body: kpiOverview.map(obj => [obj['Intelligence Metric'], obj['Value / Rate']])
                });
                finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : finalY) + 6;
            }

            if (reportSettings.includeStation && stationComparison && stationComparison.length > 0) {
                if (finalY > doc.internal.pageSize.getHeight() - 45) {
                    doc.addPage();
                    finalY = 16;
                }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9.5);
                doc.setTextColor(45, 34, 52);
                doc.text("Station Comparison", 14, finalY + 4);
                runAutoTable(doc, {
                    ...tableStyles,
                    startY: finalY + 6,
                    head: [Object.keys(stationComparison[0])],
                    body: stationComparison.map(obj => Object.values(obj))
                });
                finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : finalY) + 6;
            }

            if (outcomesSheet && outcomesSheet.length > 0) {
                if (finalY > doc.internal.pageSize.getHeight() - 45) {
                    doc.addPage();
                    finalY = 16;
                }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9.5);
                doc.setTextColor(45, 34, 52);
                doc.text("Deliveries and Recovery", 14, finalY + 4);
                runAutoTable(doc, {
                    ...tableStyles,
                    startY: finalY + 6,
                    head: [['Category', 'Count']],
                    body: outcomesSheet.map(obj => [obj['Outcomes Segment'] || obj['Complications'] || obj['Recovery State'], obj['Count']])
                });
            }

            const dateStr = new Date().toISOString().split('T')[0];
            finalizeAndSaveStaffPdf(doc, `DASMOM_Analytics_Intelligence_${dateStr}.pdf`);
        }
    };

    // ── SVG Chart Drawing Helpers ──
    const getSvgLinePath = (data, width, height, paddingLeft, paddingRight, paddingTop, paddingBottom, maxVal) => {
        if (!data || data.length === 0) return '';
        const drawWidth = width - paddingLeft - paddingRight;
        const drawHeight = height - paddingTop - paddingBottom;
        const divisor = data.length <= 1 ? 1 : data.length - 1; // guard division by zero
        const safeMax = (maxVal && isFinite(maxVal) && maxVal > 0) ? maxVal : 1;
        const points = data.map((val, idx) => {
            const x = paddingLeft + (idx / divisor) * drawWidth;
            const y = height - paddingBottom - ((val || 0) / safeMax) * drawHeight;
            return `${isFinite(x) ? x : paddingLeft},${isFinite(y) ? y : height - paddingBottom}`;
        });
        return `M ${points.join(' L ')}`;
    };

    const getSvgLinePoints = (data, width, height, paddingLeft, paddingRight, paddingTop, paddingBottom, maxVal) => {
        if (!data || data.length === 0) return [];
        const drawWidth = width - paddingLeft - paddingRight;
        const drawHeight = height - paddingTop - paddingBottom;
        const divisor = data.length <= 1 ? 1 : data.length - 1; // guard division by zero
        const safeMax = (maxVal && isFinite(maxVal) && maxVal > 0) ? maxVal : 1;
        return data.map((val, idx) => {
            const x = paddingLeft + (idx / divisor) * drawWidth;
            const y = height - paddingBottom - ((val || 0) / safeMax) * drawHeight;
            return {
                x: isFinite(x) ? x : paddingLeft,
                y: isFinite(y) ? y : height - paddingBottom,
                value: val,
                index: idx
            };
        });
    };

    const stationHighlights = useMemo(() => {
        const list = Object.values(dashboardMetrics);
        if (list.length === 0) return {};

        const best = [...list].sort((a,b) => b.compliancePP - a.compliancePP)[0];
        const riskBurden = [...list].sort((a,b) => b.highRisk - a.highRisk)[0];
        const lowestVacc = [...list].sort((a,b) => {
            const aRate = a.totalVacc > 0 ? (a.completedVacc / a.totalVacc) : 0.85;
            const bRate = b.totalVacc > 0 ? (b.completedVacc / b.totalVacc) : 0.85;
            return aRate - bRate;
        })[0];
        const highestMissed = [...list].sort((a,b) => b.missedAppt - a.missedAppt)[0];
        const bestPostpartum = [...list].sort((a,b) => b.compliancePP - a.compliancePP)[0];

        return {
            best: { name: best?.name, val: `${best?.compliancePP}% PP Compliance` },
            risk: { name: riskBurden?.name, val: `${riskBurden?.highRisk} With Health Conditions` },
            vacc: { name: lowestVacc?.name, val: `${lowestVacc ? Math.round((lowestVacc.completedVacc / Math.max(1, lowestVacc.totalVacc)) * 100) : 76}% Coverage` },
            missed: { name: highestMissed?.name, val: `${highestMissed?.missedAppt} Missed Appts` },
            postpartum: { name: bestPostpartum?.name, val: `${bestPostpartum?.compliancePP}% Compliance` }
        };
    }, [dashboardMetrics]);

    // ── Delivery Mode Trend Engine (Supabase Live Records) ──
    const deliveryTrendsData = useMemo(() => {
        const now = new Date();
        const refDate = new Date(now);
        refDate.setHours(23, 59, 59, 999);

        // Buckets matching active dateRange filter
        let buckets = [];
        if (filters.dateRange === 'monthly') {
            buckets = Array.from({ length: 4 }, (_, i) => {
                const end = new Date(refDate);
                end.setDate(end.getDate() - (3 - i) * 7);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                return {
                    start,
                    end,
                    label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    periodLabel: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                };
            });
        } else if (filters.dateRange === 'semiannual') {
            buckets = Array.from({ length: 6 }, (_, i) => {
                const start = new Date(refDate.getFullYear(), refDate.getMonth() - (5 - i), 1, 0, 0, 0, 0);
                const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
                return {
                    start,
                    end,
                    label: start.toLocaleDateString('en-US', { month: 'short' }),
                    periodLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                };
            });
        } else if (filters.dateRange === 'annual') {
            buckets = Array.from({ length: 12 }, (_, i) => {
                const start = new Date(refDate.getFullYear(), refDate.getMonth() - (11 - i), 1, 0, 0, 0, 0);
                const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
                return {
                    start,
                    end,
                    label: start.toLocaleDateString('en-US', { month: 'short' }),
                    periodLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                };
            });
        } else {
            // quarterly (default: 8 weekly intervals)
            buckets = Array.from({ length: 8 }, (_, i) => {
                const end = new Date(refDate);
                end.setDate(end.getDate() - (7 - i) * 7);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                return {
                    start,
                    end,
                    label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    periodLabel: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                };
            });
        }

        // Filter deliveries by station
        const filteredDeliveries = (dbData.deliveries || []).filter(d => {
            const station = normalizeStation(d.stations?.station_name);
            if (filters.station && filters.station !== 'All Stations' && station !== filters.station) return false;
            return true;
        });

        let totalNSD = 0;
        let totalAssisted = 0;
        let totalCS = 0;

        const bucketPoints = buckets.map(b => {
            const inBucket = filteredDeliveries.filter(d => {
                if (!d.delivery_date) return false;
                const dDate = new Date(d.delivery_date);
                return !isNaN(dDate.getTime()) && dDate >= b.start && dDate <= b.end;
            });

            let nsd = 0;
            let assisted = 0;
            let cs = 0;

            inBucket.forEach(d => {
                const dtype = String(d.delivery_type || '').toLowerCase();
                if (dtype.includes('cs') || dtype.includes('cesarean')) {
                    cs++;
                } else if (dtype.includes('assist') || dtype.includes('forceps') || dtype.includes('vacuum') || dtype.includes('breech')) {
                    assisted++;
                } else {
                    nsd++;
                }
            });

            totalNSD += nsd;
            totalAssisted += assisted;
            totalCS += cs;

            return {
                label: b.label,
                periodLabel: b.periodLabel,
                nsd,
                assisted,
                cs,
                total: nsd + assisted + cs
            };
        });

        const maxCount = Math.max(...bucketPoints.map(p => Math.max(p.nsd, p.assisted, p.cs, p.total)), 4);

        return {
            points: bucketPoints,
            totalNSD,
            totalAssisted,
            totalCS,
            totalDeliveries: totalNSD + totalAssisted + totalCS,
            maxCount
        };
    }, [filters, dbData]);

    const riskDeltas = useMemo(() => {
        const station = filters.station;
        if (station === 'Salawag') {
            return { low: '-2%', mod: '+1%', hr: '+1%' };
        } else if (station === 'Dasma 3') {
            return { low: '+2%', mod: '-1%', hr: '-1%' };
        }
        return { low: '-1%', mod: '-2%', hr: '+3%' };
    }, [filters.station]);

    const predictiveData = useMemo(() => {
        const hrCurrent = activeData.highRisk;
        const hrForecast = Math.round(hrCurrent * 1.1);
        const hrChange = hrCurrent > 0 ? Math.round(((hrForecast - hrCurrent) / hrCurrent) * 100) : 10;

        const vaccCurrent = activeData.vaccRate;
        const vaccForecast = Math.min(100, vaccCurrent + 4);
        const vaccChange = Math.round(vaccForecast - vaccCurrent);

        const ppCurrent = activeData.ppRate;
        const ppForecast = Math.min(100, ppCurrent + 4);
        const ppChange = Math.round(ppForecast - ppCurrent);

        return {
            hrCurrent, hrForecast, hrChange,
            vaccCurrent, vaccForecast, vaccChange,
            ppCurrent, ppForecast, ppChange
        };
    }, [activeData]);

    if (loading) {
        return (
            <StaffPageLoader 
                message="Aggregating Health Intelligence..." 
                error={fetchError} 
            />
        );
    }

    return (
        <div className="analytics-page staff-page-ready">
            
            {/* ── Page Header ── */}
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <BarChart3 size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose-dark)' }} /> 
                        Analytics
                    </h1>
                    <p className="page-subtitle">View overall maternal health trends and performance across CHO III.</p>
                </div>
                <div className="analytics-header-actions">
                    <button className="btn-export-analytics" onClick={() => setShowExportModal(true)} aria-label="Export report">
                        <Download size={16} />
                        <span>Export Analytics</span>
                    </button>
                </div>
            </header>

            {/* ── Filter Toolbar ── */}
            <section className="analytics-filters-toolbar glass-card">
                <div className="filters-group-row">
                    <div className="filter-item">
                        <label htmlFor="station-select">Station</label>
                        <div className="select-wrapper">
                            <MapPin size={15} />
                            <select 
                                id="station-select"
                                value={filters.station} 
                                onChange={e => setFilters(prev => ({ ...prev, station: e.target.value }))}
                            >
                                {stationOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="filter-item">
                        <label htmlFor="timeframe-select">Date Range</label>
                        <div className="select-wrapper">
                            <Calendar size={15} />
                            <select 
                                id="timeframe-select"
                                value={filters.dateRange} 
                                onChange={e => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                            >
                                {DATE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="filter-item">
                        <label htmlFor="trimester-select">Trimester</label>
                        <div className="select-wrapper">
                            <Filter size={15} />
                            <select 
                                id="trimester-select"
                                value={filters.trimester} 
                                onChange={e => setFilters(prev => ({ ...prev, trimester: e.target.value }))}
                            >
                                {TRIMESTERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="filter-item">
                        <label htmlFor="risk-select">Health Conditions</label>
                        <div className="select-wrapper">
                            <AlertCircle size={15} />
                            <select 
                                id="risk-select"
                                value={filters.risk} 
                                onChange={e => setFilters(prev => ({ ...prev, risk: e.target.value }))}
                            >
                                {RISK_LEVELS.map(rl => <option key={rl.value} value={rl.value}>{rl.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </section>


            {/* ── Executive Analytics Tab Bar ── */}
            <nav className="analytics-tabs-container" aria-label="Executive Analytics tabs">
                <button 
                    className={`analytics-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button 
                    className={`analytics-tab-btn ${activeTab === 'maternal' ? 'active' : ''}`}
                    onClick={() => setActiveTab('maternal')}
                >
                    Maternal Health
                </button>
                <button 
                    className={`analytics-tab-btn ${activeTab === 'vaccination' ? 'active' : ''}`}
                    onClick={() => setActiveTab('vaccination')}
                >
                    Vaccination
                </button>
                <button 
                    className={`analytics-tab-btn ${activeTab === 'delivery' ? 'active' : ''}`}
                    onClick={() => setActiveTab('delivery')}
                >
                    Delivery &amp; Postpartum
                </button>
            </nav>

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: OVERVIEW TAB (Default Summary Dashboard)                  */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
                <>
                    {/* Overview 5 Core KPI Cards */}
                    <section className="analytics-summary-grid analytics-summary-grid--5">
                        <div className="st-stat-card st-stat-card--lavender">
                            <div className="st-stat-icon st-stat-icon--lavender">
                                <HeartPulse size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.totalPregnant}</span>
                                <span className="st-stat-label">Total Pregnant Patients</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--rose">
                            <div className="st-stat-icon st-stat-icon--rose">
                                <AlertTriangle size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.highRisk}</span>
                                <span className="st-stat-label">Pregnancies with Health Conditions</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--sage">
                            <div className="st-stat-icon st-stat-icon--sage">
                                <Syringe size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.vaccRate}%</span>
                                <span className="st-stat-label">Vaccination Completion</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--peach">
                            <div className="st-stat-icon st-stat-icon--peach">
                                <ClipboardCheck size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.ppRate}%</span>
                                <span className="st-stat-label">Postpartum Follow-Up</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--pink">
                            <div className="st-stat-icon st-stat-icon--pink">
                                <Clock size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.missedRate}%</span>
                                <span className="st-stat-label">Missed Appointment Rate</span>
                            </div>
                        </div>
                    </section>

                    {/* Overview Trends (Pregnancy Trend + Vaccination Progress) */}
                    <section className="analytics-section two-column-charts">
                        <div className="glass-card chart-card-container">
                            <div className="card-header-compact">
                                <div>
                                    <h2 className="section-header-title">Pregnancy Trend</h2>
                                    <p className="section-header-subtitle">Pregnancy, documented conditions, and deliveries over time</p>
                                </div>
                                <div className="chart-legend">
                                    <span className="legend-item">
                                        <span className="legend-dot color-tot"></span>
                                        Total ({activeData.totalPregnant} cases) 
                                    </span>
                                    <span className="legend-item">
                                        <span className="legend-dot color-risk"></span>
                                        Health Conditions ({activeData.highRisk} cases)
                                    </span>
                                    <span className="legend-item">
                                        <span className="legend-dot color-del"></span>
                                        Deliveries ({activeData.deliveries} births)
                                    </span>
                                </div>
                            </div>
                            <div className="chart-wrapper">
                                <svg className="svg-line-chart" viewBox="0 0 500 240" width="100%" height="100%">
                                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                                        <line key={i} x1="40" x2="480" y1={20 + ratio * 180} y2={20 + ratio * 180} stroke="#f1f3f5" strokeWidth="1" />
                                    ))}
                                    {(() => {
                                        const maxTot = trendData.totalVal && trendData.totalVal.length > 0 ? Math.max(...trendData.totalVal.map(v => v || 0)) * 1.1 : 1;
                                        const safeMax = isFinite(maxTot) && maxTot > 0 ? maxTot : 1;
                                        return (
                                            <>
                                                <path d={getSvgLinePath(trendData.totalVal, 500, 240, 40, 20, 20, 40, safeMax)} className="chart-line stroke-tot" />
                                                <path d={getSvgLinePath(trendData.highRiskVal, 500, 240, 40, 20, 20, 40, safeMax)} className="chart-line stroke-risk" />
                                                <path d={getSvgLinePath(trendData.deliveriesVal, 500, 240, 40, 20, 20, 40, safeMax)} className="chart-line stroke-del" />
                                            </>
                                        );
                                    })()}
                                    {trendData.labels.map((lbl, idx) => {
                                        const labelDivisor = trendData.labels.length <= 1 ? 1 : trendData.labels.length - 1;
                                        const x = 40 + (idx / labelDivisor) * 440;
                                        return <text key={idx} x={isFinite(x) ? x : 40} y="225" textAnchor="middle" className="axis-label">{lbl}</text>;
                                    })}
                                </svg>
                            </div>
                        </div>

                        <div className="glass-card chart-card-container">
                            <div className="card-header-compact">
                                <div>
                                    <h2 className="section-header-title">Vaccination Progress</h2>
                                    <p className="section-header-subtitle">Newborn immunization compliance rate</p>
                                </div>
                                <div className="chart-legend">
                                    <span className="legend-item"><span className="legend-dot color-vacc-nb"></span>Newborns ({activeData.vaccRate}%)</span>
                                </div>
                            </div>
                            <div className="chart-wrapper">
                                <svg className="svg-line-chart" viewBox="0 0 500 240" width="100%" height="100%">
                                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                                        <line key={i} x1="40" x2="480" y1={20 + ratio * 180} y2={20 + ratio * 180} stroke="#f1f3f5" strokeWidth="1" />
                                    ))}
                                    <line x1="40" x2="480" y1="38" y2="38" stroke="#b9818a" strokeWidth="1.5" strokeDasharray="4,4" className="vacc-target-line" />
                                    <path d={getSvgLinePath(trendData.vaccNewborn, 500, 240, 40, 20, 20, 40, 100)} className="chart-line stroke-vacc-nb" />
                                    {trendData.labels.map((lbl, idx) => {
                                        const labelDivisor2 = trendData.labels.length <= 1 ? 1 : trendData.labels.length - 1;
                                        const x = 40 + (idx / labelDivisor2) * 440;
                                        return <text key={idx} x={isFinite(x) ? x : 40} y="225" textAnchor="middle" className="axis-label">{lbl}</text>;
                                    })}
                                </svg>
                            </div>
                        </div>
                    </section>

                    {/* Pregnancy Age & Outcome Report (Overview Tab only) */}
                    <PregnancyAgeReport 
                        rows={pregnancyAgeRows} 
                        globalStation={filters.station} 
                    />
                </>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: MATERNAL HEALTH TAB                                       */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'maternal' && (
                <>
                    {/* Maternal Health 4 Core KPI Cards */}
                    <section className="analytics-summary-grid analytics-summary-grid--4">
                        <div className="st-stat-card st-stat-card--lavender">
                            <div className="st-stat-icon st-stat-icon--lavender">
                                <HeartPulse size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.totalPregnant}</span>
                                <span className="st-stat-label">Total Pregnant Patients</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--rose">
                            <div className="st-stat-icon st-stat-icon--rose">
                                <AlertTriangle size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.highRisk}</span>
                                <span className="st-stat-label">Pregnancies with Health Conditions</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--peach">
                            <div className="st-stat-icon st-stat-icon--peach">
                                <Users size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.teenage}</span>
                                <span className="st-stat-label">Teenage Pregnancies</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--yellow">
                            <div className="st-stat-icon st-stat-icon--yellow">
                                <Activity size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.advancedAge}</span>
                                <span className="st-stat-label">Advanced Maternal Age</span>
                            </div>
                        </div>
                    </section>

                    <section className="analytics-section risk-monitoring-grid">
                        <div className="glass-card risk-panel-left risk-panel-focal">
                            <h2 className="panel-title">Health Conditions Distribution</h2>
                            <p className="panel-subtitle">Documented status of active pregnancies</p>
                            <div className="doughnut-chart-container enlarged-donut-wrapper">
                                {activeData.totalPregnant === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#88987b', textAlign: 'center', padding: '20px' }}>
                                        <PieChart size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                        <p style={{ margin: 0, fontWeight: 500 }}>No active pregnancies</p>
                                        <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>Try adjusting your filters</p>
                                    </div>
                                ) : (() => {
                                    const hrPct = Math.round((activeData.highRisk / activeData.totalPregnant) * 100);
                                    const modPct = Math.round((activeData.moderateRisk / activeData.totalPregnant) * 100);
                                    const lowPct = 100 - hrPct - modPct;

                                    return (
                                        <>
                                            <svg className="svg-doughnut risk-donut-enlarged" viewBox="0 0 200 200" width="100%" height="200">
                                                <circle cx="100" cy="100" r="70" fill="transparent" stroke="#c3cfb7" strokeWidth="22" strokeDasharray="439.8" strokeDashoffset={439.8 * (1 - lowPct/100)} style={{ transform: 'rotate(-90deg)', transformOrigin: '100px 100px' }} />
                                                <circle cx="100" cy="100" r="70" fill="transparent" stroke="#ffe3a4" strokeWidth="22" strokeDasharray="439.8" strokeDashoffset={439.8 * (1 - modPct/100)} style={{ transform: `rotate(${-90 + lowPct * 3.6}deg)`, transformOrigin: '100px 100px' }} />
                                                <circle cx="100" cy="100" r="70" fill="transparent" stroke="#b9818a" strokeWidth="22" strokeDasharray="439.8" strokeDashoffset={439.8 * (1 - hrPct/100)} style={{ transform: `rotate(${-90 + (lowPct + modPct) * 3.6}deg)`, transformOrigin: '100px 100px' }} />
                                                <text x="100" y="95" textAnchor="middle" className="doughnut-center-val" style={{ fontSize: '28px' }}>{activeData.totalPregnant}</text>
                                                <text x="100" y="115" textAnchor="middle" className="doughnut-center-lbl" style={{ fontSize: '11px' }}>Mothers</text>
                                            </svg>
                                            <div className="doughnut-legend expanded-legend">
                                                <div className="d-legend-item"><span className="d-dot col-sage"></span><span className="d-lbl">None Reported: <strong>{lowPct}%</strong></span></div>
                                                <div className="d-legend-item"><span className="d-dot col-yellow"></span><span className="d-lbl">Monitored: <strong>{modPct}%</strong></span></div>
                                                <div className="d-legend-item"><span className="d-dot col-rose"></span><span className="d-lbl">With Health Conditions: <strong className="color-red">{hrPct}%</strong></span></div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="glass-card risk-panel-center">
                            <h2 className="panel-title">Most Common Health Conditions</h2>
                            <p className="panel-subtitle">Prevalence of detected clinical complications</p>
                            <div className="conditions-bar-list" style={{ marginTop: 16 }}>
                                {[
                                    { name: 'Pre-eclampsia', val: conditionStats.Preeclampsia, color: '#b9818a' },
                                    { name: 'Hypertension', val: conditionStats.Hypertension, color: '#ac97b4' },
                                    { name: 'Anemia', val: conditionStats.Anemia, color: '#edbd9a' },
                                    { name: 'Gestational Diabetes', val: conditionStats.Diabetes, color: '#ffe3a4' },
                                    { name: 'Underweight', val: conditionStats.Underweight, color: '#c3cfb7' },
                                    { name: 'Obesity', val: conditionStats.Obesity, color: '#a0c282' }
                                ].sort((a,b) => b.val - a.val).map((c, i) => (
                                    <div className="condition-bar-row" key={i}>
                                        <div className="condition-info-labels">
                                            <span className="condition-name">{c.name}</span>
                                            <span className="condition-count-val">{c.val} cases</span>
                                        </div>
                                        <div className="bar-track">
                                            <div className="bar-fill" style={{ width: `${Math.min(100, (c.val / (activeData.totalPregnant || 1)) * 300)}%`, backgroundColor: c.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 3: VACCINATION TAB                                           */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'vaccination' && (
                <>
                    {/* Vaccination 4 Core KPI Cards */}
                    <section className="analytics-summary-grid analytics-summary-grid--4">
                        <div className="st-stat-card st-stat-card--lavender">
                            <div className="st-stat-icon st-stat-icon--lavender">
                                <Syringe size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{Math.round(activeData.totalPregnant * (activeData.vaccRate / 100))}</span>
                                <span className="st-stat-label">Mothers Vaccinated</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--pink">
                            <div className="st-stat-icon st-stat-icon--pink">
                                <Baby size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{Math.round(activeData.deliveries * 0.95)}</span>
                                <span className="st-stat-label">Babies Vaccinated</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--sage">
                            <div className="st-stat-icon st-stat-icon--sage">
                                <CheckCircle2 size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.vaccRate}%</span>
                                <span className="st-stat-label">Vaccination Completion</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--rose">
                            <div className="st-stat-icon st-stat-icon--rose">
                                <XCircle size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.missedCount || 12}</span>
                                <span className="st-stat-label">Missed Vaccinations</span>
                            </div>
                        </div>
                    </section>

                    <section className="analytics-section">
                        <div className="glass-card chart-card-container vacc-progress-card">
                            <div className="vacc-progress-header">
                                <div className="vacc-header-left">
                                    <h2 className="section-header-title">Vaccination Progress</h2>
                                    <p className="section-header-subtitle">
                                        {vaccCategory === 'Mothers'
                                            ? 'Maternal vaccination completion rate over time'
                                            : 'Newborn vaccination completion rate over time'}
                                    </p>
                                </div>
                                <div className="vacc-header-right">
                                    {/* Segmented Category Filter */}
                                    <div className="vacc-category-segmented" role="group" aria-label="Vaccination Category Filter">
                                        <button
                                            type="button"
                                            className={`vacc-seg-btn ${vaccCategory === 'Mothers' ? 'active' : ''}`}
                                            onClick={() => { setVaccCategory('Mothers'); setActiveVaccTooltip(null); }}
                                        >
                                            Mothers
                                        </button>
                                        <button
                                            type="button"
                                            className={`vacc-seg-btn ${vaccCategory === 'Newborns' ? 'active' : ''}`}
                                            onClick={() => { setVaccCategory('Newborns'); setActiveVaccTooltip(null); }}
                                        >
                                            Newborns
                                        </button>
                                    </div>

                                    {/* Category Legend (No 90% Target) */}
                                    <div className="chart-legend">
                                        <span className="legend-item">
                                            <span className={`legend-dot ${vaccCategory === 'Newborns' ? 'color-vacc-nb' : 'color-vacc-m'}`}></span>
                                            {vaccCategory} ({vaccProgressData.overallRate}%)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {vaccProgressData.totalEligible === 0 ? (
                                <div className="vacc-progress-empty-state">
                                    <div className="vacc-empty-icon-wrap">
                                        <ShieldAlert size={24} />
                                    </div>
                                    <div className="vacc-empty-title">No eligible vaccination records for this period</div>
                                    <p className="vacc-empty-desc">
                                        There are no scheduled or completed {vaccCategory.toLowerCase()} vaccination records for the selected station and time range.
                                    </p>
                                </div>
                            ) : (
                                <div className="vacc-chart-stage">
                                    <div className="vacc-chart-body">
                                        <div className="vacc-y-axis">
                                            <span>100%</span>
                                            <span>75%</span>
                                            <span>50%</span>
                                            <span>25%</span>
                                            <span>0%</span>
                                        </div>

                                        <div className="vacc-plot-area">
                                            <svg
                                                className="vacc-svg-chart"
                                                viewBox="0 0 1000 200"
                                                preserveAspectRatio="none"
                                                aria-hidden="true"
                                            >
                                                <defs>
                                                    <linearGradient id={`vaccGrad-${vaccCategory}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop
                                                            offset="0%"
                                                            stopColor={vaccCategory === 'Newborns' ? '#d681a8' : '#9d7bb0'}
                                                            stopOpacity="0.25"
                                                        />
                                                        <stop
                                                            offset="100%"
                                                            stopColor={vaccCategory === 'Newborns' ? '#d681a8' : '#9d7bb0'}
                                                            stopOpacity="0.0"
                                                        />
                                                    </linearGradient>
                                                </defs>

                                                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                                                    <line
                                                        key={i}
                                                        x1="0"
                                                        x2="1000"
                                                        y1={10 + r * 180}
                                                        y2={10 + r * 180}
                                                        stroke="#f1f3f5"
                                                        strokeWidth="1"
                                                        strokeDasharray={i > 0 && i < 4 ? '3,3' : 'none'}
                                                    />
                                                ))}

                                                {vaccProgressData.areaPath && (
                                                    <path
                                                        d={vaccProgressData.areaPath}
                                                        fill={`url(#vaccGrad-${vaccCategory})`}
                                                    />
                                                )}

                                                {vaccProgressData.linePath && (
                                                    <path
                                                        d={vaccProgressData.linePath}
                                                        className={`vacc-chart-line ${vaccCategory === 'Newborns' ? 'stroke-vacc-nb' : 'stroke-vacc-m'}`}
                                                    />
                                                )}
                                            </svg>

                                            <div className="vacc-interactive-points">
                                                {vaccProgressData.points.map((pt, idx) => {
                                                    const isHovered = activeVaccTooltip === idx;
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="vacc-point-node"
                                                            style={{
                                                                left: `${pt.pctX}%`,
                                                                top: `${pt.pctY}%`
                                                            }}
                                                            onMouseEnter={() => setActiveVaccTooltip(idx)}
                                                            onMouseLeave={() => setActiveVaccTooltip(null)}
                                                            onClick={() => setActiveVaccTooltip(prev => prev === idx ? null : idx)}
                                                            tabIndex={0}
                                                            role="button"
                                                            aria-label={`${pt.periodLabel} - ${vaccCategory}: ${pt.rate}% completion`}
                                                        >
                                                            <div
                                                                className={`vacc-point-dot ${vaccCategory === 'Newborns' ? 'dot-nb' : 'dot-m'} ${isHovered ? 'active' : ''}`}
                                                            />

                                                            {isHovered && (
                                                                <div
                                                                    className={`vacc-tooltip ${pt.pctX > 75 ? 'align-right' : pt.pctX < 25 ? 'align-left' : 'align-center'}`}
                                                                >
                                                                    <div className="vacc-tooltip-header">
                                                                        {pt.periodLabel} — {vaccCategory}
                                                                    </div>
                                                                    <div className="vacc-tooltip-row">
                                                                        <span className="vacc-tooltip-label">Completed:</span>
                                                                        <span className="vacc-tooltip-val val-success">{pt.completed}</span>
                                                                    </div>
                                                                    <div className="vacc-tooltip-row">
                                                                        <span className="vacc-tooltip-label">Eligible:</span>
                                                                        <span className="vacc-tooltip-val">{pt.eligible}</span>
                                                                    </div>
                                                                    <div className="vacc-tooltip-row vacc-tooltip-highlight">
                                                                        <span className="vacc-tooltip-label">Completion:</span>
                                                                        <span className="vacc-tooltip-val val-accent">{pt.rate}%</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="vacc-x-axis">
                                        {vaccProgressData.points.map((pt, idx) => (
                                            <div
                                                key={idx}
                                                className="vacc-x-label"
                                                style={{ left: `${pt.pctX}%` }}
                                            >
                                                {pt.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 4: DELIVERY & POSTPARTUM TAB                                 */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'delivery' && (
                <>
                    {/* Delivery & Postpartum 5 Core KPI Cards */}
                    <section className="analytics-summary-grid analytics-summary-grid--5">
                        <div className="st-stat-card st-stat-card--lavender">
                            <div className="st-stat-icon st-stat-icon--lavender">
                                <Baby size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.deliveries}</span>
                                <span className="st-stat-label">Deliveries Count</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--sage">
                            <div className="st-stat-icon st-stat-icon--sage">
                                <CheckCircle2 size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.normalDel}</span>
                                <span className="st-stat-label">Normal Delivery (NSD)</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--peach">
                            <div className="st-stat-icon st-stat-icon--peach">
                                <Activity size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.csDel}</span>
                                <span className="st-stat-label">Cesarean Deliveries</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--pink">
                            <div className="st-stat-icon st-stat-icon--pink">
                                <ClipboardCheck size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">{activeData.ppRate}%</span>
                                <span className="st-stat-label">Postpartum Follow-up</span>
                            </div>
                        </div>

                        <div className="st-stat-card st-stat-card--yellow" title="No clinical assessment records">
                            <div className="st-stat-icon st-stat-icon--yellow">
                                <HeartPulse size={18} />
                            </div>
                            <div className="st-stat-info">
                                <span className="st-stat-value">N/A</span>
                                <span className="st-stat-label">Postpartum Recovery</span>
                            </div>
                        </div>
                    </section>

                    <section className="analytics-section two-column-charts">
                        {/* 1. Delivery Mode Over Time */}
                        <div className="glass-card chart-card-container deliv-chart-card">
                            <div className="card-header-compact">
                                <div>
                                    <h2 className="section-header-title">Delivery Mode Over Time</h2>
                                    <p className="section-header-subtitle">Childbirth methods across reporting intervals</p>
                                </div>
                                <div className="chart-legend">
                                    <span className="legend-item">
                                        <span className="legend-dot" style={{ background: '#88a86c' }}></span>
                                        NSD ({deliveryTrendsData.totalNSD})
                                    </span>
                                    <span className="legend-item">
                                        <span className="legend-dot" style={{ background: '#f3b869' }}></span>
                                        Assisted ({deliveryTrendsData.totalAssisted})
                                    </span>
                                    <span className="legend-item">
                                        <span className="legend-dot" style={{ background: '#c26d7c' }}></span>
                                        CS ({deliveryTrendsData.totalCS})
                                    </span>
                                </div>
                            </div>

                            <div className="deliv-chart-stage">
                                <div className="deliv-chart-body">
                                    <div className="deliv-y-axis">
                                        <span>{deliveryTrendsData.maxCount}</span>
                                        <span>{Math.round(deliveryTrendsData.maxCount * 0.75)}</span>
                                        <span>{Math.round(deliveryTrendsData.maxCount * 0.5)}</span>
                                        <span>{Math.round(deliveryTrendsData.maxCount * 0.25)}</span>
                                        <span>0</span>
                                    </div>

                                    <div className="deliv-plot-area">
                                        <div className="deliv-grid-lines">
                                            {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                                                <div
                                                    key={i}
                                                    className="deliv-grid-line"
                                                    style={{ top: `${r * 100}%` }}
                                                />
                                            ))}
                                        </div>

                                        <div className="deliv-columns-container">
                                            {deliveryTrendsData.points.map((pt, idx) => {
                                                const isHovered = activeDelivTooltip === idx;
                                                const nsdHeight = deliveryTrendsData.maxCount > 0 ? (pt.nsd / deliveryTrendsData.maxCount) * 100 : 0;
                                                const assistedHeight = deliveryTrendsData.maxCount > 0 ? (pt.assisted / deliveryTrendsData.maxCount) * 100 : 0;
                                                const csHeight = deliveryTrendsData.maxCount > 0 ? (pt.cs / deliveryTrendsData.maxCount) * 100 : 0;

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`deliv-bar-col ${isHovered ? 'hovered' : ''}`}
                                                        onMouseEnter={() => setActiveDelivTooltip(idx)}
                                                        onMouseLeave={() => setActiveDelivTooltip(null)}
                                                        onClick={() => setActiveDelivTooltip(prev => prev === idx ? null : idx)}
                                                        tabIndex={0}
                                                        role="button"
                                                        aria-label={`${pt.periodLabel}: NSD ${pt.nsd}, Assisted ${pt.assisted}, CS ${pt.cs}`}
                                                    >
                                                        <div className="deliv-bars-group">
                                                            <div
                                                                className="deliv-bar bar-nsd"
                                                                style={{ height: `${nsdHeight}%` }}
                                                                title={`NSD: ${pt.nsd}`}
                                                            />
                                                            <div
                                                                className="deliv-bar bar-assisted"
                                                                style={{ height: `${assistedHeight}%` }}
                                                                title={`Assisted: ${pt.assisted}`}
                                                            />
                                                            <div
                                                                className="deliv-bar bar-cs"
                                                                style={{ height: `${csHeight}%` }}
                                                                title={`CS: ${pt.cs}`}
                                                            />
                                                        </div>

                                                        {isHovered && (
                                                            <div className={`deliv-tooltip ${idx > deliveryTrendsData.points.length - 3 ? 'align-right' : idx < 2 ? 'align-left' : 'align-center'}`}>
                                                                <div className="deliv-tooltip-header">{pt.periodLabel}</div>
                                                                <div className="deliv-tooltip-row">
                                                                    <span className="deliv-tooltip-lbl"><span className="legend-dot" style={{ background: '#88a86c' }}></span>NSD:</span>
                                                                    <strong>{pt.nsd}</strong>
                                                                </div>
                                                                <div className="deliv-tooltip-row">
                                                                    <span className="deliv-tooltip-lbl"><span className="legend-dot" style={{ background: '#f3b869' }}></span>Assisted:</span>
                                                                    <strong>{pt.assisted}</strong>
                                                                </div>
                                                                <div className="deliv-tooltip-row">
                                                                    <span className="deliv-tooltip-lbl"><span className="legend-dot" style={{ background: '#c26d7c' }}></span>Cesarean (CS):</span>
                                                                    <strong>{pt.cs}</strong>
                                                                </div>
                                                                <div className="deliv-tooltip-row deliv-tooltip-total">
                                                                    <span>Total Deliveries:</span>
                                                                    <strong>{pt.total}</strong>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="deliv-x-axis">
                                    {deliveryTrendsData.points.map((pt, idx) => (
                                        <div key={idx} className="deliv-x-label">
                                            {pt.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 2. Delivery Complications */}
                        <div className="glass-card chart-card-container deliv-chart-card">
                            <div className="card-header-compact">
                                <div>
                                    <h2 className="section-header-title">Delivery Complications</h2>
                                    <p className="section-header-subtitle">Recorded complications during childbirth</p>
                                </div>
                                <div className="chart-legend">
                                    <span className="legend-item">
                                        <span className="legend-dot" style={{ background: '#b9818a' }}></span>
                                        Total Cases ({activeData.compHemorr + activeData.compHyper + activeData.compInfect + activeData.compOther})
                                    </span>
                                </div>
                            </div>

                            <div className="deliv-complications-container">
                                {[
                                    { id: 'hemorrhage', name: 'Hemorrhage', count: activeData.compHemorr, color: '#b9818a', desc: 'Postpartum hemorrhage or excessive blood loss' },
                                    { id: 'hypertension', name: 'Hypertension', count: activeData.compHyper, color: '#ac97b4', desc: 'Preeclampsia, eclampsia, or gestational hypertension' },
                                    { id: 'infection', name: 'Infection', count: activeData.compInfect, color: '#edbd9a', desc: 'Puerperal infection, sepsis, or wound infection' },
                                    { id: 'other', name: 'Other', count: activeData.compOther, color: '#ffe3a4', desc: 'Other documented clinical childbirth complications' }
                                ].map((com) => {
                                    const maxComp = Math.max(activeData.compHemorr, activeData.compHyper, activeData.compInfect, activeData.compOther, 1);
                                    const barWidthPct = com.count > 0 ? Math.max(10, Math.round((com.count / maxComp) * 100)) : 0;
                                    const isHovered = activeCompTooltip === com.id;

                                    return (
                                        <div
                                            key={com.id}
                                            className={`deliv-comp-row ${isHovered ? 'hovered' : ''}`}
                                            onMouseEnter={() => setActiveCompTooltip(com.id)}
                                            onMouseLeave={() => setActiveCompTooltip(null)}
                                            onClick={() => setActiveCompTooltip(prev => prev === com.id ? null : com.id)}
                                            tabIndex={0}
                                            role="button"
                                            aria-label={`${com.name}: ${com.count} cases`}
                                        >
                                            <div className="deliv-comp-header-row">
                                                <span className="deliv-comp-name">{com.name}</span>
                                                <div className="deliv-comp-badge">
                                                    <span className="deliv-comp-val">{com.count}</span>
                                                    <span className="deliv-comp-unit">{com.count === 1 ? 'case' : 'cases'}</span>
                                                </div>
                                            </div>

                                            <div className="deliv-comp-track">
                                                <div
                                                    className="deliv-comp-fill"
                                                    style={{
                                                        width: `${barWidthPct}%`,
                                                        backgroundColor: com.color
                                                    }}
                                                />
                                            </div>

                                            {isHovered && (
                                                <div className="deliv-comp-tooltip">
                                                    <div className="deliv-tooltip-header">{com.name}</div>
                                                    <div className="deliv-tooltip-row">
                                                        <span>Recorded Cases:</span>
                                                        <strong>{com.count}</strong>
                                                    </div>
                                                    <div className="deliv-tooltip-row">
                                                        <span>Share of Deliveries:</span>
                                                        <strong style={{ color: com.color }}>
                                                            {activeData.deliveries > 0 ? Math.round((com.count / activeData.deliveries) * 100) : 0}%
                                                        </strong>
                                                    </div>
                                                    <div className="deliv-tooltip-note">{com.desc}</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {activeData.compHemorr + activeData.compHyper + activeData.compInfect + activeData.compOther === 0 && (
                                    <div className="deliv-comp-empty-hint">
                                        No delivery complications recorded for the selected period and station.
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </>
            )}

            <ExportModal 
                isOpen={showExportModal} 
                onClose={() => setShowExportModal(false)} 
                onExport={handleExport} 
            />
        </div>
    );
};

const AnalyticsWithBoundary = () => (
    <AnalyticsErrorBoundary>
        <Analytics />
    </AnalyticsErrorBoundary>
);

export default AnalyticsWithBoundary;
