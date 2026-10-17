import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import {
    ArrowLeft, Save, X, FileText, User, Activity,
    Calendar, HeartPulse, UploadCloud, AlertTriangle,
    CheckCircle2, XCircle, Loader2, Search, Info, History, Plus, Trash2, AlertCircle
} from 'lucide-react';
import '../../styles/pages/AddPatient.css';
import PatientService from "../../services/patientservice";
import InventoryService from '../../services/inventoryservice';
import { formatDate } from '../../utils/formatters';
import { formatMotherId } from '../../utils/displayIds';
import StaffPageLoader from '../../components/Common/StaffPageLoader';

const patientService = new PatientService();
const inventoryService = new InventoryService();
const TABS = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'pregnancy', label: 'Pregnancy', icon: HeartPulse },
    { id: 'medical', label: 'Medical', icon: Activity },
    { id: 'prenatal', label: 'Prenatal', icon: Calendar },
];
const MATERNAL_HEALTH_CATEGORIES = [
    {
        id: 'pre-existing',
        theme: 'sage',
        title: 'Pre-existing Medical Conditions',
        subtitle: 'Diagnosed before the current pregnancy',
        icon: Activity,
        otherKey: 'Other Pre-existing Condition',
        conditions: [
            'Chronic Hypertension',
            'Pre-existing Diabetes',
            'Heart Disease',
            'Asthma',
            'Other Pre-existing Condition'
        ]
    },
    {
        id: 'pregnancy-related',
        theme: 'amber',
        title: 'Pregnancy-Related Conditions',
        subtitle: 'Identified during current pregnancy',
        icon: HeartPulse,
        otherKey: 'Other Pregnancy-Related Condition',
        conditions: [
            'Gestational Hypertension',
            'Gestational Diabetes',
            'Preeclampsia',
            'Anemia During Pregnancy',
            'Other Pregnancy-Related Condition'
        ]
    },
    {
        id: 'obstetric-history',
        theme: 'lavender',
        title: 'Relevant Obstetric History',
        subtitle: 'Previous pregnancy & delivery history',
        icon: History,
        otherKey: 'Other Relevant Obstetric History',
        conditions: [
            'Previous C-section',
            'Previous Preterm Birth',
            'Previous Stillbirth',
            'Previous Miscarriage',
            'Other Relevant Obstetric History'
        ]
    }
];

// Normal ranges for vital signs
const VITAL_RANGES = {
    fhr: { min: 110, max: 160, label: 'Fetal Heart Rate', unit: 'bpm' },
    hgb: { min: 11, max: 13, label: 'Hemoglobin', unit: 'g/dL' },
    temp: { min: 35.1, max: 37.5, label: 'Temperature', unit: '°C' },
    pulse: { min: 60, max: 100, label: 'Pulse', unit: 'bpm' }
};

// Blood pressure ranges and classifications
const BP_RANGES = {
    normal: { sysMin: 90, sysMax: 120, diaMin: 60, diaMax: 80, label: 'Normal' },
    elevated: { sysMin: 121, sysMax: 129, diaMax: 79, label: 'Elevated' },
    high: { sysMin: 130, diaMin: 80, label: 'High (Hypertension)' },
    low: { sysMax: 89, diaMax: 59, label: 'Low (Hypotension)' }
};

/* ════════════════════════════
   STATION NAME FORMATTER
════════════════════════════ */
const formatStationName = (station) => {
    if (!station) return '';
    // Capitalize first letter of each word
    return station
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

/* ═══════════════════════════════════════════════════════
   PHILIPPINE LOCAL DATE & AGE VALIDATION HELPERS
═══════════════════════════════════════════════════════ */
const getPhilippineDate = () => {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const phDateStr = formatter.format(new Date());
        const [year, month, day] = phDateStr.split('-').map(Number);
        return { year, month, day, dateStr: phDateStr };
    } catch {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const pad = n => String(n).padStart(2, '0');
        return { year, month, day, dateStr: `${year}-${pad(month)}-${pad(day)}` };
    }
};

const calculatePhilippineAgeInfo = (dobString) => {
    if (!dobString) {
        return { age: null, error: null, advisory: null, tier: null, canSubmitNormally: false };
    }

    const trimmed = String(dobString).trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return {
            age: null,
            error: 'Please enter a valid date of birth.',
            advisory: null,
            tier: 'invalid',
            canSubmitNormally: false
        };
    }

    const birthYear = parseInt(match[1], 10);
    const birthMonth = parseInt(match[2], 10);
    const birthDay = parseInt(match[3], 10);

    const testDate = new Date(birthYear, birthMonth - 1, birthDay);
    if (
        testDate.getFullYear() !== birthYear ||
        testDate.getMonth() !== birthMonth - 1 ||
        testDate.getDate() !== birthDay
    ) {
        return {
            age: null,
            error: 'Please enter a valid date of birth.',
            advisory: null,
            tier: 'invalid',
            canSubmitNormally: false
        };
    }

    const { year: currentYear, month: currentMonth, day: currentDay, dateStr: phTodayStr } = getPhilippineDate();

    // Future date check
    if (trimmed > phTodayStr) {
        return {
            age: null,
            error: 'Date of birth cannot be in the future.',
            advisory: null,
            tier: 'future',
            canSubmitNormally: false
        };
    }

    if (birthYear < 1900) {
        return {
            age: null,
            error: 'Please enter a valid date of birth.',
            advisory: null,
            tier: 'invalid',
            canSubmitNormally: false
        };
    }

    let age = currentYear - birthYear;
    if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
        age--;
    }

    if (age < 0) {
        return {
            age: null,
            error: 'Date of birth cannot be in the future.',
            advisory: null,
            tier: 'future',
            canSubmitNormally: false
        };
    }

    // Ages 0-9: Prevent normal submission
    if (age <= 9) {
        return {
            age,
            error: null,
            advisory: "Registration cannot proceed through the standard process for this age. Please verify the patient's date of birth and immediately refer the case to an authorized healthcare professional for clinical assessment and appropriate safeguarding procedures, following CHO III protocols.",
            tier: 'under_10',
            canSubmitNormally: false
        };
    }

    // Ages 10-17: Non-blocking adolescent advisory
    if (age >= 10 && age <= 17) {
        return {
            age,
            error: null,
            advisory: 'Adolescent pregnancy: Please ensure appropriate clinical assessment and follow-up.',
            tier: 'adolescent',
            canSubmitNormally: true
        };
    }

    // Ages 50+: Clinical verification advisory without automatic rejection
    if (age >= 50) {
        return {
            age,
            error: null,
            advisory: 'Clinical verification advisory: Please confirm patient date of birth and ensure appropriate clinical assessment.',
            tier: 'advanced_age',
            canSubmitNormally: true
        };
    }

    // Ages 18-49: Proceed normally
    return {
        age,
        error: null,
        advisory: null,
        tier: 'adult',
        canSubmitNormally: true
    };
};

const AddPatient = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useContext(AuthContext);  
    const [activeTab, setActiveTab] = useState('personal');
    const [toast, setToast] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const saveInFlightRef = useRef(false);
    const [missingFields, setMissingFields] = useState([]);
    const [nameValidationErrors, setNameValidationErrors] = useState({});
    const [loadingStations, setLoadingStations] = useState(true);
    const [availableStations, setAvailableStations] = useState([]);
    const [midwifeList, setMidwifeList] = useState([]);
    const [doctorList, setDoctorList] = useState([]);
    const [schedulePreview, setSchedulePreview] = useState([]);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [newScheduleDate, setNewScheduleDate] = useState('');

    // New states for Registration Mode (UI only)
    const [registrationMode, setRegistrationMode] = useState('new'); // 'new' | 'existing'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedExistingPatient, setSelectedExistingPatient] = useState(null);
    const [emailSuggestions, setEmailSuggestions] = useState([]);

    const [suggestedMothers, setSuggestedMothers] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [suggestedSort, setSuggestedSort] = useState('recent'); // 'recent', 'oldest', 'az', 'za'
    const [suggestedStation, setSuggestedStation] = useState('All');
    const [suggestedPeriod, setSuggestedPeriod] = useState('All Time'); // 'All Time', 'This Year', 'Last Year'

    // Custom categorized health conditions states
    const [customConditions, setCustomConditions] = useState([]);
    const [newCustomCategory, setNewCustomCategory] = useState('');
    const [newCustomName, setNewCustomName] = useState('');
    const [customConditionError, setCustomConditionError] = useState('');
    const [inlineOtherInputs, setInlineOtherInputs] = useState({
        'Other Pre-existing Condition': '',
        'Other Pregnancy-Related Condition': '',
        'Other Relevant Obstetric History': ''
    });
    const customNameInputRef = useRef(null);
    const customCategorySelectRef = useRef(null);
    const clinicalNotesRef = useRef(null);

    const updateScheduledVisit = (index, date) => {
        if (!date) return;
        if (date < new Date().toISOString().slice(0, 10)) {
            setToast({ type: 'error', message: 'A scheduled prenatal visit cannot be moved into the past.' });
            return;
        }
        if (schedulePreview.some((visit, visitIndex) => visitIndex !== index && visit.date === date)) {
            setToast({ type: 'error', message: 'A prenatal visit is already scheduled on that date.' });
            return;
        }
        const week = patientService.calculateWeeksAtDate(formData.lmp, date);
        setSchedulePreview(current => current
            .map((visit, visitIndex) => visitIndex === index
                ? { ...visit, date, week, trimester: patientService.getTrimesterFromWeek(week) }
                : visit)
            .sort((left, right) => left.date.localeCompare(right.date))
            .map((visit, visitIndex) => ({ ...visit, visitNumber: visitIndex + 1 })));
    };

    const addScheduledVisit = () => {
        if (!newScheduleDate || !formData.lmp) return;
        const today = new Date().toISOString().slice(0, 10);
        if (newScheduleDate < today) {
            setToast({ type: 'error', message: 'A scheduled prenatal visit cannot be added in the past.' });
            return;
        }
        if (schedulePreview.some(visit => visit.date === newScheduleDate)) {
            setToast({ type: 'error', message: 'A prenatal visit is already scheduled on that date.' });
            return;
        }
        const week = patientService.calculateWeeksAtDate(formData.lmp, newScheduleDate);
        setSchedulePreview(current => [...current, {
            date: newScheduleDate,
            week,
            trimester: patientService.getTrimesterFromWeek(week),
            type: 'Routine Prenatal'
        }].sort((left, right) => left.date.localeCompare(right.date))
            .map((visit, index) => ({ ...visit, visitNumber: index + 1 })));
        setNewScheduleDate('');
    };

    const removeScheduledVisit = (index) => {
        setSchedulePreview(current => current
            .filter((_, visitIndex) => visitIndex !== index)
            .map((visit, visitIndex) => ({ ...visit, visitNumber: visitIndex + 1 })));
    };

    const fetchSuggestedMothers = async () => {
        setLoadingSuggestions(true);
        setFetchError('');
        try {
            const data = await patientService.getSuggestedReturningMothers();
            setSuggestedMothers(data);
        } catch(e) {
            console.error(e);
            setFetchError(e.message || 'An error occurred while fetching patients.');
        } finally {
            setLoadingSuggestions(false);
        }
    };

    useEffect(() => {
        if (registrationMode === 'existing' && suggestedMothers.length === 0) {
            fetchSuggestedMothers();
        }
    }, [registrationMode]);

    const hydrateExistingPatient = async (patient) => {
        if (!patient) return;

        setSelectedExistingPatient({
            id: patient.id,
            name: patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
            dob: patient.dob || patient.date_of_birth || '',
            station: patient.station || patient.stations?.station_name || patient.municipality || 'N/A'
        });

        // Load only patient_basic_info fields (personal information)
        // When adding a NEW pregnancy, populate gravida and para from the latest pregnancy_info record
        // This allows tracking cumulative pregnancy and delivery counts
        setFormData(prev => ({
            ...prev,
            // Personal info only
            firstName: patient.first_name || patient.firstName || prev.firstName,
            middleName: patient.middle_name || patient.middleName || prev.middleName,
            lastName: patient.last_name || patient.lastName || prev.lastName,
            suffix: patient.suffix || prev.suffix,
            dob: patient.date_of_birth || patient.dob || prev.dob,
            age: patient.age || prev.age,
            bloodType: patient.blood_type || patient.bloodtype || prev.bloodType,
            civilStatus: patient.civilStatus || patient.civil_status || prev.civilStatus,
            contactNumber: patient.phone || patient.contact_no || prev.contactNumber,
            address: patient.address || patient.house_no || prev.address,
            station: patient.station || patient.stations?.station_name || prev.station,
            municipality: patient.municipality || prev.municipality,
            province: patient.province || prev.province,
            emName: patient.emergencyContact?.name || patient.emergency_contact?.name || prev.emName,
            emRel: patient.emergencyContact?.relationship || patient.emergency_contact?.relationship || prev.emRel,
            emPhone: patient.emergencyContact?.phone || patient.emergency_contact?.phone || prev.emPhone,
            emAddress: patient.emergencyContact?.address || patient.emergency_contact?.address || prev.emAddress,
            // Populate gravida and para from the patient's latest pregnancy record
            // These are cumulative counts from obstetric history
            gravida: patient.gravida || prev.gravida || '',
            para: patient.para || prev.para || '',
            pregnancyStatus: 'Pregnant', // Always 'Pregnant' when adding new pregnancy to existing patient
            lmp: prev.lmp, // User will enter LMP for this new pregnancy
            edd: prev.edd,
        }));
    };

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            const results = await patientService.searchPatients(query.trim());
            setSearchResults(results.slice(0, 10));
        } catch (error) {
            console.error('Error searching patients:', error);
            setSearchResults([]);
        }
    };
    const [otherConditionRisk, setOtherConditionRisk] = useState('Low');
    const [retainedStaffList, setRetainedStaffList] = useState([]);
    const [vitalWarnings, setVitalWarnings] = useState({});
    const [bpWarning, setBpWarning] = useState(null);
    const [tempWarning, setTempWarning] = useState(null);
    const [sameAsPatientAddress, setSameAsPatientAddress] = useState(false);
    const [lmpError, setLmpError] = useState('');
    const [dobError, setDobError] = useState('');
    const [ageAdvisory, setAgeAdvisory] = useState(null);

    const getDisplayRole = (roleStr) => {
        if (!roleStr) return 'Loading...';
        const r = roleStr.toLowerCase();
        if (r.includes('staff')) return 'Station Staff';
        if (r.includes('cho')) return 'CHO Personnel';
        if (r.includes('admin')) return 'Admin';
        return roleStr;
    };

    const currentStaff = {
        id: user?.id || null,
        full_name: user ? `${user.email} (${getDisplayRole(user.role)})` : 'Loading...'
    };

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '', suffix: '',
        dob: '', age: '', bloodType: '', civilStatus: '', contactNumber: '', email: '',
        alternateContact: '', address: '', station: '', municipality: 'Dasmariñas',
        province: 'Cavite', philhealth: '', validId: '',
        pregnancyStatus: 'Pregnant', gravida: '', para: '',
        lmp: '', edd: '', gestationalAge: '', pregnancyType: 'Not Yet Determined',
        plannedDeliveryPlace: 'Hospital',
        conditions: [], otherConditions: '', clinicalNotes: '', riskLevel: 'None Reported',
        retained_staff: '',
        attending_staff: '',
        scheduleTemplate: 'Standard Prenatal Schedule',
        bp: '', weight: '', height: '', bmi: '', temp: '', pulse: '', respRate: '', fundalHeight: '',
        fetalMovement: '', presentation: '', testsDone: '', visitNotes: '',
        fhr: '', hgb: '',
        emName: '', emRel: '', emPhone: '', emAddress: '',
        // Postpartum fields
        babyName: '', birthDate: '', deliveryType: 'NSD', deliveryTime: '', deliveryMode: '',
        babyGender: 'Female', babyWeight: '', babyLength: '', headCircumference: '',
        apgar1: '', apgar5: '', babyCondition: 'Healthy',
    });

    useEffect(() => {
        // Automatic scroll to top when changing registration sections
        const scrollableMain = document.querySelector('.main-content');
        if (scrollableMain) {
            scrollableMain.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        const formContent = document.querySelector('.ap-content');
        if (formContent) {
            formContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeTab]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                setToast(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    useEffect(() => {
        const loadStations = async () => {
            try {
                const stations = await patientService.getAvailableStations();
                setAvailableStations(stations);
                console.log('✅ Available stations loaded:', stations);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingStations(false);
            }
        };
        loadStations();
    }, []);

    useEffect(() => {
        const patientId = location.state?.existingPatientId;
        if (!patientId) return;

        const fillPrefilledPatient = async () => {
            try {
                const patient = await patientService.getPatientById(patientId);
                if (!patient) return;

                setRegistrationMode('existing');
                await hydrateExistingPatient(patient);
            } catch (error) {
                console.error('Error loading prefilled patient:', error);
            }
        };

        fillPrefilledPatient();
    }, [location.state?.existingPatientId]);

    useEffect(() => {
        if (user) {
            const bhwName = `${user.email} (${getDisplayRole(user.role)})`;
            setFormData(prev => ({ ...prev, bhwAssigned: bhwName }));
            console.log('✅ BHW from AuthContext:', bhwName);
        }
    }, [user]);

    useEffect(() => {
        const filterStaff = async () => {
            if (!formData.station || loadingStations) {
                setDoctorList([]);
                setMidwifeList([]);
                setRetainedStaffList([]);
                setFormData(prev => ({ ...prev, retained_staff: '', attending_staff: '' }));
                return;
            }

            try {
                const { role, stationId, currentUser } = await patientService.getCurrentUserAccess();
                const selectedStationId = await patientService.getStationIdByName(formData.station);
                const staffAtStation = await patientService.getDoctorsByStation(formData.station);
                const staffList = (staffAtStation || []).filter(staff =>
                    role === 'admin' || (staff.station_ass === stationId && stationId === selectedStationId)
                );
                setDoctorList(staffList);
                setMidwifeList(staffList);
                setRetainedStaffList(staffList);
                setFormData(prev => ({
                    ...prev,
                    retained_staff: '',
                    attending_staff: ''
                }));
                console.log(`✅ Assignable staff loaded for ${formData.station}:`, { staffCount: staffList.length });
            } catch (err) {
                console.error(err);
            }
        };
        filterStaff();
    }, [formData.station, loadingStations, user]);

    useEffect(() => {
        if (formData.dob) {
            const info = calculatePhilippineAgeInfo(formData.dob);
            if (info.age !== null) {
                setFormData(prev => ({ ...prev, age: info.age.toString() }));
            } else {
                setFormData(prev => ({ ...prev, age: '' }));
            }

            if (info.error) {
                setDobError(info.error);
            } else {
                setDobError('');
            }

            if (info.advisory) {
                setAgeAdvisory({ message: info.advisory, tier: info.tier });
            } else {
                setAgeAdvisory(null);
            }
        } else {
            setFormData(prev => ({ ...prev, age: '' }));
            setDobError('');
            setAgeAdvisory(null);
        }
    }, [formData.dob]);

    useEffect(() => {
        if (formData.lmp) {
            const lmpDate = new Date(formData.lmp);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (lmpDate > today) {
                setLmpError('Last menstrual period date cannot be in the future.');
                setFormData(prev => ({ ...prev, edd: '', gestationalAge: '' }));
                return;
            } else {
                setLmpError('');
            }
            
            const eddDate = new Date(lmpDate);
            eddDate.setDate(eddDate.getDate() + 280);

            const diffTime = Math.abs(today - lmpDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const weeks = Math.floor(diffDays / 7);
            const days = diffDays % 7;

            setFormData(prev => ({
                ...prev,
                edd: eddDate.toISOString().split('T')[0],
                gestationalAge: `${weeks}w ${days}d`
            }));
        } else {
            setLmpError('');
            setFormData(prev => ({ ...prev, edd: '', gestationalAge: '' }));
        }
    }, [formData.lmp]);

    useEffect(() => {
        if (!formData.lmp || lmpError) {
            setSchedulePreview([]);
            return;
        }

        setLoadingSchedule(true);
        try {
            const preview = patientService.generateSemesterSchedule(formData.lmp);
            const normalizedPreview = preview
                .filter(v => v && v.date && !Number.isNaN(new Date(v.date).getTime()))
                .map(v => ({ ...v, date: new Date(v.date).toISOString().split('T')[0] }));
            const futurePreview = patientService.filterScheduleAfterToday(normalizedPreview);
            setSchedulePreview(futurePreview);
        } catch (err) {
            console.error('Error building schedule preview:', err);
            setSchedulePreview([]);
        } finally {
            setLoadingSchedule(false);
        }
    }, [formData.lmp]);

    useEffect(() => {
        // Documented health conditions check (Rule: Clinical notes do not auto-diagnose)
        const isMultipleBirth = formData.pregnancyType === 'Twins' || formData.pregnancyType === 'Multiple';
        const cleanConditions = (formData.conditions || []).filter(c => {
            if (!c) return false;
            const lower = c.trim().toLowerCase();
            return lower !== 'none' && lower !== 'none reported' && lower !== 'normal' && !lower.startsWith('other ');
        });
        const hasActiveCustomConditions = (customConditions || []).some(c => 
            c.category === 'Pre-existing Medical Conditions' || c.category === 'Pregnancy-Related Conditions'
        );
        const hasDocumented = isMultipleBirth || cleanConditions.length > 0 || hasActiveCustomConditions;

        setFormData(prev => ({ 
            ...prev, 
            hasHealthConditions: hasDocumented,
            riskLevel: hasDocumented ? 'With Health Conditions' : 'None Reported' 
        }));
    }, [formData.conditions, customConditions, formData.pregnancyType]);

    useEffect(() => {
        // Calculate BMI when weight and height change
        if (formData.weight && formData.height) {
            const weightKg = parseFloat(formData.weight);
            const heightCm = parseFloat(formData.height);
            if (weightKg > 0 && heightCm > 0) {
                const heightM = heightCm / 100;
                const bmi = (weightKg / (heightM * heightM)).toFixed(1);
                setFormData(prev => ({ ...prev, bmi: bmi.toString() }));
            }
        }
    }, [formData.weight, formData.height]);

    // Sync schedule template recommendation when risk level changes
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            scheduleTemplate: 'Standard Prenatal Schedule'
        }));
    }, [formData.riskLevel]);

    // Sync emergency contact address when "Same as Patient Address" is checked
    useEffect(() => {
        if (sameAsPatientAddress) {
            setFormData(prev => ({ ...prev, emAddress: prev.address }));
        }
    }, [sameAsPatientAddress, formData.address]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        const isText = type === 'text' || e.target.tagName === 'TEXTAREA';
        let finalValue = isText ? value.toUpperCase() : value;

        if (name === 'contactNumber' || name === 'emPhone') {
            // Remove non-numeric characters
            finalValue = finalValue.replace(/\D/g, '').slice(0, 11);
            
            // Auto-prefix "09" if user starts with "9" and the value is 10 digits
            if (finalValue.length === 10 && finalValue.startsWith('9')) {
                finalValue = '0' + finalValue;
            }
        }

        // Validate name fields (First Name, Middle Name, Last Name)
        if (name === 'firstName' || name === 'middleName' || name === 'lastName') {
            // Allow only letters, spaces, hyphens, and apostrophes
            const namePattern = /^[A-Za-z\s'-]*$/;
            
            if (finalValue && !namePattern.test(finalValue)) {
                // Contains invalid characters (numbers or special chars other than -, ', space)
                setNameValidationErrors(prev => ({
                    ...prev,
                    [name]: 'Name fields must contain letters only and cannot include numbers.'
                }));
                // Don't update formData if invalid
                return;
            } else {
                // Clear error if valid or empty
                setNameValidationErrors(prev => {
                    const updated = { ...prev };
                    delete updated[name];
                    return updated;
                });
            }
        }

        if (name === 'emName') {
            // Remove digits completely to prevent typing numbers
            finalValue = finalValue.replace(/\d/g, '');

            const namePattern = /^[A-Za-z\s'\.-]*$/;
            if (finalValue && !namePattern.test(finalValue)) {
                setNameValidationErrors(prev => ({
                    ...prev,
                    [name]: 'Please enter a valid contact person name. Numbers are not allowed.'
                }));
            } else {
                setNameValidationErrors(prev => {
                    const updated = { ...prev };
                    delete updated[name];
                    return updated;
                });
            }
        }

        // Validate email field
        if (name === 'email') {
            // Allow only valid email characters: letters, numbers, dot, underscore, hyphen, @
            // Disallow: comma, single quote, double quote, and other special characters
            const emailPattern = /^[a-zA-Z0-9._@-]*$/;
            
            if (finalValue && !emailPattern.test(finalValue)) {
                // Contains invalid characters
                setNameValidationErrors(prev => ({
                    ...prev,
                    [name]: 'Email contains invalid characters. Only letters, numbers, ., _, -, and @ are allowed.'
                }));
                // Don't update formData if invalid
                return;
            }

            // Show suggestions after @ is typed
            if (finalValue.includes('@')) {
                const parts = finalValue.split('@');
                const localPart = parts[0];
                const domainPart = parts.slice(1).join('@'); // In case of multiple @, though regex blocks it
                const providers = ['gmail.com', 'yahoo.com', 'outlook.com'];
                
                if (!domainPart || !providers.includes(domainPart)) {
                    const filtered = providers.filter(p => p.startsWith(domainPart));
                    if (filtered.length > 0 && localPart.length > 0) {
                        setEmailSuggestions(filtered.map(p => `${localPart}@${p}`));
                    } else {
                        setEmailSuggestions([]);
                    }
                } else {
                    setEmailSuggestions([]);
                }
            } else {
                setEmailSuggestions([]);
            }

            // Validate full email structure for warning
            const fullEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (finalValue && !fullEmailPattern.test(finalValue)) {
                setNameValidationErrors(prev => ({
                    ...prev,
                    [name]: 'Please enter a valid email address (e.g., name@gmail.com).'
                }));
            } else {
                setNameValidationErrors(prev => {
                    const updated = { ...prev };
                    delete updated[name];
                    return updated;
                });
            }
        }

        // Check for abnormal vital sign values
        if (VITAL_RANGES[name] && value) {
            const numValue = parseFloat(value);
            const range = VITAL_RANGES[name];
            
            if (name === 'temp') {
                // Special handling for temperature with classification
                let classification = null;
                
                if (numValue <= 35.0) {
                    classification = { type: 'low', label: 'Low (Hypothermia)' };
                } else if (numValue >= 37.6) {
                    classification = { type: 'high', label: 'High (Fever)' };
                } else {
                    classification = null; // Normal
                }
                
                setTempWarning(classification);
                
                // Also update vitalWarnings for consistency
                if (classification) {
                    setVitalWarnings(prev => ({
                        ...prev,
                        [name]: {
                            isAbnormal: true,
                            value: numValue,
                            range: `${range.min}-${range.max} ${range.unit}`
                        }
                    }));
                } else {
                    setVitalWarnings(prev => {
                        const updated = { ...prev };
                        delete updated[name];
                        return updated;
                    });
                }
            } else {
                // Default handling for other vitals
                if (numValue < range.min || numValue > range.max) {
                    setVitalWarnings(prev => ({
                        ...prev,
                        [name]: {
                            isAbnormal: true,
                            value: numValue,
                            range: `${range.min}-${range.max} ${range.unit}`
                        }
                    }));
                } else {
                    setVitalWarnings(prev => {
                        const updated = { ...prev };
                        delete updated[name];
                        return updated;
                    });
                }
            }
        } else if (name === 'temp' && !value) {
            setTempWarning(null);
        }

        // Clear and evaluate Date of Birth on change
        if (name === 'dob') {
            const info = calculatePhilippineAgeInfo(finalValue);
            if (info.error) {
                setDobError(info.error);
            } else {
                setDobError('');
            }
            if (info.advisory) {
                setAgeAdvisory({ message: info.advisory, tier: info.tier });
            } else {
                setAgeAdvisory(null);
            }
        }

        // Validate blood pressure format and classification
        if (name === 'bp' && value) {
            const bpMatch = value.match(/^(\d+)[/\s](\d+)$/);
            if (bpMatch) {
                const systolic = parseInt(bpMatch[1]);
                const diastolic = parseInt(bpMatch[2]);
                
                let classification = null;
                
                // Check BP classification
                if (systolic >= BP_RANGES.normal.sysMin && systolic <= BP_RANGES.normal.sysMax &&
                    diastolic >= BP_RANGES.normal.diaMin && diastolic <= BP_RANGES.normal.diaMax) {
                    classification = null; // Normal, no warning
                } else if (systolic >= BP_RANGES.elevated.sysMin && systolic <= BP_RANGES.elevated.sysMax &&
                           diastolic <= BP_RANGES.elevated.diaMax) {
                    classification = { type: 'elevated', label: BP_RANGES.elevated.label };
                } else if (systolic >= BP_RANGES.high.sysMin || diastolic >= BP_RANGES.high.diaMin) {
                    classification = { type: 'high', label: BP_RANGES.high.label };
                } else if (systolic <= BP_RANGES.low.sysMax || diastolic <= BP_RANGES.low.diaMax) {
                    classification = { type: 'low', label: BP_RANGES.low.label };
                }
                
                setBpWarning(classification);
            } else {
                setBpWarning(null);
            }
        } else if (name === 'bp' && !value) {
            setBpWarning(null);
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));

        if (missingFields.includes(name) || missingFields.includes(name + '-invalid')) {
            setMissingFields(prev => prev.filter(f => f !== name && f !== name + '-invalid'));
        }
    };

    const handleAddCustomCondition = () => {
        const trimmedCategory = (newCustomCategory || '').trim();
        const trimmedName = (newCustomName || '').trim();

        if (!trimmedCategory || !trimmedName) {
            setCustomConditionError('Please select a condition category and enter a condition name / description.');
            return;
        }

        // Check for duplicate custom conditions
        const isDuplicateCustom = customConditions.some(
            c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.category === trimmedCategory
        );
        const isDuplicateStandard = (formData.conditions || []).some(
            c => c.toLowerCase() === trimmedName.toLowerCase()
        );

        if (isDuplicateCustom || isDuplicateStandard) {
            setCustomConditionError('This condition has already been added.');
            return;
        }

        const newEntry = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            name: trimmedName,
            category: trimmedCategory
        };

        setCustomConditions(prev => [...prev, newEntry]);
        setNewCustomName('');
        setCustomConditionError('');

        // Automatically deselect "None Reported"
        setFormData(prev => ({
            ...prev,
            conditions: (prev.conditions || []).filter(c => c !== 'None' && c !== 'None Reported')
        }));

        setToast({
            type: 'success',
            message: `Added "${trimmedName}" under ${trimmedCategory}.`
        });
    };

    const handleRemoveCustomCondition = (id) => {
        setCustomConditions(prev => prev.filter(c => c.id !== id));
    };

    const handleAddInlineOther = (otherKey, categoryTitle) => {
        const val = (inlineOtherInputs[otherKey] || '').trim();
        if (!val) {
            setToast({ type: 'error', message: 'Please enter a condition description.' });
            return;
        }

        const isDuplicate = customConditions.some(
            c => c.name.toLowerCase() === val.toLowerCase() && c.category === categoryTitle
        );
        if (isDuplicate) {
            setToast({ type: 'error', message: `"${val}" has already been documented.` });
            return;
        }

        const newEntry = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            name: val,
            category: categoryTitle
        };

        setCustomConditions(prev => [...prev, newEntry]);
        setInlineOtherInputs(prev => ({ ...prev, [otherKey]: '' }));

        // Automatically deselect "None Reported"
        setFormData(prev => ({
            ...prev,
            conditions: (prev.conditions || []).filter(c => c !== 'None' && c !== 'None Reported')
        }));

        setToast({
            type: 'success',
            message: `Added "${val}" under ${categoryTitle}.`
        });
    };

    const handleDocumentFromNote = () => {
        let selectedText = '';
        if (clinicalNotesRef.current) {
            const start = clinicalNotesRef.current.selectionStart;
            const end = clinicalNotesRef.current.selectionEnd;
            if (start !== end) {
                selectedText = clinicalNotesRef.current.value.substring(start, end).trim();
            }
        }

        if (selectedText) {
            setNewCustomName(selectedText);
        }

        if (customCategorySelectRef.current) {
            customCategorySelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            customCategorySelectRef.current.focus();
        }

        setToast({
            type: 'info',
            message: selectedText 
                ? `Condition name "${selectedText}" populated. Please select a category to add it.`
                : 'Select a category and specify the condition name to document it.'
        });
    };

    const handleCheckbox = (conditionName) => {
        const isNone = conditionName === 'None Reported' || conditionName === 'None';
        
        if (isNone) {
            const current = formData.conditions || [];
            if (current.includes('None Reported') || current.includes('None')) {
                setFormData(prev => ({ ...prev, conditions: [] }));
                return;
            }

            const hasActiveConditions = current.some(c => c !== 'None' && c !== 'None Reported') || customConditions.length > 0;
            if (hasActiveConditions) {
                const confirmed = window.confirm(
                    "Selecting 'None Reported' will clear all currently selected and custom health conditions. Do you want to proceed?"
                );
                if (!confirmed) return;
            }

            setCustomConditions([]);
            setInlineOtherInputs({
                'Other Pre-existing Condition': '',
                'Other Pregnancy-Related Condition': '',
                'Other Relevant Obstetric History': ''
            });
            setFormData(prev => ({ ...prev, conditions: ['None Reported'] }));
            return;
        }

        // Toggling regular condition or "Other ..."
        setFormData(prev => {
            const current = [...(prev.conditions || [])];
            if (current.includes(conditionName)) {
                return { ...prev, conditions: current.filter(c => c !== conditionName) };
            } else {
                const updated = current.filter(c => c !== 'None' && c !== 'None Reported');
                return { ...prev, conditions: [...updated, conditionName] };
            }
        });

        // Auto-assign corresponding category in custom builder if "Other ..." checkbox was checked
        if (conditionName === 'Other Pre-existing Condition') {
            setNewCustomCategory('Pre-existing Medical Conditions');
        } else if (conditionName === 'Other Pregnancy-Related Condition') {
            setNewCustomCategory('Pregnancy-Related Conditions');
        } else if (conditionName === 'Other Relevant Obstetric History') {
            setNewCustomCategory('Relevant Obstetric History');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving || saveInFlightRef.current || !user?.id) return;

        // Validate name fields before submission
        const namePattern = /^[A-Za-z\s'-]*$/;
        const nameErrors = {};
        
        if (formData.firstName && !namePattern.test(formData.firstName)) {
            nameErrors.firstName = 'Name fields must contain letters only and cannot include numbers.';
        }
        if (formData.middleName && !namePattern.test(formData.middleName)) {
            nameErrors.middleName = 'Name fields must contain letters only and cannot include numbers.';
        }
        if (formData.lastName && !namePattern.test(formData.lastName)) {
            nameErrors.lastName = 'Name fields must contain letters only and cannot include numbers.';
        }

        const emNamePattern = /^[A-Za-z\s'\.-]*$/;
        if (formData.emName && !emNamePattern.test(formData.emName)) {
            nameErrors.emName = 'Please enter a valid contact person name. Numbers are not allowed.';
        }
        
        if (Object.keys(nameErrors).length > 0) {
            setNameValidationErrors(nameErrors);
            setToast({ type: 'error', message: 'Please fix the validation errors before saving.' });
            return;
        }
        
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setNameValidationErrors(prev => ({ ...prev, email: 'Please enter a valid email address (e.g., name@gmail.com).' }));
            setToast({ type: 'error', message: 'Please fix the validation errors before saving.' });
            return;
        }

        const isExistingPatientMode = registrationMode === 'existing' || !!selectedExistingPatient;
        const patientIdForPregnancy = selectedExistingPatient?.id || location.state?.existingPatientId || null;

        if (isExistingPatientMode && !patientIdForPregnancy) {
            setToast({ type: 'error', message: 'Please select an existing patient before saving the new pregnancy.' });
            return;
        }

        // Validate Date of Birth and Age according to Philippine local date & clinical guidelines
        if (!isExistingPatientMode || formData.dob) {
            if (!formData.dob) {
                setMissingFields(prev => [...new Set([...prev, 'dob'])]);
                setDobError('Date of birth is required.');
                setToast({ type: 'error', message: 'Date of birth is required.' });
                setIsSaving(false);
                setActiveTab('personal');
                return;
            }

            const ageInfo = calculatePhilippineAgeInfo(formData.dob);
            if (ageInfo.error && (ageInfo.tier === 'future' || ageInfo.tier === 'invalid')) {
                setMissingFields(prev => [...new Set([...prev, 'dob-invalid'])]);
                setDobError(ageInfo.error);
                setToast({ type: 'error', message: ageInfo.error });
                setIsSaving(false);
                setActiveTab('personal');
                return;
            }

            if (ageInfo.tier === 'under_10') {
                setMissingFields(prev => [...new Set([...prev, 'dob-underage'])]);
                setToast({
                    type: 'error',
                    message: "Registration cannot proceed through the standard process for this age. Please verify the patient's date of birth and immediately refer the case to an authorized healthcare professional for clinical assessment and appropriate safeguarding procedures, following CHO III protocols."
                });
                setIsSaving(false);
                setActiveTab('personal');
                return;
            }
        }

        // Validate EDD is not in the past for pregnant patients
        if (formData.pregnancyStatus === 'Pregnant' && formData.edd) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to start of day for fair comparison
            const eddDate = new Date(formData.edd);
            
            if (eddDate < today) {
                setToast({ 
                    type: 'error', 
                    message: `Cannot register patient with past due date. EDD (${formatDate(eddDate)}) is before today (${formatDate(today)}).` 
                });
                return;
            }
        }

        const requiredPersonal = [
            'contactNumber',
            'address',
            'station',
            ...(isExistingPatientMode ? [] : ['firstName', 'lastName', 'dob', 'email'])
        ];

        const requiredEmergency = isExistingPatientMode
            ? []
            : (sameAsPatientAddress
                ? ['emName', 'emRel', 'emPhone']
                : ['emName', 'emRel', 'emPhone', 'emAddress']);

        let requiredPregnancy = ['gravida', 'para', 'lmp'];

        const requiredVitals = ['weight', 'height', 'bp', 'temp', 'pulse'];

        const isEmptyValue = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

        const missing = [];
        const checkFields = (fields) => fields.forEach(f => {
            const value = formData[f];
            if (isEmptyValue(value)) {
                missing.push(f);
                return;
            }
            if ((f === 'contactNumber' || f === 'emPhone') && typeof value === 'string') {
                if (value.length !== 11 || !value.startsWith('09')) {
                    missing.push(f + '-invalid');
                }
            }
        });
        
        checkFields(requiredPersonal);
        checkFields(requiredPregnancy);
        // Medical section has no explicitly required fields
        checkFields(requiredVitals);
        checkFields(requiredEmergency);

        if (missing.length > 0) {
            setMissingFields(missing);
            setToast({ type: 'error', message: 'Please complete all required fields before saving.' });
            setIsSaving(false);
            
            const firstMissing = missing[0].replace('-invalid', '');
            
            let targetTab = 'personal';
            if (requiredPersonal.includes(firstMissing)) targetTab = 'personal';
            else if (requiredPregnancy.includes(firstMissing)) targetTab = 'pregnancy';
            else if (requiredVitals.includes(firstMissing) || requiredEmergency.includes(firstMissing)) targetTab = 'prenatal';
            
            setActiveTab(targetTab);
            
            setTimeout(() => {
                const fieldEl = document.querySelector(`[name="${firstMissing}"]`);
                if (fieldEl) {
                    fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    fieldEl.focus({ preventScroll: true });
                }
            }, 100);
            
            return;
        }

        saveInFlightRef.current = true;
        setIsSaving(true);

        const today = new Date();
        const todayDateOnly = today.toISOString().split('T')[0];
        const upcomingVisit = (schedulePreview || []).find((v) => {
            const visitDate = new Date(v.date);
            return !Number.isNaN(visitDate.getTime()) && visitDate >= today;
        });

        const autoFirstVisitDate = upcomingVisit
            ? upcomingVisit.date
            : todayDateOnly;

        const filteredSchedulePreview = patientService.filterScheduleAfterToday(schedulePreview);

        // Clinical risk factors: Age alone does not auto-diagnose high/low risk or medical conditions (Rule 7)
        const standardConditions = (formData.conditions || []).filter(c => 
            c !== 'None' && c !== 'None Reported' && !c.startsWith('Other ')
        );
        const customConditionStrings = (customConditions || []).map(cc => `${cc.name.trim()} [${cc.category}]`);
        const riskFactors = [
            ...standardConditions,
            ...customConditionStrings,
            ...(formData.pregnancyType === 'Twins' || formData.pregnancyType === 'Multiple' ? [`${formData.pregnancyType} Pregnancy`] : []),
        ].filter(Boolean);

        if (riskFactors.length === 0 && (formData.conditions || []).includes('None Reported')) {
            riskFactors.push('None');
        }

        const bmiCategory = patientService.calculateBMICategory(formData.weight, formData.height);
        if (bmiCategory && patientService.isBMIHighRisk(bmiCategory)) {
            riskFactors.push(`${bmiCategory} BMI`);
        }

        // Add temperature-based risks
        if (formData.temp) {
            const temp = parseFloat(formData.temp);
            if (!isNaN(temp)) {
                if (temp < 35.1) {
                    riskFactors.push('Hypothermia');
                } else if (temp > 37.5) {
                    riskFactors.push('Fever');
                }
            }
        }

        const categorizedConditionsList = [
            ...standardConditions.map(c => patientService.parseCategorizedCondition(c)),
            ...(customConditions || []).map(cc => ({ name: cc.name.trim(), category: cc.category }))
        ].filter(Boolean);

        const patientData = {
            ...formData,
            conditions: [...standardConditions, ...customConditionStrings],
            customConditions: customConditions || [],
            categorizedConditions: categorizedConditionsList,
            clinicalNotes: formData.clinicalNotes || formData.visitNotes || '',
            firstVisitDate: autoFirstVisitDate,
            schedulePreview: filteredSchedulePreview,
            riskFactors: riskFactors.join(', '),
        };

        try {
            if (isExistingPatientMode && patientIdForPregnancy) {
                const updatedPatient = await patientService.addExistingPregnancy(patientIdForPregnancy, patientData, user.id);
                setToast({
                    type: 'success',
                    message: `✅ New pregnancy saved for ${updatedPatient?.name || `${formData.firstName} ${formData.lastName}`}. Prenatal schedule was generated.`
                });
                navigate(`/dashboard/patients/${patientIdForPregnancy}`, { replace: true });
                return;
            }

            console.log('📤 Passing to PatientService.addPatient:', patientData);
            const newPatient = await patientService.addPatient(patientData);
    
            console.log('🎉 Patient created:', newPatient.id, `${newPatient.first_name || formData.firstName} ${newPatient.last_name || formData.lastName}`);
    
            const profileId = newPatient?.id || newPatient?.patient_id || newPatient?.user?.id;

            setToast({ 
                type: 'success', 
                message: `✅ Patient saved successfully!
                👤 ${newPatient.first_name || formData.firstName} ${newPatient.last_name || formData.lastName}
                📅 Semester visits auto-scheduled
                🏘️ ${newPatient.barangay || formData.station}` 
            });
    
            if (profileId) {
                navigate(`/dashboard/patients/${profileId}`, { replace: true });
            } else {
                navigate('/dashboard/patients', { replace: true });
            }
        } catch (err) {
            console.error('💥 Save failed:', err);
            setToast({ type: 'error', message: `Save failed: ${err.message}` });
        } finally {
            saveInFlightRef.current = false;
            setIsSaving(false);
        }
    };

    const activeTabs = TABS.filter(tab => {
        if (formData.pregnancyStatus === 'Postpartum' && tab.id === 'prenatal') {
            return false;
        }
        return true;
    });
    const currentTabIndex = activeTabs.findIndex(t => t.id === activeTab);
    const isFirstTab = currentTabIndex === 0;
    const isLastTab = currentTabIndex === activeTabs.length - 1;

    const handleNext = () => {
        const isExistingPatientMode = registrationMode === 'existing' || !!selectedExistingPatient;
        const missing = [];
        const isEmptyValue = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
        
        const checkFields = (fields) => fields.forEach(f => {
            const value = formData[f];
            if (isEmptyValue(value)) {
                missing.push(f);
                return;
            }
            if ((f === 'contactNumber' || f === 'emPhone') && typeof value === 'string') {
                if (value.length !== 11 || !value.startsWith('09')) {
                    missing.push(f + '-invalid');
                }
            }
        });

        if (activeTab === 'personal') {
            const requiredPersonal = [
                'contactNumber',
                'address',
                'station',
                ...(isExistingPatientMode ? [] : ['firstName', 'lastName', 'dob', 'email'])
            ];
            const requiredEmergency = isExistingPatientMode
                ? []
                : (sameAsPatientAddress
                    ? ['emName', 'emRel', 'emPhone']
                    : ['emName', 'emRel', 'emPhone', 'emAddress']);
            checkFields(requiredPersonal);
            checkFields(requiredEmergency);

            if (!isExistingPatientMode) {
                if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                    missing.push('email-invalid');
                    setNameValidationErrors(prev => ({ ...prev, email: 'Please enter a valid email address (e.g., name@gmail.com).' }));
                }
                const namePattern = /^[A-Za-z\s'-]*$/;
                if (formData.firstName && !namePattern.test(formData.firstName)) missing.push('firstName-invalid');
                if (formData.middleName && !namePattern.test(formData.middleName)) missing.push('middleName-invalid');
                if (formData.lastName && !namePattern.test(formData.lastName)) missing.push('lastName-invalid');
            }

            // Validate Date of Birth on Personal tab progression
            if (!isExistingPatientMode || formData.dob) {
                if (!formData.dob) {
                    missing.push('dob');
                    setDobError('Date of birth is required.');
                    setToast({ type: 'error', message: 'Date of birth is required.' });
                } else {
                    const ageInfo = calculatePhilippineAgeInfo(formData.dob);
                    if (ageInfo.error && (ageInfo.tier === 'future' || ageInfo.tier === 'invalid')) {
                        missing.push('dob-invalid');
                        setDobError(ageInfo.error);
                        setToast({ type: 'error', message: ageInfo.error });
                    } else if (ageInfo.tier === 'under_10') {
                        missing.push('dob-underage');
                        setToast({
                            type: 'error',
                            message: "Registration cannot proceed through the standard process for this age. Please verify the patient's date of birth and immediately refer the case to an authorized healthcare professional for clinical assessment and appropriate safeguarding procedures, following CHO III protocols."
                        });
                    }
                }
            }
        } else if (activeTab === 'pregnancy') {
            const requiredPregnancy = ['gravida', 'para', 'lmp'];
            checkFields(requiredPregnancy);
            
            if (lmpError) {
                missing.push('lmp-invalid');
                setToast({ type: 'error', message: lmpError });
            }

            if (formData.pregnancyStatus === 'Postpartum') checkFields(['attending_staff']);
            
            if (formData.pregnancyStatus === 'Pregnant' && formData.edd) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const eddDate = new Date(formData.edd);
                if (eddDate < today) {
                    missing.push('edd-invalid');
                    setToast({ type: 'error', message: `Cannot register patient with past due date.` });
                }
            }
        } else if (activeTab === 'medical') {
            // No strict required fields in medical
        } else if (activeTab === 'prenatal') {
            const requiredVitals = ['weight', 'height', 'bp', 'temp', 'pulse'];
            checkFields(requiredVitals);
        }

        if (missing.length > 0) {
            setMissingFields(prev => [...new Set([...prev, ...missing])]);
            setToast({ type: 'error', message: 'Please complete all required fields in this section.' });
            
            setTimeout(() => {
                const firstMissing = missing[0].replace('-invalid', '');
                const fieldEl = document.querySelector(`[name="${firstMissing}"]`);
                if (fieldEl) {
                    fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    fieldEl.focus({ preventScroll: true });
                }
            }, 100);
            return;
        }

        if (!isLastTab) {
            setActiveTab(activeTabs[currentTabIndex + 1].id);
            window.scrollTo(0, 0);
        }
    };

    const filteredSuggestedMothers = useMemo(() => {
        let result = [...suggestedMothers];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p => 
                p.name.toLowerCase().includes(query) || 
                (p.id && p.id.toString().includes(query))
            );
        }

        if (suggestedStation !== 'All') {
            result = result.filter(p => p.station === suggestedStation);
        }

        if (suggestedPeriod !== 'All Time') {
            const thisYear = new Date().getFullYear();
            result = result.filter(p => {
                if (!p.lastDelivery) return false;
                const dYear = new Date(p.lastDelivery).getFullYear();
                if (suggestedPeriod === 'This Year') return dYear === thisYear;
                if (suggestedPeriod === 'Last Year') return dYear === thisYear - 1;
                return true;
            });
        }

        result.sort((a, b) => {
            if (suggestedSort === 'recent') {
                return new Date(b.lastDelivery || 0) - new Date(a.lastDelivery || 0);
            } else if (suggestedSort === 'oldest') {
                return new Date(a.lastDelivery || 0) - new Date(b.lastDelivery || 0);
            } else if (suggestedSort === 'az') {
                return a.name.localeCompare(b.name);
            } else if (suggestedSort === 'za') {
                return b.name.localeCompare(a.name);
            }
            return 0;
        });

        return result;
    }, [suggestedMothers, searchQuery, suggestedStation, suggestedPeriod, suggestedSort]);

    if (loadingStations) {
        return (
            <StaffPageLoader 
                message="Loading registration form..." 
            />
        );
    }

    return (
        <div className="add-patient-page staff-page-ready">

            {toast && (
                <div className={`toast toast--${toast.type}`}>
                    <span>{toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {toast.message}</span>
                    <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
                </div>
            )}

            <div style={{ backgroundColor: 'var(--color-primary, #b9818a)', color: 'white', padding: '16px 24px', borderRadius: '12px', marginBottom: '16px' }}>
                <button 
                    onClick={() => navigate(-1)} 
                    style={{ 
                        marginBottom: '12px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.9)',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '0.85rem'
                    }}
                >
                    <ArrowLeft size={16} /> Back to Patient List
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: '1.65rem', margin: 0, fontWeight: 600 }}>
                        {formData.pregnancyStatus === 'Postpartum' 
                            ? 'Register Postpartum Patient' 
                            : 'Register New Pregnancy'}
                    </h1>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>

                        <div style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                        }}>
                            BHW: {currentStaff.full_name}
                        </div>
                    </div>
                </div>
            </div>

            <div className="ap-container">
                <aside className="ap-sidebar">
                    {activeTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`ap-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => {
                                if (activeTab === 'personal' && tab.id !== 'personal' && ageAdvisory?.tier === 'under_10') {
                                    setToast({
                                        type: 'error',
                                        message: "Registration cannot proceed through the standard process for this age. Please verify the patient's date of birth and immediately refer the case to an authorized healthcare professional for clinical assessment and appropriate safeguarding procedures, following CHO III protocols."
                                    });
                                    return;
                                }
                                setActiveTab(tab.id);
                            }}
                            type="button"
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </aside>

                <form onSubmit={handleSave} className="ap-form">
                    <div className="ap-content">
                        {activeTab !== 'personal' && (
                            <button
                                type="button"
                                onClick={() => {
                                    window.scrollTo(0, 0);
                                    setActiveTab(activeTabs[currentTabIndex - 1].id);
                                }}
                                className="btn btn-outline"
                                style={{
                                    marginBottom: '16px',
                                    padding: '6px 12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '13px',
                                    borderRadius: '8px',
                                    background: '#ffffff',
                                    color: 'var(--color-primary, #6B5B95)',
                                    borderColor: '#eef0f4'
                                }}
                            >
                                <ArrowLeft size={14} /> Back
                            </button>
                        )}
                        
                        {/* PERSONAL TAB */}
                        {activeTab === 'personal' && (
                            <div className="ap-section animate-fade">
                            <h2 className="section-title">Personal Information</h2>
                            
                            <div className="registration-mode-toggle" style={{ display: 'flex', gap: '16px', marginBottom: '24px', padding: '4px', backgroundColor: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                <button type="button" className={`btn ${registrationMode === 'new' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, border: registrationMode === 'new' ? 'none' : 'transparent', boxShadow: registrationMode === 'new' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }} onClick={() => { setRegistrationMode('new'); setSelectedExistingPatient(null); }}>
                                    <User size={16} style={{ marginRight: '8px' }} /> New Patient
                                </button>
                                <button type="button" className={`btn ${registrationMode === 'existing' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, border: registrationMode === 'existing' ? 'none' : 'transparent', boxShadow: registrationMode === 'existing' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }} onClick={() => setRegistrationMode('existing')}>
                                    <Search size={16} style={{ marginRight: '8px' }} /> Existing Patient
                                </button>
                            </div>

                            {registrationMode === 'existing' && !selectedExistingPatient && (
                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                                            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
                                            <input 
                                                type="text" 
                                                placeholder="Search by name or Patient ID..." 
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                style={{ 
                                                    width: '100%', padding: '10px 16px 10px 42px', border: '1.5px solid #eef0f4', 
                                                    borderRadius: '12px', fontSize: '13.5px', background: '#f8f9fb', outline: 'none'
                                                }}
                                                onFocus={e => { e.target.style.borderColor = 'var(--color-rose)'; e.target.style.background = '#fff'; }}
                                                onBlur={e => { e.target.style.borderColor = '#eef0f4'; e.target.style.background = '#f8f9fb'; }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <select 
                                                value={suggestedStation}
                                                onChange={(e) => setSuggestedStation(e.target.value)}
                                                style={{ padding: '9px 12px', border: '1.5px solid #eef0f4', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', cursor: 'pointer' }}
                                            >
                                                <option value="All">All Stations</option>
                                                {availableStations.map(s => <option key={s} value={s}>{formatStationName(s)}</option>)}
                                            </select>
                                            <select 
                                                value={suggestedPeriod}
                                                onChange={(e) => setSuggestedPeriod(e.target.value)}
                                                style={{ padding: '9px 12px', border: '1.5px solid #eef0f4', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', cursor: 'pointer' }}
                                            >
                                                <option value="All Time">All Time</option>
                                                <option value="This Year">This Year</option>
                                                <option value="Last Year">Last Year</option>
                                            </select>
                                            <select 
                                                value={suggestedSort}
                                                onChange={(e) => setSuggestedSort(e.target.value)}
                                                style={{ padding: '9px 12px', border: '1.5px solid #eef0f4', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', cursor: 'pointer' }}
                                            >
                                                <option value="recent">Most Recent Delivery</option>
                                                <option value="oldest">Oldest Delivery</option>
                                                <option value="az">Name A-Z</option>
                                                <option value="za">Name Z-A</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div style={{ border: '1px solid #eef0f4', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                                        {loadingSuggestions ? (
                                            <table className="do-table" style={{ margin: 0, width: '100%' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ paddingLeft: '16px' }}>Patient ID</th>
                                                        <th>Mother</th>
                                                        <th>Age</th>
                                                        <th>Station</th>
                                                        <th>Last Delivery</th>
                                                        <th style={{ paddingRight: '16px' }}>Previous Pregnancies</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <tr key={i} className="do-row">
                                                            <td style={{ paddingLeft: '16px' }}><div className="ap-skeleton" style={{ width: '80px', height: '14px' }}></div></td>
                                                            <td><div className="ap-skeleton" style={{ width: '130px', height: '14px' }}></div></td>
                                                            <td><div className="ap-skeleton" style={{ width: '25px', height: '14px' }}></div></td>
                                                            <td><div className="ap-skeleton" style={{ width: '90px', height: '14px' }}></div></td>
                                                            <td><div className="ap-skeleton" style={{ width: '75px', height: '14px' }}></div></td>
                                                            <td style={{ paddingRight: '16px' }}><div className="ap-skeleton" style={{ width: '25px', height: '14px' }}></div></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : fetchError ? (
                                            <div style={{ padding: '32px', textAlign: 'center' }}>
                                                <AlertTriangle size={24} style={{ margin: '0 auto 8px', color: '#e05c73' }} />
                                                <p style={{ color: 'var(--color-text)', fontWeight: 500, marginBottom: '8px' }}>Failed to load existing patients</p>
                                                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '16px' }}>{fetchError}</p>
                                                <button type="button" className="btn btn-outline" onClick={() => fetchSuggestedMothers()}>Retry</button>
                                            </div>
                                        ) : filteredSuggestedMothers.length > 0 ? (
                                            <table className="do-table" style={{ margin: 0, width: '100%' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ paddingLeft: '16px' }}>Patient ID</th>
                                                        <th>Mother</th>
                                                        <th>Age</th>
                                                        <th>Station</th>
                                                        <th>Last Delivery</th>
                                                        <th style={{ paddingRight: '16px' }}>Previous Pregnancies</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredSuggestedMothers.map(p => (
                                                        <tr key={p.id} className="do-row" style={{ cursor: 'pointer', transition: 'all 0.2s ease' }} onClick={async () => {
                                                            const fullPatient = await patientService.getPatientById(p.id);
                                                            if (fullPatient) {
                                                                await hydrateExistingPatient(fullPatient);
                                                            } else {
                                                                setSelectedExistingPatient(p);
                                                            }
                                                        }} onMouseEnter={e => e.currentTarget.style.background = '#fcf8f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                            <td style={{ paddingLeft: '16px' }}>{p.id ? formatMotherId(p.id) : 'N/A'}</td>
                                                            <td style={{ fontWeight: 500, color: 'var(--color-text)' }}>{p.name}</td>
                                                            <td>{p.age || 'N/A'}</td>
                                                            <td>{p.station || 'N/A'}</td>
                                                            <td>{p.lastDelivery ? new Date(p.lastDelivery).toLocaleDateString() : 'N/A'}</td>
                                                            <td style={{ paddingRight: '16px' }}>{p.previousPregnancies}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                <User size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                                <p style={{ margin: 0, fontSize: '14px' }}>No suggested patients found</p>
                                                <p style={{ margin: '4px 0 0', fontSize: '12.5px', opacity: 0.7 }}>Try adjusting your search or filters.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {registrationMode === 'existing' && selectedExistingPatient && (
                                <div className="selected-patient-card" style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-primary-light)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '4px' }}>SELECTED PATIENT</div>
                                        <div style={{ fontWeight: 600, fontSize: '16px' }}>{selectedExistingPatient.name}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>DOB: {selectedExistingPatient.dob} • Station: {selectedExistingPatient.station}</div>
                                    </div>
                                    <button type="button" className="btn btn-outline" onClick={() => { setSelectedExistingPatient(null); setSearchQuery(''); }}>Change Patient</button>
                                </div>
                            )}

                            {registrationMode === 'new' && (
                                <>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>First Name <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="firstName" 
                                        value={formData.firstName} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('firstName') || nameValidationErrors.firstName ? 'error-field' : ''} 
                                    />
                                    {nameValidationErrors.firstName && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            {nameValidationErrors.firstName}
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Middle Name</label>
                                    <input 
                                        type="text" 
                                        name="middleName" 
                                        value={formData.middleName} 
                                        onChange={handleChange}
                                        className={nameValidationErrors.middleName ? 'error-field' : ''} 
                                    />
                                    {nameValidationErrors.middleName && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            {nameValidationErrors.middleName}
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Last Name <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="lastName" 
                                        value={formData.lastName} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('lastName') || nameValidationErrors.lastName ? 'error-field' : ''} 
                                    />
                                    {nameValidationErrors.lastName && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            {nameValidationErrors.lastName}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Suffix</label>
                                    <input 
                                        type="text" 
                                        name="suffix" 
                                        placeholder="Jr., III" 
                                        value={formData.suffix} 
                                        onChange={handleChange} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth <span className="req">*</span></label>
                                    <input 
                                        type="date" 
                                        name="dob" 
                                        value={formData.dob} 
                                        onChange={handleChange} 
                                        max={getPhilippineDate().dateStr} 
                                        required 
                                        className={missingFields.includes('dob') || dobError ? 'error-field' : ''} 
                                    />
                                    {dobError && (
                                        <span className="error-text" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                            {dobError}
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Age <i>(Auto)</i></label>
                                    <input type="number" readOnly value={formData.age} className="computed-field" />
                                </div>
                            </div>

                            {ageAdvisory && (
                                <div style={{
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    marginTop: '8px',
                                    marginBottom: '16px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    backgroundColor: ageAdvisory.tier === 'under_10' ? '#fef2f2' : (ageAdvisory.tier === 'adolescent' ? '#fffbeb' : '#eff6ff'),
                                    border: `1px solid ${ageAdvisory.tier === 'under_10' ? '#fecaca' : (ageAdvisory.tier === 'adolescent' ? '#fef3c7' : '#dbeafe')}`,
                                }}>
                                    {ageAdvisory.tier === 'under_10' ? (
                                        <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    ) : ageAdvisory.tier === 'adolescent' ? (
                                        <Info size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    ) : (
                                        <Info size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    )}
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: ageAdvisory.tier === 'under_10' ? '#991b1b' : (ageAdvisory.tier === 'adolescent' ? '#92400e' : '#1e40af'),
                                        lineHeight: '1.45'
                                    }}>
                                        <strong style={{ display: 'block', marginBottom: '2px', fontSize: '0.875rem' }}>
                                            {ageAdvisory.tier === 'under_10' 
                                                ? 'Registration Requires Medical Referral' 
                                                : (ageAdvisory.tier === 'adolescent' 
                                                    ? 'Adolescent Pregnancy Advisory' 
                                                    : 'Clinical Verification Advisory')}
                                        </strong>
                                        <p style={{ margin: 0 }}>{ageAdvisory.message}</p>
                                    </div>
                                </div>
                            )}

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Civil Status</label>
                                    <select name="civilStatus" value={formData.civilStatus} onChange={handleChange}>
                                        <option value="">Select Status</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Widowed">Widowed</option>
                                        <option value="Separated">Separated</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ position: 'relative' }}>
                                    <label>Email Address <span className="req">*</span></label>
                                    <input 
                                        type="email" 
                                        name="email" 
                                        value={formData.email} 
                                        onChange={handleChange} 
                                        required
                                        className={missingFields.includes('email') || nameValidationErrors.email ? 'error-field' : ''} 
                                        onBlur={(e) => {
                                            setTimeout(() => setEmailSuggestions([]), 200);
                                        }}
                                    />
                                    {emailSuggestions.length > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            backgroundColor: '#fff',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                            zIndex: 10,
                                            marginTop: '4px',
                                            overflow: 'hidden'
                                        }}>
                                            {emailSuggestions.map(s => (
                                                <div 
                                                    key={s} 
                                                    style={{
                                                        padding: '8px 12px',
                                                        cursor: 'pointer',
                                                        fontSize: '13px',
                                                        borderBottom: '1px solid #f0f0f0',
                                                        color: 'var(--color-text)'
                                                    }}
                                                    onClick={() => {
                                                        handleChange({
                                                            target: { name: 'email', value: s, type: 'email' }
                                                        });
                                                        setEmailSuggestions([]);
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fb'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                                                >
                                                    {s}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {nameValidationErrors.email && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            {nameValidationErrors.email}
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Phone Number <span className="req">*</span></label>
                                    <input 
                                        type="tel" 
                                        name="contactNumber" 
                                        value={formData.contactNumber} 
                                        onChange={handleChange} 
                                        onBlur={(e) => {
                                            // Validate on blur for immediate feedback
                                            if (e.target.value && (e.target.value.length !== 11 || !e.target.value.startsWith('09'))) {
                                                e.target.classList.add('error-field');
                                            }
                                        }}
                                        placeholder="ex: 09123456789"
                                        required 
                                        className={missingFields.includes('contactNumber') || missingFields.includes('contactNumber-invalid') ? 'error-field' : ''}
                                    />
                                    {missingFields.includes('contactNumber-invalid') && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            Contact number must start with 09 and be 11 digits long
                                        </span>
                                    )}
                                </div>
                            </div>

                            <h3 className="section-subtitle">Address Details</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>House No. / Street <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="address" 
                                        value={formData.address} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('address') ? 'error-field' : ''} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Station <span className="req">*</span></label>
                                    <select 
                                        name="station" 
                                        value={formData.station} 
                                        onChange={handleChange} 
                                        required 
                                        className={missingFields.includes('station') ? 'error-field' : ''}
                                    >
                                        <option value="">Select Station ({availableStations.length} areas)</option>
                                        {availableStations.map(bgy => (
                                            <option key={bgy} value={bgy}>{formatStationName(bgy)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Municipality</label>
                                    <input name="municipality" value={formData.municipality} readOnly />
                                </div>
                                <div className="form-group">
                                    <label>Province</label>
                                    <input name="province" value={formData.province} readOnly />
                                </div>
                            </div>

                            <h3 className="section-subtitle">Government IDs</h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>PhilHealth Number</label>
                                    <input name="philhealth" value={formData.philhealth} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Other Valid ID Number</label>
                                    <input name="validId" value={formData.validId} onChange={handleChange} />
                                </div>
                            </div>

                            <hr className="divider" />
                            <h3 className="section-subtitle">Emergency Contact Details <span className="req">*</span></h3>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Contact Person Name <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="emName" 
                                        value={formData.emName} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('emName') || nameValidationErrors.emName ? 'error-field' : ''}
                                    />
                                    {nameValidationErrors.emName && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            {nameValidationErrors.emName}
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Relationship to Patient <span className="req">*</span></label>
                                    <select 
                                        name="emRel" 
                                        value={formData.emRel} 
                                        onChange={handleChange}
                                        className={missingFields.includes('emRel') ? 'error-field' : ''}
                                    >
                                        <option value="">Select Relationship</option>
                                        <option value="Spouse">Spouse</option>
                                        <option value="Partner">Partner</option>
                                        <option value="Parent">Parent</option>
                                        <option value="Sibling">Sibling</option>
                                        <option value="Guardian">Guardian</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Phone Number <span className="req">*</span></label>
                                    <input 
                                        type="tel" 
                                        name="emPhone" 
                                        value={formData.emPhone} 
                                        onChange={handleChange} 
                                        onBlur={(e) => {
                                            // Validate on blur for immediate feedback
                                            if (e.target.value && (e.target.value.length !== 11 || !e.target.value.startsWith('09'))) {
                                                e.target.classList.add('error-field');
                                            }
                                        }}
                                        placeholder="ex: 09123456789"
                                        className={missingFields.includes('emPhone') || missingFields.includes('emPhone-invalid') ? 'error-field' : ''}
                                    />
                                    {missingFields.includes('emPhone-invalid') && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            Contact number must start with 09 and be 11 digits long
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Address {!sameAsPatientAddress && <span className="req">*</span>}</label>
                                    <div className="checkbox-wrapper" style={{ marginBottom: '10px' }}>
                                        <label className="checkbox-inline" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={sameAsPatientAddress}
                                                onChange={(e) => setSameAsPatientAddress(e.target.checked)}
                                                style={{ cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                                            />
                                            <span>Same as Patient Address</span>
                                        </label>
                                    </div>
                                    <input 
                                        type="text" 
                                        name="emAddress" 
                                        value={formData.emAddress} 
                                        onChange={handleChange} 
                                        readOnly={sameAsPatientAddress}
                                        className={!sameAsPatientAddress && missingFields.includes('emAddress') ? 'error-field' : ''}
                                        style={sameAsPatientAddress ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                            </div>
                            </>
                            )}
                        </div>
                    )}

                    {/* PREGNANCY TAB - OLD FIELDS */}
                    {activeTab === 'pregnancy' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Pregnancy Information</h2>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Pregnancy Status</label>
                                    <input 
                                        type="text" 
                                        value="Pregnant" 
                                        readOnly 
                                        className="computed-field"
                                        style={{ backgroundColor: 'var(--color-bg, #f8f9fb)', cursor: 'not-allowed', color: 'var(--color-text-muted)' }}
                                    />
                                </div>
                                <div className="form-group duo">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Gravida (Total) <span className="req">*</span>
                                        <div className="tooltip-container">
                                            <Info 
                                                size={14} 
                                                style={{ color: 'var(--color-primary, #6B5B95)', cursor: 'pointer', opacity: 0.8 }} 
                                                tabIndex={0}
                                                aria-label="Gravida information"
                                                className="info-icon-tooltip"
                                            />
                                            <div className="tooltip-content gravida-tooltip">
                                                <strong>Gravida</strong> — Total number of times the mother has been pregnant, including the current pregnancy.
                                            </div>
                                        </div>
                                    </label>
                                    <input 
                                        type="number" 
                                        name="gravida" 
                                        value={formData.gravida} 
                                        onChange={handleChange} 
                                        min="1"
                                        className={missingFields.includes('gravida') ? 'error-field' : ''}
                                    />
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Para (Births) <span className="req">*</span>
                                        <div className="tooltip-container">
                                            <Info 
                                                size={14} 
                                                style={{ color: 'var(--color-primary, #6B5B95)', cursor: 'pointer', opacity: 0.8 }} 
                                                tabIndex={0}
                                                aria-label="Para information"
                                                className="info-icon-tooltip"
                                            />
                                            <div className="tooltip-content para-tooltip">
                                                <strong>Para</strong> — Number of pregnancies that reached the stage of delivery.
                                            </div>
                                        </div>
                                    </label>
                                    <input 
                                        type="number" 
                                        name="para" 
                                        value={formData.para} 
                                        onChange={handleChange} 
                                        min="0"
                                        className={missingFields.includes('para') ? 'error-field' : ''}
                                    />
                                </div>
                            </div>

                            {formData.pregnancyStatus === 'Pregnant' ? (
                                <>
                                    <div className="form-grid-3">
                                        <div className="form-group">
                                            <label>Last Menstrual Period Date <span className="req">*</span></label>
                                            <input 
                                                type="date" 
                                                name="lmp" 
                                                value={formData.lmp} 
                                                onChange={handleChange} 
                                                max={new Date().toISOString().split('T')[0]}
                                                className={missingFields.includes('lmp') || missingFields.includes('lmp-invalid') || lmpError ? 'error-field' : ''}
                                                onKeyDown={(e) => e.preventDefault()}
                                            />
                                            {lmpError && (
                                                <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                                    {lmpError}
                                                </span>
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label>Expected Date of Delivery</label>
                                            <input type="date" readOnly value={formData.edd} className="computed-field" />
                                        </div>
                                        <div className="form-group">
                                            <label>Gestational Age</label>
                                            <input type="text" readOnly value={formData.gestationalAge} className="computed-field" />
                                        </div>
                                    </div>

                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label>Pregnancy Type</label>
                                            <select name="pregnancyType" value={formData.pregnancyType} onChange={handleChange}>
                                                <option value="Not Yet Determined">Not Yet Determined</option>
                                                <option value="Singleton">Singleton</option>
                                                <option value="Twins">Twins</option>
                                                <option value="Multiple">Multiple</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Planned Place of Delivery</label>
                                            <select name="plannedDeliveryPlace" value={formData.plannedDeliveryPlace} onChange={handleChange}>
                                                <option value="Hospital">Hospital</option>
                                                <option value="Lying-in Clinic">Lying-in Clinic</option>
                                                <option value="City Health Office 3">City Health Office 3</option>
                                                {formData.plannedDeliveryPlace === 'Home' && (
                                                    <option value="Home" disabled hidden>Home</option>
                                                )}
                                                {formData.plannedDeliveryPlace === 'Lying-in' && (
                                                    <option value="Lying-in" disabled hidden>Lying-in Clinic</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 className="section-subtitle">Delivery Information</h3>
                                    <div className="form-grid-3">
                                        <div className="form-group">
                                            <label>Baby Name <span className="req">*</span></label>
                                            <input 
                                                type="text" 
                                                name="babyName" 
                                                value={formData.babyName} 
                                                onChange={handleChange}
                                                className={missingFields.includes('babyName') ? 'error-field' : ''}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Birth Date <span className="req">*</span></label>
                                            <input 
                                                type="date" 
                                                name="birthDate" 
                                                value={formData.birthDate} 
                                                onChange={handleChange}
                                                className={missingFields.includes('birthDate') ? 'error-field' : ''}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Delivery Time</label>
                                            <input 
                                                type="time" 
                                                name="deliveryTime" 
                                                value={formData.deliveryTime} 
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-grid-3">
                                        <div className="form-group">
                                            <label>Delivery Type <span className="req">*</span></label>
                                            <select 
                                                name="deliveryType" 
                                                value={formData.deliveryType} 
                                                onChange={handleChange}
                                                className={missingFields.includes('deliveryType') ? 'error-field' : ''}
                                            >
                                                <option value="NSD">NSD (Normal)</option>
                                                <option value="CS">CS (Cesarean)</option>
                                                <option value="Breech">Breech</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Attending Staff <span className="req">*</span></label>
                                            <select
                                                name="attending_staff"
                                                value={formData.attending_staff}
                                                onChange={handleChange}
                                                className={missingFields.includes('attending_staff') ? 'error-field' : ''}
                                            >
                                                <option value="">Select attending staff...</option>
                                                {retainedStaffList.map(staff => (
                                                    <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Baby Gender <span className="req">*</span></label>
                                            <select 
                                                name="babyGender" 
                                                value={formData.babyGender} 
                                                onChange={handleChange}
                                                className={missingFields.includes('babyGender') ? 'error-field' : ''}
                                            >
                                                <option value="Female">Female</option>
                                                <option value="Male">Male</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Birth Weight (kg) <span className="req">*</span></label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                name="babyWeight" 
                                                value={formData.babyWeight} 
                                                onChange={handleChange}
                                                className={missingFields.includes('babyWeight') ? 'error-field' : ''}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-grid-3">
                                        <div className="form-group">
                                            <label>Birth Length (cm)</label>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                name="babyLength" 
                                                value={formData.babyLength} 
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Head Circumference (cm)</label>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                name="headCircumference" 
                                                value={formData.headCircumference} 
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>APGAR (1 min)</label>
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="10"
                                                name="apgar1" 
                                                value={formData.apgar1} 
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label>APGAR (5 min)</label>
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="10"
                                                name="apgar5" 
                                                value={formData.apgar5} 
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Baby Condition at Birth</label>
                                            <select 
                                                name="babyCondition" 
                                                value={formData.babyCondition} 
                                                onChange={handleChange}
                                            >
                                                <option value="Healthy">Healthy</option>
                                                <option value="NICU">NICU</option>
                                                <option value="Special Care">Special Care</option>
                                                <option value="Stillbirth">Stillbirth</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {}
                    {activeTab === 'medical' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Maternal Health Conditions</h2>

                            <p className="section-desc">
                                Select any existing or pregnancy-related health conditions and relevant obstetric history. This information will be recorded in the mother's medical profile for healthcare monitoring.
                            </p>

                            {/* None Reported: compact full-width neutral selection row */}
                            <div className="maternal-none-row">
                                <label className={`maternal-none-toggle ${formData.conditions.includes('None Reported') ? 'is-selected' : ''}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={formData.conditions.includes('None Reported')}
                                        onChange={() => handleCheckbox('None Reported')} 
                                    />
                                    <span className="checkmark"></span> 
                                    <div className="maternal-none-text">
                                        <span className="maternal-none-title">None Reported</span>
                                        <span className="maternal-none-desc">— No documented pre-existing conditions, pregnancy complications, or relevant obstetric history</span>
                                    </div>
                                </label>
                            </div>

                            {/* Three Distinct Category Cards side-by-side */}
                            <div className="maternal-cards-grid">
                                {MATERNAL_HEALTH_CATEGORIES.map(category => {
                                    const CategoryIcon = category.icon;
                                    return (
                                        <div key={category.id} className={`maternal-category-card maternal-category-card--${category.theme}`}>
                                            <div className="maternal-category-head">
                                                <div className="maternal-category-title-wrap">
                                                    <span className="maternal-category-icon">
                                                        <CategoryIcon size={16} />
                                                    </span>
                                                    <h3 className="maternal-category-title">{category.title}</h3>
                                                </div>
                                                <p className="maternal-category-desc">{category.subtitle}</p>
                                            </div>

                                            <div className="maternal-category-divider" />

                                            <div className="maternal-category-options">
                                                {category.conditions.map(name => {
                                                    const isChecked = (formData.conditions || []).includes(name);
                                                    const isOtherOption = name.startsWith('Other ');
                                                    return (
                                                        <React.Fragment key={name}>
                                                            <label 
                                                                className={`maternal-option-row ${isChecked ? 'is-checked' : ''}`}
                                                            >
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isChecked}
                                                                    onChange={() => handleCheckbox(name)} 
                                                                />
                                                                <span className="checkmark"></span> 
                                                                <span className="maternal-option-label">{name}</span>
                                                            </label>
                                                            {isOtherOption && isChecked && (
                                                                <div className="maternal-inline-other-wrap">
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder={`Specify ${category.title.toLowerCase().replace('conditions', 'condition')}...`}
                                                                        value={inlineOtherInputs[name] || ''}
                                                                        onChange={(e) => setInlineOtherInputs(prev => ({ ...prev, [name]: e.target.value }))}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                handleAddInlineOther(name, category.title);
                                                                            }
                                                                        }}
                                                                        className="maternal-inline-other-input"
                                                                    />
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={() => handleAddInlineOther(name, category.title)}
                                                                        className="maternal-inline-other-btn"
                                                                    >
                                                                        <Plus size={13} /> Add
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add Custom Health Condition Section */}
                            <div className="maternal-custom-builder" id="maternal-custom-builder">
                                <div className="maternal-custom-head">
                                    <h3 className="maternal-custom-title">
                                        <Plus size={16} color="var(--color-primary, #b9818a)" />
                                        Add Custom Health Condition
                                    </h3>
                                    <p className="maternal-custom-desc">
                                        Manually enter and categorize any other diagnosed health condition or relevant obstetric history.
                                    </p>
                                </div>

                                <div className="maternal-custom-form">
                                    <div>
                                        <select
                                            ref={customCategorySelectRef}
                                            value={newCustomCategory}
                                            onChange={(e) => {
                                                setNewCustomCategory(e.target.value);
                                                setCustomConditionError('');
                                            }}
                                            className="maternal-custom-select"
                                            aria-label="Condition Category"
                                        >
                                            <option value="">-- Condition Category * --</option>
                                            <option value="Pre-existing Medical Conditions">Pre-existing Medical Conditions</option>
                                            <option value="Pregnancy-Related Conditions">Pregnancy-Related Conditions</option>
                                            <option value="Relevant Obstetric History">Relevant Obstetric History</option>
                                        </select>
                                    </div>
                                    <div>
                                        <input
                                            ref={customNameInputRef}
                                            type="text"
                                            value={newCustomName}
                                            onChange={(e) => {
                                                setNewCustomName(e.target.value);
                                                setCustomConditionError('');
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddCustomCondition();
                                                }
                                            }}
                                            placeholder="Condition Name / Description * (e.g., Hypothyroidism, Placenta Previa, Previous Ectopic)"
                                            className="maternal-custom-input"
                                            aria-label="Condition Name or Description"
                                        />
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleAddCustomCondition}
                                            className="maternal-custom-add-btn"
                                        >
                                            <Plus size={15} /> Add Condition
                                        </button>
                                    </div>
                                </div>

                                {customConditionError && (
                                    <div className="maternal-custom-error">
                                        <AlertCircle size={14} />
                                        <span>{customConditionError}</span>
                                    </div>
                                )}

                                {/* Documented Custom Conditions Chips */}
                                {customConditions.length > 0 && (
                                    <div className="maternal-custom-list-wrap">
                                        <span className="maternal-custom-list-label">
                                            Documented Custom Conditions ({customConditions.length})
                                        </span>
                                        <div className="maternal-custom-chips">
                                            {customConditions.map(item => {
                                                let pillClass = 'maternal-cat-pill--pre-existing';
                                                if (item.category === 'Pregnancy-Related Conditions') {
                                                    pillClass = 'maternal-cat-pill--pregnancy-related';
                                                } else if (item.category === 'Relevant Obstetric History') {
                                                    pillClass = 'maternal-cat-pill--obstetric-history';
                                                }
                                                return (
                                                    <div key={item.id} className="maternal-custom-chip">
                                                        <span className="maternal-custom-chip-name">{item.name}</span>
                                                        <span className={`maternal-cat-pill ${pillClass}`}>{item.category}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCustomCondition(item.id)}
                                                            className="maternal-custom-chip-remove"
                                                            title="Remove condition"
                                                            aria-label={`Remove ${item.name}`}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Clinical Notes & Medical Observations Section */}
                            <div className="maternal-notes-container">
                                <div className="maternal-notes-head">
                                    <div>
                                        <label className="maternal-notes-title" style={{ margin: 0 }}>
                                            Clinical Notes & Medical Observations
                                        </label>
                                        <p className="maternal-notes-hint">
                                            General observations, consultation remarks, or examination findings. Notes are saved for reference and are not automatically classified as diagnosed conditions.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDocumentFromNote}
                                        className="maternal-notes-action-btn"
                                        title="Highlight text in the notes or click to document a structured condition"
                                    >
                                        <Plus size={13} /> Add Condition from Note
                                    </button>
                                </div>
                                <textarea 
                                    ref={clinicalNotesRef}
                                    name="clinicalNotes" 
                                    rows={3} 
                                    value={formData.clinicalNotes || ''} 
                                    onChange={handleChange} 
                                    placeholder="Enter general clinical observations, patient history remarks, or consultation notes..."
                                    className="maternal-notes-input"
                                />
                            </div>
                        </div>
                    )}
                    {}
                    {activeTab === 'prenatal' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Prenatal Care & Initial Vitals</h2>

                            <div className="form-grid-2">
                                <div className="form-group">
                                    <p className="field-note">
                                        First consultation is generated automatically from the LMP schedule. You do not need to select a date manually.
                                    </p>
                                </div>
                            </div>

                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>
                                        Auto-Scheduled Visits Preview
                                        {schedulePreview.length > 0 && (
                                            <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 500 }}>
                                                {schedulePreview.length} future visits ({schedulePreview.length + 1} total including registration visit)
                                            </span>
                                        )}
                                    </label>
                                    {formData.lmp && !loadingSchedule ? (
                                        schedulePreview.length > 0 ? (
                                            <div className="visit-calendar visit-calendar--preview">
                                                {schedulePreview.map((visit, i) => (
                                                    <div key={`${visit.date}-${i}`} className={`calendar-day trimester-${visit.trimester}`}>
                                                        <label className="date-label" style={{ display: 'grid', gap: '6px' }}>
                                                            Visit {visit.visitNumber}
                                                            <input
                                                                type="date"
                                                                value={visit.date}
                                                                min={new Date().toISOString().slice(0, 10)}
                                                                aria-label={`Date for prenatal visit ${visit.visitNumber}`}
                                                                onChange={event => updateScheduledVisit(i, event.target.value)}
                                                            />
                                                        </label>
                                                        <div className="week-label">{visit.week}w</div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            aria-label={`Remove prenatal visit ${visit.visitNumber}`}
                                                            onClick={() => removeScheduledVisit(i)}
                                                            style={{ padding: '4px 8px', marginTop: '6px' }}
                                                        >
                                                            <Trash2 size={14} /> Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div>No schedule available yet.</div>
                                        )
                                    ) : formData.lmp ? (
                                        <div>Loading calendar...</div>
                                    ) : (
                                        <div className="no-lmp">Enter LMP to see the 8-visit calendar</div>
                                    )}
                                    {formData.lmp && !loadingSchedule && (
                                        <div style={{ display: 'flex', alignItems: 'end', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                                            <label className="form-group" style={{ margin: 0 }}>
                                                Add prenatal visit
                                                <input
                                                    type="date"
                                                    value={newScheduleDate}
                                                    min={new Date().toISOString().slice(0, 10)}
                                                    onChange={event => setNewScheduleDate(event.target.value)}
                                                />
                                            </label>
                                            <button type="button" className="btn btn-outline" onClick={addScheduledVisit} disabled={!newScheduleDate}>
                                                <Plus size={15} /> Add visit
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className={`prenatal-risk-info-card risk-info--${formData.hasHealthConditions ? 'high' : 'low'}`}>
                                        {formData.hasHealthConditions ? (
                                            <>
                                                <div className="card-header">
                                                    <HeartPulse size={18} className="icon-high" />
                                                    <h3>Documented Health Conditions</h3>
                                                </div>
                                                <div className="card-body">
                                                    <p className="risk-status-text">
                                                        This patient has <strong>documented health conditions</strong> that require ongoing clinical monitoring.
                                                    </p>
                                                    <p className="risk-instruction-text">
                                                        Patients with documented health conditions may require specialized maternal monitoring alongside the standard prenatal schedule.
                                                    </p>
                                                    <p className="risk-action-text">
                                                        Coordinate with the attending healthcare provider for specialized care or referrals when appropriate.
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="card-header">
                                                    <CheckCircle2 size={18} className="icon-low" />
                                                    <h3>Standard Prenatal Care</h3>
                                                </div>
                                                <div className="card-body">
                                                    <p className="risk-status-text">
                                                        No chronic or pregnancy-related health conditions are currently documented.
                                                    </p>
                                                    <p className="risk-instruction-text">
                                                        The standard prenatal visit schedule will be automatically generated based on the patient's LMP.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Assigned Staff</label>
                                        {user?.role?.toLowerCase() === 'staff' ? (
                                            <input value={formData.retained_staff ? user.fullName || user.email : 'No staff assigned for this station'} readOnly />
                                        ) : (
                                            <select name="retained_staff" value={formData.retained_staff} onChange={handleChange}>
                                                <option value="">No staff assigned</option>
                                                {retainedStaffList.map(staff => (
                                                    <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <hr className="divider" />
                            <h3 className="section-subtitle">Initial Vital Signs <span className="req">*</span></h3>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Blood Pressure (mmHg) <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="bp" 
                                        placeholder="ex: 120/80" 
                                        value={formData.bp} 
                                        onChange={handleChange} 
                                        onBlur={(e) => {
                                            if (formData.pregnancyStatus === 'Pregnant' && !e.target.value) {
                                                e.target.classList.add('error-field');
                                            }
                                        }}
                                        className={missingFields.includes('bp') ? 'error-field' : ''}
                                    />
                                    <span className="field-helper-text">Format: 120/80</span>
                                    {bpWarning && (
                                        <div className={`bp-warning bp-warning--${bpWarning.type}`}>
                                            <AlertTriangle size={14} />
                                            <span>{bpWarning.label} blood pressure detected. Please double-check.</span>
                                        </div>
                                    )}
                                    {missingFields.includes('bp') && formData.pregnancyStatus === 'Pregnant' && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            Blood pressure is required for pregnant patients.
                                        </span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Weight (kg) <span className="req">*</span></label>
                                    <input 
                                        type="number" 
                                        name="weight" 
                                        step="0.1" 
                                        value={formData.weight} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('weight') ? 'error-field' : ''}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Height (cm) <span className="req">*</span></label>
                                    <input 
                                        type="number" 
                                        name="height" 
                                        value={formData.height} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('height') ? 'error-field' : ''}
                                    />
                                </div>
                            </div>
                            {/* BMI Display */}
                            {formData.weight && formData.height && (
                                <div className="form-group" style={{marginBottom: '16px'}}>
                                    <div style={{padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px', border: '1px solid #ddd'}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                            <span style={{fontWeight: 600}}>BMI: <span style={{fontSize: '16px', color: '#333'}}>{formData.bmi}</span></span>
                                            <span style={{
                                                padding: '4px 12px', 
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                backgroundColor: (() => {
                                                    const bmi = parseFloat(formData.bmi);
                                                    if (bmi < 18.5) return '#fff3cd';
                                                    if (bmi < 25) return '#d4edda';
                                                    return '#f8d7da';
                                                })(),
                                                color: (() => {
                                                    const bmi = parseFloat(formData.bmi);
                                                    if (bmi < 18.5) return '#856404';
                                                    if (bmi < 25) return '#155724';
                                                    return '#721c24';
                                                })()
                                            }}>
                                                {(() => {
                                                    const bmi = parseFloat(formData.bmi);
                                                    if (bmi < 18.5) return '⚠️ Underweight';
                                                    if (bmi < 25) return '✓ Normal';
                                                    return '⚠️ Overweight';
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Temperature (°C) <span className="req">*</span></label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="temp"
                                        value={formData.temp}
                                        onChange={handleChange}
                                        placeholder="ex: 36.5"
                                        className={missingFields.includes('temp') ? 'error-field' : ''}
                                    />
                                    {missingFields.includes('temp') && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            Temperature is required.
                                        </span>
                                    )}
                                    {tempWarning && !missingFields.includes('temp') && (
                                        <div className={`temp-warning temp-warning--${tempWarning.type}`}>
                                            <AlertTriangle size={14} />
                                            <span>{tempWarning.label} detected. Please double-check.</span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Pulse (bpm) <span className="req">*</span></label>
                                    <input
                                        type="number"
                                        name="pulse"
                                        value={formData.pulse}
                                        onChange={handleChange}
                                        className={missingFields.includes('pulse') ? 'error-field' : ''}
                                    />
                                    {missingFields.includes('pulse') && (
                                        <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                            Pulse is required.
                                        </span>
                                    )}
                                    {vitalWarnings.pulse && !missingFields.includes('pulse') && (
                                        <div className="vital-warning">
                                            <AlertTriangle size={14} />
                                            <span>Abnormal: {formData.pulse} bpm (Normal: 60-100 bpm)</span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Blood Type</label>
                                    <select 
                                        name="bloodType" 
                                        value={formData.bloodType} 
                                        onChange={handleChange}
                                        className={missingFields.includes('bloodType') ? 'error-field' : ''}
                                    >
                                        <option value="">Select Blood Type</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A−</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B−</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB−</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O−</option>
                                        <option value="Unknown">Unknown / Not yet determined</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Fetal Heart Rate (bpm)</label>
                                    <input 
                                        type="number" 
                                        name="fhr" 
                                        value={formData.fhr} 
                                        onChange={handleChange} 
                                    />
                                    {vitalWarnings.fhr && (
                                        <div className="vital-warning">
                                            <AlertTriangle size={14} />
                                            <span>Abnormal: {formData.fhr} bpm (Normal: 110-160 bpm)</span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Hemoglobin Level (g/dL)</label>
                                    <input 
                                        type="number" 
                                        name="hgb" 
                                        step="0.1" 
                                        value={formData.hgb} 
                                        onChange={handleChange} 
                                    />
                                    {vitalWarnings.hgb && (
                                        <div className="vital-warning">
                                            <AlertTriangle size={14} />
                                            <span>Abnormal: {formData.hgb} g/dL (Normal: 11-13 g/dL)</span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Respiratory Rate (cpm)</label>
                                    <input
                                        type="number"
                                        name="respRate"
                                        value={formData.respRate}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Fundal Height (cm)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="fundalHeight"
                                        value={formData.fundalHeight}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Fetal Movement</label>
                                    <input
                                        type="text"
                                        name="fetalMovement"
                                        value={formData.fetalMovement}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Presentation</label>
                                    <select name="presentation" value={formData.presentation} onChange={handleChange}>
                                        <option value="">Select Presentation</option>
                                        <option value="Cephalic">Cephalic (Head down)</option>
                                        <option value="Breech">Breech</option>
                                        <option value="Transverse">Transverse</option>
                                        <option value="Unknown">Unknown / Too early</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Initial Visit Notes</label>
                                <textarea
                                    name="visitNotes"
                                    rows={3}
                                    value={formData.visitNotes}
                                    onChange={handleChange}
                                    placeholder="Brief consultation notes..."
                                />
                            </div>


                        </div>
                    )}
                    
                    {/* Form Action Buttons - Bottom Placement */}
                    <div className="ap-form-actions">
                        {isFirstTab ? (
                            <button className="btn btn-outline" onClick={() => navigate(-1)} disabled={isSaving} type="button">
                                <X size={15} /> Cancel
                            </button>
                        ) : (
                            <button className="btn btn-outline" onClick={() => setActiveTab(activeTabs[currentTabIndex - 1].id)} disabled={isSaving} type="button">
                                <ArrowLeft size={15} /> Back
                            </button>
                        )}
                        
                        {isLastTab ? (
                            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !currentStaff.id} type="button">
                                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                {isSaving ? 'Saving...' : 'Save & Auto-Schedule Visits'}
                            </button>
                        ) : (
                            <button 
                                className="btn btn-primary" 
                                onClick={handleNext} 
                                disabled={isSaving || (activeTab === 'personal' && ageAdvisory?.tier === 'under_10')} 
                                type="button"
                                title={activeTab === 'personal' && ageAdvisory?.tier === 'under_10' ? "Registration cannot proceed for ages 0–9" : undefined}
                            >
                                Next
                            </button>
                        )}
                    </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPatient;
