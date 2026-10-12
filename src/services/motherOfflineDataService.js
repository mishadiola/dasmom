import { Capacitor } from '@capacitor/core';
import { SQLiteConnection, CapacitorSQLite } from '@capacitor-community/sqlite';

const DATABASE_NAME = 'dasmom_mother_records';
const TABLE_NAME = 'mother_offline_records';
const sqlite = new SQLiteConnection(CapacitorSQLite);

class MotherOfflineDataService {
  constructor() {
    this.database = null;
    this.databasePromise = null;
  }

  isSupported() {
    return Capacitor.getPlatform() === 'android';
  }

  async openDatabase() {
    if (!this.isSupported()) return null;
    if (this.database) return this.database;
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = (async () => {
      const database = await sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false);
      await database.open();
      await database.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          mother_id TEXT PRIMARY KEY NOT NULL,
          patient_json TEXT NOT NULL,
          last_synced_at TEXT NOT NULL
        )
      `);
      this.database = database;
      return database;
    })();

    try {
      return await this.databasePromise;
    } catch (error) {
      this.databasePromise = null;
      throw error;
    }
  }

  async getPatient(motherId) {
    const database = await this.openDatabase();
    if (!database) return null;
    const result = await database.query(
      `SELECT patient_json FROM ${TABLE_NAME} WHERE mother_id = ?`,
      [motherId]
    );
    const value = result.values?.[0]?.patient_json;
    return value ? JSON.parse(value) : null;
  }

  async savePatient(motherId, patient) {
    const database = await this.openDatabase();
    if (!database) return;
    await database.run(
      `INSERT INTO ${TABLE_NAME} (mother_id, patient_json, last_synced_at)
       VALUES (?, ?, ?)
       ON CONFLICT (mother_id) DO UPDATE SET
         patient_json = excluded.patient_json,
         last_synced_at = excluded.last_synced_at`,
      [motherId, JSON.stringify(patient), new Date().toISOString()]
    );
  }

  async retainMother(motherId) {
    const database = await this.openDatabase();
    if (!database) return;
    await database.run(`DELETE FROM ${TABLE_NAME} WHERE mother_id != ?`, [motherId]);
  }

  async removePatient(motherId) {
    const database = await this.openDatabase();
    if (!database) return;
    await database.run(`DELETE FROM ${TABLE_NAME} WHERE mother_id = ?`, [motherId]);
  }
}

export default new MotherOfflineDataService();
