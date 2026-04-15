import React, { useState } from 'react';
import { 
    Activity, Heart, Thermometer, Weight, TrendingUp, 
    Download, ArrowLeft, Filter, AlertCircle, 
    CheckCircle2, ChevronRight, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MyVitals.css';

const MyVitals = () => {
    const navigate = useNavigate();
    const [filterTrimester, setFilterTrimester] = useState('All');

    const VITALS_DATA = [
        { date: 'Feb 20, 2026', weight: 62, bp: '120/80', pulse: 78, temp: 36.5, notes: 'Normal', trimester: '2nd' },
        { date: 'Feb 26, 2026', weight: 63, bp: '130/85', pulse: 82, temp: 36.6, notes: 'Slightly high BP', trimester: '2nd' },
        { date: 'Mar 05, 2026', weight: 64, bp: '122/82', pulse: 80, temp: 36.4, notes: 'Doing well', trimester: '3rd' },
        { date: 'Mar 12, 2026', weight: 64.5, bp: '118/78', pulse: 76, temp: 36.5, notes: 'Stable', trimester: '3rd' },
    ];

    const CURRENT_VITALS = VITALS_DATA[VITALS_DATA.length - 1];

    const filteredVitals = filterTrimester === 'All' 
        ? VITALS_DATA 
        : VITALS_DATA.filter(v => v.trimester === filterTrimester);

    const handleDownloadPDF = () => {
        window.print();
    };

    // Simple SVG Line Chart Component
    const VitalsChart = ({ data, dataKey, color, label, icon: Icon }) => {
        const padding = 40;
        const width = 500;
        const height = 200;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const values = data.map(d => typeof d[dataKey] === 'string' ? parseInt(d[dataKey].split('/')[0]) : d[dataKey]);
        const minVal = Math.min(...values) * 0.9;
        const maxVal = Math.max(...values) * 1.1;
        const range = maxVal - minVal;

        const points = values.map((val, i) => {
            const x = padding + (i / (values.length - 1)) * chartWidth;
            const y = height - padding - ((val - minVal) / range) * chartHeight;
            return `${x},${y}`;
        }).join(' ');

        return (
            <div className="vitals-chart-card">
                <div className="chart-header">
                    <div className="chart-label">
                        <Icon size={16} color={color} />
                        <span>{label} Trend</span>
                    </div>
                </div>
                <div className="svg-container">
                    <svg viewBox={`0 0 ${width} ${height}`} className="vitals-svg">
                        {/* Grid lines */}
                        {[0, 0.5, 1].map(pct => (
                            <line 
                                key={pct}
                                x1={padding} 
                                y1={height - padding - pct * chartHeight} 
                                x2={width - padding} 
                                y2={height - padding - pct * chartHeight} 
                                stroke="#f0f2f5" 
                                strokeWidth="1"
                            />
                        ))}
                        {/* Data Line */}
                        <polyline
                            fill="none"
                            stroke={color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points}
                        />
                        {/* Data Points */}
                        {values.map((val, i) => {
                            const x = padding + (i / (values.length - 1)) * chartWidth;
                            const y = height - padding - ((val - minVal) / range) * chartHeight;
                            return (
                                <g key={i} className="chart-point-group">
                                    <circle cx={x} cy={y} r="5" fill="white" stroke={color} strokeWidth="2" />
                                    <text x={x} y={y - 12} textAnchor="middle" className="chart-value-text">{val}</text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        );
    };

    return (
        <div className="my-vitals-page">
            <header className="mother-page-header">
                <div className="mother-page-header-content">
                    <button className="back-btn" onClick={() => navigate('/mother-home')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className="mother-page-header-text">
                        <h1>Vital Records</h1>
                        <p>View your pregnancy health records and vital signs history</p>
                    </div>
                </div>
                <div className="mother-page-header-actions">
                    <button className="action-btn-primary" onClick={handleDownloadPDF}><Download size={16} /> Download PDF</button>
                </div>
            </header>

            <div className="vitals-content">
                {/* ── Top Summary Cards ── */}
                <div className="vitals-summary-grid">
                    <div className="v-summary-card v-summary-card--green">
                        <div className="v-card-top">
                            <div className="v-icon-wrap"><Weight size={20} /></div>
                            <span className="v-status">Normal</span>
                        </div>
                        <div className="v-value-wrap">
                            <span className="v-value">{CURRENT_VITALS.weight}</span>
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
                            <span className="v-value">{CURRENT_VITALS.bp}</span>
                            <span className="v-unit">mmHg</span>
                        </div>
                        <p className="v-label">Blood Pressure</p>
                    </div>

                    <div className="v-summary-card v-summary-card--green">
                        <div className="v-card-top">
                            <div className="v-icon-wrap"><Heart size={20} /></div>
                            <span className="v-status">Normal</span>
                        </div>
                        <div className="v-value-wrap">
                            <span className="v-value">{CURRENT_VITALS.pulse}</span>
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
                            <span className="v-value">{CURRENT_VITALS.temp}</span>
                            <span className="v-unit">°C</span>
                        </div>
                        <p className="v-label">Temperature</p>
                    </div>
                </div>

                {/* ── Health Alerts (Conditional) ── */}
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

                {/* ── Trends Section ── */}
                <div className="vitals-trends">
                    <h2 className="section-title"><TrendingUp size={18} /> Health Trends</h2>
                    <div className="charts-grid">
                        <VitalsChart 
                            data={VITALS_DATA} 
                            dataKey="weight" 
                            color="#b9818a" 
                            label="Weight" 
                            icon={Weight} 
                        />
                        <VitalsChart 
                            data={VITALS_DATA} 
                            dataKey="bp" 
                            color="#6db8a0" 
                            label="Systolic BP" 
                            icon={Activity} 
                        />
                    </div>
                </div>

                {/* ── History Table ── */}
                <div className="vitals-history">
                    <div className="history-header">
                        <h2 className="section-title"><Calendar size={18} /> Vitals History</h2>
                        <div className="history-filters">
                            <div className="filter-item">
                                <Filter size={14} />
                                <select 
                                    value={filterTrimester} 
                                    onChange={(e) => setFilterTrimester(e.target.value)}
                                >
                                    <option value="All">All Trimesters</option>
                                    <option value="2nd">2nd Trimester</option>
                                    <option value="3rd">3rd Trimester</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="v-table-wrap">
                        <table className="v-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Weight</th>
                                    <th>BP</th>
                                    <th>Pulse</th>
                                    <th>Temp</th>
                                    <th>Status/Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVitals.map((v, i) => (
                                    <tr key={i} className="v-table-row">
                                        <td><strong>{v.date}</strong></td>
                                        <td>{v.weight} kg</td>
                                        <td>{v.bp}</td>
                                        <td>{v.pulse} bpm</td>
                                        <td>{v.temp}°C</td>
                                        <td>
                                            <span className={`v-note-tag ${v.notes.includes('high') ? 'v-note-tag--warn' : ''}`}>
                                                {v.notes}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <footer className="vitals-footer">
                <AlertCircle size={14} />
                <p>All vital records are view-only. These are recorded during your prenatal visits. Contact your health station for any corrections.</p>
            </footer>
        </div>
    );
};

export default MyVitals;
