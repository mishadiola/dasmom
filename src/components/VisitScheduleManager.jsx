import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Plus, Trash2, X } from 'lucide-react';
import PatientService from '../services/patientservice';
import { useRolePermissions } from '../context/RolePermissionContext';
import '../styles/components/VisitScheduleManager.css';

const today = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const value = type => parts.find(part => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
};

const getStatusClass = (status) => {
    const s = String(status || '').toLowerCase().trim();
    if (['attended', 'completed', 'vaccinated'].includes(s)) return 'vsm-status--attended';
    if (['scheduled', 'pending'].includes(s)) return 'vsm-status--scheduled';
    if (['missed', 'overdue'].includes(s)) return 'vsm-status--missed';
    if (['cancelled', 'canceled'].includes(s)) return 'vsm-status--cancelled';
    return 'vsm-status--scheduled';
};

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
    const { hasPermission } = useRolePermissions();
    const [visits, setVisits] = useState([]);
    const [newborns, setNewborns] = useState([]);
    const [patient, setPatient] = useState(null);
    const [delivery, setDelivery] = useState(null);
    const [userId, setUserId] = useState(null);
    const [canManage, setCanManage] = useState(false);
    const [stationId, setStationId] = useState(null);
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
            setStationId(access?.stationId || null);
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
    const patientSchedulePermission = patient?.station_ass && patient.station_ass === stationId
        ? 'visit.schedule.own_station'
        : 'visit.schedule.other_station';
    const vaccineSchedulePermission = patient?.station_ass && patient.station_ass === stationId
        ? 'vaccine.schedule.create.own_station'
        : 'vaccine.schedule.create.other_station';
    const canScheduleCurrentKind = kind === 'prenatal' || kind === 'postpartum'
        ? hasPermission(patientSchedulePermission)
        : hasPermission(vaccineSchedulePermission);

    const updateDate = async visit => {
        const nextDate = window.prompt(`New date for ${visit.display} (YYYY-MM-DD):`, visit.scheduledDate);
        if (nextDate === null) return;
        const parsedDate = new Date(`${nextDate}T00:00:00Z`);
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
            if (visit.category === 'prenatal') {
                await service.resequencePrenatalVisitNumbers(patientId);
            }
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
        if (!canManage || !canScheduleCurrentKind) {
            setError('You do not have permission to schedule this type of visit for this patient.');
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
                }).select('id').single();
            } else if (kind === 'postpartum') {
                const latest = visits.filter(visit => visit.category === 'postpartum')
                    .reduce((max, visit) => Math.max(max, Number(visit.visit_number) || 0), 0);
                result = await service.supabase.from('postpartum_visits').insert({
                    delivery_id: delivery.id, patient_id: patientId, visit_number: latest + 1,
                    scheduled_date: date, scheduled_at: preserveManilaTime(date), visit_type: label.trim() || 'Additional follow-up',
                    status: 'Scheduled', assigned_station: delivery.station_ass || patient.station_ass,
                    station_ass: delivery.station_ass || patient.station_ass, created_by: userId
                }).select('id').single();
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
            const notificationWarnings = [];
            if (kind === 'prenatal') {
                try {
                    await service.resequencePrenatalVisitNumbers(patientId);
                } catch (numberingError) {
                    console.error('Prenatal visit saved, but visit numbers could not be updated:', numberingError);
                    notificationWarnings.push('Visit numbers could not be updated.');
                }
            } else if (kind === 'postpartum') {
                try {
                    await service.resequencePostpartumVisitNumbers(delivery.id);
                } catch (numberingError) {
                    console.error('Postpartum visit saved, but visit numbers could not be updated:', numberingError);
                    notificationWarnings.push('Visit numbers could not be updated.');
                }
            }
            if (kind === 'prenatal' || kind === 'postpartum') {
                try {
                    await service.sendScheduledVisitNotification(kind, result.data.id);
                } catch (emailError) {
                    console.error('Visit was saved, but its email notification failed:', emailError);
                    notificationWarnings.push('The email notification could not be sent.');
                }
            }
            setDate('');
            setLabel('');
            await load();
            onChanged?.();
            if (notificationWarnings.length) setError(`Visit saved. ${notificationWarnings.join(' ')}`);
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

    return createPortal(
        <div className="vsm-modal-overlay" onClick={onClose}>
            <section
                className="vsm-modal-container"
                role="dialog"
                aria-modal="true"
                aria-labelledby="visit-schedule-title"
                onClick={event => event.stopPropagation()}
            >
                <header className="vsm-modal-header">
                    <div className="vsm-header-text">
                        <h2 id="visit-schedule-title">
                            <span className="vsm-header-icon-wrap">
                                <Calendar size={18} />
                            </span>
                            Manage Visit Schedule
                        </h2>
                        <p>Edit or cancel future visits. Completed and historical records are retained.</p>
                    </div>
                    <button
                        type="button"
                        className="vsm-close-btn"
                        onClick={onClose}
                        aria-label="Close schedule manager"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="vsm-modal-body">
                    {error && (
                        <div className="vsm-alert vsm-alert--error" role="alert">
                            {error}
                        </div>
                    )}
                    {!canManage && (
                        <div className="vsm-alert vsm-alert--warning" role="alert">
                            Your account is not authorized to manage visit schedules.
                        </div>
                    )}
                    {canManage && !canScheduleCurrentKind && (
                        <div className="vsm-alert vsm-alert--warning" role="alert">
                            You do not have permission to schedule this type of visit for this patient.
                        </div>
                    )}

                    <div className="vsm-add-section">
                        <div className="vsm-section-header">
                            <span className="vsm-section-title">Schedule New Visit</span>
                            <span className="vsm-section-subtitle">Select category and date for the upcoming appointment</span>
                        </div>
                        <form onSubmit={addVisit} className="vsm-form-grid">
                            <div className="vsm-field-group">
                                <label className="vsm-label" htmlFor="vsm-kind-select">
                                    Visit category
                                </label>
                                <select
                                    id="vsm-kind-select"
                                    className="vsm-select"
                                    value={kind}
                                    onChange={event => setKind(event.target.value)}
                                    disabled={busy || !canManage}
                                >
                                    {kindOptions.map(([value, text]) => (
                                        <option key={value} value={value}>{text}</option>
                                    ))}
                                </select>
                            </div>

                            {kind === 'newborn_vaccination' && (
                                <div className="vsm-field-group">
                                    <label className="vsm-label" htmlFor="vsm-newborn-select">
                                        Newborn
                                    </label>
                                    <select
                                        id="vsm-newborn-select"
                                        className="vsm-select"
                                        value={newbornId}
                                        onChange={event => setNewbornId(event.target.value)}
                                        disabled={busy || !canManage}
                                    >
                                        {newborns.map(child => (
                                            <option key={child.id} value={child.id}>
                                                {child.baby_name || 'Newborn'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="vsm-field-group">
                                <label className="vsm-label" htmlFor="vsm-date-input">
                                    Date <span className="vsm-req">*</span>
                                </label>
                                <input
                                    id="vsm-date-input"
                                    type="date"
                                    className="vsm-input"
                                    min={today()}
                                    required
                                    value={date}
                                    onChange={event => setDate(event.target.value)}
                                    disabled={busy || !canManage}
                                />
                            </div>

                            <div className="vsm-field-group vsm-field-group--details">
                                <label className="vsm-label" htmlFor="vsm-details-input">
                                    Visit details
                                </label>
                                <input
                                    id="vsm-details-input"
                                    type="text"
                                    className="vsm-input"
                                    value={label}
                                    maxLength={120}
                                    onChange={event => setLabel(event.target.value)}
                                    placeholder="Optional description"
                                    disabled={busy || !canManage}
                                />
                            </div>

                            <div className="vsm-field-group vsm-field-group--btn">
                                <button
                                    type="submit"
                                    className="vsm-add-btn"
                                    disabled={busy || !canManage || !canScheduleCurrentKind || !patient}
                                >
                                    <Plus size={16} />
                                    <span>Add visit</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="vsm-visits-section">
                        <div className="vsm-section-header">
                            <div className="vsm-section-title-wrap">
                                <span className="vsm-section-title">Visit History & Upcoming Schedule</span>
                                <span className="vsm-count-badge">{visits.length}</span>
                            </div>
                            <span className="vsm-section-subtitle">
                                Future visits can be edited or cancelled. Past visits are preserved.
                            </span>
                        </div>

                        {visits.length === 0 ? (
                            <div className="vsm-empty-state">
                                <Calendar size={32} className="vsm-empty-icon" />
                                <p>No visits are recorded for this patient.</p>
                            </div>
                        ) : (
                            <div className="vsm-visits-list">
                                {visits.map(visit => {
                                    const eligible = canManage && isEligible(visit);
                                    return (
                                        <div
                                            key={`${visit.category}-${visit.id}`}
                                            className={`vsm-visit-card ${eligible ? 'vsm-visit-card--future' : 'vsm-visit-card--past'}`}
                                        >
                                            <div className="vsm-visit-info">
                                                <div className="vsm-visit-primary">
                                                    <span className="vsm-visit-name">{visit.display}</span>
                                                    <span className={`vsm-status-badge ${getStatusClass(visit.status)}`}>
                                                        {visit.status || 'Scheduled'}
                                                    </span>
                                                </div>
                                                <div className="vsm-visit-meta">
                                                    <Calendar size={13} className="vsm-meta-icon" />
                                                    <span>{visit.scheduledDate || 'Date unavailable'}</span>
                                                    {visit.notes && visit.notes !== visit.display && (
                                                        <span className="vsm-meta-note">({visit.notes})</span>
                                                    )}
                                                </div>
                                            </div>
                                            {eligible ? (
                                                <div className="vsm-visit-actions">
                                                    <button
                                                        type="button"
                                                        className="vsm-btn-action vsm-btn-edit"
                                                        disabled={busy}
                                                        onClick={() => updateDate(visit)}
                                                    >
                                                        Edit date
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="vsm-btn-action vsm-btn-cancel"
                                                        disabled={busy}
                                                        onClick={() => cancelVisit(visit)}
                                                        aria-label={`Cancel ${visit.display}`}
                                                    >
                                                        <Trash2 size={13} />
                                                        <span>Cancel</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="vsm-readonly-tag">
                                                    {visit.status === 'Attended' || visit.status === 'Completed' ? 'Completed record' : 'Historical record'}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>,
        document.body
    );
};

export default VisitScheduleManager;
