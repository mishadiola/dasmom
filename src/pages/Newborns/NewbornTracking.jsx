import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, Baby, Heart, AlertTriangle,
    CheckCircle2, Clock, XCircle, AlertCircle, Eye,
    Edit2, Syringe, Pill, Activity, Calendar, Download,
    TrendingUp, Scale, ChevronDown, ChevronUp, Ruler
} from 'lucide-react';
import '../../styles/pages/NewbornTracking.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const SUMMARY_STATS = [
    { label: 'Total Newborns This Month', value: 35, color: 'lilac', icon: Baby },
    { label: 'Low Birth Weight (<2.5kg)', value: 4, color: 'pink', icon: Scale },
    { label: 'High-Risk Newborns', value: 3, color: 'rose', icon: AlertCircle },
    { label: 'Vaccinations Due', value: 12, color: 'sage', icon: Syringe },
    { label: 'Missed Follow-ups', value: 2, color: 'orange', icon: XCircle },
];

const NEWBORNS = [];

const ALERTS = [];

/* ════════════════════════════
   DETAIL MODAL
════════════════════════════ */
const DetailModal = ({ baby, onClose }) => {
    const [tab, setTab] = useState('basic');

    const TABS = [
        { id: 'basic',   label: 'Basic Info',        icon: Baby },
        { id: 'growth',  label: 'Growth',             icon: TrendingUp },
        { id: 'vacc',    label: 'Vaccinations',       icon: Syringe },
        { id: 'supp',    label: 'Supplements',        icon: Pill },
        { id: 'checkup', label: 'Checkups',           icon: Activity },
        { id: 'alerts',  label: `Alerts (${baby.alerts.length})`, icon: AlertTriangle },
    ];

    const vaccStatusClass = (s) => {
        if (s === 'Completed') return 'status-completed';
        if (s === 'Overdue') return 'status-overdue';
        return 'status-pending';
    };

    const suppStatusClass = (s) => {
        if (s === 'Ongoing') return 'status-ongoing';
        if (s === 'Missed') return 'status-overdue';
        return 'status-completed';
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="nb-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <div>
                        <h2>{baby.babyName}</h2>
                        <p>Mother: {baby.motherName} · {baby.motherId} · {baby.barangay}</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                {/* Tab Nav */}
                <div className="nb-tab-nav">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} className={`nb-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                                <Icon size={13} /> {t.label}
                            </button>
                        );
                    })}
                </div>

                <div className="modal-body">

                    {/* TAB 1: Basic Info */}
                    {tab === 'basic' && (
                        <div className="detail-grid">
                            <div className="detail-item"><span>Baby Name / ID</span><strong>{baby.babyName}</strong></div>
                            <div className="detail-item"><span>Baby ID</span><strong>{baby.id}</strong></div>
                            <div className="detail-item"><span>Birth Date</span><strong>{baby.birthDate}</strong></div>
                            <div className="detail-item"><span>Gender</span><strong>{baby.gender}</strong></div>
                            <div className="detail-item"><span>Birth Weight</span><strong>{baby.birthWeight} kg</strong></div>
                            <div className="detail-item"><span>Length at Birth</span><strong>{baby.length} cm</strong></div>
                            <div className="detail-item"><span>Head Circumference</span><strong>{baby.headCirc} cm</strong></div>
                            <div className="detail-item"><span>Gestational Age</span><strong>{baby.gestationalAge}</strong></div>
                            <div className="detail-item"><span>Delivery Type</span><strong>{baby.deliveryType}</strong></div>
                            <div className="detail-item"><span>Condition at Birth</span><strong>{baby.condition}</strong></div>
                            <div className="detail-item"><span>Mother</span><strong>{baby.motherName} ({baby.motherId})</strong></div>
                            <div className="detail-item"><span>Risk Level</span>
                                <strong><span className={`risk-badge risk-${baby.riskLevel.toLowerCase()}`}>{baby.riskLevel}</span></strong>
                            </div>
                            {baby.notes && <div className="detail-item full-width"><span>Notes</span><strong>{baby.notes}</strong></div>}
                        </div>
                    )}

                    {/* TAB 2: Growth */}
                    {tab === 'growth' && (
                        <div>
                            <p className="tab-hint">Growth measurements recorded at each checkup.</p>
                            <table className="nb-inner-table">
                                <thead>
                                    <tr><th>Date</th><th>Weight (kg)</th><th>Length (cm)</th><th>Head Circ. (cm)</th></tr>
                                </thead>
                                <tbody>
                                    {baby.growthLog.map((g, i) => (
                                        <tr key={i}>
                                            <td className="col-date">{g.date}</td>
                                            <td className="col-val">{g.weight}</td>
                                            <td className="col-val">{g.length}</td>
                                            <td className="col-val">{g.headCirc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Visual growth indicator */}
                            <div className="growth-bars">
                                {baby.growthLog.map((g, i) => (
                                    <div key={i} className="growth-bar-group">
                                        <div className="growth-bar-label">{g.date}</div>
                                        <div className="growth-bar-track">
                                            <div className="growth-bar-fill" style={{ width: `${Math.min(100, (g.weight / 5) * 100)}%` }}></div>
                                        </div>
                                        <span className="growth-bar-val">{g.weight}kg</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: Vaccinations */}
                    {tab === 'vacc' && (
                        <div>
                            <p className="tab-hint">Vaccination schedule for this newborn.</p>
                            <table className="nb-inner-table">
                                <thead>
                                    <tr><th>Vaccine</th><th>Dose</th><th>Date Given</th><th>Next Due</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {baby.vaccLog.map((v, i) => (
                                        <tr key={i}>
                                            <td className="col-name">{v.vaccine}</td>
                                            <td>{v.dose}</td>
                                            <td className="col-date">{v.date || <span className="not-yet">Not given</span>}</td>
                                            <td className="col-date">{v.nextDue || <span className="not-yet">—</span>}</td>
                                            <td><span className={`vacc-status ${vaccStatusClass(v.status)}`}>{v.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="tab-action">
                                <button className="btn btn-primary"><Syringe size={14} /> Record Vaccination</button>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: Supplements */}
                    {tab === 'supp' && (
                        <div>
                            <p className="tab-hint">Supplement distribution for this newborn.</p>
                            <table className="nb-inner-table">
                                <thead>
                                    <tr><th>Supplement</th><th>Dose</th><th>Start Date</th><th>End Date</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {baby.suppLog.map((s, i) => (
                                        <tr key={i}>
                                            <td className="col-name">{s.supp}</td>
                                            <td>{s.dose}</td>
                                            <td className="col-date">{s.start}</td>
                                            <td className="col-date">{s.end}</td>
                                            <td><span className={`vacc-status ${suppStatusClass(s.status)}`}>{s.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="tab-action">
                                <button className="btn btn-primary"><Pill size={14} /> Record Supplement</button>
                            </div>
                        </div>
                    )}

                    {/* TAB 5: Checkups */}
                    {tab === 'checkup' && (
                        <div>
                            <p className="tab-hint">All recorded neonatal checkups and visits.</p>
                            {baby.checkupLog.length > 0 ? (
                                <div className="checkup-list">
                                    {baby.checkupLog.map((c, i) => (
                                        <div key={i} className="checkup-card">
                                            <div className="checkup-date">{c.date}</div>
                                            <div className="checkup-body">
                                                <p className="checkup-vitals">{c.vitals}</p>
                                                <p className="checkup-staff">By {c.staff}</p>
                                                {c.notes && <p className="checkup-notes">{c.notes}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="nb-empty"><Activity size={22} /><p>No checkup records yet.</p></div>
                            )}
                            <div className="tab-action">
                                <button className="btn btn-primary"><Plus size={14} /> Record Checkup</button>
                                <button className="btn btn-outline"><Calendar size={14} /> Schedule Next Visit</button>
                            </div>
                        </div>
                    )}

                    {/* TAB 6: Alerts */}
                    {tab === 'alerts' && (
                        <div>
                            {baby.alerts.length > 0 ? (
                                <div className="nb-alerts-list">
                                    {baby.alerts.map((a, i) => (
                                        <div key={i} className="nb-alert-item">
                                            <AlertCircle size={15} className="nb-alert-icon" />
                                            <span>{a}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="nb-empty nb-empty--ok">
                                    <CheckCircle2 size={24} />
                                    <p>No alerts — this newborn is healthy and on schedule.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                    <button className="btn btn-outline"><Calendar size={14} /> Schedule Visit</button>
                    <button className="btn btn-primary"><Activity size={14} /> Record Vitals</button>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const NewbornTracking = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ risk: 'All', vacc: 'All', weight: 'All', barangay: 'All' });
    const [selectedBaby, setSelectedBaby] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);

    const handleFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    const filtered = NEWBORNS.filter(b => {
        const s = searchTerm.toLowerCase();
        const matchSearch = b.babyName.toLowerCase().includes(s) || b.motherName.toLowerCase().includes(s) || b.id.toLowerCase().includes(s) || b.barangay.toLowerCase().includes(s);
        const matchRisk = filters.risk === 'All' || b.riskLevel === filters.risk;
        const matchVacc = filters.vacc === 'All' || b.vaccStatus === filters.vacc;
        const matchWeight = filters.weight === 'All' ||
            (filters.weight === 'Low' && b.birthWeight < 2.5) ||
            (filters.weight === 'Normal' && b.birthWeight >= 2.5 && b.birthWeight < 4) ||
            (filters.weight === 'High' && b.birthWeight >= 4);
        const matchBrgy = filters.barangay === 'All' || b.barangay === filters.barangay;
        return matchSearch && matchRisk && matchVacc && matchWeight && matchBrgy;
    });

    const getRowClass = (b) => {
        if (b.riskLevel === 'High') return 'nb-row--high';
        if (b.riskLevel === 'Monitor') return 'nb-row--monitor';
        return 'nb-row--normal';
    };

    const getRiskBadge = (r) => {
        if (r === 'High') return 'risk-high';
        if (r === 'Monitor') return 'risk-monitor';
        return 'risk-normal';
    };

    const getVaccBadge = (s) => {
        if (s === 'Completed') return 'status-completed';
        if (s === 'Overdue') return 'status-overdue';
        return 'status-pending';
    };

    const getSuppBadge = (s) => {
        if (s === 'Ongoing') return 'status-ongoing';
        if (s === 'Missed') return 'status-overdue';
        return 'status-completed';
    };

    return (
        <div className="nb-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Heart size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Newborn Tracking</h1>
                    <p className="page-subtitle">Monitor newborn health, growth, vaccinations, and follow-up schedules</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline"><Download size={16} /> Export Report</button>
                    <button className="btn btn-primary"><Plus size={16} /> Add Newborn Record</button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="nb-stats-grid">
                {SUMMARY_STATS.map(s => {
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
            <div className="nb-controls">
                <div className="nb-search-wrap">
                    <Search size={16} className="nb-search-icon" />
                    <input
                        type="text"
                        className="nb-search-input"
                        placeholder="Search by baby name, mother name, ID, or barangay..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="nb-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.risk} onChange={e => handleFilter('risk', e.target.value)}>
                        <option value="All">All Risk Levels</option>
                        <option value="Normal">Normal</option>
                        <option value="Monitor">Monitor</option>
                        <option value="High">High Risk</option>
                    </select>
                    <select value={filters.weight} onChange={e => handleFilter('weight', e.target.value)}>
                        <option value="All">All Birth Weights</option>
                        <option value="Low">Low (&lt;2.5kg)</option>
                        <option value="Normal">Normal (2.5–4kg)</option>
                        <option value="High">High (&gt;4kg)</option>
                    </select>
                    <select value={filters.vacc} onChange={e => handleFilter('vacc', e.target.value)}>
                        <option value="All">All Vaccine Status</option>
                        <option value="Completed">Completed</option>
                        <option value="Pending">Pending</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                    <select value={filters.barangay} onChange={e => handleFilter('barangay', e.target.value)}>
                        <option value="All">All Barangays</option>
                        {[1,2,3,4,5,6,7].map(n => <option key={n} value={`Brgy. ${n}`}>Brgy. {n}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Main Layout ── */}
            <div className="nb-main-layout">

                {/* ── Newborn Table ── */}
                <div className="nb-table-col">
                    <div className="nb-card">
                        <div className="nb-card-head">
                            <h2><Baby size={17} /> Newborn Records</h2>
                            <div className="nb-legend">
                                <span className="legend-chip chip-normal"><CheckCircle2 size={11} /> Normal</span>
                                <span className="legend-chip chip-monitor"><AlertTriangle size={11} /> Monitor</span>
                                <span className="legend-chip chip-high"><AlertCircle size={11} /> High Risk</span>
                            </div>
                            <span className="nb-count">{filtered.length} records</span>
                        </div>

                        <div className="table-responsive">
                            <table className="nb-table">
                                <thead>
                                    <tr>
                                        <th>Baby</th>
                                        <th>Mother</th>
                                        <th>Birth Date</th>
                                        <th>Gender</th>
                                        <th>Weight</th>
                                        <th>Gest. Age</th>
                                        <th>Risk</th>
                                        <th>Vaccines</th>
                                        <th>Supplements</th>
                                        <th>Next Appt.</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(b => (
                                        <React.Fragment key={b.id}>
                                            <tr className={`nb-row ${getRowClass(b)}`}>
                                                <td>
                                                    <button className="expand-btn" onClick={() => setExpandedRow(expandedRow === b.id ? null : b.id)}>
                                                        {expandedRow === b.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </button>
                                                    <div className="nb-baby-cell">
                                                        <div className={`nb-avatar nb-avatar--${b.gender.toLowerCase()}`}>
                                                            {b.gender === 'Female' ? '♀' : '♂'}
                                                        </div>
                                                        <div>
                                                            <span className="nb-baby-name">{b.babyName}</span>
                                                            <span className="nb-baby-id">{b.id}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="nb-mother-name">{b.motherName}</span>
                                                    <span className="nb-mother-id">{b.motherId} · {b.barangay}</span>
                                                </td>
                                                <td className="nb-date">{b.birthDate}</td>
                                                <td>
                                                    <span className={`gender-badge gender-${b.gender.toLowerCase()}`}>{b.gender}</span>
                                                </td>
                                                <td>
                                                    <span className={`weight-val ${b.birthWeight < 2.5 ? 'weight-low' : ''}`}>{b.birthWeight} kg</span>
                                                    {b.birthWeight < 2.5 && <span className="lbw-flag">LBW</span>}
                                                </td>
                                                <td className="nb-ga">{b.gestationalAge}</td>
                                                <td>
                                                    <span className={`risk-badge ${getRiskBadge(b.riskLevel)}`}>{b.riskLevel}</span>
                                                </td>
                                                <td>
                                                    <span className={`vacc-status ${getVaccBadge(b.vaccStatus)}`}>{b.vaccStatus}</span>
                                                </td>
                                                <td>
                                                    <span className={`vacc-status ${getSuppBadge(b.suppStatus)}`}>{b.suppStatus}</span>
                                                </td>
                                                <td>
                                                    <span className="nb-date">{b.nextAppt}</span>
                                                </td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="action-btn view-btn" title="View Full Profile" onClick={() => setSelectedBaby(b)}><Eye size={13} /></button>
                                                        <button className="action-btn vacc-btn" title="Record Vaccination" onClick={() => navigate('/dashboard/vaccinations')}><Syringe size={13} /></button>
                                                        <button className="action-btn vitals-btn" title="Record Vitals"><Activity size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded quick-view */}
                                            {expandedRow === b.id && (
                                                <tr className="nb-expanded-row">
                                                    <td colSpan="11">
                                                        <div className="expand-detail">
                                                            <div className="expand-col">
                                                                <h4>📐 Growth</h4>
                                                                <p><strong>Birth Weight:</strong> {b.birthWeight} kg</p>
                                                                <p><strong>Length:</strong> {b.length} cm</p>
                                                                <p><strong>Head Circ.:</strong> {b.headCirc} cm</p>
                                                            </div>
                                                            <div className="expand-col">
                                                                <h4>💉 Vaccines</h4>
                                                                {b.vaccLog.map((v, i) => (
                                                                    <p key={i}><strong>{v.vaccine}:</strong> {v.status}</p>
                                                                ))}
                                                            </div>
                                                            <div className="expand-col">
                                                                <h4>💊 Supplements</h4>
                                                                {b.suppLog.map((s, i) => (
                                                                    <p key={i}><strong>{s.supp}:</strong> {s.status}</p>
                                                                ))}
                                                            </div>
                                                            <div className="expand-col">
                                                                <h4>⚠ Alerts</h4>
                                                                {b.alerts.length > 0 ? b.alerts.map((a, i) => (
                                                                    <p key={i} className="expand-alert">{a}</p>
                                                                )) : <p>No alerts.</p>}
                                                                <div className="expand-actions">
                                                                    <button className="btn btn-outline" onClick={() => setSelectedBaby(b)}>Full Profile →</button>
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
                                            <td colSpan="11" className="nb-empty">
                                                <Baby size={28} />
                                                <p>No newborn records match your filters.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ── Side Alerts ── */}
                <div className="nb-side-col">
                    <div className="nb-card">
                        <div className="nb-card-head">
                            <h2><AlertTriangle size={16} /> Alerts</h2>
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

                    {/* Quick Stats */}
                    <div className="nb-card">
                        <div className="nb-card-head"><h2><TrendingUp size={16} /> Quick Stats</h2></div>
                        <div className="quick-stats-list">
                            <div className="qs-row"><span>Female Newborns</span><strong className="qs-female">{NEWBORNS.filter(b => b.gender === 'Female').length}</strong></div>
                            <div className="qs-row"><span>Male Newborns</span><strong className="qs-male">{NEWBORNS.filter(b => b.gender === 'Male').length}</strong></div>
                            <div className="qs-row"><span>NSD Deliveries</span><strong className="qs-nsd">{NEWBORNS.filter(b => b.deliveryType === 'NSD').length}</strong></div>
                            <div className="qs-row"><span>CS Deliveries</span><strong className="qs-cs">{NEWBORNS.filter(b => b.deliveryType === 'CS').length}</strong></div>
                            <div className="qs-row"><span>Low Birth Weight</span><strong className="qs-lbw">{NEWBORNS.filter(b => b.birthWeight < 2.5).length}</strong></div>
                            <div className="qs-row"><span>In NICU</span><strong className="qs-nicu">{NEWBORNS.filter(b => b.condition === 'NICU').length}</strong></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Detail Modal ── */}
            {selectedBaby && <DetailModal baby={selectedBaby} onClose={() => setSelectedBaby(null)} />}
        </div>
    );
};

export default NewbornTracking;
