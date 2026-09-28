import { getSystemSettings } from './systemSettings';

export const formatDate = (dateValue, options = {}) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;

    const settings = getSystemSettings();
    const formatStr = settings?.regional?.dateFormat || 'MM/DD/YYYY';

    if (Object.keys(options).length > 0) {
        const locale = formatStr === 'DD/MM/YYYY' ? 'en-GB' : 'en-US';
        return date.toLocaleDateString(locale, options);
    }

    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();

    if (formatStr === 'DD/MM/YYYY') {
        return `${dd}/${mm}/${yyyy}`;
    }
    return `${mm}/${dd}/${yyyy}`;
};

export const formatTime = (dateValue, options = {}) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;

    const finalOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        ...options
    };

    return date.toLocaleTimeString('en-US', finalOptions);
};
