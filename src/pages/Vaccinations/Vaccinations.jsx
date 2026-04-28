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
import NewbornVaccinationModal from '../../components/NewbornVaccinationModal';
import '../../styles/pages/Vaccinations.css';

// Constants for vaccine and supplement types
const VACCINE_TYPES = [
  'BCG', 'DPT', 'Hepatitis B', 'OPV', 'IPV', 'MMR', 'Hib', 'Rotavirus',
  'PCV', 'Influenza', 'COVID-19', 'HPV', 'Typhoid', 'Cholera', 'Yellow Fever'
];

const SUPPLEMENT_TYPES = [
  'Iron Tablets', 'Folic Acid', 'Vitamin A', 'Vitamin D', 'Vitamin C',
  'Calcium', 'Zinc', 'Iodine', 'Vitamin B Complex', 'Omega-3'
];

const STAFF_LIST = ['Nurse Ana', 'Nurse Bea', 'Midwife Elena', 'Midwife Ana', 'Dr. Reyes (OB)'];

const RecordModal = ({ mode, initialPatientType, initialPatientName, onClose, onSave }) => {
    const [form, setForm] = useState({
        patientType: initialPatientType || 'Mother', patientName: initialPatientName || '', vaccine: '',
        supplement: '', dose: '', date: new Date().toISOString().split('T')[0], nextDue: '', staff: '', notes: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [pendingVaccines, setPendingVaccines] = useState([]);
    const [selectedVaccines, setSelectedVaccines] = useState({});
    const [staffList, setStaffList] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [supplementTypes, setSupplementTypes] = useState([]);
    const [vaccineTypes, setVaccineTypes] = useState([]);
    const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.patient-search-wrapper')) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // Fetch supplement types from inventory when in supplement mode
        if (mode === 'supplement') {
            const fetchSupplementTypes = async () => {
                try {
                    const { data, error } = await supabase
                        .from('supplement_inventory')
                        .select('supplement_name')
                        .eq('status', 'active')
                        .order('supplement_name', { ascending: true });
                    
                    if (error) throw error;
                    setSupplementTypes(data?.map(item => item.supplement_name) || []);
                } catch (error) {
                    console.error('Error fetching supplement types:', error);
                    setSupplementTypes([]);
                }
            };
            fetchSupplementTypes();
        }
        // Fetch vaccine types from inventory when in vaccine mode
        if (mode === 'vaccine') {
            const fetchVaccineTypes = async () => {
                try {
                    const { data, error } = await supabase
                        .from('vaccine_inventory')
                        .select('vaccine_name')
                        .eq('status', 'active')
                        .order('vaccine_name', { ascending: true });
                    
                    if (error) throw error;
                    setVaccineTypes(data?.map(item => item.vaccine_name) || []);
                } catch (error) {
                    console.error('Error fetching vaccine types:', error);
                    setVaccineTypes([]);
                }
            };
            fetchVaccineTypes();
        }
    }, [mode]);

    useEffect(() => {
        console.log('✅ RecordModal useEffect triggered!', form.patientName, form.patientType);
        const searchPendingVaccines = async () => {
            console.log('🔍 Searching for patient:', form.patientName);
            if (!form.patientName || form.patientName.trim().length < 3) {
                console.log('⏸️ Patient name too short or empty');
                setSelectedPatient(null);
                setPendingVaccines([]);
                setSelectedVaccines({});
                setStaffList(STAFF_LIST);
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            try {
                const patientService = new PatientService();
                let patientId = null;
                let patientLabel = null;
                let barangay = '';
                
                // Generate suggestions for dropdown
                let allMatches = [];
                if (form.patientType === 'Mother') {
                    const mothers = await patientService.searchPatients(form.patientName);
                    allMatches = mothers.map(m => ({ 
                        id: m.id, 
                        name: m.name, 
                        station: m.station,
                        type: 'Mother'
                    }));
                    if (mothers.length === 1) {
                        patientId = mothers[0].id;
                        patientLabel = mothers[0].name;
                        barangay = mothers[0].station.split(',')[0].trim();
                    }
                } else {
                    const newborns = await BabyService.searchNewborns(form.patientName);
                    allMatches = newborns.map(n => ({ 
                        id: n.id, 
                        name: n.name,
                        type: 'Newborn'
                    }));
                    if (newborns.length === 1) {
                        patientId = newborns[0].id;
                        patientLabel = newborns[0].name;
                        // For newborns, get the mother's barangay
                        const { data: motherData } = await supabase
                            .from('newborns')
                            .select('mother_id, patient_basic_info!mother_id (barangay)')
                            .eq('id', patientId)
                            .single();
                        
                        if (motherData && motherData.patient_basic_info) {
                            barangay = motherData.patient_basic_info.barangay;
                        }
                    }
                }

                // Show suggestions if matches found
                setSuggestions(allMatches);
                setShowSuggestions(allMatches.length > 0);
                console.log('📊 Suggestions to show:', allMatches, 'Show:', allMatches.length > 0);

                if (!patientId) {
                    setSelectedPatient(null);
                    setPendingVaccines([]);
                    setSelectedVaccines({});
                    return;
                }

                setSelectedPatient({ id: patientId, label: patientLabel, type: form.patientType });

                // Fetch staff for the patient's barangay - match barangay_assignment
                console.log('🏥 RecordModal - Barangay before staff fetch:', barangay);
                if (barangay) {
                    const { data: staffData, error: staffError } = await supabase
                        .from('staff_profiles')
                        .select('full_name')
                        .eq('barangay_assignment', barangay);
                    
                    console.log('👨‍⚕️ RecordModal - Staff Data:', staffData, 'Error:', staffError);
                    
                    const staffOptions = staffData ? staffData.map(s => s.full_name) : [];
                    console.log('📋 RecordModal - Staff Options:', staffOptions);
                    setStaffList(staffOptions);
                    if (staffOptions.length > 0 && !staffOptions.includes(form.staff)) {
                        updateForm('staff', staffOptions[0]);
                    }
                } else {
                    console.log('⚠️ RecordModal - No barangay found');
                    setStaffList([]);
                }

                const { data: pendingRows, error: pendingError } = await supabase
                    .from('vaccinations')
                    .select(`id, dose_number, scheduled_vaccination, vaccinated_date, status, vaccine_inventory (vaccine_name), notes`)
                    .eq(form.patientType === 'Mother' ? 'patient_id' : 'newborn_id', patientId)
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
                    vaccine: row.vaccine_inventory?.vaccine_name || (row.notes ? row.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/)?.[2] : null) || 'Unknown Vaccine',
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

        searchPendingVaccines();
    }, [form.patientName, form.patientType]);

    const handleSelectSuggestion = (suggestion) => {
        updateForm('patientName', suggestion.name);
        setShowSuggestions(false);
    };

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
                const newborns = await BabyService.searchNewborns(form.patientName);
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
                        // First get the vaccine record to find the vaccine name
                        const { data: vaccRecord } = await supabase
                            .from('vaccinations')
                            .select('id, notes, vaccine_inventory_id')
                            .eq('id', scheduledId)
                            .single();

                        let vaccineInvId = vaccRecord?.vaccine_inventory_id;

                        // If no vaccine_inventory_id, try to find it from notes
                        if (!vaccineInvId && vaccRecord?.notes) {
                            const vaccineMatch = vaccRecord.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/);
                            if (vaccineMatch) {
                                const vaccineName = vaccineMatch[2].trim();
                                const { data: vaccInv } = await supabase
                                    .from('vaccine_inventory')
                                    .select('id, quantity, vaccine_name')
                                    .or(`vaccine_name.ilike.%${vaccineName}%,vaccine_name.ilike.%${vaccineName.replace(/ \(.+\)/, '')}%`)
                                    .limit(1);

                                if (vaccInv && vaccInv.length > 0) {
                                    vaccineInvId = vaccInv[0].id;
                                }
                            }
                        }

                        // Update the vaccination record with vaccine_inventory_id
                        const updateData = {
                            vaccinated_date: form.date,
                            status: 'Completed',
                            notes: form.notes || null
                        };
                        if (vaccineInvId) {
                            updateData.vaccine_inventory_id = vaccineInvId;
                        }

                        await supabase.from('vaccinations').update(updateData).eq('id', scheduledId);

                        // Decrement vaccine inventory
                        if (vaccineInvId) {
                            const { data: vaccInv } = await supabase
                                .from('vaccine_inventory')
                                .select('id, quantity, vaccine_name')
                                .eq('id', vaccineInvId)
                                .single();

                            if (vaccInv && vaccInv.quantity > 0) {
                                await supabase
                                    .from('vaccine_inventory')
                                    .update({ quantity: vaccInv.quantity - 1 })
                                    .eq('id', vaccInv.id);
                                console.log(`✅ Decremented vaccine: ${vaccInv.vaccine_name}`);
                            }
                        } else if (vaccRecord?.notes) {
                            // Fallback: try to find by name in notes
                            const vaccineMatch = vaccRecord.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/);
                            if (vaccineMatch) {
                                const extractedName = vaccineMatch[2].trim();
                                const { data: vaccInv } = await supabase
                                    .from('vaccine_inventory')
                                    .select('id, quantity, vaccine_name')
                                    .or(`vaccine_name.ilike.%${extractedName}%,vaccine_name.ilike.%${extractedName.replace(/ \(.+\)/, '')}%`)
                                    .limit(1);

                                if (vaccInv && vaccInv.length > 0 && vaccInv[0].quantity > 0) {
                                    await supabase
                                        .from('vaccine_inventory')
                                        .update({ quantity: vaccInv[0].quantity - 1 })
                                        .eq('id', vaccInv[0].id);
                                    console.log(`✅ Decremented vaccine (by name): ${vaccInv[0].vaccine_name}`);
                                }
                            }
                        }
                    }
                } else {
                    const { data: vaccInv } = await supabase.from('vaccine_inventory').select('id, quantity').eq('vaccine_name', form.vaccine).single();
                    if (!vaccInv) throw new Error('Vaccine not found in inventory');

                    const doseNumber = form.dose === '1st Dose' ? 1 : form.dose === '2nd Dose' ? 2 : form.dose === '3rd Dose' ? 3 : form.dose === 'Booster' ? 4 : 5;

                    await supabase.from('vaccinations').insert({
                        patient_id: patientId,
                        vaccine_inventory_id: vaccInv.id,
                        dose_number: doseNumber,
                        vaccinated_date: form.date,
                        status: 'Completed',
                        created_by: currentUser,
                        notes: form.notes
                    });

                    // Decrement vaccine inventory
                    if (vaccInv.quantity > 0) {
                        await supabase
                            .from('vaccine_inventory')
                            .update({ quantity: vaccInv.quantity - 1 })
                            .eq('id', vaccInv.id);
                        console.log(`✅ Decremented vaccine: ${form.vaccine}`);
                    }
                }
            } else {
                const { data: suppInv } = await supabase.from('supplement_inventory').select('id, quantity').eq('supplement_name', form.supplement).single();
                if (!suppInv) throw new Error('Supplement not found in inventory');

                // Calculate quantity to decrement (assume 1 unit per dose, but could be made configurable)
                const quantityToDecrement = 1;
                if (suppInv.quantity >= quantityToDecrement) {
                    // Decrement supplement inventory
                    await supabase
                        .from('supplement_inventory')
                        .update({ quantity: suppInv.quantity - quantityToDecrement })
                        .eq('id', suppInv.id);
                    console.log(`✅ Decremented supplement: ${form.supplement}`);
                } else {
                    throw new Error(`Insufficient inventory for ${form.supplement}. Current stock: ${suppInv.quantity}`);
                }

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
                            <div className="patient-search-wrapper">
                                <input 
                                    type="text" 
                                    placeholder="Search patient..." 
                                    value={form.patientName} 
                                    onChange={e => {
                                        updateForm('patientName', e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="suggestions-dropdown">
                                        {suggestions.map((suggestion, idx) => (
                                            <div 
                                                key={idx} 
                                                className="suggestion-item"
                                                onClick={() => handleSelectSuggestion(suggestion)}
                                            >
                                                <div className="suggestion-name">{suggestion.name}</div>
                                                {suggestion.station && <div className="suggestion-station">{suggestion.station}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                        {vaccineTypes.map(v => <option key={v}>{v}</option>)}
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
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Supplement Type <span className="req">*</span></label>
                                    <select value={form.supplement} onChange={e => updateForm('supplement', e.target.value)}>
                                        <option value="">Select Supplement</option>
                                        {supplementTypes.map(s => <option key={s}>{s}</option>)}
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
                                {staffList.map(s => <option key={s}>{s}</option>)}
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
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('vaccines');    // 'vaccines' | 'supplements'
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ patientType: 'All', status: 'All', item: 'All' });
    const [recordModal, setRecordModal] = useState(null);      // null | { mode: 'vaccine' | 'supplement', initialPatientType?, initialPatientName? }
    const [newbornVaccinationModal, setNewbornVaccinationModal] = useState(null);  // null | newborn object
    const [expirationSummaryModal, setExpirationSummaryModal] = useState(null);      // null | 'vaccine' | 'supplement'
    const [expandedRows, setExpandedRows] = useState({});
    const [sortField, setSortField] = useState('');
    const [sortAsc, setSortAsc] = useState(true);

    const fetchData = async () => {
        try {
            setLoading(true);

            const { data: vaccRecords } = await supabase
                .from('vaccinations')
                .select(`
                    id,
                    patient_id,
                    newborn_id,
                    vaccine_inventory_id,
                    dose_number,
                    status,
                    vaccinated_date,
                    scheduled_vaccination,
                    notes,
                    created_at,
                    created_by,
                    staff_profiles!vaccinations_created_by_fkey (full_name),
                    vaccine_inventory (vaccine_name),
                    patient_basic_info!vaccinations_patient_id_fkey (id, first_name, last_name, barangay, province),
                    newborns!vaccinations_newborn_id_fkey (
                        id, 
                        baby_name, 
                        mother_id, 
                        created_at,
                        patient_basic_info!mother_id (first_name, last_name, barangay, province)
                    )
                `)
                .order('created_at', { ascending: false });
            const { data: suppRecords } = await supabase.from('supplements').select('*').order('created_at', { ascending: false });

            // Get maps for names
            const { data: vaccineInv } = await supabase.from('vaccine_inventory').select('id, vaccine_name');
            const vaccineMap = new Map(vaccineInv.map(v => [v.id, v.vaccine_name]));
            const { data: suppInv } = await supabase.from('supplement_inventory').select('id, supplement_name');
            const suppMap = new Map(suppInv.map(s => [s.id, s.supplement_name]));
            const { data: staff } = await supabase.from('staff_profiles').select('id, full_name');
            const staffMap = new Map(staff.map(s => [s.id, s.full_name]));
            const patientMap = new Map();

            // Fetch all newborns with pending vaccinations for the newborns tab - but we'll remove this
            // const { data: allNewborns } = await supabase
            //     .from('newborns')
            //     .select('id, baby_name, mother_id, deliveries!inner (delivery_date), patient_basic_info!mother_id (first_name, last_name, barangay, province)')
            //     .order('created_at', { ascending: false });
            
            // const newbornsList = (allNewborns || []).map(newborn => {
            //     const mother = newborn.patient_basic_info;
            //     return {
            //         id: newborn.id,
            //         babyName: newborn.baby_name,
            //         motherName: `${mother.first_name} ${mother.last_name}`,
            //         birthDate: newborn.deliveries?.delivery_date || 'N/A',
            //         station: `${mother.barangay}, ${mother.province}`
            //     };
            // });
            
            // setNewbornPending(newbornsList);

            // Transform vaccination records
            const transformedVaccRecords = (vaccRecords || []).map(record => {
                let patientName, station, type, patientId, birthDate = null;
                if (record.patient_id) {
                    // Mother
                    patientName = `${record.patient_basic_info?.first_name || ''} ${record.patient_basic_info?.last_name || ''}`.trim();
                    station = `${record.patient_basic_info?.barangay || 'N/A'}, ${record.patient_basic_info?.province || 'N/A'}`;
                    type = 'Mother';
                    patientId = record.patient_id;
                } else if (record.newborn_id) {
                    // Newborn
                    const newbornRecord = Array.isArray(record.newborns) ? record.newborns[0] : record.newborns;
                    const mother = Array.isArray(newbornRecord?.patient_basic_info) ? newbornRecord.patient_basic_info[0] : newbornRecord?.patient_basic_info;
                    // Use newborn's created_at as birth date (set when record was created at birth)
                    birthDate = newbornRecord?.created_at ? new Date(newbornRecord.created_at).toISOString().split('T')[0] : null;
                    patientName = newbornRecord?.baby_name || 'Unknown Newborn';
                    station = `${mother?.barangay || 'N/A'}, ${mother?.province || 'N/A'}`;
                    type = 'Newborn';
                    patientId = record.newborn_id;
                } else {
                    patientName = 'Unknown';
                    station = 'Unknown';
                    type = 'Unknown';
                    patientId = 'Unknown';
                }

                let vaccineName = record.vaccine_inventory?.vaccine_name;
                if (!vaccineName && record.notes) {
                    const match = record.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/);
                    if (match) vaccineName = match[2];
                }
                vaccineName = vaccineName || 'Unknown';

                const dose = record.dose_number ? `${record.dose_number}${record.dose_number === 1 ? 'st' : record.dose_number === 2 ? 'nd' : record.dose_number === 3 ? 'rd' : 'th'} Dose` : 'Unknown';
                const vaccinationDate = record.vaccinated_date || null;
                const scheduledDate = record.scheduled_vaccination || null;
                const expirationDate = calculateExpirationDate(vaccinationDate, 'vaccine');
                const expStatus = getExpirationStatus(expirationDate);
                const newbornRelation = Array.isArray(record.newborns) ? record.newborns[0] : record.newborns;
                const motherInfo = Array.isArray(newbornRelation?.patient_basic_info) ? newbornRelation.patient_basic_info[0] : newbornRelation?.patient_basic_info;
                return {
                    id: record.id,
                    patientId,
                    newborn_id: record.newborn_id,
                    babyName: newbornRelation?.baby_name || 'Unknown Newborn',
                    motherName: motherInfo ? `${motherInfo.first_name || ''} ${motherInfo.last_name || ''}`.trim() : 'Unknown Mother',
                    birthDate: birthDate,
                    station: station,
                    type,
                    vaccine: vaccineName,
                    dose,
                    date: vaccinationDate,
                    nextDue: scheduledDate,
                    expirationDate: expirationDate,
                    expirationStatus: expStatus.status,
                    expirationClass: expStatus.class,
                    staff: record.staff_profiles?.full_name || 'Unknown',
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
                totalAdministered: transformedVaccRecords.filter(r => r.status === 'Completed').length,
                mothersPending: transformedVaccRecords.filter(r => r.type === 'Mother' && r.status === 'Pending').length,
                newbornsPending: transformedVaccRecords.filter(r => r.type === 'Newborn' && r.status === 'Pending').length,
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
        setNewbornVaccinationModal(null);
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
            const matchSearch = (v.patientName || '').toLowerCase().includes(s) || (v.patientId || '').toLowerCase().includes(s) || (v.station || '').toLowerCase().includes(s);
            const filterType = (filters.patientType || 'All').toLowerCase();
            const filterStatus = (filters.status || 'All').toLowerCase();
            const filterItem = (filters.item || 'All').toLowerCase();
            const matchType = filterType === 'all' || (v.type || '').toLowerCase() === filterType;
            const matchStatus = filterStatus === 'all' || (v.status || '').toLowerCase() === filterStatus;
            const matchItem = filterItem === 'all' || (v.vaccine || '').toLowerCase() === filterItem;
            return matchSearch && matchType && matchStatus && matchItem;
        })
        .sort((a, b) => {
            if (!sortField) return 0;
            const va = a[sortField] ?? ''; const vb = b[sortField] ?? '';
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });

    // Group newborns for display
    const displayList = [];
    const newbornMap = {};
    filteredVaccines.forEach(v => {
        if (v.type === 'Newborn') {
            const key = v.newborn_id;
            if (!key) return; // Skip if no newborn_id
            const babyName = v.babyName || 'Unknown Newborn';
            const motherName = v.motherName || 'Unknown Mother';
            const station = v.station || 'Unknown';
            const birthDate = v.birthDate || null;

            if (!newbornMap[key]) {
                newbornMap[key] = {
                    isNewborn: true,
                    id: key,
                    babyName,
                    motherName,
                    station,
                    birthDate,
                    administeredCount: 0,
                    lastAdministered: null,
                    records: []
                };
            }
            newbornMap[key].records.push(v);
            if (v.date) {
                newbornMap[key].administeredCount++;
                const date = new Date(v.date);
                if (!newbornMap[key].lastAdministered || date > new Date(newbornMap[key].lastAdministered)) {
                    newbornMap[key].lastAdministered = v.date;
                }
            }
        } else {
            displayList.push(v);
        }
    });
    const newbornEntries = Object.values(newbornMap);
    console.log('Vaccinations grouping:', {
        filteredVaccinesCount: filteredVaccines.length,
        newbornCount: newbornEntries.length,
        newbornIds: newbornEntries.map(n => n.id),
        displayListCount: displayList.length + newbornEntries.length
    });
    newbornEntries.forEach(n => displayList.push(n));

    // ── Filter + sort supplements ──
    const filteredSupplements = supplementRecords
        .filter(s => {
            const q = searchTerm.toLowerCase();
            const matchSearch = (s.patientName || '').toLowerCase().includes(q) || (s.patientId || '').toLowerCase().includes(q) || (s.station || '').toLowerCase().includes(q);
            const filterType = (filters.patientType || 'All').toLowerCase();
            const filterStatus = (filters.status || 'All').toLowerCase();
            const filterItem = (filters.item || 'All').toLowerCase();
            const matchType = filterType === 'all' || (s.type || '').toLowerCase() === filterType;
            const matchStatus = filterStatus === 'all' || (s.status || '').toLowerCase() === filterStatus;
            const matchItem = filterItem === 'all' || (s.supplement || '').toLowerCase() === filterItem;
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
                    <button className="btn btn-outline" onClick={() => setRecordModal({ mode: 'supplement' })}><Pill size={16} /> Record Supplement</button>
                    <button className="btn btn-primary" onClick={() => setRecordModal({ mode: 'vaccine' })}><Syringe size={16} /> Record Vaccination</button>
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
                                            <th>Expiration</th>
                                            <th>Next Due</th>
                                            <th>Status</th>
                                            <th>Staff</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayList.map(item => (
                                            item.isNewborn ? (
                                                <tr key={`newborn-${item.id}`}>
                                                    <td>
                                                        <div className="vacc-patient">
                                                            <div className="vacc-avatar">{item.babyName.split(' ').map(name => name[0]).slice(0,2).join('')}</div>
                                                            <div>
                                                                <span className="vacc-name">{item.babyName}</span>
                                                                <span className="vacc-pid">Mother: {item.motherName} · {item.station}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className="type-badge type-newborn">Newborn</span></td>
                                                    <td>{item.administeredCount} vaccines</td>
                                                    <td>{item.lastAdministered || 'None'}</td>
                                                    <td>—</td>
                                                    <td>—</td>
                                                    <td>—</td>
                                                    <td>—</td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="action-btn view-btn" title="View Vaccination Schedule" onClick={() => setNewbornVaccinationModal(item)}><Eye size={13} /></button>
                                                            <button className="action-btn record-btn" title="Record Vaccine" onClick={() => setNewbornVaccinationModal(item)}><Plus size={13} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                <React.Fragment key={`vaccine-${item.id}`}>
                                                    <tr className={`vacc-row vacc-row--${item.status.toLowerCase()}`}>
                                                        <td>
                                                            <button className="expand-btn" onClick={() => toggleRow(item.id)}>
                                                                {expandedRows[item.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                            </button>
                                                            <div className="vacc-patient">
                                                                <div className="vacc-avatar">{item.patientName.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
                                                                <div>
                                                                    <span className="vacc-name">{item.patientName}</span>
                                                                    <span className="vacc-pid">{item.patientId} · {item.station}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td><span className={`type-badge type-${item.type.toLowerCase()}`}>{item.type}</span></td>
                                                        <td className="vacc-item-name">{item.vaccine}</td>
                                                        <td className="vacc-dose">{item.dose}</td>
                                                        <td className="vacc-date">{item.date || <span className="not-yet">Not given</span>}</td>
                                                        <td className="vacc-date">
                                                            {item.expirationDate ? (
                                                                <>
                                                                    <span className={`exp-status ${item.expirationClass}`}>{item.expirationStatus}</span>
                                                                    <span className="exp-date">{item.expirationDate}</span>
                                                                </>
                                                            ) : <span className="not-yet">—</span>}
                                                        </td>
                                                        <td className="vacc-date">{item.nextDue || <span className="not-yet">—</span>}</td>
                                                        <td><span className={`vacc-status ${vaccineStatusClass(item.status)}`}>{item.status}</span></td>
                                                        <td className="vacc-staff">{item.staff}</td>
                                                        <td>
                                                            <div className="row-actions">
                                                                <button className="action-btn view-btn" title="View Details" onClick={() => setExpirationSummaryModal({ patientId: item.patientId, patientName: item.patientName, type: 'vaccine' })}><Eye size={13} /></button>
                                                                <button className="action-btn record-btn" title="Record Dose" onClick={() => setRecordModal({ mode: 'vaccine' })}><Plus size={13} /></button>
                                                                <button className="action-btn edit-btn" title="Edit"><Edit2 size={13} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {expandedRows[item.id] && (
                                                        <tr className="vacc-expanded-row">
                                                            <td colSpan="9">
                                                                <div className="expand-detail">
                                                                    <div><strong>Patient ID:</strong> {item.patientId}</div>
                                                                    <div><strong>Station:</strong> {item.station}</div>
                                                                    <div><strong>Vaccine:</strong> {item.vaccine} — {item.dose}</div>
                                                                    <div><strong>Administered by:</strong> {item.staff}</div>
                                                                    {item.date && <div><strong>Date Given:</strong> {item.date}</div>}
                                                                    {item.nextDue && <div><strong>Next Due:</strong> {item.nextDue}</div>}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            )
                                        ))}
                                        {displayList.length === 0 && (
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
                                                <td className="vacc-date">{s.date}</td>
                                                <td className="vacc-date">
                                                    {s.expirationDate ? (
                                                        <>
                                                            <span className={`exp-status ${s.expirationClass}`}>{s.expirationStatus}</span>
                                                            <span className="exp-date">{s.expirationDate}</span>
                                                        </>
                                                    ) : <span className="not-yet">—</span>}
                                                </td>
                                                <td className="vacc-date">{s.nextDue}</td>
                                                <td><span className={`vacc-status ${supplementStatusClass(s.status)}`}>{s.status}</span></td>
                                                <td className="vacc-staff">{s.staff}</td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="action-btn view-btn" title="View Details" onClick={() => setExpirationSummaryModal({ patientId: s.patientId, patientName: s.patientName, type: 'supplement' })}><Eye size={13} /></button>
                                                        <button className="action-btn record-btn" title="Record Intake" onClick={() => setRecordModal({ mode: 'supplement' })}><Plus size={13} /></button>
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
            </div>



            {/* ── Record Modal ── */}
            {recordModal && <RecordModal {...recordModal} onClose={() => setRecordModal(null)} onSave={handleModalClose} />}

            {/* ── Newborn Vaccination Modal ── */}
            {newbornVaccinationModal && (
                <NewbornVaccinationModal 
                    newborn={newbornVaccinationModal} 
                    onClose={handleModalClose}
                    onSave={handleModalClose}
                />
            )}

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
