import React, { useState, useContext, useEffect } from 'react';
import { 
    Mail, Lock, Eye, EyeOff, Loader2, 
    Calendar, Activity, Heart, Baby, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MotherLogin.css';
import logo from '../../assets/images/dasmom_logo.png';
import AuthService from '../../services/authservice';
import { AuthContext } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import supabase from '../../config/supabaseclient';
import InstallAppModal from '../../components/InstallAppModal';
import { shouldPromptInstall, persistMotherOfflineData } from '../../services/notificationservice';
import PatientService from '../../services/patientservice';

const MotherLogin = () => {
    const navigate = useNavigate();
    const { alert: customAlert } = useModal();
    const { setUser } = useContext(AuthContext);
    const authService = new AuthService();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    useEffect(() => {
        const installDismissed = localStorage.getItem('dasmom-install-dismissed');
        if (installDismissed === 'true') return;

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setDeferredPrompt(event);
            setShowInstallModal(shouldPromptInstall());
        };

        const canInstall = shouldPromptInstall();
        if (canInstall) {
            setShowInstallModal(true);
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallApp = async () => {
        if (!deferredPrompt) {
            setShowInstallModal(false);
            localStorage.setItem('dasmom-install-dismissed', 'true');
            return;
        }

        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setShowInstallModal(false);
        localStorage.setItem('dasmom-install-dismissed', 'true');
    };

    const handleInstallClose = () => {
        setShowInstallModal(false);
        localStorage.setItem('dasmom-install-dismissed', 'true');
    };

    const handleForgotPassword = async (event) => {
        event.preventDefault();
        const resetEmail = window.prompt('Enter the email address registered with DASMOM:');
        if (!resetEmail?.trim()) return;

        setIsLoading(true);
        try {
            await supabase.functions.invoke('create-mother', {
                body: {
                    action: 'password_reset',
                    email: resetEmail.trim().toLowerCase(),
                    redirectTo: `${window.location.origin}/reset-password`
                }
            });
            await customAlert({ title: 'Check your email', text: 'If that account exists, a password reset link has been sent.', iconType: 'success' });
        } catch (error) {
            console.error('Password reset email failed:', error);
            await customAlert({ title: 'Reset failed', text: 'Unable to send the reset email. Please try again.', iconType: 'danger' });
        } finally {
            setIsLoading(false);
        }
    };

   const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        const user = await authService.login(email, password);

        if (!authService.accessCheck(user, 'mother')) {
            await customAlert({ title: 'Access Denied', text: 'You do not have access as a mother.', iconType: 'danger' });
            return;
        }

        const patientService = new PatientService();
        const patient = await patientService.getPatientById(user.id);
        await persistMotherOfflineData(patient, user);

        setUser(user);
        const route = authService.getRedirectRoute(user.role);
        navigate(route);

    } catch (err) {
        await customAlert({ title: 'Login Error', text: err.message, iconType: 'danger' });
    } finally {
        setIsLoading(false);
    }
};

    const highlights = [
        { icon: Activity, text: 'Track your pregnancy progress' },
        { icon: Calendar, text: 'View upcoming appointments' },
        { icon: Heart, text: 'Learn prenatal care tips' },
        { icon: Baby, text: 'Access newborn information' }
    ];

    return (
        <>
        <InstallAppModal
            isOpen={showInstallModal}
            onInstall={handleInstallApp}
            onClose={handleInstallClose}
            isDesktop={window.innerWidth > 1024 && !('beforeinstallprompt' in window)}
        />
        <div className="ml-container">
            <div className="ml-background"></div>
            
            {/* Back Button */}
            <button className="ml-back-btn" onClick={() => navigate('/landing')}>
                <ArrowLeft size={18} />
                <span>Go Back to Landing Page</span>
            </button>

            <main className="ml-main">
                <div className="ml-card">
                    {/* Left Panel - Login Form */}
                    <div className="ml-panel-left">
                        <div className="ml-login-header">
                            <div className="ml-logo-wrapper">
                                <img src={logo} alt="DasMom+ Logo" className="ml-logo" />
                            </div>
                            <h1 className="ml-title">Log in</h1>
                            <p className="ml-subtitle">Access your maternal health dashboard</p>
                        </div>

                        <form className="ml-form" onSubmit={handleSubmit}>
                            <div className="ml-form-group">
                                <label className="ml-label">Email Address</label>
                                <div className="ml-input-wrapper">
                                    <Mail size={18} className="ml-input-icon" />
                                    <input 
                                        type="email" 
                                        className="ml-input" 
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="ml-form-group">
                                <label className="ml-label">Password</label>
                                <div className="ml-input-wrapper">
                                    <Lock size={18} className="ml-input-icon" />
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        className="ml-input" 
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button 
                                        type="button" 
                                        className="ml-pwd-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="ml-submit-btn" disabled={isLoading}>
                                {isLoading ? (
                                    <span className="ml-btn-loading">
                                        <Loader2 className="ml-spinner" /> Logging in...
                                    </span>
                                ) : (
                                    <span>Login to Dashboard</span>
                                )}
                            </button>

                            <div className="ml-form-footer">
                                <a href="#forgot-password" className="ml-forgot-link" onClick={handleForgotPassword}>
                                    Forgot your password?
                                </a>
                            </div>
                        </form>
                    </div>

                    {/* Right Panel - Welcome Info */}
                    <div className="ml-panel-right">
                        <div className="ml-welcome-section">
                            <div className="ml-welcome-badge">
                                <Heart size={16} />
                                <span>Welcome, Mommy!</span>
                            </div>
                            <h2 className="ml-welcome-title">Congratulations!</h2>
                            <p className="ml-welcome-text">
                                DASMOM+ helps you ensure the safety of yourself and your baby. Track your pregnancy, view appointments, and access health information all in one place.
                            </p>

                            <div className="ml-features-list">
                                {highlights.map((item, index) => {
                                    const Icon = item.icon;
                                    return (
                                        <div className="ml-feature-item" key={index}>
                                            <div className="ml-feature-icon-wrapper">
                                                <Icon size={20} />
                                            </div>
                                            <span className="ml-feature-text">{item.text}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="ml-footer-info">
                                <p className="ml-footer-location">City Health Office 3, Dasmariñas, Cavite</p>
                                <p className="ml-footer-copy"> 2026 DASMOM+. All rights reserved.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        </>
    );
};

export default MotherLogin;