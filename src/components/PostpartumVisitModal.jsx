import React, { useEffect, useState, useContext } from 'react';
import { Activity, CheckCircle2, ClipboardList, RefreshCw, UserRound, X } from 'lucide-react';
import supabase from '../config/supabaseclient';
import { AuthContext } from '../context/AuthContext';
import BabyService from '../services/babyservices';
import { useModal } from '../context/ModalContext';
import '../styles/pages/PostpartumRecords.css';

const sections = [
    { title: 'Vital signs', fields: [
        ['bp_systolic', 'Systolic blood pressure (mmHg)', 'integer'],
        ['bp_diastolic', 'Diastolic blood pressure (mmHg)', 'integer'],
        ['weight_kg', 'Weight (kg)', 'number'],
        ['temp_c', 'Temperature (°C)', 'number'],
        ['pulse_bpm', 'Pulse (bpm)', 'integer'],
        ['resp_rate_cpm', 'Respiratory rate (/min)', 'integer'],
    ] },
    { title: 'Postpartum examination', fields: [
        ['uterine_involution', 'Uterine involution'],
        ['lochia_assessment', 'Lochia assessment'],
        ['perineal_or_wound_condition', 'Perineal / wound condition'],
        ['pain_assessment', 'Pain assessment'],
        ['breast_assessment', 'Breast assessment'],
        ['breastfeeding_status', 'Breastfeeding status'],
        ['urination_and_bowel_status', 'Urination and bowel status'],
        ['mental_health_assessment', 'Mental health assessment'],
    ] },
    { title: 'Care plan', fields: [
        ['clinical_notes', 'Clinical notes'],
        ['advice_given', 'Advice given'],
        ['treatments_given', 'Treatments given'],
        ['medications_review', 'Medications reviewed'],
        ['family_planning_counseling', 'Family planning counseling'],
    ] },
];

const dangerSignOptions = [
    'Heavy bleeding',
    'Fever or infection',
    'High blood pressure',
    'Severe headache or vision problems',
    'Wound complications',
    'Breast infection',
];

const localDateValue = date => {
    const local = new Date(date);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    return local.toISOString().slice(0, 10);
};

const PostpartumVisitModal = ({ mother, onClose, onSave }) => {
    const { user } = useContext(AuthContext);
    const { alert: customAlert } = useModal();
    const [staff, setStaff] = useState([]);
    const [staffId, setStaffId] = useState('');
    const [visitId, setVisitId] = useState('');
    const [date, setDate] = useState(localDateValue(new Date()));
    const [status, setStatus] = useState('Attended');
    const [values, setValues] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadStaff = async () => {
            const { data: profile } = await supabase.from('staff_profiles').select('station_ass').eq('id', user?.id || '').maybeSingle();
            const stationId = mother.stationId || profile?.station_ass;
            let query = supabase.from('staff_profiles').select('id, full_name, station_ass').order('full_name');
            if (stationId) query = query.eq('station_ass', stationId);
            const { data } = await query;
            const options = data || [];
            setStaff(options);
            const own = options.find(item => item.id === user?.id);
            setStaffId(user?.role === 'staff' ? (own?.id || user?.id || '') : (own?.id || options[0]?.id || ''));
            setLoading(false);
        };
        loadStaff();
    }, [mother.stationId, user?.id, user?.role]);

    const update = (key, value) => setValues(prev => ({ ...prev, [key]: value }));
    const scheduledVisits = mother.scheduledVisits || [];
    const selectedVisit = scheduledVisits.find(visit => visit.id === visitId);

    useEffect(() => {
        const nextVisit = mother.scheduledVisits?.find(visit => !['Completed', 'Cancelled'].includes(visit.status));
        setVisitId(nextVisit?.id || '');
    }, [mother.id, mother.scheduledVisits]);

    const handleSave = async () => {
        if (!visitId || (status === 'Attended' && (!date || !staffId)) || (status === 'Missed' && !values.missed_reason?.trim())) {
            await customAlert({ title: 'Missing Information', text: status === 'Missed' ? 'Enter a reason for the missed visit.' : 'Select a scheduled postpartum visit, visit date, and personnel present.', iconType: 'warning' });
            return;
        }
        const integerVitalFields = ['bp_systolic', 'bp_diastolic', 'pulse_bpm', 'resp_rate_cpm'];
        const invalidIntegerVital = status === 'Attended' && integerVitalFields.some(key =>
            values[key] && (!Number.isInteger(Number(values[key])) || Number(values[key]) <= 0)
        );
        const decimalVitalFields = ['weight_kg', 'temp_c'];
        const invalidDecimalVital = status === 'Attended' && decimalVitalFields.some(key =>
            values[key] && (!Number.isFinite(Number(values[key])) || Number(values[key]) <= 0)
        );
        if (invalidIntegerVital || invalidDecimalVital) {
            await customAlert({ title: 'Invalid Vital Sign', text: 'Enter positive values; blood pressure, pulse, and respiratory rate must be whole numbers.', iconType: 'warning' });
            return;
        }
        setSaving(true);
        try {
            await new BabyService().savePostpartumVisit(visitId, {
                status,
                attendedDate: status === 'Attended' ? date : null,
                personnelPresent: status === 'Attended' ? staffId : null,
                performedBy: status === 'Attended' ? user?.id || null : null,
                values,
            });
            onSave?.();
            onClose();
        } catch (error) {
            await customAlert({ title: 'Unable to Save', text: error.message, iconType: 'danger' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="pp-modal pp-visit-modal" onClick={event => event.stopPropagation()}>
                <div className="modal-header">
                    <div><h2><ClipboardList size={20} /> Record Postpartum Visit</h2><p>{mother.name} · {mother.station}</p></div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <div className="pp-visit-meta">
                        <label>Scheduled postpartum visit
                            <select value={visitId} onChange={event => setVisitId(event.target.value)}>
                                <option value="">Select scheduled visit</option>
                                {scheduledVisits.map(visit => (
                                    <option key={visit.id} value={visit.id} disabled={visit.status === 'Completed' || visit.status === 'Cancelled'}>
                                        {visit.visit_type} — {new Date(visit.scheduled_at).toLocaleDateString()} ({visit.status})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>Visit outcome
                            <select value={status} onChange={event => setStatus(event.target.value)}>
                                <option value="Attended">Attended</option>
                                <option value="Missed">Missed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </label>
                        {status === 'Attended' && <label>Attended date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>}
                        {status === 'Attended' && (
                            <label><UserRound size={14} /> Personnel present
                                <select value={staffId} onChange={event => setStaffId(event.target.value)} disabled={loading || user?.role === 'staff'}>
                                    <option value="">Select personnel</option>
                                    {staff.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                                </select>
                            </label>
                        )}
                    </div>
                    {selectedVisit?.assigned_staff && <p className="pp-readonly-note">Assigned prenatal staff: {staff.find(item => item.id === selectedVisit.assigned_staff)?.full_name || 'Assigned staff member'}</p>}
                    {user?.role === 'staff' && <p className="pp-readonly-note">The signed-in staff member is recorded as the person who entered this assessment.</p>}
                    {status === 'Missed' && (
                        <label className="pp-general-remarks">Reason for missed visit
                            <textarea rows="2" value={values.missed_reason || ''} onChange={event => update('missed_reason', event.target.value)} />
                        </label>
                    )}
                    {status === 'Attended' && sections.map(section => (
                        <section className="pp-assessment-section" key={section.title}>
                            <h3><Activity size={15} /> {section.title}</h3>
                            <div className="pp-assessment-grid">
                                {section.fields.map(([key, label, type = 'textarea']) => (
                                    <label key={key}>{label}
                                        {type === 'number' || type === 'integer'
                                            ? <input type="number" min="0" step={type === 'integer' ? '1' : 'any'} value={values[key] || ''} onChange={event => update(key, event.target.value)} />
                                            : <textarea rows="2" value={values[key] || ''} onChange={event => update(key, event.target.value)} />}
                                    </label>
                                ))}
                            </div>
                        </section>
                    ))}
                    {status === 'Attended' && (
                        <>
                            <section className="pp-assessment-section">
                                <h3><Activity size={15} /> Danger signs</h3>
                                <div className="pp-assessment-grid">
                                    {dangerSignOptions.map(sign => (
                                        <label key={sign} className="pp-danger-sign-option">
                                            <input
                                                type="checkbox"
                                                checked={(values.danger_signs || []).includes(sign)}
                                                onChange={event => update(
                                                    'danger_signs',
                                                    event.target.checked
                                                        ? [...(values.danger_signs || []), sign]
                                                        : (values.danger_signs || []).filter(value => value !== sign)
                                                )}
                                            />
                                            {sign}
                                        </label>
                                    ))}
                                </div>
                            </section>
                            <section className="pp-assessment-section">
                                <h3><Activity size={15} /> Referral and next appointment</h3>
                                <div className="pp-assessment-grid">
                                    <label>Referral needed
                                        <select value={values.is_referred ? 'true' : 'false'} onChange={event => update('is_referred', event.target.value === 'true')}>
                                            <option value="false">No</option>
                                            <option value="true">Yes</option>
                                        </select>
                                    </label>
                                    {values.is_referred && <>
                                        <label>Referred to<textarea rows="2" value={values.referred_to || ''} onChange={event => update('referred_to', event.target.value)} /></label>
                                        <label>Referral reason<textarea rows="2" value={values.referral_reason || ''} onChange={event => update('referral_reason', event.target.value)} /></label>
                                    </>}
                                    <label>Next appointment date<input type="date" value={values.next_appt_date || ''} onChange={event => update('next_appt_date', event.target.value)} /></label>
                                    <label>Next appointment type<input value={values.next_appt_type || ''} onChange={event => update('next_appt_type', event.target.value)} /></label>
                                </div>
                            </section>
                            <label className="pp-general-remarks">Additional notes<textarea rows="3" value={values.notes || ''} onChange={event => update('notes', event.target.value)} /></label>
                        </>
                    )}
                    {status === 'Cancelled' && <label className="pp-general-remarks">Cancellation notes<textarea rows="3" value={values.notes || ''} onChange={event => update('notes', event.target.value)} /></label>}
                </div>
                <div className="modal-footer"><button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>{saving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {saving ? 'Saving...' : 'Save Visit'}</button></div>
            </div>
        </div>
    );
};

export default PostpartumVisitModal;