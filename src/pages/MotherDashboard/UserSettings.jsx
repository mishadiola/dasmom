import React, { useState, useEffect, useContext } from 'react';
import { 
    Lock, Settings, HelpCircle, LogOut, 
    Shield, ChevronRight, Clock, Facebook, Phone, ExternalLink, ArrowLeft,
    X, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../context/ModalContext';
import { useLanguage } from '../../context/LanguageContext';
import { AuthContext } from '../../context/AuthContext';
import '../../styles/pages/UserSettings.css';
import ResetPasswordModal from '../../components/ResetPasswordModal';
import AuthService from '../../services/authservice';
import { CHO3_FACEBOOK_URL } from '../../config/appConfig';
import { formatLoginDateTime } from '../../utils/formatters';

const UserSettings = () => {
    const navigate = useNavigate();
    const { alert: customAlert } = useModal();
    const { t } = useLanguage();
    const { logout, user } = useContext(AuthContext);
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

    // Prevent body scroll and hide chatbot when modal is open
    useEffect(() => {
        if (showFaqModal) {
            document.body.style.overflow = 'hidden';
            document.body.classList.add('faq-open');
        } else {
            document.body.style.overflow = 'unset';
            document.body.classList.remove('faq-open');
        }
        return () => { 
            document.body.style.overflow = 'unset'; 
            document.body.classList.remove('faq-open');
        }
    }, [showFaqModal]);


    // Password form states
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const [loginHistory, setLoginHistory] = useState({
        timestamp: null,
        device: null,
        loading: true
    });

    useEffect(() => {
        let isMounted = true;
        const loadLoginInfo = async () => {
            try {
                const as = new AuthService();
                const currentUserId = user?.id || (await as.getAuthUser())?.id;
                const history = await as.getLoginHistory(currentUserId);
                if (isMounted) {
                    setLoginHistory({
                        timestamp: history?.timestamp || null,
                        device: history?.device || null,
                        loading: false
                    });
                }
            } catch (err) {
                console.error('Failed to load login history:', err);
                if (isMounted) {
                    setLoginHistory(prev => ({ ...prev, loading: false }));
                }
            }
        };

        loadLoginInfo();
        return () => { isMounted = false; };
    }, [user?.id]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/mother-login', { replace: true });
        } catch (error) {
            console.error('Logout error:', error);
            await customAlert({ title: 'Logout Failed', text: 'An error occurred while logging out.', iconType: 'danger' });
        }
    };

    const [resetModalOpen, setResetModalOpen] = useState(false);

    return (
        <div className="user-settings-container">
            <div className="page-header hero-header-with-img user-settings-hero-header">
                <div className="hero-decorative-icon-bg user-settings-decorative-bg" aria-hidden="true">
                    <Settings size={160} strokeWidth={1.2} className="hero-decorative-icon" />
                </div>
                <div className="hero-content-wrapper">
                    <div className="hero-text-section">
                        <h1 className="page-title">
                            <Settings size={22} className="header-icon" style={{ display: 'inline', marginRight: '6px' }} /> {t('settings_title', 'Account Settings')}
                        </h1>
                        <p className="page-subtitle">{t('settings_subtitle', 'Manage your account security and preferences')}</p>
                    </div>
                </div>
            </div>

            <div className="settings-content">

                {/* ── Section B: Security ── */}
                <section className="settings-card security-card">
                    <div className="card-header">
                        <Lock className="card-icon" size={18} />
                        <h2>{t('settings_security', 'Security')}</h2>
                    </div>
                    
                    <div className="security-reset-block">
                        <h3 className="settings-section-title">
                            Reset Password
                        </h3>
                        <p className="settings-section-desc">
                            Reset your password securely through your registered email address.
                        </p>
                        <button 
                            type="button" 
                            className="btn-update-password" 
                            onClick={() => setResetModalOpen(true)}
                        >
                            Reset Password
                        </button>
                    </div>

                    <div className="login-history">
                        <h3 className="settings-section-title">{t('settings_login_history', 'Login History')}</h3>
                        <div className="history-item">
                            <Clock size={16} className="history-icon" />
                            <div className="history-details">
                                <p className="history-text">
                                    <span className="history-label">{t('settings_last_login', 'Last login:')}</span>{' '}
                                    <span className="history-value">
                                        {loginHistory.loading 
                                            ? '...' 
                                            : (loginHistory.timestamp 
                                                ? formatLoginDateTime(loginHistory.timestamp) 
                                                : 'Not available')}
                                    </span>
                                </p>
                                <span className="history-meta">
                                    {loginHistory.device || t('settings_browser', 'Browser / Web Browser')}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>


                {/* ── Section D: Support & Contact ── */}
                <section className="settings-card support-card">
                    <div className="card-header">
                        <HelpCircle className="card-icon" size={18} />
                        <h2>{t('settings_support', 'Support & Contact')}</h2>
                    </div>
                    <div className="support-links">
                        <a 
                            href={CHO3_FACEBOOK_URL} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="support-item" 
                            onClick={(e) => e.currentTarget.blur()}
                        >
                            <div className="support-icon-wrap"><Facebook size={16} /></div>
                            <div className="support-text">
                                <h3>{t('settings_contact_cho_fb', 'Contact CHO III')}</h3>
                                <p className="support-info-line">
                                    <span className="support-info-label">Facebook:</span>{' '}
                                    <span className="support-info-val">CHO III</span>
                                </p>
                            </div>
                            <ExternalLink size={15} className="support-arrow-icon" />
                        </a>
                        <a href="tel:09452694260" className="support-item" onClick={(e) => e.currentTarget.blur()}>
                            <div className="support-icon-wrap"><Phone size={16} /></div>
                            <div className="support-text">
                                <h3>{t('settings_contact_cho_phone', 'Contact CHO III')}</h3>
                                <p className="support-info-line">
                                    <span className="support-info-label">Phone:</span>{' '}
                                    <span className="support-info-val">0945 269 4260</span>
                                </p>
                            </div>
                            <ExternalLink size={15} className="support-arrow-icon" />
                        </a>
                        <a href="#" className="support-item" onClick={(e) => { e.preventDefault(); setShowFaqModal(true); }}>
                            <div className="support-icon-wrap"><Shield size={16} /></div>
                            <div className="support-text">
                                <h3>{t('settings_faq', 'Frequently Asked Questions')}</h3>
                                <p className="support-info-line">
                                    <span className="support-info-val">{t('settings_faq_desc', 'Find answers to common questions')}</span>
                                </p>
                            </div>
                            <ChevronRight size={15} className="support-arrow-icon" />
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
            <ResetPasswordModal 
                isOpen={resetModalOpen} 
                onClose={() => setResetModalOpen(false)}
                initialEmail={user?.email || ''}
            />
        </div>
    );
};

export default UserSettings;
