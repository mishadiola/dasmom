import React, { useState, useEffect } from 'react';
import {
    User, Mail, Phone, MapPin, ShieldCheck,
    Lock, LogOut, Edit2, Heart, ChevronDown, ChevronUp,
    Calendar, UserCheck, ArrowLeft, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import '../../styles/pages/UserAccount.css';
import { formatMotherId } from '../../utils/displayIds';
import { useLanguage } from '../../context/LanguageContext';

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

const formatPhone = (phone) => {
    if (!phone) return '—';
    return phone;
};

// ─── Main Component ───────────────────────────────────────────────────
const UserAccount = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userData, setUserData] = useState(null);
    const [newborns, setNewborns] = useState([]);
    const { t } = useLanguage();
    const authService = new AuthService();
    const patientService = new PatientService();

    useEffect(() => {
        const loadUserData = async () => {
            setLoading(true);
            setError(null);
            try {
                const authUser = await authService.getAuthUser();
                if (!authUser?.id) {
                    setError(t('acct_not_authenticated'));
                    return;
                }

                const patient = await patientService.getPatientById(authUser.id);
                if (!patient) {
                    setError(t('acct_not_found'));
                    return;
                }

                // Extract patient info
                const fullName = `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim();
                const userInfo = {
                    id: patient.id,
                    name: fullName || 'N/A',
                    firstName: patient.first_name || '',
                    middleName: patient.middle_name || '',
                    lastName: patient.last_name || '',
                    suffix: patient.suffix || '',
                    dateOfBirth: patient.date_of_birth,
                    age: getAge(patient.date_of_birth),
                    bloodType: patient.blood_type || patient.bloodtype || 'N/A',
                    civilStatus: patient.civil_status || 'N/A',
                    phone: patient.contact_no || 'N/A',
                    email: authUser?.email || 'N/A',
                    address: patient.house_no ? `${patient.house_no}, ${patient.municipality || ''}, ${patient.province || ''}`.trim() : 'N/A',
                    philHealthNumber: patient.philhealthnumber || 'N/A',
                    station: patient.station || 'N/A'
                };

                setUserData(userInfo);

                // Load newborn info if available
                if (patient.newborns && patient.newborns.length > 0) {
                    setNewborns(patient.newborns);
                }
            } catch (err) {
                console.error('Failed to load user data:', err);
                setError(t('acct_load_failed'));
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, []);

    const handleLogout = async () => {
        await authService.logout();
        navigate('/mother-login');
    };

    if (loading) {
        return (
            <div className="user-account-page">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">
                            <User size={22} className="header-icon" /> {t('acct_title')}
                        </h1>
                        <p className="page-subtitle">{t('acct_loading')}</p>
                    </div>
                    <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>

                    </div>
                </div>
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <p>{t('acct_loading_text')}</p>
                </div>
            </div>
        );
    }

    if (!userData) {
        return (
            <div className="user-account-page">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">
                            <User size={22} className="header-icon" /> {t('acct_title')}
                        </h1>
                        <p className="page-subtitle">{t('acct_subtitle')}</p>
                    </div>
                    <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>

                    </div>
                </div>
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <AlertCircle size={40} style={{ color: '#e74c3c', marginBottom: '10px' }} />
                    <p>{error || t('acct_error')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="user-account-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <User size={22} className="header-icon" /> {t('acct_title')}
                    </h1>
                    <p className="page-subtitle">{t('acct_subtitle')}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
                </div>
            </div>

            <div className="ua-content">
                {/* ── Personal Information Section ── */}
                <section className="ua-section ua-section--personal">
                    <div className="ua-section-header">
                        <div className="ua-avatar-container">
                            <div className="ua-avatar">
                                {getInitials(userData.name)}
                            </div>
                        </div>
                        <div>
                            <h2>{userData.name}</h2>
                            <p className="ua-subtext">{t('acct_patient_id')} <code>{formatMotherId(userData.id)}</code></p>
                        </div>
                    </div>

                    <div className="ua-info-grid">
                        {/* Basic Info */}
                        <div className="ua-info-card">
                            <div className="ua-info-icon"><User size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_full_name')}</label>
                                <p>{userData.name}</p>
                            </div>
                        </div>

                        <div className="ua-info-card">
                            <div className="ua-info-icon"><Calendar size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_dob')}</label>
                                <p>{formatDate(userData.dateOfBirth)}</p>
                                <span className="ua-meta">{userData.age && t('acct_years_old').replace('{age}', userData.age)}</span>
                            </div>
                        </div>

                        <div className="ua-info-card">
                            <div className="ua-info-icon"><Heart size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_blood_type')}</label>
                                <p>{userData.bloodType}</p>
                            </div>
                        </div>

                        <div className="ua-info-card">
                            <div className="ua-info-icon"><UserCheck size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_civil_status')}</label>
                                <p>{userData.civilStatus}</p>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="ua-info-card">
                            <div className="ua-info-icon"><Phone size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_contact')}</label>
                                <p>{formatPhone(userData.phone)}</p>
                            </div>
                        </div>

                        <div className="ua-info-card">
                            <div className="ua-info-icon"><Mail size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_email')}</label>
                                <p>{userData.email}</p>
                            </div>
                        </div>

                        {/* Address & Location */}
                        <div className="ua-info-card ua-info-card--full">
                            <div className="ua-info-icon"><MapPin size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_address')}</label>
                                <p>{userData.address}</p>
                            </div>
                        </div>

                        <div className="ua-info-card">
                            <div className="ua-info-icon"><ShieldCheck size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_health_station')}</label>
                                <p>{userData.station}</p>
                            </div>
                        </div>

                        <div className="ua-info-card">
                            <div className="ua-info-icon"><ShieldCheck size={18} /></div>
                            <div className="ua-info-content">
                                <label>{t('acct_philhealth')}</label>
                                <p>{userData.philHealthNumber}</p>
                            </div>
                        </div>
                    </div>

                    <div className="ua-info-notice">
                        <AlertCircle size={16} />
                        <p>{t('acct_info_notice')}</p>
                    </div>
                </section>

                {/* ── Children (Newborns) Section ── */}
                {newborns.length > 0 && (
                    <section className="ua-section ua-section--children">
                        <div className="ua-section-title">
                            <h3>{t('acct_children_title')}</h3>
                            <p className="ua-section-subtitle">{newborns.length} {newborns.length === 1 ? t('acct_child') : t('acct_children')}</p>
                        </div>

                        <div className="ua-children-grid">
                            {newborns.map((child, idx) => (
                                <div key={idx} className="ua-child-card">
                                    <div className="ua-child-header">
                                        <div className="ua-child-avatar">
                                            {getInitials(child.baby_name || `Baby ${idx + 1}`)}
                                        </div>
                                        <div>
                                            <h4>{child.baby_name || `Baby ${idx + 1}`}</h4>
                                            <p className="ua-child-meta">{child.gender || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="ua-child-details">
                                        <div className="ua-child-detail">
                                            <span className="label">{t('acct_birth_weight')}</span>
                                            <span className="value">{child.birth_weight ? `${child.birth_weight} kg` : 'N/A'}</span>
                                        </div>
                                        <div className="ua-child-detail">
                                            <span className="label">{t('acct_birth_length')}</span>
                                            <span className="value">{child.birth_length ? `${child.birth_length} cm` : 'N/A'}</span>
                                        </div>
                                        <div className="ua-child-detail">
                                            <span className="label">{t('acct_condition')}</span>
                                            <span className="value">{child.condition_at_birth || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Security Section ── */}
                <section className="ua-section ua-section--security">
                    <div className="ua-section-title">
                        <h3><Lock size={18} /> {t('acct_privacy')}</h3>
                    </div>
                    <div className="ua-security-info">
                        <p>{t('acct_privacy_text1')}</p>
                        <p>{t('acct_privacy_text2')}</p>
                    </div>
                </section>

                <div className="ua-logout-container">
                    <button className="ua-logout-btn" onClick={handleLogout}>
                        <LogOut size={16} /> {t('acct_logout')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserAccount;
