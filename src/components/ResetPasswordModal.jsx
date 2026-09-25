import React, { useState, useEffect } from 'react';
import { Mail, X } from 'lucide-react';
import supabase from '../config/supabaseclient';
import { PASSWORD_RESET_URL } from '../config/appConfig';

const ResetPasswordModal = ({ isOpen, onClose, initialEmail = '' }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setEmail(initialEmail);
            setError('');
            setSuccess(false);
            setIsLoading(false);
        }
    }, [isOpen, initialEmail]);

    if (!isOpen) return null;

    const handleSendResetLink = async () => {
        setError('');
        const trimmedEmail = email.trim().toLowerCase();
        
        if (!trimmedEmail) {
            setError('Please enter your email address.');
            return;
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsLoading(true);
        try {
            const { error: resetError } = await supabase.functions.invoke('password-reset', {
                body: {
                    email: trimmedEmail,
                    redirectTo: PASSWORD_RESET_URL,
                }
            });
            
            if (resetError) throw resetError;

            setSuccess(true);
        } catch (err) {
            console.error('Password reset email failed:', err);
            setError('Failed to send reset link. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="system-modal-overlay" onClick={() => !isLoading && onClose()}>
            <div className="system-modal-card" onClick={e => e.stopPropagation()} style={{ textAlign: 'left', padding: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>
                        {success ? 'Check your email ✓' : 'Reset your password'}
                    </h2>
                    <button 
                        onClick={() => !isLoading && onClose()}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {success ? (
                    <>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '14.5px', lineHeight: '1.5', marginBottom: '24px' }}>
                            If an account is associated with this email address, we've sent password reset instructions.
                        </p>
                        <button 
                            className="ml-submit-btn" 
                            onClick={onClose}
                            style={{ width: '100%', margin: 0 }}
                        >
                            Back to Login
                        </button>
                    </>
                ) : (
                    <>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '14.5px', lineHeight: '1.5', marginBottom: '20px' }}>
                            Enter the email address registered with your DASMOM+ account. We'll send you a password reset link.
                        </p>
                        
                        <div className="ml-input-group" style={{ marginBottom: error ? '8px' : '24px' }}>
                            <label className="ml-label">Email Address</label>
                            <div className="ml-input-wrapper">
                                <Mail className="ml-input-icon" size={18} />
                                <input
                                    type="email"
                                    className="ml-input"
                                    placeholder="Enter your email address"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError('');
                                    }}
                                    disabled={isLoading}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendResetLink()}
                                />
                            </div>
                        </div>
                        
                        {error && (
                            <p style={{ color: 'var(--color-rose)', fontSize: '13px', marginBottom: '20px', marginTop: 0 }}>
                                {error}
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button 
                                className="system-btn-cancel" 
                                onClick={onClose}
                                disabled={isLoading}
                                style={{ flex: 1, padding: '12px', margin: 0 }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="ml-submit-btn" 
                                onClick={handleSendResetLink}
                                disabled={isLoading}
                                style={{ flex: 1, margin: 0, height: 'auto', padding: '12px' }}
                            >
                                {isLoading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ResetPasswordModal;
