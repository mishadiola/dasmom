import React, { useState, useEffect } from 'react';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import { 
    Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, 
    Clock, ArrowLeft, Download, Printer,
    CheckCircle2, AlertCircle, CalendarDays
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MyAppointments.css';

const toLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const formatReadableDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
};

const formatCalendarDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
};

const getDateOnly = (value) => String(value || '').split('T')[0];

const getPostpartumStatus = (delivery) => {
    if (delivery.postpartum_attended_date) return 'Completed';
    const scheduledDate = getDateOnly(delivery.postpartum_visit_date);
    const today = new Date().toISOString().split('T')[0];
    return scheduledDate && scheduledDate < today ? 'Missed' : 'Scheduled';
};

const MyAppointments = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState('month'); // 'day', 'week', 'month'
    const [filterTab, setFilterTab] = useState('All'); // 'All', 'Upcoming', 'Past' for list view
    const [calendarFilter, setCalendarFilter] = useState('All'); // 'All', 'Prenatal', 'Vaccination', 'Postpartum'

    const [appointmentsData, setAppointmentsData] = useState([]);

    useEffect(() => {
        const loadAppointments = async () => {
            const auth = new AuthService();
            const patientService = new PatientService();
            try {
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;

                const patient = await patientService.getPatientById(authUser.id);
                if (!patient) {
                    setAppointmentsData([]);
                    return;
                }

                // Map prenatal visits to unified appointment objects
                const visitAppts = (patient.visits || [])
                    .filter(v => v.visit_date)
                    .map(v => ({
                        id: v.id,
                        date: v.visit_date,
                        time: v.visit_date ? new Date(v.visit_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
                        type: 'Prenatal',
                        status: v.status || 'Scheduled',
                        location: patient.station || '',
                        notes: v.clinical_notes || '',
                        color: 'green'
                    }));

                // Map vaccinations to appointment-like events (use vaccine name in notes)
                const vacAppts = (patient.vaccines || [])
                    .filter(v => v.scheduled_vaccination || v.vaccinated_date)
                    .map((v, idx) => ({
                        id: v.id || `vac-${idx}`,
                        date: v.scheduled_vaccination || v.vaccinated_date,
                        time: '',
                        type: 'Vaccination',
                        status: v.status || 'Scheduled',
                        location: patient.station || '',
                        notes: v.notes || v.vaccine_name || '',
                        color: 'yellow'
                    }));

                const postpartumAppts = (patient.deliveries || [])
                    .filter(d => d.postpartum_visit_date || d.postpartum_attended_date)
                    .map((d, idx) => {
                        const status = getPostpartumStatus(d);
                        const date = d.postpartum_attended_date || d.postpartum_visit_date;
                        return {
                            id: d.id || `postpartum-${idx}`,
                            date,
                            scheduledDate: d.postpartum_visit_date,
                            attendedDate: d.postpartum_attended_date,
                            time: '',
                            type: 'Postpartum',
                            status,
                            location: patient.station || '',
                            notes: status === 'Completed'
                                ? 'Postpartum follow-up attended'
                                : status === 'Missed'
                                    ? 'Postpartum follow-up was not attended'
                                    : 'Postpartum follow-up scheduled',
                            assessment: d.postpartum_remarks,
                            color: 'pink'
                        };
                    });

                const combined = [...visitAppts, ...vacAppts, ...postpartumAppts];
                setAppointmentsData(combined);
            } catch (err) {
                console.error('Failed to load appointments:', err);
                setAppointmentsData([]);
            }
        };
        loadAppointments();
    }, [currentDate]);

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

    const visibleDays = getVisibleDays(currentDate, calendarView);
    const TODAY = new Date().toISOString().split('T')[0];

    const formatNavLabel = () => {
        if (calendarView === 'day') return formatReadableDate(visibleDays[0]?.date);
        if (!visibleDays || visibleDays.length === 0) return '';
        const start = new Date(visibleDays[0].date);
        const end = new Date(visibleDays[visibleDays.length - 1].date);
        if (calendarView === 'month') {
            return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        return `${formatReadableDate(start)} – ${formatReadableDate(end)}`;
    };

    const getAppointmentsForDay = (dateStr) => {
        let appointments = (appointmentsData || []).filter(a => {
            if (!a.date) return false;
            // Handle both YYYY-MM-DD format and Date objects
            const apptDate = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
            return apptDate === dateStr;
        });

        if (calendarFilter === 'All') return appointments;
        if (calendarFilter === 'Prenatal') return appointments.filter(a => a.type === 'Prenatal');
        if (calendarFilter === 'Vaccination') return appointments.filter(a => a.type === 'Vaccination');
        if (calendarFilter === 'Postpartum') return appointments.filter(a => a.type === 'Postpartum');
        return appointments;
    };

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

    const getFilteredAppointments = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (filterTab === 'All') return appointmentsData;
        if (filterTab === 'Upcoming') {
            return (appointmentsData || [])
                .filter(a => {
                    const apptDate = new Date(a.date);
                    apptDate.setHours(0, 0, 0, 0);
                    return apptDate >= today && (a.status === 'Upcoming' || a.status === 'Scheduled' || a.status === 'Attended');
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date));
        }
        if (filterTab === 'Past') {
            return (appointmentsData || [])
                .filter(a => {
                    const apptDate = new Date(a.date);
                    apptDate.setHours(0, 0, 0, 0);
                    return apptDate < today || a.status === 'Completed' || a.status === 'Missed';
                })
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        return appointmentsData;
    };

    const filteredAppointments = getFilteredAppointments();

    return (
        <div className="my-appointments-page">
            <button className="back-btn-small" onClick={() => navigate('/mother-home')}>
                <ArrowLeft size={16} /> Back
            </button>

            <div className="appt-gradient-header-card">
                <div className="appt-header-left">
                    <div className="appt-title-block">
                        <div className="appt-title-row">
                            <h1 className="appt-title">Appointments</h1>
                        </div>
                        <p className="appt-meta">
                            Keep track of your upcoming visits and health schedule
                        </p>
                    </div>
                </div>
                <div className="appt-header-right">
                    <div className="header-actions">
                        <div className="view-toggle" style={{ background: 'rgba(255, 255, 255, 0.4)', border: '1px solid rgba(255,255,255,0.6)' }}>
                            <button 
                                className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                                onClick={() => setViewMode('calendar')}
                            >
                                <CalendarIcon size={16} /> Calendar
                            </button>
                            <button 
                                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                            >
                                <List size={16} /> List
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="appt-content">
                {viewMode === 'calendar' ? (
                    <>
                    {/* Event Category Tabs — above the calendar, matching Staff Calendar tab style */}
                    <div className="visit-type-tabs">
                        <button
                            className={`visit-type-tab ${calendarFilter === 'All' ? 'active' : ''}`}
                            onClick={() => setCalendarFilter('All')}
                        >
                            All
                        </button>
                        <button
                            className={`visit-type-tab ${calendarFilter === 'Prenatal' ? 'active' : ''}`}
                            onClick={() => setCalendarFilter('Prenatal')}
                        >
                            Prenatal
                        </button>
                        <button
                            className={`visit-type-tab ${calendarFilter === 'Vaccination' ? 'active' : ''}`}
                            onClick={() => setCalendarFilter('Vaccination')}
                        >
                            Vaccination
                        </button>
                        <button
                            className={`visit-type-tab ${calendarFilter === 'Postpartum' ? 'active' : ''}`}
                            onClick={() => setCalendarFilter('Postpartum')}
                        >
                            Postpartum
                        </button>
                    </div>

                    <div className="pv-calendar-section">
                        <div className="section-head-bar">
                            <div className="date-nav">
                                <button className="icon-btn-sm" onClick={handlePrev} title="Previous">
                                    <ChevronLeft size={16} />
                                </button>
                                <h2>{formatNavLabel()}</h2>
                                <button className="icon-btn-sm" onClick={handleNext} title="Next">
                                    <ChevronRight size={16} />
                                </button>
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
                                    <span><i className="dot d-prenatal"></i> Prenatal</span>
                                    <span><i className="dot d-postpartum"></i> Postpartum</span>
                                    <span><i className="dot d-vaccination"></i> Vaccination</span>
                                </div>
                            </div>
                        </div>

                        <div className="pv-grid-container">
                            {calendarView === 'day' ? (
                                <div className="day-view-container">
                                    {visibleDays.map(day => {
                                        const dayAppts = getAppointmentsForDay(day.date);
                                        return (
                                            <div key={day.date} className={`day-schedule-card ${day.date === TODAY ? 'day-today' : ''}`}>
                                                <div className="day-schedule-header">
                                                    <h3 className="day-schedule-title">
                                                        {day.label}
                                                        {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                                    </h3>
                                                    <span className="day-schedule-count">
                                                        {dayAppts.length} schedule{dayAppts.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div className="day-schedule-list">
                                                    {dayAppts.length > 0 ? (
                                                        dayAppts.map(appt => (
                                                            <div 
                                                                key={appt.id} 
                                                                className={`schedule-item status-${(appt.status || 'scheduled').toLowerCase()} type-${appt.type.toLowerCase()}`}
                                                            >
                                                                <div className="schedule-time">
                                                                    <Clock size={14} />
                                                                    <span>{appt.time || 'TBD'}</span>
                                                                </div>
                                                                <div className="schedule-details">
                                                                    <span className="schedule-patient">{appt.type === 'Vaccination' ? appt.notes : `${appt.type} Visit`}</span>
                                                                    <span className="schedule-id">{appt.location || ''}</span>
                                                                </div>
                                                                <span className={`schedule-status status-${(appt.status || 'scheduled').toLowerCase()}`}>
                                                                    {appt.status || 'Scheduled'}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="no-schedules">No schedules for this day</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className={`day-grid ${calendarView}-grid`}>
                                    {calendarView === 'week' ? (
                                        <div className="week-row">
                                            {visibleDays.map(day => {
                                                const dayAppts = getAppointmentsForDay(day.date);
                                                return (
                                                    <div key={day.date} className={`day-cell ${day.date === TODAY ? 'day-today' : ''}`} onClick={() => { setCalendarView('day'); setCurrentDate(new Date(day.date)); }}>
                                                        <h4 className="day-header">
                                                            {formatCalendarDate(day.date)}
                                                            {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                                        </h4>
                                                        <div className="day-visits">
                                                            {dayAppts.map(appt => (
                                                                <div 
                                                                    key={appt.id} 
                                                                    className={`visit-item status-${(appt.status || 'scheduled').toLowerCase()} type-${appt.type.toLowerCase()} color-${appt.color}`}
                                                                    title={`${appt.type} - ${appt.notes || ''}`}
                                                                >
                                                                    <span className="visit-title">{appt.type === 'Vaccination' ? appt.notes : `${appt.type} Visit`}</span>
                                                                    <span className="visit-status">{appt.status || 'Scheduled'}</span>
                                                                </div>
                                                            ))}
                                                            {dayAppts.length === 0 && (
                                                                <div className="no-visits" style={{color: '#94a3b8', fontSize: '11px', textAlign: 'center', padding: '10px 0'}}>No schedules</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        // Month view
                                        (() => {
                                            const weeks = [];
                                            for (let i = 0; i < visibleDays.length; i += 7) {
                                                weeks.push(visibleDays.slice(i, i + 7));
                                            }
                                            return weeks.map((week, wIdx) => (
                                                <div key={wIdx} className="week-row">
                                                    {week.map(day => {
                                                        const dayAppts = getAppointmentsForDay(day.date);
                                                        return (
                                                            <div key={day.date} className={`day-cell ${day.date === TODAY ? 'day-today' : ''}`} onClick={() => { setCalendarView('day'); setCurrentDate(new Date(day.date)); }}>
                                                                <h4 className="day-header">
                                                                    {new Date(day.date).getDate()}
                                                                    {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                                                </h4>
                                                                <div className="day-visits">
                                                                    {dayAppts.map(appt => (
                                                                        <div 
                                                                            key={appt.id} 
                                                                            className={`visit-item status-${(appt.status || 'scheduled').toLowerCase()} type-${appt.type.toLowerCase()} color-${appt.color}`}
                                                                            title={`${appt.type} - ${appt.notes || ''}`}
                                                                        >
                                                                            <span className="visit-title">{appt.type === 'Vaccination' ? appt.notes : `${appt.type} Visit`}</span>
                                                                            <span className="visit-status">{appt.status || 'Scheduled'}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ));
                                        })()
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    </>
                ) : (
                    <div className="list-container">
                        <div className="list-filters">
                            <button 
                                className={`filter-btn ${filterTab === 'All' ? 'active' : ''}`}
                                onClick={() => setFilterTab('All')}
                            >
                                All
                            </button>
                            <button 
                                className={`filter-btn ${filterTab === 'Upcoming' ? 'active' : ''}`}
                                onClick={() => setFilterTab('Upcoming')}
                            >
                                Upcoming
                            </button>
                            <button 
                                className={`filter-btn ${filterTab === 'Past' ? 'active' : ''}`}
                                onClick={() => setFilterTab('Past')}
                            >
                                Past
                            </button>
                        </div>

                        <div className="appt-list">
                            {filteredAppointments.length > 0 ? (
                                filteredAppointments.sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => (
                                <div key={a.id} className="appt-list-item">
                                    <div className={`appt-date-box ${a.color}`}>
                                        <span className="m">{new Date(a.date || a.visit_date || Date.now()).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                                        <span className="d">{(a.date || a.visit_date || '').split('-')[2] || ''}</span>
                                    </div>
                                    <div className="appt-main-info">
                                        <div className="appt-title-row">
                                            <h3>{a.type} Visit</h3>
                                            <span className={`status-badge ${a.status.toLowerCase()}`}>
                                                   {String(a.status || '').toLowerCase() === 'completed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                   {a.status || 'Unknown'}
                                            </span>
                                        </div>
                                        <div className="appt-meta-row">
                                            <span><Clock size={14} /> {a.time}</span>
                                            <span><MapPin size={14} /> {a.location}</span>
                                        </div>
                                        <p className="appt-desc">{a.notes}</p>
                                    </div>
                                    <div className="appt-actions">
                                        <button className="btn-icon-outline" title="Print Details"><Printer size={16} /></button>
                                        <button className="btn-icon-outline" title="Download"><Download size={16} /></button>
                                    </div>
                                </div>
                            ))
                            ) : (
                                <div className="empty-state">
                                    <CalendarDays size={32} />
                                    <p>No appointments found for this filter.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <footer className="appt-footer">
                <AlertCircle size={14} />
                <p>Appointments are managed by healthcare staff. Please contact your local health station for rescheduling.</p>
            </footer>
        </div>
    );
};

export default MyAppointments;
