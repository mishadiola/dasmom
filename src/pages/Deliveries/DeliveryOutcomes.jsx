import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, Baby, Heart, AlertTriangle,
    CheckCircle2, Clock, AlertCircle, FileText, Download,
    Eye, Edit2, Printer, Activity, User, Calendar,
    Stethoscope, MapPin, ChevronDown, ChevronUp, TrendingUp
} from 'lucide-react';
import '../../styles/pages/DeliveryOutcomes.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const SUMMARY_STATS = [
    { label: 'Total Deliveries (This Month)', value: 42, color: 'blue', icon: Baby },
    { label: 'Normal Spontaneous Delivery', value: 28, color: 'green', icon: CheckCircle2 },
    { label: 'Cesarean Section', value: 14, color: 'purple', icon: Activity },
    { label: 'Complications During Delivery', value: 5, color: 'orange', icon: AlertTriangle },
    { label: 'High-Risk Deliveries', value: 6, color: 'rose', icon: AlertCircle },
];

const DELIVERIES = [
    {
        id: 'DO-001', patientId: 'PT-2401', patientName: 'Maria Reyes', age: 28, barangay: 'Brgy. 3',
        deliveryDate: '2026-02-26', deliveryTime: '08:45 AM', deliveryType: 'NSD',
        gestationalAge: '38w 2d', riskLevel: 'High', complications: 'Elevated BP',
        babyOutcome: 'Alive', babyWeight: '3.1 kg', babyGender: 'Female',
        apgar1: 8, apgar5: 9, babyCondition: 'Healthy',
        staff: 'Midwife Elena P.', facility: 'Main Clinic',
        postpartumDate: '2026-03-05', notes: 'BP normalized post-delivery.'
    },
    {
        id: 'DO-002', patientId: 'PT-2402', patientName: 'Ana Cruz', age: 32, barangay: 'Brgy. 1',
        deliveryDate: '2026-02-24', deliveryTime: '02:10 PM', deliveryType: 'CS',
        gestationalAge: '37w 0d', riskLevel: 'High', complications: 'Placenta Previa',
        babyOutcome: 'NICU', babyWeight: '2.8 kg', babyGender: 'Male',
        apgar1: 6, apgar5: 8, babyCondition: 'Special Care',
        staff: 'Dr. Reyes (OB)', facility: 'Main Clinic',
        postpartumDate: '2026-03-03', notes: 'CS due to Placenta Previa.'
    },
    {
        id: 'DO-003', patientId: 'PT-2403', patientName: 'Elena Santos', age: 24, barangay: 'Brgy. 5',
        deliveryDate: '2026-02-20', deliveryTime: '11:30 PM', deliveryType: 'NSD',
        gestationalAge: '39w 4d', riskLevel: 'Normal', complications: 'None',
        babyOutcome: 'Alive', babyWeight: '3.4 kg', babyGender: 'Female',
        apgar1: 9, apgar5: 9, babyCondition: 'Healthy',
        staff: 'Midwife Ana M.', facility: 'BHS 5',
        postpartumDate: '2026-03-01', notes: ''
    },
    {
        id: 'DO-004', patientId: 'PT-2404', patientName: 'Rosa Diaz', age: 35, barangay: 'Brgy. 7',
        deliveryDate: '2026-02-22', deliveryTime: '06:00 AM', deliveryType: 'CS',
        gestationalAge: '36w 5d', riskLevel: 'Monitor', complications: 'Preterm',
        babyOutcome: 'NICU', babyWeight: '2.4 kg', babyGender: 'Male',
        apgar1: 5, apgar5: 7, babyCondition: 'NICU',
        staff: 'Dr. Reyes (OB)', facility: 'Main Clinic',
        postpartumDate: '2026-03-01', notes: 'Preterm CS — neonatal team on standby.'
    },
    {
        id: 'DO-005', patientId: 'PT-2405', patientName: 'Clara Gomez', age: 19, barangay: 'Brgy. 2',
        deliveryDate: '2026-02-18', deliveryTime: '04:15 PM', deliveryType: 'NSD',
        gestationalAge: '40w 0d', riskLevel: 'Normal', complications: 'None',
        babyOutcome: 'Alive', babyWeight: '3.6 kg', babyGender: 'Female',
        apgar1: 9, apgar5: 10, babyCondition: 'Healthy',
        staff: 'Midwife Elena P.', facility: 'BHS 2',
        postpartumDate: '2026-02-25', notes: ''
    },
    {
        id: 'DO-006', patientId: 'PT-2406', patientName: 'Luz Ramos', age: 30, barangay: 'Brgy. 4',
        deliveryDate: '2026-02-15', deliveryTime: '09:50 AM', deliveryType: 'NSD',
        gestationalAge: '38w 0d', riskLevel: 'Normal', complications: 'Postpartum Hemorrhage',
        babyOutcome: 'Alive', babyWeight: '3.2 kg', babyGender: 'Male',
        apgar1: 8, apgar5: 9, babyCondition: 'Healthy',
        staff: 'Midwife Ana M.', facility: 'Main Clinic',
        postpartumDate: '2026-02-22', notes: 'Hemorrhage controlled — monitored for 48 hrs.'
    },
];

const ALERTS = [
    { type: 'critical', text: 'Ana Cruz (DO-002) — baby in NICU, postpartum HIGH RISK', time: '2 days ago' },
    { type: 'warning', text: 'Rosa Diaz (DO-004) — preterm, newborn tracking required', time: '3 days ago' },
    { type: 'warning', text: 'Luz Ramos (DO-006) — post-hemorrhage, close monitoring needed', time: '5 days ago' },
    { type: 'info', text: '3 mothers with CS delivery — wound assessment due this week', time: 'Today' },
];

const COMPLICATION_OPTIONS = ['None', 'Hemorrhage', 'Infection', 'Preeclampsia', 'Placenta Previa', 'Preterm'];
const STAFF_LIST = ['Midwife Elena P.', 'Midwife Ana M.', 'Dr. Reyes (OB)', 'Nurse Bea'];
const FACILITIES = ['Main Clinic', 'BHS 1', 'BHS 2', 'BHS 3', 'BHS 4', 'BHS 5', 'BHS 6', 'BHS 7'];

/* ════════════════════════════
   ADD DELIVERY MODAL
════════════════════════════ */
const AddDeliveryModal = ({ onClose }) => {
    const [section, setSection] = useState('patient');
    const [form, setForm] = useState({
        patientId: '', patientName: '', age: '', barangay: '', gestationalAge: '', riskLevel: 'Normal',
        deliveryDate: '', deliveryTime: '', deliveryType: 'NSD', deliveryMode: '',
        staff: STAFF_LIST[0], facility: FACILITIES[0],
        complications: ['None'],
        babyGender: 'Female', babyWeight: '', apgar1: '', apgar5: '', babyCondition: 'Healthy',
        postpartumDate: '', notes: ''
    });

    const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const toggleComplication = (c) => {
        setForm(prev => {
            const current = [...prev.complications];
            if (c === 'None') return { ...prev, complications: ['None'] };
            const without = current.filter(x => x !== 'None');
            return { ...prev, complications: without.includes(c) ? without.filter(x => x !== c) : [...without, c] };
        });
    };

    const SECTIONS = [
        { id: 'patient', label: 'Patient Info', icon: User },
        { id: 'delivery', label: 'Delivery Details', icon: Stethoscope },
        { id: 'complications', label: 'Complications', icon: AlertTriangle },
        { id: 'baby', label: 'Baby Info', icon: Baby },
        { id: 'plan', label: 'Postpartum Plan', icon: Calendar },
    ];

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="do-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2><Stethoscope size={20} /> Record New Delivery</h2>
                        <p>Document the delivery event for a registered patient.</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                {/* Section nav */}
                <div className="modal-nav">
                    {SECTIONS.map(s => {
                        const Icon = s.icon;
                        return (
                            <button
                                key={s.id}
                                className={`modal-nav-btn ${section === s.id ? 'active' : ''}`}
                                onClick={() => setSection(s.id)}
                                type="button"
                            >
                                <Icon size={14} /> {s.label}
                            </button>
                        );
                    })}
                </div>

                <div className="modal-body">
                    {/* A. Patient Info */}
                    {section === 'patient' && (
                        <div className="modal-section-body">
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Patient Name <span className="req">*</span></label>
                                    <input type="text" placeholder="Search patient name..." value={form.patientName} onChange={e => update('patientName', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Patient ID <span className="req">*</span></label>
                                    <input type="text" placeholder="e.g. PT-2401" value={form.patientId} onChange={e => update('patientId', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Age</label>
                                    <input type="number" value={form.age} onChange={e => update('age', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Barangay</label>
                                    <select value={form.barangay} onChange={e => update('barangay', e.target.value)}>
                                        <option value="">Select Barangay</option>
                                        {[1,2,3,4,5,6,7].map(n => <option key={n}>Brgy. {n}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Gestational Age at Delivery</label>
                                    <input type="text" placeholder="e.g. 38w 2d" value={form.gestationalAge} onChange={e => update('gestationalAge', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Maternal Risk Level</label>
                                    <select value={form.riskLevel} onChange={e => update('riskLevel', e.target.value)}>
                                        <option>Normal</option>
                                        <option>Monitor</option>
                                        <option>High</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* B. Delivery Details */}
                    {section === 'delivery' && (
                        <div className="modal-section-body">
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Delivery Date <span className="req">*</span></label>
                                    <input type="date" value={form.deliveryDate} onChange={e => update('deliveryDate', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Delivery Time <span className="req">*</span></label>
                                    <input type="time" value={form.deliveryTime} onChange={e => update('deliveryTime', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Delivery Type <span className="req">*</span></label>
                                    <select value={form.deliveryType} onChange={e => update('deliveryType', e.target.value)}>
                                        <option value="NSD">Normal Spontaneous Delivery (NSD)</option>
                                        <option value="CS">Cesarean Section (CS)</option>
                                        <option value="Breech">Breech Delivery</option>
                                        <option value="Assisted">Assisted Delivery</option>
                                    </select>
                                </div>
                                {form.deliveryType === 'CS' && (
                                    <div className="form-group">
                                        <label>CS Mode</label>
                                        <select value={form.deliveryMode} onChange={e => update('deliveryMode', e.target.value)}>
                                            <option value="">Select</option>
                                            <option>Elective CS</option>
                                            <option>Emergency CS</option>
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Attending Staff / Midwife <span className="req">*</span></label>
                                    <select value={form.staff} onChange={e => update('staff', e.target.value)}>
                                        {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Facility / Health Station</label>
                                    <select value={form.facility} onChange={e => update('facility', e.target.value)}>
                                        {FACILITIES.map(f => <option key={f}>{f}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* C. Complications */}
                    {section === 'complications' && (
                        <div className="modal-section-body">
                            <p className="section-hint">Select all complications that occurred during delivery. Select "None" if uncomplicated.</p>
                            <div className="complication-grid">
                                {COMPLICATION_OPTIONS.map(c => (
                                    <label key={c} className={`complication-chip ${form.complications.includes(c) ? 'selected' : ''}`}>
                                        <input type="checkbox" checked={form.complications.includes(c)} onChange={() => toggleComplication(c)} />
                                        {c}
                                    </label>
                                ))}
                            </div>
                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>Other Complications (specify)</label>
                                <input type="text" placeholder="Describe any other complications..." />
                            </div>
                        </div>
                    )}

                    {/* D. Baby Info */}
                    {section === 'baby' && (
                        <div className="modal-section-body">
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Baby Gender <span className="req">*</span></label>
                                    <select value={form.babyGender} onChange={e => update('babyGender', e.target.value)}>
                                        <option>Female</option>
                                        <option>Male</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Birth Weight (kg) <span className="req">*</span></label>
                                    <input type="number" step="0.1" placeholder="e.g. 3.2" value={form.babyWeight} onChange={e => update('babyWeight', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Apgar Score — 1 min</label>
                                    <input type="number" min="0" max="10" placeholder="0–10" value={form.apgar1} onChange={e => update('apgar1', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Apgar Score — 5 min</label>
                                    <input type="number" min="0" max="10" placeholder="0–10" value={form.apgar5} onChange={e => update('apgar5', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Baby Condition / Outcome <span className="req">*</span></label>
                                    <select value={form.babyCondition} onChange={e => update('babyCondition', e.target.value)}>
                                        <option>Healthy</option>
                                        <option>NICU</option>
                                        <option>Special Care</option>
                                        <option>Stillbirth</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* E. Postpartum Plan */}
                    {section === 'plan' && (
                        <div className="modal-section-body">
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>First Postpartum Visit Date</label>
                                    <input type="date" value={form.postpartumDate} onChange={e => update('postpartumDate', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Recovery Monitoring Notes</label>
                                    <input type="text" placeholder="Any notes for postpartum care..." value={form.notes} onChange={e => update('notes', e.target.value)} />
                                </div>
                            </div>
                            <div className="auto-links-box">
                                <h4><CheckCircle2 size={14} /> Auto-links on save:</h4>
                                <ul>
                                    <li><FileText size={13} /> Creates entry in Postpartum Records</li>
                                    <li><Baby size={13} /> Creates entry in Newborn Tracking</li>
                                    <li><AlertTriangle size={13} /> If High-Risk, adds to High-Risk Cases</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-outline" onClick={() => {
                        const idx = SECTIONS.findIndex(s => s.id === section);
                        if (idx > 0) setSection(SECTIONS[idx - 1].id);
                    }}>← Previous</button>
                    {section !== 'plan' ? (
                        <button className="btn btn-primary" onClick={() => {
                            const idx = SECTIONS.findIndex(s => s.id === section);
                            setSection(SECTIONS[idx + 1].id);
                        }}>Next →</button>
                    ) : (
                        <button className="btn btn-primary" onClick={onClose}><CheckCircle2 size={15} /> Save Delivery Record</button>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const DeliveryOutcomes = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ type: 'All', risk: 'All', complication: 'All', barangay: 'All' });
    const [showModal, setShowModal] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);
    const [sortField, setSortField] = useState('deliveryDate');
    const [sortAsc, setSortAsc] = useState(false);

    const handleFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    const handleSort = (field) => {
        if (sortField === field) setSortAsc(prev => !prev);
        else { setSortField(field); setSortAsc(false); }
    };

    const filtered = DELIVERIES
        .filter(d => {
            const s = searchTerm.toLowerCase();
            const matchSearch = d.patientName.toLowerCase().includes(s) || d.patientId.toLowerCase().includes(s) || d.barangay.toLowerCase().includes(s);
            const matchType = filters.type === 'All' || d.deliveryType === filters.type;
            const matchRisk = filters.risk === 'All' || d.riskLevel === filters.risk;
            const matchComp = filters.complication === 'All' || (filters.complication === 'None' ? d.complications === 'None' : d.complications !== 'None');
            const matchBrgy = filters.barangay === 'All' || d.barangay === filters.barangay;
            return matchSearch && matchType && matchRisk && matchComp && matchBrgy;
        })
        .sort((a, b) => {
            const va = a[sortField] ?? ''; const vb = b[sortField] ?? '';
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });

    const getRowClass = (d) => {
        if (d.riskLevel === 'High' || d.complications !== 'None') return 'do-row--complication';
        if (d.riskLevel === 'Monitor') return 'do-row--monitor';
        return 'do-row--normal';
    };

    const getRiskBadge = (r) => {
        if (r === 'High') return 'risk-high';
        if (r === 'Monitor') return 'risk-monitor';
        return 'risk-normal';
    };

    const getBabyBadge = (b) => {
        if (b === 'NICU' || b === 'Special Care') return 'baby-nicu';
        if (b === 'Stillbirth') return 'baby-stillbirth';
        return 'baby-alive';
    };

    const SortBtn = ({ field }) => (
        <button className="sort-btn" onClick={() => handleSort(field)}>
            {sortField === field ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="sort-inactive" />}
        </button>
    );

    const nsdCount = DELIVERIES.filter(d => d.deliveryType === 'NSD').length;
    const csCount = DELIVERIES.filter(d => d.deliveryType === 'CS').length;
    const total = DELIVERIES.length;
    const nsdPct = Math.round((nsdCount / total) * 100);
    const csPct = 100 - nsdPct;

    return (
        <div className="do-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Stethoscope size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Delivery Outcomes</h1>
                    <p className="page-subtitle">Record and monitor birth events — type, outcome, complications, and baby status</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline"><Download size={16} /> Export Report</button>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Record New Delivery</button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="do-stats-grid">
                {SUMMARY_STATS.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className={`do-stat-card do-stat--${s.color}`}>
                            <div className={`do-stat-icon do-icon--${s.color}`}><Icon size={20} /></div>
                            <div className="do-stat-value">{s.value}</div>
                            <div className="do-stat-label">{s.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── NSD vs CS Mini Chart ── */}
            <div className="do-chart-bar-wrap">
                <div className="do-chart-bar">
                    <div className="chart-label-row">
                        <span className="chart-label chart-label--nsd">NSD: {nsdCount} ({nsdPct}%)</span>
                        <span className="chart-label chart-label--cs">CS: {csCount} ({csPct}%)</span>
                    </div>
                    <div className="chart-bar-track">
                        <div className="chart-bar-nsd" style={{ width: `${nsdPct}%` }}></div>
                        <div className="chart-bar-cs" style={{ width: `${csPct}%` }}></div>
                    </div>
                    <p className="chart-caption">NSD vs CS this month — {total} total deliveries</p>
                </div>
            </div>

            {/* ── Search & Filters ── */}
            <div className="do-controls">
                <div className="do-search-wrap">
                    <Search size={16} className="do-search-icon" />
                    <input
                        type="text"
                        className="do-search-input"
                        placeholder="Search by mother name, patient ID, or barangay..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="do-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.type} onChange={e => handleFilter('type', e.target.value)}>
                        <option value="All">All Delivery Types</option>
                        <option value="NSD">NSD (Normal)</option>
                        <option value="CS">CS (Cesarean)</option>
                        <option value="Breech">Breech</option>
                    </select>
                    <select value={filters.risk} onChange={e => handleFilter('risk', e.target.value)}>
                        <option value="All">All Risk Levels</option>
                        <option value="Normal">Normal</option>
                        <option value="Monitor">Monitor</option>
                        <option value="High">High Risk</option>
                    </select>
                    <select value={filters.complication} onChange={e => handleFilter('complication', e.target.value)}>
                        <option value="All">All Complications</option>
                        <option value="None">No Complications</option>
                        <option value="HasComp">With Complications</option>
                    </select>
                    <select value={filters.barangay} onChange={e => handleFilter('barangay', e.target.value)}>
                        <option value="All">All Barangays</option>
                        {[1,2,3,4,5,6,7].map(n => <option key={n} value={`Brgy. ${n}`}>Brgy. {n}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Main Layout ── */}
            <div className="do-main-layout">

                {/* ── Deliveries Table ── */}
                <div className="do-table-col">
                    <div className="do-card">
                        <div className="do-card-head">
                            <h2><Baby size={17} /> Delivery Records</h2>
                            <div className="do-legend">
                                <span className="legend-chip chip-normal"><CheckCircle2 size={11} /> Normal</span>
                                <span className="legend-chip chip-monitor"><AlertTriangle size={11} /> Minor</span>
                                <span className="legend-chip chip-complication"><AlertCircle size={11} /> Complication</span>
                            </div>
                            <span className="do-count">{filtered.length} records</span>
                        </div>

                        <div className="table-responsive">
                            <table className="do-table">
                                <thead>
                                    <tr>
                                        <th><span className="sortable-head" onClick={() => handleSort('patientName')}>Patient <SortBtn field="patientName" /></span></th>
                                        <th><span className="sortable-head" onClick={() => handleSort('deliveryDate')}>Date <SortBtn field="deliveryDate" /></span></th>
                                        <th>Type</th>
                                        <th>Gest. Age</th>
                                        <th>Risk</th>
                                        <th>Complications</th>
                                        <th>Baby</th>
                                        <th>Weight</th>
                                        <th>Staff</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(d => (
                                        <React.Fragment key={d.id}>
                                            <tr className={`do-row ${getRowClass(d)}`}>
                                                <td>
                                                    <button className="expand-btn" onClick={() => setExpandedRow(expandedRow === d.id ? null : d.id)}>
                                                        {expandedRow === d.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                    </button>
                                                    <div className="do-patient">
                                                        <div className="do-avatar">{d.patientName.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
                                                        <div>
                                                            <span className="do-name">{d.patientName}</span>
                                                            <span className="do-pid">{d.patientId} · {d.barangay}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="do-date">{d.deliveryDate}</span>
                                                    <span className="do-time">{d.deliveryTime}</span>
                                                </td>
                                                <td>
                                                    <span className={`dt-badge dt-${d.deliveryType.toLowerCase()}`}>{d.deliveryType}</span>
                                                </td>
                                                <td className="do-ga">{d.gestationalAge}</td>
                                                <td>
                                                    <span className={`risk-badge ${getRiskBadge(d.riskLevel)}`}>{d.riskLevel}</span>
                                                </td>
                                                <td>
                                                    <span className={`comp-text ${d.complications !== 'None' ? 'has-comp' : ''}`}>
                                                        {d.complications !== 'None' && <AlertCircle size={12} />} {d.complications}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="baby-info">
                                                        <span className={`baby-badge ${getBabyBadge(d.babyOutcome)}`}>{d.babyOutcome}</span>
                                                        <span className="baby-gender">{d.babyGender}</span>
                                                    </div>
                                                </td>
                                                <td className="do-weight">{d.babyWeight}</td>
                                                <td className="do-staff">{d.staff}</td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="action-btn view-btn" title="View Details" onClick={() => setExpandedRow(expandedRow === d.id ? null : d.id)}><Eye size={13} /></button>
                                                        <button className="action-btn edit-btn" title="Edit"><Edit2 size={13} /></button>
                                                        <button className="action-btn pp-btn" title="Record Postpartum" onClick={() => navigate('/dashboard/postpartum')}><Heart size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded Row */}
                                            {expandedRow === d.id && (
                                                <tr className="do-expanded-row">
                                                    <td colSpan="10">
                                                        <div className="expand-detail">
                                                            <div className="expand-col">
                                                                <h4>🏥 Delivery</h4>
                                                                <p><strong>Type:</strong> {d.deliveryType}</p>
                                                                <p><strong>Facility:</strong> {d.facility}</p>
                                                                <p><strong>Staff:</strong> {d.staff}</p>
                                                                <p><strong>Complications:</strong> {d.complications}</p>
                                                            </div>
                                                            <div className="expand-col">
                                                                <h4>👶 Baby Details</h4>
                                                                <p><strong>Outcome:</strong> {d.babyOutcome}</p>
                                                                <p><strong>Gender:</strong> {d.babyGender}</p>
                                                                <p><strong>Weight:</strong> {d.babyWeight}</p>
                                                                <p><strong>Apgar:</strong> {d.apgar1} / {d.apgar5} (1 & 5 min)</p>
                                                                <p><strong>Condition:</strong> {d.babyCondition}</p>
                                                            </div>
                                                            <div className="expand-col">
                                                                <h4>📅 Plan</h4>
                                                                <p><strong>1st Postpartum:</strong> {d.postpartumDate}</p>
                                                                {d.notes && <p><strong>Notes:</strong> {d.notes}</p>}
                                                                <div className="expand-actions">
                                                                    <button className="btn btn-outline" onClick={() => navigate('/dashboard/postpartum')}>→ Postpartum Record</button>
                                                                    <button className="btn btn-outline" onClick={() => navigate('/dashboard/newborns')}>→ Newborn Tracking</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan="10" className="do-empty">
                                                <Baby size={28} />
                                                <p>No delivery records match your filters.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Alerts ── */}
                <div className="do-side-col">
                    <div className="do-card">
                        <div className="do-card-head">
                            <h2><AlertTriangle size={16} /> Delivery Alerts</h2>
                        </div>
                        <div className="alerts-list">
                            {ALERTS.map((a, i) => (
                                <div key={i} className={`alert-item alert-${a.type}`}>
                                    <div className="alert-dot"></div>
                                    <div className="alert-body">
                                        <p>{a.text}</p>
                                        <span>{a.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats sidebar */}
                    <div className="do-card">
                        <div className="do-card-head"><h2><TrendingUp size={16} /> This Month</h2></div>
                        <div className="quick-stats-list">
                            <div className="qs-row"><span>NSD Deliveries</span><strong className="qs-nsd">{nsdCount}</strong></div>
                            <div className="qs-row"><span>CS Deliveries</span><strong className="qs-cs">{csCount}</strong></div>
                            <div className="qs-row"><span>With Complications</span><strong className="qs-comp">{DELIVERIES.filter(d => d.complications !== 'None').length}</strong></div>
                            <div className="qs-row"><span>Babies in NICU</span><strong className="qs-nicu">{DELIVERIES.filter(d => d.babyOutcome === 'NICU').length}</strong></div>
                            <div className="qs-row"><span>High-Risk Mothers</span><strong className="qs-high">{DELIVERIES.filter(d => d.riskLevel === 'High').length}</strong></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Add Delivery Modal ── */}
            {showModal && <AddDeliveryModal onClose={() => setShowModal(false)} />}
        </div>
    );
};

export default DeliveryOutcomes;
