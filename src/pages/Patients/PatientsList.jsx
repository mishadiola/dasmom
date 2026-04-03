import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, ChevronLeft, ChevronRight,
    Eye, Activity, CalendarPlus,
    FileText, User, MapPin, Clock, AlertTriangle,
    X, CheckCircle2
} from 'lucide-react';
import '../../styles/pages/PatientsList.css';
import PatientService from '../../services/patientservice';

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
        trimester: 'All',
        risk: 'All',
        barangay: 'All'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [vitalModalPatient, setVitalModalPatient] = useState(null);
    const [vitalsHistory, setVitalsHistory] = useState({});
    const [vitalToast, setVitalToast] = useState(false);

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const data = await PatientService.getAllPatients();
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
            (p.barangay || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesTri = filters.trimester === 'All' || String(p.trimester) === filters.trimester;
        const matchesRisk = filters.risk === 'All' || p.risk === filters.risk;
        const matchesBrgy = filters.barangay === 'All' || p.barangay === filters.barangay;

        return matchesSearch && matchesTri && matchesRisk && matchesBrgy;
    });

    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const handleSaveVitals = (patientId, record) => {
        setVitalsHistory(prev => ({
            ...prev,
            [patientId]: [record, ...(prev[patientId] || [])]
        }));
        setVitalModalPatient(null);
        setVitalToast(true);
        setTimeout(() => setVitalToast(false), 3500);
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
                    <button className="btn btn-outline">
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
                        placeholder="Search by name, ID, or barangay..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="search-input"
                    />
                </div>

                <div className="filters-wrap">
                    <span className="filters-label">Filters:</span>

                    <div className="filter-group">
                        <span className="filter-icon"><Filter size={14} /></span>
                        <select value={filters.trimester} onChange={(e) => handleFilterChange('trimester', e.target.value)} className="filter-select">
                            <option value="All">All Trimesters</option>
                            <option value="1">1st Trimester</option>
                            <option value="2">2nd Trimester</option>
                            <option value="3">3rd Trimester</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <span className="filter-icon"><AlertTriangle size={14} /></span>
                        <select value={filters.risk} onChange={(e) => handleFilterChange('risk', e.target.value)} className="filter-select">
                            <option value="All">All Risks</option>
                            <option value="Normal">Normal</option>
                            <option value="Monitor">Monitor</option>
                            <option value="High">High Risk</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <span className="filter-icon"><MapPin size={14} /></span>
                        <select value={filters.barangay} onChange={(e) => handleFilterChange('barangay', e.target.value)} className="filter-select">
                            <option value="All">All Barangays</option>
                            {[1,2,3,4,5,6,7].map(n => (
                                <option key={n} value={`Brgy. ${n}`}>Brgy. {n}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="table-card">
                <div className="table-responsive">
                    <table className="patients-table">
                        <thead>
                            <tr>
                                <th>Patient ID</th>
                                <th>Name</th>
                                <th>Barangay</th>
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
                                            <div className="cell-name-wrap" onClick={() => navigate(`/dashboard/patients/${p.id.replace('PT-','')}`)}>
                                                <div className="avatar-sm">
                                                    {p.name.split(' ').map(n => n[0]).slice(0,2).join('')}
                                                </div>
                                                <div>
                                                    <span className="patient-name-link">{p.name}</span>
                                                    <span className="patient-status-note">Active</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="cell-muted">{p.barangay}</td>
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
                                                <span className="appt-date">-</span>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="actions-group">
                                                <button className="action-btn view-btn" onClick={() => navigate(`/dashboard/patients/${p.id.replace('PT-','')}`)}>
                                                    <Eye size={16} />
                                                </button>

                                                <button className="action-btn vitals-btn" onClick={() => setVitalModalPatient(p)}>
                                                    <Activity size={16} />
                                                </button>

                                                <button className="action-btn sched-btn" onClick={() => navigate('/dashboard/prenatal')}>
                                                    <CalendarPlus size={16} />
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
                <CheckCircle2 size={16} /> Vital signs record saved successfully!
            </div>
        )}
        </>
    );
};

export default PatientsList;