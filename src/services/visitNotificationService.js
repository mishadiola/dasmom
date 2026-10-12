import { Capacitor } from '@capacitor/core';
import { SQLiteConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import { LocalNotifications } from '@capacitor/local-notifications';
import supabase from '../config/supabaseclient';
import {
    buildVisitReminderSchedules,
    createVisitNotificationCopy,
    isEligibleVisitStatus
} from '../utils/visitNotificationSchedule';

const DATABASE_NAME = 'dasmom_visit_notifications';
const TABLE_NAME = 'visit_notification_schedules';
const CHANNEL_ID = 'visit-reminders';
const sqlite = new SQLiteConnection(CapacitorSQLite);

const makeRecordId = ({ motherId, visitType, visitId, reminderDays }) =>
    `${motherId}:${visitType}:${visitId}:${reminderDays}`;
class VisitNotificationService {
    constructor() {
        this.database = null;
        this.databasePromise = null;
        this.motherId = null;
        this.statusListener = null;
        this.syncPromise = null;
        this.syncRequested = false;
        this.permissionGranted = false;
        this.startGeneration = 0;
        this.visitChannel = null;
        this.vaccinationChannel = null;
        this.subscribedNewbornIds = [];
        this.subscribedMotherId = null;
    }

    isSupported() {
        return Capacitor.getPlatform() === 'android';
    }

    setStatus(status) {
        this.statusListener?.(status);
    }

    async openDatabase() {
        if (this.databasePromise) return this.databasePromise;
        if (this.database) return this.database;
        this.databasePromise = (async () => {
            const database = await sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false);
            this.database = database;
            await database.open();
            await database.execute(`
                CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                    record_id TEXT PRIMARY KEY NOT NULL,
                    mother_id TEXT NOT NULL,
                    visit_id TEXT NOT NULL,
                    visit_type TEXT NOT NULL CHECK (visit_type IN ('prenatal', 'postpartum', 'newborn_vaccination')),
                    scheduled_visit_at TEXT NOT NULL,
                    reminder_days INTEGER NOT NULL CHECK (reminder_days IN (7, 3, 1)),
                    reminder_at TEXT NOT NULL,
                    native_notification_id INTEGER NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('pending', 'scheduled', 'failed', 'permission_denied')),
                    last_reconciled_at TEXT NOT NULL,
                    UNIQUE (mother_id, visit_type, visit_id, reminder_days)
                );
                CREATE INDEX IF NOT EXISTS visit_notification_mother_idx
                    ON ${TABLE_NAME} (mother_id);
            `);
            return database;
        })();
        try {
            return await this.databasePromise;
        } catch (error) {
            this.database = null;
            this.databasePromise = null;
            throw error;
        }
    }

    async queryRows(sql, values = []) {
        const result = await (await this.openDatabase()).query(sql, values);
        return result.values || [];
    }

    async run(sql, values = []) {
        return (await this.openDatabase()).run(sql, values);
    }

    async getPendingNotifications() {
        const result = await LocalNotifications.getPending();
        return result.notifications || [];
    }

    async cancelNativeIds(ids) {
        const uniqueIds = [...new Set(ids)].filter(Number.isInteger);
        if (uniqueIds.length === 0) return;
        await LocalNotifications.cancel({
            notifications: uniqueIds.map(id => ({ id }))
        });
        const stillPending = new Set((await this.getPendingNotifications()).map(notification => notification.id));
        const notCancelled = uniqueIds.filter(id => stillPending.has(id));
        if (notCancelled.length) {
            throw new Error(`Android still reports ${notCancelled.length} obsolete reminder(s) as pending.`);
        }
    }

    async allocateNativeId() {
        const rows = await this.queryRows(`SELECT native_notification_id FROM ${TABLE_NAME}`);
        const used = new Set(rows.map(row => Number(row.native_notification_id)));
        for (let attempt = 0; attempt < 100; attempt += 1) {
            const random = globalThis.crypto?.getRandomValues
                ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
                : Math.floor(Math.random() * 0x7fffffff);
            const candidate = (random & 0x7fffffff) || 1;
            if (!used.has(candidate)) return candidate;
        }
        throw new Error('Could not allocate a unique native notification identifier.');
    }

    async ensureOtherAccountIsolation(motherId, pending) {
        const otherAccounts = await this.queryRows(
            `SELECT DISTINCT mother_id FROM ${TABLE_NAME} WHERE mother_id != ?`,
            [motherId]
        );
        const oldAccountIds = new Set(otherAccounts.map(row => row.mother_id));
        const oldRows = oldAccountIds.size
            ? await this.queryRows(
                `SELECT native_notification_id FROM ${TABLE_NAME} WHERE mother_id != ?`,
                [motherId]
            )
            : [];
        const orphanedNative = pending.filter(notification =>
            notification.extra?.motherId && notification.extra.motherId !== motherId
        ).map(notification => notification.id);
        await this.cancelNativeIds([
            ...oldRows.map(row => Number(row.native_notification_id)),
            ...orphanedNative
        ]);
        const oldNotificationIds = new Set(oldRows.map(row => Number(row.native_notification_id)));
        const delivered = await LocalNotifications.getAll({ state: 'TRIGGERED' });
        const deliveredIds = (delivered.notifications || [])
            .filter(notification => oldNotificationIds.has(notification.id)
                || (notification.extra?.motherId && notification.extra.motherId !== motherId))
            .map(notification => notification.id);
        await this.removeDeliveredNotificationIds(deliveredIds);
        if (oldAccountIds.size) {
            await this.run(`DELETE FROM ${TABLE_NAME} WHERE mother_id != ?`, [motherId]);
        }
    }

    async removeDeliveredNotificationIds(ids) {
        const uniqueIds = [...new Set(ids)].filter(Number.isInteger);
        if (uniqueIds.length) {
            await LocalNotifications.removeDeliveredNotificationsById({ ids: uniqueIds });
        }
    }

    async setPermission(request) {
        let permission = await LocalNotifications.checkPermissions();
        if (permission.display !== 'granted' && request) {
            permission = await LocalNotifications.requestPermissions();
        }
        this.permissionGranted = permission.display === 'granted';
        return this.permissionGranted;
    }

    async fetchMotherVisits(motherId) {
        const [prenatalResult, postpartumResult, newbornResult] = await Promise.all([
            supabase
                .from('prenatal_visits')
                .select('id, visit_date, visit_number, next_appt_type, status')
                .eq('patient_id', motherId),
            supabase
                .from('postpartum_visits')
                .select('id, visit_type, scheduled_date, scheduled_at, attended_date, status')
                .eq('patient_id', motherId),
            supabase
                .from('newborns')
                .select('id, mother_id, baby_name, condition_at_birth')
                .eq('mother_id', motherId)
        ]);
        if (prenatalResult.error) throw Object.assign(new Error(prenatalResult.error.message), { ...prenatalResult.error, source: 'prenatal visits' });
        if (postpartumResult.error) throw Object.assign(new Error(postpartumResult.error.message), { ...postpartumResult.error, source: 'postpartum visits' });
        if (newbornResult.error) throw Object.assign(new Error(newbornResult.error.message), { ...newbornResult.error, source: 'newborn records' });

        const newborns = newbornResult.data || [];
        const newbornIds = newborns.map(newborn => newborn.id).filter(Boolean);
        let vaccinations = [];
        if (newbornIds.length) {
            const vaccinationResult = await supabase
                .from('vaccinations')
                .select('id, newborn_id, scheduled_vaccination, vaccinated_date, status, notes, dose_number, vaccine_inventory (vaccine_name)')
                .in('newborn_id', newbornIds);
            if (vaccinationResult.error) throw Object.assign(new Error(vaccinationResult.error.message), { ...vaccinationResult.error, source: 'newborn vaccinations' });
            vaccinations = vaccinationResult.data || [];
        }

        const newbornById = new Map(newborns.map(newborn => [newborn.id, newborn]));
        const visits = [];
        (prenatalResult.data || []).forEach(visit => {
            if (!visit.id || !visit.visit_date || !isEligibleVisitStatus(visit.status, 'scheduled')) return;
            const details = visit.next_appt_type || 'Prenatal checkup';
            visits.push({
                motherId,
                visitId: String(visit.id),
                visitType: 'prenatal',
                scheduledAt: visit.visit_date,
                visitNumber: visit.visit_number,
                title: 'Upcoming Prenatal Visit',
                body: details
            });
        });
        (postpartumResult.data || []).forEach(visit => {
            const scheduledAt = visit.scheduled_at || visit.scheduled_date;
            if (!visit.id || !scheduledAt || visit.attended_date
                || !isEligibleVisitStatus(visit.status, 'scheduled')) return;
            visits.push({
                motherId,
                visitId: String(visit.id),
                visitType: 'postpartum',
                scheduledAt,
                visitName: visit.visit_type,
                title: 'Upcoming Postpartum Visit',
                body: visit.visit_type || 'Postpartum follow-up'
            });
        });
        vaccinations.forEach(vaccination => {
            const newborn = newbornById.get(vaccination.newborn_id);
            const condition = String(newborn?.condition_at_birth || '').toLowerCase();
            if (!newborn || !vaccination.id || !vaccination.scheduled_vaccination || vaccination.vaccinated_date
                || /stillbirth|stillborn|deceased|dead at birth|died|no baby|miscarriage/.test(condition)
                || !isEligibleVisitStatus(vaccination.status, 'pending')) return;
            visits.push({
                motherId,
                visitId: String(vaccination.id),
                visitType: 'newborn_vaccination',
                scheduledAt: vaccination.scheduled_vaccination,
                babyName: newborn.baby_name,
                vaccineName: vaccination.notes || vaccination.vaccine_inventory?.vaccine_name,
                doseNumber: vaccination.dose_number,
                title: 'Upcoming Newborn Vaccination',
                body: vaccination.notes || vaccination.vaccine_inventory?.vaccine_name || 'Newborn vaccination'
            });
        });
        return { visits, newbornIds };
    }

    buildDesiredSchedules(visits) {
        return visits.flatMap(visit => buildVisitReminderSchedules(visit).map(schedule => {
            const text = createVisitNotificationCopy(visit, schedule.appointmentDate, schedule.reminderDays);
            return {
                ...schedule,
                ...text,
                recordId: makeRecordId(schedule)
            };
        }));
    }

    async upsertSchedule(schedule, existing, status) {
        const nativeId = existing
            ? Number(existing.native_notification_id)
            : await this.allocateNativeId();
        const reconciledAt = new Date().toISOString();
        await this.run(
            `INSERT INTO ${TABLE_NAME}
                (record_id, mother_id, visit_id, visit_type, scheduled_visit_at, reminder_days,
                 reminder_at, native_notification_id, title, body, status, last_reconciled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (mother_id, visit_type, visit_id, reminder_days) DO UPDATE SET
                scheduled_visit_at = excluded.scheduled_visit_at,
                reminder_at = excluded.reminder_at,
                title = excluded.title,
                body = excluded.body,
                status = excluded.status,
                last_reconciled_at = excluded.last_reconciled_at`,
            [
                schedule.recordId,
                schedule.motherId,
                schedule.visitId,
                schedule.visitType,
                schedule.scheduledVisitAt,
                schedule.reminderDays,
                schedule.reminderAt,
                nativeId,
                schedule.title,
                schedule.body,
                status,
                reconciledAt
            ]
        );
        return nativeId;
    }

    async reconcileSchedules(motherId, schedules, permissionGranted) {
        const existingRows = await this.queryRows(
            `SELECT * FROM ${TABLE_NAME} WHERE mother_id = ?`,
            [motherId]
        );
        const existingByKey = new Map(existingRows.map(row => [row.record_id, row]));
        const desiredByKey = new Map(schedules.map(schedule => [schedule.recordId, schedule]));
        const pending = await this.getPendingNotifications();
        const pendingById = new Map(pending.map(notification => [notification.id, notification]));
        const cancelIds = [];
        const deleteRecords = [];
        const rowsToSchedule = [];

        pending.forEach(notification => {
            const recordId = notification.extra?.recordId;
            if (notification.extra?.motherId !== motherId || !recordId) return;
            const existing = existingByKey.get(recordId);
            if (!desiredByKey.has(recordId)
                || !existing
                || Number(existing.native_notification_id) !== notification.id) {
                cancelIds.push(notification.id);
            }
        });

        for (const row of existingRows) {
            const desired = desiredByKey.get(row.record_id);
            const pendingNotification = pendingById.get(Number(row.native_notification_id));
            cancelIds.push(...pending
                .filter(notification => notification.extra?.motherId === motherId
                    && notification.extra?.recordId === row.record_id
                    && notification.id !== Number(row.native_notification_id))
                .map(notification => notification.id));
            if (!desired) {
                if (pendingNotification) cancelIds.push(Number(row.native_notification_id));
                deleteRecords.push(row.record_id);
                continue;
            }
            const changed = row.scheduled_visit_at !== desired.scheduledVisitAt
                || row.reminder_at !== desired.reminderAt
                || row.title !== desired.title
                || row.body !== desired.body;
            if (changed && pendingNotification) cancelIds.push(Number(row.native_notification_id));
            if (!permissionGranted && pendingNotification) cancelIds.push(Number(row.native_notification_id));
        }

        for (const schedule of desiredByKey.values()) {
            const old = existingByKey.get(schedule.recordId);
            cancelIds.push(...pending
                .filter(notification => notification.extra?.motherId === motherId
                    && notification.extra?.recordId === schedule.recordId
                    && (!old || notification.id !== Number(old.native_notification_id)))
                .map(notification => notification.id));
        }
        if (!permissionGranted) {
            const knownIds = new Set(existingRows.map(row => Number(row.native_notification_id)));
            cancelIds.push(...pending
                .filter(notification => notification.extra?.motherId === motherId && !knownIds.has(notification.id))
                .map(notification => notification.id));
        }

        await this.cancelNativeIds(cancelIds);
        for (const recordId of deleteRecords) {
            await this.run(`DELETE FROM ${TABLE_NAME} WHERE record_id = ?`, [recordId]);
            desiredByKey.delete(recordId);
        }

        const latestPending = await this.getPendingNotifications();
        const latestPendingIds = new Set(latestPending.map(notification => notification.id));
        for (const schedule of desiredByKey.values()) {
            if (new Date(schedule.reminderAt).getTime() <= Date.now()) {
                const old = existingByKey.get(schedule.recordId);
                if (old) await this.run(`DELETE FROM ${TABLE_NAME} WHERE record_id = ?`, [schedule.recordId]);
                continue;
            }
            const old = existingByKey.get(schedule.recordId);
            const changed = old && (
                old.scheduled_visit_at !== schedule.scheduledVisitAt
                || old.reminder_at !== schedule.reminderAt
                || old.title !== schedule.title
                || old.body !== schedule.body
            );
            const nativeId = await this.upsertSchedule(
                schedule,
                old,
                permissionGranted ? 'pending' : 'permission_denied'
            );
            if (!permissionGranted) continue;
            if (!changed && latestPendingIds.has(nativeId)) {
                await this.run(
                    `UPDATE ${TABLE_NAME} SET status = 'scheduled', last_reconciled_at = ? WHERE record_id = ?`,
                    [new Date().toISOString(), schedule.recordId]
                );
                continue;
            }
            rowsToSchedule.push({ schedule, nativeId });
        }

        if (!permissionGranted) {
            await this.run(
                `UPDATE ${TABLE_NAME} SET status = 'permission_denied', last_reconciled_at = ? WHERE mother_id = ?`,
                [new Date().toISOString(), motherId]
            );
            return { pendingCount: 0, failures: 0, permissionDenied: true };
        }

        let failures = 0;
        let firstFailure = null;
        for (const { schedule, nativeId } of rowsToSchedule) {
            try {
                if (new Date(schedule.reminderAt).getTime() <= Date.now()) {
                    await this.run(`DELETE FROM ${TABLE_NAME} WHERE record_id = ?`, [schedule.recordId]);
                    continue;
                }
                await LocalNotifications.schedule({
                    notifications: [{
                        id: nativeId,
                        title: schedule.title,
                        body: schedule.body,
                        channelId: CHANNEL_ID,
                        schedule: { at: new Date(schedule.reminderAt), allowWhileIdle: true },
                        extra: {
                            motherId,
                            visitId: schedule.visitId,
                            visitType: schedule.visitType,
                            reminderDays: schedule.reminderDays,
                            recordId: schedule.recordId
                        }
                    }]
                });
                const confirmed = await this.getPendingNotifications();
                if (!confirmed.some(notification => notification.id === nativeId)) {
                    throw new Error('Android did not report the reminder as pending after scheduling.');
                }
                await this.run(
                    `UPDATE ${TABLE_NAME} SET status = 'scheduled', last_reconciled_at = ? WHERE record_id = ?`,
                    [new Date().toISOString(), schedule.recordId]
                );
            } catch (error) {
                failures += 1;
                firstFailure ||= error;
                await this.run(
                    `UPDATE ${TABLE_NAME} SET status = 'failed', last_reconciled_at = ? WHERE record_id = ?`,
                    [new Date().toISOString(), schedule.recordId]
                );
                console.error('Failed to schedule visit reminder:', error);
            }
        }

        const pendingAfterScheduling = await this.getPendingNotifications();
        const ownPending = pendingAfterScheduling.filter(notification => notification.extra?.motherId === motherId);
        return { pendingCount: ownPending.length, failures, firstFailure, permissionDenied: false };
    }

    async reconcileSavedSchedules(motherId, permissionGranted) {
        const rows = await this.queryRows(
            `SELECT * FROM ${TABLE_NAME} WHERE mother_id = ?`,
            [motherId]
        );
        const schedules = rows.map(row => ({
            recordId: row.record_id,
            motherId: row.mother_id,
            visitId: row.visit_id,
            visitType: row.visit_type,
            scheduledVisitAt: row.scheduled_visit_at,
            reminderDays: Number(row.reminder_days),
            reminderAt: row.reminder_at,
            title: row.title,
            body: row.body
        }));
        return this.reconcileSchedules(motherId, schedules, permissionGranted);
    }

    async syncFromSupabase(motherId) {
        const result = await this.fetchMotherVisits(motherId);
        if (this.motherId !== motherId) return { pendingCount: 0, failures: 0, permissionDenied: !this.permissionGranted };
        await this.setVaccinationSubscriptions(motherId, result.newbornIds);
        const schedules = this.buildDesiredSchedules(result.visits);
        return this.reconcileSchedules(motherId, schedules, this.permissionGranted);
    }

    updateStatus(result, mode = 'synced') {
        if (result.permissionDenied) {
            this.setStatus({
                state: 'permission-denied',
                pendingCount: 0,
                message: 'Visit reminders are turned off. Allow notifications for DasMom in your device settings to receive reminders.'
            });
        } else if (result.failures) {
            this.setStatus({
                state: 'failed',
                pendingCount: result.pendingCount,
                message: 'Some visit reminders could not be set up. Check that notifications are allowed for DasMom, then reopen the app to try again.'
            });
        } else if (mode === 'offline') {
            this.setStatus({
                state: 'offline',
                pendingCount: result.pendingCount,
                message: `You’re offline. You’re viewing information saved on this device. Connect to Wi-Fi or turn on mobile data to sync changes.${result.pendingCount ? ` Your ${result.pendingCount} saved visit reminder(s) remain scheduled.` : ''}`
            });
        } else {
            this.setStatus({
                state: result.pendingCount ? 'active' : 'empty',
                pendingCount: result.pendingCount,
                message: 'You’re online. Your records are saved on this device and available offline.'
            });
        }
    }

    async performSync() {
        const motherId = this.motherId;
        if (!motherId) return;
        let localResult;
        try {
            const permissionGranted = await this.setPermission(false);
            localResult = await this.reconcileSavedSchedules(motherId, permissionGranted);
        } catch (error) {
            if (this.motherId !== motherId) return;
            console.error('Failed to restore or verify saved visit reminders:', error);
            this.setStatus({
                state: 'failed',
                pendingCount: 0,
                message: 'We could not check your saved visit reminders on this device. Reopen DasMom to try again.'
            });
            return;
        }
        if (this.motherId !== motherId) return;
        if (!navigator.onLine) {
            this.updateStatus(localResult, 'offline');
            return;
        }

        try {
            const result = await this.syncFromSupabase(motherId);
            if (this.motherId !== motherId) return;
            if (!this.visitChannel) await this.subscribeToMotherVisits(motherId);
            this.updateStatus(result);
        } catch (error) {
            if (this.motherId !== motherId) return;
            console.error('Failed to refresh mother appointments for visit reminders:', error);
            const message = String(error?.message || error || '').toLowerCase();
            const networkError = !navigator.onLine || error instanceof TypeError
                || !error?.status && /network|fetch|timeout|timed out|offline/.test(message);
            this.setStatus({
                state: networkError ? 'offline' : 'sync-failed',
                pendingCount: localResult.pendingCount,
                message: networkError
                    ? `You’re offline. You’re viewing information saved on this device. Connect to Wi-Fi or turn on mobile data to sync changes.${localResult.pendingCount ? ` Your ${localResult.pendingCount} saved visit reminder(s) remain scheduled.` : ''}`
                    : `We couldn’t refresh your visit reminders just now. Your saved information is still on this device. Please try again later.`
            });
        }
    }

    async reconcilePersistedSchedulesForSession(motherId) {
        if (!this.isSupported() || !motherId) return;
        await this.openDatabase();
        const pending = await this.getPendingNotifications();
        await this.ensureOtherAccountIsolation(motherId, pending);
        const permissionGranted = await this.setPermission(false);
        await this.reconcileSavedSchedules(motherId, permissionGranted);
    }

    requestSync() {
        this.syncRequested = true;
        if (this.syncPromise) return this.syncPromise;
        this.syncPromise = (async () => {
            while (this.syncRequested) {
                this.syncRequested = false;
                await this.performSync();
            }
        })().finally(() => {
            this.syncPromise = null;
            if (this.syncRequested) this.requestSync();
        });
        return this.syncPromise;
    }

    async subscribeToMotherVisits(motherId) {
        const channel = supabase.channel(`mother-visit-reminders-${motherId}`);
        const refresh = () => {
            if (this.motherId === motherId) this.requestSync();
        };
        channel.on('postgres_changes', {
            event: '*', schema: 'public', table: 'prenatal_visits', filter: `patient_id=eq.${motherId}`
        }, refresh);
        channel.on('postgres_changes', {
            event: '*', schema: 'public', table: 'postpartum_visits', filter: `patient_id=eq.${motherId}`
        }, refresh);
        channel.on('postgres_changes', {
            event: '*', schema: 'public', table: 'newborns', filter: `mother_id=eq.${motherId}`
        }, refresh);
        channel.subscribe();
        this.visitChannel = channel;
    }

    async setVaccinationSubscriptions(motherId, newbornIds) {
        if (this.motherId !== motherId) return;
        const normalizedIds = [...new Set(newbornIds)].sort();
        if (this.subscribedMotherId === motherId
            && normalizedIds.join(',') === this.subscribedNewbornIds.join(',')) return;
        if (this.vaccinationChannel) {
            const previousChannel = this.vaccinationChannel;
            await supabase.removeChannel(previousChannel);
            if (this.vaccinationChannel === previousChannel) this.vaccinationChannel = null;
        }
        if (this.motherId !== motherId) return;
        this.subscribedNewbornIds = normalizedIds;
        this.subscribedMotherId = motherId;
        if (!normalizedIds.length) return;

        const channel = supabase.channel(`mother-vaccination-reminders-${motherId}`);
        normalizedIds.forEach(newbornId => {
            channel.on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'vaccinations',
                filter: `newborn_id=eq.${newbornId}`
            }, () => {
                if (this.motherId === motherId) this.requestSync();
            });
        });
        channel.subscribe();
        this.vaccinationChannel = channel;
    }

    async refreshVaccinationSubscriptions(motherId) {
        const result = await supabase
            .from('newborns')
            .select('id')
            .eq('mother_id', motherId);
        if (result.error) throw result.error;
        if (this.motherId === motherId) {
            await this.setVaccinationSubscriptions(
                motherId,
                (result.data || []).map(newborn => newborn.id).filter(Boolean)
            );
        }
    }

    async start(motherId, statusListener) {
        if (!this.isSupported()) {
            statusListener({ state: 'unsupported', pendingCount: 0, message: '' });
            return () => {};
        }
        const generation = ++this.startGeneration;
        await this.openDatabase();
        if (generation !== this.startGeneration) return () => {};
        this.motherId = motherId;
        this.statusListener = statusListener;
        await LocalNotifications.createChannel({
            id: CHANNEL_ID,
            name: 'Visit reminders',
            description: 'Reminders for your scheduled prenatal, postpartum, and newborn vaccination visits.',
            importance: 4
        });
        const permissionGranted = await this.setPermission(true);
        if (generation !== this.startGeneration || this.motherId !== motherId) return () => {};
        const pending = await this.getPendingNotifications();
        await this.ensureOtherAccountIsolation(motherId, pending);
        if (generation !== this.startGeneration || this.motherId !== motherId) return () => {};
        const initialResult = await this.reconcileSavedSchedules(motherId, permissionGranted);
        if (generation !== this.startGeneration || this.motherId !== motherId) return () => {};
        if (!navigator.onLine) this.updateStatus(initialResult, 'offline');

        const requestRefresh = () => {
            this.setPermission(false).then(() => {
                this.requestSync();
            }).catch(error => {
                console.error('Failed to check visit notification permission:', error);
                this.setStatus({
                    state: 'failed',
                    pendingCount: 0,
                    message: 'Notification permission could not be checked. Reopen the app to retry.'
                });
            });
        };
        const onOnline = () => this.requestSync();
        const onForeground = () => {
            if (document.visibilityState === 'visible') requestRefresh();
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('focus', requestRefresh);
        document.addEventListener('visibilitychange', onForeground);
        if (navigator.onLine) {
            try {
                await this.subscribeToMotherVisits(motherId);
                await this.refreshVaccinationSubscriptions(motherId);
            } catch (error) {
                console.error('Failed to subscribe to visit changes:', error);
            }
            this.requestSync();
        }

        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('focus', requestRefresh);
            document.removeEventListener('visibilitychange', onForeground);
            if (this.motherId === motherId) {
                this.startGeneration += 1;
                if (this.visitChannel) {
                    supabase.removeChannel(this.visitChannel);
                    this.visitChannel = null;
                }
                if (this.vaccinationChannel) {
                    supabase.removeChannel(this.vaccinationChannel);
                    this.vaccinationChannel = null;
                }
                this.subscribedNewbornIds = [];
                this.subscribedMotherId = null;
                this.motherId = null;
                this.statusListener = null;
            }
        };
    }

    async cancelAndClearMother(motherId) {
        if (!this.isSupported() || !motherId) return;
        await this.openDatabase();
        const rows = await this.queryRows(
            `SELECT native_notification_id FROM ${TABLE_NAME} WHERE mother_id = ?`,
            [motherId]
        );
        const pending = await this.getPendingNotifications();
        const ownPendingIds = pending.filter(notification => notification.extra?.motherId === motherId)
            .map(notification => notification.id);
        await this.cancelNativeIds([
            ...rows.map(row => Number(row.native_notification_id)),
            ...ownPendingIds
        ]);
        const delivered = await LocalNotifications.getAll({ state: 'TRIGGERED' });
        const trackedIds = new Set(rows.map(row => Number(row.native_notification_id)));
        const ownDeliveredIds = (delivered.notifications || [])
            .filter(notification => trackedIds.has(notification.id)
                || notification.extra?.motherId === motherId)
            .map(notification => notification.id);
        await this.removeDeliveredNotificationIds(ownDeliveredIds);
        await this.run(`DELETE FROM ${TABLE_NAME} WHERE mother_id = ?`, [motherId]);
    }
}

export default new VisitNotificationService();
