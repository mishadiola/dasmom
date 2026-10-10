import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import PatientService from '../../services/patientservice';
import '../../styles/components/SharedFilters.css';
import '../../styles/pages/PrenatalVisits.css';
import {
    Search, Plus, Eye, Edit2, Trash2, CalendarCheck,
    AlertTriangle, HeartPulse, Filter, Clock, ChevronLeft,
    ChevronRight, Calendar as CalendarIcon, Users, MapPin, X,
    CheckCircle2, Zap, RotateCcw, ArchiveRestore,
    Download
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import ScheduledVisitModal from '../../components/Prenatal/ScheduledVisitModal';
import PatientModal from '../../components/Prenatal/PatientModal';
import PostpartumVisitModal from '../../components/PostpartumVisitModal';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExportModal from '../../components/ExportModal';
import '../../styles/pages/PrenatalVisits.css';
import Legend from '../../components/Legend/Legend';
import { formatMotherId } from '../../utils/displayIds';

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
    const [archiveFilter, setArchiveFilter] = useState('active');
    const [currentPage, setCurrentPage] = useState(1);
    const { settings } = useSystemSettings();
    const itemsPerPage = settings?.tables?.rowsPerPage || 10;
    const [currentDate, setCurrentDate] = useState(new Date());
    const [toast, setToast] = useState(null);
    const [calendarView, setCalendarView] = useState('day');
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [postpartumVisitMother, setPostpartumVisitMother] = useState(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef(null);

    // -- Derived Data --
    const [postpartumTable, setPostpartumTable] = useState([]);
    const [visitsTable, setVisitsTable] = useState([]);
    const [archivedPatientIds, setArchivedPatientIds] = useState(new Set());
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [visitTypeTab, setVisitTypeTab] = useState('prenatal'); // 'prenatal' | 'postpartum'
    const [visitCategoryTab, setVisitCategoryTab] = useState('upcoming'); // 'upcoming' | 'missed' | 'completed'
    const [visitAccess, setVisitAccess] = useState(null);
    const [assignmentStaff, setAssignmentStaff] = useState([]);

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

    useEffect(() => {
        let active = true;
        const loadAssignmentOptions = async () => {
            try {
                const access = await patientService.getCurrentUserAccess();
                if (!active) return;
                setVisitAccess(access);
                if (access.role === 'staff') {
                    const staff = await patientService.getAssignableStaffByStationId(access.stationId);
                    if (active) setAssignmentStaff(staff);
                    return;
                }
                if (!['cho personnel', 'admin'].includes(access.role)) return;
                const { data, error } = await patientService.supabase
                    .from('staff_profiles')
                    .select('id, full_name, station_ass')
                    .order('full_name');
                if (error) throw error;
                if (active) setAssignmentStaff(data || []);
            } catch (error) {
                console.error('Could not load prenatal assignment options:', error);
            }
        };
        loadAssignmentOptions();
        return () => { active = false; };
    }, [patientService]);

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

            const archivedIds = await patientService.getArchivedPatientIds();
            setArchivedPatientIds(archivedIds);

            const visitsData = await patientService.getPrenatalVisits({ includeArchived: true });

            const processedVisits = (visitsData || []).map(v => ({
                ...v,
                visitDateOnly: v.visit_date || v.visitDateOnly || ''
            }));

            setVisitsTable(processedVisits);

        } catch (error) {
            console.error('Prenatal fetch error:', error);
        }
    }, [currentDate, calendarView, archiveFilter, patientService]);

    useEffect(() => {
        // (Removed legend click outside handler)
    }, []);

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

    const handleReassignVisit = async (visitId, assignedStaffId) => {
        try {
            await patientService.reassignPrenatalVisit(visitId, assignedStaffId);
            await fetchData();
            setToast('Visit assignment updated.');
            setTimeout(() => setToast(null), 3000);
        } catch (error) {
            console.error('Error assigning prenatal visit:', error);
            setToast(error.message || 'Could not update visit assignment.');
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
                    console.log('ðŸ”„ Detected new visits/appointments! Auto-refreshing calendar...');
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
                    name: p.fullName || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.name || p.id,
                    lmp: p.lmp || null,
                    edd: p.edd || null,
                    pregnancyStatus: p.pregnancyStatus || '', riskLevel: p.risk || 'Unknown'
                })));
            } catch (e) {
                console.error('Failed to load patients for Add Visit modal:', e);
            }
        };
        loadPatients();

        const manualVisitsKey = user?.id ? `dasmom_manual_visits_${user.id}` : null;
        const stored = manualVisitsKey ? localStorage.getItem(manualVisitsKey) : null;
        if (stored) {
            try { setManualVisits(JSON.parse(stored)); } catch (_) {}
        }
    }, [patientService, user?.id]);

    useEffect(() => {
        if (visitTypeTab !== 'postpartum') {
            setPostpartumTable([]);
            return;
        }

        const loadPostpartumFollowUps = async () => {
            try {
                const { data: postpartumVisits, error } = await patientService.supabase
                    .from('postpartum_visits')
                    .select('id, delivery_id, patient_id, visit_type, scheduled_at, attended_date, status, assigned_staff, station_ass')
                    .order('scheduled_at', { ascending: false });
                if (error) throw error;

                const patientIds = [...new Set((postpartumVisits || []).map(visit => visit.patient_id).filter(Boolean))];
                const staffIds = [...new Set((postpartumVisits || []).map(visit => visit.assigned_staff).filter(Boolean))];
                const stationIds = [...new Set((postpartumVisits || []).map(visit => visit.station_ass).filter(Boolean))];
                const [patientResult, staffResult, stationResult] = await Promise.all([
                    patientIds.length
                        ? patientService.supabase.from('patient_basic_info').select('id, first_name, last_name').in('id', patientIds)
                        : Promise.resolve({ data: [], error: null }),
                    staffIds.length
                        ? patientService.supabase.from('staff_profiles').select('id, full_name').in('id', staffIds)
                        : Promise.resolve({ data: [], error: null }),
                    stationIds.length
                        ? patientService.supabase.from('stations').select('id, station_name').in('id', stationIds)
                        : Promise.resolve({ data: [], error: null })
                ]);
                if (patientResult.error) throw patientResult.error;
                if (staffResult.error) throw staffResult.error;
                if (stationResult.error) throw stationResult.error;
                const patientById = new Map((patientResult.data || []).map(patient => [patient.id, patient]));
                const staffById = new Map((staffResult.data || []).map(profile => [profile.id, profile.full_name]));
                const stationById = new Map((stationResult.data || []).map(station => [station.id, station.station_name]));

                const rows = (postpartumVisits || []).map(visit => {
                    const attendedDate = visit.attended_date || null;
                    const scheduledDate = visit.scheduled_at || '';
                    const dateStr = attendedDate || scheduledDate;
                    const patient = patientById.get(visit.patient_id);
                    const patientName = patient
                        ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
                        : visit.patient_id;
                    const status = visit.status === 'Attended'
                        ? 'Attended'
                        : visit.status === 'Cancelled'
                            ? 'Cancelled'
                            : scheduledDate && new Date(scheduledDate) < new Date()
                                ? 'Missed'
                                : 'Scheduled';

                    return {
                        id: visit.id,
                        deliveryId: visit.delivery_id,
                        patientId: visit.patient_id,
                        patientName: patientName || visit.patient_id,
                        vaccineName: visit.visit_type,
                        doseText: '',
                        assignedStaffId: visit.assigned_staff || null,
                        assignedStaff: staffById.get(visit.assigned_staff) || null,
                        visitDate: dateStr,
                        visitDateOnly: toLocalDateStr(new Date(scheduledDate)),
                        status,
                        attendedDate,
                        vaccinatedDate: null,
                        scheduledVaccination: scheduledDate,
                        assignedStationId: visit.station_ass || null,
                        assignedStation: stationById.get(visit.station_ass) || null,
                        notes: 'Postpartum follow-up',
                        raw: visit
                    };
                });

                setPostpartumTable(rows);
            } catch (err) {
                console.error('Error loading postpartum follow-ups:', err);
                setPostpartumTable([]);
            }
        };

        loadPostpartumFollowUps();
    }, [visitTypeTab, patientService.supabase]);

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
        if (user?.id) {
            localStorage.setItem(`dasmom_manual_visits_${user.id}`, JSON.stringify(updated));
        }
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


    const visibleDays = getVisibleDays(currentDate, calendarView);
    const filteredVisits = visitsTable.filter(v => {
        const matchesSearch = (v.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.patientId?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = (filterStatus === 'All' || v.status === filterStatus);
        const matchesArchive =
            archiveFilter === 'all' ||
            (archiveFilter === 'archived' ? archivedPatientIds.has(v.patientId) : !archivedPatientIds.has(v.patientId));
        return matchesSearch && matchesStatus && matchesArchive;
    });

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
      risk: allPatients.find(p => p.id === visit.patientId)?.riskLevel || 'Unknown',
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

    // Category filtering for tabbed table view
    const archivedVisitRows = visitsTable.filter(v => archivedPatientIds.has(v.patientId));

    const categorizeVisits = () => {
        const today = new Date().toISOString().split('T')[0];

        let activeRows = [];
        if (visitTypeTab === 'postpartum') {
            activeRows = postpartumTable.filter(v => {
                const matchesSearch = (v.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.patientId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.vaccineName?.toLowerCase().includes(searchTerm.toLowerCase()));
                const matchesArchive =
                    archiveFilter === 'all' ||
                    (archiveFilter === 'archived' ? archivedPatientIds.has(v.patientId) : !archivedPatientIds.has(v.patientId));
                return matchesSearch && matchesArchive;
            });
        } else {
            activeRows = filteredVisits;
        }

        const allEntries = activeRows.map(v => ({
            id: v.id,
            patientId: v.patientId,
            patientName: v.patientName,
            risk: allPatients.find(p => p.id === v.patientId)?.riskLevel || 'Unknown',
            assignedStaffId: v.assignedStaffId || null,
            assignedStaff: v.assignedStaff || null,
            assignedStationId: v.assignedStationId || null,
            assignedStation: v.assignedStation || null,
            visitStation: v.visitStation || null,
            vaccineName: v.vaccineName,
            doseText: v.doseText,
            visitDate: v.visitDateOnly || v.visitDate,
            status: v.status,
            attendedDate: v.attendedDate || v.vaccinatedDate,
            visitDateTime: new Date(v.visitDateOnly || v.visitDate || today)
            , raw: v.raw || v
        }));

        const upcoming = allEntries.filter(v => 
            (v.status === 'Scheduled' || v.status === 'Pending') && 
            v.visitDate >= today
        ).sort((a, b) => a.visitDateTime - b.visitDateTime);

        const missed = allEntries.filter(v => 
            v.status === 'Missed' || 
            ((v.status === 'Scheduled' || v.status === 'Pending') && v.visitDate < today)
        ).sort((a, b) => b.visitDateTime - a.visitDateTime);

        const completed = allEntries.filter(v => 
            v.status === 'Attended' || v.status === 'Completed' || v.status === 'Given' || v.status === 'Done' || v.attendedDate
        ).sort((a, b) => {
            const dateA = a.attendedDate ? new Date(a.attendedDate) : a.visitDateTime;
            const dateB = b.attendedDate ? new Date(b.attendedDate) : b.visitDateTime;
            return dateB - dateA;
        });

        const latestByPatient = (entries) => Array.from(
            entries.reduce((patients, entry) => {
                if (!patients.has(entry.patientId)) patients.set(entry.patientId, entry);
                return patients;
            }, new Map()).values()
        );

        return {
            upcoming: latestByPatient(upcoming),
            missed: latestByPatient(missed),
            completed: latestByPatient(completed)
        };
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

    const openPostpartumVisit = (visit) => {
        const raw = visit.raw || {};
        setPostpartumVisitMother({
            id: visit.id,
            patientId: visit.patientId,
            name: visit.patientName,
            station: raw.patient_basic_info?.stations?.station_name || raw.station || 'Assigned station',
            stationId: raw.patient_basic_info?.station_ass || raw.stationId || null,
            deliveryType: raw.delivery_type || 'NSD',
        });
    };
    
    const tabTotalPages = Math.ceil(tabVisits.length / itemsPerPage);
    const tabStartIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTabVisits = tabVisits.slice(tabStartIndex, tabStartIndex + itemsPerPage);

    // --- Export Logic ---
    const [showExportModal, setShowExportModal] = useState(false);

    const getFilterDescription = () => {
        const date = currentDate || new Date();
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        const typeStr = visitTypeTab.charAt(0).toUpperCase() + visitTypeTab.slice(1);
        const catStr = visitCategoryTab.charAt(0).toUpperCase() + visitCategoryTab.slice(1);
        let desc = `${monthYear} · ${typeStr} · ${catStr}`;
        if (filterStatus !== 'All') {
            desc += ` · Status: ${filterStatus}`;
        }
        if (searchTerm) {
            desc += ` · Search: "${searchTerm}"`;
        }
        return desc;
    };

    const getExportData = (dateRange) => {
        let filteredForExport = tabVisits;
        
        if (dateRange && (dateRange.from || dateRange.to)) {
            filteredForExport = tabVisits.filter(v => {
                const vDateStr = v.visitDate || v.date;
                if (!vDateStr) return false;
                const vDate = new Date(`${vDateStr}T00:00:00`);
                if (dateRange.from && vDate < dateRange.from) return false;
                if (dateRange.to && vDate > dateRange.to) return false;
                return true;
            });
        }

        return filteredForExport.map(v => ({
            "Patient Name": v.patientName || 'N/A',
            "Patient ID": v.patientId || 'N/A',
            "Visit Type": (v.type || v.visitType || visitTypeTab).toUpperCase(),
            "Scheduled Date": formatReadableDate(v.visitDate || v.date) || v.visitDate || v.date || 'N/A',
            "Scheduled Time": v.visitTime || v.time || 'N/A',
            "Assigned Station": v.assignedStation || 'N/A',
            "Visit Station": v.visitStation || v.station || 'N/A',
            "Assigned Staff": v.assignedStaff || 'Unassigned',
            "Status": v.status || 'N/A'
        }));
    };

    const handleExport = (exportConfig) => {
        const { format, dateRange, reportPeriodText } = exportConfig;
        const data = getExportData(dateRange);
        
        const filterDesc = getFilterDescription();
        const fullDesc = `${reportPeriodText} · ${filterDesc}`;

        if (format === 'excel') {
            let worksheetData = [
                ["Report: Visits & Scheduling"],
                [`Period: ${reportPeriodText}`],
                [`Filters: ${filterDesc}`],
                []
            ];

            if (data.length > 0) {
                worksheetData = worksheetData.concat([
                    Object.keys(data[0]),
                    ...data.map(obj => Object.values(obj))
                ]);
            } else {
                worksheetData.push(["No records found for the selected period and filters."]);
            }

            const ws = XLSX.utils.aoa_to_sheet(worksheetData);
            
            if (data.length > 0) {
                const colWidths = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 15) }));
                ws['!cols'] = colWidths;
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Visits");
            
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Visits_Schedules_${dateStr}.xlsx`);
        } else if (format === 'pdf') {
            const doc = new jsPDF('landscape');
            
            doc.setFontSize(16);
            doc.text("Visits & Scheduling Report", 14, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Period: ${reportPeriodText}`, 14, 28);
            doc.text(`Filters: ${filterDesc}`, 14, 34);
            
            if (data.length === 0) {
                doc.text("No records found for the selected period and filters.", 14, 46);
            } else {
                const head = [Object.keys(data[0])];
                const body = data.map(obj => Object.values(obj));
                
                autoTable(doc, {
                    startY: 42,
                    head: head,
                    body: body,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [185, 129, 138] }
                });
            }
            
            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`Visits_Schedules_${dateStr}.pdf`);
        }
    };

    return (
        <div className="prenatal-visits-overall">
            {toast && <div className="toast toast--success"><CheckCircle2 size={16} /> {toast}</div>}

            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Visits &amp; Scheduling</h1>
                    <p className="page-subtitle">Manage patient visits and schedules with up to 30 appointments per day — 25 for regular visits and 5 for rescheduled visits.</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => setShowExportModal(true)}
                    >
                        <Download size={16} /> Export
                    </button>
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
                    className={`visit-type-tab ${visitTypeTab === 'postpartum' ? 'active' : ''}`}
                    onClick={() => setVisitTypeTab('postpartum')}
                >
                    Postpartum
                </button>
            </div>

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
                        <div style={{ marginLeft: '12px' }}>
                            <Legend 
                                categories={[
                                    {
                                        title: "Status",
                                        items: [
                                            { label: "Available", style: { backgroundColor: 'rgba(122, 162, 219, 0.15)', color: '#3b5a8c' } },
                                            { label: "Scheduled", style: { backgroundColor: 'rgba(230, 184, 110, 0.2)', color: '#8a6a10' } },
                                            { label: "Attended / Completed", style: { backgroundColor: 'rgba(109, 184, 160, 0.2)', color: '#3d8870' } },
                                            { label: "Missed", style: { backgroundColor: 'rgba(224, 122, 138, 0.15)', color: '#a04070' } }
                                        ]
                                    }
                                ]}
                            />
                        </div>
                    </div>
                </div>

                <div className="pv-grid-container">
                    {calendarView === 'day' ? (
                        <div className="day-view-container">
                            {visibleDays.map(day => {
                                const dayItems = visitTypeTab === 'postpartum'
                                    ? postpartumTable.filter(v => v.visitDateOnly === day.date)
                                    : visitsTable.filter(v => v.visitDateOnly === day.date);
                                const dayManual = visitTypeTab === 'prenatal' ? manualVisits.filter(v => v.visit_date === day.date) : [];

                                return (
                                    <div key={day.date} className={`day-schedule-card ${day.date === TODAY ? 'day-today' : ''}`}>
                                        <div className="day-schedule-header">
                                            <h3 className="day-schedule-title">
                                                {day.label}
                                                {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                            </h3>
                                            <span className="day-schedule-count">
                                                {dayItems.length + dayManual.length} schedule{dayItems.length + dayManual.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="day-schedule-list">
                                            {dayItems.map(item => (
                                                <div
                                                    key={item.id}
                                                    className={`schedule-item status-${(item.status || 'scheduled').toLowerCase()} clickable`}
                                                    onClick={(e) => { e.stopPropagation(); visitTypeTab === 'postpartum' ? openPostpartumVisit(item) : setSelectedVisit({ ...item, type: 'Prenatal' }); }}
                                                >
                                                    <div className="schedule-details">
                                                        <span className="schedule-patient">{item.patientName}</span>
                                                        <span className="schedule-id">{visitTypeTab === 'postpartum' ? 'Postpartum Follow-up' : formatMotherId(item.patientId)}</span>
                                                        <span className="schedule-id">Assigned: {item.assignedStaff || 'Unassigned'}</span>
                                                    </div>
                                                    <span className={`schedule-status status-${(item.status || 'scheduled').toLowerCase()}`}>
                                                        {item.status || 'Scheduled'}
                                                    </span>
                                                </div>
                                            ))}
                                            {dayItems.length === 0 && dayManual.length === 0 && <div className="no-schedules">No schedules for this day</div>}
                                            {dayManual.map(mv => (
                                                <div key={mv.id} className={`schedule-item manual-visit-item manual-${mv.visit_type}`}>
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
                                    {visibleDays.map(day => {
                                        const dayItems = visitTypeTab === 'postpartum'
                                            ? postpartumTable.filter(v => v.visitDateOnly === day.date)
                                            : visitsTable.filter(v => v.visitDateOnly === day.date);
                                        const dayManual = visitTypeTab === 'prenatal' ? manualVisits.filter(mv => mv.visit_date === day.date) : [];

                                        return (
                                            <div key={day.date} className={`day-cell ${day.date === TODAY ? 'day-today' : ''}`} onClick={() => { setCalendarView('day'); setCurrentDate(new Date(day.date)); }}>
                                                <h4 className="day-header">
                                                    {formatCalendarDate(day.date)}
                                                    {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                                </h4>
                                                <div className="day-visits">
                                                    {dayItems.map(item => (
                                                        <div 
                                                            key={item.id} 
                                                            className={`visit-item status-${(item.status || 'scheduled').toLowerCase()} clickable`}
                                                            onClick={(e) => { e.stopPropagation(); visitTypeTab === 'postpartum' ? openPostpartumVisit(item) : setSelectedVisit({ ...item, type: 'Prenatal' }); }}
                                                        >
                                                            <span className="visit-patient">{item.patientName}</span>
                                                            <span className="visit-status">{visitTypeTab === 'postpartum' ? 'Postpartum' : (item.status || 'Scheduled')}</span>
                                                            <span className="visit-status">Assigned: {item.assignedStaff || 'Unassigned'}</span>
                                                        </div>
                                                    ))}
                                                    {dayManual.map(mv => (
                                                        <div key={mv.id} className={`visit-item manual-${mv.visit_type}`}>
                                                            <span className="visit-patient">{mv.patient_name}</span>
                                                            <span className="visit-type-badge" style={{ background: mv.visit_type === 'emergency' ? 'rgba(224,92,115,0.15)' : 'rgba(147,111,199,0.15)', color: mv.visit_type === 'emergency' ? '#c94070' : '#7a4fa8', fontWeight: 600, fontSize: '10px', padding: '1px 6px', borderRadius: '8px' }}>{mv.visit_type === 'emergency' ? 'Emergency' : 'Follow-up'}</span>
                                                        </div>
                                                    ))}
                                                    {dayItems.length === 0 && dayManual.length === 0 && (
                                                        <div className="no-visits">No schedules</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                (() => {
                                    const weeks = [];
                                    for (let i = 0; i < visibleDays.length; i += 7) {
                                        weeks.push(visibleDays.slice(i, i + 7));
                                    }
                                    return weeks.map((week, weekIndex) => (
                                        <div key={weekIndex} className="week-row">
                                            {week.map(day => {
                                                const dayItems = visitTypeTab === 'postpartum'
                                                    ? postpartumTable.filter(v => v.visitDateOnly === day.date)
                                                    : visitsTable.filter(v => v.visitDateOnly === day.date);
                                                const dayManual = visitTypeTab === 'prenatal' ? manualVisits.filter(mv => mv.visit_date === day.date) : [];

                                                return (
                                                    <div key={day.date} className={`day-cell ${day.date === TODAY ? 'day-today' : ''}`} onClick={() => { setCalendarView('day'); setCurrentDate(new Date(day.date)); }}>
                                                        <h4 className="day-header">
                                                            {formatCalendarDate(day.date)}
                                                            {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                                        </h4>
                                                        <div className="day-visits">
                                                            {dayItems.map(item => (
                                                                <div 
                                                                    key={item.id} 
                                                                    className={`visit-item status-${(item.status || 'scheduled').toLowerCase()} clickable`}
                                                                    onClick={(e) => { e.stopPropagation(); visitTypeTab === 'postpartum' ? openPostpartumVisit(item) : setSelectedVisit({ ...item, type: 'Prenatal' }); }}
                                                                >
                                                                    <span className="visit-patient">{item.patientName}</span>
                                                                    <span className="visit-status">{visitTypeTab === 'postpartum' ? 'Postpartum' : (item.status || 'Scheduled')}</span>
                                                                    <span className="visit-status">Assigned: {item.assignedStaff || 'Unassigned'}</span>
                                                                </div>
                                                            ))}
                                                            {dayManual.map(mv => (
                                                                <div key={mv.id} className={`visit-item manual-${mv.visit_type}`}>
                                                                    <span className="visit-patient">{mv.patient_name}</span>
                                                                    <span className="visit-type-badge" style={{ background: mv.visit_type === 'emergency' ? 'rgba(224,92,115,0.15)' : 'rgba(147,111,199,0.15)', color: mv.visit_type === 'emergency' ? '#c94070' : '#7a4fa8', fontWeight: 600, fontSize: '11px', padding: '1px 6px', borderRadius: '8px' }}>{mv.visit_type === 'emergency' ? 'Emergency' : 'Follow-up'}</span>
                                                                </div>
                                                            ))}
                                                            {dayItems.length === 0 && dayManual.length === 0 && (
                                                                <div className="no-visits">No schedules</div>
                                                            )}
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


            {/* VISITS TABLE */}
            <div className="pv-table-section">
                <div className="section-header-row">
                    <h2 className="section-title">
                        <Clock size={18} /> Visit Records
                    </h2>
                    <div className="table-filters" style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
                        <div className="shared-search-wrap" style={{ maxWidth: '400px' }}>
                            <Search size={16} className="shared-search-icon" />
                            <input 
                                type="text" 
                                placeholder="Search Patient Name"
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="shared-search-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Category Tabs */}
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

                {visitTypeTab === 'prenatal' ? (
                    <div className="table-responsive">
                        <table className="pv-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'center', width: '50px' }}>#</th>
                                    <th>Patient Name</th>
                                    <th>Risk Level</th>
                                    <th>Date</th>
                                    <th>Assigned Staff</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTabVisits.length > 0 ? (
                                    paginatedTabVisits.map((visit, idx) => (
                                        <tr key={visit.id} className="pv-clickable-row" onClick={() => navigate(`/dashboard/patients/${visit.patientId}?tab=visits`)} style={{ cursor: 'pointer' }}>
                                            <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '12.5px', width: '50px' }}>{tabStartIndex + idx + 1}</td>
                                            <td>
                                                <div className="p-info">
                                                    <span className="p-name">{visit.patientName}</span>
                                                    <span className="p-id">{formatMotherId(visit.patientId)}</span>
                                                    <span className="p-id">Assigned: {visit.assignedStaff || 'Unassigned'}</span>
                                                    {(visit.assignedStation || visit.visitStation) && (
                                                        <span className="p-id">
                                                            Station: {visit.assignedStation || 'Unassigned'}
                                                            {visit.visitStation && visit.visitStation !== visit.assignedStation ? ` · Visit: ${visit.visitStation}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`risk-tag risk-${visit.risk?.replace(' ', '-').toLowerCase() || 'normal'}`}>
                                                    {visit.risk?.toLowerCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="visit-date">{formatReadableDate(visit.visitDate)}</span>
                                            </td>
                                            <td onClick={event => event.stopPropagation()}>
                                                {visit.status === 'Scheduled'
                                                    && (visitAccess?.role === 'admin'
                                                        || (['cho personnel', 'staff'].includes(visitAccess?.role)
                                                            && visit.assignedStationId === visitAccess.stationId
                                                            && (visitAccess.role === 'cho personnel' || !visit.assignedStaffId))) ? (
                                                    <select
                                                        value={visit.assignedStaffId || ''}
                                                        onChange={event => handleReassignVisit(visit.id, event.target.value)}
                                                        onMouseDown={event => event.stopPropagation()}
                                                        aria-label={`Assigned staff for visit ${visit.visitNumber || ''}`}
                                                    >
                                                        <option value="" disabled={visitAccess.role === 'staff'}>Unassigned</option>
                                                        {visit.assignedStaffId && !assignmentStaff.some(staff =>
                                                            staff.id === visit.assignedStaffId
                                                            && (visitAccess.role === 'admin' || staff.station_ass === visitAccess.stationId)
                                                        ) && (
                                                            <option value={visit.assignedStaffId} disabled>{visit.assignedStaff} (other station)</option>
                                                        )}
                                                        {assignmentStaff
                                                            .filter(staff => visitAccess.role === 'admin' || staff.station_ass === visitAccess.stationId)
                                                            .map(staff => <option key={staff.id} value={staff.id}>{staff.full_name}</option>)}
                                                    </select>
                                                ) : (
                                                    <div className="p-info">
                                                        <span className="p-id">Assigned: {visit.assignedStaff || 'Unassigned'}</span>
                                                    </div>
                                                )}
                                                {(visit.assignedStation || visit.visitStation) && (
                                                    <span className="p-id">
                                                        {visit.assignedStation || 'Unassigned'}
                                                        {visit.visitStation && visit.visitStation !== visit.assignedStation ? ` · Visit: ${visit.visitStation}` : ''}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${visit.status?.toLowerCase() || 'scheduled'}`}>
                                                    {visit.status}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <div className="row-actions" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); setSelectedVisit({ ...visit, type: 'Prenatal' }); }} title="Manage Visit">Manage Visit</button></div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="empty-tab-state">
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
                ) : (
                    <div className="table-responsive">
                        <table className="pv-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'center', width: '50px' }}>#</th>
                                    <th>Patient Name</th>
                                    <th>Follow-up</th>
                                    <th>Date &amp; Time</th>
                                    <th>Assigned Staff</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTabVisits.length > 0 ? (
                                    paginatedTabVisits.map((visit, idx) => (
                                        <tr key={visit.id}>
                                            <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '12.5px', width: '50px' }}>{tabStartIndex + idx + 1}</td>
                                            <td>
                                                <div className="p-info">
                                                    <span className="p-name">{visit.patientName}</span>
                                                    <span className="p-id">{formatMotherId(visit.patientId)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="p-info">
                                                    <span className="p-name" style={{ fontWeight: 600 }}>Postpartum Follow-up</span>
                                                    <span className="p-id">{visit.doseText || 'Routine check'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="visit-date">{formatReadableDate(visit.visitDate)}</span>
                                            </td>
                                            <td>{visit.assignedStaff || 'Unassigned'}</td>
                                            <td>
                                                <span className={`status-badge status-${visit.status?.toLowerCase() || 'scheduled'}`}>
                                                    {visit.status}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <div className="row-actions">
                                                    <button className="action-btn-text action-btn-secondary" onClick={() => setSelectedVisit({ ...visit, type: 'Postpartum' })} title="View" style={{ padding: '6px 8px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Eye size={14} />
                                                    </button>
                                                    <button className="action-btn-text action-btn-primary" onClick={() => openPostpartumVisit(visit)} title="Record Postpartum Visit">
                                                        <Plus size={14} /> Record
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
                                        <td colSpan="7" className="empty-tab-state">
                                            {visitCategoryTab === 'upcoming' && (
                                                <div className="empty-state-content">
                                                    <CalendarCheck size={32} />
                                                    <p>No upcoming postpartum follow-ups.</p>
                                                </div>
                                            )}
                                            {visitCategoryTab === 'missed' && (
                                                <div className="empty-state-content">
                                                    <AlertTriangle size={32} />
                                                    <p>No missed postpartum follow-ups.</p>
                                                </div>
                                            )}
                                            {visitCategoryTab === 'completed' && (
                                                <div className="empty-state-content">
                                                    <CheckCircle2 size={32} />
                                                    <p>No completed postpartum follow-ups.</p>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {tabTotalPages > 1 && (
                    <div className="pagination-wrap">
                        <span>
                            Showing {tabStartIndex + 1}–{Math.min(tabStartIndex + itemsPerPage, tabVisits.length)} of {tabVisits.length}
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

            {showAddVisitModal && (
                <div className="modal-overlay" onClick={() => setShowAddVisitModal(false)}>
                    <div
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '600px' }}
                    >
                        <div className="modal-header">
                            <h2>Add Manual Visit</h2>
                            <p>Schedule an Emergency or Follow-up visit for a patient.</p>
                        </div>
                        <form onSubmit={handleAddVisitSubmit}>
                            <div className="modal-body" style={{ padding: '24px 32px' }}>
                                
                                {/* SECTION 1: Visit Information */}
                                <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #eee' }}>
                                    <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '16px', letterSpacing: '0.5px' }}>Visit Information</h4>
                                    
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

                                    <div className="form-group">
                                        <label>Patient <span style={{ color: '#e05c73' }}>*</span></label>
                                        <SearchableDropdown
                                            patients={allPatients}
                                            value={addVisitForm.patient_id}
                                            onChange={val => setAddVisitForm({ ...addVisitForm, patient_id: val, related_emergency_id: '' })}
                                        />
                                    </div>

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
                                </div>

                                {/* SECTION 2: Assignment */}
                                <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #eee' }}>
                                    <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '16px', letterSpacing: '0.5px' }}>Assignment</h4>
                                    
                                    <div className="form-group">
                                        <label>Assigned Healthcare Staff</label>
                                        <input
                                            type="text"
                                            value={addVisitForm.assigned_staff}
                                            onChange={e => setAddVisitForm({ ...addVisitForm, assigned_staff: e.target.value })}
                                            placeholder="Enter staff name"
                                        />
                                    </div>
                                </div>

                                {/* SECTION 3: Visit Details */}
                                <div>
                                    <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '16px', letterSpacing: '0.5px' }}>Visit Details</h4>
                                    
                                    <div className="form-group">
                                        <label>Reason <span style={{ color: '#e05c73' }}>*</span></label>
                                        <input
                                            type="text"
                                            required
                                            value={addVisitForm.reason}
                                            onChange={e => setAddVisitForm({ ...addVisitForm, reason: e.target.value })}
                                            placeholder="e.g. Severe abdominal pain"
                                            style={{ border: '2px solid rgba(147, 111, 199, 0.2)', padding: '12px', fontSize: '14px', backgroundColor: '#fdfbfe' }}
                                        />
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
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
            {postpartumVisitMother && (
                <PostpartumVisitModal
                    mother={postpartumVisitMother}
                    onClose={() => setPostpartumVisitMother(null)}
                    onSave={() => { setPostpartumVisitMother(null); fetchData(); }}
                />
            )}
            <ExportModal 
                isOpen={showExportModal} 
                onClose={() => setShowExportModal(false)} 
                onExport={handleExport} 
            />
        </div>
    );
};

export default PrenatalVisits;
