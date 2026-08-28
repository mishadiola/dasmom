import React, { useState, useEffect } from 'react';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import { 
    Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, 
    Clock, ArrowLeft, Download, Printer, X,
    CheckCircle2, AlertCircle, CalendarDays, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MyAppointments.css';
import appointmentSilhouette from '../../assets/images/appointments-silhouette.png';

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

const sanitizeUUID = (str, fallback) => {
    if (!str) return fallback;
    if (typeof str === 'string' && str.length === 36 && str.includes('-')) {
        return fallback;
    }
    return str;
};

const MyAppointments = () => {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState(window.innerWidth <= 768 ? 'list' : 'month'); // 'list', 'day', 'week', 'month'
    const [typeFilter, setTypeFilter] = useState('All'); // 'All', 'Prenatal', 'Vaccination', 'Postpartum'
    const [statusFilter, setStatusFilter] = useState('Upcoming'); // 'Upcoming', 'Attended', 'Missed'
    const [selectedAppt, setSelectedAppt] = useState(null);

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

                const visitAppts = (patient.visits || [])
                    .filter(v => v.visit_date)
                    .map(v => ({
                        id: v.id,
                        date: v.visit_date,
                        time: v.visit_date ? new Date(v.visit_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
                        type: 'Prenatal',
                        status: v.status || 'Scheduled',
                        location: sanitizeUUID(patient.station, 'Health Station'),
                        notes: v.clinical_notes || '',
                        color: 'green'
                    }));

                const vacAppts = (patient.vaccines || [])
                    .filter(v => v.scheduled_vaccination || v.vaccinated_date)
                    .map((v, idx) => ({
                        id: v.id || `vac-${idx}`,
                        date: v.scheduled_vaccination || v.vaccinated_date,
                        time: '',
                        type: 'Vaccination',
                        status: v.status || 'Scheduled',
                        location: sanitizeUUID(patient.station, 'Health Station'),
                        notes: sanitizeUUID(v.notes || v.vaccine_name, 'Vaccination'),
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
                            location: sanitizeUUID(patient.station, 'Health Station'),
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
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
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

    const getAppointmentsForDay = (dateStr) => {
        let appointments = (appointmentsData || []).filter(a => {
            if (!a.date) return false;
            const apptDate = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
            return apptDate === dateStr;
        });

        if (typeFilter !== 'All') {
            appointments = appointments.filter(a => a.type === typeFilter);
        }
        return appointments;
    };

    const getFilteredListAppointments = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let filtered = appointmentsData || [];
        
        // Filter by Type
        if (typeFilter !== 'All') {
            filtered = filtered.filter(a => a.type === typeFilter);
        }

        // Filter by Status Tab
        if (statusFilter === 'Upcoming') {
            return filtered.filter(a => {
                const apptDate = new Date(a.date);
                apptDate.setHours(0, 0, 0, 0);
                return apptDate >= today && ['Upcoming', 'Scheduled'].includes(a.status);
            }).sort((a, b) => new Date(a.date) - new Date(b.date));
        }
        if (statusFilter === 'Attended') {
            return filtered.filter(a => ['Attended', 'Completed'].includes(a.status))
                           .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        if (statusFilter === 'Missed') {
            return filtered.filter(a => ['Missed', 'Cancelled'].includes(a.status))
                           .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        return filtered;
    };

    const filteredList = getFilteredListAppointments();

    return (
        <div className="my-appointments-page">
            <div className="page-header hero-header-with-img">
                <img 
                    src={appointmentSilhouette} 
                    alt="Appointments Silhouette" 
                    className="hero-silhouette-bg" 
                />
                <div className="hero-content-wrapper">
                    <div className="hero-text-section">
                        <h1 className="page-title">
                            <CalendarIcon size={22} className="header-icon" style={{ display: 'inline', marginRight: '6px' }} /> Appointments
                        </h1>
                        <p className="page-subtitle">Keep track of your upcoming visits and health schedule</p>
                    </div>
                </div>
            </div>

            <div className="appt-content">
                {/* Event Category Tabs */}
                <div className="visit-type-tabs">
                    <button
                        className={`visit-type-tab ${typeFilter === 'All' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('All')}
                    >
                        All
                    </button>
                    <button
                        className={`visit-type-tab ${typeFilter === 'Prenatal' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('Prenatal')}
                    >
                        Prenatal
                    </button>
                    <button
                        className={`visit-type-tab ${typeFilter === 'Vaccination' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('Vaccination')}
                    >
                        Vaccination
                    </button>
                    <button
                        className={`visit-type-tab ${typeFilter === 'Postpartum' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('Postpartum')}
                    >
                        Postpartum
                    </button>
                </div>

                <div className="pv-calendar-section" style={{marginBottom: '32px'}}>
                    <div className="section-head-bar">
                        <div className="date-nav" style={{ visibility: calendarView === 'list' ? 'hidden' : 'visible' }}>
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
                                {['list', 'day', 'week', 'month'].map(v => (
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
                                <span><i className="dot d-vaccination"></i> Vaccination</span>
                                <span><i className="dot d-postpartum"></i> Postpartum</span>
                            </div>
                        </div>
                    </div>

                    {calendarView !== 'list' && (
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
                                                            className={`schedule-item type-${appt.type.toLowerCase()}`}
                                                            onClick={() => setSelectedAppt(appt)}
                                                            style={{cursor: 'pointer'}}
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
                                                                className={`visit-item type-${appt.type.toLowerCase()}`}
                                                                title={`${appt.type} - ${appt.notes || ''}`}
                                                                onClick={(e) => { e.stopPropagation(); setSelectedAppt(appt); }}
                                                            >
                                                                <span className="visit-title">{appt.type === 'Vaccination' ? appt.notes : `${appt.type} Visit`}</span>
                                                                <span className="visit-status">{appt.time || 'TBD'}</span>
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
                                                                        className={`visit-item type-${appt.type.toLowerCase()}`}
                                                                        title={`${appt.type} - ${appt.notes || ''}`}
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedAppt(appt); }}
                                                                    >
                                                                        <span className="visit-title">{appt.type === 'Vaccination' ? appt.notes : `${appt.type} Visit`}</span>
                                                                        <span className="visit-status">{appt.time || 'TBD'}</span>
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
                    )}
                </div>


                <div className="list-container">
                    <div className="list-filters">
                        <button 
                            className={`filter-btn ${statusFilter === 'Upcoming' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('Upcoming')}
                        >
                            Upcoming
                        </button>
                        <button 
                            className={`filter-btn ${statusFilter === 'Attended' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('Attended')}
                        >
                            Attended / Completed
                        </button>
                        <button 
                            className={`filter-btn ${statusFilter === 'Missed' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('Missed')}
                        >
                            Missed
                        </button>
                    </div>

                    <div className="appt-list">
                        {filteredList.length > 0 ? (
                            filteredList.map(a => (
                            <div key={a.id} className="appt-list-item" onClick={() => setSelectedAppt(a)} style={{cursor: 'pointer'}}>
                                <div className={`appt-date-box ${a.color}`}>
                                    <span className="m">{new Date(a.date || a.visit_date || Date.now()).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                                    <span className="d">{(a.date || a.visit_date || '').split('-')[2] || ''}</span>
                                </div>
                                <div className="appt-main-info">
                                    <div className="appt-title-row">
                                        <h3>{a.type === 'Vaccination' ? a.notes : `${a.type} Visit`}</h3>
                                        <span className={`status-badge ${a.status.toLowerCase()}`}>
                                                {String(a.status || '').toLowerCase() === 'completed' || String(a.status || '').toLowerCase() === 'attended' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                {a.status || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="appt-meta-row">
                                        <span><Clock size={14} /> {a.time || 'TBD'}</span>
                                        <span><MapPin size={14} /> {sanitizeUUID(a.location, 'Dasma I Health Station')}</span>
                                    </div>
                                </div>
                                <div className="appt-actions">
                                    <button className="btn-icon-outline" title="Print Details" onClick={(e) => e.stopPropagation()}><Printer size={16} /></button>
                                </div>
                            </div>
                        ))
                        ) : (
                            <div className="empty-state" style={{textAlign: 'center', padding: '40px 0', color: '#64748b', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0'}}>
                                <CalendarDays size={32} style={{margin: '0 auto 12px', color: '#cbd5e1'}}/>
                                <p style={{margin: 0, fontWeight: 500}}>No {statusFilter.toLowerCase()} appointments found.</p>
                                <p style={{margin: '4px 0 0', fontSize: '13px', opacity: 0.8}}>Try changing the filters above to see more records.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer className="appt-footer">
                <AlertCircle size={14} />
                <p>Appointments are managed by healthcare staff. Please contact your local health station for rescheduling.</p>
            </footer>

            {/* Read-Only Appointment Modal */}
            {selectedAppt && (
                <div className="modal-overlay" onClick={() => setSelectedAppt(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '450px', padding: 0}}>
                        <div className="modal-header" style={{padding: '24px 24px 16px', borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h2 style={{margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <CalendarIcon size={20} color="var(--color-rose)"/> Appointment Details
                            </h2>
                            <button className="btn-icon" onClick={() => setSelectedAppt(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{padding: '24px'}}>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span style={{color: '#64748b', fontSize: '13px', fontWeight: 600}}>Type</span>
                                    <span style={{fontWeight: 600}}>{selectedAppt.type}</span>
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span style={{color: '#64748b', fontSize: '13px', fontWeight: 600}}>Status</span>
                                    <span className={`status-badge ${selectedAppt.status.toLowerCase()}`}>{selectedAppt.status}</span>
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span style={{color: '#64748b', fontSize: '13px', fontWeight: 600}}>Date</span>
                                    <span style={{fontWeight: 600}}>{formatReadableDate(selectedAppt.date)}</span>
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span style={{color: '#64748b', fontSize: '13px', fontWeight: 600}}>Time</span>
                                    <span style={{fontWeight: 600}}>{selectedAppt.time || 'Not specified'}</span>
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span style={{color: '#64748b', fontSize: '13px', fontWeight: 600}}>Location</span>
                                    <span style={{fontWeight: 600}}>{sanitizeUUID(selectedAppt.location, 'Dasma I Health Station')}</span>
                                </div>
                                {selectedAppt.notes && (
                                    <div style={{marginTop: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                        <span style={{display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px'}}>Notes</span>
                                        <p style={{margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.5'}}>{selectedAppt.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyAppointments;
