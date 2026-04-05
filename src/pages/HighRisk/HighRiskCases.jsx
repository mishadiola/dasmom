import React, { useState } from 'react';
import {
    Search, Filter, AlertTriangle, Activity, MapPin, Maximize2,
    Clock, CheckCircle2, ChevronRight, Eye, Phone, Plus, AlertCircle, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/HighRiskCases.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const STATS = [
    { id: 1, label: 'Total High-Risk', value: 43, color: 'rose', icon: AlertTriangle },
    { id: 2, label: 'Critical Cases Today', value: 5, color: 'orange', icon: Activity },
    { id: 3, label: 'Missed Follow-ups', value: 12, color: 'pink', icon: Clock },
    { id: 4, label: 'Needs Immediate Visit', value: 8, color: 'sage', icon: AlertCircle },
];

const HIGH_RISK_PATIENTS = [];

const ALERTS = [];

const BARANGAY_DISTRIBUTION = [
    { name: 'Brgy. 1 – Poblacion', count: 6 },
    { name: 'Brgy. 3 – San Jose', count: 9 },
    { name: 'Brgy. 5 – Maliwanag', count: 7 },
    { name: 'Brgy. 7 – Daan Paso', count: 10 },
];

const TrimesterBadge = ({ weeks }) => {
    const tri = weeks <= 12 ? 1 : weeks <= 26 ? 2 : 3;
    return (
        <span className={`tri-badge tri-badge--${tri}`}>
            T{tri} · {weeks}w
        </span>
    );
};

/* ════════════════════════════
   HIGH RISK CASES COMPONENT
════════════════════════════ */
const HighRiskCases = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState('all');

    const filteredPatients = HIGH_RISK_PATIENTS.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barangay.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLevel = filterLevel === 'all' || p.level === filterLevel;
        return matchesSearch && matchesLevel;
    });

    return (
        <div className="high-risk-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">High-Risk Pregnancy Monitoring</h1>
                    <p className="page-date">Prioritized view of patients requiring urgent attention</p>
                </div>
            </div>

            {/* ── Risk Summary Cards ── */}
            <div className="stats-grid">
                {STATS.map((s) => {
                    const Icon = s.icon;
                    return (
                        <div key={s.id} className={`stat-card stat-card--${s.color}`}>
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

            {/* ── Main Layout (2-column) ── */}
            <div className="dash-grid">
                
                {/* ── Left Column: Table ── */}
                <div className="dash-col-left">
                    <div className="card">
                        
                        {/* Filters & Search */}
                        <div className="filter-bar">
                            <div className="search-wrap">
                                <Search size={16} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by name, ID, or barangay..."
                                    className="search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="filter-dropdowns">
                                <button className="btn-outline">
                                    <Filter size={14} /> Filters
                                </button>
                                <div className="filter-tabs">
                                    {['all', 'critical', 'warning', 'monitor'].map((f) => (
                                        <button
                                            key={f}
                                            className={`filter-tab${filterLevel === f ? ' active' : ''}`}
                                            onClick={() => setFilterLevel(f)}
                                        >
                                            {f.charAt(0).toUpperCase() + f.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="table-wrap">
                            <table className="data-table risk-table">
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Gestational Age</th>
                                        <th>Risk Condition</th>
                                        <th>Level</th>
                                        <th>Latest BP</th>
                                        <th>Last Visit</th>
                                        <th>Next Visit</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPatients.map((p) => (
                                        <tr key={p.id} className={`table-row row-${p.level}`}>
                                            <td>
                                                <div className="patient-cell">
                                                    <div className="patient-avatar">
                                                        {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                                    </div>
                                                    <div>
                                                        <p className="patient-name">{p.name}</p>
                                                        <p className="patient-meta">{p.barangay} · {p.age} yrs</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><TrimesterBadge weeks={p.weeks} /></td>
                                            <td><strong>{p.condition}</strong></td>
                                            <td>
                                                <span className={`risk-badge risk-badge--${p.level}`}>
                                                    {p.level}
                                                </span>
                                            </td>
                                            <td><span className={p.level === 'critical' ? 'text-critical' : ''}>{p.bp}</span></td>
                                            <td>{p.lastVisit}</td>
                                            <td>
                                                <span className={`status-tag status-${p.status.toLowerCase().replace(' ', '-')}`}>
                                                    {p.nextVisit}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="action-btn" title="View Profile" onClick={() => navigate(`/dashboard/patients/${p.id}`)}>
                                                        <Eye size={16} />
                                                    </button>
                                                    <button className="action-btn" title="Record Prenatal Visit">
                                                        <FileText size={16} />
                                                    </button>
                                                    <button className="action-btn emergency-btn" title="Mark as Emergency">
                                                        <AlertTriangle size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
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
                                <AlertTriangle size={16} /> Alerts & Follow-ups
                            </h2>
                        </div>
                        <div className="alerts-list">
                            {ALERTS.map(alert => (
                                <div key={alert.id} className={`alert-item alert-${alert.type}`}>
                                    <div className="alert-content">
                                        <p>{alert.text}</p>
                                        <span>{alert.time}</span>
                                    </div>
                                </div>
                            ))}
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
                            {BARANGAY_DISTRIBUTION.map(b => (
                                <div key={b.name} className="brgy-dist-item">
                                    <span>{b.name}</span>
                                    <span className="brgy-dist-count">{b.count} cases</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                </div>
            </div>

        </div>
    );
};

export default HighRiskCases;
