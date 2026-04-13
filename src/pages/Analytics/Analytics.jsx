import React, { useState, useMemo } from 'react';
import {
    Users, Activity, AlertTriangle, CheckCircle2, 
    TrendingUp, Calendar, MapPin, Filter, 
    ChevronRight, ArrowUpRight, Baby, PieChart,
    BarChart3, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/pages/Analytics.css';

/* ════════════════════════════
   MOCK DATA ENGINE
════════════════════════════ */
const STATIONS = ['Station 1', 'Station 2', 'Station 3', 'Station 4', 'Station 5', 'Station 6', 'Station 7'];

const generateMaternalData = () => {
    const conditions = ['Preeclampsia', 'Anemia', 'Gestational Diabetes', 'None'];
    return Array.from({ length: 120 }, (_, i) => {
        const r = Math.random();
        
        // Age Distribution (Teenage pregnancies ~15%)
        const age = r < 0.15 ? Math.floor(Math.random() * 5) + 14 : Math.floor(Math.random() * 20) + 20;
        
        // Risk Levels
        const riskLevel = r > 0.85 ? 'Critical' : r > 0.65 ? 'Warning' : r > 0.4 ? 'Monitor' : 'Normal';
        
        // Trimesters
        const tri = Math.floor(Math.random() * 3) + 1;
        
        // Conditions
        const condition = r > 0.7 ? conditions[Math.floor(Math.random() * 3)] : 'None';

        return {
            id: `PT-${2026001 + i}`,
            name: `Patient ${i + 1}`,
            age,
            station: STATIONS[Math.floor(Math.random() * STATIONS.length)],
            trimester: tri,
            riskLevel,
            condition,
            isTeenage: age < 20,
            dateAdded: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28))
        };
    });
};

const MOCK_DATA = generateMaternalData();

/* ════════════════════════════
   SUB-COMPONENTS
════════════════════════════ */

const MiniTrend = ({ data, color }) => (
    <div className="mini-trend">
        {data.map((v, i) => (
            <div 
                key={i} 
                className="trend-bar" 
                style={{ 
                    height: `${(v / Math.max(...data)) * 100}%`,
                    background: color 
                }} 
            />
        ))}
    </div>
);

const DonutChart = ({ data, total, colors }) => {
    let cumulativePercent = 0;
    const slices = data.map((d, i) => {
        const percent = (d.value / total) * 100;
        const start = cumulativePercent;
        cumulativePercent += percent;
        return { ...d, start, end: cumulativePercent, color: colors[i] };
    });

    const conicGradient = slices.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ');

    return (
        <div className="donut-container">
            <div className="donut-ring" style={{ background: `conic-gradient(${conicGradient})` }}>
                <div className="donut-center">
                    <span className="donut-val">{total}</span>
                    <span className="donut-lbl">Cases</span>
                </div>
            </div>
            <div className="donut-legend-grid">
                {slices.map((s, i) => (
                    <div key={i} className="donut-leg-item">
                        <span className="leg-dot" style={{ background: s.color }} />
                        <span className="leg-name">{s.label}</span>
                        <span className="leg-val">{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const Analytics = () => {
    const [filters, setFilters] = useState({
        station: 'All',
        trimester: 'All',
        timeframe: 'quarterly'
    });

    // ── Data Filtering ──
    const filteredData = useMemo(() => {
        return MOCK_DATA.filter(p => {
            const matchStation = filters.station === 'All' || p.station === filters.station;
            const matchTri = filters.trimester === 'All' || p.trimester.toString() === filters.trimester;
            return matchStation && matchTri;
        });
    }, [filters]);

    // ── Metric Calculations ──
    const metrics = useMemo(() => {
        const total = filteredData.length;
        const teenage = filteredData.filter(p => p.isTeenage);
        const highRisk = filteredData.filter(p => p.riskLevel === 'Critical');
        const urgent = filteredData.filter(p => p.condition !== 'None');

        return {
            total,
            teenageCount: teenage.length,
            teenagePct: total > 0 ? Math.round((teenage.length / total) * 100) : 0,
            highRiskCount: highRisk.length,
            urgentCount: urgent.length,
            riskBreakdown: [
                { label: 'Critical', value: filteredData.filter(p => p.riskLevel === 'Critical').length },
                { label: 'Warning', value: filteredData.filter(p => p.riskLevel === 'Warning').length },
                { label: 'Monitor', value: filteredData.filter(p => p.riskLevel === 'Monitor').length },
            ],
            conditionStats: [
                { label: 'Pre-eclampsia', value: filteredData.filter(p => p.condition === 'Preeclampsia').length, color: '#b68191' },
                { label: 'Anemia', value: filteredData.filter(p => p.condition === 'Anemia').length, color: '#edbd9a' },
                { label: 'Diabetes', value: filteredData.filter(p => p.condition === 'Gestational Diabetes').length, color: '#ac97b4' },
            ]
        };
    }, [filteredData]);

    const handleFilterChange = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

    return (
        <div className="analytics-overhaul">
            
            {/* ── Page Header ── */}
            <header className="analytics-header">
                <div>
                    <h1 className="page-title">Analytics</h1>
                    <p className="page-subtitle">Proactive risk monitoring and population health insights</p>
                </div>
                <div className="header-actions">
                    <button className="btn-export"><Activity size={14} /> Intelligence Report</button>
                </div>
            </header>

            {/* ── Filter Bar ── */}
            <div className="analytics-filters shadow-sm">
                <div className="filter-group">
                    <MapPin size={16} className="filter-icon" />
                    <select value={filters.station} onChange={e => handleFilterChange('station', e.target.value)}>
                        <option value="All">All Stations</option>
                        {STATIONS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <PieChart size={16} className="filter-icon" />
                    <select value={filters.trimester} onChange={e => handleFilterChange('trimester', e.target.value)}>
                        <option value="All">All Trimesters</option>
                        <option value="1">1st Trimester</option>
                        <option value="2">2nd Trimester</option>
                        <option value="3">3rd Trimester</option>
                    </select>
                </div>
                <div className="filter-group">
                    <Calendar size={16} className="filter-icon" />
                    <select value={filters.timeframe} onChange={e => handleFilterChange('timeframe', e.target.value)}>
                        <option value="monthly">Monthly View</option>
                        <option value="quarterly">Quarterly View</option>
                    </select>
                </div>
            </div>

            {/* ── Summary Stats ── */}
            <section className="analytics-summary-grid">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="a-stat-card lilac">
                    <div className="a-stat-icon"><Users size={22} /></div>
                    <div className="a-stat-info">
                        <h3>{metrics.teenageCount}</h3>
                        <p>Teenage Pregnancies ({metrics.teenagePct}%)</p>
                    </div>
                    <div className="a-stat-trend up">
                        <TrendingUp size={12} /> +2.4%
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="a-stat-card rose">
                    <div className="a-stat-icon"><AlertTriangle size={22} /></div>
                    <div className="a-stat-info">
                        <h3>{metrics.highRiskCount}</h3>
                        <p>Critical High-Risk Cases</p>
                    </div>
                    <div className="a-stat-badge">Urgent</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="a-stat-card orange">
                    <div className="a-stat-icon"><Activity size={22} /></div>
                    <div className="a-stat-info">
                        <h3>{metrics.urgentCount}</h3>
                        <p>With Underlying Conditions</p>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="a-stat-card sage">
                    <div className="a-stat-icon"><Baby size={22} /></div>
                    <div className="a-stat-info">
                        <h3>{metrics.total}</h3>
                        <p>Total Managed Cases</p>
                    </div>
                </motion.div>
            </section>

            {/* ── Detailed Reports ── */}
            <div className="reports-grid">
                
                {/* 1. Teenage Pregnancy Trend */}
                <div className="report-card">
                    <div className="report-head">
                        <div>
                            <h3 className="report-title">Teenage Pregnancy Analytics</h3>
                            <p className="report-sub">Monthly trend for patients aged &lt;20 years</p>
                        </div>
                        <BarChart3 size={18} className="text-muted" />
                    </div>
                    <div className="trend-visualization">
                        <div className="trend-main-val">
                            <span className="big-num">{metrics.teenageCount}</span>
                            <div className="val-meta">
                                <span className="text-danger font-bold">-5%</span>
                                <small className="text-muted">vs last period</small>
                            </div>
                        </div>
                        <MiniTrend data={[4, 6, 8, 5, 9, 7, 12, 8]} color="#ac97b4" />
                    </div>
                    <div className="report-footer">
                        <p>Targeting awareness programs in <strong>Station 3</strong> could reduce these numbers.</p>
                    </div>
                </div>

                {/* 2. High Risk Categorization */}
                <div className="report-card">
                    <div className="report-head">
                        <div>
                            <h3 className="report-title">Risk Categorization</h3>
                            <p className="report-sub">Breakdown of maternal risk severity levels</p>
                        </div>
                        <PieChart size={18} className="text-muted" />
                    </div>
                    <DonutChart 
                        total={filteredData.length} 
                        data={metrics.riskBreakdown} 
                        colors={['#b68191', '#edbd9a', '#a0c282']} 
                    />
                </div>

                {/* 3. Underlying Conditions */}
                <div className="report-card span-2">
                    <div className="report-head">
                        <div>
                            <h3 className="report-title">Conditions & Co-morbidities</h3>
                            <p className="report-sub">Prevalence of underlying health complications</p>
                        </div>
                        <AlertCircle size={18} className="text-muted" />
                    </div>
                    <div className="conditions-grid">
                        <div className="conditions-bars">
                            {metrics.conditionStats.sort((a,b) => b.value - a.value).map(c => (
                                <div key={c.label} className="cond-row">
                                    <div className="cond-info">
                                        <span className="cond-name">{c.label}</span>
                                        <span className="cond-val">{c.value} cases</span>
                                    </div>
                                    <div className="cond-bar-track">
                                        <motion.div 
                                            initial={{ width: 0 }} 
                                            animate={{ width: `${(c.value / filteredData.length) * 100}%` }}
                                            className="cond-bar-fill"
                                            style={{ background: c.color }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="urgent-highlights">
                            <div className="highlight-box red">
                                <h4>Crucial Alert</h4>
                                <p><strong>{metrics.conditionStats[0].value}</strong> patients with Pre-eclampsia require weekly BP monitoring.</p>
                                <button className="btn-tiny">View Cases <ChevronRight size={12} /></button>
                            </div>
                            <div className="highlight-box orange">
                                <h4>Monitoring Advice</h4>
                                <p>Ensure supplement distribution is 100% for Anemic patients.</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
};

export default Analytics;
