import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, ChevronRight, Save, X, Activity, HeartPulse,
    Thermometer, AlertTriangle, FileText, CheckCircle2, XCircle,
    CalendarCheck, MapPin, ClipboardList, Baby, ShieldAlert, UserRound
} from 'lucide-react';
import PatientService from '../../services/patientservice';
import BabyService from '../../services/babyservices';
import { AuthContext } from '../../context/AuthContext';
import { formatMotherId } from '../../utils/displayIds';
import supabase from '../../config/supabaseclient';
import StaffPageLoader from '../../components/Common/StaffPageLoader';
import '../../styles/pages/AddPrenatalVisit.css';
import '../../styles/pages/PatientProfile.css';

const patientService = new PatientService();
const babyService = new BabyService();

const POSTPARTUM_DANGER_SIGNS = [
    'Excessive / heavy vaginal bleeding (soaking a pad in <1 hr)',
    'High fever or chills (signs of postpartum infection)',
    'Severe headache or visual disturbances / dizziness',
    'Severe lower abdominal pain or foul-smelling lochia',
    'Wound complications (redness, pus, separation)',
    'Severe breast pain, hardness, or redness (mastitis)',
    'Swollen, red, or painful calf (thrombosis warning)',
    'Severe sadness, overwhelming anxiety, or feeling detached'
];

const UTERINE_OPTIONS = [
    'Firm, well-contracted (Normal)',
    'At umbilicus, contracting normally',
    '1-2 cm below umbilicus (Involuting normally)',
    'Non-palpable behind pubic bone (Normal >= 10-14 days)',
    'Soft / Boggy (Requires uterine massage / attention)',
    'Tender / Subinvolution noted'
];

const LOCHIA_OPTIONS = [
    'Rubra (Dark red, normal days 1–4)',
    'Serosa (Pink/brown, normal days 4–10)',
    'Alba (Yellowish/white, normal > 10 days)',
    'Scant / Minimal amount',
    'Moderate amount (Normal)',
    'Heavy / Profuse (Warning: needs monitoring)',
    'Foul-smelling lochia (Warning: suspected infection)'
];

const WOUND_OPTIONS = [
    'Clean, dry, and intact (Healing well)',
    'Episiotomy / perineal tear intact, no inflammation',
    'C-Section incision clean, dry, well-approximated',
    'Mild erythema / localized tenderness',
    'Wound separation / dehiscence noted',
    'Purulent discharge / signs of wound infection',
    'N/A (Intact perineum, no perineal or surgical wound)'
];

const BREASTFEEDING_OPTIONS = [
    'Exclusive breastfeeding (Good latch, comfortable)',
    'Breastfeeding well, producing mature milk',
    'Mixed feeding (Breast milk and formula)',
    'Formula feeding only',
    'Breast engorgement / localized tenderness',
    'Cracked, sore, or bleeding nipples',
    'Mastitis symptoms (Warmth, redness, flu-like signs)'
];

const PAIN_OPTIONS = [
    '0 — No pain (Comfortable)',
    '1-3 — Mild discomfort (Normal afterpains / mild tenderness)',
    '4-6 — Moderate pain (Managed with prescribed analgesics)',
    '7-10 — Severe / unmanaged pain (Requires immediate review)'
];

const URINATION_BOWEL_OPTIONS = [
    'Voiding freely without dysuria, regular bowel movement',
    'Normal urination, mild constipation',
    'Dysuria / burning sensation on urination',
    'Urinary retention / difficulty voiding',
    'Constipation requiring stool softener'
];

const MENTAL_HEALTH_OPTIONS = [
    'Emotionally stable, positive mood, bonding well with baby',
    'Mild fatigue / typical baby blues (Support provided)',
    'Excessive anxiety, persistent sadness, or difficulty sleeping',
    'Signs of postpartum depression (Counseling & follow-up scheduled)'
];

const AddPostpartumVisit = () => {
    const navigate = useNavigate();
    const { patientId } = useParams();
    const location = useLocation();
    const { user } = useContext(AuthContext);

    const [toast, setToast] = useState(null);
    const [activeTab, setActiveTab] = useState('vitals'); // 'vitals', 'assessment', 'danger'
    const [patient, setPatient] = useState(null);
    const [delivery, setDelivery] = useState(null);
    const [scheduledVisits, setScheduledVisits] = useState([]);
    const [selectedVisitId, setSelectedVisitId] = useState(location.state?.visitId || '');
    
    const [staffList, setStaffList] = useState([]);
    const [stationOptions, setStationOptions] = useState([]);
    const [userAccess, setUserAccess] = useState(null);

    const [vitalsErrors, setVitalsErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const saveInFlightRef = useRef(false);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState(null);

    // Form Data
    const [formData, setFormData] = useState({
        visitDate: new Date().toISOString().split('T')[0],
        status: 'Attended',
        missedReason: '',
        visitStation: '',
        assignedStaffId: '',
        // Section 1: Vital Signs
        bpSystolic: '',
        bpDiastolic: '',
        weight: '',
        temp: '',
        pulse: '',
        respRate: '',
        // Section 2: Postpartum Assessment
        uterineInvolution: UTERINE_OPTIONS[0],
        lochiaAssessment: LOCHIA_OPTIONS[0],
        perinealCondition: WOUND_OPTIONS[0],
        breastfeedingStatus: BREASTFEEDING_OPTIONS[0],
        breastAssessment: 'Normal, soft, active lactation',
        painAssessment: PAIN_OPTIONS[0],
        urinationBowel: URINATION_BOWEL_OPTIONS[0],
        mentalHealth: MENTAL_HEALTH_OPTIONS[0],
        // Section 3: Danger Signs & Care Plan
        dangerSigns: [],
        clinicalNotes: '',
        adviceGiven: '',
        treatmentsGiven: '',
        medicationsReview: '',
        familyPlanning: '',
        // Referral & Next Appt
        isReferred: false,
        referredTo: '',
        referralReason: '',
        nextApptDate: '',
        nextApptType: '',
        additionalNotes: ''
    });

    // 1. Load User Access & Stations
    useEffect(() => {
        let active = true;
        Promise.all([
            patientService.getCurrentUserAccess(),
            supabase.from('stations').select('id, station_name').order('station_name')
        ]).then(([access, result]) => {
            if (!active) return;
            setUserAccess(access);
            setStationOptions(result.data || []);
        }).catch(err => console.error('Failed to load access/stations:', err));
        return () => { active = false; };
    }, [user?.id]);

    // 2. Load Patient, Delivery Info & Postpartum Visits
    useEffect(() => {
        let active = true;
        const loadAllData = async () => {
            try {
                setError(null);
                setLoadingData(true);
                let resolvedPatientId = patientId;
                const visitId = location.state?.visitId;

                if (visitId) {
                    const { data: scheduledVisit, error: scheduledVisitError } = await supabase
                        .from('postpartum_visits')
                        .select('patient_id, delivery_id')
                        .eq('id', visitId)
                        .maybeSingle();
                    if (scheduledVisitError) throw scheduledVisitError;
                    if (!scheduledVisit) throw new Error('The selected postpartum visit could not be found.');

                    if (scheduledVisit.delivery_id) {
                        const { data: linkedDelivery, error: linkedDeliveryError } = await supabase
                            .from('deliveries')
                            .select('mother_id')
                            .eq('id', scheduledVisit.delivery_id)
                            .maybeSingle();
                        if (linkedDeliveryError) throw linkedDeliveryError;
                        resolvedPatientId = linkedDelivery?.mother_id || scheduledVisit.patient_id || resolvedPatientId;
                    } else {
                        resolvedPatientId = scheduledVisit.patient_id || resolvedPatientId;
                    }
                }

                if (!resolvedPatientId) {
                    throw new Error('A patient could not be identified for this postpartum visit.');
                }

                const [patientData, deliveryRes, visitsRes] = await Promise.all([
                    patientService.getPatientById(resolvedPatientId),
                    supabase
                        .from('deliveries')
                        .select(`
                            id,
                            delivery_date,
                            delivery_type,
                            complications,
                            station_ass,
                            stations:station_ass(station_name),
                            patient_basic_info!deliveries_mother_id_fkey (
                                id, first_name, last_name, date_of_birth, station_ass,
                                stations:station_ass(station_name)
                            ),
                            newborns(birth_weight, condition_at_birth)
                        `)
                        .eq('mother_id', resolvedPatientId)
                        .order('delivery_date', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                    supabase
                        .from('postpartum_visits')
                        .select('*')
                        .eq('patient_id', resolvedPatientId)
                        .order('scheduled_at', { ascending: true })
                ]);

                if (!active) return;
                if (deliveryRes.error) throw deliveryRes.error;
                if (visitsRes.error) throw visitsRes.error;
                const linkedPatient = deliveryRes.data?.patient_basic_info;
                const fallbackPatient = linkedPatient ? {
                    ...linkedPatient,
                    name: `${linkedPatient.first_name || ''} ${linkedPatient.last_name || ''}`.trim()
                        || location.state?.visit?.patientName
                        || 'Unknown Patient',
                    age: linkedPatient.date_of_birth
                        ? Math.floor((Date.now() - new Date(linkedPatient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                        : 'N/A',
                    stationId: linkedPatient.station_ass || null,
                    station: linkedPatient.stations?.station_name || 'Registered Station'
                } : location.state?.visit?.patientName ? {
                    id: resolvedPatientId,
                    name: location.state.visit.patientName,
                    age: 'N/A',
                    stationId: null,
                    station: location.state.visit.location || location.state.visit.assignedStation || 'Registered Station'
                } : null;
                const resolvedPatient = patientData || fallbackPatient;
                if (!resolvedPatient) {
                    throw new Error(
                        'Patient details are unavailable. Confirm the patient record exists and your role can view patients at this station.'
                    );
                }

                setPatient(resolvedPatient);
                const dData = deliveryRes.data || (resolvedPatient?.deliveries?.[0] || null);
                setDelivery(dData);

                const pVisits = visitsRes.data || [];
                setScheduledVisits(pVisits);

                // Determine default selected visit
                const initialVisitId = location.state?.visitId;
                if (initialVisitId && pVisits.some(v => v.id === initialVisitId)) {
                    setSelectedVisitId(initialVisitId);
                } else {
                    const nextPending = pVisits.find(v => !['Completed', 'Cancelled'].includes(v.status));
                    if (nextPending) setSelectedVisitId(nextPending.id);
                    else if (pVisits.length > 0) setSelectedVisitId(pVisits[0].id);
                }

                // Wound condition default based on delivery type
                if (dData?.delivery_type === 'CS') {
                    setFormData(prev => ({
                        ...prev,
                        perinealCondition: 'C-Section incision clean, dry, well-approximated'
                    }));
                }
            } catch (err) {
                console.error('Error loading postpartum patient data:', err);
                if (active) setError(err);
            } finally {
                if (active) setLoadingData(false);
            }
        };

        loadAllData();
        return () => { active = false; };
    }, [patientId, location.state?.visitId]);

    // 3. Load Staff Members for assigned station
    useEffect(() => {
        let active = true;
        const loadStaff = async () => {
            try {
                const targetStation = patient?.stationId || delivery?.station_ass || userAccess?.stationId;
                let query = supabase.from('staff_profiles').select('id, full_name, station_ass').order('full_name');
                if (targetStation && userAccess?.role !== 'admin') {
                    query = query.eq('station_ass', targetStation);
                }
                const { data, error } = await query;
                if (error) throw error;
                if (!active) return;
                setStaffList(data || []);

                // Auto-set assigned staff if not already set
                setFormData(prev => {
                    if (prev.assignedStaffId) return prev;
                    const ownStaff = (data || []).find(s => s.id === user?.id);
                    return {
                        ...prev,
                        assignedStaffId: ownStaff?.id || (data?.[0]?.id || '')
                    };
                });
            } catch (err) {
                console.error('Error fetching staff list:', err);
            }
        };

        if (patient || userAccess) loadStaff();
        return () => { active = false; };
    }, [patient, delivery, userAccess, user?.id]);

    // 4. Update Form Defaults when Selected Visit changes
    useEffect(() => {
        if (!selectedVisitId || scheduledVisits.length === 0) return;
        const cur = scheduledVisits.find(v => v.id === selectedVisitId);
        if (!cur) return;

        setFormData(prev => ({
            ...prev,
            assignedStaffId: cur.assigned_staff || prev.assignedStaffId || user?.id || '',
            visitStation: userAccess?.role === 'admin'
                ? (stationOptions.find(st => st.id === cur.station_ass)?.station_name || prev.visitStation || '')
                : (stationOptions.find(st => st.id === userAccess?.stationId)?.station_name || patient?.station || ''),
            nextApptDate: cur.next_appt_date ? String(cur.next_appt_date).slice(0, 10) : prev.nextApptDate,
            nextApptType: cur.next_appt_type || prev.nextApptType
        }));
    }, [selectedVisitId, scheduledVisits, userAccess, stationOptions, patient, user?.id]);

    // Calculated postpartum metrics
    const postpartumStats = useMemo(() => {
        if (!delivery?.delivery_date) return { days: null, weeks: null, label: 'N/A' };
        const delDate = new Date(delivery.delivery_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffMs = today - delDate;
        const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        const diffWeeks = Math.floor(diffDays / 7);
        return {
            days: diffDays,
            weeks: diffWeeks,
            label: `Day ${diffDays} · Week ${diffWeeks + 1}`
        };
    }, [delivery?.delivery_date]);

    // Form Change Handlers
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear inline validation error
        if (vitalsErrors[name]) {
            setVitalsErrors(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const handleDangerSignToggle = (sign) => {
        setFormData(prev => {
            const exists = prev.dangerSigns.includes(sign);
            return {
                ...prev,
                dangerSigns: exists
                    ? prev.dangerSigns.filter(s => s !== sign)
                    : [...prev.dangerSigns, sign]
            };
        });
    };

    // Warnings and Alerts
    const isHighBP = (parseInt(formData.bpSystolic) >= 140) || (parseInt(formData.bpDiastolic) >= 90);
    const isFever = parseFloat(formData.temp) >= 38.0;
    const hasDangerSigns = formData.dangerSigns.length > 0;

    // Save Handler
    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (saveInFlightRef.current || isSaving) return;

        // Validation for Attended visits
        if (formData.status === 'Attended') {
            const errors = {};
            if (!selectedVisitId) {
                errors.visit = 'Please select a scheduled postpartum visit.';
            }
            if (!formData.bpSystolic || !formData.bpDiastolic) {
                errors.bp = 'Blood pressure (Systolic & Diastolic) is required.';
            } else {
                const sys = parseInt(formData.bpSystolic);
                const dia = parseInt(formData.bpDiastolic);
                if (isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) {
                    errors.bp = 'Valid positive numbers are required for blood pressure.';
                }
            }
            if (!formData.weight || parseFloat(formData.weight) <= 0) {
                errors.weight = 'Weight in kg is required.';
            }
            if (!formData.temp || parseFloat(formData.temp) <= 0) {
                errors.temp = 'Temperature is required.';
            }
            if (!formData.pulse || parseInt(formData.pulse) <= 0) {
                errors.pulse = 'Pulse rate is required.';
            }
            if (!formData.assignedStaffId && !user?.id) {
                errors.staff = 'Personnel present / assigned staff is required.';
            }

            if (Object.keys(errors).length > 0) {
                setVitalsErrors(errors);
                setToast({ type: 'error', message: 'Please complete all required fields.' });
                setActiveTab('vitals');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

        if (formData.status === 'Missed' && !formData.missedReason?.trim()) {
            setToast({ type: 'error', message: 'Please provide a reason for the missed visit.' });
            return;
        }

        saveInFlightRef.current = true;
        setIsSaving(true);

        try {
            // Determine actual station ID
            let actualStationId = userAccess?.stationId || patient?.stationId || null;
            if (userAccess?.role === 'admin' && formData.visitStation) {
                const matchStation = stationOptions.find(s => s.station_name === formData.visitStation);
                if (matchStation) actualStationId = matchStation.id;
            }

            const values = {
                bp_systolic: formData.bpSystolic,
                bp_diastolic: formData.bpDiastolic,
                weight_kg: formData.weight,
                temp_c: formData.temp,
                pulse_bpm: formData.pulse,
                resp_rate_cpm: formData.respRate || null,
                uterine_involution: formData.uterineInvolution,
                lochia_assessment: formData.lochiaAssessment,
                perineal_or_wound_condition: formData.perinealCondition,
                breast_assessment: formData.breastAssessment,
                breastfeeding_status: formData.breastfeedingStatus,
                pain_assessment: formData.painAssessment,
                urination_and_bowel_status: formData.urinationBowel,
                mental_health_assessment: formData.mentalHealth,
                danger_signs: formData.dangerSigns,
                clinical_notes: formData.clinicalNotes,
                advice_given: formData.adviceGiven,
                treatments_given: formData.treatmentsGiven,
                medications_review: formData.medicationsReview,
                family_planning_counseling: formData.familyPlanning,
                is_referred: Boolean(formData.isReferred),
                referred_to: formData.isReferred ? formData.referredTo : null,
                referral_reason: formData.isReferred ? formData.referralReason : null,
                next_appt_date: formData.nextApptDate || null,
                next_appt_type: formData.nextApptType || null,
                notes: formData.additionalNotes,
                missed_reason: formData.missedReason
            };

            const personnelPresent = formData.assignedStaffId || user?.id || null;
            const performedBy = user?.id || null;

            await babyService.savePostpartumVisit(selectedVisitId, {
                status: formData.status,
                attendedDate: formData.status === 'Attended' ? formData.visitDate : null,
                personnelPresent: formData.status === 'Attended' ? personnelPresent : null,
                performedBy: formData.status === 'Attended' ? performedBy : null,
                values
            });

            // Update assigned_staff and station_ass on postpartum_visits table if present
            if (actualStationId || formData.assignedStaffId) {
                await supabase
                    .from('postpartum_visits')
                    .update({
                        ...(actualStationId ? { station_ass: actualStationId } : {}),
                        ...(formData.assignedStaffId ? { assigned_staff: formData.assignedStaffId } : {})
                    })
                    .eq('id', selectedVisitId);
            }

            window.scrollTo(0, 0);
            setToast({ type: 'success', message: 'Postpartum visit successfully recorded!' });
            setTimeout(() => navigate('/dashboard/prenatal'), 1400);
        } catch (err) {
            console.error('Error saving postpartum visit:', err);
            setToast({ type: 'error', message: 'Failed to record visit: ' + (err.message || 'Unknown error') });
        } finally {
            saveInFlightRef.current = false;
            setIsSaving(false);
        }
    };

    if (loadingData || !patient) {
        return (
            <StaffPageLoader 
                message="Loading postpartum patient record..." 
                error={error} 
            />
        );
    }

    return (
        <div className="add-pvisit-page staff-page-ready">
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
                    <h1 className="apv-title" style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'var(--color-text)' }}>
                        Record Postpartum Visit
                    </h1>
                </div>
                <div className="apv-actions">
                    <button className="btn btn-outline" onClick={() => navigate(-1)} type="button" disabled={isSaving}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} form="postpartum-form" type="button" disabled={isSaving}>
                        <Save size={15} /> {isSaving ? 'Saving...' : 'Save Visit'}
                    </button>
                </div>
            </div>

            <form id="postpartum-form" className="apv-form-container" onSubmit={handleSave}>
                {/* Left Column: Core Postpartum Clinical Data */}
                <div className="apv-main-col">

                    {/* SECTION 1: Patient Info Banner */}
                    <section className="apv-section sticky-patient-info" style={{ 
                        background: '#ffffff', 
                        border: '1px solid var(--color-border)', 
                        padding: '24px 32px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div className="profile-avatar-lg">
                                {patient.name ? patient.name.split(' ').map(n => n[0]).join('').substring(0, 2) : 'PP'}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <h2 style={{ color: 'var(--color-text)', fontSize: '20px', fontWeight: '800', margin: 0, textTransform: 'uppercase' }}>
                                        {patient.name}
                                    </h2>
                                </div>
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: '500' }}>
                                    ID: {formatMotherId(patient.id)} · {patient.age} years old · <MapPin size={12} style={{ display: 'inline', marginLeft: '2px', marginRight: '2px' }} /> {patient.station || 'Registered Station'}
                                </div>
                            </div>
                        </div>

                        {/* Postpartum Indicators */}
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            backgroundColor: '#f8f9fb',
                            border: '1px solid var(--color-border)',
                            borderRadius: '12px',
                            padding: '12px 24px',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '20px', borderRight: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Delivery Date</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)' }}>
                                    {delivery?.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 20px', borderRight: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Delivery Type</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)' }}>
                                    {delivery?.delivery_type || 'NSD'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 20px', borderRight: '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Postpartum Stage</span>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)' }}>
                                    {postpartumStats.label}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '20px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Status</span>
                                <span className={`risk-tag risk-normal`} style={{ margin: 0, display: 'inline-block', width: 'fit-content' }}>
                                    Postpartum Care
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Step Navigation Tabs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #eef0f4' }}>
                            <button type="button" className={`apv-tab-btn ${activeTab === 'vitals' ? 'active' : ''}`} onClick={() => setActiveTab('vitals')}>
                                <Activity size={16} style={{ marginRight: '8px' }} /> Maternal Vital Signs
                            </button>
                            <ChevronRight size={16} style={{ color: '#d1d6e0', margin: '0 4px' }} />
                            <button type="button" className={`apv-tab-btn ${activeTab === 'assessment' ? 'active' : ''}`} onClick={() => setActiveTab('assessment')}>
                                <HeartPulse size={16} style={{ marginRight: '8px' }} /> Postpartum Assessment
                            </button>
                            <ChevronRight size={16} style={{ color: '#d1d6e0', margin: '0 4px' }} />
                            <button type="button" className={`apv-tab-btn ${activeTab === 'danger' ? 'active' : ''}`} onClick={() => setActiveTab('danger')}>
                                <AlertTriangle size={16} style={{ marginRight: '8px' }} /> Danger Signs &amp; Care Plan
                            </button>
                        </div>

                        {/* TAB 1: Maternal Vital Signs */}
                        <div className="apv-tab-content">
                            {activeTab === 'vitals' && (
                                <section className="apv-section" style={{ margin: 0 }}>
                                    <h3 className="section-head"><Activity size={18} /> Maternal Vital Signs</h3>
                                    <p className="section-sub">Standard vital signs taken during this postpartum checkup.</p>

                                    <div className="vitals-grid">
                                        {/* Blood Pressure */}
                                        <div className={`form-group bp-group ${isHighBP ? 'has-warning' : ''}`}>
                                            <label>Blood Pressure (mmHg) <span style={{ color: '#ef4444' }}>*</span>
                                                {isHighBP && <span className="inline-warn"><AlertTriangle size={12} /> High BP Alert</span>}
                                            </label>
                                            <div className="bp-inputs" style={vitalsErrors.bp ? { border: '1px solid #ef4444', borderRadius: '8px' } : {}}>
                                                <input
                                                    type="number"
                                                    name="bpSystolic"
                                                    value={formData.bpSystolic}
                                                    onChange={handleChange}
                                                    placeholder="Sys (e.g. 120)"
                                                    required
                                                />
                                                <span>/</span>
                                                <input
                                                    type="number"
                                                    name="bpDiastolic"
                                                    value={formData.bpDiastolic}
                                                    onChange={handleChange}
                                                    placeholder="Dia (e.g. 80)"
                                                    required
                                                />
                                            </div>
                                            {vitalsErrors.bp && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{vitalsErrors.bp}</span>}
                                        </div>

                                        {/* Weight */}
                                        <div className="form-group">
                                            <label>Weight (kg) <span style={{ color: '#ef4444' }}>*</span></label>
                                            <div className="input-with-icon">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    name="weight"
                                                    value={formData.weight}
                                                    onChange={handleChange}
                                                    placeholder="e.g. 58.5"
                                                    required
                                                    style={vitalsErrors.weight ? { border: '1px solid #ef4444' } : {}}
                                                />
                                            </div>
                                            {vitalsErrors.weight && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{vitalsErrors.weight}</span>}
                                        </div>

                                        {/* Temperature */}
                                        <div className={`form-group ${isFever ? 'has-warning' : ''}`}>
                                            <label>Temperature (°C) <span style={{ color: '#ef4444' }}>*</span>
                                                {isFever && <span className="inline-warn"><AlertTriangle size={12} /> Fever Alert (&gt;=38°C)</span>}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                name="temp"
                                                value={formData.temp}
                                                onChange={handleChange}
                                                placeholder="e.g. 36.6"
                                                required
                                                style={vitalsErrors.temp ? { border: '1px solid #ef4444' } : {}}
                                            />
                                            {vitalsErrors.temp && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{vitalsErrors.temp}</span>}
                                        </div>

                                        {/* Pulse */}
                                        <div className="form-group">
                                            <label>Pulse (BPM) <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input
                                                type="number"
                                                name="pulse"
                                                value={formData.pulse}
                                                onChange={handleChange}
                                                placeholder="e.g. 78"
                                                required
                                                style={vitalsErrors.pulse ? { border: '1px solid #ef4444' } : {}}
                                            />
                                            {vitalsErrors.pulse && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{vitalsErrors.pulse}</span>}
                                        </div>

                                        {/* Respiratory Rate */}
                                        <div className="form-group">
                                            <label>Respiratory Rate (/min) <small style={{ color: 'var(--color-text-muted)' }}>(Optional)</small></label>
                                            <input
                                                type="number"
                                                name="respRate"
                                                value={formData.respRate}
                                                onChange={handleChange}
                                                placeholder="e.g. 18"
                                            />
                                        </div>
                                    </div>

                                    {/* Step Forward Action */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={() => setActiveTab('assessment')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            Next: Postpartum Assessment <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </section>
                            )}

                            {/* TAB 2: Postpartum Clinical Assessment */}
                            {activeTab === 'assessment' && (
                                <section className="apv-section" style={{ margin: 0 }}>
                                    <h3 className="section-head"><HeartPulse size={18} /> Postpartum Clinical Assessment</h3>
                                    <p className="section-sub">Involution, lochia, wound condition, lactation, and maternal recovery evaluation.</p>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
                                        {/* Uterine Involution */}
                                        <div className="form-group">
                                            <label>Uterine Involution / Fundal Assessment</label>
                                            <select name="uterineInvolution" value={formData.uterineInvolution} onChange={handleChange}>
                                                {UTERINE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        {/* Lochia Assessment */}
                                        <div className="form-group">
                                            <label>Lochia Assessment</label>
                                            <select name="lochiaAssessment" value={formData.lochiaAssessment} onChange={handleChange}>
                                                {LOCHIA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        {/* Perineal / C-Section Wound */}
                                        <div className="form-group">
                                            <label>Perineal / Surgical Wound Condition</label>
                                            <select name="perinealCondition" value={formData.perinealCondition} onChange={handleChange}>
                                                {WOUND_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        {/* Breastfeeding & Lactation */}
                                        <div className="form-group">
                                            <label>Breastfeeding &amp; Lactation Status</label>
                                            <select name="breastfeedingStatus" value={formData.breastfeedingStatus} onChange={handleChange}>
                                                {BREASTFEEDING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        {/* Pain Assessment */}
                                        <div className="form-group">
                                            <label>Pain Assessment</label>
                                            <select name="painAssessment" value={formData.painAssessment} onChange={handleChange}>
                                                {PAIN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        {/* Urination & Bowel Status */}
                                        <div className="form-group">
                                            <label>Urination &amp; Bowel Status</label>
                                            <select name="urinationBowel" value={formData.urinationBowel} onChange={handleChange}>
                                                {URINATION_BOWEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        {/* Mental Health Assessment */}
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label>Emotional Well-being &amp; Mental Health Assessment</label>
                                            <select name="mentalHealth" value={formData.mentalHealth} onChange={handleChange}>
                                                {MENTAL_HEALTH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Tab Navigation Actions */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={() => setActiveTab('vitals')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <ArrowLeft size={16} /> Back: Vital Signs
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={() => setActiveTab('danger')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            Next: Danger Signs &amp; Care Plan <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </section>
                            )}

                            {/* TAB 3: Danger Signs & Care Plan */}
                            {activeTab === 'danger' && (
                                <section className="apv-section" style={{ margin: 0 }}>
                                    <h3 className="section-head text-danger"><AlertTriangle size={18} /> Danger Signs &amp; Clinical Findings</h3>
                                    <p className="section-sub">Select any warning symptoms observed or reported by the mother. These will flag clinical alerts.</p>

                                    {/* Danger Signs Selection */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px', marginTop: '12px', marginBottom: '24px' }}>
                                        {POSTPARTUM_DANGER_SIGNS.map(sign => {
                                            const isSelected = formData.dangerSigns.includes(sign);
                                            return (
                                                <label
                                                    key={sign}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '10px',
                                                        padding: '12px 14px',
                                                        borderRadius: '8px',
                                                        border: isSelected ? '1px solid #ef4444' : '1px solid var(--color-border)',
                                                        backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.05)' : '#ffffff',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleDangerSignToggle(sign)}
                                                        style={{ marginTop: '2px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '13px', fontWeight: isSelected ? '600' : '400', color: isSelected ? '#b91c1c' : 'var(--color-text)' }}>
                                                        {sign}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    {/* Tab Navigation Actions */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={() => setActiveTab('assessment')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <ArrowLeft size={16} /> Back: Assessment
                                        </button>
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>

                    {/* ALWAYS VISIBLE: Clinical Notes, Advice & Care Plan */}
                    <section className="apv-section" style={{ margin: 0, marginTop: '24px' }}>
                        <h3 className="section-head"><FileText size={18} /> Clinical Notes &amp; Care Plan</h3>
                        <div className="notes-grid">
                            <div className="form-group">
                                <label>Clinical Notes / Examination Findings</label>
                                <textarea
                                    name="clinicalNotes"
                                    rows="3"
                                    value={formData.clinicalNotes}
                                    onChange={handleChange}
                                    placeholder="Enter physical exam findings, complaints, recovery observations..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Advice &amp; Instructions Given</label>
                                <textarea
                                    name="adviceGiven"
                                    rows="3"
                                    value={formData.adviceGiven}
                                    onChange={handleChange}
                                    placeholder="Lactation support, maternal nutrition, hydration, wound care, danger sign warnings..."
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px' }}>
                            <div className="form-group">
                                <label>Treatments Given <small style={{ color: 'var(--color-text-muted)' }}>(Optional)</small></label>
                                <input
                                    type="text"
                                    name="treatmentsGiven"
                                    value={formData.treatmentsGiven}
                                    onChange={handleChange}
                                    placeholder="e.g. Iron supplements, wound dressing changed"
                                />
                            </div>
                            <div className="form-group">
                                <label>Medications Reviewed <small style={{ color: 'var(--color-text-muted)' }}>(Optional)</small></label>
                                <input
                                    type="text"
                                    name="medicationsReview"
                                    value={formData.medicationsReview}
                                    onChange={handleChange}
                                    placeholder="e.g. Ferrous sulfate, Mefenamic acid"
                                />
                            </div>
                            <div className="form-group">
                                <label>Family Planning Counseling <small style={{ color: 'var(--color-text-muted)' }}>(Optional)</small></label>
                                <input
                                    type="text"
                                    name="familyPlanning"
                                    value={formData.familyPlanning}
                                    onChange={handleChange}
                                    placeholder="e.g. LAM discussed, PPIUD follow-up"
                                />
                            </div>
                        </div>
                    </section>

                </div>

                {/* Right Column: Administrative & Scheduling Sidebar */}
                <div className="apv-side-col">

                    {/* SECTION: Visit Details */}
                    <div className="apv-side-card">
                        <h3 className="side-head">Visit Details</h3>

                        {/* Visit Date */}
                        <div className="form-group">
                            <label>Visit Date</label>
                            <input
                                type="date"
                                name="visitDate"
                                value={formData.visitDate}
                                onChange={handleChange}
                            />
                        </div>

                        {/* Scheduled Visit Selector */}
                        <div className="form-group mt-2">
                            <label>Scheduled Postpartum Visit <span style={{ color: '#ef4444' }}>*</span></label>
                            {scheduledVisits.length > 0 ? (
                                <select
                                    value={selectedVisitId}
                                    onChange={(e) => setSelectedVisitId(e.target.value)}
                                    style={vitalsErrors.visit ? { border: '1px solid #ef4444' } : {}}
                                >
                                    <option value="">Select scheduled visit</option>
                                    {scheduledVisits.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.visit_type || 'Follow-up'} — {v.scheduled_at ? new Date(v.scheduled_at).toLocaleDateString() : 'Unscheduled'} ({v.status})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input value="No scheduled postpartum visit records" readOnly className="read-only" />
                            )}
                            {vitalsErrors.visit && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{vitalsErrors.visit}</span>}
                        </div>

                        {/* Visit Outcome */}
                        <div className="form-group mt-2">
                            <label>Visit Outcome</label>
                            <select name="status" value={formData.status} onChange={handleChange}>
                                <option value="Attended">Attended</option>
                                <option value="Missed">Missed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>

                        {/* Reason for missed visit */}
                        {formData.status === 'Missed' && (
                            <div className="form-group mt-2">
                                <label>Reason for Missed Visit <span style={{ color: '#ef4444' }}>*</span></label>
                                <textarea
                                    name="missedReason"
                                    rows="2"
                                    value={formData.missedReason}
                                    onChange={handleChange}
                                    placeholder="Patient did not show up, patient out of town..."
                                    required
                                />
                            </div>
                        )}

                        {/* Visit Station */}
                        <div className="form-group mt-2">
                            <label>Visit Station</label>
                            {userAccess?.role === 'admin' ? (
                                <select name="visitStation" value={formData.visitStation} onChange={handleChange}>
                                    <option value="">Select station</option>
                                    {stationOptions.map(st => (
                                        <option key={st.id} value={st.station_name}>{st.station_name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input value={formData.visitStation || patient.station || 'Station not assigned'} readOnly className="read-only" />
                            )}
                        </div>

                        {/* Assigned Staff */}
                        <div className="form-group mt-2">
                            <label>Assigned Healthcare Worker</label>
                            <select
                                name="assignedStaffId"
                                value={formData.assignedStaffId}
                                onChange={handleChange}
                                disabled={userAccess?.role === 'staff'}
                            >
                                <option value="">Select staff</option>
                                {staffList.map(st => (
                                    <option key={st.id} value={st.id}>{st.full_name}</option>
                                ))}
                            </select>
                            {vitalsErrors.staff && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{vitalsErrors.staff}</span>}
                        </div>

                        {/* Performed By */}
                        <div className="form-group mt-2">
                            <label>Performed By</label>
                            <input value={user?.fullName || user?.displayName || 'Logged-in staff'} readOnly className="read-only" />
                        </div>
                    </div>

                    {/* SECTION: Next Appointment */}
                    <div className="apv-side-card appt-card">
                        <h3 className="side-head text-primary"><CalendarCheck size={18} /> Next Appointment</h3>
                        <div className="form-group mt-2">
                            <label>Next Visit Date</label>
                            <input
                                type="date"
                                name="nextApptDate"
                                value={formData.nextApptDate}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group mt-2">
                            <label>Next Visit Type</label>
                            <input
                                type="text"
                                name="nextApptType"
                                value={formData.nextApptType}
                                onChange={handleChange}
                                placeholder="e.g. 6-Week Postpartum & Family Planning"
                            />
                        </div>
                    </div>

                    {/* SECTION: Referral */}
                    <div className="apv-side-card referral-card">
                        <div className="ref-toggle">
                            <label className="check-lbl" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    name="isReferred"
                                    checked={formData.isReferred}
                                    onChange={handleChange}
                                />
                                <span className="side-head mb-0">Refer Patient to Hospital</span>
                            </label>
                        </div>

                        {formData.isReferred && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="form-group">
                                    <label>Referred To (Facility / Hospital)</label>
                                    <input
                                        type="text"
                                        name="referredTo"
                                        value={formData.referredTo}
                                        onChange={handleChange}
                                        placeholder="e.g. Provincial General Hospital"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Referral Reason</label>
                                    <textarea
                                        name="referralReason"
                                        rows="2"
                                        value={formData.referralReason}
                                        onChange={handleChange}
                                        placeholder="Reason for escalation or specialist review..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </form>
        </div>
    );
};

export default AddPostpartumVisit;
