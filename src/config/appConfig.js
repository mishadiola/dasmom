export const DASMOM_APP_URL = (import.meta.env.VITE_DASMOM_APP_URL || 'https://dasmom.vercel.app').replace(/\/$/, '');
export const PASSWORD_RESET_URL = `${DASMOM_APP_URL}/reset-password`;
