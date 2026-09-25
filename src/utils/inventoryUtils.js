export const isBatchExpired = (expirationDate) => {
    if (!expirationDate) return false;
    const expDate = new Date(expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expDate <= today;
};

export const getInventoryStatus = (qty, maxStock, hasExpiredStock) => {
    if (hasExpiredStock) return { label: 'EXPIRED', class: 'status-expired' };
    if (qty <= 0) return { label: 'Out of Stock', class: 'status-out' };
    
    const percentage = maxStock ? Math.round((qty / maxStock) * 100) : 0;
    
    if (percentage <= 20) return { label: 'Low Stock', class: 'status-low' };
    if (percentage <= 50) return { label: 'Medium Stock', class: 'status-medium' };
    return { label: 'Normal', class: 'status-ok' };
};
