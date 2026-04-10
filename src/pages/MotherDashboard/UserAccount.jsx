import React, { useState } from 'react';
import {
    User, Mail, Phone, MapPin, ShieldCheck,
    Lock, LogOut, Edit2, Trash2, Plus,
    X, Users, Baby, Heart, ChevronDown, ChevronUp,
    Calendar, UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/UserAccount.css';

// ─── Helpers ──────────────────────────────────────────────────────────
const getInitials = (name = '') =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const getAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};

const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ─── Blank templates ──────────────────────────────────────────────────
const BLANK_PARTNER = { name: '', age: '', phone: '', email: '', relationship: 'Partner' };
const BLANK_CHILD   = { name: '', gender: 'Female', dob: '', notes: '' };

// ─── Delete Confirmation Modal ────────────────────────────────────────
const DeleteConfirmModal = ({ target, onConfirm, onCancel }) => (
    <div className="ua-modal-overlay" onClick={onCancel}>
        <div className="ua-modal-card ua-modal-card--sm" onClick={e => e.stopPropagation()}>
            <div className="ua-modal-icon ua-modal-icon--danger">
                <Trash2 size={24} />
            </div>
            <h3>Remove {target}?</h3>
            <p>This action cannot be undone.</p>
            <div className="ua-modal-actions">
                <button className="ua-modal-btn ua-modal-btn--cancel" onClick={onCancel}>Cancel</button>
                <button className="ua-modal-btn ua-modal-btn--danger" onClick={onConfirm}>Yes, Remove</button>
            </div>
        </div>
    </div>
);

// ─── Partner Form Modal ────────────────────────────────────────────────
const PartnerModal = ({ initial, onSave, onClose }) => {
    const [form, setForm] = useState(initial || BLANK_PARTNER);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    return (
        <div className="ua-modal-overlay" onClick={onClose}>
            <div className="ua-modal-card" onClick={e => e.stopPropagation()}>
                <div className="ua-modal-header">
                    <h3>{initial ? 'Edit Partner' : 'Add Partner'}</h3>
                    <button className="ua-modal-close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="ua-modal-body">
                    <div className="ua-field">
                        <label>Full Name *</label>
                        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Juan Dela Cruz" />
                    </div>
                    <div className="ua-field-row">
                        <div className="ua-field">
                            <label>Age</label>
                            <input type="number" min="0" value={form.age} onChange={e => set('age', e.target.value)} placeholder="e.g. 32" />
                        </div>
                        <div className="ua-field">
                            <label>Relationship</label>
                            <select value={form.relationship} onChange={e => set('relationship', e.target.value)}>
                                <option>Partner</option>
                                <option>Spouse</option>
                                <option>Husband</option>
                            </select>
                        </div>
                    </div>
                    <div className="ua-field">
                        <label>Phone Number</label>
                        <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+63 9xx xxx xxxx" />
                    </div>
                    <div className="ua-field">
                        <label>Email (optional)</label>
                        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
                    </div>
                </div>
                <div className="ua-modal-footer">
                    <button className="ua-modal-btn ua-modal-btn--cancel" onClick={onClose}>Cancel</button>
                    <button
                        className="ua-modal-btn ua-modal-btn--save"
                        disabled={!form.name.trim()}
                        onClick={() => onSave(form)}
                    >
                        Save Partner
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Child Form Modal ──────────────────────────────────────────────────
const ChildModal = ({ initial, index, onSave, onClose }) => {
    const [form, setForm] = useState(initial || BLANK_CHILD);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    return (
        <div className="ua-modal-overlay" onClick={onClose}>
            <div className="ua-modal-card" onClick={e => e.stopPropagation()}>
                <div className="ua-modal-header">
                    <h3>{initial ? 'Edit Child' : 'Add Child'}</h3>
                    <button className="ua-modal-close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="ua-modal-body">
                    <div className="ua-field">
                        <label>Full Name *</label>
                        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Maria Dela Cruz" />
                    </div>
                    <div className="ua-field-row">
                        <div className="ua-field">
                            <label>Gender</label>
                            <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                                <option>Female</option>
                                <option>Male</option>
                            </select>
                        </div>
                        <div className="ua-field">
                            <label>Date of Birth</label>
                            <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
                        </div>
                    </div>
                    <div className="ua-field">
                        <label>Notes (optional)</label>
                        <textarea
                            value={form.notes}
                            rows={3}
                            onChange={e => set('notes', e.target.value)}
                            placeholder="e.g. nickname, medical conditions, allergies…"
                        />
                    </div>
                </div>
                <div className="ua-modal-footer">
                    <button className="ua-modal-btn ua-modal-btn--cancel" onClick={onClose}>Cancel</button>
                    <button
                        className="ua-modal-btn ua-modal-btn--save"
                        disabled={!form.name.trim()}
                        onClick={() => onSave(form, index)}
                    >
                        Save Child
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────
const UserAccount = () => {
    const navigate = useNavigate();

    // ── Personal / Contact State ──────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false);
    const [contactInfo, setContactInfo] = useState({
        email: 'user@gmail.com',
        phone: '+63 912 345 6789',
        emergencyContact: 'Hari (Partner) — +63 994 423 5141',
    });
    const userData = {
        name: 'Mish Diola',
        dob: 'June 12, 1997',
        station: 'Poblacion Uno',
        address: '123 Mabini St., Poblacion Uno, Dasmariñas City',
    };

    // ── Family State ──────────────────────────────────────────────────
    const [partner, setPartner] = useState({
        name: 'Hari Diola',
        age: '34',
        phone: '+63 994 423 5141',
        email: 'hari@gmail.com',
        relationship: 'Husband',
    });
    const [children, setChildren] = useState([
        { name: 'Maria Diola', gender: 'Female', dob: '2019-01-10', notes: '' },
        { name: 'Leo Diola',   gender: 'Male',   dob: '2021-05-23', notes: 'Allergic to peanuts' },
    ]);
    const [familyOpen, setFamilyOpen] = useState(true);

    // ── Modal State ───────────────────────────────────────────────────
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [showChildModal, setShowChildModal]     = useState(false);
    const [editChildIdx, setEditChildIdx]         = useState(null);
    const [deleteTarget, setDeleteTarget]         = useState(null); // { type: 'partner'|'child', idx? }

    // ── Handlers ──────────────────────────────────────────────────────
    const handleSavePartner = (data) => { setPartner(data); setShowPartnerModal(false); };
    const handleDeletePartner = () => { setPartner(null); setDeleteTarget(null); };

    const handleSaveChild = (data, idx) => {
        setChildren(prev => {
            const next = [...prev];
            if (idx !== null && idx !== undefined) next[idx] = data;
            else next.push(data);
            return next;
        });
        setShowChildModal(false);
        setEditChildIdx(null);
    };
    const handleDeleteChild = (idx) => {
        setChildren(prev => prev.filter((_, i) => i !== idx));
        setDeleteTarget(null);
    };

    const openEditChild = (idx) => { setEditChildIdx(idx); setShowChildModal(true); };

    return (
        <div className="user-account-container">
            {/* ── Profile Header ── */}
            <header className="account-header-card">
                <div className="account-avatar-section">
                    <div className="account-avatar-large">
                        <img
                            src="https://ui-avatars.com/api/?name=Mish+Diola&background=b9818a&color=fff&size=128"
                            alt="Mish Diola"
                        />
                    </div>
                    <div className="account-avatar-info">
                        <h1>{userData.name}</h1>
                        <p className="account-location">
                            <MapPin size={14} /> {userData.station}
                        </p>
                    </div>
                </div>
            </header>

            <div className="account-content-grid">
                {/* ── Basic Information ── */}
                <section className="account-section">
                    <h2 className="section-title"><User size={18} /> Basic Information</h2>
                    <div className="account-form">
                        <div className="form-field">
                            <label>Full Name</label>
                            <input type="text" value={userData.name} readOnly className="read-only-input" />
                        </div>
                        <div className="form-field">
                            <label>Date of Birth</label>
                            <input type="text" value={userData.dob} readOnly className="read-only-input" />
                        </div>
                        <div className="form-field">
                            <label>Station</label>
                            <input type="text" value={userData.station} readOnly className="read-only-input" />
                        </div>
                        <div className="form-field">
                            <label>Home Address</label>
                            <textarea value={userData.address} readOnly className="read-only-input" rows={2} />
                        </div>
                    </div>
                </section>

                {/* ── Contact Details ── */}
                <section className="account-section">
                    <div className="section-header">
                        <h2 className="section-title"><Phone size={18} /> Contact Information</h2>
                        {!isEditing ? (
                            <button className="btn-edit-action" onClick={() => setIsEditing(true)}>
                                <Edit2 size={14} /> Edit
                            </button>
                        ) : (
                            <button className="btn-save-action" onClick={() => setIsEditing(false)}>
                                <ShieldCheck size={14} /> Save Changes
                            </button>
                        )}
                    </div>
                    <div className="account-form">
                        <div className="form-field">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={contactInfo.email}
                                onChange={e => setContactInfo({ ...contactInfo, email: e.target.value })}
                                readOnly={!isEditing}
                                className={!isEditing ? 'read-only-input' : 'editable-input'}
                            />
                        </div>
                        <div className="form-field">
                            <label>Phone Number</label>
                            <input
                                type="text"
                                value={contactInfo.phone}
                                onChange={e => setContactInfo({ ...contactInfo, phone: e.target.value })}
                                readOnly={!isEditing}
                                className={!isEditing ? 'read-only-input' : 'editable-input'}
                            />
                        </div>
                        <div className="form-field">
                            <label>Emergency Contact</label>
                            <input
                                type="text"
                                value={contactInfo.emergencyContact}
                                onChange={e => setContactInfo({ ...contactInfo, emergencyContact: e.target.value })}
                                readOnly={!isEditing}
                                className={!isEditing ? 'read-only-input' : 'editable-input'}
                                placeholder="Name (Relation) — Number"
                            />
                        </div>
                    </div>
                </section>

                {/* ════════════════════════════════════════
                    MY FAMILY SECTION
                ════════════════════════════════════════ */}
                <section className="account-section ua-family-section">
                    {/* Section Header */}
                    <div className="section-header" style={{ marginBottom: familyOpen ? 20 : 0, borderBottom: familyOpen ? undefined : 'none' }}>
                        <h2 className="section-title">
                            <Users size={18} /> My Family
                        </h2>
                        <div className="ua-family-header-right">
                            {/* Quick stats */}
                            <span className="ua-family-stat">
                                <Heart size={13} />
                                {partner ? '1 Partner' : 'No Partner'}
                            </span>
                            <span className="ua-family-stat">
                                <Baby size={13} />
                                {children.length} {children.length === 1 ? 'Child' : 'Children'}
                            </span>
                            <button className="ua-collapse-btn" onClick={() => setFamilyOpen(v => !v)}>
                                {familyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                    </div>

                    {familyOpen && (
                        <>
                            {/* ── Partner Block ── */}
                            <div className="ua-family-block">
                                <div className="ua-family-block-title">
                                    <Heart size={14} className="ua-icon-partner" />
                                    Partner / Spouse
                                </div>

                                {partner ? (
                                    <div className="ua-member-card ua-member-card--partner">
                                        <div className="ua-member-avatar ua-member-avatar--partner">
                                            {getInitials(partner.name)}
                                        </div>
                                        <div className="ua-member-info">
                                            <strong>{partner.name}</strong>
                                            <span>{partner.relationship}{partner.age ? ` · ${partner.age} yrs` : ''}</span>
                                            {partner.phone && (
                                                <span className="ua-member-meta">
                                                    <Phone size={12} /> {partner.phone}
                                                </span>
                                            )}
                                            {partner.email && (
                                                <span className="ua-member-meta">
                                                    <Mail size={12} /> {partner.email}
                                                </span>
                                            )}
                                        </div>
                                        <div className="ua-member-actions">
                                            <button
                                                className="ua-mem-btn ua-mem-btn--edit"
                                                onClick={() => setShowPartnerModal(true)}
                                            >
                                                <Edit2 size={13} /> Edit
                                            </button>
                                            <button
                                                className="ua-mem-btn ua-mem-btn--delete"
                                                onClick={() => setDeleteTarget({ type: 'partner' })}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="ua-add-btn ua-add-btn--partner" onClick={() => setShowPartnerModal(true)}>
                                        <Plus size={16} /> Add Partner
                                    </button>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="ua-family-divider" />

                            {/* ── Children Block ── */}
                            <div className="ua-family-block">
                                <div className="ua-family-block-title">
                                    <Baby size={14} className="ua-icon-child" />
                                    Children
                                </div>

                                {children.length > 0 && (
                                    <div className="ua-children-grid">
                                        {children.map((child, i) => {
                                            const age = getAge(child.dob);
                                            return (
                                                <div key={i} className="ua-member-card ua-member-card--child">
                                                    <div className={`ua-member-avatar ${child.gender === 'Female' ? 'ua-member-avatar--girl' : 'ua-member-avatar--boy'}`}>
                                                        {getInitials(child.name)}
                                                    </div>
                                                    <div className="ua-member-info">
                                                        <strong>{child.name}</strong>
                                                        <span>
                                                            {child.gender}
                                                            {age !== null ? ` · ${age} yrs old` : ''}
                                                        </span>
                                                        {child.dob && (
                                                            <span className="ua-member-meta">
                                                                <Calendar size={12} /> {formatDate(child.dob)}
                                                            </span>
                                                        )}
                                                        {child.notes && (
                                                            <span className="ua-member-meta ua-member-notes">
                                                                {child.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="ua-member-actions">
                                                        <button
                                                            className="ua-mem-btn ua-mem-btn--edit"
                                                            onClick={() => openEditChild(i)}
                                                        >
                                                            <Edit2 size={13} /> Edit
                                                        </button>
                                                        <button
                                                            className="ua-mem-btn ua-mem-btn--delete"
                                                            onClick={() => setDeleteTarget({ type: 'child', idx: i })}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <button
                                    className="ua-add-btn ua-add-btn--child"
                                    onClick={() => { setEditChildIdx(null); setShowChildModal(true); }}
                                >
                                    <Plus size={16} />
                                    {children.length === 0 ? 'Add Child' : 'Add Another Child'}
                                </button>
                            </div>
                        </>
                    )}
                </section>

                {/* ── Account Actions ── */}
                <div className="account-actions-card">
                    <button className="action-btn action-btn--password">
                        <Lock size={16} /> Change Password
                    </button>
                    <button className="action-btn action-btn--logout" onClick={() => navigate('/')}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </div>

            <footer className="account-footer-notice">
                <ShieldCheck size={14} />
                <p>Medical data is read-only. Contact your health station for corrections.</p>
            </footer>

            {/* ── Modals ── */}
            {showPartnerModal && (
                <PartnerModal
                    initial={partner}
                    onSave={handleSavePartner}
                    onClose={() => setShowPartnerModal(false)}
                />
            )}
            {showChildModal && (
                <ChildModal
                    initial={editChildIdx !== null ? children[editChildIdx] : null}
                    index={editChildIdx}
                    onSave={handleSaveChild}
                    onClose={() => { setShowChildModal(false); setEditChildIdx(null); }}
                />
            )}
            {deleteTarget && (
                <DeleteConfirmModal
                    target={deleteTarget.type === 'partner' ? 'Partner' : children[deleteTarget.idx]?.name || 'Child'}
                    onConfirm={() =>
                        deleteTarget.type === 'partner'
                            ? handleDeletePartner()
                            : handleDeleteChild(deleteTarget.idx)
                    }
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
};

export default UserAccount;
