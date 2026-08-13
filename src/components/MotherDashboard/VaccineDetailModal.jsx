import React from 'react';
import { 
    X, Syringe, Calendar, 
    CheckCircle2, Clock, AlertTriangle, Info
} from 'lucide-react';
import '../../styles/components/VaccineDetailModal.css';

const VaccineDetailModal = ({ vaccine, onClose }) => {
    if (!vaccine) return null;

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={24} />;
            case 'Upcoming': return <Clock size={24} />;
            case 'Missed': return <AlertTriangle size={24} />;
            default: return null;
        }
    };

    const displayName = vaccine.notes || vaccine.vaccine_name || vaccine.name || 'Vaccine';
    const status = vaccine.status || 'Unknown';

    return (
        <div className="vdm-modal-overlay" onClick={onClose}>
            <div className="vdm-modal" onClick={e => e.stopPropagation()}>
                <div className={`vdm-header status-${String(status).toLowerCase()}`}>
                    <div className="vdm-header-content">
                        <div className="vdm-icon-wrap">
                            <Syringe size={32} />
                        </div>
                        <div className="vdm-title-area">
                            <h2>{displayName}</h2>
                            <span className="vdm-category">{vaccine.category || vaccine.vaccine_category || 'Vaccine'}</span>
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
                            <span>{status}</span>
                        </div>
                        <div className="vdm-quick-meta">
                            <div className="vdm-meta-item">
                                <span className="label">Schedule</span>
                                <span className="value">{vaccine.schedule || 'As advised'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Vaccination Schedule/Dates */}
                    <div className="vdm-section">
                        <h3><Calendar size={18} /> Vaccination Details</h3>
                        <div className="vdm-details-grid">
                            {vaccine.scheduled_vaccination && vaccine.status !== 'Completed' && (
                                <div className="vdm-detail-item">
                                    <span className="label">Scheduled Date</span>
                                    <span className="value">{new Date(vaccine.scheduled_vaccination).toLocaleDateString('en-PH')}</span>
                                </div>
                            )}
                            {vaccine.vaccinated_date && (
                                <div className="vdm-detail-item">
                                    <span className="label">Vaccinated Date</span>
                                    <span className="value">{new Date(vaccine.vaccinated_date).toLocaleDateString('en-PH')}</span>
                                </div>
                            )}
                            {vaccine.dose_number && (
                                <div className="vdm-detail-item">
                                    <span className="label">Dose Number</span>
                                    <span className="value">Dose {vaccine.dose_number}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Additional Info */}
                    {vaccine.remarks && (
                        <div className="vdm-section">
                            <h3><Info size={18} /> Notes</h3>
                            <p>{vaccine.remarks}</p>
                        </div>
                    )}
                </div>

                <div className="vdm-footer">
                    <button className="vdm-btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default VaccineDetailModal;
