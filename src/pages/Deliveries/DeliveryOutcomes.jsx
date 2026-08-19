import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, Baby, Heart, AlertTriangle,
    CheckCircle2, Clock, AlertCircle, FileText, Download,
    Eye, Edit2, Printer, Activity, User, Calendar,
    Stethoscope, MapPin, ChevronDown, ChevronUp, TrendingUp,
    RefreshCw, Syringe
} from 'lucide-react';
import '../../styles/pages/DeliveryOutcomes.css';
import VaccinationService from '../../services/vaccinationservice';
import BabyService from '../../services/babyservices';
import PatientService from '../../services/patientservice';
import supabase from '../../config/supabaseclient';
import * as XLSX from 'xlsx';
import { formatTime12Hour } from '../../utils/pregnancyUtils';
import { useModal } from '../../context/ModalContext';
import Legend from '../../components/Legend/Legend';

const COMPLICATION_OPTIONS = ['None', 'Hemorrhage', 'Infection', 'Preeclampsia', 'Placenta Previa', 'Preterm'];
const DELIVERY_TYPES = ['NSD', 'CS', 'Breech'];

const DeliveryOutcomes = () => {
    const navigate = useNavigate();
    const { confirm, alert: customAlert } = useModal();
    const babyService = new BabyService();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        type: 'All',
        outcome: 'All',
        complication: 'All',
        station: 'All',
        view: 'outcomes'
    });
    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [sortField, setSortField] = useState('deliveryDate');
    const [sortAsc, setSortAsc] = useState(false);
    const [deliveries, setDeliveries] = useState([]);
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stations, setStations] = useState(['All Stations']);
    const [staffList, setStaffList] = useState([]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allDeliv, allStats] = await Promise.all([
                babyService.getAllDeliveries(),
                babyService.getDeliveryStats()
            ]);
            setDeliveries(allDeliv || []);
            setStats(allStats || []);
        } catch (err) {
            console.error('Error loading delivery outcomes:', err);
            setDeliveries([]);
            setStats([]);
        } finally {
            setLoading(false);
        }
    };

    const loadConfigData = async () => {
        try {
            const stationsData = await babyService.getStations();
            setStations(stationsData);
            
            const allStaff = await babyService.getAllStaff();
            setStaffList(allStaff);
        } catch (err) {
            console.error('Config load error:', err);
        }
    };

    useEffect(() => {
        loadData();
        loadConfigData();
    }, []);

    const handleFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleExport = () => {
        const exportData = filtered.map(d => ({
            'Patient Name': d.patientName,
            'Patient ID': d.patientId,
            'Station': d.station,
            'Delivery Date': d.deliveryDate,
            'Delivery Time': formatTime12Hour(d.deliveryTime) || '',
            'Delivery Type': d.deliveryType,
            'Risk Level': d.riskLevel,
            'Complications': d.complications || 'None',
            'Baby Name': d.babyName || '',
            'Baby Outcome': d.babyOutcome,
            'Staff': d.staff || '',
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Delivery Outcomes');

        // Auto-size columns
        const colWidths = [
            { wch: 25 }, // Patient Name
            { wch: 15 }, // Patient ID
            { wch: 20 }, // Station
            { wch: 15 }, // Delivery Date
            { wch: 15 }, // Delivery Time
            { wch: 15 }, // Delivery Type
            { wch: 15 }, // Risk Level
            { wch: 20 }, // Complications
            { wch: 20 }, // Baby Name
            { wch: 15 }, // Baby Outcome
            { wch: 20 }, // Staff
        ];
        ws['!cols'] = colWidths;

        // Add header styling
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
            if (cell) {
                cell.s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: 'B9818A' } },
                    alignment: { horizontal: 'center', vertical: 'center' }
                };
            }
        }

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Delivery_Outcomes_${dateStr}.xlsx`);
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(prev => !prev);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const currentData = filters.view === 'outcomes' ? deliveries : [];

    const filtered = useMemo(() => {
        return currentData
            .filter(d => {
                const s = searchTerm.toLowerCase();
                const matchSearch = 
                    d.patientName?.toLowerCase().includes(s) ||
                    d.patientId?.toString().toLowerCase().includes(s) ||
                    d.station?.toLowerCase().includes(s);

                const matchType = filters.type === 'All' || d.deliveryType === filters.type;
                const matchOutcome = filters.outcome === 'All' || d.pregnancyOutcome === filters.outcome;
                const matchComp = filters.complication === 'All' || 
                    (filters.complication === 'None' ? d.complications === 'None' : d.complications !== 'None');
                const matchStation = filters.station === 'All' || d.station === filters.station;

                return matchSearch && matchType && matchOutcome && matchComp && matchStation;
            })
            .sort((a, b) => {
                const field = sortField;
                const va = a[field] ?? '';
                const vb = b[field] ?? '';
                return sortAsc 
                    ? String(va).localeCompare(String(vb))
                    : String(vb).localeCompare(String(va));
            });
    }, [currentData, searchTerm, filters, sortField, sortAsc]);

    const getRowClass = (d) => {
        if (d.riskLevel?.includes('High') || (d.complications && d.complications !== 'None')) 
            return 'do-row--complication';
        if (d.riskLevel === 'Monitor') return 'do-row--monitor';
        return 'do-row--normal';
    };

    const getRiskBadge = (r) => {
        if (r?.includes('High')) return 'risk-high';
        if (r === 'Monitor') return 'risk-monitor';
        return 'risk-normal';
    };

    const getOutcomeBadge = (o) => {
        if (o === 'Miscarriage') return 'outcome-miscarriage';
        if (o === 'Stillbirth') return 'outcome-stillbirth';
        return 'outcome-live';
    };

    const getBabyBadge = (b) => {
        if (b === 'NICU') return 'baby-nicu';
        if (b === 'Special Care') return 'baby-special';
        if (b === 'Stillbirth') return 'baby-stillbirth';
        if (!b || b.includes('N/A')) return 'baby-na';
        return 'baby-healthy';
    };

    const getDeliveryTypeBadge = (type) => {
        if (!type) return 'dt-na';
        if (type.includes('NSD')) return 'dt-nsd';
        if (type.includes('CS')) return 'dt-cs';
        if (type.includes('Breech')) return 'dt-breech';
        return 'dt-na';
    };

    const getDisplayData = (d) => {
        const outcome = d.pregnancyOutcome;
        let typeStr = d.deliveryType || '';
        let type = 'N/A - Not Applicable';
        let babyStatus = d.babyOutcome || 'N/A - No Baby';

        // Parse actual stored type
        const tUp = typeStr.toUpperCase();
        if (tUp.includes('NSD') || tUp === 'NORMAL') type = 'NSD (Normal)';
        else if (tUp.includes('CS') || tUp.includes('CESAREAN')) type = 'CS (Cesarean)';
        else if (tUp.includes('BREECH')) type = 'Breech';
        else if (typeStr) type = typeStr;

        // Apply rules
        if (outcome === 'Miscarriage') {
            type = 'N/A - Not Applicable';
            babyStatus = 'N/A - No Baby';
        } else if (outcome === 'Stillbirth') {
            babyStatus = 'Stillbirth';
        }

        return { type, babyStatus };
    };

    const SortBtn = ({ field }) => (
        <button className="sort-btn" onClick={() => handleSort(field)}>
            {sortField === field ? 
                (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : 
                <ChevronDown size={11} className="sort-inactive" />
            }
        </button>
    );

    const handleNewPregnancy = async (patientId) => {
        const isConfirmed = await confirm({
            title: 'Create New Pregnancy',
            text: 'This will open the existing patient form and prefill her details so you can complete the new pregnancy and vital checks.',
            confirmText: 'Continue',
            cancelText: 'Cancel',
            iconType: 'info'
        });
        if (!isConfirmed) {
            return;
        }

        navigate('/dashboard/patients/add', {
            state: { existingPatientId: patientId }
        });
    };

    return (
        <div className="do-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Stethoscope size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> 
                        Delivery Outcomes
                    </h1>
                    <p className="page-subtitle">Record and monitor birth outcomes, including delivery type, complications, and baby status.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={handleExport}><Download size={16} /> Export Report</button>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Record New Delivery
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="do-stats-grid">
                {stats.map((s, i) => (
                    <div key={i} className={`stat-card stat-card--${s.color}`}>
                        <div className="stat-top">
                            <div className={`stat-icon stat-icon--${s.color}`}>
                                <Baby size={20} />
                            </div>
                        </div>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            <AddDeliveryModal
                show={showModal}
                onClose={() => { setShowModal(false); setSelectedDelivery(null); }}
                onSuccess={loadData}
                stations={stations}
                staffList={staffList}
                editDelivery={selectedDelivery}
            />

            <ViewDeliveryModal
                show={showViewModal}
                onClose={() => setShowViewModal(false)}
                delivery={selectedDelivery}
            />
            
            {}
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
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.type} onChange={e => handleFilter('type', e.target.value)}>
                        <option value="All">All Types</option>
                        {DELIVERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={filters.outcome} onChange={e => handleFilter('outcome', e.target.value)}>
                        <option value="All">All Outcomes</option>
                        <option value="Live Birth">Live Birth</option>
                        <option value="Stillbirth">Stillbirth</option>
                        <option value="Miscarriage">Miscarriage</option>
                    </select>
                    <select value={filters.complication} onChange={e => handleFilter('complication', e.target.value)}>
                        <option value="All">All Complications</option>
                        <option value="None">No Complications</option>
                        <option value="HasComp">With Complications</option>
                    </select>
                    <select value={filters.station} onChange={e => handleFilter('station', e.target.value)}>
                        {stations.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Legend 
                        categories={[
                            {
                                title: "OUTCOME",
                                items: [
                                    { label: "Live Birth", className: "outcome-live" },
                                    { label: "Stillbirth", className: "outcome-stillbirth" },
                                    { label: "Miscarriage", className: "outcome-miscarriage" }
                                ]
                            },
                            {
                                title: "TYPE",
                                items: [
                                    { label: "NSD (Normal)", className: "dt-nsd" },
                                    { label: "CS (Cesarean)", className: "dt-cs" },
                                    { label: "Breech", className: "dt-breech" },
                                    { label: "N/A – Not Applicable", className: "dt-na" }
                                ]
                            },
                            {
                                title: "BABY STATUS",
                                items: [
                                    { label: "Healthy", className: "baby-healthy" },
                                    { label: "NICU", className: "baby-nicu" },
                                    { label: "Special Care", className: "baby-special" },
                                    { label: "Stillbirth", className: "baby-stillbirth" },
                                    { label: "N/A – No Baby", className: "baby-na" }
                                ]
                            }
                        ]}
                    />
                </div>
            </div>

            {}
            <div className="do-main-layout">
                <div className="do-table-col">
                    <div className="do-card">
                        <div className="do-card-head">
                            <h2><Baby size={17} /> Birth Records ({filtered.length})</h2>
                            <span className="do-count">{filtered.length} records</span>
                        </div>
                        <div className="table-responsive">
                            <table className="do-table">
                                <thead>
                                    <tr>
                                        <th className="row-number-header" style={{ width: '50px' }}>#</th>
                                        <th><span className="sortable-head" onClick={() => handleSort('patientName')}>
                                            Patient <SortBtn field="patientName" />
                                        </span></th>
                                        <th>Delivery Date</th>
                                        <th>Outcome</th>
                                        <th>Type</th>
                                        <th>Complications</th>
                                        <th>Baby Status</th>
                                        <th>Staff</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="9" className="do-loading">Loading...</td></tr>
                                    ) : filtered.map((d, index) => (
                                        <tr key={d.id} className={`do-row ${getRowClass(d)}`}>
                                            <td className="row-number-cell" style={{ width: '50px' }}>
                                                {index + 1}
                                            </td>
                                            <td>
                                                <div 
                                                    className="do-patient" 
                                                    onClick={() => navigate(`/dashboard/patients/${d.patientId}`)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="do-avatar">
                                                        {d.patientName?.split(' ').slice(0,2).map(n => n[0]).join('')}
                                                    </div>
                                                    <div>
                                                        <span className="do-name">{d.patientName}</span>
                                                        <span className="do-pid">{d.patientId} · {d.station}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="do-date">
                                                    {d.deliveryDate 
                                                        ? new Date(d.deliveryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) 
                                                        : ''}
                                                </span>
                                                {d.deliveryTime && <span className="do-time">{formatTime12Hour(d.deliveryTime)}</span>}
                                            </td>
                                            <td><span className={`outcome-badge ${getOutcomeBadge(d.pregnancyOutcome)}`}>{d.pregnancyOutcome}</span></td>
                                            <td><span className={`dt-badge ${getDeliveryTypeBadge(getDisplayData(d).type)}`}>{getDisplayData(d).type}</span></td>
                                            <td>
                                                <span className={`comp-text ${d.complications !== 'None' ? 'has-comp' : ''}`}>
                                                    {d.complications !== 'None' && <AlertCircle size={12} />}
                                                    {d.complications || 'None'}
                                                </span>
                                            </td>
                                            <td>
                                                {d.babyName && <div className="baby-name-summary">{d.babyName}</div>}
                                                <span className={`baby-badge ${getBabyBadge(getDisplayData(d).babyStatus)}`}>{getDisplayData(d).babyStatus}</span>
                                            </td>
                                            <td>{d.staff}</td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="action-btn view-btn" title="View" onClick={() => navigate(`/dashboard/patients/${d.patientId}`)}><Eye size={13} /></button>
                                                    <button className="action-btn new-pregnancy-btn" title="New Pregnancy" onClick={() => handleNewPregnancy(d.patientId)}><RefreshCw size={13} /></button>
                                                    <button className="action-btn edit-btn" title="Edit" onClick={() => { setSelectedDelivery(d); setShowModal(true); }}><Edit2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && !filtered.length && (
                                        <tr>
                                            <td colSpan="9" className="do-empty">
                                                <Baby size={28} />
                                                <p>No matching records found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                {/* ── Right Column: Panels ── */}
                <div className="do-side-col" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Station Distribution */}
                    <div className="do-card">
                        <div className="do-card-head">
                            <h2>
                                <MapPin size={16} /> Station Distribution
                            </h2>
                        </div>
                        <div className="station-dist-list">
                            {(() => {
                                const counts = {};
                                filtered.forEach((p) => {
                                    const st = p.station || 'Unassigned';
                                    counts[st] = (counts[st] || 0) + 1;
                                });
                                const dist = Object.entries(counts)
                                    .map(([name, count]) => ({ name, count }))
                                    .sort((a, b) => b.count - a.count);
                                
                                return (
                                    <>
                                        {dist.map((b) => (
                                            <div key={b.name} className="station-dist-item">
                                                <span>{b.name}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div className="station-bar-wrap">
                                                        <div
                                                            className="station-bar-fill"
                                                            style={{
                                                                width: `${(b.count / Math.max(filtered.length, 1)) * 100}%`,
                                                            }}
                                                        ></div>
                                                    </div>
                                                    <span
                                                        style={{
                                                            fontSize: '12px',
                                                            fontWeight: 700,
                                                            color: 'var(--color-rose)',
                                                            minWidth: '20px',
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        {b.count}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {dist.length === 0 && (
                                            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', margin: '20px 0' }}>No records found.</p>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AddDeliveryModal = ({ show, onClose, onSuccess, stations, staffList, editDelivery }) => {
    const patientService = new PatientService();
    const babyService = new BabyService();
    const [section, setSection] = useState('patient');
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [localStaff, setLocalStaff] = useState(staffList);
    const [staffLoading, setStaffLoading] = useState(true);
    const [validationErrors, setValidationErrors] = useState([]);
    const [touchedFields, setTouchedFields] = useState(new Set());
    const [form, setForm] = useState({
        patientId: '',
        patientName: '',
        station: '',
        gestationalAge: '',
        riskLevel: '',
        pregnancyType: '',
        deliveryDate: '',
        deliveryTime: '',
        deliveryType: '',
        pregnancyOutcome: '',
        attendingStaffId: '',
        attendingStaffName: '',
        facility: '',
        complications: [],
        newborns: [{
            babyName: '',
            babyGender: 'Female',
            babyWeight: '',
            babyLength: '',
            headCircumference: '',
            apgar1: '',
            apgar5: '',
            babyCondition: 'Healthy'
        }],
        postpartumDate: '',
        notes: ''
    });
    const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

    // Validation logic per section
    const validateSection = (sectionId, formData = form) => {
        const errors = [];
        if (sectionId === 'patient') {
            if (!formData.patientId) errors.push('Patient');
        }
        if (sectionId === 'delivery') {
            if (!formData.deliveryDate) errors.push('Delivery Date');
            if (!formData.deliveryType) errors.push('Delivery Type');
            if (!formData.pregnancyOutcome) errors.push('Pregnancy Outcome');
        }
        if (sectionId === 'baby') {
            formData.newborns.forEach((nb, i) => {
                const label = formData.newborns.length > 1 ? ` (Newborn ${i + 1})` : '';
                if (!nb.babyName?.trim()) errors.push(`Baby Name${label}`);
                if (!nb.babyCondition) errors.push(`Baby Condition${label}`);
            });
        }
        // complications and plan have no required fields
        return errors;
    };

    const validateAllSections = (formData = form) => {
        const sectionOrder = ['patient', 'delivery', 'complications', 'baby', 'plan'];
        for (const sec of sectionOrder) {
            const errors = validateSection(sec, formData);
            if (errors.length > 0) {
                return { valid: false, firstFailSection: sec, errors };
            }
        }
        return { valid: true, firstFailSection: null, errors: [] };
    };

    const handleNextClick = () => {
        const SECTIONS_LIST = [
            { id: 'patient' }, { id: 'delivery' }, { id: 'complications' }, { id: 'baby' }, { id: 'plan' }
        ];
        const currentErrors = validateSection(section);
        if (currentErrors.length > 0) {
            setValidationErrors(currentErrors);
            // Mark all relevant fields as touched
            const newTouched = new Set(touchedFields);
            currentErrors.forEach(e => newTouched.add(e));
            setTouchedFields(newTouched);
            return;
        }
        setValidationErrors([]);
        const idx = SECTIONS_LIST.findIndex(s => s.id === section);
        if (idx < SECTIONS_LIST.length - 1) {
            setSection(SECTIONS_LIST[idx + 1].id);
        }
    };

    const handleTabClick = (targetSectionId) => {
        const SECTIONS_LIST = [
            { id: 'patient' }, { id: 'delivery' }, { id: 'complications' }, { id: 'baby' }, { id: 'plan' }
        ];
        const currentIdx = SECTIONS_LIST.findIndex(s => s.id === section);
        const targetIdx = SECTIONS_LIST.findIndex(s => s.id === targetSectionId);

        // Going backward is always allowed
        if (targetIdx <= currentIdx) {
            setValidationErrors([]);
            setSection(targetSectionId);
            return;
        }

        // Going forward: validate all sections between current and target
        for (let i = currentIdx; i < targetIdx; i++) {
            const errors = validateSection(SECTIONS_LIST[i].id);
            if (errors.length > 0) {
                setValidationErrors(errors);
                setSection(SECTIONS_LIST[i].id);
                const newTouched = new Set(touchedFields);
                errors.forEach(e => newTouched.add(e));
                setTouchedFields(newTouched);
                return;
            }
        }

        setValidationErrors([]);
        setSection(targetSectionId);
    };

    // Helper: check if a specific field should show error state
    const hasFieldError = (fieldName) => {
        return validationErrors.includes(fieldName) || touchedFields.has(fieldName);
    };

    // Check live field validity for red-border display
    const isFieldInvalid = (fieldName, value) => {
        if (!touchedFields.has(fieldName) && !validationErrors.includes(fieldName)) return false;
        return !value || (typeof value === 'string' && !value.trim());
    };
     useEffect(() => {
        const loadStaff = async () => {
            setStaffLoading(true);
            try {
                const { data, error } = await supabase
                    .from('staff_profiles')
                    .select('id, full_name, station_ass, stations:station_ass (station_name)')
                    .order('full_name');
                
                if (error) throw error;
                console.log('✅ Staff loaded:', data?.length || 0);
                setLocalStaff(data || []);
            } catch (err) {
                console.error('❌ Staff load failed:', err);
                setLocalStaff([
                    { id: 'demo1', full_name: 'Midwife Elena P.', role: 'Midwife', stations: { station_name: 'Brgy Poblacion' } },
                    { id: 'demo2', full_name: 'Dr. Reyes (OB)', role: 'Doctor', stations: { station_name: 'Main Clinic' } }
                ]);
            } finally {
                setStaffLoading(false);
            }
        };

        if (show) {
            loadStaff();
        }
    }, [show]);
    const filteredStaffList = useMemo(() => {
        const targetBarangay = form.station?.split(',')[0]?.trim().toLowerCase();
        if (!targetBarangay) return [];

        const sourceStaff = localStaff.length ? localStaff : staffList;
        return sourceStaff.filter(staff => {
            const stationName = (staff.stations?.station_name || '').toLowerCase();
            return stationName.includes(targetBarangay);
        });
    }, [form.station, localStaff, staffList]);

    const updateForm = (key, value) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            
            // Logic for Pregnancy Outcome
            if (key === 'pregnancyOutcome') {
                if (value === 'Miscarriage') {
                    next.deliveryType = 'N/A - Not Applicable';
                    next.newborns = [{
                        babyName: 'N/A - No Baby',
                        babyGender: 'Female',
                        babyWeight: '',
                        babyLength: '',
                        headCircumference: '',
                        apgar1: '',
                        apgar5: '',
                        babyCondition: 'N/A - No Baby'
                    }];
                } else if (value === 'Stillbirth') {
                    if (next.newborns[0].babyName === 'N/A - No Baby') {
                        next.newborns[0].babyName = '';
                    }
                    next.newborns = next.newborns.map(nb => ({ ...nb, babyCondition: 'Stillbirth' }));
                    if (next.deliveryType === 'N/A - Not Applicable') next.deliveryType = '';
                } else if (value === 'Live Birth') {
                    if (next.deliveryType === 'N/A - Not Applicable') next.deliveryType = '';
                    if (next.newborns[0].babyName === 'N/A - No Baby') {
                        next.newborns[0].babyName = '';
                    }
                    if (next.newborns[0].babyCondition === 'N/A - No Baby' || next.newborns[0].babyCondition === 'Stillbirth') {
                        next.newborns = next.newborns.map(nb => ({ ...nb, babyCondition: 'Healthy' }));
                    }
                }
            }
            return next;
        });

        // Clear validation errors when user fills in a field
        if (value && validationErrors.length > 0) {
            setValidationErrors(prev => prev.filter(e => !e.toLowerCase().includes(key.toLowerCase())));
        }
        if (key === 'patientName' && value.length > 2) {
            handleSearch(value);
        }
        if (key === 'patientName' && value.length <= 2) {
            setSearchResults([]);
        }
    };
    
    // Auto-calculate postpartum visit date (48 hours after delivery)
    useEffect(() => {
        if (form.deliveryDate) {
            const deliveryDate = new Date(form.deliveryDate);
            const ppDate = new Date(deliveryDate);
            ppDate.setDate(ppDate.getDate() + 2); // 48 hours = 2 days
            setForm(prev => ({ ...prev, postpartumDate: ppDate.toISOString().split('T')[0] }));
        }
    }, [form.deliveryDate]);
    
    useEffect(() => {
        if (show && staffList.length === 0) {
            console.log('Staff list:', staffList);
        }
    }, [show, staffList]);

    // Populate form when editing existing delivery
    useEffect(() => {
        if (editDelivery && show) {
            setForm({
                patientId: editDelivery.patientId || '',
                patientName: editDelivery.patientName || '',
                station: editDelivery.station || '',
                gestationalAge: editDelivery.gestationalAge || '',
                riskLevel: editDelivery.riskLevel || '',
                pregnancyType: editDelivery.pregnancyType || '',
                deliveryDate: editDelivery.deliveryDate || '',
                deliveryTime: editDelivery.deliveryTime || '',
                deliveryType: editDelivery.deliveryType || '',
                attendingStaffId: editDelivery.attendingStaffId || '',
                attendingStaffName: editDelivery.staff || '',
                facility: editDelivery.facility || '',
                complications: editDelivery.complications ? editDelivery.complications.split(', ') : [],
                newborns: [{
                    babyName: editDelivery.babyName || '',
                    babyGender: editDelivery.babyGender || 'Female',
                    babyWeight: editDelivery.babyWeight || '',
                    babyLength: editDelivery.babyLength || '',
                    headCircumference: editDelivery.headCircumference || '',
                    apgar1: editDelivery.apgar1 || '',
                    apgar5: editDelivery.apgar5 || '',
                    babyCondition: editDelivery.babyOutcome || 'Healthy'
                }],
                postpartumDate: editDelivery.postpartum_visit_date || editDelivery.postpartumDate || '',
                notes: editDelivery.notes || ''
            });
            setSection('newborn');
        } else if (!editDelivery && show) {
            // Reset form for new delivery
            setForm({
                patientId: '',
                patientName: '',
                station: '',
                gestationalAge: '',
                riskLevel: '',
                pregnancyType: '',
                deliveryDate: '',
                deliveryTime: '',
                deliveryType: '',
                attendingStaffId: '',
                attendingStaffName: '',
                facility: '',
                complications: [],
                newborns: [{
                    babyName: '',
                    babyGender: 'Female',
                    babyWeight: '',
                    babyLength: '',
                    headCircumference: '',
                    apgar1: '',
                    apgar5: '',
                    babyCondition: 'Healthy'
                }],
                postpartumDate: '',
                notes: ''
            });
            setSection('patient');
            setValidationErrors([]);
            setTouchedFields(new Set());
            setSaveSuccessMsg('');
        }
    }, [editDelivery, show]);
    const handleSearch = async (query) => {
        try {
            // Search for both pregnant mothers and all patients to handle both scenarios:
            // 1. Patient who gives birth with existing record (pregnant)
            // 2. Adding patient that already gave birth (post-delivery recording)
            const [pregnantMothers, allPatients] = await Promise.all([
                babyService.searchPregnantMothers(query),
                patientService.searchPatients(query)
            ]);

            // Combine results, prioritizing pregnant mothers
            const patientIds = new Set(pregnantMothers.map(p => p.id));
            const otherPatients = allPatients.filter(p => !patientIds.has(p.id)).map(p => ({
                id: p.id,
                name: p.name,
                station: p.station,
                riskLevel: 'Normal', // Default for non-pregnant patients
                isPregnant: false,
                pregnancyType: 'Singleton',
                gestationalAge: '',
                gravida: null,
                para: null
            }));

            const combinedResults = [...pregnantMothers, ...otherPatients];
            setSearchResults(combinedResults);
        } catch (err) {
            console.error('Search failed:', err);
            setSearchResults([]);
        }
    };

    const selectPatient = (patient) => {
        setForm(prev => ({
            ...prev,
            patientId: patient.id,
            patientName: patient.name,
            station: patient.station,
            facility: patient.station || prev.facility,
            riskLevel: patient.riskLevel,
            pregnancyType: patient.pregnancyType || 'Singleton',
            gestationalAge: patient.gestationalAge || '',
            attendingStaffId: '',
            attendingStaffName: ''
        }));
        setSearchResults([]);
        // Clear patient-related validation errors
        setValidationErrors(prev => prev.filter(e => e !== 'Patient'));
        setTouchedFields(prev => {
            const next = new Set(prev);
            next.delete('Patient');
            return next;
        });
    };

    const updateNewborn = (index, key, value) => {
        setForm(prev => ({
            ...prev,
            newborns: prev.newborns.map((n, i) => i === index ? { ...n, [key]: value } : n)
        }));
        // Clear related validation errors when filling baby fields
        if (value && (key === 'babyName' || key === 'babyCondition')) {
            const label = form.newborns.length > 1 ? ` (Newborn ${index + 1})` : '';
            const fieldLabel = key === 'babyName' ? `Baby Name${label}` : `Baby Condition${label}`;
            setValidationErrors(prev => prev.filter(e => e !== fieldLabel));
            setTouchedFields(prev => {
                const next = new Set(prev);
                next.delete(fieldLabel);
                return next;
            });
        }
    };

    const addNewborn = () => {
        setForm(prev => ({
            ...prev,
            newborns: [...prev.newborns, {
                babyName: '',
                babyGender: 'Female',
                babyWeight: '',
                babyLength: '',
                headCircumference: '',
                apgar1: '',
                apgar5: '',
                babyCondition: 'Healthy'
            }]
        }));
    };

    const removeNewborn = (index) => {
        if (form.newborns.length > 1) {
            setForm(prev => ({
                ...prev,
                newborns: prev.newborns.filter((_, i) => i !== index)
            }));
        }
    };

    const toggleComplication = (comp) => {
        setForm(prev => {
            const current = [...prev.complications];
            if (comp === 'None') {
                return { ...prev, complications: ['None'] };
            }
            const withoutNone = current.filter(x => x !== 'None');
            if (withoutNone.includes(comp)) {
                return { ...prev, complications: withoutNone.filter(x => x !== comp) };
            }
            return { ...prev, complications: [...withoutNone, comp] };
        });
    };

    const handleSave = async () => {
        // Final cross-section validation
        const result = validateAllSections();
        if (!result.valid) {
            setValidationErrors(result.errors);
            setSection(result.firstFailSection);
            const newTouched = new Set(touchedFields);
            result.errors.forEach(e => newTouched.add(e));
            setTouchedFields(newTouched);
            return;
        }

        setValidationErrors([]);
        setLoading(true);
        try {
            const deliveryData = {
                mother_id: form.patientId,
                delivery_date: form.deliveryDate,
                delivery_time: form.deliveryTime || '09:00',
                delivery_type: form.deliveryType,
                gestational_age: form.gestationalAge || null,
                risk_level: form.riskLevel || 'Normal',
                complications: form.complications.filter(c => c !== 'None'),
                attending_staff: form.attendingStaffId || null,
                facility: form.facility || form.station || null,
                postpartum_visit_date: form.postpartumDate || null,
                notes: form.notes || null
            };

            const newbornData = form.newborns.map(n => ({
                baby_name: n.babyName?.trim() || null,
                gender: n.babyGender,
                birth_weight: n.babyWeight ? parseFloat(n.babyWeight) : null,
                birth_length: n.babyLength ? parseFloat(n.babyLength) : null,
                head_circumference: n.headCircumference ? parseFloat(n.headCircumference) : null,
                apgar_1min: n.apgar1 ? parseInt(n.apgar1) : null,
                apgar_5min: n.apgar5 ? parseInt(n.apgar5) : null,
                condition_at_birth: n.babyCondition,
                risk_level: form.riskLevel || 'Normal'
            }));

            // Pass delivery ID if editing, null if creating new
            const deliveryId = editDelivery?.id || null;
            const result = await babyService.recordDelivery(deliveryData, newbornData, deliveryId);
            
            // Only schedule vaccinations for new deliveries (not edits)
            if (!deliveryId) {
                const vaccService = new VaccinationService();
                const newbornIds = result.newborn_ids || [];
                const createdBy = await new PatientService().getCurrentUserId();
                
                for (const newbornId of newbornIds) {
                    await vaccService.scheduleNewbornVaccinations(newbornId, form.deliveryDate, createdBy);
                }
            }
            
            onSuccess();
            setSaveSuccessMsg(deliveryId ? 'Delivery updated successfully!' : 'Delivery recorded and vaccinations scheduled successfully!');
            setTimeout(() => { setSaveSuccessMsg(''); onClose(); }, 1800);
        } catch (err) {
            console.error('Save failed:', err);
            setValidationErrors([`Save failed: ${err.message}`]);
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;


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
                        <p>Document birth event and link to mother&apos;s record</p>
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
                                onClick={() => handleTabClick(s.id)}
                            >
                                <Icon size={14} /> {s.label}
                            </button>
                        );
                    })}
                </div>

                {/* Validation error banner */}
                {validationErrors.length > 0 && (
                    <div className="delivery-validation-banner">
                        <div className="delivery-validation-banner-content">
                            <AlertTriangle size={15} />
                            <div>
                                <span className="delivery-validation-title">Please complete the required fields before continuing.</span>
                                <span className="delivery-validation-missing">Missing: {validationErrors.join(', ')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Success banner */}
                {saveSuccessMsg && (
                    <div className="delivery-success-banner">
                        <CheckCircle2 size={15} />
                        <span>{saveSuccessMsg}</span>
                    </div>
                )}

                <div className="modal-body">
                    {section === 'patient' && (
                        <div className="form-grid-2">
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label>Search Patient <span className="req">*</span></label>
                                <input
                                    type="text"
                                    placeholder="Type mother&apos;s name..."
                                    value={form.patientName}
                                    onChange={e => updateForm('patientName', e.target.value)}
                                    autoComplete="off"
                                    className={isFieldInvalid('Patient', form.patientId) ? 'field-error' : ''}
                                />
                                {searchResults.length > 0 && (
                                    <div className="search-results-dropdown">
                                        {searchResults.map(p => (
                                            <div key={p.id} className="search-result-item" onClick={() => selectPatient(p)}>
                                                <div className="res-name">{p.name}</div>
                                                <div className="res-meta">
                                                    {p.id} · {p.station} · {p.isPregnant ? 'Pregnant' : p.riskLevel}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group"><label>Patient ID</label><input value={form.patientId} readOnly className="readonly-field" /></div>
                            <div className="form-group"><label>Station</label><input value={form.station} readOnly className="readonly-field" /></div>
                            <div className="form-group"><label>Risk Level</label><input value={form.riskLevel} readOnly className="readonly-field" /></div>
                            <div className="form-group"><label>Pregnancy Type</label><input value={form.pregnancyType} readOnly className="readonly-field" /></div>
                            <div className="form-group"><label>Gestational Age</label><input value={form.gestationalAge} onChange={e => updateForm('gestationalAge', e.target.value)} /></div>
                        </div>
                    )}

                    {section === 'delivery' && (
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Date <span className="req">*</span></label>
                                <input type="date" value={form.deliveryDate} onChange={e => updateForm('deliveryDate', e.target.value)} className={isFieldInvalid('Delivery Date', form.deliveryDate) ? 'field-error' : ''} />
                            </div>
                            <div className="form-group">
                                <label>Time</label>
                                <input type="time" value={form.deliveryTime} onChange={e => updateForm('deliveryTime', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Pregnancy Outcome <span className="req">*</span></label>
                                <select value={form.pregnancyOutcome} onChange={e => updateForm('pregnancyOutcome', e.target.value)} className={isFieldInvalid('Pregnancy Outcome', form.pregnancyOutcome) ? 'field-error' : ''}>
                                    <option value="">Select outcome...</option>
                                    <option value="Live Birth">Live Birth</option>
                                    <option value="Stillbirth">Stillbirth</option>
                                    <option value="Miscarriage">Miscarriage</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Type <span className="req">*</span></label>
                                <select value={form.deliveryType} onChange={e => updateForm('deliveryType', e.target.value)} disabled={form.pregnancyOutcome === 'Miscarriage'} className={isFieldInvalid('Delivery Type', form.deliveryType) ? 'field-error' : ''}>
                                    <option value="">Select type...</option>
                                    <option value="NSD">NSD (Normal)</option>
                                    <option value="CS">CS (Cesarean)</option>
                                    <option value="Breech">Breech</option>
                                    <option value="N/A - Not Applicable" style={{ display: 'none' }}>N/A - Not Applicable</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Attending Staff</label>
                                <select 
                                    value={form.attendingStaffId} 
                                    onChange={e => {
                                        const staff = filteredStaffList.find(s => s.id === e.target.value);
                                        updateForm('attendingStaffId', e.target.value);
                                        updateForm('attendingStaffName', staff?.full_name || '');
                                    }}
                                    disabled={!form.station}
                                >
                                    <option value="">Select Staff</option>
                                    {filteredStaffList.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.full_name} - {s.stations?.station_name || 'N/A'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Facility/Station</label>
                                <select value={form.facility} onChange={e => updateForm('facility', e.target.value)}>
                                    {stations.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {section === 'complications' && (
                        <div className="complication-grid">
                            {COMPLICATION_OPTIONS.map(c => (
                                <label key={c} className={`complication-chip ${form.complications.includes(c) ? 'selected' : ''}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={form.complications.includes(c)} 
                                        onChange={() => toggleComplication(c)} 
                                    />
                                    {c}
                                </label>
                            ))}
                        </div>
                    )}

                    {section === 'baby' && (
                        <div>
                            {form.newborns.map((newborn, index) => (
                                <div key={index} className="newborn-section" style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '10px', borderRadius: '5px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <h4>Newborn {index + 1}</h4>
                                        {form.newborns.length > 1 && (
                                            <button type="button" className="btn btn-outline btn-sm" onClick={() => removeNewborn(index)}>Remove</button>
                                        )}
                                    </div>
                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label>Baby Name <span className="req">*</span></label>
                                            <input type="text" value={newborn.babyName} onChange={e => updateNewborn(index, 'babyName', e.target.value)} placeholder="Enter baby name" disabled={form.pregnancyOutcome === 'Miscarriage'} className={isFieldInvalid(form.newborns.length > 1 ? `Baby Name (Newborn ${index + 1})` : 'Baby Name', newborn.babyName?.trim()) ? 'field-error' : ''} />
                                        </div>
                                        <div className="form-group">
                                            <label>Birth Weight (kg)</label>
                                            <input type="number" step="0.01" value={newborn.babyWeight} onChange={e => updateNewborn(index, 'babyWeight', e.target.value)} disabled={form.pregnancyOutcome === 'Miscarriage'} />
                                        </div>
                                        <div className="form-group">
                                            <label>Birth Length (cm)</label>
                                            <input type="number" step="0.1" value={newborn.babyLength} onChange={e => updateNewborn(index, 'babyLength', e.target.value)} disabled={form.pregnancyOutcome === 'Miscarriage'} />
                                        </div>
                                        <div className="form-group">
                                            <label>Head Circumference (cm)</label>
                                            <input type="number" step="0.1" value={newborn.headCircumference} onChange={e => updateNewborn(index, 'headCircumference', e.target.value)} disabled={form.pregnancyOutcome === 'Miscarriage'} />
                                        </div>
                                        <div className="form-group">
                                            <label>Gender</label>
                                            <select value={newborn.babyGender} onChange={e => updateNewborn(index, 'babyGender', e.target.value)} disabled={form.pregnancyOutcome === 'Miscarriage'}>
                                                <option>Male</option>
                                                <option>Female</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>APGAR 1min</label>
                                            <input type="number" min="0" max="10" value={newborn.apgar1} onChange={e => updateNewborn(index, 'apgar1', e.target.value)} disabled={form.pregnancyOutcome === 'Miscarriage'} />
                                        </div>
                                        <div className="form-group">
                                            <label>APGAR 5min</label>
                                            <input type="number" min="0" max="10" value={newborn.apgar5} onChange={e => updateNewborn(index, 'apgar5', e.target.value)} disabled={form.pregnancyOutcome === 'Miscarriage'} />
                                        </div>
                                        <div className="form-group">
                                            <label>Baby Condition <span className="req">*</span></label>
                                            <select value={newborn.babyCondition} onChange={e => updateNewborn(index, 'babyCondition', e.target.value)} disabled={form.pregnancyOutcome === 'Miscarriage' || form.pregnancyOutcome === 'Stillbirth'} className={isFieldInvalid(form.newborns.length > 1 ? `Baby Condition (Newborn ${index + 1})` : 'Baby Condition', newborn.babyCondition) ? 'field-error' : ''}>
                                                <option value="">Select condition...</option>
                                                <option value="Healthy">Healthy</option>
                                                <option value="NICU">NICU</option>
                                                <option value="Special Care">Special Care</option>
                                                <option value="Neonatal Death">Neonatal Death</option>
                                                <option value="Stillbirth">Stillbirth</option>
                                                <option value="N/A - No Baby" style={{ display: 'none' }}>N/A - No Baby</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                <button type="button" className="btn btn-outline" onClick={addNewborn} disabled={form.newborns.length >= 5 || form.pregnancyOutcome === 'Miscarriage'}>
                                    + Add Another Newborn
                                </button>
                            </div>
                        </div>
                    )}

                    {section === 'plan' && (
                        <div>
                            <div className="form-group">
                                <label>Postpartum Visit (Auto-scheduled within 48 hours)</label>
                                <input 
                                    type="date" 
                                    value={form.postpartumDate} 
                                    disabled 
                                    className="computed-field"
                                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                                />
                                <small style={{ color: '#666', fontSize: '12px' }}>
                                    Automatically calculated: 48 hours after delivery date
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea value={form.notes} onChange={e => updateForm('notes', e.target.value)} rows="3" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
                    {section !== 'plan' ? (
                        <button 
                            className="btn btn-primary" 
                            onClick={handleNextClick}
                        >
                            Next →
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Delivery Record'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const ViewDeliveryModal = ({ show, onClose, delivery }) => {
    if (!show || !delivery) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="do-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2><Eye size={20} /> View Delivery Record</h2>
                        <p>Delivery details for {delivery.patientName}</p>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    <div className="view-delivery-grid">
                        <div className="view-section">
                            <h3><User size={16} /> Patient Information</h3>
                            <div className="view-fields">
                                <div className="view-field">
                                    <label>Patient Name:</label>
                                    <span>{delivery.patientName}</span>
                                </div>
                                <div className="view-field">
                                    <label>Patient ID:</label>
                                    <span>{delivery.patientId}</span>
                                </div>
                                <div className="view-field">
                                    <label>Station:</label>
                                    <span>{delivery.station}</span>
                                </div>
                                <div className="view-field">
                                    <label>Risk Level:</label>
                                    <span>{delivery.riskLevel}</span>
                                </div>
                            </div>
                        </div>

                        <div className="view-section">
                            <h3><Stethoscope size={16} /> Delivery Details</h3>
                            <div className="view-fields">
                                <div className="view-field">
                                    <label>Delivery Date:</label>
                                    <span>{delivery.deliveryDate}</span>
                                </div>
                                <div className="view-field">
                                    <label>Delivery Time:</label>
                                    <span>{formatTime12Hour(delivery.deliveryTime) || 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>Type:</label>
                                    <span>{delivery.deliveryType}</span>
                                </div>
                                <div className="view-field">
                                </div>
                                <div className="view-field">
                                    <label>Facility:</label>
                                    <span>{delivery.facility || 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>Attending Staff:</label>
                                    <span>{delivery.staff || 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>Gestational Age:</label>
                                    <span>{delivery.gestationalAge || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="view-section">
                            <h3><AlertTriangle size={16} /> Complications</h3>
                            <div className="view-field">
                                <span>{delivery.complications || 'None'}</span>
                            </div>
                        </div>

                        <div className="view-section">
                            <h3><Baby size={16} /> Baby Information</h3>
                            <div className="view-fields">
                                <div className="view-field">
                                    <label>Baby Name:</label>
                                    <span>{delivery.babyName || 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>Outcome:</label>
                                    <span>{delivery.babyOutcome}</span>
                                </div>
                                <div className="view-field">
                                    <label>Weight:</label>
                                    <span>{delivery.babyWeight ? `${delivery.babyWeight} kg` : 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>Length:</label>
                                    <span>{delivery.babyLength ? `${delivery.babyLength} cm` : 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>Head Circumference:</label>
                                    <span>{delivery.headCircumference ? `${delivery.headCircumference} cm` : 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>Gender:</label>
                                    <span>{delivery.babyGender || 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>APGAR 1min:</label>
                                    <span>{delivery.apgar1 || 'N/A'}</span>
                                </div>
                                <div className="view-field">
                                    <label>APGAR 5min:</label>
                                    <span>{delivery.apgar5 || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="view-section">
                            <h3><Calendar size={16} /> Follow-up</h3>
                            <div className="view-fields">
                                <div className="view-field">
                                    <label>Postpartum Visit:</label>
                                    <span>{delivery.postpartumDate || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {delivery.notes && (
                            <div className="view-section">
                                <h3><FileText size={16} /> Notes</h3>
                                <div className="view-field">
                                    <span>{delivery.notes}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default DeliveryOutcomes;
