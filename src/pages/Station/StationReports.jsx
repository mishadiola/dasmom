import React, { useState, useEffect, useMemo, useRef, useCallback, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, MapPin, Users, AlertTriangle,
    Baby, Syringe, Pill, TrendingUp, TrendingDown, Download,
    ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
    FileText, Activity, Heart, HeartPulse, BarChart3, Clock, Building2, Stethoscope
} from 'lucide-react';
import '../../styles/pages/StationReports.css';
import PatientService from '../../services/patientservice';
import Legend from '../../components/Legend/Legend';
import supabase from '../../config/supabaseclient';
import ExportModal from '../../components/ExportModal';
import ActionTooltip from '../../components/Common/ActionTooltip';
import StaffPageLoader from '../../components/Common/StaffPageLoader';
import { exportStandardStaffPdf } from '../../utils/staffPdfTemplate';
import { AuthContext } from '../../context/AuthContext';
import { useDefaultStation } from '../../hooks/useDefaultStation';
import { useRolePermissions } from '../../context/RolePermissionContext';
import ReportTemplateBuilder from '../../components/ReportTemplateBuilder';
import {
    assertReportPermission,
    STATION_TEMPLATE_FIELDS,
    TEMPLATE_PERMISSION_KEYS
} from '../../utils/reportTemplateUtils';

/* ════════════════════════════
   HELPERS & LEGEND DEFINITIONS
════════════════════════════ */
const formatStationName = (name) => {
    if (!name) return '';
    return name
        .split(' ')
        .map(word => {
            const lower = word.toLowerCase();
            if (lower === 'cho' || lower === 'iii' || lower === 'ii' || lower === 'iv') {
                return word.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
};

const STATION_LEGEND_CATEGORIES = [
    {
        title: "Coverage Benchmarks",
        items: [
            { label: "≥90% Target Met", style: { background: "rgba(123, 174, 94, 0.15)", color: "#4a7a30", fontWeight: 700 } },
            { label: "80–89% Moderate", style: { background: "rgba(212, 160, 60, 0.15)", color: "#8a6a20", fontWeight: 700 } },
            { label: "<80% Needs Improvement", style: { background: "rgba(199, 88, 106, 0.15)", color: "#943848", fontWeight: 700 } },
            { label: "N/A — No Eligible Patients", style: { background: "rgba(100, 116, 139, 0.12)", color: "#475569", fontWeight: 700 } }
        ]
    },
    {
        title: "Indicator Definitions",
        items: [
            {
                label: "Vaccination Completion: Completed maternal and newborn vaccine doses out of all non-cancelled doses recorded in the selected period.",
                style: { background: "#f8fafc", color: "#334155", textAlign: "left", fontSize: "11px", fontWeight: 500, lineHeight: "1.4" }
            },
            {
                label: "Supplement Coverage: Active pregnant patients with completed micronutrient supplementation (Iron, Folic Acid, Calcium).",
                style: { background: "#f8fafc", color: "#334155", textAlign: "left", fontSize: "11px", fontWeight: 500, lineHeight: "1.4" }
            },
            {
                label: "Trimester Mix: Distribution of active pregnant patients across 1st (≤12w), 2nd (13–26w), and 3rd (≥27w) trimesters.",
                style: { background: "#f8fafc", color: "#334155", textAlign: "left", fontSize: "11px", fontWeight: 500, lineHeight: "1.4" }
            }
        ]
    }
];

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const StationReports = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { hasPermission } = useRolePermissions();
    const canExportStation = hasPermission(TEMPLATE_PERMISSION_KEYS.exportStation);
    const [stations, setStations] = useState([]);
    const stationNames = useMemo(() => stations.map(s => s.name), [stations]);
    const {
        assignedStation,
        isStationStaff,
        canViewOtherStations,
        availableStations: permittedStations,
        matchStation
    } = useDefaultStation({
        permissionKey: 'patient.view.other_station',
        allStations: stationNames,
        isArray: false
    });
    const userStation = assignedStation || user?.station || null;

    const [searchTerm, setSearchTerm] = useState('');
    const [stationFilter, setStationFilter] = useState(() => (
        isStationStaff && userStation ? userStation : 'All'
    ));
    const userHasChangedStationRef = useRef(false);

    useEffect(() => {
        if (!userHasChangedStationRef.current && isStationStaff && userStation) {
            setStationFilter(prev => prev !== 'All' ? prev : userStation);
        }
    }, [isStationStaff, userStation]);

    const [selectedStation, setSelectedStation] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [showCharts, setShowCharts] = useState(true);
    const [reportDateRange, setReportDateRange] = useState('quarterly');
    const mounted = useRef(false);
    const reportRequestId = useRef(0);
    const fetchInFlightRef = useRef(false);
    const pendingRefreshRef = useRef(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const patientService = useMemo(() => new PatientService(), []);
    const reportDateRangeRef = useRef(reportDateRange);
    const hasStationDataRef = useRef(false);
    reportDateRangeRef.current = reportDateRange;

    // Determine authorized stations based on role and permissions:
    // If Station Staff cannot view other stations, they see ONLY their assigned station.
    // If they have cross-station viewing permissions, or are Admin/CHO, they can view stations.
    const authorizedStations = useMemo(() => {
        if (!isStationStaff || canViewOtherStations) return stations;
        if (!userStation) return stations.length > 0 ? [stations[0]] : [];
        const matched = stations.filter(s => 
            s.name?.toLowerCase() === userStation.toLowerCase() ||
            formatStationName(s.name).toLowerCase() === formatStationName(userStation).toLowerCase()
        );
        return matched.length > 0 ? matched : (stations.length > 0 ? [stations[0]] : []);
    }, [stations, isStationStaff, canViewOtherStations, userStation]);

    const activeStationFilter = (isStationStaff && !canViewOtherStations)
        ? (authorizedStations[0]?.name || userStation || '')
        : stationFilter;

    const fetchStationData = useCallback(async (isSilent = false) => {
        if (fetchInFlightRef.current) {
            pendingRefreshRef.current = true;
            return;
        }
        fetchInFlightRef.current = true;
        const requestId = ++reportRequestId.current;
        try {
            if (!isSilent && !hasStationDataRef.current) {
                setLoading(true);
            }
            setError(null);
            const data = await patientService.getStationReports(reportDateRangeRef.current);
            if (!mounted.current || requestId !== reportRequestId.current) return;
            setStations(data);
            hasStationDataRef.current = true;
        } catch (error) {
            console.error('Error fetching station data:', error);
            if (mounted.current && requestId === reportRequestId.current) setError(error);
        } finally {
            if (mounted.current && requestId === reportRequestId.current) setLoading(false);
            fetchInFlightRef.current = false;
            if (pendingRefreshRef.current && mounted.current) {
                pendingRefreshRef.current = false;
                setTimeout(() => {
                    if (mounted.current) fetchStationData(true);
                }, 0);
            }
        }
    }, [patientService]);

    useEffect(() => {
        fetchStationData();
    }, [fetchStationData, reportDateRange]);

    useEffect(() => {
        let refreshTimer = null;
        mounted.current = true;

        const channel = supabase
            .channel('station-reports-live-data');
        const scheduleRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                fetchStationData();
            }, 250);
        };
        const realtimeTables = ['stations', 'patient_basic_info', 'pregnancy_info', 'prenatal_visits', 'postpartum_visits', 'deliveries', 'newborns', 'vaccinations', 'supplements'];
        realtimeTables.forEach(table => {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
        });
        channel.subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(`Station Reports Supabase Realtime subscription failed: ${status}`, error || '');
            }
        });

        return () => {
            mounted.current = false;
            reportRequestId.current += 1;
            if (refreshTimer) clearTimeout(refreshTimer);
            supabase.removeChannel(channel);
        };
    }, [fetchStationData]);

    const filtered = useMemo(() => {
        return authorizedStations.filter(b => {
            const matchesStation = (isStationStaff && !canViewOtherStations) || activeStationFilter === 'All' || b.name === activeStationFilter || formatStationName(b.name).toLowerCase() === formatStationName(activeStationFilter).toLowerCase();
            const matchesSearch = !searchTerm || b.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesStation && matchesSearch;
        });
    }, [authorizedStations, isStationStaff, canViewOtherStations, activeStationFilter, searchTerm]);

    const templateRows = useMemo(() => filtered.map(station => ({
        name: station.name,
        totalPatients: station.totalPatients,
        withHealthConditions: station.withHealthConditions || 0,
        recentDeliveries: station.recentDeliveries,
        newborns: station.newborns,
        vaccCoverage: station.vaccCoverage,
        completedVaccinations: station.completedVaccinations || 0,
        totalVaccinations: station.totalVaccinations || 0,
        suppCoverage: station.suppCoverage,
        missedAppointments: station.missedAppointments || 0,
        appointmentsDue: station.appointmentsDue || 0,
        missedRate: station.missedRate || 0,
        trimesterFirst: station.trimester?.first || 0,
        trimesterSecond: station.trimester?.second || 0,
        trimesterThird: station.trimester?.third || 0,
        complications: station.complications || 0
    })), [filtered]);

    const getCoverageClass = (v) => v >= 90 ? 'green' : v >= 80 ? 'amber' : 'red';

    const [showExportModal, setShowExportModal] = useState(false);
    const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);

    const handleExport = async (exportConfig) => {
        await assertReportPermission(supabase, TEMPLATE_PERMISSION_KEYS.exportStation);
        const { format, reportPeriodText } = exportConfig;
        const exportStations = (isStationStaff && !canViewOtherStations)
            ? authorizedStations
            : (activeStationFilter === 'All' ? stations : stations.filter(s => s.name === activeStationFilter || formatStationName(s.name) === formatStationName(activeStationFilter)));
        const exportData = exportStations.map(s => ({
            'Station': s.name,
            'Total Patients': s.totalPatients,
            'With Health Conditions': s.withHealthConditions,
            'Deliveries (Month)': s.recentDeliveries,
            'Newborns': s.newborns,
            'Vaccination Completion (%)': s.vaccCoverage,
            'Completed Vaccination Doses': s.completedVaccinations || 0,
            'Total Vaccination Doses': s.totalVaccinations || 0,
            'Supplement Coverage (%)': s.suppCoverage,
            'Missed Appointments': s.missedAppointments || 0,
            'Appointments in Period': s.appointmentsDue || 0,
            'Missed Rate (%)': s.missedRate || 0,
            '1st Trimester': s.trimester?.first || 0,
            '2nd Trimester': s.trimester?.second || 0,
            '3rd Trimester': s.trimester?.third || 0,
            'Complications': s.complications || 0,
        }));

        if (format === 'excel') {
            const XLSX = await import('xlsx');
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
            const dateStr = new Date().toISOString().split('T')[0];
            const head = exportData.length > 0 ? [Object.keys(exportData[0])] : [["Station", "Total Patients", "With Health Conditions", "Deliveries", "Newborns", "Vaccination Completion (%)", "Supplement Coverage (%)"]];
            const body = exportData.length > 0 ? exportData.map(obj => Object.values(obj)) : [];

            exportStandardStaffPdf({
                orientation: 'landscape',
                title: (isStationStaff && !canViewOtherStations) ? `${formatStationName(authorizedStations[0]?.name || userStation)} Station Report` : (activeStationFilter === 'All' ? 'Station Reports Summary' : `${formatStationName(activeStationFilter)} Station Report`),
                period: reportPeriodText || 'All Dates',
                station: (isStationStaff && !canViewOtherStations) ? formatStationName(authorizedStations[0]?.name || userStation) : (activeStationFilter === 'All' ? 'All Stations' : formatStationName(activeStationFilter)),
                totalRecords: exportData.length,
                head: head,
                body: body,
                filename: `Station_Reports_${dateStr}.pdf`
            });
        }
    };

    // Calculate derived summary values (scoped to authorized stations)
    const totalStations = authorizedStations.length;
    const totalPatients = authorizedStations.reduce((sum, s) => sum + s.totalPatients, 0);
    const totalWithConditions = authorizedStations.reduce((sum, s) => sum + (s.withHealthConditions || 0), 0);
    const totalDeliveries = authorizedStations.reduce((sum, s) => sum + s.recentDeliveries, 0);
    const totalNewborns = authorizedStations.reduce((sum, s) => sum + s.newborns, 0);

    if (loading || error) {
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
                    <p className="page-subtitle">Compare patient records, documented health conditions, and maternal-newborn care services across CHO III stations.</p>
                </div>
                <div className="header-actions">
                    <label className="st-period-filter">
                        <span>Period</span>
                        <select
                            className="st-station-filter-select"
                            value={reportDateRange}
                            onChange={event => setReportDateRange(event.target.value)}
                            aria-label="Station report date range"
                        >
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="semiannual">Semi Annual</option>
                            <option value="annual">Annual</option>
                        </select>
                    </label>
                    <button className="btn btn-outline" onClick={() => setShowTemplateBuilder(true)}>
                        <FileText size={16} /> Create Format
                    </button>
                    {canExportStation && (
                        <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
                            <Download size={16} /> Export Report
                        </button>
                    )}
                </div>
            </div>

            {/* ── Summary Statistics (5 Compact White Cards with Subtle Colored Accents) ── */}
            {!loading && (
                <div className="st-summary-grid">
                    <div 
                        className="st-stat-card st-stat-card--lavender st-stat-card--clickable" 
                        onClick={() => navigate('/dashboard/stations')} 
                        role="button" 
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard/stations'); }}
                    >
                        <div className="st-stat-icon st-stat-icon--lavender">
                            <Building2 size={18} />
                        </div>
                        <div className="st-stat-info">
                            <span className="st-stat-value">{totalStations}</span>
                            <span className="st-stat-label">Stations</span>
                        </div>
                    </div>

                    <div 
                        className="st-stat-card st-stat-card--sage st-stat-card--clickable" 
                        onClick={() => navigate('/dashboard/patients')} 
                        role="button" 
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard/patients'); }}
                    >
                        <div className="st-stat-icon st-stat-icon--sage">
                            <Users size={18} />
                        </div>
                        <div className="st-stat-info">
                            <span className="st-stat-value">{totalPatients.toLocaleString()}</span>
                            <span className="st-stat-label">Registered Patients</span>
                        </div>
                    </div>

                    <div 
                        className="st-stat-card st-stat-card--rose st-stat-card--clickable" 
                        onClick={() => navigate('/dashboard/high-risk')} 
                        role="button" 
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard/high-risk'); }}
                    >
                        <div className="st-stat-icon st-stat-icon--rose">
                            <HeartPulse size={18} />
                        </div>
                        <div className="st-stat-info">
                            <span className="st-stat-value">{totalWithConditions}</span>
                            <span className="st-stat-label">Pregnancies with Health Conditions</span>
                        </div>
                    </div>

                    <div 
                        className="st-stat-card st-stat-card--peach st-stat-card--clickable" 
                        onClick={() => navigate('/dashboard/deliveries')} 
                        role="button" 
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard/deliveries'); }}
                    >
                        <div className="st-stat-icon st-stat-icon--peach">
                            <Heart size={18} />
                        </div>
                        <div className="st-stat-info">
                            <span className="st-stat-value">{totalDeliveries}</span>
                            <span className="st-stat-label">Deliveries</span>
                        </div>
                    </div>

                    <div 
                        className="st-stat-card st-stat-card--pink st-stat-card--clickable" 
                        onClick={() => navigate('/dashboard/newborns')} 
                        role="button" 
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard/newborns'); }}
                    >
                        <div className="st-stat-icon st-stat-icon--pink">
                            <Baby size={18} />
                        </div>
                        <div className="st-stat-info">
                            <span className="st-stat-value">{totalNewborns}</span>
                            <span className="st-stat-label">Newborns</span>
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
                            <p className="st-overview-subtitle">
                                {(isStationStaff && !canViewOtherStations) 
                                    ? `Showing authorized station report for ${formatStationName(authorizedStations[0]?.name || userStation)}`
                                    : (activeStationFilter === 'All' 
                                        ? `Performance summary across ${totalStations} CHO III stations`
                                        : `Showing performance for ${formatStationName(activeStationFilter)}`)}
                            </p>
                        </div>
                        <div className="st-overview-meta">
                            <div className="st-station-filter-wrapper">
                                <Filter size={14} className="st-station-filter-icon" />
                                {isStationStaff && !canViewOtherStations ? (
                                    <select 
                                        id="station-table-filter" 
                                        className="st-station-filter-select"
                                        value={authorizedStations[0]?.name || userStation || ''}
                                        disabled
                                        aria-label="Assigned station"
                                    >
                                        <option value={authorizedStations[0]?.name || userStation || ''}>
                                            {formatStationName(authorizedStations[0]?.name || userStation)} (Assigned Station)
                                        </option>
                                    </select>
                                ) : (
                                    <select 
                                        id="station-table-filter" 
                                        className="st-station-filter-select"
                                        value={stationFilter}
                                        onChange={(e) => {
                                            userHasChangedStationRef.current = true;
                                            setStationFilter(e.target.value);
                                        }}
                                        aria-label="Filter by station"
                                    >
                                        <option value="All">All Stations ({stations.length})</option>
                                        {stations.map(b => (
                                            <option key={b.id || b.name} value={b.name}>
                                                {formatStationName(b.name)}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <ChevronDown size={14} className="st-station-filter-chevron" />
                            </div>

                            <Legend categories={STATION_LEGEND_CATEGORIES} />

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
                                    <th>Vaccination Completion</th>
                                    <th>Newborns</th>
                                    <th>Supplement Coverage</th>
                                    <th>Trimester Mix</th>
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
                                                        <span className="st-station-name">{formatStationName(b.name)}</span>
                                                    </div>
                                                </td>
                                                <td><span className="st-num">{b.totalPatients.toLocaleString()}</span></td>
                                                <td><span className="st-num">{b.withHealthConditions}</span></td>
                                                <td><span className="st-num">{b.recentDeliveries}</span></td>
                                                <td>
                                                    <div className="st-coverage-cell">
                                                        <span className="st-coverage-val">{b.vaccCoverage}%</span>
                                                        <div className="st-mini-progress" title={`Vaccination Completion: ${b.vaccCoverage}%`}>
                                                            <div
                                                                className={`st-mini-progress-fill st-mini-progress-fill--${getCoverageClass(b.vaccCoverage)}`}
                                                                style={{ width: `${Math.min(100, Math.max(0, b.vaccCoverage))}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span className="st-num">{b.newborns}</span></td>
                                                <td>
                                                    {(!b.totalPatients || b.totalPatients <= 0) ? (
                                                        <span className="st-na-badge" title="No active pregnant patients recorded for this station">N/A</span>
                                                    ) : (
                                                        <div className="st-coverage-cell">
                                                            <span className="st-coverage-val">{b.suppCoverage}%</span>
                                                            <div className="st-mini-progress" title={`Supplement Coverage: ${b.suppCoverage}%`}>
                                                                <div 
                                                                    className={`st-mini-progress-fill st-mini-progress-fill--${getCoverageClass(b.suppCoverage)}`} 
                                                                    style={{ width: `${Math.min(100, Math.max(0, b.suppCoverage))}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {total === 0 ? (
                                                        <span className="st-na-badge" title="No active pregnant patients tracked">N/A</span>
                                                    ) : (
                                                        <div className="st-trimester-pills">
                                                            <span className="st-tri-pill st-tri-pill--1st" title={`1st Trimester: ${b.trimester.first}`}>1st {p1}%</span>
                                                            <span className="st-tri-pill st-tri-pill--2nd" title={`2nd Trimester: ${b.trimester.second}`}>2nd {p2}%</span>
                                                            <span className="st-tri-pill st-tri-pill--3rd" title={`3rd Trimester: ${b.trimester.third}`}>3rd {p3}%</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Expanded inline view */}
                                            {expandedRow === b.id && (
                                                <tr className="st-expanded-row">
                                                    <td colSpan="8">
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
                                        <td colSpan="8" className="st-empty">
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

            {/* ── Station Performance Charts Section ── */}
            <div className="st-charts-wrapper">
                <div className="st-charts-bar">
                    <div className="st-charts-bar-left">
                        <h3 className="st-charts-heading">
                            <BarChart3 size={18} /> Station Performance Charts
                        </h3>
                        <span className="st-charts-subheading">
                            Compare patient distribution, health conditions, service coverage, and appointment monitoring across stations.
                        </span>
                    </div>
                    <button 
                        type="button" 
                        className="btn btn-outline st-charts-toggle-btn" 
                        onClick={() => setShowCharts(v => !v)}
                        aria-expanded={showCharts}
                    >
                        <Activity size={16} /> {showCharts ? 'Hide Charts' : 'Show Charts'}
                    </button>
                </div>
                {showCharts && <ChartsSection stations={authorizedStations} isStationStaff={isStationStaff} />}
            </div>

            {/* ── Footer Timestamp ── */}
            <div className="st-footer-timestamp">
                <Clock size={13} />
                Data last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>

            {/* ── Detail Modal ── */}
            {selectedStation && <DetailModal station={selectedStation} onClose={() => setSelectedStation(null)} navigate={navigate} canExport={canExportStation} />}

            <ExportModal
                isOpen={showExportModal && canExportStation}
                onClose={() => setShowExportModal(false)}
                onExport={handleExport}
            />
            <ReportTemplateBuilder
                isOpen={showTemplateBuilder}
                onClose={() => setShowTemplateBuilder(false)}
                reportType="station.summary"
                reportTypeLabel="Station Reports"
                fields={STATION_TEMPLATE_FIELDS}
                fieldMode="columns"
                dataRows={templateRows}
                context={{
                    period: ({ monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semi Annual', annual: 'Annual' })[reportDateRange] || reportDateRange,
                    station: activeStationFilter === 'All' ? 'All authorized stations' : activeStationFilter,
                    filters: searchTerm ? `Search: ${searchTerm}` : 'Current station and access filters'
                }}
                exportPermissionKey={TEMPLATE_PERMISSION_KEYS.exportStation}
            />
        </div>
    );
};

export default StationReports;

/* ════════════════════════════
   CHARTS SECTION
════════════════════════════ */
const ChartsSection = ({ stations, isStationStaff = false }) => {
    const [activeTooltipId, setActiveTooltipId] = useState(null);

    const coverageClass = (v) => v >= 90 ? 'green' : v >= 80 ? 'amber' : 'red';
    const maxPatients = stations.length > 0 ? Math.max(...stations.map(b => b.totalPatients || 0), 1) : 1;
    const totalWithConditions = stations.reduce((sum, s) => sum + (s.withHealthConditions || 0), 0);
    const maxWithConditions = stations.length > 0 ? Math.max(...stations.map(b => b.withHealthConditions || 0), 1) : 1;
    const maxMissed = stations.length > 0 ? Math.max(...stations.map(b => b.missedAppointments || 0), 1) : 1;
    const totalMissed = stations.reduce((sum, s) => sum + (s.missedAppointments || 0), 0);

    // Sort stations by coverage for coverage charts
    const sortedByVacc = [...stations].sort((a, b) => b.vaccCoverage - a.vaccCoverage);
    const sortedBySupp = [...stations].sort((a, b) => b.suppCoverage - a.suppCoverage);

    const handleToggleTooltip = (key) => {
        setActiveTooltipId(prev => prev === key ? null : key);
    };

    return (
        <div className="st-charts-container">
            {/* ── GROUP 1: PATIENT DISTRIBUTION ── */}
            <div className="st-chart-group">
                <div className="st-chart-group-label">PATIENT DISTRIBUTION</div>
                <div className="st-charts-grid">
                    {/* Left: Registered Patients by Station */}
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
                                {stations.map(b => {
                                    const count = b.totalPatients || 0;
                                    const heightPercent = maxPatients > 0 ? Math.round((count / maxPatients) * 100) : 0;
                                    const tKey = `pat-${b.id || b.name}`;
                                    const isTooltipOpen = activeTooltipId === tKey;

                                    return (
                                        <div 
                                            key={b.id || b.name} 
                                            className={`st-vbar-col ${isTooltipOpen ? 'is-tooltip-active' : ''}`}
                                            onMouseEnter={() => setActiveTooltipId(tKey)}
                                            onMouseLeave={() => setActiveTooltipId(null)}
                                            onClick={() => handleToggleTooltip(tKey)}
                                            tabIndex={0}
                                        >
                                            <div className="st-vbar-bar-wrap">
                                                <div
                                                    className="st-vbar-bar st-vbar-bar--purple"
                                                    style={{ height: `${heightPercent}%` }}
                                                />
                                                {/* Tooltip */}
                                                <div className="st-chart-tooltip st-chart-tooltip--top">
                                                    <div className="st-tooltip-title">{formatStationName(b.name)}</div>
                                                    <div className="st-tooltip-divider" />
                                                    <div className="st-tooltip-row">
                                                        <span>Total Registered:</span>
                                                        <strong>{count.toLocaleString()}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="st-vbar-val">{count.toLocaleString()}</span>
                                            <span className="st-vbar-label">{formatStationName(b.name.split('–')[0].trim())}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right: Pregnancies with Health Conditions */}
                    <div className="st-chart-card st-chart-card--risk">
                        <div className="st-chart-header">
                            <div className="st-chart-icon st-chart-icon--risk">
                                <HeartPulse size={18} />
                            </div>
                            <div className="st-chart-title-group">
                                <h3 className="st-chart-title">Pregnancies with Health Conditions</h3>
                                <p className="st-chart-subtitle">{isStationStaff ? 'Documented conditions for assigned station' : 'Documented conditions across all stations'}</p>
                            </div>
                        </div>
                        <div className="st-chart-body">
                            <div className="st-risk-dist-title">Distribution by Station</div>
                            <div className="st-vbar-chart st-vbar-chart--health">
                                {stations.map(b => {
                                    const count = b.withHealthConditions || 0;
                                    const heightPercent = maxWithConditions > 0 ? Math.round((count / maxWithConditions) * 100) : 0;
                                    const tKey = `risk-${b.id || b.name}`;
                                    const isTooltipOpen = activeTooltipId === tKey;

                                    return (
                                        <div 
                                            key={b.id || b.name} 
                                            className={`st-vbar-col ${isTooltipOpen ? 'is-tooltip-active' : ''}`}
                                            onMouseEnter={() => setActiveTooltipId(tKey)}
                                            onMouseLeave={() => setActiveTooltipId(null)}
                                            onClick={() => handleToggleTooltip(tKey)}
                                            tabIndex={0}
                                        >
                                            <div className="st-vbar-bar-wrap st-vbar-bar-wrap--health">
                                                <div
                                                    className="st-vbar-bar st-vbar-bar--rose"
                                                    style={{ height: `${heightPercent}%` }}
                                                />
                                                {/* Tooltip */}
                                                <div className="st-chart-tooltip st-chart-tooltip--top">
                                                    <div className="st-tooltip-title">{formatStationName(b.name)}</div>
                                                    <div className="st-tooltip-divider" />
                                                    <div className="st-tooltip-row">
                                                        <span>With Conditions:</span>
                                                        <strong>{count}</strong>
                                                    </div>
                                                    <div className="st-tooltip-row">
                                                        <span>Total Patients:</span>
                                                        <span>{b.totalPatients || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="st-vbar-val">{count}</span>
                                            <span className="st-vbar-label">{formatStationName(b.name.split('–')[0].trim())}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="st-risk-warning">
                                <span className="st-risk-total">Total: {totalWithConditions}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── GROUP 2: HEALTH SERVICE COVERAGE ── */}
            <div className="st-chart-group">
                <div className="st-chart-group-label">HEALTH SERVICE COVERAGE</div>
                <div className="st-charts-grid">
                    {/* Left: Vaccination Completion by Station */}
                    <div className="st-chart-card">
                        <div className="st-chart-header">
                            <div className="st-chart-icon st-chart-icon--vacc">
                                <Syringe size={18} />
                            </div>
                            <div className="st-chart-title-group">
                                <h3 className="st-chart-title">Vaccination Completion by Station</h3>
                                <p className="st-chart-subtitle">Maternal and newborn doses completed in the selected period</p>
                            </div>
                        </div>
                        <div className="st-chart-body">
                            <div className="st-hbar-chart">
                                {sortedByVacc.map(b => {
                                    const hasEligible = (b.totalVaccinations || 0) > 0;
                                    const tKey = `vacc-${b.id || b.name}`;
                                    const isTooltipOpen = activeTooltipId === tKey;

                                    return (
                                        <div 
                                            key={b.id || b.name} 
                                            className={`st-hbar-row ${isTooltipOpen ? 'is-tooltip-active' : ''}`}
                                            onMouseEnter={() => setActiveTooltipId(tKey)}
                                            onMouseLeave={() => setActiveTooltipId(null)}
                                            onClick={() => handleToggleTooltip(tKey)}
                                            tabIndex={0}
                                        >
                                            <span className="st-hbar-label">{formatStationName(b.name.split('–')[0].trim())}</span>
                                            <div className="st-hbar-bar-wrap">
                                                <div className="st-hbar-track">
                                                    <div
                                                        className={`st-hbar-fill st-hbar-fill--${hasEligible ? coverageClass(b.vaccCoverage) : 'empty'}`}
                                                        style={{ width: `${hasEligible ? b.vaccCoverage : 0}%` }}
                                                    />
                                                </div>
                                                {/* Tooltip */}
                                                <div className="st-chart-tooltip st-chart-tooltip--hbar">
                                                    <div className="st-tooltip-title">{formatStationName(b.name)}</div>
                                                    <div className="st-tooltip-divider" />
                                                    <div className="st-tooltip-row">
                                                        <span>Completed Doses:</span>
                                                        <strong>{b.completedVaccinations || 0}</strong>
                                                    </div>
                                                    <div className="st-tooltip-row">
                                                        <span>Total Doses:</span>
                                                        <strong>{b.totalVaccinations || 0}</strong>
                                                    </div>
                                                    <div className="st-tooltip-row">
                                                        <span>Coverage:</span>
                                                        <strong>{b.vaccCoverage}%</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="st-hbar-val">{b.vaccCoverage}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right: Supplement Coverage by Station */}
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
                                {sortedBySupp.map(b => {
                                    const hasEligible = (b.totalPatients || 0) > 0;
                                    const tKey = `supp-${b.id || b.name}`;
                                    const isTooltipOpen = activeTooltipId === tKey;

                                    return (
                                        <div 
                                            key={b.id || b.name} 
                                            className={`st-hbar-row ${isTooltipOpen ? 'is-tooltip-active' : ''}`}
                                            onMouseEnter={() => setActiveTooltipId(tKey)}
                                            onMouseLeave={() => setActiveTooltipId(null)}
                                            onClick={() => handleToggleTooltip(tKey)}
                                            tabIndex={0}
                                        >
                                            <span className="st-hbar-label">{formatStationName(b.name.split('–')[0].trim())}</span>
                                            <div className="st-hbar-bar-wrap">
                                                <div className="st-hbar-track">
                                                    <div
                                                        className={`st-hbar-fill st-hbar-fill--${hasEligible ? coverageClass(b.suppCoverage) : 'empty'}`}
                                                        style={{ width: `${hasEligible ? b.suppCoverage : 0}%` }}
                                                    />
                                                </div>
                                                {/* Tooltip */}
                                                <div className="st-chart-tooltip st-chart-tooltip--hbar">
                                                    <div className="st-tooltip-title">{formatStationName(b.name)}</div>
                                                    <div className="st-tooltip-divider" />
                                                    <div className="st-tooltip-row">
                                                        <span>Unique Mothers Received:</span>
                                                        <strong>{b.totalSupplementsGiven || 0}</strong>
                                                    </div>
                                                    <div className="st-tooltip-row">
                                                        <span>Total Eligible Mothers:</span>
                                                        <strong>{b.totalPatients || 0}</strong>
                                                    </div>
                                                    <div className="st-tooltip-row">
                                                        <span>Coverage:</span>
                                                        <strong>{hasEligible ? `${b.suppCoverage}%` : 'N/A'}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="st-hbar-val">{hasEligible ? `${b.suppCoverage}%` : 'N/A'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── GROUP 3: APPOINTMENT MONITORING (Full Width) ── */}
            <div className="st-chart-group">
                <div className="st-chart-group-label">APPOINTMENT MONITORING</div>
                <div className="st-charts-grid st-charts-grid--full">
                    <div className="st-chart-card st-chart-card--missed">
                        <div className="st-chart-header">
                            <div className="st-chart-icon st-chart-icon--missed">
                                <Clock size={18} />
                            </div>
                            <div className="st-chart-title-group">
                                <h3 className="st-chart-title">Missed Appointments by Station</h3>
                                <p className="st-chart-subtitle">Missed prenatal, postpartum, and vaccination appointments in the selected period.</p>
                            </div>
                        </div>
                        <div className="st-chart-body">
                            <div className="st-vbar-chart st-vbar-chart--missed">
                                {stations.map(b => {
                                    const missed = b.missedAppointments || 0;
                                    const due = b.appointmentsDue || 0;
                                    const hasDue = due > 0;
                                    const rateText = hasDue ? `${b.missedRate ?? Math.round((missed / due) * 100)}%` : 'N/A';
                                    const heightPercent = maxMissed > 0 ? Math.round((missed / maxMissed) * 100) : 0;
                                    const tKey = `missed-${b.id || b.name}`;
                                    const isTooltipOpen = activeTooltipId === tKey;

                                    return (
                                        <div 
                                            key={b.id || b.name} 
                                            className={`st-vbar-col ${isTooltipOpen ? 'is-tooltip-active' : ''}`}
                                            onMouseEnter={() => setActiveTooltipId(tKey)}
                                            onMouseLeave={() => setActiveTooltipId(null)}
                                            onClick={() => handleToggleTooltip(tKey)}
                                            tabIndex={0}
                                        >
                                            <div className="st-vbar-bar-wrap st-vbar-bar-wrap--missed">
                                                <div
                                                    className="st-vbar-bar st-vbar-bar--peach"
                                                    style={{ height: `${heightPercent}%` }}
                                                />
                                                {/* Tooltip */}
                                                <div className="st-chart-tooltip st-chart-tooltip--top">
                                                    <div className="st-tooltip-title">{formatStationName(b.name)}</div>
                                                    <div className="st-tooltip-divider" />
                                                    <div className="st-tooltip-row">
                                                        <span>Missed Appointments:</span>
                                                        <strong>{missed}</strong>
                                                    </div>
                                                    <div className="st-tooltip-row">
                                                        <span>Appointments in Period:</span>
                                                        <strong>{due}</strong>
                                                    </div>
                                                    <div className="st-tooltip-row">
                                                        <span>Missed Rate:</span>
                                                        <strong>{rateText}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="st-vbar-val st-vbar-val--missed">{missed}</span>
                                            <span className="st-vbar-label">{formatStationName(b.name.split('–')[0].trim())}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="st-risk-warning st-risk-warning--missed">
                                <span className="st-risk-total">Total Missed: {totalMissed}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   DETAIL MODAL
════════════════════════════ */
const DetailModal = ({ station, onClose, navigate, canExport }) => {
    const [tab, setTab] = useState('overview');
    const [showDetailExportModal, setShowDetailExportModal] = useState(false);

    const handleDetailExport = async (exportConfig) => {
        await assertReportPermission(supabase, TEMPLATE_PERMISSION_KEYS.exportStation);
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
            'Vaccination Completion (%)': station.vaccCoverage,
            'Supplement Coverage (%)': station.suppCoverage,
            '1st Trimester': station.trimester?.first || 0,
            '2nd Trimester': station.trimester?.second || 0,
            '3rd Trimester': station.trimester?.third || 0,
        }];

        if (format === 'excel') {
            const XLSX = await import('xlsx');
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
            const dateStr = new Date().toISOString().split('T')[0];
            const head = [Object.keys(exportData[0])];
            const body = exportData.map(obj => Object.values(obj));

            exportStandardStaffPdf({
                orientation: 'landscape',
                title: `${station.name} — Station Detail Report`,
                period: reportPeriodText || 'All Dates',
                station: station.name,
                totalRecords: exportData.length,
                head: head,
                body: body,
                filename: `Station_${station.name.replace(/\s+/g, '_')}_${dateStr}.pdf`
            });
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

    return createPortal(
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
                                <div className="detail-stat"><span>Vaccination Completion</span><strong>{station.vaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Newborn Vaccines</span><strong>{station.newbornVaccCoverage}%</strong></div>
                                <div className="detail-stat"><span>Supplement Coverage</span><strong>{station.suppCoverage}%</strong></div>
                            </div>
                            <div className="detail-section">
                                <h4>Coverage Breakdown</h4>
                                {[
                                    { label: 'Maternal and Newborn Dose Completion', value: station.vaccCoverage },
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
                    {canExport && (
                        <button className="btn btn-outline" onClick={() => setShowDetailExportModal(true)}>
                            <Download size={14} /> Export
                        </button>
                    )}
                    <ExportModal
                        isOpen={showDetailExportModal && canExport}
                        onClose={() => setShowDetailExportModal(false)}
                        onExport={handleDetailExport}
                    />
                    <button className="btn btn-primary"><FileText size={14} /> Generate Full Report</button>
                </div>
            </div>
        </div>
    );
};
