import React, { useState, useEffect } from 'react';
import { Heart, Calendar, Syringe, X, ChevronRight, ArrowRight, Activity, ArrowLeft } from 'lucide-react';
import '../../styles/components/WelcomeMotherModal.css';

const WelcomeMotherModal = ({ onClose }) => {
    const [step, setStep] = useState(1);
    const [selectedFeature, setSelectedFeature] = useState(null);

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
                            <h2 className="welcome-title">Hello, Mommy! Welcome to DASMOM+</h2>
                            <p className="welcome-subtitle">We care for you just as much as you care for your baby.</p>
                            <p className="welcome-text">
                                Your health and well-being matter too. DASMOM+ is here to support you through pregnancy, delivery, and postpartum care.
                            </p>
                            <button className="welcome-btn-primary" onClick={nextStep} style={{marginTop: '32px'}}>
                                Let's Get Started <ArrowRight size={18} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="welcome-step fade-in">
                            <h2 className="welcome-title" style={{textAlign: 'left', marginBottom: '8px'}}>Everything You Need, In One Place</h2>
                            <p className="welcome-text" style={{textAlign: 'left', marginBottom: '24px'}}>Keeping track of your care is easier when everything is right here.</p>
                            
                            <div className="welcome-feature-cards">
                                <div className="welcome-feature-card card-appointments">
                                    <div className="welcome-feature-icon"><Calendar size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>Appointments</h3>
                                        <p>Know what's coming up next.<br/>Keep track of your prenatal, vaccination, and postpartum visits.</p>
                                    </div>
                                </div>
                                <div className="welcome-feature-card card-records">
                                    <div className="welcome-feature-icon"><Activity size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>Health Records</h3>
                                        <p>Keep your health journey close.<br/>View your important maternal health records and visit history anytime.</p>
                                    </div>
                                </div>
                                <div className="welcome-feature-card card-vaccines">
                                    <div className="welcome-feature-icon"><Syringe size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>Vaccinations</h3>
                                        <p>Stay protected and up to date.<br/>See your recommended vaccinations and keep track of your care.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="welcome-actions-row">
                                <button className="welcome-btn-secondary" onClick={prevStep}>
                                    <ArrowLeft size={16} /> Back
                                </button>
                                <button className="welcome-btn-primary" onClick={nextStep} style={{margin: 0}}>
                                    Next <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="welcome-step fade-in">
                            <h2 className="welcome-title">Your Journey Matters, Mommy.</h2>
                            <p className="welcome-subtitle" style={{marginBottom: '24px', fontWeight: 500}}>
                                From your first visit to postpartum care, DASMOM+ is here to support you every step of the way.
                            </p>
                            <div className="welcome-reassurance-box">
                                <p>You care so much for your little one.<br/>Don't forget to care for yourself, too.</p>
                            </div>
                            <p className="welcome-text" style={{marginTop: '24px'}}>
                                We're here to help you stay connected with your health, your care team, and the services you need.
                            </p>
                            <div className="welcome-actions-row" style={{marginTop: 'auto', paddingTop: '24px'}}>
                                <button className="welcome-btn-secondary" onClick={prevStep}>
                                    <ArrowLeft size={16} /> Back
                                </button>
                                <button className="welcome-btn-primary" onClick={handleClose} style={{margin: 0}}>
                                    Go to My Dashboard <ArrowRight size={16} />
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
                    <div className="welcome-step-label">Step {step} of 3</div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeMotherModal;
