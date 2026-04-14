import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, ChevronLeft, ChevronRight, ChevronDown, Check,
    Eye, Edit, Trash, Activity, CalendarPlus,
    FileText, User, MapPin, Clock, AlertTriangle,
    X, CheckCircle2
} from 'lucide-react';
import '../../styles/pages/PatientsList.css';
import PatientService from '../../services/patientservice';
import { utils, writeFile } from 'xlsx';

const EMPTY_VITALS = {
    bp: '',
    weight: '',
    temp: '',
    heartRate: '',
    gestationalAge: '',
    fetalHeartRate: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
};

const RecordVitalsModal = ({ patient, history, onSave, onClose }) => {
    const [form, setForm] = useState({ ...EMPTY_VITALS });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.bp || !form.weight || !form.date) return;
        onSave(patient.id, { ...form, patientName: patient.name });
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
                            <label className="vm-label">Blood Pressure *</label>
                            <input className="vm-input" value={form.bp} onChange={e => set('bp', e.target.value)} required />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Weight (kg) *</label>
                            <input className="vm-input" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} required />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Body Temperature</label>
                            <input className="vm-input" type="number" value={form.temp} onChange={e => set('temp', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Heart Rate</label>
                            <input className="vm-input" type="number" value={form.heartRate} onChange={e => set('heartRate', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Gestational Age</label>
                            <input className="vm-input" type="number" value={form.gestationalAge} onChange={e => set('gestationalAge', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Fetal Heart Rate</label>
                            <input className="vm-input" type="number" value={form.fetalHeartRate} onChange={e => set('fetalHeartRate', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Date *</label>
                            <input className="vm-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
                        </div>
                    </div>

                    <div className="vm-field vm-field--full">
                        <textarea className="vm-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
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
    const [filters, setFilters] = useState({
        trimesters: [],
        risks: [],
        stations: [],
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

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [vitalModalPatient, setVitalModalPatient] = useState(null);
    const [vitalsHistory, setVitalsHistory] = useState({});
    const [vitalToast, setVitalToast] = useState(false);

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

    fetchPatients();
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
        const matchesStation = filters.stations.length === 0 || filters.stations.includes(p.station);

        return matchesSearch && matchesTri && matchesRisk && matchesStation;
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
        setFilters({ trimesters: [], risks: [], stations: [], sortBy: 'newest' });
        setSearchTerm('');
        setCurrentPage(1);
        setActivePopover(null);
    };

    const hasActiveFilters = filters.trimesters.length > 0 || filters.risks.length > 0 || filters.stations.length > 0 || filters.sortBy !== 'newest';


    const handleSaveVitals = (patientId, record) => {
        setVitalsHistory(prev => ({
            ...prev,
            [patientId]: [record, ...(prev[patientId] || [])]
        }));
        setVitalModalPatient(null);
        setVitalToast(true);
        setTimeout(() => setVitalToast(false), 3500);
    };

    const handleExportExcel = () => {
        const exportData = sortedPatients.map(p => ({
            "Patient ID": p.id || 'N/A',
            "Name": p.name || 'N/A',
            "Station": p.station || 'N/A',
            "Age": p.age || 'N/A',
            "Gestation": `T${p.trimester || 1} - ${p.weeks || '-'}w`,
            "Risk Level": p.risk || 'Normal',
            "Next Appointment": p.nextAppt || 'No upcoming appt'
        }));

        const worksheet = utils.json_to_sheet(exportData);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Patient Profiles");

        const wscols = [
            { wch: 15 }, // Patient ID
            { wch: 25 }, // Name
            { wch: 20 }, // Station
            { wch: 10 }, // Age
            { wch: 18 }, // Gestation
            { wch: 15 }, // Risk Level
            { wch: 20 }  // Next Appointment
        ];
        worksheet['!cols'] = wscols;

        writeFile(workbook, "patient_profiles.xlsx");
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
                    <button className="btn btn-outline" onClick={handleExportExcel}>
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

                <div className="filters-wrap">
                    <span className="filters-label">Filters:</span>
                    
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
                                        <div style={{ fontSize: '12px', padding: '8px', color: '#888' }}>No stations found.</div>
                                    )}
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

            <div className="table-card">
                <div className="table-responsive">
                    <table className="patients-table">
                        <thead>
                            <tr>
                                <th>Patient ID</th>
                                <th>Name</th>
                                <th>Station</th>
                                <th>Age</th>
                                <th>Gestation</th>
                                <th>Risk Level</th>
                                <th>Next Appt</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedPatients.length > 0 ? (
                                paginatedPatients.map(p => (
                                    <tr key={p.id} className="table-row">
                                        <td className="cell-id">{p.id}</td>

                                        <td>
                                            <div className="cell-name-wrap" onClick = {() => navigate(`/dashboard/patients/${p.id}`)}>
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
                                            <span className={`risk-badge risk-${(p.risk || 'normal').toLowerCase()}`}>
                                                {p.risk || 'Normal'}
                                            </span>
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
                                                <button type="button" className="action-btn view-btn" data-tooltip="View Profile" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/${p.id}`); }}>
                                                <Eye size={16} />
                                                </button>
                                                
                                                {}
                                                <button type="button" className="action-btn vitals-btn" data-tooltip="Record Vitals" onClick={(e) => { e.stopPropagation(); setVitalModalPatient(p); }}>
                                                <Activity size={16} />
                                                </button>
                                                
                                                <button type="button" className="action-btn edit-btn" data-tooltip="Edit Patient" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/patients/edit/${p.id}`); }}>
                                                <Edit size={16} />
                                                </button>
                                                
                                                <button type="button" className="action-btn delete-btn" data-tooltip="Delete Patient" onClick={(e) => {
                                                e.stopPropagation();
                                                if(window.confirm('Are you sure you want to delete this patient?')) {
                                                    console.log('Delete logic triggered');
                                                }
                                                }}>
                                                <Trash size={16} />
                                                </button>
                                            </div>
                                            </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="empty-state">
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
                history={vitalsHistory[vitalModalPatient.id] || []}
                onSave={handleSaveVitals}
                onClose={() => setVitalModalPatient(null)}
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