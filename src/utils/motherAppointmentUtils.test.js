import test from 'node:test';
import assert from 'node:assert/strict';
import { getMotherVaccinationAppointments } from './motherRecordUtils.js';

test('includes maternal vaccination appointments for pregnant and postpartum mothers', () => {
    const patient = {
        vaccines: [{
            id: 'maternal-vaccine-1',
            recipient_type: 'Mother',
            vaccine_name: 'Tetanus',
            scheduled_vaccination: '2026-10-24',
            status: 'Scheduled'
        }],
        newborns: [{
            id: 'newborn-1',
            baby_name: 'Baby A',
            condition_at_birth: 'Live birth',
            vaccines: [{
                id: 'newborn-vaccine-1',
                vaccine_name: 'BCG',
                scheduled_vaccination: '2026-10-25',
                status: 'Scheduled'
            }]
        }]
    };

    assert.deepEqual(
        getMotherVaccinationAppointments(patient, false).map(appointment => appointment.id),
        ['maternal-vaccine-1']
    );
    assert.deepEqual(
        getMotherVaccinationAppointments(patient, true).map(appointment => appointment.id),
        ['maternal-vaccine-1', 'newborn-vaccine-1']
    );
});

test('does not show newborn vaccination appointments for an ineligible newborn', () => {
    const appointments = getMotherVaccinationAppointments({
        vaccines: [],
        newborns: [{
            id: 'newborn-1',
            condition_at_birth: 'Stillbirth',
            vaccines: [{
                id: 'newborn-vaccine-1',
                scheduled_vaccination: '2026-10-25'
            }]
        }]
    }, true);

    assert.deepEqual(appointments, []);
});
