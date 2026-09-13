import React, { useState, useEffect } from 'react';
import { 
    Lock, HelpCircle, LogOut, 
    Shield, ChevronRight, Clock, Mail, Phone, ExternalLink, ArrowLeft,
    X, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../context/ModalContext';
import { useLanguage } from '../../context/LanguageContext';
import '../../styles/pages/UserSettings.css';



const UserSettings = () => {
    const navigate = useNavigate();
    const { alert: customAlert } = useModal();
    const { t } = useLanguage();
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [expandedFaq, setExpandedFaq] = useState(null);

    const FAQ_DATA = [
        { q: t('faq_q1'), a: t('faq_a1') },
        { q: t('faq_q2'), a: t('faq_a2') },
        { q: t('faq_q3'), a: t('faq_a3') },
        { q: t('faq_q4'), a: t('faq_a4') },
        { q: t('faq_q5'), a: t('faq_a5') },
        { q: t('faq_q6'), a: t('faq_a6') },
        { q: t('faq_q7'), a: t('faq_a7') },
        { q: t('faq_q8'), a: t('faq_a8') }
    ];

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (showFaqModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; }
    }, [showFaqModal]);


    // Password form states
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const userData = {
        name: "Mish Diola",
        dob: "June 12, 1997",
        age: 28,
        station: "Poblacion Uno",
        address: "123 Mabini St., Poblacion Uno, Dasmariñas City",
        lastLogin: "March 07, 2026 at 2:45 PM"
    };

    const handleLogout = () => {
        navigate('/');
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
                        <Lock size={22} className="header-icon" /> {t('settings_title', 'Account Settings')}
                    </h1>
                    <p className="page-subtitle">{t('settings_subtitle', 'Manage your account security and preferences')}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>

                </div>
            </div>

            <div className="settings-content">

                {/* ── Section B: Security ── */}
                <section className="settings-card">
                    <div className="card-header">
                        <Lock className="card-icon" size={20} />
                        <h2>{t('settings_security', 'Security')}</h2>
                    </div>
                    
                    <form className="password-form" onSubmit={handlePasswordChange}>
                        <h3>{t('settings_change_password', 'Change Password')}</h3>
                        <div className="input-group">
                            <label>{t('settings_current_password', 'Current Password')}</label>
                            <input 
                                type="password" 
                                placeholder={t('settings_current_password_ph', 'Enter current password')}
                                value={passwords.current}
                                onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                            />
                        </div>
                        <div className="input-row">
                            <div className="input-group">
                                <label>{t('settings_new_password', 'New Password')}</label>
                                <input 
                                    type="password" 
                                    placeholder={t('settings_new_password_ph', 'Enter new password')}
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                                />
                            </div>
                            <div className="input-group">
                                <label>{t('settings_confirm_password', 'Confirm New Password')}</label>
                                <input 
                                    type="password" 
                                    placeholder={t('settings_confirm_password_ph', 'Confirm new password')}
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn-update-password">{t('settings_update_password', 'Update Password')}</button>
                    </form>

                    <div className="login-history">
                        <h3>{t('settings_login_history', 'Login History')}</h3>
                        <div className="history-item">
                            <Clock size={16} />
                            <div>
                                <p>{t('settings_last_login', 'Last login:')} <strong>{userData.lastLogin}</strong></p>
                                <span>{t('settings_browser', 'Browser / Web Browser')}</span>
                            </div>
                        </div>
                    </div>
                </section>


                {/* ── Section D: Support & Contact ── */}
                <section className="settings-card">
                    <div className="card-header">
                        <HelpCircle className="card-icon" size={20} />
                        <h2>{t('settings_support', 'Support & Contact')}</h2>
                    </div>
                    <div className="support-links">
                        <a href="#" className="support-item">
                            <div className="support-icon-wrap"><Mail size={18} /></div>
                            <div className="support-text">
                                <h3>{t('settings_contact_cho', 'Contact CHO')}</h3>
                                <p>Email: support@cityhealth.gov.ph</p>
                            </div>
                            <ExternalLink size={16} />
                        </a>
                        <a href="#" className="support-item">
                            <div className="support-icon-wrap"><Phone size={18} /></div>
                            <div className="support-text">
                                <h3>{t('settings_hotline', 'Emergency Hotline')}</h3>
                                <p>Call: (046) 123-4567 — Dasmariñas City</p>
                            </div>
                            <ExternalLink size={16} />
                        </a>
                        <a href="#" className="support-item" onClick={(e) => { e.preventDefault(); setShowFaqModal(true); }}>
                            <div className="support-icon-wrap"><Shield size={18} /></div>
                            <div className="support-text">
                                <h3>{t('settings_faq', 'Frequently Asked Questions')}</h3>
                                <p>{t('settings_faq_desc', 'Find answers to common questions')}</p>
                            </div>
                            <ChevronRight size={16} />
                        </a>
                    </div>
                </section>

                {/* ── Section E: Logout ── */}
                <button className="settings-logout-btn" onClick={handleLogout}>
                    <LogOut size={18} />
                    <span>{t('settings_logout', 'Log Out')}</span>
                </button>
            </div>

            <footer className="settings-footer">
                <p>{t('settings_footer', 'DASMOM+ User Settings')}</p>
            </footer>

            {/* FAQ Modal */}
            {showFaqModal && (
                <div className="faq-modal-overlay" onClick={() => setShowFaqModal(false)}>
                    <div className="faq-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="faq-modal-header">
                            <h2>{t('settings_faq', 'Frequently Asked Questions')}</h2>
                            <button className="faq-close-btn" onClick={() => setShowFaqModal(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="faq-modal-body">
                            {FAQ_DATA.map((faq, idx) => (
                                <div key={idx} className={`faq-accordion-item ${expandedFaq === idx ? 'expanded' : ''}`}>
                                    <button 
                                        className="faq-accordion-header" 
                                        onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                                    >
                                        <span>{faq.q}</span>
                                        {expandedFaq === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                    {expandedFaq === idx && (
                                        <div className="faq-accordion-content">
                                            <p>{faq.a}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserSettings;
