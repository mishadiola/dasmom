import React, { useEffect, useState } from 'react';
import { 
    Baby, Heart, ShieldCheck, ChevronRight, Calendar, 
    MapPin, User, Stethoscope, Activity, X, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '../../styles/pages/PregnancyDeliveryInfo.css';
import AuthService from '../../services/authservice';
import PatientService from '../../services/patientservice';
import supabase from '../../config/supabaseclient';
import deliverySilhouette from '../../assets/images/pregnancy-silhouette.png';
import { useLanguage } from '../../context/LanguageContext';
import { isNewbornVaccinationEligible } from '../../utils/pregnancyUtils';

const PregnancyDeliveryInfo = () => {
    const { t } = useLanguage();
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [pastPregnancies, setPastPregnancies] = useState([]);
    const [patientInfo, setPatientInfo] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let channel = null;
        const loadRecords = async () => {
            try {
                const user = await new AuthService().getAuthUser();
                if (!user?.id) return;
                if (!channel) {
                    channel = supabase.channel(`mother-pregnancy-history-${user.id}`)
                        .on('postgres_changes', {
                            event: '*', schema: 'public', table: 'pregnancy_info',
                            filter: `patient_id=eq.${user.id}`
                        }, () => loadRecords())
                        .on('postgres_changes', {
                            event: '*', schema: 'public', table: 'deliveries',
                            filter: `mother_id=eq.${user.id}`
                        }, () => loadRecords())
                        .subscribe();
                }
                const patient = await new PatientService().getPatientById(user.id);
                setPastPregnancies(patient?.pregnancyHistory || []);

                const fullName = patient ? [patient.first_name, patient.middle_name, patient.last_name, patient.suffix].filter(Boolean).join(' ') : 'N/A';
                setPatientInfo({
                    name: fullName || 'N/A',
                    id: patient?.patient_id || patient?.id || 'N/A',
                    station: patient?.station || 'N/A'
                });
            } catch (error) {
                console.error('Failed to load pregnancy and delivery records:', error);
            } finally {
                setLoading(false);
            }
        };
        loadRecords();
        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    const formatDateBadge = (dateString) => {
        const date = new Date(dateString);
        return {
            month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
            day: date.getDate(),
            year: date.getFullYear()
        };
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF('portrait');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = 16;

        // ── Header ──
        doc.setFontSize(18);
        doc.setTextColor(139, 90, 100);
        doc.text('DASMOM+', margin, y);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('City Health Office — Dasmariñas, Cavite', margin, y + 7);
        y += 16;

        doc.setDrawColor(185, 129, 138);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        // ── Report Title ──
        doc.setFontSize(16);
        doc.setTextColor(40);
        doc.text('Pregnancy & Delivery Record', margin, y);
        y += 10;

        // ── Patient Info ──
        doc.setFontSize(10);
        doc.setTextColor(80);
        const patientId = String(patientInfo.id || 'N/A').substring(0, 8).toUpperCase();
        doc.text(`Patient Name: ${patientInfo.name || 'N/A'}`, margin, y);
        doc.text(`Patient ID: ${patientId}`, pageWidth / 2, y);
        y += 6;
        doc.text(`Health Station: ${patientInfo.station || 'N/A'}`, margin, y);
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y);
        y += 10;

        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        const tableStyles = {
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [185, 129, 138], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [252, 249, 250] },
            margin: { left: margin, right: margin },
            didDrawPage: (data) => {
                const pageCount = doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
                doc.text('DASMOM+ — Confidential Patient Record', margin, doc.internal.pageSize.getHeight() - 10);
            }
        };

        if (pastPregnancies.length > 0) {
            [...pastPregnancies].reverse().forEach(pregnancy => {
                if (y > doc.internal.pageSize.getHeight() - 60) {
                    doc.addPage();
                    y = 20;
                }

                doc.setFontSize(13);
                doc.setTextColor(40);
                doc.text(`Pregnancy #${pregnancy.pregnancyNumber}${pregnancy.isCurrent ? ' (Current)' : ''}`, margin, y);
                y += 8;
                
                doc.setFontSize(10);
                doc.setTextColor(80);
                const lmd = pregnancy.lmd || pregnancy.created_at;
                const edd = pregnancy.edd;
                doc.text(`Record Date: ${lmd ? new Date(lmd).toLocaleDateString() : 'N/A'}    |    EDD: ${edd ? new Date(edd).toLocaleDateString() : 'N/A'}`, margin, y);
                y += 6;
                doc.text(`Status: ${pregnancy.status || 'N/A'}    |    Gravida: ${pregnancy.gravida ?? 'N/A'}    |    Para: ${pregnancy.para ?? 'N/A'}`, margin, y);
                y += 8;

                if (pregnancy.deliveries && pregnancy.deliveries.length > 0) {
                    const deliveryHead = [['Date', 'Type / Mode', 'Facility', 'Attended By', 'Gestational Age', 'Outcome']];
                    const deliveryBody = pregnancy.deliveries.map(d => {
                        const outcome = pregnancy.miscarriage_info?.outcome || (pregnancy.newborns && pregnancy.newborns.length > 0 ? pregnancy.newborns.map(n => n.condition).filter(Boolean).join(', ') : 'Not recorded');
                        return [
                            d.delivery_date ? new Date(d.delivery_date).toLocaleDateString() : 'N/A',
                            `${d.delivery_type || 'N/A'} / ${d.delivery_mode || 'N/A'}`,
                            d.facility || 'N/A',
                            d.assigned_staff_name || 'N/A',
                            d.gestational_age || 'N/A',
                            outcome
                        ];
                    });
                    
                    doc.autoTable({
                        startY: y,
                        head: deliveryHead,
                        body: deliveryBody,
                        ...tableStyles,
                    });
                    y = doc.lastAutoTable.finalY + 8;
                    
                    // Complications & Postpartum
                    const complications = pregnancy.deliveries.filter(d => d.complications).map(d => d.complications).join('; ');
                    if (complications) {
                        doc.setFontSize(9);
                        doc.text(`Complications: ${complications}`, margin, y);
                        y += 6;
                    }
                } else if (pregnancy.miscarriage_info) {
                     doc.setFontSize(9);
                     doc.text(`Outcome: ${pregnancy.miscarriage_info.outcome || 'N/A'}`, margin, y);
                     y += 6;
                     if (pregnancy.miscarriage_info.notes || pregnancy.miscarriage_info.suspected_cause) {
                         doc.text(`Details: ${pregnancy.miscarriage_info.suspected_cause || pregnancy.miscarriage_info.notes}`, margin, y);
                         y += 6;
                     }
                }

                if (pregnancy.newborns && pregnancy.newborns.length > 0) {
                    const newbornHead = [['Newborn Name', 'Gender', 'Birth Weight', 'Condition']];
                    const newbornBody = pregnancy.newborns.map(n => [
                        n.baby_name || 'N/A',
                        n.gender || 'N/A',
                        n.birth_weight ? `${n.birth_weight} kg` : 'N/A',
                        n.condition || 'N/A'
                    ]);
                    
                    doc.autoTable({
                        startY: y,
                        head: newbornHead,
                        body: newbornBody,
                        ...tableStyles,
                    });
                    y = doc.lastAutoTable.finalY + 12;
                } else {
                    y += 4;
                }
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(120);
            doc.text('No pregnancy and delivery records available.', margin, y);
        }

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`DASMOM_Pregnancy_Delivery_Record_${patientId}_${dateStr}.pdf`);
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
                        <div className="mother-download-pdf-btn-wrapper">
                            <button className="mother-download-pdf-btn" onClick={handleDownloadPDF}>
                                <Download size={14} /> Download PDF
                            </button>
                        </div>
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
                                || pregnancy.newborns?.map(newborn => newborn.condition_at_birth || newborn.condition).filter(Boolean).join(', ')
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
                                {(selectedDelivery.deliveries || [])
                                    .filter(delivery => selectedDelivery.pregnancyRecordIds?.includes(delivery.pregnancy_id))
                                    .map(delivery => (
                                    <div className="pdi-modal-section" key={delivery.id}>
                                        <h3>Delivery · {delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString() : 'Date not recorded'}</h3>
                                        <p>Time: {delivery.delivery_time || 'Not recorded'}</p>
                                        <p>Type: {delivery.delivery_type || 'Not recorded'} · Mode: {delivery.delivery_mode || 'Not recorded'}</p>
                                        <p>Gestational age: {delivery.gestational_age || 'Not recorded'}</p>
                                        <p>Risk level: {delivery.risk_level || 'Not recorded'}</p>
                                        <p>Complications: {Array.isArray(delivery.complications)
                                            ? delivery.complications.join(', ') || 'None recorded'
                                            : typeof delivery.complications === 'object' && delivery.complications
                                                ? JSON.stringify(delivery.complications)
                                                : delivery.complications || 'None recorded'}</p>
                                        <p>Facility: {delivery.facility || 'Not recorded'}</p>
                                        <p>Attending health worker: {delivery.assigned_staff_name || 'Not assigned'}</p>
                                        {delivery.assigned_staff_station && <p>Health worker station: {delivery.assigned_staff_station}</p>}
                                        <p>Pregnancy ID: {delivery.pregnancy_id}</p>
                                        {delivery.postpartum_visit_date && <p>Postpartum visit: {new Date(delivery.postpartum_visit_date).toLocaleDateString()}</p>}
                                        {delivery.postpartum_attended_date && <p>Postpartum attended: {new Date(delivery.postpartum_attended_date).toLocaleDateString()}</p>}
                                        {delivery.postpartum_remarks && <p>{typeof delivery.postpartum_remarks === 'string' ? delivery.postpartum_remarks : JSON.stringify(delivery.postpartum_remarks)}</p>}
                                        {delivery.notes && <p>Notes: {delivery.notes}</p>}
                                    </div>
                                ))}
                                {(selectedDelivery.newborns || []).map(newborn => (
                                    <div className="pdi-modal-section" key={newborn.id}>
                                        <h3>{newborn.baby_name || 'Newborn'} · {newborn.condition_at_birth || newborn.condition || 'Outcome not recorded'}</h3>
                                        <p>Birth date: {newborn.birth_date ? new Date(newborn.birth_date).toLocaleDateString() : 'Not recorded'}</p>
                                        <p>Gender: {newborn.gender || 'Not recorded'}</p>
                                        <p>Birth weight: {newborn.birth_weight != null ? `${newborn.birth_weight} kg` : 'Not recorded'}</p>
                                        <p>Birth length: {newborn.birth_length != null ? `${newborn.birth_length} cm` : 'Not recorded'}</p>
                                        <p>Head circumference: {newborn.head_circumference != null ? `${newborn.head_circumference} cm` : 'Not recorded'}</p>
                                        <p>Condition at birth: {newborn.condition_at_birth || newborn.condition || 'Not recorded'}</p>
                                        <p>Risk level: {newborn.risk_level || 'Not recorded'}</p>
                                        <p>Apgar score: {newborn.apgar_1min ?? 'Not recorded'} at 1 minute · {newborn.apgar_5min ?? 'Not recorded'} at 5 minutes</p>
                                        {isNewbornVaccinationEligible(newborn) && (
                                            <div>
                                                <p>Vaccination records ({newborn.vaccines?.length || 0})</p>
                                                {newborn.vaccines?.map((vaccine, index) => (
                                                    <p key={vaccine.id || index}>
                                                        {vaccine.vaccine_name || vaccine.notes || 'Vaccination'}
                                                        {vaccine.dose_number ? ` · Dose ${vaccine.dose_number}` : ''}
                                                        {vaccine.status ? ` · ${vaccine.status}` : ''}
                                                        {vaccine.vaccinated_date ? ` · Given ${new Date(vaccine.vaccinated_date).toLocaleDateString()}` : ''}
                                                        {!vaccine.vaccinated_date && vaccine.scheduled_vaccination ? ` · Scheduled ${new Date(vaccine.scheduled_vaccination).toLocaleDateString()}` : ''}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
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
