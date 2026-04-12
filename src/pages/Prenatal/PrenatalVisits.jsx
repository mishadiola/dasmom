import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search, Plus, Eye, Edit2, Trash2, CalendarCheck,
    AlertTriangle, HeartPulse, Filter, Clock, ChevronLeft,
    ChevronRight, Calendar as CalendarIcon, Users, MapPin, X,
    CheckCircle2
} from 'lucide-react';
import ScheduledVisitModal from '../../components/Prenatal/ScheduledVisitModal';
import '../../styles/pages/PrenatalVisits.css';
import PatientService from '../../services/patientservice';

const TIME_SLOTS = [
    '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM',
    '10:30 AM', '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'
];

const SearchableDropdown = ({ patients, value, onChange }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const selectedPatient = patients.find(p => p.id === value);
    const displayValue = open ? query : (selectedPatient ? `${selectedPatient.name} (${selectedPatient.id})` : '');

    const filtered = patients.filter(p =>
        p.name?.toLowerCase().includes(query.toLowerCase()) ||
        p.id?.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (patient) => {
        onChange(patient.id);
        setQuery('');
        setOpen(false);
    };

    return (
        <div className="searchable-dropdown" ref={ref}>
            <div className="sd-input-wrap" onClick={() => setOpen(true)}>
                <Search size={14} className="sd-icon" />
                <input
                    type="text"
                    placeholder={selectedPatient ? `${selectedPatient.name} (${selectedPatient.id})` : 'Search by name or ID...'}
                    value={displayValue}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => { setOpen(true); setQuery(''); }}
                    className="sd-input"
                />
                {value && (
                    <button
                        className="sd-clear"
                        onClick={(e) => { e.stopPropagation(); onChange(''); setQuery(''); }}
                        type="button"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
            {open && (
                <ul className="sd-list">
                    {filtered.length > 0 ? filtered.map(p => (
                        <li
                            key={p.id}
                            className={`sd-item ${p.id === value ? 'sd-item--selected' : ''}`}
                            onMouseDown={() => handleSelect(p)}
                        >
                            <span className="sd-name">{p.name}</span>
                            <span className="sd-meta">{p.id}</span>
                        </li>
                    )) : (
                        <li className="sd-empty">No patients found</li>
                    )}
                </ul>
            )}
        </div>
    );
};

const PrenatalVisits = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [bookingPanelOpen, setBookingPanelOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [toast, setToast] = useState(null);
    const [calendarView, setCalendarView] = useState('week'); // day, week, month
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [visitsTable, setVisitsTable] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [livePatients, setLivePatients] = useState([]);

    const [selectedSlot, setSelectedSlot] = useState({ date: null, time: null });
    const [bookingData, setBookingData] = useState({
        patientId: '',
        patientName: '',
        visitType: 'Routine Prenatal',
        staff: '',
        location: 'Main Clinic - Rm 1'
    });
    const [conflictWarning, setConflictWarning] = useState(null);

    // Helper to get local date string YYYY-MM-DD reliably
    const toLocalDateStr = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    const getVisibleDays = (date, view) => {
        const d = new Date(date);
        if (view === 'day') {
            return [{
                date: toLocalDateStr(d),
                label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
            }];
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
                days.push({
                    date: toLocalDateStr(curr),
                    label: curr.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
                });
            }
            return days;
        }

        if (view === 'month') {
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0); // Last day
            const days = [];
            for (let i = 1; i <= end.getDate(); i++) {
                const curr = new Date(d.getFullYear(), d.getMonth(), i);
                days.push({
                    date: toLocalDateStr(curr),
                    label: i.toString()
                });
            }
            return days;
        }
        return [];
    };

    const visibleDays = getVisibleDays(currentDate, calendarView);

    // 🔥 FIXED: Dynamic date range + automatic real-time sync
    useEffect(() => {
        const patientService = new PatientService();

        const fetchData = async () => {
            try {
                const vDays = getVisibleDays(currentDate, calendarView);
                if (vDays.length === 0) return;
                
                // Fetch perfectly aligned with the visual grid columns
                const startDate = vDays[0].date;
                const endDate = vDays[vDays.length - 1].date;

                const [patientsData, visitsData, staffData, apptsData] = await Promise.all([
                    patientService.getAllPatients(),
                    patientService.getPrenatalVisits(),
                    patientService.getAllMidwives(),
                    patientService.getAppointments(startDate, endDate, calendarView)
                ]);

                setLivePatients(patientsData || []);
                setVisitsTable(visitsData || []);
                setStaffList(staffData || []);
                setAppointments(apptsData || []);

            } catch (error) {
                console.error(error);
            }
        };

        fetchData();

        // Real-time auto-refresh when new patients are added under prenatal_visits
        const subscription = patientService.supabase
            .channel('prenatal_calendar_sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'prenatal_visits' },
                () => {
                    console.log('🔄 Detected new visits/appointments! Auto-refreshing calendar...');
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            patientService.supabase.removeChannel(subscription);
        };
    }, [calendarView, currentDate]); // 🔥 Re-fetch on view/date change

    const handlePrev = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            if (calendarView === 'day') d.setDate(d.getDate() - 1);
            if (calendarView === 'week') d.setDate(d.getDate() - 7);
            if (calendarView === 'month') d.setMonth(d.getMonth() - 1);
            return d;
        });
    };

    const handleNext = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            if (calendarView === 'day') d.setDate(d.getDate() + 1);
            if (calendarView === 'week') d.setDate(d.getDate() + 7);
            if (calendarView === 'month') d.setMonth(d.getMonth() + 1);
            return d;
        });
    };

    const formatNavLabel = () => {
        if (calendarView === 'day') return currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        if (!visibleDays || visibleDays.length === 0) return '';
        const start = new Date(visibleDays[0].date);
        const end = new Date(visibleDays[visibleDays.length - 1].date);
        return calendarView === 'week' 
            ? `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // 🔥 FIXED: Slot status with next_appt_date timestamps
    const getSlotStatus = useCallback((date, time) => {
        // Filter appointments for this exact date/time (30 max/day visual)
        const dayAppts = appointments.filter(a => {
            // Secure direct comparison, preventing timezone shifting from new Date() conversion
            return a.date === date;
        });
        
        const timeAppts = dayAppts.filter(a => a.time === time);
        
        if (dayAppts.length >= 30) return 'FULL DAY'; // 30 max/day
        if (timeAppts.length >= 2) return 'Full';
        
        if (timeAppts.length === 1) return timeAppts[0];
        return 'Available';
    }, [appointments]);

    const handleSlotClick = (date, time, status) => {
        if (status === 'FULL DAY' || status === 'Full') return;

        if (status !== 'Available') {
            setSelectedVisit({
                ...status,
                visitDate: date,
                time
            });
            return;
        }

        setSelectedSlot({ date, time });
        setConflictWarning(null);
        setBookingPanelOpen(true);
    };

    const handleSelectPatient = (val) => {
        const p = livePatients.find(pt => pt.id === val);
        if (p) {
            setBookingData({ ...bookingData, patientId: p.id, patientName: p.name });
        } else {
            setBookingData({ ...bookingData, patientId: '', patientName: '' });
        }
        setConflictWarning(null);
    };

    const handleConfirmBooking = async () => {
        // TODO: Actual Supabase insert
        setToast('Visit scheduled successfully!');
        setBookingPanelOpen(false);
        setTimeout(() => setToast(null), 3000);
    };

    const filteredVisits = visitsTable.filter(v =>
        (v.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         v.patientId?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterStatus === 'All' || v.status === filterStatus)
    );

    const getRowClass = (status) => {
        if (status === 'Upcoming') return 'tr-upcoming';
        if (status === 'Completed') return 'tr-completed';
        if (status === 'Waiting') return 'tr-waiting';
        return '';
    };

    const TODAY = new Date().toISOString().split('T')[0];

    return (
        <div className="prenatal-visits-overall">
            {toast && <div className="toast toast--success"><CheckCircle2 size={16} /> {toast}</div>}

            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Prenatal Visits & Scheduling</h1>
                    <p className="page-subtitle">30 slots/day max (25 regular + 5 rescheduling)</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => {
                        setSelectedSlot({ date: visibleDays[0].date, time: '08:00 AM' });
                        setBookingPanelOpen(true);
                    }}>
                        <Plus size={16} /> Schedule Visit
                    </button>
                </div>
            </div>

            {/* CALENDAR SECTION */}
            <div className="pv-calendar-section">
                <div className="section-head-bar">
                    <div className="date-nav">
                        <button className="icon-btn-sm" onClick={handlePrev}><ChevronLeft size={16} /></button>
                        <h2>{formatNavLabel()}</h2>
                        <button className="icon-btn-sm" onClick={handleNext}><ChevronRight size={16} /></button>
                    </div>
                    <div className="cal-head-right">
                        <div className="view-toggles">
                            {['day', 'week', 'month'].map(v => (
                                <button
                                    key={v}
                                    className={`view-toggle-btn ${calendarView === v ? 'active' : ''}`}
                                    onClick={() => {
                                        setCalendarView(v);
                                        if (v === 'day') setCurrentDate(new Date());
                                    }}
                                >
                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="legend-pills">
                            <span><i className="dot d-avail"></i> Available</span>
                            <span><i className="dot d-booked"></i> Booked</span>
                            <span><i className="dot d-full"></i> Full (30/day max)</span>
                        </div>
                    </div>
                </div>

                <div className="pv-grid-container">
                    <table className="pc-grid">
                        <thead>
                            <tr>
                                <th className="th-time">Time</th>
                                {visibleDays.map(day => (
                                    <th key={day.date} className={day.date === TODAY ? 'th-today' : ''}>
                                        {day.label}
                                        {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {TIME_SLOTS.map(time => (
                                <tr key={time}>
                                    <td className="td-time">{time}</td>
                                    {visibleDays.map(day => {
                                        const status = getSlotStatus(day.date, time);
                                        const isHigh = status !== 'Available' && status !== 'Full' && status.risk === 'High Risk';
                                        return (
                                            <td
                                                key={day.date}
                                                className={`pc-slot ${status === 'Available' ? 'slot-avail' : 
                                                    status === 'FULL DAY' || status === 'Full' ? 'slot-full' : 
                                                    isHigh ? 'slot-high' : 'slot-booked'}`}
                                                onClick={() => handleSlotClick(day.date, time, status)}
                                            >
                                                {status === 'Available' ? 'Available' : 
                                                 status === 'FULL DAY' ? 'FULL DAY' : 
                                                 status === 'Full' ? 'FULL' : (
                                                    <div className="booked-card">
                                                        <span className="bc-name">{status.patient}</span>
                                                        <span className="bc-type">{status.type}</span>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* VISITS TABLE - UNCHANGED (already perfect) */}
            <div className="pv-table-section">
                <div className="section-header-row">
                    <h2 className="section-title"><Clock size={18} /> Upcoming & Recent Visits</h2>
                    <div className="pv-table-legend">
                        <span className="legend-chip chip-upcoming">Upcoming</span>
                        <span className="legend-chip chip-completed">Completed</span>
                        <span className="legend-chip chip-waiting">Waiting</span>
                    </div>
                    <div className="table-filters">
                        <div className="search-box">
                            <Search size={14} />
                            <input
                                type="text"
                                placeholder="Search patient..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="All">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="Waiting">Waiting</option>
                            <option value="Upcoming">Upcoming</option>
                        </select>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="pv-table">
                        <thead>
                            <tr>
                                <th>Visit Date</th>
                                <th>Patient Name</th>
                                <th>Gestational Age</th>
                                <th>BP / Weight</th>
                                <th>Risk</th>
                                <th>Status</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVisits.map(visit => (
                                <tr key={visit.id} className={getRowClass(visit.status)}>
                                    <td className="cell-date"><CalendarCheck size={14} /> {visit.visitDate}</td>
                                    <td>
                                        <div className="p-info">
                                            <span className="p-name">{visit.patientName}</span>
                                            <span className="p-id">{visit.patientId}</span>
                                        </div>
                                    </td>
                                    <td className="font-bold">{visit.ga}</td>
                                    <td className="vitals-cell">{visit.bp} / {visit.weight}</td>
                                    <td>
                                        <span className={`risk-tag risk-${visit.risk?.replace(' ', '-').toLowerCase() || 'normal'}`}>
                                            {visit.risk}
                                        </span>
                                    </td>
                                    <td><span className={`status-pill pill-${visit.status?.toLowerCase()}`}>{visit.status}</span></td>
                                    <td className="text-right">
                                        <div className="row-actions">
                                            <button className="icon-btn" onClick={() => navigate('/dashboard/prenatal/add')}><Plus size={14} /></button>
                                            <button className="icon-btn"><Eye size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BOOKING PANEL */}
            {bookingPanelOpen && (
                <>
                    <div className="bk-overlay" onClick={() => setBookingPanelOpen(false)}></div>
                    <div className="bk-panel slide-in-right">
                        <div className="bk-header">
                            <h2>Schedule Visit</h2>
                            <button className="icon-btn-sm" onClick={() => setBookingPanelOpen(false)}><X size={18} /></button>
                        </div>
                        <div className="bk-body">
                            <div className="bk-slot-info">
                                <CalendarIcon size={14} /> <span>{selectedSlot.date}</span>
                                <Clock size={14} className="ml-2" /> <span>{selectedSlot.time}</span>
                            </div>
                            <div className="form-group mt-4">
                                <label>Select Patient</label>
                                <SearchableDropdown
                                    patients={livePatients}
                                    value={bookingData.patientId}
                                    onChange={handleSelectPatient}
                                />
                            </div>
                            <div className="form-group mt-3">
                                <label>Visit Type</label>
                                <select value={bookingData.visitType} onChange={e => setBookingData({ ...bookingData, visitType: e.target.value })}>
                                    <option>Routine Prenatal</option>
                                    <option>High-Risk Follow-up</option>
                                    <option>Walk-in</option>
                                </select>
                            </div>
                            <div className="form-group mt-3">
                                <label>Assigned Staff</label>
                                <select value={bookingData.staff} onChange={e => setBookingData({ ...bookingData, staff: e.target.value })}>
                                    <option value="">Auto-assign</option>
                                    {staffList.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            {conflictWarning && (
                                <div className="conflict-box mt-3">
                                    <AlertTriangle size={14} /> {conflictWarning}
                                </div>
                            )}
                        </div>
                        <div className="bk-footer">
                            <button className="btn btn-outline" onClick={() => setBookingPanelOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleConfirmBooking} disabled={!bookingData.patientId}>
                                Confirm (30/day limit)
                            </button>
                        </div>
                    </div>
                </>
            )}

            {selectedVisit && (
                <ScheduledVisitModal 
                    visit={selectedVisit}
                    onClose={() => setSelectedVisit(null)}
                />
            )}
        </div>
    );
};

export default PrenatalVisits;