const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MyVitals.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VITALS REDESIGN: FINAL SMALL FIXES
══════════════════════════════════════════ */

@media (max-width: 600px) {

    /* 1. Remove duplicate line */
    .vitals-history .section-title {
        border-left: none !important;
        border: none !important;
        box-shadow: none !important;
    }
    .vitals-history .section-title::after {
        display: none !important;
    }
    
    /* Ensure the single line is perfect */
    .vitals-history .section-title::before {
        content: '' !important;
        position: absolute !important;
        left: 0 !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        width: 4px !important;
        height: 18px !important;
        background: var(--color-rose) !important;
        border-radius: 4px !important;
        display: block !important;
    }

    /* 2. Compact Dropdown Filter (Single Line) */
    .filter-item {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: flex-start !important;
        padding: 6px 12px !important;
        border-radius: 8px !important;
        border: 1px solid rgba(185, 129, 138, 0.2) !important;
        background: #ffffff !important;
        width: fit-content !important;
        gap: 6px !important;
        min-height: 0 !important;
        height: auto !important;
    }
    .filter-item svg {
        width: 12px !important;
        height: 12px !important;
        color: var(--color-text-light) !important;
        display: block !important;
        margin: 0 !important;
    }
    .filter-item select {
        font-size: 13px !important;
        font-weight: 600 !important;
        color: var(--color-text-dark) !important;
        padding: 0 !important;
        margin: 0 !important;
        height: auto !important;
        background: transparent !important;
        border: none !important;
        display: block !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended final small fixes CSS.');
