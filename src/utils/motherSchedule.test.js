import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMotherScheduleItems, getReminderDateForItem } from './motherSchedule.js';

test('buildMotherScheduleItems flattens all assigned mother appointments without self-scheduling entries', () => {
  const patient = {
    station: 'Barangay Health Center',
    visits: [
      { id: 'v1', visit_date: '2026-09-02T09:00:00.000Z', status: 'Scheduled', clinical_notes: 'Prenatal checkup' },
      { id: 'v2', visit_date: '2026-09-10T09:00:00.000Z', status: 'Attended', clinical_notes: 'Follow-up' },
    ],
    vaccines: [
      { id: 'vac1', scheduled_vaccination: '2026-09-03T00:00:00.000Z', status: 'Scheduled', notes: 'Tetanus vaccine' },
    ],
    deliveries: [
      { id: 'd1', postpartum_visit_date: '2026-09-15T00:00:00.000Z', postpartum_attended_date: null, postpartum_remarks: 'Recovery check' },
    ]
  };

  const items = buildMotherScheduleItems(patient);

  assert.equal(items.length, 3);
  assert.equal(items[0].type, 'Prenatal');
  assert.equal(items[1].type, 'Vaccination');
  assert.equal(items[1].id, 'vac1');
  assert.equal(items[2].type, 'Postpartum');
  assert.equal(items.every(item => item.isAssignedByStaff !== false), true);
});

test('getReminderDateForItem sets a two-pm reminder one day before the assigned date', () => {
  const date = getReminderDateForItem('2026-09-02');
  assert.equal(date.toISOString(), '2026-09-01T14:00:00.000Z');
});
