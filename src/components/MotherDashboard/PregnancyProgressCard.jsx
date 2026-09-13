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
import { useLanguage } from '../../context/LanguageContext';

const PregnancyProgressCard = ({ lmpDate, weeks: propWeeks, trimester: propTrimester, edd: propEdd }) => {
    const { t } = useLanguage();
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
                            <span className="gest-label">{t('progress_this_week')}</span>
                            <p className="gest-val milestone-title">{milestone.title}</p>
                            <p className="gest-desc milestone-desc">{milestone.description}</p>
                        </div>
                    </div>
                </div>

                <div className="pregnancy-progress-container">
                    <div className="progress-header">
                        <span className="progress-title">{t('progress_title')}</span>
                        <span className="progress-stats">{t('progress_weeks').replace('{weeks}', gestAge.weeks)}</span>
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
                        <span className={`tri-dot ${gestAge.weeks <= 12 ? 'active' : ''}`}>{t('progress_1st')}</span>
                        <span className={`tri-dot ${gestAge.weeks > 12 && gestAge.weeks <= 26 ? 'active' : ''}`}>{t('progress_2nd')}</span>
                        <span className={`tri-dot ${gestAge.weeks > 26 ? 'active' : ''}`}>{t('progress_3rd')}</span>
                    </div>
                </div>
            </div>

            <div className="countdown-banner">
                <Timer size={16} />
                <span>{timeRem.totalDays ? t('progress_countdown').replace('{days}', timeRem.totalDays) : t('progress_no_date')}</span>
            </div>
        </div>
    );
};

export default PregnancyProgressCard;
