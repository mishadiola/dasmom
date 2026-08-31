import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { buildMotherScheduleItems, getReminderDateForItem } from '../utils/motherSchedule.js';
import {
  isNativeSQLiteAvailable,
  saveMotherRecord,
  loadMotherRecord,
  loadAnyMotherRecord,
  clearMotherRecord,
  loadReminderKeys,
  saveReminderKeys,
} from './motherDatabase.js';

const normalizeRole = (role = '') => String(role || '').trim().toLowerCase();
const isMotherRole = (role = '') => ['mother', 'patient'].includes(normalizeRole(role));

export const isNativeAndroid = () => Capacitor.getPlatform() === 'android';

export const supportsNativeNotifications = () => {
  if (typeof window === 'undefined') return false;
  return (Capacitor.isPluginAvailable('LocalNotifications') || 'Notification' in window);
};

export const getNetworkStatus = async () => {
  try {
    if (!Capacitor.isPluginAvailable('Network')) return { connected: true };
    const status = await Network.getStatus();
    return { connected: status.connected, wifi: status.connection === 'wifi' };
  } catch (error) {
    console.error('Failed to read network status:', error);
    return { connected: true };
  }
};

export const persistMotherOfflineData = async (patient = null, authUser = null) => {
  if (!patient || !authUser || !isMotherRole(authUser.role)) return null;

  const snapshot = {
    user: {
      id: authUser.id,
      email: authUser.email,
      role: authUser.role,
      fullName: authUser.fullName || authUser.displayName || null,
    },
    patient: {
      ...patient,
      schedule: buildMotherScheduleItems(patient),
      savedAt: new Date().toISOString(),
    },
  };

  if (!isNativeSQLiteAvailable()) return null;
  await saveMotherRecord(snapshot);

  return snapshot;
};

export const loadMotherOfflineData = async (motherId = null) => {
  try {
    if (!isNativeSQLiteAvailable()) return null;
    return motherId ? await loadMotherRecord(motherId) : await loadAnyMotherRecord();
  } catch (error) {
    console.error('Failed to load mother offline snapshot:', error);
    return null;
  }
};

export const clearMotherOfflineData = async () => {
  try {
    if (!isNativeSQLiteAvailable()) return false;
    await clearMotherRecord();
    return true;
  } catch (error) {
    console.error('Failed to clear mother offline snapshot:', error);
    return false;
  }
};

export const requestNotificationPermission = async ({ title = 'Enable appointment reminders', body = 'Allow DasMom+ to send reminders for your scheduled maternal care visits and vaccinations.' } = {}) => {
  if (typeof window === 'undefined') return { granted: false, reason: 'not-available' };

  try {
    if (isNativeAndroid() && Capacitor.isPluginAvailable('LocalNotifications')) {
      const result = await LocalNotifications.requestPermissions();
      const granted = result?.display === 'granted' || result?.notifications === 'granted' || result?.granted === true;
      return { granted, reason: granted ? 'native-android' : 'denied', title, body };
    }

    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      return { granted, reason: granted ? 'browser' : 'denied', title, body };
    }

    return { granted: false, reason: 'unsupported', title, body };
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return { granted: false, reason: 'error', title, body };
  }
};

export const getStoredReminderKeys = async () => {
  try {
    if (!isNativeSQLiteAvailable()) return [];
    return await loadReminderKeys();
  } catch {
    return [];
  }
};

const getNativeNotificationId = (reminderKey) => {
  let hash = 0;
  for (let index = 0; index < reminderKey.length; index += 1) {
    hash = ((hash << 5) - hash) + reminderKey.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
};

export const saveStoredReminderKeys = async (keys) => {
  if (!isNativeSQLiteAvailable()) return false;
  await saveReminderKeys(keys);
  return keys;
};

export const scheduleMotherReminders = async (patient = null, authUser = null) => {
  if (!patient || !isMotherRole(authUser?.role || patient?.role || 'mother')) {
    return { scheduled: 0, skipped: 0 };
  }

  if (!supportsNativeNotifications()) return { scheduled: 0, skipped: 0 };

  const scheduleItems = buildMotherScheduleItems(patient)
    .filter((item) => {
      const itemDate = new Date(item.date);
      return !Number.isNaN(itemDate.getTime()) && itemDate > new Date();
    });

  if (!scheduleItems.length) {
    await persistMotherOfflineData(patient, authUser || { id: patient.id, role: 'mother' });
    return { scheduled: 0, skipped: 0 };
  }

  const storedKeys = await getStoredReminderKeys();
  const notifications = [];
  const nextKeys = [...storedKeys];

  for (const item of scheduleItems) {
    const reminderAt = getReminderDateForItem(item.date);
    if (!reminderAt || reminderAt <= new Date()) continue;

    const reminderKey = `${item.type}:${item.id}:${reminderAt.toISOString()}`;
    if (nextKeys.includes(reminderKey)) continue;

    const dateValue = new Date(item.date);
    const dateLabel = dateValue.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeLabel = item.time || 'scheduled time';

    notifications.push({
      id: getNativeNotificationId(reminderKey),
      title: `Upcoming ${item.type} reminder`,
      body: `${item.title} is scheduled for ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ''}.`,
      schedule: { at: reminderAt, allowWhileIdle: true },
      sound: 'default',
      actionTypeId: 'tap-reminder',
      extra: { reminderKey, itemType: item.type, itemId: item.id }
    });

    nextKeys.push(reminderKey);
  }

  const offlineSnapshot = await persistMotherOfflineData(patient, authUser || { id: patient.id, role: 'mother', email: patient.email || '', fullName: patient.name || '' });

  if (!notifications.length) {
    return { scheduled: 0, skipped: scheduleItems.length, snapshot: offlineSnapshot };
  }

  try {
    if (isNativeAndroid() && Capacitor.isPluginAvailable('LocalNotifications')) {
      await LocalNotifications.schedule({ notifications });
    } else if ('Notification' in window) {
      notifications.forEach((notification) => {
        const reminder = new Notification(notification.title, { body: notification.body, tag: notification.id });
        if (reminder) setTimeout(() => reminder.close(), 10000);
      });
    }

    await saveStoredReminderKeys(nextKeys);
    return { scheduled: notifications.length, skipped: Math.max(0, scheduleItems.length - notifications.length), snapshot: offlineSnapshot };
  } catch (error) {
    console.error('Failed to schedule mother reminders:', error);
    return { scheduled: 0, skipped: scheduleItems.length, snapshot: offlineSnapshot };
  }
};

export const shouldPromptInstall = () => {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return false;
  return !!('beforeinstallprompt' in window);
};

export const getRoleNotificationSummary = (role, data = []) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'mother' || normalizedRole === 'patient') {
    return (data || []).slice(0, 4).map((item) => ({
      category: 'appointments',
      type: 'info',
      text: `${item.type} reminder: ${item.title} on ${new Date(item.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`,
      time: item.status || 'Scheduled',
    }));
  }

  if (normalizedRole === 'admin') {
    return (data || []).slice(0, 4).map((item) => ({
      category: 'inventory',
      type: item.type === 'warning' ? 'warning' : 'info',
      text: item.text,
      time: item.time || 'Inventory',
    }));
  }

  if (normalizedRole === 'cho personnel') {
    return (data || []).slice(0, 4).map((item) => ({
      category: item.category || 'appointments',
      type: item.type || 'info',
      text: item.text,
      time: item.time || 'Upcoming',
    }));
  }

  if (normalizedRole === 'staff') {
    return (data || []).slice(0, 4).map((item) => ({
      category: 'appointments',
      type: item.type || 'info',
      text: item.text,
      time: item.time || 'Upcoming',
    }));
  }

  return [];
};
