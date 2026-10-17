import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import { useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Search, Filter, Plus, ChevronLeft, ChevronRight, ChevronDown, Check,
    Eye, Edit, Archive, ArchiveRestore, Activity, CalendarPlus, Calendar,
    FileText, User, Users, MapPin, Clock, AlertTriangle,
    X, CheckCircle2, Info
} from 'lucide-react';
import '../../styles/components/SharedFilters.css';
import '../../styles/pages/PatientsList.css';
import PatientService from '../../services/patientservice';
import EditPatientModal from '../../components/Patient/EditPatientModal';
import PatientStaffAssignment from '../../components/Patient/PatientStaffAssignment';
import { useModal } from '../../context/ModalContext';
import { useRolePermissions } from '../../context/RolePermissionContext';
import Legend from '../../components/Legend/Legend';
import { formatMotherId } from '../../utils/displayIds';
import ExportModal from '../../components/ExportModal';
import ActionTooltip from '../../components/Common/ActionTooltip';
import StaffPageLoader from '../../components/Common/StaffPageLoader';
import { exportStandardStaffPdf } from '../../utils/staffPdfTemplate';

// Helper function to extract first 4 numeric digits from patient ID
const getShortPatientId = (id) => {
    return formatMotherId(id);
};

// Helper function to format station names in Title Case
const toTitleCase = (str) => {
    if (!str) return '';
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

// Helper functions for Health Conditions display and classes
const formatConditionDisplay = (patient) => {
    if (!patient) return 'None Reported';
    return patient.hasHealthConditions ? 'With Health Conditions' : 'None Reported';
};

const getConditionClass = (patient) => {
    if (!patient) return 'condition-none';
    return patient.hasHealthConditions ? 'condition-present' : 'condition-none';
};

const getCategoryTheme = (category) => {
    const lower = String(category || '').toLowerCase();
    if (lower.includes('pre-existing') || lower.includes('preexisting')) return 'pre-existing';
    if (lower.includes('pregnancy-related') || lower.includes('pregnancy related')) return 'pregnancy-related';
    if (lower.includes('obstetric') || lower.includes('history')) return 'obstetric-history';
    return 'pre-existing';
};

const getPhilippineDate = () => {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    } catch {
        return new Date().toISOString().split('T')[0];
    }
};

const getEmptyVitals = () => ({
    bpSystolic: '',
    bpDiastolic: '',
    weight: '',
    temp: '',
    pulse: '',
    respRate: '',
    fundalHeight: '',
    fhr: '',
    fetalMovement: '',
    presentation: '',
    notes: '',
    date: getPhilippineDate(),
});

const RecordVitalsModal = ({ patient, onSave, onClose }) => {
    const [form, setForm] = useState(getEmptyVitals);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.bpSystolic || !form.bpDiastolic || !form.weight || !form.date) return;
        onSave(patient.id, { ...form, patientName: patient.name });
    };

    return createPortal(
        <div className="pv-modal-overlay" onClick={onClose}>
            <div className="pv-modal" onClick={e => e.stopPropagation()}>
                <div className="pv-modal-header">
                    <div>
                        <h2 className="pv-modal-title">Record Vital Signs</h2>
                        <p className="pv-modal-sub">{patient.name} &middot; {getShortPatientId(patient.id)}</p>
                    </div>
                    <button className="pv-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form className="pv-modal-body" onSubmit={handleSubmit}>
                    <div className="vm-grid">
                        <div className="vm-field">
                            <label className="vm-label">Blood Pressure Systolic <span className="vm-req">*</span></label>
                            <input className="vm-input" type="number" value={form.bpSystolic} onChange={e => set('bpSystolic', e.target.value)} required />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Blood Pressure Diastolic <span className="vm-req">*</span></label>
                            <input className="vm-input" type="number" value={form.bpDiastolic} onChange={e => set('bpDiastolic', e.target.value)} required />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Weight (kg) <span className="vm-req">*</span></label>
                            <input className="vm-input" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} required />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Body Temperature (°C)</label>
                            <input className="vm-input" type="number" step="0.1" value={form.temp} onChange={e => set('temp', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Pulse (bpm)</label>
                            <input className="vm-input" type="number" value={form.pulse} onChange={e => set('pulse', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Respiratory Rate (cpm)</label>
                            <input className="vm-input" type="number" value={form.respRate} onChange={e => set('respRate', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Fundal Height (cm)</label>
                            <input className="vm-input" type="number" step="0.1" value={form.fundalHeight} onChange={e => set('fundalHeight', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Fetal Heart Rate (bpm)</label>
                            <input className="vm-input" type="number" value={form.fhr} onChange={e => set('fhr', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Fetal Movement</label>
                            <input className="vm-input" value={form.fetalMovement} onChange={e => set('fetalMovement', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Presentation</label>
                            <input className="vm-input" value={form.presentation} onChange={e => set('presentation', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Date <span className="vm-req">*</span></label>
                            <input className="vm-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
                        </div>
                    </div>

                    <div className="vm-field vm-field--full">
                        <label className="vm-label">Clinical Notes</label>
                        <textarea className="vm-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
                    </div>



                    <div className="pv-modal-footer">
                        <button type="button" className="vm-btn vm-btn--cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="vm-btn vm-btn--save"><CheckCircle2 size={15} /> Save</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

const PatientsList = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialTrimester = searchParams.get('trimester');
    
    const { alert: customAlert, confirm } = useModal();
    const { hasPermission } = useRolePermissions();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [patients, setPatients] = useState([]);
    const [availableStations, setAvailableStations] = useState([]);
    const [assignmentAccess, setAssignmentAccess] = useState({ role: '', stationId: null });
    const [defaultApplied, setDefaultApplied] = useState(false);

    const hasPatientStationPermission = (patient, ownPermission, otherPermission) => (
        patient.stationId != null && patient.stationId === assignmentAccess.stationId
            ? hasPermission(ownPermission)
            : hasPermission(otherPermission)
    );
    const canChangeArchiveState = (patient) => hasPatientStationPermission(
        patient,
        'patient.archive.own_station',
        'patient.archive.other_station'
    );

    const [searchTerm, setSearchTerm] = useState('');

    const { settings } = useSystemSettings();
    const itemsPerPage = settings?.tables?.rowsPerPage || 10;

    const [archiveFilter, setArchiveFilter] = useState(() => {
        const defaultView = settings?.tables?.defaultPatientView || 'Active Patients';
        return defaultView === 'All Patients' ? 'all' : 'active';
    });
    const [filters, setFilters] = useState({
        trimesters: initialTrimester ? [initialTrimester] : [],
        risks: [],
        stations: [],
        assignmentStatus: 'All',
        patientType: 'All',
        sortBy: 'newest'
    });
    
    const [activePopover, setActivePopover] = useState(null);
    const [stationSearch, setStationSearch] = useState('');

    // Date filter state
    const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'this_month' | 'this_year' | 'custom'
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [dateFilterError, setDateFilterError] = useState('');
    
    useEffect(() => {
        const handleScroll = () => {
            const controls = document.querySelector('.controls-card');
            if (controls) {
                if (window.scrollY > 120) controls.classList.add('sticky');
                else controls.classList.remove('sticky');
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activePopover) {
                const popoverElement = document.querySelector('.filter-popover');
                const buttonElement = event.target.closest('.filter-btn');
                
                // Close if click is outside both the popover and its trigger button
                if (popoverElement && !popoverElement.contains(event.target) && !buttonElement) {
                    setActivePopover(null);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [activePopover]);

    const [currentPage, setCurrentPage] = useState(1);
    const [conditionPopover, setConditionPopover] = useState(null);

    useEffect(() => {
        if (!conditionPopover) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('.conditions-popover-card') && !e.target.closest('.condition-more-btn')) {
                setConditionPopover(null);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setConditionPopover(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [conditionPopover]);

    const handleOpenConditionPopover = (e, patient) => {
        e.stopPropagation();
        if (conditionPopover && conditionPopover.patient?.id === patient.id) {
            setConditionPopover(null);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const popoverWidth = 320;
        const popoverEstimatedHeight = 260;
        let top = rect.bottom + 6;
        if (top + popoverEstimatedHeight > window.innerHeight && rect.top - popoverEstimatedHeight > 10) {
            top = rect.top - popoverEstimatedHeight - 6;
        }
        let left = rect.left;
        if (left + popoverWidth > window.innerWidth - 16) {
            left = window.innerWidth - popoverWidth - 16;
        }
        if (left < 16) left = 16;

        setConditionPopover({
            patient,
            top,
            left
        });
    };

    const [vitalModalPatient, setVitalModalPatient] = useState(null);
    const [vitalToast, setVitalToast] = useState(false);
    const [editModalPatient, setEditModalPatient] = useState(null);
    const [modalLoading, setModalLoading] = useState({ edit: false, vitals: false });

    const openEditModal = async (patientId) => {
        setEditModalPatient(null);
        setModalLoading(prev => ({ ...prev, edit: true }));
        try {
            const patientService = new PatientService();
            const detailedPatient = await patientService.getPatientById(patientId);
            setEditModalPatient(detailedPatient);
        } catch (err) {
            console.error('Error loading patient details for edit:', err);
            await customAlert({ title: 'Error', text: 'Unable to load patient details. Please try again.', iconType: 'danger' });
        } finally {
            setModalLoading(prev => ({ ...prev, edit: false }));
        }
    };

    const openVitalsModal = (patientOrId) => {
        if (!patientOrId) return;
        if (typeof patientOrId === 'object') {
            setVitalModalPatient(patientOrId);
        } else {
            const found = patients.find(p => p.id === patientOrId);
            setVitalModalPatient(found || { id: patientOrId, name: 'Patient' });
        }
    };

    const loadInitialData = async () => {
        setLoading(true);
        setError(null);
        try {
            const patientService = new PatientService();
            const [data, access, stns] = await Promise.all([
                patientService.getAllPatients({ includeArchived: true }),
                patientService.getCurrentUserAccess(),
                patientService.getAllStations()
            ]);
            setPatients(data || []);
            setAssignmentAccess(access || { role: '', stationId: null });
            setAvailableStations(stns || []);
        } catch (err) {
            console.error('Failed to load patient profiles:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (!defaultApplied && availableStations.length > 0 && assignmentAccess.role) {
            if (assignmentAccess.role === 'staff' && assignmentAccess.stationId) {
                const assignedStation = availableStations.find(s => s.id === assignmentAccess.stationId);
                if (assignedStation) {
                    setFilters(prev => ({ ...prev, stations: [assignedStation.station_name] }));
                }
            }
            setDefaultApplied(true);
        }
    }, [availableStations, assignmentAccess, defaultApplied]);

    const filterDate = new Date();
    const filterYear = filterDate.getFullYear();
    const filterMonth = filterDate.getMonth();
    const normalizedSearch = searchTerm.toLowerCase();
    const filteredPatients = useMemo(() => patients.filter(p => {
        const conditionMatches = (p.activeCategories || []).some(cat => 
            cat.category.toLowerCase().includes(normalizedSearch) ||
            cat.conditions.some(cond => cond.toLowerCase().includes(normalizedSearch))
        ) || (p.documentedConditions || []).some(c => c.toLowerCase().includes(normalizedSearch));

        const matchesSearch =
            p.name.toLowerCase().includes(normalizedSearch) ||
            p.id.toLowerCase().includes(normalizedSearch) ||
            (p.station || '').toLowerCase().includes(normalizedSearch) ||
            conditionMatches;

        const matchesTri = filters.trimesters.length === 0 || filters.trimesters.includes(String(p.trimester || 1));
        
        const matchesRisk = filters.risks.length === 0 || (
            filters.risks.includes('with_conditions') && p.hasHealthConditions
        ) || (
            filters.risks.includes('none') && !p.hasHealthConditions
        );
        const matchesType = filters.patientType === 'All' || (p.patientType || p.type) === filters.patientType;
        const matchesStation = filters.stations.length === 0 || filters.stations.includes(p.station);
        const matchesAssignment = filters.assignmentStatus === 'All'
            || (filters.assignmentStatus === 'Unassigned' ? !p.assignedStaffId : Boolean(p.assignedStaffId));
        
        const isArchived = (p.archiveStatus || 'active') === 'archived';
        const matchesArchive = archiveFilter === 'all'
            ? true
            : archiveFilter === 'archived'
                ? isArchived
                : !isArchived;

        // Date filter using createdAt
        let matchesDate = true;
        if (dateFilter !== 'all') {
            const created = p.createdAt ? new Date(p.createdAt) : null;
            if (!created) {
                matchesDate = false;
            } else {
                if (dateFilter === 'this_month') {
                    matchesDate = created.getMonth() === filterMonth && created.getFullYear() === filterYear;
                } else if (dateFilter === 'this_year') {
                    matchesDate = created.getFullYear() === filterYear;
                } else if (dateFilter === 'custom' && customDateFrom && customDateTo) {
                    const from = new Date(`${customDateFrom}T00:00:00`);
                    const to = new Date(`${customDateTo}T23:59:59.999`);
                    matchesDate = created >= from && created <= to;
                }
            }
        }

        return matchesSearch && matchesTri && matchesRisk && matchesType && matchesStation && matchesAssignment && matchesArchive && matchesDate;
    }), [patients, normalizedSearch, filters, archiveFilter, dateFilter, customDateFrom, customDateTo, filterYear, filterMonth]);

    const sortedPatients = useMemo(() => [...filteredPatients].sort((a, b) => {
        if (filters.sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (filters.sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (filters.sortBy === 'alpha_az') return a.name.localeCompare(b.name);
        if (filters.sortBy === 'alpha_za') return b.name.localeCompare(a.name);
        
        if (filters.sortBy === 'nearest_edd') {
            if (!a.edd) return 1;
            if (!b.edd) return -1;
            return new Date(a.edd) - new Date(b.edd);
        }
        if (filters.sortBy === 'farthest_edd') {
            if (!a.edd) return 1;
            if (!b.edd) return -1;
            return new Date(b.edd) - new Date(a.edd);
        }
        return 0;
    }), [filteredPatients, filters.sortBy]);

    // availableStations fetched dynamically from DB

    const totalPages = Math.ceil(sortedPatients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPatients = sortedPatients.slice(startIndex, startIndex + itemsPerPage);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const toggleArrayFilter = (field, value) => {
        setFilters(prev => {
            const current = [...prev[field]];
            const updated = current.includes(value) 
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [field]: updated };
        });
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ trimesters: [], risks: [], stations: [], assignmentStatus: 'All', patientType: 'All', sortBy: 'newest' });
        setArchiveFilter('active');
        setDateFilter('all');
        setCustomDateFrom('');
        setCustomDateTo('');
        setDateFilterError('');
        setSearchTerm('');
        setCurrentPage(1);
        setActivePopover(null);
        // Clear query parameters from URL so a fresh reload doesn't re-apply the cleared filter
        if (searchParams.has('trimester')) navigate('/dashboard/patients', { replace: true });
    };

    const dateFilterLabel = dateFilter === 'this_month' ? 'This Month' : dateFilter === 'this_year' ? 'This Year' : dateFilter === 'custom' ? 'Custom' : 'All';

    const hasActiveFilters = filters.trimesters.length > 0 || filters.risks.length > 0 || filters.stations.length > 0 || filters.sortBy !== 'newest' || archiveFilter !== 'all' || dateFilter !== 'all';

    const [showExportModal, setShowExportModal] = useState(false);

    const handleExport = async (exportConfig) => {
        const { format, dateRange, reportPeriodText } = exportConfig;

        // Filter by date range using createdAt
        let dataToExport = sortedPatients;
        if (dateRange && dateRange.from && dateRange.to) {
            dataToExport = sortedPatients.filter(p => {
                const created = p.createdAt ? new Date(p.createdAt) : null;
                if (!created) return false;
                return created >= dateRange.from && created <= dateRange.to;
            });
        }

        const exportData = dataToExport.map(p => ({
            'Patient ID': formatMotherId(p.id),
            'Name': p.name || '',
            'Type': p.patientType || p.type || 'Mother',
            'Station': p.station || 'Unassigned',
            'Age': p.age || 'N/A',
            'Gestation': p.weeks ? `${p.weeks} weeks (T${p.trimester || 1})` : 'N/A',
            'Health Conditions': (p.activeCategories && p.activeCategories.length > 0)
                ? p.activeCategories.map(cat => `${cat.category}: ${cat.conditions.join(', ')}`).join('; ')
                : (p.documentedConditions && p.documentedConditions.length > 0
                    ? p.documentedConditions.join(', ')
                    : 'None Reported'),
            'Total Visits': p.totalVisits || 0,
            'Next Appointment': p.nextAppt || 'No upcoming appt'
        }));

        if (format === 'excel') {
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Patient Profiles');
            XLSX.writeFile(workbook, `patient_profiles_${reportPeriodText || 'all'}.xlsx`);
        } else if (format === 'pdf') {
            try {
                const tableColumn = ["Patient ID", "Name", "Type", "Station", "Age", "Gestation", "Health Conditions", "Total Visits", "Next Appt"];
                const tableRows = exportData.map(obj => [
                    obj['Patient ID'],
                    obj['Name'],
                    obj['Type'],
                    obj['Station'],
                    obj['Age'],
                    obj['Gestation'],
                    obj['Health Conditions'],
                    obj['Total Visits'],
                    obj['Next Appointment']
                ]);

                const stationText = filters.stations && filters.stations.length > 0 ? filters.stations.join(', ') : 'All Stations';

                exportStandardStaffPdf({
                    orientation: 'landscape',
                    title: 'Patient Profiles Masterlist',
                    period: reportPeriodText || 'All Dates',
                    station: stationText,
                    totalRecords: exportData.length,
                    columns: tableColumn,
                    rows: tableRows,
                    filename: `patient_profiles_${reportPeriodText || 'all'}.pdf`
                });
            } catch (error) {
                console.error("Error generating PDF:", error);
                await customAlert({ title: 'Error', text: 'Unable to generate PDF right now.', iconType: 'danger' });
            }
        }
    };

    const handleSaveVitals = async (patientId, record) => {
        try {
            const patientService = new PatientService();
            await patientService.recordVitals(patientId, record);
            setVitalModalPatient(null);
            setVitalToast(true);
            setTimeout(() => setVitalToast(false), 3500);
            loadInitialData();
        } catch (err) {
            console.error('Error saving vitals:', err);
            await customAlert({ title: 'Error', text: 'Error saving vitals: ' + err.message, iconType: 'danger' });
        }
    };

    const handlePatientUpdate = (updatedPatient) => {
        setPatients(prevPatients => 
            prevPatients.map(p => {
                if (p.id !== updatedPatient.id) return p;

                const merged = {
                    ...p,
                    ...updatedPatient,
                    name: `${updatedPatient.first_name || p.first_name || ''} ${updatedPatient.last_name || p.last_name || ''}`.trim(),
                    station: updatedPatient.barangay || updatedPatient.municipality || p.station,
                    age: updatedPatient.date_of_birth
                        ? Math.floor((new Date() - new Date(updatedPatient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
                        : p.age,
                    nextAppt: updatedPatient.nextAppt ?? p.nextAppt,
                };

                return merged;
            })
        );
    };

    const handleArchive = async (patientId) => {
        const isConfirmed = await confirm({
            title: 'Archive Patient',
            text: 'Are you sure you want to archive this patient? It will be removed from active lists but can be restored.',
            confirmText: 'Yes, Archive',
            cancelText: 'Cancel',
            iconType: 'archive'
        });

        if (isConfirmed) {
            try {
                const patientService = new PatientService();
                await patientService.archivePatient(patientId);
                setPatients(prevPatients => 
                    prevPatients.map(p => p.id === patientId ? { ...p, archiveStatus: 'archived' } : p)
                );
            } catch (err) {
                console.error('Error archiving patient:', err);
                await customAlert({ title: 'Error', text: 'Unable to archive patient right now.', iconType: 'danger' });
            }
        }
    };

    const handleRestore = async (patientId) => {
        const isConfirmed = await confirm({
            title: 'Restore Patient',
            text: 'Are you sure you want to restore this patient? It will be moved back to active lists.',
            confirmText: 'Yes, Restore',
            cancelText: 'Cancel',
            iconType: 'info'
        });

        if (isConfirmed) {
            try {
                const patientService = new PatientService();
                await patientService.restorePatient(patientId);
                setPatients(prevPatients => 
                    prevPatients.map(p => p.id === patientId ? { ...p, archiveStatus: 'active' } : p)
                );
            } catch (err) {
                console.error('Error restoring patient:', err);
                await customAlert({ title: 'Error', text: 'Unable to restore patient right now.', iconType: 'danger' });
            }
        }
    };

    if (loading) {
        return (
            <StaffPageLoader 
                message="Loading patient profiles..." 
                error={error} 
                onRetry={loadInitialData} 
            />
        );
    }

    return (
        <>
        <div className="patients-page staff-page-ready">

            <div className="page-header">
                <div>
                    <div className="page-title-row">
                        <h1 className="page-title">Patient Profiles</h1>
                        <span className="title-statistic-badge">
                            Total Patients: <strong>{filteredPatients.length}</strong>
                        </span>
                    </div>
                    <p className="page-subtitle">Manage and monitor all registered pregnant patients, including archived records.</p>
                </div>
                <div className="header-actions">
                        <button className="btn btn-outline" onClick={() => setShowExportModal(true)}>
                            <FileText size={16} />
                            Export
                        </button>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard/patients/add')}>
                        <Plus size={16} />
                        Register Pregnancy
                    </button>
                </div>
            </div>

            <div className="shared-controls-card">
                {/* Row 1: Search */}
                <div className="shared-search-wrap">
                    <Search className="shared-search-icon" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, ID, or station..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="shared-search-input"
                    />
                </div>

                {/* Row 2: Filters */}
                <div className="shared-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <label className="patient-assignment-filter">
                        <span>Health worker</span>
                        <select
                            value={filters.assignmentStatus}
                            onChange={event => setFilters(previous => ({ ...previous, assignmentStatus: event.target.value }))}
                            aria-label="Filter by health worker assignment"
                        >
                            <option value="All">All</option>
                            <option value="Unassigned">Unassigned</option>
                            <option value="Assigned">Assigned</option>
                        </select>
                    </label>
                    
                    {/* Pregnancy Details Popover */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${(filters.trimesters.length > 0 || filters.risks.length > 0) ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'pregnancy' ? null : 'pregnancy')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Activity size={14} className="filter-btn-icon" /> 
                            <span>Pregnancy Details</span>
                            {(filters.trimesters.length + filters.risks.length) > 0 && <span className="filter-badge">{filters.trimesters.length + filters.risks.length}</span>}
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        
                        {activePopover === 'pregnancy' && (
                            <div className="filter-popover">
                                <div className="popover-title">Trimester</div>
                                <div className="popover-options">
                                    {['1', '2', '3'].map(tri => (
                                        <label key={tri} className="popover-checkbox-label">
                                            <input type="checkbox" checked={filters.trimesters.includes(tri)} onChange={() => toggleArrayFilter('trimesters', tri)} />
                                            {tri}{tri === '1' ? 'st' : tri === '2' ? 'nd' : 'rd'} Trimester
                                        </label>
                                    ))}
                                </div>
                                
                                <div className="popover-title" style={{ marginTop: '12px' }}>Health Conditions</div>
                                <div className="popover-options">
                                    {[
                                        { id: 'with_conditions', label: 'With Health Conditions' },
                                        { id: 'none', label: 'None Reported' }
                                    ].map(item => (
                                        <label key={item.id} className="popover-checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                checked={filters.risks.includes(item.id)} 
                                                onChange={() => toggleArrayFilter('risks', item.id)} 
                                            />
                                            {item.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Station Popover */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${filters.stations.length > 0 ? 'active-filter' : ''}`}
                            onClick={() => {
                                setActivePopover(activePopover === 'station' ? null : 'station');
                                setStationSearch('');
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <MapPin size={14} className="filter-btn-icon" /> 
                            <span>
                                {filters.stations.length === 0 
                                    ? 'All Stations' 
                                    : filters.stations.length === 1 
                                        ? filters.stations[0] 
                                        : `${filters.stations.length} Stations`}
                            </span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        
                        {activePopover === 'station' && (
                            <div className="filter-popover">
                                <div className="popover-title">Station</div>
                                <input 
                                    type="text" 
                                    placeholder="Search stations..." 
                                    className="popover-search"
                                    value={stationSearch}
                                    onChange={(e) => setStationSearch(e.target.value)}
                                    autoFocus
                                />
                                <div className="popover-options">
                                    {availableStations
                                        .filter(s => s.toLowerCase().includes(stationSearch.toLowerCase()))
                                        .map(station => (
                                            <label key={station} className="popover-checkbox-label">
                                                <input type="checkbox" checked={filters.stations.includes(station)} onChange={() => toggleArrayFilter('stations', station)} />
                                                {station}
                                            </label>
                                        ))}
                                    {availableStations.filter(s => s.toLowerCase().includes(stationSearch.toLowerCase())).length === 0 && (
                                        <div className="popover-empty">No stations found</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>



                    {/* Archive Filter */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${archiveFilter !== 'all' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'archive' ? null : 'archive')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Archive size={14} className="filter-btn-icon" /> 
                            <span>{archiveFilter === 'active' ? 'Active' : archiveFilter === 'archived' ? 'Archived' : 'All'}</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        
                        {activePopover === 'archive' && (
                            <div className="filter-popover">
                                <div className="popover-title">Status</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${archiveFilter === 'active' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('active'); setActivePopover(null); setCurrentPage(1); }}>Active</button>
                                    <button className={`popover-opt-btn ${archiveFilter === 'archived' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('archived'); setActivePopover(null); setCurrentPage(1); }}>Archived</button>
                                    <button className={`popover-opt-btn ${archiveFilter === 'all' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('all'); setActivePopover(null); setCurrentPage(1); }}>All</button>
                                </div>
                            </div>
                        )}
                    </div>



                    {/* Date Filter Popover */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${dateFilter !== 'all' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'date' ? null : 'date')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Calendar size={14} className="filter-btn-icon" /> 
                            <span>Date: {dateFilterLabel}</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        
                        {activePopover === 'date' && (
                            <div className="filter-popover" style={{ minWidth: '240px' }}>
                                <div className="popover-title">Registration Date</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${dateFilter === 'all' ? 'selected' : ''}`} onClick={() => { setDateFilter('all'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); setCurrentPage(1); }}>All Time</button>
                                    <button className={`popover-opt-btn ${dateFilter === 'this_month' ? 'selected' : ''}`} onClick={() => { setDateFilter('this_month'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); setCurrentPage(1); }}>This Month</button>
                                    <button className={`popover-opt-btn ${dateFilter === 'this_year' ? 'selected' : ''}`} onClick={() => { setDateFilter('this_year'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); setCurrentPage(1); }}>This Year</button>
                                    <button className={`popover-opt-btn ${dateFilter === 'custom' ? 'selected' : ''}`} onClick={() => { setDateFilter('custom'); setDateFilterError(''); }}>Custom Range</button>
                                </div>
                                {dateFilter === 'custom' && (
                                    <div className="date-custom-range-section">
                                        <div className="date-custom-range-fields">
                                            <div className="date-custom-field">
                                                <label>From</label>
                                                <input type="date" value={customDateFrom} onChange={e => { setCustomDateFrom(e.target.value); setDateFilterError(''); }} />
                                            </div>
                                            <div className="date-custom-field">
                                                <label>To</label>
                                                <input type="date" value={customDateTo} min={customDateFrom} onChange={e => { setCustomDateTo(e.target.value); setDateFilterError(''); }} />
                                            </div>
                                        </div>
                                        {dateFilterError && (
                                            <div className="date-filter-error">
                                                <AlertTriangle size={12} /> {dateFilterError}
                                            </div>
                                        )}
                                        <div className="date-custom-actions">
                                            <button className="date-custom-cancel" onClick={() => { setDateFilter('all'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); setCurrentPage(1); }}>Cancel</button>
                                            <button className="date-custom-apply" onClick={() => {
                                                if (!customDateFrom || !customDateTo) {
                                                    setDateFilterError('Both dates are required.');
                                                    return;
                                                }
                                                if (new Date(customDateFrom) > new Date(customDateTo)) {
                                                    setDateFilterError('From date cannot be later than To.');
                                                    return;
                                                }
                                                setDateFilterError('');
                                                setActivePopover(null);
                                                setCurrentPage(1);
                                            }}>Apply</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Record Sorting Popover */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${filters.sortBy !== 'newest' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'sort' ? null : 'sort')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Clock size={14} className="filter-btn-icon" /> 
                            <span>Sort By</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        
                        {activePopover === 'sort' && (
                            <div className="filter-popover">
                                <div className="popover-title">Date Added</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${filters.sortBy === 'newest' ? 'selected' : ''}`} onClick={() => { handleFilterChange('sortBy', 'newest'); setActivePopover(null); }}>Newest to Oldest</button>
                                    <button className={`popover-opt-btn ${filters.sortBy === 'oldest' ? 'selected' : ''}`} onClick={() => { handleFilterChange('sortBy', 'oldest'); setActivePopover(null); }}>Oldest to Newest</button>
                                </div>
                                <div className="popover-title" style={{ marginTop: '8px' }}>Due Date</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${filters.sortBy === 'nearest_edd' ? 'selected' : ''}`} onClick={() => { handleFilterChange('sortBy', 'nearest_edd'); setActivePopover(null); }}>Due Date: Soonest</button>
                                    <button className={`popover-opt-btn ${filters.sortBy === 'farthest_edd' ? 'selected' : ''}`} onClick={() => { handleFilterChange('sortBy', 'farthest_edd'); setActivePopover(null); }}>Due Date: Farthest</button>
                                </div>
                                <div className="popover-title" style={{ marginTop: '8px' }}>Alphabetical</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${filters.sortBy === 'alpha_az' ? 'selected' : ''}`} onClick={() => { handleFilterChange('sortBy', 'alpha_az'); setActivePopover(null); }}>Name: A-Z</button>
                                    <button className={`popover-opt-btn ${filters.sortBy === 'alpha_za' ? 'selected' : ''}`} onClick={() => { handleFilterChange('sortBy', 'alpha_za'); setActivePopover(null); }}>Name: Z-A</button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {hasActiveFilters && (
                        <button className="clear-filters-btn" onClick={clearFilters}>Clear All</button>
                    )}
                    <Legend 
                        categories={[
                            {
                                title: "Gestation",
                                items: [
                                    { label: "1st Trim", className: "tri-badge tri-1" },
                                    { label: "2nd Trim", className: "tri-badge tri-2" },
                                    { label: "3rd Trim", className: "tri-badge tri-3" }
                                ]
                            },
                            {
                                title: "Health Conditions",
                                items: [
                                    { label: "Pre-existing Medical Conditions", className: "category-badge category-badge--pre-existing" },
                                    { label: "Pregnancy-Related Conditions", className: "category-badge category-badge--pregnancy-related" },
                                    { label: "Relevant Obstetric History", className: "category-badge category-badge--obstetric-history" },
                                    { label: "None Reported", className: "risk-badge condition-none" }
                                ]
                            }
                        ]}
                    />
                </div> {/* Closes shared-filters-row */}
            </div> {/* Closes shared-controls-card */}

            <div className="table-card">
                <div className="table-responsive">
                    <table className="patients-table">
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Patient ID</th>
                                <th>Name</th>
                                <th>Station</th>
                                <th>Age</th>
                                <th>Gestation</th>
                                <th>Health Conditions</th>
                                <th>Visits</th>
                                <th>Next Appt</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedPatients.length > 0 ? (
                                paginatedPatients.map((p, index) => (
                                    <tr key={p.id} className="table-row">
                                        <td className="cell-number">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                        <td className="cell-id">
                                            <span 
                                                onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/${p.id}?from=patients`); }}
                                                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                                onMouseOver={(e) => { e.target.style.color = '#b9818a'; e.target.style.textDecoration = 'underline'; }}
                                                onMouseOut={(e) => { e.target.style.color = ''; e.target.style.textDecoration = 'none'; }}
                                                title="View Patient Profile"
                                            >
                                                {getShortPatientId(p.id)}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="cell-name-wrap" onClick = {() => navigate(`/dashboard/patients/${p.id}?from=patients`)}>
                                                <div className="avatar-sm">
                                                    {p.name.split(' ').map(n => n[0]).slice(0,2).join('')}
                                                </div>
                                                <div>
                                                    <span className="patient-name-link">{p.name}</span>
                                                    <span className="patient-status-note">{(p.archiveStatus || 'active') === 'archived' ? 'Archived' : 'Active'}</span>
                                                    <PatientStaffAssignment
                                                        patientId={p.id}
                                                        patientStationId={p.stationId}
                                                        assignedStaffId={p.assignedStaffId}
                                                        role={assignmentAccess.role}
                                                        viewerStationId={assignmentAccess.stationId}
                                                        onAssigned={({ id: assignedStaffId }) => setPatients(previous => previous.map(patient =>
                                                            patient.id === p.id ? { ...patient, assignedStaffId } : patient
                                                        ))}
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        <td className="cell-muted">{toTitleCase(p.station)}</td>
                                        <td className="cell-bold">{p.age}</td>

                                        <td>
                                            <span className={`tri-badge tri-${p.trimester || 1}`}>
                                                T{p.trimester || 1} · {p.weeks || '-'}w
                                            </span>
                                        </td>

                                        <td>
                                            {(!p.activeCategories || p.activeCategories.length === 0) ? (
                                                <span 
                                                    className="risk-badge condition-none"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/${p.id}?from=patients&tab=history`); }}
                                                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                                                    onMouseOver={(e) => { e.target.style.opacity = '0.75'; }}
                                                    onMouseOut={(e) => { e.target.style.opacity = '1'; }}
                                                    title="View Medical History"
                                                >
                                                    None Reported
                                                </span>
                                            ) : (
                                                <div className="patient-conditions-cell" onClick={(e) => e.stopPropagation()}>
                                                    {p.activeCategories.slice(0, 2).map((catGroup, catIdx) => {
                                                        const theme = getCategoryTheme(catGroup.category);
                                                        const allConditions = catGroup.conditions || [];
                                                        const displayConditions = allConditions.slice(0, 2);
                                                        const extraConditionsCount = allConditions.length - displayConditions.length;

                                                        return (
                                                            <div key={catIdx} className="category-group">
                                                                <span 
                                                                    className={`category-badge category-badge--${theme}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/dashboard/patients/${p.id}?from=patients&tab=history`);
                                                                    }}
                                                                    title="View in Medical History"
                                                                >
                                                                    {catGroup.category}
                                                                </span>
                                                                <div className="category-conditions-text">
                                                                    {displayConditions.join(', ')}
                                                                    {extraConditionsCount > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            className="condition-more-btn"
                                                                            onClick={(e) => handleOpenConditionPopover(e, p)}
                                                                            title="View all documented conditions"
                                                                        >
                                                                            +{extraConditionsCount} more
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {p.activeCategories.length > 2 && (
                                                        <button
                                                            type="button"
                                                            className="condition-more-btn condition-more-btn--categories"
                                                            onClick={(e) => handleOpenConditionPopover(e, p)}
                                                            title="View all categories & conditions"
                                                        >
                                                            +{p.activeCategories.length - 2} more {p.activeCategories.length - 2 === 1 ? 'category' : 'categories'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        <td className="cell-bold">
                                            {(p.totalVisits ?? 0) > 0 ? (
                                                <span 
                                                    className="patient-visits-link"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/${p.id}?from=patients&tab=visits`); }}
                                                    style={{ cursor: 'pointer', color: 'var(--color-rose)', textDecoration: 'none' }}
                                                    onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                                                    onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                                                >
                                                    {p.totalVisits}
                                                </span>
                                            ) : (
                                                p.totalVisits ?? 0
                                            )}
                                        </td>

                                        <td>
                                            <div className="cell-appt">
                                                <Clock size={13} className="appt-icon" />
                                                {p.nextAppt ? (
                                                    <span className="appt-date">{p.nextAppt}</span>
                                                ) : (
                                                    <span className="appt-date appt-none">No upcoming appt</span>
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            <div className="actions-group">
                                                {hasPatientStationPermission(p, 'patient.view.own_station', 'patient.view.other_station') && (
                                                    <ActionTooltip text="View Profile">
                                                        <button type="button" className="action-btn view-btn" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/${p.id}?from=patients`); }}>
                                                            <Eye size={16} />
                                                        </button>
                                                    </ActionTooltip>
                                                )}

                                                {hasPatientStationPermission(p, 'prenatal.record.own_station', 'prenatal.record.other_station') && (
                                                    <ActionTooltip text="Record Vitals">
                                                        <button type="button" className="action-btn vitals-btn" onClick={(e) => { e.stopPropagation(); openVitalsModal(p); }}>
                                                            <Activity size={16} />
                                                        </button>
                                                    </ActionTooltip>
                                                )}

                                                {hasPatientStationPermission(p, 'patient.edit.own_station', 'patient.edit.other_station') && (
                                                    <ActionTooltip text="Edit Patient">
                                                        <button type="button" className="action-btn edit-btn" onClick={(e) => { e.stopPropagation(); openEditModal(p.id); }} disabled={modalLoading.edit}>
                                                            <Edit size={16} />
                                                        </button>
                                                    </ActionTooltip>
                                                )}

                                                {canChangeArchiveState(p) && ((p.archiveStatus || 'active') === 'archived' ? (
                                                    <ActionTooltip text="Restore Patient">
                                                        <button type="button" className="action-btn restore-btn" onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRestore(p.id);
                                                        }}>
                                                            <ArchiveRestore size={16} />
                                                        </button>
                                                    </ActionTooltip>
                                                ) : (
                                                    <ActionTooltip text="Archive Patient">
                                                        <button type="button" className="action-btn archive-btn" onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleArchive(p.id);
                                                        }}>
                                                            <Archive size={16} />
                                                        </button>
                                                    </ActionTooltip>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" className="empty-state">
                                        <User size={32} />
                                        <p>No patients found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="pagination-wrap">
                        <span>
                            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredPatients.length)} of {filteredPatients.length}
                        </span>

                        <div className="pagination-controls">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                                <ChevronLeft size={16} />
                            </button>

                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {vitalModalPatient && (
            <RecordVitalsModal
                key={vitalModalPatient.id}
                patient={vitalModalPatient}
                onSave={handleSaveVitals}
                onClose={() => setVitalModalPatient(null)}
            />
        )}

        {editModalPatient && (
            <EditPatientModal
                key={editModalPatient.id}
                patient={editModalPatient}
                onClose={() => setEditModalPatient(null)}
                onSave={handlePatientUpdate}
            />
        )}

        {vitalToast && (
            <div className="vm-toast">
                <span><CheckCircle2 size={16} /> Vital signs record saved successfully!</span>
                <button className="toast-close" onClick={() => setVitalToast(false)}><X size={14} /></button>
            </div>
        )}

        <ExportModal 
            isOpen={showExportModal} 
            onClose={() => setShowExportModal(false)} 
            onExport={handleExport} 
        />

        {conditionPopover && createPortal(
            <div 
                className="conditions-popover-card" 
                style={{
                    position: 'fixed',
                    top: `${conditionPopover.top}px`,
                    left: `${conditionPopover.left}px`,
                    zIndex: 9999
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="conditions-popover-header">
                    <div>
                        <h4 className="conditions-popover-title">Documented Health Conditions</h4>
                        <p className="conditions-popover-sub">
                            {conditionPopover.patient.name} &middot; {getShortPatientId(conditionPopover.patient.id)}
                        </p>
                    </div>
                    <button 
                        type="button" 
                        className="conditions-popover-close" 
                        onClick={() => setConditionPopover(null)}
                        aria-label="Close"
                    >
                        <X size={15} />
                    </button>
                </div>

                <div className="conditions-popover-body">
                    {(conditionPopover.patient.activeCategories || []).map((catGroup, idx) => {
                        const theme = getCategoryTheme(catGroup.category);
                        return (
                            <div key={idx} className="conditions-popover-group">
                                <span className={`category-badge category-badge--${theme}`}>
                                    {catGroup.category}
                                </span>
                                <div className="conditions-popover-tags">
                                    {(catGroup.conditions || []).map((c, cIdx) => (
                                        <span key={cIdx} className="conditions-popover-tag">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="conditions-popover-footer">
                    <button 
                        type="button"
                        className="conditions-popover-history-link"
                        onClick={() => {
                            const patientId = conditionPopover.patient.id;
                            setConditionPopover(null);
                            navigate(`/dashboard/patients/${patientId}?from=patients&tab=history`);
                        }}
                    >
                        View Full Medical History &rarr;
                    </button>
                </div>
            </div>,
            document.body
        )}
        </>
    );
};

export default PatientsList;
