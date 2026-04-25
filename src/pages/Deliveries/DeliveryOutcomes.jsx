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
import babyservices from '../../services/babyservices';
import PatientService from '../../services/patientservice';
import supabase from '../../config/supabaseclient';
import * as XLSX from 'xlsx';
import { formatTime12Hour } from '../../utils/pregnancyUtils';

const COMPLICATION_OPTIONS = ['None', 'Hemorrhage', 'Infection', 'Preeclampsia', 'Placenta Previa', 'Preterm'];
const DELIVERY_TYPES = ['NSD', 'CS', 'Breech'];

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
    const [showViewModal, setShowViewModal] = useState(false);
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
                babyservices.getAllDeliveries(),
                babyservices.getDeliveryStats()
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
            const stationsData = await babyservices.getStations();
            setStations(stationsData);
            
            const allStaff = await babyservices.getAllStaff();
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
                const matchRisk = filters.risk === 'All' || d.riskLevel === filters.risk;
                const matchComp = filters.complication === 'All' || 
                    (filters.complication === 'None' ? d.complications === 'None' : d.complications !== 'None');
                const matchStation = filters.station === 'All' || d.station === filters.station;

                return matchSearch && matchType && matchRisk && matchComp && matchStation;
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

    const getBabyBadge = (b) => {
        if (b === 'NICU' || b === 'Special Care') return 'baby-nicu';
        if (b === 'Stillbirth') return 'baby-stillbirth';
        return 'baby-alive';
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
        if (!confirm('Are you sure you want to create a new pregnancy record for this patient? This will mark them as active/pregnant again.')) {
            return;
        }

        try {
            const patientService = new PatientService();
            
            // Create new pregnancy record
            const newPregnancyData = {
                patient_id: patientId,
                lmd: new Date().toISOString().split('T')[0], // Set LMP to current date
                edd: null, // Will be calculated based on LMP
                gravida: null, // Will be updated from patient history
                para: null, // Will be updated from patient history
                risk_factors: '',
                calculated_risk: 'Normal',
                pregnancy_type: 'Singleton',
                status: 'Active'
            };

            // Insert new pregnancy record
            const { data: pregnancyData, error: pregnancyError } = await supabase
                .from('pregnancy_info')
                .insert([newPregnancyData])
                .select()
                .single();

            if (pregnancyError) throw pregnancyError;

            // Update patient basic info to mark as pregnant
            const { error: updateError } = await supabase
                .from('patient_basic_info')
                .update({ is_pregnant: true })
                .eq('id', patientId);

            if (updateError) throw updateError;

            alert(' New pregnancy record created successfully!');
            
            // Navigate to patient profile
            navigate(`/dashboard/patients/${patientId}?from=deliveries`);
        } catch (err) {
            console.error('Error creating new pregnancy:', err);
            alert(` Failed to create new pregnancy: ${err.message}`);
        }
    };

    return (
        <div className="do-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Stethoscope size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> 
                        Delivery Outcomes
                    </h1>
                    <p className="page-subtitle">Record and monitor birth events — type, outcome, complications, and baby status</p>
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
                onClose={() => setShowModal(false)}
                onSuccess={loadData}
                stations={stations}
                staffList={staffList}
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
                    <div className="view-toggle-wrap">
                        <button 
                            className={`view-toggle ${filters.view === 'outcomes' ? 'active' : ''}`} 
                            onClick={() => handleFilter('view', 'outcomes')}
                        >
                            Completed Deliveries
                        </button>
                    </div>
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    <select value={filters.type} onChange={e => handleFilter('type', e.target.value)}>
                        <option value="All">All Types</option>
                        {DELIVERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={filters.risk} onChange={e => handleFilter('risk', e.target.value)}>
                        <option value="All">All Risk</option>
                        <option value="Normal">Normal</option>
                        <option value="Monitor">Monitor</option>
                        <option value="High Risk">High Risk</option>
                    </select>
                    <select value={filters.complication} onChange={e => handleFilter('complication', e.target.value)}>
                        <option value="All">All Complications</option>
                        <option value="None">No Complications</option>
                        <option value="HasComp">With Complications</option>
                    </select>
                    <select value={filters.station} onChange={e => handleFilter('station', e.target.value)}>
                        {stations.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
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
                                        <th><span className="sortable-head" onClick={() => handleSort('patientName')}>
                                            Patient <SortBtn field="patientName" />
                                        </span></th>
                                        <th><span className="sortable-head" onClick={() => handleSort('deliveryDate')}>
                                            Birth Date <SortBtn field="deliveryDate" />
                                        </span></th>
                                        <th>Type</th>
                                        <th>Risk</th>
                                        <th>Complications</th>
                                        <th>Baby Status</th>
                                        <th>Staff</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="8" className="do-loading">Loading...</td></tr>
                                    ) : filtered.map(d => (
                                        <tr key={d.id} className={`do-row ${getRowClass(d)}`}>
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
                                                <span className="do-date">{d.deliveryDate}</span>
                                                {d.deliveryTime && <span className="do-time">{formatTime12Hour(d.deliveryTime)}</span>}
                                            </td>
                                            <td><span className={`dt-badge dt-${d.deliveryType?.toLowerCase()}`}>{d.deliveryType}</span></td>
                                            <td><span className={`risk-badge ${getRiskBadge(d.riskLevel)}`}>{d.riskLevel}</span></td>
                                            <td>
                                                <span className={`comp-text ${d.complications !== 'None' ? 'has-comp' : ''}`}>
                                                    {d.complications !== 'None' && <AlertCircle size={12} />}
                                                    {d.complications || 'None'}
                                                </span>
                                            </td>
                                            <td>
                                                {d.babyName && <div className="baby-name-summary">{d.babyName}</div>}
                                                <span className={`baby-badge ${getBabyBadge(d.babyOutcome)}`}>{d.babyOutcome}</span>
                                            </td>
                                            <td>{d.staff}</td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="action-btn view-btn" title="View" onClick={() => navigate(`/dashboard/patients/${d.patientId}`)}><Eye size={13} /></button>
                                                    <button className="action-btn new-pregnancy-btn" title="New Pregnancy" onClick={() => handleNewPregnancy(d.patientId)}><RefreshCw size={13} /></button>
                                                    <button className="action-btn edit-btn" title="Edit"><Edit2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && !filtered.length && (
                                        <tr>
                                            <td colSpan="8" className="do-empty">
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
            </div>
        </div>
    );
};

const AddDeliveryModal = ({ show, onClose, onSuccess, stations, staffList }) => {
    const patientService = new PatientService();
    const [section, setSection] = useState('patient');
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [localStaff, setLocalStaff] = useState(staffList);
    const [staffLoading, setStaffLoading] = useState(true);
    const [form, setForm] = useState({
        patientId: '',
        patientName: '',
        station: '',
        gestationalAge: '',
        riskLevel: 'Normal',
        pregnancyType: 'Singleton',
        deliveryDate: new Date().toISOString().split('T')[0],
        deliveryTime: '',
        deliveryType: 'NSD',
        deliveryMode: '',
        attendingStaffId: '',
        attendingStaffName: '',
        facility: stations?.[0] || '',
        complications: ['None'],
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
     useEffect(() => {
        const loadStaff = async () => {
            setStaffLoading(true);
            try {
                const { data, error } = await supabase
                    .from('staff_profiles')
                    .select('id, full_name, barangay_assignment')
                    .order('full_name');
                
                if (error) throw error;
                console.log('✅ Staff loaded:', data?.length || 0);
                setLocalStaff(data || []);
            } catch (err) {
                console.error('❌ Staff load failed:', err);
                setLocalStaff([
                    { id: 'demo1', full_name: 'Midwife Elena P.', role: 'Midwife', barangay_assignment: 'Brgy Poblacion' },
                    { id: 'demo2', full_name: 'Dr. Reyes (OB)', role: 'Doctor', barangay_assignment: 'Main Clinic' }
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
            const barangay = staff.barangay_assignment?.toLowerCase() || '';
            return barangay.includes(targetBarangay);
        });
    }, [form.station, localStaff, staffList]);

    const updateForm = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (key === 'patientName' && value.length > 2) {
            handleSearch(value);
        }
        if (key === 'patientName' && value.length <= 2) {
            setSearchResults([]);
        }
    };
    useEffect(() => {
        if (show && staffList.length === 0) {
            console.log('Staff list:', staffList);
        }
    }, [show, staffList]);
    const handleSearch = async (query) => {
        try {
            const results = await babyservices.searchPregnantMothers(query);
            setSearchResults(results);
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
            riskLevel: patient.riskLevel,
            pregnancyType: patient.pregnancyType || 'Singleton',
            gestationalAge: patient.gestationalAge || '',
            attendingStaffId: '',
            attendingStaffName: ''
        }));
        setSearchResults([]);
    };

    const updateNewborn = (index, key, value) => {
        setForm(prev => ({
            ...prev,
            newborns: prev.newborns.map((n, i) => i === index ? { ...n, [key]: value } : n)
        }));
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
        if (!form.patientId || !form.deliveryDate) {
            alert('Please select a patient and delivery date.');
            return;
        }

        setLoading(true);
        try {
            const deliveryData = {
                mother_id: form.patientId,
                delivery_date: form.deliveryDate,
                delivery_time: form.deliveryTime || '09:00',
                delivery_type: form.deliveryType,
                delivery_mode: form.deliveryMode || null,
                gestational_age: form.gestationalAge || null,
                risk_level: form.riskLevel || 'Normal',
                complications: form.complications.filter(c => c !== 'None'),
                attending_staff: form.attendingStaffId || null,
                facility: form.facility || null,
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

            const result = await babyservices.recordDelivery(deliveryData, newbornData);
            
            // Automatically schedule vaccinations for each newborn
            const vaccService = new VaccinationService();
            const newbornIds = result.newborn_ids || [];
            const createdBy = await new PatientService().getCurrentUserId();
            
            for (const newbornId of newbornIds) {
                await vaccService.scheduleNewbornVaccinations(newbornId, form.deliveryDate, createdBy);
            }
            
            onSuccess();
            onClose();
            alert('✅ Delivery recorded and vaccinations scheduled successfully!');
        } catch (err) {
            console.error('Save failed:', err);
            alert(`❌ Save failed: ${err.message}`);
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
                                onClick={() => setSection(s.id)}
                            >
                                <Icon size={14} /> {s.label}
                            </button>
                        );
                    })}
                </div>

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
                                <input type="date" value={form.deliveryDate} onChange={e => updateForm('deliveryDate', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Time</label>
                                <input type="time" value={form.deliveryTime} onChange={e => updateForm('deliveryTime', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Type <span className="req">*</span></label>
                                <select value={form.deliveryType} onChange={e => updateForm('deliveryType', e.target.value)}>
                                    <option value="NSD">NSD (Normal)</option>
                                    <option value="CS">CS (Cesarean)</option>
                                    <option value="Breech">Breech</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Mode</label>
                                <select value={form.deliveryMode} onChange={e => updateForm('deliveryMode', e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="Normal Spontaneous Delivery">Normal Spontaneous</option>
                                    <option value="Cesarean Section">Cesarean Section</option>
                                    <option value="Assisted Delivery">Assisted</option>
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
                                            {s.full_name} - {s.barangay_assignment || 'N/A'}
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
                                            <label>Baby Name</label>
                                            <input type="text" value={newborn.babyName} onChange={e => updateNewborn(index, 'babyName', e.target.value)} placeholder="Optional" />
                                        </div>
                                        <div className="form-group">
                                            <label>Birth Weight (kg)</label>
                                            <input type="number" step="0.01" value={newborn.babyWeight} onChange={e => updateNewborn(index, 'babyWeight', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>Birth Length (cm)</label>
                                            <input type="number" step="0.1" value={newborn.babyLength} onChange={e => updateNewborn(index, 'babyLength', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>Head Circumference (cm)</label>
                                            <input type="number" step="0.1" value={newborn.headCircumference} onChange={e => updateNewborn(index, 'headCircumference', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>Gender</label>
                                            <select value={newborn.babyGender} onChange={e => updateNewborn(index, 'babyGender', e.target.value)}>
                                                <option>Male</option>
                                                <option>Female</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>APGAR 1min</label>
                                            <input type="number" min="0" max="10" value={newborn.apgar1} onChange={e => updateNewborn(index, 'apgar1', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>APGAR 5min</label>
                                            <input type="number" min="0" max="10" value={newborn.apgar5} onChange={e => updateNewborn(index, 'apgar5', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>Baby Condition</label>
                                            <select value={newborn.babyCondition} onChange={e => updateNewborn(index, 'babyCondition', e.target.value)}>
                                                <option>Healthy</option>
                                                <option>NICU</option>
                                                <option>Special Care</option>
                                                <option>Stillbirth</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                <button type="button" className="btn btn-outline" onClick={addNewborn} disabled={form.newborns.length >= 5}>
                                    + Add Another Newborn
                                </button>
                            </div>
                        </div>
                    )}

                    {section === 'plan' && (
                        <div>
                            <div className="form-group">
                                <label>Postpartum Visit</label>
                                <input type="date" value={form.postpartumDate} onChange={e => updateForm('postpartumDate', e.target.value)} />
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
                            onClick={() => {
                                const idx = SECTIONS.findIndex(s => s.id === section);
                                setSection(SECTIONS[idx + 1].id);
                            }}
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
                                    <label>Mode:</label>
                                    <span>{delivery.deliveryMode || 'N/A'}</span>
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