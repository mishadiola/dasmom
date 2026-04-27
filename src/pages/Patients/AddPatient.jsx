import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import {
    ArrowLeft, Save, X, FileText, User, Activity,
    Calendar, HeartPulse, UploadCloud, AlertTriangle,
    CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import '../../styles/pages/AddPatient.css';
import PatientService from "../../services/patientservice";
import InventoryService from '../../services/inventoryservice';
const patientService = new PatientService();
const inventoryService = new InventoryService();
const TABS = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'pregnancy', label: 'Pregnancy', icon: HeartPulse },
    { id: 'medical', label: 'Medical', icon: Activity },
    { id: 'prenatal', label: 'Prenatal', icon: Calendar },
];
const MEDICAL_CONDITIONS = [
    { name: 'None', risk: 'None', isExclusive: true },
    { name: 'Hypertension', risk: 'High' },
    { name: 'Diabetes', risk: 'High' },
    { name: 'Heart Disease', risk: 'High' },
    { name: 'Asthma', risk: 'Medium' },
    { name: 'Anemia', risk: 'Medium' },
    { name: 'Previous C-section', risk: 'High' }
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
    
    const stationMap = {
        'cho iii': 'City Health Office 3',
        'cho 3': 'City Health Office 3',
        'cho3': 'City Health Office 3',
        'salawag': 'Salawag',
    };
    
    const lowerStation = station.toLowerCase().trim();
    
    // Check for exact match in map
    if (stationMap[lowerStation]) {
        return stationMap[lowerStation];
    }
    
    // For stations not in the map, apply general formatting
    // Capitalize first letter of each word
    return station
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const AddPatient = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);  
    const [activeTab, setActiveTab] = useState('personal');
    const [toast, setToast] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [missingFields, setMissingFields] = useState([]);
    const [nameValidationErrors, setNameValidationErrors] = useState({});
    const [loadingStations, setLoadingStations] = useState(true);
    const [availableStations, setAvailableStations] = useState([]);
    const [midwifeList, setMidwifeList] = useState([]);
    const [doctorList, setDoctorList] = useState([]);
    const [schedulePreview, setSchedulePreview] = useState([]);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [otherConditionRisk, setOtherConditionRisk] = useState('Low');
    const [retainedStaffList, setRetainedStaffList] = useState([]);
    const [emailSuggestions, setEmailSuggestions] = useState([]);
    const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
    const [vitalWarnings, setVitalWarnings] = useState({});
    const [bpWarning, setBpWarning] = useState(null);
    const [tempWarning, setTempWarning] = useState(null);

    const currentStaff = {
        id: user?.id || null,
        full_name: user ? `${user.email} (Admin)` : 'Admin User'
    };

    const [formData, setFormData] = useState({
        firstName: '', middleName: '', lastName: '', suffix: '',
        dob: '', age: '', civilStatus: '', contactNumber: '', email: '',
        alternateContact: '', address: '', station: '', municipality: 'Dasmariñas',
        province: 'Cavite', philhealth: '', validId: '',
        pregnancyStatus: 'Pregnant', gravida: '', para: '',
        lmp: '', edd: '', gestationalAge: '', pregnancyType: 'Singleton',
        plannedDeliveryPlace: 'Hospital',
        conditions: [], otherConditions: '', riskLevel: 'Low Risk',
        retained_staff: '',
        bp: '', weight: '', height: '', bmi: '', temp: '', pulse: '', respRate: '', fundalHeight: '',
        fetalMovement: '', presentation: '', testsDone: '', visitNotes: '',
        fhr: '', hgb: '',
        emName: '', emRel: '', emPhone: '', emAddress: '',
    });

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
        if (user) {
            const bhwName = `${user.email} (Admin)`;
            setFormData(prev => ({ ...prev, bhwAssigned: bhwName }));
            console.log('✅ BHW from AuthContext:', bhwName);
        }
    }, [user]);

    useEffect(() => {
        const filterStaff = async () => {
            if (!formData.station || loadingStations) return;
            try {
                // Get all staff at the selected station
                const staffAtStation = await patientService.getDoctorsByStation(formData.station);
                setDoctorList(staffAtStation);
                setMidwifeList(staffAtStation);

                // Get retained staff for the selected station
                const retainedStaff = await patientService.getRetainedStaff(formData.station);
                const staffList = Array.isArray(retainedStaff) ? retainedStaff : (retainedStaff ? [retainedStaff] : []);
                setRetainedStaffList(staffList);
                setFormData(prev => ({ ...prev, retained_staff: staffList.length > 0 ? staffList[0].id : '' }));
                console.log(`✅ Staff filtered for ${formData.station}:`, { staffCount: staffAtStation.length });
            } catch (err) {
                console.error(err);
            }
        };
        filterStaff();
    }, [formData.station, loadingStations]);

    useEffect(() => {
        if (formData.dob) {
            const today = new Date();
            const birthDate = new Date(formData.dob);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            setFormData(prev => ({ ...prev, age: age.toString() }));
        }
    }, [formData.dob]);

    useEffect(() => {
        if (formData.lmp) {
            const lmpDate = new Date(formData.lmp);
            const eddDate = new Date(lmpDate);
            eddDate.setDate(eddDate.getDate() + 280);

            const today = new Date();
            const diffTime = Math.abs(today - lmpDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const weeks = Math.floor(diffDays / 7);
            const days = diffDays % 7;

            setFormData(prev => ({
                ...prev,
                edd: eddDate.toISOString().split('T')[0],
                gestationalAge: `${weeks}w ${days}d`
            }));
        }
    }, [formData.lmp]);

    useEffect(() => {
        if (!formData.lmp) {
            setSchedulePreview([]);
            return;
        }

        setLoadingSchedule(true);
        try {
            const preview = patientService.generateSemesterSchedule(formData.lmp, {
                time: '08:00'
            });
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
        let risk = 'Low Risk';
        
        // Check for multiple pregnancy (high-risk indicator)
        const isMultipleBirth = formData.pregnancyType && formData.pregnancyType.toLowerCase() !== 'singleton';
        
        // Check selected conditions from MEDICAL_CONDITIONS
        const selectedConditions = formData.conditions.map(conditionName => {
            return MEDICAL_CONDITIONS.find(c => c.name === conditionName);
        }).filter(Boolean);
        
        const selectedConditionCount = selectedConditions.length;
        const hasHighRisk = selectedConditions.some(c => c.risk === 'High');
        const hasMedRisk = selectedConditions.some(c => c.risk === 'Medium');
        
        // Check Other Conditions risk level
        const hasOtherCondition = formData.otherConditions && formData.otherConditions.trim() !== '';
        const otherRisk = hasOtherCondition ? otherConditionRisk : null;

        // Check BMI
        const bmiCategory = patientService.calculateBMICategory(formData.weight, formData.height);
        const isBMIHighRisk = bmiCategory && patientService.isBMIHighRisk(bmiCategory);

        // Determine overall risk (multiple pregnancy is high-risk)
        if (isMultipleBirth || hasHighRisk || selectedConditionCount >= 2 || otherRisk === 'High' || isBMIHighRisk) {
            risk = 'High Risk';
        } else if (hasMedRisk || otherRisk === 'Medium') {
            risk = 'Medium Risk';
        }

        // Age-based risk: <18 or >35 is high risk
        const age = parseInt(formData.age);
        if (!isNaN(age) && (age < 18 || age > 35)) {
            risk = 'High Risk';
        }

        setFormData(prev => ({ ...prev, riskLevel: risk }));
    }, [formData.conditions, formData.otherConditions, formData.pregnancyType, otherConditionRisk, formData.age, formData.weight, formData.height]);

    useEffect(() => {
        // Calculate BMI when weight and height change
        if (formData.weight && formData.height) {
            const weightKg = parseFloat(formData.weight);
            const heightCm = parseFloat(formData.height);
            if (weightKg > 0 && heightCm > 0) {
                const heightM = heightCm / 100;
                const bmi = (weightKg / (heightM * heightM)).toFixed(1);
                setFormData(prev => ({ ...prev, bmi: bmi.toString() }));
                
                // Check if BMI indicates high-risk (underweight < 18.5 or overweight >= 25)
                const bmiValue = parseFloat(bmi);
                const isBMIHighRisk = bmiValue < 18.5 || bmiValue >= 25;
                
                // Update risk level if BMI is high-risk
                if (isBMIHighRisk) {
                    setFormData(prev => ({ ...prev, riskLevel: 'High Risk' }));
                }
            }
        }
    }, [formData.weight, formData.height]);

    useEffect(() => {
        // Check BP for high-risk indicators
        if (formData.bp) {
            const bpMatch = formData.bp.match(/^(\d+)[/\\s](\d+)$/);
            if (bpMatch) {
                const systolic = parseInt(bpMatch[1]);
                const diastolic = parseInt(bpMatch[2]);
                
                // High-risk BP ranges for pregnancy:
                // Hypertension: >= 140/90
                // Hypotension: < 90/60
                const isHighRisk = (systolic >= 140 || diastolic >= 90) || (systolic < 90 || diastolic < 60);
                
                if (isHighRisk) {
                    setFormData(prev => ({ ...prev, riskLevel: 'High Risk' }));
                }
            }
        }
    }, [formData.bp]);

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
            } else {
                // Clear error if valid or empty
                setNameValidationErrors(prev => {
                    const updated = { ...prev };
                    delete updated[name];
                    return updated;
                });

                // Generate domain suggestions if user typed @
                if (finalValue.includes('@')) {
                    const [username, domain] = finalValue.split('@');
                    const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
                    
                    if (domain === '' || domain.length < 3) {
                        // Show all suggestions when user just typed @ or started typing domain
                        const suggestions = commonDomains.map(d => `${username}@${d}`);
                        setEmailSuggestions(suggestions);
                        setShowEmailSuggestions(true);
                    } else {
                        // Filter suggestions based on what user typed
                        const filtered = commonDomains.filter(d => d.startsWith(domain.toLowerCase()));
                        const suggestions = filtered.map(d => `${username}@${d}`);
                        setEmailSuggestions(suggestions);
                        setShowEmailSuggestions(suggestions.length > 0);
                    }
                } else {
                    setShowEmailSuggestions(false);
                    setEmailSuggestions([]);
                }
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

    const handleCheckbox = (conditionName) => {
        setFormData(prev => {
            const current = [...prev.conditions];
            
            // Check if this is the "None" option
            const isNone = conditionName === 'None';
            
            if (isNone) {
                // If "None" is being selected
                if (current.includes('None')) {
                    // Deselect "None"
                    return { ...prev, conditions: current.filter(c => c !== 'None') };
                } else {
                    // Select "None" and deselect all other conditions
                    return { ...prev, conditions: ['None'] };
                }
            } else {
                // If a regular condition is being selected
                if (current.includes(conditionName)) {
                    // Deselect this condition
                    const updated = current.filter(c => c !== conditionName);
                    return { ...prev, conditions: updated };
                } else {
                    // Select this condition and deselect "None" if it's selected
                    const updated = current.filter(c => c !== 'None');
                    return { ...prev, conditions: [...updated, conditionName] };
                }
            }
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (isSaving || !user?.id) return;

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
        
        if (Object.keys(nameErrors).length > 0) {
            setNameValidationErrors(nameErrors);
            setToast({ type: 'error', message: 'Please fix the validation errors before saving.' });
            return;
        }

        const requiredPersonal = ['firstName', 'lastName', 'dob', 'email', 'contactNumber', 'address', 'station'];
        const requiredEmergency = ['emName', 'emRel', 'emPhone', 'emAddress'];
        const requiredPregnancy = ['gravida', 'para', 'lmp'];
        
        // BP is required for pregnant patients
        const requiredVitals = formData.pregnancyStatus === 'Pregnant' ? ['bp', 'weight', 'height'] : ['weight', 'height'];

        const missing = [];
        const checkFields = (fields) => fields.forEach(f => {
            if (!formData[f]) {
                missing.push(f);
            } 
            else if ((f === 'contactNumber' || f === 'emPhone')) {
                // Validate Philippine mobile number format: must start with "09" and be exactly 11 digits
                if (formData[f].length !== 11 || !formData[f].startsWith('09')) {
                    missing.push(f + '-invalid');
                }
            }
        });
        checkFields(requiredPersonal);
        checkFields(requiredEmergency);
        checkFields(requiredPregnancy);
        checkFields(requiredVitals);

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

        const filteredSchedulePreview = patientService.filterScheduleAfterToday(schedulePreview).filter((v) => {
            const visitDate = new Date(v.date);
            const firstDate = new Date(autoFirstVisitDate);
            return !Number.isNaN(visitDate.getTime()) && visitDate > firstDate;
        });

        const riskFactors = [
            ...formData.conditions,
            ...(formData.otherConditions ? [formData.otherConditions] : []),
            ...(formData.pregnancyType !== 'Singleton' ? [`${formData.pregnancyType} Pregnancy`] : []),
            ...(formData.age && (formData.age < 18 || formData.age > 35) ? [`Age ${formData.age} (${formData.age < 18 ? 'Teenage' : 'Advanced Maternal Age'})`] : []),
        ].filter(Boolean);

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

        const patientData = {
            ...formData,
            firstVisitDate: autoFirstVisitDate,
            schedulePreview: filteredSchedulePreview,
            riskFactors: riskFactors.join(', '),
        };

        try {
            console.log('📤 Passing to PatientService.addPatient:', patientData);
            const newPatient = await patientService.addPatient(patientData);
    
    console.log('🎉 Patient created:', newPatient.id, `${newPatient.first_name || formData.firstName} ${newPatient.last_name || formData.lastName}`);
    
    setToast({ 
        type: 'success', 
        message: `✅ Patient saved successfully!
        👤 ${newPatient.first_name || formData.firstName} ${newPatient.last_name || formData.lastName}
        📅 Semester visits auto-scheduled
        🏘️ ${newPatient.barangay || formData.station}` 
    });
    
    navigate(`/dashboard/patients/${newPatient.id}`);  
} 
        catch (err) {
            console.error('💥 Save failed:', err);
            setToast({ type: 'error', message: `Save failed: ${err.message}` });
        }
        finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="add-patient-page">
            {toast && (
                <div className={`toast toast--${toast.type}`}>
                    <span>{toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {toast.message}</span>
                    <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
                </div>
            )}

            <div className="ap-header">
                <div>
                    <button className="back-link" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} /> Back to Patient List
                    </button>
                    <h1 className="ap-title">Add New Pregnant Patient</h1>
                    <p>BHW: {currentStaff.full_name} | Available Stations: {availableStations.length}</p>
                </div>
                <div className="ap-actions">
                    <button className="btn btn-outline" onClick={() => navigate(-1)} disabled={isSaving}>
                        <X size={15} /> Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !currentStaff.id}>
                        {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        {isSaving ? 'Saving...' : 'Save & Auto-Schedule Visits'}
                    </button>
                </div>
            </div>

            <div className="ap-smart-badges">
                <div className={`smart-badge risk-badge risk-${formData.riskLevel.toLowerCase().split(' ')[0]}`}>
                    {formData.riskLevel === 'High Risk' && <AlertTriangle size={14} />}
                    Auto Risk: {formData.riskLevel}
                </div>
                {formData.gestationalAge && <div className="smart-badge">GA: {formData.gestationalAge}</div>}
                <div className="smart-badge">35 slots/day per Station</div>
            </div>

            <div className="ap-container">
                <aside className="ap-sidebar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`ap-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            type="button"
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </aside>

                <form onSubmit={handleSave} className="ap-form">
                    <div className="ap-content">
                        {/* PERSONAL TAB - OLD FIELDS + NEW DROPDOWN */}
                        {activeTab === 'personal' && (
                            <div className="ap-section animate-fade">
                            <h2 className="section-title">Personal Information</h2>
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
                                        required 
                                        className={missingFields.includes('dob') ? 'error-field' : ''} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Age <i>(Auto)</i></label>
                                    <input type="number" readOnly value={formData.age} className="computed-field" />
                                </div>
                            </div>

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
                                        onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 200)}
                                        onFocus={() => formData.email.includes('@') && setShowEmailSuggestions(true)}
                                        required
                                        className={missingFields.includes('email') || nameValidationErrors.email ? 'error-field' : ''} 
                                    />
                                    {showEmailSuggestions && emailSuggestions.length > 0 && (
                                        <div className="email-suggestions-dropdown">
                                            {emailSuggestions.map((suggestion, index) => (
                                                <div 
                                                    key={index}
                                                    className="email-suggestion-item"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, email: suggestion }));
                                                        setShowEmailSuggestions(false);
                                                        setEmailSuggestions([]);
                                                    }}
                                                >
                                                    {suggestion}
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
                        </div>
                    )}

                    {/* PREGNANCY TAB - OLD FIELDS */}
                    {activeTab === 'pregnancy' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Pregnancy Information</h2>
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label>Pregnancy Status</label>
                                    <select name="pregnancyStatus" value={formData.pregnancyStatus} onChange={handleChange}>
                                        <option value="Pregnant">Pregnant</option>
                                        <option value="Postpartum">Postpartum</option>
                                    </select>
                                </div>
                                <div className="form-group duo">
                                    <label>Gravida (Total) <span className="req">*</span></label>
                                    <input 
                                        type="number" 
                                        name="gravida" 
                                        value={formData.gravida} 
                                        onChange={handleChange} 
                                        min="1"
                                        className={missingFields.includes('gravida') ? 'error-field' : ''}
                                    />
                                    <label>Para (Births) <span className="req">*</span></label>
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

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Last Menstrual Period Date <span className="req">*</span></label>
                                    <input 
                                        type="date" 
                                        name="lmp" 
                                        value={formData.lmp} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('lmp') ? 'error-field' : ''}
                                    />
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
                                        <option value="Singleton">Singleton</option>
                                        <option value="Twins">Twins</option>
                                        <option value="Multiple">Multiple</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Planned Place of Delivery</label>
                                    <select name="plannedDeliveryPlace" value={formData.plannedDeliveryPlace} onChange={handleChange}>
                                        <option value="Hospital">Hospital</option>
                                        <option value="Lying-in">Lying-in Clinic</option>
                                        <option value="Home">Home</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                    {}
                    {activeTab === 'medical' && (
                        <div className="ap-section animate-fade">
                            <h2 className="section-title">Medical Risk Assessment</h2>
                            <p className="section-desc">Select all existing medical conditions. The system will auto-compute the risk level based on CHO guidelines.</p>
                            <h3 className="section-subtitle">Pre-existing Conditions</h3>
                            <div className="checkbox-grid">
                                {MEDICAL_CONDITIONS.map(cond => (
                                    <label key={cond.name} className={`custom-checkbox ${cond.isExclusive ? 'exclusive-option' : ''}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={formData.conditions.includes(cond.name)}
                                            onChange={() => handleCheckbox(cond.name)} 
                                        />
                                        <span className="checkmark"></span> 
                                        <span>{cond.name}</span>
                                        {!cond.isExclusive && (
                                            <span className={`risk-badge risk-badge--${cond.risk.toLowerCase()}`}>
                                                {cond.risk} Risk
                                            </span>
                                        )}
                                        {cond.isExclusive && (
                                            <span className="risk-badge" style={{background: 'rgba(109, 184, 160, 0.15)', color: '#3d8870', border: 'none'}}>
                                                No risks
                                            </span>
                                        )}
                                    </label>
                                ))}
                            </div>
                            <div className="form-group mt-3">
                                <label>Other Conditions</label>
                                <textarea 
                                    name="otherConditions" 
                                    rows={2} 
                                    value={formData.otherConditions} 
                                    onChange={handleChange} 
                                    placeholder="Specify other conditions here..."
                                />
                                {formData.otherConditions && (
                                    <div className="mt-2">
                                        <label style={{fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block'}}>
                                            Risk Level:
                                        </label>
                                        <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
                                            <label style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'}}>
                                                <input 
                                                    type="radio" 
                                                    name="otherConditionRisk"
                                                    value="Low"
                                                    checked={otherConditionRisk === 'Low'}
                                                    onChange={(e) => setOtherConditionRisk(e.target.value)}
                                                /> 
                                                Low Risk
                                            </label>
                                            <label style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'}}>
                                                <input 
                                                    type="radio" 
                                                    name="otherConditionRisk"
                                                    value="Medium"
                                                    checked={otherConditionRisk === 'Medium'}
                                                    onChange={(e) => setOtherConditionRisk(e.target.value)}
                                                /> 
                                                Medium Risk
                                            </label>
                                            <label style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'}}>
                                                <input 
                                                    type="radio" 
                                                    name="otherConditionRisk"
                                                    value="High"
                                                    checked={otherConditionRisk === 'High'}
                                                    onChange={(e) => setOtherConditionRisk(e.target.value)}
                                                /> 
                                                High Risk
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="risk-summary mt-4">
                                <h4>Assessed Risk Level</h4>
                                <div className={`risk-result risk-result--${formData.riskLevel.toLowerCase().split(' ')[0]}`}>
                                    {formData.riskLevel === 'High Risk' && <AlertTriangle size={20} />}
                                    <span>{formData.riskLevel}</span>
                                </div>
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
                                    <label>Auto-Scheduled Visits Preview</label>
                                    {formData.lmp && !loadingSchedule ? (
                                        schedulePreview.length > 0 ? (
                                            <div className="visit-calendar visit-calendar--preview">
                                                {schedulePreview.map((visit, i) => (
                                                    <div key={i} className={`calendar-day trimester-${visit.trimester}`}>
                                                        <div className="day-number">{new Date(visit.date).getDate()}</div>
                                                        <div className="week-label">{visit.week}w</div>
                                                        <div className="date-label">{new Date(visit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                                        <div className="visit-number">Visit {visit.visitNumber + 1}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div>No schedule available yet.</div>
                                        )
                                    ) : formData.lmp ? (
                                        <div>Loading calendar...</div>
                                    ) : (
                                        <div className="no-lmp">Enter LMP to see 9-visit calendar</div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Assigned Staff</label>
                                    <select name="retained_staff" value={formData.retained_staff} onChange={handleChange}>
                                        <option value="">{retainedStaffList.length} available</option>
                                        {retainedStaffList.map(staff => (
                                            <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                                        ))}
                                    </select>
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
                            </div>
                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label>Temperature (°C)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="temp"
                                        value={formData.temp}
                                        onChange={handleChange}
                                        placeholder="ex: 36.5"
                                    />
                                    {tempWarning && (
                                        <div className={`temp-warning temp-warning--${tempWarning.type}`}>
                                            <AlertTriangle size={14} />
                                            <span>{tempWarning.label} detected. Please double-check.</span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Pulse (bpm)</label>
                                    <input
                                        type="number"
                                        name="pulse"
                                        value={formData.pulse}
                                        onChange={handleChange}
                                    />
                                    {vitalWarnings.pulse && (
                                        <div className="vital-warning">
                                            <AlertTriangle size={14} />
                                            <span>Abnormal: {formData.pulse} bpm (Normal: 60-100 bpm)</span>
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
                                        className={missingFields.includes('emName') ? 'error-field' : ''}
                                    />
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
                                    <label>Address <span className="req">*</span></label>
                                    <input 
                                        type="text" 
                                        name="emAddress" 
                                        value={formData.emAddress} 
                                        onChange={handleChange} 
                                        className={missingFields.includes('emAddress') ? 'error-field' : ''}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPatient;
