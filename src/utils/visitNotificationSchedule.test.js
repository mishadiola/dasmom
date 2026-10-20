import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildVisitReminderSchedules,
    createVisitNotificationCopy,
    createVisitChangeNotificationCopy,
    getMotherCareStage,
    getVisitChangeType,
    isEligibleVisitStatus,
    isVisitRelevantForCareStage
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
    const maternalVaccine = createVisitNotificationCopy({
        visitType: 'maternal_vaccination',
        vaccineName: 'Tdap',
        doseNumber: 2
    }, 'October 20, 2026', 3);
    assert.match(prenatal.body, /Prenatal checkup \(visit 2\).*October 20, 2026.*7-day reminder/i);
    assert.match(postpartum.body, /postpartum follow-up \(6 weeks after birth\).*3-day reminder/i);
    assert.match(newborn.body, /BCG \(dose 1\) for Baby Ana.*1-day reminder/);
    assert.equal(newborn.title, 'Upcoming Newborn Vaccination');
    assert.match(maternalVaccine.body, /Your vaccination for Tdap \(dose 2\).*3-day reminder/i);
    assert.equal(maternalVaccine.title, 'Upcoming Vaccination');
});

test('excludes cancelled, completed, and missed visits from reminder eligibility', () => {
    ['Cancelled', 'Completed', 'Attended', 'Missed', 'Overdue'].forEach(status => {
        assert.equal(isEligibleVisitStatus(status), false);
    });
    assert.equal(isEligibleVisitStatus('Scheduled'), true);
    assert.equal(isEligibleVisitStatus('Pending'), true);
});

test('selects prenatal or postpartum reminders from the current maternal care stage', () => {
    assert.equal(getMotherCareStage('Pregnant', false), 'pregnant');
    assert.equal(getMotherCareStage('Postpartum', false), 'postpartum');
    assert.equal(getMotherCareStage('Unknown', true), 'postpartum');
    assert.equal(getMotherCareStage('Unknown', false), 'unknown');

    assert.equal(isVisitRelevantForCareStage('prenatal', 'pregnant'), true);
    assert.equal(isVisitRelevantForCareStage('postpartum', 'pregnant'), false);
    assert.equal(isVisitRelevantForCareStage('prenatal', 'postpartum'), false);
    assert.equal(isVisitRelevantForCareStage('postpartum', 'postpartum'), true);
    assert.equal(isVisitRelevantForCareStage('maternal_vaccination', 'postpartum'), true);
    assert.equal(isVisitRelevantForCareStage('newborn_vaccination', 'pregnant'), true);
});

test('detects added and rescheduled visits but ignores unrelated updates', () => {
    assert.equal(getVisitChangeType({ eventType: 'INSERT', new: { visit_date: '2026-10-20' } }), 'added');
    assert.equal(getVisitChangeType({
        eventType: 'UPDATE',
        old: { scheduled_date: '2026-10-20' },
        new: { scheduled_date: '2026-10-21' }
    }), 'rescheduled');
    assert.equal(getVisitChangeType({
        eventType: 'UPDATE',
        old: { scheduled_date: '2026-10-20', status: 'Scheduled' },
        new: { scheduled_date: '2026-10-20', status: 'Attended' }
    }), null);
    assert.equal(getVisitChangeType({
        eventType: 'UPDATE',
        old: { id: 'visit-1' },
        new: { id: 'visit-1', rescheduled_at: '2026-10-20T10:00:00Z', status: 'Attended' }
    }), null);
});

test('creates change alerts for maternal visits, postpartum visits, and vaccinations', () => {
    const prenatal = createVisitChangeNotificationCopy('prenatal', 'added', '2026-10-20', 'Prenatal checkup');
    const postpartum = createVisitChangeNotificationCopy('postpartum', 'rescheduled', '2026-10-20', '4 weeks after birth');
    const vaccination = createVisitChangeNotificationCopy('maternal_vaccination', 'rescheduled', '2026-10-20', 'Tdap');

    assert.equal(prenatal.title, 'New Visit Added');
    assert.match(prenatal.body, /prenatal visit: Prenatal checkup has been added for October 20, 2026/);
    assert.equal(postpartum.title, 'Visit Rescheduled');
    assert.match(postpartum.body, /postpartum visit: 4 weeks after birth has been rescheduled for October 20, 2026/);
    assert.equal(vaccination.title, 'Visit Rescheduled');
    assert.match(vaccination.body, /vaccination: Tdap has been rescheduled for October 20, 2026/);
});
