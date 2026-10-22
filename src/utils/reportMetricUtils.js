export const isReportDateWithinRange = (dateValue, dateRange, now = new Date()) => {
    if (!dateValue) return true;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return true;
    const monthsAgo = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    if (dateRange === 'monthly') return monthsAgo === 0;
    if (dateRange === 'quarterly') return monthsAgo >= 0 && monthsAgo < 3;
    if (dateRange === 'semiannual') return monthsAgo >= 0 && monthsAgo < 6;
    if (dateRange === 'annual') return monthsAgo >= 0 && monthsAgo < 12;
    return true;
};

export const getReportDateBounds = (dateRange, now = new Date()) => {
    const monthCount = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[dateRange];
    if (!monthCount) return null;

    const start = new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1);
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const formatDate = date => [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');

    return { startDate: formatDate(start), endDateExclusive: formatDate(endExclusive) };
};

export const isReportRecordCancelled = status =>
    ['cancelled', 'canceled'].includes(String(status || '').trim().toLowerCase());

const isDateBeforeToday = (dateValue, now) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue))) {
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        return dateValue < today;
    }
    return date < now;
};

export const getAppointmentMetrics = (visits, dateRange, now = new Date()) => {
    const inRange = visits.filter(visit => isReportDateWithinRange(
        visit.visit_date || visit.scheduled_date || visit.scheduled_vaccination,
        dateRange,
        now
    ));
    const appointments = inRange.filter(visit => !isReportRecordCancelled(visit.status));
    const missedAppointments = appointments.filter(visit => {
        const status = String(visit.status || '').trim().toLowerCase();
        if (isVaccinationCompleted(visit) || ['attended', 'completed', 'vaccinated'].includes(status)) return false;
        if (status === 'missed' || status === 'overdue') return true;
        if (!['scheduled', 'pending', 'upcoming'].includes(status)) return false;
        const dateValue = visit.visit_date || visit.scheduled_date || visit.scheduled_vaccination;
        if (!dateValue) return false;
        return isDateBeforeToday(dateValue, now);
    }).length;

    return {
        missedAppointments,
        appointmentsDue: appointments.length,
        missedRate: appointments.length > 0 ? Math.round((missedAppointments / appointments.length) * 100) : 0
    };
};

export const isVaccinationCompleted = vaccination =>
    Boolean(vaccination.vaccinated_date)
    || String(vaccination.status || '').trim().toLowerCase() === 'completed';

export const getVaccinationStatus = (vaccination, now = new Date()) => {
    if (isReportRecordCancelled(vaccination.status)) return 'cancelled';
    if (isVaccinationCompleted(vaccination)) return 'completed';

    const status = String(vaccination.status || '').trim().toLowerCase();
    if (status === 'missed' || status === 'overdue') return 'missed';
    if (vaccination.scheduled_vaccination && isDateBeforeToday(vaccination.scheduled_vaccination, now)) return 'missed';
    if (status === 'scheduled' || status === 'upcoming') return 'scheduled';
    return 'pending';
};

export const getVaccinationMetrics = (vaccinations, dateRange, now = new Date()) => {
    const inRange = vaccinations.filter(vaccination =>
        isReportDateWithinRange(
            vaccination.vaccinated_date || vaccination.scheduled_vaccination || vaccination.created_at,
            dateRange,
            now
        )
    );
    const records = inRange.filter(vaccination => !isReportRecordCancelled(vaccination.status));
    const completedVaccinations = records.filter(isVaccinationCompleted).length;
    const statusCounts = records.reduce((counts, vaccination) => {
        counts[getVaccinationStatus(vaccination, now)]++;
        return counts;
    }, { completed: 0, pending: 0, scheduled: 0, missed: 0 });

    return {
        completedVaccinations,
        totalVaccinations: records.length,
        statusCounts,
        vaccinationRate: records.length > 0 ? Math.round((completedVaccinations / records.length) * 100) : 0
    };
};
