import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, Calendar, Clock, MapPin, User, FileText, 
    CheckCircle2, AlertCircle, ExternalLink, Plus, 
    Activity, Users, Syringe, ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PatientService from '../../services/patientservice';
import '../../styles/components/ScheduledVisitModal.css';
import supabase from '../../config/supabaseclient';
import { formatMotherId } from '../../utils/displayIds';
import VisitScheduleManager from '../VisitScheduleManager';

const ScheduledVisitModal = ({ visit, onClose, onScheduleChanged }) => {
    const navigate = useNavigate();
    const patientService = useMemo(() => new PatientService(), []);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [patientVisits, setPatientVisits] = useState([]);
    const [loadingVisits, setLoadingVisits] = useState(true);
    const [patientStation, setPatientStation] = useState('');
    const [showScheduleManager, setShowScheduleManager] = useState(false);

    if (!visit) return null;

    const isPostpartum = visit.type === 'Postpartum' || visit.visitType === 'Postpartum' || visit.notes === 'Postpartum follow-up';

    // Fetch patient visit history
    useEffect(() => {
        const fetchPatientVisits = async () => {
            try {
                if (isPostpartum) {
                    const { data, error } = await supabase
                        .from('postpartum_visits')
                        .select('*')
                        .eq('patient_id', visit.patientId)
                        .order('scheduled_at', { ascending: false });
                    
                    if (error) throw error;
                    const normalized = (data || []).map(v => ({
                        ...v,
                        visit_date: v.attended_date || v.scheduled_at,
                        visit_number: v.visit_type
                    }));
                    setPatientVisits(normalized);
                } else {
                    const { data, error } = await supabase
                        .from('prenatal_visits')
                        .select('*')
                        .eq('patient_id', visit.patientId)
                        .order('visit_date', { ascending: false });
                    
                    if (error) throw error;
                    setPatientVisits(data || []);
                }
            } catch (error) {
                console.error('Error fetching patient visits:', error);
            } finally {
                setLoadingVisits(false);
            }
        };
        
        if (visit.patientId) fetchPatientVisits();
    }, [visit.patientId, isPostpartum]);

    // Fetch patient station
    useEffect(() => {
        const fetchPatientStation = async () => {
            if (!visit?.patientId) return;
            try {
                const { data, error } = await supabase
                    .from('patient_basic_info')
                    .select('station_ass, stations:station_ass (station_name)')
                    .eq('id', visit.patientId)
                    .maybeSingle();
                if (error) throw error;
                setPatientStation(data?.stations?.station_name || '');
            } catch (error) {
                console.error('Error fetching patient station:', error);
            }
        };
        
        fetchPatientStation();
    }, [visit]);



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

    const formatVisitDateTime = (dateVal, timeVal) => {
        if (!dateVal || dateVal === 'N/A' || dateVal === 'None' || dateVal === 'Not scheduled') {
            return { date: 'Not scheduled', time: null };
        }
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) {
            return { date: String(dateVal), time: timeVal || null };
        }
        const dateStr = d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        let timeStr = timeVal || null;
        if (!timeStr && typeof dateVal === 'string' && (dateVal.includes('T') || dateVal.includes(':'))) {
            timeStr = d.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
        return { date: dateStr, time: timeStr };
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

    return createPortal(
        <div className="sv-modal-overlay" onClick={onClose}>
            <div className="sv-modal" onClick={e => e.stopPropagation()}>
                {/* ── Sticky Header ── */}
                <div className="sv-modal-header">
                    <div className="sv-header-info">
                        <h2 onClick={() => navigate(`/dashboard/patients/${visit.patientId}`)}>
                            {visit.patientName} <ExternalLink size={16} />
                        </h2>
                        <div className="sv-header-meta">
                            <span>ID: {formatMotherId(visit.patientId || visit.motherId)}</span>
                            <span className="sv-type-tag">{visit.type || visit.visitType}</span>
                        </div>
                    </div>
                    <button className="sv-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* ── Scrollable Body ── */}
                <div className="sv-modal-body">
                    {/* Primary Action */}
                    <div className="sv-section" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                        {visit.type === 'Vaccination' ? (
                            <button 
                                className="btn btn-primary" 
                                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                                onClick={() => navigate('/dashboard/vaccinations', { 
                                    state: { 
                                        openRecordModal: true, 
                                        patientId: visit.patientId,
                                        patientName: visit.patientName,
                                        patientType: visit.patientType || 'Mother'
                                    } 
                                })}
                            >
                                <Syringe size={18} style={{ marginRight: '8px' }} /> Record Vaccination Visit
                            </button>
                        ) : isPostpartum ? (
                            <button 
                                className="btn btn-primary" 
                                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                                onClick={() => {
                                    onClose?.();
                                    navigate(`/dashboard/postpartum/add/${visit.patientId}`, {
                                        state: { visitId: visit.id, visit }
                                    });
                                }}
                            >
                                <ClipboardList size={18} style={{ marginRight: '8px' }} /> Record Postpartum Visit
                            </button>
                        ) : (
                            <button 
                                className="btn btn-primary" 
                                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                                onClick={() => navigate(`/dashboard/prenatal/add/${visit.patientId}`)}
                            >
                                <Plus size={18} style={{ marginRight: '8px' }} /> Record Prenatal Visit
                            </button>
                        )}
                    </div>

                    {/* Visit Details */}
                    <div className="sv-section">
                        <h3 className="sv-section-title">Visit Details</h3>
                        <div className="sv-details-grid">
                            {(() => {
                                const dt = formatVisitDateTime(visit.visitDate || visit.date || visit.scheduled_at, visit.time);
                                return (
                                    <div className="sv-field">
                                        <label className="sv-label">Scheduled Date & Time</label>
                                        <div className="sv-value">
                                            <Calendar size={16} /> {dt.date}
                                            {dt.time && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}><Clock size={16} /> {dt.time}</span>}
                                        </div>
                                    </div>
                                );
                            })()}
                            <div className="sv-field">
                                <label className="sv-label">Location / Facility</label>
                                <div className="sv-value">
                                    <MapPin size={16} /> {patientStation || visit.location || visit.assignedStation || 'Station not assigned'}
                                </div>
                            </div>
                            <div className="sv-field">
                                <label className="sv-label">Assigned Healthcare Worker</label>
                                <div className="sv-value">
                                    <User size={16} /> {visit.assignedStaff || 'Unassigned'}
                                </div>
                            </div>
                            <div className="sv-field">
                                <label className="sv-label">{isPostpartum ? 'Visit Type / Follow-up' : 'Gestational Age'}</label>
                                <div className="sv-value">
                                    {isPostpartum ? (visit.vaccineName || visit.visitType || 'Postpartum Follow-up') : (visit.ga || '28w 4d')}
                                </div>
                            </div>
                            <div className="sv-field">
                                <label className="sv-label">Health Conditions</label>
                                <div className="sv-value">
                                    <span className={`sv-risk-badge ${visit.risk && !visit.risk.toLowerCase().includes('low') && !visit.risk.toLowerCase().includes('normal') ? 'sv-risk-high' : 'sv-risk-normal'}`}>
                                        {visit.risk && !visit.risk.toLowerCase().includes('low') && !visit.risk.toLowerCase().includes('normal') ? 'Documented Conditions' : 'None Reported'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {visit.reschedule_reason && (
                            <div className="sv-field" style={{ marginTop: '12px' }}>
                                <label className="sv-label">Reason for rescheduling</label>
                                <div className="sv-value">{visit.reschedule_reason}</div>
                            </div>
                        )}
                    </div>

                    {/* Secondary Actions */}
                    <div className="sv-section" style={{ display: 'flex', gap: '10px', borderBottom: isHistoryExpanded ? '1px solid #eee' : 'none' }}>
                        <button 
                            className="btn btn-outline"
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        >
                            <Activity size={14} style={{ marginRight: '8px' }} /> {isHistoryExpanded ? 'Hide History' : 'View History'}
                        </button>
                        <button 
                            className="btn btn-outline"
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => navigate(`/dashboard/patients/${visit.patientId}`)}
                        >
                            <Users size={14} style={{ marginRight: '8px' }} /> View Profile
                        </button>
                        <button
                            className="btn btn-outline"
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => setShowScheduleManager(true)}
                        >
                            <Calendar size={14} style={{ marginRight: '8px' }} /> Manage Schedule
                        </button>
                    </div>

                    {/* Visit History Section (Expandable) */}
                    {isHistoryExpanded && (
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
                    )}
                </div>
                {showScheduleManager && (
                    <VisitScheduleManager
                        patientId={visit.patientId}
                        onClose={() => setShowScheduleManager(false)}
                        onChanged={onScheduleChanged}
                    />
                )}
            </div>
        </div>,
        document.body
    );
};

export default ScheduledVisitModal;
