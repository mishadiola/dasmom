import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../config/supabaseclient';
import { Eye, EyeOff, Check, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import '../styles/pages/MotherLogin.css';

export default function ResetPassword() {
    const navigate = useNavigate();
    const accountType = new URLSearchParams(window.location.search).get('accountType');
    const loginPath = accountType === 'mother' ? '/mother-login' : '/login';
    
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [isExpired, setIsExpired] = useState(false);

    // Initial session check
    useEffect(() => {
        supabase.auth.getSession().then(({ data, error }) => {
            if (error || !data.session) {
                // If there's no active session, the link is either invalid or expired
                setIsExpired(true);
            }
        });
    }, []);

    // Validation
    const hasMinLength = password.length >= 8;
    const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const isMatch = password && confirmation && password === confirmation;
    const isValid = hasMinLength && hasUpperLower && hasNumber && hasSymbol && isMatch;
    
    const showMatchError = confirmation.length > 0 && !isMatch;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        
        if (!isValid) return;

        setSaving(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setSaving(false);
        
        if (updateError) {
            if (updateError.message.toLowerCase().includes('missing') || 
                updateError.message.toLowerCase().includes('expired') || 
                updateError.status === 401) {
                setIsExpired(true);
            } else {
                setError(updateError.message);
            }
            return;
        }
        
        setSuccess(true);
    };

    const RequirementItem = ({ met, text }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: met ? 'var(--color-green, #2ecc71)' : 'var(--color-text-muted, #736d71)', fontSize: '13px' }}>
            {met ? <Check size={14} /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid currentColor', opacity: 0.5 }} />}
            <span>{text}</span>
        </div>
    );

    const renderCard = (children) => (
        <div className="ml-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
            <div className="ml-background"></div>
            <div style={{ 
                background: '#fff', 
                width: '100%', 
                maxWidth: '480px', 
                borderRadius: '24px', 
                padding: '40px', 
                boxShadow: '0 20px 50px rgba(45, 34, 52, 0.08)',
                border: '1px solid rgba(185, 129, 138, 0.1)',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column'
            }}>
                {children}
            </div>
        </div>
    );

    if (isExpired) {
        return renderCard(
            <div style={{ textAlign: 'center' }}>
                <div style={{ margin: '0 auto 24px', width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle size={32} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)', marginBottom: '12px' }}>Reset link expired</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                    This password reset link is invalid or has expired. Please request a new password reset link.
                </p>
                <button onClick={() => navigate(loginPath)} className="ml-submit-btn" style={{ width: '100%' }}>
                    Request New Reset Link
                </button>
            </div>
        );
    }

    if (success) {
        return renderCard(
            <div style={{ textAlign: 'center' }}>
                <div style={{ margin: '0 auto 24px', width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={32} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)', marginBottom: '12px' }}>✓ Password updated successfully</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                    You can now sign in using your new password.
                </p>
                <button onClick={() => navigate(loginPath)} className="ml-submit-btn" style={{ width: '100%' }}>
                    Back to Login
                </button>
            </div>
        );
    }

    return renderCard(
        <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '24px', letterSpacing: '-0.5px', marginBottom: '24px' }}>
                    DASMOM<span style={{color: 'var(--color-rose, #b9818a)'}}>+</span>
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)', marginBottom: '12px' }}>Set a new password</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', lineHeight: '1.5' }}>
                    Choose a secure password for your DASMOM+ account.
                </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* New Password */}
                <div className="ml-input-group">
                    <label className="ml-label">New Password</label>
                    <div className="ml-input-wrapper" style={{ position: 'relative' }}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="ml-input"
                            style={{ paddingRight: '48px' }}
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={saving}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? "Hide password" : "Show password"}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex'
                            }}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {/* Confirm New Password */}
                <div className="ml-input-group">
                    <label className="ml-label">Confirm New Password</label>
                    <div className="ml-input-wrapper" style={{ position: 'relative' }}>
                        <input
                            type={showConfirmation ? 'text' : 'password'}
                            className="ml-input"
                            style={{ paddingRight: '48px', borderColor: showMatchError ? 'var(--color-rose)' : undefined }}
                            placeholder="Confirm new password"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            disabled={saving}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmation(!showConfirmation)}
                            title={showConfirmation ? "Hide password" : "Show password"}
                            aria-label={showConfirmation ? "Hide password" : "Show password"}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex'
                            }}
                        >
                            {showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {showMatchError && (
                        <p style={{ color: 'var(--color-rose)', fontSize: '13px', marginTop: '6px' }}>Passwords do not match.</p>
                    )}
                </div>

                {/* Requirements */}
                <div style={{ background: '#f8f9fb', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)', margin: '0 0 4px 0' }}>Password requirements</p>
                    <RequirementItem met={hasMinLength} text="At least 8 characters" />
                    <RequirementItem met={hasUpperLower} text="Uppercase and lowercase letter" />
                    <RequirementItem met={hasNumber} text="At least one number" />
                    <RequirementItem met={hasSymbol} text="At least one symbol" />
                </div>

                {error && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '13.5px' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                    <button 
                        type="submit" 
                        className="ml-submit-btn" 
                        disabled={!isValid || saving}
                    >
                        {saving ? 'Updating Password...' : 'Update Password'}
                    </button>
                    
                    <button 
                        type="button" 
                        onClick={() => navigate(loginPath)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            fontWeight: '600',
                            fontSize: '14.5px',
                            cursor: 'pointer',
                            padding: '8px'
                        }}
                    >
                        Back to Login
                    </button>
                </div>
            </form>
        </>
    );
}
