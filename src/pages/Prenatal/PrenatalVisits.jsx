import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import PatientService from '../../services/patientservice';
import {
    Search, Plus, Eye, Edit2, Trash2, CalendarCheck,
    AlertTriangle, HeartPulse, Filter, Clock, ChevronLeft,
    ChevronRight, Calendar as CalendarIcon, Users, MapPin, X,
    CheckCircle2, Zap, RotateCcw
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
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
    const { user } = useContext(AuthContext);

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
    const [visitTypeTab, setVisitTypeTab] = useState('prenatal'); // 'prenatal' | 'vaccination' | 'postpartum'
    const [visitCategoryTab, setVisitCategoryTab] = useState('upcoming'); // 'upcoming' | 'missed' | 'completed'

    // Add Visit modal states
    const [showAddVisitModal, setShowAddVisitModal] = useState(false);
    const [allPatients, setAllPatients] = useState([]);
    const [manualVisits, setManualVisits] = useState([]);
    const [isAddingVisit, setIsAddingVisit] = useState(false);
    const [addVisitForm, setAddVisitForm] = useState({
        visit_type: 'emergency',
        patient_id: '',
        visit_date: new Date().toISOString().split('T')[0],
        visit_time: '',
        assigned_staff: '',
        reason: '',
        notes: '',
        related_emergency_id: ''
    });

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

            const [visitsData, apptsData] = await Promise.all([
                patientService.getPrenatalVisits(),
                patientService.getAppointments(startDate, endDate, calendarView)
            ]);

            const processedVisits = (visitsData || []).map(v => ({
                ...v,
                visitDateOnly: v.visit_date || v.visitDateOnly || ''
            }));

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

    // Load patients list and manual visits on mount
    useEffect(() => {
        const loadPatients = async () => {
            try {
                const data = await patientService.getAllPatients();
                setAllPatients((data || []).map(p => ({
                    id: p.id,
                    name: p.fullName || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.name || p.id
                })));
            } catch (e) {
                console.error('Failed to load patients for Add Visit modal:', e);
            }
        };
        loadPatients();

        const stored = localStorage.getItem('dasmom_manual_visits');
        if (stored) {
            try { setManualVisits(JSON.parse(stored)); } catch (_) {}
        }
    }, [patientService]);

    // Auto-fill assigned staff from auth context
    useEffect(() => {
        if (user) {
            setAddVisitForm(prev => ({
                ...prev,
                assigned_staff: user.fullName || user.email?.split('@')[0] || prev.assigned_staff
            }));
        }
    }, [user]);

    const handleAddVisitSubmit = (e) => {
        e.preventDefault();
        setIsAddingVisit(true);

        const patient = allPatients.find(p => p.id === addVisitForm.patient_id);
        const newRecord = {
            id: `manual-${Date.now()}`,
            visit_type: addVisitForm.visit_type, // 'emergency' | 'follow_up'
            patient_id: addVisitForm.patient_id,
            patient_name: patient?.name || addVisitForm.patient_id,
            visit_date: addVisitForm.visit_date,
            visit_time: addVisitForm.visit_time,
            assigned_staff: addVisitForm.assigned_staff,
            reason: addVisitForm.reason,
            notes: addVisitForm.notes,
            related_emergency_id: addVisitForm.visit_type === 'follow_up' ? addVisitForm.related_emergency_id : '',
            created_at: new Date().toISOString()
        };

        const updated = [newRecord, ...manualVisits];
        localStorage.setItem('dasmom_manual_visits', JSON.stringify(updated));
        setManualVisits(updated);

        // Reset form
        setShowAddVisitModal(false);
        setAddVisitForm({
            visit_type: 'emergency',
            patient_id: '',
            visit_date: new Date().toISOString().split('T')[0],
            visit_time: '',
            assigned_staff: user?.fullName || user?.email?.split('@')[0] || '',
            reason: '',
            notes: '',
            related_emergency_id: ''
        });

        setToast('Visit added successfully!');
        setTimeout(() => setToast(null), 3000);
        setIsAddingVisit(false);
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

    const formatNavLabel = () => {
        if (calendarView === 'day') return formatReadableDate(visibleDays[0]?.date);
        if (!visibleDays || visibleDays.length === 0) return '';
        const start = new Date(visibleDays[0].date);
        const end = new Date(visibleDays[visibleDays.length - 1].date);
        if (calendarView === 'month') {
            return start.toLocaleDateString('en-US', { month: 'long' });
        }
        return `${formatReadableDate(start)} – ${formatReadableDate(end)}`;
    };


    const getSlotStatus = useCallback((date, time) => {
        const visitsForSlot = visitsTable.filter(v => {
            return v.visitDateOnly === date && v.visitTime === time;
        });

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

    const todayOnly = new Date().toISOString().split('T')[0];
    // Group visits by patient
    const latestPatientVisitMap = new Map();
    filteredVisits
      .slice()
      .sort((a, b) => new Date(b.visitDateOnly) - new Date(a.visitDateOnly))
      .forEach((visit) => {
        if (!latestPatientVisitMap.has(visit.patientId)) {
          latestPatientVisitMap.set(visit.patientId, visit);
        }
      });

    const uniquePatients = Array.from(latestPatientVisitMap.values()).map((visit) => ({
      id: visit.patientId,
      name: visit.patientName,
      risk: visit.risk || visit.calculated_risk || 'Normal',
      nextVisit: (() => {
        const nextScheduled = filteredVisits.filter(v => v.patientId === visit.patientId && v.status === 'Scheduled' && v.visitDateOnly >= todayOnly).sort((a, b) => a.visitDateOnly.localeCompare(b.visitDateOnly))[0];
        return nextScheduled ? nextScheduled.visitDateOnly : 'No upcoming';
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
    }));

    const totalPages = Math.ceil(uniquePatients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPatients = uniquePatients.slice(startIndex, startIndex + itemsPerPage);

    const TODAY = new Date().toISOString().split('T')[0];

    // Visit category filtering for tabbed table view
    const categorizeVisits = () => {
        const today = new Date().toISOString().split('T')[0];
        
        // Flatten all visits into individual visit records with status
        const allVisits = filteredVisits.map(v => ({
            id: v.id,
            patientId: v.patientId,
            patientName: v.patientName,
            risk: v.risk || v.calculated_risk || 'Normal',
            visitDate: v.visitDateOnly,
            visitTime: v.visitTime,
            status: v.status,
            attendedDate: v.attendedDate,
            visitDateTime: new Date(`${v.visitDateOnly}T${v.visitTime || '00:00'}`)
        }));

        const upcoming = allVisits.filter(v => 
            (v.status === 'Scheduled' || v.status === 'Pending') && 
            v.visitDate >= today
        ).sort((a, b) => a.visitDate.localeCompare(b.visitDate));

        const missed = allVisits.filter(v => 
            v.status === 'Missed' || 
            (v.status === 'Scheduled' && v.visitDate < today)
        ).sort((a, b) => b.visitDate.localeCompare(a.visitDate));

        const completed = allVisits.filter(v => 
            v.status === 'Attended' || v.status === 'Completed'
        ).sort((a, b) => {
            const dateA = a.attendedDate ? new Date(a.attendedDate) : new Date(a.visitDate);
            const dateB = b.attendedDate ? new Date(b.attendedDate) : new Date(b.visitDate);
            return dateB - dateA;
        });

        return { upcoming, missed, completed };
    };

    const categorizedVisits = categorizeVisits();
    
    const getTabVisits = () => {
        switch(visitCategoryTab) {
            case 'upcoming': return categorizedVisits.upcoming;
            case 'missed': return categorizedVisits.missed;
            case 'completed': return categorizedVisits.completed;
            default: return categorizedVisits.upcoming;
        }
    };

    const tabVisits = getTabVisits();
    
    // Deduplicate visits by patient ID - keep only the most recent visit per patient
    const deduplicatedVisits = tabVisits.reduce((acc, visit) => {
        const existingIndex = acc.findIndex(v => v.patientId === visit.patientId);
        if (existingIndex === -1) {
            acc.push(visit);
        } else {
            // Keep the most recent visit (by date)
            const existingDate = new Date(acc[existingIndex].visitDate || acc[existingIndex].visitDateTime);
            const currentDate = new Date(visit.visitDate || visit.visitDateTime);
            if (currentDate > existingDate) {
                acc[existingIndex] = visit;
            }
        }
        return acc;
    }, []);
    
    const tabTotalPages = Math.ceil(deduplicatedVisits.length / itemsPerPage);
    const tabStartIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTabVisits = deduplicatedVisits.slice(tabStartIndex, tabStartIndex + itemsPerPage);

    return (
        <div className="prenatal-visits-overall">
            {toast && <div className="toast toast--success"><CheckCircle2 size={16} /> {toast}</div>}

            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Visits &amp; Scheduling</h1>
                    <p className="page-subtitle">30 slots/day max (25 regular + 5 rescheduling)</p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => {
                            setAddVisitForm({
                                visit_type: 'emergency',
                                patient_id: '',
                                visit_date: new Date().toISOString().split('T')[0],
                                visit_time: '',
                                assigned_staff: user?.fullName || user?.email?.split('@')[0] || '',
                                reason: '',
                                notes: '',
                                related_emergency_id: ''
                            });
                            setShowAddVisitModal(true);
                        }}
                    >
                        <Plus size={16} /> Add Visit
                    </button>
                </div>
            </div>

            {/* Visit Type Tabs */}
            <div className="visit-type-tabs">
                <button
                    className={`visit-type-tab ${visitTypeTab === 'prenatal' ? 'active' : ''}`}
                    onClick={() => setVisitTypeTab('prenatal')}
                >
                    Prenatal
                </button>
                <button
                    className={`visit-type-tab ${visitTypeTab === 'vaccination' ? 'active' : ''}`}
                    onClick={() => setVisitTypeTab('vaccination')}
                >
                    Vaccination
                </button>
                <button
                    className={`visit-type-tab ${visitTypeTab === 'postpartum' ? 'active' : ''}`}
                    onClick={() => setVisitTypeTab('postpartum')}
                >
                    Postpartum
                </button>
            </div>

            {visitTypeTab === 'prenatal' ? (
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
                            <span><i className="dot d-scheduled"></i> Scheduled</span>
                            <span><i className="dot d-attended"></i> Attended</span>
                            <span><i className="dot d-missed"></i> Missed</span>
                            <span><i className="dot d-full"></i> Full (35/day max)</span>
                        </div>
                    </div>
                </div>

                <div className="pv-grid-container">
                    {calendarView === 'day' ? (
                        <div className="day-view-container">
                            {visibleDays.map(day => {
                                const dayVisits = visitsTable.filter(v => v.visitDateOnly === day.date);
                                const dayAppts = appointments.filter(a => a.date === day.date);
                                const dayManual = manualVisits.filter(v => v.visit_date === day.date);
                                
                                return (
                                    <div key={day.date} className={`day-schedule-card ${day.date === TODAY ? 'day-today' : ''}`}>
                                        <div className="day-schedule-header">
                                            <h3 className="day-schedule-title">
                                                {day.label}
                                                {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                            </h3>
                                            <span className="day-schedule-count">
                                                {dayVisits.length + dayAppts.length + dayManual.length} schedule{dayVisits.length + dayAppts.length + dayManual.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="day-schedule-list">
                                            {dayVisits.length > 0 ? (
                                                dayVisits.map(v => (
                                                    <div 
                                                        key={v.id} 
                                                        className={`schedule-item status-${v.status.toLowerCase()} clickable`}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedVisit(v); }}
                                                    >
                                                        <div className="schedule-time">
                                                            <Clock size={14} />
                                                            <span>{v.visitTime || 'TBD'}</span>
                                                        </div>
                                                        <div className="schedule-details">
                                                            <span className="schedule-patient">{v.patientName}</span>
                                                            <span className="schedule-id">{v.patientId}</span>
                                                        </div>
                                                        <span className={`schedule-status status-${v.status.toLowerCase()}`}>
                                                            {v.status}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : dayAppts.length > 0 ? (
                                                dayAppts.map((a, idx) => (
                                                    <div key={`appt-${idx}`} className={`schedule-item status-${a.status?.toLowerCase() || 'scheduled'}`}>
                                                        <div className="schedule-time">
                                                            <Clock size={14} />
                                                            <span>{a.time || 'TBD'}</span>
                                                        </div>
                                                        <div className="schedule-details">
                                                            <span className="schedule-patient">{a.patientName || 'Appointment'}</span>
                                                            <span className="schedule-id">{a.patientId || ''}</span>
                                                        </div>
                                                        <span className={`schedule-status status-${a.status?.toLowerCase() || 'scheduled'}`}>
                                                            {a.status || 'Scheduled'}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-schedules">No schedules for this day</div>
                                            )}
                                            {/* Manual visits (Emergency / Follow-up) */}
                                            {dayManual.map(mv => (
                                                <div key={mv.id} className={`schedule-item manual-visit-item manual-${mv.visit_type}`}>
                                                    <div className="schedule-time">
                                                        <Clock size={14} />
                                                        <span>{mv.visit_time || 'TBD'}</span>
                                                    </div>
                                                    <div className="schedule-details">
                                                        <span className="schedule-patient">{mv.patient_name}</span>
                                                        <span className="visit-type-badge badge-manual-type badge-{mv.visit_type}">{mv.visit_type === 'emergency' ? 'Emergency' : 'Follow-up'}</span>
                                                    </div>
                                                    <span className="visit-type-badge" style={{ background: mv.visit_type === 'emergency' ? 'rgba(224,92,115,0.15)' : 'rgba(147,111,199,0.15)', color: mv.visit_type === 'emergency' ? '#c94070' : '#7a4fa8', fontWeight: 600, fontSize: '11px', padding: '2px 8px', borderRadius: '10px' }}>
                                                        {mv.visit_type === 'emergency' ? 'Emergency' : 'Follow-up'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={`day-grid ${calendarView}-grid`}>
                            {calendarView === 'week' ? (
                                <div className="week-row">
                                    {visibleDays.map(day => (
                                        <div key={day.date} className={`day-cell ${day.date === TODAY ? 'day-today' : ''}`} onClick={() => { setCalendarView('day'); setCurrentDate(new Date(day.date)); }}>
                                            <h4 className="day-header">
                                                {formatCalendarDate(day.date)}
                                                {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                            </h4>
                                            <div className="day-visits">
                                                {visitsTable.filter(v => v.visitDateOnly === day.date).map(v => (
                                                    <div 
                                                        key={v.id} 
                                                        className={`visit-item status-${v.status.toLowerCase()} clickable`}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedVisit(v); }}
                                                    >
                                                        <span className="visit-patient">{v.patientName}</span>
                                                        <span className="visit-status">{v.status}</span>
                                                    </div>
                                                ))}
                                                {manualVisits.filter(mv => mv.visit_date === day.date).map(mv => (
                                                    <div key={mv.id} className={`visit-item manual-${mv.visit_type}`}>
                                                        <span className="visit-patient">{mv.patient_name}</span>
                                                        <span className="visit-type-badge" style={{ background: mv.visit_type === 'emergency' ? 'rgba(224,92,115,0.15)' : 'rgba(147,111,199,0.15)', color: mv.visit_type === 'emergency' ? '#c94070' : '#7a4fa8', fontWeight: 600, fontSize: '10px', padding: '1px 6px', borderRadius: '8px' }}>{mv.visit_type === 'emergency' ? 'Emergency' : 'Follow-up'}</span>
                                                    </div>
                                                ))}
                                                {visitsTable.filter(v => v.visitDateOnly === day.date).length === 0 && manualVisits.filter(mv => mv.visit_date === day.date).length === 0 && (
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
                                                <div key={day.date} className={`day-cell ${day.date === TODAY ? 'day-today' : ''}`} onClick={() => { setCalendarView('day'); setCurrentDate(new Date(day.date)); }}>
                                                    <h4 className="day-header">
                                                        {formatCalendarDate(day.date)}
                                                        {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                                    </h4>
                                                    <div className="day-visits">
                                                        {visitsTable.filter(v => v.visitDateOnly === day.date).map(v => (
                                                            <div 
                                                                key={v.id} 
                                                                className={`visit-item status-${v.status.toLowerCase()} clickable`}
                                                                onClick={(e) => { e.stopPropagation(); setSelectedVisit(v); }}
                                                            >
                                                                <span className="visit-patient">{v.patientName}</span>
                                                                <span className="visit-status">{v.status}</span>
                                                            </div>
                                                        ))}
                                                        {manualVisits.filter(mv => mv.visit_date === day.date).map(mv => (
                                                            <div key={mv.id} className={`visit-item manual-${mv.visit_type}`}>
                                                                <span className="visit-patient">{mv.patient_name}</span>
                                                                <span className="visit-type-badge" style={{ background: mv.visit_type === 'emergency' ? 'rgba(224,92,115,0.15)' : 'rgba(147,111,199,0.15)', color: mv.visit_type === 'emergency' ? '#c94070' : '#7a4fa8', fontWeight: 600, fontSize: '10px', padding: '1px 6px', borderRadius: '8px' }}>{mv.visit_type === 'emergency' ? 'Emergency' : 'Follow-up'}</span>
                                                            </div>
                                                        ))}
                                                        {visitsTable.filter(v => v.visitDateOnly === day.date).length === 0 && manualVisits.filter(mv => mv.visit_date === day.date).length === 0 && (
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
            ) : visitTypeTab === 'vaccination' ? (
                /* Vaccination Tab - Calendar Empty State */
                <div className="pv-calendar-section vaccination-empty">
                    <div className="empty-state">
                        <CalendarIcon size={48} />
                        <h3>No vaccination schedules yet.</h3>
                        <p>Vaccination scheduling will be available soon.</p>
                    </div>
                </div>
            ) : (
                /* Postpartum Tab - Calendar Empty State */
                <div className="pv-calendar-section vaccination-empty">
                    <div className="empty-state">
                        <CalendarIcon size={48} />
                        <h3>No postpartum schedules yet.</h3>
                        <p>Postpartum scheduling will be available soon.</p>
                    </div>
                </div>
            )}

            {/* VISITS TABLE */}
            {visitTypeTab === 'prenatal' ? (
            <div className="pv-table-section">
                <div className="section-header-row">
                    <h2 className="section-title"><Clock size={18} /> Visit Records</h2>
                    <div className="table-filters">
                        <div className="header-search">
                            <Search size={18} className="hs-icon" />
                            <input 
                                type="text" 
                                placeholder="Search Patient Name" 
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="hs-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Visit Category Tabs */}
                <div className="visit-category-tabs">
                    <button
                        className={`visit-category-tab ${visitCategoryTab === 'upcoming' ? 'active' : ''}`}
                        onClick={() => { setVisitCategoryTab('upcoming'); setCurrentPage(1); }}
                    >
                        Upcoming
                    </button>
                    <button
                        className={`visit-category-tab ${visitCategoryTab === 'missed' ? 'active' : ''}`}
                        onClick={() => { setVisitCategoryTab('missed'); setCurrentPage(1); }}
                    >
                        Missed
                    </button>
                    <button
                        className={`visit-category-tab ${visitCategoryTab === 'completed' ? 'active' : ''}`}
                        onClick={() => { setVisitCategoryTab('completed'); setCurrentPage(1); }}
                    >
                        Completed
                    </button>
                </div>

                <div className="table-responsive">
                    <table className="pv-table">
                        <thead>
                            <tr>
                                <th>Patient Name</th>
                                <th>Risk Level</th>
                                <th>Date & Time</th>
                                <th>Status</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTabVisits.length > 0 ? (
                                paginatedTabVisits.map(visit => (
                                    <tr key={visit.id}>
                                        <td>
                                            <div className="p-info">
                                                <span className="p-name">{visit.patientName}</span>
                                                <span className="p-id">{visit.patientId}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`risk-tag risk-${visit.risk?.replace(' ', '-').toLowerCase() || 'normal'}`}>
                                                {visit.risk}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="visit-datetime">
                                                <span className="visit-date">{formatReadableDate(visit.visitDate)}</span>
                                                <span className="visit-time">{visit.visitTime || 'TBD'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge status-${visit.status?.toLowerCase() || 'scheduled'}`}>
                                                {visit.status}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <div className="row-actions">
                                                <button className="action-btn-text action-btn-primary" onClick={() => navigate(`/dashboard/prenatal/add/${visit.patientId}`)} title="Record Prenatal Visit">
                                                    <Plus size={14} /> Record
                                                </button>
                                                <button className="action-btn-text action-btn-secondary" onClick={() => setSelectedVisit(visit)} title="View Visit Details">
                                                    <Eye size={14} /> View
                                                </button>
                                                <button className="action-btn-text action-btn-accent" onClick={() => navigate(`/dashboard/patients/${visit.patientId}`)} title="View Patient Profile">
                                                    <Users size={14} /> Profile
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="empty-tab-state">
                                        {visitCategoryTab === 'upcoming' && (
                                            <div className="empty-state-content">
                                                <CalendarCheck size={32} />
                                                <p>No upcoming visits.</p>
                                            </div>
                                        )}
                                        {visitCategoryTab === 'missed' && (
                                            <div className="empty-state-content">
                                                <AlertTriangle size={32} />
                                                <p>No missed visits.</p>
                                            </div>
                                        )}
                                        {visitCategoryTab === 'completed' && (
                                            <div className="empty-state-content">
                                                <CheckCircle2 size={32} />
                                                <p>No completed visits.</p>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {tabTotalPages > 1 && (
                    <div className="pagination-wrap">
                        <span>
                            Showing {tabStartIndex + 1}-{Math.min(tabStartIndex + itemsPerPage, tabVisits.length)} of {tabVisits.length}
                        </span>

                        <div className="pagination-controls">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="page-btn">
                                <ChevronLeft size={16} />
                            </button>

                            <div className="page-numbers">
                                {Array.from({ length: tabTotalPages }, (_, i) => i + 1).map(num => (
                                    <button 
                                        key={num}
                                        className={`page-num ${currentPage === num ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(num)}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>

                            <button disabled={currentPage === tabTotalPages} onClick={() => setCurrentPage(p => p + 1)} className="page-btn">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            ) : (
                /* Vaccination & Postpartum Tab - Table Empty State */
                <div className="pv-table-section vaccination-empty">
                    <div className="empty-state">
                        <Users size={48} />
                        <h3>No {visitTypeTab} schedules found.</h3>
                        <p>{visitTypeTab.charAt(0).toUpperCase() + visitTypeTab.slice(1)} patient records will appear here.</p>
                    </div>
                </div>
            )}

            {showAddVisitModal && (
                <div className="modal-overlay" onClick={() => setShowAddVisitModal(false)}>
                    <div
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '500px' }}
                    >
                        <div className="modal-header">
                            <h2>Add Manual Visit</h2>
                            <p>Schedule an Emergency or Follow-up visit for a patient.</p>
                        </div>
                        <form onSubmit={handleAddVisitSubmit}>
                            <div className="modal-body">
                                {/* Visit Type */}
                                <div className="form-group">
                                    <label>Visit Type <span style={{ color: '#e05c73' }}>*</span></label>
                                    <select
                                        required
                                        value={addVisitForm.visit_type}
                                        onChange={e => setAddVisitForm({ ...addVisitForm, visit_type: e.target.value, related_emergency_id: '' })}
                                        className="form-control"
                                    >
                                        <option value="emergency">Emergency Visit</option>
                                        <option value="follow_up">Follow-up Visit</option>
                                    </select>
                                </div>

                                {/* Patient searchable dropdown */}
                                <div className="form-group">
                                    <label>Patient <span style={{ color: '#e05c73' }}>*</span></label>
                                    <SearchableDropdown
                                        patients={allPatients}
                                        value={addVisitForm.patient_id}
                                        onChange={val => setAddVisitForm({ ...addVisitForm, patient_id: val, related_emergency_id: '' })}
                                    />
                                </div>

                                {/* Conditional Related Emergency Visit for Follow-up type */}
                                {addVisitForm.visit_type === 'follow_up' && (
                                    <div className="form-group">
                                        <label>Related Emergency Visit <span style={{ color: '#e05c73' }}>*</span></label>
                                        <select
                                            required
                                            value={addVisitForm.related_emergency_id}
                                            onChange={e => setAddVisitForm({ ...addVisitForm, related_emergency_id: e.target.value })}
                                            className="form-control"
                                        >
                                            <option value="">— Select emergency visit —</option>
                                            {manualVisits
                                                .filter(v => v.patient_id === addVisitForm.patient_id && v.visit_type === 'emergency')
                                                .map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        Emergency Visit – {formatReadableDate(v.visit_date)}
                                                    </option>
                                                ))}
                                        </select>
                                        {manualVisits.filter(v => v.patient_id === addVisitForm.patient_id && v.visit_type === 'emergency').length === 0 && (
                                            <span style={{ color: '#e8b84b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                                                No previous emergency visits recorded for this patient.
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Date and Time */}
                                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label>Visit Date <span style={{ color: '#e05c73' }}>*</span></label>
                                        <input
                                            type="date"
                                            required
                                            value={addVisitForm.visit_date}
                                            onChange={e => setAddVisitForm({ ...addVisitForm, visit_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Visit Time <span style={{ color: '#e05c73' }}>*</span></label>
                                        <input
                                            type="time"
                                            required
                                            value={addVisitForm.visit_time}
                                            onChange={e => setAddVisitForm({ ...addVisitForm, visit_time: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Assigned Healthcare Staff */}
                                <div className="form-group">
                                    <label>Assigned Healthcare Staff</label>
                                    <input
                                        type="text"
                                        value={addVisitForm.assigned_staff}
                                        onChange={e => setAddVisitForm({ ...addVisitForm, assigned_staff: e.target.value })}
                                        placeholder="Enter staff name"
                                    />
                                </div>

                                {/* Reason */}
                                <div className="form-group">
                                    <label>Reason <span style={{ color: '#e05c73' }}>*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={addVisitForm.reason}
                                        onChange={e => setAddVisitForm({ ...addVisitForm, reason: e.target.value })}
                                        placeholder="e.g. Severe abdominal pain"
                                    />
                                </div>

                                {/* Notes */}
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea
                                        rows={3}
                                        value={addVisitForm.notes}
                                        onChange={e => setAddVisitForm({ ...addVisitForm, notes: e.target.value })}
                                        placeholder="Additional observations or treatment..."
                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => setShowAddVisitModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isAddingVisit}
                                >
                                    {isAddingVisit ? 'Saving...' : 'Save Visit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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