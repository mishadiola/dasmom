import React, { useState, useEffect } from 'react';
import PatientService from '../../services/patientservice';
import BabyService from '../../services/babyservices';
import supabase from '../../config/supabaseclient';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, X, Syringe, Pill, Package,
    AlertTriangle, CheckCircle2, Clock, XCircle,
    Eye, Edit2, Calendar, Download, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Baby
} from 'lucide-react';
import '../../styles/pages/Vaccinations.css';

const VACCINE_TYPES = ['Tetanus Toxoid (TT)', 'BCG', 'Hepatitis B (HepB)', 'Influenza', 'OPV', 'DPT'];
const SUPPLEMENT_TYPES = ['Iron', 'Folic Acid', 'Calcium', 'Vitamin D'];
const STAFF_LIST = ['Nurse Ana', 'Nurse Bea', 'Midwife Elena', 'Midwife Ana', 'Dr. Reyes (OB)'];

/* ════════════════════════════════════
   RECORD MODAL COMPONENT
════════════════════════════════════ */
const RecordModal = ({ mode, onClose, onSave }) => {
    const [form, setForm] = useState({
        patientType: 'Mother', patientName: '', vaccine: '',
        supplement: '', dose: '', date: '', nextDue: '', staff: STAFF_LIST[0], notes: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [pendingVaccines, setPendingVaccines] = useState([]);
    const [selectedVaccines, setSelectedVaccines] = useState({});
    const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    useEffect(() => {
        const searchPendingVaccines = async () => {
            if (!form.patientName || form.patientName.trim().length < 3) {
                setSelectedPatient(null);
                setPendingVaccines([]);
                setSelectedVaccines({});
                return;
            }

            try {
                const patientService = new PatientService();
                let patientId = null;
                let patientLabel = null;

                if (form.patientType === 'Mother') {
                    const mothers = await patientService.searchPatients(form.patientName);
                    if (mothers.length === 1) {
                        patientId = mothers[0].id;
                        patientLabel = mothers[0].name;
                    }
                } else {
                    const newborns = await babyService.searchNewborns(form.patientName);
                    if (newborns.length === 1) {
                        patientId = newborns[0].id;
                        patientLabel = newborns[0].name;
                    }
                }

                if (!patientId) {
                    setSelectedPatient(null);
                    setPendingVaccines([]);
                    setSelectedVaccines({});
                    return;
                }

                setSelectedPatient({ id: patientId, label: patientLabel, type: form.patientType });

                const { data: pendingRows, error: pendingError } = await supabase
                    .from('vaccinations')
                    .select(`id, dose_number, scheduled_vaccination, vaccinated_date, status, vaccine_inventory (vaccine_name)`)
                    .eq('patient_id', patientId)
                    .eq('status', 'Pending')
                    .order('scheduled_vaccination', { ascending: true });

                if (pendingError) {
                    console.warn('Unable to load pending vaccinations:', pendingError);
                    setPendingVaccines([]);
                    setSelectedVaccines({});
                    return;
                }

                const pending = (pendingRows || []).map(row => ({
                    id: row.id,
                    vaccine: row.vaccine_inventory?.vaccine_name || 'Unknown Vaccine',
                    dose_number: row.dose_number,
                    scheduled_vaccination: row.scheduled_vaccination,
                    status: row.status
                }));

                setPendingVaccines(pending);
                setSelectedVaccines({});
            } catch (err) {
                console.error('Error loading patient vaccination schedule:', err);
                setSelectedPatient(null);
                setPendingVaccines([]);
                setSelectedVaccines({});
            }
        };

        const timer = setTimeout(searchPendingVaccines, 400);
        return () => clearTimeout(timer);
    }, [form.patientName, form.patientType]);

    const handleSave = async () => {
        const hasPendingSelection = mode === 'vaccine' && Object.values(selectedVaccines).some(Boolean);
        if (!form.patientName || (mode === 'vaccine' && !hasPendingSelection && (!form.vaccine || !form.dose)) || (mode === 'supplement' && (!form.supplement || !form.dose)) || !form.date || !form.staff) {
            alert('Please fill in all required fields.');
            return;
        }

        setIsSaving(true);
        try {
            const patientService = new PatientService();

            let patientId;
            if (form.patientType === 'Mother') {
                const patients = await patientService.searchPatients(form.patientName);
                if (patients.length !== 1) throw new Error('Please enter a unique patient name');
                patientId = patients[0].id;
            } else {
                const newborns = await babyService.searchNewborns(form.patientName);
                if (newborns.length !== 1) throw new Error('Please enter a unique newborn name');
                patientId = newborns[0].id;
            }

            const currentUser = await patientService.getCurrentUserId();
            if (!currentUser) throw new Error('No logged-in user');

            if (mode === 'vaccine') {
                const selectedScheduledIds = Object.entries(selectedVaccines)
                    .filter(([, checked]) => checked)
                    .map(([id]) => id);

                if (selectedScheduledIds.length > 0) {
                    // Mark existing scheduled vaccine records as completed
                    for (const scheduledId of selectedScheduledIds) {
                        await supabase.from('vaccinations').update({
                            vaccinated_date: form.date,
                            status: 'Completed',
                            notes: form.notes || null
                        }).eq('id', scheduledId);
                    }
                } else {
                    const { data: vaccInv } = await supabase.from('vaccine_inventory').select('id').eq('vaccine_name', form.vaccine).single();
                    if (!vaccInv) throw new Error('Vaccine not found in inventory');

                    const doseNumber = form.dose === '1st Dose' ? 1 : form.dose === '2nd Dose' ? 2 : form.dose === '3rd Dose' ? 3 : form.dose === 'Booster' ? 4 : 5;

                    await supabase.from('vaccinations').insert({
                        patient_id: patientId,
                        vaccine_inventory_id: vaccInv.id,
                        dose_number: doseNumber,
                        vaccinated_date: form.date,
                        scheduled_vaccination: form.nextDue || null,
                        status: 'Completed',
                        created_by: currentUser,
                        notes: form.notes
                    });
                }
            } else {
                const { data: suppInv } = await supabase.from('supplement_inventory').select('id').eq('supplement_name', form.supplement).single();
                if (!suppInv) throw new Error('Supplement not found in inventory');

                await supabase.from('supplements').insert({
                    patient_id: patientId,
                    supplement_inventory_id: suppInv.id,
                    dosage: form.dose,
                    start_date: form.date,
                    end_date: form.nextDue || null,
                    status: 'Ongoing',
                    created_by: currentUser,
                    notes: form.notes
                });
            }

            if (onSave) {
                onSave(); // Trigger parent refresh
            } else {
                onClose(); // Fallback to just close
            }
        } catch (error) {
            console.error('Error saving record:', error);
            alert('Failed to save record: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

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
                    {mode === 'vaccine' && pendingVaccines.length > 0 && (
                        <div className="pending-vaccines-section">
                            <h3>Pending Scheduled Vaccines</h3>
                            <p className="pending-vaccines-note">Check any scheduled doses that were administered today to update their records.</p>
                            {pendingVaccines.map(v => (
                                <label key={v.id} className="pending-vaccine-item">
                                    <input
                                        type="checkbox"
                                        checked={!!selectedVaccines[v.id]}
                                        onChange={() => setSelectedVaccines(prev => ({ ...prev, [v.id]: !prev[v.id] }))}
                                    />
                                    {v.vaccine} (Dose {v.dose_number}) — {v.scheduled_vaccination}
                                </label>
                            ))}
                        </div>
                    )}
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
                    <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                        {isSaving ? 'Saving...' : 'Confirm & Save'}
                    </button>
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
    const patientService = new PatientService();
    const babyService = BabyService;

    // State
    const [stats, setStats] = useState({
        totalAdministered: 0,
        mothersPending: 0,
        newbornsPending: 0,
        supplementsDistributed: 0,
        lowStockAlerts: 0
    });
    const [inventory, setInventory] = useState([]);
    const [vaccinationRecords, setVaccinationRecords] = useState([]);
    const [supplementRecords, setSupplementRecords] = useState([]);
    const [newbornPending, setNewbornPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('vaccines');    // 'vaccines' | 'supplements' | 'newborns'
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ patientType: 'All', status: 'All', item: 'All' });
    const [recordModal, setRecordModal] = useState(null);      // null | 'vaccine' | 'supplement'
    const [expirationSummaryModal, setExpirationSummaryModal] = useState(null);      // null | 'vaccine' | 'supplement'
    const [expandedRows, setExpandedRows] = useState({});
    const [sortField, setSortField] = useState('');
    const [sortAsc, setSortAsc] = useState(true);

    const fetchData = async () => {
        try {
            setLoading(true);

            const { data: vaccRecords } = await supabase.from('vaccinations').select('*').order('created_at', { ascending: false });
            const { data: suppRecords } = await supabase.from('supplements').select('*').order('created_at', { ascending: false });

            // Get maps for names
            const { data: vaccineInv } = await supabase.from('vaccine_inventory').select('id, vaccine_name');
            const vaccineMap = new Map(vaccineInv.map(v => [v.id, v.vaccine_name]));
            const { data: suppInv } = await supabase.from('supplement_inventory').select('id, supplement_name');
            const suppMap = new Map(suppInv.map(s => [s.id, s.supplement_name]));
            const { data: staff } = await supabase.from('staff_profiles').select('id, full_name');
            const staffMap = new Map(staff.map(s => [s.id, s.full_name]));

            // Get patient information
            const patientIds = [...new Set([...(vaccRecords || []).map(r => r.patient_id), ...(suppRecords || []).map(r => r.patient_id)])];
            const patients = patientIds.length > 0 ? await patientService.getPatientsByIds(patientIds) : [];
            const patientMap = new Map(patients.map(p => [p.id, { ...p, type: 'Mother' }]));

            // Get newborns for ids not in patients
            const newbornIds = patientIds.filter(id => !patientMap.has(id));
            if (newbornIds.length > 0) {
                const { data: newborns } = await supabase.from('newborns').select('id, baby_name, mother_id, deliveries!inner (delivery_date), patient_basic_info!mother_id (first_name, last_name, barangay, province)').in('id', newbornIds);
                newborns.forEach(newborn => {
                    const mother = newborn.patient_basic_info;
                    patientMap.set(newborn.id, {
                        id: newborn.id,
                        name: newborn.baby_name || `Newborn of ${mother.first_name} ${mother.last_name}`,
                        station: `${mother.barangay}, ${mother.province}`,
                        type: 'Newborn',
                        date_of_birth: newborn.deliveries.delivery_date
                    });
                });
            }

            // Transform vaccination records
            const transformedVaccRecords = (vaccRecords || []).map(record => {
                const vaccinationDate = record.vaccinated_date || null;
                const scheduledDate = record.scheduled_vaccination || null;
                const expirationDate = calculateExpirationDate(vaccinationDate, 'vaccine');
                const expStatus = getExpirationStatus(expirationDate);
                return {
                    id: record.id,
                    patientId: record.patient_id,
                    patientName: patientMap.get(record.patient_id)?.name || 'Unknown',
                    station: patientMap.get(record.patient_id)?.station || 'Unknown',
                    type: patientMap.get(record.patient_id)?.type || 'Unknown',
                    vaccine: vaccineMap.get(record.vaccine_inventory_id) || 'Unknown',
                    dose: `${record.dose_number}${record.dose_number === 1 ? 'st' : record.dose_number === 2 ? 'nd' : record.dose_number === 3 ? 'rd' : 'th'} Dose`,
                    date: vaccinationDate,
                    nextDue: scheduledDate,
                    expirationDate: expirationDate,
                    expirationStatus: expStatus.status,
                    expirationClass: expStatus.class,
                    staff: staffMap.get(record.created_by) || 'Unknown',
                    notes: record.notes,
                    status: record.status || (vaccinationDate ? 'Completed' : 'Pending')
                };
            });

            // Transform supplement records
            const transformedSuppRecords = (suppRecords || []).map(record => {
                const expirationDate = calculateExpirationDate(record.start_date, 'supplement');
                const expStatus = getExpirationStatus(expirationDate);
                return {
                    id: record.id,
                    patientId: record.patient_id,
                    patientName: patientMap.get(record.patient_id)?.name || 'Unknown',
                    station: patientMap.get(record.patient_id)?.station || 'Unknown',
                    type: patientMap.get(record.patient_id)?.type || 'Unknown',
                    supplement: suppMap.get(record.supplement_inventory_id) || 'Unknown',
                    dose: record.dosage,
                    date: record.start_date,
                    nextDue: record.end_date,
                    expirationDate: expirationDate,
                    expirationStatus: expStatus.status,
                    expirationClass: expStatus.class,
                    staff: staffMap.get(record.created_by) || 'Unknown',
                    notes: record.notes,
                    status: record.status
                };
            });

            setVaccinationRecords(transformedVaccRecords);
            setSupplementRecords(transformedSuppRecords);

            // Update stats
            setStats({
                totalAdministered: vaccRecords.length,
                mothersPending: 0, // TODO: calculate
                newbornsPending: 0, // TODO: calculate
                supplementsDistributed: suppRecords.length,
                lowStockAlerts: 0 // TODO: calculate
            });

            // Update inventory
            const inventoryService = (await import('../../services/inventoryservice')).default;
            const invSvc = new inventoryService();
            const vaccineInvData = await invSvc.getVaccineInventory();
            const suppInvData = await invSvc.getSupplementInventory();
            const inventory = [...vaccineInvData.map(v => ({ ...v, type: 'vaccine', threshold: 20, status: v.quantity < 10 ? 'Critical' : v.quantity < 20 ? 'Low' : 'Sufficient' })), ...suppInvData.map(s => ({ ...s, type: 'supplement', threshold: 50, status: s.quantity < 25 ? 'Critical' : s.quantity < 50 ? 'Low' : 'Sufficient' }))];
            setInventory(inventory);

            setVaccinationRecords(transformedVaccRecords);
            setSupplementRecords(transformedSuppRecords);

            // Fetch newborn pending vaccinations
            const newbornData = await patientService.getNewbornPendingVaccinations();
            setNewbornPending(newbornData);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };
    
    // Helper function to calculate age from date of birth
    const calculateAge = (dateOfBirth) => {
        if (!dateOfBirth) return 0;
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // Helper function to calculate expiration date (frontend only)
    const calculateExpirationDate = (dateGiven, itemType) => {
        if (!dateGiven) return null;
        const given = new Date(dateGiven);
        // Vaccines typically expire 1 year after administration
        // Supplements typically expire 6 months after start
        const monthsToAdd = itemType === 'vaccine' ? 12 : 6;
        given.setMonth(given.getMonth() + monthsToAdd);
        return given.toISOString().split('T')[0];
    };

    // Helper function to determine expiration status
    const getExpirationStatus = (expirationDate) => {
        if (!expirationDate) return { status: 'Unknown', class: 'status-unknown' };
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expDate = new Date(expirationDate);
        expDate.setHours(0, 0, 0, 0);
        
        const daysUntilExpiry = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
            return { status: 'Expired', class: 'status-expired', days: daysUntilExpiry };
        } else if (daysUntilExpiry <= 30) {
            return { status: 'Near Expiry', class: 'status-near-expiry', days: daysUntilExpiry };
        } else {
            return { status: 'Valid', class: 'status-valid', days: daysUntilExpiry };
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Refresh data when modal closes (assuming new record was added)
    const handleModalClose = () => {
        setRecordModal(null);
        fetchData(); // Refresh data to show new records
    };

    // Derived Stats for UI mapping
    const dynamicSummaryStats = [
        { label: 'Total Vaccinations Administered', value: stats.totalAdministered, color: 'lilac', icon: Syringe },
        { label: 'Mothers Pending Vaccines', value: stats.mothersPending, color: 'pink', icon: AlertCircle },
        { label: 'Newborns Pending Vaccines', value: stats.newbornsPending, color: 'orange', icon: AlertCircle },
        { label: 'Supplements Distributed', value: stats.supplementsDistributed, unit: 'units', color: 'sage', icon: Pill },
        { label: 'Low Stock Items', value: stats.lowStockAlerts, color: 'rose', icon: Package },
    ];

    const handleFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSort = (field) => {
        if (sortField === field) setSortAsc(prev => !prev);
        else { setSortField(field); setSortAsc(true); }
    };

    // ── Filter + sort vaccines ──
    const filteredVaccines = vaccinationRecords
        .filter(v => {
            const s = searchTerm.toLowerCase();
            const matchSearch = v.patientName.toLowerCase().includes(s) || v.patientId.toLowerCase().includes(s) || v.station.toLowerCase().includes(s);
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
    const filteredSupplements = supplementRecords
        .filter(s => {
            const q = searchTerm.toLowerCase();
            const matchSearch = s.patientName.toLowerCase().includes(q) || s.patientId.toLowerCase().includes(q) || s.station.toLowerCase().includes(q);
            const matchType = filters.patientType === 'All' || s.type === filters.patientType;
            const matchStatus = filters.status === 'All' || s.status === filters.status;
            const matchItem = filters.item === 'All' || s.supplement === filters.item;
            return matchSearch && matchType && matchStatus && matchItem;
        })
        .sort((a, b) => {
            if (!sortField) return 0;
            const va = a[sortField] ?? ''; const vb = b[sortField] ?? '';
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
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
                    <h1 className="page-title"><Syringe size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Vaccines & Supplements</h1>
                    <p className="page-subtitle">This page is used to record and track vaccines and supplements that have been administered to patients.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline"><Download size={16} /> Export Report</button>
                    <button className="btn btn-outline" onClick={() => setRecordModal('supplement')}><Pill size={16} /> Record Supplement</button>
                    <button className="btn btn-primary" onClick={() => setRecordModal('vaccine')}><Syringe size={16} /> Record Vaccination</button>
                </div>
            </div>

            {/* ── Summary Stats ── */}
            <div className="vacc-stats-grid">
                {dynamicSummaryStats.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className={`stat-card stat-card--${s.color} ${loading ? 'skeleton-loading' : ''}`}>
                            <div className="stat-top">
                                <div className={`stat-icon stat-icon--${s.color}`}>
                                    <Icon size={20} />
                                </div>
                            </div>
                            <div className="stat-value">{loading ? '...' : s.value}{s.unit && <span className="stat-unit"> {s.unit}</span>}</div>
                            <div className="stat-label">{s.label}</div>
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
                        placeholder="Search by patient name, ID, or station..."
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
                        <button className={`vacc-tab ${activeTab === 'newborns' ? 'active' : ''}`} onClick={() => setActiveTab('newborns')}>
                            <Baby size={15} /> Newborns
                        </button>
                    </div>

                    <div className="vacc-card">
                        <div className="vacc-card-head">
                            <h2>{activeTab === 'vaccines' ? <><Syringe size={16} /> Vaccination Records</> : activeTab === 'supplements' ? <><Pill size={16} /> Supplement Records</> : <><Baby size={16} /> Newborn Pending Vaccinations</>}</h2>
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
                                            <th>Expiration</th>
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
                                                                <span className="vacc-pid">{v.patientId} · {v.station}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className={`type-badge type-${v.type.toLowerCase()}`}>{v.type}</span></td>
                                                    <td className="vacc-item-name">{v.vaccine}</td>
                                                    <td className="vacc-dose">{v.dose}</td>
                                                    <td className="vacc-date">{v.dateAdministered || <span className="not-yet">Not given</span>}</td>
                                                    <td className="vacc-date">
                                                        {v.expirationDate ? (
                                                            <>
                                                                <span className={`exp-status ${v.expirationClass}`}>{v.expirationStatus}</span>
                                                                <span className="exp-date">{v.expirationDate}</span>
                                                            </>
                                                        ) : <span className="not-yet">—</span>}
                                                    </td>
                                                    <td className="vacc-date">{v.nextDue || <span className="not-yet">—</span>}</td>
                                                    <td><span className={`vacc-status ${vaccineStatusClass(v.status)}`}>{v.status}</span></td>
                                                    <td className="vacc-staff">{v.staff}</td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="action-btn view-btn" title="View Details" onClick={() => setExpirationSummaryModal({ patientId: v.patientId, patientName: v.patientName, type: 'vaccine' })}><Eye size={13} /></button>
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
                                                                <div><strong>Station:</strong> {v.station}</div>
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
                                            <th>Expiration</th>
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
                                                            <span className="vacc-pid">{s.patientId} · {s.station}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span className={`type-badge type-${s.type.toLowerCase()}`}>{s.type}</span></td>
                                                <td className="vacc-item-name">{s.supplement}</td>
                                                <td className="vacc-dose">{s.dose}</td>
                                                <td className="vacc-date">{s.startDate}</td>
                                                <td className="vacc-date">
                                                    {s.expirationDate ? (
                                                        <>
                                                            <span className={`exp-status ${s.expirationClass}`}>{s.expirationStatus}</span>
                                                            <span className="exp-date">{s.expirationDate}</span>
                                                        </>
                                                    ) : <span className="not-yet">—</span>}
                                                </td>
                                                <td className="vacc-date">{s.endDate}</td>
                                                <td><span className={`vacc-status ${supplementStatusClass(s.status)}`}>{s.status}</span></td>
                                                <td className="vacc-staff">{s.staff}</td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="action-btn view-btn" title="View Details" onClick={() => setExpirationSummaryModal({ patientId: s.patientId, patientName: s.patientName, type: 'supplement' })}><Eye size={13} /></button>
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

                        {activeTab === 'newborns' && (
                            <div className="table-responsive">
                                <table className="vacc-table">
                                    <thead>
                                        <tr>
                                            <th>Baby Name</th>
                                            <th>Mother Name</th>
                                            <th>Birth Date</th>
                                            <th>Pending Vaccines</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="5" className="vacc-loading">Loading...</td></tr>
                                        ) : newbornPending.map(n => (
                                            <tr key={n.id}>
                                                <td className="vacc-patient-name">{n.babyName}</td>
                                                <td className="vacc-patient-name">{n.motherName}</td>
                                                <td className="vacc-date">{n.birthDate}</td>
                                                <td className="vacc-item-name">{n.pendingVaccines}</td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="action-btn record-btn" title="Record Vaccination" onClick={() => setRecordModal('vaccine')}><Plus size={13} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {!loading && !newbornPending.length && (
                                            <tr>
                                                <td colSpan="5" className="vacc-empty">
                                                    <Baby size={28} />
                                                    <p>No newborns with pending vaccinations</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>



            {/* ── Record Modal ── */}
            {recordModal && <RecordModal mode={recordModal} onClose={handleModalClose} />}

            {/* ── Expiration Summary Modal ── */}
            {expirationSummaryModal && (
                <div className="modal-backdrop" onClick={() => setExpirationSummaryModal(null)}>
                    <div className="vacc-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2><AlertCircle size={20} /> Expiration Summary</h2>
                                <p>{expirationSummaryModal.patientName} - {expirationSummaryModal.type === 'vaccine' ? 'Vaccinations' : 'Supplements'}</p>
                            </div>
                            <button className="modal-close" onClick={() => setExpirationSummaryModal(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            {(() => {
                                const records = expirationSummaryModal.type === 'vaccine' 
                                    ? vaccinationRecords.filter(r => r.patientId === expirationSummaryModal.patientId)
                                    : supplementRecords.filter(r => r.patientId === expirationSummaryModal.patientId);
                                
                                const expiredCount = records.filter(r => r.expirationStatus === 'Expired').length;
                                const nearExpiryCount = records.filter(r => r.expirationStatus === 'Near Expiry').length;
                                const validCount = records.filter(r => r.expirationStatus === 'Valid').length;
                                const totalCount = records.length;

                                return (
                                    <>
                                        {/* Summary Section */}
                                        <div className="exp-summary-grid">
                                            <div className="exp-summary-card exp-summary-total">
                                                <div className="exp-summary-value">{totalCount}</div>
                                                <div className="exp-summary-label">Total Items</div>
                                            </div>
                                            <div className="exp-summary-card exp-summary-expired">
                                                <div className="exp-summary-value">{expiredCount}</div>
                                                <div className="exp-summary-label">Expired</div>
                                            </div>
                                            <div className="exp-summary-card exp-summary-near">
                                                <div className="exp-summary-value">{nearExpiryCount}</div>
                                                <div className="exp-summary-label">Near Expiry</div>
                                            </div>
                                            <div className="exp-summary-card exp-summary-valid">
                                                <div className="exp-summary-value">{validCount}</div>
                                                <div className="exp-summary-label">Valid</div>
                                            </div>
                                        </div>

                                        {/* Detailed List View */}
                                        <div className="exp-detailed-list">
                                            <h3>Detailed Records</h3>
                                            {records.length === 0 ? (
                                                <p className="no-records">No records found for this patient.</p>
                                            ) : (
                                                <table className="exp-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Item Name</th>
                                                            <th>Type</th>
                                                            <th>Date Given</th>
                                                            <th>Expiration Date</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {records.map(r => (
                                                            <tr key={r.id}>
                                                                <td>{expirationSummaryModal.type === 'vaccine' ? r.vaccine : r.supplement}</td>
                                                                <td>{expirationSummaryModal.type === 'vaccine' ? 'Vaccine' : 'Supplement'}</td>
                                                                <td>{r.date}</td>
                                                                <td>{r.expirationDate || '—'}</td>
                                                                <td>
                                                                    <span className={`exp-status-badge ${r.expirationClass}`}>
                                                                        {r.expirationStatus}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => setExpirationSummaryModal(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vaccinations;
