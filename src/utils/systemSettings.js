const STORAGE_KEY = 'dasmom.systemSettings';

export const DEFAULT_SYSTEM_SETTINGS = {

    tables: {
        rowsPerPage: 10,
        defaultPatientView: 'Active Patients',
    },
    regional: {
        dateFormat: 'MM/DD/YYYY',
    },
    export: {
        defaultFormat: 'Excel',
    }
};

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));

export const getSystemSettings = () => {
    if (typeof window === 'undefined') return cloneDefaults();

    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
        return {

            tables: { ...DEFAULT_SYSTEM_SETTINGS.tables, ...(stored.tables || {}) },
            regional: { ...DEFAULT_SYSTEM_SETTINGS.regional, ...(stored.regional || {}) },
            export: { ...DEFAULT_SYSTEM_SETTINGS.export, ...(stored.export || {}) }
        };
    } catch (error) {
        console.warn('Unable to read system settings:', error);
        return cloneDefaults();
    }
};

export const saveSystemSettings = (settings) => {
    const nextSettings = {

        tables: { ...DEFAULT_SYSTEM_SETTINGS.tables, ...(settings?.tables || {}) },
        regional: { ...DEFAULT_SYSTEM_SETTINGS.regional, ...(settings?.regional || {}) },
        export: { ...DEFAULT_SYSTEM_SETTINGS.export, ...(settings?.export || {}) }
    };

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
        window.dispatchEvent(new CustomEvent('dasmom:system-settings-changed', { detail: nextSettings }));
    }

    return nextSettings;
};

export const resetSystemSettings = () => saveSystemSettings(cloneDefaults());
