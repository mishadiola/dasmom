import React, { useState, useEffect } from 'react';
import { 
    Calendar, Clock, Heart, Activity, 
    Baby, Star, ChevronRight, Bell,
    CheckCircle2, AlertCircle, Phone, MessageCircle,
    Sparkles, ArrowRight, ChevronLeft, Info, TrendingUp
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

                if (import.meta.env.DEV && authUser.email === "maria@gmail.com") {
                    setShowWelcome(true);
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
                            staff: v.assigned_staff || 'N/A',
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

                    // health records: latest vitals from visits
                    const records = (patient.visits || [])
                        .filter(v => v.visit_date)
                        .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
                        .slice(0, 4)
                        .map(v => ({
                            label: v.bp_systolic && v.bp_diastolic ? 'Blood Pressure' : 'Weight',
                            value: v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : (v.weight_kg ? `${v.weight_kg} kg` : 'N/A'),
                            status: 'Normal',
                            trend: v.weight_kg ? `Δ ${v.weight_kg}` : 'stable',
                            icon: Heart
                        }));
                    setHealthRecords(records);
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

    return (
        <div className="mother-dashboard">
            {showWelcome && <WelcomeMotherModal onClose={() => setShowWelcome(false)} />}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <img src="/assets/images/dashboard/greeting-icon.png" alt="Greeting Icon" style={{ width: '22px', height: '22px', marginRight: '12px' }} />
                        Hello, Mommy! 👋
                    </h1>
                    <p className="page-subtitle">
                        You are {pregnancyData.weeks || '?'} weeks pregnant. Welcome to your personal maternal health portal. {pregnancyData.daysUntilDue !== undefined && `Your baby is expected in ${pregnancyData.daysUntilDue} days.`}
                    </p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
                    <div className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'none' }}>
                        <Calendar size={16} /> {today}
                    </div>
                    <div className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'none' }}>
                        <Baby size={16} /> {pregnancyData.trimester}
                    </div>
                </div>
            </div>

            {/* ── Pregnancy Progress Section ── */}
            {pregnancyData.lmp && (
                <PregnancyProgressCard 
                    lmpDate={pregnancyData.lmp}
                    edd={pregnancyData.edd}
                    weeks={pregnancyData.weeks}
                    trimester={pregnancyData.trimester}
                    daysUntilDue={pregnancyData.daysUntilDue}
                />
            )}

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
                                    className={`timeline-item ${String(appt.status || '').toLowerCase()}`}
                                    onClick={() => navigate('/mother-home/user-appointments')}
                                >
                                    <div className="timeline-dot"></div>
                                    <div className="timeline-content">
                                        <div className="timeline-header">
                                            <span className="timeline-type">{appt.type}</span>
                                            <span className={`timeline-status status-${String(appt.status || '').toLowerCase()}`}>
                                                {appt.status || 'Unknown'}
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
                                            <span className={`health-record-status ${String(record.status || '').toLowerCase()}`}>
                                                <CheckCircle2 size={12} /> {record.status || 'Unknown'}
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
