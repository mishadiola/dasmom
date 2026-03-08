import React from 'react';
import { Calendar, Baby, Timer, TrendingUp } from 'lucide-react';
import { 
    calculateEDD, 
    calculateGestationalAge, 
    calculateTimeRemaining, 
    calculateProgress, 
    formatDateLong,
    getTrimester
} from '../../utils/pregnancyUtils';

const PregnancyProgressCard = ({ lmpDate }) => {
    // If no LMP date provided, we can't calculate. For mock, we'll use a default.
    const lmp = lmpDate || '2025-08-20'; // Default for demo if not provided
    
    const edd = calculateEDD(lmp);
    const gestAge = calculateGestationalAge(lmp);
    const timeRem = calculateTimeRemaining(edd);
    const progress = calculateProgress(lmp);
    const trimester = getTrimester(gestAge.weeks);

    return (
        <div className="mother-card pregnancy-progress-card">
            <div className="pregnancy-card-main">
                <div className="due-date-section">
                    <span className="section-label">Expected Due Date</span>
                    <h2 className="due-date-val">
                        <Calendar size={20} className="icon-inline" /> {formatDateLong(edd)}
                    </h2>
                </div>

                <div className="gestation-details">
                    <div className="gest-item">
                        <div className="gest-icon bg-rose-soft">
                            <Baby size={18} />
                        </div>
                        <div className="gest-content">
                            <span className="gest-label">Current Status</span>
                            <p className="gest-val">{gestAge.weeks} weeks pregnant</p>
                        </div>
                    </div>
                    <div className="gest-item">
                        <div className="gest-icon bg-blue-soft">
                            <Timer size={18} />
                        </div>
                        <div className="gest-content">
                            <span className="gest-label">Remaining</span>
                            <p className="gest-val">{timeRem.weeks} weeks to go</p>
                        </div>
                    </div>
                </div>

                <div className="pregnancy-progress-container">
                    <div className="progress-header">
                        <span className="progress-title"><TrendingUp size={16} className="icon-inline" /> Pregnancy Progress</span>
                        <span className="progress-stats">{gestAge.weeks} / 40 weeks ({Math.round(progress)}%)</span>
                    </div>
                    <div className="custom-progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                        >
                            <span className="progress-percentage">{Math.round(progress)}%</span>
                        </div>
                    </div>
                    <div className="trimester-indicator">
                        <div className={`tri-item ${gestAge.weeks <= 12 ? 'active' : ''}`}>
                            <span className="tri-label">1st</span>
                        </div>
                        <div className={`tri-item ${gestAge.weeks > 12 && gestAge.weeks <= 26 ? 'active' : ''}`}>
                            <span className="tri-label">2nd</span>
                        </div>
                        <div className={`tri-item ${gestAge.weeks > 26 ? 'active' : ''}`}>
                            <span className="tri-label">3rd Trimester</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="countdown-banner">
                <Timer size={16} />
                <span>{timeRem.totalDays} Days Until You Meet Your Baby</span>
            </div>
        </div>
    );
};

export default PregnancyProgressCard;
