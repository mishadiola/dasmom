const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MotherDashboard.css';
let content = fs.readFileSync(path, 'utf8');

const fix = `
/* --- URGENT FIX: PREVENT HORIZONTAL OVERFLOW & COMPACT CARDS --- */
@media (max-width: 600px) {
    /* 1. Ensure all containers strictly bound to 100% width and wrap contents */
    .mother-dash-row-2col,
    .mother-dash-bottom-2col,
    .gestation-details-row {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    }

    .mother-card {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    }

    /* 2. Fix timeline inner items */
    .appointments-timeline {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
    }

    .timeline-item {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        flex-wrap: nowrap !important; /* Keep icon/date and content side-by-side */
    }

    .timeline-content {
        min-width: 0 !important; /* Extremely important for flex items to shrink below their content size */
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }
    
    .timeline-details {
        flex-wrap: wrap !important;
        min-width: 0 !important;
    }

    /* 3. Expected Due Date alignment */
    .edd-content-box {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
    }

    .edd-details-wrapper {
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
    }
}
`;

content = content + fix;
fs.writeFileSync(path, content);
console.log('Appended anti-overflow rules.');
