import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Trash2, X } from 'lucide-react';
import PatientService from '../services/patientservice';

const today = () => new Date().toISOString().slice(0, 10);

const preserveManilaTime = (date, timestamp) => {
    const scheduled = timestamp ? new Date(timestamp) : null;
    const valid = scheduled && !Number.isNaN(scheduled.getTime());
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).formatToParts(valid ? scheduled : new Date());
    const value = type => parts.find(part => part.type === type)?.value;
    return `${date}T${value('hour')}:${value('minute')}:${value('second')}+08:00`;
};

const VisitScheduleManager = ({ patientId, onClose, onChanged }) => {
    const service = useMemo(() => new PatientService(), []);
    const [visits, setVisits] = useState([]);
    const [newborns, setNewborns] = useState([]);
    const [patient, setPatient] = useState(null);
    const [delivery, setDelivery] = useState(null);
    const [userId, setUserId] = useState(null);
    const [canManage, setCanManage] = useState(false);
    const [kind, setKind] = useState('prenatal');
    const [newbornId, setNewbornId] = useState('');
    const [date, setDate] = useState('');
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setError('');
        try {
            const [access, session, patientResult, pregnancyResult, deliveryResult, prenatalResult, postpartumResult, maternalVaccineResult, newbornResult] = await Promise.all([
                service.getCurrentUserAccess(),
                service.supabase.auth.getUser(),
                service.supabase.from('patient_basic_info').select('id, station_ass').eq('id', patientId).single(),
                service.supabase.from('pregnancy_info').select('lmd').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
                service.supabase.from('deliveries').select('id, station_ass').eq('mother_id', patientId).order('delivery_date', { ascending: false }).limit(1).maybeSingle(),
                service.supabase.from('prenatal_visits').select('id, visit_date, visit_number, status, trimester, gestational_age').eq('patient_id', patientId).order('visit_date', { ascending: true }),
                service.supabase.from('postpartum_visits').select('id, delivery_id, visit_type, visit_number, scheduled_date, scheduled_at, status').eq('patient_id', patientId).order('scheduled_date', { ascending: true }),
                service.supabase.from('vaccinations').select('id, patient_id, newborn_id, dose_number, scheduled_vaccination, vaccinated_date, status, notes').eq('patient_id', patientId).order('scheduled_vaccination', { ascending: true }),
                service.supabase.from('newborns').select('id, baby_name, mother_id').eq('mother_id', patientId)
            ]);
            const failures = [patientResult, pregnancyResult, deliveryResult, prenatalResult, postpartumResult, maternalVaccineResult, newbornResult]
                .find(result => result.error);
            if (failures?.error) throw failures.error;

            const children = newbornResult.data || [];
            const newbornVaccineResult = children.length
                ? await service.supabase.from('vaccinations')
                    .select('id, patient_id, newborn_id, dose_number, scheduled_vaccination, vaccinated_date, status, notes')
                    .in('newborn_id', children.map(child => child.id))
                    .order('scheduled_vaccination', { ascending: true })
                : { data: [], error: null };
            if (newbornVaccineResult.error) throw newbornVaccineResult.error;

            const maternal = (maternalVaccineResult.data || []).map(row => ({
                ...row, category: 'maternal_vaccination', scheduledDate: row.scheduled_vaccination,
                display: row.notes || `Maternal vaccination dose ${row.dose_number || ''}`
            }));
            const newbornVaccines = (newbornVaccineResult.data || []).map(row => ({
                ...row, category: 'newborn_vaccination', scheduledDate: row.scheduled_vaccination,
                display: `${children.find(child => child.id === row.newborn_id)?.baby_name || 'Newborn'} — ${row.notes || `Dose ${row.dose_number || ''}`}`
            }));
            setVisits([
                ...(prenatalResult.data || []).map(row => ({ ...row, category: 'prenatal', scheduledDate: row.visit_date, display: `Prenatal visit ${row.visit_number || ''}` })),
                ...(postpartumResult.data || []).map(row => ({ ...row, category: 'postpartum', scheduledDate: row.scheduled_date, display: row.visit_type || `Postpartum visit ${row.visit_number || ''}` })),
                ...maternal,
                ...newbornVaccines
            ].sort((left, right) => String(left.scheduledDate).localeCompare(String(right.scheduledDate))));
            setNewborns(children);
            setPatient(patientResult.data);
            setDelivery(deliveryResult.data);
            setUserId(session.data?.user?.id || null);
            const normalizedRole = String(access?.role || '').trim().toLowerCase().replace(/_/g, ' ');
            setCanManage(['admin', 'staff', 'cho personnel'].includes(
                normalizedRole === 'station staff' ? 'staff' : normalizedRole
            ));
            if (!pregnancyResult.data?.lmd && kind === 'prenatal') setKind('postpartum');
            if (children[0]?.id && !newbornId) setNewbornId(children[0].id);
        } catch (loadError) {
            console.error('Could not load patient visit schedule:', loadError);
            setError(loadError.message || 'Could not load this visit schedule.');
        }
    }, [kind, newbornId, patientId, service]);

    useEffect(() => { load(); }, [load]);

    const isEligible = visit => {
        const isFuture = visit.scheduledDate && visit.scheduledDate >= today();
        if (!isFuture) return false;
        if (visit.category === 'prenatal' || visit.category === 'postpartum') return visit.status === 'Scheduled';
        return visit.status === 'Pending' && !visit.vaccinated_date;
    };

    const hasDateConflict = (category, scheduledDate, excludeId = null, targetId = patientId) => visits.some(visit =>
        visit.category === category
        && visit.id !== excludeId
        && ['Scheduled', 'Pending'].includes(visit.status)
        && (category !== 'newborn_vaccination' || visit.newborn_id === targetId)
        && visit.scheduledDate === scheduledDate
    );

    const updateDate = async visit => {
        const nextDate = window.prompt(`New date for ${visit.display} (YYYY-MM-DD):`, visit.scheduledDate);
        if (nextDate === null) return;
        const parsedDate = new Date(`${nextDate}T00:00:00`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)
            || Number.isNaN(parsedDate.getTime())
            || parsedDate.toISOString().slice(0, 10) !== nextDate
            || nextDate < today()) {
            setError('Choose a valid date that is today or later.');
            return;
        }
        const targetId = visit.category === 'newborn_vaccination' ? visit.newborn_id : patientId;
        if (hasDateConflict(visit.category, nextDate, visit.id, targetId)) {
            setError('A visit of this category is already scheduled for that date.');
            return;
        }
        setBusy(true);
        setError('');
        let notificationWarning = '';
        try {
            const table = visit.category === 'prenatal' ? 'prenatal_visits'
                : visit.category === 'postpartum' ? 'postpartum_visits' : 'vaccinations';
            const dateColumn = visit.category === 'prenatal' ? 'visit_date'
                : visit.category === 'postpartum' ? 'scheduled_date' : 'scheduled_vaccination';
            const eventId = crypto.randomUUID();
            const payload = {
                [dateColumn]: nextDate,
                reschedule_reason: null,
                rescheduled_from_date: visit.scheduledDate,
                rescheduled_at: new Date().toISOString(),
                rescheduled_by: userId,
                reschedule_event_id: eventId
            };
            if (visit.category === 'postpartum') payload.scheduled_at = preserveManilaTime(nextDate, visit.scheduled_at);
            const targetColumn = visit.category === 'newborn_vaccination' ? 'newborn_id' : 'patient_id';
            const { data, error: updateError } = await service.supabase.from(table)
                .update(payload)
                .eq('id', visit.id)
                .eq(targetColumn, targetId)
                .eq('status', visit.category === 'prenatal' || visit.category === 'postpartum' ? 'Scheduled' : 'Pending')
                .gte(dateColumn, today())
                .select('id')
                .maybeSingle();
            if (updateError) throw updateError;
            if (!data) throw new Error('This visit is no longer eligible to change. Refresh the schedule and try again.');
            try {
                const { data: notification, error: notificationError } = await service.supabase.functions.invoke('visit-reschedule-email', {
                    body: {
                        event_id: eventId,
                        visit_id: visit.id,
                        visit_type: visit.category,
                        original_date: visit.scheduledDate,
                        new_date: nextDate
                    }
                });
                if (notificationError || !notification?.emailSent) {
                    console.error('Visit was rescheduled, but its email notification failed:', notificationError || notification?.error);
                    notificationWarning = 'Visit date saved, but the reschedule email could not be sent.';
                }
            } catch (notificationError) {
                console.error('Visit was rescheduled, but its email notification failed:', notificationError);
                notificationWarning = 'Visit date saved, but the reschedule email could not be sent.';
            }
            await load();
            if (notificationWarning) setError(notificationWarning);
            onChanged?.();
        } catch (updateError) {
            setError(updateError.message || 'Could not update the visit.');
        } finally {
            setBusy(false);
        }
    };

    const cancelVisit = async visit => {
        if (!window.confirm(`Cancel ${visit.display}? The visit record will be retained in history.`)) return;
        setBusy(true);
        setError('');
        try {
            const { error: updateError } = await service.supabase.rpc('cancel_future_scheduled_visit', {
                p_visit_kind: visit.category,
                p_visit_id: visit.id,
                p_patient_id: patientId
            });
            if (updateError) throw updateError;
            await load();
            onChanged?.();
        } catch (cancelError) {
            setError(cancelError.message || 'Could not cancel the visit.');
        } finally {
            setBusy(false);
        }
    };

    const addVisit = async event => {
        event.preventDefault();
        if (!date || date < today() || !userId) {
            setError('Choose a future visit date and verify your staff session.');
            return;
        }
        const targetId = kind === 'newborn_vaccination' ? newbornId : patientId;
        if (hasDateConflict(kind, date, null, targetId)) {
            setError('A visit of this category is already scheduled for that date.');
            return;
        }
        if (kind === 'postpartum' && !delivery?.id) {
            setError('A delivery record is required before adding a postpartum visit.');
            return;
        }
        if (kind === 'newborn_vaccination' && !newbornId) {
            setError('Select a newborn before adding a vaccination visit.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            let result;
            if (kind === 'prenatal') {
                const pregnancyResult = await service.supabase.from('pregnancy_info')
                    .select('lmd').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (pregnancyResult.error) throw pregnancyResult.error;
                if (!pregnancyResult.data?.lmd) throw new Error('A current pregnancy with an LMP is required to add a prenatal visit.');
                const week = service.calculateWeeksAtDate(pregnancyResult.data?.lmd, date);
                const nextNumber = Math.max(0, ...visits.filter(visit => visit.category === kind).map(visit => Number(visit.visit_number) || 0)) + 1;
                result = await service.supabase.from('prenatal_visits').insert({
                    patient_id: patientId, created_by: userId, visit_date: date, visit_number: nextNumber,
                    trimester: service.getTrimesterFromWeek(week), gestational_age: `${week}w`,
                    next_appt_type: label.trim() || 'Additional prenatal visit', status: 'Scheduled',
                    assigned_station: patient.station_ass
                });
            } else if (kind === 'postpartum') {
                const latest = visits.filter(visit => visit.category === 'postpartum')
                    .reduce((max, visit) => Math.max(max, Number(visit.visit_number) || 0), 0);
                result = await service.supabase.from('postpartum_visits').insert({
                    delivery_id: delivery.id, patient_id: patientId, visit_number: latest + 1,
                    scheduled_date: date, scheduled_at: preserveManilaTime(date), visit_type: label.trim() || 'Additional follow-up',
                    status: 'Scheduled', assigned_station: delivery.station_ass || patient.station_ass,
                    station_ass: delivery.station_ass || patient.station_ass, created_by: userId
                });
            } else {
                const targetId = kind === 'newborn_vaccination' ? newbornId : patientId;
                const targetColumn = kind === 'newborn_vaccination' ? 'newborn_id' : 'patient_id';
                const nextNumber = Math.max(0, ...visits.filter(visit => visit.category === kind).map(visit => Number(visit.dose_number) || 0)) + 1;
                result = await service.supabase.from('vaccinations').insert({
                    [targetColumn]: targetId, dose_number: nextNumber, scheduled_vaccination: date,
                    vaccinated_date: null, status: 'Pending', created_by: userId, station_ass: patient.station_ass,
                    ...(kind === 'maternal_vaccination' && delivery?.id ? { delivery_id: delivery.id } : {}),
                    notes: label.trim() || (kind === 'newborn_vaccination' ? 'Additional newborn vaccination visit' : 'Additional maternal vaccination visit')
                });
            }
            if (result.error) throw result.error;
            setDate('');
            setLabel('');
            await load();
            onChanged?.();
        } catch (insertError) {
            console.error('Could not add a scheduled visit:', insertError);
            setError(insertError.message || 'Could not add this visit.');
        } finally {
            setBusy(false);
        }
    };

    const kindOptions = [
        ['prenatal', 'Prenatal'],
        ['postpartum', 'Postpartum'],
        ['maternal_vaccination', 'Maternal vaccination'],
        ...(newborns.length ? [['newborn_vaccination', 'Newborn vaccination']] : [])
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <section className="modal-content" role="dialog" aria-modal="true" aria-labelledby="visit-schedule-title"
                onClick={event => event.stopPropagation()} style={{ maxWidth: 850, maxHeight: '90vh', overflowY: 'auto' }}>
                <header className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 id="visit-schedule-title"><Calendar size={18} /> Manage visit schedule</h2>
                        <p>Edit or cancel future visits. Completed and historical records are retained.</p>
                    </div>
                    <button type="button" className="btn btn-outline" onClick={onClose} aria-label="Close schedule manager"><X /></button>
                </header>
                <div className="modal-body" style={{ padding: 20 }}>
                    {error && <div role="alert" style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>}
                    {!canManage && <p role="alert">Your account is not authorized to manage visit schedules.</p>}
                    <form onSubmit={addVisit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                        <label>Visit category
                            <select value={kind} onChange={event => setKind(event.target.value)}>
                                {kindOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                            </select>
                        </label>
                        {kind === 'newborn_vaccination' && <label>Newborn
                            <select value={newbornId} onChange={event => setNewbornId(event.target.value)}>
                                {newborns.map(child => <option key={child.id} value={child.id}>{child.baby_name || 'Newborn'}</option>)}
                            </select>
                        </label>}
                        <label>Date
                            <input type="date" min={today()} required value={date} onChange={event => setDate(event.target.value)} />
                        </label>
                        <label>Visit details
                            <input value={label} maxLength={120} onChange={event => setLabel(event.target.value)} placeholder="Optional description" />
                        </label>
                        <button type="submit" className="btn btn-primary" disabled={busy || !canManage || !patient}><Plus size={16} /> Add visit</button>
                    </form>
                    {visits.length === 0 ? <p>No visits are recorded for this patient.</p> : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {visits.map(visit => (
                                <div key={`${visit.category}-${visit.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                                    <div>
                                        <strong>{visit.display}</strong>
                                        <div>{visit.scheduledDate || 'Date unavailable'} · {visit.status}</div>
                                    </div>
                                    {canManage && isEligible(visit) && (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => updateDate(visit)}>Edit date</button>
                                            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => cancelVisit(visit)} aria-label={`Cancel ${visit.display}`}><Trash2 size={15} /> Cancel</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default VisitScheduleManager;
