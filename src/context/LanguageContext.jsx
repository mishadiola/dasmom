import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations } from '../utils/motherTranslations';

const LanguageContext = createContext(null);

const LS_KEY = 'dasmom_language';

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        try {
            return localStorage.getItem(LS_KEY) || 'en';
        } catch {
            return 'en';
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEY, language);
        } catch {
            // ignore storage errors
        }
    }, [language]);

    const toggleLanguage = useCallback(() => {
        setLanguage(prev => prev === 'en' ? 'fil' : 'en');
    }, []);

    const t = useCallback((key, fallback) => {
        const dict = translations[language] || translations.en;
        if (dict[key] !== undefined && dict[key] !== '') return dict[key];
        if (translations.en[key] !== undefined && translations.en[key] !== '') return translations.en[key];
        return fallback !== undefined ? fallback : key;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        // Return safe defaults when used outside provider (e.g., Staff side)
        return { language: 'en', toggleLanguage: () => {}, t: (key, fallback) => fallback !== undefined ? fallback : key };
    }
    return context;
};

export default LanguageContext;
