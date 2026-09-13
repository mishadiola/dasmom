import React, { useState, useEffect } from 'react';
import { Heart, Calendar, Syringe, X, ChevronRight, ArrowRight, Activity, ArrowLeft } from 'lucide-react';
import '../../styles/components/WelcomeMotherModal.css';
import { useLanguage } from '../../context/LanguageContext';

const WelcomeMotherModal = ({ onClose }) => {
    const [step, setStep] = useState(1);
    const [selectedFeature, setSelectedFeature] = useState(null);
    const { t } = useLanguage();

    // Fade in effect on mount
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        setIsVisible(true);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300); // match animation duration
    };

    const nextStep = () => {
        if (step < 3) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className={`welcome-modal-overlay ${isVisible ? 'visible' : ''}`} onClick={handleClose}>
            <div className="welcome-modal-container" onClick={(e) => e.stopPropagation()}>
                <button className="welcome-close-btn" onClick={handleClose} aria-label="Close">
                    <X size={20} />
                </button>
                
                <div className="welcome-modal-content">
                    {step === 1 && (
                        <div className="welcome-step fade-in">
                            <div className="welcome-icon-wrapper" style={{ backgroundColor: '#fdf2f4' }}>
                                <Heart size={48} className="welcome-main-icon" style={{ color: '#b9818a' }} />
                            </div>
                            <h2 className="welcome-title">{t('welcome_title')}</h2>
                            <p className="welcome-subtitle">{t('welcome_subtitle')}</p>
                            <p className="welcome-text">
                                {t('welcome_text')}
                            </p>
                            <button className="welcome-btn-primary" onClick={nextStep} style={{marginTop: '32px'}}>
                                {t('welcome_get_started')} <ArrowRight size={18} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="welcome-step fade-in">
                            <h2 className="welcome-title" style={{textAlign: 'left', marginBottom: '8px'}}>{t('welcome_step2_title')}</h2>
                            <p className="welcome-text" style={{textAlign: 'left', marginBottom: '24px'}}>{t('welcome_step2_text')}</p>
                            
                            <div className="welcome-feature-cards">
                                <div className="welcome-feature-card card-appointments">
                                    <div className="welcome-feature-icon"><Calendar size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>{t('welcome_appointments')}</h3>
                                        <p>{t('welcome_appointments_desc')}</p>
                                    </div>
                                </div>
                                <div className="welcome-feature-card card-records">
                                    <div className="welcome-feature-icon"><Activity size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>{t('welcome_records')}</h3>
                                        <p>{t('welcome_records_desc')}</p>
                                    </div>
                                </div>
                                <div className="welcome-feature-card card-vaccines">
                                    <div className="welcome-feature-icon"><Syringe size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>{t('welcome_vaccines')}</h3>
                                        <p>{t('welcome_vaccines_desc')}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="welcome-actions-row">
                                <button className="welcome-btn-secondary" onClick={prevStep}>
                                    <ArrowLeft size={16} /> {t('welcome_back')}
                                </button>
                                <button className="welcome-btn-primary" onClick={nextStep} style={{margin: 0}}>
                                    {t('welcome_next')} <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="welcome-step fade-in">
                            <h2 className="welcome-title">{t('welcome_step3_title')}</h2>
                            <p className="welcome-subtitle" style={{marginBottom: '24px', fontWeight: 500}}>
                                {t('welcome_step3_subtitle')}
                            </p>
                            <div className="welcome-reassurance-box">
                                <p>{t('welcome_step3_box')}</p>
                            </div>
                            <p className="welcome-text" style={{marginTop: '24px'}}>
                                {t('welcome_step3_text')}
                            </p>
                            <div className="welcome-actions-row" style={{marginTop: 'auto', paddingTop: '24px'}}>
                                <button className="welcome-btn-secondary" onClick={prevStep}>
                                    <ArrowLeft size={16} /> {t('welcome_back')}
                                </button>
                                <button className="welcome-btn-primary" onClick={handleClose} style={{margin: 0}}>
                                    {t('welcome_go_dashboard')} <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="welcome-progress-section">
                    <div className="welcome-progress-dots">
                        {[1, 2, 3].map((num) => (
                            <React.Fragment key={num}>
                                <div className={`welcome-dot ${step >= num ? 'active' : ''}`} />
                                {num < 3 && <div className={`welcome-line ${step > num ? 'active' : ''}`} />}
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="welcome-step-label">{t('welcome_step_label').replace('{step}', step)}</div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeMotherModal;
