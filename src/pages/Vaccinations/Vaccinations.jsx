import React, { useState, useEffect } from 'react';
import PatientService from '../../services/patientservice';
import BabyService from '../../services/babyservices';
import VaccinationService from '../../services/vaccinationservice';
import supabase from '../../config/supabaseclient';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../context/ModalContext';
import {
    Search, Filter, Plus, X, Syringe, Pill, Package,
    AlertTriangle, CheckCircle2, Clock, XCircle,
    Eye, Edit2, Calendar, Download, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Baby, User, Activity, Archive, MapPin,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import NewbornVaccinationModal from '../../components/NewbornVaccinationModal';
import '../../styles/pages/Vaccinations.css';
import '../../styles/components/SharedFilters.css';
import Legend from '../../components/Legend/Legend';

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

const formatReadableDate = (dateString) => {
    if (!dateString) return dateString;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
export const RecordModal = ({ mode, initialPatientType, initialPatientName, initialAutoSelectId, onClose, onSave }) => {
    const { alert: customAlert } = useModal();
    const babyService = new BabyService();
    const [form, setForm] = useState({
        patientType: initialPatientType || 'Mother', patientName: initialPatientName || '', vaccine: '',
        supplement: '', dose: '', date: new Date().toISOString().split('T')[0], nextDue: '', staff: '', remarks: '', brand: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [pendingVaccines, setPendingVaccines] = useState([]);
    const [selectedVaccines, setSelectedVaccines] = useState({});
    const [selectedVaccineNames, setSelectedVaccineNames] = useState([]);
    const [vaccineDoses, setVaccineDoses] = useState({});
    const [selectedVaccineBrands, setSelectedVaccineBrands] = useState({});
    const [vaccineBrandOptions, setVaccineBrandOptions] = useState({});
    const [supplementBrandOptions, setSupplementBrandOptions] = useState([]);
    const [selectedSupplementBrand, setSelectedSupplementBrand] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [supplementTypes, setSupplementTypes] = useState([]);
    const [vaccineTypes, setVaccineTypes] = useState([]);
    const [isPregnant, setIsPregnant] = useState(false);
    const [patientStationId, setPatientStationId] = useState(null);
    const [vaccineSearchQuery, setVaccineSearchQuery] = useState('');
    const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const resolvePatientStation = async (patientId, patientType, fallbackStationName = '') => {
        try {
            let stationId = null;
            let stationName = null;

            if (patientType === 'Mother') {
                const { data, error } = await supabase
                    .from('patient_basic_info')
                    .select('station_ass, stations:station_ass (station_name)')
                    .eq('id', patientId)
                    .maybeSingle();

                if (error) throw error;
                stationId = data?.station_ass ?? null;
                stationName = data?.stations?.station_name ?? null;

                if (stationId && !stationName) {
                    const { data: stationRow, error: stationError } = await supabase
                        .from('stations')
                        .select('station_name')
                        .eq('id', stationId)
                        .maybeSingle();
                    if (!stationError) {
                        stationName = stationRow?.station_name || stationName;
                    }
                }
            } else {
                const { data, error } = await supabase
                    .from('newborns')
                    .select('mother_id, patient_basic_info!mother_id (station_ass, stations:station_ass (station_name))')
                    .eq('id', patientId)
                    .maybeSingle();

                if (error) throw error;
                const pInfo = Array.isArray(data?.patient_basic_info) ? data?.patient_basic_info[0] : data?.patient_basic_info;
                stationId = pInfo?.station_ass ?? null;
                stationName = pInfo?.stations?.station_name ?? null;
            }

            if (!stationId && fallbackStationName) {
                const stationLookup = fallbackStationName.split(',')[0].trim();
                if (stationLookup) {
                    const { data: stationRow, error: stationError } = await supabase
                        .from('stations')
                        .select('id, station_name')
                        .ilike('station_name', `%${stationLookup}%`)
                        .maybeSingle();

                    if (!stationError && stationRow?.id) {
                        stationId = stationRow.id;
                        stationName = stationRow.station_name || stationLookup;
                    }
                }
            }

            return { stationId, stationName };
        } catch (error) {
            console.error('Error resolving patient station:', error);
            return { stationId: null, stationName: null };
        }
    };

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

        if (mode === 'supplement' && patientStationId && form.supplement) {
            const fetchSupplementBrands = async () => {
                try {
                    const { data: stationRows, error: stationError } = await supabase
                        .from('station_supplement_inventory')
                        .select('supplement_inventory_id, quantity')
                        .eq('station_id', patientStationId)
                        .gt('quantity', 0);

                    if (stationError) throw stationError;
                    const supplementIds = [...new Set((stationRows || []).map(item => item.supplement_inventory_id).filter(Boolean))];
                    if (supplementIds.length === 0) {
                        setSupplementBrandOptions([]);
                        setSelectedSupplementBrand('');
                        return;
                    }

                    const { data, error } = await supabase
                        .from('supplement_inventory')
                        .select('brand')
                        .in('id', supplementIds)
                        .eq('supplement_name', form.supplement)
                        .gt('quantity', 0)
                        .not('brand', 'is', null)
                        .order('brand', { ascending: true });

                    if (error) throw error;
                    const brands = [...new Set((data || []).map(item => item.brand).filter(Boolean))];
                    setSupplementBrandOptions(brands);
                    setSelectedSupplementBrand(prev => prev && brands.includes(prev) ? prev : (brands[0] || ''));
                } catch (error) {
                    console.error('Error fetching supplement brands:', error);
                    setSupplementBrandOptions([]);
                    setSelectedSupplementBrand('');
                }
            };
            fetchSupplementBrands();
        } else if (mode === 'supplement') {
            setSupplementBrandOptions([]);
            setSelectedSupplementBrand('');
        }

        // Fetch vaccine types from station inventory when in vaccine mode and patient is selected
        if (mode === 'vaccine' && patientStationId) {
            const fetchVaccineTypes = async () => {
                try {
                    console.log('🔍 Fetching vaccines for station:', patientStationId);
                    
                    // DEBUG: Fetch all to see what's in the table
                    const { data: allSvi } = await supabase.from('station_vaccine_inventory').select('*');
                    console.log('🐞 ALL station_vaccine_inventory records:', allSvi);

                    const { data: stationRows, error: stationError } = await supabase
                        .from('station_vaccine_inventory')
                        .select('vaccine_id, quantity')
                        .eq('station_id', patientStationId)
                        .gt('quantity', 0);

                    console.log('📦 Station vaccine inventory rows:', stationRows, 'Error:', stationError);
                    if (stationError) throw stationError;

                    const vaccineIds = [...new Set((stationRows || []).map(item => item.vaccine_id).filter(Boolean))];
                    if (vaccineIds.length === 0) {
                        setVaccineTypes([]);
                        return;
                    }

                    const { data: vaccineRows, error: vaccineError } = await supabase
                        .from('vaccine_inventory')
                        .select('id, vaccine_name')
                        .in('id', vaccineIds)
                        .order('vaccine_name', { ascending: true });

                    console.log('📦 Resolved vaccine inventory names:', vaccineRows, 'Error:', vaccineError);
                    if (vaccineError) throw vaccineError;

                    const uniqueVaccines = [...new Set((vaccineRows || []).map(item => item.vaccine_name).filter(Boolean))];
                    setVaccineTypes(uniqueVaccines);
                } catch (error) {
                    console.error('Error fetching vaccine types:', error);
                    setVaccineTypes([]);
                }
            };
            fetchVaccineTypes();
        } else if (mode === 'vaccine') {
            setVaccineTypes([]);
        }
    }, [mode, form.patientType, form.supplement, isPregnant, patientStationId]);

    useEffect(() => {
        const loadVaccineBrands = async () => {
            if (mode !== 'vaccine' || !patientStationId) {
                setVaccineBrandOptions({});
                return;
            }

            const selectedNames = [...new Set(selectedVaccineNames.filter(Boolean))];
            if (selectedNames.length === 0) {
                setVaccineBrandOptions({});
                return;
            }

            try {
                const { data: stationRows, error: stationError } = await supabase
                    .from('station_vaccine_inventory')
                    .select('vaccine_id')
                    .eq('station_id', patientStationId)
                    .gt('quantity', 0);

                if (stationError) throw stationError;

                const vaccineIds = [...new Set((stationRows || []).map(item => item.vaccine_id).filter(Boolean))];
                if (vaccineIds.length === 0) {
                    setVaccineBrandOptions({});
                    return;
                }

                const { data: vaccineRows, error: vaccineError } = await supabase
                    .from('vaccine_inventory')
                    .select('id, vaccine_name, brand')
                    .in('id', vaccineIds)
                    .gt('quantity', 0)
                    .not('brand', 'is', null)
                    .order('vaccine_name', { ascending: true });

                if (vaccineError) throw vaccineError;

                const nextOptions = {};
                for (const vaccineName of selectedNames) {
                    nextOptions[vaccineName] = [...new Set((vaccineRows || [])
                        .filter(item => item.vaccine_name === vaccineName)
                        .map(item => item.brand)
                        .filter(Boolean))];
                }
                setVaccineBrandOptions(nextOptions);
            } catch (error) {
                console.error('Error fetching vaccine brands:', error);
                setVaccineBrandOptions({});
            }
        };

        loadVaccineBrands();
    }, [mode, selectedVaccineNames, patientStationId]);

    useEffect(() => {
        console.log('✅ RecordModal useEffect triggered!', form.patientName, form.patientType);
        const searchPendingVaccines = async () => {
            console.log('🔍 Searching for patient:', form.patientName);
            let patientId = selectedPatient?.id || null;
            let patientLabel = selectedPatient?.label || null;
            let stationHint = selectedPatient?.station || '';
            let barangay = '';

            if (!form.patientName || form.patientName.trim().length < 3) {
                console.log('⏸️ Patient name too short or empty');
                setSelectedPatient(null);
                setPendingVaccines([]);
                setSelectedVaccines({});
                setStaffList(STAFF_LIST);
                setSuggestions([]);
                setShowSuggestions(false);
                setPatientStationId(null);
                return;
            }

            try {
                const patientService = new PatientService();
                let allMatches = [];
                if (!patientId) {
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
                            stationHint = mothers[0].station || '';
                            barangay = mothers[0].station.split(',')[0].trim();
                            setSelectedPatient({ id: mothers[0].id, label: mothers[0].name, type: 'Mother', station: mothers[0].station });
                            console.log('✅ Auto-selected single mother match:', mothers[0].name);
                        }
                    } else {
                        const newborns = await babyService.searchNewborns(form.patientName);
                        allMatches = newborns.map(n => ({
                            id: n.id,
                            name: n.name,
                            station: n.station,
                            type: 'Newborn'
                        }));
                        if (newborns.length === 1) {
                            patientId = newborns[0].id;
                            patientLabel = newborns[0].name;
                            stationHint = newborns[0].station || '';
                            setSelectedPatient({ id: newborns[0].id, label: newborns[0].name, type: 'Newborn', station: newborns[0].station });
                            console.log('✅ Auto-selected single newborn match:', newborns[0].name);
                            const { data: motherData, error: mError } = await supabase
                                .from('newborns')
                                .select('mother_id, patient_basic_info!mother_id (station_ass, stations:station_ass (station_name))')
                                .eq('id', patientId)
                                .maybeSingle();

                            if (!mError && motherData?.patient_basic_info?.stations) {
                                barangay = motherData.patient_basic_info.stations.station_name;
                            }
                        }
                    }
                }

                setSuggestions(allMatches);
                setShowSuggestions(allMatches.length > 0);
                console.log('📊 Suggestions to show:', allMatches, 'Show:', allMatches.length > 0);

                if (!patientId) {
                    setSelectedPatient(null);
                    setPendingVaccines([]);
                    setSelectedVaccines({});
                    setPatientStationId(null);
                    return;
                }

                setSelectedPatient(prev => prev ? { ...prev, id: patientId, label: patientLabel || prev.label, type: form.patientType, station: stationHint || prev.station } : { id: patientId, label: patientLabel || form.patientName, type: form.patientType, station: stationHint });

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

                const { stationId } = await resolvePatientStation(patientId, form.patientType, stationHint);
                console.log('🏢 Final resolved station ID:', stationId, 'hint:', stationHint);
                setPatientStationId(stationId);

                if (barangay) {
                    const { data: staffData, error: staffError } = await supabase
                        .from('staff_profiles')
                        .select('full_name, station_ass, stations:station_ass (station_name)')
                        .ilike('stations.station_name', `%${barangay}%`);

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
                    vaccine: row.vaccine_inventory?.vaccine_name || row.notes?.trim() || 'Unknown Vaccine',
                    dose_number: row.dose_number,
                    scheduled_vaccination: row.scheduled_vaccination,
                    status: row.status
                }));

                setPendingVaccines(pending);
                if (initialAutoSelectId) {
                    setSelectedVaccines({ [initialAutoSelectId]: true });
                } else {
                    setSelectedVaccines({});
                }
            } catch (err) {
                console.error('Error loading patient vaccination schedule:', err);
                setSelectedPatient(null);
                setPatientStationId(null);
                setPendingVaccines([]);
                setSelectedVaccines({});
            }
        };

        searchPendingVaccines();
    }, [form.patientName, form.patientType, selectedPatient?.id, selectedPatient?.label]);

    const handleSelectSuggestion = async (suggestion) => {
        console.log('🎯 handleSelectSuggestion called with:', suggestion);
        updateForm('patientName', suggestion.name);

        let station = suggestion.station;
        if (!station || station.toLowerCase().startsWith('no station')) {
            const { stationName } = await resolvePatientStation(suggestion.id, suggestion.type);
            station = stationName || station || '';
        }

        setSelectedPatient({ id: suggestion.id, label: suggestion.name, type: suggestion.type, station });
        setShowSuggestions(false);
        console.log('✅ selectedPatient set to:', { id: suggestion.id, label: suggestion.name, type: suggestion.type, station });
    };

    const resolveInventoryBatch = async (itemType, itemName, brand, stationId = null) => {
        const vaccinationService = new VaccinationService();
        return vaccinationService.resolveInventoryItem({ itemType, itemName, brand, stationId });
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
            await customAlert({ title: 'Missing Information', text: 'Please fill in all required fields.', iconType: 'warning' });
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
                const selectedScheduledIds = Object.entries(selectedVaccines)
                    .filter(([, checked]) => checked)
                    .map(([id]) => id);

                if (selectedScheduledIds.length > 0) {
                    // Only update checked scheduled vaccination records, do not insert new rows.
                    for (const [index, scheduledId] of selectedScheduledIds.entries()) {
                        const { data: vaccRecord } = await supabase
                            .from('vaccinations')
                            .select('id, vaccine_inventory_id, notes')
                            .eq('id', scheduledId)
                            .single();

                        let vaccineInvId = vaccRecord?.vaccine_inventory_id;
                        const selectedVaccineName = selectedVaccineNames.length > 0
                            ? (selectedVaccineNames[index] || selectedVaccineNames[0])
                            : null;
                        const selectedBrand = selectedVaccineName ? (selectedVaccineBrands[selectedVaccineName] || null) : null;

                        if (selectedVaccineName) {
                            const inventoryItem = await resolveInventoryBatch('vaccine', selectedVaccineName, selectedBrand, patientStationId);
                            if (inventoryItem?.id) {
                                vaccineInvId = inventoryItem.id;
                            }
                        }

                        if (!vaccineInvId && vaccRecord?.notes) {
                            const vaccineMatch = vaccRecord.notes.match(/(\d+)(?:st|nd|rd|th) dose of (.+)/);
                            if (vaccineMatch) {
                                const extractedName = vaccineMatch[2].trim();
                                const { data: fuzzyItems, error: fuzzyError } = await supabase
                                    .from('vaccine_inventory')
                                    .select('id, quantity, vaccine_name')
                                    .gt('quantity', 0)
                                    .order('expiration_date', { ascending: true, nullsFirst: false });

                                if (!fuzzyError && fuzzyItems) {
                                    const searchTerm = extractedName.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    const match = fuzzyItems.find(item => {
                                        const normalizedItem = item.vaccine_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                                        return normalizedItem.includes(searchTerm) || searchTerm.includes(normalizedItem);
                                    });
                                    if (match) vaccineInvId = match.id;
                                }
                            }
                        }

                        const updateData = {
                            vaccinated_date: form.date,
                            status: 'Completed',
                            vaccinated_by: currentUser,
                            remarks: form.remarks || null
                        };

                        if (vaccineInvId) {
                            updateData.vaccine_inventory_id = vaccineInvId;
                        }

                        await supabase.from('vaccinations').update(updateData).eq('id', scheduledId);

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

                                if (patientStationId) {
                                    const { data: stationInv, error: stationInvError } = await supabase
                                        .from('station_vaccine_inventory')
                                        .select('id, quantity')
                                        .eq('station_id', patientStationId)
                                        .eq('vaccine_id', vaccInv.id)
                                        .maybeSingle();

                                    if (!stationInvError && stationInv && stationInv.quantity > 0) {
                                        await supabase
                                            .from('station_vaccine_inventory')
                                            .update({ quantity: stationInv.quantity - 1 })
                                            .eq('id', stationInv.id);
                                        console.log(`✅ Decremented station vaccine inventory for ${vaccInv.vaccine_name} at station ${patientStationId}`);
                                    }
                                }
                            }
                        }
                    }

                    if (onSave) {
                        onSave();
                    } else {
                        onClose();
                    }
                    return;
                }

                if (selectedVaccineNames.length > 0) {
                    for (const vaccineName of selectedVaccineNames) {
                        const dose = vaccineDoses[vaccineName];
                        if (!dose) {
                            await customAlert({ title: 'Missing Dose', text: `Please select a dose for ${vaccineName}`, iconType: 'warning' });
                            setIsSaving(false);
                            return;
                        }

                        const selectedBrand = selectedVaccineBrands[vaccineName] || null;
                        const vaccInv = await resolveInventoryBatch('vaccine', vaccineName, selectedBrand, patientStationId);

                        if (!vaccInv) {
                            await customAlert({ title: 'Out of Stock', text: `No stock available for ${vaccineName}`, iconType: 'warning' });
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
                            vaccinated_by: currentUser,
                            remarks: form.remarks || null
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

                        if (patientStationId) {
                            const { data: stationInv, error: stationInvError } = await supabase
                                .from('station_vaccine_inventory')
                                .select('id, quantity')
                                .eq('station_id', patientStationId)
                                .eq('vaccine_id', vaccInv.id)
                                .maybeSingle();

                            if (!stationInvError && stationInv && stationInv.quantity > 0) {
                                await supabase
                                    .from('station_vaccine_inventory')
                                    .update({ quantity: stationInv.quantity - 1 })
                                    .eq('id', stationInv.id);
                                console.log(`✅ Decremented station vaccine inventory for ${vaccInv.vaccine_name} at station ${patientStationId}`);
                            }
                        }

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

                // Manual entry route when no scheduled rows are checked
                if (selectedVaccineNames.length === 0 && selectedScheduledIds.length === 0) {
                    // Manual entry: try to find in inventory first, otherwise create without inventory
                    const vaccInv = await resolveInventoryBatch('vaccine', form.vaccine, form.brand || null, patientStationId);
                    const doseNumber = parseInt(form.dose.match(/\d+/)?.[0]) || 1;
                    const vaccinationRecord = {
                        patient_id: patientId,
                        dose_number: doseNumber,
                        vaccinated_date: form.date,
                        scheduled_vaccination: form.date,
                        status: 'Completed',
                        created_by: currentUser,
                        vaccinated_by: currentUser,
                        remarks: form.remarks || null
                    };

                    if (vaccInv) {
                        vaccinationRecord.vaccine_inventory_id = vaccInv.id;
                        await supabase.from('vaccinations').insert([vaccinationRecord]);

                        if (vaccInv.quantity > 0) {
                            await supabase
                                .from('vaccine_inventory')
                                .update({ quantity: vaccInv.quantity - 1 })
                                .eq('id', vaccInv.id);
                            console.log(`✅ Decremented vaccine: ${form.vaccine}`);
                        }

                        if (patientStationId) {
                            const { data: stationInv, error: stationInvError } = await supabase
                                .from('station_vaccine_inventory')
                                .select('id, quantity')
                                .eq('station_id', patientStationId)
                                .eq('vaccine_id', vaccInv.id)
                                .maybeSingle();

                            if (!stationInvError && stationInv && stationInv.quantity > 0) {
                                await supabase
                                    .from('station_vaccine_inventory')
                                    .update({ quantity: stationInv.quantity - 1 })
                                    .eq('id', stationInv.id);
                                console.log(`✅ Decremented station vaccine inventory for ${form.vaccine} at station ${patientStationId}`);
                            }
                        }
                    } else {
                        console.log(`⚠️ Vaccine not in inventory, creating manual record for: ${form.vaccine}`);
                        await supabase.from('vaccinations').insert([vaccinationRecord]);
                    }

                    if (form.patientType === 'Mother' && isPregnant) {
                        const vaccService = new VaccinationService();
                        const { data: patientData } = await supabase
                            .from('patient_basic_info')
                            .select('pregnancy_info (lmd)')
                            .eq('id', patientId)
                            .single();
                        const lmpDate = patientData?.pregnancy_info?.[0]?.lmd || null;

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
                const suppInv = await resolveInventoryBatch('supplement', form.supplement, selectedSupplementBrand || null, patientStationId);

                const supplementRecord = {
                    patient_id: patientId,
                    dosage: form.dose,
                    start_date: form.date,
                    end_date: form.date,
                    created_by: currentUser
                };

                // If supplement found in inventory, link it and decrement
                if (suppInv) {
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
            await customAlert({ title: 'Error', text: 'Failed to save record: ' + (error.message || 'Unknown error - check console for details'), iconType: 'danger' });
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
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Search & Select Vaccines <span className="req">*</span></label>
                                <input 
                                    type="text" 
                                    placeholder="Search vaccines available at patient's station..." 
                                    value={vaccineSearchQuery} 
                                    onChange={(e) => setVaccineSearchQuery(e.target.value)} 
                                    style={{ marginBottom: '10px', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                                {patientStationId ? (
                                    <div className="vaccine-checkbox-list">
                                        {vaccineTypes
                                            .filter(v => v.toLowerCase().includes(vaccineSearchQuery.toLowerCase()))
                                            .map(vaccine => (
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
                                                        value={selectedVaccineBrands[vaccine] || ''}
                                                        onChange={(e) => setSelectedVaccineBrands({ ...selectedVaccineBrands, [vaccine]: e.target.value })}
                                                        className="dose-select"
                                                    >
                                                        <option value="">Select Brand</option>
                                                        {(vaccineBrandOptions[vaccine] || []).map(brand => (
                                                            <option key={brand} value={brand}>{brand}</option>
                                                        ))}
                                                    </select>
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
                                ) : (
                                    <p style={{ color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>Please select a valid patient to view available vaccines at their station.</p>
                                )}
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
                                    <label>Brand</label>
                                    <select value={selectedSupplementBrand} onChange={e => setSelectedSupplementBrand(e.target.value)}>
                                        <option value="">Select Brand</option>
                                        {supplementBrandOptions.map(brand => <option key={brand} value={brand}>{brand}</option>)}
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
                            <label>Remarks</label>
                            <input type="text" placeholder="Doctor's observations or remarks..." value={form.remarks} onChange={e => updateForm('remarks', e.target.value)} />
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
    const { alert: customAlert } = useModal();
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
    const [archivedPatientIds, setArchivedPatientIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [activePopover, setActivePopover] = useState(null);

    const [activeTab, setActiveTab] = useState('vaccines');    // 'vaccines' | 'supplements'
    const [searchTerm, setSearchTerm] = useState('');
    const [archiveFilter, setArchiveFilter] = useState('active');
    const [filters, setFilters] = useState({ patientType: 'All', status: 'All', item: 'All' });
    const [recordModal, setRecordModal] = useState(null);      // null | { mode: 'vaccine' | 'supplement', initialPatientType?, initialPatientName? }
    const [newbornVaccinationModal, setNewbornVaccinationModal] = useState(null);  // null | newborn object
    const [expirationSummaryModal, setExpirationSummaryModal] = useState(null);      // null | 'vaccine' | 'supplement'
    const [expandedRows, setExpandedRows] = useState({});
    const [sortField, setSortField] = useState('');
    const [sortAsc, setSortAsc] = useState(true);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Reset pagination on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchTerm, filters, archiveFilter]);

    const fetchData = async () => {
        try {
            setLoading(true);

            const archivedIds = await patientService.getArchivedPatientIds();
            setArchivedPatientIds(archivedIds);

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
                    patient_basic_info!vaccinations_patient_id_fkey (id, first_name, last_name, station_ass, stations:station_ass (station_name), province)
                `)
                .order('created_at', { ascending: false });
            console.log('💉 Fetched vaccination records:', vaccRecords?.length || 0);
            console.log('🔍 Sample vaccination records with patient_id:', vaccRecords?.filter(r => r.patient_id).slice(0, 5).map(r => ({
                id: r.id,
                patient_id: r.patient_id,
                patient_basic_info: r.patient_basic_info
            })));
            const { data: suppRecords } = await supabase.from('supplements').select('*').order('created_at', { ascending: false });

            const { data: allPatients } = await supabase
                .from('patient_basic_info')
                .select('id, first_name, last_name, station_ass, stations:station_ass (station_name), province');

            // Fetch all newborns to create a map
            const { data: allNewborns } = await supabase
                .from('newborns')
                .select('id, baby_name, mother_id, created_at');

            const archivedNewbornIds = new Set(
                (allNewborns || [])
                    .filter((newborn) => archivedIds.has(newborn.mother_id))
                    .map((newborn) => newborn.id)
            );

            // Get maps for names
            const { data: vaccineInv } = await supabase.from('vaccine_inventory').select('id, vaccine_name');
            const vaccineMap = new Map(vaccineInv.map(v => [v.id, v.vaccine_name]));
            const { data: suppInv } = await supabase.from('supplement_inventory').select('id, supplement_name');
            const suppMap = new Map(suppInv.map(s => [s.id, s.supplement_name]));
            const { data: staff } = await supabase.from('staff_profiles').select('id, full_name');
            const staffMap = new Map(staff.map(s => [s.id, s.full_name]));
            
            console.log('📋 Fetched patients:', allPatients?.length || 0);
            const patientMap = new Map(allPatients?.map(p => [p.id, {
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                station: `${p.stations?.station_name || 'N/A'}, ${p.province || 'N/A'}`
            }]) || []);
            console.log('🗺️ PatientMap size:', patientMap.size);
            console.log('🗺️ Sample PatientMap entries:', Array.from(patientMap.entries()).slice(0, 5));
            console.log('🗺️ All PatientMap keys:', Array.from(patientMap.keys()).slice(0, 20));

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

            const isVisiblePatientRecord = (patientId, newbornId) => {
                if (archiveFilter === 'all') return true;
                if (archiveFilter === 'archived') {
                    return (patientId && archivedIds.has(patientId)) || (newbornId && archivedNewbornIds.has(newbornId));
                }
                return !(patientId && archivedIds.has(patientId)) && !(newbornId && archivedNewbornIds.has(newbornId));
            };

            // Transform vaccination records
            const transformedVaccRecords = (vaccRecords || [])
                .filter(record => {
                    if (!isVisiblePatientRecord(record.patient_id, record.newborn_id)) return false;
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
            const transformedSuppRecords = (suppRecords || [])
                .filter(record => isVisiblePatientRecord(record.patient_id, null))
                .map(record => {
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
    }, [archiveFilter]);

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

    // Pagination logic for Vaccines
    const totalVaccinePages = Math.ceil(displayList.length / itemsPerPage);
    const paginatedVaccines = displayList.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

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

    // Group supplement records by patient
    const displayListSupplements = [];
    const suppPatientMap = {};

    filteredSupplements.forEach(s => {
        const key = s.patientId || s.patientName;
        if (!key) return;

        if (!suppPatientMap[key]) {
            suppPatientMap[key] = {
                id: key,
                patientId: s.patientId,
                patientName: s.patientName || 'Unknown',
                station: s.station || 'Unknown',
                type: s.type || 'Mother',
                administeredCount: 0,
                pendingCount: 0,
                lastAdministered: null,
                nextScheduled: null,
                lastStaff: null,
                records: []
            };
        }
        suppPatientMap[key].records.push(s);
        if (s.status === 'Completed') {
            suppPatientMap[key].administeredCount++;
            const date = new Date(s.date);
            if (!suppPatientMap[key].lastAdministered || date > new Date(suppPatientMap[key].lastAdministered)) {
                suppPatientMap[key].lastAdministered = s.date;
                suppPatientMap[key].lastStaff = s.staff;
            }
        } else if (s.status === 'Ongoing' || s.status === 'Pending') {
            suppPatientMap[key].pendingCount++;
            if (s.nextDue) {
                const scheduledDate = new Date(s.nextDue);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (scheduledDate >= today) {
                    if (!suppPatientMap[key].nextScheduled || scheduledDate < new Date(suppPatientMap[key].nextScheduled)) {
                        suppPatientMap[key].nextScheduled = s.nextDue;
                    }
                }
            }
        }
    });

    Object.values(suppPatientMap).forEach(p => displayListSupplements.push(p));

    // Pagination logic for Supplements
    const totalSuppPages = Math.ceil(displayListSupplements.length / itemsPerPage);
    const paginatedSupplements = displayListSupplements.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

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
                    <h1 className="page-title"><Syringe size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Distribution Records</h1>
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
            <div className="shared-controls-card">
                <div className="shared-search-wrap">
                    <Search size={16} className="shared-search-icon" />
                    <input
                        type="text"
                        className="shared-search-input"
                        placeholder="Search by patient name, ID, or station..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="shared-filters-row">
                    <span className="filters-label"><Filter size={13} /> Filters:</span>
                    {/* Patient Type Filter */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${filters.patientType !== 'All' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'patientType' ? null : 'patientType')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <User size={14} className="filter-btn-icon" />
                            <span>{filters.patientType === 'All' ? 'All Patient Types' : filters.patientType}</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        {activePopover === 'patientType' && (
                            <div className="filter-popover">
                                <div className="popover-title">Patient Type</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${filters.patientType === 'All' ? 'selected' : ''}`} onClick={() => { handleFilter('patientType', 'All'); setActivePopover(null); }}>All Patient Types</button>
                                    <button className={`popover-opt-btn ${filters.patientType === 'Mother' ? 'selected' : ''}`} onClick={() => { handleFilter('patientType', 'Mother'); setActivePopover(null); }}>Mother</button>
                                    <button className={`popover-opt-btn ${filters.patientType === 'Newborn' ? 'selected' : ''}`} onClick={() => { handleFilter('patientType', 'Newborn'); setActivePopover(null); }}>Newborn</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Item Filter */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${filters.item !== 'All' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'item' ? null : 'item')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {activeTab === 'vaccines' ? <Syringe size={14} className="filter-btn-icon" /> : <Pill size={14} className="filter-btn-icon" />}
                            <span>{filters.item === 'All' ? (activeTab === 'vaccines' ? 'All Vaccines' : 'All Supplements') : filters.item}</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        {activePopover === 'item' && (
                            <div className="filter-popover">
                                <div className="popover-title">Item</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${filters.item === 'All' ? 'selected' : ''}`} onClick={() => { handleFilter('item', 'All'); setActivePopover(null); }}>{activeTab === 'vaccines' ? 'All Vaccines' : 'All Supplements'}</button>
                                    {itemOptions.map(o => (
                                        <button key={o} className={`popover-opt-btn ${filters.item === o ? 'selected' : ''}`} onClick={() => { handleFilter('item', o); setActivePopover(null); }}>{o}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status Filter */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${filters.status !== 'All' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Activity size={14} className="filter-btn-icon" />
                            <span>{filters.status === 'All' ? 'All Statuses' : filters.status}</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        {activePopover === 'status' && (
                            <div className="filter-popover">
                                <div className="popover-title">Status</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${filters.status === 'All' ? 'selected' : ''}`} onClick={() => { handleFilter('status', 'All'); setActivePopover(null); }}>All Statuses</button>
                                    {activeTab === 'vaccines' ? (
                                        <>
                                            <button className={`popover-opt-btn ${filters.status === 'Completed' ? 'selected' : ''}`} onClick={() => { handleFilter('status', 'Completed'); setActivePopover(null); }}>Completed</button>
                                            <button className={`popover-opt-btn ${filters.status === 'Pending' ? 'selected' : ''}`} onClick={() => { handleFilter('status', 'Pending'); setActivePopover(null); }}>Pending</button>
                                            <button className={`popover-opt-btn ${filters.status === 'Overdue' ? 'selected' : ''}`} onClick={() => { handleFilter('status', 'Overdue'); setActivePopover(null); }}>Overdue</button>
                                        </>
                                    ) : (
                                        <>
                                            <button className={`popover-opt-btn ${filters.status === 'Ongoing' ? 'selected' : ''}`} onClick={() => { handleFilter('status', 'Ongoing'); setActivePopover(null); }}>Ongoing</button>
                                            <button className={`popover-opt-btn ${filters.status === 'Completed' ? 'selected' : ''}`} onClick={() => { handleFilter('status', 'Completed'); setActivePopover(null); }}>Completed</button>
                                            <button className={`popover-opt-btn ${filters.status === 'Missed' ? 'selected' : ''}`} onClick={() => { handleFilter('status', 'Missed'); setActivePopover(null); }}>Missed</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Archive Filter */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${archiveFilter !== 'active' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'archive' ? null : 'archive')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Archive size={14} className="filter-btn-icon" />
                            <span>{archiveFilter === 'active' ? 'Active' : 'Archived'}</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        {activePopover === 'archive' && (
                            <div className="filter-popover">
                                <div className="popover-title">Status</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${archiveFilter === 'active' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('active'); setActivePopover(null); }}>Active</button>
                                    <button className={`popover-opt-btn ${archiveFilter === 'archived' ? 'selected' : ''}`} onClick={() => { setArchiveFilter('archived'); setActivePopover(null); }}>Archived</button>
                                </div>
                            </div>
                        )}
                    </div>
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
                            <h2>{activeTab === 'vaccines' ? <><Syringe size={16} /> Distribution Records</> : <><Pill size={16} /> Distribution Records</>}</h2>
                            <Legend 
                                categories={[
                                    {
                                        title: "Status",
                                        items: activeTab === 'vaccines' ? [
                                            { label: "Completed", className: "chip-completed", icon: <CheckCircle2 size={11} /> },
                                            { label: "Pending", className: "chip-pending", icon: <Clock size={11} /> },
                                            { label: "Overdue", className: "chip-overdue", icon: <AlertTriangle size={11} /> }
                                        ] : [
                                            { label: "Completed", className: "chip-completed", icon: <CheckCircle2 size={11} /> },
                                            { label: "Ongoing", className: "chip-pending", icon: <Pill size={11} /> },
                                            { label: "Missed", className: "chip-missed", icon: <XCircle size={11} /> }
                                        ]
                                    }
                                ]}
                            />
                        </div>

                        {/* VACCINES TABLE */}
                        {activeTab === 'vaccines' && (
                            <div className="table-responsive">
                                <table className="vacc-table">
                                    <thead>
                                        <tr>
                                            <th className="col-num">#</th>
                                            <th className="col-patient"><span onClick={() => handleSort('patientName')} className="sortable-head">Patient <SortBtn field="patientName" /></span></th>
                                            <th className="col-type">Type</th>
                                            <th className="col-admin">Administered</th>
                                            <th className="col-pending">Pending</th>
                                            <th className="col-date">Last Given</th>
                                            <th className="col-date">Next Scheduled</th>
                                            <th className="col-status">Status</th>
                                            <th className="col-staff">Last Staff</th>
                                            <th className="col-actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedVaccines.map((item, index) => (
                                            <React.Fragment key={`patient-${item.id}`}>
                                                <tr className={`vacc-row vacc-row--grouped`}>
                                                    <td className="col-num" rowSpan={expandedRows[item.id] ? 2 : 1}>
                                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                                    </td>
                                                    <td className="col-patient">
                                                        <div className="patient-col-wrapper">
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
                                                        </div>
                                                    </td>
                                                    <td className="col-type"><span className={`type-badge type-${item.type.toLowerCase()}`}>{item.type}</span></td>
                                                    <td className="col-admin">{item.administeredCount} administered</td>
                                                    <td className="col-pending">{item.pendingCount} pending</td>
                                                    <td className="col-date">{formatReadableDate(item.lastAdministered) || <span className="not-yet">None</span>}</td>
                                                    <td className="col-date">{formatReadableDate(item.nextScheduled) || <span className="not-yet">None scheduled</span>}</td>
                                                    <td className="col-status"><span className={`vacc-status ${item.pendingCount > 0 ? 'status-pending' : 'status-completed'}`}>{item.pendingCount > 0 ? 'Pending' : 'Completed'}</span></td>
                                                    <td className="col-staff">{item.lastStaff || <span className="not-yet">—</span>}</td>
                                                    <td className="col-actions">
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
                                                                            <th className="mini-col-item">Vaccine</th>
                                                                            <th className="mini-col-dose">Dose</th>
                                                                            <th className="mini-col-date">Date Given</th>
                                                                            <th className="mini-col-date">Scheduled</th>
                                                                            <th className="mini-col-status">Status</th>
                                                                            <th className="mini-col-actions">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {item.records.map((record, idx) => (
                                                                            <tr key={idx}>
                                                                                <td className="mini-col-item"><strong>{record.vaccine}</strong></td>
                                                                                <td className="mini-col-dose">{record.dose}</td>
                                                                                <td className="mini-col-date">{formatReadableDate(record.date) || <span className="not-yet">Not given</span>}</td>
                                                                                <td className="mini-col-date">{formatReadableDate(record.nextDue) || <span className="not-yet">—</span>}</td>
                                                                                <td className="mini-col-status"><span className={`vacc-status ${vaccineStatusClass(record.status)}`}>{record.status}</span></td>
                                                                                <td className="mini-col-actions">
                                                                                    {record.status === 'Pending' && (
                                                                                        <button 
                                                                                            className="action-btn record-btn" 
                                                                                            style={{ fontSize: '0.75rem', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                                            onClick={() => setRecordModal({ mode: 'vaccine', initialPatientType: item.type, initialPatientName: item.patientName, initialAutoSelectId: record.id })}
                                                                                        >
                                                                                            <Syringe size={12} /> Administer Now
                                                                                        </button>
                                                                                    )}
                                                                                </td>
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
                                            <tr><td colSpan="10" className="vacc-empty"><Syringe size={24} /><p>No vaccination records match your filters.</p></td></tr>
                                        )}
                                    </tbody>
                                </table>
                                {totalVaccinePages > 1 && (
                                    <div className="pagination-wrap">
                                        <span>
                                            Showing {(currentPage - 1) * itemsPerPage + 1}–
                                            {Math.min(currentPage * itemsPerPage, displayList.length)} of {displayList.length}
                                        </span>
                                        <div className="pagination-controls">
                                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="page-btn">
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div className="page-numbers">
                                                {Array.from({ length: totalVaccinePages }, (_, i) => i + 1).map(num => (
                                                    <button key={num} className={`page-num ${currentPage === num ? 'active' : ''}`} onClick={() => setCurrentPage(num)}>
                                                        {num}
                                                    </button>
                                                ))}
                                            </div>
                                            <button disabled={currentPage === totalVaccinePages} onClick={() => setCurrentPage(p => p + 1)} className="page-btn">
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SUPPLEMENTS TABLE */}
                        {activeTab === 'supplements' && (
                            <div className="table-responsive">
                                <table className="vacc-table">
                                    <thead>
                                        <tr>
                                            <th className="col-num">#</th>
                                            <th className="col-patient"><span onClick={() => handleSort('patientName')} className="sortable-head">Patient <SortBtn field="patientName" /></span></th>
                                            <th className="col-type">Type</th>
                                            <th className="col-admin">Administered</th>
                                            <th className="col-pending">Pending</th>
                                            <th className="col-date">Last Given</th>
                                            <th className="col-date">Next Scheduled</th>
                                            <th className="col-status">Status</th>
                                            <th className="col-staff">Last Staff</th>
                                            <th className="col-actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedSupplements.map((item, index) => (
                                            <React.Fragment key={`supp-patient-${item.id}`}>
                                                <tr className={`vacc-row vacc-row--grouped`}>
                                                    <td className="col-num" rowSpan={expandedRows[item.id] ? 2 : 1}>
                                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                                    </td>
                                                    <td className="col-patient">
                                                        <div className="patient-col-wrapper">
                                                            <button className="expand-btn" onClick={() => toggleRow(item.id)}>
                                                                {expandedRows[item.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                            </button>
                                                            <div className="vacc-patient">
                                                                <div className="vacc-avatar">{item.patientName ? item.patientName.split(' ').map(n=>n[0]).slice(0,2).join('') : '—'}</div>
                                                                <div>
                                                                    <span className="vacc-name">{item.patientName}</span>
                                                                    <span className="vacc-pid">{item.station}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="col-type"><span className={`type-badge type-${item.type.toLowerCase()}`}>{item.type}</span></td>
                                                    <td className="col-admin">{item.administeredCount} administered</td>
                                                    <td className="col-pending">{item.pendingCount} pending</td>
                                                    <td className="col-date">{formatReadableDate(item.lastAdministered) || <span className="not-yet">None</span>}</td>
                                                    <td className="col-date">{formatReadableDate(item.nextScheduled) || <span className="not-yet">None scheduled</span>}</td>
                                                    <td className="col-status"><span className={`vacc-status ${item.pendingCount > 0 ? 'status-pending' : 'status-completed'}`}>{item.pendingCount > 0 ? 'Pending' : 'Completed'}</span></td>
                                                    <td className="col-staff">{item.lastStaff || <span className="not-yet">—</span>}</td>
                                                    <td className="col-actions">
                                                        <div className="row-actions">
                                                            <button className="action-btn view-btn" title="View Supplement Schedule" onClick={() => toggleRow(item.id)}><Eye size={13} /></button>
                                                            <button className="action-btn record-btn" title="Record Supplement" onClick={() => setRecordModal({ mode: 'supplement' })}><Plus size={13} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedRows[item.id] && (
                                                    <tr className="vacc-expanded-row">
                                                        <td colSpan="9">
                                                            <div className="expand-detail">
                                                                <h4>Supplement Distribution History for {item.patientName}</h4>
                                                                <table className="mini-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th className="mini-col-item">Supplement</th>
                                                                            <th className="mini-col-dose">Dose</th>
                                                                            <th className="mini-col-date">Start Date</th>
                                                                            <th className="mini-col-exp">Expiration</th>
                                                                            <th className="mini-col-date">End Date</th>
                                                                            <th className="mini-col-status">Status</th>
                                                                            <th className="mini-col-actions">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {item.records.map((record, idx) => (
                                                                            <tr key={idx}>
                                                                                <td className="mini-col-item"><strong>{record.supplement}</strong></td>
                                                                                <td className="mini-col-dose">{record.dose}</td>
                                                                                <td className="mini-col-date">{formatReadableDate(record.date) || <span className="not-yet">Not given</span>}</td>
                                                                                <td className="mini-col-exp">
                                                                                    {record.expirationDate ? (
                                                                                        <>
                                                                                            <span className={`exp-status ${record.expirationClass}`}>{record.expirationStatus}</span>
                                                                                            <span className="exp-date">{formatReadableDate(record.expirationDate)}</span>
                                                                                        </>
                                                                                    ) : <span className="not-yet">—</span>}
                                                                                </td>
                                                                                <td className="mini-col-date">{formatReadableDate(record.nextDue) || <span className="not-yet">—</span>}</td>
                                                                                <td className="mini-col-status"><span className={`vacc-status ${supplementStatusClass(record.status)}`}>{record.status}</span></td>
                                                                                <td className="mini-col-actions">
                                                                                    <div className="row-actions">
                                                                                        <button className="action-btn edit-btn" title="Edit"><Edit2 size={13} /></button>
                                                                                    </div>
                                                                                </td>
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
                                        {displayListSupplements.length === 0 && (
                                            <tr><td colSpan="10" className="vacc-empty"><Pill size={24} /><p>No supplement records match your filters.</p></td></tr>
                                        )}
                                    </tbody>
                                </table>
                                {totalSuppPages > 1 && (
                                    <div className="pagination-wrap">
                                        <span>
                                            Showing {(currentPage - 1) * itemsPerPage + 1}–
                                            {Math.min(currentPage * itemsPerPage, filteredSupplements.length)} of {filteredSupplements.length}
                                        </span>
                                        <div className="pagination-controls">
                                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="page-btn">
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div className="page-numbers">
                                                {Array.from({ length: totalSuppPages }, (_, i) => i + 1).map(num => (
                                                    <button key={num} className={`page-num ${currentPage === num ? 'active' : ''}`} onClick={() => setCurrentPage(num)}>
                                                        {num}
                                                    </button>
                                                ))}
                                            </div>
                                            <button disabled={currentPage === totalSuppPages} onClick={() => setCurrentPage(p => p + 1)} className="page-btn">
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                                                <td>{formatReadableDate(r.date)}</td>
                                                                <td>{formatReadableDate(r.expirationDate) || '—'}</td>
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
