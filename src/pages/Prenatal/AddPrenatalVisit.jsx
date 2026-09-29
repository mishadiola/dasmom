import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, ChevronRight, Save, X, Activity, Baby, HeartPulse,
    Thermometer, AlertTriangle, Calculator,
    Stethoscope, FileText, CheckCircle2, XCircle, CalendarCheck, MapPin
} from 'lucide-react';
import PatientService from '../../services/patientservice';
import { AuthContext } from '../../context/AuthContext';
import { formatMotherId } from '../../utils/displayIds';
import '../../styles/pages/AddPrenatalVisit.css';
import '../../styles/pages/PatientProfile.css';

const patientService = new PatientService();

const MEDICAL_TESTS = ['Hemoglobin', 'Urinalysis', 'Blood Type', 'Ultrasound'];
const RISK_FACTORS = ['None', 'Bleeding', 'Severe Headache', 'Swelling', 'High BP', 'Fever', 'Other'];

// Normal ranges for vital signs
const VITAL_RANGES = {
    fhr: { min: 110, max: 160, label: 'Fetal Heart Rate', unit: 'bpm' },
    temp: { min: 35.1, max: 37.5, label: 'Temperature', unit: '°C' },
    pulse: { min: 60, max: 100, label: 'Pulse', unit: 'bpm' }
};

const AddPrenatalVisit = () => {
    const navigate = useNavigate();
    const { patientId } = useParams();
    const { user } = useContext(AuthContext);
    const [toast, setToast] = useState(null);

    const [activeTab, setActiveTab] = useState('vitals'); // 'vitals', 'fetal', 'labs', 'danger'
    const [patient, setPatient] = useState(null);
    const [vitalWarnings, setVitalWarnings] = useState({});
    const [tempWarning, setTempWarning] = useState(null);
    const [vitalsErrors, setVitalsErrors] = useState({});
    const [dangerErrors, setDangerErrors] = useState({});

    // Form State - initialize with empty strings to avoid uncontrolled/controlled warnings
    const [formData, setFormData] = useState({
        testsDone: [],
        riskFactors: [],
        // Initialize all fields with empty strings to ensure controlled inputs
        name: '', id: '', station: '', age: '', edd: '', lmp: '',
        gestationalAge: '', trimester: '', gravida: '', para: '',
        visitDate: '', visitNumber: '',
        attendingMidwife: '', healthFacility: '', visitType: '',
        bpSystolic: '', bpDiastolic: '', weight: '', temp: '', pulse: '', rr: '',
        fundalHeight: '', fhr: '', fetalMovement: 'Normal', presentation: 'Cephalic',
        clinicalNotes: '', adviceGiven: '',
        referred: false, referralReason: [], referralDate: '',
        nextApptDate: '',
        calculatedRisk: 'Normal'
    });

    const [midwives, setMidwives] = useState([]);
    const [midwivesLoading, setMidwivesLoading] = useState(false);
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const saveInFlightRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [rebalanceRemainingSchedule, setRebalanceRemainingSchedule] = useState(false);

    // Fetch patient data
    useEffect(() => {
        if (patientId) {
            patientService.getPatientById(patientId).then(setPatient).catch(console.error);
        }
    }, [patientId]);

    // Set form data when patient loads
    useEffect(() => {
        if (patient && !isFormInitialized) {
            const pregnancyVisits = patient.currentPregnancy?.visits || [];
            const scheduledVisits = pregnancyVisits
                .filter(visit => visit.status === 'Scheduled')
                .sort((left, right) => Number(left.visit_number) - Number(right.visit_number));
            const nextScheduledVisit = scheduledVisits[0] || null;
            const maxVisitNumber = pregnancyVisits.reduce((max, visit) => Math.max(max, Number(visit.visit_number) || 0), 0);
            
            setFormData(prev => ({
                ...prev,
                ...patient,
                edd: patient.edd || '',
                gestationalAge: patient.weeks ? `${patient.weeks}w` : '',
                trimester: patient.trimester || '',
                visitDate: new Date().toISOString().split('T')[0],
                visitNumber: nextScheduledVisit?.visit_number || maxVisitNumber + 1,
                attendingMidwife: user?.id || '',
                healthFacility: patient.station || 'CHO 3 – Main Health Facility',
                healthFacility: patient.station || 'CHO 3 – Main Health Facility',
                fundalHeight: '', fhr: '', fetalMovement: 'Normal', presentation: 'Cephalic',
                testsDone: [], 
                riskFactors: ['None'], otherRiskFactor: '',
                calculatedRisk: patient.risk || 'Normal',
                clinicalNotes: '', adviceGiven: '',
                referred: false, referralReason: [], referralDate: '',
                nextApptDate: nextScheduledVisit?.visit_date ? String(nextScheduledVisit.visit_date).slice(0, 10) : ''
            }));
            setIsFormInitialized(true);
        }
    }, [patient, isFormInitialized, user]);

    // Smart Calculators: EDD, GA, Trimester
    useEffect(() => {
        if (formData.lmp && formData.visitDate) {
            const lmpDate = new Date(formData.lmp);
            const visitDateObj = new Date(formData.visitDate);

            // EDD
            const eddObj = new Date(lmpDate);
            eddObj.setDate(eddObj.getDate() + 280);

            // GA at time of visit
            const diffTime = Math.abs(visitDateObj - lmpDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const weeks = Math.floor(diffDays / 7);
            const days = diffDays % 7;

            // Trimester
            let tri = 1;
            if (weeks >= 13 && weeks <= 26) tri = 2;
            else if (weeks >= 27) tri = 3;

            setFormData(prev => ({
                ...prev,
                edd: eddObj.toISOString().split('T')[0],
                gestationalAge: `${weeks}w ${days}d`,
                trimester: tri
            }));
        }
    }, [formData.lmp, formData.visitDate]);

    // Smart Calculator: Risk Level & BP warning trigger
    useEffect(() => {
        let isHighRisk = false;

        // Risk factor checkboxes
        if (formData.riskFactors && formData.riskFactors.length > 0) isHighRisk = true;

        // BP check
        const sys = parseInt(formData.bpSystolic);
        const dia = parseInt(formData.bpDiastolic);
        if (sys >= 140 || dia >= 90) {
            isHighRisk = true;
            if (!formData.riskFactors.includes('High BP')) {
                // Auto add to factors if actual numbers are high
                setFormData(prev => ({ ...prev, riskFactors: [...prev.riskFactors, 'High BP'] }));
            }
        }

        // Base risk inheritance
        if (patient && patient.risk === 'High Risk') isHighRisk = true;

        setFormData(prev => ({
            ...prev,
            calculatedRisk: isHighRisk ? 'High Risk' : (prev.riskFactors && prev.riskFactors.length) ? 'Monitor' : 'Normal'
        }));

    }, [formData.riskFactors, formData.bpSystolic, formData.bpDiastolic, patient]);

    // Fetch midwives based on station
    useEffect(() => {
        if (formData.station) {
            setMidwivesLoading(true);
            patientService.getDoctorsByStation(formData.station).then(data => {
                setMidwives(data || []);
                setMidwivesLoading(false);
            }).catch(err => {
                console.error('Failed to fetch midwives:', err);
                setMidwives([]);
                setMidwivesLoading(false);
            });
        } else {
            setMidwives([]);
            setMidwivesLoading(false);
        }
    }, [formData.station]);

    // Handlers
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const isText = type === 'text' || e.target.tagName === 'TEXTAREA';
        const finalValue = isText ? value.toUpperCase() : value;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : finalValue
        }));

        setDangerErrors(prev => {
            if (Object.keys(prev).length === 0) return prev;
            const updated = { ...prev };
            if (updated[name]) delete updated[name];
            return updated;
        });

        setVitalsErrors(prev => {
            if (Object.keys(prev).length === 0) return prev;
            const updated = { ...prev };
            if (name === 'bpSystolic' || name === 'bpDiastolic') {
                const otherVal = name === 'bpSystolic' ? formData.bpDiastolic : formData.bpSystolic;
                if (String(finalValue).trim() !== '' && String(otherVal).trim() !== '') {
                    delete updated.bp;
                }
            } else if (updated[name] && String(finalValue).trim() !== '') {
                delete updated[name];
            }
            return updated;
        });

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
    };

    const handleNextFromVitals = () => {
        const errors = {};
        let firstErrorField = null;

        const bpSys = String(formData.bpSystolic || '').trim();
        const bpDia = String(formData.bpDiastolic || '').trim();
        if (!bpSys || !bpDia) {
            errors.bp = 'Blood pressure is required.';
            if (!firstErrorField) firstErrorField = 'bpSystolic';
        }
        
        if (!String(formData.weight || '').trim()) {
            errors.weight = 'Weight is required.';
            if (!firstErrorField) firstErrorField = 'weight';
        }
        
        if (!String(formData.temp || '').trim()) {
            errors.temp = 'Temperature is required.';
            if (!firstErrorField) firstErrorField = 'temp';
        }
        
        if (!String(formData.pulse || '').trim()) {
            errors.pulse = 'Pulse is required.';
            if (!firstErrorField) firstErrorField = 'pulse';
        }

        setVitalsErrors(errors);

        if (Object.keys(errors).length > 0) {
            const el = document.querySelector(`[name="${firstErrorField}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
            }
            return;
        }

        setActiveTab('fetal');
    };

    const handleRiskToggle = (factor) => {
        setFormData(prev => {
            let curr = [...(prev.riskFactors || [])];
            if (factor === 'None') {
                curr = ['None'];
            } else {
                curr = curr.filter(i => i !== 'None');
                if (curr.includes(factor)) {
                    curr = curr.filter(i => i !== factor);
                    if (curr.length === 0) curr = ['None'];
                } else {
                    curr.push(factor);
                }
            }
            return { ...prev, riskFactors: curr };
        });
    };

    const handleArrayToggle = (field, item) => {
        setFormData(prev => {
            const curr = prev[field];
            return {
                ...prev,
                [field]: curr.includes(item) ? curr.filter(i => i !== item) : [...curr, item]
            };
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();

        // Validation for Danger Signs section
        const hasRisk = formData.riskFactors && !formData.riskFactors.includes('None') && formData.riskFactors.length > 0;
        const errors = {};
        let firstErrorField = null;

        if (hasRisk) {
            if (!String(formData.clinicalNotes || '').trim()) {
                errors.clinicalNotes = 'Clinical notes are required when a danger sign or risk factor is present.';
                if (!firstErrorField) firstErrorField = 'clinicalNotes';
            }
            if (!String(formData.adviceGiven || '').trim()) {
                errors.adviceGiven = 'Advice / instructions are required when a danger sign or risk factor is present.';
                if (!firstErrorField) firstErrorField = 'adviceGiven';
            }
        }
        
        if (formData.riskFactors?.includes('Other') && !String(formData.otherRiskFactor || '').trim()) {
            errors.otherRiskFactor = 'Please specify the other risk factor.';
            if (!firstErrorField) firstErrorField = 'otherRiskFactor';
        }

        setDangerErrors(errors);

        if (Object.keys(errors).length > 0) {
            const el = document.querySelector([name="${firstErrorField}"]);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
            }
            return;
        }

        if (isSaving || saveInFlightRef.current) return;
        saveInFlightRef.current = true;
        setIsSaving(true);
        try {
            const createdBy = await patientService.getCurrentUserId();
            if (!createdBy) throw new Error('Not authenticated');

            const currentPregnancyVisits = patient.currentPregnancy?.visits || [];
            const currentPregnancyVisitIds = currentPregnancyVisits.map(visit => visit.id).filter(Boolean);
            const { data: allVisits, error: visitsError } = await patientService.supabase
                .from('prenatal_visits')
                .select('*')
                .eq('patient_id', patientId)
                .order('visit_date', { ascending: true });
            if (visitsError) throw visitsError;
            const currentPregnancyVisitIdSet = new Set(currentPregnancyVisitIds);
            const visits = (allVisits || []).filter(visit => currentPregnancyVisitIdSet.has(visit.id));

            const scheduledVisits = visits
                .filter(visit => visit.status === 'Scheduled')
                .sort((left, right) => Number(left.visit_number) - Number(right.visit_number));
            const visitDateStr = formData.visitDate;
            const exactMatch = scheduledVisits.find(visit => String(visit.visit_date).slice(0, 10) === visitDateStr);
            const isOffSchedule = scheduledVisits.length > 0 && !exactMatch;
            const targetVisit = exactMatch || scheduledVisits[0] || null;
            const maxVisitNumber = visits.reduce((max, visit) => Math.max(max, Number(visit.visit_number) || 0), 0);

            const rowVisitNumber = targetVisit ? Number(targetVisit.visit_number) : maxVisitNumber + 1;
            const rowVisitDate = formData.visitDate;
            const rowId = exactMatch ? exactMatch.id : (isOffSchedule ? null : targetVisit?.id || null);

            if (isOffSchedule) {
                await patientService.shiftPrenatalVisitsForInsertion(
                    patientId,
                    visits,
                    rowVisitNumber
                );
            }

            console.log('Target visit info:', { 
                rowVisitNumber, 
                rowVisitDate, 
                rowId, 
                scheduledCount: scheduledVisits.length,
                scheduledVisits: scheduledVisits.map(v => ({ id: v.id, visit_number: v.visit_number, visit_date: v.visit_date, status: v.status }))
            });

            const visitData = {
                patient_id: patientId,
                created_by: createdBy,
                visit_date: rowVisitDate,
                visit_number: rowVisitNumber,
                trimester: formData.trimester,
                gestational_age: formData.gestationalAge,
                bp_systolic: formData.bpSystolic ? parseInt(formData.bpSystolic) : null,
                bp_diastolic: formData.bpDiastolic ? parseInt(formData.bpDiastolic) : null,
                weight_kg: formData.weight ? parseFloat(formData.weight) : null,
                temp_c: formData.temp ? parseFloat(formData.temp) : null,
                pulse_bpm: formData.pulse ? parseInt(formData.pulse) : null,
                resp_rate_cpm: formData.rr ? parseInt(formData.rr) : null,
                fundal_height_cm: formData.fundalHeight ? parseFloat(formData.fundalHeight) : null,
                fhr_bpm: formData.fhr ? parseInt(formData.fhr) : null,
                fetal_movement: formData.fetalMovement || null,
                presentation: formData.presentation || null,
                tests_done: formData.testsDone || [],
                clinical_notes: formData.clinicalNotes || null,
                advice_given: formData.adviceGiven || null,
                is_referred: formData.referred || false,
                referred_to: null,
                referral_reason: formData.referralReason?.length > 0 ? formData.referralReason.join(', ') : null,
                next_appt_date: formData.nextApptDate || null,
                next_appt_type: null,
                status: 'Attended',
                attended_date: formData.visitDate || new Date().toISOString().split('T')[0],
                assigned_staff: formData.attendingMidwife || null,
                risk_factors: formData.riskFactors?.length > 0 
                    ? formData.riskFactors.filter(f => f !== 'None').map(f => f === 'Other' ? formData.otherRiskFactor : f).join(', ') 
                    : null,
                calculated_risk: formData.calculatedRisk,
            };

            let currentVisitId = rowId;
            if (rowId) {
                // Update only the specific visit by ID
                const { data: updatedVisit, error: updateError } = await patientService.supabase
                    .from('prenatal_visits')
                    .update(visitData)
                    .eq('id', rowId)
                    .select('id')
                    .single();
                
                if (updateError) throw updateError;
                currentVisitId = updatedVisit.id;
                console.log(`Updated visit ${rowVisitNumber} with ID ${rowId}`);
            } else {
                const { data: insertedVisit, error: insertError } = await patientService.supabase
                    .from('prenatal_visits')
                    .insert(visitData)
                    .select('id')
                    .single();
                
                if (insertError) throw insertError;
                currentVisitId = insertedVisit.id;
                console.log(`Inserted new visit ${rowVisitNumber}`);
            }

            if (!isOffSchedule || rebalanceRemainingSchedule) {
                await patientService.rebalancePrenatalSchedule(
                    patientId,
                    formData.lmp,
                    rowVisitNumber,
                    rowVisitDate,
                    createdBy,
                    { retained_staff: formData.attendingMidwife || null },
                    35,
                    [...currentPregnancyVisitIds, currentVisitId],
                    currentVisitId
                );
            }

            console.log(`Patient ${patientId} visit ${rowVisitNumber} recorded${rebalanceRemainingSchedule ? '; remaining schedule rebalanced' : ''}.`);

            window.scrollTo(0, 0);
            setToast({ type: 'success', message: 'Prenatal visit successfully recorded!' });
            setTimeout(() => navigate('/dashboard/prenatal'), 1500);
        } catch (err) {
            console.error('Error saving visit:', err);
            setToast({ type: 'error', message: 'Error recording visit: ' + err.message });
        } finally {
            saveInFlightRef.current = false;
            setIsSaving(false);
        }
    };

    // Derived flags for UI
    const isHighBP = parseInt(formData.bpSystolic) >= 140 || parseInt(formData.bpDiastolic) >= 90;
    const currentPregnancyVisits = patient?.currentPregnancy?.visits || [];
    const scheduledPregnancyVisits = currentPregnancyVisits
        .filter(visit => visit.status === 'Scheduled')
        .sort((left, right) => Number(left.visit_number) - Number(right.visit_number));
    const isOutsideScheduledDate = scheduledPregnancyVisits.length > 0
        && !scheduledPregnancyVisits.some(visit => String(visit.visit_date).slice(0, 10) === formData.visitDate);

    if (!patient) {
        return <div className="loading">Loading patient data...</div>;
    }

    return (
        <div className="add-pvisit-page">
            {toast && (
                <div className={`toast toast--${toast.type}`}>
                    <span>{toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {toast.message}</span>
                    <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
                </div>
            )}

            {/* Header */}
            <div className="apv-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button 
                        onClick={() => navigate(-1)} 
                        type="button"
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--color-text-muted)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            cursor: 'pointer',
                            padding: 0
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-primary-accent)'; e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.textDecoration = 'none'; }}
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <span style={{ color: '#cbd5e1', fontSize: '18px', margin: '0 4px', fontWeight: '300' }}>/</span>
                    <h1 className="apv-title" style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'var(--color-text)' }}>Record Prenatal Visit</h1>
                </div>
                <div className="apv-actions">
                    <button className="btn btn-outline" onClick={() => navigate(-1)} type="button">Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} form="pv-form" type="button" disabled={isSaving}>
                        <Save size={15} /> {isSaving ? 'Saving...' : 'Save Visit'}
                    </button>
                </div>
            </div>

            <form id="pv-form" className="apv-form-container" onSubmit={handleSave}>

                {/* Left Column: Core Medical Data */}
                <div className="apv-main-col">

                    {/* SECTION 1: Patient Info */}
                    <section className="apv-section sticky-patient-info" style={{ 
                        background: '#ffffff', 
                        border: '1px solid var(--color-border)', 
                        padding: '24px 32px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div className="profile-avatar-lg">
                                {formData.name ? formData.name.split(' ').map(n => n[0]).join('').substring(0, 2) : '??'}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <h2 style={{ color: 'var(--color-text)', fontSize: '20px', fontWeight: '800', margin: 0, textTransform: 'uppercase' }}>
                                        {formData.name}
                                    </h2>
                                </div>
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: '500' }}>
                                    ID: {formatMotherId(formData.id)} · {formData.age} years old · <MapPin size={12} style={{ display: 'inline', marginLeft: '2px', marginRight: '2px' }} /> {formData.station}
                                </div>
                            </div>
                        </div>

                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            backgroundColor: '#f8f9fb',
                            border: '1px solid var(--color-border)',
                            borderRadius: '12px',
                            padding: '12px 24px'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '24px', borderRight: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Gestation</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)' }}>{formData.gestationalAge || '--'}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 24px', borderRight: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Trimester</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)' }}>
                                    {formData.trimester ? (formData.trimester === 1 ? '1st' : formData.trimester === 2 ? '2nd' : formData.trimester === 3 ? '3rd' : formData.trimester) + ' Trimester' : '--'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 24px', borderRight: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Gravida / Para</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)' }}>G{formData.gravida} P{formData.para}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '24px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Risk Level</span>
                                <span className={`risk-tag risk-${formData.calculatedRisk?.replace(' ', '-').toLowerCase() || 'normal'}`} style={{ margin: 0, display: 'inline-block', width: 'fit-content' }}>
                                    {formData.calculatedRisk}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* TABS CONTAINER */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                        {/* TABS HEADER */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #eef0f4' }}>
                            <button type="button" className={`apv-tab-btn ${activeTab === 'vitals' ? 'active' : ''}`} onClick={() => setActiveTab('vitals')}>
                                <Activity size={16} style={{ marginRight: '8px' }} /> Maternal Vital Signs
                            </button>
                            <ChevronRight size={16} style={{ color: '#d1d6e0', margin: '0 4px' }} />
                            <button type="button" className={`apv-tab-btn ${activeTab === 'fetal' ? 'active' : ''}`} onClick={() => setActiveTab('fetal')}>
                                <Baby size={16} style={{ marginRight: '8px' }} /> Fetal Assessment
                            </button>
                            <ChevronRight size={16} style={{ color: '#d1d6e0', margin: '0 4px' }} />
                            <button type="button" className={`apv-tab-btn ${activeTab === 'danger' ? 'active' : ''}`} onClick={() => setActiveTab('danger')}>
                                <AlertTriangle size={16} style={{ marginRight: '8px' }} /> Danger Signs / Risk Factors
                            </button>
                        </div>

                        {/* TAB CONTENT AREA */}
                        <div className="apv-tab-content">
                            {activeTab === 'vitals' && (
                                <section className="apv-section" style={{ margin: 0 }}>
                                <h3 className="section-head"><Activity size={18} /> Maternal Vital Signs</h3>

                                <div className="vitals-grid">
                                    <div className={`form-group bp-group ${isHighBP ? 'has-warning' : ''}`}>
                                        <label>Blood Pressure <span style={{ color: '#ef4444' }}>*</span>
                                            {isHighBP && <span className="inline-warn"><AlertTriangle size={12} /> High BP Alert</span>}
                                        </label>
                                        <div className="bp-inputs" style={vitalsErrors.bp ? { border: '1px solid #ef4444', borderRadius: '8px' } : {}}>
                                            <input type="number" name="bpSystolic" value={formData.bpSystolic} onChange={handleChange} placeholder="Sys" required />
                                            <span>/</span>
                                            <input type="number" name="bpDiastolic" value={formData.bpDiastolic} onChange={handleChange} placeholder="Dia" required />
                                        </div>
                                        {vitalsErrors.bp && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{vitalsErrors.bp}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Weight (kg) <span style={{ color: '#ef4444' }}>*</span></label>
                                        <div className="input-with-icon">
                                            <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} required style={vitalsErrors.weight ? { border: '1px solid #ef4444' } : {}} />
                                        </div>
                                        {vitalsErrors.weight && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{vitalsErrors.weight}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Temp (°C) <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="number" step="0.1" name="temp" value={formData.temp} onChange={handleChange} placeholder="ex: 36.5" required style={vitalsErrors.temp ? { border: '1px solid #ef4444' } : {}} />
                                        {vitalsErrors.temp && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{vitalsErrors.temp}</span>}
                                        {tempWarning && !vitalsErrors.temp && (
                                            <div className={`temp-warning temp-warning--${tempWarning.type}`}>
                                                <AlertTriangle size={14} />
                                                <span>{tempWarning.label} detected. Please double-check.</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Pulse (bpm) <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="number" name="pulse" value={formData.pulse} onChange={handleChange} required style={vitalsErrors.pulse ? { border: '1px solid #ef4444' } : {}} />
                                        {vitalsErrors.pulse && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{vitalsErrors.pulse}</span>}
                                        {vitalWarnings.pulse && !vitalsErrors.pulse && (
                                            <div className="vital-warning">
                                                <AlertTriangle size={14} />
                                                <span>Abnormal: {formData.pulse} bpm (Normal: 60-100 bpm)</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Resp. Rate (cpm)</label>
                                        <input type="number" name="rr" value={formData.rr} onChange={handleChange} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                                    <button type="button" className="btn-next-tab" onClick={handleNextFromVitals} title="Next Section">
                                        <ArrowRight size={20} />
                                    </button>
                                </div>
                            </section>
                        )}

                        {activeTab === 'fetal' && (
                            <section className="apv-section" style={{ margin: 0 }}>
                                <h3 className="section-head"><Baby size={18} /> Fetal Assessment</h3>

                                <div className="fetal-grid">
                                    <div className="form-group">
                                        <label>Fundal Height (cm)</label>
                                        <input type="number" name="fundalHeight" value={formData.fundalHeight} onChange={handleChange} />
                                    </div>
                                    <div className="form-group">
                                        <label>Fetal Heart Rate (bpm)</label>
                                        <input type="number" name="fhr" value={formData.fhr} onChange={handleChange} />
                                        {vitalWarnings.fhr && (
                                            <div className="vital-warning">
                                                <AlertTriangle size={14} />
                                                <span>Abnormal: {formData.fhr} bpm (Normal: 110-160 bpm)</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Fetal Movement</label>
                                        <select name="fetalMovement" value={formData.fetalMovement} onChange={handleChange}>
                                            <option value="Normal">Normal</option>
                                            <option value="Decreased">Decreased</option>
                                            <option value="Absent">Absent</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Presentation</label>
                                        <select name="presentation" value={formData.presentation} onChange={handleChange}>
                                            <option value="Cephalic">Cephalic (Head down)</option>
                                            <option value="Breech">Breech</option>
                                            <option value="Transverse">Transverse</option>
                                            <option value="Unknown">Unknown / Too early</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                                    <button type="button" className="btn-next-tab" onClick={() => setActiveTab('danger')} title="Next Section">
                                        <ArrowRight size={20} />
                                    </button>
                                </div>
                            </section>
                        )}

                        {activeTab === 'danger' && (
                            <section className="apv-section alert-section" style={{ margin: 0 }}>
                                <h3 className="section-head text-danger"><AlertTriangle size={18} /> Danger Signs / Risk Factors observed</h3>
                                <p className="section-sub">Select any applicable symptoms. System will auto-flag patient as High Risk.</p>

                                <div className="risk-tags">
                                    {RISK_FACTORS.map(factor => (
                                        <button
                                            type="button"
                                            key={factor}
                                            className={`risk-btn ${formData.riskFactors?.includes(factor) ? 'active' : ''}`}
                                            onClick={() => handleRiskToggle(factor)}
                                        >
                                            {factor}
                                        </button>
                                    ))}
                                </div>
                                {formData.riskFactors?.includes('Other') && (
                                    <div className="form-group" style={{marginTop: '16px'}}>
                                        <label>Other danger sign / risk factor <span className="req">*</span></label>
                                        <input
                                            type="text"
                                            name="otherRiskFactor"
                                            value={formData.otherRiskFactor || ''}
                                            onChange={handleChange}
                                            placeholder="Enter danger sign or risk factor..."
                                            className={dangerErrors?.otherRiskFactor ? 'error-field' : ''}
                                        />
                                        {dangerErrors?.otherRiskFactor && (
                                            <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                                {dangerErrors.otherRiskFactor}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                </div>

                <section className="apv-section" style={{ margin: 0 }}>
                        <h3 className="section-head"><FileText size={18} /> Clinical Notes & Findings</h3>
                        <div className="notes-grid">
                            <div className="form-group">
                                <label>Clinical Notes {(!formData.riskFactors?.includes('None') && formData.riskFactors?.length > 0) && <span className="req">*</span>}</label>
                                <textarea
                                    name="clinicalNotes" rows="3"
                                    value={formData.clinicalNotes} onChange={handleChange}
                                    placeholder="Enter physical exam findings, complaints..."
                                    className={dangerErrors?.clinicalNotes ? 'error-field' : ''}
                                />
                                {dangerErrors?.clinicalNotes && (
                                    <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                        {dangerErrors.clinicalNotes}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Advice / Instructions Given {(!formData.riskFactors?.includes('None') && formData.riskFactors?.length > 0) && <span className="req">*</span>}</label>
                                <textarea
                                    name="adviceGiven" rows="3"
                                    value={formData.adviceGiven} onChange={handleChange}
                                    placeholder="Dietary advice, rest required..."
                                    className={dangerErrors?.adviceGiven ? 'error-field' : ''}
                                />
                                {dangerErrors?.adviceGiven && (
                                    <span className="field-error-msg" style={{color: 'var(--color-rose)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                                        {dangerErrors.adviceGiven}
                                    </span>
                                )}
                            </div>
                        </div>
                    </section>

                </div>

                {/* Right Column: Administrative & Scheduling */}
                <div className="apv-side-col">

                    {/* SECTION 2: Visit Details */}
                    <div className="apv-side-card">
                        <h3 className="side-head">Visit Details</h3>
                        <div className="form-group">
                            <label>Visit Date</label>
                            <input type="date" name="visitDate" value={formData.visitDate} readOnly className="read-only" />
                            <small style={{marginTop: '4px', display: 'block', color: '#999'}}>Auto-assigned. Date is fixed for this visit.</small>
                        </div>
                        <div className="form-group mt-2">
                            <label>Visit Number</label>
                            <input type="number" readOnly className="read-only" value={formData.visitNumber} />
                        </div>
                        {isOutsideScheduledDate && (
                            <div className="form-group mt-2" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', cursor: 'pointer', fontWeight: '500', color: 'var(--color-text)', margin: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={rebalanceRemainingSchedule}
                                        onChange={event => setRebalanceRemainingSchedule(event.target.checked)}
                                        style={{ margin: 0, cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                                    />
                                    <span style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>Adjust Remaining Visits</span>
                                </label>
                                <small style={{ display: 'block', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                                    Automatically adjust the dates and visit numbers of the remaining scheduled prenatal visits based on this visit.
                                </small>
                            </div>
                        )}
                        <div className="form-group mt-2">
                            <label>Health Facility</label>
                            <select name="healthFacility" value={formData.healthFacility} onChange={handleChange}>
                                {patient?.station && patient.station !== 'CHO 3 – Main Health Facility' && (
                                    <option value={patient.station}>{patient.station}</option>
                                )}
                                <option value="CHO 3 – Main Health Facility">CHO 3 – Main Health Facility</option>
                            </select>
                        </div>
                        <div className="form-group mt-2">
                            <label>Attending Midwife / Doctor</label>
                            <select name="attendingMidwife" value={formData.attendingMidwife} onChange={handleChange}>
                                <option value="">Select Midwife</option>
                                {midwivesLoading ? (
                                    <option disabled>Loading...</option>
                                ) : (
                                    midwives.map(midwife => (
                                        <option key={midwife.id} value={midwife.id}>{midwife.full_name}</option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>

                    {/* SECTION 8: Next Appointment */}
                    <div className="apv-side-card appt-card">
                        <h3 className="side-head text-primary"><CalendarCheck size={18} /> Next Appointment</h3>
                        <div className="form-group mt-2">
                            <label>Next Visit Date</label>
                            <input type="date" name="nextApptDate" value={formData.nextApptDate} readOnly className="read-only" />
                        </div>
                    </div>

                    {/* SECTION 9: Referral */}
                    <div className="apv-side-card referral-card">
                        <div className="ref-toggle">
                            <label className="check-lbl">
                                <input
                                    type="checkbox"
                                    name="referred"
                                    checked={formData.referred}
                                    onChange={handleChange}
                                />
                                <span className="side-head mb-0">Refer Patient to Hospital</span>
                            </label>
                        </div>

                    </div>

                </div>

            </form>
        </div>
    );
};

export default AddPrenatalVisit;
