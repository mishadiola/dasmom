import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Users, Shield, Settings as SettingsIcon, FileText, User,
    Plus, Search, Filter, Edit2, Trash2, RotateCcw, X, Eye, EyeOff,
    CheckCircle2, XCircle, AlertCircle, Lock, Bell, Download,
    Monitor, LogOut, Clock, ChevronDown, ToggleLeft, ToggleRight,
    Key, Mail, MapPin, Activity, Save
} from 'lucide-react';
import '../../styles/pages/Settings.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const USERS = [
    { id: 1, name: 'Mish Diola',   role: 'Super Admin', email: 'mish@dasmom.ph',  status: 'Active',   lastLogin: '2026-03-01 09:14 AM', avatar: 'MD' },
    { id: 2, name: 'Midwife Elena Perez',role: 'Admin',       email: 'elena.perez@dasmom.ph',   status: 'Active',   lastLogin: '2026-03-01 08:30 AM', avatar: 'EP' },
    { id: 3, name: 'Nurse Ana Reyes',    role: 'Staff',       email: 'ana.reyes@dasmom.ph',     status: 'Active',   lastLogin: '2026-02-28 04:45 PM', avatar: 'AR' },
    { id: 4, name: 'Nurse Bea Gomez',    role: 'Staff',       email: 'bea.gomez@dasmom.ph',     status: 'Inactive', lastLogin: '2026-02-20 02:00 PM', avatar: 'BG' },
    { id: 5, name: 'Midwife Ana Magtibay',role:'Admin',       email: 'ana.magtibay@dasmom.ph',  status: 'Active',   lastLogin: '2026-02-27 10:00 AM', avatar: 'AM' },
    { id: 6, name: 'Intern Rosa Cruz',   role: 'Staff',       email: 'rosa.cruz@dasmom.ph',     status: 'Active',   lastLogin: '2026-03-01 07:55 AM', avatar: 'RC' },
];

const AUDIT_LOGS = [
    { id: 1, user: 'Mish Diola',    action: 'Generated Report',   details: 'Barangay 3 monthly report exported to PDF', time: '2026-03-01 09:14 AM', ip: '192.168.1.10' },
    { id: 2, user: 'Nurse Ana Reyes',     action: 'Added Patient',      details: 'New patient Maria Cruz (PT-2412) registered', time: '2026-03-01 08:50 AM', ip: '192.168.1.12' },
    { id: 3, user: 'Midwife Elena Perez', action: 'Record Vitals',      details: 'Vitals recorded for PT-2401 – Maria Reyes', time: '2026-03-01 08:30 AM', ip: '192.168.1.11' },
    { id: 4, user: 'Nurse Bea Gomez',     action: 'Login',              details: 'Successful login', time: '2026-02-28 04:45 PM', ip: '192.168.1.13' },
    { id: 5, user: 'Mish Diola',    action: 'Created Account',    details: 'New staff account created for Intern Rosa Cruz', time: '2026-02-27 11:00 AM', ip: '192.168.1.10' },
    { id: 6, user: 'Midwife Ana Magtibay','action': 'Record Delivery',   details: 'Delivery recorded for PT-2406 – Luz Ramos', time: '2026-02-27 10:00 AM', ip: '192.168.1.15' },
    { id: 7, user: 'Nurse Ana Reyes',     action: 'Record Vaccination', details: 'BCG recorded for NB-001 – Baby Reyes', time: '2026-02-27 09:30 AM', ip: '192.168.1.12' },
    { id: 8, user: 'Mish Diola',    action: 'Settings Changed',   details: 'Notification preferences updated', time: '2026-02-26 03:00 PM', ip: '192.168.1.10' },
];

const ROLES_DATA = [
    {
        role: 'Super Admin', color: 'rose', badge: 'badge-superadmin',
        perms: {
            patients: { view: true,  add: true,  edit: true,  delete: true  },
            prenatal: { view: true,  add: true,  edit: true,  delete: true  },
            highRisk: { view: true,  add: true,  edit: true,  delete: true  },
            postpartum:{ view: true, add: true,  edit: true,  delete: true  },
            deliveries:{ view: true, add: true,  edit: true,  delete: true  },
            newborns:  { view: true, add: true,  edit: true,  delete: true  },
            vaccinations:{view:true, add: true,  edit: true,  delete: true  },
            barangay:  { view: true, add: true,  edit: true,  delete: true  },
            analytics: { view: true, add: true,  edit: true,  delete: true  },
            settings:  { view: true, add: true,  edit: true,  delete: true  },
        }
    },
    {
        role: 'Admin', color: 'blue', badge: 'badge-admin',
        perms: {
            patients: { view: true,  add: true,  edit: true,  delete: false },
            prenatal: { view: true,  add: true,  edit: true,  delete: false },
            highRisk: { view: true,  add: true,  edit: true,  delete: false },
            postpartum:{ view: true, add: true,  edit: true,  delete: false },
            deliveries:{ view: true, add: true,  edit: true,  delete: false },
            newborns:  { view: true, add: true,  edit: true,  delete: false },
            vaccinations:{view:true, add: true,  edit: true,  delete: false },
            barangay:  { view: true, add: false, edit: false, delete: false },
            analytics: { view: true, add: false, edit: false, delete: false },
            settings:  { view: false,add: false, edit: false, delete: false },
        }
    },
    {
        role: 'Staff', color: 'green', badge: 'badge-staff',
        perms: {
            patients: { view: true,  add: true,  edit: true,  delete: false },
            prenatal: { view: true,  add: true,  edit: false, delete: false },
            highRisk: { view: true,  add: false, edit: false, delete: false },
            postpartum:{ view: true, add: true,  edit: false, delete: false },
            deliveries:{ view: true, add: true,  edit: false, delete: false },
            newborns:  { view: true, add: true,  edit: false, delete: false },
            vaccinations:{view:true, add: true,  edit: false, delete: false },
            barangay:  { view: false,add: false, edit: false, delete: false },
            analytics: { view: false,add: false, edit: false, delete: false },
            settings:  { view: false,add: false, edit: false, delete: false },
        }
    },
];

const MODULE_LABELS = {
    patients: 'Patient Profiles', prenatal: 'Prenatal Visits',
    highRisk: 'High-Risk Cases', postpartum: 'Postpartum Records',
    deliveries: 'Delivery Outcomes', newborns: 'Newborn Tracking',
    vaccinations: 'Vaccinations', barangay: 'Barangay Reports',
    analytics: 'Analytics', settings: 'Settings',
};

/* ════════════════════════════
   ADD USER MODAL
════════════════════════════ */
const AddUserModal = ({ onClose }) => {
    const [showPwd, setShowPwd] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Staff', barangay: '', status: 'Active' });
    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const genPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
        const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        update('password', pwd);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="set-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div><h2><Plus size={20} /> Add New Staff Account</h2><p>Create a login for a new staff member.</p></div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-grid-2">
                        <div className="form-group form-group--full">
                            <label>Full Name <span className="req">*</span></label>
                            <input type="text" placeholder="e.g. Nurse Ana Reyes" value={form.name} onChange={e => update('name', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Email / Username <span className="req">*</span></label>
                            <input type="email" placeholder="user@dasmom.ph" value={form.email} onChange={e => update('email', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Role <span className="req">*</span></label>
                            <select value={form.role} onChange={e => update('role', e.target.value)}>
                                <option value="Staff">Staff</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Assign Barangay</label>
                            <select value={form.barangay} onChange={e => update('barangay', e.target.value)}>
                                <option value="">All Barangays</option>
                                {[1,2,3,4,5,6,7].map(n => <option key={n} value={`Brgy. ${n}`}>Brgy. {n}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Initial Status</label>
                            <select value={form.status} onChange={e => update('status', e.target.value)}>
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                        <div className="form-group form-group--full">
                            <label>Password <span className="req">*</span></label>
                            <div className="pwd-wrap">
                                <input type={showPwd ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password} onChange={e => update('password', e.target.value)} />
                                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button type="button" className="btn btn-outline pwd-gen-btn" onClick={genPassword}><Key size={13} /> Auto-generate</button>
                            </div>
                            <span className="form-hint">Use 8+ characters with mixed case, numbers, and symbols.</span>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={onClose}><CheckCircle2 size={15} /> Create Account</button>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   TAB 1: USER ACCOUNTS
════════════════════════════ */
const UserAccountsTab = () => {
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showModal, setShowModal] = useState(false);

    const filtered = USERS.filter(u => {
        const s = search.toLowerCase();
        const matchS = u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
        const matchR = roleFilter === 'All' || u.role === roleFilter;
        const matchSt = statusFilter === 'All' || u.status === statusFilter;
        return matchS && matchR && matchSt;
    });

    return (
        <div className="tab-content">
            <div className="tab-toolbar">
                <div className="set-search-wrap">
                    <Search size={15} className="set-search-icon" />
                    <input className="set-search-input" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="set-select">
                    <option value="All">All Roles</option>
                    <option>Super Admin</option>
                    <option>Admin</option>
                    <option>Staff</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="set-select">
                    <option value="All">All Statuses</option>
                    <option>Active</option>
                    <option>Inactive</option>
                </select>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> Add Staff</button>
            </div>

            <div className="set-table-wrap">
                <table className="set-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(u => (
                            <tr key={u.id} className={u.status === 'Inactive' ? 'row-inactive' : ''}>
                                <td>
                                    <div className="user-cell">
                                        <div className={`user-avatar uav-${u.role.toLowerCase().replace(' ', '')}`}>{u.avatar}</div>
                                        <span>{u.name}</span>
                                    </div>
                                </td>
                                <td><span className={`role-badge ${u.role === 'Super Admin' ? 'badge-superadmin' : u.role === 'Admin' ? 'badge-admin' : 'badge-staff'}`}>{u.role}</span></td>
                                <td className="email-cell">{u.email}</td>
                                <td>
                                    <span className={`status-dot ${u.status === 'Active' ? 'dot-active' : 'dot-inactive'}`}>
                                        {u.status === 'Active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {u.status}
                                    </span>
                                </td>
                                <td className="last-login">{u.lastLogin}</td>
                                <td>
                                    <div className="row-actions">
                                        <button className="action-btn edit-btn" title="Edit"><Edit2 size={13} /></button>
                                        <button className="action-btn key-btn" title="Reset Password"><Key size={13} /></button>
                                        <button className={`action-btn ${u.status === 'Active' ? 'deact-btn' : 'act-btn'}`} title={u.status === 'Active' ? 'Deactivate' : 'Activate'}>
                                            {u.status === 'Active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                                        </button>
                                        {u.role !== 'Super Admin' && (
                                            <button className="action-btn del-btn" title="Delete"><Trash2 size={13} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showModal && <AddUserModal onClose={() => setShowModal(false)} />}
        </div>
    );
};

/* ════════════════════════════
   TAB 2: ROLES & PERMISSIONS
════════════════════════════ */
const RolesTab = () => {
    const modules = Object.keys(MODULE_LABELS);
    const actions = ['view', 'add', 'edit', 'delete'];

    return (
        <div className="tab-content">
            <p className="tab-desc">Review access levels for each system role. Only Super Admins can modify permissions.</p>
            <div className="roles-grid">
                {ROLES_DATA.map(rd => (
                    <div key={rd.role} className={`role-card role-card--${rd.color}`}>
                        <div className="role-card-head">
                            <Shield size={16} />
                            <span className={`role-badge ${rd.badge}`}>{rd.role}</span>
                        </div>
                        <div className="perm-table">
                            <div className="perm-header">
                                <span className="perm-module-col">Module</span>
                                {actions.map(a => <span key={a} className="perm-action-col">{a}</span>)}
                            </div>
                            {modules.map(mod => (
                                <div key={mod} className="perm-row">
                                    <span className="perm-module">{MODULE_LABELS[mod]}</span>
                                    {actions.map(a => (
                                        <span key={a} className="perm-cell">
                                            {rd.perms[mod]?.[a]
                                                ? <CheckCircle2 size={13} className="perm-yes" />
                                                : <XCircle size={13} className="perm-no" />
                                            }
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ════════════════════════════
   TAB 3: SYSTEM SETTINGS
════════════════════════════ */
const SystemSettingsTab = () => {
    const [notifs, setNotifs] = useState({ highRiskEmail: true, appointmentReminder: true, lowStock: true, missedFollowUp: false });
    const [reports, setReports] = useState({ format: 'PDF', includeBarangay: true, includePatientSummary: true });
    const [dash, setDash] = useState({ landingPage: 'Dashboard', showHighRisk: true, showAlerts: true, showStats: true });

    const toggle = (group, setter, key) => setter(prev => ({ ...prev, [key]: !prev[key] }));

    const ToggleSwitch = ({ value, onChange, label, desc }) => (
        <div className="setting-row">
            <div className="setting-info">
                <span className="setting-label">{label}</span>
                {desc && <span className="setting-desc">{desc}</span>}
            </div>
            <button
                className={`toggle-switch ${value ? 'toggle-on' : ''}`}
                onClick={onChange}
                aria-label={label}
            >
                <span className="toggle-thumb" />
            </button>
        </div>
    );

    return (
        <div className="tab-content">
            <div className="settings-sections">
                {/* Notifications */}
                <div className="settings-section">
                    <div className="section-header"><Bell size={16} /><h3>Notification Settings</h3></div>
                    <ToggleSwitch
                        value={notifs.highRiskEmail} label="High-Risk Case Alerts"
                        desc="Send email when a new high-risk patient is flagged"
                        onChange={() => toggle(notifs, setNotifs, 'highRiskEmail')}
                    />
                    <ToggleSwitch
                        value={notifs.appointmentReminder} label="Appointment Reminders"
                        desc="Notify staff of upcoming prenatal and postpartum visits"
                        onChange={() => toggle(notifs, setNotifs, 'appointmentReminder')}
                    />
                    <ToggleSwitch
                        value={notifs.lowStock} label="Low Stock Alerts"
                        desc="Alert when vaccine or supplement stock falls below threshold"
                        onChange={() => toggle(notifs, setNotifs, 'lowStock')}
                    />
                    <ToggleSwitch
                        value={notifs.missedFollowUp} label="Missed Follow-up Alerts"
                        desc="Notify staff when patients miss a scheduled visit"
                        onChange={() => toggle(notifs, setNotifs, 'missedFollowUp')}
                    />
                </div>

                {/* Reports */}
                <div className="settings-section">
                    <div className="section-header"><FileText size={16} /><h3>Report Settings</h3></div>
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-label">Default Export Format</span>
                            <span className="setting-desc">Choose format for all generated reports</span>
                        </div>
                        <div className="format-pills">
                            {['PDF', 'Excel'].map(f => (
                                <button key={f} className={`format-pill ${reports.format === f ? 'active' : ''}`} onClick={() => setReports(p => ({ ...p, format: f }))}>{f}</button>
                            ))}
                        </div>
                    </div>
                    <ToggleSwitch
                        value={reports.includeBarangay} label="Include Barangay Summary"
                        desc="Add barangay-level breakdown in reports"
                        onChange={() => toggle(reports, setReports, 'includeBarangay')}
                    />
                    <ToggleSwitch
                        value={reports.includePatientSummary} label="Include Patient Summary"
                        desc="Add individual patient summaries in reports"
                        onChange={() => toggle(reports, setReports, 'includePatientSummary')}
                    />
                </div>

                {/* Dashboard */}
                <div className="settings-section">
                    <div className="section-header"><Monitor size={16} /><h3>Dashboard Settings</h3></div>
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-label">Default Landing Page</span>
                            <span className="setting-desc">Page shown after login</span>
                        </div>
                        <select className="set-select" value={dash.landingPage} onChange={e => setDash(p => ({ ...p, landingPage: e.target.value }))}>
                            <option>Dashboard</option>
                            <option>Patient Profiles</option>
                            <option>High-Risk Cases</option>
                        </select>
                    </div>
                    <ToggleSwitch
                        value={dash.showHighRisk} label="Show High-Risk Widget"
                        desc="Display high-risk patient count on dashboard"
                        onChange={() => toggle(dash, setDash, 'showHighRisk')}
                    />
                    <ToggleSwitch
                        value={dash.showAlerts} label="Show Alerts Panel"
                        desc="Display system alerts on dashboard"
                        onChange={() => toggle(dash, setDash, 'showAlerts')}
                    />
                    <ToggleSwitch
                        value={dash.showStats} label="Show Summary Stats"
                        desc="Display stat cards at top of dashboard"
                        onChange={() => toggle(dash, setDash, 'showStats')}
                    />
                </div>
            </div>

            <div className="settings-save-bar">
                <button className="btn btn-outline"><RotateCcw size={14} /> Reset to Defaults</button>
                <button className="btn btn-primary"><Save size={14} /> Save Settings</button>
            </div>
        </div>
    );
};

/* ════════════════════════════
   TAB 4: AUDIT LOGS
════════════════════════════ */
const AuditLogsTab = () => {
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('All');

    const actionTypes = [...new Set(AUDIT_LOGS.map(l => l.action))];

    const filtered = AUDIT_LOGS.filter(l => {
        const s = search.toLowerCase();
        const matchS = l.user.toLowerCase().includes(s) || l.details.toLowerCase().includes(s);
        const matchA = actionFilter === 'All' || l.action === actionFilter;
        return matchS && matchA;
    });

    const actionColor = (a) => {
        if (a.includes('Delete') || a.includes('Deact')) return 'audit-rose';
        if (a.includes('Created') || a.includes('Add')) return 'audit-green';
        if (a.includes('Login')) return 'audit-blue';
        if (a.includes('Settings')) return 'audit-yellow';
        return 'audit-gray';
    };

    return (
        <div className="tab-content">
            <div className="tab-toolbar">
                <div className="set-search-wrap">
                    <Search size={15} className="set-search-icon" />
                    <input className="set-search-input" placeholder="Search by user or action..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="set-select">
                    <option value="All">All Actions</option>
                    {actionTypes.map(a => <option key={a}>{a}</option>)}
                </select>
                <button className="btn btn-outline"><Download size={14} /> Export Logs</button>
            </div>

            <div className="set-table-wrap">
                <table className="set-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Action</th>
                            <th>Details</th>
                            <th>Date / Time</th>
                            <th>IP Address</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(l => (
                            <tr key={l.id}>
                                <td>
                                    <div className="user-cell">
                                        <div className="user-avatar uav-staff">{l.user.split(' ').slice(-2).map(n=>n[0]).join('')}</div>
                                        <span>{l.user}</span>
                                    </div>
                                </td>
                                <td><span className={`audit-tag ${actionColor(l.action)}`}>{l.action}</span></td>
                                <td className="audit-details">{l.details}</td>
                                <td className="audit-time">{l.time}</td>
                                <td className="audit-ip">{l.ip}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/* ════════════════════════════
   TAB 5: PROFILE & SECURITY
════════════════════════════ */
const ProfileTab = () => {
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [twoFA, setTwoFA] = useState(false);

    return (
        <div className="tab-content">
            <div className="profile-layout">
                {/* Profile Card */}
                <div className="profile-card">
                    <div className="profile-avatar-lg">MD</div>
                    <h3>Mish Diola</h3>
                    <p className="profile-role">Super Admin</p>
                    <p className="profile-email"><Mail size={13} /> mish@dasmom.ph</p>
                    <p className="profile-barangay"><MapPin size={13} /> All Barangays</p>
                    <p className="profile-login"><Clock size={13} /> Last login: 2026-03-01 09:14 AM</p>
                    <button className="btn btn-outline logout-btn"><LogOut size={14} /> Sign Out</button>
                </div>

                {/* Right side forms */}
                <div className="profile-forms">
                    {/* Update Info */}
                    <div className="settings-section">
                        <div className="section-header"><User size={16} /><h3>Update Profile</h3></div>
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input type="text" defaultValue="Mish Diola" />
                            </div>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input type="email" defaultValue="mish@dasmom.ph" />
                            </div>
                            <div className="form-group">
                                <label>Contact Number</label>
                                <input type="tel" defaultValue="+63 912 345 6789" />
                            </div>
                            <div className="form-group">
                                <label>Position / Title</label>
                                <input type="text" defaultValue="Medical Officer" />
                            </div>
                        </div>
                        <button className="btn btn-primary mt-action"><Save size={14} /> Save Changes</button>
                    </div>

                    {/* Change Password */}
                    <div className="settings-section">
                        <div className="section-header"><Lock size={16} /><h3>Change Password</h3></div>
                        <div className="form-grid-2">
                            <div className="form-group form-group--full">
                                <label>Current Password</label>
                                <div className="pwd-wrap">
                                    <input type={showOld ? 'text' : 'password'} placeholder="Enter current password" />
                                    <button type="button" className="pwd-toggle" onClick={() => setShowOld(v => !v)}>
                                        {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <div className="pwd-wrap">
                                    <input type={showNew ? 'text' : 'password'} placeholder="Min. 8 characters" />
                                    <button type="button" className="pwd-toggle" onClick={() => setShowNew(v => !v)}>
                                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <input type="password" placeholder="Re-enter new password" />
                            </div>
                        </div>
                        <button className="btn btn-primary mt-action"><Key size={14} /> Update Password</button>
                    </div>

                    {/* 2FA */}
                    <div className="settings-section">
                        <div className="section-header"><Shield size={16} /><h3>Security</h3></div>
                        <div className="setting-row">
                            <div className="setting-info">
                                <span className="setting-label">Two-Factor Authentication (2FA)</span>
                                <span className="setting-desc">Add an extra layer of security to your account</span>
                            </div>
                            <button className={`toggle-switch ${twoFA ? 'toggle-on' : ''}`} onClick={() => setTwoFA(v => !v)}>
                                <span className="toggle-thumb" />
                            </button>
                        </div>
                        <div className="setting-row">
                            <div className="setting-info">
                                <span className="setting-label">Login History</span>
                                <span className="setting-desc">View all recent sessions</span>
                            </div>
                            <button className="btn btn-outline btn-sm"><Activity size={13} /> View History</button>
                        </div>
                        <div className="setting-row">
                            <div className="setting-info">
                                <span className="setting-label">Sign Out All Devices</span>
                                <span className="setting-desc">Terminate all active sessions for your account</span>
                            </div>
                            <button className="btn btn-outline btn-sm btn-danger"><LogOut size={13} /> Sign Out All</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ════════════════════════════
   MAIN COMPONENT
════════════════════════════ */
const Settings = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'accounts');

    // Sync state with URL search params
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && TABS.some(t => t.id === tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId });
    };

    const TABS = [
        { id: 'accounts',  label: 'User Accounts',      icon: Users },
        { id: 'roles',     label: 'Roles & Permissions', icon: Shield },
        { id: 'system',    label: 'System Settings',    icon: SettingsIcon },
        { id: 'audit',     label: 'Audit Logs',         icon: FileText },
        { id: 'profile',   label: 'Profile & Security', icon: User },
    ];

    return (
        <div className="set-page">
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><SettingsIcon size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Settings &amp; Account Management</h1>
                    <p className="page-subtitle">Manage users, roles, system preferences, and audit logs</p>
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="set-tab-bar">
                {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            className={`set-tab-btn ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => handleTabChange(t.id)}
                        >
                            <Icon size={15} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Tab Content ── */}
            <div className="set-tab-content-wrap">
                {activeTab === 'accounts' && <UserAccountsTab />}
                {activeTab === 'roles'    && <RolesTab />}
                {activeTab === 'system'   && <SystemSettingsTab />}
                {activeTab === 'audit'    && <AuditLogsTab />}
                {activeTab === 'profile'  && <ProfileTab />}
            </div>
        </div>
    );
};

export default Settings;
