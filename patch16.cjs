const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\UserVaccinations.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VACCINATIONS REDESIGN: HEADER SPACING FIX
══════════════════════════════════════════ */

/* Desktop spacing for the badges row */
.user-vaccinations-page .hero-badges-row {
    display: flex;
    gap: 12px;
    margin-top: 24px;
}

@media (max-width: 600px) {
    /* Mobile spacing for the badges row */
    .user-vaccinations-page .hero-badges-row {
        margin-top: 24px !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Header Spacing CSS.');
