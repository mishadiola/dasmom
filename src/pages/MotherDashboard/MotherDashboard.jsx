import React, { useState } from 'react';
import { 
    Calendar, Clock, Heart, Activity, 
    Baby, Star, ChevronRight, Bell,
    CheckCircle2, AlertCircle, Phone, MessageCircle,
    Sparkles, ArrowRight, ChevronLeft, Info, TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MotherDashboard.css';
import BabySizeCard, { sizeMapping } from '../../components/MotherDashboard/BabySizeCard';
import PregnancyProgressCard from '../../components/MotherDashboard/PregnancyProgressCard';

const MotherDashboard = () => {
    const navigate = useNavigate();
    const [expandedHealth, setExpandedHealth] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const [showSupportModal, setShowSupportModal] = useState(false);
    
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const pregnancyData = {
        lmp: '2025-08-20',
        weeks: 28,
        trimester: '3rd Trimester'
    };

    // Get baby size data for the progress card
    const weeksList = Object.keys(sizeMapping).map(Number).sort((a, b) => b - a);
    const targetWeek = weeksList.find(w => pregnancyData.weeks >= w) || 8;
    const babySizeData = sizeMapping[targetWeek];

    const appointments = [
        { id: 1, date: 'Mar 15, 2026', time: '9:00 AM', type: 'Prenatal Checkup', staff: 'Midwife Elena P.', status: 'Upcoming', location: 'Station 3 Health Center' },
        { id: 2, date: 'Mar 22, 2026', time: '10:00 AM', type: 'Vaccination', staff: 'Nurse Ana M.', status: 'Scheduled', location: 'City Health Office' },
        { id: 3, date: 'Feb 28, 2026', time: '8:30 AM', type: 'Prenatal Checkup', staff: 'Midwife Elena P.', status: 'Completed', location: 'Station 3 Health Center' },
    ];

    const healthRecords = [
        { label: 'Blood Pressure', value: '110/70', status: 'Normal', trend: 'stable', icon: Heart },
        { label: 'Weight', value: '62 kg', status: 'Normal', trend: '+2kg', icon: TrendingUp },
        { label: 'Heart Rate', value: '78 bpm', status: 'Normal', trend: 'stable', icon: Activity },
        { label: 'Temperature', value: '36.5°C', status: 'Normal', trend: 'stable', icon: Sparkles },
    ];

    const healthTips = [
        { id: 1, title: '⚠️ Mga Babala sa Kalusugan', text: 'Pumunta agad sa health center kung may pamamanas, sakit ng ulo, o pagdurugo.', icon: AlertCircle, color: 'warning' },
        { id: 2, title: '🥗 Malusog na Pagbubuntis', text: 'Kumain nang tama, magpahinga, at umiwas sa masasamang bisyo at maaalat na pagkain.', icon: Heart, color: 'info' },
        { id: 3, title: '💧 Mag-ingat sa Hydration', text: 'Inom ng 8-10 na basong tubig araw-araw para sa iyong kalusugan at ng baby.', icon: Sparkles, color: 'success' },
    ];

    const nextTip = () => {
        setCurrentTipIndex((prev) => (prev + 1) % healthTips.length);
    };

    const prevTip = () => {
        setCurrentTipIndex((prev) => (prev - 1 + healthTips.length) % healthTips.length);
    };

    return (
        <div className="mother-dashboard">
            {/* ── Welcome Banner ── */}
            <div className="mother-welcome-banner">
                <div className="welcome-content">
                    <div className="welcome-emoji">🤰</div>
                    <div>
                        <p className="welcome-greeting">Hello, Mommy! 👋</p>
                        <h1>Your Pregnancy Journey</h1>
                        <p className="welcome-sub">Welcome to your personal maternal health portal. Here's your update for today.</p>
                    </div>
                </div>
                <div className="welcome-meta">
                    <div className="date-badge">
                        <Calendar size={14} />
                        {today}
                    </div>
                    <div className="trimester-badge modern-trimester">
                        <Baby size={14} />
                        {pregnancyData.trimester}
                    </div>
                </div>
            </div>

            {/* ── Pregnancy Progress Section ── */}
            <PregnancyProgressCard 
                lmpDate={pregnancyData.lmp} 
            />

            <div className="mother-dash-grid modern-grid">
                {/* ── Left Column ── */}
                <div className="mother-dash-left">
                    {/* Upcoming Appointments - Timeline Style */}
                    <div className="mother-card modern-card appointments-card">
                        <div className="mother-card-header">
                            <h2 className="mother-card-title">
                                <Calendar size={18} /> Upcoming Visits
                            </h2>
                            <button 
                                className="mother-card-link clickable"
                                onClick={() => navigate('/mother-home/user-appointments')}
                            >
                                See all <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="appointments-timeline">
                            {appointments.map((appt, index) => (
                                <div 
                                    key={appt.id} 
                                    className={`timeline-item ${appt.status.toLowerCase()}`}
                                    onClick={() => navigate('/mother-home/user-appointments')}
                                >
                                    <div className="timeline-dot"></div>
                                    <div className="timeline-content">
                                        <div className="timeline-header">
                                            <span className="timeline-type">{appt.type}</span>
                                            <span className={`timeline-status status-${appt.status.toLowerCase()}`}>
                                                {appt.status}
                                            </span>
                                        </div>
                                        <div className="timeline-details">
                                            <div className="timeline-detail">
                                                <Clock size={14} />
                                                {appt.date} at {appt.time}
                                            </div>
                                            <div className="timeline-detail">
                                                <Info size={14} />
                                                {appt.location}
                                            </div>
                                        </div>
                                        <div className="timeline-staff">
                                            <span className="staff-label">With:</span> {appt.staff}
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="timeline-arrow" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Health Records - Expandable Cards */}
                    <div className="mother-card modern-card health-card">
                        <div className="mother-card-header">
                            <h2 className="mother-card-title">
                                <Activity size={18} /> My Latest Health Records
                            </h2>
                            <button 
                                className="expand-toggle"
                                onClick={() => setExpandedHealth(!expandedHealth)}
                            >
                                {expandedHealth ? 'Show Less' : 'Show More'}
                                <ChevronRight size={14} className={`chevron ${expandedHealth ? 'expanded' : ''}`} />
                            </button>
                        </div>
                        <div className={`health-records-grid ${expandedHealth ? 'expanded' : ''}`}>
                            {healthRecords.slice(0, expandedHealth ? healthRecords.length : 2).map((record, index) => {
                                const Icon = record.icon;
                                return (
                                    <div key={index} className="health-record-card">
                                        <div className="health-record-icon">
                                            <Icon size={20} />
                                        </div>
                                        <div className="health-record-info">
                                            <span className="health-record-label">{record.label}</span>
                                            <span className="health-record-value">{record.value}</span>
                                            <span className={`health-record-status ${record.status.toLowerCase()}`}>
                                                <CheckCircle2 size={12} /> {record.status}
                                            </span>
                                            {record.trend !== 'stable' && (
                                                <span className="health-record-trend">
                                                    <TrendingUp size={12} /> {record.trend}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Right Column ── */}
                <div className="mother-dash-right">
                    {/* Baby Size Card */}
                    <BabySizeCard currentWeek={pregnancyData.weeks} />

                    {/* Health Tips - Carousel Style */}
                    {healthTips.length > 0 && (
                        <div className="mother-card modern-card tips-card modern-tips">
                            <div className="mother-card-header">
                                <h2 className="mother-card-title">
                                    <Star size={18} /> Daily Health Tips
                                </h2>
                            </div>
                            <div className="tips-carousel">
                                <button className="carousel-nav carousel-prev" onClick={prevTip}>
                                    <ChevronLeft size={20} />
                                </button>
                                <div className="carousel-content">
                                    <div className="tip-card-modern">
                                        <div className="tip-icon-modern">
                                            <div className={`tip-icon-circle ${healthTips[currentTipIndex].color}`}>
                                                {(() => {
                                                    const Icon = healthTips[currentTipIndex].icon;
                                                    return <Icon size={24} />;
                                                })()}
                                            </div>
                                        </div>
                                        <div className="tip-content-modern">
                                            <p className="tip-title-modern">{healthTips[currentTipIndex].title}</p>
                                            <p className="tip-text-modern">{healthTips[currentTipIndex].text}</p>
                                        </div>
                                    </div>
                                </div>
                                <button className="carousel-nav carousel-next" onClick={nextTip}>
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                            <div className="carousel-indicators">
                                {healthTips.map((_, index) => (
                                    <div 
                                        key={index} 
                                        className={`indicator ${index === currentTipIndex ? 'active' : ''}`}
                                        onClick={() => setCurrentTipIndex(index)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Support - Emergency Action Card */}
                    <div className="mother-card modern-card support-card emergency-card">
                        <div className="support-header">
                            <div className="support-icon-wrapper">
                                <AlertCircle size={32} />
                            </div>
                            <div>
                                <h2 className="support-title">Quick Support</h2>
                                <p className="support-subtitle">Need immediate help? We're here for you.</p>
                            </div>
                        </div>
                        <p className="support-text">Facing an emergency or have urgent questions? Contact your healthcare provider directly.</p>
                        <div className="support-actions">
                            <button className="support-btn support-btn-primary">
                                <Phone size={16} />
                                Call Midwife
                            </button>
                            <button className="support-btn support-btn-secondary">
                                <MessageCircle size={16} />
                                Message Health Center
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MotherDashboard;
