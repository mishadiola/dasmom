import React from 'react';
import { 
    Calendar, Clock, Heart, Activity, 
    Baby, Star, ChevronRight, Bell,
    CheckCircle2, AlertCircle
} from 'lucide-react';
import '../../styles/pages/MotherDashboard.css';
import BabySizeCard, { sizeMapping } from '../../components/MotherDashboard/BabySizeCard';
import PregnancyProgressCard from '../../components/MotherDashboard/PregnancyProgressCard';

const MotherDashboard = () => {
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
        { id: 1, date: 'Mar 15, 2026', time: '9:00 AM', type: 'Prenatal Checkup', staff: 'Midwife Elena P.', status: 'Upcoming' },
        { id: 2, date: 'Mar 22, 2026', time: '10:00 AM', type: 'Vaccination', staff: 'Nurse Ana M.', status: 'Scheduled' },
    ];

    const healthTips = [
        { id: 1, title: 'Mga Babala sa Kalusugan', text: 'Pumunta agad sa health center kung may pamamanas, sakit ng ulo, o pagdurugo.' },
        { id: 2, title: 'Malusog na Pagbubuntis', text: 'Kumain nang tama, magpahinga, at umiwas sa masasamang bisyo at maaalat na pagkain.' },
    ];

    return (
        <div className="mother-dashboard">
            {/* ── Welcome Banner ── */}
            <div className="mother-welcome-banner">
                <div className="welcome-text">
                    <h1>Hello, Mommy! 👋</h1>
                    <p className="welcome-sub">Welcome to your personal maternal health portal. Here's your update for today.</p>
                    <p className="current-date">{today}</p>
                </div>
                <div className="pregnancy-summary-simple">
                   <div className="trimester-badge">{pregnancyData.trimester}</div>
                </div>
            </div>

            {/* ── Pregnancy Progress Section ── */}
            <PregnancyProgressCard 
                lmpDate={pregnancyData.lmp} 
                babySizeData={babySizeData} 
            />

            <div className="mother-dash-grid">
                {/* ── Left Column ── */}
                <div className="mother-dash-left">
                    {/* Upcoming Appointments */}
                    <div className="mother-card">
                        <div className="mother-card-header">
                            <h2 className="mother-card-title">
                                <Calendar size={18} /> Upcoming visits
                            </h2>
                            <button className="mother-card-link">See all <ChevronRight size={14} /></button>
                        </div>
                        <div className="mother-appt-list">
                            {appointments.map(appt => (
                                <div key={appt.id} className="mother-appt-item">
                                    <div className="mother-appt-icon">
                                        <Calendar size={20} />
                                    </div>
                                    <div className="mother-appt-info">
                                        <p className="mother-appt-type">{appt.type}</p>
                                        <p className="mother-appt-meta">{appt.date} · {appt.time}</p>
                                        <p className="mother-appt-staff">{appt.staff}</p>
                                    </div>
                                    <div className={`mother-appt-status status-${appt.status.toLowerCase()}`}>
                                        {appt.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Vitals & Health */}
                    <div className="mother-card">
                        <div className="mother-card-header">
                            <h2 className="mother-card-title">
                                <Activity size={18} /> My Latest Health Records
                            </h2>
                        </div>
                        <div className="mother-vitals-grid">
                            <div className="mother-vital-box">
                                <span className="vital-label">Blood Pressure</span>
                                <span className="vital-val">110/70</span>
                                <span className="vital-desc"><CheckCircle2 size={12} /> Normal</span>
                            </div>
                            <div className="mother-vital-box">
                                <span className="vital-label">Weight</span>
                                <span className="vital-val">62 kg</span>
                                <span className="vital-desc">+2kg from last visit</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Right Column ── */}
                <div className="mother-dash-right">
                    {/* Baby Size Card */}
                    <BabySizeCard currentWeek={pregnancyData.weeks} />

                    {/* Health Tips */}
                    {healthTips.length > 0 && (
                        <div className="mother-card tips-card">
                            <div className="mother-card-header">
                                <h2 className="mother-card-title">
                                    <Star size={18} /> Daily Health Tips
                                </h2>
                            </div>
                            <div className="mother-tips-list">
                                {healthTips.map(tip => (
                                    <div key={tip.id} className="mother-tip-item">
                                        <div className="tip-icon">
                                            <Heart size={16} />
                                        </div>
                                        <div className="tip-content">
                                            <p className="tip-title">{tip.title}</p>
                                            <p className="tip-text">{tip.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Support */}
                    <div className="mother-card support-card">
                        <div className="mother-card-header">
                            <h2 className="mother-card-title">
                                <AlertCircle size={18} /> Quick Support
                            </h2>
                        </div>
                        <p className="support-text">Facing an emergency or have urgent questions? Contact your midwife directly.</p>
                        <button className="mother-btn-contact">Call Brgy. Health Station</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MotherDashboard;
