import React, { useState, useMemo, useEffect } from 'react';
import { Users, ChevronDown, BarChart3 } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════
   PREGNANCY AGE & OUTCOME REPORT (ANALYTICS OVERVIEW TAB)
   ════════════════════════════════════════════════════════════════ */
const PregnancyAgeReport = ({ rows = [], globalStation = 'All Stations' }) => {
    const [filters, setFilters] = useState({
        period: 'All',
        station: 'All',
        outcome: 'All',
        deliveryType: 'All'
    });

    // Synchronize station filter with global Analytics station filter
    useEffect(() => {
        if (globalStation && globalStation !== 'All Stations') {
            setFilters(prev => ({ ...prev, station: globalStation }));
        } else if (globalStation === 'All Stations') {
            setFilters(prev => ({ ...prev, station: 'All' }));
        }
    }, [globalStation]);

    const stationOptions = useMemo(() => [
        ...new Set(rows.map(row => row.station).filter(Boolean))
    ].sort(), [rows]);

    const deliveryTypeOptions = useMemo(() => [
        ...new Set(rows.map(row => row.deliveryType).filter(type => type && type !== 'N/A'))
    ].sort(), [rows]);

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
        <section className="st-age-report" id="pregnancy-age-outcome-report">
            <div className="st-age-report-header">
                <div>
                    <h2 className="st-overview-title st-age-title">
                        <Users size={18} /> Pregnancy Age &amp; Outcome Report
                    </h2>
                    <p className="st-overview-subtitle st-age-subtitle">
                        Maternal age at the recorded pregnancy event, grouped by station and outcome
                    </p>
                </div>
                <span className="st-station-count st-age-badge">
                    {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
                </span>
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
                                    <div className="st-age-bar-track">
                                        <div className="st-age-bar-fill" style={{ width: `${(item.count / maxAgeCount) * 100}%` }} />
                                    </div>
                                    <strong>{item.count}</strong>
                                </div>
                            ))}
                        </div>
                    ) : <div className="st-age-empty">No age records match these filters.</div>}
                </div>

                <div className="st-age-table-panel">
                    <div className="st-age-table-wrap">
                        <table className="st-age-table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Age</th>
                                    <th>Station</th>
                                    <th>Date</th>
                                    <th>Outcome</th>
                                    <th>Delivery Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map(row => (
                                    <tr key={row.id}>
                                        <td>{row.patientName}</td>
                                        <td>{row.age === null ? 'N/A' : `${row.age} yrs`}</td>
                                        <td>{row.station}</td>
                                        <td>{formatDate(row.eventDate)}</td>
                                        <td>
                                            <span className={`st-age-outcome st-age-outcome--${(row.outcome || '').toLowerCase()}`}>
                                                {row.outcome}
                                            </span>
                                        </td>
                                        <td>{row.deliveryType}</td>
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="st-age-empty">No pregnancy records match these filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PregnancyAgeReport;
