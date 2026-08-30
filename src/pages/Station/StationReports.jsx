import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, MapPin, Users, AlertTriangle,
    Baby, Syringe, Pill, TrendingUp, TrendingDown, Download,
    Eye, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
    FileText, Activity, Heart, BarChart3, Clock, Building2, Stethoscope
} from 'lucide-react';
import '../../styles/pages/StationReports.css';
import PatientService from '../../services/patientservice';
import Legend from '../../components/Legend/Legend';

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
        { label: 'Total Pregnant Patients', value: 0, color: 'sage', icon: Users, path: '/dashboard/patients', filter: null },
        { label: 'High-Risk Pregnancies', value: 0, color: 'rose', icon: AlertTriangle, path: '/dashboard/high-risk', filter: null },
        { label: 'Total Deliveries (Month)', value: 0, color: 'orange', icon: Heart, path: '/dashboard/deliveries', filter: null },
        { label: 'Vaccination Coverage', value: '0%', color: 'lilac', icon: Syringe, path: '/dashboard/inventory', filter: 'vaccines' },
        { label: 'Supplements Distributed', value: 0, color: 'pink', icon: Pill, path: '/dashboard/inventory', filter: 'supplements' },
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
                { label: 'Total Pregnant Patients', value: totalPregnant, color: 'sage', icon: Users, path: '/dashboard/patients', filter: null },
                { label: 'High-Risk Pregnancies', value: totalHighRisk, color: 'rose', icon: AlertTriangle, path: '/dashboard/high-risk', filter: null },
                { label: 'Total Deliveries (Month)', value: totalDeliveries, color: 'orange', icon: Heart, path: '/dashboard/deliveries', filter: null },
                { label: 'Vaccination Coverage', value: `${avgVaccCoverage}%`, color: 'lilac', icon: Syringe, path: '/dashboard/inventory', filter: 'vaccines' },
                { label: 'Supplements Distributed', value: totalSupplements, color: 'pink', icon: Pill, path: '/dashboard/inventory', filter: 'supplements' },
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

    const getCoverageClass = (v) => v >= 90 ? 'green' : v >= 80 ? 'amber' : 'red';

    const getStatusLabel = (r) => {
        if (r === 'Critical') return 'Critical';
        if (r === 'Monitor') return 'Needs Attention';
        return 'Healthy';
    };

    const getStatusClass = (r) => {
        if (r === 'Critical') return 'st-status--critical';
        if (r === 'Monitor') return 'st-status--attention';
        return 'st-status--healthy';
    };

    const [showExportMenu, setShowExportMenu] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showExportMenu && !event.target.closest('.export-dropdown-container')) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExportMenu]);

    // Calculate derived summary values
    const totalStations = stations.length;
    const totalPatients = stations.reduce((sum, s) => sum + s.totalPatients, 0);
    const totalHighRisk = stations.reduce((sum, s) => sum + s.highRisk, 0);
    const totalDeliveries = stations.reduce((sum, s) => sum + s.recentDeliveries, 0);
    const totalNewborns = stations.reduce((sum, s) => sum + s.newborns, 0);

    return (
        <div className="st-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><BarChart3 size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose-dark)' }} /> Station Reports</h1>
                    <p className="page-subtitle">View health data and performance for each station under CHO III, including patient coverage, risk distribution, and vaccination rates.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={() => setShowCharts(v => !v)}>
                        <Activity size={16} /> {showCharts ? 'Hide Charts' : 'Show Charts'}
                    </button>
                    <div className="export-dropdown-container" style={{ position: 'relative' }}>
                        <button className="btn btn-outline" onClick={() => setShowExportMenu(!showExportMenu)}>
                            <Download size={16} /> Export
                        </button>
                        {showExportMenu && (
                            <div className="export-dropdown" style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                background: '#fff', border: '1px solid rgba(185,129,138,0.15)', borderRadius: '12px',
                                boxShadow: '0 8px 24px rgba(45,34,52,0.1)', padding: '6px',
                                display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 100, minWidth: '160px'
                            }}>
                                <button className="btn btn-text" onClick={() => { setShowExportMenu(false); }} style={{ justifyContent: 'flex-start', padding: '10px 14px', width: '100%', display: 'flex', alignItems: 'center', borderRadius: '8px' }}>
                                    <Download size={14} style={{ marginRight: '8px' }} /> Excel (.xlsx)
                                </button>
                                <button className="btn btn-text" onClick={() => { setShowExportMenu(false); }} style={{ justifyContent: 'flex-start', padding: '10px 14px', width: '100%', display: 'flex', alignItems: 'center', borderRadius: '8px' }}>
                                    <Download size={14} style={{ marginRight: '8px' }} /> PDF (.pdf)
                                </button>
                            </div>
                        )}
                    </div>
                    <button className="btn btn-primary"><FileText size={16} /> Generate Report</button>
                </div>
            </div>

            {/* ── Summary Statistics ── */}
            {!loading && (
                <div className="st-summary-card">
                    <div className="st-summary-item" onClick={() => navigate('/dashboard/stations')} role="button" tabIndex={0}>
                        <div className="st-summary-icon st-summary-icon--lilac">
                            <Building2 size={20} />
                        </div>
                        <div className="st-summary-text">
                            <span className="st-summary-value">{totalStations}</span>
                            <span className="st-summary-label">Stations</span>
                        </div>
                    </div>
                    <div className="st-summary-item" onClick={() => navigate('/dashboard/patients')} role="button" tabIndex={0}>
                        <div className="st-summary-icon st-summary-icon--sage">
                            <Users size={20} />
                        </div>
                        <div className="st-summary-text">
                            <span className="st-summary-value">{totalPatients.toLocaleString()}</span>
                            <span className="st-summary-label">Registered Patients</span>
                        </div>
                    </div>
                    <div className="st-summary-item" onClick={() => navigate('/dashboard/high-risk')} role="button" tabIndex={0}>
                        <div className="st-summary-icon st-summary-icon--rose">
                            <AlertTriangle size={20} />
                        </div>
                        <div className="st-summary-text">
                            <span className="st-summary-value">{totalHighRisk}</span>
                            <span className="st-summary-label">High-Risk Cases</span>
                        </div>
                    </div>
                    <div className="st-summary-item" onClick={() => navigate('/dashboard/deliveries')} role="button" tabIndex={0}>
                        <div className="st-summary-icon st-summary-icon--amber">
                            <Heart size={20} />
                        </div>
                        <div className="st-summary-text">
                            <span className="st-summary-value">{totalDeliveries}</span>
                            <span className="st-summary-label">Deliveries</span>
                        </div>
                    </div>
                    <div className="st-summary-item" onClick={() => navigate('/dashboard/newborns')} role="button" tabIndex={0}>
                        <div className="st-summary-icon st-summary-icon--pink">
                            <Baby size={20} />
                        </div>
                        <div className="st-summary-text">
                            <span className="st-summary-value">{totalNewborns}</span>
                            <span className="st-summary-label">Newborns</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Charts Section ── */}
            {showCharts && <ChartsSection stations={stations} />}

            {/* ── Filter Bar ── */}
            <div className="st-filter-bar">
                <div className="st-filter-group">
                    <label>Risk Level</label>
                    <select value={filters.risk} onChange={e => handleFilter('risk', e.target.value)}>
                        <option value="All">All Risk Levels</option>
                        <option value="Normal">Normal</option>
                        <option value="Monitor">Monitor</option>
                        <option value="Critical">Critical</option>
                    </select>
                </div>
                <div className="st-filter-group">
                    <label>Coverage Level</label>
                    <select value={filters.vacc} onChange={e => handleFilter('vacc', e.target.value)}>
                        <option value="All">All Coverage Levels</option>
                        <option value="High">High Coverage (≥90%)</option>
                        <option value="Low">Low Coverage (&lt;90%)</option>
                    </select>
                </div>
                <div className="st-filter-legend">
                    <div className="st-legend-item">
                        <span className="st-legend-dot st-legend-dot--green"></span>
                        <span className="st-legend-value">≥90%</span> Target Met
                    </div>
                    <div className="st-legend-item">
                        <span className="st-legend-dot st-legend-dot--amber"></span>
                        <span className="st-legend-value">80–89%</span> Low
                    </div>
                    <div className="st-legend-item">
                        <span className="st-legend-dot st-legend-dot--red"></span>
                        <span className="st-legend-value">&lt;80%</span> Critical
                    </div>
                </div>
            </div>

            {/* ── Station Overview Table ── */}
            {loading ? (
                <div className="st-loading-card">
                    <div className="st-loading-spinner"></div>
                    <span className="st-loading-text">Loading station data...</span>
                </div>
            ) : (
                <div className="st-overview-card">
                    <div className="st-overview-header">
                        <div className="st-overview-title-group">
                            <h2 className="st-overview-title">
                                <MapPin size={18} /> Station Overview
                            </h2>
                            <p className="st-overview-subtitle">Performance summary across {totalStations} CHO III stations</p>
                        </div>
                        <div className="st-overview-meta">
                            <Legend
                                categories={[
                                    {
                                        title: "Status",
                                        items: [
                                            { label: "Healthy", className: "chip-normal" },
                                            { label: "Needs Attention", className: "chip-monitor" },
                                            { label: "Critical", className: "chip-critical" }
                                        ]
                                    }
                                ]}
                            />
                            <span className="st-station-count">{filtered.length} station{filtered.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    <div className="st-table-wrap">
                        <table className="st-table">
                            <thead>
                                <tr>
                                    <th>Station</th>
                                    <th>Total Patients</th>
                                    <th>High-Risk</th>
                                    <th>Deliveries</th>
                                    <th>Vaccination Coverage</th>
                                    <th>Newborns</th>
                                    <th>Supplement Coverage</th>
                                    <th>Trimester Mix</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(b => {
                                    const total = b.trimester.first + b.trimester.second + b.trimester.third;
                                    const p1 = total > 0 ? Math.round((b.trimester.first / total) * 100) : 0;
                                    const p2 = total > 0 ? Math.round((b.trimester.second / total) * 100) : 0;
                                    const p3 = total > 0 ? (100 - p1 - p2) : 0;

                                    return (
                                        <React.Fragment key={b.id}>
                                            <tr>
                                                <td>
                                                    <div className="st-name-cell">
                                                        <div className="st-station-icon"><MapPin size={14} /></div>
                                                        <span className="st-station-name">{b.name}</span>
                                                    </div>
                                                </td>
                                                <td><span className="st-num">{b.totalPatients.toLocaleString()}</span></td>
                                                <td><span className="st-num st-num--risk">{b.highRisk}</span></td>
                                                <td><span className="st-num">{b.recentDeliveries}</span></td>
                                                <td>
                                                    <div className="st-coverage-cell">
                                                        <span className="st-coverage-val">{b.vaccCoverage}%</span>
                                                        <span className={`st-coverage-dot st-coverage-dot--${getCoverageClass(b.vaccCoverage)}`}></span>
                                                    </div>
                                                </td>
                                                <td><span className="st-num">{b.newborns}</span></td>
                                                <td>
                                                    <div className="st-coverage-cell">
                                                        <span className="st-coverage-val">{b.suppCoverage}%</span>
                                                        <span className={`st-coverage-dot st-coverage-dot--${getCoverageClass(b.suppCoverage)}`}></span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="st-trimester-pills">
                                                        <span className="st-tri-pill st-tri-pill--1st">1st {p1}%</span>
                                                        <span className="st-tri-pill st-tri-pill--2nd">2nd {p2}%</span>
                                                        <span className="st-tri-pill st-tri-pill--3rd">3rd {p3}%</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`st-status-pill ${getStatusClass(b.riskStatus)}`}>
                                                        {getStatusLabel(b.riskStatus)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="st-action-btn"
                                                        title="View Detail"
                                                        onClick={() => setSelectedStation(b)}
                                                    >
                                                        <Eye size={15} />
                                                    </button>
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
                                    );
                                })}

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

            {/* ── Footer Timestamp ── */}
            <div className="st-footer-timestamp">
                <Clock size={13} />
                Data last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>

            {/* ── Detail Modal ── */}
            {selectedStation && <DetailModal station={selectedStation} onClose={() => setSelectedStation(null)} navigate={navigate} />}
        </div>
    );
};

export default StationReports;

/* ════════════════════════════
   CHARTS SECTION
════════════════════════════ */
const ChartsSection = ({ stations }) => {
    const coverageClass = (v) => v >= 90 ? 'green' : v >= 80 ? 'amber' : 'red';
    const maxPatients = stations.length > 0 ? Math.max(...stations.map(b => b.totalPatients)) : 1;
    const maxHighRisk = stations.length > 0 ? Math.max(...stations.map(b => b.highRisk)) : 1;
    const totalHighRisk = stations.reduce((sum, s) => sum + s.highRisk, 0);

    // Sort stations by vaccination coverage descending for coverage charts
    const sortedByVacc = [...stations].sort((a, b) => b.vaccCoverage - a.vaccCoverage);
    const sortedBySupp = [...stations].sort((a, b) => b.suppCoverage - a.suppCoverage);

    return (
        <div className="st-charts-grid">
            {/* Chart 1: Vaccination Coverage by Station */}
            <div className="st-chart-card">
                <div className="st-chart-header">
                    <div className="st-chart-icon st-chart-icon--vacc">
                        <Syringe size={18} />
                    </div>
                    <div className="st-chart-title-group">
                        <h3 className="st-chart-title">Vaccination Coverage by Station</h3>
                        <p className="st-chart-subtitle">Percentage of mothers with complete vaccination</p>
                    </div>
                </div>
                <div className="st-chart-body">
                    <div className="st-hbar-chart">
                        {sortedByVacc.map(b => (
                            <div key={b.id} className="st-hbar-row">
                                <span className="st-hbar-label">{b.name.split('–')[0].trim()}</span>
                                <div className="st-hbar-track">
                                    <div
                                        className={`st-hbar-fill st-hbar-fill--${coverageClass(b.vaccCoverage)}`}
                                        style={{ width: `${b.vaccCoverage}%` }}
                                    />
                                </div>
                                <span className="st-hbar-val">{b.vaccCoverage}%</span>
                            </div>
                        ))}
                    </div>
                    <div className="st-hbar-indicator">90% Target</div>
                </div>
            </div>

            {/* Chart 2: High-Risk Cases */}
            <div className="st-chart-card st-chart-card--risk">
                <div className="st-chart-header">
                    <div className="st-chart-icon st-chart-icon--risk">
                        <AlertTriangle size={18} />
                    </div>
                    <div className="st-chart-title-group">
                        <h3 className="st-chart-title">HIGH-RISK CASES</h3>
                        <p className="st-chart-subtitle">Total high-risk cases across all stations</p>
                    </div>
                </div>
                <div className="st-chart-body">
                    <div className="st-risk-hero">
                        <div className="st-risk-number">{totalHighRisk}</div>
                        <div className="st-risk-label">High-Risk Cases</div>
                        <div className="st-risk-sub">Across {stations.length} stations</div>
                    </div>
                    <div className="st-risk-dist-title">Distribution by Station</div>
                    <div className="st-vbar-chart" style={{ minHeight: '80px' }}>
                        {stations.map(b => (
                            <div key={b.id} className="st-vbar-col">
                                <div className="st-vbar-bar-wrap" style={{ minHeight: '60px' }}>
                                    <div
                                        className="st-vbar-bar st-vbar-bar--rose"
                                        style={{ height: `${maxHighRisk > 0 ? Math.round((b.highRisk / maxHighRisk) * 100) : 0}%` }}
                                        title={`${b.name}: ${b.highRisk}`}
                                    />
                                </div>
                                <span className="st-vbar-val">{b.highRisk}</span>
                                <span className="st-vbar-label">{b.name.split('–')[0].trim()}</span>
                            </div>
                        ))}
                    </div>
                    <div className="st-risk-warning">
                        <AlertCircle size={14} />
                        <span>High-risk mothers need priority monitoring and follow-up care.</span>
                    </div>
                </div>
            </div>

            {/* Chart 3: Registered Patients by Station */}
            <div className="st-chart-card">
                <div className="st-chart-header">
                    <div className="st-chart-icon st-chart-icon--patients">
                        <Users size={18} />
                    </div>
                    <div className="st-chart-title-group">
                        <h3 className="st-chart-title">Registered Patients by Station</h3>
                        <p className="st-chart-subtitle">Total number of registered patients</p>
                    </div>
                </div>
                <div className="st-chart-body">
                    <div className="st-vbar-chart">
                        {stations.map(b => (
                            <div key={b.id} className="st-vbar-col">
                                <div className="st-vbar-bar-wrap">
                                    <div
                                        className="st-vbar-bar st-vbar-bar--purple"
                                        style={{ height: `${maxPatients > 0 ? Math.round((b.totalPatients / maxPatients) * 100) : 0}%` }}
                                        title={`${b.name}: ${b.totalPatients}`}
                                    />
                                </div>
                                <span className="st-vbar-val">{b.totalPatients.toLocaleString()}</span>
                                <span className="st-vbar-label">{b.name.split('–')[0].trim()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart 4: Supplement Coverage by Station */}
            <div className="st-chart-card">
                <div className="st-chart-header">
                    <div className="st-chart-icon st-chart-icon--supp">
                        <Pill size={18} />
                    </div>
                    <div className="st-chart-title-group">
                        <h3 className="st-chart-title">Supplement Coverage by Station</h3>
                        <p className="st-chart-subtitle">Percentage of mothers who received complete supplements</p>
                    </div>
                </div>
                <div className="st-chart-body">
                    <div className="st-hbar-chart">
                        {sortedBySupp.map(b => (
                            <div key={b.id} className="st-hbar-row">
                                <span className="st-hbar-label">{b.name.split('–')[0].trim()}</span>
                                <div className="st-hbar-track">
                                    <div
                                        className={`st-hbar-fill st-hbar-fill--${coverageClass(b.suppCoverage)}`}
                                        style={{ width: `${b.suppCoverage}%` }}
                                    />
                                </div>
                                <span className="st-hbar-val">{b.suppCoverage}%</span>
                            </div>
                        ))}
                    </div>
                    <div className="st-hbar-indicator">90% Target</div>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   DETAIL MODAL
════════════════════════════ */
const DetailModal = ({ station, onClose, navigate }) => {
    const [tab, setTab] = useState('overview');
    const [showExportMenu, setShowExportMenu] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showExportMenu && !event.target.closest('.export-dropdown-container')) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExportMenu]);

    const TABS = [
        { id: 'overview',   label: 'Patients Overview', icon: Users },
        { id: 'deliveries', label: 'Delivery Summary',  icon: Heart },
        { id: 'vacc',       label: 'Vaccinations',      icon: Syringe },
        { id: 'newborns',   label: 'Newborn Status',    icon: Baby },
        { id: 'alerts',     label: `Alerts (${station.alerts.length})`, icon: AlertTriangle },
    ];

    const coverageColor = (v) => v >= 90 ? '#7bae5e' : v >= 80 ? '#d4a03c' : '#c7586a';

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
                                        { label: 'Healthy', count: station.newborns - station.lbwBabies - station.nicuBabies, total: station.newborns, color: '#7bae5e' },
                                        { label: 'Low Birth Weight', count: station.lbwBabies, total: station.newborns, color: '#d4a03c' },
                                        { label: 'NICU', count: station.nicuBabies, total: station.newborns, color: '#c7586a' },
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
                    <div className="export-dropdown-container" style={{ position: 'relative' }}>
                        <button className="btn btn-outline" onClick={() => setShowExportMenu(!showExportMenu)}>
                            <Download size={14} /> Export
                        </button>
                        {showExportMenu && (
                            <div className="export-dropdown" style={{
                                position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px',
                                background: '#fff', border: '1px solid rgba(185,129,138,0.15)', borderRadius: '12px',
                                boxShadow: '0 8px 24px rgba(45,34,52,0.1)', padding: '6px',
                                display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 100, minWidth: '160px'
                            }}>
                                <button className="btn btn-text" onClick={() => { setShowExportMenu(false); }} style={{ justifyContent: 'flex-start', padding: '10px 14px', width: '100%', display: 'flex', alignItems: 'center', borderRadius: '8px' }}>
                                    <Download size={14} style={{ marginRight: '8px' }} /> Excel (.xlsx)
                                </button>
                                <button className="btn btn-text" onClick={() => { setShowExportMenu(false); }} style={{ justifyContent: 'flex-start', padding: '10px 14px', width: '100%', display: 'flex', alignItems: 'center', borderRadius: '8px' }}>
                                    <Download size={14} style={{ marginRight: '8px' }} /> PDF (.pdf)
                                </button>
                            </div>
                        )}
                    </div>
                    <button className="btn btn-primary"><FileText size={14} /> Generate Full Report</button>
                </div>
            </div>
        </div>
    );
};
