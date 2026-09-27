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
import { isNewbornVaccinationEligible } from '../../utils/pregnancyUtils';

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
                setPastPregnancies(patient?.pregnancyHistory || []);
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
                            <h2>My Pregnancy History</h2>
                            <p>Current and previous pregnancies recorded by your healthcare team.</p>
                </div>

                <div className="pdi-history-summary">
                    <div className="pdi-summary-box">
                            <span className="pdi-summary-label">Pregnancies</span>
                        <span className="pdi-summary-value">{pastPregnancies.length}</span>
                    </div>
                    <div className="pdi-summary-info">
                        <span className="pdi-summary-recorded">{t('pdi_recorded_by')}</span>
                        <span className="pdi-summary-view">{t('pdi_view_only')}</span>
                    </div>
                </div>

                <div className="pdi-cards-list">
                        {loading ? <p>{t('pdi_loading')}</p> : pastPregnancies.length > 0 ? (
                        pastPregnancies.map((pregnancy) => {
                            const delivery = pregnancy.deliveries?.[0];
                            const outcome = pregnancy.miscarriage_info?.outcome
                                || pregnancy.newborns?.map(newborn => newborn.condition).filter(Boolean).join(', ')
                                || (delivery ? 'Outcome not recorded' : 'Not recorded');
                            const date = pregnancy.lmd || pregnancy.created_at;
                            return (
                                <div 
                                    key={pregnancy.id}
                                    className="pdi-delivery-card"
                                    onClick={() => setSelectedDelivery(pregnancy)}
                                >
                                    <div className="pdi-card-main">
                                        <div className="pdi-card-header-row">
                                            <div className="pdi-card-title-group">
                                                <span className="pdi-detail-label">Pregnancy #{pregnancy.pregnancyNumber}{pregnancy.isCurrent ? ' · Current' : ''}</span>
                                                <h3>{date ? new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : t('pdi_unknown_date')}</h3>
                                            </div>
                                            <span className="pdi-status-badge">{pregnancy.status || 'Unknown'}</span>
                                        </div>
                                        
                                        <div className="pdi-card-details-grid">
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">Outcome</span>
                                                <span className="pdi-detail-value">{outcome}</span>
                                            </div>
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">Due date</span>
                                                <span className="pdi-detail-value">{pregnancy.edd ? new Date(pregnancy.edd).toLocaleDateString() : 'Not recorded'}</span>
                                            </div>
                                            <div className="pdi-detail-box">
                                                <span className="pdi-detail-label">Records</span>
                                                <span className="pdi-detail-value">{pregnancy.visits?.length || 0} visits · {pregnancy.newborns?.length || 0} newborns</span>
                                            </div>
                                        </div>

                                        <div className="pdi-card-footer">
                                            <span className="pdi-view-link">View Records <ChevronRight size={14} /></span>
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
                            <h4>No Pregnancy Records Yet</h4>
                            <p>Your pregnancy history will appear here when a pregnancy record is added by your healthcare team.</p>
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
                                    <h2>Pregnancy #{selectedDelivery.pregnancyNumber} Records</h2>
                            <button className="pdi-modal-close" onClick={() => setSelectedDelivery(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="pdi-modal-body">
                            <div className="pdi-modal-section">
                                <div className="pdi-modal-row">
                                    <div className="pdi-modal-field">
                                        <label><Calendar size={14} /> LMP / Record Date</label>
                                        <p>{selectedDelivery.lmd ? new Date(selectedDelivery.lmd).toLocaleDateString() : selectedDelivery.created_at ? new Date(selectedDelivery.created_at).toLocaleDateString() : 'Not recorded'}</p>
                                    </div>
                                    <div className="pdi-modal-field">
                                        <label><Activity size={14} /> Status / Outcome</label>
                                        <p>{selectedDelivery.status || selectedDelivery.miscarriage_info?.outcome || 'Unknown'}</p>
                                    </div>
                                </div>
                                <div className="pdi-modal-row">
                                    <div className="pdi-modal-field"><label>Estimated due date</label><p>{selectedDelivery.edd ? new Date(selectedDelivery.edd).toLocaleDateString() : 'Not recorded'}</p></div>
                                    <div className="pdi-modal-field"><label>Gravida / Para</label><p>{selectedDelivery.gravida ?? 'Not recorded'} / {selectedDelivery.para ?? 'Not recorded'}</p></div>
                                </div>
                            </div>
                                <div className="pdi-modal-section">
                                    <h3>Prenatal visits ({selectedDelivery.visits?.length || 0})</h3>
                                    {selectedDelivery.visits?.length ? selectedDelivery.visits.map(visit => (
                                        <div key={visit.id}>
                                            <p>{visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'Date not recorded'} · {visit.status || 'Status not recorded'}{visit.clinical_notes ? ` · ${visit.clinical_notes}` : ''}</p>
                                            {[visit.weight_kg ? `Weight ${visit.weight_kg} kg` : null, visit.bp_systolic && visit.bp_diastolic ? `BP ${visit.bp_systolic}/${visit.bp_diastolic}` : null, visit.temp_c ? `Temperature ${visit.temp_c} °C` : null].filter(Boolean).length > 0 && (
                                                <p>Health records: {[visit.weight_kg ? `Weight ${visit.weight_kg} kg` : null, visit.bp_systolic && visit.bp_diastolic ? `BP ${visit.bp_systolic}/${visit.bp_diastolic}` : null, visit.temp_c ? `Temperature ${visit.temp_c} °C` : null].filter(Boolean).join(' · ')}</p>
                                            )}
                                        </div>
                                    )) : <p>No prenatal visits recorded.</p>}
                                </div>
                                {(selectedDelivery.deliveries || []).map(delivery => (
                                    <div className="pdi-modal-section" key={delivery.id}>
                                        <h3>Delivery · {delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString() : 'Date not recorded'}</h3>
                                        <p>Type: {delivery.delivery_type || 'Not recorded'} · Mode: {delivery.delivery_mode || 'Not recorded'}</p>
                                        <p>Facility: {delivery.facility || 'Not recorded'}</p>
                                        <p>Attending health worker: {delivery.assigned_staff_name || 'Not assigned'}</p>
                                        {delivery.assigned_staff_station && <p>Health worker station: {delivery.assigned_staff_station}</p>}
                                        {delivery.postpartum_visit_date && <p>Postpartum visit: {new Date(delivery.postpartum_visit_date).toLocaleDateString()}</p>}
                                        {delivery.postpartum_attended_date && <p>Postpartum attended: {new Date(delivery.postpartum_attended_date).toLocaleDateString()}</p>}
                                        {delivery.postpartum_remarks && <p>{typeof delivery.postpartum_remarks === 'string' ? delivery.postpartum_remarks : JSON.stringify(delivery.postpartum_remarks)}</p>}
                                    </div>
                                ))}
                                {(selectedDelivery.newborns || []).map(newborn => (
                                    <div className="pdi-modal-section" key={newborn.id}>
                                        <h3>{newborn.baby_name || 'Newborn'} · {newborn.condition || 'Outcome not recorded'}</h3>
                                        <p>{[newborn.gender, newborn.birth_weight ? `${newborn.birth_weight} kg` : null].filter(Boolean).join(' · ') || 'Birth details not recorded'}</p>
                                        {isNewbornVaccinationEligible(newborn) && <p>Vaccination records: {newborn.vaccines?.length || 0}</p>}
                                    </div>
                                ))}
                                {selectedDelivery.miscarriage_info && (
                                    <div className="pdi-modal-section"><h3>Pregnancy outcome details</h3><p>{selectedDelivery.miscarriage_info.suspected_cause || selectedDelivery.miscarriage_info.notes || selectedDelivery.miscarriage_info.outcome || 'No additional details recorded.'}</p></div>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PregnancyDeliveryInfo;
