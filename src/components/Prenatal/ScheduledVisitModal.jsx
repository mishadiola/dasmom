import React, { useState } from 'react';
import { 
    X, Calendar, Clock, MapPin, User, FileText, 
    Activity, Send, Printer, CheckCircle2, 
    AlertCircle, RefreshCcw, SidebarClose,
    ExternalLink, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PatientService from '../../services/patientservice';
import '../../styles/components/ScheduledVisitModal.css';

const ScheduledVisitModal = ({ visit, onClose }) => {
    const navigate = useNavigate();
    const patientService = new PatientService();
    const [status, setStatus] = useState(visit.status || 'Upcoming');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!visit) return null;

    const handleStatusChange = (newStatus) => {
        setStatus(newStatus);
    };

    const handleSave = async () => {
        const updates = {
            status,
            clinical_notes: notes.trim() || null,  // Your fix
            attended_date: status === 'Attended' ? new Date().toISOString() : visit.attended_date,
            missed_reason: status === 'Missed' ? notes || null : null
        };

        // 🆕 ADD THIS LOG - see exact payload before Supabase call
        console.log('🔄 Sending updates to Supabase:', {
            visitId: visit.id,
            updates,
            notesRaw: notes  // Raw textarea value
        });

        setIsSaving(true);
        try {
            const result = await patientService.updatePrenatalVisitStatus(visit.id, updates);
            
            // 🆕 ADD THIS LOG - see Supabase response
            console.log('✅ Update SUCCESS:', result);
        } catch (error) {
            // 🆕 ENHANCED ERROR LOG
            console.error('❌ Supabase ERROR:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                fullError: error
            });
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
                    {/* Visit Details Section */}
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

                    {/* Visit Status Section */}
                    <div className="sv-section">
                        <h3 className="sv-section-title">Visit Status & Outcome</h3>
                        <div className="sv-status-options">
                            {[
                                { label: 'Attended', icon: CheckCircle2, value: 'Attended', class: 'completed' },
                                { label: 'Missed', icon: AlertCircle, value: 'Missed', class: 'missed' },
                                { label: 'Cancelled', icon: SidebarClose, value: 'Cancelled', class: 'cancelled' }
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

                    {/* Quick Actions Section */}
                    <div className="sv-section">
                        <h3 className="sv-section-title">Quick Actions</h3>
                        <div className="sv-quick-actions">
                            <button className="sv-action-btn sv-btn-primary" onClick={() => navigate('/dashboard/patients')}>
                                <Activity size={16} /> Record Vitals
                            </button>
                            <button className="sv-action-btn sv-btn-outline">
                                <Send size={16} /> Send Reminder
                            </button>
                            <button className="sv-action-btn sv-btn-outline">
                                <Printer size={16} /> Print Record
                            </button>
                            <button className="sv-action-btn sv-btn-outline" onClick={() => navigate(`/dashboard/patients/${visit.patientId}`)}>
                                <User size={16} /> View Patient Profile
                            </button>
                        </div>
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
