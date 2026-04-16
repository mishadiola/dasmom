import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Printer, Download, Edit,
    Activity, Syringe, Baby, HeartPulse,
    CalendarCheck, User, MapPin, Phone,
    AlertTriangle, CheckCircle2, Clock, History,
    Shield, Mail, Home, FileText, Pill, Scale
} from 'lucide-react';
import '../../styles/pages/PatientProfile.css';
import PatientService from '../../services/patientservice';
import EditPatientModal from '../../components/Patient/EditPatientModal';

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
    const [editModalOpen, setEditModalOpen] = useState(false);

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
                    <p class="patient-info">Patient ID: ${p.id} | Age: ${p.age} years | Station: ${p.station}</p>
                    <p class="patient-info">Risk Level: <span class="risk-badge">${p.risk || 'Normal'}</span></p>
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
                            <span class="info-value">${p.edd || 'TBD'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">LMP:</span>
                            <span class="info-value">${p.lmp || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Risk Level:</span>
                            <span class="info-value">${p.risk || 'Normal'}</span>
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
                    <p class="patient-info">Patient ID: ${p.id} | Age: ${p.age} years | Station: ${p.station}</p>
                    <p class="patient-info">Prenatal Visits Schedule</p>
                    <p class="patient-info">Generated on: ${new Date().toLocaleDateString()}</p>
                </div>

                <div class="summary-info">
                    <p><strong>Total Visits:</strong> ${p.visits ? p.visits.length : 0}</p>
                    <p><strong>Current Trimester:</strong> ${p.trimester || 'N/A'}</p>
                    <p><strong>Weeks of Pregnancy:</strong> ${p.weeks || 'N/A'} weeks</p>
                    <p><strong>Expected Due Date:</strong> ${p.edd || 'N/A'}</p>
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
                            ID: {p.id.slice(0, 8)}... · {p.age} years old · <MapPin size={12} /> {p.station}
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
                        <button className="btn btn-outline" title="Print Record" onClick={handlePrintProfile}><Printer size={16} /></button>
                        <button className="btn btn-outline" title="Edit Patient" onClick={handleEditPatient}><Edit size={16} /></button>
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
                                        <span>{p.id.split('-')[0].toUpperCase()}</span>
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
                                            <span className="gpa-value str">{p.risk || 'Normal'}</span>
                                            <span className="gpa-sub">Calculated</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card: Conditions */}
                            <div className="modern-card">
                                <div className="modern-card-header">
                                    <div className="mc-icon orange-gradient"><AlertTriangle size={18} /></div>
                                    <h3>Pre-existing Conditions</h3>
                                </div>
                                <div className="mc-body">
                                    {p.medicalConditions?.length > 0 ? (
                                        <div className="modern-condition-tags">
                                            {p.medicalConditions.map(c => (
                                                <div key={c} className="modern-tag-pill">
                                                    <span className="tag-dot"></span>
                                                    {c}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-box">
                                            <CheckCircle2 size={24} className="text-success mb-2" />
                                            <p>No high-risk pre-existing conditions recorded.</p>
                                        </div>
                                    )}
                                    
                                    {p.otherMedicalNotes && (
                                        <div className="medical-notes-panel mt-4">
                                            <div className="notes-header">
                                                <FileText size={14} /> Additional Clinical Notes
                                            </div>
                                            <div className="notes-content">
                                                {p.otherMedicalNotes}
                                            </div>
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
                        {/* Hero Stats */}
                        <div className="tracking-hero-grid">
                            <div className="tracking-hero-card">
                                <span className="track-icon-wrap"><CalendarCheck size={24} /></span>
                                <div className="track-hero-content">
                                    <span className="track-hero-label">Estimated Due Date</span>
                                    <span className="track-hero-val">{p.edd || 'TBD'}</span>
                                    <span className="track-hero-sub">Based on LMP: {p.lmp || 'N/A'}</span>
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
                                    <span className="track-hero-val">{p.risk || 'Normal'}</span>
                                    <span className="track-hero-sub">{p.medicalConditions?.length || 0} Risk Factors Detected</span>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Progress Bar */}
                        <div className="tracking-progress-section">
                            <h3 className="tracking-section-title">Gestation Progress Tracking</h3>
                            <div className="progress-infographic">
                                <div className="progress-bar-bg">
                                    <div className="progress-fill" style={{ width: `${Math.min(100, (p.weeks / 40) * 100)}%` }}>
                                        <div className="progress-glow"></div>
                                    </div>
                                    
                                    {/* Markers */}
                                    <div className={`progress-marker ${p.weeks >= 0 ? 'reached' : ''}`} style={{ left: '0%' }}>
                                        <div className="marker-dot"></div>
                                        <span className="marker-label">T1 (Start)</span>
                                    </div>
                                    <div className={`progress-marker ${p.weeks >= 14 ? 'reached' : ''}`} style={{ left: '35%' }}>
                                        <div className="marker-dot"></div>
                                        <span className="marker-label">T2 (Week 14)</span>
                                    </div>
                                    <div className={`progress-marker ${p.weeks >= 28 ? 'reached' : ''}`} style={{ left: '70%' }}>
                                        <div className="marker-dot"></div>
                                        <span className="marker-label">T3 (Week 28)</span>
                                    </div>
                                    <div className={`progress-marker ${p.weeks >= 40 ? 'reached' : ''}`} style={{ left: '100%' }}>
                                        <div className="marker-dot"></div>
                                        <span className="marker-label">Term (Week 40)</span>
                                    </div>
                                </div>
                            </div>
                            <p className="progress-note">
                                Patient is currently at <strong>{p.weeks} weeks</strong>. Ensure all scheduled prenatal visits for Trimester {p.trimester} are completed on time.
                            </p>
                        </div>

                        {/* Additional Details */}
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
                                
                                // Find the next upcoming appointment
                                const nextAppointmentIndex = sortedVisits.findIndex(v => new Date(v.visit_date) >= today);
                                
                                return sortedVisits.map((v, i) => {
                                    const visitDate = new Date(v.visit_date);
                                    visitDate.setHours(0, 0, 0, 0);
                                    
                                    let visitStatus = 'future';
                                    if (visitDate < today) {
                                        visitStatus = 'past';
                                    } else if (i === nextAppointmentIndex) {
                                        visitStatus = 'next';
                                    }
                                    
                                    return (
                                        <div className={`timeline-item timeline-item--${visitStatus}`} key={i}>
                                            <div className={`timeline-dot ${visitStatus === 'past' ? 'completed' : visitStatus === 'next' ? 'next' : 'upcoming'}`}></div>
                                            <div className="timeline-content">
                                                <div className="timeline-top">
                                                    <span className="timeline-date">{formatReadableDate(v.visit_date)}</span>
                                                    {visitStatus === 'next' && <span className="timeline-badge-next">Next Appointment</span>}
                                                    <div className="timeline-meta-row">
                                                        <span className="timeline-type">Visit #{v.visit_number}</span>
                                                        <span className="timeline-tag">{getOrdinalSuffix(v.trimester)} Trim.</span>
                                                    </div>
                                                </div>
                                                { v.bp && (
                                                    <div className="timeline-vitals">
                                                        <Shield size={12} /> {v.bp}
                                                        <Scale size={12} /> {v.weight}kg
                                                        <Activity size={12} /> {v.fht || 'N/A'} bpm
                                                    </div>
                                                )}
                                                {v.notes && <p className="timeline-notes">{v.notes}</p>}
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