import React from 'react';
import { Calendar, Baby, Timer, Sparkles, ChevronRight } from 'lucide-react';
import { 
    calculateEDD, 
    calculateGestationalAge, 
    calculateTimeRemaining, 
    calculateProgress, 
    formatDateLong,
    getTrimester,
    getWeeklyMilestone
} from '../../utils/pregnancyUtils';

const PregnancyProgressCard = ({ lmpDate, weeks: propWeeks, trimester: propTrimester, edd: propEdd }) => {
    const hasLmp = lmpDate && !Number.isNaN(new Date(lmpDate).getTime());

    let edd = null;
    let gestAge = { weeks: propWeeks || 0, days: 0 };
    let timeRem = { weeks: 0, days: 0, totalDays: 0 };
    let progress = 0;
    let trimester = propTrimester || 'N/A';
    let milestone = getWeeklyMilestone(gestAge.weeks || 0);

    if (hasLmp) {
        edd = calculateEDD(lmpDate);
        gestAge = calculateGestationalAge(lmpDate);
        timeRem = calculateTimeRemaining(edd);
        progress = calculateProgress(lmpDate);
        trimester = getTrimester(gestAge.weeks);
        milestone = getWeeklyMilestone(gestAge.weeks);
    } else if (propEdd) {
        // If EDD provided without LMP, use it to compute remaining time and display weeks if available
        edd = new Date(propEdd);
        timeRem = calculateTimeRemaining(edd);
        if (propWeeks) {
            progress = Math.min(Math.max((propWeeks / 40) * 100, 0), 100);
            milestone = getWeeklyMilestone(propWeeks);
        }
    } else {
        // No reliable pregnancy dates available, keep safe defaults
        edd = null;
        gestAge = { weeks: propWeeks || 0, days: 0 };
        progress = propWeeks ? Math.min(Math.max((propWeeks / 40) * 100, 0), 100) : 0;
        milestone = getWeeklyMilestone(gestAge.weeks);
    }

    return (
        <div className="mother-card modern-card pregnancy-progress-card">
            <div className="pregnancy-card-main">
                <div className="gestation-details-row">
                    <div className="gest-item milestone-item">
                        <div className="gest-icon bg-yellow-soft">
                            <Sparkles size={18} />
                        </div>
                        <div className="gest-content">
                            <span className="gest-label">This Week:</span>
                            <p className="gest-val milestone-title">{milestone.title}</p>
                            <p className="gest-desc milestone-desc">{milestone.description}</p>
                        </div>
                    </div>
                    
                    <div className="gest-item remaining-item">
                        <div className="gest-icon bg-blue-soft">
                            <Timer size={18} />
                        </div>
                        <div className="gest-content">
                            <span className="gest-label">Remaining:</span>
                            <p className="gest-val">{timeRem.totalDays ? `${timeRem.weeks} weeks to go!` : 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <div className="pregnancy-progress-container">
                    <div className="progress-header">
                        <span className="progress-title">Pregnancy Progress</span>
                        <span className="progress-stats">{gestAge.weeks} / 40 weeks</span>
                    </div>
                    <div className="custom-progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ 
                                width: `${Math.max(progress, 5)}%`,
                                backgroundColor: '#b9818a',
                                backgroundImage: 'linear-gradient(90deg, #b9818a 0%, #ff8fa3 100%)',
                                height: '100%',
                                borderRadius: '50px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                paddingRight: '12px',
                                minWidth: '50px'
                            }}
                        >
                            <span className="progress-percentage">{Math.round(progress)}%</span>
                        </div>
                    </div>
                    <div className="trimester-indicator">
                        <span className={`tri-dot ${gestAge.weeks <= 12 ? 'active' : ''}`}>1st</span>
                        <span className={`tri-dot ${gestAge.weeks > 12 && gestAge.weeks <= 26 ? 'active' : ''}`}>2nd</span>
                        <span className={`tri-dot ${gestAge.weeks > 26 ? 'active' : ''}`}>3rd Trimester</span>
                    </div>
                </div>
            </div>

            <div className="countdown-banner">
                <Timer size={16} />
                <span>{timeRem.totalDays ? `${timeRem.totalDays} Days Until You Meet Your Baby` : 'Date not available'}</span>
            </div>
        </div>
    );
};

export default PregnancyProgressCard;
