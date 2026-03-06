import React from 'react';
import {
    Users, Activity, AlertTriangle, CheckCircle2
} from 'lucide-react';
import '../../styles/pages/Analytics.css';

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
const Analytics = () => {

    return (
        <div className="analytics-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Analytics & Dashboard</h1>
                    <p className="page-subtitle">Aggregate population monitoring and high-risk pregnancy identification</p>
                </div>
            </div>

            {/* ── Top Summary Cards ── */}
            <div className="tracking-stats-grid">
                <div className="stat-card stat-card--sage">
                    <div className="stat-top">
                        <div className="stat-icon stat-icon--sage"><Users size={20} /></div>
                    </div>
                    <div className="stat-value">{STATS.total}</div>
                    <div className="stat-label">Active Pregnancies</div>
                </div>
                <div className="stat-card stat-card--rose">
                    <div className="stat-top">
                        <div className="stat-icon stat-icon--rose"><AlertTriangle size={20} /></div>
                    </div>
                    <div className="stat-value">{STATS.highRisk}</div>
                    <div className="stat-label">High-Risk Cases</div>
                </div>
                <div className="stat-card stat-card--pink">
                    <div className="stat-top">
                        <div className="stat-icon stat-icon--pink"><CheckCircle2 size={20} /></div>
                    </div>
                    <div className="stat-value">{STATS.normal}</div>
                    <div className="stat-label">Normal Progressions</div>
                </div>
                <div className="stat-card stat-card--orange">
                    <div className="stat-top">
                        <div className="stat-icon stat-icon--orange"><Activity size={20} /></div>
                    </div>
                    <div className="stat-value">{STATS.upcoming}</div>
                    <div className="stat-label">Due &lt; 3 weeks</div>
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

        </div>
    );
};

export default Analytics;
