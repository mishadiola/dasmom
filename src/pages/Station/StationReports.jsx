import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, MapPin, Users, AlertTriangle,
    Baby, Syringe, Pill, TrendingUp, TrendingDown, Download,
    Eye, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
    FileText, Activity, Heart, HeartPulse, BarChart3, Clock, Building2, Stethoscope
} from 'lucide-react';
import '../../styles/pages/StationReports.css';
import PatientService from '../../services/patientservice';
import Legend from '../../components/Legend/Legend';
import supabase from '../../config/supabaseclient';
import ExportModal from '../../components/ExportModal';
import ActionTooltip from '../../components/Common/ActionTooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import StaffPageLoader from '../../components/Common/StaffPageLoader';

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const StationReports = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStation, setSelectedStation] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [showCharts, setShowCharts] = useState(true);
    const [stations, setStations] = useState([]);
    const [pregnancyAgeRows, setPregnancyAgeRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [summaryStats, setSummaryStats] = useState([
        { label: 'Total Pregnant Patients', value: 0, color: 'sage', icon: Users, path: '/dashboard/patients', filter: null },
        { label: 'Pregnancies with Health Conditions', value: 0, color: 'rose', icon: HeartPulse, path: '/dashboard/high-risk', filter: null },
        { label: 'Total Deliveries (Month)', value: 0, color: 'orange', icon: Heart, path: '/dashboard/deliveries', filter: null },
        { label: 'Vaccination Coverage', value: '0%', color: 'lilac', icon: Syringe, path: '/dashboard/inventory', filter: 'vaccines' },
        { label: 'Supplements Distributed', value: 0, color: 'pink', icon: Pill, path: '/dashboard/inventory', filter: 'supplements' },
    ]);

    const patientService = new PatientService();

    useEffect(() => {
        let pollingTimer = null;

        const startPollingFallback = () => {
            if (pollingTimer) return;
            pollingTimer = setInterval(fetchStationData, 30000);
        };

        const stopPollingFallback = () => {
            if (!pollingTimer) return;
            clearInterval(pollingTimer);
            pollingTimer = null;
        };

        fetchStationData();

        const channel = supabase
            .channel('station-reports-live-data')
            .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
                const tables = ['stations', 'patient_basic_info', 'pregnancy_info', 'prenatal_visits', 'deliveries', 'newborns', 'vaccinations', 'supplements'];
                if (tables.includes(payload.table)) fetchStationData();
            })
            .subscribe(status => {
                if (status === 'SUBSCRIBED') {
                    stopPollingFallback();
                } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
                    startPollingFallback();
                }
            });

        return () => {
            stopPollingFallback();
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchStationData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [data, ageRows] = await Promise.all([
                patientService.getStationReports(),
                patientService.getStationPregnancyAgeReport()
            ]);
            setStations(data);
            setPregnancyAgeRows(ageRows);

            // Calculate summary stats from station data
            const totalPregnant = data.reduce((sum, s) => sum + s.totalPatients, 0);
            const totalWithHealthConditions = data.reduce((sum, s) => sum + (s.withHealthConditions || 0), 0);
            const totalDeliveries = data.reduce((sum, s) => sum + s.recentDeliveries, 0);
            const avgVaccCoverage = data.length > 0
                ? Math.round(data.reduce((sum, s) => sum + s.vaccCoverage, 0) / data.length)
                : 0;
            const totalSupplements = data.reduce((sum, s) => sum + s.totalSupplementsGiven, 0);

            setSummaryStats([
                { label: 'Total Pregnant Patients', value: totalPregnant, color: 'sage', icon: Users, path: '/dashboard/patients', filter: null },
                { label: 'Pregnancies with Health Conditions', value: totalWithHealthConditions, color: 'rose', icon: HeartPulse, path: '/dashboard/high-risk', filter: null },
                { label: 'Total Deliveries (Month)', value: totalDeliveries, color: 'orange', icon: Heart, path: '/dashboard/deliveries', filter: null },
                { label: 'Vaccination Coverage', value: `${avgVaccCoverage}%`, color: 'lilac', icon: Syringe, path: '/dashboard/inventory', filter: 'vaccines' },
                { label: 'Supplements Distributed', value: totalSupplements, color: 'pink', icon: Pill, path: '/dashboard/inventory', filter: 'supplements' },
            ]);
        } catch (error) {
            console.error('Error fetching station data:', error);
            setError(error);
            setPregnancyAgeRows([]);
        } finally {
            setLoading(false);
        }
    };

    const filtered = searchTerm
        ? stations.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : stations;

    const getCoverageClass = (v) => v >= 90 ? 'green' : v >= 80 ? 'amber' : 'red';

    const [showExportModal, setShowExportModal] = useState(false);

    const handleExport = (exportConfig) => {
        const { format, reportPeriodText } = exportConfig;
        const exportData = stations.map(s => ({
            'Station': s.name,
            'Total Patients': s.totalPatients,
            'With Health Conditions': s.withHealthConditions,
            'Deliveries (Month)': s.recentDeliveries,
            'Newborns': s.newborns,
            'Vaccination Coverage (%)': s.vaccCoverage,
            'Supplement Coverage (%)': s.suppCoverage,
            '1st Trimester': s.trimester?.first || 0,
            '2nd Trimester': s.trimester?.second || 0,
            '3rd Trimester': s.trimester?.third || 0,
            'Complications': s.complications || 0,
        }));

        if (format === 'excel') {
            let worksheetData = [
                ['Report: DASMOM+ Station Reports'],
                [`Generated: ${new Date().toLocaleString()}`],
                [`Period: ${reportPeriodText}`],
                []
            ];
            if (exportData.length > 0) {
                worksheetData = worksheetData.concat([
                    Object.keys(exportData[0]),
                    ...exportData.map(obj => Object.values(obj))
                ]);
            } else {
                worksheetData.push(['No station data found.']);
            }
            const ws = XLSX.utils.aoa_to_sheet(worksheetData);
            if (exportData.length > 0) {
                ws['!cols'] = Object.keys(exportData[0]).map(key => ({ wch: Math.max(key.length, 15) }));
            }
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Station Reports');
            XLSX.writeFile(wb, `Station_Reports_${new Date().toISOString().split('T')[0]}.xlsx`);
        } else if (format === 'pdf') {
            const doc = new jsPDF('landscape');
            doc.setFontSize(16);
            doc.text('DASMOM+ Station Reports', 14, 20);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            doc.text(`Period: ${reportPeriodText}`, 14, 34);
            if (exportData.length === 0) {
                doc.text('No station data found.', 14, 46);
            } else {
                const head = [Object.keys(exportData[0])];
                const body = exportData.map(obj => Object.values(obj));
                doc.autoTable({
                    startY: 42,
                    head,
                    body,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [185, 129, 138] }
                });
            }
            doc.save(`Station_Reports_${new Date().toISOString().split('T')[0]}.pdf`);
        }
    };

    // Calculate derived summary values
    const totalStations = stations.length;
    const totalPatients = stations.reduce((sum, s) => sum + s.totalPatients, 0);
    const totalWithConditions = stations.reduce((sum, s) => sum + (s.withHealthConditions || 0), 0);
    const totalDeliveries = stations.reduce((sum, s) => sum + s.recentDeliveries, 0);
    const totalNewborns = stations.reduce((sum, s) => sum + s.newborns, 0);

    if (loading) {
        return (
            <StaffPageLoader 
                message="Loading station reports..." 
                error={error} 
                onRetry={fetchStationData} 
            />
        );
    }

    return (
        <div className="st-page staff-page-ready">

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
                    <button className="btn btn-outline" onClick={() => setShowExportModal(true)}>
                        <Download size={16} /> Export
                    </button>
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
                            <HeartPulse size={20} />
                        </div>
                        <div className="st-summary-text">
                            <span className="st-summary-value">{totalWithConditions}</span>
                            <span className="st-summary-label">Pregnancies with Health Conditions</span>
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
                                        title: "Coverage Level",
                                        items: [
                                            { label: "≥90% Target Met", style: { background: "rgba(123, 174, 94, 0.15)", color: "#4a7a30", fontWeight: 700 } },
                                            { label: "80–89% Low", style: { background: "rgba(212, 160, 60, 0.15)", color: "#8a6a20", fontWeight: 700 } },
                                            { label: "<80% Critical", style: { background: "rgba(199, 88, 106, 0.15)", color: "#943848", fontWeight: 700 } }
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
                                    <th>With Health Conditions</th>
                                    <th>Deliveries</th>
                                    <th>Vaccination Coverage</th>
                                    <th>Newborns</th>
                                    <th>Supplement Coverage</th>
                                    <th>Trimester Mix</th>
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
                                                <td><span className="st-num">{b.withHealthConditions}</span></td>
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
                                                    <ActionTooltip text="View Details">
                                                        <button
                                                            className="st-action-btn"
                                                            onClick={() => setSelectedStation(b)}
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                    </ActionTooltip>
                                                </td>
                                            </tr>

                                            {/* Expanded inline view */}
                                            {expandedRow === b.id && (
                                                <tr className="st-expanded-row">
                                                    <td colSpan="9">
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
                                        <td colSpan="9" className="st-empty">
                                            <MapPin size={30} />
                                            <p>No stations found.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Charts Section ── */}
            {showCharts && <ChartsSection stations={stations} />}

            <PregnancyAgeReport rows={pregnancyAgeRows} />

            {/* ── Footer Timestamp ── */}
            <div className="st-footer-timestamp">
                <Clock size={13} />
                Data last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>

            {/* ── Detail Modal ── */}
            {selectedStation && <DetailModal station={selectedStation} onClose={() => setSelectedStation(null)} navigate={navigate} />}

            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                onExport={handleExport}
            />
        </div>
    );
};

export default StationReports;

/* ════════════════════════════
   PREGNANCY AGE REPORT
════════════════════════════ */
const PregnancyAgeReport = ({ rows }) => {
    const [filters, setFilters] = useState({ period: 'All', station: 'All', outcome: 'All', deliveryType: 'All' });

    const stationOptions = [...new Set(rows.map(row => row.station).filter(Boolean))].sort();
    const deliveryTypeOptions = [...new Set(rows.map(row => row.deliveryType).filter(type => type && type !== 'N/A'))].sort();

    const filteredRows = useMemo(() => rows.filter(row => {
        const date = new Date(row.eventDate);
        const now = new Date();
        const isSameMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const matchPeriod = filters.period === 'All'
            || (filters.period === 'Month' && isSameMonth && date.getFullYear() === now.getFullYear())
            || (filters.period === 'Year' && date.getFullYear() === now.getFullYear())
            || (filters.period === 'Week' && date >= startOfWeek && date <= now);
        return matchPeriod
            && (filters.station === 'All' || row.station === filters.station)
            && (filters.outcome === 'All' || row.outcome === filters.outcome)
            && (filters.deliveryType === 'All' || row.deliveryType === filters.deliveryType);
    }), [rows, filters]);

    const ageCounts = filteredRows.reduce((counts, row) => {
        if (row.age === null) return counts;
        counts[row.age] = (counts[row.age] || 0) + 1;
        return counts;
    }, {});
    const ageData = Object.entries(ageCounts).map(([age, count]) => ({ age: Number(age), count }))
        .sort((a, b) => a.age - b.age);
    const maxAgeCount = Math.max(...ageData.map(item => item.count), 1);

    const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
    const formatDate = date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <section className="st-age-report">
            <div className="st-age-report-header">
                <div>
                    <h2 className="st-overview-title"><Users size={18} /> Pregnancy Age &amp; Outcome Report</h2>
                    <p className="st-overview-subtitle">Maternal age at the recorded pregnancy event, grouped by station and outcome</p>
                </div>
                <span className="st-station-count">{filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="st-age-filters">
                <div className="st-filter-group">
                    <label>Period</label>
                    <div className="st-select-wrapper">
                        <select value={filters.period} onChange={event => updateFilter('period', event.target.value)}>
                            <option value="All">All Time</option>
                            <option value="Month">This Month</option>
                            <option value="Week">This Week</option>
                            <option value="Year">This Year</option>
                        </select>
                        <ChevronDown size={14} className="st-select-arrow" />
                    </div>
                </div>
                <div className="st-filter-group">
                    <label>Station</label>
                    <div className="st-select-wrapper">
                        <select value={filters.station} onChange={event => updateFilter('station', event.target.value)}>
                            <option value="All">All Stations</option>
                            {stationOptions.map(station => <option key={station} value={station}>{station}</option>)}
                        </select>
                        <ChevronDown size={14} className="st-select-arrow" />
                    </div>
                </div>
                <div className="st-filter-group">
                    <label>Outcome</label>
                    <div className="st-select-wrapper">
                        <select value={filters.outcome} onChange={event => updateFilter('outcome', event.target.value)}>
                            <option value="All">All Outcomes</option>
                            <option value="Successful">Successful</option>
                            <option value="Unsuccessful">Unsuccessful</option>
                            <option value="Pending">Pending</option>
                        </select>
                        <ChevronDown size={14} className="st-select-arrow" />
                    </div>
                </div>
                <div className="st-filter-group">
                    <label>Delivery Type</label>
                    <div className="st-select-wrapper">
                        <select value={filters.deliveryType} onChange={event => updateFilter('deliveryType', event.target.value)}>
                            <option value="All">All Delivery Types</option>
                            {deliveryTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                        <ChevronDown size={14} className="st-select-arrow" />
                    </div>
                </div>
            </div>

            <div className="st-age-content">
                <div className="st-age-chart-panel">
                    <div className="st-chart-header">
                        <div className="st-chart-icon st-chart-icon--patients"><BarChart3 size={18} /></div>
                        <div className="st-chart-title-group">
                            <h3 className="st-chart-title">Age by Pregnancy Record</h3>
                            <p className="st-chart-subtitle">Number of records at each maternal age</p>
                        </div>
                    </div>
                    {ageData.length > 0 ? (
                        <div className="st-age-bars">
                            {ageData.map(item => (
                                <div className="st-age-bar-row" key={item.age}>
                                    <span className="st-age-label">{item.age} yrs</span>
                                    <div className="st-age-bar-track"><div className="st-age-bar-fill" style={{ width: `${(item.count / maxAgeCount) * 100}%` }} /></div>
                                    <strong>{item.count}</strong>
                                </div>
                            ))}
                        </div>
                    ) : <div className="st-age-empty">No age records match these filters.</div>}
                </div>

                <div className="st-age-table-panel">
                    <div className="st-age-table-wrap">
                        <table className="st-age-table">
                            <thead><tr><th>Patient</th><th>Age</th><th>Station</th><th>Date</th><th>Outcome</th><th>Delivery Type</th></tr></thead>
                            <tbody>
                                {filteredRows.map(row => (
                                    <tr key={row.id}>
                                        <td>{row.patientName}</td>
                                        <td>{row.age === null ? 'N/A' : `${row.age} yrs`}</td>
                                        <td>{row.station}</td>
                                        <td>{formatDate(row.eventDate)}</td>
                                        <td><span className={`st-age-outcome st-age-outcome--${row.outcome.toLowerCase()}`}>{row.outcome}</span></td>
                                        <td>{row.deliveryType}</td>
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && <tr><td colSpan="6" className="st-age-empty">No pregnancy records match these filters.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
};

/* ════════════════════════════
   CHARTS SECTION
════════════════════════════ */
const ChartsSection = ({ stations }) => {
    const coverageClass = (v) => v >= 90 ? 'green' : v >= 80 ? 'amber' : 'red';
    const maxPatients = stations.length > 0 ? Math.max(...stations.map(b => b.totalPatients)) : 1;
    const totalWithConditions = stations.reduce((sum, s) => sum + (s.withHealthConditions || 0), 0);
    const maxWithConditions = stations.length > 0 ? Math.max(...stations.map(b => b.withHealthConditions || 0), 1) : 1;

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

            {/* Chart 2: Pregnancies with Health Conditions */}
            <div className="st-chart-card st-chart-card--risk">
                <div className="st-chart-header st-chart-header--split">
                    <div className="st-chart-header-left">
                        <div className="st-chart-icon st-chart-icon--risk">
                            <HeartPulse size={18} />
                        </div>
                        <div className="st-chart-title-group">
                            <h3 className="st-chart-title">Pregnancies with Health Conditions</h3>
                            <p className="st-chart-subtitle">Total pregnant patients with documented health conditions across all stations</p>
                        </div>
                    </div>
                    <div className="st-risk-header-summary">
                        <span className="st-risk-summary-count">{totalWithConditions}</span>
                        <div className="st-risk-summary-meta">
                            <span className="st-risk-summary-label">Pregnancies with Health Conditions</span>
                            <span className="st-risk-summary-sub">Across {stations.length} stations</span>
                        </div>
                    </div>
                </div>
                <div className="st-chart-body">
                    <div className="st-risk-dist-title">Distribution by Station</div>
                    <div className="st-vbar-chart st-vbar-chart--health">
                        {stations.map(b => {
                            const count = b.withHealthConditions || 0;
                            const heightPercent = maxWithConditions > 0 ? Math.round((count / maxWithConditions) * 100) : 0;
                            return (
                                <div key={b.id} className="st-vbar-col">
                                    <div className="st-vbar-bar-wrap st-vbar-bar-wrap--health">
                                        <div
                                            className="st-vbar-bar st-vbar-bar--rose"
                                            style={{ height: `${heightPercent}%` }}
                                            title={`${b.name}: ${count}`}
                                        />
                                    </div>
                                    <span className="st-vbar-val">{count}</span>
                                    <span className="st-vbar-label">{b.name.split('–')[0].trim()}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="st-risk-warning">
                        <HeartPulse size={13} />
                        <span>Pregnant patients with documented health conditions across CHO III stations.</span>
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
    const [showDetailExportModal, setShowDetailExportModal] = useState(false);

    const handleDetailExport = (exportConfig) => {
        const { format, reportPeriodText } = exportConfig;
        const exportData = [{
            'Station': station.name,
            'Total Patients': station.totalPatients,
            'With Health Conditions': station.withHealthConditions || 0,
            'Deliveries (Month)': station.recentDeliveries,
            'NSD': station.deliveryTypes?.nsd || 0,
            'CS': station.deliveryTypes?.cs || 0,
            'Complications': station.complications || 0,
            'Newborns': station.newborns,
            'Low Birth Weight': station.lbwBabies || 0,
            'NICU': station.nicuBabies || 0,
            'Vaccination Coverage (%)': station.vaccCoverage,
            'Supplement Coverage (%)': station.suppCoverage,
            '1st Trimester': station.trimester?.first || 0,
            '2nd Trimester': station.trimester?.second || 0,
            '3rd Trimester': station.trimester?.third || 0,
        }];

        if (format === 'excel') {
            let worksheetData = [
                [`Report: ${station.name} — Station Detail Report`],
                [`Generated: ${new Date().toLocaleString()}`],
                [`Period: ${reportPeriodText}`],
                []
            ];
            worksheetData = worksheetData.concat([
                Object.keys(exportData[0]),
                ...exportData.map(obj => Object.values(obj))
            ]);
            const ws = XLSX.utils.aoa_to_sheet(worksheetData);
            ws['!cols'] = Object.keys(exportData[0]).map(key => ({ wch: Math.max(key.length, 15) }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Station Detail');
            XLSX.writeFile(wb, `Station_${station.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } else if (format === 'pdf') {
            const doc = new jsPDF('landscape');
            doc.setFontSize(16);
            doc.text(`${station.name} — Station Detail Report`, 14, 20);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            doc.text(`Period: ${reportPeriodText}`, 14, 34);
            const head = [Object.keys(exportData[0])];
            const body = exportData.map(obj => Object.values(obj));
            doc.autoTable({
                startY: 42,
                head,
                body,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [185, 129, 138] }
            });
            doc.save(`Station_${station.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        }
    };

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
                                <div className="detail-stat detail-stat--rose"><span>With Health Conditions</span><strong>{station.withHealthConditions || 0}</strong></div>
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
                                <div className="detail-stat"><span>Newborn Vaccines</span><strong>{station.newbornVaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Supplement Coverage</span><strong>{station.suppCoverage}%</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>Coverage Breakdown</h4>
                                {[
                                    { label: 'Overall Vaccination', value: station.vaccCoverage },
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
                    <button className="btn btn-outline" onClick={() => setShowDetailExportModal(true)}>
                        <Download size={14} /> Export
                    </button>
                    <ExportModal
                        isOpen={showDetailExportModal}
                        onClose={() => setShowDetailExportModal(false)}
                        onExport={handleDetailExport}
                    />
                    <button className="btn btn-primary"><FileText size={14} /> Generate Full Report</button>
                </div>
            </div>
        </div>
    );
};
