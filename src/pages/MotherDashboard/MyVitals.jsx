import React, { useState, useEffect } from 'react';
import AuthService from '../../services/authservice';
import { loadMotherPatient } from '../../services/motherOfflineService';
import { 
    Activity, Heart, Thermometer, Weight, TrendingUp, 
    Download, ArrowLeft, Filter, AlertCircle, 
    CheckCircle2, ChevronRight, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MyVitals.css';
import vitalsSilhouette from '../../assets/images/vitals-silhouette.png';

const MyVitals = () => {
    const navigate = useNavigate();
    const [filterTrimester, setFilterTrimester] = useState('All');
    const [vitalsData, setVitalsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Current Health');

    const TABS = ['Current Health', 'Vitals History'];

    useEffect(() => {
        const loadVitals = async () => {
            const auth = new AuthService();
            try {
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;
                const patient = await loadMotherPatient(authUser);
                // Only include visits that have actual vital records (not pending/incomplete)
                const visits = (patient?.visits || [])
                    .filter(v => v.visit_date && (v.weight_kg || (v.bp_systolic && v.bp_diastolic) || v.pulse_bpm || v.temp_c))
                    .map(v => ({
                        id: v.id,
                        date: v.visit_date,
                        weight: v.weight_kg,
                        bp: v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : null,
                        bp_systolic: v.bp_systolic,
                        bp_diastolic: v.bp_diastolic,
                        pulse: v.pulse_bpm,
                        temp: v.temp_c,
                        notes: v.clinical_notes || '',
                        trimester: v.trimester ? `Trimester ${v.trimester}` : patient?.trimester || 'N/A'
                    }))
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
                
                const chronological = [...visits].reverse();
                setVitalsData({ visits, chronological });
            } catch (err) {
                console.error('Failed to load vitals:', err);
            } finally {
                setLoading(false);
            }
        };
        loadVitals();
    }, []);

    const CURRENT_VITALS = vitalsData.visits?.[0] || {};
    const filteredVitals = filterTrimester === 'All' ? (vitalsData.visits || []) : (vitalsData.visits || []).filter(v => v.trimester === filterTrimester);

    const handleDownloadPDF = () => {
        window.print();
    };

    // Simple SVG Line Chart Component
    const VitalsChart = ({ data, dataKey, dataKey2, color, color2, label, unit, icon: Icon }) => {
        const validData = data.filter(d => d[dataKey] !== undefined && d[dataKey] !== null);
        
        if (!validData || validData.length === 0) return (
            <div className="vitals-chart-card empty-chart">
                <div className="chart-header">
                    <div className="chart-label">
                        <Icon size={16} color={color} />
                        <span>{label} Trend</span>
                        {unit && <span className="chart-unit">{unit}</span>}
                    </div>
                </div>
                <div className="empty-chart-content">
                    <p>Not enough records yet</p>
                </div>
            </div>
        );

        const padding = 30;
        const width = 500;
        const height = 160;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const getRaw = (d, key) => {
            const v = d[key];
            if (typeof v === 'string' && v.includes('/')) return parseInt(v.split('/')[0]) || 0;
            return typeof v === 'number' ? v : (parseFloat(v) || 0);
        };

        const rawValues1 = validData.map(d => getRaw(d, dataKey)).filter(n => typeof n === 'number' && !Number.isNaN(n));
        const rawValues2 = dataKey2 ? validData.map(d => getRaw(d, dataKey2)).filter(n => typeof n === 'number' && !Number.isNaN(n)) : [];
        
        const allVals = [...rawValues1, ...rawValues2];
        const minVal = allVals.length ? Math.min(...allVals) * 0.9 : 0;
        const maxVal = allVals.length ? Math.max(...allVals) * 1.1 : minVal + 1;
        const range = maxVal - minVal || 1;

        const getPoint = (val, index) => {
            const x = padding + (index / (validData.length - 1 || 1)) * chartWidth;
            const y = height - padding - ((val - minVal) / range) * chartHeight;
            return { x, y };
        };

        const points1 = validData.map((d, i) => getPoint(getRaw(d, dataKey), i));
        const points2 = dataKey2 ? validData.map((d, i) => getPoint(getRaw(d, dataKey2), i)) : [];

        const path1 = points1.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const path2 = points2.length ? points2.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';

        return (
            <div className="vitals-chart-card">
                <div className="chart-header">
                    <div className="chart-label">
                        <Icon size={16} color={color} />
                        <span>{label} Trend</span>
                        {unit && <span className="chart-unit">{unit}</span>}
                    </div>
                </div>
                <div className="chart-svg-container">
                    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                        <path d={path1} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {path2 && <path d={path2} fill="none" stroke={color2} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                        
                        {points1.map((p, i) => {
                            const val = getRaw(validData[i], dataKey);
                            return (
                                <g key={`p1-${i}`}>
                                    <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" />
                                    <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#64748b" fontSize="10">{val}</text>
                                </g>
                            );
                        })}
                        {points2.map((p, i) => {
                            const val = getRaw(validData[i], dataKey2);
                            return (
                                <g key={`p2-${i}`}>
                                    <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color2} strokeWidth="2" />
                                    <text x={p.x} y={p.y + 18} textAnchor="middle" fill="#64748b" fontSize="10">{val}</text>
                                </g>
                            );
                        })}
                    </svg>
                    {dataKey2 && (
                        <div className="chart-legend">
                            <span style={{color: color}}><span className="legend-dot">●</span> Systolic</span>
                            <span style={{color: color2}}><span className="legend-dot">●</span> Diastolic</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="my-vitals-page">
            <div className="page-header vitals-hero-header-with-img">
                <img 
                    src={vitalsSilhouette} 
                    alt="Vitals Silhouette" 
                    className="vitals-silhouette-bg" 
                />
                <div className="vitals-hero-content-wrapper">
                    <div className="vitals-hero-text-section">
                        <h1 className="page-title">
                            <Activity size={22} className="header-icon" style={{ display: 'inline', marginRight: '6px' }} /> Vital Records
                        </h1>
                        <p className="page-subtitle">View your pregnancy health records and vital signs history</p>
                        
                        <div className="vitals-hero-badges-row">
                            <button className="vitals-badge-btn" onClick={handleDownloadPDF}>
                                <Download size={16} /> Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="vitals-tabs">
                {TABS.map(tab => (
                    <button 
                        key={tab}
                        className={`vitals-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="vitals-content">
                {activeTab === 'Current Health' && (
                    <>
                        {/* ── Top Summary Cards ── */}
                        <div className="vitals-section-card">
                            <h2 className="section-title">Current Health</h2>
                            <div className="vitals-summary-grid">
                                <div className="v-summary-card v-summary-card--green">
                                    <div className="v-card-top">
                                        <div className="v-icon-wrap"><Weight size={20} /></div>
                                        <span className="v-status">Normal</span>
                                    </div>
                                    <div className="v-value-wrap">
                                        <span className="v-value">{CURRENT_VITALS.weight || '--'}</span>
                                        <span className="v-unit">kg</span>
                                    </div>
                                    <p className="v-label">Current Weight</p>
                                </div>

                                <div className="v-summary-card v-summary-card--yellow">
                                    <div className="v-card-top">
                                        <div className="v-icon-wrap"><Activity size={20} /></div>
                                        <span className="v-status">Monitor</span>
                                    </div>
                                    <div className="v-value-wrap">
                                        <span className="v-value">{CURRENT_VITALS.bp || '--'}</span>
                                        <span className="v-unit">mmHg</span>
                                    </div>
                                    <p className="v-label">Blood Pressure</p>
                                </div>

                                <div className="v-summary-card v-summary-card--pink">
                                    <div className="v-card-top">
                                        <div className="v-icon-wrap"><Heart size={20} /></div>
                                        <span className="v-status">Normal</span>
                                    </div>
                                    <div className="v-value-wrap">
                                        <span className="v-value">{CURRENT_VITALS.pulse || '--'}</span>
                                        <span className="v-unit">BPM</span>
                                    </div>
                                    <p className="v-label">Heart Rate</p>
                                </div>

                                <div className="v-summary-card v-summary-card--green">
                                    <div className="v-card-top">
                                        <div className="v-icon-wrap"><Thermometer size={20} /></div>
                                        <span className="v-status">Normal</span>
                                    </div>
                                    <div className="v-value-wrap">
                                        <span className="v-value">{CURRENT_VITALS.temp || '--'}</span>
                                        <span className="v-unit">°C</span>
                                    </div>
                                    <p className="v-label">Temperature</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'Current Health' && (
                    <>
                        {/* ── Health Alerts (Conditional) ── */}
                        <div className="vitals-observations-card">
                            <h2 className="section-title">Health Observations</h2>
                            <div className="vitals-alerts">
                                <div className="v-alert-banner v-alert-banner--warning">
                                    <AlertCircle size={20} />
                                    <div className="v-alert-text">
                                        <h4>Recent High BP Observation</h4>
                                        <p>Your blood pressure was slightly elevated (130/85) on Feb 26. Please continue to monitor and avoid salty foods.</p>
                                    </div>
                                </div>
                                <div className="v-alert-banner v-alert-banner--success">
                                    <CheckCircle2 size={20} />
                                    <div className="v-alert-text">
                                        <h4>Steady Weight Gain</h4>
                                        <p>Good job! Your weight gain is within the normal range for your current trimester.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}


                {activeTab === 'Vitals History' && (
                    <div className="vitals-history">
                        <div className="history-header">
                            <h2 className="section-title">Vitals History</h2>
                            <div className="history-filters">
                                <div className="filter-item">
                                    <Filter size={14} />
                                    <select 
                                        value={filterTrimester} 
                                        onChange={(e) => setFilterTrimester(e.target.value)}
                                    >
                                        <option value="All">All Trimesters</option>
                                        <option value="1st">1st Trimester</option>
                                        <option value="2nd">2nd Trimester</option>
                                        <option value="3rd">3rd Trimester</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="v-table-wrap">
                            {filteredVitals.length > 0 ? (
                                <table className="v-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Weight</th>
                                            <th>BP</th>
                                            <th>Pulse</th>
                                            <th>Temp</th>
                                            <th>Trimester</th>
                                            <th>Status/Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVitals.map((v) => (
                                            <tr key={v.id} className="v-table-row">
                                                <td><strong>{new Date(v.date).toLocaleDateString('en-PH')}</strong></td>
                                                <td>{v.weight ? `${v.weight} kg` : '--'}</td>
                                                <td>{v.bp || '--'}</td>
                                                <td>{v.pulse ? `${v.pulse} bpm` : '--'}</td>
                                                <td>{v.temp ? `${v.temp}°C` : '--'}</td>
                                                <td>{v.trimester}</td>
                                                <td>
                                                    <span className={`v-note-tag ${(v.notes || '').includes('high') || (v.notes || '').includes('alert') ? 'v-note-tag--warn' : ''}`}>
                                                        {v.notes || 'Routine'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-vitals-message">
                                    <AlertCircle size={32} />
                                    <p>No vital records available yet. Your vitals will be recorded during prenatal visits.</p>
                                </div>
                            )}
                        </div>

                        <footer className="vitals-footer">
                            <AlertCircle size={14} />
                            <p>All vital records are view-only. These are recorded during your prenatal visits. Contact your health station for any corrections.</p>
                        </footer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyVitals;
