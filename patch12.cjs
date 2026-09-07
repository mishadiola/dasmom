const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MyVitals.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VITALS REDESIGN: HISTORY BADGE FIX
══════════════════════════════════════════ */

@media (max-width: 600px) {
    /* Remove the pseudo-element hack on the date cell */
    .v-table td:first-child::after {
        display: none !important;
    }

    /* Make row relative for absolute positioning of the badge */
    .v-table-row {
        position: relative !important;
    }

    /* Restore the 6th cell (Trimester) and make it the badge */
    .v-table td:nth-child(6) {
        display: inline-flex !important;
        position: absolute !important;
        top: 14px !important;
        right: 16px !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        color: var(--color-rose) !important;
        background: rgba(185, 129, 138, 0.1) !important;
        padding: 3px 8px !important;
        border-radius: 4px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        border: none !important; /* No bottom border */
    }

    /* Hide the 'Trimester' ::before label on the badge itself */
    .v-table td:nth-child(6)::before {
        display: none !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Badge Fix CSS rules.');
