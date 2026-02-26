import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import '../../styles/pages/Login.css';
import logo from '../../assets/images/dasmom_logo.png';

const Login = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            alert('Login logic goes here!');
        }, 2000);
    };

    return (
        <div className="login-container">
            <div className="background-motion"></div>

            <div className="login-panel">
                <div className="login-form-side">
                    <div className="login-header">
                        <img src={logo} alt="DasMom Logo" className="login-logo" />
                        <h1>Welcome back</h1>
                        <p>Empowering mothers, enhancing care.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="input-group">
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                            <label htmlFor="username">Username</label>
                        </div>

                        <div className="input-group">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <label htmlFor="password">Password</label>
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        <button
                            type="submit"
                            className={`login-button ${isLoading ? 'loading' : ''}`}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="spinner" /> : 'Login'}
                        </button>
                    </form>

                    <div className="login-footer">
                        <a href="#terms" className="terms-link">Terms & Conditions</a>
                    </div>
                </div>

                <div className="login-image-side">
                    <div className="image-overlay"></div>
                    <img
                        src="https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?q=80&w=1587&auto=format&fit=crop"
                        alt="Mother and Nurse"
                        className="hero-image"
                    />
                </div>
            </div>
        </div>
    );
};

export default Login;
