import React, { useState, useEffect } from 'react';
import { 
    Lock, HelpCircle, LogOut, 
    Shield, ChevronRight, Clock, Mail, Phone, ExternalLink, ArrowLeft,
    X, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../context/ModalContext';
import '../../styles/pages/UserSettings.css';

const FAQ_DATA = [
    {
        q: "What is DASMOM+?",
        a: "DASMOM+ is a maternal healthcare platform that helps mothers and healthcare staff manage and view maternal health records, appointments, vaccinations, and other pregnancy-related information."
    },
    {
        q: "How do I view my health records?",
        a: "Go to Records from the bottom navigation. You can view your available vital records and delivery information recorded by your healthcare team."
    },
    {
        q: "Can I edit my health records?",
        a: "No. Health records are managed by authorized healthcare staff to help keep the information accurate and secure. Contact your health station if you notice incorrect information."
    },
    {
        q: "How do I check my appointments?",
        a: "Go to Visits to view your upcoming appointments, completed visits, and available appointment details."
    },
    {
        q: "How do I view my vaccination schedule?",
        a: "Go to Vaccines to view your recorded vaccination information, scheduled vaccines, and vaccination status."
    },
    {
        q: "Is my information secure?",
        a: "Your information is protected and accessible only to authorized healthcare personnel through the DASMOM+ system."
    },
    {
        q: "What should I do if my information is incorrect?",
        a: "Contact your assigned health station or City Health Office so authorized staff can review and correct your records."
    },
    {
        q: "Where can I learn more about using DASMOM+?",
        a: "Please refer to the DASMOM+ User Manual for detailed instructions on how to use the system."
    }
];

const UserSettings = () => {
    const navigate = useNavigate();
    const { alert: customAlert } = useModal();
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [expandedFaq, setExpandedFaq] = useState(null);

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
                        <Lock size={22} className="header-icon" /> Settings
                    </h1>
                    <p className="page-subtitle">Manage your personal information and security</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>

                </div>
            </div>

            <div className="settings-content">

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
                        <a href="#" className="support-item" onClick={(e) => { e.preventDefault(); setShowFaqModal(true); }}>
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

            {/* FAQ Modal */}
            {showFaqModal && (
                <div className="faq-modal-overlay" onClick={() => setShowFaqModal(false)}>
                    <div className="faq-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="faq-modal-header">
                            <h2>Frequently Asked Questions</h2>
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
