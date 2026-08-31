import React, { useState, useEffect } from 'react';
import { 
    User, Lock, Bell, HelpCircle, LogOut, 
    Shield, ChevronRight, Clock, Mail, Phone, ExternalLink, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../context/ModalContext';
import AuthService from '../../services/authservice';
import { loadMotherPatient } from '../../services/motherOfflineService';
import { requestNotificationPermission } from '../../services/notificationservice';
import '../../styles/pages/UserSettings.css';

const UserSettings = () => {
    const navigate = useNavigate();
    const { alert: customAlert } = useModal();
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const auth = new AuthService();
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;
                const patient = await loadMotherPatient(authUser);
                setUserProfile({
                    name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || authUser.fullName || 'Mother',
                    dob: patient?.date_of_birth || '',
                    station: patient?.station || 'Health Station',
                    address: patient?.house_no ? `${patient.house_no}, ${patient.municipality || ''}`.trim() : 'N/A',
                    lastLogin: new Date().toLocaleString('en-PH')
                });
            } catch (err) {
                console.error('Failed to load user settings profile:', err);
            }
        };
        loadProfile();
    }, []);

    // Notification states
    const [notifs, setNotifs] = useState({
        appointments: true,
        vaccinations: true
    });

    // Password form states
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const userData = userProfile || {
        name: 'Mother',
        dob: '',
        age: '',
        station: 'Health Station',
        address: 'N/A',
        lastLogin: new Date().toLocaleString('en-PH')
    };

    const handleLogout = () => {
        navigate('/mother-login');
    };

    const handleNotificationToggle = async (key) => {
        const nextState = !notifs[key];
        setNotifs({ ...notifs, [key]: nextState });

        if (nextState) {
            const result = await requestNotificationPermission();
            if (!result.granted) {
                setNotifs({ ...notifs, [key]: false });
                await customAlert({ title: 'Permission needed', text: 'Notifications were not enabled. You can allow them later in Settings to receive reminders.', iconType: 'warning' });
            }
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        await customAlert({ title: 'Password Change', text: 'Password change initiated. In a real app, this would verify the current password.', iconType: 'info' });
        setPasswords({ current: '', new: '', confirm: '' });
    };

    return (
        <div className="user-settings-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Lock size={22} className="header-icon" /> Settings
                    </h1>
                    <p className="page-subtitle">Manage your personal information and security</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>

                </div>
            </div>

            <div className="settings-content">
                {/* ── Section A: Personal Information (Read-Only) ── */}
                <section className="settings-card">
                    <div className="card-header">
                        <User className="card-icon" size={20} />
                        <h2>Personal Information</h2>
                    </div>
                    <div className="read-only-grid">
                        <div className="field-group">
                            <label>Full Name</label>
                            <p>{userData.name}</p>
                        </div>
                        <div className="field-group">
                            <label>Date of Birth</label>
                            <p>{userData.dob} ({userData.age} years old)</p>
                        </div>
                        <div className="field-group">
                            <label>Station</label>
                            <p>{userData.station}</p>
                        </div>
                        <div className="field-group">
                            <label>Home Address</label>
                            <p>{userData.address}</p>
                        </div>
                    </div>
                    <div className="info-notice">
                        <Shield size={14} />
                        <span>Medical and identity data is managed by your health station.</span>
                    </div>
                </section>

                {/* ── Section B: Security ── */}
                <section className="settings-card">
                    <div className="card-header">
                        <Lock className="card-icon" size={20} />
                        <h2>Security</h2>
                    </div>
                    
                    <form className="password-form" onSubmit={handlePasswordChange}>
                        <h3>Change Password</h3>
                        <div className="input-group">
                            <label>Current Password</label>
                            <input 
                                type="password" 
                                placeholder="Enter current password"
                                value={passwords.current}
                                onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                            />
                        </div>
                        <div className="input-row">
                            <div className="input-group">
                                <label>New Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Min. 8 characters"
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                                />
                            </div>
                            <div className="input-group">
                                <label>Confirm New Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Repeat new password"
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn-update-password">Update Password</button>
                    </form>

                    <div className="login-history">
                        <h3>Login History</h3>
                        <div className="history-item">
                            <Clock size={16} />
                            <div>
                                <p>Last login: <strong>{userData.lastLogin}</strong></p>
                                <span>Chrome on Windows 11</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Section C: Notifications ── */}
                <section className="settings-card">
                    <div className="card-header">
                        <Bell className="card-icon" size={20} />
                        <h2>Notifications & Alerts</h2>
                    </div>
                    <div className="toggles-list">
                        <div className="toggle-item">
                            <div className="toggle-info">
                                <h3>Appointment Reminders</h3>
                                <p>Get notified about your upcoming prenatal and postpartum visits.</p>
                            </div>
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    checked={notifs.appointments}
                                    onChange={() => handleNotificationToggle('appointments')}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        <div className="toggle-item">
                            <div className="toggle-info">
                                <h3>Vaccination Alerts</h3>
                                <p>Receive alerts for scheduled infant or maternal vaccinations.</p>
                            </div>
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    checked={notifs.vaccinations}
                                    onChange={() => handleNotificationToggle('vaccinations')}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                </section>

                {/* ── Section D: Support & Contact ── */}
                <section className="settings-card">
                    <div className="card-header">
                        <HelpCircle className="card-icon" size={20} />
                        <h2>Support & Help</h2>
                    </div>
                    <div className="support-links">
                        <a href="#" className="support-item">
                            <div className="support-icon-wrap"><Mail size={18} /></div>
                            <div className="support-text">
                                <h3>Contact City Health Office</h3>
                                <p>Email: support@cityhealth.gov.ph</p>
                            </div>
                            <ExternalLink size={16} />
                        </a>
                        <a href="#" className="support-item">
                            <div className="support-icon-wrap"><Phone size={18} /></div>
                            <div className="support-text">
                                <h3>Health Station Hotline</h3>
                                <p>Call: (046) 123-4567 — Dasmariñas City</p>
                            </div>
                            <ExternalLink size={16} />
                        </a>
                        <a href="#" className="support-item">
                            <div className="support-icon-wrap"><Shield size={18} /></div>
                            <div className="support-text">
                                <h3>Frequently Asked Questions</h3>
                                <p>Find quick answers to common maternal care questions.</p>
                            </div>
                            <ChevronRight size={16} />
                        </a>
                    </div>
                </section>

                {/* ── Section E: Logout ── */}
                <button className="settings-logout-btn" onClick={handleLogout}>
                    <LogOut size={18} />
                    <span>Log Out of My Account</span>
                </button>
            </div>

            <footer className="settings-footer">
                <p>&copy; 2025 DasMom — City Health Office 3. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default UserSettings;
