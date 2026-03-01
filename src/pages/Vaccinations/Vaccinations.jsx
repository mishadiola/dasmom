import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, Syringe, Pill, Package,
    AlertTriangle, CheckCircle2, Clock, XCircle,
    Eye, Edit2, Calendar, Download, RefreshCw, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import '../../styles/pages/Vaccinations.css';

/* ════════════════════════════════════
   MOCK DATA
════════════════════════════════════ */
const SUMMARY_STATS = [
    { label: 'Total Vaccinations Administered', value: 1250, color: 'blue', icon: Syringe },
    { label: 'Mothers Pending Vaccines', value: 42, color: 'yellow', icon: AlertCircle },
    { label: 'Newborns Pending Vaccines', value: 18, color: 'orange', icon: AlertCircle },
    { label: 'Supplements Distributed', value: '1,500', unit: 'tablets', color: 'green', icon: Pill },
    { label: 'Low Stock Items', value: 3, color: 'rose', icon: Package },
];

const VACCINES = [
    { id: 'V-001', patientId: 'PT-2401', patientName: 'Maria Reyes', type: 'Mother', vaccine: 'Tetanus Toxoid (TT)', dose: '2nd Dose', dateAdministered: '2026-02-20', nextDue: '2026-04-20', status: 'Pending', staff: 'Nurse Ana', barangay: 'Brgy. 3' },
    { id: 'V-002', patientId: 'NB-0101', patientName: 'Baby Santos', type: 'Newborn', vaccine: 'BCG', dose: '1st Dose', dateAdministered: '2026-02-22', nextDue: null, status: 'Completed', staff: 'Midwife Elena', barangay: 'Brgy. 1' },
    { id: 'V-003', patientId: 'PT-2403', patientName: 'Elena Santos', type: 'Mother', vaccine: 'Tetanus Toxoid (TT)', dose: '1st Dose', dateAdministered: '2026-01-15', nextDue: '2026-02-15', status: 'Overdue', staff: 'Nurse Bea', barangay: 'Brgy. 5' },
    { id: 'V-004', patientId: 'NB-0203', patientName: 'Baby Cruz', type: 'Newborn', vaccine: 'Hepatitis B (HepB)', dose: '1st Dose', dateAdministered: '2026-02-28', nextDue: '2026-03-28', status: 'Pending', staff: 'Midwife Ana', barangay: 'Brgy. 2' },
    { id: 'V-005', patientId: 'PT-2404', patientName: 'Rosa Diaz', type: 'Mother', vaccine: 'Influenza', dose: 'Annual', dateAdministered: '2026-02-10', nextDue: '2027-02-10', status: 'Completed', staff: 'Dr. Reyes', barangay: 'Brgy. 7' },
    { id: 'V-006', patientId: 'NB-0305', patientName: 'Baby Gomez', type: 'Newborn', vaccine: 'OPV', dose: '1st Dose', dateAdministered: '2026-02-25', nextDue: '2026-03-25', status: 'Pending', staff: 'Nurse Ana', barangay: 'Brgy. 2' },
    { id: 'V-007', patientId: 'PT-2405', patientName: 'Clara Gomez', type: 'Mother', vaccine: 'Tetanus Toxoid (TT)', dose: '3rd Dose', dateAdministered: '2026-01-05', nextDue: '2026-02-05', status: 'Overdue', staff: 'Midwife Elena', barangay: 'Brgy. 4' },
    { id: 'V-008', patientId: 'NB-0407', patientName: 'Baby Ramos', type: 'Newborn', vaccine: 'BCG', dose: '1st Dose', dateAdministered: null, nextDue: '2026-03-05', status: 'Pending', staff: '—', barangay: 'Brgy. 6' },
];

const SUPPLEMENTS = [
    { id: 'S-001', patientId: 'PT-2401', patientName: 'Maria Reyes', type: 'Mother', supplement: 'Iron', dose: '60 mg/day', startDate: '2026-01-10', endDate: '2026-04-10', status: 'Ongoing', staff: 'Nurse Ana', barangay: 'Brgy. 3' },
    { id: 'S-002', patientId: 'PT-2402', patientName: 'Ana Cruz', type: 'Mother', supplement: 'Folic Acid', dose: '400 mcg/day', startDate: '2026-02-01', endDate: '2026-05-01', status: 'Ongoing', staff: 'Midwife Elena', barangay: 'Brgy. 1' },
    { id: 'S-003', patientId: 'PT-2403', patientName: 'Elena Santos', type: 'Mother', supplement: 'Calcium', dose: '500 mg/day', startDate: '2026-01-15', endDate: '2026-04-15', status: 'Missed', staff: 'Nurse Bea', barangay: 'Brgy. 5' },
    { id: 'S-004', patientId: 'NB-0101', patientName: 'Baby Santos', type: 'Newborn', supplement: 'Vitamin D', dose: '400 IU/day', startDate: '2026-02-22', endDate: '2026-08-22', status: 'Ongoing', staff: 'Midwife Elena', barangay: 'Brgy. 1' },
    { id: 'S-005', patientId: 'PT-2405', patientName: 'Clara Gomez', type: 'Mother', supplement: 'Iron', dose: '60 mg/day', startDate: '2026-01-30', endDate: '2026-04-30', status: 'Missed', staff: 'Midwife Ana', barangay: 'Brgy. 4' },
    { id: 'S-006', patientId: 'PT-2406', patientName: 'Luz Ramos', type: 'Mother', supplement: 'Folic Acid', dose: '400 mcg/day', startDate: '2025-09-01', endDate: '2026-01-01', status: 'Completed', staff: 'Nurse Ana', barangay: 'Brgy. 6' },
];

const STOCK = [
    { item: 'Tetanus Toxoid (TT)', quantity: 12, unit: 'vials', threshold: 20, status: 'Low' },
    { item: 'Iron Tablets', quantity: 320, unit: 'tablets', threshold: 500, status: 'Critical' },
    { item: 'Folic Acid', quantity: 15, unit: 'strips', threshold: 50, status: 'Critical' },
    { item: 'Calcium Tablets', quantity: 60, unit: 'tablets', threshold: 100, status: 'Low' },
    { item: 'BCG Vaccine', quantity: 8, unit: 'vials', threshold: 10, status: 'Low' },
    { item: 'Hepatitis B (HepB)', quantity: 38, unit: 'vials', threshold: 20, status: 'Sufficient' },
    { item: 'Vitamin D Drops', quantity: 45, unit: 'bottles', threshold: 20, status: 'Sufficient' },
    { item: 'OPV', quantity: 22, unit: 'vials', threshold: 15, status: 'Sufficient' },
];

const STOCK_ALERTS = [
    { text: 'Iron Tablets critically low — only 320 remaining', type: 'critical', time: '1 hour ago' },
    { text: 'Folic Acid stock below threshold — reorder needed', type: 'critical', time: '2 hours ago' },
    { text: 'Tetanus Toxoid (TT) running low — 12 vials left', type: 'warning', time: '5 hours ago' },
    { text: 'Elena Santos TT 1st dose is 2 weeks overdue', type: 'warning', time: 'Yesterday' },
];

const VACCINE_TYPES = ['Tetanus Toxoid (TT)', 'BCG', 'Hepatitis B (HepB)', 'Influenza', 'OPV', 'DPT'];
const SUPPLEMENT_TYPES = ['Iron', 'Folic Acid', 'Calcium', 'Vitamin D'];
const STAFF_LIST = ['Nurse Ana', 'Nurse Bea', 'Midwife Elena', 'Midwife Ana', 'Dr. Reyes (OB)'];

/* ════════════════════════════════════
   RECORD MODAL COMPONENT
════════════════════════════════════ */
const RecordModal = ({ mode, onClose }) => {
    const [form, setForm] = useState({
        patientType: 'Mother', patientName: '', vaccine: '',
        supplement: '', dose: '', date: '', nextDue: '', staff: STAFF_LIST[0], notes: ''
    });
    const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="vacc-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2><Syringe size={20} /> Record Vaccination</h2>
                        <p>{mode === 'vaccine' ? 'Log a vaccine dose for a mother or newborn.' : 'Record supplement distribution.'}</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label>Patient Type <span className="req">*</span></label>
                            <select value={form.patientType} onChange={e => updateForm('patientType', e.target.value)}>
                                <option>Mother</option>
                                <option>Newborn</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Patient Name / ID <span className="req">*</span></label>
                            <input type="text" placeholder="Search patient..." value={form.patientName} onChange={e => updateForm('patientName', e.target.value)} />
                        </div>
                    </div>
                    {mode === 'vaccine' ? (
                        <>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Vaccine Name <span className="req">*</span></label>
                                    <select value={form.vaccine} onChange={e => updateForm('vaccine', e.target.value)}>
                                        <option value="">Select Vaccine</option>
                                        {VACCINE_TYPES.map(v => <option key={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Dose <span className="req">*</span></label>
                                    <select value={form.dose} onChange={e => updateForm('dose', e.target.value)}>
                                        <option value="">Select Dose</option>
                                        <option>1st Dose</option>
                                        <option>2nd Dose</option>
                                        <option>3rd Dose</option>
                                        <option>Booster</option>
                                        <option>Annual</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Date Administered <span className="req">*</span></label>
                                    <input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Next Due Date</label>
                                    <input type="date" value={form.nextDue} onChange={e => updateForm('nextDue', e.target.value)} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Supplement Type <span className="req">*</span></label>
                                    <select value={form.supplement} onChange={e => updateForm('supplement', e.target.value)}>
                                        <option value="">Select Supplement</option>
                                        {SUPPLEMENT_TYPES.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Dose / Quantity <span className="req">*</span></label>
                                    <input type="text" placeholder="e.g. 60 mg/day or 1 tablet" value={form.dose} onChange={e => updateForm('dose', e.target.value)} />
                                </div>
                            </div>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Start Date <span className="req">*</span></label>
                                    <input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>End Date</label>
                                    <input type="date" value={form.nextDue} onChange={e => updateForm('nextDue', e.target.value)} />
                                </div>
                            </div>
                        </>
                    )}
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label>Administered By <span className="req">*</span></label>
                            <select value={form.staff} onChange={e => updateForm('staff', e.target.value)}>
                                {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Notes (optional)</label>
                            <input type="text" placeholder="Any relevant notes..." value={form.notes} onChange={e => updateForm('notes', e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={onClose}><CheckCircle2 size={15} /> Confirm &amp; Save</button>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
const Vaccinations = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('vaccines');    // 'vaccines' | 'supplements'
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ patientType: 'All', status: 'All', item: 'All' });
    const [recordModal, setRecordModal] = useState(null);      // null | 'vaccine' | 'supplement'
    const [expandedRows, setExpandedRows] = useState({});
    const [sortField, setSortField] = useState('');
    const [sortAsc, setSortAsc] = useState(true);

    const handleFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSort = (field) => {
        if (sortField === field) setSortAsc(prev => !prev);
        else { setSortField(field); setSortAsc(true); }
    };

    // ── Filter + sort vaccines ──
    const filteredVaccines = VACCINES
        .filter(v => {
            const s = searchTerm.toLowerCase();
            const matchSearch = v.patientName.toLowerCase().includes(s) || v.patientId.toLowerCase().includes(s) || v.barangay.toLowerCase().includes(s);
            const matchType = filters.patientType === 'All' || v.type === filters.patientType;
            const matchStatus = filters.status === 'All' || v.status === filters.status;
            const matchItem = filters.item === 'All' || v.vaccine === filters.item;
            return matchSearch && matchType && matchStatus && matchItem;
        })
        .sort((a, b) => {
            if (!sortField) return 0;
            const va = a[sortField] ?? ''; const vb = b[sortField] ?? '';
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });

    // ── Filter + sort supplements ──
    const filteredSupplements = SUPPLEMENTS
        .filter(s => {
            const q = searchTerm.toLowerCase();
            const matchSearch = s.patientName.toLowerCase().includes(q) || s.patientId.toLowerCase().includes(q) || s.barangay.toLowerCase().includes(q);
            const matchType = filters.patientType === 'All' || s.type === filters.patientType;
            const matchStatus = filters.status === 'All' || s.status === filters.status;
            const matchItem = filters.item === 'All' || s.supplement === filters.item;
            return matchSearch && matchType && matchStatus && matchItem;
        });

    const SortBtn = ({ field }) => (
        <button className="sort-btn" onClick={() => handleSort(field)}>
            {sortField === field ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} className="sort-inactive" />}
        </button>
    );

    const vaccineStatusClass = (s) => {
        if (s === 'Completed') return 'status-completed';
        if (s === 'Overdue') return 'status-overdue';
        return 'status-pending';
    };

    const supplementStatusClass = (s) => {
        if (s === 'Completed') return 'status-completed';
        if (s === 'Missed') return 'status-missed';
        return 'status-ongoing';
    };

    const stockStatusClass = (s) => {
        if (s === 'Sufficient') return 'stock-ok';
        if (s === 'Low') return 'stock-low';
        return 'stock-critical';
    };

    const stockPct = (item) => Math.min(100, Math.round((item.quantity / (item.threshold * 2)) * 100));

    const itemOptions = activeTab === 'vaccines' ? VACCINE_TYPES : SUPPLEMENT_TYPES;

    return (
        <div className="vacc-page">

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Syringe size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Vaccinations &amp; Supplements</h1>
                    <p className="page-subtitle">Track vaccine doses, supplements, and facility stock levels for mothers and newborns</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline"><Download size={16} /> Export Report</button>
                    <button className="btn btn-outline" onClick={() => setRecordModal('supplement')}><Pill size={16} /> Record Supplement</button>
                    <button className="btn btn-primary" onClick={() => setRecordModal('vaccine')}><Syringe size={16} /> Record Vaccination</button>
                </div>
            </div>

            {/* ── Summary Stats ── */}
            <div className="vacc-stats-grid">
                {SUMMARY_STATS.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className={`vacc-stat-card vacc-stat--${s.color}`}>
                            <div className={`vacc-stat-icon vacc-icon--${s.color}`}><Icon size={20} /></div>
                            <div className="vacc-stat-value">{s.value}{s.unit && <span className="vacc-stat-unit"> {s.unit}</span>}</div>
                            <div className="vacc-stat-label">{s.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Search & Filters ── */}
            <div className="vacc-controls">
                <div className="vacc-search-wrap">
                    <Search size={16} className="vacc-search-icon" />
                    <input
                        type="text"
                        className="vacc-search-input"
                        placeholder="Search by patient name, ID, or barangay..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="vacc-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.patientType} onChange={e => handleFilter('patientType', e.target.value)}>
                        <option value="All">All Patient Types</option>
                        <option value="Mother">Mother</option>
                        <option value="Newborn">Newborn</option>
                    </select>
                    <select value={filters.item} onChange={e => handleFilter('item', e.target.value)}>
                        <option value="All">{activeTab === 'vaccines' ? 'All Vaccines' : 'All Supplements'}</option>
                        {itemOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={filters.status} onChange={e => handleFilter('status', e.target.value)}>
                        <option value="All">All Statuses</option>
                        {activeTab === 'vaccines'
                            ? <><option value="Completed">Completed</option><option value="Pending">Pending</option><option value="Overdue">Overdue</option></>
                            : <><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option><option value="Missed">Missed</option></>
                        }
                    </select>
                </div>
            </div>

            {/* ── Main 2-col layout ── */}
            <div className="vacc-main-layout">

                {/* ── LEFT: Tables ── */}
                <div className="vacc-table-col">

                    {/* Tab Switcher */}
                    <div className="vacc-tabs">
                        <button className={`vacc-tab ${activeTab === 'vaccines' ? 'active' : ''}`} onClick={() => setActiveTab('vaccines')}>
                            <Syringe size={15} /> Vaccinations
                        </button>
                        <button className={`vacc-tab ${activeTab === 'supplements' ? 'active' : ''}`} onClick={() => setActiveTab('supplements')}>
                            <Pill size={15} /> Supplements
                        </button>
                    </div>

                    <div className="vacc-card">
                        <div className="vacc-card-head">
                            <h2>{activeTab === 'vaccines' ? <><Syringe size={16} /> Vaccination Records</> : <><Pill size={16} /> Supplement Records</>}</h2>
                            <div className="vacc-legend">
                                {activeTab === 'vaccines' ? (
                                    <>
                                        <span className="legend-chip chip-completed"><CheckCircle2 size={11} /> Completed</span>
                                        <span className="legend-chip chip-pending"><Clock size={11} /> Pending</span>
                                        <span className="legend-chip chip-overdue"><AlertTriangle size={11} /> Overdue</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="legend-chip chip-completed"><CheckCircle2 size={11} /> Completed</span>
                                        <span className="legend-chip chip-pending"><Pill size={11} /> Ongoing</span>
                                        <span className="legend-chip chip-missed"><XCircle size={11} /> Missed</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* VACCINES TABLE */}
                        {activeTab === 'vaccines' && (
                            <div className="table-responsive">
                                <table className="vacc-table">
                                    <thead>
                                        <tr>
                                            <th><span onClick={() => handleSort('patientName')} className="sortable-head">Patient <SortBtn field="patientName" /></span></th>
                                            <th>Type</th>
                                            <th><span onClick={() => handleSort('vaccine')} className="sortable-head">Vaccine <SortBtn field="vaccine" /></span></th>
                                            <th>Dose</th>
                                            <th>Date Given</th>
                                            <th>Next Due</th>
                                            <th>Status</th>
                                            <th>Staff</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVaccines.map(v => (
                                            <React.Fragment key={v.id}>
                                                <tr className={`vacc-row vacc-row--${v.status.toLowerCase()}`}>
                                                    <td>
                                                        <button className="expand-btn" onClick={() => toggleRow(v.id)}>
                                                            {expandedRows[v.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                        </button>
                                                        <div className="vacc-patient">
                                                            <div className="vacc-avatar">{v.patientName.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
                                                            <div>
                                                                <span className="vacc-name">{v.patientName}</span>
                                                                <span className="vacc-pid">{v.patientId} · {v.barangay}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className={`type-badge type-${v.type.toLowerCase()}`}>{v.type}</span></td>
                                                    <td className="vacc-item-name">{v.vaccine}</td>
                                                    <td className="vacc-dose">{v.dose}</td>
                                                    <td className="vacc-date">{v.dateAdministered || <span className="not-yet">Not given</span>}</td>
                                                    <td className="vacc-date">{v.nextDue || <span className="not-yet">—</span>}</td>
                                                    <td><span className={`vacc-status ${vaccineStatusClass(v.status)}`}>{v.status}</span></td>
                                                    <td className="vacc-staff">{v.staff}</td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="action-btn record-btn" title="Record Dose" onClick={() => setRecordModal('vaccine')}><Plus size={13} /></button>
                                                            <button className="action-btn edit-btn" title="Edit"><Edit2 size={13} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedRows[v.id] && (
                                                    <tr className="vacc-expanded-row">
                                                        <td colSpan="9">
                                                            <div className="expand-detail">
                                                                <div><strong>Patient ID:</strong> {v.patientId}</div>
                                                                <div><strong>Barangay:</strong> {v.barangay}</div>
                                                                <div><strong>Vaccine:</strong> {v.vaccine} — {v.dose}</div>
                                                                <div><strong>Administered by:</strong> {v.staff}</div>
                                                                {v.dateAdministered && <div><strong>Date Given:</strong> {v.dateAdministered}</div>}
                                                                {v.nextDue && <div><strong>Next Due:</strong> {v.nextDue}</div>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                        {filteredVaccines.length === 0 && (
                                            <tr><td colSpan="9" className="vacc-empty"><Syringe size={24} /><p>No vaccination records match your filters.</p></td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* SUPPLEMENTS TABLE */}
                        {activeTab === 'supplements' && (
                            <div className="table-responsive">
                                <table className="vacc-table">
                                    <thead>
                                        <tr>
                                            <th>Patient</th>
                                            <th>Type</th>
                                            <th>Supplement</th>
                                            <th>Dose</th>
                                            <th>Start Date</th>
                                            <th>End Date</th>
                                            <th>Status</th>
                                            <th>Staff</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSupplements.map(s => (
                                            <tr key={s.id} className={`vacc-row supp-row--${s.status.toLowerCase()}`}>
                                                <td>
                                                    <div className="vacc-patient">
                                                        <div className="vacc-avatar">{s.patientName.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
                                                        <div>
                                                            <span className="vacc-name">{s.patientName}</span>
                                                            <span className="vacc-pid">{s.patientId} · {s.barangay}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span className={`type-badge type-${s.type.toLowerCase()}`}>{s.type}</span></td>
                                                <td className="vacc-item-name">{s.supplement}</td>
                                                <td className="vacc-dose">{s.dose}</td>
                                                <td className="vacc-date">{s.startDate}</td>
                                                <td className="vacc-date">{s.endDate}</td>
                                                <td><span className={`vacc-status ${supplementStatusClass(s.status)}`}>{s.status}</span></td>
                                                <td className="vacc-staff">{s.staff}</td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="action-btn record-btn" title="Record Intake" onClick={() => setRecordModal('supplement')}><Plus size={13} /></button>
                                                        <button className="action-btn edit-btn" title="Edit"><Edit2 size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredSupplements.length === 0 && (
                                            <tr><td colSpan="9" className="vacc-empty"><Pill size={24} /><p>No supplement records match your filters.</p></td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT SIDE PANELS ── */}
                <div className="vacc-side-col">

                    {/* Stock Monitoring Panel */}
                    <div className="vacc-card">
                        <div className="vacc-card-head">
                            <h2><Package size={16} /> Stock Monitoring</h2>
                            <button className="icon-btn-sm" title="Refresh"><RefreshCw size={13} /></button>
                        </div>
                        <div className="stock-list">
                            {STOCK.map(s => (
                                <div key={s.item} className={`stock-row stock-row--${s.status.toLowerCase()}`}>
                                    <div className="stock-info">
                                        <span className="stock-name">{s.item}</span>
                                        <span className="stock-qty">{s.quantity} {s.unit}</span>
                                    </div>
                                    <div className="stock-bar-bg">
                                        <div
                                            className="stock-bar-fill"
                                            style={{ width: `${stockPct(s)}%`, background: s.status === 'Sufficient' ? '#6db8a0' : s.status === 'Low' ? '#e8b84b' : '#e05c73' }}
                                        ></div>
                                    </div>
                                    <span className={`stock-badge ${stockStatusClass(s.status)}`}>{s.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alerts Panel */}
                    <div className="vacc-card">
                        <div className="vacc-card-head">
                            <h2><AlertTriangle size={16} /> Alerts</h2>
                        </div>
                        <div className="alerts-list">
                            {STOCK_ALERTS.map((a, i) => (
                                <div key={i} className={`alert-item alert-${a.type}`}>
                                    <div className="alert-dot"></div>
                                    <div className="alert-body">
                                        <p>{a.text}</p>
                                        <span>{a.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Record Modal ── */}
            {recordModal && <RecordModal mode={recordModal} onClose={() => setRecordModal(null)} />}
        </div>
    );
};

export default Vaccinations;
