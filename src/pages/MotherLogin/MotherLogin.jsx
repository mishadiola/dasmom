import React, { useState, useContext } from 'react';
import { 
    Mail, Lock, Eye, EyeOff, Loader2, 
    Calendar, Activity, Heart, Baby 
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
            // Create mock user object for testing
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