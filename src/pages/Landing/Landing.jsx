import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Baby, Heart, Calendar, Activity, Shield, Smartphone,
    CheckCircle, ArrowRight, Flower, Sparkles, Users,
    Bell, Lock, ChevronRight
} from 'lucide-react';
import '../../styles/pages/Landing.css';

const Landing = () => {
    const navigate = useNavigate();

    const handleLogin = () => {
        navigate('/mother-login');
    };

    const features = [
        {
            icon: Baby,
            title: 'Pregnancy Monitoring',
            description: 'Track weekly pregnancy progress, trimester status, and due date updates.'
        },
        {
            icon: Calendar,
            title: 'Prenatal Scheduling',
            description: 'View upcoming appointments and prenatal checkups in a structured calendar.'
        },
        {
            icon: Activity,
            title: 'Vital Records Tracking',
            description: 'Monitor blood pressure, weight, and other maternal health indicators.'
        },
        {
            icon: Shield,
            title: 'Vaccination & Supplements',
            description: 'Track administered vaccines and supplements for complete maternal care.'
        },
        {
            icon: Bell,
            title: 'Health Monitoring Support',
            description: 'Helps healthcare staff monitor high-risk pregnancy cases effectively.'
        },
        {
            icon: Users,
            title: 'Health Worker Connection',
            description: 'Stay connected with midwives and healthcare providers.'
        }
    ];

    const steps = [
        {
            number: '1',
            title: 'Login as Mother',
            description: 'Securely access your maternal account.'
        },
        {
            number: '2',
            title: 'View Dashboard',
            description: 'See pregnancy progress, appointments, and health updates.'
        },
        {
            number: '3',
            title: 'Stay Updated',
            description: 'Get real-time monitoring of schedules and records.'
        },
        {
            number: '4',
            title: 'Receive Care Support',
            description: 'Stay connected with health workers and clinic updates.'
        }
    ];

    const benefits = [
        'Easy and user-friendly maternal health system',
        'Centralized pregnancy tracking',
        'Real-time appointment monitoring',
        'Better communication between mothers and health workers',
        'Designed for clarity, safety, and accessibility'
    ];

    return (
        <div className="landing-page">
            {/* NAVBAR */}
            <nav className="landing-navbar">
                <div className="navbar-container">
                    <div className="navbar-brand">
                        <h1 className="navbar-logo">DASMOM<span className="plus-sign">+</span></h1>
                    </div>
                    <div className="navbar-menu">
                        <a href="#" className="navbar-link navbar-link--active">Home</a>
                        <button className="btn btn-primary" onClick={handleLogin}>
                            Login as Mother
                        </button>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <section className="hero-section">
                <div className="hero-container">
                    <div className="hero-content">
                        <div className="hero-badge">
                            <Sparkles size={16} />
                            <span>Maternal Health Support System</span>
                        </div>
                        <h1 className="hero-title">
                            DASMOM<span className="plus-sign">+</span>
                        </h1>
                        <p className="hero-tagline">
                            👉 "Congratulations, Nanay! Saudo kami sayo!"
                        </p>
                        <p className="hero-description">
                            DASMOM+ is a smart maternal health monitoring system that helps expecting mothers track their pregnancy progress, manage prenatal visits, and access important health records in one safe and centralized platform.
                        </p>
                        <div className="hero-actions">
                            <button className="btn btn-primary btn-lg" onClick={handleLogin}>
                                <Baby size={18} />
                                Login as Mother
                            </button>
                        </div>
                    </div>
                    <div className="hero-visual">
                        <div className="hero-card">
                            <div className="hero-icon-wrapper">
                                <Baby size={100} className="hero-main-icon" />
                                <Heart size={35} className="hero-heart hero-heart-1" />
                                <Heart size={28} className="hero-heart hero-heart-2" />
                                <Heart size={22} className="hero-heart hero-heart-3" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ABOUT SECTION */}
            <section className="about-section">
                <div className="section-container">
                    <div className="about-card">
                        <div className="section-header">
                            <Flower size={24} className="section-icon" />
                            <h2 className="section-title">About DASMOM+</h2>
                        </div>
                        <p className="about-text">
                            DASMOM+ is a maternal healthcare system designed to support both mothers and healthcare providers. It provides real-time pregnancy monitoring, appointment tracking, and health record management in one unified platform.
                        </p>
                        <p className="about-text">
                            The system ensures better communication, safer pregnancy monitoring, and easier access to maternal health information.
                        </p>
                    </div>
                </div>
            </section>

            {/* FEATURES SECTION */}
            <section className="features-section">
                <div className="section-container">
                    <div className="section-header section-header--center">
                        <Sparkles size={24} className="section-icon" />
                        <h2 className="section-title">Features</h2>
                        <p className="section-subtitle">Comprehensive maternal health tools at your fingertips</p>
                    </div>
                    <div className="features-grid">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div key={index} className="feature-card">
                                    <div className="feature-icon-wrapper">
                                        <Icon size={28} />
                                    </div>
                                    <h3 className="feature-title">{feature.title}</h3>
                                    <p className="feature-description">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section className="how-it-works-section">
                <div className="section-container">
                    <div className="section-header section-header--center">
                        <Smartphone size={24} className="section-icon" />
                        <h2 className="section-title">How It Works</h2>
                        <p className="section-subtitle">Simple steps to access your maternal health dashboard</p>
                    </div>
                    <div className="steps-container">
                        {steps.map((step, index) => (
                            <React.Fragment key={index}>
                                <div className="step-card">
                                    <div className="step-number">{step.number}</div>
                                    <div className="step-content">
                                        <h3 className="step-title">{step.title}</h3>
                                        <p className="step-description">{step.description}</p>
                                    </div>
                                </div>
                                {index < steps.length - 1 && (
                                    <ChevronRight size={20} className="step-connector" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </section>

            {/* WHY DASMOM+ SECTION */}
            <section className="why-section">
                <div className="section-container">
                    <div className="why-card">
                        <div className="why-visual">
                            <div className="why-circle">
                                <CheckCircle size={60} />
                            </div>
                        </div>
                        <div className="why-text">
                            <div className="section-header">
                                <Heart size={24} className="section-icon" />
                                <h2 className="section-title">Why DASMOM+?</h2>
                            </div>
                            <ul className="benefits-list">
                                {benefits.map((benefit, index) => (
                                    <li key={index} className="benefit-item">
                                        <CheckCircle size={16} className="benefit-icon" />
                                        <span>{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* LOGIN CTA SECTION */}
            <section className="login-section">
                <div className="section-container">
                    <div className="login-card">
                        <div className="login-header">
                            <Lock size={32} className="login-icon" />
                            <h2 className="login-title">Mother Portal Access</h2>
                        </div>
                        <p className="login-description">
                            Already registered? Sign in to access your personalized maternal dashboard.
                        </p>
                        <button className="btn btn-primary btn-xl" onClick={handleLogin}>
                            👉 Login as Mother
                        </button>
                        <p className="login-note">
                            Secure access to personal maternal health records and pregnancy tracking system.
                        </p>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="landing-footer">
                <div className="footer-container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <h3 className="footer-title">DASMOM+</h3>
                            <p className="footer-tagline">Maternal Health Support System</p>
                        </div>
                        <div className="footer-info">
                            <p className="footer-text">
                                A comprehensive maternal healthcare platform designed to support expecting mothers and healthcare providers.
                            </p>
                            <p className="footer-contact">
                                📍 Clinic/Health Center Information
                            </p>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p className="footer-copyright">
                            © {new Date().getFullYear()} DASMOM+. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
