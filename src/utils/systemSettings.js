const STORAGE_KEY = 'dasmom.systemSettings';

export const DEFAULT_SYSTEM_SETTINGS = {
    notifications: {
        highRiskEmail: true,
        appointmentReminder: true,
        lowStock: true,
    },
    reports: {
        format: 'PDF',
        includeStation: true,
        includePatientSummary: true,
    },
};

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_SYSTEM_SETTINGS));

export const getSystemSettings = () => {
    if (typeof window === 'undefined') return cloneDefaults();

    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
        return {
            notifications: {
                ...DEFAULT_SYSTEM_SETTINGS.notifications,
                ...(stored.notifications || {}),
            },
            reports: {
                ...DEFAULT_SYSTEM_SETTINGS.reports,
                ...(stored.reports || {}),
                format: stored.reports?.format === 'Excel' ? 'Excel' : DEFAULT_SYSTEM_SETTINGS.reports.format,
            },
        };
    } catch (error) {
        console.warn('Unable to read system settings:', error);
        return cloneDefaults();
    }
};

export const saveSystemSettings = (settings) => {
    const nextSettings = {
        notifications: {
            ...DEFAULT_SYSTEM_SETTINGS.notifications,
            ...(settings?.notifications || {}),
        },
        reports: {
            ...DEFAULT_SYSTEM_SETTINGS.reports,
            ...(settings?.reports || {}),
        },
    };

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
        window.dispatchEvent(new CustomEvent('dasmom:system-settings-changed', { detail: nextSettings }));
    }

    return nextSettings;
};

export const resetSystemSettings = () => saveSystemSettings(cloneDefaults());
