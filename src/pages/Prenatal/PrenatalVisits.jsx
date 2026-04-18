import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PatientService from '../../services/patientservice';
import {
    Search, Plus, Eye, Edit2, Trash2, CalendarCheck,
    AlertTriangle, HeartPulse, Filter, Clock, ChevronLeft,
    ChevronRight, Calendar as CalendarIcon, Users, MapPin, X,
    CheckCircle2
} from 'lucide-react';
import ScheduledVisitModal from '../../components/Prenatal/ScheduledVisitModal';
import PatientModal from '../../components/Prenatal/PatientModal';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/PrenatalVisits.css';

const toLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

// New helper function for readable date formatting
const formatReadableDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
};

// Helper function for formatting calendar date labels
const formatCalendarDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { 
        month: 'short', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
};

const TIME_SLOTS = [
    '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM',
    '10:30 AM', '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'
];

// Helper to convert TIME_SLOTS format (12-hour) to 24-hour format
const convertTo24Hour = (timeStr) => {
    const [time, period] = timeStr.trim().split(' ');
    const [hours, minutes] = time.split(':');
    let h = parseInt(hours);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${minutes}`;
};

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

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const [currentDate, setCurrentDate] = useState(new Date());
    const [toast, setToast] = useState(null);
    const [calendarView, setCalendarView] = useState('week'); // day, week, month
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [visitsTable, setVisitsTable] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);

    const patientService = useMemo(() => new PatientService(), []);

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
                    label: formatCalendarDate(curr)
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
                    label: formatCalendarDate(curr)
                });
            }
            return days;
        }
        return [];
    };

    const fetchData = useCallback(async () => {
        try {
            const vDays = getVisibleDays(currentDate, calendarView);
            if (vDays.length === 0) return;
            
            // Fetch perfectly aligned with the visual grid columns
            const startDate = vDays[0].date;
            const endDate = vDays[vDays.length - 1].date;

            const [, visitsData, apptsData] = await Promise.all([
                patientService.getAllPatients(),
                patientService.getPrenatalVisits(),
                patientService.getAppointments(startDate, endDate, calendarView)
            ]);

            // Ensure visits have consistent local date format for filtering
            const processedVisits = (visitsData || []).map(v => {
                const visitDateTime = v.visitDate ? new Date(v.visitDate) : null;
                return {
                    ...v,
                    visitDateOnly: visitDateTime ? toLocalDateStr(visitDateTime) : ''
                };
            });

            setVisitsTable(processedVisits);
            setAppointments(apptsData || []);

        } catch (error) {
            console.error(error);
        }
    }, [currentDate, calendarView, patientService]);

    const handleUpdateVisitStatus = async (visitId, updates) => {
        try {
            await patientService.updatePrenatalVisitStatus(visitId, updates);
            await fetchData();
            setToast('Visit status updated successfully!');
            setTimeout(() => setToast(null), 3000);
        } catch (error) {
            console.error('Error updating visit:', error);
            setToast('Failed to update visit status.');
            setTimeout(() => setToast(null), 3000);
        }
    };

    // Now useEffect for channel
    useEffect(() => {
        fetchData();

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
    }, [calendarView, currentDate, fetchData, patientService.supabase]);

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
        if (calendarView === 'day') return formatReadableDate(visibleDays[0]?.date);
        if (!visibleDays || visibleDays.length === 0) return '';
        const start = new Date(visibleDays[0].date);
        const end = new Date(visibleDays[visibleDays.length - 1].date);
        return calendarView === 'week' 
            ? `${formatReadableDate(start)} – ${formatReadableDate(end)}`
            : formatReadableDate(start);
    };

    const getSlotStatus = useCallback((date, time) => {
        const time24 = convertTo24Hour(time);
        
        // Filter visits for this EXACT date and time slot (not >= range)
        const visitsForSlot = visitsTable.filter(v => {
            if (!v.visitDate) return false;
            const visitDateTime = new Date(v.visitDate);
            const visitDate = toLocalDateStr(visitDateTime);
            const visitTime24 = visitDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            // Only show visit in the exact time slot it's scheduled for
            return visitDate === date && visitTime24 === time24;
        });

        // Deduplicate by patient ID per time slot per day
        const uniqueVisits = [];
        const seenPatients = new Set();
        for (const v of visitsForSlot) {
            if (!seenPatients.has(v.patientId)) {
                uniqueVisits.push(v);
                seenPatients.add(v.patientId);
            }
        }

        if (uniqueVisits.length > 0) {
            const visit = uniqueVisits[0];
            return { hasVisit: true, visits: uniqueVisits, status: visit.status, patient: visit.patientName, type: 'Prenatal Visit' };
        }

        const dayAppts = appointments.filter(a => a.date === date);
        const timeAppts = dayAppts.filter(a => a.time === time);
        
        if (dayAppts.length >= 35) return { status: 'FULL_DAY', label: 'FULL DAY' };
        if (timeAppts.length >= 2) return { status: 'FULL', label: 'FULL' };
        if (timeAppts.length === 1) return timeAppts[0];
        return { status: 'AVAILABLE', label: 'Available' };
    }, [visitsTable, appointments]);

    const handleSlotClick = (date, time, status) => {
        // Calendar is now view-only - no manual scheduling allowed
        if (status !== 'Available') {
            setSelectedVisit({
                ...status,
                visitDate: date,
                time
            });
            return;
        }
        // Do nothing for available slots - no booking panel will open
    };

    const visibleDays = getVisibleDays(currentDate, calendarView);
    const filteredVisits = visitsTable.filter(v =>
        (v.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         v.patientId?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterStatus === 'All' || v.status === filterStatus)
    );

    // Group visits by patient
    const uniquePatients = Array.from(
        new Map(filteredVisits.map(visit => [visit.patientId, {
            id: visit.patientId,
            name: visit.patientName,
            risk: visit.risk,
            nextVisit: (() => {
                const nextScheduled = filteredVisits.filter(v => v.patientId === visit.patientId && v.status === 'Scheduled' && new Date(v.visitDate) >= new Date()).sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate))[0];
                return nextScheduled ? formatReadableDate(nextScheduled.visitDate) : 'No upcoming';
            })(),
            // Show last ATTENDED visit (not just any visit)
            lastVisit: (() => {
                const attended = filteredVisits.filter(v => v.patientId === visit.patientId && v.status === 'Attended')
                    .sort((a, b) => {
                        const dateA = a.attendedDate ? new Date(a.attendedDate) : new Date(a.visitDate);
                        const dateB = b.attendedDate ? new Date(b.attendedDate) : new Date(b.visitDate);
                        return dateB - dateA;
                    })[0];
                return attended ? (attended.attendedDate || attended.visitDate) : 'No completed visit';
            })(),
            totalVisits: filteredVisits.filter(v => v.patientId === visit.patientId).length
        }])).values()
    );

    const totalPages = Math.ceil(uniquePatients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPatients = uniquePatients.slice(startIndex, startIndex + itemsPerPage);

    const TODAY = new Date().toISOString().split('T')[0];

    return (
        <div className="prenatal-visits-overall">
            {toast && <div className="toast toast--success"><CheckCircle2 size={16} /> {toast}</div>}

            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Visits & Scheduling</h1>
                    <p className="page-subtitle">30 slots/day max (25 regular + 5 rescheduling)</p>
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
                    {calendarView === 'day' ? (
                        <table className="pc-grid">
                            <thead>
                                <tr>
                                    <th className="th-time">Time</th>
                                    {visibleDays.map(day => (
                                        <th key={day.date} className={day.date === TODAY ? 'th-today' : ''}>
                                            {formatCalendarDate(day.date)}
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
                                            const slotData = getSlotStatus(day.date, time);
                                            let slotClass = 'slot-avail';
                                            
                                            if (slotData.hasVisit) {
                                                // Status-based coloring for prenatal visits
                                                if (slotData.status === 'Attended') {
                                                    slotClass = 'slot-attended'; // Green
                                                } else if (slotData.status === 'Missed') {
                                                    slotClass = 'slot-missed'; // Red
                                                } else if (slotData.status === 'Scheduled') {
                                                    slotClass = 'slot-scheduled'; // Yellow
                                                } else if (slotData.status === 'Cancelled') {
                                                    slotClass = 'slot-cancelled'; // Gray
                                                }
                                            } else if (slotData.status === 'FULL_DAY' || slotData.status === 'FULL') {
                                                slotClass = 'slot-full';
                                            } else if (slotData.status && slotData.status !== 'AVAILABLE') {
                                                slotClass = 'slot-booked';
                                            }

                                            return (
                                                <td
                                                    key={day.date}
                                                    className={`pc-slot ${slotClass}`}
                                                    onClick={() => slotData.status !== 'AVAILABLE' && handleSlotClick(day.date, time, slotData)}
                                                >
                                                    {slotData.hasVisit ? (
                                                        <div className="booked-card">
                                                            <span className="bc-name">{slotData.patient}</span>
                                                            <span className="bc-type">{slotData.status}</span>
                                                        </div>
                                                    ) : slotData.label === 'FULL DAY' ? (
                                                        'FULL DAY'
                                                    ) : slotData.label === 'FULL' ? (
                                                        'FULL'
                                                    ) : slotData.status === 'AVAILABLE' ? (
                                                        'Available'
                                                    ) : (
                                                        <div className="booked-card">
                                                            <span className="bc-name">{slotData.patient}</span>
                                                            <span className="bc-type">{slotData.type}</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className={`day-grid ${calendarView}-grid`}>
                            {calendarView === 'week' ? (
                                <div className="week-row">
                                    {visibleDays.map(day => (
                                        <div key={day.date} className={`day-cell ${day.date === TODAY ? 'day-today' : ''}`}>
                                            <h4 className="day-header">
                                                {formatCalendarDate(day.date)}
                                                {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                            </h4>
                                            <div className="day-visits">
                                                {visitsTable.filter(v => v.visitDateOnly === day.date).map(v => (
                                                    <div key={v.id} className={`visit-item status-${v.status.toLowerCase()}`}>
                                                        <span className="visit-patient">{v.patientName}</span>
                                                        <span className="visit-status">{v.status}</span>
                                                        <span className="visit-time">{new Date(v.visitDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                ))}
                                                {visitsTable.filter(v => v.visitDateOnly === day.date).length === 0 && (
                                                    <div className="no-visits">No visits</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                // Month view: group days into weeks
                                (() => {
                                    const weeks = [];
                                    for (let i = 0; i < visibleDays.length; i += 7) {
                                        weeks.push(visibleDays.slice(i, i + 7));
                                    }
                                    return weeks.map((week, weekIndex) => (
                                        <div key={weekIndex} className="week-row">
                                            {week.map(day => (
                                                <div key={day.date} className={`day-cell ${day.date === TODAY ? 'day-today' : ''}`}>
                                                    <h4 className="day-header">
                                                        {formatCalendarDate(day.date)}
                                                        {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                                    </h4>
                                                    <div className="day-visits">
                                                        {visitsTable.filter(v => v.visitDateOnly === day.date).map(v => (
                                                            <div key={v.id} className={`visit-item status-${v.status.toLowerCase()}`}>
                                                                <span className="visit-patient">{v.patientName}</span>
                                                                <span className="visit-status">{v.status}</span>
                                                            </div>
                                                        ))}
                                                        {visitsTable.filter(v => v.visitDateOnly === day.date).length === 0 && (
                                                            <div className="no-visits">No visits</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ));
                                })()
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* VISITS TABLE */}
            <div className="pv-table-section">
                <div className="section-header-row">
                    <h2 className="section-title"><Clock size={18} /> Upcoming & Recent Visits</h2>
                    <div className="table-filters">
                        <div className="header-search">
                            <Search size={14} className="hs-icon" />
                            <input 
                                type="text" 
                                placeholder="Search patient name…" 
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="hs-input"
                            />
                        </div>
                        <select 
                            className="header-filter-select"
                            value={filterStatus}
                            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="Upcoming">Upcoming</option>
                        </select>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="pv-table">
                        <thead>
                            <tr>
                                <th>Patient Name</th>
                                <th>Risk Level</th>
                                <th>Next Visit</th>
                                <th>Last Visit</th>
                                <th>Total Visits</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPatients.map(patient => (
                                <tr key={patient.id}>
                                    <td>
                                        <div className="p-info">
                                            <span className="p-name">{patient.name}</span>
                                            <span className="p-id">{patient.id}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`risk-tag risk-${patient.risk?.replace(' ', '-').toLowerCase() || 'normal'}`}>
                                            {patient.risk}
                                        </span>
                                    </td>
                                    <td>{patient.nextVisit !== 'No upcoming' ? formatReadableDate(patient.nextVisit) : 'No upcoming'}</td>
                                    <td>{formatReadableDate(patient.lastVisit)}</td>
                                    <td>{patient.totalVisits}</td>
                                    <td className="text-right">
                                        <div className="row-actions">
                                            <button className="icon-btn" onClick={() => navigate(`/dashboard/prenatal/add/${patient.id}`)}><Plus size={14} /></button>
                                            <button className="icon-btn" onClick={() => setSelectedPatient(patient.id)}><Eye size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="pagination-wrap">
                        <span>
                            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, uniquePatients.length)} of {uniquePatients.length}
                        </span>

                        <div className="pagination-controls">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="page-btn">
                                <ChevronLeft size={16} />
                            </button>

                            <div className="page-numbers">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                                    <button 
                                        key={num}
                                        className={`page-num ${currentPage === num ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(num)}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>

                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="page-btn">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {selectedVisit && (
                <ScheduledVisitModal 
                    visit={selectedVisit}
                    onClose={() => setSelectedVisit(null)}
                    onUpdateStatus={handleUpdateVisitStatus}
                />
            )}

            {selectedPatient && (
                <PatientModal 
                    patientId={selectedPatient}
                    onClose={() => setSelectedPatient(null)}
                />
            )}
        </div>
    );
};

export default PrenatalVisits;