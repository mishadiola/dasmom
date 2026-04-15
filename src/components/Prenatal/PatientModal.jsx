import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Heart, Activity, MapPin, Phone, Mail } from 'lucide-react';
import PatientService from '../../services/patientservice';
import '../../styles/components/ScheduledVisitModal.css'; // reuse styles

const PatientModal = ({ patientId, onClose }) => {
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const patientService = new PatientService();

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
    }, [patientId]);

    if (loading) return <div className="modal-overlay"><div className="modal-content">Loading...</div></div>;
    if (!patient) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><User size={20} /> Patient Details</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <div className="patient-info-section">
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Name:</label>
                                <span>{patient.name}</span>
                            </div>
                            <div className="info-item">
                                <label>ID:</label>
                                <span>{patient.id}</span>
                            </div>
                            <div className="info-item">
                                <label>Age:</label>
                                <span>{patient.age}</span>
                            </div>
                            <div className="info-item">
                                <label>Station:</label>
                                <span>{patient.station}</span>
                            </div>
                            <div className="info-item">
                                <label>Phone:</label>
                                <span>{patient.phone}</span>
                            </div>
                            <div className="info-item">
                                <label>Risk Level:</label>
                                <span className={`risk-tag risk-${patient.risk?.toLowerCase()}`}>{patient.risk}</span>
                            </div>
                            <div className="info-item">
                                <label>LMP:</label>
                                <span>{patient.lmp}</span>
                            </div>
                            <div className="info-item">
                                <label>EDD:</label>
                                <span>{patient.edd}</span>
                            </div>
                            <div className="info-item">
                                <label>Trimester:</label>
                                <span>{patient.trimester}</span>
                            </div>
                            <div className="info-item">
                                <label>Weeks:</label>
                                <span>{patient.weeks}</span>
                            </div>
                        </div>
                    </div>
                    <div className="visits-section">
                        <h3><Calendar size={18} /> Visit Schedule</h3>
                        <div className="visits-list">
                            {patient.visits && patient.visits.length > 0 ? (
                                patient.visits.map(visit => (
                                    <div key={visit.id} className="visit-item">
                                        <div className="visit-date">{visit.visit_date}</div>
                                        <div className="visit-details">
                                            Visit #{visit.visit_number} - {visit.status}
                                            {visit.bp_systolic && <span> BP: {visit.bp_systolic}/{visit.bp_diastolic}</span>}
                                            {visit.weight_kg && <span> Weight: {visit.weight_kg}kg</span>}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p>No visits scheduled.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientModal;