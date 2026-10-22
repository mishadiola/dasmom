import test from 'node:test';
import assert from 'node:assert/strict';
import { getAppointmentMetrics, getReportDateBounds, getVaccinationMetrics, getVaccinationStatus } from './reportMetricUtils.js';

const now = new Date('2026-10-22T10:00:00');

test('creates compact half-open database bounds for selected reporting periods', () => {
    assert.deepEqual(getReportDateBounds('quarterly', now), {
        startDate: '2026-08-01',
        endDateExclusive: '2026-11-01'
    });
    assert.equal(getReportDateBounds('all', now), null);
});

test('calculates missed visits from non-cancelled appointments in the selected date range', () => {
    const visits = [
        { visit_date: '2026-10-01', status: 'Missed' },
        { visit_date: '2026-10-02', status: 'Scheduled' },
        { visit_date: '2026-10-23', status: 'Scheduled' },
        { visit_date: '2026-10-03', status: 'Cancelled' },
        { visit_date: '2026-06-01', status: 'Missed' }
    ];

    assert.deepEqual(getAppointmentMetrics(visits, 'quarterly', now), {
        missedAppointments: 2,
        appointmentsDue: 3,
        missedRate: 67
    });
});

test('calculates completed vaccine doses consistently and ignores cancelled records', () => {
    const vaccinations = [
        { scheduled_vaccination: '2026-10-01', status: 'Completed' },
        { vaccinated_date: '2026-10-02', status: 'Pending' },
        { scheduled_vaccination: '2026-10-23', status: 'Pending' },
        { scheduled_vaccination: '2026-10-04', status: 'Cancelled' },
        { scheduled_vaccination: '2026-06-01', status: 'Completed' }
    ];

    assert.deepEqual(getVaccinationMetrics(vaccinations, 'quarterly', now), {
        completedVaccinations: 2,
        totalVaccinations: 3,
        statusCounts: { completed: 2, pending: 1, scheduled: 0, missed: 0 },
        vaccinationRate: 67
    });
});

test('includes both maternal and newborn doses in the same completion rate', () => {
    const vaccinations = [
        { patient_id: 'mother-1', scheduled_vaccination: '2026-10-01', status: 'Completed' },
        { newborn_id: 'newborn-1', scheduled_vaccination: '2026-10-02', status: 'Completed' },
        { newborn_id: 'newborn-1', scheduled_vaccination: '2026-10-23', status: 'Pending' }
    ];

    assert.deepEqual(getVaccinationMetrics(vaccinations, 'quarterly', now), {
        completedVaccinations: 2,
        totalVaccinations: 3,
        statusCounts: { completed: 2, pending: 1, scheduled: 0, missed: 0 },
        vaccinationRate: 67
    });
});

test('classifies scheduled, pending, and overdue vaccine records without counting cancellations', () => {
    assert.equal(getVaccinationStatus({ status: 'Scheduled', scheduled_vaccination: '2026-10-23' }, now), 'scheduled');
    assert.equal(getVaccinationStatus({ status: 'Pending', scheduled_vaccination: '2026-10-23' }, now), 'pending');
    assert.equal(getVaccinationStatus({ status: 'Pending', scheduled_vaccination: '2026-10-01' }, now), 'missed');
    assert.equal(getVaccinationStatus({ status: 'Missed', scheduled_vaccination: '2026-10-23' }, now), 'missed');
    assert.equal(getVaccinationStatus({ status: 'Pending', scheduled_vaccination: '2026-10-22' }, now), 'pending');
    assert.equal(getVaccinationStatus({ status: 'Cancelled' }, now), 'cancelled');
});

test('counts missed prenatal, postpartum, and vaccination appointments in one rate', () => {
    const appointments = [
        { visit_date: '2026-10-01', status: 'Missed' },
        { scheduled_date: '2026-10-02', status: 'Missed' },
        { scheduled_vaccination: '2026-10-03', status: 'Pending' },
        { scheduled_vaccination: '2026-10-04', vaccinated_date: '2026-10-04', status: 'Completed' },
        { scheduled_date: '2026-10-05', status: 'Cancelled' }
    ];

    assert.deepEqual(getAppointmentMetrics(appointments, 'quarterly', now), {
        missedAppointments: 3,
        appointmentsDue: 4,
        missedRate: 75
    });
});
