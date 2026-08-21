import React, { useEffect, useState, useContext } from 'react';
import { Activity, CheckCircle2, ClipboardList, RefreshCw, UserRound, X } from 'lucide-react';
import supabase from '../config/supabaseclient';
import { AuthContext } from '../context/AuthContext';
import BabyService from '../services/babyservices';
import { useModal } from '../context/ModalContext';
import '../styles/pages/PostpartumRecords.css';

const sections = [
    { title: 'Vital signs', fields: [['blood_pressure', 'Blood pressure'], ['temperature', 'Temperature'], ['pulse', 'Pulse'], ['respiratory_rate', 'Respiratory rate']] },
    { title: 'Uterus / abdominal recovery', fields: [['fundal_height_involution', 'Fundal height / involution'], ['uterine_firmness', 'Uterine firmness'], ['uterine_tenderness', 'Uterine tenderness']] },
    { title: 'Vaginal bleeding (lochia)', fields: [['lochia_amount', 'Amount'], ['lochia_color_type', 'Color / type'], ['lochia_clots', 'Presence of clots'], ['lochia_foul_smell', 'Foul-smelling discharge']] },
    { title: 'Perineum / birth injury', fields: [['perineal_healing', 'Perineal healing'], ['episiotomy_laceration', 'Episiotomy / laceration status'], ['perineal_pain', 'Pain'], ['perineal_swelling_infection', 'Swelling or signs of infection']] },
    { title: 'Breastfeeding / breasts', fields: [['breast_condition', 'Breast condition'], ['nipple_condition', 'Nipple condition'], ['breastfeeding_status', 'Breastfeeding status'], ['breastfeeding_problems', 'Problems with breastfeeding']] },
    { title: 'Pain', fields: [['pain_location', 'Location'], ['pain_severity', 'Severity'], ['pain_management', 'Current pain management']] },
    { title: 'Urination & bowel function', fields: [['difficulty_urinating', 'Difficulty urinating'], ['constipation', 'Constipation'], ['bowel_movement', 'Bowel movement'], ['incontinence', 'Incontinence']] },
    { title: 'Maternal mental / emotional status', fields: [['mood', 'Mood'], ['anxiety_depressive_symptoms', 'Anxiety / depressive symptoms'], ['emotional_wellbeing', 'Emotional wellbeing'], ['support_at_home', 'Support at home']] },
    { title: 'Family planning / contraception', fields: [['contraception_method', 'Contraception method'], ['counseling_provided', 'Counseling provided'], ['pregnancy_spacing_plans', 'Pregnancy spacing plans']] },
    { title: 'Postpartum complications', fields: [['heavy_bleeding', 'Heavy bleeding'], ['fever_infection', 'Fever / infection'], ['high_blood_pressure', 'High blood pressure'], ['severe_headache_vision', 'Severe headache / vision problems'], ['wound_complications', 'Wound complications'], ['breast_infection', 'Breast infection']] },
];

const selectFields = new Set(['uterine_firmness', 'lochia_amount', 'lochia_color_type', 'lochia_clots', 'lochia_foul_smell', 'breastfeeding_status', 'pain_severity', 'difficulty_urinating', 'constipation', 'bowel_movement', 'incontinence', 'mood', 'support_at_home', 'counseling_provided']);

const PostpartumVisitModal = ({ mother, onClose, onSave }) => {
    const { user } = useContext(AuthContext);
    const { alert: customAlert } = useModal();
    const [staff, setStaff] = useState([]);
    const [staffId, setStaffId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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

    const handleSave = async () => {
        if (!date || !staffId) {
            await customAlert({ title: 'Missing Information', text: 'Select the visit date and personnel present.', iconType: 'warning' });
            return;
        }
        setSaving(true);
        try {
            const selectedStaff = staff.find(item => item.id === staffId);
            const remarks = {
                recorded_at: new Date().toISOString(),
                recorded_by: user?.id || null,
                personnel_present: { id: staffId, name: selectedStaff?.full_name || user?.fullName || '' },
                assessment: values,
            };
            await new BabyService().savePostpartumVisit(mother.id, { date, remarks });
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
                        <label>Visit date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
                        <label><UserRound size={14} /> Personnel present
                            <select value={staffId} onChange={event => setStaffId(event.target.value)} disabled={loading || user?.role === 'staff'}>
                                <option value="">Select personnel</option>
                                {staff.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                            </select>
                        </label>
                    </div>
                    {user?.role === 'staff' && <p className="pp-readonly-note">Staff accounts can record visits only under their own name.</p>}
                    {sections.map(section => (
                        <section className="pp-assessment-section" key={section.title}>
                            <h3><Activity size={15} /> {section.title}</h3>
                            <div className="pp-assessment-grid">
                                {section.fields.map(([key, label]) => (
                                    <label key={key}>{label}
                                        {selectFields.has(key) ? (
                                            <select value={values[key] || ''} onChange={event => update(key, event.target.value)}>
                                                <option value="">Not assessed</option><option>Normal</option><option>None</option><option>No</option><option>Yes</option><option>Mild</option><option>Moderate</option><option>Severe</option><option>Rubra</option><option>Serosa</option><option>Alba</option>
                                            </select>
                                        ) : <textarea rows="2" value={values[key] || ''} onChange={event => update(key, event.target.value)} />}
                                    </label>
                                ))}
                            </div>
                        </section>
                    ))}
                    <label className="pp-general-remarks">General notes<textarea rows="3" value={values.general_notes || ''} onChange={event => update('general_notes', event.target.value)} /></label>
                </div>
                <div className="modal-footer"><button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>{saving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {saving ? 'Saving...' : 'Save Visit'}</button></div>
            </div>
        </div>
    );
};

export default PostpartumVisitModal;