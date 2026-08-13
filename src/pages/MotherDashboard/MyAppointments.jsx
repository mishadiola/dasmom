import React, { useState, useEffect } from 'react';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import { 
    Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, 
    Clock, MapPin, Info, ArrowLeft, Download, Printer,
    CheckCircle2, AlertCircle, CalendarDays
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MyAppointments.css';

const MyAppointments = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [filterTab, setFilterTab] = useState('All'); // 'All', 'Upcoming', 'Past' for list view
    const [calendarFilter, setCalendarFilter] = useState('All Events'); // 'All Events', 'Appointments', 'Prenatal Visits', 'Vaccinations', 'Other Health Records' for calendar view

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

                const combined = [...visitAppts, ...vacAppts];
                setAppointmentsData(combined);
            } catch (err) {
                console.error('Failed to load appointments:', err);
                setAppointmentsData([]);
            }
        };
        loadAppointments();
    }, [currentMonth]);

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    const { days, firstDay } = getDaysInMonth(currentMonth);
    const prevMonthDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();

    const calendarCells = [];
    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
        calendarCells.push({ day: prevMonthDays - i, currentMonth: false });
    }
    // Current month days
    for (let i = 1; i <= days; i++) {
        calendarCells.push({ day: i, currentMonth: true });
    }
    // Next month padding
    const remaining = 42 - calendarCells.length;
    for (let i = 1; i <= remaining; i++) {
        calendarCells.push({ day: i, currentMonth: false });
    }

    const formatMonth = (date) => {
        return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const getAppointmentsForDay = (day, isCurrentMonth) => {
        if (!isCurrentMonth) return [];
        const year = currentMonth.getFullYear();
        const month = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day.toString().padStart(2, '0')}`;
        
        let appointments = (appointmentsData || []).filter(a => {
            if (!a.date) return false;
            // Handle both YYYY-MM-DD format and Date objects
            const apptDate = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
            return apptDate === dateStr;
        });

        if (calendarFilter === 'All Events') return appointments;
        if (calendarFilter === 'Appointments') return appointments.filter(a => a.type === 'Prenatal' || a.type === 'Postpartum' || a.type === undefined);
        if (calendarFilter === 'Prenatal Visits') return appointments.filter(a => a.type === 'Prenatal');
        if (calendarFilter === 'Vaccinations') return appointments.filter(a => a.type === 'Vaccination');
        if (calendarFilter === 'Other Health Records') return appointments.filter(a => a.type === 'Postpartum');
        return appointments;
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
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
            <header className="mother-page-header">
                <div className="mother-page-header-content">
                    <button className="back-btn" onClick={() => navigate('/mother-home')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div className="mother-page-header-text">
                        <h1>Appointments</h1>
                        <p>Keep track of your upcoming visits and health schedule</p>
                    </div>
                </div>
                <div className="mother-page-header-actions">
                    <div className="view-toggle">
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
            </header>

            <div className="appt-content">
                {viewMode === 'calendar' ? (
                    <div className="calendar-container">
                        <div className="calendar-nav">
                            <h2>{formatMonth(currentMonth)}</h2>
                            <div className="nav-buttons">
                                <button onClick={handlePrevMonth}><ChevronLeft size={20} /></button>
                                <button className="today-btn">Today</button>
                                <button onClick={handleNextMonth}><ChevronRight size={20} /></button>
                            </div>
                        </div>

                        <div className="calendar-filters">
                            <button 
                                className={`calendar-filter-btn ${calendarFilter === 'All Events' ? 'active' : ''}`}
                                onClick={() => setCalendarFilter('All Events')}
                            >
                                All Events
                            </button>
                            <button 
                                className={`calendar-filter-btn ${calendarFilter === 'Appointments' ? 'active' : ''}`}
                                onClick={() => setCalendarFilter('Appointments')}
                            >
                                Appointments
                            </button>
                            <button 
                                className={`calendar-filter-btn ${calendarFilter === 'Prenatal Visits' ? 'active' : ''}`}
                                onClick={() => setCalendarFilter('Prenatal Visits')}
                            >
                                Prenatal Visits
                            </button>
                            <button 
                                className={`calendar-filter-btn ${calendarFilter === 'Vaccinations' ? 'active' : ''}`}
                                onClick={() => setCalendarFilter('Vaccinations')}
                            >
                                Vaccinations
                            </button>
                            <button 
                                className={`calendar-filter-btn ${calendarFilter === 'Other Health Records' ? 'active' : ''}`}
                                onClick={() => setCalendarFilter('Other Health Records')}
                            >
                                Other Health Records
                            </button>
                        </div>

                        <div className="calendar-grid">
                            <div className="weekday-header">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <div key={d} className="weekday">{d}</div>
                                ))}
                            </div>
                            <div className="days-grid">
                                {calendarCells.map((cell, idx) => {
                                    const dayAppts = getAppointmentsForDay(cell.day, cell.currentMonth);
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`day-cell ${!cell.currentMonth ? 'other-month' : ''} ${selectedDate === cell.day ? 'selected' : ''}`}
                                            onClick={() => cell.currentMonth && setSelectedDate(cell.day)}
                                        >
                                            <span className="day-num">{cell.day}</span>
                                            <div className="day-appts">
                                                {dayAppts.map(a => (
                                                    <div key={a.id} className={`appt-dot appt-dot--${a.color}`} title={a.type} />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="calendar-legend">
                            <div className="legend-item"><span className="dot dot--green"></span> Prenatal Visit</div>
                            <div className="legend-item"><span className="dot dot--blue"></span> Postpartum Visit</div>
                            <div className="legend-item"><span className="dot dot--yellow"></span> Vaccination</div>
                        </div>

                        {selectedDate && (
                            <div className="day-detail-panel">
                                <div className="panel-header">
                                     <h3>{new Date(currentMonth.getFullYear(), currentMonth.getMonth(), selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
                                    <button className="close-panel" onClick={() => setSelectedDate(null)}>&times;</button>
                                </div>
                                <div className="panel-body">
                                    {getAppointmentsForDay(selectedDate, true).length > 0 ? (
                                        getAppointmentsForDay(selectedDate, true).map(a => (
                                            <div key={a.id} className="appt-card-mini">
                                                <div className={`appt-stripe ${a.color}`}></div>
                                                <div className="appt-info-mini">
                                                    <div className="appt-type-row">
                                                        <span className="appt-type">{a.type}</span>
                                                        <span className={`appt-status-tag ${String(a.status || '').toLowerCase()}`}>{a.status || 'Unknown'}</span>
                                                    </div>
                                                    <div className="appt-meta-mini">
                                                        <span><Clock size={12} /> {a.time}</span>
                                                        <span><MapPin size={12} /> {a.location}</span>
                                                    </div>
                                                    {a.notes && <p className="appt-notes-mini"><Info size={12} /> {a.notes}</p>}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-day">
                                            <CalendarDays size={32} />
                                            <p>No appointments scheduled for this day.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
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
