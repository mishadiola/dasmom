import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, MapPin, Users, AlertTriangle,
    Baby, Syringe, Pill, TrendingUp, TrendingDown, Download,
    Eye, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
    FileText, Activity, Heart
} from 'lucide-react';
import '../../styles/pages/StationReports.css';
import PatientService from '../../services/patientservice';

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const StationReports = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ risk: 'All', vacc: 'All' });
    const [selectedStation, setSelectedStation] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [showCharts, setShowCharts] = useState(true);
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summaryStats, setSummaryStats] = useState([
        { label: 'Total Pregnant Patients', value: 0, color: 'sage', icon: Users },
        { label: 'High-Risk Pregnancies', value: 0, color: 'rose', icon: AlertTriangle },
        { label: 'Total Deliveries (Month)', value: 0, color: 'orange', icon: Heart },
        { label: 'Vaccination Coverage', value: '0%', color: 'lilac', icon: Syringe },
        { label: 'Supplements Distributed', value: 0, color: 'pink', icon: Pill },
    ]);

    const patientService = new PatientService();

    useEffect(() => {
        fetchStationData();
    }, []);

    const fetchStationData = async () => {
        try {
            setLoading(true);
            const data = await patientService.getStationReports();
            setStations(data);

            // Calculate summary stats from station data
            const totalPregnant = data.reduce((sum, s) => sum + s.totalPatients, 0);
            const totalHighRisk = data.reduce((sum, s) => sum + s.highRisk, 0);
            const totalDeliveries = data.reduce((sum, s) => sum + s.recentDeliveries, 0);
            const avgVaccCoverage = data.length > 0
                ? Math.round(data.reduce((sum, s) => sum + s.vaccCoverage, 0) / data.length)
                : 0;
            const totalSupplements = data.reduce((sum, s) => sum + s.totalSupplementsGiven, 0);

            setSummaryStats([
                { label: 'Total Pregnant Patients', value: totalPregnant, color: 'sage', icon: Users },
                { label: 'High-Risk Pregnancies', value: totalHighRisk, color: 'rose', icon: AlertTriangle },
                { label: 'Total Deliveries (Month)', value: totalDeliveries, color: 'orange', icon: Heart },
                { label: 'Vaccination Coverage', value: `${avgVaccCoverage}%`, color: 'lilac', icon: Syringe },
                { label: 'Supplements Distributed', value: totalSupplements, color: 'pink', icon: Pill },
            ]);
        } catch (error) {
            console.error('Error fetching station data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    const filtered = stations.filter(b => {
        const s = searchTerm.toLowerCase();
        const matchSearch = b.name.toLowerCase().includes(s);
        const matchRisk = filters.risk === 'All' || b.riskStatus === filters.risk;
        const matchVacc = filters.vacc === 'All' ||
            (filters.vacc === 'High' && b.vaccCoverage >= 90) ||
            (filters.vacc === 'Low' && b.vaccCoverage < 90);
        return matchSearch && matchRisk && matchVacc;
    });

    const getRiskClass = (r) => {
        if (r === 'Critical') return 'st-row--critical';
        if (r === 'Monitor') return 'st-row--monitor';
        return 'st-row--normal';
    };

    const getRiskBadge = (r) => {
        if (r === 'Critical') return 'badge-critical';
        if (r === 'Monitor') return 'badge-monitor';
        return 'badge-normal';
    };

    const coverageColor = (v) => v >= 90 ? '#80a06c' : v >= 80 ? '#b08d70' : '#926674';
    const coverageBg = (v) => v >= 90 ? 'rgba(160,194,130,0.12)' : v >= 80 ? 'rgba(237,189,154,0.12)' : 'rgba(182,129,145,0.12)';

    return (
        <div className="st-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><MapPin size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Station Reports</h1>
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
            <div className="st-stats-grid">
                {summaryStats.map(s => {
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
            {showCharts && <ChartsSection stations={stations} />}

            {/* ── Search & Filters ── */}
            <div className="st-controls">
                <div className="st-search-wrap">
                    <Search size={16} className="st-search-icon" />
                    <input
                        type="text"
                        className="st-search-input"
                        placeholder="Search station name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="st-filters-row">
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

            {/* ── Station Table ── */}
            {loading ? (
                <div className="st-card">
                    <div className="st-empty">
                        <p>Loading station data...</p>
                    </div>
                </div>
            ) : (
            <div className="st-card">
                <div className="st-card-head">
                    <h2><MapPin size={17} /> Station Overview</h2>
                    <div className="st-legend">
                        <span className="legend-chip chip-normal"><CheckCircle2 size={11} /> Normal</span>
                        <span className="legend-chip chip-monitor"><AlertTriangle size={11} /> Monitor</span>
                        <span className="legend-chip chip-critical"><AlertCircle size={11} /> Critical</span>
                    </div>
                    <span className="st-count">{filtered.length} stations</span>
                </div>

                <div className="table-responsive">
                    <table className="st-table">
                        <thead>
                            <tr>
                                <th>Station</th>
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
                                    <tr className={`st-row ${getRiskClass(b.riskStatus)}`}>
                                        <td>
                                            <button className="expand-btn" onClick={() => setExpandedRow(expandedRow === b.id ? null : b.id)}>
                                                {expandedRow === b.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                            <div className="st-name-cell">
                                                <div className="st-station-icon"><MapPin size={13} /></div>
                                                <div>
                                                    <span className="st-station-name">{b.name}</span>
                                                    {b.alerts.length > 0 && (
                                                        <span className="st-alert-count">{b.alerts.length} alert{b.alerts.length > 1 ? 's' : ''}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="st-num">{b.totalPatients}</span>
                                        </td>
                                        <td>
                                            <span className={`hr-num ${b.highRisk >= 10 ? 'hr-high' : b.highRisk >= 6 ? 'hr-mid' : 'hr-low'}`}>{b.highRisk}</span>
                                        </td>
                                        <td className="st-num">{b.recentDeliveries}</td>
                                        <td>
                                            <MiniBar value={b.vaccCoverage} color={b.vaccCoverage >= 90 ? '#6db8a0' : b.vaccCoverage >= 80 ? '#e8b84b' : '#e05c73'} />
                                        </td>
                                        <td className="st-num">{b.newborns}</td>
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
                                                <button className="action-btn view-btn" title="View Detail" onClick={() => setSelectedStation(b)}><Eye size={13} /></button>
                                                <button className="action-btn export-btn" title="Export Report"><Download size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded inline view */}
                                    {expandedRow === b.id && (
                                        <tr className="st-expanded-row">
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
                                                            <button className="btn btn-outline" onClick={() => setSelectedStation(b)}>Full Report →</button>
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
                                    <td colSpan="10" className="st-empty">
                                        <MapPin size={30} />
                                        <p>No stations match your filters.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* ── Detail Modal ── */}
            {selectedStation && <DetailModal station={selectedStation} onClose={() => setSelectedStation(null)} navigate={navigate} />}
        </div>
    );
};

export default StationReports;

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
const DetailModal = ({ station, onClose, navigate }) => {
    const [tab, setTab] = useState('overview');

    const TABS = [
        { id: 'overview',   label: 'Patients Overview', icon: Users },
        { id: 'deliveries', label: 'Delivery Summary',  icon: Heart },
        { id: 'vacc',       label: 'Vaccinations',      icon: Syringe },
        { id: 'newborns',   label: 'Newborn Status',    icon: Baby },
        { id: 'alerts',     label: `Alerts (${station.alerts.length})`, icon: AlertTriangle },
    ];

    const coverageColor = (v) => v >= 90 ? '#a0c282' : v >= 80 ? '#edbd9a' : '#b68191';

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="st-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2><MapPin size={16} /> {station.name}</h2>
                        <p>{station.totalPatients} patients tracked · {station.recentDeliveries} deliveries this month</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="st-tab-nav">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} className={`st-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
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
                                <div className="detail-stat"><span>Total Patients</span><strong>{station.totalPatients}</strong></div>
                                <div className="detail-stat detail-stat--rose"><span>High-Risk</span><strong>{station.highRisk}</strong></div>
                                <div className="detail-stat detail-stat--blue"><span>1st Trimester</span><strong>{station.trimester.first}</strong></div>
                                <div className="detail-stat detail-stat--yellow"><span>2nd Trimester</span><strong>{station.trimester.second}</strong></div>
                                <div className="detail-stat detail-stat--purple"><span>3rd Trimester</span><strong>{station.trimester.third}</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>Trimester Distribution</h4>
                                <div className="tri-bar-large">
                                    <div className="tri-seg tri-1" style={{ flex: station.trimester.first }}>
                                        <span>1st: {station.trimester.first}</span>
                                    </div>
                                    <div className="tri-seg tri-2" style={{ flex: station.trimester.second }}>
                                        <span>2nd: {station.trimester.second}</span>
                                    </div>
                                    <div className="tri-seg tri-3" style={{ flex: station.trimester.third }}>
                                        <span>3rd: {station.trimester.third}</span>
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
                                <div className="detail-stat detail-stat--green"><span>Total Deliveries</span><strong>{station.recentDeliveries}</strong></div>
                                <div className="detail-stat"><span>NSD</span><strong>{station.deliveryTypes.nsd}</strong></div>
                                <div className="detail-stat detail-stat--purple"><span>CS</span><strong>{station.deliveryTypes.cs}</strong></div>
                                <div className="detail-stat detail-stat--rose"><span>With Complications</span><strong>{station.complications}</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>NSD vs CS Breakdown</h4>
                                <div className="do-bar-row">
                                    <label>NSD ({station.deliveryTypes.nsd})</label>
                                    <div className="do-bar-track">
                                        <div className="do-bar-nsd" style={{ width: `${Math.round((station.deliveryTypes.nsd / station.recentDeliveries) * 100)}%` }} />
                                    </div>
                                    <span>{Math.round((station.deliveryTypes.nsd / station.recentDeliveries) * 100)}%</span>
                                </div>
                                <div className="do-bar-row">
                                    <label>CS ({station.deliveryTypes.cs})</label>
                                    <div className="do-bar-track">
                                        <div className="do-bar-cs" style={{ width: `${Math.round((station.deliveryTypes.cs / station.recentDeliveries) * 100)}%` }} />
                                    </div>
                                    <span>{Math.round((station.deliveryTypes.cs / station.recentDeliveries) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: Vaccinations */}
                    {tab === 'vacc' && (
                        <div>
                            <div className="detail-stats-grid">
                                <div className="detail-stat"><span>Overall Coverage</span><strong>{station.vaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Maternal Vaccines</span><strong>{station.maternalVaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Newborn Vaccines</span><strong>{station.newbornVaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Supplement Coverage</span><strong>{station.suppCoverage}%</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>Coverage Breakdown</h4>
                                {[
                                    { label: 'Overall Vaccination', value: station.vaccCoverage },
                                    { label: 'Maternal Vaccines', value: station.maternalVaccCoverage },
                                    { label: 'Newborn Vaccines', value: station.newbornVaccCoverage },
                                    { label: 'Supplement Coverage', value: station.suppCoverage },
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
                                <div className="detail-stat detail-stat--blue"><span>Newborns Tracked</span><strong>{station.newborns}</strong></div>
                                <div className="detail-stat detail-stat--orange"><span>Low Birth Weight</span><strong>{station.lbwBabies}</strong></div>
                                <div className="detail-stat detail-stat--rose"><span>NICU Admissions</span><strong>{station.nicuBabies}</strong></div>
                                <div className="detail-stat detail-stat--green"><span>Healthy Newborns</span><strong>{station.newborns - station.lbwBabies - station.nicuBabies}</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>Newborn Condition Distribution</h4>
                                <div className="nb-status-bars">
                                    {[
                                        { label: 'Healthy', count: station.newborns - station.lbwBabies - station.nicuBabies, total: station.newborns, color: '#a0c282' },
                                        { label: 'Low Birth Weight', count: station.lbwBabies, total: station.newborns, color: '#edbd9a' },
                                        { label: 'NICU', count: station.nicuBabies, total: station.newborns, color: '#b68191' },
                                    ].map(item => (
                                        <div key={item.label} className="nb-status-bar-row">
                                            <label>{item.label} ({item.count})</label>
                                            <div className="nb-bar-track">
                                                <div className="nb-bar-fill" style={{
                                                    width: station.newborns > 0 ? `${Math.round((item.count / station.newborns) * 100)}%` : '0%',
                                                    background: item.color
                                                }} />
                                            </div>
                                            <span>{station.newborns > 0 ? Math.round((item.count / station.newborns) * 100) : 0}%</span>
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
                            {station.alerts.length > 0 ? (
                                <div className="st-alerts-list">
                                    {station.alerts.map((a, i) => (
                                        <div key={i} className="st-alert-item">
                                            <AlertCircle size={15} />
                                            <span>{a}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="st-empty st-empty--ok">
                                    <CheckCircle2 size={28} />
                                    <p>No alerts — this station is performing well across all indicators.</p>
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
const ChartsSection = ({ stations }) => {
    const coverageColor = (v) => v >= 90 ? '#a0c282' : v >= 80 ? '#edbd9a' : '#b68191';
    const maxPatients = Math.max(...stations.map(b => b.totalPatients));
    const maxHighRisk = Math.max(...stations.map(b => b.highRisk));

    return (
        <div className="charts-grid">
            {/* Chart 1: Vaccination Coverage by Station */}
            <div className="chart-card">
                <h3 className="chart-title"><Syringe size={15} /> Vaccination Coverage by Station</h3>
                <div className="bar-chart-v">
                    {stations.map(b => (
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

            {/* Chart 2: High-Risk Cases by Station */}
            <div className="chart-card">
                <h3 className="chart-title"><AlertTriangle size={15} /> High-Risk Cases by Station</h3>
                <div className="horiz-bar-chart">
                    {stations.map(b => (
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

            {/* Chart 3: Total Patients by Station */}
            <div className="chart-card">
                <h3 className="chart-title"><Users size={15} /> Total Patients by Station</h3>
                <div className="horiz-bar-chart">
                    {stations.map(b => (
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
                <h3 className="chart-title"><Pill size={15} /> Supplement Coverage by Station</h3>
                <div className="bar-chart-v">
                    {stations.map(b => (
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
