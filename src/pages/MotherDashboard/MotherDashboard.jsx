import React, { useState, useEffect } from 'react';
import { 
    Calendar, Clock, Heart, Activity, 
    Baby, Star, ChevronRight, Bell,
    CheckCircle2, AlertCircle, Phone, MessageCircle, Mail,
    Sparkles, ArrowRight, ChevronLeft, Info, TrendingUp, Droplet, Thermometer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/MotherDashboard.css';
import PregnancyProgressCard from '../../components/MotherDashboard/PregnancyProgressCard';
import WelcomeMotherModal from '../../components/MotherDashboard/WelcomeMotherModal';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import supabase from '../../config/supabaseclient';
import pregnancySilhouette from '../../assets/images/pregnancy-silhouette.png';
import { calculateEDD, calculateTimeRemaining, calculateGestationalAge, getTrimester, isNewbornVaccinationEligible } from '../../utils/pregnancyUtils';
import { useLanguage } from '../../context/LanguageContext';

const MotherDashboard = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [expandedHealth, setExpandedHealth] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    
    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });

    const [pregnancyData, setPregnancyData] = useState({ lmp: null, weeks: null, trimester: null, status: 'Unknown', isPregnant: false, isPostpartum: false });
    const [appointments, setAppointments] = useState([]);
    const [healthRecords, setHealthRecords] = useState([]);
    const [postpartumVisit, setPostpartumVisit] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const auth = new AuthService();
        const patientService = new PatientService();
        let channel = null;
        let welcomeChecked = false;

        const load = async () => {
            setLoading(true);
            try {
                const authUser = await auth.getAuthUser();
                if (!authUser?.id) return;

                if (!welcomeChecked && (authUser.role === 'mother' || authUser.role === 'patient')) {
                    welcomeChecked = true;
                    const { data: welcomeData, error: welcomeError } = await supabase.functions.invoke('mother-welcome', {
                        body: { action: 'claim' },
                    });
                    if (welcomeError) {
                        console.error('Error checking first-login welcome status:', welcomeError);
                    } else if (welcomeData?.showWelcome) {
                        setShowWelcome(true);
                    }
                }

                if (!channel) {
                    channel = supabase.channel(`mother-dashboard-${authUser.id}`)
                        .on('postgres_changes', {
                            event: '*', schema: 'public', table: 'pregnancy_info',
                            filter: `patient_id=eq.${authUser.id}`
                        }, () => load())
                        .on('postgres_changes', {
                            event: '*', schema: 'public', table: 'deliveries',
                            filter: `mother_id=eq.${authUser.id}`
                        }, () => load())
                        .subscribe();
                }

                const patient = await patientService.getPatientById(authUser.id);
                if (patient) {
                    const currentPregnancy = patient.currentPregnancy;
                    const currentPregnancyRecord = currentPregnancy || patient.pregnancyRecord;
                    const status = String(currentPregnancyRecord?.pregn_postp || currentPregnancyRecord?.status || patient.pregnancyStatus || 'Unknown');
                    const isPregnant = status.toLowerCase() === 'pregnant';
                    const isPostpartum = status.toLowerCase() === 'postpartum';
                    const lmpDateStr = isPregnant ? currentPregnancyRecord?.lmd : null;
                    let gestAge = null;
                    let eddDate = isPregnant && currentPregnancyRecord?.edd
                        ? new Date(currentPregnancyRecord.edd)
                        : null;
                    let timeRem = null;
                    let trimesterStr = null;

                    if (lmpDateStr) {
                        if (!eddDate || Number.isNaN(eddDate.getTime())) eddDate = calculateEDD(lmpDateStr);
                        gestAge = calculateGestationalAge(lmpDateStr);
                        timeRem = calculateTimeRemaining(eddDate);
                        trimesterStr = getTrimester(gestAge.weeks);
                    } else if (eddDate && !Number.isNaN(eddDate.getTime())) {
                        timeRem = calculateTimeRemaining(eddDate);
                    }
                    const latestDelivery = currentPregnancy?.deliveries?.[0] || null;
                    setPregnancyData({
                        lmp: lmpDateStr,
                        edd: isPregnant && eddDate && !Number.isNaN(eddDate.getTime())
                            ? eddDate.toISOString().split('T')[0]
                            : null,
                        weeks: gestAge?.weeks ?? null,
                        daysUntilDue: timeRem?.totalDays,
                        trimester: trimesterStr,
                        status,
                        isPregnant,
                        isPostpartum,
                        deliveryDate: latestDelivery?.delivery_date || null
                    });
                    
                    // Main dashboard appointments belong only to the current pregnancy.
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const todayKey = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;
                    const getDateKey = value => String(value || '').split('T')[0];
                    const currentVisits = currentPregnancy?.visits || [];
                    let allAppts = isPregnant ? currentVisits
                        .filter(v => {
                            if (!v.visit_date || ['Cancelled', 'Missed', 'Attended', 'Completed'].includes(v.status)) return false;
                            return getDateKey(v.visit_date) >= todayKey;
                        })
                        .map(v => ({
                            id: v.id,
                            date: v.visit_date,
                            time: new Date(v.visit_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                            type: v.next_appt_type || 'Prenatal Checkup',
                            staff: v.assigned_staff_name || 'Healthcare Worker',
                            status: v.status || 'Scheduled',
                            location: patient.station || ''
                        })) : [];

                    if (isPregnant) {
                        const scheduledDays = new Set(allAppts.map(appointment => String(appointment.date).split('T')[0]));
                        const nextAppointmentSource = currentVisits
                            .filter(visit => visit.status === 'Attended' && visit.next_appt_date)
                            .filter(visit => {
                                return getDateKey(visit.next_appt_date) >= todayKey && !scheduledDays.has(getDateKey(visit.next_appt_date));
                            })
                            .sort((left, right) => new Date(left.next_appt_date) - new Date(right.next_appt_date))[0];

                        if (nextAppointmentSource) {
                            allAppts.push({
                                id: `next-${nextAppointmentSource.id}`,
                                date: nextAppointmentSource.next_appt_date,
                                time: '',
                                type: nextAppointmentSource.next_appt_type || 'Prenatal Checkup',
                                staff: nextAppointmentSource.assigned_staff_name || 'Healthcare Worker',
                                status: 'Scheduled',
                                location: patient.station || ''
                            });
                        }
                    }

                    if (!isPregnant) {
                        (patient.deliveries || []).forEach(delivery => {
                            (delivery.postpartum_visits || [])
                                .filter(visit => {
                                    const status = String(visit.status || 'Scheduled').toLowerCase();
                                    const scheduledDate = visit.scheduled_date || visit.scheduled_at;
                                    return scheduledDate && getDateKey(scheduledDate) >= todayKey
                                        && !['attended', 'completed', 'cancelled', 'missed'].includes(status);
                                })
                                .forEach(visit => {
                                    const scheduledDate = visit.scheduled_at || visit.scheduled_date;
                                    allAppts.push({
                                        id: visit.id,
                                        date: scheduledDate,
                                        time: visit.scheduled_at
                                            ? new Date(visit.scheduled_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
                                            : '',
                                        type: visit.visit_type || 'Postpartum Visit',
                                        staff: visit.assigned_staff_name || 'Healthcare Worker',
                                        status: visit.status || 'Scheduled',
                                        location: visit.assigned_station_name || visit.station_name || patient.station || ''
                                    });
                                });
                        });

                        const eligibleNewbornIds = new Set((patient.newborns || [])
                            .filter(isNewbornVaccinationEligible)
                            .map(newborn => newborn.id));
                        (patient.vaccines || [])
                            .filter(vaccine => {
                                const status = String(vaccine.status || 'Pending').toLowerCase();
                                const dueDate = vaccine.scheduled_vaccination;
                                if (vaccine.recipient_type === 'Baby' && !eligibleNewbornIds.has(vaccine.newborn_id)) return false;
                                return dueDate && getDateKey(dueDate) >= todayKey
                                    && !['completed', 'cancelled', 'missed', 'overdue'].includes(status);
                            })
                            .forEach(vaccine => {
                                allAppts.push({
                                    id: vaccine.id,
                                    date: vaccine.scheduled_vaccination,
                                    time: '',
                                    type: `${vaccine.recipient_type === 'Baby' ? `${vaccine.recipient_name || 'Baby'} ` : ''}Vaccination${vaccine.vaccine_name ? ` · ${vaccine.vaccine_name}` : ''}`,
                                    staff: vaccine.assigned_staff_name || 'Healthcare Worker',
                                    status: vaccine.status || 'Pending',
                                    location: vaccine.administration_station_name || vaccine.assigned_staff_station || patient.station || ''
                                });
                            });
                    }

                    const appts = allAppts
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .slice(0, 1);
                        
                    setAppointments(appts);

                    const postpartumVisits = latestDelivery?.postpartum_visits || [];
                    if (postpartumVisits.length > 0) {
                        const selectedPostpartumVisit = postpartumVisits.find(visit => visit.status !== 'Attended' && visit.status !== 'Cancelled')
                            || postpartumVisits[postpartumVisits.length - 1];
                        const scheduledDate = selectedPostpartumVisit.scheduled_at;
                        const attendedDate = selectedPostpartumVisit.attended_date || null;
                        const todayDate = new Date().toISOString().split('T')[0];
                        setPostpartumVisit({
                            status: selectedPostpartumVisit.status === 'Attended'
                                ? 'Completed'
                                : String(selectedPostpartumVisit.scheduled_date || scheduledDate).slice(0, 10) < todayDate
                                    ? 'Missed'
                                    : 'Scheduled',
                            date: attendedDate || scheduledDate,
                            scheduledDate,
                            attendedDate,
                            remarks: selectedPostpartumVisit.assessment
                        });
                    }

                    // health records: extract Weight, BP, and Temp from latest visit
                    let weightVal = 'N/A';
                    let bpVal = 'N/A';
                    let tempVal = 'N/A';
                    
                    const latestVisit = currentVisits
                        .filter(v => v.visit_date && (v.weight_kg || (v.bp_systolic && v.bp_diastolic) || v.temp_c || v.temperature))
                        .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))[0];

                    if (latestVisit) {
                        weightVal = latestVisit.weight_kg ? `${latestVisit.weight_kg} kg` : 'N/A';
                        bpVal = latestVisit.bp_systolic && latestVisit.bp_diastolic ? `${latestVisit.bp_systolic}/${latestVisit.bp_diastolic}` : 'N/A';
                        tempVal = (latestVisit.temp_c || latestVisit.temperature) ? `${latestVisit.temp_c || latestVisit.temperature} °C` : 'N/A';
                    }

                    const records = [
                        { label: 'WEIGHT', value: weightVal, status: weightVal === 'N/A' ? 'Not recorded' : 'Recorded', icon: Heart },
                        { label: 'BP', value: bpVal, status: bpVal === 'N/A' ? 'Not recorded' : 'Recorded', icon: Droplet },
                        { label: 'TEMP', value: tempVal, status: tempVal === 'N/A' ? 'Not recorded' : 'Recorded', icon: Thermometer }
                    ];
                    
                    setHealthRecords(records);
                }
            } catch (err) {
                console.error('Error loading mother dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
        return () => {
            if (channel) supabase.removeChannel(channel);
        };
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
        setShowWelcome(false);
    };

    return (
        <div className="mother-dashboard">
            {showWelcome && <WelcomeMotherModal onClose={handleCloseWelcome} />}
            <div className="page-header mother-welcome-header-with-img">
                <img 
                    src={pregnancySilhouette} 
                    alt="" 
                    className="pregnancy-silhouette-bg" 
                />
                <div className="mother-welcome-header-content-wrapper">
                    <div className="mother-welcome-text-section">
                        <h1 className="page-title">
                            {t('dash_hello')}
                        </h1>
                        <p className="page-subtitle">
                            {pregnancyData.isPostpartum ? (
                                <>You're now in your postpartum recovery period.</>
                            ) : pregnancyData.isPregnant ? (
                                <>{t('dash_weeks_pregnant').replace('{weeks}', pregnancyData.weeks ?? '?')} {pregnancyData.daysUntilDue !== undefined && t('dash_baby_expected').replace('{days}', pregnancyData.daysUntilDue)}</>
                            ) : (
                                <>Current pregnancy status: {pregnancyData.status}</>
                            )}
                        </p>
                        
                        <div className="welcome-badges-row">
                            <div className="welcome-badge welcome-badge-light">
                                <Calendar size={16} /> {today}
                            </div>
                            {pregnancyData.isPregnant ? (
                                <div className="welcome-badge welcome-badge-mauve">
                                    <Baby size={16} /> {pregnancyData.trimester}
                                </div>
                            ) : pregnancyData.isPostpartum ? (
                                <div className="welcome-badge welcome-badge-mauve">Postpartum</div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="dashboard-content-layout">
                {/* ── Row 1: Appt and EDD ── */}
                <div className="mother-dash-row-2col">
                    <div className="mother-card modern-card appointments-card">
                        <div className="mother-card-header">
                            <h2 className="mother-card-title">
                                {t('dash_next_appointment')}
                            </h2>
                            <button 
                                className="mother-card-link clickable"
                                onClick={() => navigate('/mother-home/user-appointments')}
                            >
                                {t('dash_see_all')} <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="appointments-timeline">
                            {appointments.slice(0, 1).map((appt) => (
                                <div 
                                    key={appt.id} 
                                    className={`mother-timeline-item ${String(appt.status || '').toLowerCase()}`}
                                    onClick={() => navigate('/mother-home/user-appointments')}
                                >
                                    <div className="timeline-date-block">
                                        <span className="month">{new Date(appt.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
                                        <span className="day">{new Date(appt.date).getDate()}</span>
                                        <span className="weekday">{new Date(appt.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
                                    </div>
                                    <div className="timeline-content">
                                        <div className="timeline-header">
                                            <span className="timeline-type">{appt.type}</span>
                                            <span className={`timeline-status status-${String(appt.status || '').toLowerCase()}`}>
                                                {appt.status || 'Unknown'}
                                            </span>
                                        </div>
                                        <div className="timeline-details">
                                            <div className="timeline-detail">
                                                <Clock size={14} /> {appt.time}
                                            </div>
                                            <div className="timeline-detail">
                                                <Info size={14} /> {appt.location || 'Health Station'}
                                            </div>
                                        </div>
                                        <div className="timeline-staff">
                                            <span className="staff-label">{t('dash_with')}</span> <span className="staff-name">{appt.staff}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {appointments.length === 0 && (
                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('dash_no_upcoming')}</p>
                            )}
                        </div>
                    </div>

                    <div className="mother-card modern-card edd-card">
                        <div className="edd-content-box">
                            <div className="edd-icon-wrapper bg-white-soft">
                                <Calendar size={24} color="white" />
                            </div>
                            <div className="edd-details-wrapper">
                                {pregnancyData.isPostpartum ? (
                                    <>
                                        <h2 className="mother-card-title edd-title-small">Postpartum Recovery</h2>
                                        {pregnancyData.deliveryDate ? (
                                            <h2 className="edd-display">
                                                Delivered {new Date(pregnancyData.deliveryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                            </h2>
                                        ) : (
                                            <h2 className="edd-display" style={{ opacity: 0.5 }}>Delivered</h2>
                                        )}
                                        {pregnancyData.deliveryDate && (
                                            <p className="edd-subtitle">Day {Math.floor((new Date().setHours(0,0,0,0) - new Date(pregnancyData.deliveryDate).setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)) + 1} of postpartum recovery</p>
                                        )}
                                    </>
                                ) : pregnancyData.isPregnant ? (
                                    <>
                                        <h2 className="mother-card-title edd-title-small">{t('dash_expected_due')}</h2>
                                        {pregnancyData.edd ? (
                                            <h2 className="edd-display">
                                                {new Date(pregnancyData.edd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                            </h2>
                                        ) : (
                                            <h2 className="edd-display" style={{ opacity: 0.5 }}>N/A</h2>
                                        )}
                                        {pregnancyData.daysUntilDue !== undefined && pregnancyData.daysUntilDue !== null && (
                                            <p className="edd-subtitle">
                                                {pregnancyData.daysUntilDue > 1 
                                                    ? `${pregnancyData.daysUntilDue} days remaining` 
                                                    : pregnancyData.daysUntilDue === 1 
                                                        ? '1 day remaining' 
                                                        : 'Due today'
                                                }
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <h2 className="mother-card-title edd-title-small">{pregnancyData.status}</h2>
                                        <h2 className="edd-display" style={{ opacity: 0.5 }}>No current due date</h2>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Row 2: Health Records ── */}
                <div className="mother-card modern-card health-records-full">
                    <div className="mother-card-header">
                        <h2 className="mother-card-title">
                            <Activity size={18} /> {t('dash_health_records')}
                        </h2>
                        <button 
                            className="mother-card-link clickable"
                            onClick={() => navigate('/mother-home/user-vitals')}
                        >
                            {t('dash_show_more')} <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="health-records-row">
                        {healthRecords.length > 0 ? healthRecords.slice(0, 3).map((record, index) => {
                            const Icon = record.icon;
                            return (
                                <div key={index} className="health-record-card-horizontal">
                                    <div className="hrc-icon-bg">
                                        <Icon size={20} />
                                    </div>
                                    <div className="hrc-info">
                                        <span className="hrc-label">{record.label}</span>
                                        <span className="hrc-value">{record.value}</span>
                                        <span className={`hrc-status ${String(record.status || '').toLowerCase()}`}>
                                            <CheckCircle2 size={12} /> {record.status || 'Normal'}
                                        </span>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="hrc-empty">{t('dash_no_records')}</div>
                        )}
                    </div>
                </div>

                {/* ── Row 3: Pregnancy Progress ── */}
                {pregnancyData.isPregnant && pregnancyData.lmp && (
                    <PregnancyProgressCard 
                        lmpDate={pregnancyData.lmp}
                        edd={pregnancyData.edd}
                        weeks={pregnancyData.weeks}
                        trimester={pregnancyData.trimester}
                        daysUntilDue={pregnancyData.daysUntilDue}
                    />
                )}

                {/* ── Row 4: Tips and Support ── */}
                <div className="mother-dash-bottom-2col">
                    {/* Health Tips */}
                    {healthTips.length > 0 && (
                        <div className="mother-card modern-card tips-card modern-tips">
                            <div className="mother-card-header">
                                <h2 className="mother-card-title">
                                    <Star size={18} /> {t('dash_daily_tips')}
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

                    {/* Quick Support */}
                    <div className="mother-card modern-card support-card emergency-card">
                        <div className="support-header">
                            <div className="support-icon-wrapper">
                                <AlertCircle size={32} />
                            </div>
                            <div>
                                <h2 className="support-title">{t('dash_quick_support')}</h2>
                                <p className="support-subtitle">{t('dash_support_subtitle')}</p>
                            </div>
                        </div>
                        <p className="support-text">{t('dash_support_text')}</p>
                        <div className="support-actions">
                            <a href="tel:09452694260" className="support-btn support-btn-primary" style={{ textDecoration: 'none' }}>
                                <Phone size={16} />
                                {t('dash_call_cho')}
                            </a>
                            <a href="mailto:cho3.salawag@gmail.com" className="support-btn support-btn-secondary" style={{ textDecoration: 'none' }}>
                                <Mail size={16} />
                                {t('dash_email_cho')}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MotherDashboard;
