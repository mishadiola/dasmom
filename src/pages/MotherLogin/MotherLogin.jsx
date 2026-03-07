import React, { useState } from 'react';
import { 
    Mail, Lock, Eye, EyeOff, Loader2, 
    Calendar, Activity, Heart, ShieldCheck, 
    Baby, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MotherLogin.css';
import logo from '../../assets/images/dasmom_logo.png';

const MotherLogin = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Dummy auth for testing
        setTimeout(() => {
            setIsLoading(false);
            if (email === 'user@gmail.com' && password === 'user123') {
                navigate('/dashboard/user-home');
            } else {
                alert('Invalid credentials. Use user@gmail.com / user123');
            }
        }, 1200);
    };

    const highlights = [
        { icon: Activity, text: 'Track your pregnancy progress' },
        { icon: Calendar, text: 'View upcoming appointments and vaccination schedule' },
        { icon: Heart, text: 'Learn useful tips for prenatal and postpartum care' },
        { icon: Baby, text: 'Access newborn information after delivery' }
    ];

    return (
        <div className="mother-login-container">
            <main className="mother-login-main">
                <div className="mother-login-card">
                    
                    {/* ── Left Panel (Login Form) ── */}
                    <div className="panel-left">
                        <div className="login-header">
                            <h1>Welcome Back!</h1>
                            <p>Login to access your maternal health account</p>
                        </div>

                        <form className="mother-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Email Address</label>
                                <div className="input-container">
                                    <input 
                                        type="email" 
                                        className="mother-input" 
                                        placeholder="name@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Password</label>
                                <div className="input-container">
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        className="mother-input" 
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button 
                                        type="button" 
                                        className="pwd-toggle"
                                        style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#a89bae' }}
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="mother-btn-primary" disabled={isLoading}>
                                {isLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <Loader2 className="btn-spinner" size={20} aria-hidden="true" /> Logging In...
                                    </div>
                                ) : 'Login'}
                            </button>

                            <a href="#" className="forgot-link" onClick={(e) => e.preventDefault()}>
                                Forgot Password?
                            </a>
                        </form>
                    </div>

                    {/* ── Right Panel (Welcome / Info) ── */}
                    <div className="panel-right">
                        <div className="welcome-content">
                            <h2>Congratulations Mommy!</h2>
                            <p className="welcome-message">
                                With this platform, you can ensure the safety of yourself and your baby in the womb. 
                                You can view your personal information, track your appointments, learn important health tips, and stay updated. 
                                Saludo kami sa’yo!
                            </p>

                            <div className="highlights-list">
                                {highlights.map((item, index) => (
                                    <div className="highlight-item" key={index} style={{ animationDelay: `${index * 0.1}s` }}>
                                        <div className="highlight-icon">
                                            <item.icon size={20} />
                                        </div>
                                        <span className="highlight-text">{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            {/* ── Footer ── */}
            <footer className="mother-footer">
                <div className="footer-content">
                    {/* Assuming logo exists or use text branding */}
                    <span className="footer-text">
                        City Health Office 3, Dasmariñas, Cavite
                    </span>
                    <p style={{ fontSize: '12px', color: '#a89bae', marginTop: '4px' }}>
                        &copy; 2026 DasMom. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default MotherLogin;
