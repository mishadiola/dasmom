import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Lock, CheckCircle2, ArrowRight, Menu, X,
    Activity, Calendar, Heart, Baby, Users, Bell,
    Syringe, AlertTriangle, HeartPulse, FileText,
    ShieldCheck, BarChart3, Building2, Globe2, Star,
    MapPin, TrendingUp, UserCheck, ClipboardList, Stethoscope
} from 'lucide-react';
import '../../styles/pages/Landing.css';

const Landing = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMobileMenuOpen(false);
    };

    const handleLogin = () => navigate('/mother-login');

    const navLinks = [
        { id: 'home',        label: 'Home' },
        { id: 'who',         label: 'Who Can Use' },
        { id: 'services',    label: 'Services' },
        { id: 'journey',     label: 'Maternal Journey' },
        { id: 'impact',      label: 'Our Impact' },
        { id: 'benefits',    label: 'Benefits' },
    ];

    const healthServices = [
        {
            icon: HeartPulse,
            title: 'Prenatal Care Monitoring',
            description: 'Track pregnancy progress, trimester milestones, and important health updates throughout your pregnancy journey.',
            benefit: 'Never miss important checkups or pregnancy milestones.',
            color: 'mauve'
        },
        {
            icon: Calendar,
            title: 'Appointment Scheduling',
            description: 'Manage prenatal appointments, schedule follow-up visits, and stay connected with your healthcare provider.',
            benefit: 'Always know when your next checkup is.',
            color: 'sage'
        },
        {
            icon: Syringe,
            title: 'Vaccination Tracking',
            description: 'Complete immunization records for mothers and newborns — from tetanus shots to full infant vaccination timelines.',
            benefit: 'Keep your baby and yourself fully protected.',
            color: 'amber'
        },
        {
            icon: AlertTriangle,
            title: 'Maternal Risk Monitoring',
            description: 'Automatic identification of high-risk pregnancies with early alerts so healthcare workers can act quickly.',
            benefit: 'Early detection leads to better outcomes for you and your baby.',
            color: 'rose'
        },
        {
            icon: Activity,
            title: 'Postpartum Follow-Up',
            description: 'Postpartum care tracking, recovery support, and mother-baby wellness monitoring during the critical first weeks.',
            benefit: 'Support and guidance even after your baby is born.',
            color: 'sage'
        },
        {
            icon: Users,
            title: 'Healthcare Coordination',
            description: 'Unified platform connecting midwives, Barangay Health Workers, and the City Health Office for seamless care.',
            benefit: 'Your healthcare team stays connected and informed.',
            color: 'mauve'
        }
    ];

    const careJourneySteps = [
        { icon: '🤱', step: '01', title: 'Pregnancy Registration', desc: 'Register with your Barangay Health Station. A midwife records your health history and pregnancy details.' },
        { icon: '🩺', step: '02', title: 'Prenatal Monitoring', desc: 'Regular checkups are tracked digitally. Your health records are always up to date and accessible.' },
        { icon: '💉', step: '03', title: 'Vaccination Tracking', desc: 'Tetanus, micronutrients, and all prenatal vaccines are recorded and monitored for your protection.' },
        { icon: '🏥', step: '04', title: 'Delivery Care', desc: 'Delivery details, outcomes, and newborn information are safely logged in your maternal record.' },
        { icon: '🌸', step: '05', title: 'Postpartum Recovery', desc: 'Follow-up care for the 6-week postpartum period is tracked to support your recovery.' },
        { icon: '👶', step: '06', title: 'Newborn Monitoring', desc: 'Your newborn\'s immunization schedule, checkups, and growth milestones are tracked and managed.' }
    ];

    const whoUsers = [
        {
            emoji: '🤰',
            title: 'Pregnant Mothers',
            desc: 'Track your prenatal appointments, vaccines, and pregnancy progress in one safe place.',
            tag: 'Patient Access',
            color: 'mauve'
        },
        {
            emoji: '🩺',
            title: 'Midwives',
            desc: 'Monitor your patients, record prenatal visits, and coordinate maternal care efficiently.',
            tag: 'Healthcare Provider',
            color: 'sage'
        },
        {
            emoji: '👥',
            title: 'Barangay Health Workers',
            desc: 'Coordinate patient follow-ups, community outreach, and maternal health support in your area.',
            tag: 'Community Health',
            color: 'amber'
        },
        {
            emoji: '🏥',
            title: 'Health Centers',
            desc: 'Manage maternal health records, monitor outcomes, and generate reports for the City Health Office.',
            tag: 'Administration',
            color: 'lavender'
        }
    ];

    const impactStats = [
        { icon: '🤱', val: '501+', lbl: 'Mothers Supported', color: 'mauve' },
        { icon: '👶', val: '152',  lbl: 'Healthy Deliveries Recorded', color: 'rose' },
        { icon: '💉', val: '850+', lbl: 'Vaccinations Tracked', color: 'sage' },
        { icon: '🏥', val: '7',    lbl: 'Connected Health Stations', color: 'amber' },
        { icon: '📋', val: '84%',  lbl: 'Postpartum Follow-Up Rate', color: 'lavender' }
    ];

    const testimonialCards = [
        {
            emoji: '🤰',
            role: 'For Mothers',
            sub: 'Pregnant & Postpartum',
            type: 'mother',
            quote: '"DASMOM+ makes it easy to stay on top of my prenatal checkups. My midwife can see all my records and I always know when my next appointment is."',
            benefits: [
                'View your prenatal schedule anytime',
                'Track your vaccination records',
                'Stay connected with your midwife'
            ]
        },
        {
            emoji: '🩺',
            role: 'For Midwives',
            sub: 'Healthcare Professionals',
            type: 'midwife',
            quote: '"Managing records for hundreds of patients used to take so much time. Now everything is in one place and I can quickly see who needs follow-up care."',
            benefits: [
                'Access all patient records instantly',
                'Get alerts for high-risk patients',
                'Streamline appointment management'
            ]
        },
        {
            emoji: '👥',
            role: 'For Health Workers',
            sub: 'Barangay Health Workers & Staff',
            type: 'worker',
            quote: '"Coordinating with the health center is now so much easier. We can share updates, track community health, and make sure no mother is missed."',
            benefits: [
                'Coordinate community health visits',
                'Track vaccination coverage rates',
                'Support seamless care transitions'
            ]
        }
    ];

    const whyBenefits = [
        { title: 'Centralized Health Records',       cap: 'Consolidates scattered manual logbooks into a single, secure electronic maternal registry accessible across barangay health stations.' },
        { title: 'Appointment Management',            cap: 'Tracks scheduled visits, updates records automatically, and flags patients missing their critical checkups.' },
        { title: 'Vaccination Monitoring',            cap: 'Records immunization logs for both expectant mothers and infants, verifying local program compliance.' },
        { title: 'Early Risk Identification',         cap: 'Evaluates clinical indicators such as hypertension, advanced maternal age, and teenage pregnancy to flag high-risk cases instantly.' },
        { title: 'Health Station Coordination',       cap: 'Bridges Barangay Health Stations, Rural Health Units, and the central City Health Office for seamless care delivery.' },
        { title: 'Analytics & Reporting',             cap: 'Provides real-time maternal health statistics, program coverage rates, and station performance to healthcare executives.' },
        { title: 'Data Security & Confidentiality',   cap: 'Restricts access to certified healthcare practitioners, protecting patient privacy under official health record frameworks.' }
    ];

    return (
        <div className="ldg-page">

            {/* ══════════════ NAVBAR ══════════════ */}
            <nav className={`ldg-nav${scrolled ? ' ldg-nav--scrolled' : ''}`} role="navigation" aria-label="Main navigation">
                <div className="ldg-nav__container">
                    <div className="ldg-nav__brand">
                        <div className="ldg-nav__logo-mark">
                            <HeartPulse size={18} />
                        </div>
                        <span className="ldg-nav__logo-text">
                            DASMOM<span className="ldg-nav__plus">+</span>
                        </span>
                        <span className="ldg-nav__tagline">Maternal Health Platform</span>
                    </div>

                    <div className={`ldg-nav__links${mobileMenuOpen ? ' ldg-nav__links--open' : ''}`}>
                        {navLinks.map(link => (
                            <button
                                key={link.id}
                                className="ldg-nav__link"
                                onClick={() => scrollToSection(link.id)}
                            >
                                {link.label}
                            </button>
                        ))}
                    </div>

                    <div className="ldg-nav__actions">
                        <button className="ldg-nav__login-btn" onClick={handleLogin} id="nav-login-btn">
                            <Lock size={13} />
                            Sign In
                        </button>
                        <button
                            className="ldg-nav__mobile-toggle"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle navigation menu"
                            id="mobile-menu-toggle"
                        >
                            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* ══════════════ HERO SECTION ══════════════ */}
            <section id="home" className="ldg-hero" aria-label="DASMOM+ maternal healthcare platform">
                <div className="ldg-hero__blob1" aria-hidden="true"></div>
                <div className="ldg-hero__blob2" aria-hidden="true"></div>
                <div className="ldg-hero__blob3" aria-hidden="true"></div>
                <div className="ldg-hero__pattern" aria-hidden="true"></div>

                <div className="ldg-hero__container">
                    {/* Left: Content */}
                    <div className="ldg-hero__content">
                        <div className="ldg-hero__gov-badge">
                            <ShieldCheck size={13} />
                            <span>City Health Office · Dasmariñas City</span>
                        </div>

                        <h1 className="ldg-hero__title">
                            DASMOM<span className="ldg-hero__plus">+</span>
                        </h1>

                        <p className="ldg-hero__subtitle">
                            Supporting Mothers Through Every Stage of Pregnancy
                        </p>

                        <p className="ldg-hero__desc">
                            A maternal healthcare platform that helps mothers stay connected with healthcare workers, monitor pregnancy progress, track appointments, receive vaccinations, and access postpartum support.
                        </p>

                        <ul className="ldg-hero__trust-list" aria-label="Key platform benefits">
                            {[
                                'Easy to Use',
                                'Connected Health Stations',
                                'Secure Maternal Records',
                                'Healthcare Worker Support',
                            ].map((item, i) => (
                                <li key={i} className="ldg-hero__trust-item">
                                    <span className="ldg-hero__trust-check">✓</span>
                                    {item}
                                </li>
                            ))}
                        </ul>

                        <div className="ldg-hero__cta-group">
                            <button
                                className="ldg-btn ldg-btn--white ldg-btn--lg"
                                onClick={handleLogin}
                                id="hero-login-btn"
                            >
                                <Heart size={16} />
                                Get Started
                            </button>
                            <button
                                className="ldg-btn ldg-btn--ghost ldg-btn--lg"
                                onClick={() => scrollToSection('who')}
                                id="hero-learn-btn"
                            >
                                Learn More
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Right: Illustration + Stats */}
                    <div className="ldg-hero__visual">
                        <div className="ldg-hero__illus-wrap">
                            <div className="ldg-hero__illus-card">
                                {/* Healthcare SVG Illustration */}
                                <svg
                                    className="ldg-hero__illus-svg"
                                    viewBox="0 0 320 220"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-label="Maternal healthcare illustration"
                                    role="img"
                                >
                                    {/* Background shapes */}
                                    <ellipse cx="160" cy="200" rx="100" ry="18" fill="rgba(255,255,255,0.08)" />

                                    {/* Pregnant Mother */}
                                    {/* Body */}
                                    <ellipse cx="120" cy="145" rx="36" ry="48" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
                                    {/* Baby bump */}
                                    <ellipse cx="130" cy="160" rx="22" ry="20" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
                                    {/* Head */}
                                    <circle cx="120" cy="90" r="22" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.45)" strokeWidth="2"/>
                                    {/* Hair */}
                                    <path d="M 100 78 Q 120 65 140 78 Q 138 70 120 66 Q 102 70 100 78" fill="rgba(255,255,255,0.35)"/>
                                    {/* Face - smile */}
                                    <path d="M 112 96 Q 120 103 128 96" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" fill="none"/>
                                    {/* Eyes */}
                                    <circle cx="113" cy="90" r="2.5" fill="rgba(255,255,255,0.8)"/>
                                    <circle cx="127" cy="90" r="2.5" fill="rgba(255,255,255,0.8)"/>
                                    {/* Arms */}
                                    <path d="M 85 135 Q 75 150 80 165" stroke="rgba(255,255,255,0.35)" strokeWidth="10" strokeLinecap="round"/>
                                    <path d="M 155 135 Q 165 150 160 170" stroke="rgba(255,255,255,0.35)" strokeWidth="10" strokeLinecap="round"/>
                                    {/* Legs */}
                                    <path d="M 105 190 L 100 215" stroke="rgba(255,255,255,0.3)" strokeWidth="10" strokeLinecap="round"/>
                                    <path d="M 132 192 L 138 217" stroke="rgba(255,255,255,0.3)" strokeWidth="10" strokeLinecap="round"/>

                                    {/* Healthcare Worker */}
                                    {/* Lab coat / body */}
                                    <rect x="195" y="120" width="60" height="70" rx="12" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                                    {/* Cross on coat */}
                                    <rect x="221" y="128" width="8" height="20" rx="2" fill="rgba(255,255,255,0.5)"/>
                                    <rect x="215" y="134" width="20" height="8" rx="2" fill="rgba(255,255,255,0.5)"/>
                                    {/* Head */}
                                    <circle cx="225" cy="96" r="20" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth="2"/>
                                    {/* Face */}
                                    <path d="M 218 103 Q 225 109 232 103" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" fill="none"/>
                                    <circle cx="219" cy="97" r="2" fill="rgba(255,255,255,0.8)"/>
                                    <circle cx="231" cy="97" r="2" fill="rgba(255,255,255,0.8)"/>
                                    {/* Stethoscope */}
                                    <path d="M 208 118 Q 200 130 205 140 Q 210 150 218 148" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" fill="none"/>
                                    <circle cx="218" cy="148" r="5" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"/>
                                    {/* Arms */}
                                    <path d="M 198 135 L 180 155" stroke="rgba(255,255,255,0.3)" strokeWidth="9" strokeLinecap="round"/>
                                    <path d="M 252 135 L 270 155" stroke="rgba(255,255,255,0.3)" strokeWidth="9" strokeLinecap="round"/>
                                    {/* Legs */}
                                    <path d="M 208 188 L 204 215" stroke="rgba(255,255,255,0.3)" strokeWidth="9" strokeLinecap="round"/>
                                    <path d="M 240 188 L 245 215" stroke="rgba(255,255,255,0.3)" strokeWidth="9" strokeLinecap="round"/>

                                    {/* Floating hearts */}
                                    <text x="162" y="80" fontSize="18" fill="rgba(255,255,255,0.7)" textAnchor="middle">💗</text>
                                    <text x="75" y="115" fontSize="14" fill="rgba(255,255,255,0.5)" textAnchor="middle">✨</text>
                                    <text x="280" y="100" fontSize="12" fill="rgba(255,255,255,0.4)" textAnchor="middle">⭐</text>

                                    {/* Connection line between them */}
                                    <path d="M 155 160 Q 175 140 195 150" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="4 4" fill="none"/>
                                </svg>

                                {/* Mini stat chips */}
                                <div className="ldg-hero__mini-stats">
                                    <div className="ldg-hero__mini-stat">
                                        <span className="ldg-hero__mini-stat-val">501+</span>
                                        <span className="ldg-hero__mini-stat-lbl">Mothers Enrolled</span>
                                    </div>
                                    <div className="ldg-hero__mini-stat">
                                        <span className="ldg-hero__mini-stat-val">7</span>
                                        <span className="ldg-hero__mini-stat-lbl">Health Stations</span>
                                    </div>
                                    <div className="ldg-hero__mini-stat">
                                        <span className="ldg-hero__mini-stat-val">152</span>
                                        <span className="ldg-hero__mini-stat-lbl">Deliveries Logged</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════ WHO CAN USE DASMOM+ ══════════════ */}
            <section id="who" className="ldg-who" aria-label="Who can use DASMOM+">
                <div className="ldg-who__inner">
                    <div className="ldg-section-head ldg-section-head--center">
                        <span className="ldg-badge">Community Platform</span>
                        <h2 className="ldg-section-title">Who Can Use DASMOM+?</h2>
                        <p className="ldg-section-sub">
                            DASMOM+ is designed for everyone involved in maternal healthcare — from expecting mothers to healthcare administrators.
                        </p>
                    </div>

                    <div className="ldg-who__grid">
                        {whoUsers.map((user, i) => (
                            <div key={i} className={`ldg-who-card ldg-who-card--${user.color}`} id={`who-card-${i}`}>
                                <div className="ldg-who-card__icon-wrap">
                                    <span role="img" aria-label={user.title}>{user.emoji}</span>
                                </div>
                                <h3 className="ldg-who-card__title">{user.title}</h3>
                                <p className="ldg-who-card__desc">{user.desc}</p>
                                <span className="ldg-who-card__tag">{user.tag}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ ABOUT SECTION ══════════════ */}
            <section id="about" className="ldg-about" aria-label="About DASMOM+">
                <div className="ldg-about__inner">
                    {/* Visual Card */}
                    <div className="ldg-about__visual">
                        <div className="ldg-about-visual-card">
                            <div className="ldg-about-visual-card__header">
                                <div className="ldg-about-visual-card__title">💊 DASMOM+ — How It Works</div>
                                <div className="ldg-about-visual-card__sub">Connecting mothers & healthcare workers across Dasmariñas City</div>
                            </div>
                            <div className="ldg-about-visual-card__body">
                                <svg
                                    className="ldg-about-visual-card__svg"
                                    viewBox="0 0 380 180"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-label="System connectivity diagram"
                                    role="img"
                                >
                                    <defs>
                                        <marker id="arr2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#b9818a" />
                                        </marker>
                                    </defs>

                                    {/* Central Portal */}
                                    <rect x="130" y="15" width="120" height="58" rx="14" fill="#f5eaec" stroke="#b9818a" strokeWidth="2"/>
                                    <text x="190" y="38" textAnchor="middle" fill="#7a4e58" fontWeight="bold" fontSize="11" fontFamily="Poppins, sans-serif">DASMOM+ Portal</text>
                                    <text x="190" y="54" textAnchor="middle" fill="#b9818a" fontSize="9" fontFamily="Poppins, sans-serif">City Health Office</text>
                                    <text x="190" y="66" textAnchor="middle" fill="#b9818a" fontSize="8" fontFamily="Poppins, sans-serif">Central Records Hub</text>

                                    {/* Station nodes */}
                                    {[
                                        { cx: 55, cy: 145, name: 'Dasma 1', color: '#c3cfb7', stroke: '#7a9b6a' },
                                        { cx: 155, cy: 155, name: 'Salawag', color: '#f5eaec', stroke: '#b9818a' },
                                        { cx: 255, cy: 155, name: 'Dasma 3', color: '#eef0f9', stroke: '#b5a9d4' },
                                        { cx: 345, cy: 145, name: 'Paliparan', color: '#fef6ec', stroke: '#e8b97a' },
                                    ].map((n, i) => (
                                        <g key={i}>
                                            <circle cx={n.cx} cy={n.cy} r="28" fill={n.color} stroke={n.stroke} strokeWidth="2"/>
                                            <text x={n.cx} y={n.cy + 4} textAnchor="middle" fill="#2d2234" fontWeight="600" fontSize="9" fontFamily="Poppins, sans-serif">{n.name}</text>
                                        </g>
                                    ))}

                                    {/* Connection lines */}
                                    <path d="M 75 120 Q 110 70 145 58" fill="none" stroke="#b9818a" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#arr2)" opacity="0.7"/>
                                    <path d="M 155 127 L 175 76" fill="none" stroke="#b9818a" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#arr2)" opacity="0.7"/>
                                    <path d="M 255 127 L 225 76" fill="none" stroke="#b9818a" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#arr2)" opacity="0.7"/>
                                    <path d="M 320 120 Q 285 70 240 60" fill="none" stroke="#b9818a" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#arr2)" opacity="0.7"/>

                                    {/* Labels */}
                                    <text x="88" y="95" fill="#9c6672" fontSize="7.5" fontFamily="Poppins, sans-serif" fontStyle="italic">Midwife Records</text>
                                    <text x="163" y="108" fill="#9c6672" fontSize="7.5" fontFamily="Poppins, sans-serif" fontStyle="italic">Vitals</text>
                                    <text x="243" y="108" fill="#9c6672" fontSize="7.5" fontFamily="Poppins, sans-serif" fontStyle="italic">Vaccines</text>
                                    <text x="290" y="95" fill="#9c6672" fontSize="7.5" fontFamily="Poppins, sans-serif" fontStyle="italic">Follow-ups</text>
                                </svg>

                                <div className="ldg-about-visual-card__stats">
                                    <div className="ldg-about-vc-stat">
                                        <span className="ldg-about-vc-stat__val">501</span>
                                        <span className="ldg-about-vc-stat__lbl">Active Mothers</span>
                                    </div>
                                    <div className="ldg-about-vc-stat">
                                        <span className="ldg-about-vc-stat__val">85%</span>
                                        <span className="ldg-about-vc-stat__lbl">Vacc. Rate</span>
                                    </div>
                                    <div className="ldg-about-vc-stat">
                                        <span className="ldg-about-vc-stat__val">7</span>
                                        <span className="ldg-about-vc-stat__lbl">Stations</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Text Content */}
                    <div className="ldg-about__content">
                        <span className="ldg-badge">About the Platform</span>
                        <h2 className="ldg-section-title">A Caring Platform Built for Mothers and Communities</h2>
                        <p className="ldg-about__intro">
                            DASMOM+ is a maternal healthcare platform designed for Barangay Health Stations, Rural Health Units, and the City Health Office of Dasmariñas City. It brings together mothers, midwives, and healthcare workers in one connected system — making prenatal care more accessible, organized, and supportive for every family.
                        </p>

                        <div className="ldg-about__mvp-cards">
                            <div className="ldg-about-mvp-card">
                                <div className="ldg-about-mvp-card__icon"><Heart size={16} /></div>
                                <h4>Our Mission</h4>
                                <p>To make maternal healthcare accessible, organized, and compassionate — ensuring every mother receives the care she deserves throughout her pregnancy journey.</p>
                            </div>
                            <div className="ldg-about-mvp-card">
                                <div className="ldg-about-mvp-card__icon"><Globe2 size={16} /></div>
                                <h4>Our Vision</h4>
                                <p>A fully connected community healthcare network where every pregnant mother in Dasmariñas City has access to quality, timely, and caring maternal support.</p>
                            </div>
                            <div className="ldg-about-mvp-card">
                                <div className="ldg-about-mvp-card__icon"><ShieldCheck size={16} /></div>
                                <h4>Our Promise</h4>
                                <p>Safe, private, and reliable health records — accessible only by your healthcare team and managed with the highest standards of data protection.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════ HEALTHCARE SERVICES ══════════════ */}
            <section id="services" className="ldg-services" aria-label="Healthcare services">
                <div className="ldg-services__inner">
                    <div className="ldg-section-head ldg-section-head--center">
                        <span className="ldg-badge ldg-badge--sage">Healthcare Services</span>
                        <h2 className="ldg-section-title">Everything You Need, All in One Place</h2>
                        <p className="ldg-section-sub">
                            From your first prenatal visit to your baby's first checkup — DASMOM+ supports every step of your maternal health journey.
                        </p>
                    </div>

                    <div className="ldg-services__grid">
                        {healthServices.map((service, i) => {
                            const Icon = service.icon;
                            return (
                                <div key={i} className={`ldg-service-card ldg-service-card--${service.color}`} id={`service-card-${i}`}>
                                    <div className="ldg-service-card__head">
                                        <div className="ldg-service-card__icon">
                                            <Icon size={26} />
                                        </div>
                                        <h3 className="ldg-service-card__title">{service.title}</h3>
                                    </div>
                                    <p className="ldg-service-card__desc">{service.description}</p>
                                    <div className="ldg-service-card__benefit">
                                        <span className="ldg-service-card__benefit-label">✨ Why it matters</span>
                                        <span className="ldg-service-card__benefit-text">{service.benefit}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ══════════════ MATERNAL CARE JOURNEY ══════════════ */}
            <section id="journey" className="ldg-journey" aria-label="Maternal care journey">
                <div className="ldg-journey__deco" aria-hidden="true"></div>
                <div className="ldg-journey__deco2" aria-hidden="true"></div>
                <div className="ldg-journey__inner">
                    <div className="ldg-section-head ldg-section-head--center">
                        <span className="ldg-badge">Your Care Journey</span>
                        <h2 className="ldg-section-title">Your Pregnancy Journey with DASMOM+</h2>
                        <p className="ldg-section-sub">
                            From your first registration to your newborn's first checkup — we're with you every step of the way.
                        </p>
                    </div>

                    <div className="ldg-journey-grid">
                        {careJourneySteps.map((step, i) => (
                            <div key={i} className="ldg-journey-step" id={`journey-step-${i}`}>
                                <div className="ldg-journey-step__num">{step.step}</div>
                                <span className="ldg-journey-step__icon" role="img" aria-label={step.title}>{step.icon}</span>
                                <h3 className="ldg-journey-step__title">{step.title}</h3>
                                <p className="ldg-journey-step__desc">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ COMMUNITY IMPACT ══════════════ */}
            <section id="impact" className="ldg-impact" aria-label="Community impact statistics">
                <div className="ldg-impact__deco1" aria-hidden="true"></div>
                <div className="ldg-impact__deco2" aria-hidden="true"></div>
                <div className="ldg-impact__inner">
                    <div className="ldg-section-head ldg-section-head--center">
                        <span className="ldg-badge">Community Impact</span>
                        <h2 className="ldg-section-title">Supporting Mothers Across Dasmariñas City</h2>
                        <p className="ldg-section-sub">
                            Real numbers from real communities — showing how DASMOM+ is making a difference in maternal healthcare.
                        </p>
                    </div>

                    <div className="ldg-impact__grid">
                        {impactStats.map((stat, i) => (
                            <div key={i} className={`ldg-impact-card ldg-impact-card--${stat.color}`} id={`impact-stat-${i}`}>
                                <span className="ldg-impact-card__icon" role="img" aria-label={stat.lbl}>{stat.icon}</span>
                                <div className="ldg-impact-card__val">{stat.val}</div>
                                <div className="ldg-impact-card__lbl">{stat.lbl}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ TESTIMONIALS / SUPPORTING BETTER HEALTHCARE ══════════════ */}
            <section className="ldg-testimonials" aria-label="Supporting better maternal healthcare">
                <div className="ldg-testimonials__inner">
                    <div className="ldg-section-head ldg-section-head--center">
                        <span className="ldg-badge ldg-badge--peach">Community Voices</span>
                        <h2 className="ldg-section-title">Supporting Better Maternal Healthcare</h2>
                        <p className="ldg-section-sub">
                            DASMOM+ is built around the real needs of mothers, midwives, and community health workers.
                        </p>
                    </div>

                    <div className="ldg-testimonials__grid">
                        {testimonialCards.map((card, i) => (
                            <div key={i} className={`ldg-testimonial-card ldg-testimonial-card--${card.type}`} id={`testimonial-${i}`}>
                                <div className="ldg-testimonial-card__top">
                                    <div className="ldg-testimonial-card__avatar">
                                        <span role="img" aria-label={card.role}>{card.emoji}</span>
                                    </div>
                                    <div className="ldg-testimonial-card__who">
                                        <span className="ldg-testimonial-card__role">{card.role}</span>
                                        <span className="ldg-testimonial-card__sub">{card.sub}</span>
                                    </div>
                                </div>

                                <p className="ldg-testimonial-card__quote">{card.quote}</p>

                                <div className="ldg-testimonial-card__benefits">
                                    {card.benefits.map((b, j) => (
                                        <div key={j} className="ldg-testimonial-card__benefit">
                                            <span className="ldg-testimonial-card__benefit-dot"></span>
                                            {b}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════ HEALTHCARE BENEFITS MATRIX ══════════════ */}
            <section id="benefits" className="ldg-benefits" aria-label="Healthcare benefits">
                <div className="ldg-benefits__inner">
                    <div className="ldg-section-head ldg-section-head--center">
                        <span className="ldg-badge ldg-badge--lavender">Platform Benefits</span>
                        <h2 className="ldg-section-title">Addressing Real Maternal Healthcare Needs</h2>
                        <p className="ldg-section-sub">
                            How DASMOM+ solves the everyday challenges of maternal healthcare delivery across Dasmariñas City.
                        </p>
                    </div>

                    <div className="ldg-benefits-matrix">
                        <div className="ldg-benefits-matrix__header">
                            <div>Healthcare Need</div>
                            <div>DASMOM+ Solution</div>
                        </div>
                        <div className="ldg-benefits-matrix__body">
                            {whyBenefits.map((b, i) => (
                                <div key={i} className="ldg-benefits-matrix__row">
                                    <div className="ldg-benefits-matrix__cell-req">
                                        <div className="ldg-benefits-matrix__cell-req-inner">
                                            <span className="check-dot">✓</span>
                                            <strong>{b.title}</strong>
                                        </div>
                                    </div>
                                    <div className="ldg-benefits-matrix__cell-cap">{b.cap}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════ ACCESS SECTION ══════════════ */}
            <section className="ldg-access-cta" aria-label="Access DASMOM+ account">
                <div className="ldg-access-cta__deco" aria-hidden="true"></div>
                <div className="ldg-access-cta__inner">
                    <span className="ldg-badge ldg-badge--sage" style={{ margin: '0 auto 16px' }}>Your Healthcare Portal</span>
                    <h2 className="ldg-access-cta__title">
                        Access Your <span>DASMOM+</span> Account
                    </h2>
                    <p className="ldg-access-cta__desc">
                        Sign in to access your maternal health records, appointments, healthcare monitoring, and support services — all in one secure and easy-to-use platform.
                    </p>

                    <div className="ldg-access-cta__icons">
                        {[
                            { icon: '🔒', label: 'Secure Access' },
                            { icon: '🩺', label: 'Health Monitoring' },
                            { icon: '📋', label: 'Maternal Records' },
                            { icon: '🤝', label: 'Healthcare Support' }
                        ].map((item, i) => (
                            <div key={i} className="ldg-access-cta__icon-item">
                                <div className="ldg-access-cta__icon-circle">
                                    <span role="img" aria-label={item.label}>{item.icon}</span>
                                </div>
                                <span className="ldg-access-cta__icon-lbl">{item.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="ldg-access-cta__btns">
                        <button className="ldg-btn ldg-btn--sage ldg-btn--lg" onClick={handleLogin} id="access-cta-login-btn">
                            <Heart size={16} />
                            Sign In to DASMOM+
                        </button>
                        <button className="ldg-btn ldg-btn--outline ldg-btn--lg" onClick={() => scrollToSection('who')} id="access-cta-learn-btn">
                            Learn More
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ══════════════ FOOTER ══════════════ */}
            <footer className="ldg-footer" role="contentinfo">
                <div className="ldg-footer__inner">
                    <div className="ldg-footer__grid">

                        {/* Column 1: Branding */}
                        <div className="ldg-footer__brand">
                            <div className="ldg-footer__logo">
                                <div className="ldg-footer__logo-icon"><HeartPulse size={16} /></div>
                                <span>DASMOM<span className="ldg-footer__plus">+</span></span>
                            </div>
                            <p className="ldg-footer__desc">
                                A maternal healthcare platform supporting pregnant mothers, midwives, and community health workers across Dasmariñas City.
                            </p>
                            <div className="ldg-footer__heart">
                                <span className="ldg-footer__heart-icon">❤️</span>
                                Made with care for mothers & communities
                            </div>
                            <span className="ldg-footer__version">System Version 2.0 · Capstone 2026</span>
                        </div>

                        {/* Column 2: Navigation */}
                        <div className="ldg-footer__col">
                            <h4>Platform</h4>
                            <ul>
                                {navLinks.map(link => (
                                    <li key={link.id}>
                                        <button onClick={() => scrollToSection(link.id)}>{link.label}</button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Column 3: Coverage */}
                        <div className="ldg-footer__col">
                            <h4>Program Coverage</h4>
                            <ul>
                                <li><span>Dasmariñas City Maternal Health</span></li>
                                <li><span>7 Connected Health Stations</span></li>
                                <li><span>Rural Health Units (RHU)</span></li>
                                <li><span>Barangay Health Workers (BHW)</span></li>
                                <li><span>Midwife Care Support Program</span></li>
                            </ul>
                        </div>

                        {/* Column 4: Contact */}
                        <div className="ldg-footer__col">
                            <h4>City Health Office</h4>
                            <div className="ldg-footer__contact">
                                <div className="ldg-footer__contact-item">
                                    <MapPin size={13} />
                                    <span>Municipal Health Office<br />Dasmariñas City<br />Cavite, Philippines</span>
                                </div>
                                <div className="ldg-footer__contact-item">
                                    <Building2 size={13} />
                                    <span>City Government Health Services</span>
                                </div>
                                <div className="ldg-footer__contact-item">
                                    <ShieldCheck size={13} />
                                    <span>Data Privacy Act Compliant</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ldg-footer__bottom">
                        <p>© {new Date().getFullYear()} DASMOM+ Maternal Health Monitoring System. All Rights Reserved.</p>
                        <p>Official Digital Maternal Health Platform · Dasmariñas City Health Office</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
