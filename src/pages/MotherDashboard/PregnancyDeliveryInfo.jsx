import React, { useEffect, useState } from 'react';
import { 
    Baby, Heart, ShieldCheck, ChevronRight, Calendar, 
    MapPin, User, Stethoscope, Activity, X 
} from 'lucide-react';
import '../../styles/pages/PregnancyDeliveryInfo.css';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import deliverySilhouette from '../../assets/images/pregnancy-silhouette.png';

const PregnancyDeliveryInfo = () => {
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [pastPregnancies, setPastPregnancies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadRecords = async () => {
            try {
                const user = await new AuthService().getAuthUser();
                if (!user?.id) return;
                const patient = await new PatientService().getPatientById(user.id);
                const newborns = patient?.newborns || [];
                const babiesByDelivery = newborns.reduce((map, baby) => {
                    if (!map[baby.delivery_id]) map[baby.delivery_id] = [];
                    map[baby.delivery_id].push(baby);
                    return map;
                }, {});
                const deliveries = (patient?.deliveries || []).map(delivery => ({
                    ...delivery,
                    outcome: 'Live Birth',
                    health_station: patient.station,
                    healthcare_provider: 'Healthcare Team',
                    baby: babiesByDelivery[delivery.id]?.[0] || null,
                    baby_gender: babiesByDelivery[delivery.id]?.map(b => b.gender).join(', ') || 'Not recorded',
                    birth_weight: babiesByDelivery[delivery.id]?.[0]?.birth_weight ? `${babiesByDelivery[delivery.id][0].birth_weight} kg` : 'Not recorded',
                    status: babiesByDelivery[delivery.id]?.some(b => b.risk_level && b.risk_level !== 'Normal') ? 'Needs attention' : 'Recorded',
                    notes: delivery.postpartum_remarks || ''
                }));
                const outcomes = (patient?.pregnancyHistory || [])
                    .filter(pregnancy => pregnancy.miscarriage_info?.outcome || String(pregnancy.pregn_postp || '').toLowerCase() !== 'pregnant')
                    .filter(pregnancy => !deliveries.some(delivery => delivery.delivery_date === pregnancy.created_at));
                const unsuccessful = outcomes.map(pregnancy => ({
                    id: `pregnancy-${pregnancy.id}`,
                    delivery_date: pregnancy.created_at,
                    outcome: pregnancy.miscarriage_info?.outcome || pregnancy.pregn_postp || 'Pregnancy outcome recorded',
                    delivery_type: 'Not applicable',
                    health_station: patient.station,
                    healthcare_provider: 'Healthcare Team',
                    baby_gender: 'Not applicable',
                    birth_weight: 'Not applicable',
                    status: 'Recorded',
                    complications: pregnancy.miscarriage_info?.reason || 'Not recorded',
                    notes: pregnancy.miscarriage_info?.notes || ''
                }));
                setPastPregnancies([...deliveries, ...unsuccessful].sort((a, b) => new Date(b.delivery_date) - new Date(a.delivery_date)));
            } catch (error) {
                console.error('Failed to load pregnancy and delivery records:', error);
            } finally {
                setLoading(false);
            }
        };
        loadRecords();
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
            <div className="page-header hero-header-with-img pdi-custom-hero">
                <img 
                    src={deliverySilhouette} 
                    alt="Delivery Silhouette" 
                    className="hero-silhouette-bg" 
                />
                <div className="hero-content-wrapper">
                    <div className="hero-text-section">
                        <h1 className="page-title">
                            <Baby size={22} className="header-icon" style={{ display: 'inline', marginRight: '6px' }} /> Delivery Information
                        </h1>
                        <p className="page-subtitle">View your previous pregnancy and delivery records</p>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                DELIVERY HISTORY SECTION
            ══════════════════════════════════════════════════ */}
            <section className="pdi-section content-card pdi-main-card">
                <div className="pdi-section-header">
                    <h2>My Delivery History</h2>
                    <p>Your previous delivery records recorded by your healthcare team.</p>
                </div>

                <div className="pdi-history-summary">
                    <div className="pdi-summary-box">
                        <span className="pdi-summary-label">Previous Deliveries</span>
                        <span className="pdi-summary-value">{pastPregnancies.length}</span>
                    </div>
                    <div className="pdi-summary-info">
                        <span className="pdi-summary-recorded">Recorded by your healthcare team</span>
                        <span className="pdi-summary-view">View-only record</span>
                    </div>
                </div>

                <div className="pdi-cards-list">
                    {loading ? <p>Loading records...</p> : pastPregnancies.length > 0 ? (
                        pastPregnancies.map((delivery) => {
                            return (
                                <div 
                                    key={delivery.id} 
                                    className="pdi-delivery-card"
                                    onClick={() => setSelectedDelivery(delivery)}
                                >
                                    <div className="pdi-card-main">
                                        <div className="pdi-card-header-row">
                                            <div className="pdi-card-title-group">
                                                <span className="pdi-detail-label">Delivery Date</span>
                                                <h3>{delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}</h3>
                                            </div>
                                            <span className="pdi-status-badge">{delivery.outcome}</span>
                                        </div>
                                        
                                        <div className="pdi-card-details-grid">
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">Delivery Type</span>
                                                <span className="pdi-detail-value">{delivery.delivery_type}</span>
                                            </div>
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">Place of Delivery</span>
                                                <span className="pdi-detail-value">{delivery.health_station}</span>
                                            </div>
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">Attended By</span>
                                                <span className="pdi-detail-value">{delivery.healthcare_provider}</span>
                                            </div>
                                        </div>

                                        {delivery.notes && (
                                            <div className="pdi-card-notes">
                                                <span className="pdi-detail-label">Notes</span>
                                                <p>{delivery.notes}</p>
                                            </div>
                                        )}

                                        <div className="pdi-card-footer">
                                            <span className="pdi-view-link">View Details <ChevronRight size={14} /></span>
                                        </div>
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
