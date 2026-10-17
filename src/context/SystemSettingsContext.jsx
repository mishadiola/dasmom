import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { getSystemSettings, saveSystemSettings } from '../utils/systemSettings';

const SystemSettingsContext = createContext();

export const SystemSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(getSystemSettings);

    useEffect(() => {
        const handleSettingsChanged = (e) => {
            setSettings(e.detail);
        };
        window.addEventListener('dasmom:system-settings-changed', handleSettingsChanged);
        
        // Initial load sync
        setSettings(getSystemSettings());

        return () => window.removeEventListener('dasmom:system-settings-changed', handleSettingsChanged);
    }, []);
    
    const contextValue = useMemo(() => ({ settings, saveSystemSettings }), [settings]);

    return (
        <SystemSettingsContext.Provider value={contextValue}>
            {children}
        </SystemSettingsContext.Provider>
    );
};

export const useSystemSettings = () => useContext(SystemSettingsContext);
