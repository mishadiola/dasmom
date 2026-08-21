import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, ChevronRight, Save, X, Activity, Baby, HeartPulse,
    Thermometer, AlertTriangle, Calculator,
    Stethoscope, FileText, CheckCircle2, XCircle, CalendarCheck
} from 'lucide-react';
import PatientService from '../../services/patientservice';
import { AuthContext } from '../../context/AuthContext';
import '../../styles/pages/AddPrenatalVisit.css';

const patientService = new PatientService();

const MEDICAL_TESTS = ['Hemoglobin', 'Urinalysis', 'Blood Type', 'Ultrasound'];
const RISK_FACTORS = ['Bleeding', 'Severe Headache', 'Swelling', 'High BP', 'Fever', 'Previous Complications'];

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

    // Fetch patient data
    useEffect(() => {
        if (patientId) {
            patientService.getPatientById(patientId).then(setPatient).catch(console.error);
        }
    }, [patientId]);

    // Set form data when patient loads
    useEffect(() => {
        if (patient && !isFormInitialized) {
            const attendedCount = patient.visits?.filter(v => v.status === 'Attended').length || 0;
            const scheduledVisits = (patient.visits || []).filter(v => v.status === 'Scheduled');
            
            // Find the most recent scheduled visit (highest visit_number) to record the current visit
            // This is the visit where we'll input the records
            const mostRecentScheduled = scheduledVisits.length > 0 
                ? scheduledVisits.reduce((prev, current) => {
                    return (parseInt(prev.visit_number) > parseInt(current.visit_number)) ? prev : current;
                })
                : null;
            
            setFormData(prev => ({
                ...prev,
                ...patient,
                edd: patient.edd || '',
                gestationalAge: patient.weeks ? `${patient.weeks}w` : '',
                trimester: patient.trimester || '',
                visitDate: new Date().toISOString().split('T')[0],
                visitNumber: attendedCount + 1,
                attendingMidwife: user?.id || '',
                healthFacility: patient.station || 'CHO 3 – Main Health Facility',
                bpSystolic: '', bpDiastolic: '', weight: '', temp: '', pulse: '', rr: '',
                fundalHeight: '', fhr: '', fetalMovement: 'Normal', presentation: 'Cephalic',
                testsDone: [], 
                riskFactors: patient.medicalConditions || [],
                calculatedRisk: patient.risk || 'Normal',
                clinicalNotes: '', adviceGiven: '',
                referred: false, referralReason: [], referralDate: '',
                nextApptDate: (mostRecentScheduled?.visit_date) ? new Date(mostRecentScheduled.visit_date).toISOString().split('T')[0] : ''
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
        try {
            const createdBy = await patientService.getCurrentUserId();
            if (!createdBy) throw new Error('Not authenticated');

            const { data: visits } = await patientService.supabase
                .from('prenatal_visits')
                .select('*')
                .eq('patient_id', patientId)
                .order('visit_date', { ascending: true });

            // Find the maximum attended visit number
            const attendedVisits = (visits || []).filter(v => v.status === 'Attended');
            const maxAttendedNumber = attendedVisits.length > 0 ? Math.max(...attendedVisits.map(v => v.visit_number || 0)) : 0;
            
            // Get all scheduled visits sorted by visit_number
            const scheduledVisits = (visits || []).filter(v => v.status === 'Scheduled').sort((a, b) => a.visit_number - b.visit_number);
            
            // Find the target visit to edit:
            // 1. First, try to find a scheduled visit that matches the actual visit date
            // 2. If not found, use the NEXT scheduled visit (lowest visit_number among scheduled)
            // 3. If no scheduled visits, create a new one
            let targetVisit = null;
            const visitDateStr = formData.visitDate;
            
            if (scheduledVisits.length > 0) {
                // Try to find a scheduled visit that matches the actual visit date
                const exactMatch = scheduledVisits.find(v => v.visit_date === visitDateStr);
                if (exactMatch) {
                    targetVisit = exactMatch;
                } else {
                    // Use the NEXT scheduled visit (lowest visit_number) - this is the one to update
                    // This should be the first scheduled visit after the last attended visit
                    targetVisit = scheduledVisits[0];
                }
            }

            const rowVisitNumber = targetVisit ? targetVisit.visit_number : (maxAttendedNumber + 1);
            const rowVisitDate = formData.visitDate;
            const rowId = targetVisit ? targetVisit.id : null;

            console.log('Target visit info:', { 
                rowVisitNumber, 
                rowVisitDate, 
                rowId, 
                maxAttendedNumber, 
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
                risk_factors: formData.riskFactors.length > 0 ? formData.riskFactors.join(', ') : null,
                calculated_risk: formData.calculatedRisk,
            };

            if (rowId) {
                // Update only the specific visit by ID
                const { error: updateError } = await patientService.supabase
                    .from('prenatal_visits')
                    .update(visitData)
                    .eq('id', rowId)
                    .select();
                
                if (updateError) throw updateError;
                console.log(`Updated visit ${rowVisitNumber} with ID ${rowId}`);
            } else {
                const { error: insertError } = await patientService.supabase
                    .from('prenatal_visits')
                    .insert(visitData)
                    .select();
                
                if (insertError) throw insertError;
                console.log(`Inserted new visit ${rowVisitNumber}`);
            }

            await patientService.rebalancePrenatalSchedule(
                patientId,
                formData.lmp,
                rowVisitNumber,
                rowVisitDate,
                createdBy,
                { retained_staff: formData.attendingMidwife || null },
                35
            );

            console.log(`✅ Patient ${patientId} visit ${rowVisitNumber} marked attended; remaining schedule rebalanced starting from ${rowVisitDate}.`);

            window.scrollTo(0, 0);
            setToast({ type: 'success', message: 'Prenatal visit successfully recorded!' });
            setTimeout(() => navigate('/dashboard/prenatal'), 1500);
        } catch (err) {
            console.error('Error saving visit:', err);
            setToast({ type: 'error', message: 'Error recording visit: ' + err.message });
        }
    };

    // Derived flags for UI
    const isHighBP = parseInt(formData.bpSystolic) >= 140 || parseInt(formData.bpDiastolic) >= 90;

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
            <div className="apv-header">
                <div>
                    <button className="back-link" onClick={() => navigate(-1)} type="button">
                        <ArrowLeft size={16} /> Back to Visits
                    </button>
                    <h1 className="apv-title">Record Prenatal Visit</h1>
                </div>
                <div className="apv-actions">
                    <button className="btn btn-outline" onClick={() => navigate(-1)} type="button">Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} form="pv-form" type="button">
                        <Save size={15} /> Save Visit
                    </button>
                </div>
            </div>

            <form id="pv-form" className="apv-form-container" onSubmit={handleSave}>

                {/* Left Column: Core Medical Data */}
                <div className="apv-main-col">

                    {/* SECTION 1: Patient Info */}
                    <section className="apv-section sticky-patient-info" style={{ background: '#fff3cd', border: '1px solid #ffe69c', padding: '24px 32px' }}>
                        <div className="pi-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="pi-main" style={{ color: 'var(--color-text)', flex: 1, borderRight: '1px solid rgba(0,0,0,0.08)', paddingRight: '24px' }}>
                                <h2 style={{ color: 'var(--color-text)', marginBottom: '8px', fontSize: '24px', fontWeight: '700' }}>{formData.name}</h2>
                                <span style={{ color: 'var(--color-text-muted)', fontWeight: '500', fontSize: '14px' }}>{formData.id}</span>
                                <div style={{ color: 'var(--color-text-muted)', fontWeight: '500', fontSize: '14px', marginTop: '4px' }}>{formData.age} yrs · {formData.station}</div>
                            </div>
                            <div className="pi-stats" style={{ background: 'transparent', display: 'flex', gap: '32px', paddingLeft: '32px', flex: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <small style={{ color: 'var(--color-text-muted)', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Gestation</small>
                                    <strong style={{ color: 'var(--color-text)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <CalendarCheck size={18} /> {formData.gestationalAge || '--'}
                                    </strong>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <small style={{ color: 'var(--color-text-muted)', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Trimester</small>
                                    <strong style={{ color: 'var(--color-text)', fontSize: '1.1rem', backgroundColor: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ffe69c' }}>
                                        {formData.trimester || '--'}
                                    </strong>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <small style={{ color: 'var(--color-text-muted)', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Gravida/Para</small>
                                    <strong style={{ color: 'var(--color-text)', fontSize: '1.1rem', backgroundColor: '#fff', padding: '6px 16px', borderRadius: '20px', border: '1px solid #ffe69c' }}>
                                        G{formData.gravida} P{formData.para}
                                    </strong>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', borderLeft: '1px solid rgba(0,0,0,0.08)', paddingLeft: '32px' }}>
                                    <small style={{ color: 'var(--color-text-muted)', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Risk Level</small>
                                    <strong style={{ 
                                        fontSize: '1.05rem', 
                                        backgroundColor: formData.calculatedRisk === 'High Risk' ? '#fee2e2' : '#d1fae5', 
                                        color: formData.calculatedRisk === 'High Risk' ? '#b91c1c' : '#065f46',
                                        padding: '6px 16px', 
                                        borderRadius: '20px',
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        border: formData.calculatedRisk === 'High Risk' ? '1px solid #fecaca' : '1px solid #a7f3d0'
                                    }}>
                                        {formData.calculatedRisk === 'High Risk' && <AlertTriangle size={16} />}
                                        {formData.calculatedRisk}
                                    </strong>
                                </div>
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
                                        <label>Blood Pressure
                                            {isHighBP && <span className="inline-warn"><AlertTriangle size={12} /> High BP Alert</span>}
                                        </label>
                                        <div className="bp-inputs">
                                            <input type="number" name="bpSystolic" value={formData.bpSystolic} onChange={handleChange} placeholder="Sys" required />
                                            <span>/</span>
                                            <input type="number" name="bpDiastolic" value={formData.bpDiastolic} onChange={handleChange} placeholder="Dia" required />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Weight (kg)</label>
                                        <div className="input-with-icon">
                                            <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} required />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Temp (°C)</label>
                                        <input type="number" step="0.1" name="temp" value={formData.temp} onChange={handleChange} placeholder="ex: 36.5" required />
                                        {tempWarning && (
                                            <div className={`temp-warning temp-warning--${tempWarning.type}`}>
                                                <AlertTriangle size={14} />
                                                <span>{tempWarning.label} detected. Please double-check.</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Pulse (bpm)</label>
                                        <input type="number" name="pulse" value={formData.pulse} onChange={handleChange} required />
                                        {vitalWarnings.pulse && (
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
                                    <button type="button" className="btn-next-tab" onClick={() => setActiveTab('fetal')} title="Next Section">
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
                                            className={`risk-btn ${formData.riskFactors.includes(factor) ? 'active' : ''}`}
                                            onClick={() => handleArrayToggle('riskFactors', factor)}
                                        >
                                            {factor}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                <section className="apv-section" style={{ margin: 0 }}>
                        <h3 className="section-head"><FileText size={18} /> Clinical Notes & Findings</h3>
                        <div className="notes-grid">
                            <div className="form-group">
                                <label>Clinical Notes</label>
                                <textarea
                                    name="clinicalNotes" rows="3"
                                    value={formData.clinicalNotes} onChange={handleChange}
                                    placeholder="Enter physical exam findings, complaints..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Advice / Instructions Given</label>
                                <textarea
                                    name="adviceGiven" rows="3"
                                    value={formData.adviceGiven} onChange={handleChange}
                                    placeholder="Dietary advice, rest required..."
                                />
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
