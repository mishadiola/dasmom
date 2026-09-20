import React, { useState, useContext } from 'react';
import { 
    Mail, Lock, Eye, EyeOff, Loader2, Chrome,
    Calendar, Activity, Heart, Baby, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MotherLogin.css';
import logo from '../../assets/images/dasmom_logo.png';
import AuthService from '../../services/authservice';
import { AuthContext } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import supabase from '../../config/supabaseclient';
import { useLanguage } from '../../context/LanguageContext';
import { DASMOM_APP_URL, PASSWORD_RESET_URL } from '../../config/appConfig';

const MotherLogin = () => {
    const navigate = useNavigate();
    const { alert: customAlert } = useModal();
    const { user, setUser, isAuthLoading } = useContext(AuthContext);
    const { t } = useLanguage();
    const authService = new AuthService();

    React.useEffect(() => {
        if (!isAuthLoading && user) {
            navigate(authService.getRedirectRoute(user.role), { replace: true });
        }
    }, [user, isAuthLoading, navigate]);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleForgotPassword = async (event) => {
        event.preventDefault();
        const resetEmail = window.prompt(t('login_reset_prompt'));
        if (!resetEmail?.trim()) return;

        setIsLoading(true);
        try {
            await supabase.functions.invoke('password-reset', {
                body: {
                    email: resetEmail.trim().toLowerCase(),
                    redirectTo: PASSWORD_RESET_URL,
                }
            });
            await customAlert({ title: t('login_reset_title'), text: t('login_reset_text'), iconType: 'success' });
        } catch (error) {
            console.error('Password reset email failed:', error);
            await customAlert({ title: t('login_reset_fail_title'), text: t('login_reset_fail_text'), iconType: 'danger' });
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
            await customAlert({ title: t('login_access_denied_title'), text: t('login_access_denied_text'), iconType: 'danger' });
            return;
        }

        setUser(user);
        const route = authService.getRedirectRoute(user.role);
        navigate(route);

    } catch (err) {
        await customAlert({ title: t('login_error_title'), text: err.message, iconType: 'danger' });
    } finally {
        setIsLoading(false);
    }
};

    const handleGoogleLogin = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            await customAlert({ title: t('login_error_title'), text: 'Enter your registered email before using Google sign-in.', iconType: 'danger' });
            return;
        }

        setIsLoading(true);
        try {
            await authService.signInWithGoogle(normalizedEmail, `${DASMOM_APP_URL}/mother-login`);
        } catch (error) {
            await customAlert({ title: t('login_error_title'), text: error.message || 'Google sign-in failed.', iconType: 'danger' });
            setIsLoading(false);
        }
    };

    const highlights = [
        { icon: Activity, text: t('login_feature1') },
        { icon: Calendar, text: t('login_feature2') },
        { icon: Heart, text: t('login_feature3') },
        { icon: Baby, text: t('login_feature4') }
    ];

    return (
        <div className="ml-container">
            <div className="ml-background"></div>
            
            {/* Back Button */}
            <button className="ml-back-btn" onClick={() => navigate('/landing')}>
                <ArrowLeft size={18} />
                <span>{t('login_back')}</span>
            </button>

            <main className="ml-main">
                <div className="ml-card">
                    {/* Left Panel - Login Form */}
                    <div className="ml-panel-left">
                        <div className="ml-login-header">
                            <div className="ml-logo-wrapper">
                                <img src={logo} alt="DasMom+ Logo" className="ml-logo" />
                            </div>
                            <h1 className="ml-title">{t('login_title')}</h1>
                            <p className="ml-subtitle">{t('login_subtitle')}</p>
                        </div>

                        <form className="ml-form" onSubmit={handleSubmit}>
                            <div className="ml-form-group">
                                <label className="ml-label">{t('login_email_label')}</label>
                                <div className="ml-input-wrapper">
                                    <Mail size={18} className="ml-input-icon" />
                                    <input 
                                        type="email" 
                                        className="ml-input" 
                                        placeholder={t('login_email_placeholder')}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="ml-form-group">
                                <label className="ml-label">{t('login_password_label')}</label>
                                <div className="ml-input-wrapper">
                                    <Lock size={18} className="ml-input-icon" />
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        className="ml-input" 
                                        placeholder={t('login_password_placeholder')}
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
                                        <Loader2 className="ml-spinner" /> {t('login_logging_in')}
                                    </span>
                                ) : (
                                    <span>{t('login_submit')}</span>
                                )}
                            </button>

                            <div className="ml-form-footer">
                                <a href="#forgot-password" className="ml-forgot-link" onClick={handleForgotPassword}>
                                    {t('login_forgot')}
                                </a>
                            </div>
                        </form>
                        <button type="button" className="ml-google-btn" onClick={handleGoogleLogin} disabled={isLoading}>
                            <Chrome size={18} aria-hidden="true" />
                            Sign in with Google
                        </button>
                    </div>

                    {/* Right Panel - Welcome Info */}
                    <div className="ml-panel-right">
                        <div className="ml-welcome-section">
                            <div className="ml-welcome-badge">
                                <Heart size={16} />
                                <span>{t('login_welcome_badge')}</span>
                            </div>
                            <h2 className="ml-welcome-title">{t('login_welcome_title')}</h2>
                            <p className="ml-welcome-text">
                                {t('login_welcome_text')}
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
                                <p className="ml-footer-location">{t('login_footer_location')}</p>
                                <p className="ml-footer-copy">{t('login_footer_copy')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MotherLogin;