const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\UserAccount.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   USER ACCOUNT REDESIGN: LOGOUT ALIGNMENT FIX
══════════════════════════════════════════ */

.ua-logout-container {
    justify-content: flex-start !important;
}

@media (max-width: 600px) {
    .ua-logout-container {
        padding-left: 0 !important; /* Ensure it perfectly aligns with the card edge if there's container padding */
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Logout Alignment CSS.');
