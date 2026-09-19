import React, { useState, useEffect, useRef } from 'react';
import useClickOutside from '../../hooks/useClickOutside';
import PatientService from '../../services/patientservice';
import BabyService from '../../services/babyservices';
import VaccinationService from '../../services/vaccinationservice';
import supabase from '../../config/supabaseclient';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { formatMotherId, formatNewbornId } from '../../utils/displayIds';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ExportModal from '../../components/ExportModal';

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
            const vaccinationService = new VaccinationService();
            const assignedStaff = form.patientType === 'Mother'
                ? await vaccinationService.getAssignedStaffForPatient(patientId)
                : await vaccinationService.getAssignedStaffForNewborn(patientId);

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
                            assigned_staff: assignedStaff,
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
                        assigned_staff: assignedStaff,
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
    const location = useLocation();
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
    const filterRowRef = useRef(null);
    useClickOutside(filterRowRef, () => setActivePopover(null));

    const [activeTab, setActiveTab] = useState('pending');    // 'pending' | 'missed' | 'administered'
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ patientType: 'All', item: 'All Items' });

    const [showExportModal, setShowExportModal] = useState(false);
    const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'this_month' | 'this_year' | 'custom'
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [dateFilterError, setDateFilterError] = useState('');
    const dateFilterLabel = dateFilter === 'this_month' ? 'This Month' : dateFilter === 'this_year' ? 'This Year' : dateFilter === 'custom' ? 'Custom' : 'All';

    const hasActiveFilters = filters.patientType !== 'All' || filters.item !== 'All Items' || searchTerm !== '' || dateFilter !== 'all';

    const clearFilters = () => {
        setFilters({ patientType: 'All', item: 'All Items' });
        setSearchTerm('');
        setDateFilter('all');
        setCustomDateFrom('');
        setCustomDateTo('');
        setDateFilterError('');
        setActivePopover(null);
    };

    const [recordModal, setRecordModal] = useState(null);      // null | { mode: 'vaccine' | 'supplement', initialPatientType?, initialPatientName? }

    useEffect(() => {
        if (location.state?.openRecordModal && location.state?.patientName) {
            setRecordModal({
                mode: 'vaccine',
                initialPatientType: location.state.patientType || 'Mother',
                initialPatientName: location.state.patientName,
            });
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate]);
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
    }, [activeTab, searchTerm, filters]);

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
                    type: 'Mother',
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

    // ── Combine, Filter + sort all records ──
    const todayStr = new Date().toISOString().split('T')[0];

    const allRecords = [
        ...vaccinationRecords.map(v => ({
            ...v,
            itemType: 'vaccine',
            itemName: v.vaccine,
            scheduledDate: v.nextDue,
            administeredDate: v.date
        })),
        ...supplementRecords.map(s => ({
            ...s,
            itemType: 'supplement',
            itemName: s.supplement,
            scheduledDate: s.nextDue,
            administeredDate: s.date
        }))
    ];

    const filteredRecordItems = allRecords
        .filter(r => {
            // Global search
            const q = searchTerm.toLowerCase();
            const matchSearch = (r.patientName || '').toLowerCase().includes(q) || (r.patientId || '').toLowerCase().includes(q) || (r.station || '').toLowerCase().includes(q);

            // Dropdown filters
            const filterType = (filters.patientType || 'All').toLowerCase();
            const filterItem = (filters.item || 'All Items').toLowerCase();
            
            const matchType = filterType === 'all' || (r.type || '').toLowerCase() === filterType;
            let matchItem = true;
            if (filterItem === 'vaccines') {
                matchItem = r.itemType === 'vaccine';
            } 
            else if (filterItem === 'supplements') {
                matchItem = r.itemType === 'supplement';
            }

            // Tab (Status) filtering
            let matchTab = false;
            const rStatus = (r.status || '').toLowerCase();
            
            if (activeTab === 'pending') {
                matchTab = (rStatus === 'pending' || rStatus === 'scheduled') && (!r.scheduledDate || r.scheduledDate >= todayStr);
            } 
            else if (activeTab === 'missed') {
                matchTab = (rStatus === 'missed' || rStatus === 'overdue') || ((rStatus === 'pending' || rStatus === 'scheduled') && r.scheduledDate && r.scheduledDate < todayStr);
            } 
            else if (activeTab === 'administered') {
                matchTab = rStatus === 'completed' || rStatus === 'administered' || rStatus === 'ongoing' || r.administeredDate;
            }

            // Date filter using administeredDate
            let matchDate = true;
            if (dateFilter !== 'all') {
                const dDate = r.administeredDate ? new Date(r.administeredDate) : null;
                if (!dDate || isNaN(dDate.getTime())) {
                    matchDate = false;
                } 
            else {
                 const now = new Date();
                if (dateFilter === 'this_month') {
                    matchDate = dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
                    } else if (dateFilter === 'this_year') {
                        matchDate = dDate.getFullYear() === now.getFullYear();
                    } else if (dateFilter === 'custom' && customDateFrom && customDateTo) {
                        const from = new Date(`${customDateFrom}T00:00:00`);
                        const to = new Date(`${customDateTo}T23:59:59.999`);
                        matchDate = dDate >= from && dDate <= to;
                    }
                }
            }

            return matchSearch && matchType && matchItem && matchTab && matchDate;
        })
        .sort((a, b) => {
            if (!sortField) {
                // Default sort: administered by administeredDate desc, others by scheduledDate asc
                if (activeTab === 'administered') {
                    const da = a.administeredDate || ''; const db = b.administeredDate || '';
                    return db.localeCompare(da);
                } else {
                    const da = a.scheduledDate || '9999-12-31'; const db = b.scheduledDate || '9999-12-31';
                    return da.localeCompare(db);
                }
            }
            const va = a[sortField] ?? ''; const vb = b[sortField] ?? '';
            return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });

    // Show one row per patient while keeping every matching item available in the row summary.
    const filteredRecords = Array.from(filteredRecordItems.reduce((patientMap, record) => {
        const patientKey = `${record.type}:${record.patientId}`;
        const existing = patientMap.get(patientKey);

        if (existing) {
            existing.records.push(record);
            return patientMap;
        }

        patientMap.set(patientKey, {
            ...record,
            records: [record],
            itemNames: [record.itemName],
            itemTypes: [record.itemType],
            pendingCount: 0,
            missedCount: 0,
            administeredCount: 0
        });
        return patientMap;
    }, new Map()).values()).map(patient => {
        patient.records.forEach(record => {
            const status = (record.status || '').toLowerCase();
            const isMissed = status === 'missed' || status === 'overdue' || (
                (status === 'pending' || status === 'scheduled') && record.scheduledDate && record.scheduledDate < todayStr
            );
            const isAdministered = status === 'completed' || status === 'administered' || status === 'ongoing' || record.administeredDate;

            if (isMissed) patient.missedCount += 1;
            else if (isAdministered) patient.administeredCount += 1;
            else patient.pendingCount += 1;

            if (!patient.itemNames.includes(record.itemName)) patient.itemNames.push(record.itemName);
            if (!patient.itemTypes.includes(record.itemType)) patient.itemTypes.push(record.itemType);
        });

        patient.itemName = patient.itemNames.join(', ');
        patient.itemType = patient.itemTypes.length === 1 ? patient.itemTypes[0] : 'mixed';
        patient.status = activeTab === 'missed' ? 'Missed' : activeTab === 'administered' ? 'Administered' : 'Pending';
        patient.scheduledDate = patient.records
            .map(record => record.scheduledDate)
            .filter(Boolean)
            .sort()[0] || null;
        patient.administeredDate = patient.records
            .map(record => record.administeredDate)
            .filter(Boolean)
            .sort()
            .pop() || null;

        return patient;
    });

    const getExportData = (dateRange) => {
        let toExport = allRecords;
        
        if (dateRange && (dateRange.from || dateRange.to)) {
            toExport = allRecords.filter(d => {
                const dDate = d.administeredDate ? new Date(d.administeredDate) : null;
                if (!dDate) return false;
                if (dateRange.from && dDate < dateRange.from) return false;
                if (dateRange.to && dDate > dateRange.to) return false;
                return true;
            });
        }

        return toExport.map(d => ({
            'Patient Name': d.patientName || d.babyName,
            'Patient ID': d.patientId,
            'Patient Type': d.type,
            'Item Type': d.itemType === 'vaccine' ? 'Vaccine' : 'Supplement',
            'Item Name': d.itemName,
            'Dose': d.dose || 'N/A',
            'Status': d.status,
            'Administered Date': formatReadableDate(d.administeredDate) || 'N/A',
            'Scheduled Date': formatReadableDate(d.scheduledDate) || 'N/A',
            'Staff': d.staff || 'N/A',
            'Station': d.station || 'N/A',
        }));
    };

    const handleExport = (exportConfig) => {
        const { format, dateRange, reportPeriodText } = exportConfig;
        const exportData = getExportData(dateRange);

        if (format === 'excel') {
            let worksheetData = [
                ["Report: Distribution Records"],
                [`Period: ${reportPeriodText}`],
                []
            ];

            if (exportData.length > 0) {
                worksheetData = worksheetData.concat([
                    Object.keys(exportData[0]),
                    ...exportData.map(obj => Object.values(obj))
                ]);
            } else {
                worksheetData.push(["No records found for the selected period."]);
            }

            const ws = XLSX.utils.aoa_to_sheet(worksheetData);
            
            if (exportData.length > 0) {
                const colWidths = [
                    { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
                    { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, 
                    { wch: 20 }, { wch: 20 }, { wch: 20 }
                ];
                ws['!cols'] = colWidths;
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Distribution Records');

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Distribution_Records_${dateStr}.xlsx`);
        } else if (format === 'pdf') {
            const doc = new jsPDF('landscape');
            
            doc.setFontSize(16);
            doc.text("Distribution Records Report", 14, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Period: ${reportPeriodText}`, 14, 28);
            
            if (exportData.length === 0) {
                doc.text("No records found for the selected period.", 14, 40);
            } else {
                const head = [Object.keys(exportData[0])];
                const body = exportData.map(obj => Object.values(obj));
                
                doc.autoTable({
                    startY: 35,
                    head: head,
                    body: body,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [185, 129, 138] }
                });
            }
            
            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`Distribution_Records_${dateStr}.pdf`);
        }
    };

    // Pagination logic
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = filteredRecords.slice(
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
                    <div className="export-dropdown-container" style={{ position: 'relative' }}>
                        <button className="btn btn-outline" onClick={() => setShowExportModal(true)}>
                            <Download size={16} /> Export
                        </button>
                    </div>
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
                <div className="shared-filters-row" ref={filterRowRef}>
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
                            className={`filter-btn ${filters.item !== 'All Items' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'item' ? null : 'item')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {filters.item === 'Vaccines' ? <Syringe size={14} className="filter-btn-icon" /> : <Pill size={14} className="filter-btn-icon" />}
                            <span>{filters.item}</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        {activePopover === 'item' && (
                            <div className="filter-popover">
                                <div className="popover-title">Item</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${filters.item === 'All Items' ? 'selected' : ''}`} onClick={() => { handleFilter('item', 'All Items'); setActivePopover(null); }}>All Items</button>
                                    <button className={`popover-opt-btn ${filters.item === 'Vaccines' ? 'selected' : ''}`} onClick={() => { handleFilter('item', 'Vaccines'); setActivePopover(null); }}>Vaccines</button>
                                    <button className={`popover-opt-btn ${filters.item === 'Supplements' ? 'selected' : ''}`} onClick={() => { handleFilter('item', 'Supplements'); setActivePopover(null); }}>Supplements</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Date Filter */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${dateFilter !== 'all' ? 'active-filter' : ''}`}
                            onClick={() => setActivePopover(activePopover === 'date' ? null : 'date')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Calendar size={14} className="filter-btn-icon" /> 
                            <span>Date: {dateFilterLabel}</span>
                            <ChevronDown size={14} className="filter-btn-icon" />
                        </button>
                        
                        {activePopover === 'date' && (
                            <div className="filter-popover" style={{ minWidth: '240px' }}>
                                <div className="popover-title">Date</div>
                                <div className="popover-options">
                                    <button className={`popover-opt-btn ${dateFilter === 'all' ? 'selected' : ''}`} onClick={() => { setDateFilter('all'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); }}>All Time</button>
                                    <button className={`popover-opt-btn ${dateFilter === 'this_month' ? 'selected' : ''}`} onClick={() => { setDateFilter('this_month'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); }}>This Month</button>
                                    <button className={`popover-opt-btn ${dateFilter === 'this_year' ? 'selected' : ''}`} onClick={() => { setDateFilter('this_year'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); }}>This Year</button>
                                    <button className={`popover-opt-btn ${dateFilter === 'custom' ? 'selected' : ''}`} onClick={() => { setDateFilter('custom'); setDateFilterError(''); }}>Custom Range</button>
                                </div>
                                {dateFilter === 'custom' && (
                                    <div className="date-custom-range-section">
                                        <div className="date-custom-range-fields">
                                            <div className="date-custom-field">
                                                <label>From</label>
                                                <input type="date" value={customDateFrom} onChange={e => { setCustomDateFrom(e.target.value); setDateFilterError(''); }} />
                                            </div>
                                            <div className="date-custom-field">
                                                <label>To</label>
                                                <input type="date" value={customDateTo} min={customDateFrom} onChange={e => { setCustomDateTo(e.target.value); setDateFilterError(''); }} />
                                            </div>
                                        </div>
                                        {dateFilterError && (
                                            <div className="date-filter-error">
                                                <AlertTriangle size={12} /> {dateFilterError}
                                            </div>
                                        )}
                                        <div className="date-custom-actions">
                                            <button className="date-custom-cancel" onClick={() => { setDateFilter('all'); setCustomDateFrom(''); setCustomDateTo(''); setDateFilterError(''); setActivePopover(null); }}>Cancel</button>
                                            <button className="date-custom-apply" onClick={() => {
                                                if (!customDateFrom || !customDateTo) {
                                                    setDateFilterError('Both dates are required.');
                                                    return;
                                                }
                                                if (new Date(customDateFrom) > new Date(customDateTo)) {
                                                    setDateFilterError('From date cannot be later than To.');
                                                    return;
                                                }
                                                setDateFilterError('');
                                                setActivePopover(null);
                                            }}>Apply</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {hasActiveFilters && (
                        <button className="clear-filters-btn" onClick={clearFilters}>Clear All</button>
                    )}

                    <Legend 
                        categories={[
                            {
                                title: "Type",
                                items: [
                                    { label: "Mother", className: "type-mother" },
                                    { label: "Newborn", className: "type-newborn" }
                                ]
                            },
                            {
                                title: "Item Type",
                                items: [
                                    { label: "Vaccine", className: "badge-vaccine" },
                                    { label: "Supplement", className: "badge-supplement" }
                                ]
                            },
                            {
                                title: "Status",
                                items: [
                                    { label: "Completed / Administered", className: "chip-completed" },
                                    { label: "Pending", className: "chip-pending" },
                                    { label: "Missed / Overdue", className: "chip-missed" }
                                ]
                            }
                        ]}
                    />
                </div>
            </div>
            {/* ── Main Layout ── */}
            <div className="vacc-main-layout">

                {/* ── Tables ── */}
                <div className="vacc-table-col" style={{ gridColumn: '1 / -1' }}>

                    {/* Tab Switcher */}
                    <div className="vacc-tabs">
                        <button className={`vacc-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                            Pending
                        </button>
                        <button className={`vacc-tab ${activeTab === 'missed' ? 'active' : ''}`} onClick={() => setActiveTab('missed')}>
                            Missed
                        </button>
                        <button className={`vacc-tab ${activeTab === 'administered' ? 'active' : ''}`} onClick={() => setActiveTab('administered')}>
                            Administered
                        </button>
                    </div>

                    <div className="vacc-card">
                        <div className="vacc-card-head">
                            <h2><Syringe size={16} /> Distribution Records</h2>
                        </div>

                        <div className="table-responsive">
                            <table className="vacc-table">
                                <thead>
                                    <tr>
                                        <th className="col-num">#</th>
                                        <th className="col-patient"><span onClick={() => handleSort('patientName')} className="sortable-head">Patient Name <SortBtn field="patientName" /></span></th>
                                        <th className="col-type">Type</th>
                                        <th className="col-item">Item</th>
                                        <th className="col-date"><span onClick={() => handleSort(activeTab === 'administered' ? 'administeredDate' : 'scheduledDate')} className="sortable-head">Date <SortBtn field={activeTab === 'administered' ? 'administeredDate' : 'scheduledDate'} /></span></th>
                                        <th className="col-status">Status</th>
                                        <th className="col-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRecords.map((item, index) => (
                                        <tr key={`record-${item.id}`} className="vacc-row">
                                            <td className="col-num">
                                                {(currentPage - 1) * itemsPerPage + index + 1}
                                            </td>
                                            <td className="col-patient">
                                                <div className="vacc-patient" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div className="vacc-avatar">{item.patientName ? item.patientName.split(' ').map(n=>n[0]).slice(0,2).join('') : '—'}</div>
                                                    <div>
                                                        <span className="vacc-name">{item.patientName}</span>
                                                        <span className="vacc-pid">{item.type === 'Newborn' ? formatNewbornId(item.patientId) : formatMotherId(item.patientId)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="col-type">
                                                <span className={`type-badge type-${item.type.toLowerCase()}`}>{item.type}</span>
                                            </td>
                                            <td className="col-item">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <strong>{item.itemNames.length > 2 ? `${item.itemNames.slice(0, 2).join(', ')} + ${item.itemNames.length - 2} more` : item.itemName}</strong>
                                                    <span className={item.itemType === 'vaccine' ? 'badge-vaccine' : item.itemType === 'supplement' ? 'badge-supplement' : 'badge-vaccine'} style={{ alignSelf: 'flex-start' }}>
                                                        {item.itemType === 'mixed' ? 'Vaccines & Supplements' : item.itemType === 'vaccine' ? 'Vaccine' : 'Supplement'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="col-date">
                                                {activeTab === 'administered' ? (
                                                    formatReadableDate(item.administeredDate) || <span className="not-yet">Unknown</span>
                                                ) : (
                                                    formatReadableDate(item.scheduledDate) || <span className="not-yet">Not scheduled</span>
                                                )}
                                            </td>
                                            <td className="col-status">
                                                <span className={`vacc-status ${
                                                    ['completed', 'administered', 'ongoing'].includes((item.status || '').toLowerCase()) ? 'status-completed' :
                                                    ['missed', 'overdue'].includes((item.status || '').toLowerCase()) ? 'status-missed' : 'status-pending'
                                                }`}>
                                                    {item.status}
                                                    {item.itemType === 'mixed' && <small style={{ display: 'block', marginTop: '3px' }}>{item.records.length} items</small>}
                                                </span>
                                            </td>
                                            <td className="col-actions">
                                                <div className="row-actions">
                                                    <button className="action-btn view-btn" title="View Patient Profile"><User size={13} /></button>
                                                    {activeTab !== 'administered' && (
                                                        <button 
                                                            className="action-btn record-btn" 
                                                            title="Record vaccination or supplement"
                                                            onClick={() => setRecordModal({ mode: item.itemTypes.includes('vaccine') ? 'vaccine' : 'supplement', initialPatientType: item.type, initialPatientName: item.patientName })}
                                                        >
                                                            <Plus size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedRecords.length === 0 && (
                                        <tr><td colSpan="7" className="vacc-empty"><Package size={24} /><p>No distribution records match your filters.</p></td></tr>
                                    )}
                                </tbody>
                            </table>
                            {totalPages > 1 && (
                                <div className="pagination-wrap">
                                    <span>
                                        Showing {(currentPage - 1) * itemsPerPage + 1}–
                                        {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length}
                                    </span>
                                    <div className="pagination-controls">
                                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="page-btn">
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className="page-numbers">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                                                <button key={num} className={`page-num ${currentPage === num ? 'active' : ''}`} onClick={() => setCurrentPage(num)}>
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="page-btn">
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
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
            {newbornVaccinationModal && (
                <NewbornVaccinationModal
                    newbornId={newbornVaccinationModal.newbornId}
                    newbornName={newbornVaccinationModal.newbornName}
                    initialTab={newbornVaccinationModal.initialTab}
                    onClose={handleModalClose}
                />
            )}

            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                onExport={handleExport}
                title="Export Distribution Records"
            />
        </div>
    );
};

export default Vaccinations;
