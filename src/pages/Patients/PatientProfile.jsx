import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Printer, Download, Edit,
    Activity, Syringe, Baby, HeartPulse,
    CalendarCheck, User, MapPin, Phone,
    AlertTriangle, CheckCircle2, Clock, History,
    Shield, Mail, Home, FileText, Pill
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

    if (loading) return (
        <div className="profile-page">
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading patient records...</p>
            </div>
        </div>
    );

    if (!p) return (
        <div className="profile-page">
            <div className="error-state">
                <AlertTriangle size={48} />
                <h2>Patient Not Found</h2>
                <p>The patient record you are looking for does not exist or has been moved.</p>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard/patients')}>
                    Return to List
                </button>
            </div>
        </div>
    );

    return (
        <div className="profile-page animate-fade">
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
                            <span className={`risk-badge risk-${p.risk?.toLowerCase().split(' ')[0]}`}>
                                {p.risk} Risk
                            </span>
                        </div>
                        <p className="profile-meta">
                            ID: {p.id.slice(0, 8)}... · {p.age} years old · <MapPin size={12} /> {p.barangay}
                        </p>
                    </div>
                </div>
                <div className="profile-header-right">
                    <div className="header-stats">
                        <div className="h-stat">
                            <span className="h-stat-label">Trimester</span>
                            <span className="h-stat-val trimester-val">{p.trimester || 'N/A'}</span>
                        </div>
                        <div className="h-stat">
                            <span className="h-stat-label">Weeks</span>
                            <span className="h-stat-val">{p.weeks || '0'}w</span>
                        </div>
                        <div className="h-stat">
                            <span className="h-stat-label">EDD</span>
                            <span className="h-stat-val">{p.edd || 'TBD'}</span>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-outline" title="Print Record"><Printer size={16} /></button>
                        <button className="btn btn-primary"><Edit size={16} /> Record Visit</button>
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

                {/* --- BASIC INFO --- */}
                {activeTab === 'info' && (
                    <div className="info-grid animate-fade">
                        <div className="info-card">
                            <h3 className="info-card-title"><User size={16} /> Demographics</h3>
                            <div className="info-list">
                                <div className="info-item">
                                    <span className="info-label">Current Status</span>
                                    <span className="info-val pregnancy-status-badge">{p.pregnancyStatus}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Civil Status</span>
                                    <span className="info-val">{p.civilStatus || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Date of Birth</span>
                                    <span className="info-val">{p.dob}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Blood Type</span>
                                    <span className="info-val blood-type">{p.bloodType}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">PhilHealth No.</span>
                                    <span className="info-val">{p.philhealth || 'Not Provided'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="info-card">
                            <h3 className="info-card-title"><Home size={16} /> Contact & Address</h3>
                            <div className="info-list">
                                <div className="info-item">
                                    <span className="info-label">Phone Number</span>
                                    <span className="info-val">{p.phone}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Full Address</span>
                                    <span className="info-val">{p.address}, {p.barangay}, {p.municipality}</span>
                                </div>
                            </div>
                            <h3 className="info-card-title mt-4"><Shield size={16} /> Emergency Contact</h3>
                            <div className="info-list">
                                <div className="info-item">
                                    <span className="info-label">Name</span>
                                    <span className="info-val">{p.emergencyContact?.name || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Relationship</span>
                                    <span className="info-val">{p.emergencyContact?.relationship || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Contact Phone</span>
                                    <span className="info-val">{p.emergencyContact?.phone || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MEDICAL HISTORY --- */}
                {activeTab === 'history' && (
                    <div className="info-grid animate-fade">
                        <div className="info-card">
                            <h3 className="info-card-title"><History size={16} /> Obstetric History</h3>
                            <div className="info-list">
                                <div className="info-item">
                                    <span className="info-label">Gravida (Total Pregnancies)</span>
                                    <span className="info-val highlight">{p.gravida || 0}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Para (Total Births)</span>
                                    <span className="info-val highlight">{p.para || 0}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Current Risk Level</span>
                                    <span className={`info-val risk-text-${p.risk?.toLowerCase().split(' ')[0]}`}>{p.risk}</span>
                                </div>
                            </div>
                        </div>
                        <div className="info-card">
                            <h3 className="info-card-title"><AlertTriangle size={16} /> Pre-existing Conditions</h3>
                            {p.medicalConditions?.length > 0 ? (
                                <div className="condition-tags">
                                    {p.medicalConditions.map(c => (
                                        <span key={c} className="condition-tag">{c}</span>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-text">No pre-existing conditions recorded.</p>
                            )}
                            
                            {p.otherMedicalNotes && (
                                <div className="notes-box mt-4">
                                    <h4 className="notes-title">Additional Notes</h4>
                                    <p>{p.otherMedicalNotes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- PREGNANCY TRACKING --- */}
                {activeTab === 'tracking' && (
                    <div className="tracking-container animate-fade">
                        <div className="tracking-summary-grid">
                            <div className="tracking-stat-card">
                                <span className="track-label">LMP Date</span>
                                <span className="track-val">{p.lmp || 'N/A'}</span>
                            </div>
                            <div className="tracking-stat-card">
                                <span className="track-label">Expected Due Date</span>
                                <span className="track-val">{p.edd || 'TBD'}</span>
                            </div>
                            <div className="tracking-stat-card">
                                <span className="track-label">Pregnancy Type</span>
                                <span className="track-val">{p.pregnancyType || 'Singleton'}</span>
                            </div>
                            <div className="tracking-stat-card">
                                <span className="track-label">Planned Delivery Place</span>
                                <span className="track-val">{p.plannedDeliveryPlace || 'TBD'}</span>
                            </div>
                        </div>

                        <div className="progress-infographic">
                            <div className="progress-bar-container">
                                <div className="progress-fill" style={{ width: `${Math.min(100, (p.weeks / 40) * 100)}%` }}></div>
                                <div className="progress-marker marker-1" style={{ left: '0%' }}><span>T1</span></div>
                                <div className="progress-marker marker-2" style={{ left: '32.5%' }}><span>T2</span></div>
                                <div className="progress-marker marker-3" style={{ left: '67.5%' }}><span>T3</span></div>
                            </div>
                            <div className="progress-labels">
                                <span>Weeks: {p.weeks} / 40</span>
                                <span>Current: {p.trimester === 1 ? '1st' : p.trimester === 2 ? '2nd' : '3rd'} Trimester</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PRENATAL VISITS --- */}
                {activeTab === 'visits' && (
                    <div className="timeline-card animate-fade">
                        <div className="timeline-header">
                            <h3 className="info-card-title">Prenatal Visits Timeline</h3>
                            <button className="btn btn-sm btn-outline"><Printer size={12} /> Print Schedule</button>
                        </div>
                        <div className="timeline-list">
                            {p.visits.length > 0 ? p.visits.map((v, i) => (
                                <div className="timeline-item" key={i}>
                                    <div className={`timeline-dot ${new Date(v.visit_date) < new Date() ? 'completed' : 'upcoming'}`}></div>
                                    <div className="timeline-content">
                                        <div className="timeline-top">
                                            <span className="timeline-date">{v.visit_date}</span>
                                            <div className="timeline-meta-row">
                                                <span className="timeline-type">Visit #{v.visit_number}</span>
                                                <span className="timeline-tag">{v.trimester}th Trim.</span>
                                            </div>
                                        </div>
                                        {v.bp && (
                                            <div className="timeline-vitals">
                                                <span title="Blood Pressure"><Shield size={12} /> {v.bp}</span>
                                                <span title="Weight"><Scale size={12} /> {v.weight}kg</span>
                                                <span title="Fetal Heart Tone"><Activity size={12} /> {v.fht || 'N/A'} bpm</span>
                                            </div>
                                        )}
                                        {v.notes && <p className="timeline-notes">{v.notes}</p>}
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state-mini">
                                    <CalendarCheck size={32} />
                                    <p>No prenatal visits recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- VACCINES & SUPPLEMENTS --- */}
                {activeTab === 'vaccines' && (
                    <div className="info-grid animate-fade">
                        <div className="info-card">
                            <h3 className="info-card-title"><Syringe size={16} /> Administered Vaccines</h3>
                            {p.vaccines.length > 0 ? (
                                <table className="mini-table">
                                    <thead>
                                        <tr>
                                            <th>Vaccine Name</th>
                                            <th>Dose</th>
                                            <th>Date Given</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.vaccines.map((v, i) => (
                                            <tr key={i}>
                                                <td>{v.vaccine_name}</td>
                                                <td>{v.dose_number}</td>
                                                <td>{v.date_administered}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="empty-text">No vaccines administered yet.</p>
                            )}
                        </div>
                        <div className="info-card">
                            <h3 className="info-card-title"><Pill size={16} /> Supplement Distribution</h3>
                            {p.supplements.length > 0 ? (
                                <table className="mini-table">
                                    <thead>
                                        <tr>
                                            <th>Supplement</th>
                                            <th>Quantity</th>
                                            <th>Date Given</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.supplements.map((s, i) => (
                                            <tr key={i}>
                                                <td>{s.supplement_name}</td>
                                                <td>{s.quantity}</td>
                                                <td>{s.date_given}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="empty-text">No supplements distributed yet.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* --- DELIVERY & POSTPARTUM --- */}
                {activeTab === 'delivery' && (
                    <div className="info-grid animate-fade">
                        {p.pregnancyStatus === 'Postpartum' ? (
                            <div className="info-card full-width">
                                <div className="status-banner banner-postpartum">
                                    <CheckCircle2 size={20} />
                                    <span>Patient is in Postpartum Recovery</span>
                                </div>
                                <p className="mt-4">Loading postpartum records...</p>
                            </div>
                        ) : (
                            <div className="empty-state-card">
                                <Activity size={48} />
                                <h3>No Delivery Records</h3>
                                <p>Patient is currently in the prenatal stage. Delivery records will appear here after the birth event is recorded.</p>
                                <button className="btn btn-outline mt-3" onClick={() => navigate('/dashboard/deliveries')}>
                                    Go to Delivery Outcomes
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* --- NEWBORNS --- */}
                {activeTab === 'newborn' && (
                    <div className="info-grid animate-fade">
                        {p.newborns.length > 0 ? (
                            p.newborns.map((baby, i) => (
                                <div key={i} className="info-card baby-card">
                                    <div className="baby-header">
                                        <div className={`baby-icon baby-${baby.gender?.toLowerCase()}`}><Baby size={20} /></div>
                                        <div>
                                            <h4 className="baby-name">{baby.baby_name || 'Newborn Baby'}</h4>
                                            <span className="baby-meta">{baby.birth_date} · {baby.gender}</span>
                                        </div>
                                    </div>
                                    <div className="baby-stats mt-3">
                                        <div className="b-stat"><span>Weight:</span> <strong>{baby.birth_weight}kg</strong></div>
                                        <div className="b-stat"><span>Condition:</span> <strong>{baby.condition}</strong></div>
                                    </div>
                                    <button className="btn btn-sm btn-outline mt-3 w-100" onClick={() => navigate('/dashboard/newborns')}>
                                        View Tracking Profile
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state-card">
                                <Baby size={48} />
                                <h3>No Newborns Registered</h3>
                                <p>There are no newborns associated with this patient's record yet.</p>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

// Simple Scale icon since Lucide might not have it in all versions
const Scale = ({ size, ...props }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
    >
        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/>
    </svg>
);

export default PatientProfile;