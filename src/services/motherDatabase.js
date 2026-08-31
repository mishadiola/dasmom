import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const DATABASE_NAME = 'dasmom_mother';
const MOTHER_TABLE = 'mother_records';
const STATE_TABLE = 'app_state';

const sqliteConnection = new SQLiteConnection(CapacitorSQLite);
let databasePromise = null;

export const isNativeSQLiteAvailable = () => (
  Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios'
) && Capacitor.isPluginAvailable('CapacitorSQLite');

const getDatabase = async () => {
  if (!isNativeSQLiteAvailable()) return null;
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await sqliteConnection.createConnection(
        DATABASE_NAME,
        false,
        'no-encryption',
        1,
        false,
      );
      await database.open();
      await database.execute(`
        CREATE TABLE IF NOT EXISTS ${MOTHER_TABLE} (
          mother_id TEXT PRIMARY KEY NOT NULL,
          user_json TEXT NOT NULL,
          patient_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
          state_key TEXT PRIMARY KEY NOT NULL,
          state_value TEXT NOT NULL
        );
      `);
      return database;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
};

export const saveMotherRecord = async (snapshot) => {
  const database = await getDatabase();
  if (!database || !snapshot?.user?.id || !snapshot.patient) return false;

  await database.run(
    `INSERT OR REPLACE INTO ${MOTHER_TABLE}
      (mother_id, user_json, patient_json, updated_at)
     VALUES (?, ?, ?, ?)`,
    [
      snapshot.user.id,
      JSON.stringify(snapshot.user),
      JSON.stringify(snapshot.patient),
      snapshot.patient.savedAt || new Date().toISOString(),
    ],
  );
  return true;
};

export const loadMotherRecord = async (motherId = null) => {
  const database = await getDatabase();
  if (!database || !motherId) return null;

  const result = await database.query(
    `SELECT user_json, patient_json, updated_at
     FROM ${MOTHER_TABLE} WHERE mother_id = ? LIMIT 1`,
    [motherId],
  );
  const row = result?.values?.[0];
  if (!row) return null;

  return {
    user: JSON.parse(row.user_json),
    patient: JSON.parse(row.patient_json),
    savedAt: row.updated_at,
  };
};

export const loadAnyMotherRecord = async () => {
  const database = await getDatabase();
  if (!database) return null;

  const result = await database.query(
    `SELECT user_json, patient_json, updated_at
     FROM ${MOTHER_TABLE} ORDER BY updated_at DESC LIMIT 1`,
  );
  const row = result?.values?.[0];
  if (!row) return null;

  return {
    user: JSON.parse(row.user_json),
    patient: JSON.parse(row.patient_json),
    savedAt: row.updated_at,
  };
};

export const clearMotherRecord = async () => {
  const database = await getDatabase();
  if (!database) return false;
  await database.execute(`DELETE FROM ${MOTHER_TABLE}; DELETE FROM ${STATE_TABLE};`);
  return true;
};

export const loadReminderKeys = async () => {
  const database = await getDatabase();
  if (!database) return [];
  const result = await database.query(
    `SELECT state_value FROM ${STATE_TABLE} WHERE state_key = ? LIMIT 1`,
    ['mother_reminder_keys'],
  );
  const value = result?.values?.[0]?.state_value;
  return value ? JSON.parse(value) : [];
};

export const saveReminderKeys = async (keys) => {
  const database = await getDatabase();
  if (!database) return false;
  await database.run(
    `INSERT OR REPLACE INTO ${STATE_TABLE} (state_key, state_value) VALUES (?, ?)`,
    ['mother_reminder_keys', JSON.stringify(keys)],
  );
  return true;
};
