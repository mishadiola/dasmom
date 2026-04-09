import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, Filter, AlertTriangle, Eye, 
    FileText, MapPin, Calendar, HeartPulse,
    ChevronRight, ArrowUpRight
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
    const [filterBarangay, setFilterBarangay] = useState('All');

    const loadHighRiskData = useCallback(async () => {
        try {
            const service = new PatientService();
            const [statsData, patientsData] = await Promise.all([
                service.getHighRiskStats(),
                service.getHighRiskPatients()
            ]);
            setStats(statsData);
            setPatients(patientsData);
        } catch (err) {
            console.error('Error loading high risk data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHighRiskData();

        // --- Real-time Subscription ---
        const service = new PatientService();
        const subscription = service.subscribeToHighRiskChanges(() => {
            console.log('🔄 High risk changes detected, re-fetching data...');
            loadHighRiskData();
        });

        // Cleanup subscription on unmount
        return () => {
            console.log('🔌 Unsubscribing from high risk changes');
            subscription.unsubscribe();
        };
    }, [loadHighRiskData]);

    const filteredPatients = patients.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBrgy = filterBarangay === 'All' || p.barangay === filterBarangay;
        return matchesSearch && matchesBrgy;
    });

    const getBrgyDistribution = () => {
        const counts = {};
        patients.forEach(p => {
            counts[p.barangay] = (counts[p.barangay] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    };

    const brgyDistribution = getBrgyDistribution();

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
            <div className="hr-header">
                <div>
                    <h1 className="hr-title">High-Risk Case Management</h1>
                    <p className="hr-subtitle">Dynamic monitoring of critical pregnancies and priority follow-ups</p>
                </div>
                <div className="hr-actions">
                    <div className="live-pill">
                        <span className="live-dot"></span>
                        LIVE UPDATES
                    </div>
                </div>
            </div>

            {/* ── Summary Stats ── */}
            <div className="hr-stats-grid">
                <div className="hr-stat-card border-rose">
                    <div className="stat-icon-wrap bg-rose"><AlertTriangle size={20} /></div>
                    <div>
                        <p className="stat-label">Total High Risk</p>
                        <h3 className="stat-value">{stats.totalHighRisk}</h3>
                    </div>
                </div>
                <div className="hr-stat-card border-orange">
                    <div className="stat-icon-wrap bg-orange"><HeartPulse size={20} /></div>
                    <div>
                        <p className="stat-label">Critical Today</p>
                        <h3 className="stat-value text-orange">{stats.criticalToday}</h3>
                    </div>
                </div>
                <div className="hr-stat-card border-amber">
                    <div className="stat-icon-wrap bg-amber"><Calendar size={20} /></div>
                    <div>
                        <p className="stat-label">Missed Follow-ups</p>
                        <h3 className="stat-value text-amber">{stats.missedFollowups}</h3>
                    </div>
                </div>
                <div className="hr-stat-card border-lilac">
                    <div className="stat-icon-wrap bg-lilac"><ChevronRight size={20} /></div>
                    <div>
                        <p className="stat-label">Needs Referral</p>
                        <h3 className="stat-value">{stats.needsImmediate}</h3>
                    </div>
                </div>
            </div>

            <div className="hr-main-grid">
                {/* ── Left Column: Table ── */}
                <div className="dash-col-left">
                    <div className="card">
                        <div className="card-header-flex">
                            <h2 className="card-title">Real-Time High-Risk Monitoring</h2>
                            <div className="filter-controls">
                                <div className="search-box">
                                    <Search size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Search name or ID..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <select 
                                    className="brgy-select"
                                    value={filterBarangay}
                                    onChange={(e) => setFilterBarangay(e.target.value)}
                                >
                                    <option value="All">All Barangays</option>
                                    {brgyDistribution.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                                </select>
                            </div>
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
                                        <tr key={p.id} className={`table-row row-${p.riskLevel?.toLowerCase().replace(' ', '-')}`}>
                                            <td>
                                                <div className="patient-cell" onClick={() => navigate(`/dashboard/patients/${p.id}`)} style={{ cursor: 'pointer' }}>
                                                    <div className="patient-avatar">
                                                        {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                                    </div>
                                                    <div>
                                                        <p className="patient-name patient-name-link">{p.name}</p>
                                                        <span className={`risk-pill risk-pill-${p.riskLevel?.toLowerCase().split(' ')[0]}`}>{p.riskLevel}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><TrimesterBadge weeks={p.weeks} /></td>
                                            <td>
                                                <div className="condition-wrap">
                                                    <span className="condition-main">{p.condition}</span>
                                                    <span className="condition-meta">{p.barangay}</span>
                                                </div>
                                            </td>
                                            <td><span className="due-date-val">{p.edd}</span></td>
                                            <td><span className={p.riskLevel === 'High Risk' ? 'text-critical font-bold' : ''}>{p.bp}</span></td>
                                            <td>
                                                <span className={`status-tag status-${p.status?.toLowerCase().replace(' ', '-')}`}>
                                                    {p.nextVisit}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="action-btn" title="View Profile" onClick={() => navigate(`/dashboard/patients/${p.id}`)}>
                                                        <Eye size={16} />
                                                    </button>
                                                    <button className="action-btn" title="Record Visit">
                                                        <FileText size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="7" className="empty-table-msg">
                                                No high-risk patients found matching your criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ── Right Column: Panels ── */}
                <div className="dash-col-right">
                    
                    {/* Alerts Panel */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">
                                <AlertTriangle size={16} /> Critical Alerts
                            </h2>
                        </div>
                        <div className="alerts-list">
                            {filteredPatients.filter(p => p.riskLevel?.toLowerCase().includes('high')).slice(0, 8).map(p => (
                                <div key={p.id} className="alert-item alert-critical" onClick={() => navigate(`/dashboard/patients/${p.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="alert-content">
                                        <p><strong>{p.name}</strong></p>
                                        <p className="alert-reason">{p.condition}</p>
                                        <div className="alert-footer">
                                            <span>EDD: {p.edd}</span>
                                            <ArrowUpRight size={12} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredPatients.length === 0 && <p className="p-4 text-center text-muted">No urgent alerts</p>}
                        </div>
                    </div>

                    {/* Barangay Distribution */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">
                                <MapPin size={16} /> Barangay Distribution
                            </h2>
                        </div>
                        <div className="brgy-dist-list">
                            {brgyDistribution.map(b => (
                                <div key={b.name} className="brgy-dist-item">
                                    <span>{b.name}</span>
                                    <div className="brgy-bar-wrap">
                                        <div className="brgy-bar-fill" style={{ width: `${(b.count / patients.length) * 100}%` }}></div>
                                        <span className="brgy-dist-count">{b.count}</span>
                                    </div>
                                </div>
                            ))}
                            {brgyDistribution.length === 0 && <p className="p-4 text-center text-muted">No records found</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HighRiskCases;
