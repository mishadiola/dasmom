import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getMotherPostpartumVisits,
    getMotherVitalsData,
    toPostpartumAppointment
} from './motherRecordUtils.js';

test('loads postpartum visits from delivery records when the direct query is empty', () => {
    const patient = {
        deliveries: [{
            id: 'delivery-1',
            postpartum_visits: [
                { id: 'postpartum-1', visit_type: '3 days after birth', scheduled_at: '2026-10-23T00:00:00Z' }
            ]
        }]
    };

    assert.deepEqual(
        getMotherPostpartumVisits(patient).map(visit => visit.id),
        ['postpartum-1']
    );
});

test('merges direct and delivery-linked postpartum visits without duplicates', () => {
    const patient = {
        deliveries: [{
            id: 'delivery-1',
            postpartum_visits: [{ id: 'postpartum-1', visit_type: '3 days after birth', notes: 'From delivery' }]
        }]
    };
    const visits = getMotherPostpartumVisits(patient, [
        { id: 'postpartum-1', visit_type: '3 days after birth', scheduled_at: '2026-10-23T00:00:00Z' },
        { id: 'postpartum-2', visit_type: '7 days after birth' }
    ]);

    assert.equal(visits.length, 2);
    assert.equal(visits[0].notes, 'From delivery');
    assert.equal(visits[0].scheduled_at, '2026-10-23T00:00:00Z');
});

test('normalizes postpartum appointment category and visit status for calendar filters', () => {
    const appointment = toPostpartumAppointment({
        id: 'postpartum-1',
        visit_type: '3 days after birth',
        scheduled_date: '2026-10-23',
        status: 'Scheduled'
    }, '2026-10-20');

    assert.equal(appointment.type, 'Postpartum');
    assert.equal(appointment.visitName, '3 days after birth');
    assert.equal(appointment.date, '2026-10-23');
    assert.equal(appointment.status, 'Scheduled');
});

test('shows latest postpartum vitals as current while retaining prenatal and postpartum history', () => {
    const data = getMotherVitalsData({
        pregnancyStatus: 'Postpartum',
        visits: [
            { id: 'prenatal-1', visit_date: '2026-10-10', weight_kg: 65, bp_systolic: 110, bp_diastolic: 70, trimester: 3 }
        ],
        deliveries: [{
            postpartum_visits: [
                { id: 'postpartum-1', attended_date: '2026-10-20', weight_kg: 61, bp_systolic: 120, bp_diastolic: 80, pulse_bpm: 82, temp_c: 36.7 }
            ]
        }]
    });

    assert.equal(data.current.id, 'postpartum-1');
    assert.equal(data.current.stage, 'Postpartum');
    assert.deepEqual(data.visits.map(visit => visit.id), ['postpartum-1', 'prenatal-1']);
    assert.deepEqual(data.chronological.map(visit => visit.id), ['prenatal-1', 'postpartum-1']);
});

test('falls back to latest prenatal vitals until postpartum vitals are recorded', () => {
    const data = getMotherVitalsData({
        pregnancyStatus: 'Postpartum',
        currentPregnancy: {
            visits: [
                { id: 'prenatal-old', visit_date: '2026-10-10', weight_kg: 64, trimester: 3 },
                { id: 'prenatal-new', visit_date: '2026-10-18', weight_kg: 65, bp_systolic: 110, bp_diastolic: 70, trimester: 3 }
            ]
        },
        deliveries: [{
            postpartum_visits: [
                { id: 'postpartum-scheduled', scheduled_at: '2026-10-23T00:00:00Z', status: 'Scheduled' }
            ]
        }]
    });

    assert.equal(data.current.id, 'prenatal-new');
    assert.equal(data.current.stage, 'Prenatal');
    assert.equal(data.currentStage, 'Postpartum');
    assert.deepEqual(data.visits.map(visit => visit.id), ['prenatal-new', 'prenatal-old']);
});

test('shows latest prenatal vitals as current for a pregnant mother', () => {
    const data = getMotherVitalsData({
        pregnancyStatus: 'Pregnant',
        visits: [
            { id: 'prenatal-old', visit_date: '2026-10-10', weight_kg: 64, trimester: 2 },
            { id: 'prenatal-new', visit_date: '2026-10-18', weight_kg: 65, trimester: 3 }
        ],
        deliveries: [{
            postpartum_visits: [
                { id: 'postpartum-old', attended_date: '2026-09-01', weight_kg: 60 }
            ]
        }]
    });

    assert.equal(data.current.id, 'prenatal-new');
    assert.equal(data.current.stage, 'Prenatal');
    assert.equal(data.visits.length, 3);
});
