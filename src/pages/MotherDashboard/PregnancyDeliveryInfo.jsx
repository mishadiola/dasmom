import React, { useEffect, useState } from 'react';
import { 
    Baby, Heart, ShieldCheck, ChevronRight, Calendar, 
    MapPin, User, Stethoscope, Activity, X 
} from 'lucide-react';
import '../../styles/pages/PregnancyDeliveryInfo.css';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import deliverySilhouette from '../../assets/images/pregnancy-silhouette.png';
import { useLanguage } from '../../context/LanguageContext';

const PregnancyDeliveryInfo = () => {
    const { t } = useLanguage();
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
                    outcome: t('pdi_live_birth'),
                    health_station: patient.station,
                    healthcare_provider: t('pdi_healthcare_team'),
                    baby: babiesByDelivery[delivery.id]?.[0] || null,
                    baby_gender: babiesByDelivery[delivery.id]?.map(b => b.gender).join(', ') || t('pdi_not_recorded'),
                    birth_weight: babiesByDelivery[delivery.id]?.[0]?.birth_weight ? `${babiesByDelivery[delivery.id][0].birth_weight} kg` : t('pdi_not_recorded'),
                    status: babiesByDelivery[delivery.id]?.some(b => b.risk_level && b.risk_level !== 'Normal') ? t('pdi_needs_attention') : t('pdi_recorded'),
                    notes: delivery.postpartum_remarks || ''
                }));
                const outcomes = (patient?.pregnancyHistory || [])
                    .filter(pregnancy => pregnancy.miscarriage_info?.outcome || String(pregnancy.pregn_postp || '').toLowerCase() !== 'pregnant')
                    .filter(pregnancy => !deliveries.some(delivery => delivery.delivery_date === pregnancy.created_at));
                const unsuccessful = outcomes.map(pregnancy => ({
                    id: `pregnancy-${pregnancy.id}`,
                    delivery_date: pregnancy.created_at,
                    outcome: pregnancy.miscarriage_info?.outcome || pregnancy.pregn_postp || t('pdi_outcome_recorded'),
                    delivery_type: t('pdi_not_applicable'),
                    health_station: patient.station,
                    healthcare_provider: t('pdi_healthcare_team'),
                    baby_gender: t('pdi_not_applicable'),
                    birth_weight: t('pdi_not_applicable'),
                    status: t('pdi_recorded'),
                    complications: pregnancy.miscarriage_info?.reason || t('pdi_not_recorded'),
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
                            <Baby size={22} className="header-icon" style={{ display: 'inline', marginRight: '6px' }} /> {t('pdi_title')}
                        </h1>
                        <p className="page-subtitle">{t('pdi_subtitle')}</p>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                DELIVERY HISTORY SECTION
            ══════════════════════════════════════════════════ */}
            <section className="pdi-section content-card pdi-main-card">
                <div className="pdi-section-header">
                    <h2>{t('pdi_history_title')}</h2>
                    <p>{t('pdi_history_desc')}</p>
                </div>

                <div className="pdi-history-summary">
                    <div className="pdi-summary-box">
                        <span className="pdi-summary-label">{t('pdi_previous_deliveries', 'Previous Deliveries')}</span>
                        <span className="pdi-summary-value">{pastPregnancies.length}</span>
                    </div>
                    <div className="pdi-summary-info">
                        <span className="pdi-summary-recorded">{t('pdi_recorded_by')}</span>
                        <span className="pdi-summary-view">{t('pdi_view_only')}</span>
                    </div>
                </div>

                <div className="pdi-cards-list">
                    {loading ? <p>{t('pdi_loading')}</p> : pastPregnancies.length > 0 ? (
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
                                                <span className="pdi-detail-label">{t('pdi_delivery_date')}</span>
                                                <h3>{delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : t('pdi_unknown_date')}</h3>
                                            </div>
                                            <span className="pdi-status-badge">{delivery.outcome}</span>
                                        </div>
                                        
                                        <div className="pdi-card-details-grid">
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">{t('pdi_delivery_type')}</span>
                                                <span className="pdi-detail-value">{delivery.delivery_type}</span>
                                            </div>
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">{t('pdi_place')}</span>
                                                <span className="pdi-detail-value">{delivery.health_station}</span>
                                            </div>
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">{t('pdi_attended_by')}</span>
                                                <span className="pdi-detail-value">{delivery.healthcare_provider}</span>
                                            </div>
                                        </div>

                                        {delivery.notes && (
                                            <div className="pdi-card-notes">
                                                <span className="pdi-detail-label">{t('pdi_notes')}</span>
                                                <p>{delivery.notes}</p>
                                            </div>
                                        )}

                                        <div className="pdi-card-footer">
                                            <span className="pdi-view-link">{t('pdi_view_details')} <ChevronRight size={14} /></span>
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
                            <h4>{t('pdi_no_records', 'No Delivery Records Yet')}</h4>
                            <p>{t('pdi_no_records_desc', 'Your delivery records will appear here once they are recorded by your healthcare team.')}</p>
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
                    <h4>{t('pdi_records_safe', 'Your records are kept safe')}</h4>
                    <p>{t('pdi_records_safe_desc', 'Your health information is securely stored and only accessible to authorized healthcare staff.')}</p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                DELIVERY DETAILS MODAL
            ══════════════════════════════════════════════════ */}
            {selectedDelivery && (
                <div className="pdi-modal-overlay" onClick={() => setSelectedDelivery(null)}>
                    <div className="pdi-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="pdi-modal-header">
                            <h2>{t('pdi_modal_title')}</h2>
                            <button className="pdi-modal-close" onClick={() => setSelectedDelivery(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="pdi-modal-body">
                            <div className="pdi-modal-section">
                                <div className="pdi-modal-row">
                                    <div className="pdi-modal-field">
                                        <label><Calendar size={14} /> {t('pdi_delivery_date')}</label>
                                        <p>{new Date(selectedDelivery.delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                    </div>
                                    <div className="pdi-modal-field">
                                        <label><Activity size={14} /> {t('pdi_outcome')}</label>
                                        <p>{selectedDelivery.outcome}</p>
                                    </div>
                                </div>
                                <div className="pdi-modal-field">
                                    <label><Stethoscope size={14} /> {t('pdi_delivery_type')}</label>
                                    <p>{selectedDelivery.delivery_type}</p>
                                </div>
                            </div>
                            
                            <div className="pdi-modal-section">
                                <div className="pdi-modal-field">
                                    <label><MapPin size={14} /> {t('pdi_health_station')}</label>
                                    <p>{selectedDelivery.health_station}</p>
                                </div>
                                <div className="pdi-modal-field">
                                    <label><User size={14} /> {t('pdi_healthcare_provider')}</label>
                                    <p>{selectedDelivery.healthcare_provider}</p>
                                </div>
                            </div>
                            
                            <div className="pdi-modal-section">
                                <h3>{t('pdi_baby_info')}</h3>
                                <div className="pdi-modal-row">
                                    <div className="pdi-modal-field">
                                        <label>{t('pdi_gender')}</label>
                                        <p>{selectedDelivery.baby_gender}</p>
                                    </div>
                                    <div className="pdi-modal-field">
                                        <label>{t('pdi_birth_weight')}</label>
                                        <p>{selectedDelivery.birth_weight}</p>
                                    </div>
                                </div>
                                <div className="pdi-modal-field">
                                    <label>{t('pdi_status')}</label>
                                    <p><span className="pdi-status-badge">{selectedDelivery.status}</span></p>
                                </div>
                            </div>
                            
                            {(selectedDelivery.complications !== 'None' || selectedDelivery.notes) && (
                                <div className="pdi-modal-section">
                                    <h3>{t('pdi_additional_info')}</h3>
                                    {selectedDelivery.complications !== 'None' && (
                                        <div className="pdi-modal-field">
                                            <label>{t('pdi_complications')}</label>
                                            <p>{selectedDelivery.complications}</p>
                                        </div>
                                    )}
                                    {selectedDelivery.notes && (
                                        <div className="pdi-modal-field">
                                            <label>{t('pdi_notes')}</label>
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
