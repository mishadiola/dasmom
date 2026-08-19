import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, X, Baby, Heart, AlertTriangle,
    CheckCircle2, Clock, AlertCircle, Eye,
    Syringe, Calendar, Download, ChevronDown, ChevronUp,
    TrendingUp, ShieldCheck, Timer, ChevronLeft, ChevronRight
} from 'lucide-react';
import NewbornService from '../../services/newbornservice';
import * as XLSX from 'xlsx';
import '../../styles/pages/NewbornTracking.css';
import Legend from '../../components/Legend/Legend';

/* ════════════════════════════
   CALENDAR HELPERS
════════════════════════════ */
const toLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const formatCalDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatReadableDateNB = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Helper function for readable date formatting
const formatDateLong = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
};

/* ════════════════════════════
   VACCINATION DETAIL MODAL
════════════════════════════ */
const VaccinationDetailModal = ({ baby, onClose }) => {
    const vaccStatusClass = (s) => {
        if (s === 'Completed') return 'status-completed';
        if (s === 'Overdue') return 'status-overdue';
        return 'status-pending';
    };

    const getVaccinationProgress = () => {
        if (!baby.vaccLog?.length) return { completed: 0, total: 0, percentage: 0 };
        const completed = baby.vaccLog.filter(v => v.status === 'Completed').length;
        return {
            completed,
            total: baby.vaccLog.length,
            percentage: Math.round((completed / baby.vaccLog.length) * 100)
        };
    };

    const progress = getVaccinationProgress();

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="nb-modal vacc-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header vacc-header">
                    <div>
                        <h2><Syringe size={22} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {baby.babyName}</h2>
                        <p>Mother: {baby.motherName} · {baby.station}</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    {/* Vaccination Progress Overview */}
                    <div className="vacc-progress-overview">
                        <div className="vacc-progress-card">
                            <div className="vacc-progress-header">
                                <ShieldCheck size={24} className="vacc-progress-icon" />
                                <div>
                                    <h3>Vaccination Progress</h3>
                                    <p className="vacc-progress-subtitle">{progress.completed} of {progress.total} vaccines completed</p>
                                </div>
                            </div>
                            <div className="vacc-progress-bar-wrap">
                                <div className="vacc-progress-track">
                                    <div 
                                        className="vacc-progress-fill" 
                                        style={{ width: `${progress.percentage}%` }}
                                    ></div>
                                </div>
                                <span className="vacc-progress-percent">{progress.percentage}%</span>
                            </div>
                        </div>

                        <div className="vacc-status-cards">
                            <div className="vacc-status-card completed">
                                <CheckCircle2 size={18} />
                                <span className="vacc-status-count">{baby.vaccLog?.filter(v => v.status === 'Completed').length || 0}</span>
                                <span className="vacc-status-label">Completed</span>
                            </div>
                            <div className="vacc-status-card upcoming">
                                <Timer size={18} />
                                <span className="vacc-status-count">{baby.vaccLog?.filter(v => v.status === 'Pending').length || 0}</span>
                                <span className="vacc-status-label">Upcoming</span>
                            </div>
                            <div className="vacc-status-card overdue">
                                <AlertTriangle size={18} />
                                <span className="vacc-status-count">{baby.vaccLog?.filter(v => v.status === 'Overdue').length || 0}</span>
                                <span className="vacc-status-label">Overdue</span>
                            </div>
                        </div>
                    </div>

                    {/* Vaccination Schedule Table */}
                    <div className="vacc-schedule-section">
                        <h3 className="vacc-section-title"><Calendar size={16} /> Vaccination Schedule</h3>
                        <table className="nb-inner-table vacc-table">
                            <thead>
                                <tr>
                                    <th>Vaccine</th>
                                    <th>Dose</th>
                                    <th>Scheduled Date</th>
                                    <th>Date Given</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {baby.vaccLog?.map((v, i) => (
                                    <tr key={i} className={v.status === 'Overdue' ? 'row-overdue' : v.status === 'Completed' ? 'row-completed' : ''}>
                                        <td className="col-vaccine">{v.vaccine}</td>
                                        <td>{v.dose}</td>
                                        <td className="col-date">{v.nextDue || '—'}</td>
                                        <td className="col-date">{v.date || <span className="not-yet">Pending</span>}</td>
                                        <td><span className={`vacc-status ${vaccStatusClass(v.status)}`}>{v.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Next Vaccination Alert */}
                    {baby.nextVaccine && (
                        <div className="next-vaccine-alert">
                            <Clock size={18} />
                            <div>
                                <strong>Next Vaccination:</strong> {baby.nextVaccine.vaccine} ({baby.nextVaccine.dose})
                                <p>Scheduled for: {baby.nextVaccine.date}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard/vaccinations')}>
                        <Syringe size={14} /> Go to Distribution Records
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   MAIN COMPONENT - VACCINATION TRACKING
════════════════════════════ */
const NewbornTracking = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ status: 'All', progress: 'All', station: 'All' });
    const [selectedBaby, setSelectedBaby] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // ── Baby Vaccination Calendar State ──
    const [vaccCalendarDate, setVaccCalendarDate] = useState(new Date());
    const [vaccCalendarView, setVaccCalendarView] = useState('week');

    // Live data state - filtered for vaccination tracking
    const [stats, setStats] = useState({
        totalWithVaccines: 0,
        fullyVaccinated: 0,
        partiallyVaccinated: 0,
        overdueVaccines: 0,
        upcomingDoses: 0
    });
    const [newborns, setNewborns] = useState([]);

    const loadNewbornData = useCallback(async () => {
        try {
            const service = new NewbornService();
            const newbornsData = await service.getAllNewborns();
            
            // Show ALL newborns, not just those with vaccination records
            const allNewborns = newbornsData || [];
            
            // Calculate vaccination stats for all newborns
            const fullyVaccinated = allNewborns.filter(b => {
                if (!b.vaccLog || b.vaccLog.length === 0) return false;
                const completed = b.vaccLog.filter(v => v.status === 'Completed').length;
                return completed === b.vaccLog.length;
            }).length;

            const overdueVaccines = allNewborns.filter(b => 
                b.vaccLog && b.vaccLog.some(v => v.status === 'Overdue')
            ).length;

            const upcomingDoses = allNewborns.reduce((acc, b) => 
                acc + (b.vaccLog ? b.vaccLog.filter(v => v.status === 'Pending').length : 0), 0
            );

            const partiallyVaccinated = allNewborns.filter(b => {
                if (!b.vaccLog || b.vaccLog.length === 0) return false;
                const completed = b.vaccLog.filter(v => v.status === 'Completed').length;
                return completed > 0 && completed < b.vaccLog.length;
            }).length;
            
            setStats({
                totalWithVaccines: allNewborns.length,
                fullyVaccinated,
                partiallyVaccinated,
                overdueVaccines,
                upcomingDoses
            });
            setNewborns(allNewborns);
        } catch (err) {
            console.error('Error loading newborn data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNewbornData();

        const service = new NewbornService();
        const subscription = service.subscribeToNewbornChanges(() => {
            console.log('🔄 Newborn changes detected, re-fetching data...');
            loadNewbornData();
        });

        return () => {
            console.log('🔌 Unsubscribing from newborn changes');
            subscription.unsubscribe();
        };
    }, [loadNewbornData]);

    const handleFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    /* ────────────────────────────────────────────────────
       BABY VACCINATION CALENDAR HELPERS
    ──────────────────────────────────────────────────── */
    const getVaccVisibleDays = (date, view) => {
        const d = new Date(date);
        if (view === 'day') {
            return [{ date: toLocalDateStr(d), label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) }];
        }
        if (view === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(d);
            start.setDate(diff);
            const days = [];
            for (let i = 0; i < 7; i++) {
                const curr = new Date(start);
                curr.setDate(start.getDate() + i);
                days.push({ date: toLocalDateStr(curr), label: formatCalDate(curr) });
            }
            return days;
        }
        if (view === 'month') {
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            const days = [];
            for (let i = 1; i <= end.getDate(); i++) {
                const curr = new Date(d.getFullYear(), d.getMonth(), i);
                days.push({ date: toLocalDateStr(curr), label: formatCalDate(curr) });
            }
            return days;
        }
        return [];
    };

    const vaccVisibleDays = useMemo(
        () => getVaccVisibleDays(vaccCalendarDate, vaccCalendarView),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [vaccCalendarDate, vaccCalendarView]
    );

    const formatVaccNavLabel = () => {
        if (!vaccVisibleDays || vaccVisibleDays.length === 0) return '';
        if (vaccCalendarView === 'day') return formatReadableDateNB(vaccVisibleDays[0]?.date);
        const start = new Date(vaccVisibleDays[0].date);
        const end = new Date(vaccVisibleDays[vaccVisibleDays.length - 1].date);
        if (vaccCalendarView === 'month') return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `${formatReadableDateNB(start)} – ${formatReadableDateNB(end)}`;
    };

    const handleVaccPrev = () => {
        setVaccCalendarDate(prev => {
            const d = new Date(prev);
            if (vaccCalendarView === 'day') d.setDate(d.getDate() - 1);
            if (vaccCalendarView === 'week') d.setDate(d.getDate() - 7);
            if (vaccCalendarView === 'month') d.setMonth(d.getMonth() - 1);
            return d;
        });
    };

    const handleVaccNext = () => {
        setVaccCalendarDate(prev => {
            const d = new Date(prev);
            if (vaccCalendarView === 'day') d.setDate(d.getDate() + 1);
            if (vaccCalendarView === 'week') d.setDate(d.getDate() + 7);
            if (vaccCalendarView === 'month') d.setMonth(d.getMonth() + 1);
            return d;
        });
    };

    // Build date → vaccinations map from existing newborns data
    const vaccByDate = useMemo(() => {
        const map = {};
        newborns.forEach(b => {
            (b.vaccLog || []).forEach(v => {
                if (!v.nextDue) return;
                const key = v.nextDue.split('T')[0];
                if (!map[key]) map[key] = [];
                map[key].push({
                    babyName: b.babyName,
                    vaccine: v.vaccine,
                    dose: v.dose,
                    status: v.status
                });
            });
        });
        return map;
    }, [newborns]);

    const VACC_TODAY = new Date().toISOString().split('T')[0];

    // Filter for vaccination tracking only
    const filtered = useMemo(() => {
        return newborns.filter(b => {
            const s = searchTerm.toLowerCase();
            const matchSearch = b.babyName?.toLowerCase().includes(s) || 
                              b.motherName?.toLowerCase().includes(s) || 
                              b.id?.toLowerCase().includes(s) || 
                              b.station?.toLowerCase().includes(s);
            
            // Calculate vaccination progress
            const completed = b.vaccLog?.filter(v => v.status === 'Completed').length || 0;
            const total = b.vaccLog?.length || 0;
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            // Status filter
            const matchStatus = filters.status === 'All' || 
                (filters.status === 'Completed' && percentage === 100) ||
                (filters.status === 'In Progress' && percentage > 0 && percentage < 100) ||
                (filters.status === 'Overdue' && b.vaccLog?.some(v => v.status === 'Overdue'));
            
            // Progress filter
            const matchProgress = filters.progress === 'All' ||
                (filters.progress === '0-25%' && percentage <= 25) ||
                (filters.progress === '26-50%' && percentage > 25 && percentage <= 50) ||
                (filters.progress === '51-75%' && percentage > 50 && percentage <= 75) ||
                (filters.progress === '76-99%' && percentage > 75 && percentage < 100) ||
                (filters.progress === '100%' && percentage === 100);
            
            const matchStation = filters.station === 'All' || b.station === filters.station;
            
            return matchSearch && matchStatus && matchProgress && matchStation;
        });
    }, [newborns, searchTerm, filters]);

    const getVaccinationProgress = (baby) => {
        const completed = baby.vaccLog?.filter(v => v.status === 'Completed').length || 0;
        const total = baby.vaccLog?.length || 0;
        return {
            completed,
            total,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    };

    const getNextVaccine = (baby) => {
        const pending = baby.vaccLog?.find(v => v.status === 'Pending' || v.status === 'Overdue');
        return pending ? { vaccine: pending.vaccine, dose: pending.dose, date: pending.nextDue } : null;
    };

    const getLastVaccine = (baby) => {
        const completed = baby.vaccLog?.filter(v => v.status === 'Completed' && v.date);
        if (!completed?.length) return null;
        // Sort by date descending and get the most recent
        const sorted = completed.sort((a, b) => new Date(b.date) - new Date(a.date));
        return sorted[0];
    };

    const calculateAge = (birthDate) => {
        if (!birthDate) return 'N/A';
        const birth = new Date(birthDate);
        const now = new Date();
        
        let years = now.getFullYear() - birth.getFullYear();
        let months = now.getMonth() - birth.getMonth();
        let days = now.getDate() - birth.getDate();
        
        if (days < 0) {
            months--;
            days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }
        
        if (years > 0) {
            return `${years}y ${months}m`;
        } else if (months > 0) {
            return `${months}m ${days}d`;
        } else {
            return `${days}d`;
        }
    };

    const getVaccinationStatus = (baby) => {
        const completed = baby.vaccLog?.filter(v => v.status === 'Completed').length || 0;
        const total = baby.vaccLog?.length || 0;
        const hasOverdue = baby.vaccLog?.some(v => v.status === 'Overdue');
        
        if (total === 0) return { label: 'Not Started', class: 'status-none' };
        if (completed === total) return { label: 'Fully Vaccinated', class: 'status-completed' };
        if (hasOverdue) return { label: 'Needs Attention', class: 'status-overdue' };
        return { label: 'In Progress', class: 'status-progress' };
    };

    const getRowClass = (b) => {
        const progress = getVaccinationProgress(b);
        if (b.vaccLog?.some(v => v.status === 'Overdue')) return 'nb-row--overdue';
        if (progress.percentage === 100) return 'nb-row--completed';
        if (progress.percentage >= 75) return 'nb-row--progress';
        return 'nb-row--started';
    };

    const getProgressBadge = (percentage) => {
        if (percentage === 100) return 'progress-completed';
        if (percentage >= 75) return 'progress-high';
        if (percentage >= 50) return 'progress-medium';
        if (percentage >= 25) return 'progress-low';
        return 'progress-started';
    };

    const handleExport = () => {
        const exportData = filtered.map(b => {
            const progress = getVaccinationProgress(b);
            const nextVaccine = getNextVaccine(b);
            return {
                'Baby Name': b.babyName,
                'Mother Name': b.motherName,
                'Baby ID': b.id,
                'Station': b.station,
                'Birth Date': formatDateLong(b.birthDate),
                'Vaccines Completed': progress.completed,
                'Total Vaccines': progress.total,
                'Progress %': `${progress.percentage}%`,
                'Next Vaccine': nextVaccine ? `${nextVaccine.vaccine} (${nextVaccine.dose})` : 'All Completed',
                'Next Due Date': nextVaccine?.date || '—',
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Newborn Vaccination Tracking');

        // Auto-size columns
        const colWidths = [
            { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
            { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 15 }
        ];
        ws['!cols'] = colWidths;

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Newborn_Vaccination_Tracking_${dateStr}.xlsx`);
    };

    const SUMMARY_CARDS = [
        { label: 'Total Newborns', value: newborns.length, color: 'lilac', icon: Baby },
        { label: 'Fully Vaccinated', value: stats.fullyVaccinated, color: 'sage', icon: CheckCircle2 },
        { label: 'In Progress', value: stats.partiallyVaccinated, color: 'blue', icon: Timer },
        { label: 'Needs Attention', value: stats.overdueVaccines, color: 'rose', icon: AlertTriangle },
    ];

    if (loading) return (
        <div className="nb-page">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '16px' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #f0f2f5', borderTopColor: 'var(--color-rose)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Loading newborn records...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );

    return (
        <div className="nb-page vacc-tracking-page">

            {/* ── Page Header ── */}
            <div className="page-header vacc-header">
                <div>
                    <h1 className="page-title"><Baby size={24} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Newborn Records</h1>
                    <p className="page-subtitle">View and manage newborn records, including vaccination status and newborn information.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={handleExport}>
                        <Download size={14} /> Export Report
                    </button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="nb-stats-grid vacc-stats">
                {SUMMARY_CARDS.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className={`stat-card stat-card--${s.color}`}>
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

            {/* ── Search & Filters ── */}
            <div className="nb-controls vacc-controls">
                <div className="nb-search-wrap">
                    <Search size={16} className="nb-search-icon" />
                    <input
                        type="text"
                        className="nb-search-input"
                        placeholder="Search by baby name, mother name, ID, or station..."
                        value={searchTerm}
                        onChange={e => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <div className="nb-filters-row vacc-filters">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.status} onChange={e => { handleFilter('status', e.target.value); setCurrentPage(1); }}>
                        <option value="All">All Status</option>
                        <option value="Completed">Fully Vaccinated</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                    <select value={filters.progress} onChange={e => { handleFilter('progress', e.target.value); setCurrentPage(1); }}>
                        <option value="All">All Progress</option>
                        <option value="0-25%">0-25% Complete</option>
                        <option value="26-50%">26-50% Complete</option>
                        <option value="51-75%">51-75% Complete</option>
                        <option value="76-99%">76-99% Complete</option>
                        <option value="100%">100% Complete</option>
                    </select>
                    <select value={filters.station} onChange={e => { handleFilter('station', e.target.value); setCurrentPage(1); }}>
                        <option value="All">All Stations</option>
                        {[1,2,3,4,5,6,7].map(n => <option key={n} value={`Station ${n}`}>Station {n}</option>)}
                    </select>
                </div>
            </div>

            {/* ── Baby Vaccination Schedule Calendar ── */}
            <div className="pv-calendar-section vacc-cal-section">
                {/* Section head bar */}
                <div className="section-head-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Syringe size={18} style={{ color: 'var(--color-rose)' }} />
                            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>Baby Vaccination Schedule</span>
                        </div>
                        <div className="date-nav">
                            <button className="icon-btn-sm" onClick={handleVaccPrev}><ChevronLeft size={16} /></button>
                            <h2>{formatVaccNavLabel()}</h2>
                            <button className="icon-btn-sm" onClick={handleVaccNext}><ChevronRight size={16} /></button>
                        </div>
                    </div>
                    <div className="cal-head-right">
                        <div className="view-toggles">
                            {['day', 'week', 'month'].map(v => (
                                <button
                                    key={v}
                                    className={`view-toggle-btn ${vaccCalendarView === v ? 'active' : ''}`}
                                    onClick={() => {
                                        setVaccCalendarView(v);
                                        if (v === 'day') setVaccCalendarDate(new Date());
                                    }}
                                >
                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                </button>
                            ))}
                        </div>
                        <Legend 
                            categories={[
                                {
                                    title: "Schedule Status",
                                    items: [
                                        { label: "Scheduled", icon: <i className="dot vacc-dot-scheduled"></i> },
                                        { label: "Completed", icon: <i className="dot vacc-dot-completed"></i> },
                                        { label: "Missed", icon: <i className="dot vacc-dot-missed"></i> },
                                        { label: "Overdue", icon: <i className="dot vacc-dot-overdue"></i> }
                                    ]
                                }
                            ]}
                        />
                    </div>
                </div>

                {/* Calendar grid */}
                <div className="pv-grid-container">
                    {vaccCalendarView === 'day' ? (
                        <div className="day-view-container">
                            {vaccVisibleDays.map(day => {
                                const dayVaccs = vaccByDate[day.date] || [];
                                return (
                                    <div key={day.date} className={`day-schedule-card ${day.date === VACC_TODAY ? 'day-today' : ''}`}>
                                        <div className="day-schedule-header">
                                            <h3 className="day-schedule-title">
                                                {day.label}
                                                {day.date === VACC_TODAY && <span className="today-badge">TODAY</span>}
                                            </h3>
                                            <span className="day-schedule-count">
                                                {dayVaccs.length} vaccination{dayVaccs.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="day-schedule-list">
                                            {dayVaccs.length > 0 ? dayVaccs.map((vc, idx) => (
                                                <div key={idx} className={`schedule-item vacc-schedule-item vacc-item-${vc.status?.toLowerCase()}`}>
                                                    <div className="schedule-details">
                                                        <span className="schedule-patient">{vc.babyName}</span>
                                                        <span className="schedule-id">{vc.vaccine} · {vc.dose}</span>
                                                    </div>
                                                    <span className={`schedule-status vacc-status-badge vacc-badge-${vc.status?.toLowerCase()}`}>
                                                        {vc.status}
                                                    </span>
                                                </div>
                                            )) : (
                                                <div className="no-schedules">No vaccinations scheduled for this day.</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : vaccCalendarView === 'week' ? (
                        <div className="day-grid week-grid">
                            <div className="week-row">
                                {vaccVisibleDays.map(day => {
                                    const dayVaccs = vaccByDate[day.date] || [];
                                    return (
                                        <div
                                            key={day.date}
                                            className={`day-cell ${day.date === VACC_TODAY ? 'day-today' : ''}`}
                                            onClick={() => { setVaccCalendarView('day'); setVaccCalendarDate(new Date(day.date)); }}
                                        >
                                            <h4 className="day-header">
                                                {formatCalDate(day.date)}
                                                {day.date === VACC_TODAY && <span className="today-badge">TODAY</span>}
                                            </h4>
                                            <div className="day-visits">
                                                {dayVaccs.length > 0 ? dayVaccs.map((vc, idx) => (
                                                    <div key={idx} className={`visit-item vacc-item-${vc.status?.toLowerCase()}`}>
                                                        <span className="visit-patient">{vc.babyName}</span>
                                                        <span className="visit-status">{vc.vaccine}</span>
                                                    </div>
                                                )) : (
                                                    <div className="no-visits">No vaccines</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        // Month view
                        <div className="day-grid month-grid">
                            {(() => {
                                const weeks = [];
                                for (let i = 0; i < vaccVisibleDays.length; i += 7) {
                                    weeks.push(vaccVisibleDays.slice(i, i + 7));
                                }
                                return weeks.map((week, wi) => (
                                    <div key={wi} className="week-row">
                                        {week.map(day => {
                                            const dayVaccs = vaccByDate[day.date] || [];
                                            return (
                                                <div
                                                    key={day.date}
                                                    className={`day-cell ${day.date === VACC_TODAY ? 'day-today' : ''}`}
                                                    onClick={() => { setVaccCalendarView('day'); setVaccCalendarDate(new Date(day.date)); }}
                                                >
                                                    <h4 className="day-header">
                                                        {formatCalDate(day.date)}
                                                        {day.date === VACC_TODAY && <span className="today-badge">TODAY</span>}
                                                    </h4>
                                                    <div className="day-visits">
                                                        {dayVaccs.length > 0 ? dayVaccs.map((vc, idx) => (
                                                            <div key={idx} className={`visit-item vacc-item-${vc.status?.toLowerCase()}`}>
                                                                <span className="visit-patient">{vc.babyName}</span>
                                                                <span className="visit-status">{vc.vaccine}</span>
                                                            </div>
                                                        )) : (
                                                            <div className="no-visits">No vaccines</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Vaccination Tracking Table ── */}
            <div className="nb-card vacc-table-card">
                <div className="nb-card-head registry-table-head">
                    <h2><Baby size={17} /> Newborn Registry</h2>
                    <Legend 
                        categories={[
                            {
                                title: "Status",
                                items: [
                                    { label: "Fully Vaccinated", className: "chip-completed", icon: <CheckCircle2 size={11} /> },
                                    { label: "In Progress", className: "chip-progress", icon: <TrendingUp size={11} /> },
                                    { label: "Needs Attention", className: "chip-overdue", icon: <AlertTriangle size={11} /> }
                                ]
                            }
                        ]}
                    />
                    <span className="nb-count">{filtered.length} newborns</span>
                </div>

                <div className="table-responsive">
                    <table className="nb-table vacc-table">
                        <thead>
                            <tr>
                                <th className="row-number-header" style={{ width: '50px' }}># / No.</th>
                                <th>Baby Name</th>
                                <th>Mother Name</th>
                                <th>Birth Date</th>
                                <th>Age</th>
                                <th>Vaccination Status</th>
                                <th>Last Vaccine Given</th>
                                <th>Next Due Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((b, index) => {
                                const nextVaccine = getNextVaccine(b);
                                const lastVaccine = getLastVaccine(b);
                                const vaccStatus = getVaccinationStatus(b);
                                return (
                                    <tr key={b.id} className={`nb-row ${getRowClass(b)}`}>
                                        <td className="row-number-cell" style={{ width: '50px' }}>
                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                        </td>
                                        <td>
                                            <div className="nb-baby-cell">
                                                <div className={`nb-avatar nb-avatar--${b.gender?.toLowerCase() || 'unknown'}`}>
                                                    {b.gender === 'Female' ? '♀' : b.gender === 'Male' ? '♂' : '?'}
                                                </div>
                                                <div>
                                                    <span className="nb-baby-name">{b.babyName}</span>
                                                    <span className="nb-baby-id" title={b.id}>{b.id?.substring(0, 8)}...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td onClick={() => navigate(`/dashboard/patients/${b.motherId}`)} style={{ cursor: 'pointer' }}>
                                            <span className="nb-mother-name patient-name-link">{b.motherName}</span>
                                            <span className="nb-mother-id">{b.station}</span>
                                        </td>
                                        <td className="nb-date">{formatDateLong(b.birthDate)}</td>
                                        <td>
                                            <span className="nb-age">{calculateAge(b.birthDate)}</span>
                                        </td>
                                        <td>
                                            <span className={`vacc-status-badge ${vaccStatus.class}`}>
                                                {vaccStatus.label}
                                            </span>
                                        </td>
                                        <td>
                                            {lastVaccine ? (
                                                <div className="last-vaccine-info">
                                                    <span className="last-vaccine-name">{lastVaccine.vaccine}</span>
                                                    <span className="last-vaccine-date">{lastVaccine.date}</span>
                                                </div>
                                            ) : (
                                                <span className="no-vaccine">—</span>
                                            )}
                                        </td>
                                        <td className="nb-date">
                                            {nextVaccine ? (
                                                <span className={`next-date ${b.vaccLog?.some(v => v.status === 'Overdue') ? 'date-overdue' : ''}`}>
                                                    {nextVaccine.date}
                                                </span>
                                            ) : (
                                                <span className="no-date">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="row-actions registry-actions">
                                                <button className="action-btn-text action-btn-secondary" title="View Profile" onClick={() => navigate(`/dashboard/patients/${b.motherId}`)}>
                                                    <Eye size={13} /> View Profile
                                                </button>
                                                <button className="action-btn-text action-btn-primary" title="View Vaccination History" onClick={() => setSelectedBaby(b)}>
                                                    <Syringe size={13} /> View History
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="nb-empty registry-empty">
                                        <Baby size={48} />
                                        <p>No newborn records found.</p>
                                        <small>Newborn records will appear here when added to the system.</small>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {/* Pagination Controls */}
                    {filtered.length > 0 && (
                        <div className="table-pagination">
                            <div className="pagination-info">
                                Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
                            </div>
                            <div className="pagination-controls">
                                <button 
                                    className="page-btn" 
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button 
                                    className="page-btn" 
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filtered.length / itemsPerPage)))}
                                    disabled={currentPage === Math.ceil(filtered.length / itemsPerPage)}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Vaccination Detail Modal ── */}
            {selectedBaby && <VaccinationDetailModal baby={selectedBaby} onClose={() => setSelectedBaby(null)} />}
        </div>
    );
};

export default NewbornTracking;
