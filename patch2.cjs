const fs = require('fs');

// Patch 1: DashboardLayout.css (Header spacing)
const dashPath = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\layouts\\DashboardLayout.css';
let dashContent = fs.readFileSync(dashPath, 'utf8');

const topbarMobileRule = `
    .topbar {
        padding: 0 24px;
    }
    .topbar-right {
        gap: 20px;
    }
`;

if (!dashContent.includes('.topbar-right { gap: 20px; }')) {
    dashContent = dashContent.replace(
        '@media (max-width: 768px) {',
        '@media (max-width: 768px) {' + topbarMobileRule
    );
    fs.writeFileSync(dashPath, dashContent);
    console.log('Patched DashboardLayout.css');
}

// Patch 2 & 3: MotherDashboard.css (Timeline type & EDD alignment)
const motherPath = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MotherDashboard.css';
let motherContent = fs.readFileSync(motherPath, 'utf8');

// Update timeline-type
const oldTimelineType = '.timeline-type { font-size: 11px; }';
const newTimelineType = `
    .timeline-type { 
        font-size: 9px; 
        font-weight: 700; 
        background: rgba(185, 129, 138, 0.1); 
        color: var(--color-rose); 
        padding: 3px 6px; 
        border-radius: 4px; 
        display: inline-block; 
        text-transform: uppercase; 
        letter-spacing: 0.5px;
    }`;

if (motherContent.includes(oldTimelineType)) {
    motherContent = motherContent.replace(oldTimelineType, newTimelineType);
}

// Update EDD content box
const oldEddBox = `/* ── EDD Card compact horizontal layout ── */
    .edd-content-box {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        min-height: auto;
        padding: 4px 0;
    }
    .edd-icon-wrapper {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        flex-shrink: 0;
    }
    .edd-icon-wrapper svg { width: 16px; height: 16px; }
    .edd-details-wrapper { display: flex; flex-direction: column; }
    .edd-title-small { font-size: 9px; margin-bottom: 1px; }
    .edd-display { font-size: 14px; font-weight: 800; margin: 0; line-height: 1.1; }
    .edd-subtitle { font-size: 9px; padding: 2px 6px; margin-top: 2px; }`;

const newEddBox = `/* ── EDD Card compact vertically centered layout ── */
    .edd-content-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: auto;
        padding: 8px 0;
        text-align: center;
    }
    .edd-icon-wrapper {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        margin: 0 auto;
    }
    .edd-icon-wrapper svg { width: 16px; height: 16px; }
    .edd-details-wrapper { display: flex; flex-direction: column; align-items: center; width: 100%; }
    .edd-title-small { font-size: 10px; margin-bottom: 2px; text-align: center; }
    .edd-display { font-size: 16px; font-weight: 800; margin: 0; line-height: 1.1; text-align: center; }
    .edd-subtitle { font-size: 9px; padding: 2px 6px; margin-top: 4px; text-align: center; }`;

if (motherContent.includes(oldEddBox)) {
    motherContent = motherContent.replace(oldEddBox, newEddBox);
}

fs.writeFileSync(motherPath, motherContent);
console.log('Patched MotherDashboard.css');
