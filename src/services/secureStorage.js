import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

export const isAndroidApp = () => Capacitor.getPlatform() === 'android';

export const secureStorage = {
  async get(key) {
    if (!isAndroidApp()) return null;
    return SecureStorage.getItem(key);
  },

  async set(key, value) {
    if (!isAndroidApp()) return;
    await SecureStorage.setItem(key, value);
  },

  async remove(key) {
    if (!isAndroidApp()) return;
    await SecureStorage.remove(key);
  }
};

export const supabaseSecureStorage = {
  getItem: key => secureStorage.get(key),
  setItem: (key, value) => secureStorage.set(key, value),
  removeItem: key => secureStorage.remove(key)
};
