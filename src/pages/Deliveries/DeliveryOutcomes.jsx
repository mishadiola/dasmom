import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, Baby, Heart, AlertTriangle,
    CheckCircle2, Clock, AlertCircle, FileText, Download,
    Eye, Edit2, Printer, Activity, User, Calendar,
    Stethoscope, MapPin, ChevronDown, ChevronUp, TrendingUp
} from 'lucide-react';
import '../../styles/pages/DeliveryOutcomes.css';
import babyservices from '../../services/babyservices';

const COMPLICATION_OPTIONS = ['None', 'Hemorrhage', 'Infection', 'Preeclampsia', 'Placenta Previa', 'Preterm'];
const STAFF_LIST = ['Midwife Elena P.', 'Midwife Ana M.', 'Dr. Reyes (OB)', 'Nurse Bea'];
const FACILITIES = ['Main Clinic', 'BHS 1', 'BHS 2', 'BHS 3', 'BHS 4', 'BHS 5', 'BHS 6', 'BHS 7'];

const AddDeliveryModal = ({ onClose, onSuccess }) => {
    const [section, setSection] = useState('patient');
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);

    const [form, setForm] = useState({
        patientId: '',
        patientName: '',
        age: '',
        station: '',
        gestationalAge: '',
        riskLevel: 'Normal',
        deliveryDate: new Date().toISOString().split('T')[0],
        deliveryTime: '',
        deliveryType: 'NSD',
        deliveryMode: '',
        staff: STAFF_LIST[0],
        facility: FACILITIES[0],
        complications: ['None'],
        babyGender: 'Female',
        babyWeight: '',
        babyLength: '',
        headCircumference: '',
        apgar1: '',
        apgar5: '',
        babyCondition: 'Healthy',
        postpartumDate: '',
        notes: ''
    });

    const update = (k, v) => {
        setForm(prev => ({ ...prev, [k]: v }));
        if (k === 'patientName' && v.length > 2) handleSearch(v);
        if (k === 'patientName' && v.length <= 2) setShowResults(false);
    };

    const handleSearch = async (q) => {
        try {
            const results = await babyservices.searchPregnantMothers(q);
            setSearchResults(results); // remove setShowResults entirely
        } catch (err) {
            console.error('Search failed:', err);
            setSearchResults([]);
        }
        };

    const selectPatient = (p) => {
        setForm(prev => ({
            ...prev,
            patientId: p.id,
            patientName: p.name,
            station: p.station,
            riskLevel: p.riskLevel
        }));
        setShowResults(false);
    };

    const toggleComplication = (c) => {
        setForm(prev => {
            const current = [...prev.complications];
            if (c === 'None') return { ...prev, complications: ['None'] };
            const without = current.filter(x => x !== 'None');
            return {
                ...prev,
                complications: without.includes(c) ? without.filter(x => x !== c) : [...without, c]
            };
        });
    };

    const handleSave = async () => {
        if (!form.patientId || !form.deliveryDate) {
            alert('Please select a patient and delivery date.');
            return;
        }

        setLoading(true);
        try {
            await babyservices.recordDelivery(
                {
                    mother_id: form.patientId,
                    delivery_date: form.deliveryDate,
                    delivery_time: form.deliveryTime || '00:00',
                    delivery_type: form.deliveryType,
                    delivery_mode: form.deliveryMode || null,
                    gestational_age: form.gestationalAge || null,
                    risk_level: form.riskLevel || 'Normal',
                    complications: form.complications,
                    attending_staff: null,
                    facility: form.facility || null,
                    postpartum_visit_date: form.postpartumDate || null,
                    notes: form.notes || null
                },
                {
                    baby_name: null,
                    gender: form.babyGender,
                    birth_weight: form.babyWeight ? Number(form.babyWeight) : null,
                    birth_length: form.babyLength ? Number(form.babyLength) : null,
                    head_circumference: form.headCircumference ? Number(form.headCircumference) : null,
                    apgar_1min: form.apgar1 ? Number(form.apgar1) : null,
                    apgar_5min: form.apgar5 ? Number(form.apgar5) : null,
                    condition_at_birth: form.babyCondition,
                    risk_level: form.riskLevel || 'Normal'
                }
            );
            onSuccess();
        } catch (err) {
            console.error('Failed to save delivery record:', err);
            alert('Failed to save delivery record. Please check the logs.');
        } finally {
            setLoading(false);
        }
    };

    const SECTIONS = [
        { id: 'patient', label: 'Patient Info', icon: User },
        { id: 'delivery', label: 'Delivery Details', icon: Stethoscope },
        { id: 'complications', label: 'Complications', icon: AlertTriangle },
        { id: 'baby', label: 'Baby Info', icon: Baby },
        { id: 'plan', label: 'Postpartum Plan', icon: Calendar }
    ];

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="do-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2><Stethoscope size={20} /> Record New Delivery</h2>
                        <p>Document the birth event and link it to the mother's record.</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-nav">
                    {SECTIONS.map(s => {
                        const Icon = s.icon;
                        return (
                            <button
                                key={s.id}
                                className={`modal-nav-btn ${section === s.id ? 'active' : ''}`}
                                onClick={() => setSection(s.id)}
                            >
                                <Icon size={14} /> {s.label}
                            </button>
                        );
                    })}
                </div>

                <div className="modal-body">
                    {section === 'patient' && (
                        <div className="modal-section-body">
                            <div className="form-grid-2">
                                <div className="form-group" style={{ position: 'relative' }}>
                                    <label>Search Patient Name <span className="req">*</span></label>
                                    <div className="search-input-wrap">
                                        <input
                                            type="text"
                                            placeholder="Type mother's name..."
                                            value={form.patientName}
                                            onChange={e => update('patientName', e.target.value)}
                                            autoComplete="off"
                                        />
                                        {searchResults.length > 0 && (
                                        <div className="search-results-dropdown">
                                            {searchResults.map(p => (
                                            <div key={p.id} className="search-result-item" onClick={() => selectPatient(p)}>
                                                <div className="res-name">{p.name}</div>
                                                <div className="res-meta">{p.id} · {p.station} · {p.isPregnant ? 'Pregnant' : 'Status: ' + p.riskLevel}</div>
                                            </div>
                                            ))}
                                        </div>
                                        )}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Patient ID</label>
                                    <input type="text" value={form.patientId} readOnly className="readonly-field" />
                                </div>
                                <div className="form-group">
                                    <label>Station</label>
                                    <input type="text" value={form.station} readOnly className="readonly-field" />
                                </div>
                                <div className="form-group">
                                    <label>Risk Level</label>
                                    <input type="text" value={form.riskLevel} readOnly className="readonly-field" />
                                </div>
                                <div className="form-group">
                                    <label>Gestational Age (at delivery)</label>
                                    <input type="text" placeholder="e.g. 38w 4d" value={form.gestationalAge} onChange={e => update('gestationalAge', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {section === 'delivery' && (
                        <div className="modal-section-body">
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Date <span className="req">*</span></label>
                                    <input type="date" value={form.deliveryDate} onChange={e => update('deliveryDate', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Time</label>
                                    <input type="time" value={form.deliveryTime} onChange={e => update('deliveryTime', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Type <span className="req">*</span></label>
                                    <select value={form.deliveryType} onChange={e => update('deliveryType', e.target.value)}>
                                        <option value="NSD">NSD (Normal)</option>
                                        <option value="CS">CS (Cesarean)</option>
                                        <option value="Breech">Breech</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Delivery Mode</label>
                                    <select value={form.deliveryMode} onChange={e => update('deliveryMode', e.target.value)}>
                                        <option value="">Select mode</option>
                                        <option value="Normal Spontaneous Delivery">Normal Spontaneous Delivery</option>
                                        <option value="Cesarean Section">Cesarean Section</option>
                                        <option value="Assisted Delivery">Assisted Delivery</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Staff</label>
                                    <select value={form.staff} onChange={e => update('staff', e.target.value)}>
                                        {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Facility</label>
                                    <select value={form.facility} onChange={e => update('facility', e.target.value)}>
                                        {FACILITIES.map(f => <option key={f}>{f}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {section === 'complications' && (
                        <div className="modal-section-body">
                            <div className="complication-grid">
                                {COMPLICATION_OPTIONS.map(c => (
                                    <label key={c} className={`complication-chip ${form.complications.includes(c) ? 'selected' : ''}`}>
                                        <input type="checkbox" checked={form.complications.includes(c)} onChange={() => toggleComplication(c)} />
                                        {c}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {section === 'baby' && (
                        <div className="modal-section-body">
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Birth Weight (kg)</label>
                                    <input type="number" step="0.1" value={form.babyWeight} onChange={e => update('babyWeight', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Birth Length (cm)</label>
                                    <input type="number" step="0.1" value={form.babyLength} onChange={e => update('babyLength', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Head Circumference (cm)</label>
                                    <input type="number" step="0.1" value={form.headCircumference} onChange={e => update('headCircumference', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Gender</label>
                                    <select value={form.babyGender} onChange={e => update('babyGender', e.target.value)}>
                                        <option>Male</option>
                                        <option>Female</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>APGAR score (1 min)</label>
                                    <input type="number" value={form.apgar1} onChange={e => update('apgar1', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>APGAR score (5 min)</label>
                                    <input type="number" value={form.apgar5} onChange={e => update('apgar5', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Baby Condition</label>
                                    <select value={form.babyCondition} onChange={e => update('babyCondition', e.target.value)}>
                                        <option>Healthy</option>
                                        <option>NICU</option>
                                        <option>Special Care</option>
                                        <option>Stillbirth</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {section === 'plan' && (
                        <div className="modal-section-body">
                            <div className="form-group">
                                <label>Scheduled Postpartum Visit</label>
                                <input type="date" value={form.postpartumDate} onChange={e => update('postpartumDate', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows="3"></textarea>
                            </div>
                            <div className="auto-links-box">
                                <h4><CheckCircle2 size={14} /> Automatic System Actions:</h4>
                                <ul>
                                    <li>Registers baby in Newborn Tracking</li>
                                    <li>Updates mother's status to Postpartum</li>
                                    <li>Schedules initial postpartum checkup</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
                    {section !== 'plan' ? (
                        <button className="btn btn-primary" onClick={() => {
                            const idx = SECTIONS.findIndex(s => s.id === section);
                            setSection(SECTIONS[idx + 1].id);
                        }}>Next Stage →</button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Finalize Delivery Record'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const DeliveryOutcomes = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        type: 'All',
        risk: 'All',
        complication: 'All',
        station: 'All',
        view: 'outcomes'
    });
    const [showModal, setShowModal] = useState(false);
    const [sortField, setSortField] = useState('deliveryDate');
    const [sortAsc, setSortAsc] = useState(false);
    const [deliveries, setDeliveries] = useState([]);
    const [upcoming, setUpcoming] = useState([]);
    const [stats, setStats] = useState([
        { label: 'Total Deliveries', value: 0, color: 'lilac', icon: Baby },
        { label: 'Normal vs CS', value: '0 / 0', color: 'sage', icon: CheckCircle2 },
        { label: 'Complications', value: 0, color: 'orange', icon: AlertTriangle },
        { label: 'High-Risk Deliveries', value: 0, color: 'rose', icon: AlertCircle }
    ]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allDeliv, allStats] = await Promise.all([
                babyservices.getAllDeliveries(),
                babyservices.getDeliveryStats()
            ]);
            setDeliveries(allDeliv || []);
            setUpcoming([]);
            setStats(allStats || []);
        } catch (err) {
            console.error('Error loading delivery outcomes:', err);
            setDeliveries([]);
            setUpcoming([]);
            setStats([
                { label: 'Total Deliveries', value: 0, color: 'lilac', icon: Baby },
                { label: 'Normal vs CS', value: '0 / 0', color: 'sage', icon: CheckCircle2 },
                { label: 'Complications', value: 0, color: 'orange', icon: AlertTriangle },
                { label: 'High-Risk Deliveries', value: 0, color: 'rose', icon: AlertCircle }
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    const handleSort = (field) => {
        if (sortField === field) setSortAsc(prev => !prev);
        else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const currentData = filters.view === 'outcomes' ? deliveries : upcoming;

    const filtered = useMemo(() => {
        return currentData
            .filter(d => {
                const s = searchTerm.toLowerCase();
                const patientName = d.patientName || '';
                const patientId = d.patientId || '';
                const station = d.station || '';

                const matchSearch =
                    patientName.toLowerCase().includes(s) ||
                    patientId.toString().toLowerCase().includes(s) ||
                    station.toLowerCase().includes(s);

                const matchType = filters.type === 'All' || d.deliveryType === filters.type;
                const matchRisk = filters.risk === 'All' || d.riskLevel === filters.risk;
                const matchComp = filters.complication === 'All' || (filters.complication === 'None' ? d.complications === 'None' : d.complications !== 'None');
                const matchStation = filters.station === 'All' || d.station === filters.station;

                return matchSearch && matchType && matchRisk && matchComp && matchStation;
            })
            .sort((a, b) => {
                const field = sortField || (filters.view === 'outcomes' ? 'deliveryDate' : 'edd');
                const va = a[field] ?? '';
                const vb = b[field] ?? '';
                return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            });
    }, [currentData, searchTerm, filters, sortField, sortAsc]);

    const getRowClass = (d) => {
        if (d.riskLevel === 'High' || (d.complications && d.complications !== 'None')) return 'do-row--complication';
        if (d.riskLevel === 'Monitor') return 'do-row--monitor';
        return 'do-row--normal';
    };

    const getRiskBadge = (r) => {
        if (r === 'High' || r === 'High Risk') return 'risk-high';
        if (r === 'Monitor') return 'risk-monitor';
        return 'risk-normal';
    };

    const getBabyBadge = (b) => {
        if (b === 'NICU' || b === 'Special Care') return 'baby-nicu';
        if (b === 'Stillbirth') return 'baby-stillbirth';
        return 'baby-alive';
    };

    const SortBtn = ({ field }) => (
        <button className="sort-btn" onClick={() => handleSort(field)}>
            {sortField === field ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="sort-inactive" />}
        </button>
    );

    const total = deliveries.length;
    const nsdCount = deliveries.filter(d => d.deliveryType === 'NSD').length;
    const csCount = deliveries.filter(d => d.deliveryType === 'CS').length;
    const nsdPct = total > 0 ? Math.round((nsdCount / total) * 100) : 0;
    const csPct = total > 0 ? Math.round((csCount / total) * 100) : 0;

    const resolveIcon = (icon) => {
        const Icon = icon;
        return typeof Icon === 'function' ? Icon : Baby;
    };

    return (
        <div className="do-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><Stethoscope size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Delivery Outcomes</h1>
                    <p className="page-subtitle">Record and monitor birth events — type, outcome, complications, and baby status</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline"><Download size={16} /> Export Report</button>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Record New Delivery</button>
                </div>
            </div>

            <div className="do-stats-grid">
                {stats.map(s => {
                    const Icon = resolveIcon(s.icon);
                    return (
                        <div key={s.label} className={`stat-card stat-card--${s.color}`}>
                            <div className="stat-top">
                                <div className={`stat-icon stat-icon--${s.color}`}>
                                    <Icon size={20} />
                                </div>
                            </div>
                            <div className="stat-value">{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    );
                })}
            </div>

            <div className="do-chart-bar-wrap">
                <div className="do-chart-bar">
                    <div className="chart-label-row">
                        <span className="chart-label chart-label--nsd">NSD: {nsdCount} ({nsdPct}%)</span>
                        <span className="chart-label chart-label--cs">CS: {csCount} ({csPct}%)</span>
                    </div>
                    <div className="chart-bar-track">
                        <div className="chart-bar-nsd" style={{ width: `${nsdPct}%` }}></div>
                        <div className="chart-bar-cs" style={{ width: `${csPct}%` }}></div>
                    </div>
                    <p className="chart-caption">NSD vs CS — {total} recorded deliveries</p>
                </div>
            </div>

            <div className="do-controls">
                <div className="do-search-wrap">
                    <Search size={16} className="do-search-icon" />
                    <input
                        type="text"
                        className="do-search-input"
                        placeholder="Search by mother name, patient ID, or station..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="do-filters-row">
                    <div className="view-toggle-wrap">
                        <button className={`view-toggle ${filters.view === 'outcomes' ? 'active' : ''}`} onClick={() => handleFilter('view', 'outcomes')}>Completed Deliveries</button>
                        <button className={`view-toggle ${filters.view === 'upcoming' ? 'active' : ''}`} onClick={() => handleFilter('view', 'upcoming')}>Scheduled Deliveries (Nearest Due Date)</button>
                    </div>
                    <div className="filter-divider"></div>
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.type} onChange={e => handleFilter('type', e.target.value)} disabled={filters.view === 'upcoming'}>
                        <option value="All">All Delivery Types</option>
                        <option value="NSD">NSD (Normal)</option>
                        <option value="CS">CS (Cesarean)</option>
                        <option value="Breech">Breech</option>
                    </select>
                    <select value={filters.risk} onChange={e => handleFilter('risk', e.target.value)}>
                        <option value="All">All Risk Levels</option>
                        <option value="Normal">Normal</option>
                        <option value="Monitor">Monitor</option>
                        <option value="High Risk">High Risk</option>
                    </select>
                    <select value={filters.complication} onChange={e => handleFilter('complication', e.target.value)} disabled={filters.view === 'upcoming'}>
                        <option value="All">All Complications</option>
                        <option value="None">No Complications</option>
                        <option value="HasComp">With Complications</option>
                    </select>
                    <select value={filters.station} onChange={e => handleFilter('station', e.target.value)}>
                        <option value="All">All Stations</option>
                        {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={`Station ${n}`}>Station {n}</option>)}
                    </select>
                </div>
            </div>

            <div className="do-main-layout">
                <div className="do-table-col">
                    <div className="do-card">
                        <div className="do-card-head">
                            <h2>{filters.view === 'outcomes' ? <Baby size={17} /> : <Clock size={17} />}{filters.view === 'outcomes' ? 'Birth Records' : 'Expected Deliveries'}</h2>
                            <div className="do-legend">
                                <span className="legend-chip chip-normal"><CheckCircle2 size={11} /> Normal</span>
                                <span className="legend-chip chip-monitor"><AlertTriangle size={11} /> Minor/Monitor</span>
                                <span className="legend-chip chip-complication"><AlertCircle size={11} /> High Risk / Complication</span>
                            </div>
                            <span className="do-count">{filtered.length} records</span>
                        </div>

                        <div className="table-responsive">
                            <table className="do-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <span className="sortable-head" onClick={() => handleSort('patientName')}>
                                                Patient <SortBtn field="patientName" />
                                            </span>
                                        </th>
                                        <th>
                                            <span className="sortable-head" onClick={() => handleSort(filters.view === 'outcomes' ? 'deliveryDate' : 'edd')}>
                                                {filters.view === 'outcomes' ? 'Birth Date' : 'Expected Due Date'} <SortBtn field={filters.view === 'outcomes' ? 'deliveryDate' : 'edd'} />
                                            </span>
                                        </th>
                                        {filters.view === 'outcomes' ? (
                                            <>
                                                <th>Type</th>
                                                <th>Risk</th>
                                                <th>Complications</th>
                                                <th>Baby Status</th>
                                                <th>Staff Involved</th>
                                            </>
                                        ) : (
                                            <>
                                                <th>Risk Level</th>
                                                <th>Station</th>
                                                <th>Last Checkup</th>
                                                <th>Status</th>
                                            </>
                                        )}
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="10" className="do-loading">Loading records...</td></tr>
                                    ) : filtered.map(d => (
                                        <tr key={d.id} className={`do-row ${getRowClass(d)}`}>
                                            <td>
                                                <div className="do-patient" onClick={() => navigate(`/dashboard/patients/${d.patientId}`)} style={{ cursor: 'pointer' }}>
                                                    <div className="do-avatar">{d.patientName?.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                                                    <div>
                                                        <span className="do-name">{d.patientName}</span>
                                                        <span className="do-pid">{d.patientId} · {d.station}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="do-date">{filters.view === 'outcomes' ? d.deliveryDate : d.edd}</span>
                                                {filters.view === 'outcomes' && <span className="do-time">{d.deliveryTime}</span>}
                                            </td>
                                            {filters.view === 'outcomes' ? (
                                                <>
                                                    <td><span className={`dt-badge dt-${String(d.deliveryType || '').toLowerCase()}`}>{d.deliveryType}</span></td>
                                                    <td><span className={`risk-badge ${getRiskBadge(d.riskLevel)}`}>{d.riskLevel}</span></td>
                                                    <td>
                                                        <span className={`comp-text ${d.complications !== 'None' ? 'has-comp' : ''}`}>
                                                            {d.complications !== 'None' && <AlertCircle size={12} />} {d.complications}
                                                        </span>
                                                    </td>
                                                    <td><span className={`baby-badge ${getBabyBadge(d.babyOutcome)}`}>{d.babyOutcome}</span></td>
                                                    <td className="do-staff">{d.staff}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td><span className={`risk-badge ${getRiskBadge(d.riskLevel)}`}>{d.riskLevel}</span></td>
                                                    <td>{d.station}</td>
                                                    <td>-</td>
                                                    <td><span className="status-pill pill-upcoming">Upcoming</span></td>
                                                </>
                                            )}
                                            <td>
                                                <div className="row-actions">
                                                    <button className="action-btn view-btn" title="View Details"><Eye size={13} /></button>
                                                    <button className="action-btn edit-btn" title="Edit"><Edit2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && filtered.length === 0 && (
                                        <tr>
                                            <td colSpan="10" className="do-empty">
                                                <Baby size={28} />
                                                <p>No delivery records match your search or filters.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="do-side-col">
                    <div className="do-card">
                        <div className="do-card-head">
                            <h2><AlertTriangle size={16} /> Delivery Alerts</h2>
                        </div>
                        <div className="alerts-list">
                            {deliveries.filter(d => d.babyOutcome === 'NICU' || d.complications !== 'None').slice(0, 5).map((a, i) => (
                                <div key={i} className="alert-item alert-rose">
                                    <div className="alert-dot"></div>
                                    <div className="alert-body">
                                        <p><strong>{a.patientName}</strong>: {a.complications !== 'None' ? a.complications : `Baby in ${a.babyOutcome}`}</p>
                                        <span>{a.deliveryDate}</span>
                                    </div>
                                </div>
                            ))}
                            {deliveries.filter(d => d.babyOutcome === 'NICU' || d.complications !== 'None').length === 0 && (
                                <p className="empty-alerts">No critical alerts for recent births.</p>
                            )}
                        </div>
                    </div>

                    <div className="do-card">
                        <div className="do-card-head"><h2><TrendingUp size={16} /> System Summary</h2></div>
                        <div className="quick-stats-list">
                            <div className="qs-row"><span>Total Birth Events</span><strong>{deliveries.length}</strong></div>
                            <div className="qs-row"><span>Expected Soon</span><strong>{upcoming.length}</strong></div>
                            <div className="qs-row"><span>NICU / Special Care</span><strong>{deliveries.filter(d => d.babyOutcome === 'NICU').length}</strong></div>
                            <div className="qs-row"><span>High-Risk Births</span><strong>{deliveries.filter(d => d.riskLevel === 'High Risk').length}</strong></div>
                        </div>
                    </div>
                </div>
            </div>

            {showModal && (
                <AddDeliveryModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        loadData();
                    }}
                />
            )}
        </div>
    );
};

export default DeliveryOutcomes;