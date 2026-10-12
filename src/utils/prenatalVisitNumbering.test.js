import assert from 'node:assert/strict';
import test from 'node:test';
import { numberPrenatalVisitsChronologically } from './prenatalVisitNumbering.js';

test('numbers a newly registered patient visit before the scheduled visits', () => {
  const visits = numberPrenatalVisitsChronologically([
    { id: 'attended', visit_date: '2026-10-12', visit_number: 2, status: 'Attended' },
    { id: 'scheduled-1', visit_date: '2026-11-11', visit_number: 1, status: 'Scheduled' },
    { id: 'scheduled-2', visit_date: '2026-12-30', visit_number: 2, status: 'Scheduled' }
  ]);

  assert.deepEqual(
    visits.map(({ id, visit_number }) => [id, visit_number]),
    [['attended', 1], ['scheduled-1', 2], ['scheduled-2', 3]]
  );
});

test('inserts an existing patient scheduled visit into chronological numbering', () => {
  const visits = numberPrenatalVisitsChronologically([
    { id: 'attended', visit_date: '2026-10-12', visit_number: 1, status: 'Attended' },
    { id: 'later', visit_date: '2026-12-30', visit_number: 2, status: 'Scheduled' },
    { id: 'inserted', visit_date: '2026-11-11', visit_number: 3, status: 'Scheduled' }
  ]);

  assert.deepEqual(
    visits.map(({ id, visit_number }) => [id, visit_number]),
    [['attended', 1], ['inserted', 2], ['later', 3]]
  );
});
