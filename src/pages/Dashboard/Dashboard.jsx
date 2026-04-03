import React, { useState, useEffect } from 'react';
import {
    Users, Baby, AlertTriangle, CalendarCheck, TrendingUp,
    TrendingDown, Activity, Syringe, HeartPulse, MapPin,
    Clock, ChevronRight, Plus, FileText, Eye, Filter,
    CheckCircle2, XCircle, Circle, Dot, MoreHorizontal,
    ArrowUpRight, Package, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/Dashboard.css';
import AuthService from '../../services/authservice';

const authService = new AuthService();


/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const STATS = [
    {
        id: 1, label: 'Total Pregnant Patients', value: 284,
        change: +12, trend: 'up', sub: 'this month',
        icon: HeartPulse, color: 'rose', path: '/dashboard/patients'
    },
    {
        id: 2, label: 'High-Risk Pregnancies', value: 43,
        change: -3, trend: 'down', sub: 'vs last month',
        icon: AlertTriangle, color: 'orange', path: '/dashboard/high-risk'
    },
    {
        id: 3, label: 'Newborns Registered', value: 31,
        change: +8, trend: 'up', sub: 'this month',
        icon: Baby, color: 'pink', path: '/dashboard/newborns'
    },
    {
        id: 4, label: 'Appointments Today', value: 18,
        change: 0, trend: 'neutral', sub: '6 pending confirmation',
        icon: CalendarCheck, color: 'sage', path: '/dashboard/prenatal'
    },
];

const UPCOMING_APPTS = [
    { id: 'UA-1', name: 'Naomi Nicole C. Magsino', age: 24, weeks: 24, time: '8:00 AM', type: 'Prenatal', barangay: 'Brgy. 3', risk: 'normal' },
    { id: 'UA-2', name: 'Jane Rose M. Tadeo', age: 28, weeks: 32, time: '9:30 AM', type: 'High-Risk', risk: 'high' },
    { id: 'UA-3', name: 'Bhea Mae E. Tria', age: 22, weeks: 10, time: '10:00 AM', type: 'Routine', risk: 'monitor' },
    { id: 'UA-4', name: 'Guila C. Valdesimo', age: 26, weeks: 20, time: '11:00 AM', type: 'Prenatal', risk: 'normal' },
    { id: 'UA-5', name: 'Safia C. Baig', age: 30, weeks: 36, time: '2:00 PM', type: 'Follow-up', risk: 'high' },
    { id: 1, name: 'Maria Reyes', age: 28, weeks: 32, time: '8:00 AM', type: 'Prenatal', barangay: 'Brgy. 3', risk: 'high' },
    { id: 2, name: 'Ana Cruz', age: 24, weeks: 20, time: '9:30 AM', type: 'Prenatal', barangay: 'Brgy. 7', risk: 'normal' },
    { id: 3, name: 'Lorna Santos', age: 33, weeks: 36, time: '10:00 AM', type: 'Follow-up', barangay: 'Brgy. 1', risk: 'monitor' },
    { id: 4, name: 'Cristina Dela Cruz', age: 29, weeks: 14, time: '11:00 AM', type: 'Prenatal', barangay: 'Brgy. 5', risk: 'normal' },
    { id: 5, name: 'Joy Bautista', age: 21, weeks: 28, time: '2:00 PM', type: 'Prenatal', barangay: 'Brgy. 2', risk: 'monitor' },
];

const HIGH_RISK = [
    { id: 'HR-1', name: 'Jane Rose M. Tadeo', weeks: 32, condition: 'Preeclampsia', bp: '160/100', lastVisit: '1 week ago', status: 'critical' },
    { id: 'HR-2', name: 'Safia C. Baig', weeks: 36, condition: 'Anemia', bp: '135/85', lastVisit: '3 days ago', status: 'warning' },
    { id: 1, name: 'Maria Reyes', weeks: 32, condition: 'Preeclampsia', bp: '150/95', lastVisit: '2 days ago', status: 'critical' },
    { id: 2, name: 'Susan Flores', weeks: 28, condition: 'Gestional Diabetes', bp: '130/85', lastVisit: '5 days ago', status: 'warning' },
    { id: 3, name: 'Nora Villanueva', weeks: 36, condition: 'Placenta Previa', bp: '125/80', lastVisit: '1 day ago', status: 'critical' },
    { id: 4, name: 'Ruth Gonzalez', weeks: 24, condition: 'Anemia', bp: '110/70', lastVisit: '3 days ago', status: 'warning' },
];

const VACCINE_STOCK = [
    { name: 'Tetanus Toxoid (TT)', stock: 12, min: 20, unit: 'vials', status: 'low' },
    { name: 'Hepa B (Newborn)', stock: 45, min: 30, unit: 'vials', status: 'ok' },
    { name: 'BCG', stock: 8, min: 20, unit: 'vials', status: 'critical' },
    { name: 'Iron Supplements', stock: 320, min: 100, unit: 'tablets', status: 'ok' },
    { name: 'Folic Acid', stock: 15, min: 100, unit: 'tablets', status: 'critical' },
    { name: 'Calcium Supplements', stock: 60, min: 50, unit: 'tablets', status: 'ok' },
];

const BARANGAY_DATA = [
    { name: 'Brgy. 1 – Poblacion', total: 42, highRisk: 6, newborns: 5 },
    { name: 'Brgy. 2 – Sta. Cruz', total: 38, highRisk: 4, newborns: 3 },
    { name: 'Brgy. 3 – San Jose', total: 51, highRisk: 9, newborns: 7 },
    { name: 'Brgy. 4 – Bagong Pag-asa', total: 29, highRisk: 2, newborns: 2 },
    { name: 'Brgy. 5 – Maliwanag', total: 44, highRisk: 7, newborns: 6 },
    { name: 'Brgy. 6 – Mabini', total: 33, highRisk: 5, newborns: 4 },
    { name: 'Brgy. 7 – Daan Paso', total: 47, highRisk: 10, newborns: 4 },
];

const RECENT_DELIVERIES = [
    { id: 1, mother: 'Elena Torres', date: 'Feb 26', type: 'NSD', outcome: 'Good', newborn: 'Girl, 3.1 kg' },
    { id: 2, mother: 'Grace Padilla', date: 'Feb 25', type: 'CS', outcome: 'Good', newborn: 'Boy, 2.9 kg' },
    { id: 3, mother: 'Mylene Aquino', date: 'Feb 24', type: 'NSD', outcome: 'Monitor', newborn: 'Girl, 2.4 kg' },
    { id: 4, mother: 'Daisy Ramos', date: 'Feb 22', type: 'NSD', outcome: 'Good', newborn: 'Boy, 3.3 kg' },
];

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
    const [user, setUser] = useState(null);

    useEffect(() => {
        const currentUser = authService.getUser();
        if (!currentUser) {
            navigate('/');
            return;
        }

        if (!authService.accessCheck(currentUser, 'admin')) {
            authService.logout();
            navigate('/');
            return;
        }

        setUser(currentUser);
    }, [navigate]);

    const displayName = user?.email ? user.email.split('@')[0] : 'User';
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

            {/* ── Welcome Banner ── */}
            <div className="welcome-banner">
                <div className="welcome-left">
                    <p className="welcome-greeting">Good morning, {displayName} <span className="wave-emoji">👋</span></p>
                    <p className="welcome-sub">
                        You have <strong>18 appointments</strong> today and <strong>3 high-risk alerts</strong> requiring attention.
                    </p>
                </div>
                <div className="welcome-pills">
                    <span className="pill pill--alert"><AlertTriangle size={12} />3 Critical Alerts</span>
                    <span className="pill pill--warning"><Clock size={12} />2 Missed Visits</span>
                    <span className="pill pill--info"><Package size={12} />2 Low Stock Items</span>
                </div>
            </div>

            {/* ── Quick Actions (full-width, below greeting) ── */}
            <div className="card quick-actions-card">
                <div className="card-header">
                    <h2 className="card-title">Quick Actions</h2>
                </div>
                <p className="card-description">Shortcuts to frequently used administrative actions.</p>
                <div className="quick-actions-grid quick-actions-grid--row">
                    {[
                        { label: 'Add Patient', icon: Users, color: 'rose', path: '/dashboard/patients/add' },
                        { label: 'Schedule Visit', icon: CalendarCheck, color: 'sage', path: '/dashboard/prenatal', state: { openBooking: true } },
                        { label: 'Record Vitals', icon: Activity, color: 'blue', path: '/dashboard/patients' },
                        { label: 'Log Delivery', icon: Baby, color: 'pink', path: '/dashboard/deliveries' },
                        { label: 'Issue Vaccine', icon: Syringe, color: 'orange', path: '/dashboard/vaccinations' },
                        { label: 'Generate Report', icon: FileText, color: 'purple', path: '/dashboard/analytics' },
                    ].map(({ label, icon: Icon, color, path, state }) => (
                        <button key={label} className={`quick-btn quick-btn--${color}`} onClick={() => navigate(path, state ? { state } : undefined)}>
                            <Icon size={18} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="stats-grid">
                {STATS.map((s) => {
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
                                    {s.change !== 0
                                        ? `${s.trend === 'up' ? '+' : ''}${s.change}`
                                        : '—'
                                    }
                                </span>
                            </div>
                            <div className="stat-value">{s.value}</div>
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
                                <span className="card-badge card-badge--blue">18</span>
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
                                        <th>Time</th>
                                        <th>Risk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {UPCOMING_APPTS.map((a) => (
                                        <tr key={a.id} className="table-row">
                                            <td>
                                                <div className="patient-cell">
                                                    <div className="patient-avatar">
                                                        {a.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                                    </div>
                                                    <div>
                                                        <p className="patient-name">{a.name}</p>
                                                        <p className="patient-meta">{a.barangay} · {a.age} yrs</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><TrimesterBadge weeks={a.weeks} /></td>
                                            <td><span className="type-tag">{a.type}</span></td>
                                            <td><span className="time-tag">{a.time}</span></td>
                                            <td>
                                                <span className={`risk-badge risk-badge--${a.risk}`}>
                                                    {a.risk}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* VACCINE & SUPPLEMENT STOCK */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">
                                <Syringe size={16} />Vaccine &amp; Supply Stock
                                <span className="card-badge card-badge--red">2 Low</span>
                            </h2>
                            <button className="card-link">Manage <ChevronRight size={13} /></button>
                        </div>
                        <p className="card-description">Manage real-time inventory levels of vital supplements and vaccines.</p>
                        <div className="stock-list">
                            {VACCINE_STOCK.map((v) => (
                                <div key={v.name} className={`stock-item stock-item--${v.status}`}>
                                    <div className="stock-info">
                                        <span className="stock-name">{v.name}</span>
                                        <div className="stock-bar-wrap">
                                            <MiniBar
                                                value={v.stock}
                                                max={Math.max(v.stock, v.min) * 1.5}
                                                color={v.status === 'ok' ? 'sage' : v.status === 'low' ? 'yellow' : 'rose'}
                                            />
                                        </div>
                                    </div>
                                    <div className="stock-meta">
                                        <span className="stock-qty">{v.stock} {v.unit}</span>
                                        <span className={`stock-badge stock-badge--${v.status}`}>
                                            {v.status === 'ok' ? 'In Stock' : v.status === 'low' ? 'Low' : 'Critical'}
                                        </span>
                                    </div>
                                </div>
                            ))}
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
                            {[
                                { label: 'Normal BP', pct: 71, color: 'sage' },
                                { label: 'Pre-eclampsia', pct: 15, color: 'rose' },
                                { label: 'Anaemia', pct: 9, color: 'orange' },
                                { label: 'Gestational Diabetes', pct: 5, color: 'yellow' },
                            ].map((m) => (
                                <div key={m.label} className="snapshot-item">
                                    <div className="snapshot-label-row">
                                        <span className="snapshot-label">{m.label}</span>
                                        <span className="snapshot-pct">{m.pct}%</span>
                                    </div>
                                    <MiniBar value={m.pct} max={100} color={m.color} />
                                </div>
                            ))}
                        </div>

                        {/* Trimester Distribution */}
                        <div className="section-divider" />
                        <p className="section-sub-title">Trimester Distribution</p>
                        <div className="tri-dist">
                            {[
                                { label: '1st Trimester', count: 62, color: 'tri1' },
                                { label: '2nd Trimester', count: 104, color: 'tri2' },
                                { label: '3rd Trimester', count: 118, color: 'tri3' },
                            ].map((t) => (
                                <div key={t.label} className={`tri-block tri-block--${t.color}`}>
                                    <span className="tri-count">{t.count}</span>
                                    <span className="tri-label">{t.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>{/* end right col */}

            </div>{/* end dash-grid */}
        </div>
    );
};

export default Dashboard;
