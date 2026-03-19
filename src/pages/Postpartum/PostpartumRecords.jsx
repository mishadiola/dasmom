import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Baby, Heart, AlertTriangle, Clock,
    CheckCircle2, XCircle, ChevronRight, Eye, Plus,
    AlertCircle, FileText, MapPin, Activity, Thermometer,
    Brain, Milk, Calendar, TrendingUp, Download, X
} from 'lucide-react';
import '../../styles/pages/PostpartumRecords.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const SUMMARY_STATS = [
    { label: 'Recent Deliveries (42 days)', value: 58, color: 'lilac', icon: Baby },
    { label: 'Due for Postpartum Visit', value: 21, color: 'pink', icon: Calendar },
    { label: 'Missed Follow-ups', value: 6, color: 'orange', icon: XCircle },
    { label: 'With Complications', value: 4, color: 'rose', icon: AlertTriangle },
    { label: 'Recovered Mothers', value: 27, color: 'sage', icon: CheckCircle2 },
];

const MOCK_MOTHERS = [
    {
        id: 'PP-2026-01', patientId: 'PT-2026-N1', name: 'Naomi Nicole C. Magsino', age: 24,
        barangay: 'Brgy. 3', deliveryDate: '2026-02-28', deliveryType: 'NSD',
        daysPostpartum: 6, babyOutcome: 'Alive', recoveryStatus: 'Normal',
        lastCheckup: '2026-03-01', nextFollowUp: '2026-03-14',
        complications: 'None', followUpStatus: 'Upcoming',
        weight: '58 kg', bp: '110/70', temp: '36.5°C',
        progress: 95,
    },
    {
        id: 'PP-2026-02', patientId: 'PT-2026-J2', name: 'Jane Rose M. Tadeo', age: 28,
        barangay: 'Brgy. 1', deliveryDate: '2026-02-25', deliveryType: 'CS',
        daysPostpartum: 9, babyOutcome: 'Alive', recoveryStatus: 'Monitoring',
        lastCheckup: '2026-03-01', nextFollowUp: '2026-03-10',
        complications: 'Preeclampsia History', followUpStatus: 'Upcoming',
        weight: '65 kg', bp: '140/90', temp: '36.7°C',
        progress: 75,
    },
    {
        id: 'PP-2026-03', patientId: 'PT-2026-B3', name: 'Bhea Mae E. Tria', age: 22,
        barangay: 'Brgy. 5', deliveryDate: '2026-03-01', deliveryType: 'NSD',
        daysPostpartum: 5, babyOutcome: 'Alive', recoveryStatus: 'Normal',
        lastCheckup: '2026-03-05', nextFollowUp: '2026-03-12',
        complications: 'None', followUpStatus: 'Upcoming',
        weight: '52 kg', bp: '115/75', temp: '36.6°C',
        progress: 90,
    },
    {
        id: 'PP-2026-04', patientId: 'PT-2026-G4', name: 'Guila C. Valdesimo', age: 26,
        barangay: 'Brgy. 2', deliveryDate: '2026-02-20', deliveryType: 'NSD',
        daysPostpartum: 14, babyOutcome: 'Alive', recoveryStatus: 'Normal',
        lastCheckup: '2026-03-01', nextFollowUp: '2026-03-15',
        complications: 'None', followUpStatus: 'Completed',
        weight: '60 kg', bp: '120/80', temp: '36.4°C',
        progress: 100,
    },
    {
        id: 'PP-2026-05', patientId: 'PT-2026-S5', name: 'Safia C. Baig', age: 30,
        barangay: 'Brgy. 7', deliveryDate: '2026-02-27', deliveryType: 'CS',
        daysPostpartum: 7, babyOutcome: 'Alive', recoveryStatus: 'Complication',
        lastCheckup: '2026-03-01', nextFollowUp: '2026-03-08',
        complications: 'Anemia', followUpStatus: 'Upcoming',
        weight: '68 kg', bp: '135/85', temp: '36.8°C',
        progress: 60,
    },
    {
        id: 'PP-001', patientId: 'PT-2401', name: 'Maria Reyes', age: 28,
        barangay: 'Brgy. 3', deliveryDate: '2026-02-10', deliveryType: 'NSD',
        daysPostpartum: 18, babyOutcome: 'Alive', recoveryStatus: 'Monitoring',
        lastCheckup: '2026-02-22', nextFollowUp: '2026-03-03',
        complications: 'Elevated BP', followUpStatus: 'Upcoming',
        weight: '58 kg', bp: '140/90', temp: '36.8°C',
        progress: 65,
    },
    {
        id: 'PP-002', patientId: 'PT-2402', name: 'Ana Cruz', age: 32,
        barangay: 'Brgy. 1', deliveryDate: '2026-02-18', deliveryType: 'CS',
        daysPostpartum: 10, babyOutcome: 'Alive', recoveryStatus: 'Normal',
        lastCheckup: '2026-02-25', nextFollowUp: '2026-03-07',
        complications: 'None', followUpStatus: 'Completed',
        weight: '65 kg', bp: '120/80', temp: '36.5°C',
        progress: 82,
    },
    {
        id: 'PP-003', patientId: 'PT-2403', name: 'Elena Santos', age: 24,
        barangay: 'Brgy. 5', deliveryDate: '2026-02-05', deliveryType: 'NSD',
        daysPostpartum: 23, babyOutcome: 'NICU', recoveryStatus: 'Complication',
        lastCheckup: '2026-02-14', nextFollowUp: '2026-02-21',
        complications: 'Infection / Heavy Bleeding', followUpStatus: 'Missed',
        weight: '54 kg', bp: '150/100', temp: '38.2°C',
        progress: 30,
    },
    {
        id: 'PP-004', patientId: 'PT-2404', name: 'Rosa Diaz', age: 35,
        barangay: 'Brgy. 7', deliveryDate: '2026-02-20', deliveryType: 'CS',
        daysPostpartum: 8, babyOutcome: 'Alive', recoveryStatus: 'Normal',
        lastCheckup: '2026-02-24', nextFollowUp: '2026-03-06',
        complications: 'None', followUpStatus: 'Upcoming',
        weight: '70 kg', bp: '118/76', temp: '36.6°C',
        progress: 90,
    },
    {
        id: 'PP-005', patientId: 'PT-2405', name: 'Clara Gomez', age: 19,
        barangay: 'Brgy. 2', deliveryDate: '2026-01-30', deliveryType: 'NSD',
        daysPostpartum: 29, babyOutcome: 'Alive', recoveryStatus: 'Monitoring',
        lastCheckup: '2026-02-10', nextFollowUp: '2026-02-17',
        complications: 'Depression Signs', followUpStatus: 'Missed',
        weight: '52 kg', bp: '110/70', temp: '36.7°C',
        progress: 50,
    },
    {
        id: 'PP-006', patientId: 'PT-2406', name: 'Luz Ramos', age: 30,
        barangay: 'Brgy. 4', deliveryDate: '2026-02-01', deliveryType: 'NSD',
        daysPostpartum: 27, babyOutcome: 'Alive', recoveryStatus: 'Normal',
        lastCheckup: '2026-02-28', nextFollowUp: '2026-03-15',
        complications: 'None', followUpStatus: 'Completed',
        weight: '60 kg', bp: '116/74', temp: '36.5°C',
        progress: 95,
    },
];

const SYSTEM_ALERTS = [
    { id: 1, type: 'critical', text: 'Elena Santos missed postpartum visit — Day 23 unassessed', time: '1 hour ago' },
    { id: 2, type: 'warning', text: 'Maria Reyes BP still elevated (140/90) — follow-up needed', time: '3 hours ago' },
    { id: 3, type: 'warning', text: 'Clara Gomez missed 7-day and 14-day checkups', time: '6 hours ago' },
    { id: 4, type: 'info', text: '4 CS mothers due for wound assessment this week', time: 'Today' },
];

const BARANGAY_RECOVERY = [
    { name: 'Brgy. 1', total: 12, recovered: 9 },
    { name: 'Brgy. 2', total: 8, recovered: 5 },
    { name: 'Brgy. 3', total: 14, recovered: 10 },
    { name: 'Brgy. 4', total: 10, recovered: 8 },
    { name: 'Brgy. 5', total: 7, recovered: 3 },
    { name: 'Brgy. 7', total: 7, recovered: 6 },
];

/* ════════════════════════════
   POSTPARTUM DETAIL MODAL
════════════════════════════ */
const FOLLOW_UP_SCHEDULE = [
    { label: '24–48 Hours', key: 'd1' },
    { label: '7 Days', key: 'd7' },
    { label: '14 Days', key: 'd14' },
    { label: '6 Weeks', key: 'w6' },
];

const MOCK_DETAIL = {
    'PP-001': {
        deliveryFacility: 'Dasmariñas CHO Main',
        attendingStaff: 'Midwife Elena P.',
        deliveryComplications: 'Prolonged labor',
        birthWeight: '3.1 kg',
        breastfeeding: 'Exclusive',
        mhStatus: 'Needs Counseling',
        woundCondition: 'N/A (NSD)',
        followUps: { d1: 'Completed', d7: 'Completed', d14: 'Upcoming', w6: 'Upcoming' },
        vitals: [
            { date: 'Feb 12', bp: '138/88', temp: '36.9°C', weight: '57 kg' },
            { date: 'Feb 17', bp: '142/92', temp: '36.8°C', weight: '58 kg' },
            { date: 'Feb 22', bp: '140/90', temp: '36.8°C', weight: '58 kg' },
        ]
    },
    'PP-003': {
        deliveryFacility: 'Barangay Health Center 5',
        attendingStaff: 'Midwife Ana M.',
        deliveryComplications: 'Postpartum hemorrhage',
        birthWeight: '2.7 kg',
        breastfeeding: 'Difficulty',
        mhStatus: 'Normal',
        woundCondition: 'N/A (NSD)',
        followUps: { d1: 'Completed', d7: 'Missed', d14: 'Missed', w6: 'Upcoming' },
        vitals: [
            { date: 'Feb 07', bp: '148/98', temp: '38.0°C', weight: '53 kg' },
            { date: 'Feb 14', bp: '150/100', temp: '38.2°C', weight: '54 kg' },
        ]
    }
};

const DetailModal = ({ mother, onClose }) => {
    const detail = MOCK_DETAIL[mother.id] || {
        deliveryFacility: 'Dasmariñas CHO',
        attendingStaff: 'Midwife Elena P.',
        deliveryComplications: 'None',
        birthWeight: '3.2 kg',
        breastfeeding: 'Exclusive',
        mhStatus: 'Normal',
        woundCondition: mother.deliveryType === 'CS' ? 'Healing Well' : 'N/A (NSD)',
        followUps: { d1: 'Completed', d7: 'Completed', d14: 'Upcoming', w6: 'Upcoming' },
        vitals: [{ date: 'Feb 25', bp: mother.bp, temp: mother.temp, weight: mother.weight }]
    };

    const followUpStatusClass = (s) => {
        if (s === 'Completed') return 'fu-completed';
        if (s === 'Missed') return 'fu-missed';
        return 'fu-upcoming';
    };

    const followUpIcon = (s) => {
        if (s === 'Completed') return <CheckCircle2 size={14} />;
        if (s === 'Missed') return <XCircle size={14} />;
        return <Clock size={14} />;
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="pp-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>{mother.name}</h2>
                        <p>{mother.patientId} · {mother.deliveryType} · Day {mother.daysPostpartum} Postpartum</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    {/* A. Delivery Summary */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><Baby size={15} /> Delivery Summary</h3>
                        <div className="detail-grid">
                            <div className="detail-item"><span>Delivery Date</span><strong>{mother.deliveryDate}</strong></div>
                            <div className="detail-item"><span>Facility</span><strong>{detail.deliveryFacility}</strong></div>
                            <div className="detail-item"><span>Delivery Type</span><strong>{mother.deliveryType}</strong></div>
                            <div className="detail-item"><span>Attending Staff</span><strong>{detail.attendingStaff}</strong></div>
                            <div className="detail-item"><span>Complications During Delivery</span><strong>{detail.deliveryComplications}</strong></div>
                            <div className="detail-item"><span>Baby Birth Weight</span><strong>{detail.birthWeight}</strong></div>
                            <div className="detail-item"><span>Baby Outcome</span><strong>{mother.babyOutcome}</strong></div>
                        </div>
                    </section>

                    {/* B. Vitals Timeline */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><Activity size={15} /> Maternal Recovery Vitals</h3>
                        <div className="vitals-timeline">
                            <table className="vitals-table">
                                <thead>
                                    <tr><th>Date</th><th>Blood Pressure</th><th>Temperature</th><th>Weight</th></tr>
                                </thead>
                                <tbody>
                                    {detail.vitals.map((v, i) => (
                                        <tr key={i}>
                                            <td className="vt-date">{v.date}</td>
                                            <td className={parseFloat(v.bp) > 130 ? 'vt-high' : ''}>{v.bp}</td>
                                            <td className={parseFloat(v.temp) > 37.5 ? 'vt-high' : ''}>{v.temp}</td>
                                            <td>{v.weight}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* C. Wound */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><FileText size={15} /> Wound / Physical Assessment</h3>
                        <div className="detail-grid">
                            <div className="detail-item"><span>Incision / Wound Condition</span><strong>{detail.woundCondition}</strong></div>
                            <div className="detail-item"><span>Current Complications</span><strong>{mother.complications === 'None' ? 'None' : mother.complications}</strong></div>
                            <div className="detail-item"><span>Recovery Progress</span>
                                <div className="progress-wrap">
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${mother.progress}%`, background: mother.progress >= 80 ? '#6db8a0' : mother.progress >= 50 ? '#e8b84b' : '#e05c73' }}></div>
                                    </div>
                                    <strong>{mother.progress}%</strong>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* D. Mental Health */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><Brain size={15} /> Mental Health Screening</h3>
                        <div className={`mh-status-box ${detail.mhStatus === 'Normal' ? 'mh-normal' : 'mh-alert'}`}>
                            {detail.mhStatus === 'Normal'
                                ? <><CheckCircle2 size={16} /> Screening normal — no signs of postpartum depression</>
                                : <><AlertTriangle size={16} /> Counseling recommended — depression signs observed</>
                            }
                        </div>
                        <div className="mh-checklist">
                            {['Mood Changes', 'Sleep Difficulty', 'Anxiety', 'Postpartum Depression Signs'].map(item => (
                                <label key={item} className="mh-check-item">
                                    <input type="checkbox" defaultChecked={detail.mhStatus !== 'Normal'} readOnly />
                                    <span>{item}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* E. Breastfeeding */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><Milk size={15} /> Breastfeeding Status</h3>
                        <div className="bf-options">
                            {['Exclusive', 'Mixed Feeding', 'Difficulty', 'Counseling Provided'].map(opt => (
                                <span key={opt} className={`bf-chip ${detail.breastfeeding === opt ? 'bf-chip--active' : ''}`}>{opt}</span>
                            ))}
                        </div>
                    </section>

                    {/* F. Follow-up Schedule */}
                    <section className="modal-section">
                        <h3 className="modal-section-title"><Calendar size={15} /> Postpartum Follow-up Schedule</h3>
                        <div className="followup-schedule">
                            {FOLLOW_UP_SCHEDULE.map(fu => (
                                <div key={fu.key} className={`fu-item ${followUpStatusClass(detail.followUps[fu.key])}`}>
                                    {followUpIcon(detail.followUps[fu.key])}
                                    <span className="fu-label">{fu.label}</span>
                                    <span className="fu-status">{detail.followUps[fu.key]}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                    <button className="btn btn-outline"><Calendar size={15} /> Schedule Follow-up</button>
                    <button className="btn btn-primary"><Plus size={15} /> Record Postpartum Visit</button>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const PostpartumRecords = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        deliveryType: 'All', stage: 'All', recovery: 'All', barangay: 'All', followUp: 'All'
    });
    const [selectedMother, setSelectedMother] = useState(null);

    const handleFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

    const filtered = MOCK_MOTHERS.filter(m => {
        const s = searchTerm.toLowerCase();
        const matchSearch = m.name.toLowerCase().includes(s) || m.patientId.toLowerCase().includes(s) || m.barangay.toLowerCase().includes(s);
        const matchDT = filters.deliveryType === 'All' || m.deliveryType === filters.deliveryType;
        const matchRec = filters.recovery === 'All' || m.recoveryStatus === filters.recovery;
        const matchBrgy = filters.barangay === 'All' || m.barangay === filters.barangay;
        const matchFU = filters.followUp === 'All' || m.followUpStatus === filters.followUp;
        return matchSearch && matchDT && matchRec && matchBrgy && matchFU;
    });

    const getRecoveryClass = (status) => {
        if (status === 'Normal') return 'tr-normal';
        if (status === 'Monitoring') return 'tr-monitoring';
        return 'tr-complication';
    };

    const getRecoveryBadge = (status) => {
        if (status === 'Normal') return 'badge-normal';
        if (status === 'Monitoring') return 'badge-monitoring';
        return 'badge-complication';
    };

    const getFollowUpBadge = (status) => {
        if (status === 'Completed') return 'fu-badge-completed';
        if (status === 'Missed') return 'fu-badge-missed';
        return 'fu-badge-upcoming';
    };

    const maxBrgy = Math.max(...BARANGAY_RECOVERY.map(b => b.total));

    return (
        <div className="pp-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Heart size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Postpartum Records</h1>
                    <p className="page-subtitle">Monitor mothers post-delivery — recovery, complications & follow-ups</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline"><Download size={16} /> Export Report</button>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard/prenatal/add')}><Plus size={16} /> Record Postpartum Visit</button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="pp-stats-grid">
                {SUMMARY_STATS.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className={`stat-card stat-card--${s.color}`}>
                            <div className="stat-top">
                                <div className={`stat-icon stat-icon--${s.color}`}>
                                    <Icon size={20} />
                                </div>
                            </div>
                            <div className="stat-value">{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Search & Filters ── */}
            <div className="pp-controls-card">
                <div className="pp-search-wrap">
                    <Search size={16} className="pp-search-icon" />
                    <input
                        type="text"
                        className="pp-search-input"
                        placeholder="Search by name, patient ID, or barangay..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="pp-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.deliveryType} onChange={e => handleFilter('deliveryType', e.target.value)}>
                        <option value="All">All Delivery Types</option>
                        <option value="NSD">NSD (Normal)</option>
                        <option value="CS">CS (Cesarean)</option>
                    </select>
                    <select value={filters.recovery} onChange={e => handleFilter('recovery', e.target.value)}>
                        <option value="All">All Recovery Status</option>
                        <option value="Normal">Normal</option>
                        <option value="Monitoring">Monitoring</option>
                        <option value="Complication">Complication</option>
                    </select>
                    <select value={filters.followUp} onChange={e => handleFilter('followUp', e.target.value)}>
                        <option value="All">All Follow-up Status</option>
                        <option value="Completed">Completed</option>
                        <option value="Upcoming">Upcoming</option>
                        <option value="Missed">Missed</option>
                    </select>
                    <select value={filters.barangay} onChange={e => handleFilter('barangay', e.target.value)}>
                        <option value="All">All Barangays</option>
                        {[1, 2, 3, 4, 5, 7].map(n => <option key={n} value={`Brgy. ${n}`}>Brgy. {n}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Main 2-col layout ── */}
            <div className="pp-main-layout">

                {/* ── LEFT: Mothers Table ── */}
                <div className="pp-table-col">
                    <div className="pp-card">
                        <div className="pp-card-head">
                            <h2><Baby size={17} /> Postpartum Mothers</h2>
                            <span className="pp-count">{filtered.length} records</span>
                        </div>
                        <div className="table-responsive">
                            <table className="pp-table">
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Delivery</th>
                                        <th>Days PP</th>
                                        <th>Baby</th>
                                        <th>Recovery</th>
                                        <th>Last Checkup</th>
                                        <th>Next Follow-up</th>
                                        <th>Complications</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(m => (
                                        <tr key={m.id} className={getRecoveryClass(m.recoveryStatus)}>
                                            <td>
                                                <div className="pp-patient-cell">
                                                    <div className="pp-avatar">{m.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                                                    <div>
                                                        <span className="pp-name">{m.name}</span>
                                                        <span className="pp-meta">{m.patientId} · {m.barangay}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`dt-badge dt-${m.deliveryType.toLowerCase()}`}>{m.deliveryType}</span>
                                                <div className="pp-ddate">{m.deliveryDate}</div>
                                            </td>
                                            <td className="pp-days-pp">
                                                <span className="days-pill">Day {m.daysPostpartum}</span>
                                            </td>
                                            <td>
                                                <span className={`baby-badge ${m.babyOutcome === 'NICU' ? 'baby-nicu' : 'baby-alive'}`}>{m.babyOutcome}</span>
                                            </td>
                                            <td>
                                                <span className={`recovery-badge ${getRecoveryBadge(m.recoveryStatus)}`}>{m.recoveryStatus}</span>
                                                <div className="mini-progress">
                                                    <div className="mini-fill" style={{ width: `${m.progress}%`, background: m.progress >= 80 ? '#6db8a0' : m.progress >= 50 ? '#e8b84b' : '#e05c73' }}></div>
                                                </div>
                                            </td>
                                            <td className="pp-date-cell">{m.lastCheckup}</td>
                                            <td>
                                                <div className="pp-date-cell">{m.nextFollowUp}</div>
                                                <span className={`fu-badge ${getFollowUpBadge(m.followUpStatus)}`}>{m.followUpStatus}</span>
                                            </td>
                                            <td>
                                                <span className={`complication-text ${m.complications !== 'None' ? 'has-complication' : ''}`}>
                                                    {m.complications !== 'None' && <AlertCircle size={12} />}  {m.complications}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="pp-actions">
                                                    <button className="action-btn view-btn" title="View Profile" onClick={() => setSelectedMother(m)}>
                                                        <Eye size={15} />
                                                    </button>
                                                    <button className="action-btn record-btn" title="Record Checkup" onClick={() => navigate('/dashboard/prenatal/add')}>
                                                        <Plus size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="pp-empty">
                                                <Baby size={28} />
                                                <p>No postpartum records matching your filters.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Alerts + Barangay ── */}
                <div className="pp-side-col">

                    {/* Alerts Panel */}
                    <div className="pp-card">
                        <div className="pp-card-head">
                            <h2><AlertTriangle size={17} /> System Alerts</h2>
                        </div>
                        <div className="alerts-list">
                            {SYSTEM_ALERTS.map(a => (
                                <div key={a.id} className={`alert-item alert-${a.type}`}>
                                    <div className="alert-dot"></div>
                                    <div className="alert-body">
                                        <p>{a.text}</p>
                                        <span>{a.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Barangay Recovery Distribution */}
                    <div className="pp-card">
                        <div className="pp-card-head">
                            <h2><MapPin size={17} /> Barangay Recovery</h2>
                        </div>
                        <div className="brgy-list">
                            {BARANGAY_RECOVERY.map(b => {
                                const pct = Math.round((b.recovered / b.total) * 100);
                                return (
                                    <div key={b.name} className="brgy-row">
                                        <div className="brgy-name-row">
                                            <span className="brgy-name">{b.name}</span>
                                            <span className="brgy-count">{b.recovered}/{b.total} recovered</span>
                                        </div>
                                        <div className="brgy-bar-bg">
                                            <div className="brgy-bar-fill" style={{ width: `${pct}%`, background: pct >= 70 ? '#6db8a0' : pct >= 50 ? '#e8b84b' : '#e05c73' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Detail Modal ── */}
            {selectedMother && <DetailModal mother={selectedMother} onClose={() => setSelectedMother(null)} />}

        </div>
    );
};

export default PostpartumRecords;
