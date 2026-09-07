const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\UserVaccinations.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VACCINATIONS REDESIGN: TYPOGRAPHY SHRINK
══════════════════════════════════════════ */

@media (max-width: 600px) {
    /* Top Badges */
    .uv-category-tag {
        font-size: 9px !important;
        padding: 3px 6px !important;
    }
    .uv-status-badge {
        font-size: 9.5px !important;
        padding: 3px 6px !important;
    }
    .uv-status-badge svg {
        width: 10px !important;
        height: 10px !important;
    }

    /* Vaccine Name (Unknown) */
    .uv-vaccine-name {
        font-size: 15px !important;
        margin-bottom: 12px !important;
    }

    /* Schedule Box */
    .uv-vaccine-schedule {
        padding: 10px !important;
        gap: 6px !important;
        margin-bottom: 12px !important;
    }
    .uv-schedule-item .label {
        font-size: 11px !important;
    }
    .uv-schedule-item .value {
        font-size: 12px !important;
    }

    /* Footer Details Link */
    .uv-card-footer {
        font-size: 11px !important;
        padding-top: 10px !important;
    }
    .uv-card-footer svg {
        width: 12px !important;
        height: 12px !important;
    }

    /* Outer Card Padding Adjust */
    .uv-vaccine-card {
        padding: 14px !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Card Typography Shrink CSS.');
