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

export const formatLoginDateTime = (dateValue) => {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '—';

    try {
        const dateStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            month: 'long',
            day: '2-digit',
            year: 'numeric'
        }).format(date);

        const timeStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(date);

        return `${dateStr} at ${timeStr}`;
    } catch {
        return date.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    }
};

export const getClientDeviceString = () => {
    if (typeof navigator === 'undefined') return 'Browser / Web Browser';
    const ua = navigator.userAgent || '';
    
    // Check if running in mobile app (Capacitor or Android WebView)
    const isAndroid = /Android/i.test(ua);
    const isWebView = /wv|WebView/i.test(ua) || (typeof window !== 'undefined' && Boolean(window.Capacitor));

    if (isAndroid && isWebView) {
        return 'Android App / Mobile';
    }

    let os = 'Unknown OS';
    if (isAndroid) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac OS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Browser';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';

    if (os === 'Unknown OS' && browser === 'Browser') {
        return 'Browser / Web Browser';
    }

    return `${browser} on ${os}`;
};
