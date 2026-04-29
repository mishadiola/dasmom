import React, { useState, useEffect } from 'react';
import PatientService from '../../services/patientservice';
import BabyService from '../../services/babyservices';
import VaccinationService from '../../services/vaccinationservice';
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
    const babyService = new BabyService();
    const [form, setForm] = useState({
        patientType: initialPatientType || 'Mother', patientName: initialPatientName || '', vaccine: '',
        supplement: '', dose: '', date: new Date().toISOString().split('T')[0], nextDue: '', staff: '', notes: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [pendingVaccines, setPendingVaccines] = useState([]);
    const [selectedVaccines, setSelectedVaccines] = useState({});
    const [selectedVaccineNames, setSelectedVaccineNames] = useState([]);
    const [vaccineDoses, setVaccineDoses] = useState({});
    const [staffList, setStaffList] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [supplementTypes, setSupplementTypes] = useState([]);
    const [vaccineTypes, setVaccineTypes] = useState([]);
    const [isPregnant, setIsPregnant] = useState(false);
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
                        .gt('quantity', 0)
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
                        .gt('quantity', 0)
                        .order('vaccine_name', { ascending: true });
                    
                    if (error) throw error;
                    
                    // Filter vaccine types based on pregnancy status
                    let filteredVaccines = data?.map(item => item.vaccine_name) || [];
                    if (form.patientType === 'Mother' && isPregnant) {
                        // Only show Td and Influenza vaccines during pregnancy
                        filteredVaccines = filteredVaccines.filter(v => 
                            v.toLowerCase().includes('tetanus') || 
                            v.toLowerCase().includes('td') ||
                            v.toLowerCase().includes('influenza') ||
                            v.toLowerCase().includes('flu')
                        );
                    }
                    // Deduplicate vaccine names to avoid React key warnings
                    const uniqueVaccines = [...new Set(filteredVaccines)];
                    setVaccineTypes(uniqueVaccines);
                } catch (error) {
                    console.error('Error fetching vaccine types:', error);
                    setVaccineTypes([]);
                }
            };
            fetchVaccineTypes();
        }
    }, [mode, form.patientType, isPregnant]);

    useEffect(() => {
        console.log('✅ RecordModal useEffect triggered!', form.patientName, form.patientType);
        const searchPendingVaccines = async () => {
            console.log('🔍 Searching for patient:', form.patientName);
            // Don't reset selectedPatient if it's already set and matches the current name
            if (selectedPatient && selectedPatient.label === form.patientName) {
                console.log('✅ Keeping existing selectedPatient:', selectedPatient);
                return;
            }
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
                        // Auto-select the single match
                        setSelectedPatient({ id: mothers[0].id, label: mothers[0].name, type: 'Mother' });
                        console.log('✅ Auto-selected single mother match:', mothers[0].name);
                    }
                } else {
                    const newborns = await babyService.searchNewborns(form.patientName);
                    allMatches = newborns.map(n => ({
                        id: n.id,
                        name: n.name,
                        type: 'Newborn'
                    }));
                    if (newborns.length === 1) {
                        patientId = newborns[0].id;
                        patientLabel = newborns[0].name;
                        // Auto-select the single match
                        setSelectedPatient({ id: newborns[0].id, label: newborns[0].name, type: 'Newborn' });
                        console.log('✅ Auto-selected single newborn match:', newborns[0].name);
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

                // Check pregnancy status for mothers
                if (form.patientType === 'Mother') {
                    const { data: pregInfo } = await supabase
                        .from('pregnancy_info')
                        .select('pregn_postp')
                        .eq('patient_id', patientId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    const isCurrentlyPregnant = pregInfo?.pregn_postp === 'Pregnant';
                    setIsPregnant(isCurrentlyPregnant);
                    console.log('🤰 Pregnancy status for mother:', isCurrentlyPregnant);
                } else {
                    setIsPregnant(false);
                }

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
        console.log('🎯 handleSelectSuggestion called with:', suggestion);
        updateForm('patientName', suggestion.name);
        setSelectedPatient({ id: suggestion.id, label: suggestion.name, type: suggestion.type });
        setShowSuggestions(false);
        console.log('✅ selectedPatient set to:', { id: suggestion.id, label: suggestion.name, type: suggestion.type });
    };

    const handleSave = async () => {
        const hasPendingSelection = mode === 'vaccine' && Object.values(selectedVaccines).some(Boolean);
        const hasCheckboxSelection = mode === 'vaccine' && selectedVaccineNames.length > 0;

        console.log('🔍 handleSave - selectedPatient:', selectedPatient);
        console.log('🔍 handleSave - form.patientName:', form.patientName);
        console.log('🔍 handleSave - form.patientType:', form.patientType);

        if (!form.patientName ||
            (mode === 'vaccine' && !hasPendingSelection && !hasCheckboxSelection && (!form.vaccine || !form.dose)) ||
            (mode === 'supplement' && (!form.supplement || !form.dose)) ||
            !form.date) {
            alert('Please fill in all required fields.');
            return;
        }

        setIsSaving(true);
        try {
            const patientService = new PatientService();

            // Use selectedPatient if available (from autocomplete), otherwise search by name
            let patientId;
            if (selectedPatient && selectedPatient.id) {
                patientId = selectedPatient.id;
                console.log('✅ Using selected patient ID:', patientId);
            } else {
                console.log('⚠️ No selectedPatient, searching by name...');
                // Fallback to search if no patient was selected from autocomplete
                if (form.patientType === 'Mother') {
                    const patients = await patientService.searchPatients(form.patientName);
                    console.log('🔍 Search results for mothers:', patients);
                    if (patients.length === 0) throw new Error('Patient not found. Please check the name spelling or add the patient first.');
                    if (patients.length > 1) throw new Error(`Multiple patients found with similar names. Please select from the suggestions dropdown.`);
                    patientId = patients[0].id;
                } else {
                    const newborns = await babyService.searchNewborns(form.patientName);
                    console.log('🔍 Search results for newborns:', newborns);
                    if (newborns.length === 0) throw new Error('Newborn not found. Please check the name spelling or add the newborn first.');
                    if (newborns.length > 1) throw new Error(`Multiple newborns found with similar names. Please select from the suggestions dropdown.`);
                    patientId = newborns[0].id;
                }
            }

            // Final validation - ensure we have a patientId
            if (!patientId) {
                throw new Error('Patient ID could not be determined. Please select a patient from the dropdown.');
            }

            const currentUser = await patientService.getCurrentUserId();
            if (!currentUser) throw new Error('No logged-in user');

            if (mode === 'vaccine') {
                // Handle checkbox-selected vaccines (new multi-vaccine selection)
                if (selectedVaccineNames.length > 0) {
                    for (const vaccineName of selectedVaccineNames) {
                        const dose = vaccineDoses[vaccineName];
                        if (!dose) {
                            alert(`Please select a dose for ${vaccineName}`);
                            setIsSaving(false);
                            return;
                        }

                        // Get vaccine inventory ID with better matching - use earliest expiration
                        const { data: vaccInvItems, error: invError } = await supabase
                            .from('vaccine_inventory')
                            .select('id, quantity, vaccine_name, expiration_date')
                            .gt('quantity', 0)
                            .order('expiration_date', { ascending: true, nullsFirst: false });
                        
                        if (invError) {
                            console.error('Error fetching vaccine inventory:', invError);
                            throw new Error('Failed to fetch vaccine inventory: ' + invError.message);
                        }
                        
                        let vaccInv = null;
                        if (vaccInvItems && vaccInvItems.length > 0) {
                            // Try exact match first
                            vaccInv = vaccInvItems.find(item => item.vaccine_name === vaccineName);
                            // If no exact match, try fuzzy matching
                            if (!vaccInv) {
                                const searchTerm = vaccineName.toLowerCase().replace(/[^a-z0-9]/g, '');
                                vaccInv = vaccInvItems.find(item => {
                                    const itemName = item.vaccine_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    return itemName.includes(searchTerm) || searchTerm.includes(itemName);
                                });
                            }
                        }

                        if (!vaccInv) {
                            alert(`No stock available for ${vaccineName}`);
                            setIsSaving(false);
                            return;
                        }

                        // Convert dose to number
                        const doseNumber = parseInt(dose.match(/\d+/)?.[0]) || 1;

                        // Prepare the insert payload
                        const vaccinationRecord = {
                            vaccinated_date: form.date,
                            status: 'Completed',
                            created_by: currentUser,
                            notes: form.notes || null
                        };
                        
                        // Add patient or newborn ID based on type
                        if (form.patientType === 'Mother') {
                            vaccinationRecord.patient_id = patientId;
                        } else {
                            vaccinationRecord.newborn_id = patientId;
                        }
                        
                        // Add vaccine inventory ID and dose number
                        vaccinationRecord.vaccine_inventory_id = vaccInv.id;
                        vaccinationRecord.dose_number = doseNumber;

                        console.log('Inserting vaccination record:', vaccinationRecord);

                        // Insert vaccination record
                        const { error: insertError } = await supabase.from('vaccinations').insert([vaccinationRecord]);

                        if (insertError) {
                            console.error('Insert vaccination error:', insertError);
                            throw new Error('Failed to insert vaccination: ' + insertError.message);
                        }

                        // Decrement inventory
                        const newQuantity = vaccInv.quantity - 1;
                        await supabase.from('vaccine_inventory')
                            .update({ quantity: newQuantity })
                            .eq('id', vaccInv.id);

                        // Auto-schedule maternal vaccinations for pregnant mothers - ONLY on first Td dose
                        if (form.patientType === 'Mother' && isPregnant && doseNumber === 1) {
                            if (vaccineName.toLowerCase().includes('tetanus') || vaccineName.toLowerCase().includes('td')) {
                                const vaccService = new VaccinationService();

                                // Check if this is truly the first Td vaccine for this patient
                                const { data: existingTdVaccines } = await supabase
                                    .from('vaccinations')
                                    .select('id')
                                    .eq('patient_id', patientId)
                                    .ilike('notes', '%Td%')
                                    .eq('status', 'Completed');

                                const isFirstTd = !existingTdVaccines || existingTdVaccines.length === 0;

                                if (isFirstTd) {
                                    console.log(`🔄 First Td vaccine (dose 1) for pregnant mother, scheduling full maternal vaccination schedule...`);
                                    // Get patient's LMP for influenza scheduling
                                    const { data: patientData } = await supabase
                                        .from('patient_basic_info')
                                        .select('pregnancy_info (lmd)')
                                        .eq('id', patientId)
                                        .single();
                                    const lmpDate = patientData?.pregnancy_info?.[0]?.lmd || null;

                                    await vaccService.scheduleMaternalVaccinations(patientId, form.date, vaccineName, currentUser, lmpDate);
                                }
                            }
                        }
                    }
                }

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

                        // If no vaccine_inventory_id, try to find it from notes using nearest expiration date
                        if (!vaccineInvId && vaccRecord?.notes) {
                            const vaccineMatch = vaccRecord.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/);
                            if (vaccineMatch) {
                                const vaccineName = vaccineMatch[2].trim();
                                const { data: vaccInv } = await supabase
                                    .from('vaccine_inventory')
                                    .select('id, quantity, vaccine_name, expiration_date')
                                    .or(`vaccine_name.ilike.%${vaccineName}%,vaccine_name.ilike.%${vaccineName.replace(/ \(.+\)/, '')}%`)
                                    .gt('quantity', 0)
                                    .order('expiration_date', { ascending: true, nullsFirst: false })
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
                            // Fallback: try to find by name in notes using nearest expiration date
                            const vaccineMatch = vaccRecord.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/);
                            if (vaccineMatch) {
                                const extractedName = vaccineMatch[2].trim();
                                const { data: vaccInv } = await supabase
                                    .from('vaccine_inventory')
                                    .select('id, quantity, vaccine_name, expiration_date')
                                    .or(`vaccine_name.ilike.%${extractedName}%,vaccine_name.ilike.%${extractedName.replace(/ \(.+\)/, '')}%`)
                                    .gt('quantity', 0)
                                    .order('expiration_date', { ascending: true, nullsFirst: false })
                                    .limit(1);

                                if (vaccInv && vaccInv.length > 0 && vaccInv[0].quantity > 0) {
                                    await supabase
                                        .from('vaccine_inventory')
                                        .update({ quantity: vaccInv[0].quantity - 1 })
                                        .eq('id', vaccInv[0].id);
                                    console.log(`✅ Decremented vaccine (by name, nearest exp): ${vaccInv[0].vaccine_name}`);
                                }
                            }
                        }
                    }
                } else {
                    // Manual entry: try to find in inventory first, otherwise create without inventory
                    const { data: vaccInvItems } = await supabase
                        .from('vaccine_inventory')
                        .select('id, quantity, vaccine_name, expiration_date')
                        .gt('quantity', 0)
                        .order('expiration_date', { ascending: true, nullsFirst: false });

                    let vaccInv = null;
                    if (vaccInvItems && vaccInvItems.length > 0) {
                        // Try exact match first
                        vaccInv = vaccInvItems.find(item => item.vaccine_name === form.vaccine);
                        // If no exact match, try fuzzy matching
                        if (!vaccInv) {
                            const searchTerm = form.vaccine.toLowerCase().replace(/[^a-z0-9]/g, '');
                            vaccInv = vaccInvItems.find(item => {
                                const itemName = item.vaccine_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                                return itemName.includes(searchTerm) || searchTerm.includes(itemName);
                            });
                        }
                    }

                    const doseNumber = form.dose === '1st Dose' ? 1 : form.dose === '2nd Dose' ? 2 : form.dose === '3rd Dose' ? 3 : form.dose === 'Booster' ? 4 : 5;
                    const doseOrdinal = doseNumber === 1 ? '1st' : doseNumber === 2 ? '2nd' : doseNumber === 3 ? '3rd' : `${doseNumber}th`;

                    const vaccinationRecord = {
                        patient_id: patientId,
                        dose_number: doseNumber,
                        vaccinated_date: form.date,
                        scheduled_vaccination: form.date,
                        status: 'Completed',
                        created_by: currentUser,
                        notes: form.notes || `${doseOrdinal} dose of ${form.vaccine}`
                    };

                    // If vaccine found in inventory, link it and decrement
                    if (vaccInv) {
                        vaccinationRecord.vaccine_inventory_id = vaccInv.id;
                        await supabase.from('vaccinations').insert([vaccinationRecord]);

                        // Decrement vaccine inventory
                        if (vaccInv.quantity > 0) {
                            await supabase
                                .from('vaccine_inventory')
                                .update({ quantity: vaccInv.quantity - 1 })
                                .eq('id', vaccInv.id);
                            console.log(`✅ Decremented vaccine: ${form.vaccine}`);
                        }
                    } else {
                        // Manual entry method: create record without inventory link
                        console.log(`⚠️ Vaccine not in inventory, creating manual record for: ${form.vaccine}`);
                        await supabase.from('vaccinations').insert([vaccinationRecord]);
                    }

                    // Auto-schedule maternal vaccinations for pregnant mothers
                    if (form.patientType === 'Mother' && isPregnant) {
                        const vaccService = new VaccinationService();
                        // Get patient's LMP for influenza scheduling
                        const { data: patientData } = await supabase
                            .from('patient_basic_info')
                            .select('pregnancy_info (lmd)')
                            .eq('id', patientId)
                            .single();
                        const lmpDate = patientData?.pregnancy_info?.[0]?.lmd || null;

                        // Check if this is the first Td vaccine
                        const { data: existingTdVaccines } = await supabase
                            .from('vaccinations')
                            .select('id')
                            .eq('patient_id', patientId)
                            .ilike('notes', '%Td%')
                            .eq('status', 'Completed');

                        const isFirstTd = !existingTdVaccines || existingTdVaccines.length === 0;

                        if (isFirstTd && (form.vaccine.toLowerCase().includes('tetanus') || form.vaccine.toLowerCase().includes('td'))) {
                            console.log(`🔄 First Td vaccine for pregnant mother, scheduling full maternal vaccination schedule...`);
                            await vaccService.scheduleMaternalVaccinations(patientId, form.date, form.vaccine, currentUser, lmpDate);
                        }
                    }
                }
            } else {
                // Supplement handling: try to find in inventory first, otherwise create manual record
                const { data: suppInvItems } = await supabase
                    .from('supplement_inventory')
                    .select('id, quantity, expiration_date')
                    .eq('supplement_name', form.supplement)
                    .gt('quantity', 0)
                    .order('expiration_date', { ascending: true, nullsFirst: false })
                    .limit(1);

                const supplementRecord = {
                    patient_id: patientId,
                    dosage: form.dose,
                    start_date: form.date,
                    end_date: form.date,
                    created_by: currentUser,
                    notes: form.notes || null
                };

                // If supplement found in inventory, link it and decrement
                if (suppInvItems && suppInvItems.length > 0) {
                    const suppInv = suppInvItems[0];
                    supplementRecord.supplement_inventory_id = suppInv.id;

                    // Decrement supplement inventory
                    if (suppInv.quantity > 0) {
                        await supabase
                            .from('supplement_inventory')
                            .update({ quantity: suppInv.quantity - 1 })
                            .eq('id', suppInv.id);
                        console.log(`✅ Decremented supplement: ${form.supplement}`);
                    }
                } else {
                    // Manual entry: create record without inventory link
                    console.log(`⚠️ Supplement not in inventory, creating manual record for: ${form.supplement}`);
                }

                await supabase.from('supplements').insert([supplementRecord]);
            }

            if (onSave) {
                onSave(); // Trigger parent refresh
            } else {
                onClose(); // Fallback to just close
            }
        } catch (error) {
            console.error('Error saving record:', error);
            console.error('Error stack:', error.stack);
            alert('Failed to save record: ' + (error.message || 'Unknown error - check console for details'));
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
                            <div className="form-group">
                                <label>Select Vaccines <span className="req">*</span></label>
                                <div className="vaccine-checkbox-list">
                                    {vaccineTypes.map(vaccine => (
                                        <div key={vaccine} className="vaccine-checkbox-item">
                                            <label className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedVaccineNames.includes(vaccine)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedVaccineNames([...selectedVaccineNames, vaccine]);
                                                        } else {
                                                            setSelectedVaccineNames(selectedVaccineNames.filter(v => v !== vaccine));
                                                        }
                                                    }}
                                                />
                                                <span className="vaccine-name">{vaccine}</span>
                                            </label>
                                            {selectedVaccineNames.includes(vaccine) && (
                                                <div className="vaccine-dose-info">
                                                    <select
                                                        value={vaccineDoses[vaccine] || ''}
                                                        onChange={(e) => setVaccineDoses({...vaccineDoses, [vaccine]: e.target.value})}
                                                        className="dose-select"
                                                    >
                                                        <option value="">Select Dose</option>
                                                        <option>1st Dose</option>
                                                        <option>2nd Dose</option>
                                                        <option>3rd Dose</option>
                                                        <option>Booster</option>
                                                        <option>Annual</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    ))}
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
    const babyService = new BabyService();

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

            const { data: vaccRecords, error: vaccError } = await supabase
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
                    patient_basic_info!vaccinations_patient_id_fkey (id, first_name, last_name, barangay, province)
                `)
                .order('created_at', { ascending: false });
            console.log('💉 Fetched vaccination records:', vaccRecords?.length || 0);
            console.log('🔍 Sample vaccination records with patient_id:', vaccRecords?.filter(r => r.patient_id).slice(0, 5).map(r => ({
                id: r.id,
                patient_id: r.patient_id,
                patient_basic_info: r.patient_basic_info
            })));
            const { data: suppRecords } = await supabase.from('supplements').select('*').order('created_at', { ascending: false });

            // Get maps for names
            const { data: vaccineInv } = await supabase.from('vaccine_inventory').select('id, vaccine_name');
            const vaccineMap = new Map(vaccineInv.map(v => [v.id, v.vaccine_name]));
            const { data: suppInv } = await supabase.from('supplement_inventory').select('id, supplement_name');
            const suppMap = new Map(suppInv.map(s => [s.id, s.supplement_name]));
            const { data: staff } = await supabase.from('staff_profiles').select('id, full_name');
            const staffMap = new Map(staff.map(s => [s.id, s.full_name]));
            
            // Fetch all patients to create a map for names
            const { data: allPatients } = await supabase
                .from('patient_basic_info')
                .select('id, first_name, last_name, barangay, province');
            console.log('📋 Fetched patients:', allPatients?.length || 0);
            const patientMap = new Map(allPatients?.map(p => [p.id, {
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                station: `${p.barangay || 'N/A'}, ${p.province || 'N/A'}`
            }]) || []);
            console.log('🗺️ PatientMap size:', patientMap.size);
            console.log('🗺️ Sample PatientMap entries:', Array.from(patientMap.entries()).slice(0, 5));
            console.log('🗺️ All PatientMap keys:', Array.from(patientMap.keys()).slice(0, 20));

            // Fetch all newborns to create a map
            const { data: allNewborns } = await supabase
                .from('newborns')
                .select('id, baby_name, mother_id, created_at');
            console.log('👶 Fetched newborns:', allNewborns?.length || 0);
            console.log('👶 Sample newborn records:', allNewborns?.slice(0, 5).map(n => ({
                id: n.id,
                baby_name: n.baby_name,
                mother_id: n.mother_id
            })));
            const newbornMap = new Map(allNewborns?.map(n => {
                const motherInfo = patientMap.get(n.mother_id);
                console.log('🔍 Mapping newborn:', n.id, 'mother_id:', n.mother_id, 'motherInfo:', motherInfo);
                return [n.id, {
                    babyName: n.baby_name,
                    motherId: n.mother_id,
                    motherName: motherInfo?.name || null,
                    motherStation: motherInfo?.station || null,
                    createdAt: n.created_at
                }];
            }) || []);
            console.log('🗺️ NewbornMap size:', newbornMap.size);
            console.log('🗺️ Sample NewbornMap entries:', Array.from(newbornMap.entries()).slice(0, 3));

            // Transform vaccination records
            const transformedVaccRecords = (vaccRecords || [])
                .filter(record => {
                    // Filter out records with invalid patient IDs
                    if (record.patient_id && !patientMap.has(record.patient_id)) {
                        console.warn('Filtering out record with invalid patient_id:', record.patient_id);
                        return false;
                    }
                    if (record.newborn_id && !newbornMap.has(record.newborn_id)) {
                        console.warn('Filtering out record with invalid newborn_id:', record.newborn_id);
                        return false;
                    }
                    return true;
                })
                .map(record => {
                let patientName, station, type, patientId, birthDate = null;
                if (record.patient_id) {
                    // Mother - use patientMap directly since nested query may not work
                    const patientInfo = patientMap.get(record.patient_id);
                    console.log('🔍 Mother record lookup:', { patient_id: record.patient_id, patientInfo, name: patientInfo?.name, station: patientInfo?.station });
                    if (!patientInfo || !patientInfo.name) {
                        console.warn('Patient info missing from patientMap for patient_id:', record.patient_id);
                    }
                    patientName = patientInfo?.name || 'Unknown';
                    station = patientInfo?.station || 'Unknown';
                    type = 'Mother';
                    patientId = record.patient_id;
                } else if (record.newborn_id) {
                    // Newborn - use newbornMap which has mother info pre-fetched
                    const newbornInfo = newbornMap.get(record.newborn_id);
                    if (!newbornInfo) {
                        console.warn('Newborn info missing from newbornMap for newborn_id:', record.newborn_id);
                    }
                    birthDate = newbornInfo?.createdAt ? new Date(newbornInfo.createdAt).toISOString().split('T')[0] : null;
                    patientName = newbornInfo?.babyName || 'Unknown Newborn';
                    station = newbornInfo?.motherStation || 'Unknown';
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
                const newbornInfo = newbornMap.get(record.newborn_id);
                // Get mother name from newbornMap which has it pre-fetched
                let motherName = 'Unknown Mother';
                if (newbornInfo?.motherName) {
                    motherName = newbornInfo.motherName;
                }
                return {
                    id: record.id,
                    patientId,
                    patientName,
                    newborn_id: record.newborn_id,
                    babyName: newbornInfo?.babyName || 'Unknown Newborn',
                    motherName: motherName,
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

    // Group vaccination records by patient (both mothers and newborns)
    const displayList = [];
    const patientMap = {};
    
    filteredVaccines.forEach(v => {
        if (v.type === 'Newborn') {
            const key = v.newborn_id;
            if (!key) return; // Skip if no newborn_id
            const babyName = v.babyName || 'Unknown Newborn';
            const motherName = v.motherName || 'Unknown Mother';
            const station = v.station || 'Unknown';
            const birthDate = v.birthDate || null;

            if (!patientMap[key]) {
                patientMap[key] = {
                    isNewborn: true,
                    id: key,
                    patientName: babyName,
                    motherName,
                    station,
                    birthDate,
                    type: 'Newborn',
                    administeredCount: 0,
                    pendingCount: 0,
                    lastAdministered: null,
                    nextScheduled: null,
                    lastStaff: null,
                    records: []
                };
            }
            patientMap[key].records.push(v);
            if (v.status === 'Completed') {
                patientMap[key].administeredCount++;
                const date = new Date(v.date);
                if (!patientMap[key].lastAdministered || date > new Date(patientMap[key].lastAdministered)) {
                    patientMap[key].lastAdministered = v.date;
                    patientMap[key].lastStaff = v.staff;
                }
            } else if (v.status === 'Pending') {
                patientMap[key].pendingCount++;
                if (v.nextDue) {
                    const scheduledDate = new Date(v.nextDue);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (scheduledDate >= today) {
                        if (!patientMap[key].nextScheduled || scheduledDate < new Date(patientMap[key].nextScheduled)) {
                            patientMap[key].nextScheduled = v.nextDue;
                        }
                    }
                }
            }
        } else if (v.type === 'Mother') {
            const key = v.patientId;
            if (!key) return; // Skip if no patient_id
            const patientName = v.patientName || 'Unknown';
            const station = v.station || 'Unknown';

            if (!patientMap[key]) {
                patientMap[key] = {
                    isNewborn: false,
                    id: key,
                    patientName,
                    station,
                    type: 'Mother',
                    administeredCount: 0,
                    pendingCount: 0,
                    lastAdministered: null,
                    nextScheduled: null,
                    lastStaff: null,
                    records: []
                };
            }
            patientMap[key].records.push(v);
            if (v.status === 'Completed') {
                patientMap[key].administeredCount++;
                const date = new Date(v.date);
                if (!patientMap[key].lastAdministered || date > new Date(patientMap[key].lastAdministered)) {
                    patientMap[key].lastAdministered = v.date;
                    patientMap[key].lastStaff = v.staff;
                }
            } else if (v.status === 'Pending') {
                patientMap[key].pendingCount++;
                if (v.nextDue) {
                    const scheduledDate = new Date(v.nextDue);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (scheduledDate >= today) {
                        if (!patientMap[key].nextScheduled || scheduledDate < new Date(patientMap[key].nextScheduled)) {
                            patientMap[key].nextScheduled = v.nextDue;
                        }
                    }
                }
            }
        }
    });
    
    const patientEntries = Object.values(patientMap);
    console.log('Vaccinations grouping:', {
        filteredVaccinesCount: filteredVaccines.length,
        patientCount: patientEntries.length,
        patientIds: patientEntries.map(p => p.id)
    });
    console.log('Sample patient entries:', patientEntries.slice(0, 3).map(p => ({
        id: p.id,
        patientName: p.patientName,
        type: p.type,
        station: p.station
    })));
    patientEntries.forEach(p => displayList.push(p));

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
                                            <th>Administered</th>
                                            <th>Pending</th>
                                            <th>Last Given</th>
                                            <th>Next Scheduled</th>
                                            <th>Status</th>
                                            <th>Last Staff</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayList.map(item => (
                                            <React.Fragment key={`patient-${item.id}`}>
                                                <tr className={`vacc-row vacc-row--grouped`}>
                                                    <td>
                                                        <button className="expand-btn" onClick={() => toggleRow(item.id)}>
                                                            {expandedRows[item.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                        </button>
                                                        <div className="vacc-patient">
                                                            <div className="vacc-avatar">{item.patientName ? item.patientName.split(' ').map(n=>n[0]).slice(0,2).join('') : '—'}</div>
                                                            <div>
                                                                <span className="vacc-name">{item.patientName}</span>
                                                                {item.isNewborn && <span className="vacc-pid">Mother: {item.motherName} · {item.station}</span>}
                                                                {!item.isNewborn && <span className="vacc-pid">{item.station}</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className={`type-badge type-${item.type.toLowerCase()}`}>{item.type}</span></td>
                                                    <td>{item.administeredCount} administered</td>
                                                    <td>{item.pendingCount} pending</td>
                                                    <td className="vacc-date">{item.lastAdministered || <span className="not-yet">None</span>}</td>
                                                    <td className="vacc-date">{item.nextScheduled || <span className="not-yet">None scheduled</span>}</td>
                                                    <td><span className={`vacc-status ${item.pendingCount > 0 ? 'status-pending' : 'status-completed'}`}>{item.pendingCount > 0 ? 'Pending' : 'Completed'}</span></td>
                                                    <td className="vacc-staff">{item.lastStaff || <span className="not-yet">—</span>}</td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="action-btn view-btn" title="View Vaccination Schedule" onClick={() => toggleRow(item.id)}><Eye size={13} /></button>
                                                            <button className="action-btn record-btn" title="Record Vaccine" onClick={() => setRecordModal({ mode: 'vaccine', initialPatientType: item.type, initialPatientName: item.patientName })}><Plus size={13} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedRows[item.id] && (
                                                    <tr className="vacc-expanded-row">
                                                        <td colSpan="9">
                                                            <div className="expand-detail">
                                                                <h4>Vaccination Schedule for {item.patientName}</h4>
                                                                <table className="mini-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Vaccine</th>
                                                                            <th>Dose</th>
                                                                            <th>Date Given</th>
                                                                            <th>Scheduled</th>
                                                                            <th>Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {item.records.map((record, idx) => (
                                                                            <tr key={idx}>
                                                                                <td>{record.vaccine}</td>
                                                                                <td>{record.dose}</td>
                                                                                <td>{record.date || <span className="not-yet">Not given</span>}</td>
                                                                                <td>{record.nextDue || <span className="not-yet">—</span>}</td>
                                                                                <td><span className={`vacc-status ${vaccineStatusClass(record.status)}`}>{record.status}</span></td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
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
