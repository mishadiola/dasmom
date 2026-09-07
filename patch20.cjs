const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\UserAccount.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   USER ACCOUNT REDESIGN: MOTHER MOBILE-FIRST
══════════════════════════════════════════ */

/* Logout Button (Applies universally but styled for mobile) */
.ua-logout-container {
    display: flex;
    justify-content: center;
    margin-top: 24px;
    padding-bottom: 24px;
}
.ua-logout-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: #fff;
    color: #e05c73;
    border: 1px solid rgba(224,92,115,0.3);
    border-radius: 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    transition: all 0.2s ease;
}
.ua-logout-btn:active {
    background: #fff0f2;
    transform: translateY(1px);
}

@media (max-width: 600px) {
    /* Base Container */
    .user-account-page {
        padding: 0 0 80px 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
        gap: 16px !important;
    }
    .ua-content {
        padding: 0 !important;
        gap: 16px !important;
    }

    /* ── Compact Header ── */
    .user-account-page .page-header {
        margin-bottom: 0 !important;
        padding: 16px !important;
        border-radius: 16px !important;
    }
    .user-account-page .page-title {
        font-size: 18px !important;
        margin-bottom: 4px !important;
        display: flex;
        align-items: center;
    }
    .user-account-page .page-title .header-icon {
        width: 18px !important;
        height: 18px !important;
    }
    .user-account-page .page-subtitle {
        font-size: 12px !important;
        margin: 0 !important;
    }

    /* ── Profile Card ── */
    .ua-section--personal {
        padding: 16px !important;
        border-radius: 16px !important;
    }
    .ua-section-header {
        flex-direction: row !important; /* Force horizontal layout for Avatar + Name */
        align-items: center !important;
        text-align: left !important;
        gap: 12px !important;
        margin-bottom: 16px !important;
        padding-bottom: 16px !important;
    }
    .ua-avatar-container {
        margin: 0 !important;
    }
    .ua-avatar {
        width: 48px !important;
        height: 48px !important;
        font-size: 18px !important;
    }
    .ua-section-header h2 {
        font-size: 16px !important;
        margin-bottom: 4px !important;
    }
    .ua-subtext {
        font-size: 11px !important;
    }
    .ua-subtext code {
        font-size: 11px !important;
        padding: 2px 4px !important;
    }

    /* ── Information Cards ── */
    .ua-info-grid {
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
    }
    .ua-info-card {
        padding: 12px !important;
        border-radius: 12px !important;
        gap: 12px !important;
        align-items: flex-start !important;
    }
    .ua-info-icon {
        width: 32px !important;
        height: 32px !important;
        border-radius: 8px !important;
    }
    .ua-info-icon svg {
        width: 16px !important;
        height: 16px !important;
    }
    .ua-info-content {
        gap: 2px !important;
    }
    .ua-info-content label {
        font-size: 9.5px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        margin-bottom: 2px !important;
    }
    .ua-info-content p {
        font-size: 13px !important;
        line-height: 1.3 !important;
    }
    .ua-meta {
        font-size: 11px !important;
        margin-top: 2px !important;
    }

    /* ── Read Only Notice ── */
    .ua-info-notice {
        padding: 12px 14px !important;
        border-radius: 12px !important;
        font-size: 11px !important;
        margin-top: 16px !important;
    }
    .ua-info-notice svg {
        width: 14px !important;
        height: 14px !important;
        margin-top: 2px !important;
    }

    /* ── Privacy & Security ── */
    .ua-section--security {
        padding: 16px !important;
        border-radius: 16px !important;
    }
    .ua-section-title h3 {
        font-size: 15px !important;
        margin-bottom: 12px !important;
    }
    .ua-section-title h3 svg {
        width: 16px !important;
        height: 16px !important;
    }
    .ua-security-info {
        padding: 12px !important;
        border-radius: 12px !important;
        gap: 10px !important;
    }
    .ua-security-info p {
        font-size: 12px !important;
        line-height: 1.4 !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Account Mobile Redesign CSS rules.');
