import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Printer, Download, Edit,
    Activity, Syringe, Baby, HeartPulse,
    CalendarCheck, User, MapPin, Phone,
    AlertTriangle, CheckCircle2, Clock, History
} from 'lucide-react';
import '../../styles/pages/PatientProfile.css';
import PatientService from '../../services/patientservice';

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
    const { id } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('info');
    const [p, setP] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPatient = async () => {
            try {
                const patientService = new PatientService();  
                const data = await patientService.getPatientById(id);  
                setP(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchPatient();
    }, [id]);


    if (loading) return <div className="profile-page">Loading...</div>;
    if (!p) return <div className="profile-page">Patient not found</div>;

    return (
        <div className="profile-page">

            <button className="back-btn" onClick={() => navigate('/dashboard/patients')}>
                <ArrowLeft size={16} /> Back to Patients List
            </button>

            <div className="profile-header-card">
                <div className="profile-header-left">
                    <div className="profile-avatar-lg">
                        {p.name?.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="profile-title-block">
                        <div className="profile-title-row">
                            <h1 className="profile-name">{p.name}</h1>
                            <span className={`risk-badge risk-${p.risk?.toLowerCase()}`}>
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

            <div className="tab-content-area">

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

                {activeTab === 'visits' && (
                    <div className="timeline-card">
                        <div className="timeline-header">
                            <h3 className="info-card-title">Prenatal Visits History</h3>
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

                {activeTab === 'vaccines' && (
                    <div className="info-grid">
                        <div className="info-card">
                            <h3 className="info-card-title">Vaccinations</h3>
                            <table className="mini-table">
                                <tbody>
                                    {p.vaccines.map((v, i) => (
                                        <tr key={i}>
                                            <td>{v.name}</td>
                                            <td>{v.date}</td>
                                            <td>{v.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PatientProfile;