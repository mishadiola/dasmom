import React from 'react';
import { 
    X, Syringe, Shield, Activity, 
    AlertTriangle, HeartPulse, Send, 
    Calendar, CheckCircle2, Clock
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

    return (
        <div className="vdm-modal-overlay" onClick={onClose}>
            <div className="vdm-modal" onClick={e => e.stopPropagation()}>
                <div className={`vdm-header status-${vaccine.status.toLowerCase()}`}>
                    <div className="vdm-header-content">
                        <div className="vdm-icon-wrap">
                            <Syringe size={32} />
                        </div>
                        <div className="vdm-title-area">
                            <h2>{vaccine.name}</h2>
                            <span className="vdm-category">{vaccine.category} Vaccine</span>
                        </div>
                    </div>
                    <button className="vdm-close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="vdm-body">
                    <div className="vdm-status-shelf">
                        <div className={`vdm-status-indicator status-${vaccine.status.toLowerCase()}`}>
                            {getStatusIcon(vaccine.status)}
                            <span>{vaccine.status}</span>
                        </div>
                        <div className="vdm-quick-meta">
                            <div className="vdm-meta-item">
                                <span className="label">Recommended Schedule</span>
                                <span className="value">{vaccine.schedule}</span>
                            </div>
                        </div>
                    </div>

                    <div className="vdm-section">
                        <h3><Shield size={18} /> Why is this important?</h3>
                        <p>{vaccine.importance}</p>
                    </div>

                    <div className="vdm-section">
                        <h3><Activity size={18} /> Possible Side Effects</h3>
                        <p>{vaccine.sideEffects}</p>
                    </div>

                    <div className="vdm-section">
                        <h3><HeartPulse size={18} /> Care Tips & Notes</h3>
                        <div className="vdm-tips-box">
                            <p>{vaccine.tips}</p>
                        </div>
                    </div>

                    {vaccine.lastTaken && (
                        <div className="vdm-history-section">
                            <h3><Calendar size={18} /> Vaccination History</h3>
                            <div className="vdm-history-item">
                                <div className="history-dot completed"></div>
                                <div className="history-info">
                                    <span className="history-action">Dose administered</span>
                                    <span className="history-date">{vaccine.lastTaken}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="vdm-footer">
                    <button className="vdm-btn-secondary" onClick={onClose}>Close</button>
                    <button className="vdm-btn-primary">
                        <Send size={16} /> Add to Calendar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VaccineDetailModal;
