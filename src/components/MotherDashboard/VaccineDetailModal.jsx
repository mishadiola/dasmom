import React from 'react';
import { 
    X, Syringe, Calendar, 
    CheckCircle2, Clock, AlertTriangle, Info, UserRound, MapPin
} from 'lucide-react';
import '../../styles/components/VaccineDetailModal.css';
import { useLanguage } from '../../context/LanguageContext';

const VaccineDetailModal = ({ vaccine, onClose }) => {
    const { t } = useLanguage();
    if (!vaccine) return null;

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={24} />;
            case 'Upcoming': return <Clock size={24} />;
            case 'Missed': return <AlertTriangle size={24} />;
            default: return null;
        }
    };

    const scheduledVaccination = vaccine.notes?.trim() || 'Scheduled vaccination';
    const actualVaccine = vaccine.vaccine_inventory || null;
    const assignedStaffName = vaccine.assigned_staff_name || null;
    const assignedStaffStation = vaccine.assigned_staff_station || null;
    const vaccinatedBy = vaccine.vaccinated_by_name || null;
    const displayName = scheduledVaccination;
    const status = vaccine.status || 'Unknown';
    
    const displayStatus = {
        'Completed': t('vax_modal_status_completed', 'Completed'),
        'Upcoming': t('vax_modal_status_upcoming', 'Pending'),
        'Missed': t('vax_modal_status_missed', 'Missed')
    }[status] || status;

    return (
        <div className="vdm-modal-overlay" onClick={onClose}>
            <div className="vdm-modal" onClick={e => e.stopPropagation()}>
                <div className={`vdm-header status-${String(status).toLowerCase()}`}>
                    <div className="vdm-header-content">
                        <div className="vdm-icon-wrap">
                            <Syringe size={24} />
                        </div>
                        <div className="vdm-title-area">
                            <span className="vdm-category">{vaccine.category || vaccine.vaccine_category || t('vax_modal_vaccine', 'Vaccine')}</span>
                            <h2>{displayName}</h2>
                        </div>
                    </div>
                    <button className="vdm-close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="vdm-body">
                    <div className="vdm-status-shelf">
                        <div className={`vdm-status-indicator status-${String(status).toLowerCase()}`}>
                            {getStatusIcon(status)}
                            <span>{displayStatus}</span>
                        </div>
                        <div className="vdm-quick-meta">
                            <div className="vdm-meta-item">
                                <span className="label">{t('vax_modal_schedule', 'Recommended')}</span>
                                <span className="value">{vaccine.schedule || t('vax_modal_as_advised', 'As advised')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Vaccination Schedule/Dates */}
                    <div className="vdm-section">
                        <h3><Calendar size={18} /> {t('vax_modal_details', 'Vaccine Details')}</h3>
                        <div className="vdm-details-grid">
                            {vaccine.scheduled_vaccination && (
                                <div className="vdm-detail-item">
                                    <span className="label">{t('vax_modal_scheduled_date', 'Scheduled Date')}</span>
                                    <span className="value">{new Date(vaccine.scheduled_vaccination).toLocaleDateString('en-PH')}</span>
                                </div>
                            )}
                            {vaccine.vaccinated_date && (
                                <div className="vdm-detail-item">
                                    <span className="label">{t('vax_modal_vaccinated_date', 'Vaccination Date')}</span>
                                    <span className="value">{new Date(vaccine.vaccinated_date).toLocaleDateString('en-PH')}</span>
                                </div>
                            )}
                            {vaccine.dose_number && (
                                <div className="vdm-detail-item">
                                    <span className="label">{t('vax_modal_dose_number', 'Dose Number')}</span>
                                    <span className="value">{t('vax_modal_dose', 'Dose')} {vaccine.dose_number}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {actualVaccine && (
                        <div className="vdm-section">
                            <h3><Syringe size={18} /> {t('vax_modal_actual_vaccine', 'Actual Vaccine Given')}</h3>
                            <div className="vdm-details-grid">
                                <div className="vdm-detail-item"><span className="label">{t('vax_modal_vaccine', 'Vaccine')}</span><span className="value">{actualVaccine.vaccine_name}</span></div>
                                {actualVaccine.brand && <div className="vdm-detail-item"><span className="label">{t('vax_modal_brand', 'Brand')}</span><span className="value">{actualVaccine.brand}</span></div>}
                                {actualVaccine.doses && <div className="vdm-detail-item"><span className="label">{t('vax_modal_inventory_doses', 'Inventory Doses')}</span><span className="value">{actualVaccine.doses}</span></div>}
                                {vaccinatedBy && <div className="vdm-detail-item"><span className="label">{t('vax_modal_vaccinated_by', 'Vaccinated By')}</span><span className="value">{vaccinatedBy}</span></div>}
                            </div>
                        </div>
                    )}

                    <div className="vdm-section">
                        <h3><UserRound size={18} /> {t('vax_modal_assigned_hw', 'Assigned Health Worker')}</h3>
                        <div className="vdm-details-grid">
                            <div className="vdm-detail-item">
                                <span className="label">{t('vax_modal_hw_label', 'Health worker')}</span>
                                <span className="value">{assignedStaffName || t('vax_modal_not_assigned', 'Not assigned')}</span>
                            </div>
                            {assignedStaffStation && (
                                <div className="vdm-detail-item">
                                    <span className="label"><MapPin size={13} /> {t('vax_modal_assigned_station', 'Assigned Station')}</span>
                                    <span className="value">{assignedStaffStation}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Additional Info */}
                    {vaccine.remarks && (
                        <div className="vdm-section">
                            <h3><Info size={18} /> {t('vax_modal_notes', 'Notes')}</h3>
                            <p>{vaccine.remarks}</p>
                        </div>
                    )}
                </div>

                <div className="vdm-footer">
                    <button className="vdm-btn-primary" onClick={onClose}>{t('vax_modal_close', 'Close')}</button>
                </div>
            </div>
        </div>
    );
};

export default VaccineDetailModal;
