import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPregnancyRiskTrend } from './analyticsTrendUtils.js';

test('counts latest active pregnancies with the same latest-attended-visit risk assessment', () => {
    const patients = [{ id: 'patient-1' }, { id: 'patient-2' }, { id: 'patient-3' }];
    const pregnancies = [
        { patient_id: 'patient-1', pregn_postp: 'Pregnant', created_at: '2026-10-02' },
        { patient_id: 'patient-1', pregn_postp: 'Postpartum', created_at: '2026-10-08' },
        { patient_id: 'patient-2', pregn_postp: 'Pregnant', created_at: '2026-10-04' },
        { patient_id: 'patient-3', pregn_postp: 'Pregnant', created_at: '2026-10-05' }
    ];
    const visits = [
        { patient_id: 'patient-2', status: 'Attended', visit_date: '2026-10-01', risk_factors: 'None' },
        { patient_id: 'patient-2', status: 'Attended', visit_date: '2026-10-06', risk_factors: 'Hypertension' },
        { patient_id: 'patient-2', status: 'Scheduled', visit_date: '2026-10-07', risk_factors: 'None' }
    ];
    const selectedPatientIds = new Set(['patient-1', 'patient-2']);
    const weeks = [
        { start: new Date('2026-10-01'), end: new Date('2026-10-08') },
        { start: new Date('2026-10-08'), end: new Date('2026-10-15') }
    ];

    const result = buildPregnancyRiskTrend({
        patients,
        pregnancies,
        visits,
        selectedPatientIds,
        weeks,
        getRiskAssessment: (_patient, _pregnancy, visit) => ({
            isHighRisk: visit?.risk_factors === 'Hypertension'
        })
    });

    assert.deepEqual(result.totalVal, [1, 0]);
    assert.deepEqual(result.highRiskVal, [1, 0]);
});
