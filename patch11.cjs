const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MyVitals.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VITALS REDESIGN: FINAL POLISH
══════════════════════════════════════════ */

@media (max-width: 600px) {
    /* 1. Tabs spacing */
    .vitals-tabs {
        margin-bottom: 20px !important;
    }

    /* 2. Vitals History Header Spacing */
    .vitals-history .history-header {
        margin-top: 0 !important;
        margin-bottom: 16px !important;
        gap: 8px !important;
    }

    /* 3. Compact Filter Dropdown */
    .history-filters {
        width: 100% !important;
    }
    .filter-item {
        padding: 4px 12px !important;
        border-radius: 8px !important;
        border: 1px solid rgba(185, 129, 138, 0.2) !important;
        background: #ffffff !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.02) !important;
        width: fit-content !important;
        display: inline-flex !important;
        gap: 6px !important;
    }
    .filter-item svg {
        width: 12px !important;
        height: 12px !important;
        color: var(--color-text-light) !important;
    }
    .filter-item select {
        font-size: 12px !important;
        font-weight: 600 !important;
        color: var(--color-text-dark) !important;
        padding: 2px 0 !important;
    }

    /* 4. History Record Card Polish */
    .v-table-row {
        padding: 16px !important;
        gap: 0 !important; /* Managed by td padding */
        border-radius: 12px !important;
    }

    /* Date and Trimester Row */
    .v-table td:first-child {
        border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
        padding-bottom: 10px !important;
        margin-bottom: 8px !important;
        align-items: center !important;
    }
    .v-table td:first-child strong {
        font-size: 15px !important;
        font-weight: 800 !important;
        color: var(--color-text-dark) !important;
    }
    .v-table td:first-child::after {
        content: "Trimester " attr(data-trimester) !important; /* If data attribute existed, but we'll stick to CSS below */
        font-size: 10px !important;
        font-weight: 700 !important;
        color: var(--color-rose) !important;
        background: rgba(185, 129, 138, 0.1) !important;
        padding: 3px 8px !important;
        border-radius: 4px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
    }

    /* Inner vital rows */
    .v-table td {
        padding: 4px 0 !important; /* Consistent vertical spacing */
        font-size: 13px !important;
        font-weight: 600 !important;
        color: var(--color-text-dark) !important;
    }

    /* Vital labels (muted & smaller) */
    .v-table td:nth-child(2)::before,
    .v-table td:nth-child(3)::before,
    .v-table td:nth-child(4)::before,
    .v-table td:nth-child(5)::before {
        font-size: 12px !important;
        font-weight: 500 !important;
        color: var(--color-text-light) !important;
    }

    /* Status/Notes Badge at bottom */
    .v-table td:last-child {
        margin-top: 12px !important;
        padding-top: 0 !important;
    }
    .v-note-tag {
        font-size: 11px !important;
        font-weight: 600 !important;
        padding: 4px 10px !important;
        border-radius: 6px !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Final Polish CSS rules.');
