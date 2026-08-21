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
import { formatMotherId } from '../../utils/displayIds';

const ScheduledVisitModal = ({ visit, onClose }) => {
    const navigate = useNavigate();
    const patientService = useMemo(() => new PatientService(), []);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [patientVisits, setPatientVisits] = useState([]);
    const [loadingVisits, setLoadingVisits] = useState(true);
    const [patientStation, setPatientStation] = useState('');

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

    // Fetch patient station
    useEffect(() => {
        const fetchPatientStation = async () => {
            if (!visit?.patientId) return;
            try {
                const { data, error } = await supabase
                    .from('patient_basic_info')
                    .select('station')
                    .eq('id', visit.patientId)
                    .single();
                
                if (data?.station) {
                    setPatientStation(data.station);
                }
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
                        <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                            onClick={() => navigate(`/dashboard/prenatal/add/${visit.patientId}`)}
                            title="Record Prenatal Visit"
                        >
                            <Plus size={18} style={{ marginRight: '8px' }} /> Record Prenatal Visit
                        </button>
                    </div>

                    {/* Visit Details */}
                    <div className="sv-section">
                        <h3 className="sv-section-title">Visit Details</h3>
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
                                    <MapPin size={16} /> {patientStation || visit.location || 'CHO 3'}
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

                    {/* Secondary Actions */}
                    <div className="sv-section" style={{ display: 'flex', gap: '10px', borderBottom: isHistoryExpanded ? '1px solid #eee' : 'none' }}>
                        <button 
                            className="btn btn-outline"
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                            title="View Visit History"
                        >
                            <Activity size={14} style={{ marginRight: '8px' }} /> {isHistoryExpanded ? 'Hide History' : 'View History'}
                        </button>
                        <button 
                            className="btn btn-outline"
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => navigate(`/dashboard/patients/${visit.patientId}`)}
                            title="View Patient Profile"
                        >
                            <Users size={14} style={{ marginRight: '8px' }} /> View Profile
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
            </div>
        </div>
    );
};

export default ScheduledVisitModal;
