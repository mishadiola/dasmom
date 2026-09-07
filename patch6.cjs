const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MotherDashboard.css';
let content = fs.readFileSync(path, 'utf8');

// Global replacement to ensure the margin is applied using a highly specific rule
content = content + `

/* --- URGENT FIX: PREGNANCY HEADER SPACING --- */
.mother-welcome-text-section .page-title {
    margin-bottom: 10px !important;
}
.mother-welcome-text-section .page-subtitle {
    margin-bottom: 24px !important;
}
.mother-welcome-text-section .welcome-badges-row {
    margin-top: 8px !important; /* Total gap between desc and buttons ~ 32px or 24px */
}

@media (max-width: 768px) {
    .mother-welcome-text-section .page-title {
        margin-bottom: 8px !important;
    }
    .mother-welcome-text-section .page-subtitle {
        margin-bottom: 20px !important;
    }
}

@media (max-width: 600px) {
    .mother-welcome-text-section .page-title {
        margin-bottom: 8px !important;
    }
    .mother-welcome-text-section .page-subtitle {
        margin-bottom: 22px !important;
    }
    .mother-welcome-text-section .welcome-badges-row {
        margin-top: 0 !important; 
    }
}
`;

fs.writeFileSync(path, content);
console.log('Fixed CSS spacing rules.');
