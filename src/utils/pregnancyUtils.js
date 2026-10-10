export const getLatestPregnancyRecord = (records = []) => {
    return records.reduce((latest, record) => {
        if (!record) return latest;
        if (!latest) return record;
        const recordTime = new Date(record.created_at || 0).getTime() || 0;
        const latestTime = new Date(latest.created_at || 0).getTime() || 0;
        return recordTime > latestTime ? record : latest;
    }, null);
};

export const getPregnancyStatus = (record) =>
    String(record?.pregn_postp || record?.miscarriage_info?.outcome || 'Unknown').trim();

export const getPregnancyForDelivery = (records = [], deliveryDate, pregnancyId = null, deliveryTime = null) => {
    if (pregnancyId) return records.find(record => record.id === pregnancyId) || null;

    const datePart = String(deliveryDate || '').slice(0, 10);
    const deliveryInstant = new Date(
        deliveryTime && String(deliveryTime).includes('T')
            ? deliveryTime
            : `${datePart}T${deliveryTime || '23:59:59'}`
    ).getTime();
    if (!Number.isFinite(deliveryInstant)) return null;

    const recordsWithLmp = records.filter(record => {
        const lmpTime = new Date(record.lmd || '').getTime();
        const createdTime = new Date(record.created_at || 0).getTime() || 0;
        return Number.isFinite(lmpTime) && lmpTime <= deliveryInstant && createdTime <= deliveryInstant;
    });
    if (recordsWithLmp.length > 0) {
        const latestLmp = Math.max(...recordsWithLmp.map(record => new Date(record.lmd).getTime()));
        const samePregnancy = recordsWithLmp.filter(record => new Date(record.lmd).getTime() === latestLmp);
        const pregnantRecord = samePregnancy
            .filter(record => String(record.pregn_postp || '').toLowerCase() === 'pregnant')
            .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))[0];
        if (pregnantRecord) return pregnantRecord;
        return getLatestPregnancyRecord(samePregnancy.filter(record => !record.miscarriage_info));
    }

    return getLatestPregnancyRecord(records.filter(record =>
        String(record.pregn_postp || '').toLowerCase() === 'pregnant'
        && new Date(record.created_at || 0).getTime() <= deliveryInstant
    ));
};

export const isNewbornVaccinationEligible = (newborn) => {
    if (!newborn) return false;
    const condition = String(newborn.condition_at_birth || newborn.condition || '').trim().toLowerCase();
    if (/(stillbirth|stillborn|deceased|dead at birth|died|no baby|miscarriage)/.test(condition)) return false;
    return Boolean(condition || newborn.vaccines?.length);
};

export const buildPregnancyHistory = (records = [], visits = [], deliveries = [], newborns = []) => {
    const latest = getLatestPregnancyRecord(records);
    const groupedRecords = new Map();
    records.forEach(record => {
        const pregnancyDate = record.lmd || record.miscarriage_info?.date;
        const key = pregnancyDate ? String(pregnancyDate).slice(0, 10) : record.id || record.created_at;
        const group = groupedRecords.get(key) || { records: [], latest: record, anchor: pregnancyDate || record.created_at };
        group.records.push(record);
        if (getLatestPregnancyRecord([group.latest, record]) === record) group.latest = record;
        if (!group.anchor || (pregnancyDate && new Date(pregnancyDate) < new Date(group.anchor))) group.anchor = pregnancyDate;
        groupedRecords.set(key, group);
    });
    const chronological = [...groupedRecords.values()].sort((left, right) =>
        (new Date(left.anchor || 0).getTime() || 0) - (new Date(right.anchor || 0).getTime() || 0)
    );
    const currentGroup = chronological.find(group => group.records.includes(latest));

    return chronological.map((group, index) => {
        const record = group.latest;
        const startValue = group.anchor;
        const startTime = new Date(startValue || 0).getTime();
        const nextStartTime = chronological
            .slice(index + 1)
            .map(next => new Date(next.anchor || 0).getTime())
            .find(time => Number.isFinite(time) && time > startTime);
        const belongsToRange = value => {
            if (!value || !Number.isFinite(startTime)) return false;
            const time = new Date(value).getTime();
            return Number.isFinite(time) && time >= startTime && (nextStartTime === undefined || time < nextStartTime);
        };
        const groupIds = new Set(group.records.map(groupRecord => groupRecord.id).filter(Boolean));
        const pregnancyDeliveries = deliveries.filter(delivery => {
            if (delivery.pregnancy_id) return groupIds.has(delivery.pregnancy_id);
            const deliveryPregnancy = getPregnancyForDelivery(
                records,
                delivery.delivery_date,
                null,
                delivery.delivery_time
            );
            if (deliveryPregnancy) {
                return group.records.some(groupRecord => groupRecord.id === deliveryPregnancy.id);
            }
            return belongsToRange(delivery.delivery_date);
        });
        const isPostpartumVisit = visit => String(visit.next_appt_type || '').toLowerCase().includes('postpartum');
        const deliveryPostpartumDates = new Set(pregnancyDeliveries
            .flatMap(delivery => (delivery.postpartum_visits || [])
                .map(visit => String(visit.scheduled_date || visit.scheduled_at || '').slice(0, 10)))
            .filter(Boolean));
        const pregnancyVisits = visits.filter(visit => isPostpartumVisit(visit)
            ? deliveryPostpartumDates.has(String(visit.visit_date || '').slice(0, 10))
            : belongsToRange(visit.visit_date)
        );
        const deliveryIds = new Set(pregnancyDeliveries.map(delivery => delivery.id));
        const pregnancyNewborns = newborns.filter(newborn => deliveryIds.has(newborn.delivery_id));

        return {
            ...record,
            pregnancyNumber: index + 1,
            pregnancyRecordIds: [...groupIds],
            isCurrent: group === currentGroup,
            status: getPregnancyStatus(record),
            visits: pregnancyVisits,
            deliveries: pregnancyDeliveries,
            newborns: pregnancyNewborns,
            vaccinations: [
                ...pregnancyNewborns
                    .filter(isNewbornVaccinationEligible)
                    .flatMap(newborn => newborn.vaccines || [])
            ]
        };
    }).reverse();
};

/**
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
 * @param {number} weeks 
 * @returns {string}
 */
export const getTrimester = (weeks) => {
    if (weeks <= 12) return '1st Trimester';
    if (weeks <= 26) return '2nd Trimester';
    return '3rd Trimester';
};

/**
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

/**
 * Converts 24-hour time format (e.g., "14:30") to 12-hour format (e.g., "2:30 PM")
 * @param {string} time24 - Time in 24-hour format (HH:MM or HH:MM:SS)
 * @returns {string} Time in 12-hour format with AM/PM indicator
 */
export const formatTime12Hour = (time24) => {
    if (!time24) return '';
    
    // Handle different input formats
    const timeParts = time24.split(':');
    let hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1] || '00';
    
    // Determine AM/PM
    const period = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // Handle midnight (0 becomes 12)
    
    // Format minutes
    const formattedMinutes = minutes.padStart(2, '0');
    
    return `${hours}:${formattedMinutes} ${period}`;
};

/**
 * Get weekly milestone information based on gestational week
 * @param {number} weeks 
 * @returns {{title: string, description: string}}
 */
export const getWeeklyMilestone = (weeks) => {
    const milestones = {
        '1-4': {
            title: 'Early Development',
            description: 'Your baby is beginning to form. The neural tube, heart, and other organs are starting to develop.'
        },
        '5-8': {
            title: 'Organ Formation',
            description: 'All major organs are forming. Tiny fingers and toes are developing, and the heart is beating.'
        },
        '9-12': {
            title: 'First Trimester Milestone',
            description: 'Your baby is fully formed and growing rapidly. Fingers and toes are separated, and facial features are developing.'
        },
        '13-16': {
            title: 'Second Trimester Begins',
            description: 'Your baby can make facial expressions and may suck their thumb. Bones are hardening.'
        },
        '17-20': {
            title: 'Mid-Pregnancy',
            description: 'Your baby is growing stronger. You may feel the first movements (quickening) around this time.'
        },
        '21-24': {
            title: 'Rapid Growth Phase',
            description: 'Your baby is gaining weight quickly. Eyebrows and eyelashes are growing, and the skin is still transparent.'
        },
        '25-28': {
            title: 'Viability Milestone',
            description: 'Your baby can now open and close eyes. With proper medical care, survival outside the womb is possible.'
        },
        '29-32': {
            title: 'Third Trimester Begins',
            description: 'Your baby is getting stronger and gaining more weight. Brain development is accelerating.'
        },
        '33-36': {
            title: 'Final Growth Spurt',
            description: 'Your baby is practicing breathing movements and gaining weight rapidly in preparation for birth.'
        },
        '37-40': {
            title: 'Full Term Approaching',
            description: 'Your baby is considered full term. They are ready for birth and practicing breathing and sucking reflexes.'
        },
        '41-42': {
            title: 'Post-Term',
            description: 'Your baby is continuing to grow and gain weight. Your healthcare provider will monitor you closely.'
        }
    };

    if (weeks <= 4) return milestones['1-4'];
    if (weeks <= 8) return milestones['5-8'];
    if (weeks <= 12) return milestones['9-12'];
    if (weeks <= 16) return milestones['13-16'];
    if (weeks <= 20) return milestones['17-20'];
    if (weeks <= 24) return milestones['21-24'];
    if (weeks <= 28) return milestones['25-28'];
    if (weeks <= 32) return milestones['29-32'];
    if (weeks <= 36) return milestones['33-36'];
    if (weeks <= 40) return milestones['37-40'];
    return milestones['41-42'];
};
