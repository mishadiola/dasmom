import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, ChevronRight, Save, X, Activity, Baby, HeartPulse,
    Thermometer, AlertTriangle, Calculator,
    Stethoscope, FileText, CheckCircle2, XCircle, CalendarCheck, MapPin, Plus, Trash2
} from 'lucide-react';
import PatientService from '../../services/patientservice';
import { AuthContext } from '../../context/AuthContext';
import { formatMotherId } from '../../utils/displayIds';
import StaffPageLoader from '../../components/Common/StaffPageLoader';
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
    const [patientError, setPatientError] = useState(null);
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
    const [userAccess, setUserAccess] = useState(null);
    const [stationOptions, setStationOptions] = useState([]);
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const saveInFlightRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [rebalanceRemainingSchedule, setRebalanceRemainingSchedule] = useState(false);
    const [rebalanceReview, setRebalanceReview] = useState(null);
    const [rebalanceNewDate, setRebalanceNewDate] = useState('');
    const [isApplyingRebalance, setIsApplyingRebalance] = useState(false);

    useEffect(() => {
        let active = true;
        Promise.all([
            patientService.getCurrentUserAccess(),
            patientService.supabase.from('stations').select('id, station_name').order('station_name')
        ]).then(([access, result]) => {
            if (!active) return;
            setUserAccess(access);
            setStationOptions(result.data || []);
        }).catch(error => console.error('Failed to load visit permissions:', error));
        return () => { active = false; };
    }, [user?.id]);

    // Fetch patient data
    useEffect(() => {
        if (patientId) {
            patientService.getPatientById(patientId).then(setPatient).catch(err => {
                console.error(err);
                setPatientError(err);
            });
        }
    }, [patientId]);

    // Set form data when patient loads
    useEffect(() => {
        if (patient && userAccess && !isFormInitialized) {
            const pregnancyVisits = patient.currentPregnancy?.visits || [];
            const scheduledVisits = pregnancyVisits
                .filter(visit => visit.status === 'Scheduled')
                .sort((left, right) => Number(left.visit_number) - Number(right.visit_number));
            const today = new Date().toISOString().split('T')[0];
            const nextScheduledVisit = scheduledVisits.find(
                visit => String(visit.visit_date).slice(0, 10) >= today
            ) || null;
            
            setFormData(prev => ({
                ...prev,
                ...patient,
                edd: patient.edd || '',
                gestationalAge: patient.weeks ? `${patient.weeks}w` : '',
                trimester: patient.trimester || '',
                visitDate: new Date().toISOString().split('T')[0],
                visitNumber: nextScheduledVisit?.visit_number
                    || pregnancyVisits.filter(visit =>
                        String(visit.visit_date).slice(0, 10) <= today
                    ).length + 1,
                attendingMidwife: nextScheduledVisit?.assigned_staff || '',
                healthFacility: userAccess.role === 'admin'
                    ? patient.station || ''
                    : stationOptions.find(station => station.id === userAccess.stationId)?.station_name || '',
                fundalHeight: '', fhr: '', fetalMovement: 'Normal', presentation: 'Cephalic',
                testsDone: [], 
                riskFactors: ['None'], otherRiskFactor: '',
                calculatedRisk: patient.risk || 'Normal',
                clinicalNotes: '', adviceGiven: '',
                referred: false, referralReason: [], referralDate: '',
                nextApptDate: nextScheduledVisit?.next_appt_date
                    ? String(nextScheduledVisit.next_appt_date).slice(0, 10)
                    : ''
            }));
            setIsFormInitialized(true);
        }
    }, [patient, isFormInitialized, user, userAccess, stationOptions]);

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
        const heightCm = [...(patient?.currentPregnancy?.visits || [])]
            .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
            .find(visit => Number(visit.height_cm) > 0)?.height_cm;
        const riskAssessment = patientService.getPregnancyRisk(
            patient || {},
            patient?.currentPregnancy || {},
            {
                risk_factors: (formData.riskFactors || []).filter(factor => factor !== 'None').join(', '),
                bp_systolic: formData.bpSystolic,
                bp_diastolic: formData.bpDiastolic,
                weight_kg: formData.weight,
                height_cm: heightCm,
                temp_c: formData.temp,
                pulse_bpm: formData.pulse,
                resp_rate_cpm: formData.rr,
                fhr_bpm: formData.fhr,
            }
        );
        setFormData(prev => ({
            ...prev,
            calculatedRisk: riskAssessment.riskLevel
        }));
    }, [formData.riskFactors, formData.bpSystolic, formData.bpDiastolic, formData.weight, formData.temp, formData.pulse, formData.rr, formData.fhr, patient]);

    // CHO/admin assignment choices are constrained by the caller's station and selected facility.
    useEffect(() => {
        if (formData.healthFacility && userAccess?.role !== 'staff') {
            setMidwivesLoading(true);
            patientService.getDoctorsByStation(formData.healthFacility).then(data => {
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
    }, [formData.healthFacility, userAccess?.role]);

    useEffect(() => {
        const selectedSchedule = (patient?.currentPregnancy?.visits || []).find(visit =>
            ['Scheduled', 'Missed'].includes(visit.status)
            && Number(visit.visit_number) === Number(formData.visitNumber)
        );
        if (selectedSchedule) {
            setFormData(prev => ({
                ...prev,
                nextApptDate: String(selectedSchedule.next_appt_date || '').slice(0, 10)
            }));
        }
    }, [patient, formData.visitNumber]);

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
            const el = document.getElementsByName(firstErrorField)[0];
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
            const exactMatch = scheduledVisits.find(
                visit => String(visit.visit_date).slice(0, 10) === visitDateStr
            ) || null;
            const isOffSchedule = !exactMatch;
            const rowVisitNumber = exactMatch
                ? Number(exactMatch.visit_number)
                : patientService.getPrenatalVisitNumberForWeek(
                    patientService.calculateWeeksAtDate(formData.lmp, visitDateStr)
                );
            const rowVisitDate = formData.visitDate;
            const rowId = exactMatch?.id || null;

            const pastScheduledVisits = visits.filter(visit =>
                visit.status === 'Scheduled' &&
                String(visit.visit_date).slice(0, 10) < visitDateStr
            );
            for (const missedVisit of pastScheduledVisits) {
                const { error: missedError } = await patientService.supabase
                    .from('prenatal_visits')
                    .update({ status: 'Missed' })
                    .eq('id', missedVisit.id)
                    .eq('status', 'Scheduled');
                if (missedError) throw missedError;
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
                risk_factors: formData.riskFactors?.length > 0 
                    ? formData.riskFactors.filter(f => f !== 'None').map(f => f === 'Other' ? formData.otherRiskFactor : f).join(', ') 
                    : null,
                calculated_risk: formData.calculatedRisk,
            };
            const latestRecordedHeight = [...(patient.currentPregnancy?.visits || [])]
                .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
                .find(visit => Number(visit.height_cm) > 0)?.height_cm;
            const riskAssessment = patientService.getPregnancyRisk(
                patient,
                patient.currentPregnancy || {},
                { ...visitData, height_cm: latestRecordedHeight }
            );
            visitData.calculated_risk = riskAssessment.riskLevel;
            visitData.risk_factors = riskAssessment.riskFactors.join(', ') || null;

            const actualStationId = userAccess.role === 'admin'
                ? await patientService.getStationIdByName(formData.healthFacility)
                : userAccess.stationId;
            if (!actualStationId) throw new Error('Select a valid visit station.');

            let currentVisitId = rowId;
            if (rowId) {
                await patientService.completePrenatalVisit(rowId, visitData, actualStationId);
                console.log(`Updated visit ${rowVisitNumber} with ID ${rowId}`);
            } else {
                const assignedStationId = patient.stationId || actualStationId;
                const { data: insertedVisit, error: insertError } = await patientService.supabase
                    .from('prenatal_visits')
                    .insert({
                        ...visitData,
                        assigned_staff: (patient.currentPregnancy?.visits || [])
                            .find(visit => visit.status === 'Scheduled' && visit.assigned_staff)
                            ?.assigned_staff || null,
                        assigned_station: assignedStationId,
                        station_ass: actualStationId,
                        performed_by: user?.id
                    })
                    .select('id')
                    .single();
                
                if (insertError) throw insertError;
                currentVisitId = insertedVisit.id;
                console.log(`Inserted new visit ${rowVisitNumber}`);
            }

            await patientService.resequencePrenatalVisitNumbers(patientId);

            if (isOffSchedule && rebalanceRemainingSchedule) {
                const proposal = await patientService.rebalancePrenatalSchedule(
                    patientId,
                    formData.lmp,
                    rowVisitDate,
                    35,
                    [...currentPregnancyVisitIds, currentVisitId],
                    currentVisitId,
                    true
                );
                setRebalanceReview({
                    ...proposal,
                    patientId,
                    currentVisitId,
                    attendedDate: rowVisitDate,
                    lmp: formData.lmp
                });
                setToast({ type: 'success', message: 'Visit recorded. Review and confirm the proposed schedule before it is changed.' });
                return;
            }

            console.log(`Patient ${patientId} visit ${rowVisitNumber} recorded.`);

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

    const renumberProposedVisits = proposed => {
        const active = proposed
            .filter(visit => visit.status !== 'Cancelled' && visit.date)
            .sort((left, right) => left.date.localeCompare(right.date));
        const numbersByKey = new Map(active.map((visit, index) => [
            visit.id || visit.localId,
            index + 1
        ]));
        return proposed.map(visit => visit.status === 'Cancelled'
            ? visit
            : { ...visit, visitNumber: numbersByKey.get(visit.id || visit.localId) ?? visit.visitNumber });
    };

    const updateProposedVisitDate = (visitKey, date) => {
        if (!rebalanceReview || !date) return;
        const todayDate = new Date().toISOString().slice(0, 10);
        if (date <= rebalanceReview.attendedDate || date < todayDate) {
            setToast({ type: 'error', message: 'Rebalanced visits must be scheduled after the completed visit and not in the past.' });
            return;
        }
        if (rebalanceReview.proposed.some(visit =>
            (visit.id || visit.localId) !== visitKey && visit.status !== 'Cancelled' && visit.date === date
        )) {
            setToast({ type: 'error', message: 'Only one prenatal visit can be scheduled on a date.' });
            return;
        }
        const week = patientService.calculateWeeksAtDate(rebalanceReview.lmp, date);
        setRebalanceReview(current => ({
            ...current,
            proposed: renumberProposedVisits(current.proposed.map(visit => (visit.id || visit.localId) === visitKey
                ? { ...visit, date, week, trimester: patientService.getTrimesterFromWeek(week) }
                : visit))
        }));
    };

    const addProposedVisit = () => {
        if (!rebalanceReview || !rebalanceNewDate) return;
        if (rebalanceNewDate <= rebalanceReview.attendedDate || rebalanceNewDate < new Date().toISOString().slice(0, 10)) {
            setToast({ type: 'error', message: 'Add a future visit date after the completed visit.' });
            return;
        }
        if (rebalanceReview.proposed.some(visit => visit.status !== 'Cancelled' && visit.date === rebalanceNewDate)) {
            setToast({ type: 'error', message: 'Only one prenatal visit can be scheduled on a date.' });
            return;
        }
        const earliestScheduled = rebalanceReview.proposed
            .filter(visit => visit.status !== 'Cancelled' && visit.date)
            .sort((left, right) => left.date.localeCompare(right.date))[0];
        if (earliestScheduled && rebalanceNewDate < earliestScheduled.date) {
            setToast({ type: 'error', message: 'Add the visit after the first remaining scheduled visit so the completed visit history remains unchanged.' });
            return;
        }
        const week = patientService.calculateWeeksAtDate(rebalanceReview.lmp, rebalanceNewDate);
        setRebalanceReview(current => ({
            ...current,
            proposed: renumberProposedVisits([...current.proposed, {
                new: true,
                localId: crypto.randomUUID(),
                date: rebalanceNewDate,
                week,
                trimester: patientService.getTrimesterFromWeek(week),
                type: 'Additional prenatal visit',
                status: 'Scheduled',
                visitNumber: 1
            }])
        }));
        setRebalanceNewDate('');
    };

    const removeProposedVisit = visit => {
        if (!rebalanceReview) return;
        setRebalanceReview(current => ({
            ...current,
            proposed: renumberProposedVisits(visit.new
                ? current.proposed.filter(item => item !== visit)
                : current.proposed.map(item => item.id === visit.id ? { ...item, status: 'Cancelled' } : item))
        }));
    };

    const confirmRebalancedSchedule = async () => {
        if (!rebalanceReview) return;
        setIsApplyingRebalance(true);
        let rebalanceApplied = false;
        try {
            const active = rebalanceReview.proposed
                .filter(visit => visit.status !== 'Cancelled')
                .sort((left, right) => left.date.localeCompare(right.date));
            const activeIndexes = new Map(active.map((visit, index) => [
                visit.id || visit.localId,
                index
            ]));
            if (active.some(visit => !visit.date || visit.date <= rebalanceReview.attendedDate)) {
                throw new Error('Every remaining visit must have a date after the completed visit.');
            }
            if (new Set(active.map(visit => visit.date)).size !== active.length) {
                throw new Error('Only one prenatal visit can be scheduled on a date.');
            }
            const withNextDates = rebalanceReview.proposed.map(visit => ({
                ...visit,
                ...(visit.status === 'Cancelled' ? {} : {
                    visitNumber: (activeIndexes.get(visit.id || visit.localId) ?? 0) + 1
                }),
                nextApptDate: visit.status === 'Cancelled' ? null
                    : active.find((nextVisit, index) => index > active.findIndex(item =>
                        (item.id || item.localId) === (visit.id || visit.localId)
                    ))?.date || null
            }));
            const existingSchedule = withNextDates
                .filter(visit => !visit.new)
                .sort((left, right) => {
                    if (left.status === 'Cancelled') return 1;
                    if (right.status === 'Cancelled') return -1;
                    return left.date.localeCompare(right.date);
                });
            const { error } = await patientService.supabase.rpc('rebalance_prenatal_visits', {
                p_current_visit_id: rebalanceReview.currentVisitId,
                p_schedule: existingSchedule,
                p_future_visit_ids: rebalanceReview.futureVisitIds
            });
            if (error) throw error;
            rebalanceApplied = true;

            const additions = active.filter(visit => visit.new);
            if (additions.length) {
                const assignedStaff = (patient?.currentPregnancy?.visits || [])
                    .find(visit => visit.status === 'Scheduled' && visit.assigned_staff)?.assigned_staff || null;
                await patientService.insertPrenatalSchedule(
                    patientId,
                    additions,
                    user?.id,
                    { retained_staff: assignedStaff },
                    35
                );
            }
            await patientService.resequencePrenatalVisitNumbers(patientId);
            setRebalanceReview(null);
            setToast({ type: 'success', message: 'The reviewed prenatal schedule was saved.' });
            setTimeout(() => navigate('/dashboard/prenatal'), 1200);
        } catch (error) {
            console.error('Could not save the reviewed prenatal schedule:', error);
            setToast({
                type: 'error',
                message: rebalanceApplied
                    ? `Existing visits were rebalanced, but an added visit could not be saved: ${error.message}. Refresh before retrying.`
                    : `Could not save the reviewed schedule: ${error.message}`
            });
        } finally {
            setIsApplyingRebalance(false);
        }
    };

    const keepCurrentSchedule = () => {
        setRebalanceReview(null);
        setToast({ type: 'success', message: 'Visit recorded; the existing future schedule was kept unchanged.' });
        setTimeout(() => navigate('/dashboard/prenatal'), 1200);
    };

    // Derived flags for UI
    const isHighBP = parseInt(formData.bpSystolic) >= 140 || parseInt(formData.bpDiastolic) >= 90;
    const scheduledVisitToRecord = (patient?.currentPregnancy?.visits || []).find(visit =>
        Number(visit.visit_number) === Number(formData.visitNumber)
        && visit.status === 'Scheduled'
    );
    const currentPregnancyVisits = patient?.currentPregnancy?.visits || [];
    const scheduledPregnancyVisits = currentPregnancyVisits
        .filter(visit => visit.status === 'Scheduled')
        .sort((left, right) => Number(left.visit_number) - Number(right.visit_number));
    const isOutsideScheduledDate = Boolean(
        scheduledVisitToRecord
        && String(scheduledVisitToRecord.visit_date).slice(0, 10) !== formData.visitDate
    );

    if (!patient) {
        return (
            <StaffPageLoader 
                message="Loading patient visit details..." 
                error={patientError} 
                onRetry={() => {
                    setPatientError(null);
                    patientService.getPatientById(patientId).then(setPatient).catch(err => {
                        console.error(err);
                        setPatientError(err);
                    });
                }} 
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
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Health Conditions</span>
                                <span className={`risk-tag ${patient?.hasHealthConditions || (formData.riskFactors && formData.riskFactors.some(f => f && f !== 'None')) ? 'risk-high' : 'risk-normal'}`} style={{ margin: 0, display: 'inline-block', width: 'fit-content' }}>
                                    {patient?.hasHealthConditions || (formData.riskFactors && formData.riskFactors.some(f => f && f !== 'None')) ? 'Documented Conditions' : 'None Reported'}
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
                                <p className="section-sub">Select any applicable symptoms to document health conditions and clinical risk factors.</p>

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
                            {scheduledPregnancyVisits.length > 0 ? (
                                <select name="visitNumber" value={formData.visitNumber} onChange={handleChange}>
                                    {scheduledPregnancyVisits.map(visit => (
                                        <option key={visit.id} value={visit.visit_number}>
                                            Visit {visit.visit_number} · {String(visit.visit_date).slice(0, 10)}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input type="number" readOnly className="read-only" value={formData.visitNumber} />
                            )}
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
                                    Review a proposed schedule based on this visit before any remaining dates are changed.
                                </small>
                            </div>
                        )}
                        <div className="form-group mt-2">
                            <label>Visit Station</label>
                            {userAccess?.role === 'admin' ? (
                                <select name="healthFacility" value={formData.healthFacility} onChange={handleChange}>
                                    <option value="">Select station</option>
                                    {stationOptions.map(station => (
                                        <option key={station.id} value={station.station_name}>{station.station_name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input value={formData.healthFacility || 'Station not assigned'} readOnly className="read-only" />
                            )}
                        </div>
                        <div className="form-group mt-2">
                            <label>Assigned Staff</label>
                            {userAccess?.role === 'staff' || (scheduledVisitToRecord && scheduledVisitToRecord.assigned_staff) ? (
                                <input
                                    value={userAccess?.role === 'staff'
                                        ? scheduledVisitToRecord?.assigned_staff_name || (patient?.stationId === userAccess.stationId ? user?.fullName : 'Not assigned')
                                        : scheduledVisitToRecord?.assigned_staff_name || 'Not assigned'}
                                    readOnly
                                    className="read-only"
                                />
                            ) : (
                                <select name="attendingMidwife" value={formData.attendingMidwife} onChange={handleChange}>
                                    <option value="">No staff assigned</option>
                                    {midwivesLoading ? (
                                        <option disabled>Loading...</option>
                                    ) : (
                                        midwives.map(midwife => (
                                            <option key={midwife.id} value={midwife.id}>{midwife.full_name}</option>
                                        ))
                                    )}
                                </select>
                            )}
                        </div>
                        <div className="form-group mt-2">
                            <label>Performed By</label>
                            <input value={user?.fullName || user?.displayName || 'Current user'} readOnly className="read-only" />
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
            {rebalanceReview && (
                <div className="modal-overlay" role="presentation">
                    <section className="modal-content" role="dialog" aria-modal="true" aria-labelledby="rebalance-review-title"
                        onClick={event => event.stopPropagation()} style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
                        <header className="modal-header">
                            <h2 id="rebalance-review-title">Review Prenatal Schedule Rebalance</h2>
                            <p>The completed visit has been saved. The remaining schedule will stay unchanged until you confirm below.</p>
                        </header>
                        <div className="modal-body" style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                                <section>
                                    <h3>Current future schedule</h3>
                                    {rebalanceReview.current.map(visit => (
                                        <div key={visit.id} style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>
                                            Visit {visit.visit_number} · {visit.visit_date}
                                        </div>
                                    ))}
                                    {rebalanceReview.current.length === 0 && <p>No eligible future visits.</p>}
                                </section>
                                <section>
                                    <h3>Proposed schedule (editable)</h3>
                                    {rebalanceReview.proposed.map((visit, index) => (
                                        <div key={visit.id || `new-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: 8, borderBottom: '1px solid #e2e8f0', opacity: visit.status === 'Cancelled' ? 0.55 : 1 }}>
                                            <div>
                                                <label>{visit.new ? 'Additional visit' : `Visit ${visit.visitNumber || ''}`}
                                                    <input
                                                        type="date"
                                                        min={new Date().toISOString().slice(0, 10)}
                                                        value={visit.date || ''}
                                                        disabled={visit.status === 'Cancelled'}
                                                        onChange={event => updateProposedVisitDate(visit.id || visit.localId, event.target.value)}
                                                    />
                                                </label>
                                                {visit.status === 'Cancelled' && <div>Removed from proposed schedule</div>}
                                            </div>
                                            {visit.status !== 'Cancelled' && (
                                                <button type="button" className="btn btn-outline" onClick={() => removeProposedVisit(visit)}>
                                                    <Trash2 size={14} /> Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'end' }}>
                                        <label>Add visit between existing visits
                                            <input type="date" min={new Date().toISOString().slice(0, 10)} value={rebalanceNewDate} onChange={event => setRebalanceNewDate(event.target.value)} />
                                        </label>
                                        <button type="button" className="btn btn-outline" onClick={addProposedVisit} disabled={!rebalanceNewDate}><Plus size={14} /> Add</button>
                                    </div>
                                </section>
                            </div>
                        </div>
                        <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16 }}>
                            <button type="button" className="btn btn-outline" disabled={isApplyingRebalance} onClick={keepCurrentSchedule}>Keep current schedule</button>
                            <button type="button" className="btn btn-primary" disabled={isApplyingRebalance} onClick={confirmRebalancedSchedule}>
                                {isApplyingRebalance ? 'Saving…' : 'Confirm and save schedule'}
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </div>
    );
};

export default AddPrenatalVisit;
