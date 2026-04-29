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
const authService = new AuthService();


/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const STAT_META = [
    { id: 1, label: 'Total Pregnant Patients', key: 'totalPatients', trend: 'up', sub: 'registered in system', icon: HeartPulse, color: 'rose', path: '/dashboard/patients' },
    { id: 2, label: 'High-Risk Pregnancies',   key: 'highRisk',      trend: 'up', sub: 'marked high risk',    icon: AlertTriangle, color: 'orange', path: '/dashboard/high-risk' },
    { id: 3, label: 'Delivery Outcomes',        key: 'newborns',      trend: 'up', sub: 'birth records',        icon: Baby, color: 'pink', path: '/dashboard/newborns' },
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

const BARANGAY_DATA = [
    { name: 'Station 1 – Poblacion', total: 42, highRisk: 6, newborns: 5 },
    { name: 'Station 2 – Sta. Cruz', total: 38, highRisk: 4, newborns: 3 },
    { name: 'Station 3 – San Jose', total: 51, highRisk: 9, newborns: 7 },
    { name: 'Station 4 – Bagong Pag-asa', total: 29, highRisk: 2, newborns: 2 },
    { name: 'Station 5 – Maliwanag', total: 44, highRisk: 7, newborns: 6 },
    { name: 'Station 6 – Mabini', total: 33, highRisk: 5, newborns: 4 },
    { name: 'Station 7 – Daan Paso', total: 47, highRisk: 10, newborns: 4 },
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

const TrimesterBadge = ({ weeks }) => {
    const tri = weeks <= 12 ? 1 : weeks <= 26 ? 2 : 3;
    return (
        <span className={`tri-badge tri-badge--${tri}`}>
            T{tri} · {weeks}w
        </span>
    );
};



const Dashboard = () => {
    const navigate = useNavigate();
    const {user} = useContext(AuthContext);
    const patientService = new PatientService();
    
    //const [user, setUser] = useState(null);
    const [liveStats, setLiveStats] = useState({ totalPatients: 0, highRisk: 0, newborns: 0, apptToday: 0 });
    const [vaccineStock, setVaccineStock] = useState([]);
    const [loadingStock, setLoadingStock] = useState(true);
    const [todayAppts, setTodayAppts] = useState([]);
    const [healthSnapshot, setHealthSnapshot] = useState({ conditions: [], trimesterDist: [] });
    const [loadingHealth, setLoadingHealth] = useState(true);

    useEffect(() => {
    const fetchStats = async () => {
        try {
            // ✅ Defend against timezone shifting when converting 'today' to ISO YYYY-MM-DD
            const now = new Date();
            const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            
            // Fetch high risk stats using PatientService (same logic as HighRiskCases page)
            const highRiskStats = await patientService.getHighRiskStats();
            
            const [{ count: totalPatients }, { count: newborns }, { count: apptToday }, { data: apptData }, { data: pregnancyData }] = await Promise.all([
                // Count only pregnant patients (not postpartum)
                supabase.from('pregnancy_info').select('patient_id', { count: 'exact', head: true }).eq('pregn_postp', 'Pregnant'),
                supabase.from('newborns').select('id', { count: 'exact', head: true }),
                supabase.from('prenatal_visits').select('id', { count: 'exact', head: true }).eq('visit_date', todayStr),
                
                // 🔥 NEW: Fetch full rich relational data for Today's Appointments table dynamic rendering
                supabase.from('prenatal_visits').select(`
                    id, visit_date, patient_id, created_at,
                    patient_basic_info!inner ( 
                        first_name, last_name, barangay, date_of_birth
                    )
                `).eq('visit_date', todayStr).order('created_at', { ascending: true }),
                
                // Fetch pregnancy info separately to avoid nested relationship error, ordered by created_at to get latest first
                supabase.from('pregnancy_info').select('patient_id, lmd, created_at').eq('pregn_postp', 'Pregnant').order('created_at', { ascending: false })
            ]);

            setLiveStats({
                totalPatients: totalPatients ?? 0,
                highRisk: highRiskStats?.highRiskCount ?? 0,
                newborns: newborns ?? 0,
                apptToday: apptToday ?? 0,
            });

            // Dynamically map schedule data instead of relying on empty mock arrays
            if (apptData) {
                // Create a map of patient_id to pregnancy info (only keep latest per patient)
                const pregMap = new Map();
                (pregnancyData || []).forEach(p => {
                    if (p.patient_id && !pregMap.has(p.patient_id)) {
                        // Since we ordered by created_at descending, first occurrence is the latest
                        pregMap.set(p.patient_id, p);
                    }
                });

                // Additional client-side filtering to ensure only today's appointments
                const todayFiltered = apptData.filter(v => {
                    if (!v.visit_date) return false;
                    const visitDate = new Date(v.visit_date);
                    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
                    return visitDateOnly.getTime() === todayDate.getTime();
                });

                const mappedAppts = todayFiltered.map(v => {
                    const info = v.patient_basic_info || {};
                    const pregInfo = pregMap.get(v.patient_id) || {};
                    
                    let age = '?';
                    if (info.date_of_birth) {
                        const bd = new Date(info.date_of_birth);
                        age = now.getFullYear() - bd.getFullYear();
                        if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
                    }

                    let weeks = 0;
                    if (pregInfo.lmd) {
                        weeks = Math.floor((now - new Date(pregInfo.lmd)) / (1000 * 60 * 60 * 24 * 7));
                    }

                    return {
                        id: v.id,
                        name: `${info.first_name || ''} ${info.last_name || ''}`.trim() || 'Unknown',
                        station: info.barangay || 'N/A',
                        age: age,
                        weeks: Math.max(0, weeks),
                        type: 'Checkup',
                        time: patientService.generateTimeSlot(v.patient_id, v.visit_date),
                        risk: pregInfo.calculated_risk || 'Normal'
                    };
                });
                
                // Remove duplicates based on patient ID (keep only the latest visit per patient for today)
                const uniqueAppts = mappedAppts.reduce((acc, current) => {
                    const existingIndex = acc.findIndex(item => item.name === current.name);
                    if (existingIndex === -1) {
                        acc.push(current);
                    } else {
                        // Keep the one with the later time
                        const existingTime = acc[existingIndex].time;
                        const currentTime = current.time;
                        if (currentTime > existingTime) {
                            acc[existingIndex] = current;
                        }
                    }
                    return acc;
                }, []);
                
                // Sort chronologically using internal patientService algorithm rules
                uniqueAppts.sort((a, b) => {
                   const parseTime = (t) => {
                       const [val, ampm] = t.split(' ');
                       let [hr, min] = val.split(':').map(Number);
                       if (ampm === 'PM' && hr !== 12) hr += 12;
                       if (ampm === 'AM' && hr === 12) hr = 0;
                       return hr * 60 + min;
                   };
                   return parseTime(a.time) - parseTime(b.time);
                });

                setTodayAppts(uniqueAppts);
            }

            // Fetch Vaccine Stock
            setLoadingStock(true);
            const stockData = await patientService.getVaccineInventory();
            setVaccineStock(stockData);
            setLoadingStock(false);

            // Fetch Health Snapshot Data
            setLoadingHealth(true);
            const [{ data: prenatalVisits, error: visitsError }, { data: pregnancies, error: pregError }] = await Promise.all([
                supabase.from('prenatal_visits').select('bp_systolic, bp_diastolic, risk_factors, calculated_risk'),
                supabase.from('pregnancy_info').select('patient_id, lmd, created_at').eq('pregn_postp', 'Pregnant').order('created_at', { ascending: false })
            ]);

            if (visitsError) console.error('Error fetching prenatal visits for health snapshot:', visitsError);
            if (pregError) console.error('Error fetching pregnancies for health snapshot:', pregError);

            console.log('Health snapshot data - prenatalVisits:', prenatalVisits?.length || 0, 'pregnancies:', pregnancies?.length || 0);

            // Calculate health conditions
            let normalBP = 0, preEclampsia = 0, anaemia = 0, gestationalDiabetes = 0;
            const totalVisits = prenatalVisits?.length || 0;

            prenatalVisits?.forEach(visit => {
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
            (pregnancies || []).forEach(p => {
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
        } catch (err) {
            console.error('Failed to load dashboard stats:', err);
            setLoadingStock(false);
            setLoadingHealth(false);
        }
    };
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
/*
const Dashboard = () => {
    const navigate = useNavigate();
    const [riskFilter, setRiskFilter] = useState('all');

    // ✅ STORE USER IN STATE
    const [user, setUser] = useState(null);

    // ✅ LOAD USER FROM LOCALSTORAGE
    useEffect(() => {
        const currentUser = authService.getUser();

        if (!currentUser) {
            navigate('/');
            return;
        }

        // Block unauthorized roles
        if (!authService.accessCheck(currentUser, 'admin')) {
            authService.logout();
            navigate('/');
            return;
        }

        setUser(currentUser);
    }, [navigate]);

    // ✅ Extract display name
    const displayName = user?.email
        ? user.email.split('@')[0]
        : 'User';

    const roleLabel = user?.role?.toUpperCase() || 'UNKNOWN';

    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });*/
    return (
        <div className="dashboard">

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
                        You have <strong>{liveStats.apptToday} appointments</strong> today and <strong>{liveStats.highRisk} high-risk alerts</strong> requiring attention.
                    </p>
                </div>
                <div className="welcome-actions-panel">
                    <p className="welcome-actions-title">Quick Actions</p>
                    <div className="welcome-actions">
                        {[
                            { label: 'Add Patient', icon: Users, color: 'rose', path: '/dashboard/patients/add' },
                            { label: 'View Schedules', icon: CalendarCheck, color: 'sage', path: '/dashboard/prenatal', state: { openBooking: true } },
                            { label: 'High Risk Patients', icon: AlertTriangle, color: 'blue', path: '/dashboard/high-risk' },
                            { label: 'Log Delivery', icon: Baby, color: 'pink', path: '/dashboard/deliveries' },
                            { label: 'Issue Vaccine', icon: Syringe, color: 'orange', path: '/dashboard/vaccinations' },
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
                    <div className="card">
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
                                        <th>Risk</th>
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
                                                <td><TrimesterBadge weeks={a.weeks} /></td>
                                                <td><span className="type-tag">{a.type}</span></td>
                                                <td>
                                                    <span className={`risk-badge risk-badge--${a.risk.replace(' ', '-').toLowerCase()}`}>
                                                        {a.risk}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* VACCINE & SUPPLEMENT STOCK */}
                    <div className="card">
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
                                <div className="stock-summary-card stock-summary--critical">
                                    <span className="stock-summary-count">{vaccineStock.filter(v => v.status === 'critical').length}</span>
                                    <span className="stock-summary-label">Critical</span>
                                </div>
                                <div className="stock-summary-card stock-summary--low">
                                    <span className="stock-summary-count">{vaccineStock.filter(v => v.status === 'low').length}</span>
                                    <span className="stock-summary-label">Low Stock</span>
                                </div>
                                <div className="stock-summary-card stock-summary--ok">
                                    <span className="stock-summary-count">{vaccineStock.filter(v => v.status === 'ok').length}</span>
                                    <span className="stock-summary-label">Normal</span>
                                </div>
                            </div>
                        )}
                        
                        <div className="stock-list">
                            {loadingStock ? (
                                <div className="stock-loading">Loading inventory...</div>
                            ) : vaccineStock.length > 0 ? (
                                vaccineStock
                                    .sort((a, b) => {
                                        // Priority sort: Critical (0) → Low (1) → Medium (2) → Ok (3)
                                        const priority = { critical: 0, low: 1, medium: 2, ok: 3 };
                                        return priority[a.status] - priority[b.status];
                                    })
                                    .slice(0, 5)
                                    .map((v) => (
                                    <div key={v.name} className={`stock-item stock-item--${v.status}`}>
                                        <div className="stock-info">
                                            <span className="stock-name">{v.name}</span>
                                            <div className="stock-bar-wrap">
                                                <MiniBar
                                                    value={v.stock}
                                                    max={Math.max(v.stock, v.min) * 1.5}
                                                    color={v.status === 'ok' ? 'sage' : v.status === 'medium' ? 'blue' : v.status === 'low' ? 'yellow' : 'rose'}
                                                />
                                            </div>
                                        </div>
                                        <div className="stock-meta">
                                            <span className="stock-qty">{v.stock} {v.unit}</span>
                                            <span className={`stock-badge stock-badge--${v.status}`}>
                                                {v.status === 'ok' ? 'Normal' : v.status === 'medium' ? 'Medium' : v.status === 'low' ? 'Low' : 'Critical'}
                                            </span>
                                        </div>
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

                    {/* MATERNAL HEALTH SNAPSHOT */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title"><Activity size={16} />Health Snapshot</h2>
                        </div>
                        <p className="card-description">Shows the common pregnancy conditions for easier monitoring.</p>
                        <div className="snapshot-list">
                            {loadingHealth ? (
                                <div style={{textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)'}}>
                                    Loading health data...
                                </div>
                            ) : healthSnapshot.conditions.length > 0 ? (
                                healthSnapshot.conditions.map((m) => (
                                    <div key={m.label} className="snapshot-item">
                                        <div className="snapshot-label-row">
                                            <span className="snapshot-label">{m.label}</span>
                                            <span className="snapshot-pct">{m.pct}%</span>
                                        </div>
                                        <MiniBar value={m.pct} max={100} color={m.color} />
                                    </div>
                                ))
                            ) : (
                                <div style={{textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)'}}>
                                    No health data available.
                                </div>
                            )}
                        </div>

                        {/* Trimester Distribution */}
                        <div className="section-divider" />
                        <p className="section-sub-title">Trimester Distribution</p>
                        <div className="tri-dist">
                            {loadingHealth ? (
                                <div style={{textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)'}}>
                                    Loading...
                                </div>
                            ) : healthSnapshot.trimesterDist.length > 0 ? (
                                healthSnapshot.trimesterDist.map((t) => (
                                    <div key={t.label} className={`tri-block tri-block--${t.color}`}>
                                        <span className="tri-count">{t.count}</span>
                                        <span className="tri-label">{t.label}</span>
                                    </div>
                                ))
                            ) : (
                                <div style={{textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)'}}>
                                    No data available.
                                </div>
                            )}
                        </div>
                    </div>

                </div>{/* end right col */}

            </div>{/* end dash-grid */}
        </div>
    );
};

export default Dashboard;
