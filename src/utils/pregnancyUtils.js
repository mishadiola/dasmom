/**
 * Pregnancy Utility Functions
 */

/**
 * Calculates the Estimated Due Date (EDD) based on Last Menstrual Period (LMP).
 * Standard pregnancy is approx 280 days (40 weeks) from LMP.
 * @param {string|Date} lmpDate 
 * @returns {Date}
 */
export const calculateEDD = (lmpDate) => {
    const lmp = new Date(lmpDate);
    const edd = new Date(lmp);
    edd.setDate(lmp.getDate() + 280);
    return edd;
};

/**
 * Calculates current gestational age in weeks and days.
 * @param {string|Date} lmpDate 
 * @returns {{weeks: number, days: number}}
 */
export const calculateGestationalAge = (lmpDate) => {
    const lmp = new Date(lmpDate);
    const today = new Date();
    const diffTime = Math.abs(today - lmp);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return {
        weeks: Math.floor(diffDays / 7),
        days: diffDays % 7
    };
};

/**
 * Calculates time remaining until EDD.
 * @param {Date} edd 
 * @returns {{weeks: number, days: number, totalDays: number}}
 */
export const calculateTimeRemaining = (edd) => {
    const today = new Date();
    const diffTime = edd - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { weeks: 0, days: 0, totalDays: 0 };

    return {
        weeks: Math.floor(diffDays / 7),
        days: diffDays % 7,
        totalDays: diffDays
    };
};

/**
 * Calculates pregnancy progress percentage based on 40 weeks (280 days).
 * @param {string|Date} lmpDate 
 * @returns {number}
 */
export const calculateProgress = (lmpDate) => {
    const lmp = new Date(lmpDate);
    const today = new Date();
    const diffTime = today - lmp;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const progress = (diffDays / 280) * 100;
    return Math.min(Math.max(progress, 0), 100);
};

/**
 * Determines current trimester.
 * @param {number} weeks 
 * @returns {string}
 */
export const getTrimester = (weeks) => {
    if (weeks <= 12) return '1st Trimester';
    if (weeks <= 26) return '2nd Trimester';
    return '3rd Trimester';
};

/**
 * Formats a date to 'Month Day, Year' (e.g., November 12, 2026).
 * @param {Date} date 
 * @returns {string}
 */
export const formatDateLong = (date) => {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};
