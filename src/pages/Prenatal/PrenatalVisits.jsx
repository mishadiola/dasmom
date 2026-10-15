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
    Download, CalendarPlus
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
import VisitStaffAssignment from '../../components/Prenatal/VisitStaffAssignment';
import ActionTooltip from '../../components/Common/ActionTooltip';
import StaffPageLoader from '../../components/Common/StaffPageLoader';

const toLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const withPreservedManilaTime = (date, scheduledAt) => {
    if (!scheduledAt) {
        throw new Error('Could not determine the existing postpartum visit time.');
    }
    const original = new Date(scheduledAt);
    if (Number.isNaN(original.getTime())) {
        throw new Error('Could not determine the existing postpartum visit time.');
    }
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).formatToParts(original);
    const timePart = type => parts.find(part => part.type === type)?.value;
    const clock = `${timePart('hour')}:${timePart('minute')}:${timePart('second')}`;
    return `${date}T${clock}+08:00`;
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

    const [initialLoading, setInitialLoading] = useState(true);
    const [initialError, setInitialError] = useState(null);
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
    const [vaccinationRescheduleRows, setVaccinationRescheduleRows] = useState([]);
    const [visitsTable, setVisitsTable] = useState([]);
    const [archivedPatientIds, setArchivedPatientIds] = useState(new Set());
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [visitTypeTab, setVisitTypeTab] = useState('prenatal'); // 'prenatal' | 'postpartum'
    const [visitCategoryTab, setVisitCategoryTab] = useState('upcoming'); // 'upcoming' | 'missed' | 'completed'
    const [visitAccess, setVisitAccess] = useState(null);
    const [assignmentStaff, setAssignmentStaff] = useState([]);
    const [assignmentStations, setAssignmentStations] = useState([]);
    const [loadingAssignmentStaff, setLoadingAssignmentStaff] = useState(false);

    // Manage Visits selection modal state
    const [showManageModal, setShowManageModal] = useState(false);

    // Schedule a Visit modal states
    const [showAddVisitModal, setShowAddVisitModal] = useState(false);
    const [allPatients, setAllPatients] = useState([]);
    const [isAddingVisit, setIsAddingVisit] = useState(false);
    const [addVisitForm, setAddVisitForm] = useState({
        visit_category: 'Prenatal',
        visit_type: 'emergency',
        patient_id: '',
        visit_date: new Date().toISOString().split('T')[0],
        assigned_staff: '',
        assigned_station: '',
        reason: '',
        notes: ''
    });

    // Reschedule a Visit modal states
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [rescheduleSearch, setRescheduleSearch] = useState('');
    const [rescheduleDateFilter, setRescheduleDateFilter] = useState('');
    const [selectedRescheduleVisitIds, setSelectedRescheduleVisitIds] = useState([]);
    const [rescheduleForm, setRescheduleForm] = useState({
        new_date: '',
        reason: ''
    });
    const [rescheduleResults, setRescheduleResults] = useState([]);
    const [isRescheduling, setIsRescheduling] = useState(false);

    const patientService = useMemo(() => new PatientService(), []);
    const canReschedule = ['admin', 'staff', 'cho personnel'].includes(visitAccess?.role);
    const patientsForVisitCategory = useMemo(() => allPatients.filter(patient => (
        addVisitForm.visit_category === 'Postpartum'
            ? patient.hasDelivery
            : !patient.hasDelivery && String(patient.pregnancyStatus).toLowerCase() === 'pregnant'
    )), [addVisitForm.visit_category, allPatients]);
    const selectedAddVisitPatient = allPatients.find(patient => patient.id === addVisitForm.patient_id);
    const assignableVisitStaff = addVisitForm.visit_category === 'Postpartum' && selectedAddVisitPatient?.assignedStaffId
        ? assignmentStaff.filter(staff => staff.id === selectedAddVisitPatient.assignedStaffId)
        : assignmentStaff;

    useEffect(() => {
        let active = true;
        const loadAssignmentOptions = async () => {
            try {
                const access = await patientService.getCurrentUserAccess();
                if (!active) return;
                setVisitAccess(access);

                const { data: stations, error: stationError } = await patientService.supabase
                    .from('stations')
                    .select('id, station_name')
                    .order('station_name');
                if (stationError) throw stationError;
                if (!active) return;
                setAssignmentStations(stations || []);
                if (access.stationId) {
                    setAddVisitForm(current => ({
                        ...current,
                        assigned_station: current.assigned_station || access.stationId
                    }));
                }
            } catch (error) {
                console.error('Could not load prenatal assignment options:', error);
            }
        };
        loadAssignmentOptions();
        return () => { active = false; };
    }, [patientService]);

    useEffect(() => {
        let active = true;
        const loadStaffForSelectedStation = async () => {
            const stationId = addVisitForm.assigned_station;
            if (!stationId || !['admin', 'staff', 'cho personnel'].includes(visitAccess?.role)) {
                setAssignmentStaff([]);
                return;
            }
            setLoadingAssignmentStaff(true);
            try {
                const staff = await patientService.getAssignableStaffByStationId(stationId);
                if (active) setAssignmentStaff(staff);
            } catch (error) {
                console.error('Could not load staff for the selected station:', error);
                if (active) setAssignmentStaff([]);
            } finally {
                if (active) setLoadingAssignmentStaff(false);
            }
        };
        loadStaffForSelectedStation();
        return () => { active = false; };
    }, [addVisitForm.assigned_station, patientService, visitAccess?.role]);

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
            setInitialLoading(false);

        } catch (error) {
            console.error('Prenatal fetch error:', error);
            setInitialError(error);
            setInitialLoading(false);
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

    // Load patients and their latest delivery so the category and patient list stay in sync.
    useEffect(() => {
        const loadPatients = async () => {
            try {
                const [data, { data: deliveries, error }] = await Promise.all([
                    patientService.getAllPatients(),
                    patientService.supabase
                        .from('deliveries')
                        .select('id, mother_id, delivery_date, station_ass')
                        .order('delivery_date', { ascending: false })
                ]);
                if (error) throw error;
                const latestDeliveryByPatient = new Map();
                (deliveries || []).forEach(delivery => {
                    if (delivery.mother_id && !latestDeliveryByPatient.has(delivery.mother_id)) {
                        latestDeliveryByPatient.set(delivery.mother_id, delivery);
                    }
                });
                setAllPatients((data || []).map(p => ({
                    id: p.id,
                    name: p.fullName || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.name || p.id,
                    stationId: p.stationId || null,
                    assignedStaffId: p.assignedStaffId || null,
                    lmp: p.lmp || null,
                    edd: p.edd || null,
                    pregnancyStatus: p.pregnancyStatus || '',
                    riskLevel: p.risk || 'Unknown',
                    delivery: latestDeliveryByPatient.get(p.id) || null,
                    hasDelivery: latestDeliveryByPatient.has(p.id)
                })));
            } catch (e) {
                console.error('Failed to load patients for Add Visit modal:', e);
            }
        };
        loadPatients();
    }, [patientService]);

    useEffect(() => {
        const loadPostpartumFollowUps = async () => {
            try {
                const { data: postpartumVisits, error } = await patientService.supabase
                    .from('postpartum_visits')
                    .select('id, delivery_id, patient_id, visit_type, scheduled_at, scheduled_date, attended_date, status, assigned_staff, station_ass, reschedule_reason')
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
                    const dateStr = attendedDate || visit.scheduled_date || scheduledDate;
                    const patient = patientById.get(visit.patient_id);
                    const patientName = patient
                        ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
                        : visit.patient_id;
                    const status = visit.status === 'Attended'
                        ? 'Attended'
                        : visit.status === 'Cancelled'
                            ? 'Cancelled'
                            : scheduledDate && (visit.scheduled_date || toLocalDateStr(new Date(scheduledDate))) < toLocalDateStr(new Date())
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
                        visitDateOnly: visit.scheduled_date || toLocalDateStr(new Date(scheduledDate)),
                        reschedule_reason: visit.reschedule_reason || null,
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
    }, [patientService.supabase]);

    useEffect(() => {
        let active = true;
        const loadVaccinationsForRescheduling = async () => {
            try {
                const { data: records, error } = await patientService.supabase
                    .from('vaccinations')
                    .select('id, patient_id, newborn_id, vaccine_inventory_id, dose_number, scheduled_vaccination, status, vaccinated_date, station_ass, reschedule_reason, vaccine_inventory(vaccine_name)')
                    .eq('status', 'Pending')
                    .not('scheduled_vaccination', 'is', null)
                    .order('scheduled_vaccination', { ascending: true });
                if (error) throw error;

                const newbornIds = [...new Set((records || []).map(record => record.newborn_id).filter(Boolean))];
                const { data: newborns, error: newbornError } = newbornIds.length
                    ? await patientService.supabase.from('newborns').select('id, baby_name, mother_id').in('id', newbornIds)
                    : { data: [], error: null };
                if (newbornError) throw newbornError;

                const patientIds = [...new Set([
                    ...(records || []).map(record => record.patient_id),
                    ...(newborns || []).map(newborn => newborn.mother_id)
                ].filter(Boolean))];
                const { data: patients, error: patientError } = patientIds.length
                    ? await patientService.supabase.from('patient_basic_info').select('id, first_name, last_name').in('id', patientIds)
                    : { data: [], error: null };
                if (patientError) throw patientError;

                const newbornById = new Map((newborns || []).map(newborn => [newborn.id, newborn]));
                const patientById = new Map((patients || []).map(patient => [
                    patient.id,
                    `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
                ]));
                const rows = (records || []).map(record => {
                    const newborn = newbornById.get(record.newborn_id);
                    const patientId = record.patient_id || newborn?.mother_id;
                    const vaccineName = record.vaccine_inventory?.vaccine_name || 'Vaccination';
                    const dose = record.dose_number ? `, dose ${record.dose_number}` : '';
                    const isNewborn = Boolean(record.newborn_id);
                    return {
                        id: record.id,
                        key: `${isNewborn ? 'newborn_vaccination' : 'maternal_vaccination'}:${record.id}`,
                        kind: isNewborn ? 'newborn_vaccination' : 'maternal_vaccination',
                        patientId,
                        patientName: patientById.get(patientId) || 'Unknown patient',
                        visitType: isNewborn
                            ? `Baby vaccination: ${vaccineName}${dose}`
                            : `Maternal vaccination: ${vaccineName}${dose}`,
                        currentDate: String(record.scheduled_vaccination).slice(0, 10),
                        currentTime: null,
                        station: '',
                        rescheduleReason: record.reschedule_reason || ''
                    };
                }).filter(record => record.patientId);
                if (active) setVaccinationRescheduleRows(rows);
            } catch (error) {
                console.error('Could not load vaccinations for rescheduling:', error);
                if (active) {
                    setToast('Could not load scheduled vaccinations for rescheduling.');
                    setTimeout(() => setToast(null), 4000);
                }
            }
        };
        loadVaccinationsForRescheduling();
        return () => { active = false; };
    }, [patientService.supabase]);

    const handleAddVisitSubmit = async (e) => {
        e.preventDefault();
        const role = visitAccess?.role;
        if (!['admin', 'staff', 'cho personnel'].includes(role)) {
            setToast('Your account is not authorized to schedule visits.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        const mayAssignOutsideOwnStation = role === 'admin';
        if (!addVisitForm.assigned_station) {
            setToast('Select an assigned station for this visit.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        if (!mayAssignOutsideOwnStation
            && addVisitForm.assigned_station !== visitAccess?.stationId
            && addVisitForm.assigned_staff) {
            setToast('Staff and CHO personnel can only assign a worker when the visit station is their own station.');
            setTimeout(() => setToast(null), 4000);
            return;
        }
        if (addVisitForm.assigned_staff
            && !assignmentStaff.some(staff => staff.id === addVisitForm.assigned_staff)) {
            setToast('Select a healthcare worker from the assigned station.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        const patient = patientsForVisitCategory.find(p => p.id === addVisitForm.patient_id);
        if (!patient) {
            setToast('Select a patient who matches the selected visit category.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        if (addVisitForm.visit_category === 'Postpartum'
            && addVisitForm.assigned_staff
            && patient.assignedStaffId !== addVisitForm.assigned_staff) {
            setToast("Postpartum visits can only be assigned to the patient's assigned prenatal healthcare worker.");
            setTimeout(() => setToast(null), 4000);
            return;
        }
        setIsAddingVisit(true);

        try {
            const postInsertWarnings = [];
            const assignedStaff = assignmentStaff.find(staff => staff.id === addVisitForm.assigned_staff);
            const assignedStation = assignmentStations.find(station => station.id === addVisitForm.assigned_station);
            const visitLabel = `${addVisitForm.visit_type === 'emergency' ? 'Emergency Visit' : 'Follow-up Visit'}: ${addVisitForm.reason.trim()}`;

            if (addVisitForm.visit_category === 'Prenatal') {
                const [pregnancyResult, latestVisitResult, duplicateResult] = await Promise.all([
                    patientService.supabase.from('pregnancy_info')
                        .select('lmd')
                        .eq('patient_id', patient.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    patientService.supabase.from('prenatal_visits')
                        .select('visit_number')
                        .eq('patient_id', patient.id)
                        .order('visit_number', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    patientService.supabase.from('prenatal_visits')
                        .select('id')
                        .eq('patient_id', patient.id)
                        .eq('visit_date', addVisitForm.visit_date)
                        .eq('status', 'Scheduled')
                        .limit(1)
                        .maybeSingle()
                ]);
                const queryError = pregnancyResult.error || latestVisitResult.error || duplicateResult.error;
                if (queryError) throw queryError;
                if (!pregnancyResult.data?.lmd) {
                    throw new Error('The selected patient does not have a current pregnancy record.');
                }
                if (duplicateResult.data) {
                    throw new Error('This patient already has a scheduled prenatal visit on that date.');
                }

                const gestationalWeek = patientService.calculateWeeksAtDate(pregnancyResult.data.lmd, addVisitForm.visit_date);
                const { data: insertedVisit, error } = await patientService.supabase.from('prenatal_visits').insert({
                    patient_id: patient.id,
                    created_by: user?.id || null,
                    visit_date: addVisitForm.visit_date,
                    visit_number: Number(latestVisitResult.data?.visit_number || 0) + 1,
                    trimester: patientService.getTrimesterFromWeek(gestationalWeek),
                    gestational_age: `${gestationalWeek}w`,
                    next_appt_type: visitLabel,
                    clinical_notes: addVisitForm.notes.trim() || null,
                    status: 'Scheduled',
                    assigned_staff: assignedStaff?.id || null,
                    assigned_station: assignedStation?.id || null
                }).select('id').single();
                if (error) throw error;
                try {
                    await patientService.resequencePrenatalVisitNumbers(patient.id);
                } catch (numberingError) {
                    console.error('Prenatal visit saved, but visit numbers could not be updated:', numberingError);
                    postInsertWarnings.push('Visit numbers could not be updated.');
                }
                try {
                    await patientService.sendScheduledVisitNotification('prenatal', insertedVisit.id);
                } catch (emailError) {
                    console.error('Prenatal visit was saved, but its email notification failed:', emailError);
                    postInsertWarnings.push('The email notification could not be sent.');
                }
                await fetchData();
            } else {
                if (!patient.delivery?.id) {
                    throw new Error('A delivery record is required before scheduling a postpartum visit.');
                }
                const [latestVisitResult, duplicateResult] = await Promise.all([
                    patientService.supabase.from('postpartum_visits')
                        .select('visit_number')
                        .eq('delivery_id', patient.delivery.id)
                        .order('visit_number', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    patientService.supabase.from('postpartum_visits')
                        .select('id')
                        .eq('delivery_id', patient.delivery.id)
                        .eq('scheduled_date', addVisitForm.visit_date)
                        .eq('status', 'Scheduled')
                        .limit(1)
                        .maybeSingle()
                ]);
                const queryError = latestVisitResult.error || duplicateResult.error;
                if (queryError) throw queryError;
                if (duplicateResult.data) {
                    throw new Error('This patient already has a scheduled postpartum visit on that date.');
                }

                const { data: insertedVisit, error } = await patientService.supabase
                    .from('postpartum_visits')
                    .insert({
                        delivery_id: patient.delivery.id,
                        patient_id: patient.id,
                        visit_number: Number(latestVisitResult.data?.visit_number || 0) + 1,
                        scheduled_date: addVisitForm.visit_date,
                        scheduled_at: `${addVisitForm.visit_date}T00:00:00+08:00`,
                        visit_type: visitLabel,
                        status: 'Scheduled',
                        assigned_staff: assignedStaff?.id || null,
                        assigned_station: assignedStation?.id || null,
                        station_ass: patient.delivery.station_ass || null,
                        created_by: user?.id || null,
                        notes: addVisitForm.notes.trim() || null
                    })
                    .select('id, delivery_id, patient_id, visit_type, scheduled_date, attended_date, status, assigned_staff, station_ass')
                    .single();
                if (error) throw error;
                try {
                    await patientService.resequencePostpartumVisitNumbers(patient.delivery.id);
                } catch (numberingError) {
                    console.error('Postpartum visit saved, but visit numbers could not be updated:', numberingError);
                    postInsertWarnings.push('Visit numbers could not be updated.');
                }
                try {
                    await patientService.sendScheduledVisitNotification('postpartum', insertedVisit.id);
                } catch (emailError) {
                    console.error('Postpartum visit was saved, but its email notification failed:', emailError);
                    postInsertWarnings.push('The email notification could not be sent.');
                }

                setPostpartumTable(current => [{
                    id: insertedVisit.id,
                    deliveryId: insertedVisit.delivery_id,
                    patientId: insertedVisit.patient_id,
                    patientName: patient.name,
                    vaccineName: insertedVisit.visit_type,
                    doseText: '',
                    assignedStaffId: insertedVisit.assigned_staff || null,
                    assignedStaff: assignedStaff?.full_name || null,
                    visitDate: insertedVisit.scheduled_date,
                    visitDateOnly: insertedVisit.scheduled_date,
                    status: insertedVisit.status,
                    attendedDate: insertedVisit.attended_date || null,
                    assignedStationId: insertedVisit.station_ass || null,
                    assignedStation: patient.delivery.station_ass
                        ? assignmentStations.find(station => station.id === patient.delivery.station_ass)?.station_name || null
                        : null,
                    notes: 'Postpartum follow-up',
                    raw: insertedVisit
                }, ...current]);
            }

            setShowAddVisitModal(false);
            setAddVisitForm({
                visit_category: 'Prenatal',
                visit_type: 'emergency',
                patient_id: '',
                visit_date: new Date().toISOString().split('T')[0],
                assigned_staff: '',
                assigned_station: visitAccess?.stationId || '',
                reason: '',
                notes: ''
            });
            setToast(postInsertWarnings.length
                ? `Visit saved. ${postInsertWarnings.join(' ')}`
                : 'Visit scheduled successfully. An email notification was sent.');
            setTimeout(() => setToast(null), 3000);
        } catch (error) {
            console.error('Failed to schedule visit:', error);
            setToast(`Failed to schedule visit: ${error.message || 'Please try again.'}`);
            setTimeout(() => setToast(null), 5000);
        } finally {
            setIsAddingVisit(false);
        }
    };

    const handleConfirmReschedule = async (e) => {
        e.preventDefault();
        if (!canReschedule) {
            setToast('Your account is not authorized to reschedule visits.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        const visitsToReschedule = selectedRescheduleVisitIds
            .map(key => eligibleVisitsToReschedule.find(visit => visit.key === key))
            .filter(Boolean);
        if (!visitsToReschedule.length || visitsToReschedule.length !== selectedRescheduleVisitIds.length) {
            setToast('Select one or more current scheduled visits.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        if (!rescheduleForm.new_date || !/^\d{4}-\d{2}-\d{2}$/.test(rescheduleForm.new_date)) {
            setToast('Please select a valid new visit date.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        const [year, month, day] = rescheduleForm.new_date.split('-').map(Number);
        const parsedDate = new Date(year, month - 1, day);
        if (
            Number.isNaN(parsedDate.getTime())
            || parsedDate.getFullYear() !== year
            || parsedDate.getMonth() !== month - 1
            || parsedDate.getDate() !== day
        ) {
            setToast('Please select a valid new visit date.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        if (rescheduleForm.reason.length > 1000) {
            setToast('The rescheduling reason must be 1000 characters or fewer.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        const todayStr = toLocalDateStr(new Date());
        if (rescheduleForm.new_date < todayStr) {
            setToast('Cannot reschedule to a past date.');
            setTimeout(() => setToast(null), 3500);
            return;
        }
        if (visitsToReschedule.some(visit => visit.currentDate === rescheduleForm.new_date)) {
            setToast('The new date must differ from the current date for every selected visit.');
            setTimeout(() => setToast(null), 4000);
            return;
        }
        if (!user?.id) {
            setToast('Your staff session is unavailable. Sign in again to reschedule visits.');
            setTimeout(() => setToast(null), 4000);
            return;
        }

        setRescheduleResults([]);
        setIsRescheduling(true);
        const results = [];
        for (const visit of visitsToReschedule) {
            const eventId = crypto.randomUUID();
            const dateColumn = visit.kind === 'prenatal'
                ? 'visit_date'
                : visit.kind === 'postpartum'
                    ? 'scheduled_date'
                    : 'scheduled_vaccination';
            const table = visit.kind === 'prenatal'
                ? 'prenatal_visits'
                : visit.kind === 'postpartum'
                    ? 'postpartum_visits'
                    : 'vaccinations';
            const rescheduledAt = new Date().toISOString();
            let newScheduledAt = null;
            try {
                const updatePayload = {
                    [dateColumn]: rescheduleForm.new_date,
                    reschedule_reason: rescheduleForm.reason.trim() || null,
                    rescheduled_from_date: visit.currentDate,
                    rescheduled_at: rescheduledAt,
                    rescheduled_by: user.id,
                    reschedule_event_id: eventId
                };
                if (visit.kind === 'postpartum') {
                    newScheduledAt = withPreservedManilaTime(rescheduleForm.new_date, visit.scheduledAt);
                    updatePayload.scheduled_at = newScheduledAt;
                }
                const { data, error: updateError } = await patientService.supabase
                    .from(table)
                    .update(updatePayload)
                    .eq('id', visit.id)
                    .eq(dateColumn, visit.currentDate)
                    .in('status', ['Scheduled', 'Pending'])
                    .select('id')
                    .maybeSingle();
                if (updateError) throw updateError;
                if (!data) {
                    throw new Error('The visit changed or is no longer eligible; refresh the visit list and try again.');
                }
            } catch (error) {
                console.error('Could not reschedule visit:', error);
                results.push({
                    key: visit.key,
                    patientName: visit.patientName,
                    visitType: visit.visitType,
                    status: 'failed',
                    message: error.message || 'The visit could not be updated.'
                });
                continue;
            }

            let message = 'Rescheduled successfully.';
            if (visit.kind === 'prenatal') {
                try {
                    await patientService.resequencePrenatalVisitNumbers(visit.patientId);
                } catch (numberingError) {
                    console.error('Visit was rescheduled, but prenatal visit numbers could not be updated:', numberingError);
                    message += ' Visit numbers could not be updated.';
                }
            }
            try {
                const { data: notification, error: notificationError } = await patientService.supabase.functions.invoke(
                    'visit-reschedule-email',
                    {
                        body: {
                            event_id: eventId,
                            visit_id: visit.id,
                            visit_type: visit.kind,
                            original_date: visit.currentDate,
                            new_date: rescheduleForm.new_date
                        }
                    }
                );
                if (notificationError || !notification?.emailSent) {
                    console.error('Visit was rescheduled, but its email notification failed:', notificationError || notification?.error);
                    message += ` Email notification failed${notification?.error ? `: ${notification.error}` : '.'}`;
                } else {
                    message += ' Email notification sent.';
                }
            } catch (error) {
                console.error('Visit was rescheduled, but its email notification failed:', error);
                message += ' Email notification failed.';
            }
            results.push({
                key: visit.key,
                patientName: visit.patientName,
                visitType: visit.visitType,
                status: 'success',
                message,
                scheduledAt: newScheduledAt
            });
        }
        const succeededKeys = new Set(results.filter(result => result.status === 'success').map(result => result.key));
        const successfulResultsByKey = new Map(results
            .filter(result => result.status === 'success')
            .map(result => [result.key, result]));
        setVisitsTable(current => current.map(visit => succeededKeys.has(`prenatal:${visit.id}`)
            ? {
                ...visit,
                visit_date: rescheduleForm.new_date,
                visitDate: rescheduleForm.new_date,
                visitDateOnly: rescheduleForm.new_date,
                reschedule_reason: rescheduleForm.reason.trim() || null
            }
            : visit));
        setPostpartumTable(current => current.map(visit => succeededKeys.has(`postpartum:${visit.id}`)
            ? {
                ...visit,
                scheduledVaccination: rescheduleForm.new_date,
                visitDate: rescheduleForm.new_date,
                visitDateOnly: rescheduleForm.new_date,
                raw: {
                    ...visit.raw,
                    scheduled_at: successfulResultsByKey.get(`postpartum:${visit.id}`)?.scheduledAt,
                    scheduled_date: rescheduleForm.new_date,
                    reschedule_reason: rescheduleForm.reason.trim() || null
                }
            }
            : visit));
        setVaccinationRescheduleRows(current => current.map(visit => succeededKeys.has(visit.key)
            ? { ...visit, currentDate: rescheduleForm.new_date, rescheduleReason: rescheduleForm.reason.trim() }
            : visit));
        setRescheduleResults(results);
        try {
            await fetchData();
        } catch (error) {
            console.error('Could not refresh visits after rescheduling:', error);
        } finally {
            setIsRescheduling(false);
        }
        const succeeded = results.filter(result => result.status === 'success').length;
        const failed = results.length - succeeded;
        setToast(`${succeeded} visit${succeeded === 1 ? '' : 's'} rescheduled; ${failed} failed. Review the result list.`);
        setTimeout(() => setToast(null), 5000);
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

        const allEntries = activeRows.map(v => {
            const pat = allPatients.find(p => p.id === v.patientId);
            return {
                id: v.id,
                patientId: v.patientId,
                patientName: v.patientName,
                hasHealthConditions: pat?.hasHealthConditions,
                risk: pat?.hasHealthConditions ? 'Documented Conditions' : 'None Reported',
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
            visitDateTime: new Date(v.visitDateOnly || v.visitDate || today),
            raw: v.raw || v
        };
        });

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

    // Eligible existing appointments for rescheduling:
    // Only pending or scheduled records without recorded attendance.
    const eligibleVisitsToReschedule = useMemo(() => {
        const list = [];
        
        // From prenatal visits table
        (visitsTable || []).forEach(v => {
            if (['Scheduled', 'Pending'].includes(v.status) && !v.attendedDate) {
                list.push({
                    id: v.id,
                    key: `prenatal:${v.id}`,
                    kind: 'prenatal',
                    patientId: v.patientId,
                    patientName: v.patientName,
                    visitType: v.type || 'Prenatal Checkup',
                    currentDate: v.visitDateOnly || v.visitDate,
                    currentTime: v.visitTime || null,
                    station: v.assignedStation || v.visitStation || 'Unassigned',
                    rescheduleReason: v.reschedule_reason || ''
                });
            }
        });

        // From postpartum visits
        (postpartumTable || []).forEach(v => {
            if (['Scheduled', 'Pending'].includes(v.status) && !v.attendedDate) {
                list.push({
                    id: v.id,
                    key: `postpartum:${v.id}`,
                    kind: 'postpartum',
                    patientId: v.patientId,
                    patientName: v.patientName,
                    visitType: v.vaccineName || 'Postpartum Follow-up',
                    currentDate: v.visitDateOnly || v.visitDate,
                    scheduledAt: v.raw?.scheduled_at,
                    currentTime: null,
                    station: v.assignedStation || 'Unassigned',
                    rescheduleReason: v.raw?.reschedule_reason || ''
                });
            }
        });

        (vaccinationRescheduleRows || []).forEach(visit => list.push(visit));

        return list;
    }, [visitsTable, postpartumTable, vaccinationRescheduleRows]);

    const filteredEligibleVisits = useMemo(() => {
        const q = rescheduleSearch.toLowerCase();
        return eligibleVisitsToReschedule.filter(visit =>
            (!rescheduleDateFilter || visit.currentDate === rescheduleDateFilter)
            && (!q
                || visit.patientName?.toLowerCase().includes(q)
                || visit.patientId?.toLowerCase().includes(q)
                || visit.visitType?.toLowerCase().includes(q))
        );
    }, [eligibleVisitsToReschedule, rescheduleDateFilter, rescheduleSearch]);

    const openPostpartumVisit = (visit) => {
        navigate(`/dashboard/postpartum/add/${visit.patientId}`, {
            state: { visitId: visit.id, visit }
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

    if (initialLoading) {
        return (
            <StaffPageLoader 
                message="Loading visits & scheduling..." 
                error={initialError} 
                onRetry={() => {
                    setInitialLoading(true);
                    setInitialError(null);
                    fetchData();
                }} 
            />
        );
    }

    return (
        <div className="prenatal-visits-overall staff-page-ready">
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
                        onClick={() => setShowManageModal(true)}
                    >
                        <Plus size={16} /> Manage Visits
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

                                return (
                                    <div key={day.date} className={`day-schedule-card ${day.date === TODAY ? 'day-today' : ''}`}>
                                        <div className="day-schedule-header">
                                            <h3 className="day-schedule-title">
                                                {day.label}
                                                {day.date === TODAY && <span className="today-badge">TODAY</span>}
                                            </h3>
                                            <span className="day-schedule-count">
                                                {dayItems.length} schedule{dayItems.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="day-schedule-list">
                                            {dayItems.map(item => (
                                                <div
                                                    key={item.id}
                                                    className={`schedule-item status-${(item.status || 'scheduled').toLowerCase()} clickable`}
                                                    onClick={(e) => { e.stopPropagation(); setSelectedVisit({ ...item, type: visitTypeTab === 'postpartum' ? 'Postpartum' : 'Prenatal' }); }}
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
                                            {dayItems.length === 0 && <div className="no-schedules">No schedules for this day</div>}
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
                                                            onClick={(e) => { e.stopPropagation(); setSelectedVisit({ ...item, type: visitTypeTab === 'postpartum' ? 'Postpartum' : 'Prenatal' }); }}
                                                        >
                                                            <span className="visit-patient">{item.patientName}</span>
                                                            <span className="visit-status">{visitTypeTab === 'postpartum' ? 'Postpartum' : (item.status || 'Scheduled')}</span>
                                                            <span className="visit-status">Assigned: {item.assignedStaff || 'Unassigned'}</span>
                                                        </div>
                                                    ))}
                                                    {dayItems.length === 0 && (
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
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedVisit({ ...item, type: visitTypeTab === 'postpartum' ? 'Postpartum' : 'Prenatal' }); }}
                                                                >
                                                                    <span className="visit-patient">{item.patientName}</span>
                                                                    <span className="visit-status">{visitTypeTab === 'postpartum' ? 'Postpartum' : (item.status || 'Scheduled')}</span>
                                                                    <span className="visit-status">Assigned: {item.assignedStaff || 'Unassigned'}</span>
                                                                </div>
                                                            ))}
                                                            {dayItems.length === 0 && (
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
                                    <th>Health Conditions</th>
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
                                                <span className={`risk-tag ${visit.hasHealthConditions ? 'risk-high' : 'risk-normal'}`}>
                                                    {visit.hasHealthConditions ? 'Documented Conditions' : 'None Reported'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="visit-date">{formatReadableDate(visit.visitDate)}</span>
                                            </td>
                                            <td onClick={event => event.stopPropagation()}>
                                                <VisitStaffAssignment
                                                    visitId={visit.id}
                                                    visitStationId={visit.assignedStationId}
                                                    assignedStaffId={visit.assignedStaffId}
                                                    assignedStaffName={visit.assignedStaff}
                                                    assignedStationName={visit.assignedStation}
                                                    visitStationName={visit.visitStation}
                                                    visitStatus={visit.status}
                                                    userRole={visitAccess?.role}
                                                    userStationId={visitAccess?.stationId}
                                                    onAssigned={async ({ assignedStaffId, assignedStaffName }) => {
                                                        setToast('Healthcare worker assigned successfully.');
                                                        setTimeout(() => setToast(null), 3000);
                                                        await fetchData();
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${visit.status?.toLowerCase() || 'scheduled'}`}>
                                                    {visit.status}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                                                    <ActionTooltip text="Manage Visit" align="center">
                                                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); setSelectedVisit({ ...visit, type: 'Prenatal' }); }}>Manage Visit</button>
                                                    </ActionTooltip>
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
                                                    <ActionTooltip text="View Details">
                                                        <button className="action-btn-text action-btn-secondary" onClick={() => setSelectedVisit({ ...visit, type: 'Postpartum' })} style={{ padding: '6px 8px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Eye size={14} />
                                                        </button>
                                                    </ActionTooltip>
                                                    <ActionTooltip text="Record Postpartum Visit">
                                                        <button className="action-btn-text action-btn-primary" onClick={() => openPostpartumVisit(visit)}>
                                                            <Plus size={14} /> Record
                                                        </button>
                                                    </ActionTooltip>
                                                    <ActionTooltip text="View Patient Profile">
                                                        <button className="action-btn-text action-btn-accent" onClick={() => navigate(`/dashboard/patients/${visit.patientId}`)}>
                                                            <Users size={14} /> Profile
                                                        </button>
                                                    </ActionTooltip>
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

            {/* ── MANAGE VISITS SELECTION MODAL ── */}
            {showManageModal && (
                <div className="modal-overlay" onClick={() => setShowManageModal(false)}>
                    <div
                        className="modal-content mv-selection-modal"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header mv-modal-header">
                            <div>
                                <h2 className="mv-modal-title">Manage Visits</h2>
                                <p className="mv-modal-desc">Choose whether to create a new appointment or modify an existing schedule.</p>
                            </div>
                            <button
                                type="button"
                                className="mv-modal-close"
                                onClick={() => setShowManageModal(false)}
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="mv-selection-grid">
                            <div
                                className="mv-option-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    setShowManageModal(false);
                                    setAddVisitForm({
                                        visit_category: 'Prenatal',
                                        visit_type: 'emergency',
                                        patient_id: '',
                                        visit_date: new Date().toISOString().split('T')[0],
                                        assigned_staff: '',
                                        assigned_station: visitAccess?.stationId || '',
                                        reason: '',
                                        notes: ''
                                    });
                                    setShowAddVisitModal(true);
                                }}
                            >
                                <div className="mv-option-icon mv-option-icon--schedule">
                                    <CalendarPlus size={24} />
                                </div>
                                <div>
                                    <h3 className="mv-option-title">Schedule a Visit</h3>
                                    <p className="mv-option-desc">Create a new appointment for a patient.</p>
                                </div>
                            </div>

                            {canReschedule && (
                                <div
                                    className="mv-option-card"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        setShowManageModal(false);
                                        setSelectedRescheduleVisitIds([]);
                                        setRescheduleSearch('');
                                        setRescheduleDateFilter('');
                                        setRescheduleResults([]);
                                        setRescheduleForm({ new_date: '', reason: '' });
                                        setShowRescheduleModal(true);
                                    }}
                                >
                                    <div className="mv-option-icon mv-option-icon--reschedule">
                                        <RotateCcw size={24} />
                                    </div>
                                    <div>
                                        <h3 className="mv-option-title">Reschedule Visits</h3>
                                        <p className="mv-option-desc">Update the scheduled date for one or more eligible visits.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── SCHEDULE A VISIT MODAL (Formerly Add Visit) ── */}
            {showAddVisitModal && (
                <div className="modal-overlay" onClick={() => setShowAddVisitModal(false)}>
                    <div
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '600px' }}
                    >
                        <div className="modal-header">
                            <h2>Schedule a Visit</h2>
                            <p>Schedule an appointment or checkup for a patient.</p>
                        </div>
                        <form onSubmit={handleAddVisitSubmit}>
                            <div className="modal-body" style={{ padding: '24px 32px' }}>
                                
                                {/* SECTION 1: Visit Information */}
                                <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #eee' }}>
                                    <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '16px', letterSpacing: '0.5px' }}>Visit Information</h4>
                                    
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label>Type of Visit <span style={{ color: '#e05c73' }}>*</span></label>
                                        <select
                                            required
                                            value={addVisitForm.visit_category}
                                            onChange={e => {
                                                const category = e.target.value;
                                                const currentPatient = allPatients.find(patient => patient.id === addVisitForm.patient_id);
                                                const remainsEligible = category === 'Postpartum'
                                                    ? currentPatient?.hasDelivery
                                                    : currentPatient && !currentPatient.hasDelivery
                                                        && String(currentPatient.pregnancyStatus).toLowerCase() === 'pregnant';
                                                setAddVisitForm({
                                                    ...addVisitForm,
                                                    visit_category: category,
                                                    patient_id: remainsEligible ? addVisitForm.patient_id : '',
                                                    assigned_station: remainsEligible
                                                        ? addVisitForm.assigned_station
                                                        : visitAccess?.stationId || '',
                                                    assigned_staff: ''
                                                });
                                                setAssignmentStaff([]);
                                            }}
                                            className="form-control"
                                        >
                                            <option value="Prenatal">Prenatal</option>
                                            <option value="Postpartum">Postpartum</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Visit Classification <span style={{ color: '#e05c73' }}>*</span></label>
                                        <select
                                            required
                                            value={addVisitForm.visit_type}
                                            onChange={e => setAddVisitForm({ ...addVisitForm, visit_type: e.target.value })}
                                            className="form-control"
                                        >
                                            <option value="emergency">Emergency Visit</option>
                                            <option value="follow_up">Follow-up Visit</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Patient <span style={{ color: '#e05c73' }}>*</span></label>
                                        <SearchableDropdown
                                            patients={patientsForVisitCategory}
                                            value={addVisitForm.patient_id}
                                            onChange={val => {
                                                const selected = patientsForVisitCategory.find(patient => patient.id === val);
                                                const visitCategory = selected
                                                    ? selected.hasDelivery ? 'Postpartum' : 'Prenatal'
                                                    : addVisitForm.visit_category;
                                                setAddVisitForm({
                                                    ...addVisitForm,
                                                    patient_id: val,
                                                    visit_category: visitCategory,
                                                    assigned_station: selected?.delivery?.station_ass
                                                        || selected?.stationId
                                                        || addVisitForm.assigned_station,
                                                    assigned_staff: ''
                                                });
                                                setAssignmentStaff([]);
                                            }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Visit Date <span style={{ color: '#e05c73' }}>*</span></label>
                                        <input
                                            type="date"
                                            required
                                            value={addVisitForm.visit_date}
                                            onChange={e => setAddVisitForm({ ...addVisitForm, visit_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* SECTION 2: Assignment */}
                                <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #eee' }}>
                                    <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '16px', letterSpacing: '0.5px' }}>Assignment</h4>
                                    
                                    <div className="form-group">
                                        <label>Assigned Station <span style={{ color: '#e05c73' }}>*</span></label>
                                        <select
                                            required
                                            value={addVisitForm.assigned_station}
                                            onChange={event => {
                                                setAddVisitForm({
                                                    ...addVisitForm,
                                                    assigned_station: event.target.value,
                                                    assigned_staff: ''
                                                });
                                                setAssignmentStaff([]);
                                            }}
                                            className="form-control"
                                        >
                                            <option value="">Select assigned station</option>
                                            {assignmentStations.map(station => (
                                                <option key={station.id} value={station.id}>{station.station_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Assigned Healthcare Staff</label>
                                        <select
                                            value={addVisitForm.assigned_staff}
                                            onChange={event => setAddVisitForm({ ...addVisitForm, assigned_staff: event.target.value })}
                                            disabled={!addVisitForm.assigned_station
                                                || loadingAssignmentStaff
                                                || (visitAccess?.role !== 'admin' && addVisitForm.assigned_station !== visitAccess?.stationId)
                                                || assignableVisitStaff.length === 0}
                                            className="form-control"
                                        >
                                            <option value="">
                                                {loadingAssignmentStaff
                                                    ? 'Loading staff for station...'
                                                    : addVisitForm.assigned_station && visitAccess?.role !== 'admin' && addVisitForm.assigned_station !== visitAccess?.stationId
                                                        ? 'Workers can only be assigned at your own station'
                                                        : 'Select healthcare staff (optional)'}
                                            </option>
                                            {assignableVisitStaff.map(staff => (
                                                <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                                            ))}
                                        </select>
                                        {visitAccess?.role !== 'admin'
                                            && addVisitForm.assigned_station
                                            && addVisitForm.assigned_station !== visitAccess?.stationId && (
                                            <small style={{ display: 'block', marginTop: 6, color: '#a16207' }}>
                                                You selected a different station. A healthcare worker cannot be assigned by staff or CHO personnel.
                                            </small>
                                        )}
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
                                            placeholder="e.g. Routine checkup or abdominal pain"
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

            {/* ── RESCHEDULE A VISIT MODAL ── */}
            {showRescheduleModal && (
                <div className="modal-overlay" onClick={() => !isRescheduling && setShowRescheduleModal(false)}>
                    <div
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '760px' }}
                    >
                        <div className="modal-header">
                            <h2>Reschedule Visits</h2>
                            <p>Select scheduled visits across patients and visit types, then apply a common new date.</p>
                        </div>
                        <form onSubmit={handleConfirmReschedule}>
                            <div className="modal-body" style={{ padding: '24px 32px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                                    <label className="form-group">
                                        Filter by current visit date
                                        <input
                                            type="date"
                                            value={rescheduleDateFilter}
                                            onChange={event => setRescheduleDateFilter(event.target.value)}
                                        />
                                    </label>
                                    <label className="form-group">
                                        Search patient or visit
                                        <input
                                            type="search"
                                            placeholder="Patient name, ID, or visit type"
                                            value={rescheduleSearch}
                                            onChange={event => setRescheduleSearch(event.target.value)}
                                        />
                                    </label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    <input
                                        type="checkbox"
                                        aria-label="Select all filtered visits"
                                        checked={filteredEligibleVisits.length > 0 && filteredEligibleVisits.every(visit => selectedRescheduleVisitIds.includes(visit.key))}
                                        onChange={event => {
                                            const filteredKeys = filteredEligibleVisits.map(visit => visit.key);
                                            setSelectedRescheduleVisitIds(current => event.target.checked
                                                ? [...new Set([...current, ...filteredKeys])]
                                                : current.filter(key => !filteredKeys.includes(key)));
                                        }}
                                    />
                                    <span>Select all {filteredEligibleVisits.length} filtered visits</span>
                                    <span style={{ marginLeft: 'auto' }}>{selectedRescheduleVisitIds.length} selected</span>
                                </div>
                                <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1.5px solid #eee', borderRadius: '12px', background: '#fff' }}>
                                    {filteredEligibleVisits.length ? filteredEligibleVisits.map(visit => (
                                        <label
                                            key={visit.key}
                                            style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 14px', borderBottom: '1px solid #f1f3f7', cursor: 'pointer' }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedRescheduleVisitIds.includes(visit.key)}
                                                disabled={isRescheduling || rescheduleResults.length > 0}
                                                onChange={event => setSelectedRescheduleVisitIds(current => event.target.checked
                                                    ? [...current, visit.key]
                                                    : current.filter(key => key !== visit.key))}
                                            />
                                            <span style={{ flex: 1 }}>
                                                <span style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                                    <strong>{visit.patientName}</strong>
                                                    <strong style={{ fontSize: '12px', color: '#7a4fa8' }}>{visit.visitType}</strong>
                                                </span>
                                                <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                                    Current date: {formatReadableDate(visit.currentDate)}{visit.rescheduleReason ? ` · Previous reason: ${visit.rescheduleReason}` : ''}
                                                </span>
                                            </span>
                                        </label>
                                    )) : (
                                        <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                                            No eligible scheduled appointments match these filters.
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: '20px', paddingBottom: '18px', borderBottom: '1px solid #eee' }}>
                                    <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '12px' }}>
                                        New schedule
                                    </h4>
                                    <label className="form-group">
                                        Common new visit date <span style={{ color: '#e05c73' }}>*</span>
                                        <input
                                            type="date"
                                            required
                                            min={toLocalDateStr(new Date())}
                                            value={rescheduleForm.new_date}
                                            disabled={isRescheduling || rescheduleResults.length > 0}
                                            onChange={event => setRescheduleForm({ ...rescheduleForm, new_date: event.target.value })}
                                        />
                                    </label>
                                    <label className="form-group" style={{ marginTop: '12px' }}>
                                        Reason for rescheduling (optional; applied to all selected visits)
                                        <textarea
                                            rows={2}
                                            maxLength={1000}
                                            value={rescheduleForm.reason}
                                            disabled={isRescheduling || rescheduleResults.length > 0}
                                            onChange={event => setRescheduleForm({ ...rescheduleForm, reason: event.target.value })}
                                            placeholder="Reason for changing these visit dates"
                                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', resize: 'vertical' }}
                                        />
                                    </label>
                                </div>

                                {selectedRescheduleVisitIds.length > 0 && (
                                    <div style={{ marginTop: '18px' }}>
                                        <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: '700', marginBottom: '10px' }}>
                                            Review before confirming
                                        </h4>
                                        {selectedRescheduleVisitIds.map(key => {
                                            const visit = eligibleVisitsToReschedule.find(item => item.key === key);
                                            return visit ? (
                                                <div key={key} style={{ padding: '8px 0', borderBottom: '1px solid #f1f3f7', fontSize: '13px' }}>
                                                    <strong>{visit.patientName}</strong> · {visit.visitType}: {formatReadableDate(visit.currentDate)} → {rescheduleForm.new_date ? formatReadableDate(rescheduleForm.new_date) : 'Choose a new date'}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                )}

                                {rescheduleResults.length > 0 && (
                                    <div role="status" style={{ marginTop: '18px' }}>
                                        <h4>Rescheduling results</h4>
                                        {rescheduleResults.map(result => (
                                            <div key={result.key} style={{ padding: '8px 0', borderBottom: '1px solid #f1f3f7', color: result.status === 'failed' ? '#b42318' : result.message.includes('Email notification failed') ? '#956c00' : '#287a48', fontSize: '13px' }}>
                                                <strong>{result.patientName}</strong> · {result.visitType}: {result.message}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    disabled={isRescheduling}
                                    onClick={() => {
                                        setShowRescheduleModal(false);
                                        setSelectedRescheduleVisitIds([]);
                                    }}
                                >
                                    {rescheduleResults.length ? 'Done' : 'Cancel'}
                                </button>
                                {rescheduleResults.length === 0 && (
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={isRescheduling || !canReschedule || selectedRescheduleVisitIds.length === 0}
                                    >
                                        {isRescheduling ? 'Rescheduling...' : 'Confirm Rescheduling'}
                                    </button>
                                )}
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
                    onScheduleChanged={fetchData}
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
