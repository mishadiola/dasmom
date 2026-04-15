import React, { useState, useContext } from 'react';
import { 
    Mail, Lock, Eye, EyeOff, Loader2, 
    Calendar, Activity, Heart, Baby, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MotherLogin.css';
import logo from '../../assets/images/dasmom_logo.png';
import AuthService from '../../services/authservice';
import { AuthContext } from '../../context/AuthContext';

const MotherLogin = () => {
    const navigate = useNavigate();
    const { setUser } = useContext(AuthContext);
    const authService = new AuthService();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

   const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        // Check for mock credentials first (temporary testing)
        if (email === 'mother@gmail.com' && password === 'mother123') {
            const mockUser = {
                id: 'mock-mother-001',
                email: 'mother@gmail.com',
                fullName: 'Test Mother',
                role: 'mother',
                station: 'Station 1',
                barangay_assignment: 'Poblacion'
            };
            setUser(mockUser);
            navigate('/mother-home');
            return;
        }

        // Original backend authentication
        const user = await authService.login(email, password);

        if (!authService.accessCheck(user, 'mother')) {
            alert('You do not have access as a mother.');
            return;
        }

        setUser(user);
        const route = authService.getRedirectRoute(user.role);
        navigate(route);

    } catch (err) {
        alert(err.message);
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
                            <h1 className="ml-title">Mother Login</h1>
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
                                <a href="#" className="ml-forgot-link" onClick={(e) => e.preventDefault()}>
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
    );
};

export default MotherLogin;