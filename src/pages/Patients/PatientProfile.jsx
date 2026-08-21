import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Printer, Download, Edit,
    Activity, Syringe, Baby, HeartPulse,
    CalendarCheck, User, MapPin, Phone,
    AlertTriangle, CheckCircle2, Clock, History,
    Shield, Mail, Home, FileText, Pill, Scale,
    Ruler, Thermometer, Heart, Wind
} from 'lucide-react';
import '../../styles/pages/PatientProfile.css';
import PatientService from '../../services/patientservice';
import EditPatientModal from '../../components/Patient/EditPatientModal';
import { formatMotherId } from '../../utils/displayIds';

// Helper function for readable date formatting
const formatReadableDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
};

const getPostpartumStatus = (delivery) => {
    if (delivery.postpartum_attended_date) return 'Completed';
    const scheduledDate = String(delivery.postpartum_visit_date || '').split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    return scheduledDate && scheduledDate < today ? 'Missed' : 'Scheduled';
};

// Helper function to extract first 4 numeric digits from patient ID
const getShortPatientId = (id) => {
    return formatMotherId(id);
};

// Helper function for proper ordinal formatting
const getOrdinalSuffix = (num) => {
    if (!num) return '';
    
    const lastDigit = num % 10;
    const lastTwoDigits = num % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return num + 'th';
    }
    
    if (lastDigit === 1) return num + 'st';
    if (lastDigit === 2) return num + 'nd';
    if (lastDigit === 3) return num + 'rd';
    return num + 'th';
};

const TABS = [
    { id: 'info', label: 'Basic Info', icon: User },
    { id: 'history', label: 'Medical History', icon: History },
    { id: 'tracking', label: 'Pregnancy Tracking', icon: HeartPulse },
    { id: 'visits', label: 'Prenatal Visits', icon: CalendarCheck },
    { id: 'vaccines', label: 'Distribution Records', icon: Syringe },
    { id: 'delivery', label: 'Delivery & Postpartum', icon: Activity },
    { id: 'newborn', label: 'Newborn Records', icon: Baby },
];

const PatientProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const from = searchParams.get('from') || 'patients';

    const [activeTab, setActiveTab] = useState('info');
    const [p, setP] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editModalOpen, setEditModalOpen] = useState(false);

    const handleBack = () => {
        if (from === 'high-risk') {
            navigate('/dashboard/high-risk');
        } else {
            navigate('/dashboard/patients');
        }
    };

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

    const handleEditPatient = () => {
        setEditModalOpen(true);
    };

    const handlePatientUpdate = (updatedPatient) => {
        setP(updatedPatient);
    };

    const handlePrintProfile = () => {
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        // Generate the HTML content for the PDF
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Patient Profile - ${p.name}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        color: #333;
                        line-height: 1.6;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #b9818a;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .patient-name {
                        font-size: 24px;
                        font-weight: bold;
                        color: #b9818a;
                        margin: 0;
                    }
                    .patient-info {
                        font-size: 14px;
                        color: #666;
                        margin: 5px 0;
                    }
                    .section {
                        margin-bottom: 30px;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #b9818a;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 5px;
                        margin-bottom: 15px;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        margin-bottom: 20px;
                    }
                    .info-item {
                        margin-bottom: 10px;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #555;
                        display: inline-block;
                        width: 120px;
                    }
                    .info-value {
                        color: #333;
                    }
                    .risk-badge {
                        background: #ffebee;
                        color: #c62828;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    .footer {
                        margin-top: 40px;
                        text-align: center;
                        font-size: 12px;
                        color: #999;
                        border-top: 1px solid #ddd;
                        padding-top: 20px;
                    }
                    @media print {
                        body { margin: 15px; }
                        .section { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="patient-name">${p.name}</h1>
                    <p class="patient-info">Patient ID: ${getShortPatientId(p.id)} | Age: ${p.age} years | Station: ${p.station}</p>
                    <p class="patient-info">Risk Level: <span class="risk-badge">${(p.risk || 'Normal').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span></p>
                    <p class="patient-info">Generated on: ${new Date().toLocaleDateString()}</p>
                </div>

                <div class="section">
                    <h2 class="section-title">Personal Information</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Date of Birth:</span>
                            <span class="info-value">${formatReadableDate(p.dob) || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Age:</span>
                            <span class="info-value">${p.age || 'N/A'} years</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Civil Status:</span>
                            <span class="info-value">${p.civilStatus || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Blood Type:</span>
                            <span class="info-value">${p.bloodType || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">PhilHealth:</span>
                            <span class="info-value">${p.philhealth || 'Not Provided'}</span>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Contact Information</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Phone:</span>
                            <span class="info-value">${p.phone || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Address:</span>
                            <span class="info-value">${p.address || 'N/A'}, ${p.station || 'N/A'}, ${p.municipality || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Emergency Contact:</span>
                            <span class="info-value">${p.emergencyContact?.name || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Relationship:</span>
                            <span class="info-value">${p.emergencyContact?.relationship || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Emergency Phone:</span>
                            <span class="info-value">${p.emergencyContact?.phone || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Pregnancy Information</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Trimester:</span>
                            <span class="info-value">${p.trimester || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Weeks:</span>
                            <span class="info-value">${p.weeks || '0'} weeks</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">EDD:</span>
                            <span class="info-value">${formatReadableDate(p.edd) || 'TBD'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">LMP:</span>
                            <span class="info-value">${p.lmp || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Risk Level:</span>
                            <span class="info-value">${(p.risk || 'Normal').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Medical History</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Allergies:</span>
                            <span class="info-value">${p.allergies || 'None recorded'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Medications:</span>
                            <span class="info-value">${p.medications || 'None recorded'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Previous Pregnancies:</span>
                            <span class="info-value">${p.previousPregnancies || '0'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Medical Conditions:</span>
                            <span class="info-value">${p.medicalConditions || 'None recorded'}</span>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <p>Generated by DasMom+ Health System on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    <p>This document contains confidential patient information. Handle with care.</p>
                </div>
            </body>
            </html>
        `;
        
        // Write the content to the new window
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for the content to load, then print
        printWindow.onload = function() {
            printWindow.print();
            printWindow.close();
        };
    };

    const handlePrintVisits = () => {
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        // Generate the HTML content for the prenatal visits PDF
        const visitsContent = p.visits && p.visits.length > 0 
            ? p.visits.map((visit, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${formatReadableDate(visit.visitDate) || 'N/A'}</td>
                    <td>${visit.trimester || 'N/A'}</td>
                    <td>${visit.weeks || 'N/A'} weeks</td>
                    <td>${visit.visitType || 'Checkup'}</td>
                    <td>${visit.weight || 'N/A'} kg</td>
                    <td>${visit.bp || 'N/A'}</td>
                    <td>${visit.notes || 'No notes'}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="8" style="text-align: center; padding: 20px;">No prenatal visits recorded</td></tr>';
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prenatal Visits - ${p.name}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        color: #333;
                        line-height: 1.6;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #b9818a;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .patient-name {
                        font-size: 24px;
                        font-weight: bold;
                        color: #b9818a;
                        margin: 0;
                    }
                    .patient-info {
                        font-size: 14px;
                        color: #666;
                        margin: 5px 0;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #b9818a;
                        margin-bottom: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 30px;
                    }
                    th {
                        background-color: #b9818a;
                        color: white;
                        padding: 12px;
                        text-align: left;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    td {
                        padding: 10px 12px;
                        border-bottom: 1px solid #ddd;
                        font-size: 12px;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    tr:hover {
                        background-color: #f5f5f5;
                    }
                    .footer {
                        margin-top: 40px;
                        text-align: center;
                        font-size: 12px;
                        color: #999;
                        border-top: 1px solid #ddd;
                        padding-top: 20px;
                    }
                    .summary-info {
                        background-color: #f8f9fa;
                        padding: 15px;
                        border-radius: 5px;
                        margin-bottom: 20px;
                        border-left: 4px solid #b9818a;
                    }
                    .summary-info p {
                        margin: 5px 0;
                        font-size: 14px;
                    }
                    @media print {
                        body { margin: 15px; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; page-break-after: auto; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="patient-name">${p.name}</h1>
                    <p class="patient-info">Patient ID: ${getShortPatientId(p.id)} | Age: ${p.age} years | Station: ${p.station} | Risk: ${p.risk ? p.risk.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : ''}</p>
                    <p class="patient-info">Prenatal Visits Schedule</p>
                    <p class="patient-info">Generated on: ${new Date().toLocaleDateString()}</p>
                </div>

                <div class="summary-info">
                    <p><strong>Total Visits:</strong> ${p.visits ? p.visits.length : 0}</p>
                    <p><strong>Current Trimester:</strong> ${p.trimester || 'N/A'}</p>
                    <p><strong>Weeks of Pregnancy:</strong> ${p.weeks || 'N/A'} weeks</p>
                    <p><strong>Expected Due Date:</strong> ${formatReadableDate(p.edd) || 'N/A'}</p>
                </div>

                <h2 class="section-title">Prenatal Visits Timeline</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Visit #</th>
                            <th>Date</th>
                            <th>Trimester</th>
                            <th>Weeks</th>
                            <th>Visit Type</th>
                            <th>Weight (kg)</th>
                            <th>Blood Pressure</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visitsContent}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Generated by DasMom+ Health System on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    <p>This document contains confidential patient information. Handle with care.</p>
                </div>
            </body>
            </html>
        `;
        
        // Write the content to the new window
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for the content to load, then print
        printWindow.onload = function() {
            printWindow.print();
            printWindow.close();
        };
    };

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
                <button className="btn btn-primary" onClick={handleBack}>
                    Return to List
                </button>
            </div>
        </div>
    );

    return (
        <div className="profile-page animate-fade">
            <button className="back-btn" onClick={handleBack}>
                <ArrowLeft size={16} /> Back
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
                                {p.risk ? p.risk.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : ''}
                            </span>
                        </div>
                        <p className="profile-meta">
                            ID: {getShortPatientId(p.id)} · {p.age} years old · <MapPin size={12} /> {p.station}
                        </p>
                    </div>
                </div>
                <div className="profile-header-right">
                    <div className="header-stats" style={{ display: 'flex', gap: '24px', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '12px 24px', borderRadius: '12px', border: '1px solid #edf2f7', marginRight: '16px' }}>
                        <div className="h-stat" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="h-stat-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Trimester</span>
                            <span className="h-stat-val trimester-val" style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                                {p.trimester ? `${p.trimester}${p.trimester == 1 ? 'st' : p.trimester == 2 ? 'nd' : p.trimester == 3 ? 'rd' : 'th'} Trimester` : 'N/A'}
                            </span>
                        </div>
                        <div style={{ width: '1px', height: '32px', backgroundColor: '#e2e8f0' }}></div>
                        <div className="h-stat" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="h-stat-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Gestational Age</span>
                            <span className="h-stat-val" style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{p.weeks || '0'} weeks</span>
                        </div>
                        <div style={{ width: '1px', height: '32px', backgroundColor: '#e2e8f0' }}></div>
                        <div className="h-stat" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="h-stat-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Expected Due Date</span>
                            <span className="h-stat-val" style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 }}>{formatReadableDate(p.edd) || 'TBD'}</span>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-outline" title="Print Record" onClick={handlePrintProfile}><Printer size={16} /></button>
                        <button className="btn btn-outline" title="Edit Patient" onClick={handleEditPatient}><Edit size={16} /></button>
                        <button className="btn btn-primary"><Edit size={16} /> Record Visit</button>
                    </div>
                </div>
            </div>

            <div className="profile-tabs-wrap">
                <div className="profile-tabs">
                    {TABS.filter(t => {
                        // Hide prenatal visits for postpartum patients (but keep tracking for postpartum recovery)
                        if (p?.pregnancyStatus === 'Postpartum' && t.id === 'visits') {
                            return false;
                        }
                        // Hide newborn tab for pregnant patients (only show for postpartum)
                        if (p?.pregnancyStatus !== 'Postpartum' && t.id === 'newborn') {
                            return false;
                        }
                        return true;
                    }).map(t => (
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
                    <div className="profile-section-fade animate-fade">
                        <div className="modern-info-grid">
                            {/* Card: Demographics */}
                            <div className="modern-card">
                                <div className="modern-card-header">
                                    <div className="mc-icon pink-gradient"><User size={18} /></div>
                                    <h3>Demographics & Identity</h3>
                                </div>
                                <div className="mc-body grid-2-col">
                                    <div className="mc-field">
                                        <label>Patient ID</label>
                                        <span>{getShortPatientId(p.id)}</span>
                                    </div>
                                    <div className="mc-field">
                                        <label>Date of Birth</label>
                                        <span>{formatReadableDate(p.dob)} <em>({p.age} y/o)</em></span>
                                    </div>
                                    <div className="mc-field">
                                        <label>Civil Status</label>
                                        <span className="badge-civil">{p.civilStatus || 'N/A'}</span>
                                    </div>
                                    <div className="mc-field">
                                        <label>Blood Type</label>
                                        <span className="badge-blood">{p.bloodType}</span>
                                    </div>
                                    <div className="mc-field full-col mt-2">
                                        <label>PhilHealth Number</label>
                                        <div className="copyable-box">
                                            {p.philhealth || 'Not Provided'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card: Contact Info */}
                            <div className="modern-card">
                                <div className="modern-card-header">
                                    <div className="mc-icon blue-gradient"><Phone size={18} /></div>
                                    <h3>Contact Information</h3>
                                </div>
                                <div className="mc-body">
                                    <div className="mc-field-row">
                                        <Phone size={16} className="text-muted" />
                                        <div>
                                            <label>Primary Phone</label>
                                            <span>{p.phone}</span>
                                        </div>
                                    </div>
                                    <div className="mc-field-row">
                                        <MapPin size={16} className="text-muted" />
                                        <div>
                                            <label>Residential Address</label>
                                            <span>{p.address}, {p.station}, {p.municipality}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="modern-card-sub-header mt-4">
                                    <div className="mc-icon purple-gradient-sm"><Shield size={14} /></div>
                                    <h4>Emergency Contact</h4>
                                </div>
                                <div className="mc-body alert-bg-light">
                                    <div className="mc-field">
                                        <label>{p.emergencyContact?.relationship || 'Contact Person'}</label>
                                        <span className="highlight-text">{p.emergencyContact?.name || 'N/A'}</span>
                                    </div>
                                    <div className="mc-field">
                                        <label>Phone Number</label>
                                        <span>{p.emergencyContact?.phone || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MEDICAL HISTORY --- */}
                {activeTab === 'history' && (
                    <div className="profile-section-fade animate-fade">
                        <div className="modern-info-grid">
                            
                            {/* Card: Obstetric */}
                            <div className="modern-card">
                                <div className="modern-card-header">
                                    <div className="mc-icon rose-gradient"><History size={18} /></div>
                                    <h3>Obstetric History (GPA)</h3>
                                </div>
                                <div className="mc-body">
                                    <p className="section-instruction">Previous pregnancy outcomes and current clinical risk evaluation.</p>
                                    
                                    <div className="gpa-score-grid mt-3">
                                        <div className="gpa-box">
                                            <span className="gpa-label">Gravida</span>
                                            <span className="gpa-value">{p.gravida || 0}</span>
                                            <span className="gpa-sub">Total</span>
                                        </div>
                                        <div className="gpa-box">
                                            <span className="gpa-label">Para</span>
                                            <span className="gpa-value">{p.para || 0}</span>
                                            <span className="gpa-sub">Births</span>
                                        </div>
                                        <div className={`gpa-box box-risk-${(p.risk || 'normal').toLowerCase().split(' ')[0]}`}>
                                            <span className="gpa-label">Risk Level</span>
                                            <span className="gpa-value str">{(p.risk || 'Normal').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                                            <span className="gpa-sub">Calculated</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card: Risk History Timeline */}
                            <div className="modern-card">
                                <div className="modern-card-header">
                                    <div className="mc-icon orange-gradient"><AlertTriangle size={18} /></div>
                                    <h3>Risk Assessment History</h3>
                                </div>
                                <div className="mc-body">
                                    {p.visits && p.visits.length > 0 ? (
                                        <div className="risk-history-timeline">
                                            {p.visits
                                                .filter(v => v.status === 'Attended')
                                                .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date))
                                                .map((visit, index) => (
                                                    <div key={index} className="risk-history-item">
                                                        <div className="risk-history-header">
                                                            <div className="risk-visit-info">
                                                                <span className="risk-visit-date">{formatReadableDate(visit.visit_date)}</span>
                                                                <span className="risk-visit-number">Visit #{visit.visit_number}</span>
                                                            </div>
                                                            <div className={`risk-badge risk-${(visit.calculated_risk || 'normal').toLowerCase().split(' ')[0]}`}>
                                                                {visit.calculated_risk || 'Normal'} Risk
                                                            </div>
                                                        </div>
                                                        {visit.risk_factors && visit.risk_factors.split(',').filter(f => f.trim() && f.trim().toLowerCase() !== 'none').length > 0 && (
                                                            <div className="risk-factors-list">
                                                                {visit.risk_factors.split(',').filter(f => f.trim() && f.trim().toLowerCase() !== 'none').map((factor, i) => (
                                                                    <span key={i} className="risk-factor-tag">
                                                                        {factor.trim()}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    ) : (
                                        <div className="empty-box">
                                            <History size={24} className="text-muted mb-2" />
                                            <p>No visit history available yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PREGNANCY TRACKING --- */}
                {activeTab === 'tracking' && (
                    <div className="tracking-container animate-fade">
                        {p.pregnancyStatus === 'Postpartum' ? (
                            // Postpartum Recovery View
                            <>
                                <div className="tracking-hero-grid">
                                    <div className="tracking-hero-card">
                                        <span className="track-icon-wrap"><Activity size={24} /></span>
                                        <div className="track-hero-content">
                                            <span className="track-hero-label">Delivery Date</span>
                                            <span className="track-hero-val">{formatReadableDate(p.deliveryDate) || 'N/A'}</span>
                                            <span className="track-hero-sub">Type: {p.deliveryType || 'NSD'}</span>
                                        </div>
                                    </div>
                                    <div className="tracking-hero-card">
                                        <span className="track-icon-wrap"><Baby size={24} /></span>
                                        <div className="track-hero-content">
                                            <span className="track-hero-label">Postpartum Status</span>
                                            <span className="track-hero-val text-rose">Postpartum</span>
                                            <span className="track-hero-sub">Recovery in progress</span>
                                        </div>
                                    </div>
                                    <div className={`tracking-hero-card risk-card-${(p.risk || 'normal').toLowerCase().split(' ')[0]}`}>
                                        <span className="track-icon-wrap"><AlertTriangle size={24} /></span>
                                        <div className="track-hero-content">
                                            <span className="track-hero-label">Risk Level</span>
                                            <span className="track-hero-val">{(p.risk || 'Normal').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                                            <span className="track-hero-sub">Based on delivery outcome</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="tracking-progress-section">
                                    <h3 className="tracking-section-title">Postpartum Recovery Progress</h3>
                                    <div className="progress-infographic">
                                        <div className="progress-bar-bg">
                                            <div className="progress-fill" style={{ width: '100%', backgroundColor: '#b9818a' }}>
                                                <div className="progress-glow"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="progress-note">
                                        Patient is in <strong>postpartum recovery</strong> period. Monitor for complications and ensure follow-up visits are completed.
                                    </p>
                                </div>

                                <div className="tracking-details-grid">
                                    <div className="tracking-detail-box">
                                        <h5>Delivery Type</h5>
                                        <p>{p.deliveryType || 'N/A'}</p>
                                    </div>
                                    <div className="tracking-detail-box">
                                        <h5>Gravida / Para</h5>
                                        <p>G{p.gravida || 1} P{p.para || 0}</p>
                                    </div>
                                    <div className="tracking-detail-box">
                                        <h5>Postpartum Visit</h5>
                                        <p>{formatReadableDate(p.postpartumVisitDate) || 'Scheduled'}</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            // Pregnancy Tracking View
                            <>
                                <div className="tracking-hero-grid">
                                    <div className="tracking-hero-card">
                                        <span className="track-icon-wrap"><CalendarCheck size={24} /></span>
                                        <div className="track-hero-content">
                                            <span className="track-hero-label">Estimated Due Date</span>
                                            <span className="track-hero-val">{formatReadableDate(p.edd) || 'TBD'}</span>
                                            <span className="track-hero-sub">Based on LMP: {formatReadableDate(p.lmp) || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="tracking-hero-card">
                                        <span className="track-icon-wrap"><HeartPulse size={24} /></span>
                                        <div className="track-hero-content">
                                            <span className="track-hero-label">Current Trimester</span>
                                            <span className="track-hero-val text-rose">Trimester {p.trimester}</span>
                                            <span className="track-hero-sub">Week {p.weeks} of Pregnancy</span>
                                        </div>
                                    </div>
                                    <div className={`tracking-hero-card risk-card-${(p.risk || 'normal').toLowerCase().split(' ')[0]}`}>
                                        <span className="track-icon-wrap"><AlertTriangle size={24} /></span>
                                        <div className="track-hero-content">
                                            <span className="track-hero-label">Assessed Risk Level</span>
                                            <span className="track-hero-val">{(p.risk || 'Normal').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                                            <span className="track-hero-sub">{p.medicalConditions?.length || 0} Risk Factors Detected</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="tracking-progress-section" style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #edf2f7', marginTop: '16px' }}>
                                    <h3 className="tracking-section-title" style={{ fontSize: '15px', color: '#1e293b', fontWeight: '700', marginBottom: '64px' }}>Gestation Progress Tracking</h3>
                                    
                                    <div className="progress-timeline-container" style={{ position: 'relative', width: '100%', margin: '0 auto', height: '16px' }}>
                                        {/* Background Track */}
                                        <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}></div>
                                        
                                        {/* Fill Track */}
                                        <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: `${Math.min(100, (p.weeks / 40) * 100)}%`, height: '8px', backgroundColor: '#b9818a', borderRadius: '4px', transition: 'width 1s ease-in-out' }}></div>
                                        
                                        {/* Milestones */}
                                        <div style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 2 }}>
                                            {/* 1st Trimester */}
                                            <div style={{ position: 'absolute', left: '0%', transform: 'translateX(-20%)', top: '50%', marginTop: '-8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: p.weeks >= 0 ? '#b9818a' : '#fff', border: `3px solid ${p.weeks >= 0 ? '#b9818a' : '#cbd5e1'}`, marginBottom: '12px', transition: 'all 0.3s' }}></div>
                                                <div style={{ textAlign: 'center', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '700', color: p.weeks >= 0 ? '#1e293b' : '#64748b' }}>1st Trimester</div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#94a3b8', marginTop: '2px' }}>Weeks 1–13</div>
                                                </div>
                                            </div>

                                            {/* 2nd Trimester */}
                                            <div style={{ position: 'absolute', left: '35%', transform: 'translateX(-50%)', top: '50%', marginTop: '-8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: p.weeks >= 14 ? '#b9818a' : '#fff', border: `3px solid ${p.weeks >= 14 ? '#b9818a' : '#cbd5e1'}`, marginBottom: '12px', transition: 'all 0.3s' }}></div>
                                                <div style={{ textAlign: 'center', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '700', color: p.weeks >= 14 ? '#1e293b' : '#64748b' }}>2nd Trimester</div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#94a3b8', marginTop: '2px' }}>Weeks 14–27</div>
                                                </div>
                                            </div>

                                            {/* 3rd Trimester */}
                                            <div style={{ position: 'absolute', left: '70%', transform: 'translateX(-50%)', top: '50%', marginTop: '-8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: p.weeks >= 28 ? '#b9818a' : '#fff', border: `3px solid ${p.weeks >= 28 ? '#b9818a' : '#cbd5e1'}`, marginBottom: '12px', transition: 'all 0.3s' }}></div>
                                                <div style={{ textAlign: 'center', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '700', color: p.weeks >= 28 ? '#1e293b' : '#64748b' }}>3rd Trimester</div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#94a3b8', marginTop: '2px' }}>Weeks 28–40</div>
                                                </div>
                                            </div>

                                            {/* Term */}
                                            <div style={{ position: 'absolute', left: '100%', transform: 'translateX(-80%)', top: '50%', marginTop: '-8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: p.weeks >= 40 ? '#b9818a' : '#fff', border: `3px solid ${p.weeks >= 40 ? '#b9818a' : '#cbd5e1'}`, marginBottom: '12px', transition: 'all 0.3s' }}></div>
                                                <div style={{ textAlign: 'center', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '700', color: p.weeks >= 40 ? '#1e293b' : '#64748b' }}>Term</div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#94a3b8', marginTop: '2px' }}>Week 40</div>
                                                </div>
                                            </div>
                                            
                                            {/* Current Patient Marker */}
                                            {p.weeks > 0 && p.weeks <= 40 && (
                                                <div style={{ position: 'absolute', left: `${Math.min(100, (p.weeks / 40) * 100)}%`, transform: 'translate(-50%, -100%)', top: '-6px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                                                    <div style={{ backgroundColor: '#fff', color: '#b9818a', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', boxShadow: '0 2px 10px rgba(185, 129, 138, 0.25)', border: '1.5px solid #b9818a', whiteSpace: 'nowrap' }}>
                                                        Week {p.weeks}
                                                    </div>
                                                    <div style={{ width: '2px', height: '16px', backgroundColor: '#b9818a', marginTop: '4px' }}></div>
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fff', border: '2.5px solid #b9818a', marginTop: '-4px' }}></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ backgroundColor: '#f8f9fa', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid #b9818a', marginTop: '72px' }}>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                                            Patient is currently at <strong style={{ color: '#1e293b' }}>{p.weeks} weeks</strong>. Ensure all scheduled prenatal visits for Trimester {p.trimester} are completed on time.
                                        </p>
                                    </div>
                                </div>

                                <div className="tracking-details-grid">
                                    <div className="tracking-detail-box">
                                        <h5>Pregnancy Type</h5>
                                        <p>{p.pregnancyType || 'Singleton'}</p>
                                    </div>
                                    <div className="tracking-detail-box">
                                        <h5>Planned Delivery Place</h5>
                                        <p>{p.plannedDeliveryPlace || 'TBD'}</p>
                                    </div>
                                    <div className="tracking-detail-box">
                                        <h5>Gravida / Para</h5>
                                        <p>G{p.gravida || 1} P{p.para || 0}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* --- PRENATAL VISITS --- */}
                {activeTab === 'visits' && (
                    <div className="timeline-card animate-fade">
                        <div className="timeline-header">
                            <h3 className="info-card-title">Prenatal Visits Timeline</h3>
                            <button className="btn btn-sm btn-outline" onClick={handlePrintVisits}><Printer size={12} /> Print Schedule</button>
                        </div>
                        <div className="timeline-list">
                            {p.visits.length > 0 ? (() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                
                                // Sort visits by date
                                const sortedVisits = [...p.visits].sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date));
                                
                                // Find the last attended visit index
                                const lastAttendedIndex = sortedVisits.findLastIndex(v => v.status === 'Attended');
                                
                                return sortedVisits.map((v, i) => {
                                    const visitDate = new Date(v.visit_date);
                                    visitDate.setHours(0, 0, 0, 0);
                                    
                                    let visitStatus = 'future';
                                    if (v.status === 'Attended') {
                                        visitStatus = 'attended';
                                    } else if (i === lastAttendedIndex + 1) {
                                        visitStatus = 'next-after-attended';
                                    } else {
                                        visitStatus = 'scheduled';
                                    }
                                    
                                    return (
                                        <div className={`timeline-item timeline-item--${visitStatus}`} key={i}>
                                            <div className={`timeline-dot ${visitStatus === 'attended' ? 'completed' : visitStatus === 'next-after-attended' ? 'next' : 'upcoming'}`}></div>
                                            <div className="timeline-content">
                                                <div className="timeline-top">
                                                    <span className="timeline-date">{formatReadableDate(v.visit_date)}</span>
                                                    {visitStatus === 'next-after-attended' && <span className="timeline-badge-next">Next Appointment</span>}
                                                    <div className="timeline-meta-row">
                                                        <span className="timeline-type">Visit #{v.visit_number}</span>
                                                        <span className="timeline-tag">{getOrdinalSuffix(v.trimester)} Trim.</span>
                                                    </div>
                                                </div>
                                                {v.status === 'Attended' && (
                                                    <div className="timeline-vitals-grid">
                                                        {v.bp_systolic && v.bp_diastolic && (
                                                            <div className="vital-chip">
                                                                <Shield size={10} />
                                                                <span className="vital-label">BP:</span> {v.bp_systolic}/{v.bp_diastolic} mmHg
                                                            </div>
                                                        )}
                                                        {v.weight_kg && (
                                                            <div className="vital-chip">
                                                                <Scale size={10} />
                                                                <span className="vital-label">Weight:</span> {v.weight_kg}kg
                                                            </div>
                                                        )}
                                                        {v.height_cm && (
                                                            <div className="vital-chip">
                                                                <Ruler size={10} />
                                                                <span className="vital-label">Height:</span> {v.height_cm}cm
                                                            </div>
                                                        )}
                                                        {v.temp_c && (
                                                            <div className="vital-chip">
                                                                <Thermometer size={10} />
                                                                <span className="vital-label">Temp:</span> {v.temp_c}°C
                                                            </div>
                                                        )}
                                                        {v.pulse_bpm && (
                                                            <div className="vital-chip">
                                                                <Heart size={10} />
                                                                <span className="vital-label">Pulse:</span> {v.pulse_bpm} bpm
                                                            </div>
                                                        )}
                                                        {v.resp_rate_cpm && (
                                                            <div className="vital-chip">
                                                                <Wind size={10} />
                                                                <span className="vital-label">Resp:</span> {v.resp_rate_cpm} cpm
                                                            </div>
                                                        )}
                                                        {v.fundal_height_cm && (
                                                            <div className="vital-chip">
                                                                <Ruler size={10} />
                                                                <span className="vital-label">FH:</span> {v.fundal_height_cm}cm
                                                            </div>
                                                        )}
                                                        {v.fhr_bpm && (
                                                            <div className="vital-chip">
                                                                <Activity size={10} />
                                                                <span className="vital-label">FHR:</span> {v.fhr_bpm} bpm
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {(v.fetal_movement || v.presentation || (v.tests_done && v.tests_done.length > 0) || v.clinical_notes || v.advice_given) && (
                                                    <div className="timeline-details-grid">
                                                        {v.fetal_movement && (
                                                            <div className="detail-item">
                                                                <span className="detail-label">Fetal Movement:</span>
                                                                <span className="detail-value">{v.fetal_movement}</span>
                                                            </div>
                                                        )}
                                                        {v.presentation && (
                                                            <div className="detail-item">
                                                                <span className="detail-label">Presentation:</span>
                                                                <span className="detail-value">{v.presentation}</span>
                                                            </div>
                                                        )}
                                                        {v.tests_done && v.tests_done.length > 0 && (
                                                            <div className="detail-item">
                                                                <span className="detail-label">Tests Done:</span>
                                                                <span className="detail-value">{v.tests_done.join(', ')}</span>
                                                            </div>
                                                        )}
                                                        {v.clinical_notes && (
                                                            <div className="detail-item full-width">
                                                                <span className="detail-label">Clinical Notes:</span>
                                                                <span className="detail-value">{v.clinical_notes}</span>
                                                            </div>
                                                        )}
                                                        {v.advice_given && (
                                                            <div className="detail-item full-width">
                                                                <span className="detail-label">Advice Given:</span>
                                                                <span className="detail-value">{v.advice_given}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {v.status !== 'Attended' && (
                                                    <div className="timeline-status">
                                                        Status: {v.status}
                                                        {v.missed_reason && <span> - {v.missed_reason}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })() : (
                                <div className="empty-state-mini">
                                    <CalendarCheck size={32} />
                                    <p>No prenatal visits recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- DISTRIBUTION RECORDS --- */}
                {activeTab === 'vaccines' && (
                    <div className="info-grid animate-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
                        {/* Administered Vaccines Card */}
                        <div className="info-card" style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #edf2f7', padding: '28px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ backgroundColor: '#fff0f3', padding: '12px', borderRadius: '14px', color: '#b9818a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Syringe size={22} />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Administered Vaccines</h3>
                            </div>
                            
                            {p.vaccines.length > 0 ? (
                                <div style={{ overflowX: 'auto', flex: 1 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '0 16px 16px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '2px solid #f1f5f9' }}>Vaccine Name</th>
                                                <th style={{ padding: '0 16px 16px 16px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '2px solid #f1f5f9' }}>Dose</th>
                                                <th style={{ padding: '0 16px 16px 16px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '2px solid #f1f5f9' }}>Date Given</th>
                                                <th style={{ padding: '0 0 16px 16px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '2px solid #f1f5f9', textAlign: 'right' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {p.vaccines.map((v, i) => {
                                                const status = v.status || (v.vaccinated_date ? 'Completed' : 'Pending');
                                                const statusColor = status === 'Completed' ? '#059669' : '#d97706';
                                                const statusBg = status === 'Completed' ? '#d1fae5' : '#fef3c7';
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                        <td style={{ padding: '20px 16px 20px 0', fontSize: '14px', color: '#0f172a', fontWeight: '600', maxWidth: '180px', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4' }}>{v.vaccine_name}</td>
                                                        <td style={{ padding: '20px 16px', fontSize: '14px', color: '#475569', fontWeight: '500' }}>{v.dose_number}</td>
                                                        <td style={{ padding: '20px 16px', fontSize: '14px', color: '#475569', fontWeight: '500' }}>{v.vaccinated_date || v.scheduled_vaccination}</td>
                                                        <td style={{ padding: '20px 0 20px 16px', textAlign: 'right' }}>
                                                            <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '24px', fontSize: '12px', fontWeight: '700', backgroundColor: statusBg, color: statusColor, letterSpacing: '0.3px' }}>{status}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0' }}>
                                    <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>No vaccines administered yet.</p>
                                </div>
                            )}
                        </div>

                        {/* Supplement Distribution Card */}
                        <div className="info-card" style={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #edf2f7', padding: '28px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ backgroundColor: '#fff0f3', padding: '12px', borderRadius: '14px', color: '#b9818a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Pill size={22} />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Supplement Distribution</h3>
                            </div>
                            
                            {p.supplements.length > 0 ? (
                                <div style={{ overflowX: 'auto', flex: 1 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '0 16px 16px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '2px solid #f1f5f9' }}>Supplement</th>
                                                <th style={{ padding: '0 16px 16px 16px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '2px solid #f1f5f9' }}>Dosage</th>
                                                <th style={{ padding: '0 16px 16px 16px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '2px solid #f1f5f9' }}>Start Date</th>
                                                <th style={{ padding: '0 0 16px 16px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '2px solid #f1f5f9', textAlign: 'right' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {p.supplements.map((s, i) => {
                                                const status = s.status || 'Ongoing';
                                                const statusColor = status === 'Completed' ? '#059669' : '#0284c7';
                                                const statusBg = status === 'Completed' ? '#d1fae5' : '#e0f2fe';
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                        <td style={{ padding: '20px 16px 20px 0', fontSize: '14px', color: '#0f172a', fontWeight: '600', maxWidth: '180px', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4' }}>{s.supplement_name}</td>
                                                        <td style={{ padding: '20px 16px', fontSize: '14px', color: '#475569', fontWeight: '500' }}>{s.dosage}</td>
                                                        <td style={{ padding: '20px 16px', fontSize: '14px', color: '#475569', fontWeight: '500' }}>{s.start_date}</td>
                                                        <td style={{ padding: '20px 0 20px 16px', textAlign: 'right' }}>
                                                            <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '24px', fontSize: '12px', fontWeight: '700', backgroundColor: statusBg, color: statusColor, letterSpacing: '0.3px' }}>{status}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0' }}>
                                    <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>No supplements distributed yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- DELIVERY & POSTPARTUM --- */}
                {activeTab === 'delivery' && (
                    <div className="animate-fade">
                        {(p.deliveries && p.deliveries.length > 0) || p.pregnancyStatus === 'Postpartum' ? (
                            <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e8e0e4', padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                                {/* Header row: icon + title + status badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                    <div style={{ backgroundColor: '#fff0f3', padding: '10px', borderRadius: '10px', color: '#b9818a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Activity size={20} />
                                    </div>
                                    <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Delivery Records</h3>
                                    {p.pregnancyStatus === 'Postpartum' && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', color: '#059669', padding: '5px 12px', borderRadius: '20px', fontWeight: '600', fontSize: '12px', marginLeft: '4px' }}>
                                            <CheckCircle2 size={14} />
                                            Patient is in Postpartum Recovery
                                        </span>
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{ height: '1px', backgroundColor: '#f1ecee', marginBottom: '20px' }} />

                                {/* Delivery data grid */}
                                {p.deliveries && p.deliveries.length > 0 ? (
                                    p.deliveries.map((delivery, i) => (
                                        <div key={i} style={{ marginBottom: i === p.deliveries.length - 1 ? 0 : '20px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0' }}>
                                                <div style={{ padding: '0 12px 0 0' }}>
                                                    <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Delivery Date</label>
                                                    <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{delivery.delivery_date || 'N/A'}</p>
                                                </div>
                                                <div style={{ padding: '0 12px' }}>
                                                    <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Type</label>
                                                    <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{delivery.delivery_type || 'N/A'}</p>
                                                </div>
                                                <div style={{ padding: '0 12px' }}>
                                                    <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Mode</label>
                                                    <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{delivery.delivery_mode || 'N/A'}</p>
                                                </div>
                                                <div style={{ padding: '0 12px' }}>
                                                    <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Gestational Age</label>
                                                    <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{delivery.gestational_age || 'N/A'}</p>
                                                </div>
                                                <div style={{ padding: '0 12px' }}>
                                                    <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Risk Level</label>
                                                    <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{(delivery.risk_level || 'Normal').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</p>
                                                </div>
                                                <div style={{ padding: '0 0 0 12px' }}>
                                                    <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Facility</label>
                                                    <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{delivery.facility || 'N/A'}</p>
                                                </div>
                                            </div>
                                            {delivery.complications && delivery.complications.length > 0 && (
                                                <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                                                    <label style={{ fontSize: '10.5px', color: '#b91c1c', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Complications</label>
                                                    <p style={{ margin: '4px 0 0', color: '#991b1b', fontSize: '13px', fontWeight: '500' }}>{Array.isArray(delivery.complications) ? delivery.complications.join(', ') : delivery.complications}</p>
                                                </div>
                                            )}
                                            {(delivery.postpartum_visit_date || delivery.postpartum_attended_date) && (
                                                <div style={{ marginTop: '16px', padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #b9818a' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                                        <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Postpartum Follow-up</label>
                                                        <span style={{ fontSize: '12px', fontWeight: '700', color: getPostpartumStatus(delivery) === 'Completed' ? '#059669' : getPostpartumStatus(delivery) === 'Missed' ? '#dc2626' : '#b45309' }}>
                                                            {getPostpartumStatus(delivery)}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '13px' }}>
                                                        Scheduled: {formatReadableDate(delivery.postpartum_visit_date)}
                                                        {delivery.postpartum_attended_date && ` · Attended: ${formatReadableDate(delivery.postpartum_attended_date)}`}
                                                    </p>
                                                    {delivery.postpartum_remarks?.personnel_present?.name && (
                                                        <p style={{ margin: '5px 0 0', color: '#475569', fontSize: '13px' }}>
                                                            Personnel present: {delivery.postpartum_remarks.personnel_present.name}
                                                        </p>
                                                    )}
                                                    {delivery.postpartum_remarks?.assessment && (
                                                        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '12px' }}>
                                                            Assessment recorded: {Object.values(delivery.postpartum_remarks.assessment).filter(Boolean).length} field(s)
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading delivery records...</p>
                                )}
                            </div>
                        ) : (
                            <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e8e0e4', padding: '48px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', textAlign: 'center' }}>
                                <div style={{ color: '#c4b5ba', marginBottom: '16px' }}>
                                    <Activity size={40} />
                                </div>
                                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>No Delivery Records</h3>
                                <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '380px', margin: '0 auto 20px', lineHeight: '1.5' }}>Patient is currently in the prenatal stage. Delivery records will appear here after the birth event is recorded.</p>
                                <button className="btn btn-outline" onClick={() => navigate('/dashboard/deliveries')} style={{ padding: '8px 20px', fontWeight: '600', borderRadius: '8px', fontSize: '13px' }}>
                                    Go to Delivery Outcomes
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* --- NEWBORNS --- */}
                {activeTab === 'newborn' && (
                    <div className="animate-fade">
                        {p.newborns.length > 0 ? (
                            p.newborns.map((baby, i) => (
                                <div key={i} style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e8e0e4', padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', marginBottom: i === p.newborns.length - 1 ? 0 : '16px' }}>
                                    {/* Header row: icon + title ... button */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ backgroundColor: '#fff0f3', padding: '10px', borderRadius: '10px', color: '#b9818a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Baby size={20} />
                                            </div>
                                            <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Newborn Records</h3>
                                        </div>
                                        <button className="btn btn-outline" onClick={() => navigate('/dashboard/newborns')} style={{ padding: '7px 18px', fontWeight: '600', borderRadius: '8px', fontSize: '13px', flexShrink: 0 }}>
                                            View Newborn Records
                                        </button>
                                    </div>

                                    {/* Divider */}
                                    <div style={{ height: '1px', backgroundColor: '#f1ecee', marginBottom: '20px' }} />

                                    {/* Newborn data grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0' }}>
                                        <div style={{ padding: '0 12px 0 0' }}>
                                            <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Newborn Name</label>
                                            <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{baby.baby_name || 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '0 12px' }}>
                                            <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Date of Birth</label>
                                            <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{baby.birth_date || 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '0 12px' }}>
                                            <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Sex</label>
                                            <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{baby.gender || 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '0 12px' }}>
                                            <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Weight</label>
                                            <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{baby.birth_weight ? `${baby.birth_weight} kg` : 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '0 0 0 12px' }}>
                                            <label style={{ fontSize: '10.5px', color: '#8a7f83', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>Condition</label>
                                            <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '14px', lineHeight: '1.3' }}>{baby.condition || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e8e0e4', padding: '48px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', textAlign: 'center' }}>
                                <div style={{ color: '#c4b5ba', marginBottom: '16px' }}>
                                    <Baby size={40} />
                                </div>
                                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>No Newborns Registered</h3>
                                <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '380px', margin: '0 auto', lineHeight: '1.5' }}>There are no newborns associated with this patient's record yet.</p>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {editModalOpen && (
                <EditPatientModal 
                    patient={p}
                    onClose={() => setEditModalOpen(false)}
                    onSave={handlePatientUpdate}
                />
            )}
        </div>
    );
};
/*
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
);*/

export default PatientProfile;