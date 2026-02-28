import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Printer, Download, Edit,
    Activity, Syringe, Baby, HeartPulse,
    CalendarCheck, User, MapPin, Phone,
    AlertTriangle, CheckCircle2, Clock, History
} from 'lucide-react';
import '../../styles/pages/PatientProfile.css';

/* ── MOCK PATIENT DATA ── */
const MOCK_PROFILE = {
    id: "PT-2026042",
    name: "Maria C. Reyes",
    age: 28,
    dob: "1997-09-15",
    barangay: "Brgy. 3 - San Jose",
    phone: "0917-123-4567",
    emergencyContact: "Jose Reyes (Husband) - 0918-987-6543",
    risk: "High",
    bloodType: "O+",

    // Ob/Gyn History
    gravida: 3,
    para: 1,
    abortions: 1,
    living: 1,
    pastPregnancies: [
        { year: 2021, outcome: "Miscarriage", weeks: 10 },
        { year: 2023, outcome: "Live Birth (NSD)", weeks: 39, baby: "Boy, 3.2kg" }
    ],
    conditions: ["Chronic Hypertension"],

    // Current Tracking
    lmp: "2025-07-20",
    edd: "2026-04-26",
    trimester: 3,
    weeks: 32,
    issues: ["Elevated BP (150/95)", "Mild Proteinuria"],

    // Visits
    visits: [
        { date: "Feb 26, 2026", type: "Prenatal", bp: "150/95", weight: "68 kg", fh: "30 cm", fht: "140 bpm", notes: "Monitored for preeclampsia. Prescribed Methyldopa." },
        { date: "Feb 10, 2026", type: "Prenatal", bp: "145/90", weight: "67 kg", fh: "28 cm", fht: "142 bpm", notes: "Advised bed rest. Urinalysis requested." },
        { date: "Jan 15, 2026", type: "Prenatal", bp: "138/85", weight: "65 kg", fh: "24 cm", fht: "145 bpm", notes: "Routine check. Ultrasound normal." }
    ],

    // Vaccines & Supps
    vaccines: [
        { name: "Tetanus Toxoid 1", date: "Sep 10, 2025", status: "Given" },
        { name: "Tetanus Toxoid 2", date: "Oct 15, 2025", status: "Given" }
    ],
    supplements: [
        { name: "Iron / Folic Acid", status: "Given 90 tabs (Oct 2025)" },
        { name: "Calcium Carbonate", status: "Given 60 tabs (Jan 2026)" }
    ]
};

const TABS = [
    { id: 'info', label: 'Basic Info', icon: User },
    { id: 'history', label: 'Medical History', icon: History },
    { id: 'tracking', label: 'Pregnancy Tracking', icon: HeartPulse },
    { id: 'visits', label: 'Prenatal Visits', icon: CalendarCheck },
    { id: 'vaccines', label: 'Vaccines & Supps', icon: Syringe },
    { id: 'delivery', label: 'Delivery & Postpartum', icon: Activity },
    { id: 'newborn', label: 'Newborns', icon: Baby },
];

const PatientProfile = () => {
    const { id } = useParams(); // Use this to fetch data later
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('info');

    // Currently hardcoded to MOCK_PROFILE
    const p = MOCK_PROFILE;

    return (
        <div className="profile-page">

            {/* ── Top Nav ── */}
            <button className="back-btn" onClick={() => navigate('/dashboard/patients')}>
                <ArrowLeft size={16} /> Back to Patients List
            </button>

            {/* ── Header Card ── */}
            <div className="profile-header-card">
                <div className="profile-header-left">
                    <div className="profile-avatar-lg">
                        {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="profile-title-block">
                        <div className="profile-title-row">
                            <h1 className="profile-name">{p.name}</h1>
                            <span className={`risk-badge risk-${p.risk.toLowerCase()}`}>
                                {p.risk} Risk
                            </span>
                        </div>
                        <p className="profile-meta">
                            {p.id} · {p.age} years old · <MapPin size={12} /> {p.barangay}
                        </p>
                    </div>
                </div>
                <div className="profile-header-right">
                    <div className="header-actions">
                        <button className="btn btn-outline"><Printer size={16} /></button>
                        <button className="btn btn-outline"><Download size={16} /></button>
                        <button className="btn btn-primary"><Edit size={16} /> Edit Profile</button>
                    </div>
                </div>
            </div>

            {/* ── Tabs Navigation ── */}
            <div className="profile-tabs-wrap">
                <div className="profile-tabs">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(t.id)}
                        >
                            <t.icon size={15} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="tab-content-area">

                {/* BASIC INFO */}
                {activeTab === 'info' && (
                    <div className="info-grid">
                        <div className="info-card">
                            <h3 className="info-card-title">Demographics</h3>
                            <div className="info-list">
                                <div className="info-item">
                                    <span className="info-label">Full Name</span>
                                    <span className="info-val">{p.name}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Date of Birth</span>
                                    <span className="info-val">{p.dob} ({p.age} yrs)</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Blood Type</span>
                                    <span className="info-val">{p.bloodType}</span>
                                </div>
                            </div>
                        </div>
                        <div className="info-card">
                            <h3 className="info-card-title">Contact & Location</h3>
                            <div className="info-list">
                                <div className="info-item">
                                    <span className="info-label">Barangay</span>
                                    <span className="info-val">{p.barangay}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Phone</span>
                                    <span className="info-val">{p.phone}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Emergency Contact</span>
                                    <span className="info-val">{p.emergencyContact}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MEDICAL HISTORY */}
                {activeTab === 'history' && (
                    <div className="info-grid">
                        <div className="info-card">
                            <h3 className="info-card-title">Obstetric Score (G-P-A-L)</h3>
                            <div className="gpal-grid">
                                <div className="gpal-box">
                                    <span className="gpal-num">{p.gravida}</span>
                                    <span className="gpal-lbl">Gravida</span>
                                </div>
                                <div className="gpal-box">
                                    <span className="gpal-num">{p.para}</span>
                                    <span className="gpal-lbl">Para</span>
                                </div>
                                <div className="gpal-box">
                                    <span className="gpal-num">{p.abortions}</span>
                                    <span className="gpal-lbl">Abortions</span>
                                </div>
                                <div className="gpal-box">
                                    <span className="gpal-num">{p.living}</span>
                                    <span className="gpal-lbl">Living</span>
                                </div>
                            </div>

                            <h4 className="info-card-sub">Past Pregnancies</h4>
                            <table className="mini-table">
                                <thead>
                                    <tr>
                                        <th>Year</th>
                                        <th>Gestation</th>
                                        <th>Outcome / Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {p.pastPregnancies.map((pp, i) => (
                                        <tr key={i}>
                                            <td>{pp.year}</td>
                                            <td>{pp.weeks} weeks</td>
                                            <td>{pp.outcome} {pp.baby ? `(${pp.baby})` : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="info-card">
                            <h3 className="info-card-title">Pre-existing Conditions</h3>
                            <ul className="conditions-list">
                                {p.conditions.map((c, i) => (
                                    <li key={i}><AlertTriangle size={14} className="text-orange" /> {c}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* TRACKING */}
                {activeTab === 'tracking' && (
                    <div className="info-grid tracking-grid">
                        <div className="info-card">
                            <h3 className="info-card-title">Current Pregnancy</h3>
                            <div className="info-list">
                                <div className="info-item">
                                    <span className="info-label">LMP</span>
                                    <span className="info-val">{p.lmp}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">EDD (Estimated Due Date)</span>
                                    <span className="info-val text-bold">{p.edd}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Current Gestation</span>
                                    <span className="info-val text-rose">{p.weeks} Weeks (Trimester {p.trimester})</span>
                                </div>
                            </div>
                        </div>
                        <div className="info-card border-red">
                            <h3 className="info-card-title text-red">High Risk Factors Identified</h3>
                            <ul className="conditions-list">
                                {p.issues.map((iss, i) => (
                                    <li key={i}><AlertTriangle size={14} className="text-red" /> {iss}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* VISITS */}
                {activeTab === 'visits' && (
                    <div className="timeline-card">
                        <div className="timeline-header">
                            <h3 className="info-card-title">Prenatal Visits History</h3>
                            <button className="btn btn-primary btn-sm"><CalendarCheck size={14} /> Add Visit</button>
                        </div>
                        <div className="timeline-list">
                            {p.visits.map((v, i) => (
                                <div className="timeline-item" key={i}>
                                    <div className="timeline-dot"></div>
                                    <div className="timeline-content">
                                        <div className="timeline-top">
                                            <span className="timeline-date">{v.date}</span>
                                            <span className="timeline-type">{v.type}</span>
                                        </div>
                                        <div className="timeline-vitals">
                                            <span><strong>BP:</strong> {v.bp}</span>
                                            <span><strong>WT:</strong> {v.weight}</span>
                                            <span><strong>FH:</strong> {v.fh}</span>
                                            <span><strong>FHT:</strong> {v.fht}</span>
                                        </div>
                                        <p className="timeline-notes">{v.notes}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VACCINES */}
                {activeTab === 'vaccines' && (
                    <div className="info-grid">
                        <div className="info-card">
                            <h3 className="info-card-title">Vaccinations</h3>
                            <table className="mini-table">
                                <thead>
                                    <tr>
                                        <th>Vaccine</th>
                                        <th>Date Given</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {p.vaccines.map((v, i) => (
                                        <tr key={i}>
                                            <td className="text-bold">{v.name}</td>
                                            <td>{v.date}</td>
                                            <td><span className="status-badge success"><CheckCircle2 size={12} /> {v.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="info-card">
                            <h3 className="info-card-title">Supplements Provided</h3>
                            <table className="mini-table">
                                <thead>
                                    <tr>
                                        <th>Supplement</th>
                                        <th>Distribution Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {p.supplements.map((s, i) => (
                                        <tr key={i}>
                                            <td className="text-bold">{s.name}</td>
                                            <td>{s.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* DELIVERY & NEWBORN (Placeholders) */}
                {(activeTab === 'delivery' || activeTab === 'newborn') && (
                    <div className="empty-state-card">
                        <Clock size={40} className="empty-icon-lg" />
                        <h3>Awaiting Delivery</h3>
                        <p>This patient is currently at {p.weeks} weeks gestation.<br />Delivery and newborn records will be unlocked after the birth is logged.</p>
                        {activeTab === 'delivery' && (
                            <button className="btn btn-primary mt-4">Log Delivery Outcome</button>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default PatientProfile;
