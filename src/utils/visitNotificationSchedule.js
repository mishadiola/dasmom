export const VISIT_NOTIFICATION_TIME_ZONE = 'Asia/Manila';
export const VISIT_REMINDER_DAYS = [7, 3, 1];
export const VISIT_REMINDER_HOUR = 9;

const MANILA_UTC_OFFSET_HOURS = 8;

const getManilaDateParts = (date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: VISIT_NOTIFICATION_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day)
    };
};

const manilaDateTime = (year, month, day, hour, minute = 0, second = 0) =>
    new Date(Date.UTC(year, month - 1, day, hour - MANILA_UTC_OFFSET_HOURS, minute, second));

const parseVisitDate = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (dateOnly) {
        return {
            instant: manilaDateTime(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]), VISIT_REMINDER_HOUR),
            hasTime: false
        };
    }

    const zonedDateTime = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/i.exec(text);
    if (zonedDateTime) {
        const instant = new Date(text);
        return Number.isNaN(instant.getTime()) ? null : { instant, hasTime: true };
    }

    const localDateTime = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(text);
    if (localDateTime) {
        return {
            instant: manilaDateTime(
                Number(localDateTime[1]),
                Number(localDateTime[2]),
                Number(localDateTime[3]),
                Number(localDateTime[4]),
                Number(localDateTime[5]),
                Number(localDateTime[6] || 0)
            ),
            hasTime: true
        };
    }

    return null;
};

export const formatVisitDate = (value) => {
    const parsed = parseVisitDate(value);
    if (!parsed) return '';
    const date = new Intl.DateTimeFormat('en-US', {
        timeZone: VISIT_NOTIFICATION_TIME_ZONE,
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(parsed.instant);
    if (!parsed.hasTime) return date;
    const time = new Intl.DateTimeFormat('en-US', {
        timeZone: VISIT_NOTIFICATION_TIME_ZONE,
        hour: 'numeric',
        minute: '2-digit'
    }).format(parsed.instant);
    return `${date} at ${time}`;
};

export const buildVisitReminderSchedules = (visit, now = new Date()) => {
    const scheduled = parseVisitDate(visit.scheduledAt);
    if (!scheduled || scheduled.instant.getTime() <= now.getTime()) return [];

    const visitDay = getManilaDateParts(scheduled.instant);
    return VISIT_REMINDER_DAYS
        .map(daysBefore => {
            const reminderDay = new Date(Date.UTC(visitDay.year, visitDay.month - 1, visitDay.day - daysBefore));
            const reminderAt = manilaDateTime(
                reminderDay.getUTCFullYear(),
                reminderDay.getUTCMonth() + 1,
                reminderDay.getUTCDate(),
                VISIT_REMINDER_HOUR
            );
            if (reminderAt.getTime() <= now.getTime()) return null;

            return {
                ...visit,
                reminderDays: daysBefore,
                scheduledVisitAt: scheduled.instant.toISOString(),
                reminderAt: reminderAt.toISOString(),
                appointmentDate: formatVisitDate(visit.scheduledAt)
            };
        })
        .filter(Boolean);
};

export const isEligibleVisitStatus = (status, defaultStatus = 'scheduled') => {
    const normalized = String(status || defaultStatus).trim().toLowerCase();
    return !['cancelled', 'canceled', 'missed', 'attended', 'completed', 'overdue', 'vaccinated'].includes(normalized);
};

export const getMotherCareStage = (pregnancyStatus, hasDelivery) => {
    const status = String(pregnancyStatus || '').trim().toLowerCase();
    if (status === 'pregnant') return 'pregnant';
    if (status === 'postpartum' || hasDelivery) return 'postpartum';
    return 'unknown';
};

export const isVisitRelevantForCareStage = (visitType, careStage) => {
    if (visitType === 'prenatal') return careStage === 'pregnant';
    if (visitType === 'postpartum') return careStage === 'postpartum';
    return visitType === 'maternal_vaccination' || visitType === 'newborn_vaccination';
};

export const getVisitChangeType = (event) => {
    if (event?.eventType === 'INSERT') return 'added';
    if (event?.eventType !== 'UPDATE') return null;

    const oldVisit = event.old || {};
    const newVisit = event.new || {};
    if (oldVisit.rescheduled_at && newVisit.rescheduled_at
        && newVisit.rescheduled_at !== oldVisit.rescheduled_at) {
        return 'rescheduled';
    }
    const scheduledFields = ['visit_date', 'scheduled_at', 'scheduled_date', 'scheduled_vaccination'];
    const previousDate = scheduledFields.map(field => oldVisit[field]).find(Boolean);
    const nextDate = scheduledFields.map(field => newVisit[field]).find(Boolean);
    return previousDate && nextDate && previousDate !== nextDate ? 'rescheduled' : null;
};

export const createVisitChangeNotificationCopy = (visitType, changeType, scheduledAt, visitName = '') => {
    const date = formatVisitDate(scheduledAt);
    const action = changeType === 'rescheduled' ? 'rescheduled' : 'added';
    const detail = visitName ? `: ${visitName}` : '';
    const typeName = {
        prenatal: 'prenatal visit',
        postpartum: 'postpartum visit',
        maternal_vaccination: 'vaccination',
        newborn_vaccination: 'newborn vaccination'
    }[visitType] || 'visit';

    return {
        title: changeType === 'rescheduled' ? 'Visit Rescheduled' : 'New Visit Added',
        body: date
            ? `Your ${typeName}${detail} has been ${action} for ${date}.`
            : `A ${typeName}${detail} has been ${action} to your schedule.`
    };
};

export const createVisitNotificationCopy = (visit, appointmentDate, reminderDays) => {
    const reminder = `${reminderDays}-day reminder`;
    if (visit.visitType === 'prenatal') {
        const detail = visit.visitNumber ? ` (visit ${visit.visitNumber})` : '';
        return {
            title: 'Upcoming Prenatal Visit',
            body: `Your ${visit.body || 'prenatal appointment'}${detail} is scheduled for ${appointmentDate}. This is your ${reminder}. Please prepare for your visit.`
        };
    }
    if (visit.visitType === 'postpartum') {
        return {
            title: 'Upcoming Postpartum Visit',
            body: `Your postpartum follow-up${visit.visitName ? ` (${visit.visitName})` : ''} is scheduled for ${appointmentDate}. This is your ${reminder}. Please prepare for your visit.`
        };
    }
    if (visit.visitType === 'maternal_vaccination') {
        const vaccine = visit.vaccineName ? ` for ${visit.vaccineName}` : '';
        const dose = visit.doseNumber ? ` (dose ${visit.doseNumber})` : '';
        return {
            title: 'Upcoming Vaccination',
            body: `Your vaccination${vaccine}${dose} is scheduled for ${appointmentDate}. This is your ${reminder}. Please prepare for the visit.`
        };
    }

    const baby = visit.babyName || 'your newborn';
    const vaccine = visit.vaccineName ? ` for ${visit.vaccineName}` : '';
    const dose = visit.doseNumber ? ` (dose ${visit.doseNumber})` : '';
    return {
        title: 'Upcoming Newborn Vaccination',
        body: `A vaccination${vaccine}${dose} for ${baby} is scheduled for ${appointmentDate}. This is your ${reminder}. Please prepare for the visit.`
    };
};
