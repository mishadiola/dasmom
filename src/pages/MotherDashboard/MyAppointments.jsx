import React, { useState } from 'react';
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
    const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2, 1)); // March 2026
    const [selectedDate, setSelectedDate] = useState(null);

    const APPOINTMENTS = [
        { id: 1, date: '2026-03-10', time: '08:00 AM', type: 'Prenatal', location: 'Barangay 3 Health Center', status: 'Upcoming', notes: 'Routine 2nd trimester checkup', color: 'green' },
        { id: 2, date: '2026-03-15', time: '09:30 AM', type: 'Vaccination', location: 'City Health Office', status: 'Completed', notes: 'TT Vaccine (Tetanus Toxoid)', color: 'yellow' },
        { id: 3, date: '2026-03-22', time: '10:00 AM', type: 'Postpartum', location: 'Barangay 3 Health Center', status: 'Upcoming', notes: 'Post-delivery follow-up', color: 'blue' },
        { id: 4, date: '2026-02-15', time: '08:30 AM', type: 'Prenatal', location: 'Barangay 3 Health Center', status: 'Completed', notes: 'Initial prenatal visit', color: 'green' },
        { id: 5, date: '2026-03-28', time: '01:00 PM', type: 'Prenatal', location: 'Barangay 3 Health Center', status: 'Upcoming', notes: 'Follow-up ultrasound review', color: 'green' },
    ];

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
        const dateStr = `2026-03-${day.toString().padStart(2, '0')}`;
        return APPOINTMENTS.filter(a => a.date === dateStr);
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    return (
        <div className="my-appointments-page">
            <header className="appt-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/dashboard/user-home')}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1>My Appointments</h1>
                        <p>Keep track of your upcoming visits and health schedule</p>
                    </div>
                </div>
                <div className="header-actions">
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
                                    <h3>March {selectedDate}, 2026</h3>
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
                                                        <span className={`appt-status-tag ${a.status.toLowerCase()}`}>{a.status}</span>
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
                            <button className="filter-btn active">All</button>
                            <button className="filter-btn">Upcoming</button>
                            <button className="filter-btn">Past</button>
                        </div>

                        <div className="appt-list">
                            {APPOINTMENTS.sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => (
                                <div key={a.id} className="appt-list-item">
                                    <div className={`appt-date-box ${a.color}`}>
                                        <span className="m">MAR</span>
                                        <span className="d">{a.date.split('-')[2]}</span>
                                    </div>
                                    <div className="appt-main-info">
                                        <div className="appt-title-row">
                                            <h3>{a.type} Visit</h3>
                                            <span className={`status-badge ${a.status.toLowerCase()}`}>
                                                {a.status === 'Completed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                {a.status}
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
                            ))}
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
