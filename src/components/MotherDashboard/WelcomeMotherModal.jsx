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
                            <div className="welcome-icon-wrapper">
                                <Heart size={48} className="welcome-main-icon" />
                            </div>
                            <h2 className="welcome-title">Welcome to DASMOM+</h2>
                            <p className="welcome-subtitle">Care for you, every step of the way.</p>
                            <p className="welcome-text">
                                DASMOM+ is here to support you throughout your motherhood journey — from pregnancy to postpartum care.
                            </p>
                            <button className="welcome-btn-primary" onClick={nextStep} style={{marginTop: '24px'}}>
                                Let's Get Started <ArrowRight size={18} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="welcome-step fade-in">
                            <h2 className="welcome-title" style={{textAlign: 'left', marginBottom: '8px'}}>Your Care, Organized</h2>
                            <p className="welcome-text" style={{textAlign: 'left', marginBottom: '24px'}}>Explore the features designed to support your journey.</p>
                            
                            <div className="welcome-feature-cards">
                                <button 
                                    className={`welcome-feature-card ${selectedFeature === 'appointments' ? 'selected' : ''}`}
                                    onClick={() => setSelectedFeature('appointments')}
                                    aria-pressed={selectedFeature === 'appointments'}
                                >
                                    <div className="welcome-feature-icon"><Calendar size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>Appointments</h3>
                                        <p>Keep track of your upcoming prenatal, vaccination, and postpartum visits.</p>
                                    </div>
                                </button>
                                <button 
                                    className={`welcome-feature-card ${selectedFeature === 'records' ? 'selected' : ''}`}
                                    onClick={() => setSelectedFeature('records')}
                                    aria-pressed={selectedFeature === 'records'}
                                >
                                    <div className="welcome-feature-icon"><Activity size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>Health Records</h3>
                                        <p>Keep your maternal health information organized and easy to access.</p>
                                    </div>
                                </button>
                                <button 
                                    className={`welcome-feature-card ${selectedFeature === 'vaccines' ? 'selected' : ''}`}
                                    onClick={() => setSelectedFeature('vaccines')}
                                    aria-pressed={selectedFeature === 'vaccines'}
                                >
                                    <div className="welcome-feature-icon"><Syringe size={24} /></div>
                                    <div className="welcome-feature-info">
                                        <h3>Vaccinations</h3>
                                        <p>Stay updated with your recommended vaccinations and health services.</p>
                                    </div>
                                </button>
                            </div>

                            <div className="welcome-actions-row">
                                <button className="welcome-btn-secondary" onClick={prevStep}>
                                    <ArrowLeft size={16} /> Back
                                </button>
                                <button className="welcome-btn-primary" onClick={nextStep}>
                                    Next <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="welcome-step fade-in">
                            <h2 className="welcome-title">Your health matters.</h2>
                            <p className="welcome-text" style={{marginBottom: '32px'}}>
                                From pregnancy to postpartum, DASMOM+ helps you stay connected with the care and services you need.
                            </p>
                            <div className="welcome-reassurance-box">
                                <p>You're not just keeping track of your health.<br/>We're here to help you through the journey.</p>
                            </div>
                            <div className="welcome-actions-row" style={{marginTop: '40px', justifyContent: 'center', gap: '16px'}}>
                                <button className="welcome-btn-secondary" onClick={prevStep}>
                                    <ArrowLeft size={16} /> Back
                                </button>
                                <button className="welcome-btn-primary" onClick={handleClose}>
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
