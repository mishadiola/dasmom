import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Search, Filter, Plus, ChevronLeft, ChevronRight, ChevronDown, Check,
    Eye, Edit, Archive, ArchiveRestore, Activity, CalendarPlus,
    FileText, User, MapPin, Clock, AlertTriangle,
    X, CheckCircle2
} from 'lucide-react';
import '../../styles/pages/PatientsList.css';
import PatientService from '../../services/patientservice';
import EditPatientModal from '../../components/Patient/EditPatientModal';

const EMPTY_VITALS = {
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
    date: new Date().toISOString().split('T')[0],
};

const RecordVitalsModal = ({ patient, onSave, onClose, supplements }) => {
    const [form, setForm] = useState({ ...EMPTY_VITALS });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const [selectedSupplements, setSelectedSupplements] = useState({});
    const [supplementAmounts, setSupplementAmounts] = useState({});

    useEffect(() => {
        if (!patient) return;

        const latestVisit = Array.isArray(patient.visits) && patient.visits.length > 0
            ? [...patient.visits].sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))[0]
            : null;

        const initialForm = {
            ...EMPTY_VITALS,
            date: latestVisit?.visit_date ? latestVisit.visit_date.split('T')[0] : new Date().toISOString().split('T')[0],
            bpSystolic: latestVisit?.bp_systolic || '',
            bpDiastolic: latestVisit?.bp_diastolic || '',
            weight: latestVisit?.weight_kg || '',
            temp: latestVisit?.temp_c || '',
            pulse: latestVisit?.pulse_bpm || '',
            respRate: latestVisit?.resp_rate_cpm || '',
            fundalHeight: latestVisit?.fundal_height_cm || '',
            fhr: latestVisit?.fhr_bpm || '',
            fetalMovement: latestVisit?.fetal_movement || '',
            presentation: latestVisit?.presentation || '',
            notes: latestVisit?.clinical_notes || '',
        };

        setForm(initialForm);
    }, [patient]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.bpSystolic || !form.bpDiastolic || !form.weight || !form.date) return;
        const supplementsData = Object.keys(selectedSupplements).filter(id => selectedSupplements[id]).map(id => {
            const sup = supplements.find(s => s.id === id);
            return { id, amount: supplementAmounts[id] || 0, unit: sup?.unit || 'units' };
        });
        onSave(patient.id, { ...form, patientName: patient.name }, supplementsData);
    };

    return (
        <div className="pv-modal-overlay" onClick={onClose}>
            <div className="pv-modal" onClick={e => e.stopPropagation()}>
                <div className="pv-modal-header">
                    <div>
                        <h2 className="pv-modal-title">Record Vital Signs</h2>
                        <p className="pv-modal-sub">{patient.name} &middot; {patient.id}</p>
                    </div>
                    <button className="pv-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form className="pv-modal-body" onSubmit={handleSubmit}>
                    <div className="vm-grid">
                        <div className="vm-field">
                            <label className="vm-label">Blood Pressure Systolic *</label>
                            <input className="vm-input" type="number" value={form.bpSystolic} onChange={e => set('bpSystolic', e.target.value)} required />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Blood Pressure Diastolic *</label>
                            <input className="vm-input" type="number" value={form.bpDiastolic} onChange={e => set('bpDiastolic', e.target.value)} required />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Weight (kg) *</label>
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
                            <label className="vm-label">Date *</label>
                            <input className="vm-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
                        </div>
                    </div>

                    <div className="vm-field vm-field--full">
                        <label className="vm-label">Clinical Notes</label>
                        <textarea className="vm-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
                    </div>

                    <div className="vm-supplements">
                        <h3>Administer Supplements</h3>
                        {supplements.map(sup => (
                            <div key={sup.id} className="vm-supplement-item">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={selectedSupplements[sup.id] || false}
                                        onChange={e => setSelectedSupplements(prev => ({ ...prev, [sup.id]: e.target.checked }))}
                                    />
                                    {sup.name} (Stock: {sup.stock} {sup.unit})
                                </label>
                                {selectedSupplements[sup.id] && (
                                    <input
                                        type="number"
                                        placeholder="Amount"
                                        value={supplementAmounts[sup.id] || ''}
                                        onChange={e => setSupplementAmounts(prev => ({ ...prev, [sup.id]: e.target.value }))}
                                        min="0"
                                        max={sup.stock}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="pv-modal-footer">
                        <button type="button" className="vm-btn vm-btn--cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="vm-btn vm-btn--save"><CheckCircle2 size={15} /> Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PatientsList = () => {
    const navigate = useNavigate();

    const [patients, setPatients] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [archiveFilter, setArchiveFilter] = useState('active'); // 'active' | 'archived' | 'all'
    const [filters, setFilters] = useState({
        trimesters: [],
        risks: [],
        stations: [],
        patientType: 'All',
        sortBy: 'newest'
    });
    
    const [activePopover, setActivePopover] = useState(null);
    const [stationSearch, setStationSearch] = useState('');
    
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
    const itemsPerPage = 10;

    const [vitalModalPatient, setVitalModalPatient] = useState(null);
    const [vitalToast, setVitalToast] = useState(false);
    const [editModalPatient, setEditModalPatient] = useState(null);
    const [modalLoading, setModalLoading] = useState({ edit: false, vitals: false });
    const [supplements, setSupplements] = useState([]);

    const openEditModal = async (patientId) => {
        setEditModalPatient(null);
        setModalLoading(prev => ({ ...prev, edit: true }));
        try {
            const patientService = new PatientService();
            const detailedPatient = await patientService.getPatientById(patientId);
            setEditModalPatient(detailedPatient);
        } catch (err) {
            console.error('Error loading patient details for edit:', err);
            alert('Unable to load patient details. Please try again.');
        } finally {
            setModalLoading(prev => ({ ...prev, edit: false }));
        }
    };

    const openVitalsModal = async (patientId) => {
        setVitalModalPatient(null);
        setModalLoading(prev => ({ ...prev, vitals: true }));
        try {
            const patientService = new PatientService();
            const detailedPatient = await patientService.getPatientById(patientId);
            setVitalModalPatient(detailedPatient);
        } catch (err) {
            console.error('Error loading patient details for vitals:', err);
            alert('Unable to load patient details. Please try again.');
        } finally {
            setModalLoading(prev => ({ ...prev, vitals: false }));
        }
    };

    useEffect(() => {
    const fetchPatients = async () => {
        try {
            const patientService = new PatientService();  
            const data = await patientService.getAllPatients(); 
            setPatients(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSupplements = async () => {
        try {
            const patientService = new PatientService();
            const data = await patientService.getSupplementInventory();
            setSupplements(data);
        } catch (err) {
            console.error(err);
        }
    };

    fetchPatients();
    fetchSupplements();
}, []);


    const filteredPatients = patients.filter(p => {
        const matchesSearch =
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.station || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesTri = filters.trimesters.length === 0 || filters.trimesters.includes(String(p.trimester || 1));
        
        const normalizedRisk = (p.risk || 'Normal').toLowerCase();
        let derivedRisk = normalizedRisk;
        if (normalizedRisk.includes('high')) derivedRisk = 'High';
        else if (normalizedRisk.includes('monitor')) derivedRisk = 'Monitor';
        else derivedRisk = 'Normal';
        
        const matchesRisk = filters.risks.length === 0 || filters.risks.includes(derivedRisk);
        const matchesType = filters.patientType === 'All' || (p.patientType || p.type) === filters.patientType;
        const matchesStation = filters.stations.length === 0 || filters.stations.includes(p.station);
        
        // Filter out postpartum patients - they should not appear in patient list
        // as they are now managed through DeliveryOutcomes
        const isPostpartum = p.archiveStatus === 'postpartum';
        const matchesArchive = archiveFilter === 'all' 
            ? !isPostpartum  // In 'all' mode, exclude postpartum by default
            : archiveFilter === 'active' 
                ? !isPostpartum  // In 'active' mode, exclude postpartum
                : isPostpartum; // In 'archived' mode, only show postpartum

        return matchesSearch && matchesTri && matchesRisk && matchesType && matchesStation && matchesArchive;
    });

    const sortedPatients = [...filteredPatients].sort((a, b) => {
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
    });

    const availableStations = [...new Set(patients.map(p => p.station).filter(Boolean))].sort();

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
        setFilters({ trimesters: [], risks: [], stations: [], patientType: 'All', sortBy: 'newest' });
        setArchiveFilter('active');
        setSearchTerm('');
        setCurrentPage(1);
        setActivePopover(null);
    };

    const hasActiveFilters = filters.trimesters.length > 0 || filters.risks.length > 0 || filters.stations.length > 0 || filters.sortBy !== 'newest' || archiveFilter !== 'active';

    const handleExport = () => {
        const exportData = sortedPatients.map(p => ({
            'Patient ID': p.id || '',
            'Name': p.name || '',
            'Type': p.patientType || p.type || 'Mother',
            'Station': p.station || 'Unassigned',
            'Age': p.age || 'N/A',
            'Gestation': p.weeks ? `${p.weeks} weeks (T${p.trimester || 1})` : 'N/A',
            'Risk Level': p.risk || 'Normal',
            'Total Visits': p.totalVisits || 0,
            'Next Appointment': p.nextAppt || 'No upcoming appt'
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Patient Profiles');

        XLSX.writeFile(workbook, 'patient_profiles.xlsx');
    };

    const handleSaveVitals = async (patientId, record, supplements) => {
        try {
            const patientService = new PatientService();
            await patientService.recordVitals(patientId, record, supplements);
            setVitalModalPatient(null);
            setVitalToast(true);
            setTimeout(() => setVitalToast(false), 3500);
        } catch (err) {
            console.error('Error saving vitals:', err);
            alert('Error saving vitals: ' + err.message);
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

    const handleArchive = (patientId) => {
        if (window.confirm('Are you sure you want to archive this patient? It will be removed from active lists but can be restored.')) {
            setPatients(prevPatients => 
                prevPatients.map(p => p.id === patientId ? { ...p, archiveStatus: 'archived' } : p)
            );
        }
    };

    const handleRestore = (patientId) => {
        if (window.confirm('Are you sure you want to restore this patient? It will be moved back to active lists.')) {
            setPatients(prevPatients => 
                prevPatients.map(p => p.id === patientId ? { ...p, archiveStatus: 'active' } : p)
            );
        }
    };

    return (
        <>
        <div className="patients-page">

            <div className="page-header">
                <div>
                    <h1 className="page-title">Patient Profiles</h1>
                    <p className="page-subtitle">Manage and monitor all registered pregnant patients</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={handleExport}>
                        <FileText size={16} />
                        Export List
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard/patients/add')}>
                        <Plus size={16} />
                        Add New Patient
                    </button>
                </div>
            </div>

            <div className="controls-card">
                {/* Row 1: Search */}
                <div className="search-row">
                    <div className="search-wrap">
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, ID, or station..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="search-input"
                        />
                    </div>
                </div>

                {/* Row 2: Filters */}
                <div className="filters-row">
                    <div className="filter-group">
                        <span className="filter-label">Pregnancy Details</span>
                    
                    {/* Pregnancy Details Popover */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${(filters.trimesters.length > 0 || filters.risks.length > 0) ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'pregnancy' ? null : 'pregnancy')}
                        >
                            <AlertTriangle size={14} className="filter-btn-icon" />
                            Pregnancy Details
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
                                
                                <div className="popover-title" style={{ marginTop: '12px' }}>Risk Level</div>
                                <div className="popover-options">
                                    {['Normal', 'Monitor', 'High'].map(risk => (
                                        <label key={risk} className="popover-checkbox-label">
                                            <input type="checkbox" checked={filters.risks.includes(risk)} onChange={() => toggleArrayFilter('risks', risk)} />
                                            {risk} {risk === 'High' ? 'Risk' : ''}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Location Popover */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${filters.stations.length > 0 ? 'active-filter' : ''}`}
                            onClick={() => {
                                setActivePopover(activePopover === 'location' ? null : 'location');
                                setStationSearch('');
                            }}
                        >
                            <MapPin size={14} className="filter-btn-icon" />
                            Location
                            {filters.stations.length > 0 && <span className="filter-badge">{filters.stations.length}</span>}
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        
                        {activePopover === 'location' && (
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

                    {/* Patient Type Filter */}
                    <div className="filter-dropdown-container">
                        <select
                            className="filter-btn patient-type-filter"
                            value={filters.patientType}
                            onChange={(e) => { handleFilterChange('patientType', e.target.value); setActivePopover(null); }}
                        >
                            <option value="All">All Types</option>
                            <option value="Mother">Mother</option>
                        </select>
                    </div>

                    {/* Archive Filter */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${archiveFilter !== 'active' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'archive' ? null : 'archive')}
                        >
                            <Archive size={14} className="filter-btn-icon" />
                            {archiveFilter === 'active' ? 'Active' : archiveFilter === 'archived' ? 'Archived' : archiveFilter === 'missed_delivery' ? 'Missed Delivery' : archiveFilter === 'postpartum' ? 'Postpartum' : 'All'}
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        
                        {activePopover === 'archive' && (
                            <div className="filter-popover">
                                <div className="popover-title">Status</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${archiveFilter === 'active' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('active'); setActivePopover(null); setCurrentPage(1); }}>Active</button>
                                    <button className={`popover-opt-btn ${archiveFilter === 'missed_delivery' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('missed_delivery'); setActivePopover(null); setCurrentPage(1); }}>Missed Delivery</button>
                                    <button className={`popover-opt-btn ${archiveFilter === 'postpartum' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('postpartum'); setActivePopover(null); setCurrentPage(1); }}>Postpartum</button>
                                    <button className={`popover-opt-btn ${archiveFilter === 'archived' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('archived'); setActivePopover(null); setCurrentPage(1); }}>Archived</button>
                                    <button className={`popover-opt-btn ${archiveFilter === 'all' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('all'); setActivePopover(null); setCurrentPage(1); }}>All</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Record Sorting Popover */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${filters.sortBy !== 'newest' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'sort' ? null : 'sort')}
                        >
                            <Clock size={14} className="filter-btn-icon" />
                            Sort By
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
                </div>
                </div>
            </div>

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
                                <th>Risk Level</th>
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
                                        <td className="cell-id">{p.id}</td>

                                        <td>
                                            <div className="cell-name-wrap" onClick = {() => navigate(`/dashboard/patients/${p.id}?from=patients`)}>
                                                <div className="avatar-sm">
                                                    {p.name.split(' ').map(n => n[0]).slice(0,2).join('')}
                                                </div>
                                                <div>
                                                    <span className="patient-name-link">{p.name}</span>
                                                    <span className="patient-status-note">Active</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="cell-muted">{p.station}</td>
                                        <td className="cell-bold">{p.age}</td>

                                        <td>
                                            <span className={`tri-badge tri-${p.trimester || 1}`}>
                                                T{p.trimester || 1} · {p.weeks || '-'}w
                                            </span>
                                        </td>

                                        <td>
                                            <div>
                                                <span className={`risk-badge risk-${(p.risk || 'Low Risk').toLowerCase().split(' ')[0]}`}>
                                                    {p.risk || 'Low Risk'}
                                                </span>
                                                {p.riskFactors && p.riskFactors.length > 0 && (
                                                    <div className="risk-factors">
                                                        {p.riskFactors.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        <td className="cell-bold">{p.totalVisits ?? 0}</td>

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
                                                <button type="button" className="action-btn view-btn" data-tooltip="View Profile" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/${p.id}?from=patients`); }}>
                                                <Eye size={16} />
                                                </button>

                                                <button type="button" className="action-btn vitals-btn" data-tooltip="Record Vitals" onClick={(e) => { e.stopPropagation(); openVitalsModal(p.id); }} disabled={modalLoading.vitals}>
                                                <Activity size={16} />
                                                </button>

                                                <button type="button" className="action-btn edit-btn" data-tooltip="Edit Patient" onClick={(e) => { e.stopPropagation(); openEditModal(p.id); }} disabled={modalLoading.edit}>
                                                <Edit size={16} />
                                                </button>

                                                {(p.archiveStatus || 'active') === 'archived' ? (
                                                    <button type="button" className="action-btn restore-btn" data-tooltip="Restore Patient" onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRestore(p.id);
                                                    }}>
                                                    <ArchiveRestore size={16} />
                                                    </button>
                                                ) : (
                                                    <button type="button" className="action-btn archive-btn" data-tooltip="Archive Patient" onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleArchive(p.id);
                                                    }}>
                                                    <Archive size={16} />
                                                    </button>
                                                )}
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
                patient={vitalModalPatient}
                onSave={handleSaveVitals}
                onClose={() => setVitalModalPatient(null)}
                supplements={supplements}
            />
        )}

        {editModalPatient && (
            <EditPatientModal
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
        </>
    );
};

export default PatientsList;