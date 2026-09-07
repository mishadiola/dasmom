const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MyVitals.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VITALS REDESIGN: FINAL MOBILE OVERHAUL
══════════════════════════════════════════ */

/* Desktop Base: Hide mobile elements */
.mobile-vital-left { display: none; }
.mobile-vital-icon { display: none; }
.mobile-vital-label { display: none; }

@media (max-width: 600px) {

    /* Vitals History Header Accent */
    .vitals-history .section-title {
        position: relative !important;
        padding-left: 12px !important;
    }
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
    }

    /* History Record Card */
    .v-table-row {
        position: relative !important;
        padding: 16px !important;
        border-radius: 16px !important;
        background: #ffffff !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.04) !important;
        border: 1px solid rgba(185, 129, 138, 0.08) !important;
        gap: 0 !important;
        margin-bottom: 16px !important;
    }

    /* Clear all previous td ::before overrides */
    .v-table td:nth-child(2)::before,
    .v-table td:nth-child(3)::before,
    .v-table td:nth-child(4)::before,
    .v-table td:nth-child(5)::before {
        display: none !important;
    }

    /* Make vital rows flex containers for icon vs value */
    .v-table td {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 6px 0 !important;
        border: none !important;
    }

    /* Reveal the mobile left block */
    .mobile-vital-left {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
    }

    /* Icon Block Styling */
    .mobile-vital-icon {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 28px !important;
        height: 28px !important;
        border-radius: 8px !important;
    }
    .v-icon-green { background: #f0fdf4 !important; color: #166534 !important; }
    .v-icon-yellow { background: #fff9eb !important; color: #856404 !important; }
    .v-icon-pink { background: #fff0f6 !important; color: #a61e4d !important; }
    .v-icon-blue { background: #f0f9ff !important; color: #0369a1 !important; } /* Using blue for Temp instead of green again */

    .mobile-vital-icon svg {
        width: 14px !important;
        height: 14px !important;
    }

    /* Text Styling */
    .mobile-vital-label {
        display: block !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        color: var(--color-text-light) !important;
    }
    .vital-val {
        font-size: 14px !important;
        font-weight: 600 !important;
        color: var(--color-text-dark) !important;
        text-align: right !important;
    }

    /* Date Divider */
    .v-table td:first-child {
        padding-bottom: 12px !important;
        margin-bottom: 8px !important;
        border-bottom: 1px solid rgba(185, 129, 138, 0.1) !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Final Mobile Overhaul CSS.');
