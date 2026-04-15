import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import AuthService from '../../services/authservice';
import StaffService from '../../services/staffservice';
import {
    Users, Settings as SettingsIcon, User,
    Plus, Search, Edit2, Trash2, RotateCcw, X, Eye, EyeOff,
    CheckCircle2, XCircle, AlertCircle, Bell,
    Monitor, ChevronDown, ToggleLeft, ToggleRight,
    Key, Save, Mail, MapPin, Clock, LogOut, Lock, FileText
} from 'lucide-react';
import '../../styles/pages/Settings.css';

/* ════════════════════════════
   MOCK DATA
════════════════════════════ */
const USERS = [
    { id: 1, name: 'Mish Diola',   role: 'Super Admin', email: 'mish@gmail.com',  status: 'Active',   lastLogin: '2026-03-01 09:14 AM', avatar: 'MD' },
    { id: 2, name: 'Midwife Elena Perez',role: 'Admin',       email: 'elena.perez@gmail.com',   status: 'Active',   lastLogin: '2026-03-01 08:30 AM', avatar: 'EP' },
    { id: 3, name: 'Nurse Ana Reyes',    role: 'Staff',       email: 'ana.reyes@gmail.com',     status: 'Active',   lastLogin: '2026-02-28 04:45 PM', avatar: 'AR' },
    { id: 4, name: 'Nurse Bea Gomez',    role: 'Staff',       email: 'bea.gomez@gmail.com',     status: 'Inactive', lastLogin: '2026-02-20 02:00 PM', avatar: 'BG' },
    { id: 5, name: 'Midwife Ana Magtibay',role:'Admin',       email: 'ana.magtibay@gmail.com',  status: 'Active',   lastLogin: '2026-02-27 10:00 AM', avatar: 'AM' },
    { id: 6, name: 'Intern Rosa Cruz',   role: 'Staff',       email: 'rosa.cruz@gmail.com',     status: 'Active',   lastLogin: '2026-03-01 07:55 AM', avatar: 'RC' },
];


/* ════════════════════════════
   STATION NAME FORMATTER
════════════════════════════ */
const formatStationName = (station) => {
    if (!station) return '';
    
    const stationMap = {
        'cho iii': 'City Health Office 3',
        'cho 3': 'City Health Office 3',
        'cho3': 'City Health Office 3',
        'salawag': 'Salawag',
    };
    
    const lowerStation = station.toLowerCase().trim();
    
    // Check for exact match in map
    if (stationMap[lowerStation]) {
        return stationMap[lowerStation];
    }
    
    // For stations not in the map, apply general formatting
    // Capitalize first letter of each word
    return station
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

/* ════════════════════════════
   ADD USER MODAL
════════════════════════════ */
const AddUserModal = ({ onClose, onSuccess }) => {
    const staffService = new StaffService();
    const [showPwd, setShowPwd] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Staff', station: '' });
    const [stations, setStations] = useState([]);
    const [showStationDropdown, setShowStationDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    useEffect(() => {
        const fetchStations = async () => {
            setLoading(true);
            try {
                const stationList = await staffService.getAllStations();
                setStations(stationList);
            } catch (err) {
                console.error('Failed to fetch stations:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStations();
    }, []);

    const genPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
        const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        update('password', pwd);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.role.trim()) {
            setError('Please fill in all required fields');
            return;
        }

        if (form.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setSubmitting(true);
        try {
            await staffService.addStaff({
                fullName: form.name,
                email: form.email,
                password: form.password,
                role: form.role,
                station: form.station || null,
            });
            setError('');
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Failed to create staff account:', err);
            setError(err.message || 'Failed to create account. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="set-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div><h2><Plus size={20} /> Add New Staff Account</h2><p>Create a login for a new staff member.</p></div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    {error && (
                        <div className="form-error" style={{ padding: '12px', backgroundColor: '#fee', borderLeft: '4px solid #f66', marginBottom: '16px', borderRadius: '4px', color: '#c33' }}>
                            <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                            {error}
                        </div>
                    )}
                    <div className="form-grid-2">
                        <div className="form-group form-group--full">
                            <label>Full Name <span className="req">*</span></label>
                            <input type="text" placeholder="e.g. Nurse Ana Reyes" value={form.name} onChange={e => update('name', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Email / Username <span className="req">*</span></label>
                            <input type="email" placeholder="user@gmail.com" value={form.email} onChange={e => update('email', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Role <span className="req">*</span></label>
                            <select value={form.role} onChange={e => update('role', e.target.value)}>
                                <option value="Staff">Staff</option>
                                <option value="Admin">Admin</option>
                                <option value="Midwife">Midwife</option>
                                <option value="Doctor">Doctor</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Assign Station / Barangay</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Select or type barangay..."
                                    value={form.station}
                                    onChange={e => {
                                        update('station', e.target.value);
                                        setShowStationDropdown(true);
                                    }}
                                    onFocus={() => setShowStationDropdown(true)}
                                    style={{ paddingRight: '32px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowStationDropdown(!showStationDropdown)}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px',
                                    }}
                                >
                                    <ChevronDown size={16} />
                                </button>
                                {showStationDropdown && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            backgroundColor: 'white',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px',
                                            marginTop: '4px',
                                            zIndex: 100,
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                        }}
                                    >
                                        {stations.length > 0 ? (
                                            stations.map(s => (
                                                <div
                                                    key={s}
                                                    onClick={() => {
                                                        update('station', s);
                                                        setShowStationDropdown(false);
                                                    }}
                                                    style={{
                                                        padding: '10px 12px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f0f0f0',
                                                        backgroundColor: form.station === s ? '#f0f0f0' : 'white',
                                                        ':hover': { backgroundColor: '#f5f5f5' },
                                                    }}
                                                >
                                                    {formatStationName(s)}
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ padding: '10px 12px', color: '#999' }}>
                                                No stations available. Type to create new.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <span className="form-hint">Select existing station or type to create a new one</span>
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
                    <button className="btn btn-outline" onClick={onClose} disabled={submitting}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                        <CheckCircle2 size={15} /> {submitting ? 'Creating...' : 'Create Account'}
                    </button>
                </div>
            </div>
        </div>
    );
};
/* ════════════════════════════
   EDIT USER MODAL
════════════════════════════ */
const EditUserModal = ({ staff, onClose, onSuccess }) => {
    const staffService = new StaffService();
    const [form, setForm] = useState({ name: staff.name, email: staff.email, role: staff.role, station: staff.station });
    const [stations, setStations] = useState([]);
    const [showStationDropdown, setShowStationDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

    useEffect(() => {
        const fetchStations = async () => {
            setLoading(true);
            try {
                const stationList = await staffService.getAllStations();
                setStations(stationList);
            } catch (err) {
                console.error('Failed to fetch stations:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStations();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            await staffService.updateStaff(staff.id, {
                fullName: form.name,
                role: form.role,
                station: form.station,
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to update staff');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="set-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div><h2><Edit2 size={20} /> Edit Staff Account</h2><p>Update staff member details.</p></div>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    {error && (
                        <div className="form-error" style={{ padding: '12px', backgroundColor: '#fee', borderLeft: '4px solid #f66', marginBottom: '16px', borderRadius: '4px', color: '#c33' }}>
                            <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                            {error}
                        </div>
                    )}
                    <div className="form-grid-2">
                        <div className="form-group form-group--full">
                            <label>Full Name <span className="req">*</span></label>
                            <input type="text" placeholder="e.g. Nurse Ana Reyes" value={form.name} onChange={e => update('name', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Email / Username</label>
                            <input type="email" placeholder="user@gmail.com" value={form.email} disabled style={{ backgroundColor: '#f5f5f5' }} />
                        </div>
                        <div className="form-group">
                            <label>Role <span className="req">*</span></label>
                            <select value={form.role} onChange={e => update('role', e.target.value)}>
                                <option value="Staff">Staff</option>
                                <option value="Admin">Admin</option>
                                <option value="Midwife">Midwife</option>
                                <option value="Doctor">Doctor</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Assign Station / Barangay</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Select or type barangay..."
                                    value={form.station}
                                    onChange={e => update('station', e.target.value)}
                                    onFocus={() => setShowStationDropdown(true)}
                                    style={{ paddingRight: '32px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowStationDropdown(!showStationDropdown)}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px',
                                    }}
                                >
                                    <ChevronDown size={16} />
                                </button>
                                {showStationDropdown && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            backgroundColor: 'white',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px',
                                            marginTop: '4px',
                                            zIndex: 100,
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                        }}
                                    >
                                        {stations.length > 0 ? (
                                            stations.map(s => (
                                                <div
                                                    key={s}
                                                    onClick={() => { update('station', s); setShowStationDropdown(false); }}
                                                    style={{
                                                        padding: '10px 12px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f0f0f0',
                                                        backgroundColor: form.station === s ? '#f0f0f0' : 'white',
                                                        ':hover': { backgroundColor: '#f5f5f5' },
                                                    }}
                                                >
                                                    {formatStationName(s)}
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ padding: '10px 12px', color: '#999' }}>
                                                No stations available. Type to create new.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <span className="form-hint">Select existing station or type to create a new one</span>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose} disabled={submitting}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                        <CheckCircle2 size={15} /> {submitting ? 'Updating...' : 'Update Account'}
                    </button>
                </div>
            </div>
        </div>
    );
};
const UserAccountsTab = () => {
    const staffService = new StaffService();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const staffList = await staffService.getAllStaff();
            setStaff(staffList);
        } catch (err) {
            console.error('Failed to fetch staff:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const filtered = staff.filter(u => {
        const s = search.toLowerCase();
        const matchS = u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
        const matchR = roleFilter === 'All' || u.role === roleFilter;
        const matchSt = statusFilter === 'All' || u.status === statusFilter;
        return matchS && matchR && matchSt;
    });

    const handleModalSuccess = () => {
        fetchStaff();
    };

    if (loading) {
        return (
            <div className="tab-content">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <div className="set-spinner"></div>
                    <p style={{ marginLeft: '16px' }}>Loading staff...</p>
                </div>
            </div>
        );
    }

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
                    <option>Midwife</option>
                    <option>Doctor</option>
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
                            <th>Station</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length > 0 ? (
                            filtered.map(u => (
                                <tr key={u.id} className={u.status === 'Inactive' ? 'row-inactive' : ''}>
                                    <td>
                                        <div className="user-cell">
                                            <div className={`user-avatar uav-${u.role.toLowerCase().replace(' ', '')}`}>{u.avatar}</div>
                                            <span>{u.name}</span>
                                        </div>
                                    </td>
                                    <td><span className={`role-badge ${u.role === 'Super Admin' ? 'badge-superadmin' : u.role === 'Admin' ? 'badge-admin' : 'badge-staff'}`}>{u.role}</span></td>
                                    <td className="email-cell">{u.email}</td>
                                    <td>{u.station}</td>
                                    <td>
                                        <span className={`status-dot ${u.status === 'Active' ? 'dot-active' : 'dot-inactive'}`}>
                                            {u.status === 'Active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {u.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            <button className="action-btn edit-btn" title="Edit" onClick={() => { setSelectedStaff(u); setShowEditModal(true); }}><Edit2 size={13} /></button>
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
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
                                    No staff members found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {showModal && <AddUserModal onClose={() => setShowModal(false)} onSuccess={handleModalSuccess} />}
            {showEditModal && <EditUserModal staff={selectedStaff} onClose={() => setShowEditModal(false)} onSuccess={handleModalSuccess} />}
        </div>
    );
};

/* ════════════════════════════
   TAB 3: SYSTEM SETTINGS
════════════════════════════ */
const SystemSettingsTab = () => {
    const [notifs, setNotifs] = useState({ highRiskEmail: true, appointmentReminder: true, lowStock: true, missedFollowUp: false });
    const [reports, setReports] = useState({ format: 'PDF', includeStation: true, includePatientSummary: true });
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
                        value={reports.includeStation} label="Include Station Summary"
                        desc="Add station-level breakdown in reports"
                        onChange={() => toggle(reports, setReports, 'includeStation')}
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
   TAB 5: PROFILE & SECURITY
════════════════════════════ */
const ProfileTab = () => {
    const { user, logout: handleLogout } = useContext(AuthContext);
    const authService = new AuthService();

    const [fullProfile, setFullProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Profile Form
    const [profileForm, setProfileForm] = useState({ fullName: '', contactNo: '', station: '' });
    
    // Password Form
    const [pwdForm, setPwdForm] = useState({ new: '', confirm: '' });
    const [showNew, setShowNew] = useState(false);
    

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const data = await authService.getFullStaffProfile(user.id);
                if (data) {
                    setFullProfile(data);
                    setProfileForm({
                        fullName: data.full_name || '',
                        contactNo: data.contact_no || '',
                        station: data.barangay_assignment || ''
                    });
                }
            } catch (err) {
                console.error('Failed to fetch profile:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [user]);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setUpdating(true);
        try {
            await authService.updateStaffProfile(user.id, {
                fullName: profileForm.fullName,
                contactNo: profileForm.contactNo,
                barangayAssignment: profileForm.station
            });
            showToast('Profile updated successfully!');
        } catch (err) {
            console.error(err);
            showToast('Failed to update profile.', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (pwdForm.new !== pwdForm.confirm) {
            return showToast('Passwords do not match.', 'error');
        }
        if (pwdForm.new.length < 8) {
            return showToast('Password must be at least 8 characters.', 'error');
        }

        setUpdating(true);
        try {
            await authService.updatePassword(pwdForm.new);
            showToast('Password updated successfully!');
            setPwdForm({ new: '', confirm: '' });
        } catch (err) {
            console.error(err);
            showToast('Failed to update password.', 'error');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="tab-loading">
                <div className="set-spinner"></div>
                <p>Loading your profile...</p>
            </div>
        );
    }

    return (
        <div className="tab-content">
            <div className="profile-layout">
                {/* Profile Summary Card */}
                <div className="profile-card">
                    <div className="profile-avatar-lg">
                        {user?.fullName?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
                    </div>
                    <h3>{user?.fullName || 'User Account'}</h3>
                    <p className="profile-role">{user?.role?.toUpperCase() || 'Staff'}</p>
                    <div className="profile-info-item">
                        <Mail size={13} /> {user?.email}
                    </div>
                    <div className="profile-info-item">
                        <MapPin size={13} /> {fullProfile?.barangay_assignment || 'No Assignment'}
                    </div>
                    <div className="profile-info-item">
                        <Clock size={13} /> Active Session
                    </div>
                    <button className="btn btn-outline logout-btn" onClick={handleLogout}>
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>

                {/* Right side forms */}
                <div className="profile-forms">
                    {/* Update Info */}
                    <form className="settings-section" onSubmit={handleUpdateProfile}>
                        <div className="section-header"><User size={16} /><h3>Update Profile</h3></div>
                        <div className="form-grid-2">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input 
                                    type="text" 
                                    value={profileForm.fullName} 
                                    onChange={e => setProfileForm(p => ({ ...p, fullName: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Email Address (View-only)</label>
                                <input type="email" value={user?.email || ''} disabled readOnly style={{ background: '#f8f9fb', cursor: 'not-allowed' }} />
                            </div>
                            <div className="form-group">
                                <label>Contact Number</label>
                                <input 
                                    type="tel" 
                                    value={profileForm.contactNo} 
                                    onChange={e => setProfileForm(p => ({ ...p, contactNo: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Station / Barangay</label>
                                <input 
                                    type="text" 
                                    value={profileForm.station} 
                                    onChange={e => setProfileForm(p => ({ ...p, station: e.target.value }))}
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary mt-action" disabled={updating}>
                            <Save size={14} /> {updating ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>

                    {/* Change Password */}
                    <form className="settings-section" onSubmit={handleUpdatePassword}>
                        <div className="section-header"><Lock size={16} /><h3>Change Password</h3></div>
                        <div className="form-grid-2">
                            <div className="form-group form-group--full">
                                <label>New Password</label>
                                <div className="pwd-wrap">
                                    <input 
                                        type={showNew ? 'text' : 'password'} 
                                        placeholder="Min. 8 characters" 
                                        value={pwdForm.new}
                                        onChange={e => setPwdForm(p => ({ ...p, new: e.target.value }))}
                                        required
                                    />
                                    <button type="button" className="pwd-toggle" onClick={() => setShowNew(v => !v)}>
                                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group form-group--full">
                                <label>Confirm New Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Re-enter new password" 
                                    value={pwdForm.confirm}
                                    onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary mt-action" disabled={updating}>
                            <Key size={14} /> {updating ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>

                </div>
            </div>

            {toast.show && (
                <div className={`set-toast toast-${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{toast.message}</span>
                </div>
            )}
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
        { id: 'system',    label: 'System Settings',    icon: SettingsIcon },
        { id: 'profile',   label: 'Profile', icon: User },
    ];

    return (
        <div className="set-page">
            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title"><SettingsIcon size={22} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--color-rose)' }} /> Settings</h1>
                    <p className="page-subtitle">Manage users, system preferences, and security settings</p>
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
                {activeTab === 'system'   && <SystemSettingsTab />}
                {activeTab === 'profile'  && <ProfileTab />}
            </div>
        </div>
    );
};

export default Settings;
