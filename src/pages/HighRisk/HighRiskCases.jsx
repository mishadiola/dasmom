import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, Filter, AlertTriangle, Eye, 
    FileText, MapPin, Calendar, HeartPulse,
    ChevronRight, ArrowUpRight, AlertCircle, Activity
} from 'lucide-react';
import PatientService from '../../services/patientservice';
import '../../styles/pages/HighRiskCases.css';

const TrimesterBadge = ({ weeks }) => {
    let trim = 1;
    if (weeks >= 13) trim = 2;
    if (weeks >= 27) trim = 3;
    
    return <span className={`trim-badge trim-${trim}`}>{trim}{trim === 1 ? 'st' : trim === 2 ? 'nd' : 'rd'} Trim</span>;
};

const HighRiskCases = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalHighRisk: 0,
        criticalToday: 0,
        missedFollowups: 0,
        needsImmediate: 0
    });
    const [patients, setPatients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStation, setFilterStation] = useState('All');

    const service = useMemo(() => new PatientService(), []);

    // ✅ FIXED: Transform raw Supabase data to match JSX expectations
    const loadHighRiskData = useCallback(async () => {
        try {
            setLoading(true);
            const [statsData, patientsData] = await Promise.all([
                service.getHighRiskStats(),
                service.getHighRiskPatients()
            ]);

            // ✅ TRANSFORM raw data to match your JSX structure
            const formattedPatients = (patientsData || []).map(p => ({
                id: p.id,
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed Patient',
                first_name: p.first_name,
                last_name: p.last_name,
                station: p.barangay || p.municipality || 'Unassigned',
                riskLevel: p.pregnancy_info?.calculated_risk || 'High Risk',
                condition: p.pregnancy_info?.risk_factors || 'High Risk Pregnancy',
                gravida: p.pregnancy_info?.gravida || 0,
                lmd: p.pregnancy_info?.lmd || '',
                nextVisit: 'Initial Visit'
            }));

            setStats({
                ...statsData,
                totalHighRisk: statsData.highRiskCount || 0,
                criticalToday: 0, // Add logic later
                missedFollowups: 0,
                needsImmediate: 0
            });
            setPatients(formattedPatients);
            console.log('✅ Loaded high-risk:', formattedPatients.length, 'patients');

        } catch (err) {
            console.error('Error loading high risk data:', err);
        } finally {
            setLoading(false);
        }
    }, [service]);

    useEffect(() => {
        let timeout;
        loadHighRiskData();

        const subscription = service.subscribeToHighRiskChanges(() => {
            console.log('🔄 High risk changes detected, re-fetching...');
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                console.log('⏳ Debounced reload...');
                loadHighRiskData();
            }, 500);
        });

        return () => {
            if (timeout) clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, [loadHighRiskData]);

    const filteredPatients = patients.filter(p => {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
            (p.name || '').toLowerCase().includes(search) ||
            (p.id || '').toLowerCase().includes(search);
        const matchesStation =
            filterStation === 'All' || p.station === filterStation;
        return matchesSearch && matchesStation;
    });

    const getStationDistribution = () => {
        const counts = {};
        patients.forEach(p => {
            counts[p.station] = (counts[p.station] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    };

    const stationDistribution = getStationDistribution();

    const getRowClass = (p) => {
        if (p.riskLevel === 'High Risk') return 'row-high-risk';
        if (p.riskLevel === 'Moderate Risk') return 'row-moderate-risk';
        return 'row-monitor';
    };

    const STAT_CARDS = [
        { label: 'Total High-Risk', value: stats.totalHighRisk, color: 'rose', icon: AlertTriangle },
        { label: 'Critical Today', value: stats.criticalToday, color: 'orange', icon: HeartPulse },
        { label: 'Missed Follow-ups', value: stats.missedFollowups, color: 'pink', icon: Calendar },
        { label: 'Needs Referral', value: stats.needsImmediate, color: 'lilac', icon: ChevronRight },
    ];

    if (loading) return (
        <div className="high-risk-page">
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading high-risk dashboard...</p>
            </div>
        </div>
    );

    return (
        <div className="high-risk-page animate-fade">
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <AlertTriangle size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} />
                        High-Risk Case Management
                    </h1>
                    <p className="page-subtitle">Dynamic monitoring of critical pregnancies and priority follow-ups</p>
                </div>
                <div className="header-actions">
                </div>
            </div>

            {/* ── Summary Stats ── */}
            <div className="hr-stats-grid">
                {STAT_CARDS.map(s => {
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
            <div className="hr-controls-card">
                <div className="hr-search-wrap">
                    <Search size={16} className="hr-search-icon" />
                    <input 
                        type="text"
                        className="hr-search-input"
                        placeholder="Search by name or patient ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="hr-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select 
                        value={filterStation}
                        onChange={(e) => setFilterStation(e.target.value)}
                    >
                        <option value="All">All Stations</option>
                        {stationDistribution.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Main Layout ── */}
            <div className="hr-main-grid">
                {/* ── Left Column: Table ── */}
                <div className="hr-table-col">
                    <div className="hr-card">
                        <div className="hr-card-head">
                            <h2>
                                <HeartPulse size={17} /> Real-Time High-Risk Monitoring
                            </h2>
                            <div className="hr-legend">
                                <span className="legend-chip chip-high"><AlertCircle size={11} /> High Risk</span>
                                <span className="legend-chip chip-monitor"><AlertTriangle size={11} /> Monitor</span>
                                <span className="legend-chip chip-normal"><Activity size={11} /> Stable</span>
                            </div>
                            <span className="hr-count">{filteredPatients.length} patients</span>
                        </div>

                        <div className="table-responsive">
                            <table className="hr-table">
                                <thead>
                                    <tr>
                                        <th>Patient Profile</th>
                                        <th>Stage</th>
                                        <th>Conditions / Complications</th>
                                        <th>Due Date</th>
                                        <th>BP</th>
                                        <th>Next Visit</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPatients.length > 0 ? filteredPatients.map((p) => (
                                        <tr key={p.id} className={getRowClass(p)}>
                                            <td>
                                                <div className="patient-cell" onClick={() => navigate(`/dashboard/patients/${p.id}`)} style={{ cursor: 'pointer' }}>
                                                    <div className="patient-avatar">
                                                        {(p.name || '').split(' ').map(n => n[0]).slice(0, 2).join('') || 'ID'}
                                                    </div>
                                                    <div>
                                                        <p className="patient-name patient-name-link">{p.name}</p>
                                                        <span className={`risk-pill risk-pill-${(p.riskLevel || '').toLowerCase().split(' ')[0]}`}>{p.riskLevel}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><TrimesterBadge weeks={0} /></td>
                                            <td>
                                                <div className="condition-wrap">
                                                    <span className="condition-main">{p.condition}</span>
                                                    <span className="condition-meta">{p.station}</span>
                                                </div>
                                            </td>
                                            <td><span className="due-date-val">N/A</span></td>
                                            <td><span className={p.riskLevel === 'High Risk' ? 'text-critical font-bold' : ''}>N/A</span></td>
                                            <td>
                                                <span className={`status-tag status-scheduled`}>
                                                    {p.nextVisit || 'Initial'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="action-btn view-btn" title="View Profile" onClick={() => navigate(`/dashboard/patients/${p.id}`)}>
                                                        <Eye size={14} />
                                                    </button>
                                                    <button className="action-btn record-btn" title="Record Visit">
                                                        <FileText size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="7" className="hr-empty">
                                                <AlertTriangle size={28} />
                                                <p>No high-risk patients found matching your criteria.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ── Right Column: Panels ── */}
                <div className="hr-side-col">
                    {/* Alerts Panel */}
                    <div className="hr-card">
                        <div className="hr-card-head">
                            <h2>
                                <AlertTriangle size={16} /> Critical Alerts
                            </h2>
                        </div>
                        <div className="alerts-list">
                            {filteredPatients.filter(p => (p.riskLevel || '').toLowerCase().includes('high')).slice(0, 8).map(p => (
                                <div key={p.id} className="alert-item alert-critical" onClick={() => navigate(`/dashboard/patients/${p.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="alert-dot"></div>
                                    <div className="alert-body">
                                        <p><strong>{p.name}</strong></p>
                                        <p className="alert-reason">{p.condition}</p>
                                        <div className="alert-footer">
                                            <span>Station: {p.station}</span>
                                            <ArrowUpRight size={12} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredPatients.filter(p => (p.riskLevel || '').toLowerCase().includes('high')).length === 0 && (
                                <p className="empty-alerts">No urgent alerts at this time.</p>
                            )}
                        </div>
                    </div>

                    {/* Station Distribution */}
                    <div className="hr-card">
                        <div className="hr-card-head">
                            <h2>
                                <MapPin size={16} /> Station Distribution
                            </h2>
                        </div>
                        <div className="station-dist-list">
                            {stationDistribution.map(b => (
                                <div key={b.name} className="station-dist-item">
                                    <span>{b.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="station-bar-wrap">
                                            <div className="station-bar-fill" style={{ width: `${(b.count / Math.max(patients.length, 1)) * 100}%` }}></div>
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-rose)', minWidth: '20px', textAlign: 'right' }}>{b.count}</span>
                                    </div>
                                </div>
                            ))}
                            {stationDistribution.length === 0 && <p className="empty-alerts">No records found.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HighRiskCases;