import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, MapPin, Users, AlertTriangle,
    Baby, Syringe, Pill, TrendingUp, TrendingDown, Download,
    Eye, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
    FileText, Activity, Heart
} from 'lucide-react';
import '../../styles/pages/BarangayReports.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const SUMMARY_STATS = [
    { label: 'Total Pregnant Patients', value: 340, color: 'sage', icon: Users },
    { label: 'High-Risk Pregnancies', value: 43, color: 'rose', icon: AlertTriangle },
    { label: 'Total Deliveries (Month)', value: 58, color: 'orange', icon: Heart },
    { label: 'Vaccination Coverage', value: '86%', color: 'lilac', icon: Syringe },
    { label: 'Supplements Distributed', value: '1,500', color: 'pink', icon: Pill },
];

const BARANGAYS = [
    {
        id: 'brgy-1',
        name: 'Brgy. 1 – Poblacion Norte',
        totalPatients: 52, highRisk: 8, recentDeliveries: 10,
        vaccCoverage: 90, newborns: 10, suppCoverage: 92,
        riskStatus: 'Normal',
        alerts: [],
        trimester: { first: 18, second: 22, third: 12 },
        deliveryTypes: { nsd: 7, cs: 3 },
        complications: 1, lbwBabies: 0, nicuBabies: 0,
        maternalVaccCoverage: 92, newbornVaccCoverage: 88,
    },
    {
        id: 'brgy-2',
        name: 'Brgy. 2 – Barangay Uno',
        totalPatients: 45, highRisk: 5, recentDeliveries: 7,
        vaccCoverage: 78, newborns: 7, suppCoverage: 80,
        riskStatus: 'Monitor',
        alerts: ['Low vaccination coverage (78%)'],
        trimester: { first: 14, second: 20, third: 11 },
        deliveryTypes: { nsd: 5, cs: 2 },
        complications: 0, lbwBabies: 1, nicuBabies: 0,
        maternalVaccCoverage: 80, newbornVaccCoverage: 75,
    },
    {
        id: 'brgy-3',
        name: 'Brgy. 3 – San Jose',
        totalPatients: 61, highRisk: 12, recentDeliveries: 11,
        vaccCoverage: 82, newborns: 11, suppCoverage: 85,
        riskStatus: 'Monitor',
        alerts: ['3 missed follow-up visits this month'],
        trimester: { first: 20, second: 28, third: 13 },
        deliveryTypes: { nsd: 8, cs: 3 },
        complications: 2, lbwBabies: 1, nicuBabies: 1,
        maternalVaccCoverage: 84, newbornVaccCoverage: 79,
    },
    {
        id: 'brgy-4',
        name: 'Brgy. 4 – Aplaya',
        totalPatients: 38, highRisk: 3, recentDeliveries: 6,
        vaccCoverage: 94, newborns: 6, suppCoverage: 96,
        riskStatus: 'Normal',
        alerts: [],
        trimester: { first: 12, second: 16, third: 10 },
        deliveryTypes: { nsd: 5, cs: 1 },
        complications: 0, lbwBabies: 0, nicuBabies: 0,
        maternalVaccCoverage: 96, newbornVaccCoverage: 92,
    },
    {
        id: 'brgy-5',
        name: 'Brgy. 5 – Sala',
        totalPatients: 44, highRisk: 6, recentDeliveries: 8,
        vaccCoverage: 70, newborns: 8, suppCoverage: 68,
        riskStatus: 'Critical',
        alerts: ['Vaccination coverage critically low (70%)', 'Supplement coverage below 70%'],
        trimester: { first: 15, second: 18, third: 11 },
        deliveryTypes: { nsd: 6, cs: 2 },
        complications: 2, lbwBabies: 2, nicuBabies: 1,
        maternalVaccCoverage: 72, newbornVaccCoverage: 67,
    },
    {
        id: 'brgy-6',
        name: 'Brgy. 6 – Bagong Nayon',
        totalPatients: 55, highRisk: 5, recentDeliveries: 9,
        vaccCoverage: 88, newborns: 9, suppCoverage: 90,
        riskStatus: 'Normal',
        alerts: [],
        trimester: { first: 19, second: 24, third: 12 },
        deliveryTypes: { nsd: 7, cs: 2 },
        complications: 1, lbwBabies: 0, nicuBabies: 0,
        maternalVaccCoverage: 90, newbornVaccCoverage: 86,
    },
    {
        id: 'brgy-7',
        name: 'Brgy. 7 – Mapalad',
        totalPatients: 45, highRisk: 4, recentDeliveries: 7,
        vaccCoverage: 86, newborns: 7, suppCoverage: 88,
        riskStatus: 'Normal',
        alerts: [],
        trimester: { first: 15, second: 20, third: 10 },
        deliveryTypes: { nsd: 5, cs: 2 },
        complications: 0, lbwBabies: 1, nicuBabies: 0,
        maternalVaccCoverage: 88, newbornVaccCoverage: 84,
    },
];

/* simple inline bar chart component */
const MiniBar = ({ value, max = 100, color = '#a0c282' }) => {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (
        <div className="mini-bar-wrap">
            <div className="mini-bar-track">
                <div className="mini-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="mini-bar-label">{typeof value === 'number' && value <= 100 ? `${value}%` : value}</span>
        </div>
    );
};

/* simple inline horizontal stacked bar */
const TriBar = ({ b }) => {
    const total = b.trimester.first + b.trimester.second + b.trimester.third;
    const p1 = Math.round((b.trimester.first / total) * 100);
    const p2 = Math.round((b.trimester.second / total) * 100);
    const p3 = 100 - p1 - p2;
    return (
        <div className="tri-bar">
            <div className="tri-seg tri-1" style={{ width: `${p1}%` }} title={`1st: ${b.trimester.first}`} />
            <div className="tri-seg tri-2" style={{ width: `${p2}%` }} title={`2nd: ${b.trimester.second}`} />
            <div className="tri-seg tri-3" style={{ width: `${p3}%` }} title={`3rd: ${b.trimester.third}`} />
        </div>
    );
};

/* ════════════════════════════
   DETAIL MODAL
════════════════════════════ */
const DetailModal = ({ brgy, onClose, navigate }) => {
    const [tab, setTab] = useState('overview');

    const TABS = [
        { id: 'overview',   label: 'Patients Overview', icon: Users },
        { id: 'deliveries', label: 'Delivery Summary',  icon: Heart },
        { id: 'vacc',       label: 'Vaccinations',      icon: Syringe },
        { id: 'newborns',   label: 'Newborn Status',    icon: Baby },
        { id: 'alerts',     label: `Alerts (${brgy.alerts.length})`, icon: AlertTriangle },
    ];

    const coverageColor = (v) => v >= 90 ? '#a0c282' : v >= 80 ? '#edbd9a' : '#b68191';

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="br-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2><MapPin size={16} /> {brgy.name}</h2>
                        <p>{brgy.totalPatients} patients tracked · {brgy.recentDeliveries} deliveries this month</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="br-tab-nav">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} className={`br-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                                <Icon size={13} /> {t.label}
                            </button>
                        );
                    })}
                </div>

                <div className="modal-body">

                    {/* TAB: Patients Overview */}
                    {tab === 'overview' && (
                        <div>
                            <div className="detail-stats-grid">
                                <div className="detail-stat"><span>Total Patients</span><strong>{brgy.totalPatients}</strong></div>
                                <div className="detail-stat detail-stat--rose"><span>High-Risk</span><strong>{brgy.highRisk}</strong></div>
                                <div className="detail-stat detail-stat--blue"><span>1st Trimester</span><strong>{brgy.trimester.first}</strong></div>
                                <div className="detail-stat detail-stat--yellow"><span>2nd Trimester</span><strong>{brgy.trimester.second}</strong></div>
                                <div className="detail-stat detail-stat--purple"><span>3rd Trimester</span><strong>{brgy.trimester.third}</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>Trimester Distribution</h4>
                                <div className="tri-bar-large">
                                    <div className="tri-seg tri-1" style={{ flex: brgy.trimester.first }}>
                                        <span>1st: {brgy.trimester.first}</span>
                                    </div>
                                    <div className="tri-seg tri-2" style={{ flex: brgy.trimester.second }}>
                                        <span>2nd: {brgy.trimester.second}</span>
                                    </div>
                                    <div className="tri-seg tri-3" style={{ flex: brgy.trimester.third }}>
                                        <span>3rd: {brgy.trimester.third}</span>
                                    </div>
                                </div>
                                <div className="tri-legend">
                                    <span className="tri-dot tri-dot--1" />1st Trimester
                                    <span className="tri-dot tri-dot--2" />2nd Trimester
                                    <span className="tri-dot tri-dot--3" />3rd Trimester
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: Delivery Summary */}
                    {tab === 'deliveries' && (
                        <div>
                            <div className="detail-stats-grid">
                                <div className="detail-stat detail-stat--green"><span>Total Deliveries</span><strong>{brgy.recentDeliveries}</strong></div>
                                <div className="detail-stat"><span>NSD</span><strong>{brgy.deliveryTypes.nsd}</strong></div>
                                <div className="detail-stat detail-stat--purple"><span>CS</span><strong>{brgy.deliveryTypes.cs}</strong></div>
                                <div className="detail-stat detail-stat--rose"><span>With Complications</span><strong>{brgy.complications}</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>NSD vs CS Breakdown</h4>
                                <div className="do-bar-row">
                                    <label>NSD ({brgy.deliveryTypes.nsd})</label>
                                    <div className="do-bar-track">
                                        <div className="do-bar-nsd" style={{ width: `${Math.round((brgy.deliveryTypes.nsd / brgy.recentDeliveries) * 100)}%` }} />
                                    </div>
                                    <span>{Math.round((brgy.deliveryTypes.nsd / brgy.recentDeliveries) * 100)}%</span>
                                </div>
                                <div className="do-bar-row">
                                    <label>CS ({brgy.deliveryTypes.cs})</label>
                                    <div className="do-bar-track">
                                        <div className="do-bar-cs" style={{ width: `${Math.round((brgy.deliveryTypes.cs / brgy.recentDeliveries) * 100)}%` }} />
                                    </div>
                                    <span>{Math.round((brgy.deliveryTypes.cs / brgy.recentDeliveries) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: Vaccinations */}
                    {tab === 'vacc' && (
                        <div>
                            <div className="detail-stats-grid">
                                <div className="detail-stat"><span>Overall Coverage</span><strong>{brgy.vaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Maternal Vaccines</span><strong>{brgy.maternalVaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Newborn Vaccines</span><strong>{brgy.newbornVaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Supplement Coverage</span><strong>{brgy.suppCoverage}%</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>Coverage Breakdown</h4>
                                {[
                                    { label: 'Overall Vaccination', value: brgy.vaccCoverage },
                                    { label: 'Maternal Vaccines', value: brgy.maternalVaccCoverage },
                                    { label: 'Newborn Vaccines', value: brgy.newbornVaccCoverage },
                                    { label: 'Supplement Coverage', value: brgy.suppCoverage },
                                ].map(item => (
                                    <div key={item.label} className="cov-bar-row">
                                        <label>{item.label}</label>
                                        <div className="cov-bar-track">
                                            <div className="cov-bar-fill" style={{
                                                width: `${item.value}%`,
                                                background: coverageColor(item.value)
                                            }} />
                                        </div>
                                        <span className="cov-pct" style={{ color: coverageColor(item.value) }}>{item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB: Newborn Status */}
                    {tab === 'newborns' && (
                        <div>
                            <div className="detail-stats-grid">
                                <div className="detail-stat detail-stat--blue"><span>Newborns Tracked</span><strong>{brgy.newborns}</strong></div>
                                <div className="detail-stat detail-stat--orange"><span>Low Birth Weight</span><strong>{brgy.lbwBabies}</strong></div>
                                <div className="detail-stat detail-stat--rose"><span>NICU Admissions</span><strong>{brgy.nicuBabies}</strong></div>
                                <div className="detail-stat detail-stat--green"><span>Healthy Newborns</span><strong>{brgy.newborns - brgy.lbwBabies - brgy.nicuBabies}</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>Newborn Condition Distribution</h4>
                                <div className="nb-status-bars">
                                    {[
                                        { label: 'Healthy', count: brgy.newborns - brgy.lbwBabies - brgy.nicuBabies, total: brgy.newborns, color: '#a0c282' },
                                        { label: 'Low Birth Weight', count: brgy.lbwBabies, total: brgy.newborns, color: '#edbd9a' },
                                        { label: 'NICU', count: brgy.nicuBabies, total: brgy.newborns, color: '#b68191' },
                                    ].map(item => (
                                        <div key={item.label} className="nb-status-bar-row">
                                            <label>{item.label} ({item.count})</label>
                                            <div className="nb-bar-track">
                                                <div className="nb-bar-fill" style={{
                                                    width: brgy.newborns > 0 ? `${Math.round((item.count / brgy.newborns) * 100)}%` : '0%',
                                                    background: item.color
                                                }} />
                                            </div>
                                            <span>{brgy.newborns > 0 ? Math.round((item.count / brgy.newborns) * 100) : 0}%</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="tab-action">
                                    <button className="btn btn-outline" onClick={() => { navigate('/dashboard/newborns'); onClose(); }}>→ View Newborn Records</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: Alerts */}
                    {tab === 'alerts' && (
                        <div>
                            {brgy.alerts.length > 0 ? (
                                <div className="br-alerts-list">
                                    {brgy.alerts.map((a, i) => (
                                        <div key={i} className="br-alert-item">
                                            <AlertCircle size={15} />
                                            <span>{a}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="br-empty br-empty--ok">
                                    <CheckCircle2 size={28} />
                                    <p>No alerts — this barangay is performing well across all indicators.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                    <button className="btn btn-outline"><Download size={14} /> Export PDF</button>
                    <button className="btn btn-primary"><FileText size={14} /> Generate Full Report</button>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   CHARTS SECTION
════════════════════════════ */
const ChartsSection = ({ barangays }) => {
    const coverageColor = (v) => v >= 90 ? '#a0c282' : v >= 80 ? '#edbd9a' : '#b68191';
    const maxPatients = Math.max(...barangays.map(b => b.totalPatients));
    const maxHighRisk = Math.max(...barangays.map(b => b.highRisk));

    return (
        <div className="charts-grid">
            {/* Chart 1: Vaccination Coverage by Barangay */}
            <div className="chart-card">
                <h3 className="chart-title"><Syringe size={15} /> Vaccination Coverage by Barangay</h3>
                <div className="bar-chart-v">
                    {barangays.map(b => (
                        <div key={b.id} className="bar-chart-col">
                            <div className="bar-chart-bar-wrap">
                                <div
                                    className="bar-chart-bar"
                                    style={{
                                        height: `${b.vaccCoverage}%`,
                                        background: coverageColor(b.vaccCoverage)
                                    }}
                                    title={`${b.name}: ${b.vaccCoverage}%`}
                                />
                            </div>
                            <span className="bar-chart-val">{b.vaccCoverage}%</span>
                            <span className="bar-chart-label">{b.name.split('–')[0].trim()}</span>
                        </div>
                    ))}
                </div>
                <div className="chart-legend">
                    <span className="cleg cleg--green">≥90% Target met</span>
                    <span className="cleg cleg--yellow">80–89% Low</span>
                    <span className="cleg cleg--red">&lt;80% Critical</span>
                </div>
            </div>

            {/* Chart 2: High-Risk Cases by Barangay */}
            <div className="chart-card">
                <h3 className="chart-title"><AlertTriangle size={15} /> High-Risk Cases by Barangay</h3>
                <div className="horiz-bar-chart">
                    {barangays.map(b => (
                        <div key={b.id} className="horiz-bar-row">
                            <span className="horiz-label">{b.name.split('–')[0].trim()}</span>
                            <div className="horiz-track">
                                <div
                                    className="horiz-fill"
                                    style={{
                                        width: `${Math.round((b.highRisk / maxHighRisk) * 100)}%`,
                                        background: b.highRisk >= 10 ? '#b68191' : b.highRisk >= 6 ? '#edbd9a' : '#a0c282'
                                    }}
                                />
                            </div>
                            <span className="horiz-val">{b.highRisk}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chart 3: Total Patients by Barangay */}
            <div className="chart-card">
                <h3 className="chart-title"><Users size={15} /> Total Patients by Barangay</h3>
                <div className="horiz-bar-chart">
                    {barangays.map(b => (
                        <div key={b.id} className="horiz-bar-row">
                            <span className="horiz-label">{b.name.split('–')[0].trim()}</span>
                            <div className="horiz-track">
                                <div
                                    className="horiz-fill"
                                    style={{
                                        width: `${Math.round((b.totalPatients / maxPatients) * 100)}%`,
                                        background: '#ac97b4'
                                    }}
                                />
                            </div>
                            <span className="horiz-val">{b.totalPatients}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chart 4: Supplement Coverage */}
            <div className="chart-card">
                <h3 className="chart-title"><Pill size={15} /> Supplement Coverage by Barangay</h3>
                <div className="bar-chart-v">
                    {barangays.map(b => (
                        <div key={b.id} className="bar-chart-col">
                            <div className="bar-chart-bar-wrap">
                                <div
                                    className="bar-chart-bar"
                                    style={{
                                        height: `${b.suppCoverage}%`,
                                        background: coverageColor(b.suppCoverage)
                                    }}
                                    title={`${b.name}: ${b.suppCoverage}%`}
                                />
                            </div>
                            <span className="bar-chart-val">{b.suppCoverage}%</span>
                            <span className="bar-chart-label">{b.name.split('–')[0].trim()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const BarangayReports = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ risk: 'All', vacc: 'All' });
    const [selectedBrgy, setSelectedBrgy] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [showCharts, setShowCharts] = useState(true);

    const handleFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    const filtered = BARANGAYS.filter(b => {
        const s = searchTerm.toLowerCase();
        const matchSearch = b.name.toLowerCase().includes(s);
        const matchRisk = filters.risk === 'All' || b.riskStatus === filters.risk;
        const matchVacc = filters.vacc === 'All' ||
            (filters.vacc === 'High' && b.vaccCoverage >= 90) ||
            (filters.vacc === 'Low' && b.vaccCoverage < 90);
        return matchSearch && matchRisk && matchVacc;
    });

    const getRiskClass = (r) => {
        if (r === 'Critical') return 'br-row--critical';
        if (r === 'Monitor') return 'br-row--monitor';
        return 'br-row--normal';
    };

    const getRiskBadge = (r) => {
        if (r === 'Critical') return 'badge-critical';
        if (r === 'Monitor') return 'badge-monitor';
        return 'badge-normal';
    };

    const coverageColor = (v) => v >= 90 ? '#80a06c' : v >= 80 ? '#b08d70' : '#926674';
    const coverageBg = (v) => v >= 90 ? 'rgba(160,194,130,0.12)' : v >= 80 ? 'rgba(237,189,154,0.12)' : 'rgba(182,129,145,0.12)';

    return (
        <div className="br-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><MapPin size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Barangay Reports</h1>
                    <p className="page-subtitle">Community-level health monitoring — patient coverage, risk distribution, and vaccination rates</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={() => setShowCharts(v => !v)}>
                        <Activity size={16} /> {showCharts ? 'Hide Charts' : 'Show Charts'}
                    </button>
                    <button className="btn btn-outline"><Download size={16} /> Export All</button>
                    <button className="btn btn-primary"><FileText size={16} /> Generate Report</button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="br-stats-grid">
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

            {/* ── Chartsection ── */}
            {showCharts && <ChartsSection barangays={BARANGAYS} />}

            {/* ── Search & Filters ── */}
            <div className="br-controls">
                <div className="br-search-wrap">
                    <Search size={16} className="br-search-icon" />
                    <input
                        type="text"
                        className="br-search-input"
                        placeholder="Search barangay name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="br-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.risk} onChange={e => handleFilter('risk', e.target.value)}>
                        <option value="All">All Risk Levels</option>
                        <option value="Normal">Normal</option>
                        <option value="Monitor">Monitor</option>
                        <option value="Critical">Critical</option>
                    </select>
                    <select value={filters.vacc} onChange={e => handleFilter('vacc', e.target.value)}>
                        <option value="All">All Coverage Levels</option>
                        <option value="High">High Coverage (≥90%)</option>
                        <option value="Low">Low Coverage (&lt;90%)</option>
                    </select>
                </div>
            </div>

            {/* ── Barangay Table ── */}
            <div className="br-card">
                <div className="br-card-head">
                    <h2><MapPin size={17} /> Barangay Overview</h2>
                    <div className="br-legend">
                        <span className="legend-chip chip-normal"><CheckCircle2 size={11} /> Normal</span>
                        <span className="legend-chip chip-monitor"><AlertTriangle size={11} /> Monitor</span>
                        <span className="legend-chip chip-critical"><AlertCircle size={11} /> Critical</span>
                    </div>
                    <span className="br-count">{filtered.length} barangays</span>
                </div>

                <div className="table-responsive">
                    <table className="br-table">
                        <thead>
                            <tr>
                                <th>Barangay</th>
                                <th>Total Patients</th>
                                <th>High-Risk</th>
                                <th>Deliveries</th>
                                <th>Vacc. Coverage</th>
                                <th>Newborns</th>
                                <th>Supp. Coverage</th>
                                <th>Trimester Mix</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(b => (
                                <React.Fragment key={b.id}>
                                    <tr className={`br-row ${getRiskClass(b.riskStatus)}`}>
                                        <td>
                                            <button className="expand-btn" onClick={() => setExpandedRow(expandedRow === b.id ? null : b.id)}>
                                                {expandedRow === b.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                            <div className="br-name-cell">
                                                <div className="br-brgy-icon"><MapPin size={13} /></div>
                                                <div>
                                                    <span className="br-brgy-name">{b.name}</span>
                                                    {b.alerts.length > 0 && (
                                                        <span className="br-alert-count">{b.alerts.length} alert{b.alerts.length > 1 ? 's' : ''}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="br-num">{b.totalPatients}</span>
                                        </td>
                                        <td>
                                            <span className={`hr-num ${b.highRisk >= 10 ? 'hr-high' : b.highRisk >= 6 ? 'hr-mid' : 'hr-low'}`}>{b.highRisk}</span>
                                        </td>
                                        <td className="br-num">{b.recentDeliveries}</td>
                                        <td>
                                            <MiniBar value={b.vaccCoverage} color={b.vaccCoverage >= 90 ? '#6db8a0' : b.vaccCoverage >= 80 ? '#e8b84b' : '#e05c73'} />
                                        </td>
                                        <td className="br-num">{b.newborns}</td>
                                        <td>
                                            <MiniBar value={b.suppCoverage} color={b.suppCoverage >= 90 ? '#6db8a0' : b.suppCoverage >= 80 ? '#e8b84b' : '#e05c73'} />
                                        </td>
                                        <td style={{ minWidth: '100px' }}>
                                            <TriBar b={b} />
                                        </td>
                                        <td>
                                            <span className={`risk-badge ${getRiskBadge(b.riskStatus)}`}>{b.riskStatus}</span>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="action-btn view-btn" title="View Detail" onClick={() => setSelectedBrgy(b)}><Eye size={13} /></button>
                                                <button className="action-btn export-btn" title="Export Report"><Download size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded inline view */}
                                    {expandedRow === b.id && (
                                        <tr className="br-expanded-row">
                                            <td colSpan="10">
                                                <div className="expand-detail">
                                                    <div className="expand-col">
                                                        <h4>📅 Trimesters</h4>
                                                        <p><strong>1st Trimester:</strong> {b.trimester.first}</p>
                                                        <p><strong>2nd Trimester:</strong> {b.trimester.second}</p>
                                                        <p><strong>3rd Trimester:</strong> {b.trimester.third}</p>
                                                    </div>
                                                    <div className="expand-col">
                                                        <h4>🏥 Deliveries</h4>
                                                        <p><strong>NSD:</strong> {b.deliveryTypes.nsd}</p>
                                                        <p><strong>CS:</strong> {b.deliveryTypes.cs}</p>
                                                        <p><strong>Complications:</strong> {b.complications}</p>
                                                    </div>
                                                    <div className="expand-col">
                                                        <h4>👶 Newborns</h4>
                                                        <p><strong>Total:</strong> {b.newborns}</p>
                                                        <p><strong>Low BW:</strong> {b.lbwBabies}</p>
                                                        <p><strong>NICU:</strong> {b.nicuBabies}</p>
                                                    </div>
                                                    <div className="expand-col">
                                                        <h4>⚠ Alerts</h4>
                                                        {b.alerts.length > 0 ? b.alerts.map((a, i) => <p key={i} className="expand-alert">{a}</p>) : <p>No alerts.</p>}
                                                        <div className="expand-actions">
                                                            <button className="btn btn-outline" onClick={() => setSelectedBrgy(b)}>Full Report →</button>
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
                                    <td colSpan="10" className="br-empty">
                                        <MapPin size={30} />
                                        <p>No barangays match your filters.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Detail Modal ── */}
            {selectedBrgy && <DetailModal brgy={selectedBrgy} onClose={() => setSelectedBrgy(null)} navigate={navigate} />}
        </div>
    );
};

export default BarangayReports;
