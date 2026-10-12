import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildVisitReminderSchedules,
    createVisitNotificationCopy,
    isEligibleVisitStatus
} from './visitNotificationSchedule.js';

const now = new Date('2026-10-01T01:00:00.000Z');
const visit = scheduledAt => ({
    motherId: 'mother-1',
    visitId: 'visit-1',
    visitType: 'prenatal',
    scheduledAt,
    title: 'Upcoming Prenatal Visit',
    body: 'Prepare for your visit.'
});

test('creates all three future reminders for a visit more than seven days away', () => {
    const reminders = buildVisitReminderSchedules(visit('2026-10-20'), now);
    assert.deepEqual(reminders.map(reminder => reminder.reminderDays), [7, 3, 1]);
    assert.deepEqual(
        reminders.map(reminder => reminder.reminderAt),
        [
            '2026-10-13T01:00:00.000Z',
            '2026-10-17T01:00:00.000Z',
            '2026-10-19T01:00:00.000Z'
        ]
    );
});

test('does not schedule a past seven-day reminder for a visit five days away', () => {
    const reminders = buildVisitReminderSchedules(visit('2026-10-06'), now);
    assert.deepEqual(reminders.map(reminder => reminder.reminderDays), [3, 1]);
});

test('schedules only the one-day reminder for a visit two days away', () => {
    const reminders = buildVisitReminderSchedules(visit('2026-10-03'), now);
    assert.deepEqual(reminders.map(reminder => reminder.reminderDays), [1]);
});

test('uses Manila calendar dates for date-only and timestamp visits', () => {
    const dateOnly = buildVisitReminderSchedules(visit('2026-10-20'), now);
    const timestamp = buildVisitReminderSchedules(visit('2026-10-20T00:30:00.000Z'), now);
    assert.equal(dateOnly[0].appointmentDate, 'October 20, 2026');
    assert.equal(timestamp[0].appointmentDate, 'October 20, 2026 at 8:30 AM');
});

test('does not schedule a reminder on or before its local due time', () => {
    const afterReminderTime = new Date('2026-10-13T01:01:00.000Z');
    const reminders = buildVisitReminderSchedules(visit('2026-10-20'), afterReminderTime);
    assert.deepEqual(reminders.map(reminder => reminder.reminderDays), [3, 1]);
});

test('formats personalized reminders for each supported visit type', () => {
    const prenatal = createVisitNotificationCopy({
        visitType: 'prenatal',
        visitNumber: 2,
        body: 'Prenatal checkup'
    }, 'October 20, 2026', 7);
    const postpartum = createVisitNotificationCopy({ visitType: 'postpartum', visitName: '6 weeks after birth' }, 'October 20, 2026', 3);
    const newborn = createVisitNotificationCopy({
        visitType: 'newborn_vaccination',
        babyName: 'Baby Ana',
        vaccineName: 'BCG',
        doseNumber: 1
    }, 'October 20, 2026', 1);
    assert.match(prenatal.body, /Prenatal checkup \(visit 2\).*October 20, 2026.*7-day reminder/i);
    assert.match(postpartum.body, /postpartum follow-up \(6 weeks after birth\).*3-day reminder/i);
    assert.match(newborn.body, /BCG \(dose 1\) for Baby Ana.*1-day reminder/);
    assert.equal(newborn.title, 'Upcoming Newborn Vaccination');
});

test('excludes cancelled, completed, and missed visits from reminder eligibility', () => {
    ['Cancelled', 'Completed', 'Attended', 'Missed', 'Overdue'].forEach(status => {
        assert.equal(isEligibleVisitStatus(status), false);
    });
    assert.equal(isEligibleVisitStatus('Scheduled'), true);
    assert.equal(isEligibleVisitStatus('Pending'), true);
});
