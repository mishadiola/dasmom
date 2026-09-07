const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\PregnancyTips.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   PREGNANCY TIPS REDESIGN: MOTHER MOBILE-FIRST
══════════════════════════════════════════ */

@media (max-width: 600px) {
    /* Base Container */
    .pregnancy-tips-container {
        padding: 0 0 80px 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
        gap: 16px !important;
    }

    /* ── Compact Hero Header ── */
    .pregnancy-tips-container .hero-header-with-img {
        min-height: 0 !important;
        height: auto !important;
        padding: 16px !important;
        border-radius: 16px !important;
        margin-bottom: 0 !important;
        box-sizing: border-box !important;
        width: 100% !important;
    }
    .pregnancy-tips-container .hero-content-wrapper {
        width: 100% !important;
        max-width: 85% !important; /* Plenty of room for text */
        padding-right: 0 !important;
        box-sizing: border-box !important;
    }
    .pregnancy-tips-container .page-title {
        font-size: 18px !important;
        margin-bottom: 8px !important;
        display: flex;
        align-items: center;
    }
    .pregnancy-tips-container .page-title .header-icon {
        width: 18px !important;
        height: 18px !important;
    }
    .pregnancy-tips-container .page-subtitle {
        font-size: 11.5px !important;
        line-height: 1.4 !important;
        margin-bottom: 0 !important;
    }
    .pregnancy-tips-container .hero-silhouette-bg {
        top: auto !important;
        bottom: -5% !important;
        right: -5% !important;
        height: auto !important;
        max-height: 120px !important;
        width: 45% !important;
        object-position: right bottom !important;
        opacity: 0.15 !important;
    }

    /* ── Tip of the Day ── */
    .pt-tod-banner {
        padding: 16px !important;
        border-radius: 16px !important;
        min-height: 0 !important;
        margin-bottom: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        position: relative !important;
    }
    .pt-tod-label {
        font-size: 10px !important;
        margin-bottom: 8px !important;
    }
    .pt-tod-content h2 {
        font-size: 15px !important;
        margin-bottom: 6px !important;
        max-width: 80% !important; /* avoid overlapping icon */
    }
    .pt-tod-content p {
        font-size: 12px !important;
        line-height: 1.3 !important;
        margin-bottom: 12px !important;
        max-width: 80% !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
    }
    .pt-tod-cta {
        font-size: 11px !important;
    }
    .pt-tod-icon-wrap {
        width: 36px !important;
        height: 36px !important;
        position: absolute !important;
        top: 16px !important;
        right: 16px !important;
        bottom: auto !important;
    }
    .pt-tod-icon-wrap svg {
        width: 18px !important;
        height: 18px !important;
    }

    /* ── Search & Saved Row ── */
    .pt-search-row {
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        gap: 8px !important;
        align-items: center !important;
        margin-bottom: 0 !important;
    }
    .pt-search-wrap {
        flex: 1 !important;
        height: auto !important;
        padding: 8px 12px !important;
        border-radius: 12px !important;
    }
    .pt-search-ico {
        width: 14px !important;
        height: 14px !important;
    }
    .pt-search-input {
        font-size: 13px !important;
    }
    .pt-bookmark-toggle {
        flex-shrink: 0 !important;
        padding: 8px 12px !important;
        font-size: 12px !important;
        border-radius: 12px !important;
        height: auto !important;
    }

    /* ── Category Filters ── */
    .pt-categories {
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        padding-bottom: 4px !important;
        scrollbar-width: none !important;
        gap: 8px !important;
        margin-bottom: 0 !important;
    }
    .pt-categories::-webkit-scrollbar {
        display: none !important;
    }
    .pt-cat-btn {
        flex-shrink: 0 !important;
        padding: 6px 14px !important;
        font-size: 12px !important;
        border-radius: 16px !important;
        white-space: nowrap !important;
    }

    /* ── Article Count ── */
    .pt-results-count {
        font-size: 11px !important;
        margin: 0 0 -8px 0 !important;
    }

    /* ── Article Cards ── */
    .pt-grid {
        display: flex !important;
        flex-direction: column !important;
        gap: 16px !important;
    }
    .pt-card {
        border-radius: 16px !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.04) !important;
    }
    .pt-card-header {
        height: 120px !important;
        padding: 12px !important;
    }
    .pt-read-badge {
        font-size: 9px !important;
        padding: 4px 8px !important;
    }
    .pt-card-header .pt-save-btn {
        width: 28px !important;
        height: 28px !important;
    }
    .pt-card-body {
        padding: 14px !important;
    }
    .pt-card-cat {
        font-size: 9px !important;
        padding: 3px 6px !important;
        margin-bottom: 6px !important;
    }
    .pt-card-title {
        font-size: 14px !important;
        margin-bottom: 6px !important;
        line-height: 1.3 !important;
    }
    .pt-card-desc {
        font-size: 12px !important;
        margin-bottom: 12px !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
    }
    .pt-card-footer {
        padding-top: 10px !important;
    }
    .pt-read-time {
        font-size: 11px !important;
    }
    .pt-read-time svg {
        width: 12px !important;
        height: 12px !important;
    }
    .pt-action-link {
        font-size: 11px !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Pregnancy Tips Mobile Redesign CSS rules.');
