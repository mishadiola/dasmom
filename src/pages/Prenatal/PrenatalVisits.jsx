import React, { useState, useRef, useEffect } from 'react';
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

// ── Mock Data ──
const TIME_SLOTS = [
    '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM',
    '10:30 AM', '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'
];

const MOCK_APPOINTMENTS = [];

const MOCK_VISITS_TABLE = [];

const MOCK_PATIENTS = [];

const STAFF_LIST = ['Midwife Elena P.', 'Midwife Ana M.', 'Dr. Reyes (OB)'];

// ── Searchable Dropdown Component ──
const SearchableDropdown = ({ patients, value, onChange }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const selectedPatient = patients.find(p => p.id === value);
    const displayValue = open ? query : (selectedPatient ? `${selectedPatient.name} (${selectedPatient.id})` : '');

    const filtered = patients.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.id.toLowerCase().includes(query.toLowerCase())
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
                    value={open ? query : (selectedPatient ? `${selectedPatient.name} (${selectedPatient.id})` : '')}
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
                            className={`sd-item ${p.id === value ? 'sd-item--selected' : ''} sd-risk-${p.risk.toLowerCase()}`}
                            onMouseDown={() => handleSelect(p)}
                        >
                            <span className="sd-name">{p.name}</span>
                            <span className="sd-meta">{p.id} · <span className={`sd-risk-dot risk-dot-${p.risk.toLowerCase()}`}></span> {p.risk}</span>
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

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [bookingPanelOpen, setBookingPanelOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [toast, setToast] = useState(null);
    const [calendarView, setCalendarView] = useState('week'); // 'day' | 'week' | 'month'
    const [selectedVisit, setSelectedVisit] = useState(null);

    // Booking States
    const [selectedSlot, setSelectedSlot] = useState({ date: null, time: null });
    const [bookingData, setBookingData] = useState({
        patientId: '',
        patientName: '',
        visitType: 'Routine Prenatal',
        staff: 'Midwife Elena P.',
        location: 'Main Clinic - Rm 1'
    });
    const [conflictWarning, setConflictWarning] = useState(null);
    const [livePatients, setLivePatients] = useState([]);

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const data = await PatientService.getAllPatients();
                const mapped = data.map(p => ({
                    id: p.id,
                    name: p.name,
                    risk: p.risk || 'Normal'
                }));
                setLivePatients(mapped);
            } catch (err) {
                console.error("Failed to load patients for search:", err);
            }
        };
        fetchPatients();
    }, []);

    // ── Date Logic ──
    const getWeekDays = (date) => {
        const start = new Date(date);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        const days = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push({
                date: d.toISOString().split('T')[0],
                label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
            });
        }
        return days;
    };

    const getDayView = (date) => {
        const d = new Date(date);
        return [{
            date: d.toISOString().split('T')[0],
            label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        }];
    };

    const getMonthDays = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dt = new Date(year, month, d);
            days.push({
                date: dt.toISOString().split('T')[0],
                label: d.toString(),
                weekday: dt.toLocaleDateString('en-US', { weekday: 'short' })
            });
        }
        return days;
    };

    const visibleDays = React.useMemo(() => (
        calendarView === 'day'
            ? getDayView(currentDate)
            : calendarView === 'week'
                ? getWeekDays(currentDate)
                : getMonthDays(currentDate)
    ), [calendarView, currentDate]);

    // ── Auto-open booking panel when navigated from Dashboard ──
    useEffect(() => {
        if (location.state?.openBooking && visibleDays.length > 0) {
            setSelectedSlot({ 
                date: visibleDays[0].date, 
                time: '08:00 AM' 
            });
            setBookingPanelOpen(true);
            
            // ✅ Clear the state properly in history
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, visibleDays, navigate, location.pathname]);

    // ── Close on Escape Key ──
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') setBookingPanelOpen(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);


    const handlePrev = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            if (calendarView === 'day') d.setDate(d.getDate() - 1);
            else if (calendarView === 'week') d.setDate(d.getDate() - 7);
            else d.setMonth(d.getMonth() - 1);
            return d;
        });
    };

    const handleNext = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            if (calendarView === 'day') d.setDate(d.getDate() + 1);
            else if (calendarView === 'week') d.setDate(d.getDate() + 7);
            else d.setMonth(d.getMonth() + 1);
            return d;
        });
    };

    const coverageColor = (v) => v >= 90 ? '#a0c282' : v >= 80 ? '#edbd9a' : '#b68191';


    const formatNavLabel = () => {
        if (calendarView === 'day') {
            return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
        if (calendarView === 'week') {
            const days = getWeekDays(currentDate);
            const start = new Date(days[0].date);
            const end = new Date(days[days.length - 1].date);
            return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // ── Slot Logic ──
    const getSlotStatus = (date, time) => {
        const appts = MOCK_APPOINTMENTS.filter(a => a.date === date && a.time === time);
        if (appts.length >= 2) return 'Full';
        if (appts.length === 1) return appts[0];
        return 'Available';
    };

    const getApptCountForDay = (date) => {
        return MOCK_APPOINTMENTS.filter(a => a.date === date).length;
    };

    const handleSlotClick = (date, time, status) => {
        if (status === 'Full') return;
        if (status !== 'Available') {
            // Find patient data if available
            const patient = MOCK_PATIENTS.find(p => p.name === status.patient);
            setSelectedVisit({
                ...status,
                patientId: patient ? patient.id : 'PT-2026-N1',
                visitDate: date,
                time: time,
                risk: status.risk || 'Normal',
                visitType: status.type || 'Prenatal'
            });
            return;
        }
        setSelectedSlot({ date, time });
        setConflictWarning(null);
        setBookingPanelOpen(true);
    };

    const handleUpdateVisitStatus = (id, updates) => {
        setToast(`Visit for ${selectedVisit.patientName} updated to ${updates.status}`);
        setTimeout(() => setToast(null), 3000);
        // In a real app, we would update the state/API here
    };

    const handleSelectPatient = (val) => {
        const p = livePatients.find(pt => pt.id === val);
        if (p) {
            setBookingData({ ...bookingData, patientId: p.id, patientName: p.name });
            // Conflict check logic (optional expansion here)
            setConflictWarning(null);
        } else {
            setBookingData({ ...bookingData, patientId: '', patientName: '' });
            setConflictWarning(null);
        }
    };

    const handleConfirmBooking = () => {
        setToast('Additional visit scheduled successfully!');
        setBookingPanelOpen(false);
        setTimeout(() => setToast(null), 3000);
    };

    // ── Table Logic ──
    const filteredVisits = MOCK_VISITS_TABLE.filter(v =>
        (v.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || v.patientId.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterStatus === 'All' || v.status === filterStatus)
    );

    const getRowClass = (status) => {
        if (status === 'Upcoming') return 'tr-upcoming';
        if (status === 'Completed') return 'tr-completed';
        if (status === 'Waiting') return 'tr-waiting';
        return '';
    };

    const todayObj = new Date();
    const TODAY = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    return (
        <div className="prenatal-visits-overall">
            {toast && (
                <div className="toast toast--success">
                    <span><CheckCircle2 size={16} /> {toast}</span>
                    <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
                </div>
            )}

            <div className="page-header">
                <div>
                    <h1 className="page-title">Prenatal Visits &amp; Scheduling</h1>
                    <p className="page-subtitle">Unified view of facility workload and patient checkups</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => {
                        setSelectedSlot({ date: visibleDays[0].date, time: '08:00 AM' });
                        setBookingPanelOpen(true);
                    }}>
                        <Plus size={16} /> Schedule Additional Visit
                    </button>
                </div>
            </div>

            {/* ── CALENDAR SECTION ── */}
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
                                    onClick={() => setCalendarView(v)}
                                >
                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="legend-pills">
                            <span><i className="dot d-avail"></i> Available</span>
                            <span><i className="dot d-booked"></i> Booked</span>
                            <span><i className="dot d-full"></i> Full</span>
                        </div>
                    </div>
                </div>

                {/* MONTH VIEW */}
                {calendarView === 'month' ? (
                    <div className="month-grid-wrap">
                        <div className="month-weekday-row">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                <div key={d} className="month-weekday-label">{d}</div>
                            ))}
                        </div>
                        <div className="month-day-grid">
                            {/* blank cells for offset */}
                            {Array.from({ length: (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
                                <div key={`blank-${i}`} className="month-cell month-cell--empty"></div>
                            ))}
                            {getMonthDays(currentDate).map(day => {
                                const count = getApptCountForDay(day.date);
                                const isToday = day.date === TODAY;
                                return (
                                    <div
                                        key={day.date}
                                        className={`month-cell ${isToday ? 'month-cell--today' : ''} ${count > 0 ? 'month-cell--has-appts' : ''}`}
                                        onClick={() => { setCurrentDate(new Date(day.date + 'T12:00:00')); setCalendarView('day'); }}
                                    >
                                        <span className="month-day-num">{day.label}</span>
                                        {count > 0 && (
                                            <span className="month-appt-badge">{count} appt{count > 1 ? 's' : ''}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* DAY & WEEK VIEW */
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
                                            const isHigh = status !== 'Available' && status !== 'Full' && status.risk === 'High';
                                            return (
                                                <td
                                                    key={day.date}
                                                    className={`pc-slot ${status === 'Available' ? 'slot-avail' : status === 'Full' ? 'slot-full' : isHigh ? 'slot-high' : 'slot-booked'}`}
                                                    onClick={() => handleSlotClick(day.date, time, status)}
                                                >
                                                    {status === 'Available' ? 'Available' : status === 'Full' ? 'FULL' : (
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
                )}
            </div>

            {/* ── VISITS TABLE ── */}
            <div className="pv-table-section">
                <div className="section-header-row">
                    <h2 className="section-title"><Clock size={18} /> Upcoming &amp; Recent Visits</h2>
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
                                        <span className={`risk-tag risk-${visit.risk.replace(' ', '-').toLowerCase()}`}>
                                            {visit.risk}
                                        </span>
                                    </td>
                                    <td><span className={`status-pill pill-${visit.status.toLowerCase()}`}>{visit.status}</span></td>
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

            {/* ── Booking Slide-over Panel ── */}
            {bookingPanelOpen && (
                <>
                    <div className="bk-overlay" onClick={() => setBookingPanelOpen(false)}></div>
                    <div className="bk-panel slide-in-right">
                        <div className="bk-header">
                            <h2>Schedule Additional Visit</h2>
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
                                <label>Reason / Visit Type</label>
                                <select value={bookingData.visitType} onChange={e => setBookingData({ ...bookingData, visitType: e.target.value })}>
                                    <option>Routine Prenatal (Auto-gen)</option>
                                    <option>High-Risk Follow-up</option>
                                    <option>Walk-in Consultation</option>
                                    <option>Emergency Check</option>
                                    <option>Laboratory Review</option>
                                </select>
                            </div>
                            <div className="form-group mt-3">
                                <label>Assigned Midwife/Staff</label>
                                <select value={bookingData.staff} onChange={e => setBookingData({ ...bookingData, staff: e.target.value })}>
                                    {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
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
                            <button className="btn btn-primary" onClick={handleConfirmBooking} disabled={!bookingData.patientId || !!conflictWarning}>
                                Confirm Schedule
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Scheduled Visit Modal ── */}
            {selectedVisit && (
                <ScheduledVisitModal 
                    visit={selectedVisit}
                    onClose={() => setSelectedVisit(null)}
                    onUpdateStatus={handleUpdateVisitStatus}
                />
            )}
        </div>
    );
};

export default PrenatalVisits;
