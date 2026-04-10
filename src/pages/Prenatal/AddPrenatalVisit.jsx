import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, X, Activity, Baby, HeartPulse,
    Thermometer, ShieldAlert, AlertTriangle, Calculator,
    Stethoscope, FileText, CheckCircle2, XCircle
} from 'lucide-react';
import '../../styles/pages/AddPrenatalVisit.css';

// Mock Patient Data for auto-filling the first section
const MOCK_PATIENT = {
    id: 'PT-2026105',
    name: 'Maria Santos',
    age: 28,
    station: 'Station 3',
    gravida: 2,
    para: 1,
    lmp: '2025-09-10',
    baseRisk: 'Normal'
};

const MEDICAL_TESTS = ['Hemoglobin', 'Urinalysis', 'Blood Type', 'Ultrasound'];
const SUPPLEMENTS = ['Iron', 'Folic Acid', 'Calcium', 'Tetanus Toxoid'];
const RISK_FACTORS = ['Bleeding', 'Severe Headache', 'Swelling', 'High BP', 'Fever', 'Previous Complications'];

const AddPrenatalVisit = () => {
    const navigate = useNavigate();
    const [toast, setToast] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        // 1. Patient Info (readonly populated)
        ...MOCK_PATIENT,
        edd: '',
        gestationalAge: '',

        // 2. Visit Details
        visitDate: new Date().toISOString().split('T')[0],
        visitNumber: 4,
        trimester: '',
        attendingMidwife: '',
        healthFacility: 'Dasma CHO',
        visitType: 'Facility Visit', // Home or Facility

        // 3. Maternal Vitals
        bpSystolic: '', bpDiastolic: '', weight: '', temp: '', pulse: '', rr: '',

        // 4. Fetal Assessment
        fundalHeight: '', fhr: '', fetalMovement: 'Normal', presentation: 'Cephalic',

        // 5. Labs & Supplements
        testsDone: [], supplementsGiven: [],

        // 6. Risk Assessment
        riskFactors: [], calculatedRisk: MOCK_PATIENT.baseRisk,

        // 7. Notes
        clinicalNotes: '', adviceGiven: '',

        // 8. Referral
        referred: false, referredTo: '', referralReason: '', referralDate: '',

        // 9. Next Appt
        nextApptDate: '', remiderEnabled: true, nextApptType: 'Routine Checkup'
    });

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
        if (formData.riskFactors.length > 0) isHighRisk = true;

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
        if (MOCK_PATIENT.baseRisk === 'High Risk') isHighRisk = true;

        setFormData(prev => ({
            ...prev,
            calculatedRisk: isHighRisk ? 'High Risk' : prev.riskFactors.length ? 'Monitor' : 'Normal'
        }));

    }, [formData.riskFactors, formData.bpSystolic, formData.bpDiastolic]);


    // Handlers
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const isText = type === 'text' || e.target.tagName === 'TEXTAREA';
        const finalValue = isText ? value.toUpperCase() : value;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : finalValue
        }));
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

    const handleSave = (e) => {
        e.preventDefault();
        window.scrollTo(0, 0);
        setToast({ type: 'success', message: 'Prenatal visit successfully recorded!' });
        setTimeout(() => navigate('/dashboard/prenatal'), 1500);
    };

    // Derived flags for UI
    const isHighBP = parseInt(formData.bpSystolic) >= 140 || parseInt(formData.bpDiastolic) >= 90;

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
                    <section className="apv-section sticky-patient-info">
                        <div className="pi-grid">
                            <div className="pi-main">
                                <h2>{formData.name}</h2>
                                <span>{formData.id} · {formData.age} yrs · {formData.station}</span>
                            </div>
                            <div className="pi-stats">
                                <div className="pi-stat-box">
                                    <small>Gestation</small>
                                    <strong>{formData.gestationalAge || '--'}</strong>
                                </div>
                                <div className="pi-stat-box">
                                    <small>Trimester</small>
                                    <strong>{formData.trimester || '--'}</strong>
                                </div>
                                <div className="pi-stat-box">
                                    <small>Gravida/Para</small>
                                    <strong>G{formData.gravida} P{formData.para}</strong>
                                </div>
                                <div className={`pi-stat-box risk-box rb-${formData.calculatedRisk.replace(' ', '-').toLowerCase()}`}>
                                    <small>Risk Level</small>
                                    <strong>
                                        {formData.calculatedRisk === 'High Risk' && <AlertTriangle size={14} />}
                                        {formData.calculatedRisk}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 3: Maternal Vitals */}
                    <section className="apv-section">
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
                                <input type="number" step="0.1" name="temp" value={formData.temp} onChange={handleChange} required />
                            </div>

                            <div className="form-group">
                                <label>Pulse (bpm)</label>
                                <input type="number" name="pulse" value={formData.pulse} onChange={handleChange} required />
                            </div>

                            <div className="form-group">
                                <label>Resp. Rate (cpm)</label>
                                <input type="number" name="rr" value={formData.rr} onChange={handleChange} />
                            </div>
                        </div>
                    </section>

                    {/* SECTION 4: Fetal Assessment */}
                    <section className="apv-section">
                        <h3 className="section-head"><Baby size={18} /> Fetal Assessment</h3>

                        <div className="fetal-grid">
                            <div className="form-group">
                                <label>Fundal Height (cm)</label>
                                <input type="number" name="fundalHeight" value={formData.fundalHeight} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Fetal Heart Rate (bpm)</label>
                                <input type="number" name="fhr" value={formData.fhr} onChange={handleChange} />
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
                    </section>

                    {/* SECTION 5: Labs & Supplements */}
                    <section className="apv-section split-section">
                        <div className="split-half">
                            <h3 className="section-head"><Thermometer size={18} /> Laboratory Tests</h3>
                            <div className="check-list">
                                {MEDICAL_TESTS.map(test => (
                                    <label key={test} className="check-lbl">
                                        <input
                                            type="checkbox"
                                            checked={formData.testsDone.includes(test)}
                                            onChange={() => handleArrayToggle('testsDone', test)}
                                        />
                                        <span>{test}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="split-half highlight-panel">
                            <h3 className="section-head"><ShieldAlert size={18} /> Supplements Given</h3>
                            <div className="check-list">
                                {SUPPLEMENTS.map(sup => (
                                    <label key={sup} className="check-lbl">
                                        <input
                                            type="checkbox"
                                            checked={formData.supplementsGiven.includes(sup)}
                                            onChange={() => handleArrayToggle('supplementsGiven', sup)}
                                        />
                                        <span>{sup}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* SECTION 6 & 7: Risk & Notes */}
                    <section className="apv-section alert-section">
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

                    <section className="apv-section">
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
                            <input type="date" name="visitDate" value={formData.visitDate} onChange={handleChange} required />
                        </div>
                        <div className="form-group mt-2">
                            <label>Visit Number</label>
                            <input type="number" readOnly className="read-only" value={formData.visitNumber} />
                        </div>
                        <div className="form-group mt-2">
                            <label>Visit Type</label>
                            <select name="visitType" value={formData.visitType} onChange={handleChange}>
                                <option value="Facility Visit">Facility Visit</option>
                                <option value="Home Visit">Home Visit</option>
                            </select>
                        </div>
                        <div className="form-group mt-2">
                            <label>Health Facility</label>
                            <input type="text" name="healthFacility" value={formData.healthFacility} onChange={handleChange} />
                        </div>
                        <div className="form-group mt-2">
                            <label>Attending Midwife / Doctor</label>
                            <input type="text" name="attendingMidwife" value={formData.attendingMidwife} onChange={handleChange} />
                        </div>
                    </div>

                    {/* SECTION 8: Referral */}
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

                        {formData.referred && (
                            <div className="ref-body animate-fade">
                                <div className="form-group mt-2">
                                    <label>Referred To</label>
                                    <input type="text" name="referredTo" value={formData.referredTo} onChange={handleChange} required={formData.referred} placeholder="Hospital name" />
                                </div>
                                <div className="form-group mt-2">
                                    <label>Reason for Referral</label>
                                    <input type="text" name="referralReason" value={formData.referralReason} onChange={handleChange} required={formData.referred} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 9: Next Appointment */}
                    <div className="apv-side-card appt-card">
                        <h3 className="side-head text-primary"><CalendarCheck size={18} /> Next Appointment</h3>
                        <div className="form-group mt-2">
                            <label>Next Visit Date</label>
                            <input type="date" name="nextApptDate" value={formData.nextApptDate} onChange={handleChange} required />
                        </div>
                        <div className="form-group mt-2">
                            <label>Visit Type</label>
                            <select name="nextApptType" value={formData.nextApptType} onChange={handleChange}>
                                <option value="Routine Checkup">Routine Checkup</option>
                                <option value="Lab Results Review">Lab Results Review</option>
                                <option value="Ultrasound">Ultrasound</option>
                                <option value="Post-Referral Check">Post-Referral Check</option>
                            </select>
                        </div>
                        <label className="check-lbl mt-3">
                            <input type="checkbox" name="remiderEnabled" checked={formData.remiderEnabled} onChange={handleChange} />
                            <span>Enable auto-reminder 3 days before</span>
                        </label>
                    </div>

                </div>

            </form>
        </div>
    );
};

export default AddPrenatalVisit;
