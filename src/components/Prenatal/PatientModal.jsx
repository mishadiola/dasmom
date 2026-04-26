import React, { useState, useEffect, useMemo } from 'react';
import { X, User, Calendar, Heart, Activity, MapPin, Phone, Mail, Baby, Clock, Thermometer, Weight, Ruler } from 'lucide-react';
import PatientService from '../../services/patientservice';
import '../../styles/components/ScheduledVisitModal.css'; // reuse styles

const PatientModal = ({ patientId, onClose }) => {
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const patientService = useMemo(() => new PatientService(), []);

    useEffect(() => {
        const fetchPatient = async () => {
            try {
                const data = await patientService.getPatientById(patientId);
                setPatient(data);
            } catch (error) {
                console.error('Error fetching patient:', error);
            } finally {
                setLoading(false);
            }
        };
        if (patientId) fetchPatient();
    }, [patientId, patientService]);

    if (loading) return <div className="modal-overlay"><div className="modal-content loading">Loading patient details...</div></div>;
    if (!patient) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const isUpcoming = (visitDate) => {
        return new Date(visitDate) > new Date();
    };

    const sortedVisits = patient.visits ? [...patient.visits].sort((a, b) => {
        const aUpcoming = isUpcoming(a.visit_date);
        const bUpcoming = isUpcoming(b.visit_date);
        
        // Upcoming visits first
        if (aUpcoming && !bUpcoming) return -1;
        if (!aUpcoming && bUpcoming) return 1;
        
        // Within the same category, sort by date (nearest first for upcoming, most recent for past)
        return new Date(a.visit_date) - new Date(b.visit_date);
    }) : [];

    const upcomingVisits = sortedVisits.filter(v => isUpcoming(v.visit_date));
    const pastVisits = sortedVisits.filter(v => !isUpcoming(v.visit_date));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content patient-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><User size={24} /> {patient.name}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    {/* Patient Summary Card */}
                    <div className="patient-summary-card">
                        <div className="summary-header">
                            <div className="summary-avatar">
                                <User size={40} />
                            </div>
                            <div className="summary-info">
                                <h3>{patient.name}</h3>
                                <p>ID: {patient.id}</p>
                                <div className="summary-badges">
                                    <span className={`risk-badge risk-${patient.risk?.toLowerCase() || 'normal'}`}>{patient.risk || 'Normal'}</span>
                                    <span className="trimester-badge">Trimester {patient.trimester}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visit History */}
                    <div className="visits-section">
                        <h3><Activity size={18} /> Visit History</h3>
                        <div className="visits-list">
                            {sortedVisits.length > 0 ? (
                                <>
                                    {upcomingVisits.length > 0 && (
                                        <>
                                            <div className="visit-section-label">Upcoming Visits</div>
                                            {upcomingVisits.map(visit => (
                                                <div key={visit.id} className={`visit-card visit-${visit.status?.toLowerCase()}`}>
                                                    <div className="visit-header">
                                                        <div className="visit-date">{formatDate(visit.visit_date)}</div>
                                                        <div className={`visit-status status-${visit.status?.toLowerCase()}`}>{visit.status}</div>
                                                    </div>
                                                    <div className="visit-details">
                                                        <div className="visit-meta">
                                                            <span>Visit #{visit.visit_number}</span>
                                                            <span>{visit.gestational_age}</span>
                                                        </div>
                                                        {visit.bp_systolic && (
                                                            <div className="vital">
                                                                <Activity size={14} />
                                                                BP: {visit.bp_systolic}/{visit.bp_diastolic} mmHg
                                                            </div>
                                                        )}
                                                        {visit.weight_kg && (
                                                            <div className="vital">
                                                                <Weight size={14} />
                                                                Weight: {visit.weight_kg} kg
                                                            </div>
                                                        )}
                                                        {visit.temp_c && (
                                                            <div className="vital">
                                                                <Thermometer size={14} />
                                                                Temp: {visit.temp_c}°C
                                                            </div>
                                                        )}
                                                        {visit.fundal_height_cm && (
                                                            <div className="vital">
                                                                <Ruler size={14} />
                                                                Fundal Height: {visit.fundal_height_cm} cm
                                                            </div>
                                                        )}
                                                        {visit.clinical_notes && (
                                                            <div className="visit-notes">
                                                                <strong>Notes:</strong> {visit.clinical_notes}
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
                                            {pastVisits.map(visit => (
                                                <div key={visit.id} className={`visit-card visit-${visit.status?.toLowerCase()}`}>
                                                    <div className="visit-header">
                                                        <div className="visit-date">{formatDate(visit.visit_date)}</div>
                                                        <div className={`visit-status status-${visit.status?.toLowerCase()}`}>{visit.status}</div>
                                                    </div>
                                                    <div className="visit-details">
                                                        <div className="visit-meta">
                                                            <span>Visit #{visit.visit_number}</span>
                                                            <span>{visit.gestational_age}</span>
                                                        </div>
                                                        {visit.bp_systolic && (
                                                            <div className="vital">
                                                                <Activity size={14} />
                                                                BP: {visit.bp_systolic}/{visit.bp_diastolic} mmHg
                                                            </div>
                                                        )}
                                                        {visit.weight_kg && (
                                                            <div className="vital">
                                                                <Weight size={14} />
                                                                Weight: {visit.weight_kg} kg
                                                            </div>
                                                        )}
                                                        {visit.temp_c && (
                                                            <div className="vital">
                                                                <Thermometer size={14} />
                                                                Temp: {visit.temp_c}°C
                                                            </div>
                                                        )}
                                                        {visit.fundal_height_cm && (
                                                            <div className="vital">
                                                                <Ruler size={14} />
                                                                Fundal Height: {visit.fundal_height_cm} cm
                                                            </div>
                                                        )}
                                                        {visit.clinical_notes && (
                                                            <div className="visit-notes">
                                                                <strong>Notes:</strong> {visit.clinical_notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="no-visits">
                                    <Calendar size={48} />
                                    <p>No visits recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientModal;