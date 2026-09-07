const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MotherDashboard.css';
let content = fs.readFileSync(path, 'utf8');

// Replace the padding-right rule in the mobile block
content = content.replace(
    /padding-right: 25%;/g,
    '/* padding-right: 25%; removed to fix text wrapping */'
);

// Specifically ensure the content wrapper uses full width without large paddings on mobile
content = content + `
/* --- URGENT FIX: PREVENT TEXT WRAPPING --- */
@media (max-width: 600px) {
    .mother-welcome-header-content-wrapper {
        width: 100% !important;
        max-width: 100% !important;
        padding-right: 5% !important; /* Only a tiny bit of padding so it doesn't hit the absolute edge */
    }
}
`;

fs.writeFileSync(path, content);
console.log('Fixed CSS text wrapping rules.');
