import React, { useState, useEffect } from 'react';
import { 
    Calendar, Clock, Heart, Activity, 
    Baby, Star, ChevronRight, Bell,
    CheckCircle2, AlertCircle, Phone, MessageCircle,
    Sparkles, ArrowRight, ChevronLeft, Info, TrendingUp, Menu, MapPin, Headphones
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MotherDashboard.css';
import PregnancyProgressCard from '../../components/MotherDashboard/PregnancyProgressCard';
import WelcomeMotherModal from '../../components/MotherDashboard/WelcomeMotherModal';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';

const MotherDashboard = () => {
    const navigate = useNavigate();
    const [expandedHealth, setExpandedHealth] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    
    const today = new Date().toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const [pregnancyData, setPregnancyData] = useState({ lmp: null, weeks: null, trimester: null });
    const [appointments, setAppointments] = useState([]);
    const [healthRecords, setHealthRecords] = useState([]);
    const [postpartumVisit, setPostpartumVisit] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const auth = new AuthService();
        const patientService = new PatientService();

        const load = async () => {
            setLoading(true);
            try {
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;

                if (authUser.role === 'mother' || authUser.role === 'patient') {
                    const onboardingKey = `dasmom_onboarding_completed_${authUser.id}`;
                    const hasCompletedOnboarding = localStorage.getItem(onboardingKey) === 'true';
                    if (!hasCompletedOnboarding) {
                        setShowWelcome(true);
                    }
                }

                const patient = await patientService.getPatientById(authUser.id);
                if (patient) {
                    if (patient.lmp) {
                    // Calculate weeks pregnant from LMP
                    const lmpDate = new Date(patient.lmp);
                    const today = new Date();
                    const diffTime = today - lmpDate;
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const weeksPregnant = Math.floor(diffDays / 7);
                    
                    // Calculate expected due date (LMP + 280 days = 40 weeks)
                    const eddDate = new Date(lmpDate);
                    eddDate.setDate(eddDate.getDate() + 280);
                    const daysUntilDue = Math.floor((eddDate - today) / (1000 * 60 * 60 * 24));
                    
                    // Calculate trimester
                    let trimester = 'N/A';
                    if (weeksPregnant < 13) trimester = '1st Trimester';
                    else if (weeksPregnant < 28) trimester = '2nd Trimester';
                    else if (weeksPregnant <= 40) trimester = '3rd Trimester';
                    
                    setPregnancyData({ 
                        lmp: patient.lmp, 
                        edd: eddDate.toISOString().split('T')[0], 
                        weeks: weeksPregnant,
                        daysUntilDue: Math.max(0, daysUntilDue),
                        trimester: trimester 
                    });
                    }
                    
                    // map visits to appointment-like objects for display (next 3 upcoming)
                    const now = new Date();
                    const appts = (patient.visits || [])
                        .filter(v => v.visit_date && new Date(v.visit_date) >= now)
                        .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date))
                        .slice(0, 3)
                        .map(v => ({
                            id: v.id,
                            date: v.visit_date,
                            time: new Date(v.visit_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                            type: v.next_appt_type || 'Prenatal Checkup',
                            staff: (v.assigned_staff && v.assigned_staff.length === 36 && v.assigned_staff.includes('-')) ? 'Healthcare Worker' : (v.assigned_staff || 'Healthcare Worker'),
                            status: v.status || 'Scheduled',
                            location: patient.station || ''
                        }));
                    setAppointments(appts);

                    const latestDelivery = (patient.deliveries || [])[0];
                    if (latestDelivery?.postpartum_visit_date || latestDelivery?.postpartum_attended_date) {
                        const scheduledDate = String(latestDelivery.postpartum_visit_date || '').split('T')[0];
                        const attendedDate = latestDelivery.postpartum_attended_date || null;
                        const todayDate = new Date().toISOString().split('T')[0];
                        setPostpartumVisit({
                            status: attendedDate ? 'Completed' : scheduledDate < todayDate ? 'Missed' : 'Scheduled',
                            date: attendedDate || latestDelivery.postpartum_visit_date,
                            scheduledDate,
                            attendedDate,
                            remarks: latestDelivery.postpartum_remarks
                        });
                    }

                    // health records: latest vitals
                    const latestVisitWithVitals = (patient.visits || [])
                        .filter(v => v.visit_date && (v.weight_kg || (v.bp_systolic && v.bp_diastolic) || v.heart_rate))
                        .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))[0];
                    
                    if (latestVisitWithVitals) {
                        setHealthRecords([
                            {
                                label: 'WEIGHT',
                                value: latestVisitWithVitals.weight_kg ? `${latestVisitWithVitals.weight_kg} kg` : 'N/A',
                                status: 'Normal',
                                icon: Activity
                            },
                            {
                                label: 'BLOOD PRESSURE',
                                value: (latestVisitWithVitals.bp_systolic && latestVisitWithVitals.bp_diastolic) ? `${latestVisitWithVitals.bp_systolic}/${latestVisitWithVitals.bp_diastolic}` : 'N/A',
                                status: 'Normal',
                                icon: Heart
                            },
                            {
                                label: 'HEART RATE',
                                value: latestVisitWithVitals.heart_rate ? `${latestVisitWithVitals.heart_rate} bpm` : 'N/A',
                                status: 'Normal',
                                icon: Heart
                            }
                        ]);
                    } else {
                        setHealthRecords([
                            { label: 'WEIGHT', value: 'N/A', status: 'Normal', icon: Activity },
                            { label: 'BLOOD PRESSURE', value: 'N/A', status: 'Normal', icon: Heart },
                            { label: 'HEART RATE', value: 'N/A', status: 'Normal', icon: Heart }
                        ]);
                    }
                }
            } catch (err) {
                console.error('Error loading mother dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

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

    const handleCloseWelcome = async () => {
        const auth = new AuthService();
        const authUser = await auth.getAuthUser();
        if (authUser?.id) {
            localStorage.setItem(`dasmom_onboarding_completed_${authUser.id}`, 'true');
        }
        setShowWelcome(false);
    };

    return (
        <div className="mother-dashboard">
            {showWelcome && <WelcomeMotherModal onClose={handleCloseWelcome} />}
            {/* ── Mobile App Header ── */}
            <div className="mobile-app-header">
                <div className="header-left">
                    <button className="header-icon-btn"><Menu size={24} /></button>
                    <div className="header-brand">
                        <img src="/assets/dasmom_logo.png" alt="DASMOM Logo" className="brand-logo" />
                        <span className="brand-text">DASMOM<span className="plus">+</span></span>
                    </div>
                </div>
                <div className="header-right">
                    <button className="header-icon-btn"><Bell size={20} /></button>
                    <div className="header-avatar">MM</div>
                </div>
            </div>

            {/* ── Unified Pregnancy Hero Card ── */}
            <div className="mother-hero-card">
                <div className="hero-content">
                    <h1 className="hero-title">Hello, Mommy! 🩷</h1>
                    <p className="hero-subtitle">
                        You're <span className="highlight-text">{pregnancyData.weeks || '?'} weeks</span> pregnant.
                        <br />
                        Your baby is expected in <span className="highlight-text">{pregnancyData.daysUntilDue !== undefined ? pregnancyData.daysUntilDue : '?'} days</span>.
                    </p>
                    
                    <div className="hero-badges">
                        <div className="hero-badge date-badge">
                            <Calendar size={16} />
                            <span>{today}</span>
                        </div>
                        <div className="hero-badge trimester-badge">
                            <Baby size={16} />
                            <span>{pregnancyData.trimester || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                <div className="hero-illustration">
                    {/* Placeholder for mother illustration */}
                </div>
            </div>

            <div className="mother-dash-grid modern-grid">
                {/* ── Left Column ── */}
                <div className="mother-dash-left">
                    {/* Upcoming Appointments - Timeline Style */}
                    {/* Next Appointment Card */}
                    <div className="mother-card modern-card next-appt-card">
                        <div className="mother-card-header">
                            <h2 className="mother-card-title">Next Appointment</h2>
                            <button 
                                className="mother-card-link clickable"
                                onClick={() => navigate('/mother-home/user-appointments')}
                            >
                                See all <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="next-appt-content">
                            {appointments.slice(0, 1).map((appt) => (
                                <div 
                                    key={appt.id} 
                                    className={`appt-list-item`}
                                    onClick={() => navigate('/mother-home/user-appointments')}
                                    style={{ cursor: 'pointer', padding: 0, border: 'none', boxShadow: 'none' }}
                                >
                                    <div className="appt-date-box green">
                                        <span className="m">{new Date(appt.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                                        <span className="d">{new Date(appt.date).getDate()}</span>
                                    </div>
                                    <div className="appt-main-info">
                                        <div className="appt-title-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                            <h3 className="type-text-green">{appt.type === 'Vaccination' ? 'Vaccination' : `${appt.type} Visit`}</h3>
                                            <span className={`status-badge ${String(appt.status || 'scheduled').toLowerCase()}`}>
                                                {appt.status || 'SCHEDULED'}
                                            </span>
                                        </div>
                                        <div className="appt-meta-row">
                                            <span><Clock size={12} /> {appt.time || 'TBD'}</span>
                                            <span><MapPin size={12} /> {appt.location || 'Health Station'}</span>
                                            <span style={{color: 'var(--color-text)'}}>With: <span style={{color: 'var(--color-rose)', fontWeight: 600}}>{appt.staff}</span></span>
                                        </div>
                                    </div>
                                    <div className="appt-actions">
                                        <ChevronRight size={18} color="#b9818a" />
                                    </div>
                                </div>
                            ))}
                            {appointments.length === 0 && (
                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No upcoming appointments.</p>
                            )}
                        </div>
                    </div>

                    {postpartumVisit && (
                        <div className="mother-card modern-card">
                            <div className="mother-card-header">
                                <h2 className="mother-card-title"><Calendar size={18} /> Postpartum Follow-up</h2>
                                <span className={`timeline-status status-${postpartumVisit.status.toLowerCase()}`}>
                                    {postpartumVisit.status === 'Completed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                    {postpartumVisit.status}
                                </span>
                            </div>
                            <p className="support-text">
                                {postpartumVisit.status === 'Completed'
                                    ? `Attended on ${postpartumVisit.attendedDate}.`
                                    : postpartumVisit.status === 'Missed'
                                        ? `Scheduled for ${postpartumVisit.scheduledDate}, but no attendance was recorded.`
                                        : `Scheduled for ${postpartumVisit.scheduledDate}.`}
                            </p>
                            {postpartumVisit.remarks?.personnel_present?.name && (
                                <div className="timeline-staff">Personnel present: {postpartumVisit.remarks.personnel_present.name}</div>
                            )}
                        </div>
                    )}

                    {/* Health Records - Horizontal Cards */}
                    <div className="mother-card modern-card my-health-card">
                        <div className="mother-card-header">
                            <h2 className="mother-card-title">
                                <Heart size={18} color="#b9818a" /> My Health
                            </h2>
                            <button 
                                className="mother-card-link clickable"
                                onClick={() => navigate('/mother-home/user-vitals')}
                            >
                                View Records <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="health-metrics-row">
                            {healthRecords.map((record, index) => {
                                const Icon = record.icon;
                                return (
                                    <div key={index} className="health-metric-box">
                                        <span className="metric-label">{record.label}</span>
                                        <div className="metric-icon-wrapper">
                                            <Icon size={18} color="#b9818a" />
                                        </div>
                                        <span className="metric-value">{record.value}</span>
                                        <span className={`metric-status`}>
                                            <CheckCircle2 size={12} color="#10b981" /> {record.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Right Column ── */}
                <div className="mother-dash-right">
                    {/* Health Tips - Clean Reference Style */}
                    {healthTips.length > 0 && (
                        <div className="mother-card modern-card tips-card">
                            <div className="mother-card-header">
                                <h2 className="mother-card-title">
                                    <Star size={18} color="#b9818a" /> Daily Health Tip
                                </h2>
                                <button className="mother-card-link clickable">
                                    See all <ChevronRight size={14} />
                                </button>
                            </div>
                            
                            <div className="daily-tip-container">
                                <div className="daily-tip-card">
                                    <div className="tip-icon-left">
                                        {(() => {
                                            const Icon = healthTips[currentTipIndex].icon;
                                            return <Icon size={28} color="#f59e0b" />;
                                        })()}
                                    </div>
                                    <div className="tip-text-content">
                                        <h4 className="tip-title-ref">{healthTips[currentTipIndex].title}</h4>
                                        <p className="tip-desc-ref">{healthTips[currentTipIndex].text}</p>
                                    </div>
                                    <div className="tip-illustration-right">
                                        {/* Placeholder for tip illustration */}
                                    </div>
                                </div>
                                <div className="carousel-indicators-ref">
                                    {healthTips.map((_, index) => (
                                        <div 
                                            key={index} 
                                            className={`indicator-dot ${index === currentTipIndex ? 'active' : ''}`}
                                            onClick={() => setCurrentTipIndex(index)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Support - Soft Pink Reference Style */}
                    <div className="mother-card quick-support-card">
                        <div className="support-header-ref">
                            <div className="support-icon-ref">
                                <Headphones size={24} color="#fff" />
                            </div>
                            <div className="support-title-block-ref">
                                <h3 className="support-title-ref">Quick Support</h3>
                                <p className="support-subtitle-ref">Need immediate help? We're here for you.</p>
                            </div>
                        </div>
                        <div className="support-actions-ref">
                            <button className="support-btn-ref primary-ref">
                                <Phone size={16} />
                                Call Midwife
                            </button>
                            <button className="support-btn-ref secondary-ref">
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
