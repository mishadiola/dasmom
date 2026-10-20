export const isBatchExpired = (expirationDate) => {
    if (!expirationDate) return false;
    const expDate = new Date(expirationDate);
    if (isNaN(expDate.getTime())) return false;
    expDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expDate <= today;
};

export const isBatchExpiringSoon = (expirationDate, daysThreshold = 30) => {
    if (!expirationDate) return false;
    if (isBatchExpired(expirationDate)) return false;
    const expDate = new Date(expirationDate);
    if (isNaN(expDate.getTime())) return false;
    expDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= daysThreshold;
};

export const getInventoryStatus = (qty, maxStock, hasExpiredStock) => {
    if (hasExpiredStock) return { label: 'EXPIRED', class: 'status-expired' };
    if (qty <= 0) return { label: 'Out of Stock', class: 'status-out' };
    
    const percentage = maxStock ? Math.round((qty / maxStock) * 100) : 0;
    
    if (percentage <= 20) return { label: 'Low Stock', class: 'status-low' };
    if (percentage <= 50) return { label: 'Medium Stock', class: 'status-medium' };
    return { label: 'Normal', class: 'status-ok' };
};
