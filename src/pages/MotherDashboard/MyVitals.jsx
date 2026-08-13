import React, { useState, useEffect } from 'react';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
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
    const [vitalsData, setVitalsData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadVitals = async () => {
            const auth = new AuthService();
            const patientService = new PatientService();
            try {
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;
                const patient = await patientService.getPatientById(authUser.id);
                // Only include visits that have actual vital records (not pending/incomplete)
                const visits = (patient?.visits || [])
                    .filter(v => v.visit_date && (v.weight_kg || (v.bp_systolic && v.bp_diastolic) || v.pulse_bpm || v.temp_c))
                    .map(v => ({
                        id: v.id,
                        date: v.visit_date,
                        weight: v.weight_kg,
                        bp: v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : null,
                        pulse: v.pulse_bpm,
                        temp: v.temp_c,
                        notes: v.clinical_notes || '',
                        trimester: v.trimester ? `Trimester ${v.trimester}` : patient?.trimester || 'N/A'
                    }))
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
                setVitalsData(visits);
            } catch (err) {
                console.error('Failed to load vitals:', err);
            } finally {
                setLoading(false);
            }
        };
        loadVitals();
    }, []);

    const CURRENT_VITALS = vitalsData[0] || {};
    const filteredVitals = filterTrimester === 'All' ? vitalsData : vitalsData.filter(v => v.trimester === filterTrimester);

    const handleDownloadPDF = () => {
        window.print();
    };

    // Simple SVG Line Chart Component
    const VitalsChart = ({ data, dataKey, color, label, icon: Icon }) => {
        if (!data || data.length === 0) return null;
        const padding = 40;
        const width = 500;
        const height = 200;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const rawValues = data.map(d => {
            const v = d[dataKey];
            if (typeof v === 'string' && v.includes('/')) return parseInt(v.split('/')[0]) || 0;
            return typeof v === 'number' ? v : (parseFloat(v) || 0);
        }).filter(n => typeof n === 'number' && !Number.isNaN(n));
        const minVal = rawValues.length ? Math.min(...rawValues) * 0.9 : 0;
        const maxVal = rawValues.length ? Math.max(...rawValues) * 1.1 : minVal + 1;
        const range = maxVal - minVal || 1;

        const points = rawValues.map((val, i) => {
            const x = padding + (i / (rawValues.length - 1)) * chartWidth;
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
                        {rawValues.map((val, i) => {
                            const x = padding + (i / (rawValues.length - 1)) * chartWidth;
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
                            data={vitalsData.length ? vitalsData : []} 
                            dataKey="weight" 
                            color="#b9818a" 
                            label="Weight" 
                            icon={Weight} 
                        />
                        <VitalsChart 
                            data={vitalsData.length ? vitalsData : []} 
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
                                            <td>{v.weight ? `${v.weight} kg` : 'N/A'}</td>
                                            <td>{v.bp || 'N/A'}</td>
                                            <td>{v.pulse ? `${v.pulse} bpm` : 'N/A'}</td>
                                            <td>{v.temp ? `${v.temp}°C` : 'N/A'}</td>
                                            <td>{v.trimester}</td>
                                            <td>
                                                <span className={`v-note-tag ${(v.notes || '').includes('high') || (v.notes || '').includes('alert') ? 'v-note-tag--warn' : ''}`}>
                                                    {v.notes || 'Normal'}
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
