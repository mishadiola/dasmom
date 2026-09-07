const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\UserVaccinations.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VACCINATIONS REDESIGN: HEADER TEXT WRAPPING FIX
══════════════════════════════════════════ */

@media (max-width: 600px) {
    /* Give the text more room to breathe by increasing the max-width */
    .user-vaccinations-page .hero-content-wrapper {
        max-width: 85% !important; /* Increased from 65% */
        padding-right: 0 !important;
    }
    
    /* Slightly reduce the subtitle font size to ensure a clean 2-3 line wrap */
    .user-vaccinations-page .page-subtitle {
        font-size: 11.5px !important;
        line-height: 1.4 !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Header Text Wrapping CSS.');
