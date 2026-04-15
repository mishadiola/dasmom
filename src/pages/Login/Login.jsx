import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2, Clock, User, X, Mail, Lock, AlertCircle } from 'lucide-react';
import '../../styles/pages/Login.css';
import logo from '../../assets/images/dasmom_logo.png';
import AuthService from '../../services/authservice.js';
import { AuthContext } from '../../context/AuthContext';

const authService = new AuthService();
const MAX_ATTEMPTS = 5;

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

  const emailRef = useRef(null);
  const forgotBtnRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [lastLogin, setLastLogin] = useState({ time: 'Checking...', device: '...' });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dasmom_last_login');
      if (saved) {
        const parsed = JSON.parse(saved);
        const d = new Date(parsed.time);
        setLastLogin({
          time: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          device: parsed.device || 'Unknown device'
        });
      } else {
        setLastLogin({ time: 'First time login', device: 'This device' });
      }
    } catch {
      setLastLogin({ time: 'Unknown', device: 'Unknown' });
    }
  }, []);

  const [errors, setErrors] = useState({ email: '', password: '', form: '', general: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

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
      setUser(user);

      console.log('LOGIN SUCCESS:', user);

      try {
          const getDeviceString = () => {
              const ua = navigator.userAgent;
              let browser = 'Unknown Browser';
              let os = 'Unknown OS';
              if (ua.includes('Firefox')) browser = 'Firefox';
              else if (ua.includes('Edg/')) browser = 'Edge';
              else if (ua.includes('Chrome')) browser = 'Chrome';
              else if (ua.includes('Safari')) browser = 'Safari';

              if (ua.includes('Windows')) os = 'Windows';
              else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'Mac OS';
              else if (ua.includes('Linux')) os = 'Linux';
              else if (ua.includes('Android')) os = 'Android';
              else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

              return `${browser} on ${os}`;
          };

          localStorage.setItem('dasmom_last_login', JSON.stringify({
              time: new Date().toISOString(),
              device: getDeviceString()
          }));
      } 
      catch (storageErr) {
          console.warn('Failed to save last login stat:', storageErr);
      }

      let redirect = '/';
      if (user.role === 'admin') redirect = '/dashboard'; 
      else if (user.role === 'mother') redirect = '/mother-home'; 
      else redirect = '/dashboard'; 

      console.log('Redirecting to:', redirect);
      navigate(redirect);
    } 
    catch (err) {
      console.error(err);
      setErrors(prev => ({ ...prev, general: err.message || 'Login failed' }));
      setAttempts(prev => {
        const next = prev + 1;
        if (next >= MAX_ATTEMPTS) {
          setIsLocked(true);
          setLockTimer(30);
        }
        return next;
      });
    } 
    finally {
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
            <p>testtest</p>
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

                <div className="last-login" aria-label="Last activity"><Clock size={12} aria-hidden="true" /><span>Last login: {lastLogin.time} · {lastLogin.device}</span></div>
                <div className="login-notice" role="note"><p>Authorized personnel only. Access is monitored and recorded for security purposes.</p></div>
                <div className="login-role-switch">
                    <button type="button" className="role-switch-btn" onClick={() => navigate('/mother-login')}><User size={14} />Login as User</button>
                </div>
            </main>

            <footer className="login-footer">
                <p>&copy; 2025 City Health Office 3. All rights reserved.</p>
            </footer>
        </div>
    );
}
