import React, { useState } from 'react';
import {
    Baby, Heart, ChevronDown, ChevronUp, Plus, Trash2, Edit2,
    Printer, Save, Check, X, Info, AlertTriangle, FileText,
    MapPin, Users, ShieldCheck, ClipboardList, CheckSquare, Square
} from 'lucide-react';
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
                            {COMPLICATION_OPTIONS.map(comp => {
                                const checked = data.complications.includes(comp);
                                return (
                                    <button
                                        key={comp}
                                        type="button"
                                        className={`pdi-comp-chip ${checked ? 'pdi-comp-chip--checked' : ''}`}
                                        onClick={() => toggleComp(comp)}
                                    >
                                        {checked ? <CheckSquare size={13} /> : <Square size={13} />}
                                        {comp}
                                    </button>
                                );
                            })}
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
    const [saved, setSaved] = useState(false);
    const [agreed, setAgreed] = useState(false);

    // ── Section A — Past Pregnancies ──────────────────────────────
    const [gravida, setGravida] = useState('2');
    const [para, setPara]       = useState('2');
    const [pastPregnancies, setPastPregnancies] = useState([
        { year: '2019', outcome: 'Live Birth', deliveryType: 'Normal Spontaneous Delivery (NSD)', complications: ['None'], notes: '', expanded: false },
        { year: '2021', outcome: 'Live Birth', deliveryType: 'Normal Spontaneous Delivery (NSD)', complications: ['Anemia'], notes: 'Required iron supplementation', expanded: false },
    ]);

    // ── Section B — Current Delivery Preferences ──────────────────
    const [prefs, setPrefs] = useState({
        assistedBy: '',
        facility: '',
        philhealthFacility: false,
        philhealthMember: true,
        birthPlan: '',
        allergies: '',
    });
    const setP = (k, v) => setPrefs(p => ({ ...p, [k]: v }));

    // ── Past Pregnancy handlers ───────────────────────────────────
    const addPastPregnancy = () => {
        setPastPregnancies(prev => [...prev, { ...BLANK_PREGNANCY }]);
        setGravida(g => String(Number(g) + 1));
    };
    const updatePastPregnancy = (i, data) => {
        setPastPregnancies(prev => { const n = [...prev]; n[i] = data; return n; });
    };
    const removePastPregnancy = (i) => {
        setPastPregnancies(prev => prev.filter((_, idx) => idx !== i));
        setGravida(g => String(Math.max(0, Number(g) - 1)));
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const handlePrint = () => window.print();

    return (
        <div className="pdi-page">
            {/* ── Page Header ── */}
            <div className="pdi-header">
                <div className="pdi-header-text">
                    <h1><Baby size={26} /> Pregnancy &amp; Delivery Info</h1>
                    <p>Your past pregnancy history and delivery preferences — all in one place.</p>
                </div>
                <div className="pdi-header-actions">
                    <button className="pdi-btn pdi-btn--outline" onClick={handlePrint}>
                        <Printer size={15} /> Print / Export
                    </button>
                    <button
                        className={`pdi-btn pdi-btn--save ${saved ? 'pdi-btn--saved' : ''}`}
                        onClick={handleSave}
                        disabled={!agreed}
                        title={!agreed ? 'Please agree to the terms before saving.' : ''}
                    >
                        {saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
                    </button>
                </div>
            </div>

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
                    <div className="pdi-field pdi-field--full">
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
                    <div className="pdi-field pdi-field--full">
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
                    <div className="pdi-toggle-group">
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
                        Barangay Health Office (BHO) / Community Health Office (CHO) staff for the purpose of
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
