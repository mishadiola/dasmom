import React, { useState, useEffect } from 'react';
import { 
    Baby, Heart, ShieldCheck, ChevronRight, Calendar, 
    MapPin, User, Stethoscope, Activity, X 
} from 'lucide-react';
import '../../styles/pages/PregnancyDeliveryInfo.css';
import AuthService from '../../services/authservice';
import { loadMotherPatient } from '../../services/motherOfflineService';

const PregnancyDeliveryInfo = () => {
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [pastPregnancies, setPastPregnancies] = useState([]);

    useEffect(() => {
        const loadDeliveries = async () => {
            const authUser = await new AuthService().getAuthUser();
            const patient = await loadMotherPatient(authUser);
            setPastPregnancies(patient?.deliveries || []);
        };
        loadDeliveries().catch((error) => console.error('Failed to load delivery records:', error));
    }, []);

    const formatDateBadge = (dateString) => {
        const date = new Date(dateString);
        return {
            month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
            day: date.getDate(),
            year: date.getFullYear()
        };
    };

    return (
        <div className="pdi-page">
            {/* ══════════════════════════════════════════════════
                PAGE HEADER
            ══════════════════════════════════════════════════ */}
            <div className="pdi-hero-card">
                <div className="pdi-hero-content">
                    <h1>Delivery Information</h1>
                    <p>View your previous pregnancy and delivery records</p>
                </div>
                <div className="pdi-hero-graphic">
                    <Heart size={48} className="pdi-hero-icon" />
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                DELIVERY HISTORY SECTION
            ══════════════════════════════════════════════════ */}
            <section className="pdi-section">
                <div className="pdi-section-header">
                    <h2>My Delivery History</h2>
                    <p>Your previous delivery records recorded by your healthcare team.</p>
                </div>

                <div className="pdi-history-summary">
                    <span className="pdi-summary-count">{pastPregnancies.length} Previous Deliveries</span>
                    <span className="pdi-summary-subtitle">Recorded by your healthcare team</span>
                </div>

                <div className="pdi-cards-list">
                    {pastPregnancies.length > 0 ? (
                        pastPregnancies.map((delivery) => {
                            const dateBadge = formatDateBadge(delivery.delivery_date);
                            
                            return (
                                <div 
                                    key={delivery.id} 
                                    className="pdi-delivery-card"
                                    onClick={() => setSelectedDelivery(delivery)}
                                >
                                    <div className="pdi-card-date-badge">
                                        <span className="pdi-badge-month">{dateBadge.month}</span>
                                        <span className="pdi-badge-day">{dateBadge.day}</span>
                                        <span className="pdi-badge-year">{dateBadge.year}</span>
                                    </div>
                                    
                                    <div className="pdi-card-main">
                                        <div className="pdi-card-header-row">
                                            <h3>{delivery.outcome}</h3>
                                            <span className="pdi-status-badge">{delivery.status}</span>
                                        </div>
                                        <p className="pdi-delivery-type">{delivery.delivery_type}</p>
                                        
                                        <div className="pdi-card-details">
                                            <div className="pdi-detail-item">
                                                <MapPin size={14} />
                                                <span>{delivery.health_station}</span>
                                            </div>
                                            <div className="pdi-detail-item">
                                                <Baby size={14} />
                                                <span>{delivery.baby_gender}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="pdi-card-arrow">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="pdi-empty-state">
                            <div className="pdi-empty-icon-wrap">
                                <Baby size={32} />
                            </div>
                            <h4>No delivery records yet</h4>
                            <p>Your previous delivery records will appear here once they have been recorded by your healthcare team.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══════════════════════════════════════════════════
                INFORMATION NOTE
            ══════════════════════════════════════════════════ */}
            <div className="pdi-info-card">
                <div className="pdi-info-icon-wrap">
                    <ShieldCheck size={20} />
                </div>
                <div className="pdi-info-content">
                    <h4>Your records are kept safe</h4>
                    <p>Your delivery information is recorded and managed by authorized DASMOM+ healthcare staff. You can view your records here anytime.</p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                DELIVERY DETAILS MODAL
            ══════════════════════════════════════════════════ */}
            {selectedDelivery && (
                <div className="pdi-modal-overlay" onClick={() => setSelectedDelivery(null)}>
                    <div className="pdi-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="pdi-modal-header">
                            <h2>Delivery Details</h2>
                            <button className="pdi-modal-close" onClick={() => setSelectedDelivery(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="pdi-modal-body">
                            <div className="pdi-modal-section">
                                <div className="pdi-modal-row">
                                    <div className="pdi-modal-field">
                                        <label><Calendar size={14} /> Delivery Date</label>
                                        <p>{new Date(selectedDelivery.delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                    </div>
                                    <div className="pdi-modal-field">
                                        <label><Activity size={14} /> Outcome</label>
                                        <p>{selectedDelivery.outcome}</p>
                                    </div>
                                </div>
                                <div className="pdi-modal-field">
                                    <label><Stethoscope size={14} /> Delivery Type</label>
                                    <p>{selectedDelivery.delivery_type}</p>
                                </div>
                            </div>
                            
                            <div className="pdi-modal-section">
                                <div className="pdi-modal-field">
                                    <label><MapPin size={14} /> Health Station</label>
                                    <p>{selectedDelivery.health_station}</p>
                                </div>
                                <div className="pdi-modal-field">
                                    <label><User size={14} /> Healthcare Provider</label>
                                    <p>{selectedDelivery.healthcare_provider}</p>
                                </div>
                            </div>
                            
                            <div className="pdi-modal-section">
                                <h3>Baby Information</h3>
                                <div className="pdi-modal-row">
                                    <div className="pdi-modal-field">
                                        <label>Gender</label>
                                        <p>{selectedDelivery.baby_gender}</p>
                                    </div>
                                    <div className="pdi-modal-field">
                                        <label>Birth Weight</label>
                                        <p>{selectedDelivery.birth_weight}</p>
                                    </div>
                                </div>
                                <div className="pdi-modal-field">
                                    <label>Status</label>
                                    <p><span className="pdi-status-badge">{selectedDelivery.status}</span></p>
                                </div>
                            </div>
                            
                            {(selectedDelivery.complications !== 'None' || selectedDelivery.notes) && (
                                <div className="pdi-modal-section">
                                    <h3>Additional Information</h3>
                                    {selectedDelivery.complications !== 'None' && (
                                        <div className="pdi-modal-field">
                                            <label>Complications</label>
                                            <p>{selectedDelivery.complications}</p>
                                        </div>
                                    )}
                                    {selectedDelivery.notes && (
                                        <div className="pdi-modal-field">
                                            <label>Notes</label>
                                            <p className="pdi-notes-text">{selectedDelivery.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PregnancyDeliveryInfo;
