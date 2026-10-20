import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import useClickOutside from '../../hooks/useClickOutside';
import PatientService from '../../services/patientservice';
import BabyService from '../../services/babyservices';
import VaccinationService from '../../services/vaccinationservice';
import InventoryService from '../../services/inventoryservice';
import supabase from '../../config/supabaseclient';
import { useNavigate, useLocation } from 'react-router-dom';
import { useModal } from '../../context/ModalContext';
import { useRolePermissions } from '../../context/RolePermissionContext';
import {
    Search, Filter, Plus, X, Syringe, Pill, Package,
    AlertTriangle, CheckCircle2, Clock, XCircle,
    Eye, Edit2, Calendar, Download, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Baby, User, Users, CalendarClock, Activity, Archive, MapPin,
    ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import NewbornVaccinationModal from '../../components/NewbornVaccinationModal';
import '../../styles/pages/Vaccinations.css';
import '../../styles/components/SharedFilters.css';
import Legend from '../../components/Legend/Legend';
import { formatMotherId, formatNewbornId } from '../../utils/displayIds';
import * as XLSX from 'xlsx';
import ExportModal from '../../components/ExportModal';
import { exportStandardStaffPdf } from '../../utils/staffPdfTemplate';
import ActionTooltip from '../../components/Common/ActionTooltip';
import StaffPageLoader from '../../components/Common/StaffPageLoader';
import SearchableSelect from '../../components/Common/SearchableSelect';
import { useDefaultStation } from '../../hooks/useDefaultStation';

const inventoryService = new InventoryService();

// Constants for vaccine and supplement types
const VACCINE_TYPES = [
  'BCG', 'DPT', 'Hepatitis B', 'OPV', 'IPV', 'MMR', 'Hib', 'Rotavirus',
  'PCV', 'Influenza', 'COVID-19', 'HPV', 'Typhoid', 'Cholera', 'Yellow Fever'
];

const SUPPLEMENT_TYPES = [
  'Iron Tablets', 'Folic Acid', 'Vitamin A', 'Vitamin D', 'Vitamin C',
  'Calcium', 'Zinc', 'Iodine', 'Vitamin B Complex', 'Omega-3'
];

const formatReadableDate = (dateString) => {
    if (!dateString) return dateString;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const isMaternalOnlyVaccine = (vaccineName) => {
    if (!vaccineName || typeof vaccineName !== 'string') return false;
    const name = vaccineName.trim();
    const lower = name.toLowerCase();

    // Pediatric combination vaccines that protect against diphtheria, pertussis, tetanus, etc.
    // are newborn vaccines (e.g., Pentavalent Vaccine (DPT-Hep B-Hib), DPT).
    if (lower.includes('pentavalent') || /\bdpt\b/i.test(name)) {
        return false;
    }

    // Explicit maternal vaccines
    if (lower.includes('maternal')) return true;
    if (lower.includes('tetanus')) return true;
    if (lower.includes('toxoid')) return true;
    if (/\btdap\b/i.test(name)) return true;
    if (/\btd\b/i.test(name)) return true;
    if (/\btt\b/i.test(name)) return true;
    if (/\bttd\b/i.test(name)) return true;

    return false;
};

export const RecordModal = ({ mode, initialPatientType, initialPatientName, initialAutoSelectId, onClose, onSave }) => {
    const { alert: customAlert } = useModal();
    const babyService = new BabyService();
    const defaultPatientType = mode === 'vaccine' ? (initialPatientType || 'Newborn') : (initialPatientType || 'Mother');
    const [form, setForm] = useState({
        patientType: defaultPatientType,
        patientName: initialPatientName || '',
        vaccine: '',
        supplement: '',
        dose: '',
        date: new Date().toISOString().split('T')[0],
        nextDue: '',
        staff: '',
        remarks: '',
        brand: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // 1. Separate patient search & selection states
    const [patientSearchInput, setPatientSearchInput] = useState(initialPatientName || '');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearchingPatients, setIsSearchingPatients] = useState(false);
    const [confirmedPatient, setConfirmedPatient] = useState(null);

    // 2. Vaccine loading & schedule states
    const [isLoadingVaccines, setIsLoadingVaccines] = useState(false);
    const [vaccineLoadError, setVaccineLoadError] = useState(null);
    const [patientStationId, setPatientStationId] = useState(null);
    const [pendingVaccines, setPendingVaccines] = useState([]);
    const [vaccineTypes, setVaccineTypes] = useState([]);
    const [vaccineSearchQuery, setVaccineSearchQuery] = useState('');
    const [selectedVaccines, setSelectedVaccines] = useState({});
    const [selectedVaccineNames, setSelectedVaccineNames] = useState([]);
    const [vaccineDoses, setVaccineDoses] = useState({});
    const [selectedVaccineBrands, setSelectedVaccineBrands] = useState({});
    const [vaccineBrandOptions, setVaccineBrandOptions] = useState({});

    // 3. Supplement states
    const [supplementBrandOptions, setSupplementBrandOptions] = useState([]);
    const [selectedSupplementBrand, setSelectedSupplementBrand] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [supplementTypes, setSupplementTypes] = useState([]);
    const [supplementInventoryItems, setSupplementInventoryItems] = useState([]);
    const [isLoadingSupplements, setIsLoadingSupplements] = useState(false);
    const [supplementLoadError, setSupplementLoadError] = useState(null);

    const updateForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
    const selectedPatient = confirmedPatient;

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

    // Load authorized supplement inventory whenever mode is supplement
    useEffect(() => {
        if (mode !== 'supplement') return;

        let isMounted = true;
        const loadSupplementInventory = async () => {
            setIsLoadingSupplements(true);
            setSupplementLoadError(null);
            try {
                let rows = [];
                try {
                    rows = await inventoryService.getStationInventorySnapshot();
                } catch (snapshotErr) {
                    console.warn('getStationInventorySnapshot failed, falling back to getSupplementInventory:', snapshotErr);
                    const fallbackSupp = await inventoryService.getSupplementInventory();
                    rows = (fallbackSupp || []).map(item => ({
                        ...item,
                        item_type: 'Supplement'
                    }));
                }

                if (!isMounted) return;

                const availableSupplements = (rows || []).filter(item => {
                    const isSupp = String(item.item_type || '').toLowerCase() === 'supplement';
                    const hasStock = Number(item.quantity) > 0;
                    return isSupp && hasStock;
                });

                setSupplementInventoryItems(availableSupplements);
            } catch (err) {
                console.error('Error loading supplement inventory:', err);
                if (isMounted) {
                    setSupplementLoadError(err.message || 'Failed to load supplement inventory');
                    setSupplementInventoryItems([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoadingSupplements(false);
                }
            }
        };

        loadSupplementInventory();

        return () => {
            isMounted = false;
        };
    }, [mode]);

    // Active items prioritizing patient's station if stock exists there, otherwise all authorized station inventory
    const activeSupplementItems = useMemo(() => {
        if (patientStationId) {
            const stationSpecific = supplementInventoryItems.filter(item => item.station_id === patientStationId);
            if (stationSpecific.length > 0) {
                return stationSpecific;
            }
        }
        return supplementInventoryItems;
    }, [supplementInventoryItems, patientStationId]);

    // Deduplicated Supplement Types
    const supplementTypeOptions = useMemo(() => {
        const typeMap = new Map();
        for (const item of activeSupplementItems) {
            const name = item.item_name?.trim();
            if (!name) continue;

            const existing = typeMap.get(name) || { totalStock: 0, brands: new Set(), unit: item.unit || 'tablets' };
            existing.totalStock += Number(item.quantity) || 0;
            if (item.brand?.trim()) {
                existing.brands.add(item.brand.trim());
            }
            typeMap.set(name, existing);
        }

        return Array.from(typeMap.entries()).map(([name, data]) => {
            const brandCount = data.brands.size;
            const brandText = brandCount > 0 ? `${brandCount} brand${brandCount > 1 ? 's' : ''}` : 'generic';
            return {
                value: name,
                label: name,
                subtext: `${data.totalStock} ${data.unit} available (${brandText})`
            };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }, [activeSupplementItems]);

    // Brands dependent on selected Supplement Type (form.supplement)
    const brandOptions = useMemo(() => {
        if (!form.supplement) return [];

        const matchingItems = activeSupplementItems.filter(
            item => item.item_name?.trim().toLowerCase() === form.supplement.trim().toLowerCase()
        );

        const brandMap = new Map();
        for (const item of matchingItems) {
            const brandName = item.brand?.trim() || 'Generic / Standard';
            const existing = brandMap.get(brandName) || { stock: 0, unit: item.unit || 'tablets' };
            existing.stock += Number(item.quantity) || 0;
            brandMap.set(brandName, existing);
        }

        return Array.from(brandMap.entries()).map(([brandName, data]) => ({
            value: brandName,
            label: brandName,
            subtext: `${data.stock} ${data.unit} in stock`
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [activeSupplementItems, form.supplement]);

    // Handle initial patient auto-load if initialPatientName was provided
    useEffect(() => {
        if (!initialPatientName) return;

        let active = true;
        const loadInitialPatient = async () => {
            try {
                if (form.patientType === 'Mother') {
                    const patientService = new PatientService();
                    const mothers = await patientService.searchPatients(initialPatientName);
                    if (!active) return;
                    const matched = mothers.find(m => m.name.toLowerCase() === initialPatientName.toLowerCase()) || mothers[0];
                    if (matched) {
                        const patientObj = {
                            id: matched.id,
                            name: matched.name,
                            station: matched.station,
                            type: 'Mother'
                        };
                        setConfirmedPatient(patientObj);
                        setPatientSearchInput(matched.name);
                        updateForm('patientName', matched.name);
                    }
                } else {
                    const newborns = await babyService.searchNewborns(initialPatientName);
                    if (!active) return;
                    const matched = newborns.find(n => n.name.toLowerCase() === initialPatientName.toLowerCase()) || newborns[0];
                    if (matched) {
                        const patientObj = {
                            id: matched.id,
                            name: matched.name,
                            station: matched.station,
                            motherName: matched.motherName,
                            motherId: matched.motherId,
                            birthDate: matched.birthDate,
                            type: 'Newborn'
                        };
                        setConfirmedPatient(patientObj);
                        setPatientSearchInput(matched.name);
                        updateForm('patientName', matched.name);
                    }
                }
            } catch (err) {
                console.error('Error loading initial patient:', err);
            }
        };

        loadInitialPatient();
        return () => { active = false; };
    }, [initialPatientName]);

    // Debounced search for patient autocomplete suggestions
    useEffect(() => {
        // If confirmedPatient is set and input matches its name, do not run search
        if (confirmedPatient && patientSearchInput.trim().toLowerCase() === confirmedPatient.name.trim().toLowerCase()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const trimmed = patientSearchInput.trim();
        if (trimmed.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            setIsSearchingPatients(false);
            return;
        }

        let isCurrent = true;
        setIsSearchingPatients(true);

        const debounceTimer = setTimeout(async () => {
            try {
                let matches = [];
                if (form.patientType === 'Mother') {
                    const patientService = new PatientService();
                    const mothers = await patientService.searchPatients(trimmed);
                    if (!isCurrent) return;
                    matches = mothers.map(m => ({
                        id: m.id,
                        name: m.name,
                        station: m.station,
                        type: 'Mother'
                    }));
                } else {
                    const newborns = await babyService.searchNewborns(trimmed);
                    if (!isCurrent) return;
                    matches = newborns.map(n => ({
                        id: n.id,
                        name: n.name,
                        station: n.station,
                        motherName: n.motherName,
                        motherId: n.motherId,
                        birthDate: n.birthDate,
                        type: 'Newborn'
                    }));
                }

                if (isCurrent) {
                    setSuggestions(matches);
                    setShowSuggestions(matches.length > 0);
                    // CRITICAL: NEVER auto-select a patient on typing/searching alone!
                }
            } catch (err) {
                console.error('Error searching patients:', err);
                if (isCurrent) {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } finally {
                if (isCurrent) {
                    setIsSearchingPatients(false);
                }
            }
        }, 250);

        return () => {
            isCurrent = false;
            clearTimeout(debounceTimer);
        };
    }, [patientSearchInput, form.patientType, confirmedPatient]);

    const handlePatientInputChange = (e) => {
        const val = e.target.value;
        setPatientSearchInput(val);
        updateForm('patientName', val);

        // Invalidate confirmed patient if user modifies text after selecting
        if (confirmedPatient) {
            setConfirmedPatient(null);
            setPatientStationId(null);
            setPendingVaccines([]);
            setSelectedVaccines({});
            setVaccineTypes([]);
            setSelectedVaccineNames([]);
            setVaccineBrandOptions({});
            setVaccineLoadError(null);
        }
        setShowSuggestions(true);
    };

    const handleSelectSuggestion = (suggestion) => {
        setPatientSearchInput(suggestion.name);
        updateForm('patientName', suggestion.name);
        setConfirmedPatient(suggestion);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    const handlePatientTypeChange = (newType) => {
        updateForm('patientType', newType);
        setPatientSearchInput('');
        updateForm('patientName', '');
        setConfirmedPatient(null);
        setSuggestions([]);
        setShowSuggestions(false);
        setPendingVaccines([]);
        setSelectedVaccines({});
        setVaccineTypes([]);
        setSelectedVaccineNames([]);
        setVaccineBrandOptions({});
        setPatientStationId(null);
        setVaccineLoadError(null);
    };

    // Load patient's pending vaccines and station inventory once patient is confirmed
    const loadPatientVaccineData = async (patient) => {
        if (!patient || !patient.id) {
            setPendingVaccines([]);
            setSelectedVaccines({});
            setVaccineTypes([]);
            setPatientStationId(null);
            setIsLoadingVaccines(false);
            setVaccineLoadError(null);
            return;
        }

        setIsLoadingVaccines(true);
        setVaccineLoadError(null);

        try {
            // 1. Resolve patient station
            const { stationId, stationName } = await resolvePatientStation(patient.id, patient.type, patient.station);
            let targetStationId = stationId;
            try {
                const inventoryScope = await inventoryService.getCurrentUserScope();
                targetStationId = inventoryScope.stationId || stationId;
            } catch (scopeErr) {
                console.warn('Could not determine inventory user scope, using patient station:', scopeErr);
            }
            setPatientStationId(targetStationId);

            // 2. Resolve staff for barangay / station
            const barangayHint = stationName || patient.station || '';
            const barangay = barangayHint.split(',')[0].trim();
            if (barangay) {
                const { data: staffData } = await supabase
                    .from('staff_profiles')
                    .select('full_name, station_ass, stations:station_ass (station_name)')
                    .ilike('stations.station_name', `%${barangay}%`);

                const staffOptions = (staffData || []).map(s => s.full_name).filter(Boolean);
                setStaffList(staffOptions);
                if (staffOptions.length > 0 && !staffOptions.includes(form.staff)) {
                    updateForm('staff', staffOptions[0]);
                }
            } else {
                setStaffList([]);
            }

            if (mode !== 'vaccine') {
                setPendingVaccines([]);
                setSelectedVaccines({});
                setVaccineTypes([]);
                return;
            }

            // 3. Fetch pending scheduled vaccinations for the patient
            const pendingQuery = supabase
                .from('vaccinations')
                .select(`id, dose_number, scheduled_vaccination, vaccinated_date, status, vaccine_inventory (vaccine_name), notes`)
                .eq('status', 'Pending')
                .order('scheduled_vaccination', { ascending: true });

            if (patient.type === 'Mother') {
                pendingQuery.eq('patient_id', patient.id);
            } else {
                pendingQuery.eq('newborn_id', patient.id);
            }

            const { data: pendingRows, error: pendingError } = await pendingQuery;
            if (pendingError) throw pendingError;

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

            // 4. Fetch available vaccine inventory from station
            let availableVaccineNames = [];
            let inventoryCatalog = [];
            try {
                inventoryCatalog = await inventoryService.getStationInventorySnapshot();
            } catch (invErr) {
                console.warn('Failed to get station inventory snapshot:', invErr);
            }

            const stationVaccines = (inventoryCatalog || []).filter(item =>
                item.item_type === 'Vaccine' &&
                (!targetStationId || item.station_id === targetStationId) &&
                Number(item.quantity) > 0
            );

            // Deduplicate vaccine item names
            const uniqueNames = [...new Set(stationVaccines.map(item => item.item_name?.trim()).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b));

            // CRITICAL: Filter out maternal-only vaccines when patient is a Newborn!
            if (patient.type === 'Newborn') {
                availableVaccineNames = uniqueNames.filter(v => !isMaternalOnlyVaccine(v));
            } else {
                availableVaccineNames = uniqueNames;
            }

            setVaccineTypes(availableVaccineNames);
        } catch (err) {
            console.error('Error loading patient vaccine data:', err);
            setVaccineLoadError(err.message || 'Failed to load vaccine data');
        } finally {
            setIsLoadingVaccines(false);
        }
    };

    useEffect(() => {
        if (confirmedPatient && confirmedPatient.id) {
            loadPatientVaccineData(confirmedPatient);
        } else {
            setPendingVaccines([]);
            setSelectedVaccines({});
            setVaccineTypes([]);
            setPatientStationId(null);
            setVaccineLoadError(null);
            setIsLoadingVaccines(false);
        }
    }, [confirmedPatient?.id, confirmedPatient?.type, mode]);

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
                const inventoryRows = await inventoryService.getStationInventorySnapshot();
                const availableVaccines = inventoryRows.filter(item =>
                    item.item_type === 'Vaccine' &&
                    item.station_id === patientStationId &&
                    Number(item.quantity) > 0
                );

                const nextOptions = {};
                for (const vaccineName of selectedNames) {
                    nextOptions[vaccineName] = [...new Set(availableVaccines
                        .filter(item => item.item_name === vaccineName)
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

    const resolveInventoryBatch = async (itemType, itemName, brand, stationId = null) => {
        const vaccinationService = new VaccinationService();
        return vaccinationService.resolveInventoryItem({ itemType, itemName, brand, stationId });
    };

    const handleSave = async () => {
        const hasPendingSelection = mode === 'vaccine' && Object.values(selectedVaccines).some(Boolean);
        const hasCheckboxSelection = mode === 'vaccine' && selectedVaccineNames.length > 0;

        const patientId = confirmedPatient?.id;
        if (!patientId) {
            await customAlert({
                title: 'Patient Required',
                text: 'Please select a valid patient from the search suggestions dropdown.',
                iconType: 'warning'
            });
            return;
        }

        if (mode === 'vaccine' && !hasPendingSelection && !hasCheckboxSelection && (!form.vaccine || !form.dose)) {
            await customAlert({
                title: 'Vaccine Required',
                text: 'Please select at least one pending scheduled vaccine or an available station vaccine to record.',
                iconType: 'warning'
            });
            return;
        }

        if (mode === 'supplement' && (!form.supplement || !form.dose)) {
            await customAlert({
                title: 'Supplement Required',
                text: 'Please fill in all required supplement fields.',
                iconType: 'warning'
            });
            return;
        }

        if (!form.date) {
            await customAlert({
                title: 'Date Required',
                text: 'Please select the administration date.',
                iconType: 'warning'
            });
            return;
        }

        setIsSaving(true);
        try {
            const patientService = new PatientService();
            const currentUser = await patientService.getCurrentUserId();
            if (!currentUser) throw new Error('No logged-in user');
            const access = await patientService.getCurrentUserAccess();
            const vaccinationService = new VaccinationService();
            const performingStationId = access.stationId || await vaccinationService.getCurrentUserStationId();
            if (!performingStationId) throw new Error('Your account must have an assigned service station.');
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
                        const { data: vaccRecord, error: recordError } = await supabase
                            .from('vaccinations')
                            .select('id, vaccine_inventory_id, notes')
                            .eq('id', scheduledId)
                            .single();
                        if (recordError) throw recordError;

                        const selectedVaccineName = selectedVaccineNames.length > 0
                            ? (selectedVaccineNames[index] || selectedVaccineNames[0])
                            : null;
                        const selectedBrand = selectedVaccineName ? (selectedVaccineBrands[selectedVaccineName] || null) : null;
                        const { data: scheduledInventory, error: scheduledInventoryError } = vaccRecord?.vaccine_inventory_id
                            ? await supabase.from('vaccine_inventory').select('vaccine_name').eq('id', vaccRecord.vaccine_inventory_id).maybeSingle()
                            : { data: null, error: null };
                        if (scheduledInventoryError) throw scheduledInventoryError;
                        const vaccineMatch = vaccRecord?.notes?.match(/(?:\d+)(?:st|nd|rd|th) dose of (.+)/);
                        const notes = String(vaccRecord?.notes || '').toLowerCase();
                        const scheduledName = vaccineMatch?.[1]?.trim() || (
                            /tetanus|tdap|\btd\b/.test(notes) ? 'Tetanus Diphtheria (TD)' :
                            /influenza|\bflu\b/.test(notes) ? 'Influenza Vaccine' : null
                        );
                        const vaccineName = selectedVaccineName || scheduledInventory?.vaccine_name || scheduledName;
                        const inventoryItem = vaccineName
                            ? await resolveInventoryBatch('vaccine', vaccineName, selectedBrand, performingStationId)
                            : null;
                        if (!inventoryItem) throw new Error('This vaccine is not available in your assigned station inventory.');
                        const vaccineInvId = inventoryItem.id;

                        const updateData = {
                            vaccinated_date: form.date,
                            status: 'Completed',
                            station_ass: performingStationId,
                            vaccinated_by: currentUser,
                            remarks: form.remarks || null
                        };

                        if (vaccineInvId) {
                            updateData.vaccine_inventory_id = vaccineInvId;
                        }

                        const { error: updateError } = await supabase
                            .from('vaccinations')
                            .update(updateData)
                            .eq('id', scheduledId);
                        if (updateError) throw updateError;

                        await vaccinationService.decrementStationInventory({
                            itemType: 'vaccine',
                            inventoryItem,
                            stationId: performingStationId
                        });
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
                        const vaccInv = await resolveInventoryBatch('vaccine', vaccineName, selectedBrand, performingStationId);

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
                            station_ass: performingStationId,
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

                        await vaccinationService.decrementStationInventory({
                            itemType: 'vaccine',
                            inventoryItem: vaccInv,
                            stationId: performingStationId
                        });

                    }
                }

                // Manual entry route when no scheduled rows are checked
                if (selectedVaccineNames.length === 0 && selectedScheduledIds.length === 0) {
                    // Manual entry: try to find in inventory first, otherwise create without inventory
                    const vaccInv = await resolveInventoryBatch('vaccine', form.vaccine, form.brand || null, performingStationId);
                    const doseNumber = parseInt(form.dose.match(/\d+/)?.[0]) || 1;
                    const vaccinationRecord = {
                        newborn_id: patientId,
                        dose_number: doseNumber,
                        vaccinated_date: form.date,
                        scheduled_vaccination: form.date,
                        status: 'Completed',
                        station_ass: performingStationId,
                        created_by: currentUser,
                        vaccinated_by: currentUser,
                        assigned_staff: assignedStaff,
                        remarks: form.remarks || null
                    };

                    if (vaccInv) {
                        vaccinationRecord.vaccine_inventory_id = vaccInv.id;
                        const { error: insertError } = await supabase.from('vaccinations').insert([vaccinationRecord]);
                        if (insertError) throw insertError;

                        await vaccinationService.decrementStationInventory({
                            itemType: 'vaccine',
                            inventoryItem: vaccInv,
                            stationId: performingStationId
                        });
                    } else {
                        console.log(`⚠️ Vaccine not in inventory, creating manual record for: ${form.vaccine}`);
                        const { error: insertError } = await supabase.from('vaccinations').insert([vaccinationRecord]);
                        if (insertError) throw insertError;
                    }

                }
            } else {
                // Supplement handling
                const selectedBrand = selectedSupplementBrand === 'Generic / Standard' ? null : (selectedSupplementBrand || form.brand || null);

                // Find inventory item from loaded active inventory
                let suppInv = null;
                const matchingItem = activeSupplementItems.find(item => 
                    item.item_name?.trim().toLowerCase() === form.supplement.trim().toLowerCase() &&
                    (selectedBrand ? item.brand?.trim().toLowerCase() === selectedBrand.trim().toLowerCase() : true)
                );

                if (matchingItem) {
                    suppInv = {
                        id: matchingItem.id,
                        supplement_name: matchingItem.item_name,
                        brand: matchingItem.brand,
                        quantity: matchingItem.quantity
                    };
                }

                // Fallback to resolveInventoryBatch if not found in active inventory
                if (!suppInv) {
                    suppInv = await resolveInventoryBatch('supplement', form.supplement, selectedBrand, performingStationId);
                }

                if (!suppInv) {
                    throw new Error('This supplement is not available in your authorized station inventory.');
                }

                let targetPatientId = patientId;
                let notesText = form.remarks || null;

                // Handle newborn patient type
                if (form.patientType === 'Newborn') {
                    const { data: nb } = await supabase.from('newborns').select('mother_id, baby_name').eq('id', patientId).maybeSingle();
                    if (nb?.mother_id) {
                        targetPatientId = nb.mother_id;
                        notesText = `Administered to newborn: ${nb.baby_name || form.patientName}${form.remarks ? ' - ' + form.remarks : ''}`;
                    }
                }

                const supplementRecord = {
                    patient_id: targetPatientId,
                    dosage: form.dose,
                    start_date: form.date,
                    end_date: form.nextDue || form.date,
                    created_by: currentUser,
                    administered_by: currentUser,
                    station_ass: performingStationId,
                    supplement_inventory_id: suppInv.id
                };

                if (notesText) {
                    supplementRecord.notes = notesText;
                }

                // 1. Insert record first
                const { error: supplementError } = await supabase.from('supplements').insert([supplementRecord]);
                if (supplementError) throw supplementError;

                // 2. Decrement station inventory only after insert succeeds
                await vaccinationService.decrementStationInventory({
                    itemType: 'supplement',
                    inventoryItem: suppInv,
                    stationId: performingStationId
                });
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

    return createPortal(
        <div className="modal-backdrop" onClick={onClose}>
            <div className="vacc-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>
                            {mode === 'vaccine' ? (
                                <>
                                    <Syringe size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                    <span>Record Vaccination</span>
                                </>
                            ) : (
                                <>
                                    <Pill size={20} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--color-rose, #803035)' }} />
                                    <span>Record Supplement</span>
                                </>
                            )}
                        </h2>
                        <p>
                            {mode === 'vaccine'
                                ? 'Log a vaccine dose for a newborn.'
                                : 'Record supplement distribution for a mother or newborn.'}
                        </p>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close modal"><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-grid-2">
                        <div className="form-group">
                            <label>Patient Type <span className="req">*</span></label>
                            <select 
                                value={form.patientType} 
                                onChange={e => handlePatientTypeChange(e.target.value)}
                                aria-label="Patient Type"
                            >
                                <option value="Newborn">Newborn</option>
                                <option value="Mother">Mother</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Patient Name / ID <span className="req">*</span></label>
                            <div className="patient-search-wrapper">
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input 
                                        type="text" 
                                        placeholder={`Search ${form.patientType.toLowerCase()} name or ID...`}
                                        value={patientSearchInput} 
                                        onChange={handlePatientInputChange}
                                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                        style={{ width: '100%', paddingRight: isSearchingPatients || confirmedPatient ? '36px' : '12px' }}
                                        aria-label="Patient Name"
                                    />
                                    {isSearchingPatients && (
                                        <div style={{ position: 'absolute', right: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#9ca3af' }}>
                                            <Loader2 size={16} className="animate-spin" />
                                        </div>
                                    )}
                                    {!isSearchingPatients && confirmedPatient && (
                                        <div 
                                            title="Confirmed patient selection"
                                            style={{ position: 'absolute', right: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#10b981' }}
                                        >
                                            <CheckCircle2 size={16} />
                                        </div>
                                    )}
                                </div>
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="suggestions-dropdown">
                                        {suggestions.map((suggestion, idx) => (
                                            <div 
                                                key={suggestion.id || idx} 
                                                className="suggestion-item"
                                                onClick={() => handleSelectSuggestion(suggestion)}
                                            >
                                                <div className="suggestion-name">{suggestion.name}</div>
                                                <div className="suggestion-station">
                                                    <span style={{ fontWeight: 600 }}>
                                                        {suggestion.type === 'Newborn' ? formatNewbornId(suggestion.id) : formatMotherId(suggestion.id)}
                                                    </span>
                                                    <span> · </span>
                                                    {suggestion.type === 'Newborn' && suggestion.motherName && (
                                                        <span>Mother: {suggestion.motherName} · </span>
                                                    )}
                                                    {suggestion.station || 'No station assigned'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {mode === 'vaccine' ? (
                        <>
                            {!confirmedPatient ? (
                                <div className="vaccine-patient-prompt" style={{
                                    padding: '16px',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    border: '1px dashed #cbd5e1',
                                    textAlign: 'center',
                                    margin: '12px 0 16px',
                                    color: '#64748b',
                                    fontSize: '0.9rem'
                                }}>
                                    <p style={{ margin: 0, fontWeight: 500 }}>
                                        Select a patient to view scheduled and available vaccines.
                                    </p>
                                </div>
                            ) : isLoadingVaccines ? (
                                <div className="vaccine-loading-box" style={{
                                    padding: '24px',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    margin: '12px 0 16px',
                                    color: '#64748b',
                                    fontSize: '0.9rem'
                                }}>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Loading scheduled and available vaccines...</span>
                                </div>
                            ) : vaccineLoadError ? (
                                <div className="vaccine-error-box" style={{
                                    padding: '14px 16px',
                                    background: '#fef2f2',
                                    borderRadius: '8px',
                                    border: '1px solid #fecaca',
                                    margin: '12px 0 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px'
                                }}>
                                    <div style={{ color: '#b91c1c', fontSize: '0.875rem' }}>
                                        <strong>Failed to load vaccines:</strong> {vaccineLoadError}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => loadPatientVaccineData(confirmedPatient)}
                                        style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                    >
                                        <RefreshCw size={12} style={{ marginRight: '4px' }} /> Retry
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* 1. Pending Scheduled Vaccines */}
                                    <div className="pending-vaccines-section">
                                        <h3 style={{ marginBottom: '4px' }}>Pending Scheduled Vaccines</h3>
                                        <p className="pending-vaccines-note">
                                            Check any scheduled doses that were administered today to update their records.
                                        </p>
                                        {pendingVaccines.length > 0 ? (
                                            <div className="pending-vaccines-list">
                                                {pendingVaccines.map(v => {
                                                    const parts = v.vaccine.split(' - ');
                                                    const mainName = parts[0];
                                                    const desc = parts.length > 1 ? parts.slice(1).join(' - ') : '';
                                                    
                                                    return (
                                                        <label key={v.id} className={"pending-vaccine-card " + (selectedVaccines[v.id] ? 'selected' : '')}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!selectedVaccines[v.id]}
                                                                onChange={() => setSelectedVaccines(prev => ({ ...prev, [v.id]: !prev[v.id] }))}
                                                            />
                                                            <div className="pending-vaccine-details">
                                                                <div className="pending-vaccine-title">{mainName}</div>
                                                                <div className="pending-vaccine-desc">
                                                                    {desc ? desc + ' · ' : ''}Dose {v.dose_number}
                                                                </div>
                                                                <div className="pending-vaccine-date">
                                                                    Scheduled: {formatReadableDate(v.scheduled_vaccination) || v.scheduled_vaccination}
                                                                </div>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{
                                                padding: '12px 14px',
                                                background: '#f8fafc',
                                                borderRadius: '6px',
                                                border: '1px solid #e2e8f0',
                                                color: '#64748b',
                                                fontSize: '0.875rem',
                                                fontStyle: 'italic'
                                            }}>
                                                No pending scheduled vaccines for this {form.patientType.toLowerCase()}.
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Available Station Vaccines Selection */}
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>Search & Select Vaccines <span className="req">*</span></label>
                                        <input 
                                            type="text" 
                                            placeholder="Search vaccines available at patient's station..." 
                                            value={vaccineSearchQuery} 
                                            onChange={(e) => setVaccineSearchQuery(e.target.value)} 
                                            style={{ marginBottom: '10px', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        />
                                        {vaccineTypes.length > 0 ? (
                                            (() => {
                                                const filteredVaccines = vaccineTypes.filter(v =>
                                                    v.toLowerCase().includes(vaccineSearchQuery.toLowerCase())
                                                );
                                                if (filteredVaccines.length === 0) {
                                                    return (
                                                        <p style={{ color: '#666', fontStyle: 'italic', fontSize: '0.9rem', margin: '8px 0' }}>
                                                            No matching vaccines found for "{vaccineSearchQuery}".
                                                        </p>
                                                    );
                                                }
                                                return (
                                                    <div className="vaccine-checkbox-list">
                                                        {filteredVaccines.map(vaccine => (
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
                                                );
                                            })()
                                        ) : (
                                            <p style={{ color: '#666', fontStyle: 'italic', fontSize: '0.9rem', margin: '8px 0' }}>
                                                No eligible vaccines available at this patient's station inventory.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
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
                                    <SearchableSelect
                                        id="supplement-type-select"
                                        value={form.supplement}
                                        onChange={(val) => {
                                            updateForm('supplement', val);
                                            setSelectedSupplementBrand('');
                                            updateForm('brand', '');
                                        }}
                                        options={supplementTypeOptions}
                                        placeholder="Select Supplement"
                                        searchPlaceholder="Search supplement type or name..."
                                        loading={isLoadingSupplements}
                                        loadingText="Loading available supplements..."
                                        emptyText={supplementLoadError ? `Error: ${supplementLoadError}` : "No available supplements"}
                                        notFoundText="No matching supplements found"
                                        ariaLabel="Supplement Type"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Brand</label>
                                    <SearchableSelect
                                        id="supplement-brand-select"
                                        value={selectedSupplementBrand}
                                        onChange={(val) => {
                                            setSelectedSupplementBrand(val);
                                            updateForm('brand', val);
                                        }}
                                        options={brandOptions}
                                        placeholder={!form.supplement ? "Select a supplement first" : "Select Brand"}
                                        searchPlaceholder="Search brand..."
                                        disabled={!form.supplement}
                                        emptyText={!form.supplement ? "Please select a supplement first" : "No brands available for this supplement"}
                                        notFoundText="No matching brands found"
                                        ariaLabel="Brand"
                                    />
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
        </div>,
        document.body
    );
};

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
const Vaccinations = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { alert: customAlert } = useModal();
    const { hasAnyPermission } = useRolePermissions();
    const canRecordVaccine = hasAnyPermission([
        'vaccine.administer.own_station',
        'vaccine.administer.other_station',
    ]);
    const canDistributeSupplement = hasAnyPermission([
        'supplement.distribute.patient.own_station',
        'supplement.distribute.patient.other_station',
    ]);
    const canRecordItem = item => (
        ((item.itemTypes || []).includes('vaccine') && canRecordVaccine)
        || ((item.itemTypes || []).includes('supplement') && canDistributeSupplement)
    );
    const patientService = new PatientService();
    const babyService = new BabyService();

    const [availableStations, setAvailableStations] = useState([]);
    useEffect(() => {
        const fetchStations = async () => {
            try {
                const data = await patientService.getAllStations();
                setAvailableStations(data || []);
            } catch (err) {
                console.error('Error fetching stations:', err);
            }
        };
        fetchStations();
    }, []);

    const {
        assignedStation,
        isStationStaff,
        canViewOtherStations,
        availableStations: permittedStations,
        matchStation,
    } = useDefaultStation({
        permissionKey: ['vaccine.schedule.view.other_station', 'supplement.distribute.patient.other_station', 'patient.view.other_station'],
        allStations: availableStations,
        isArray: false
    });

    // State
    const [stats, setStats] = useState({
        patientsAdministered: 0,
        vaccinationsAdministered: 0,
        supplementsDistributed: 0,
        supplementsDistributedUnit: 'units',
        pendingVaccinations: 0
    });
    const [inventory, setInventory] = useState([]);
    const [vaccinationRecords, setVaccinationRecords] = useState([]);
    const [supplementRecords, setSupplementRecords] = useState([]);
    const [archivedPatientIds, setArchivedPatientIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activePopover, setActivePopover] = useState(null);
    const filterRowRef = useRef(null);
    useClickOutside(filterRowRef, () => setActivePopover(null));

    const [activeTab, setActiveTab] = useState('pending');    // 'pending' | 'missed' | 'administered'
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState(() => ({
        patientType: 'All',
        item: 'All Items',
        station: isStationStaff && assignedStation ? assignedStation : 'All'
    }));
    const userHasChangedStationRef = useRef(false);

    useEffect(() => {
        if (!userHasChangedStationRef.current && isStationStaff && assignedStation) {
            setFilters(prev => ({
                ...prev,
                station: prev.station !== 'All' ? prev.station : assignedStation
            }));
        }
    }, [isStationStaff, assignedStation]);

    const [showExportModal, setShowExportModal] = useState(false);
    const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'this_month' | 'this_year' | 'custom'
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [dateFilterError, setDateFilterError] = useState('');
    const dateFilterLabel = dateFilter === 'this_month' ? 'This Month' : dateFilter === 'this_year' ? 'This Year' : dateFilter === 'custom' ? 'Custom' : 'All';

    const defaultStationVal = (isStationStaff && !canViewOtherStations) ? (assignedStation || '__UNASSIGNED__') : 'All';
    const hasActiveFilters = filters.patientType !== 'All' || filters.item !== 'All Items' || (filters.station !== 'All' && filters.station !== defaultStationVal) || searchTerm !== '' || dateFilter !== 'all';

    const clearFilters = () => {
        const defStation = (isStationStaff && !canViewOtherStations) ? (assignedStation || '__UNASSIGNED__') : 'All';
        setFilters({ patientType: 'All', item: 'All Items', station: defStation });
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
                initialPatientType: 'Newborn',
                initialPatientName: location.state.patientName,
            });
            navigate(location.pathname, { replace: true, state: {} });
        } else if (location.state?.openRecordVaccination) {
            setRecordModal({ mode: 'vaccine' });
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate]);
    const [newbornVaccinationModal, setNewbornVaccinationModal] = useState(null);  // null | newborn object
    const [expirationSummaryModal, setExpirationSummaryModal] = useState(null);      // null | 'vaccine' | 'supplement'
    const [expandedRows, setExpandedRows] = useState({});
    const [expandedItemRows, setExpandedItemRows] = useState(new Set());
    const [sortField, setSortField] = useState('');
    const [sortAsc, setSortAsc] = useState(true);

    const toggleItemRowExpanded = (rowKey) => {
        setExpandedItemRows(prev => {
            const next = new Set(prev);
            if (next.has(rowKey)) {
                next.delete(rowKey);
            } else {
                next.add(rowKey);
            }
            return next;
        });
    };

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const { settings } = useSystemSettings();
    const itemsPerPage = settings?.tables?.rowsPerPage || 10;

    // Reset pagination and collapsible item states on tab, search, or filter changes
    useEffect(() => {
        setCurrentPage(1);
        setExpandedItemRows(new Set());
    }, [activeTab, searchTerm, filters, dateFilter, customDateFrom, customDateTo]);

    // Also reset collapsible rows when changing pages
    useEffect(() => {
        setExpandedItemRows(new Set());
    }, [currentPage]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [
                archivedIds,
                vaccinationResult,
                supplementResult,
                patientsResult,
                newbornsResult,
                staffResult,
                vaccineInvData,
                suppInvData
            ] = await Promise.all([
                patientService.getArchivedPatientIds(),
                supabase
                    .from('vaccinations')
                    .select(`
                        id,
                        patient_id,
                        newborn_id,
                        delivery_id,
                        vaccine_inventory_id,
                        dose_number,
                        status,
                        vaccinated_date,
                        scheduled_vaccination,
                        reschedule_reason,
                        vaccinated_by,
                        assigned_staff,
                        notes,
                        created_at,
                        created_by,
                        vaccine_inventory (vaccine_name, brand, unit, doses, batch, expiration_date)
                    `)
                    .or('patient_id.not.is.null,newborn_id.not.is.null')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('supplements')
                    .select('id, patient_id, supplement_inventory_id, dosage, start_date, end_date, created_by, administered_by, station_ass, notes, status')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('patient_basic_info')
                    .select('id, first_name, last_name, station_ass, stations:station_ass (station_name), province'),
                supabase
                    .from('newborns')
                    .select('id, baby_name, mother_id, created_at'),
                supabase
                    .from('staff_profiles')
                    .select('id, full_name'),
                inventoryService.getVaccineInventory(),
                inventoryService.getSupplementInventory()
            ]);

            const { data: vaccRecords, error: vaccError } = vaccinationResult;
            const { data: suppRecords, error: suppError } = supplementResult;
            const { data: allPatients, error: patientsError } = patientsResult;
            const { data: allNewborns, error: newbornsError } = newbornsResult;
            const { data: staff, error: staffError } = staffResult;
            if (vaccError) throw vaccError;
            if (suppError) throw suppError;
            if (patientsError) throw patientsError;
            if (newbornsError) throw newbornsError;
            if (staffError) throw staffError;

            setArchivedPatientIds(archivedIds);
            console.log('💉 Fetched vaccination records:', vaccRecords?.length || 0);

            const archivedNewbornIds = new Set(
                (allNewborns || [])
                    .filter((newborn) => archivedIds.has(newborn.mother_id))
                    .map((newborn) => newborn.id)
            );

            // Get maps for names
            const vaccineMap = new Map((vaccineInvData || []).map(v => [v.id, v.item_name || v.vaccine_name]));
            const suppMap = new Map((suppInvData || []).map(s => [s.id, s.item_name || s.supplement_name]));
            const suppUnitMap = new Map((suppInvData || []).map(s => [s.id, s.unit]));
            const staffMap = new Map((staff || []).map(s => [s.id, s.full_name]));
            
            const patientMap = new Map(allPatients?.map(p => [p.id, {
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                station: `${p.stations?.station_name || 'N/A'}, ${p.province || 'N/A'}`
            }]) || []);

            const newbornMap = new Map(allNewborns?.map(n => {
                const motherInfo = patientMap.get(n.mother_id);
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
                    if (record.newborn_id && !newbornMap.has(record.newborn_id)) {
                        console.warn('Filtering out record with invalid newborn_id:', record.newborn_id);
                        return false;
                    }
                    return true;
                })
                .map(record => {
                let patientName, station, type, patientId, birthDate = null;
                if (record.newborn_id) {
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
                    const motherInfo = patientMap.get(record.patient_id);
                    patientName = motherInfo?.name || 'Unknown Mother';
                    station = motherInfo?.station || 'Unknown';
                    type = 'Mother';
                    patientId = record.patient_id;
                }

                const vaccineName = record.vaccine_inventory?.vaccine_name || null;
                const scheduledVaccination = record.notes?.trim() || 'Scheduled vaccination';

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
                    vaccine: scheduledVaccination,
                    actualVaccine: record.vaccine_inventory || null,
                    scheduledVaccination,
                    dose,
                    date: vaccinationDate,
                    nextDue: scheduledDate,
                    expirationDate: expirationDate,
                    expirationStatus: expStatus.status,
                    expirationClass: expStatus.class,
                    staff: staffMap.get(record.created_by) || 'Unknown',
                    vaccinatedBy: staffMap.get(record.vaccinated_by) || staffMap.get(record.assigned_staff) || null,
                    notes: record.notes,
                    rescheduleReason: record.reschedule_reason || null,
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
                    supplement_inventory_id: record.supplement_inventory_id,
                    dose: record.dosage,
                    unit: suppUnitMap.get(record.supplement_inventory_id) || 'units',
                    date: record.start_date,
                    nextDue: record.end_date,
                    expirationDate: expirationDate,
                    expirationStatus: expStatus.status,
                    expirationClass: expStatus.class,
                    staff: staffMap.get(record.created_by) || 'Unknown',
                    administeredBy: staffMap.get(record.administered_by) || staffMap.get(record.created_by) || 'Unknown',
                    serviceStationId: record.station_ass || null,
                    notes: record.notes,
                    status: record.status
                };
            });

            setVaccinationRecords(transformedVaccRecords);
            setSupplementRecords(transformedSuppRecords);

            // Update stats


            // 1. Number of Patients Administered:
            // Count unique mothers and newborns who have received at least one recorded vaccine or supplement.
            // Do not double-count patients with multiple administrations.
            const uniqueAdministeredPatients = new Set();

            transformedVaccRecords.forEach(r => {
                const status = (r.status || '').toLowerCase();
                const isCompleted = status === 'completed' || status === 'administered' || Boolean(r.date);
                if (isCompleted) {
                    if (r.type === 'Newborn' && (r.newborn_id || r.patientId)) {
                        uniqueAdministeredPatients.add(`newborn_${r.newborn_id || r.patientId}`);
                    } else if (r.patientId) {
                        uniqueAdministeredPatients.add(`mother_${r.patientId}`);
                    }
                }
            });

            transformedSuppRecords.forEach(r => {
                const status = (r.status || '').toLowerCase();
                const isCancelled = status === 'cancelled';
                if (!isCancelled && r.patientId) {
                    uniqueAdministeredPatients.add(`mother_${r.patientId}`);
                }
            });

            const patientsAdministeredCount = uniqueAdministeredPatients.size;

            // 2. Vaccinations Administered:
            // Count all successfully recorded vaccine administrations for mothers and newborns.
            const vaccinationsAdministeredCount = transformedVaccRecords.filter(r => {
                const status = (r.status || '').toLowerCase();
                return status === 'completed' || status === 'administered' || Boolean(r.date);
            }).length;

            // 3. Supplements Distributed:
            // Display the total quantity of supplements actually distributed, using recorded quantities and their appropriate units.
            // Do not use current inventory stock as the distributed quantity.
            const completedSuppRecords = transformedSuppRecords.filter(r => (r.status || '').toLowerCase() !== 'cancelled');
            let supplementsDistributedCount = 0;
            const unitCounts = {};

            completedSuppRecords.forEach(r => {
                const qty = parseInt(r.dose?.toString().match(/\d+/)?.[0]) || 1;
                supplementsDistributedCount += qty;

                const unitMatch = r.dose?.toString().match(/\d+\s*([a-zA-Z]+)/);
                let unit = unitMatch ? unitMatch[1].toLowerCase() : (r.unit || 'units');
                if (unit === 'tablet') unit = 'tablets';
                if (unit === 'capsule') unit = 'capsules';
                if (unit === 'sachet') unit = 'sachets';
                if (unit === 'bottle') unit = 'bottles';
                if (unit === 'piece' || unit === 'pc') unit = 'pcs';
                unitCounts[unit] = (unitCounts[unit] || 0) + 1;
            });

            let distributedUnit = 'units';
            const unitEntries = Object.entries(unitCounts);
            if (unitEntries.length === 1) {
                distributedUnit = unitEntries[0][0];
            } else if (unitEntries.length > 1) {
                unitEntries.sort((a, b) => b[1] - a[1]);
                if (unitEntries[0][1] >= completedSuppRecords.length * 0.75) {
                    distributedUnit = unitEntries[0][0];
                } else {
                    distributedUnit = 'units';
                }
            }
            if (supplementsDistributedCount === 1 && distributedUnit.endsWith('s') && !['pcs'].includes(distributedUnit)) {
                distributedUnit = distributedUnit.slice(0, -1);
            }

            // 4. Pending Vaccinations:
            // Count outstanding scheduled vaccinations for mothers and newborns.
            // Include overdue vaccinations that remain pending.
            // Exclude completed and cancelled records.
            // Supplements must not be included.
            const pendingVaccinationsCount = transformedVaccRecords.filter(r => {
                const status = (r.status || '').toLowerCase();
                if (status === 'completed' || status === 'administered' || status === 'cancelled') {
                    return false;
                }
                if (r.date && status !== 'pending' && status !== 'scheduled' && status !== 'overdue' && status !== 'missed') {
                    return false;
                }
                return status === 'pending' || status === 'scheduled' || status === 'overdue' || status === 'missed' || !r.date;
            }).length;

            setStats({
                patientsAdministered: patientsAdministeredCount,
                vaccinationsAdministered: vaccinationsAdministeredCount,
                supplementsDistributed: supplementsDistributedCount,
                supplementsDistributedUnit: distributedUnit,
                pendingVaccinations: pendingVaccinationsCount
            });

            const inventory = [...(vaccineInvData || []).map(v => ({ ...v, type: 'vaccine', threshold: 20, status: v.quantity < 10 ? 'Critical' : v.quantity < 20 ? 'Low' : 'Sufficient' })), ...(suppInvData || []).map(s => ({ ...s, type: 'supplement', threshold: 50, status: s.quantity < 25 ? 'Critical' : s.quantity < 50 ? 'Low' : 'Sufficient' }))];
            setInventory(inventory);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            setError(error);
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

    // Derived dynamic stats respecting station filter
    const activeStats = useMemo(() => {
        const isMatchingStation = (r) => {
            if (!filters.station || filters.station === 'All') return true;
            return matchStation(r.station, filters.station);
        };

        const stationVacc = vaccinationRecords.filter(isMatchingStation);
        const stationSupp = supplementRecords.filter(isMatchingStation);

        const uniqueAdministeredPatients = new Set();
        stationVacc.forEach(r => {
            const status = (r.status || '').toLowerCase();
            const isCompleted = status === 'completed' || status === 'administered' || Boolean(r.date);
            if (isCompleted) {
                if (r.type === 'Newborn' && (r.newborn_id || r.patientId)) {
                    uniqueAdministeredPatients.add(`newborn_${r.newborn_id || r.patientId}`);
                } else if (r.patientId) {
                    uniqueAdministeredPatients.add(`mother_${r.patientId}`);
                }
            }
        });

        stationSupp.forEach(r => {
            const status = (r.status || '').toLowerCase();
            const isCancelled = status === 'cancelled';
            if (!isCancelled && r.patientId) {
                uniqueAdministeredPatients.add(`mother_${r.patientId}`);
            }
        });

        const vaccinationsAdministeredCount = stationVacc.filter(r => {
            const status = (r.status || '').toLowerCase();
            return status === 'completed' || status === 'administered' || Boolean(r.date);
        }).length;

        const completedSuppRecords = stationSupp.filter(r => (r.status || '').toLowerCase() !== 'cancelled');
        let supplementsDistributedCount = 0;
        const unitCounts = {};

        completedSuppRecords.forEach(r => {
            const qty = parseInt(r.dose?.toString().match(/\d+/)?.[0]) || 1;
            supplementsDistributedCount += qty;

            const unitMatch = r.dose?.toString().match(/\d+\s*([a-zA-Z]+)/);
            let unit = unitMatch ? unitMatch[1].toLowerCase() : (r.unit || 'units');
            if (unit === 'tablet') unit = 'tablets';
            if (unit === 'capsule') unit = 'capsules';
            if (unit === 'sachet') unit = 'sachets';
            if (unit === 'bottle') unit = 'bottles';
            if (unit === 'piece' || unit === 'pc') unit = 'pcs';
            unitCounts[unit] = (unitCounts[unit] || 0) + 1;
        });

        let distributedUnit = 'units';
        const unitEntries = Object.entries(unitCounts);
        if (unitEntries.length === 1) {
            distributedUnit = unitEntries[0][0];
        } else if (unitEntries.length > 1) {
            unitEntries.sort((a, b) => b[1] - a[1]);
            if (unitEntries[0][1] >= completedSuppRecords.length * 0.75) {
                distributedUnit = unitEntries[0][0];
            } else {
                distributedUnit = 'units';
            }
        }
        if (supplementsDistributedCount === 1 && distributedUnit.endsWith('s') && !['pcs'].includes(distributedUnit)) {
            distributedUnit = distributedUnit.slice(0, -1);
        }

        const pendingVaccinationsCount = stationVacc.filter(r => {
            const status = (r.status || '').toLowerCase();
            if (status === 'completed' || status === 'administered' || status === 'cancelled') {
                return false;
            }
            if (r.date && status !== 'pending' && status !== 'scheduled' && status !== 'overdue' && status !== 'missed') {
                return false;
            }
            return status === 'pending' || status === 'scheduled' || status === 'overdue' || status === 'missed' || !r.date;
        }).length;

        return {
            patientsAdministered: uniqueAdministeredPatients.size,
            vaccinationsAdministered: vaccinationsAdministeredCount,
            supplementsDistributed: supplementsDistributedCount,
            supplementsDistributedUnit: distributedUnit,
            pendingVaccinations: pendingVaccinationsCount
        };
    }, [vaccinationRecords, supplementRecords, filters.station, matchStation]);

    // Derived Stats for UI mapping - Exact requested order:
    // 1. Number of Patients Administered (Lavender, users icon)
    // 2. Vaccinations Administered (Soft Peach, syringe icon)
    // 3. Supplements Distributed (Soft Sage, pill icon)
    // 4. Pending Vaccinations (Dusty Rose, calendar-clock icon)
    const dynamicSummaryStats = [
        { 
            label: 'Number of Patients Administered', 
            value: activeStats.patientsAdministered, 
            color: 'lilac', 
            icon: Users, 
            onClick: () => {
                setActiveTab('administered');
                setFilters(prev => ({ ...prev, patientType: 'All', item: 'All Items' }));
                setSearchTerm('');
                setDateFilter('all');
                document.querySelector('.vacc-tabs')?.scrollIntoView({ behavior: 'smooth' });
            } 
        },
        { 
            label: 'Vaccinations Administered', 
            value: activeStats.vaccinationsAdministered, 
            color: 'orange', 
            icon: Syringe, 
            onClick: () => {
                setActiveTab('administered');
                setFilters(prev => ({ ...prev, patientType: 'All', item: 'Vaccines' }));
                setSearchTerm('');
                setDateFilter('all');
                document.querySelector('.vacc-tabs')?.scrollIntoView({ behavior: 'smooth' });
            } 
        },
        { 
            label: 'Supplements Distributed', 
            value: activeStats.supplementsDistributed, 
            unit: activeStats.supplementsDistributedUnit || 'units', 
            color: 'sage', 
            icon: Pill, 
            onClick: () => {
                setActiveTab('administered');
                setFilters(prev => ({ ...prev, patientType: 'All', item: 'Supplements' }));
                setSearchTerm('');
                setDateFilter('all');
                document.querySelector('.vacc-tabs')?.scrollIntoView({ behavior: 'smooth' });
            } 
        },
        { 
            label: 'Pending Vaccinations', 
            value: activeStats.pendingVaccinations, 
            color: 'rose', 
            icon: CalendarClock, 
            onClick: () => {
                setActiveTab('pending');
                setFilters(prev => ({ ...prev, patientType: 'All', item: 'Vaccines' }));
                setSearchTerm('');
                setDateFilter('all');
                document.querySelector('.vacc-tabs')?.scrollIntoView({ behavior: 'smooth' });
            } 
        },
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
            const readableId = r.type === 'Newborn' ? formatNewbornId(r.patientId) : formatMotherId(r.patientId);
            const matchSearch = (r.patientName || '').toLowerCase().includes(q) || 
                (r.patientId || '').toLowerCase().includes(q) || 
                readableId.toLowerCase().includes(q) || 
                (r.station || '').toLowerCase().includes(q);

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

            // Station filter
            const matchStationVal = filters.station === 'All' || matchStation(r.station, filters.station);

            return matchSearch && matchType && matchItem && matchTab && matchDate && matchStationVal;
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
            patientKey,
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

        if (filters.station && filters.station !== 'All') {
            toExport = toExport.filter(d => matchStation(d.station, filters.station));
        }
        
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
            'Patient ID': d.type === 'Newborn' ? formatNewbornId(d.patientId) : formatMotherId(d.patientId),
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
            const dateStr = new Date().toISOString().split('T')[0];
            const stationText = (filters.station && filters.station !== 'All' && filters.station !== 'All Stations')
                ? filters.station
                : 'All Stations';

            const head = exportData.length > 0 ? [Object.keys(exportData[0])] : [["Patient Name", "Patient ID", "Patient Type", "Item Type", "Item Name", "Dose", "Status", "Administered Date", "Scheduled Date", "Staff", "Station"]];
            const body = exportData.length > 0 ? exportData.map(obj => Object.values(obj)) : [];

            exportStandardStaffPdf({
                orientation: 'landscape',
                title: 'Distribution Records Report',
                period: reportPeriodText || 'All Dates',
                station: stationText,
                totalRecords: exportData.length,
                head: head,
                body: body,
                filename: `Distribution_Records_${dateStr}.pdf`
            });
        }
    };

    // Pagination logic
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = filteredRecords.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );


    const SortBtn = ({ field }) => (
        <button className="sort-btn" onClick={event => {
            event.stopPropagation();
            handleSort(field);
        }}>
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

    if (loading) {
        return (
            <StaffPageLoader 
                message="Loading distribution records..." 
                error={error} 
                onRetry={fetchData} 
            />
        );
    }

    return (
        <div className="vacc-page staff-page-ready">

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
                        <div 
                            key={s.label} 
                            className={`stat-card stat-card--${s.color} ${loading ? 'skeleton-loading' : ''} stat-card--clickable`}
                            onClick={s.onClick}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    s.onClick && s.onClick();
                                }
                            }}
                        >
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

                    {/* Station Filter */}
                    <div className="filter-dropdown-container">
                        <button 
                            className={`filter-btn ${filters.station !== 'All' ? 'active-filter' : ''}`}
                            onClick={() => {
                                if (isStationStaff && !canViewOtherStations) return;
                                setActivePopover(activePopover === 'station' ? null : 'station');
                            }}
                            title={isStationStaff && !canViewOtherStations ? "Station selection locked to your assigned station" : undefined}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: (isStationStaff && !canViewOtherStations) ? 'default' : 'pointer' }}
                        >
                            <MapPin size={14} className="filter-btn-icon" />
                            <span>Station: {filters.station}</span>
                            {(!isStationStaff || canViewOtherStations) && <ChevronDown size={14} className="filter-btn-icon" />}
                        </button>
                        {activePopover === 'station' && (
                            <div className="filter-popover">
                                <div className="popover-title">Station</div>
                                <div className="popover-options">
                                    <button
                                        className={`popover-opt-btn ${filters.station === 'All' ? 'selected' : ''}`}
                                        onClick={() => {
                                            userHasChangedStationRef.current = true;
                                            handleFilter('station', 'All');
                                            setActivePopover(null);
                                        }}
                                    >
                                        All Stations
                                    </button>
                                    {permittedStations.map(stationName => (
                                        <button
                                            key={stationName}
                                            className={`popover-opt-btn ${filters.station === stationName ? 'selected' : ''}`}
                                            onClick={() => {
                                                userHasChangedStationRef.current = true;
                                                handleFilter('station', stationName);
                                                setActivePopover(null);
                                            }}
                                        >
                                            {stationName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

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
                                                {(() => {
                                                    const rowKey = item.patientKey || `${item.type}:${item.patientId || item.id}`;
                                                    const isExpanded = expandedItemRows.has(rowKey);
                                                    const allRecords = item.records || [];
                                                    const hasMoreThanTwo = allRecords.length > 2;
                                                    const firstTwoRecords = allRecords.slice(0, 2);
                                                    const remainingRecords = allRecords.slice(2);
                                                    const remainingCount = remainingRecords.length;

                                                    return (
                                                        <div className="vacc-col-item-wrap">
                                                            <div className="vacc-items-list">
                                                                {firstTwoRecords.map((record, rIdx) => (
                                                                    <div key={record.id || `${rowKey}-first-${rIdx}`} className="vacc-item-entry">
                                                                        <strong>{record.scheduledVaccination || record.itemName}</strong>
                                                                        {isExpanded && record.scheduledDate && (
                                                                            <small style={{ display: 'block' }}>
                                                                                Scheduled: {formatReadableDate(record.scheduledDate)}
                                                                            </small>
                                                                        )}
                                                                        {record.actualVaccine && (
                                                                            <small style={{ display: 'block' }}>
                                                                                Actual: {record.actualVaccine.vaccine_name}
                                                                                {record.actualVaccine.brand ? ` · Brand: ${record.actualVaccine.brand}` : ''}
                                                                                {record.dose ? ` · ${record.dose}` : ''}
                                                                                {record.vaccinatedBy ? ` · By: ${record.vaccinatedBy}` : ''}
                                                                            </small>
                                                                        )}
                                                                        {record.rescheduleReason && <small style={{ display: 'block' }}>Reschedule reason: {record.rescheduleReason}</small>}
                                                                    </div>
                                                                ))}

                                                                {hasMoreThanTwo && isExpanded && (
                                                                    <div className="vacc-items-expandable">
                                                                        {remainingRecords.map((record, rIdx) => (
                                                                            <div key={record.id || `${rowKey}-rem-${rIdx}`} className="vacc-item-entry">
                                                                                <strong>{record.scheduledVaccination || record.itemName}</strong>
                                                                                {record.scheduledDate && (
                                                                                    <small style={{ display: 'block' }}>
                                                                                        Scheduled: {formatReadableDate(record.scheduledDate)}
                                                                                    </small>
                                                                                )}
                                                                                {record.actualVaccine && (
                                                                                    <small style={{ display: 'block' }}>
                                                                                        Actual: {record.actualVaccine.vaccine_name}
                                                                                        {record.actualVaccine.brand ? ` · Brand: ${record.actualVaccine.brand}` : ''}
                                                                                        {record.dose ? ` · ${record.dose}` : ''}
                                                                                        {record.vaccinatedBy ? ` · By: ${record.vaccinatedBy}` : ''}
                                                                                    </small>
                                                                                )}
                                                                                {record.rescheduleReason && <small style={{ display: 'block' }}>Reschedule reason: {record.rescheduleReason}</small>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {hasMoreThanTwo && (
                                                                <button
                                                                    type="button"
                                                                    className="vacc-show-more-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleItemRowExpanded(rowKey);
                                                                    }}
                                                                    aria-expanded={isExpanded}
                                                                >
                                                                    <span>{isExpanded ? 'Show Less' : `Show More (${remainingCount} more)`}</span>
                                                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                                </button>
                                                            )}

                                                            <span className={item.itemType === 'vaccine' ? 'badge-vaccine' : item.itemType === 'supplement' ? 'badge-supplement' : 'badge-vaccine'} style={{ alignSelf: 'flex-start' }}>
                                                                {item.itemType === 'mixed' ? 'Vaccines & Supplements' : item.itemType === 'vaccine' ? 'Vaccine' : 'Supplement'}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="col-date">
                                                {(() => {
                                                    const date = activeTab === 'administered'
                                                        ? item.administeredDate
                                                        : activeTab === 'missed'
                                                            ? (item.records || [])
                                                                .map(record => record.scheduledDate)
                                                                .filter(Boolean)
                                                                .sort()
                                                                .pop()
                                                            : item.scheduledDate;

                                                    return formatReadableDate(date) || (
                                                        <span className="not-yet">
                                                            {activeTab === 'administered' ? 'Unknown' : 'Not scheduled'}
                                                        </span>
                                                    );
                                                })()}
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
                                                    <ActionTooltip text="View Patient Profile">
                                                        <button className="action-btn view-btn" onClick={() => item.type === 'Mother' ? navigate(`/dashboard/patients/${item.patientId}`) : navigate(`/dashboard/patients/${item.records?.[0]?.motherId || item.patientId}`)}><User size={13} /></button>
                                                    </ActionTooltip>
                                                    {activeTab !== 'administered' && canRecordItem(item) && (
                                                        <ActionTooltip text="Record Vaccination or Supplement">
                                                            <button 
                                                                className="action-btn record-btn" 
                                                                onClick={() => setRecordModal({ mode: item.itemTypes.includes('vaccine') ? 'vaccine' : 'supplement', initialPatientType: item.type, initialPatientName: item.patientName })}
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                        </ActionTooltip>
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
            {expirationSummaryModal && createPortal(
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
                </div>,
                document.body
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
