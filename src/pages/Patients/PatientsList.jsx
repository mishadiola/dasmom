import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, ChevronLeft, ChevronRight,
    MoreHorizontal, Eye, Activity, CalendarPlus,
    FileText, User, MapPin, Clock, AlertTriangle,
    X, CheckCircle2
} from 'lucide-react';
import '../../styles/pages/PatientsList.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const TEST_PATIENTS = [
    { id: 'PT-2026-N1', name: 'Naomi Nicole C. Magsino', barangay: 'Brgy. 3', age: 24, trimester: 2, weeks: 24, risk: 'Normal', lastVisit: '2 days ago', nextAppt: 'Mar 15, 2026', status: 'Healthy' },
    { id: 'PT-2026-J2', name: 'Jane Rose M. Tadeo', barangay: 'Brgy. 1', age: 28, trimester: 3, weeks: 32, risk: 'High', lastVisit: '1 week ago', nextAppt: 'Mar 10, 2026', status: 'Preeclampsia' },
    { id: 'PT-2026-B3', name: 'Bhea Mae E. Tria', barangay: 'Brgy. 5', age: 22, trimester: 1, weeks: 10, risk: 'Monitor', lastVisit: '4 days ago', nextAppt: 'Mar 20, 2026', status: 'Gestational Diabetes' },
    { id: 'PT-2026-G4', name: 'Guila C. Valdesimo', barangay: 'Brgy. 2', age: 26, trimester: 2, weeks: 20, risk: 'Normal', lastVisit: 'Yesterday', nextAppt: 'Mar 25, 2026', status: 'Healthy' },
    { id: 'PT-2026-S5', name: 'Safia C. Baig', barangay: 'Brgy. 7', age: 30, trimester: 3, weeks: 36, risk: 'High', lastVisit: '3 days ago', nextAppt: 'Mar 12, 2026', status: 'Anemia' },
];

const MOCK_PATIENTS = [
    ...TEST_PATIENTS,
    ...Array.from({ length: 45 }, (_, i) => {
        const id = `PT-${2026001 + i}`;
        const riskTypes = ['Normal', 'Monitor', 'High'];
        const risk = riskTypes[Math.floor(Math.random() * riskTypes.length)];
        const trimesters = [1, 2, 3];
        const tri = trimesters[Math.floor(Math.random() * trimesters.length)];
        const weeks = tri === 1 ? Math.floor(Math.random() * 12) + 1
            : tri === 2 ? Math.floor(Math.random() * 14) + 13
                : Math.floor(Math.random() * 14) + 27;

        return {
            id,
            name: `Patient Name ${i + 1}`,
            barangay: `Brgy. ${Math.floor(Math.random() * 7) + 1}`,
            age: Math.floor(Math.random() * 20) + 18,
            trimester: tri,
            weeks: weeks,
            risk: risk,
            lastVisit: `${Math.floor(Math.random() * 30) + 1} days ago`,
            nextAppt: Math.random() > 0.3 ? `Mar ${Math.floor(Math.random() * 20) + 1}, 2026` : 'Not scheduled',
            status: risk === 'High' ? 'High BP / Anemia' : risk === 'Monitor' ? 'Gestational Diabetes' : 'Healthy',
        };
    })
];

/* ════════════════════════════
   RECORD VITALS MODAL
════════════════════════════ */
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
                        {/* Row 1 */}
                        <div className="vm-field">
                            <label className="vm-label">Blood Pressure <span className="vm-req">*</span></label>
                            <input className="vm-input" placeholder="e.g. 120/80" value={form.bp} onChange={e => set('bp', e.target.value)} required />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Weight (kg) <span className="vm-req">*</span></label>
                            <input className="vm-input" type="number" step="0.1" min="0" placeholder="e.g. 62" value={form.weight} onChange={e => set('weight', e.target.value)} required />
                        </div>
                        {/* Row 2 */}
                        <div className="vm-field">
                            <label className="vm-label">Body Temperature (°C)</label>
                            <input className="vm-input" type="number" step="0.1" min="30" max="45" placeholder="e.g. 36.6" value={form.temp} onChange={e => set('temp', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Heart Rate / Pulse Rate (bpm)</label>
                            <input className="vm-input" type="number" min="0" placeholder="e.g. 80" value={form.heartRate} onChange={e => set('heartRate', e.target.value)} />
                        </div>
                        {/* Row 3 */}
                        <div className="vm-field">
                            <label className="vm-label">Gestational Age (weeks)</label>
                            <input className="vm-input" type="number" min="0" max="42" placeholder="e.g. 28" value={form.gestationalAge} onChange={e => set('gestationalAge', e.target.value)} />
                        </div>
                        <div className="vm-field">
                            <label className="vm-label">Fetal Heart Rate (bpm)</label>
                            <input className="vm-input" type="number" min="0" placeholder="e.g. 140" value={form.fetalHeartRate} onChange={e => set('fetalHeartRate', e.target.value)} />
                        </div>
                        {/* Row 4 */}
                        <div className="vm-field">
                            <label className="vm-label">Date of Checkup <span className="vm-req">*</span></label>
                            <input className="vm-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
                        </div>
                    </div>

                    <div className="vm-field vm-field--full">
                        <label className="vm-label">Notes / Clinical Remarks</label>
                        <textarea className="vm-textarea" rows={3} placeholder="Enter clinical observations, prescriptions, or follow-up instructions..." value={form.notes} onChange={e => set('notes', e.target.value)} />
                    </div>

                    {/* Previous records for this patient */}
                    {history && history.length > 0 && (
                        <div className="vm-history">
                            <h4 className="vm-history-title">Recent Vitals History</h4>
                            <div className="vm-history-list">
                                {history.slice(0, 3).map((rec, i) => (
                                    <div key={i} className="vm-history-item">
                                        <span className="vm-history-date">{rec.date}</span>
                                        <span className="vm-history-vals">BP: <strong>{rec.bp}</strong> &middot; Wt: <strong>{rec.weight} kg</strong>{rec.fetalHeartRate ? ` · FHR: ${rec.fetalHeartRate} bpm` : ''}</span>
                                        {rec.notes && <p className="vm-history-notes">{rec.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pv-modal-footer">
                        <button type="button" className="vm-btn vm-btn--cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="vm-btn vm-btn--save"><CheckCircle2 size={15} /> Save Vital Record</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ════════════════════════════
   COMPONENT
════════════════════════════ */
const PatientsList = () => {
    const navigate = useNavigate();

    /* ── State ── */
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        trimester: 'All',
        risk: 'All',
        barangay: 'All'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Vitals modal state
    const [vitalModalPatient, setVitalModalPatient] = useState(null);
    const [vitalsHistory, setVitalsHistory] = useState({});
    const [vitalToast, setVitalToast] = useState(false);

    /* ── Filtering Logic ── */
    const filteredPatients = MOCK_PATIENTS.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.barangay.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesTri = filters.trimester === 'All' || p.trimester.toString() === filters.trimester;
        const matchesRisk = filters.risk === 'All' || p.risk === filters.risk;
        const matchesBrgy = filters.barangay === 'All' || p.barangay === filters.barangay;

        return matchesSearch && matchesTri && matchesRisk && matchesBrgy;
    });

    /* ── Pagination Logic ── */
    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

    /* ── Handlers ── */
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

            {/* ── Page Header ── */}
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

            {/* ── Controls Bar ── */}
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
                        <select
                            value={filters.trimester}
                            onChange={(e) => handleFilterChange('trimester', e.target.value)}
                            className="filter-select"
                        >
                            <option value="All">All Trimesters</option>
                            <option value="1">1st Trimester</option>
                            <option value="2">2nd Trimester</option>
                            <option value="3">3rd Trimester</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <span className="filter-icon"><AlertTriangle size={14} /></span>
                        <select
                            value={filters.risk}
                            onChange={(e) => handleFilterChange('risk', e.target.value)}
                            className="filter-select"
                        >
                            <option value="All">All Risks</option>
                            <option value="Normal">Normal</option>
                            <option value="Monitor">Monitor</option>
                            <option value="High">High Risk</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <span className="filter-icon"><MapPin size={14} /></span>
                        <select
                            value={filters.barangay}
                            onChange={(e) => handleFilterChange('barangay', e.target.value)}
                            className="filter-select"
                        >
                            <option value="All">All Barangays</option>
                            {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                <option key={n} value={`Brgy. ${n}`}>Brgy. {n}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Data Table ── */}
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
                                            <div className="cell-name-wrap" onClick={() => navigate(`/dashboard/patients/${p.id}`)}>
                                                <div className="avatar-sm">
                                                    {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                                </div>
                                                <div>
                                                    <span className="patient-name-link">{p.name}</span>
                                                    <span className="patient-status-note">{p.status}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="cell-muted">{p.barangay}</td>
                                        <td className="cell-bold">{p.age}</td>
                                        <td>
                                            <span className={`tri-badge tri-${p.trimester}`}>
                                                T{p.trimester} · {p.weeks}w
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`risk-badge risk-${p.risk.toLowerCase()}`}>
                                                {p.risk}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="cell-appt">
                                                <Clock size={13} className="appt-icon" />
                                                <span className={p.nextAppt === 'Not scheduled' ? 'appt-none' : 'appt-date'}>
                                                    {p.nextAppt}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="actions-group">
                                                <button
                                                    className="action-btn view-btn"
                                                    title="View Profile"
                                                    onClick={() => navigate(`/dashboard/patients/${p.id}`)}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    className="action-btn vitals-btn"
                                                    title="Record Vitals"
                                                    onClick={() => setVitalModalPatient(p)}
                                                >
                                                    <Activity size={16} />
                                                </button>
                                                <button
                                                    className="action-btn sched-btn"
                                                    title="Add Schedule"
                                                    onClick={() => navigate('/dashboard/prenatal', { state: { openBooking: true } })}
                                                >
                                                    <CalendarPlus size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="empty-state">
                                        <User size={32} className="empty-icon" />
                                        <p>No patients found matching your filters.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div className="pagination-wrap">
                        <span className="pagination-info">
                            Showing <strong>{startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredPatients.length)}</strong> of <strong>{filteredPatients.length}</strong> patients
                        </span>
                        <div className="pagination-controls">
                            <button
                                className="page-btn"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                            >
                                <ChevronLeft size={16} />
                            </button>

                            <div className="page-numbers">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                    <button
                                        key={pageNum}
                                        className={`page-num ${currentPage === pageNum ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(pageNum)}
                                    >
                                        {pageNum}
                                    </button>
                                ))}
                            </div>

                            <button
                                className="page-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </div>

        {/* Record Vitals Modal */}
        {vitalModalPatient && (
            <RecordVitalsModal
                patient={vitalModalPatient}
                history={vitalsHistory[vitalModalPatient.id] || []}
                onSave={handleSaveVitals}
                onClose={() => setVitalModalPatient(null)}
            />
        )}

        {/* Vitals Saved Toast */}
        {vitalToast && (
            <div className="vm-toast">
                <CheckCircle2 size={16} /> Vital signs record saved successfully!
            </div>
        )}
    </>
    );
};

export default PatientsList;

