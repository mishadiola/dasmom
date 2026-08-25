import React, { useState, useEffect } from 'react';
import {
    Baby, Heart, ChevronDown, ChevronUp, Plus, Trash2, Edit2,
    Printer, Save, Check, X, Info, AlertTriangle, FileText,
    MapPin, Users, ShieldCheck, ClipboardList, CheckSquare, Square, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import '../../styles/pages/PregnancyDeliveryInfo.css';

// ─── Complication options ────────────────────────────────────────────
const COMPLICATION_OPTIONS = [
    'Preeclampsia / Hypertension',
    'Gestational Diabetes',
    'Anemia',
    'Preterm Birth',
    'Miscarriage / Stillbirth',
    'C-section (Cesarean)',
    'Postpartum Hemorrhage',
    'Placenta Previa',
    'Prolonged Labor',
    'None',
];

const DELIVERY_TYPES = ['Normal Spontaneous Delivery (NSD)', 'Cesarean Section (C-section)', 'Assisted Delivery (Forceps/Vacuum)', 'Home Delivery', 'Other'];

const BLANK_PREGNANCY = {
    id: null,
    year: '',
    outcome: 'Live Birth',
    deliveryType: 'Normal Spontaneous Delivery (NSD)',
    complications: [],
    notes: '',
    expanded: true,
};

// ─── Helper ──────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, label }) => (
    <button
        type="button"
        className={`pdi-toggle ${checked ? 'pdi-toggle--on' : ''}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
    >
        <span className="pdi-toggle-knob" />
        <span className="pdi-toggle-label">{checked ? 'Yes' : 'No'}</span>
    </button>
);

// ─── Past Pregnancy Card ─────────────────────────────────────────────
const PastPregnancyCard = ({ index, data, onChange, onRemove }) => {
    const [open, setOpen] = useState(data.expanded ?? true);

    const toggleComp = (comp) => {
        const next = data.complications.includes(comp)
            ? data.complications.filter(c => c !== comp)
            : [...data.complications.filter(c => c !== 'None'), comp === 'None' ? 'None' : comp];
        if (comp === 'None') { onChange(index, { ...data, complications: ['None'] }); return; }
        onChange(index, { ...data, complications: next.filter(c => c !== 'None') });
    };

    return (
        <div className="pdi-past-card">
            <div className="pdi-past-card-header" onClick={() => setOpen(v => !v)}>
                <div className="pdi-past-card-title">
                    <Baby size={16} />
                    <span>Pregnancy #{index + 1}</span>
                    {data.year && <span className="pdi-past-year-badge">{data.year}</span>}
                </div>
                <div className="pdi-past-card-actions">
                    <button
                        className="pdi-icon-btn pdi-icon-btn--danger"
                        onClick={e => { e.stopPropagation(); onRemove(index); }}
                        title="Remove"
                    >
                        <Trash2 size={14} />
                    </button>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            {open && (
                <div className="pdi-past-card-body">
                    <div className="pdi-field-row">
                        <div className="pdi-field">
                            <label>Year of Delivery</label>
                            <input
                                type="number"
                                min="1990"
                                max={new Date().getFullYear()}
                                value={data.year}
                                onChange={e => onChange(index, { ...data, year: e.target.value })}
                                placeholder="e.g. 2021"
                            />
                        </div>
                        <div className="pdi-field">
                            <label>Pregnancy Outcome</label>
                            <select value={data.outcome} onChange={e => onChange(index, { ...data, outcome: e.target.value })}>
                                <option>Live Birth</option>
                                <option>Stillbirth</option>
                                <option>Miscarriage</option>
                                <option>Ectopic Pregnancy</option>
                            </select>
                        </div>
                        <div className="pdi-field">
                            <label>Delivery Type</label>
                            <select value={data.deliveryType} onChange={e => onChange(index, { ...data, deliveryType: e.target.value })}>
                                {DELIVERY_TYPES.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="pdi-field">
                        <label>Complications (select all that apply)</label>
                        <div className="pdi-comp-grid">
                            {COMPLICATION_OPTIONS.map(comp => (
                                <label key={comp} className="pdi-comp-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={data.complications.includes(comp)}
                                        onChange={() => toggleComp(comp)}
                                    />
                                    <span>{comp}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="pdi-field">
                        <label>Additional Notes <span className="pdi-optional">(optional)</span></label>
                        <textarea
                            rows={2}
                            value={data.notes}
                            onChange={e => onChange(index, { ...data, notes: e.target.value })}
                            placeholder="Any details about this pregnancy or delivery…"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────
const PregnancyDeliveryInfo = () => {
    const navigate = useNavigate();
    const [saved, setSaved] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const authService = new AuthService();
    const patientService = new PatientService();

    // ── Section A — Past Pregnancies ──────────────────────────────
    const [gravida, setGravida] = useState('0');
    const [para, setPara] = useState('0');
    const [pastPregnancies, setPastPregnancies] = useState([]);

    // ── Section B — Current Delivery Preferences ──────────────────
    const [prefs, setPrefs] = useState({
        assistedBy: '',
        facility: '',
        philhealthFacility: false,
        philhealthMember: false,
        birthPlan: '',
        allergies: '',
    });
    const setP = (k, v) => setPrefs(p => ({ ...p, [k]: v }));

    // Load data from Supabase on mount
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const authUser = await authService.getAuthUser();
                if (!authUser?.id) {
                    setError('Not authenticated');
                    return;
                }

                const patient = await patientService.getPatientById(authUser.id);
                if (!patient) {
                    setError('Patient not found');
                    return;
                }

                // Load pregnancy info
                if (patient.pregnancy_info) {
                    setGravida(String(patient.pregnancy_info.gravida || '0'));
                    setPara(String(patient.pregnancy_info.para || '0'));
                }

                // Load past pregnancies from deliveries
                if (patient.deliveries && patient.deliveries.length > 0) {
                    const pastPregnancies = patient.deliveries.map((delivery, idx) => ({
                        id: delivery.id,
                        year: delivery.delivery_date ? new Date(delivery.delivery_date).getFullYear().toString() : '',
                        outcome: delivery.delivery_type ? (delivery.delivery_type.includes('Live') ? 'Live Birth' : 'Other') : 'Live Birth',
                        deliveryType: delivery.delivery_mode || 'Normal Spontaneous Delivery (NSD)',
                        complications: delivery.complications ? (Array.isArray(delivery.complications) ? delivery.complications : []) : [],
                        notes: delivery.notes || '',
                        expanded: false,
                    }));
                    setPastPregnancies(pastPregnancies);
                }

                // Load delivery preferences from pregnancy_info notes or separate field
                if (patient.pregnancy_info) {
                    const preferences = patient.pregnancy_info.delivery_preferences || {};
                    setPrefs({
                        assistedBy: preferences.assistedBy || '',
                        facility: preferences.facility || patient.pregnancy_info.place_of_delivery || '',
                        philhealthFacility: preferences.philhealthFacility || false,
                        philhealthMember: preferences.philhealthMember || false,
                        birthPlan: preferences.birthPlan || '',
                        allergies: preferences.allergies || '',
                    });
                }
            } catch (err) {
                console.error('Failed to load pregnancy delivery info:', err);
                setError('Failed to load data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // ── Past Pregnancy handlers ───────────────────────────────────
    const addPastPregnancy = () => {
        setPastPregnancies(prev => [...prev, { ...BLANK_PREGNANCY }]);
    };

    const updatePastPregnancy = (i, data) => {
        setPastPregnancies(prev => { const n = [...prev]; n[i] = data; return n; });
    };

    const removePastPregnancy = (i) => {
        setPastPregnancies(prev => prev.filter((_, idx) => idx !== i));
    };

    const handleSave = async () => {
        try {
            setError(null);
            const authUser = await authService.getAuthUser();
            if (!authUser?.id) {
                setError('Not authenticated');
                return;
            }

            // Save pregnancy info and delivery preferences to Supabase
            const pregnancyData = {
                gravida: parseInt(gravida) || 0,
                para: parseInt(para) || 0,
                place_of_delivery: prefs.facility,
                delivery_preferences: {
                    assistedBy: prefs.assistedBy,
                    facility: prefs.facility,
                    philhealthFacility: prefs.philhealthFacility,
                    philhealthMember: prefs.philhealthMember,
                    birthPlan: prefs.birthPlan,
                    allergies: prefs.allergies,
                }
            };

            await patientService.updatePatient(authUser.id, {
                pregnancy_info: pregnancyData,
                delivery_preferences: prefs
            });

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save pregnancy delivery info:', err);
            setError('Failed to save data. Please try again.');
        }
    };

    const handlePrint = () => window.print();

    if (loading) {
        return (
            <div className="pdi-page">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">
                            <ClipboardList size={22} className="header-icon" /> Delivery Info
                        </h1>
                        <p className="page-subtitle">Loading your pregnancy and delivery information...</p>
                    </div>
                    <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => navigate('/mother-home')}>
                            <ArrowLeft size={16} /> Back
                        </button>
                    </div>
                </div>
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pdi-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <ClipboardList size={22} className="header-icon" /> Delivery Info
                    </h1>
                    <p className="page-subtitle">Your past pregnancy history and delivery preferences</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>

                    <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handlePrint}>
                        <Printer size={16} /> Print / Export
                    </button>
                    <button
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={handleSave}
                        disabled={!agreed}
                        title={!agreed ? 'Please agree to the terms before saving.' : ''}
                    >
                        {saved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
                    </button>
                </div>
            </div>

            {error && (
                <div className="pdi-error-banner">
                    <AlertTriangle size={18} />
                    <p>{error}</p>
                </div>
            )}

            {/* ── Progress Indicator ── */}
            <div className="pdi-progress-bar-wrap">
                <div className="pdi-progress-step pdi-progress-step--done">
                    <span>1</span> Past Pregnancies
                </div>
                <div className="pdi-progress-line" />
                <div className="pdi-progress-step pdi-progress-step--done">
                    <span>2</span> Delivery Preferences
                </div>
                <div className="pdi-progress-line" />
                <div className="pdi-progress-step">
                    <span>3</span> Agreement
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                SECTION A — PAST PREGNANCIES
            ══════════════════════════════════════════════════ */}
            <section className="pdi-section">
                <div className="pdi-section-header pdi-section-header--a">
                    <div className="pdi-section-icon"><Baby size={20} /></div>
                    <div>
                        <h2>My Past Pregnancies &amp; Deliveries</h2>
                        <p>Record your previous pregnancy and delivery history. This helps your midwife plan better care.</p>
                    </div>
                </div>

                {/* Gravida / Para Summary */}
                <div className="pdi-gp-row">
                    <div className="pdi-gp-box">
                        <label>
                            Gravida (G)
                            <span className="pdi-tooltip" title="Total number of times you have been pregnant">
                                <Info size={13} />
                            </span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={gravida}
                            onChange={e => setGravida(e.target.value)}
                            className="pdi-gp-input"
                        />
                        <span className="pdi-gp-hint">Total pregnancies</span>
                    </div>
                    <div className="pdi-gp-divider">×</div>
                    <div className="pdi-gp-box">
                        <label>
                            Para (P)
                            <span className="pdi-tooltip" title="Number of deliveries after 20 weeks gestation">
                                <Info size={13} />
                            </span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={para}
                            onChange={e => setPara(e.target.value)}
                            className="pdi-gp-input"
                        />
                        <span className="pdi-gp-hint">Live births / deliveries</span>
                    </div>
                </div>

                {/* Past Pregnancy Cards */}
                <div className="pdi-past-list">
                    {pastPregnancies.map((pp, i) => (
                        <PastPregnancyCard
                            key={i}
                            index={i}
                            data={pp}
                            onChange={updatePastPregnancy}
                            onRemove={removePastPregnancy}
                        />
                    ))}
                </div>

                {pastPregnancies.length === 0 && (
                    <div className="pdi-no-past-pregnancies">
                        <p>No past pregnancies recorded yet.</p>
                    </div>
                )}

                <button className="pdi-add-btn" onClick={addPastPregnancy}>
                    <Plus size={16} /> Add Past Pregnancy
                </button>
            </section>

            {/* ══════════════════════════════════════════════════
                SECTION B — CURRENT DELIVERY PREFERENCES
            ══════════════════════════════════════════════════ */}
            <section className="pdi-section">
                <div className="pdi-section-header pdi-section-header--b">
                    <div className="pdi-section-icon"><ClipboardList size={20} /></div>
                    <div>
                        <h2>My Delivery Preferences &amp; Birth Plan</h2>
                        <p>Share your preferences for your upcoming delivery so your care team can prepare accordingly.</p>
                    </div>
                </div>

                <div className="pdi-prefs-grid">
                    {/* Assisted by */}
                    <div className="pdi-field">
                        <label>
                            <Users size={13} /> Who will assist during delivery?
                            <span className="pdi-required">*</span>
                        </label>
                        <input
                            type="text"
                            value={prefs.assistedBy}
                            onChange={e => setP('assistedBy', e.target.value)}
                            placeholder="e.g. Midwife Elena P., Dr. Santos at San Lazaro Hospital"
                        />
                    </div>

                    {/* Facility */}
                    <div className="pdi-field">
                        <label>
                            <MapPin size={13} /> Delivery location / facility
                            <span className="pdi-required">*</span>
                        </label>
                        <input
                            type="text"
                            value={prefs.facility}
                            onChange={e => setP('facility', e.target.value)}
                            placeholder="e.g. Dasmariñas City Health Center, De La Salle Medical Center"
                        />
                    </div>

                    {/* PhilHealth toggles */}
                    <div className="pdi-toggle-group pdi-field--full">
                        <div className="pdi-toggle-field">
                            <div className="pdi-toggle-label-wrap">
                                <ShieldCheck size={15} className="pdi-toggle-ico pdi-toggle-ico--green" />
                                <div>
                                    <strong>PhilHealth Accredited Facility?</strong>
                                    <span>Is your chosen delivery facility PhilHealth-accredited?</span>
                                </div>
                            </div>
                            <Toggle checked={prefs.philhealthFacility} onChange={v => setP('philhealthFacility', v)} />
                        </div>

                        <div className="pdi-toggle-field">
                            <div className="pdi-toggle-label-wrap">
                                <ShieldCheck size={15} className="pdi-toggle-ico pdi-toggle-ico--blue" />
                                <div>
                                    <strong>PhilHealth Member?</strong>
                                    <span>Are you a PhilHealth member or dependent?</span>
                                </div>
                            </div>
                            <Toggle checked={prefs.philhealthMember} onChange={v => setP('philhealthMember', v)} />
                        </div>
                    </div>

                    {/* Birth plan */}
                    <div className="pdi-field pdi-field--full">
                        <label>
                            <FileText size={13} /> Preferred birth plan / additional notes
                            <span className="pdi-optional">(optional)</span>
                        </label>
                        <textarea
                            rows={4}
                            value={prefs.birthPlan}
                            onChange={e => setP('birthPlan', e.target.value)}
                            placeholder="Describe your delivery preferences: e.g. skin-to-skin contact, natural pain management, support persons allowed, cord banking…"
                        />
                    </div>

                    {/* Allergies */}
                    <div className="pdi-field pdi-field--full">
                        <label>
                            <AlertTriangle size={13} className="pdi-allergy-ico" /> Allergies / Medical Considerations
                            <span className="pdi-optional">(optional)</span>
                        </label>
                        <textarea
                            rows={2}
                            value={prefs.allergies}
                            onChange={e => setP('allergies', e.target.value)}
                            placeholder="e.g. Allergic to penicillin, latex. Inform care team before any procedure."
                        />
                        {prefs.allergies && (
                            <div className="pdi-allergy-warning">
                                <AlertTriangle size={14} /> This info will be highlighted for your care team.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════
                SECTION C — TERMS & CONDITIONS
            ══════════════════════════════════════════════════ */}
            <section className="pdi-section pdi-section--terms">
                <div className="pdi-section-header pdi-section-header--c">
                    <div className="pdi-section-icon"><CheckSquare size={20} /></div>
                    <div>
                        <h2>Agreement &amp; Terms</h2>
                        <p>Please read and acknowledge the statement below before saving your information.</p>
                    </div>
                </div>

                <div className="pdi-terms-box">
                    <p>
                        By checking below, I confirm that the information I have provided — including my past
                        pregnancy history, delivery preferences, and medical considerations — is accurate and
                        truthful to the best of my knowledge. I consent to this information being used by the
                        Station Health Office (BHO) / Community Health Office (CHO) staff for the purpose of
                        planning and managing my prenatal and delivery care under the DasMom+ maternal health system.
                    </p>
                    <p>
                        I understand that this data is private and will only be accessed by authorized healthcare
                        personnel of the CHO.
                    </p>
                </div>

                <label className="pdi-agree-row">
                    <button
                        type="button"
                        className={`pdi-agree-check ${agreed ? 'pdi-agree-check--on' : ''}`}
                        onClick={() => setAgreed(v => !v)}
                        aria-pressed={agreed}
                    >
                        {agreed && <Check size={14} />}
                    </button>
                    <span>
                        I acknowledge that the above information is accurate and can be used for my prenatal and delivery planning.{' '}
                        <a href="#" className="pdi-terms-link">View full terms</a>
                    </span>
                </label>
            </section>

            {/* ── Bottom Save Bar ── */}
            <div className="pdi-bottom-bar">
                <p className={`pdi-bottom-hint ${!agreed ? 'pdi-bottom-hint--warn' : ''}`}>
                    {agreed
                        ? <><Check size={14} /> You have agreed to the terms. You may now save your information.</>
                        : <><AlertTriangle size={14} /> Please check the agreement box above before saving.</>
                    }
                </p>
                <div className="pdi-bottom-actions">
                    <button className="pdi-btn pdi-btn--outline" onClick={handlePrint}>
                        <Printer size={15} /> Print / Export
                    </button>
                    <button
                        className={`pdi-btn pdi-btn--save ${saved ? 'pdi-btn--saved' : ''}`}
                        onClick={handleSave}
                        disabled={!agreed}
                    >
                        {saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PregnancyDeliveryInfo;
