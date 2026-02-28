import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, FileText, Activity, AlertTriangle,
    CalendarCheck, TrendingUp, Users, HeartPulse, ChevronDown,
    ChevronUp, Eye, Thermometer, Clock, MapPin, CheckCircle2
} from 'lucide-react';
import '../../styles/pages/PregnancyTracking.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
// Generate aggregate pregnancy data
const generateTrackingData = () => {
    return Array.from({ length: 60 }, (_, i) => {
        const id = `PT-${2026001 + i}`;
        const riskTypes = ['Normal', 'Monitor', 'High'];
        // Skew towards normal for realism
        const r = Math.random();
        const risk = r > 0.85 ? 'High' : r > 0.6 ? 'Monitor' : 'Normal';

        const trimesters = [1, 2, 3];
        const tri = trimesters[Math.floor(Math.random() * trimesters.length)];
        const weeks = tri === 1 ? Math.floor(Math.random() * 12) + 1
            : tri === 2 ? Math.floor(Math.random() * 14) + 13
                : Math.floor(Math.random() * 14) + 27;

        return {
            id,
            name: `Patient Name ${i + 1}`,
            barangay: `Brgy. ${Math.floor(Math.random() * 7) + 1}`,
            age: Math.floor(Math.random() * 20) + 18,
            trimester: tri,
            weeks: weeks,
            risk: risk,
            lmp: '2025-08-10',
            edd: '2026-05-17',
            lastVitals: { bp: '120/80', weight: '65kg', fht: '140bpm' },
            nextAppt: Math.random() > 0.4 ? `Mar ${Math.floor(Math.random() * 20) + 1}, 2026` : 'Pending',
            flags: risk === 'High' ? 'Preeclampsia Watch' : risk === 'Monitor' ? 'Anemia' : 'None',
            notes: risk === 'High' ? 'Advised bed rest. Needs BP log.' : 'Routine check scheduled.'
        };
    }).sort((a, b) => {
        // Sort high risk first by default
        if (a.risk === 'High' && b.risk !== 'High') return -1;
        if (a.risk !== 'High' && b.risk === 'High') return 1;
        return b.weeks - a.weeks; // Then by most progressed
    });
};

const MOCK_PREGNANCIES = generateTrackingData();

// Analytics summaries
const STATS = {
    total: MOCK_PREGNANCIES.length,
    highRisk: MOCK_PREGNANCIES.filter(p => p.risk === 'High').length,
    normal: MOCK_PREGNANCIES.filter(p => p.risk === 'Normal').length,
    upcoming: MOCK_PREGNANCIES.filter(p => p.weeks >= 37).length
};

/* ════════════════════════════
   COMPONENT
════════════════════════════ */
const PregnancyTracking = () => {
    const navigate = useNavigate();

    /* ── State ── */
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        trimester: 'All',
        risk: 'All',
        barangay: 'All'
    });

    const [expandedRow, setExpandedRow] = useState(null);

    /* ── Logic ── */
    const filteredData = MOCK_PREGNANCIES.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTri = filters.trimester === 'All' || p.trimester.toString() === filters.trimester;
        const matchesRisk = filters.risk === 'All' || p.risk === filters.risk;
        const matchesBrgy = filters.barangay === 'All' || p.barangay === filters.barangay;
        return matchesSearch && matchesTri && matchesRisk && matchesBrgy;
    });

    const toggleRow = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    return (
        <div className="tracking-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Pregnancy Tracking & Analytics</h1>
                    <p className="page-subtitle">Aggregate population monitoring and high-risk pregnancy identification</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline">
                        <FileText size={16} /> Export Report
                    </button>
                    <button className="btn btn-primary bg-rose">
                        <Plus size={16} /> Add Pregnancy Record
                    </button>
                </div>
            </div>

            {/* ── Top Summary Cards ── */}
            <div className="tracking-stats-grid">
                <div className="track-stat-card theme-blue">
                    <div className="track-stat-icon"><Users size={20} /></div>
                    <div className="track-stat-info">
                        <span className="track-stat-val">{STATS.total}</span>
                        <span className="track-stat-lbl">Active Pregnancies</span>
                    </div>
                </div>
                <div className="track-stat-card theme-red">
                    <div className="track-stat-icon"><AlertTriangle size={20} /></div>
                    <div className="track-stat-info">
                        <span className="track-stat-val">{STATS.highRisk}</span>
                        <span className="track-stat-lbl">High-Risk Cases</span>
                    </div>
                </div>
                <div className="track-stat-card theme-green">
                    <div className="track-stat-icon"><CheckCircle2 size={20} /></div>
                    <div className="track-stat-info">
                        <span className="track-stat-val">{STATS.normal}</span>
                        <span className="track-stat-lbl">Normal Progressions</span>
                    </div>
                </div>
                <div className="track-stat-card theme-orange">
                    <div className="track-stat-icon"><Activity size={20} /></div>
                    <div className="track-stat-info">
                        <span className="track-stat-val">{STATS.upcoming}</span>
                        <span className="track-stat-lbl">Due &lt; 3 weeks</span>
                    </div>
                </div>
            </div>

            {/* ── Analytics Dashboard Panel (CSS Charts) ── */}
            <div className="analytics-panel">

                {/* Chart 1: Trimester Distro */}
                <div className="analytics-card">
                    <h3 className="analytics-title">Trimester Distribution</h3>
                    <div className="tri-progress-wrap">
                        <div className="tri-progress-bar">
                            <div className="tri-seg tri1" style={{ width: '30%' }} title="1st Tri: 30%"></div>
                            <div className="tri-seg tri2" style={{ width: '45%' }} title="2nd Tri: 45%"></div>
                            <div className="tri-seg tri3" style={{ width: '25%' }} title="3rd Tri: 25%"></div>
                        </div>
                        <div className="tri-legend">
                            <span><div className="dot tri1"></div>1st (30%)</span>
                            <span><div className="dot tri2"></div>2nd (45%)</span>
                            <span><div className="dot tri3"></div>3rd (25%)</span>
                        </div>
                    </div>
                </div>

                {/* Chart 2: Risk Ratio (CSS Donut) */}
                <div className="analytics-card">
                    <h3 className="analytics-title">Risk Ratio</h3>
                    <div className="css-donut-wrap">
                        {/* A fallback CSS donut utilizing conic-gradient */}
                        <div className="css-donut" style={{ background: `conic-gradient(#e05c73 0% ${Math.round(STATS.highRisk / STATS.total * 100)}%, #f9a26c ${Math.round(STATS.highRisk / STATS.total * 100)}% ${Math.round((STATS.highRisk + STATS.normal) / STATS.total * 100)}%, #6db8a0 ${Math.round((STATS.highRisk + STATS.normal) / STATS.total * 100)}% 100%)` }}>
                            <div className="css-donut-hole">
                                <span>{STATS.total}</span>
                                <small>Cases</small>
                            </div>
                        </div>
                        <div className="donut-legend">
                            <span><div className="dot d-high"></div>High ({STATS.highRisk})</span>
                            <span><div className="dot d-mon"></div>Monitor</span>
                            <span><div className="dot d-norm"></div>Normal ({STATS.normal})</span>
                        </div>
                    </div>
                </div>

                {/* Chart 3: Barangay Risk Comparisson */}
                <div className="analytics-card span-2">
                    <h3 className="analytics-title">High-Risk Cases by Barangay</h3>
                    <div className="bar-chart">
                        {[
                            { b: 'Brgy 1', val: 75 }, { b: 'Brgy 2', val: 40 },
                            { b: 'Brgy 3', val: 90 }, { b: 'Brgy 4', val: 20 },
                            { b: 'Brgy 5', val: 60 }
                        ].map((br, i) => (
                            <div className="bar-row" key={i}>
                                <span className="bar-lbl">{br.b}</span>
                                <div className="bar-track">
                                    <div className="bar-fill bg-red" style={{ width: `${br.val}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* ── Main Data Table ── */}
            <div className="tracking-table-card">

                {/* Table Controls */}
                <div className="table-toolbar">
                    <div className="search-wrap">
                        <Search className="search-icon" size={16} />
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="table-filters">
                        <select className="filter-select" value={filters.risk} onChange={(e) => setFilters(p => ({ ...p, risk: e.target.value }))}>
                            <option value="All">All Risks</option>
                            <option value="High">High Risk</option>
                            <option value="Monitor">Monitor</option>
                            <option value="Normal">Normal</option>
                        </select>
                        <select className="filter-select" value={filters.trimester} onChange={(e) => setFilters(p => ({ ...p, trimester: e.target.value }))}>
                            <option value="All">All Trimesters</option>
                            <option value="1">Trimester 1</option>
                            <option value="2">Trimester 2</option>
                            <option value="3">Trimester 3</option>
                        </select>
                    </div>
                </div>

                {/* Table Data */}
                <div className="table-responsive">
                    <table className="track-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}></th>
                                <th>Patient</th>
                                <th>Barangay</th>
                                <th>Gestation</th>
                                <th>EDD</th>
                                <th>Risk Level</th>
                                <th>Alert Flags</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map(p => (
                                <React.Fragment key={p.id}>
                                    <tr className={`track-row ${expandedRow === p.id ? 'expanded' : ''}`}>
                                        <td className="cell-expand">
                                            <button className="expand-btn" onClick={() => toggleRow(p.id)}>
                                                {expandedRow === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="track-patient" onClick={() => navigate(`/dashboard/patients/${p.id}`)}>
                                                <span className="tp-name">{p.name}</span>
                                                <span className="tp-id">{p.id} · {p.age} yrs</span>
                                            </div>
                                        </td>
                                        <td className="cell-muted">{p.barangay}</td>
                                        <td>
                                            <div className="gestation-stack">
                                                <span className={`tri-badge tri-${p.trimester}`}>Week {p.weeks}</span>
                                            </div>
                                        </td>
                                        <td className="cell-muted">{p.edd}</td>
                                        <td>
                                            <span className={`risk-badge risk-${p.risk.toLowerCase()}`}>
                                                {p.risk}
                                            </span>
                                        </td>
                                        <td>
                                            {p.flags !== 'None' ? (
                                                <span className="alert-flag"><AlertTriangle size={12} /> {p.flags}</span>
                                            ) : (
                                                <span className="cell-muted">—</span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <div className="row-actions">
                                                <button className="icon-btn-sm" title="Record Vitals"><Thermometer size={14} /></button>
                                                <button className="icon-btn-sm" title="Schedule Visit"><CalendarCheck size={14} /></button>
                                                <button className="icon-btn-sm text-rose" title="View Full Profile" onClick={() => navigate(`/dashboard/patients/${p.id}`)}>
                                                    <Eye size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expandable Vitals Drawer */}
                                    {expandedRow === p.id && (
                                        <tr className="drawer-row">
                                            <td colSpan="8">
                                                <div className="drawer-content">
                                                    <div className="drawer-vitals">
                                                        <span className="drawer-lbl">Latest Vitals:</span>
                                                        <span className="d-vit"><strong>BP:</strong> {p.lastVitals.bp}</span>
                                                        <span className="d-vit"><strong>WT:</strong> {p.lastVitals.weight}</span>
                                                        <span className="d-vit"><strong>FHT:</strong> {p.lastVitals.fht}</span>
                                                    </div>
                                                    <div className="drawer-notes">
                                                        <span className="drawer-lbl">Notes:</span> {p.notes}
                                                    </div>
                                                    <div className="drawer-appt">
                                                        <Clock size={12} /> Next Appt: {p.nextAppt}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="empty-state">No matching pregnancies found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>

        </div>
    );
};

export default PregnancyTracking;
