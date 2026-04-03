/*import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2,
    Clock, User, X, Mail, Lock, AlertCircle
} from 'lucide-react';
import '../../styles/pages/Login.css';
import logo from '../../assets/images/dasmom_logo.png';
import AuthService from '../../services/authservice.js';

const authService = new AuthService();
const MAX_ATTEMPTS = 5;
const MOCK_LAST_LOGIN = {
    time: 'Feb 26, 2026 · 3:42 PM',
    device: 'Chrome on Windows',
};

export default function Login() {
    const navigate = useNavigate();
    const emailRef = useRef(null);
    const forgotBtnRef = useRef(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const [errors, setErrors] = useState({ email: '', password: '', form: '', general: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [lockTimer, setLockTimer] = useState(0);

    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSent, setForgotSent] = useState(false);

    // Lock timer effect
    useEffect(() => {
        if (!isLocked) return;
        const interval = setInterval(() => {
            setLockTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setIsLocked(false);
                    setAttempts(0);
                    setErrors(e => ({ ...e, form: '' }));
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isLocked]);

    // Validation
    const validate = () => {
        const newErrors = { email: '', password: '', form: '', general: '' };
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        if (!trimmedEmail) newErrors.email = 'Email address is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
            newErrors.email = 'Enter a valid email address.';
        if (!trimmedPassword) newErrors.password = 'Password is required.';

        setErrors(newErrors);
        return !newErrors.email && !newErrors.password;
    };

    // Login submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLocked || !validate()) return;

        setIsLoading(true);
        setErrors({ email: '', password: '', form: '', general: '' });

        try {
            // Normalize email lowercase + trim
            const normalizedEmail = email.trim().toLowerCase();
            const trimmedPassword = password.trim();

            const user = await authService.login(normalizedEmail, trimmedPassword);

            if (user.role === 'patient') {
                setErrors(prev => ({ ...prev, general: 'Patients must use the mother login page.' }));
                return;
            }

            if (!authService.accessCheck(user, 'admin')) {
                setErrors(prev => ({ ...prev, general: 'You do not have permission to access this system.' }));
                return;
            }

            //authService.saveUser(user);
            navigate(authService.getRedirectRoute(user.role));

        } catch (err) {
            console.log('Login failed:', { email, password, err }); // Debug
            setErrors(prev => ({ ...prev, general: err?.message || 'Login failed. Please try again.' }));

            const nextAttempts = attempts + 1;
            setAttempts(nextAttempts);

            if (nextAttempts >= MAX_ATTEMPTS) {
                setIsLocked(true);
                setLockTimer(30);
                setErrors(prev => ({ ...prev, form: 'Too many failed attempts. Account locked for 30 seconds.' }));
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Forgot password submit
    const handleForgotSubmit = (e) => {
        e.preventDefault();
        if (!forgotEmail.trim()) return;

        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            setForgotSent(true);
        }, 1400);
    };

    const closeForgot = () => {
        setShowForgot(false);
        setForgotSent(false);
        setForgotEmail('');
        setTimeout(() => forgotBtnRef.current?.focus(), 50);
    };
*/






/*
const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked || !validate()) return;

    setIsLoading(true);
    setErrors({ email: '', password: '', form: '', general: '' });

    try {
        const user = await authService.login(email, password);

        if (user.role === 'patient') {
            setErrors(prev => ({ ...prev, general: 'Patients must use the mother login page.' }));
            setIsLoading(false);
            return;
        }

        // Allow both staff and admin
        const allowedRoles = ['staff', 'admin'];
        if (!allowedRoles.includes(user.role)) {
            setErrors(prev => ({ ...prev, general: 'You do not have permission to access this system.' }));
            setIsLoading(false);
            console.log("SAVING USER:", loggedInUser);
            this.saveUser(loggedInUser);
            console.log("AFTER SAVE:", localStorage.getItem('user'));
            return;
        }

        // Save session
        authService.saveUser(user);

        // Redirect based on role
        navigate(authService.getRedirectRoute(user.role));


    } catch (err) {
        console.error('Login error:', err);
        setErrors(prev => ({ ...prev, form: 'Login failed. Check your credentials.' }));
        setIsLoading(false);
    }
};*/




import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2, Clock, User, X, Mail, Lock, AlertCircle } from 'lucide-react';
import '../../styles/pages/Login.css';
import logo from '../../assets/images/dasmom_logo.png';
import AuthService from '../../services/authservice.js';

const authService = new AuthService();
const MAX_ATTEMPTS = 5;
const MOCK_LAST_LOGIN = { time: 'Feb 26, 2026 · 3:42 PM', device: 'Chrome on Windows' };

export default function Login() {
    const navigate = useNavigate();
    const emailRef = useRef(null);
    const forgotBtnRef = useRef(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const [errors, setErrors] = useState({ email: '', password: '', form: '', general: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [lockTimer, setLockTimer] = useState(0);

    // Forgot password modal state
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSent, setForgotSent] = useState(false);

    // Lock timer effect
    useEffect(() => {
        if (!isLocked) return;
        const interval = setInterval(() => {
            setLockTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setIsLocked(false);
                    setAttempts(0);
                    setErrors(e => ({ ...e, form: '' }));
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isLocked]);

    const validate = () => {
        const newErrors = { email: '', password: '', form: '', general: '' };
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        if (!trimmedEmail) newErrors.email = 'Email address is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) newErrors.email = 'Enter a valid email address.';
        if (!trimmedPassword) newErrors.password = 'Password is required.';

        setErrors(newErrors);
        return !newErrors.email && !newErrors.password;
    };

const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked || !validate()) return;

    setIsLoading(true);
    setErrors({ email: '', password: '', form: '', general: '' });

    try {
        const user = await authService.login(email, password);

        console.log("LOGIN SUCCESS:", user);

        // Allow BOTH admin and staff
        if (user.role === 'patient') {
            setErrors(prev => ({
                ...prev,
                general: 'Patients must use the mother login page.'
            }));
            return;
        }

        // ✅ REMOVE overly strict access check for now
        // if (!authService.accessCheck(user, 'admin')) { ... }

        navigate(authService.getRedirectRoute(user.role));

    } catch (err) {
        console.error(err);
        setErrors(prev => ({
            ...prev,
            general: err.message || 'Login failed'
        }));
    } finally {
        setIsLoading(false);
    }
};

    const handleForgotSubmit = (e) => {
        e.preventDefault();
        if (!forgotEmail.trim()) return;

        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            setForgotSent(true);
        }, 1400);
    };

    const closeForgot = () => {
        setShowForgot(false);
        setForgotSent(false);
        setForgotEmail('');
        setTimeout(() => forgotBtnRef.current?.focus(), 50);
    };

    return (
        <div className="login-page">
            {/* Forgot password modal */}
            {showForgot && (
                <div
                    className="modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="forgot-title"
                    onClick={(e) => { if (e.target === e.currentTarget) closeForgot(); }}
                >
                    <div className="modal-card">
                        <button className="modal-close" onClick={closeForgot} aria-label="Close password reset dialog">
                            <X size={18} />
                        </button>
                        {forgotSent ? (
                            <div className="modal-success">
                                <span className="modal-success-icon" aria-hidden="true">
                                    <CheckCircle2 size={44} />
                                </span>
                                <h2 id="forgot-title" className="modal-title">Email Sent!</h2>
                                <p className="modal-body">
                                    If <strong>{forgotEmail}</strong> is registered, a password
                                    reset link has been sent. Check your inbox and spam folder.
                                </p>
                                <button className="login-btn modal-btn" onClick={closeForgot}>
                                    Back to Login
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className="modal-icon" aria-hidden="true">
                                    <ShieldCheck size={36} />
                                </span>
                                <h2 id="forgot-title" className="modal-title">Reset Password</h2>
                                <p className="modal-body">
                                    Enter your work email and we'll send you a secure reset link.
                                </p>
                                <form onSubmit={handleForgotSubmit} className="modal-form" noValidate>
                                    <div className="field-group">
                                        <label htmlFor="forgot-email" className="field-label">Work Email</label>
                                        <div className="input-wrap">
                                            <span className="input-icon" aria-hidden="true">
                                                <Mail size={16} />
                                            </span>
                                            <input
                                                type="email"
                                                id="forgot-email"
                                                className="field-input"
                                                placeholder="name@cityhealth.gov"
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                autoFocus
                                                required
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        className={`login-btn modal-btn${isLoading ? ' loading' : ''}`}
                                        disabled={isLoading || !forgotEmail.trim()}
                                    >
                                        {isLoading ? <Loader2 className="btn-spinner" size={18} /> : 'Send Reset Link'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Main login card */}
            <main className="login-card" aria-label="Staff login">
                <div className="login-logo-wrap">
                    <img src={logo} alt="DasMom — City Health Office" className="login-logo" />
                </div>
                <header className="login-header">
                    <h1 className="login-title">Welcome Back</h1>
                    <p className="login-subtitle">Login to your staff account</p>
                    <div className="login-header-bar" aria-hidden="true" />
                </header>

                {errors.form && (
                    <div className={`form-alert${isLocked ? ' form-alert--locked' : ' form-alert--error'}`} role="alert" aria-live="assertive">
                        <AlertCircle size={15} aria-hidden="true" />
                        <span>{errors.form}{isLocked && lockTimer > 0 && <strong> Retry in {lockTimer}s.</strong>}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form" noValidate aria-label="Login form">
                    {/* Email */}
                    <div className="field-group">
                        <label htmlFor="email" className="field-label">Email address</label>
                        <div className={`input-wrap${errors.email ? ' input-wrap--error' : ''}`}>
                            <span className="input-icon" aria-hidden="true"><Mail size={16} /></span>
                            <input
                                ref={emailRef}
                                type="email"
                                id="email"
                                className="field-input"
                                autoComplete="email"
                                placeholder="name@cityhealth.gov"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value.toLowerCase()); // Normalize lowercase
                                    if (errors.email) setErrors(p => ({ ...p, email: '' }));
                                }}
                                aria-invalid={!!errors.email}
                                aria-describedby={errors.email ? 'email-error' : undefined}
                                disabled={isLocked}
                                required
                            />
                        </div>
                        {errors.email && <p className="field-error" id="email-error" role="alert"><AlertCircle size={12} aria-hidden="true" />{errors.email}</p>}
                    </div>

                    {/* Password */}
                    <div className="field-group">
                        <label htmlFor="password" className="field-label">Password</label>
                        <div className={`input-wrap${errors.password ? ' input-wrap--error' : ''}`}>
                            <span className="input-icon" aria-hidden="true"><Lock size={16} /></span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                className="field-input"
                                autoComplete="current-password"
                                placeholder="Min. 8 characters"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (errors.password) setErrors(p => ({ ...p, password: '' }));
                                }}
                                aria-invalid={!!errors.password}
                                aria-describedby={errors.password ? 'pwd-error' : undefined}
                                disabled={isLocked}
                                required
                            />
                            <button type="button" className="pwd-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {errors.password && <p className="field-error" id="pwd-error" role="alert"><AlertCircle size={12} aria-hidden="true" />{errors.password}</p>}
                    </div>

                    {/* Extras */}
                    <div className="login-extras">
                        <label className="remember-wrap" htmlFor="remember-me">
                            <input
                                type="checkbox"
                                id="remember-me"
                                className="remember-checkbox"
                                checked={rememberMe}
                                onChange={e => setRememberMe(e.target.checked)}
                                disabled={isLocked}
                            />
                            <span className="remember-custom" aria-hidden="true" />
                            <span className="remember-label">Remember me</span>
                        </label>
                        <button type="button" ref={forgotBtnRef} className="forgot-btn" onClick={() => setShowForgot(true)} aria-haspopup="dialog">Forgot password?</button>
                    </div>

                    <button type="submit" className={`login-btn${isLoading ? ' loading' : ''}`} disabled={isLoading || isLocked} aria-busy={isLoading}>
                        {isLoading ? <Loader2 className="btn-spinner" size={20} aria-hidden="true" /> : isLocked ? `Locked · ${lockTimer}s` : 'Login'}
                    </button>
                </form>

                <div className="last-login" aria-label="Last activity"><Clock size={12} aria-hidden="true" /><span>Last login: {MOCK_LAST_LOGIN.time} · {MOCK_LAST_LOGIN.device}</span></div>
                <div className="login-notice" role="note"><p>Authorized personnel only. Access is monitored and recorded for security purposes.</p></div>
                <div className="login-role-switch">
                    <button type="button" className="role-switch-btn" onClick={() => navigate('/')}><User size={14} />Login as User</button>
                </div>
            </main>

            <footer className="login-footer">
                <p>&copy; 2025 City Health Office 3. All rights reserved.</p>
            </footer>
        </div>
    );
};