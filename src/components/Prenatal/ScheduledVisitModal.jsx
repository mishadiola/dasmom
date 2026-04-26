import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Calendar, Clock, MapPin, User, FileText, 
    CheckCircle2, AlertCircle, ExternalLink, Plus, 
    Activity, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PatientService from '../../services/patientservice';
import '../../styles/components/ScheduledVisitModal.css';
import supabase from '../../config/supabaseclient';

const ScheduledVisitModal = ({ visit, onClose }) => {
    const navigate = useNavigate();
    const patientService = useMemo(() => new PatientService(), []);
    const [status, setStatus] = useState(visit.status || 'Upcoming');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [patientVisits, setPatientVisits] = useState([]);
    const [loadingVisits, setLoadingVisits] = useState(true);

    if (!visit) return null;

    // Fetch patient visit history
    useEffect(() => {
        const fetchPatientVisits = async () => {
            try {
                const { data, error } = await supabase
                    .from('prenatal_visits')
                    .select('*')
                    .eq('patient_id', visit.patientId)
                    .order('visit_date', { ascending: false });
                
                if (error) throw error;
                setPatientVisits(data || []);
            } catch (error) {
                console.error('Error fetching patient visits:', error);
            } finally {
                setLoadingVisits(false);
            }
        };
        
        if (visit.patientId) fetchPatientVisits();
    }, [visit.patientId]);

    const handleStatusChange = (newStatus) => {
        setStatus(newStatus);
    };

    const handleSave = async () => {
    const updates = {
        status,
        clinical_notes: notes.trim() || null,
        attended_date: status === 'Attended' ? new Date().toISOString().split('T')[0] : null,
    };
    
    setIsSaving(true);
    try {
        // 🔥 DIRECT SUPABASE - skips service cache issue
        const { data, error } = await supabase
            .from('prenatal_visits')
            .update(updates)
            .eq('id', visit.id)
            .select();
            
        if (error) throw error;
        console.log('✅ DIRECT UPDATE SUCCESS:', data);
    } catch (error) {
        console.error('❌ Supabase ERROR:', error);
    }
    setIsSaving(false);
    onClose();
};

    const getStatusClass = (s) => {
        switch (s.toLowerCase()) {
            case 'attended':
            case 'completed': return 'completed';
            case 'missed': return 'missed';
            case 'rescheduled': return 'rescheduled';
            case 'cancelled': return 'cancelled';
            default: return '';
        }
    };

    const getRiskClass = (risk) => {
        if (!risk) return 'sv-risk-normal';
        const r = risk.toLowerCase();
        if (r.includes('high')) return 'sv-risk-high';
        if (r.includes('monitor')) return 'sv-risk-monitor';
        return 'sv-risk-normal';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const isUpcoming = (visitDate) => {
        return new Date(visitDate) > new Date();
    };

    const sortedVisits = [...patientVisits].sort((a, b) => {
        const aUpcoming = isUpcoming(a.visit_date);
        const bUpcoming = isUpcoming(b.visit_date);
        
        // Upcoming visits first
        if (aUpcoming && !bUpcoming) return -1;
        if (!aUpcoming && bUpcoming) return 1;
        
        // Within the same category, sort by date (nearest first for upcoming, most recent for past)
        return new Date(a.visit_date) - new Date(b.visit_date);
    });

    const upcomingVisits = sortedVisits.filter(v => isUpcoming(v.visit_date));
    const pastVisits = sortedVisits.filter(v => !isUpcoming(v.visit_date));

    return (
        <div className="sv-modal-overlay" onClick={onClose}>
            <div className="sv-modal" onClick={e => e.stopPropagation()}>
                {/* ── Sticky Header ── */}
                <div className="sv-modal-header">
                    <div className="sv-header-info">
                        <h2 onClick={() => navigate(`/dashboard/patients/${visit.patientId}`)}>
                            {visit.patientName} <ExternalLink size={16} />
                        </h2>
                        <div className="sv-header-meta">
                            <span>ID: {visit.patientId || visit.motherId || 'PT-2026-N1'}</span>
                            <span className="sv-type-tag">{visit.type || visit.visitType}</span>
                        </div>
                    </div>
                    <button className="sv-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* ── Scrollable Body ── */}
                <div className="sv-modal-body">
                    {/* Action Buttons Section */}
                    <div className="sv-section">
                        <h3 className="sv-section-title">Actions</h3>
                        <div className="sv-action-buttons">
                            <button 
                                className="action-btn-text action-btn-primary" 
                                onClick={() => navigate(`/dashboard/prenatal/add/${visit.patientId}`)}
                                title="Record Prenatal Visit"
                            >
                                <Plus size={14} /> Record Visit
                            </button>
                            <button 
                                className="action-btn-text action-btn-secondary"
                                onClick={() => document.getElementById('visit-history').scrollIntoView({ behavior: 'smooth' })}
                                title="View Visit History"
                            >
                                <Activity size={14} /> View History
                            </button>
                            <button 
                                className="action-btn-text action-btn-accent"
                                onClick={() => navigate(`/dashboard/patients/${visit.patientId}`)}
                                title="View Patient Profile"
                            >
                                <Users size={14} /> View Profile
                            </button>
                        </div>
                    </div>

                    {/* Visit Status & Outcome Section */}
                    <div className="sv-section">
                        <h3 className="sv-section-title">Visit Status & Outcome</h3>
                        <div className="sv-status-options">
                            {[
                                { label: 'Attended', icon: CheckCircle2, value: 'Attended', class: 'completed' },
                                { label: 'Missed', icon: AlertCircle, value: 'Missed', class: 'missed' }
                            ].map(opt => (
                                <button 
                                    key={opt.value}
                                    className={`sv-status-btn ${status === opt.value ? `active ${opt.class}` : ''}`}
                                    onClick={() => handleStatusChange(opt.value)}
                                >
                                    <opt.icon size={18} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="sv-notes-field">
                            <label className="sv-label">Visit Notes / Remarks</label>
                            <textarea 
                                className="sv-textarea" 
                                placeholder="Add reasoning for status or follow-up instructions..."
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Visit Details */}
                    <div className="sv-section">
                        <div className="sv-details-grid">
                            <div className="sv-field">
                                <label className="sv-label">Scheduled Date & Time</label>
                                <div className="sv-value">
                                    <Calendar size={16} /> {visit.visitDate || visit.date}
                                    <Clock size={16} className="ml-2" /> {visit.time}
                                </div>
                            </div>
                            <div className="sv-field">
                                <label className="sv-label">Location / Facility</label>
                                <div className="sv-value">
                                    <MapPin size={16} /> {visit.location || 'Station Health Station'}
                                </div>
                            </div>
                            <div className="sv-field">
                                <label className="sv-label">Staff Assigned</label>
                                <div className="sv-value">
                                    <User size={16} /> {visit.midwife || visit.staff || 'Midwife Elena P.'}
                                </div>
                            </div>
                            <div className="sv-field">
                                <label className="sv-label">Maternal Risk Level</label>
                                <div className="sv-value">
                                    <span className={`sv-risk-badge ${getRiskClass(visit.risk)}`}>
                                        {visit.risk || 'Normal'}
                                    </span>
                                </div>
                            </div>
                            <div className="sv-field">
                                <label className="sv-label">Gestational Age</label>
                                <div className="sv-value">
                                    {visit.ga || '28w 4d'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visit History Section */}
                    <div className="sv-section" id="visit-history">
                        <h3 className="sv-section-title"><Activity size={18} /> Visit History</h3>
                        {loadingVisits ? (
                            <div className="loading-visits">Loading visit history...</div>
                        ) : sortedVisits.length > 0 ? (
                            <div className="sv-visit-history">
                                {upcomingVisits.length > 0 && (
                                    <>
                                        <div className="visit-section-label">Upcoming Visits</div>
                                        {upcomingVisits.map(v => (
                                            <div key={v.id} className={`visit-card visit-${v.status?.toLowerCase()}`}>
                                                <div className="visit-header">
                                                    <div className="visit-date">{formatDate(v.visit_date)}</div>
                                                    <div className={`visit-status status-${v.status?.toLowerCase()}`}>{v.status}</div>
                                                </div>
                                                <div className="visit-details">
                                                    <div className="visit-meta">
                                                        <span>Visit #{v.visit_number || 'N/A'}</span>
                                                        <span>{v.gestational_age || 'N/A'}</span>
                                                    </div>
                                                    {v.clinical_notes && (
                                                        <div className="visit-notes">
                                                            <strong>Notes:</strong> {v.clinical_notes}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {pastVisits.length > 0 && (
                                    <>
                                        <div className="visit-section-label">Past Visits</div>
                                        {pastVisits.map(v => (
                                            <div key={v.id} className={`visit-card visit-${v.status?.toLowerCase()}`}>
                                                <div className="visit-header">
                                                    <div className="visit-date">{formatDate(v.visit_date)}</div>
                                                    <div className={`visit-status status-${v.status?.toLowerCase()}`}>{v.status}</div>
                                                </div>
                                                <div className="visit-details">
                                                    <div className="visit-meta">
                                                        <span>Visit #{v.visit_number || 'N/A'}</span>
                                                        <span>{v.gestational_age || 'N/A'}</span>
                                                    </div>
                                                    {v.clinical_notes && (
                                                        <div className="visit-notes">
                                                            <strong>Notes:</strong> {v.clinical_notes}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="no-visits">
                                <Calendar size={48} />
                                <p>No visits recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="sv-modal-footer">
                    <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Update Visit Record'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScheduledVisitModal;
