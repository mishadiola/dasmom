const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MyVitals.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VITALS REDESIGN: MOTHER MOBILE-FIRST
══════════════════════════════════════════ */

@media (max-width: 600px) {
    /* Base Container */
    .my-vitals-page {
        padding: 0 0 80px 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
    }

    /* ── Compact Hero Header ── */
    .vitals-hero-header-with-img {
        min-height: 0 !important;
        height: auto !important;
        padding: 16px !important;
        border-radius: 16px !important;
        margin-bottom: 12px !important;
        box-sizing: border-box !important;
    }
    .vitals-hero-content-wrapper {
        width: 100% !important;
        max-width: 65% !important;
        padding-right: 5% !important;
        box-sizing: border-box !important;
    }
    .page-title {
        font-size: 18px !important;
        margin-bottom: 8px !important;
        display: flex;
        align-items: center;
    }
    .page-title .header-icon {
        width: 18px !important;
        height: 18px !important;
    }
    .page-subtitle {
        font-size: 12px !important;
        line-height: 1.4 !important;
        margin-bottom: 12px !important;
    }
    .vitals-badge-btn {
        padding: 6px 12px !important;
        font-size: 11px !important;
    }
    .vitals-silhouette-bg {
        top: auto !important;
        bottom: -5% !important;
        right: -5% !important;
        height: auto !important;
        max-height: 120px !important;
        width: 45% !important;
        object-position: right bottom !important;
        opacity: 0.15 !important;
    }

    /* ── Navigation Tabs ── */
    .vitals-tabs {
        margin-bottom: 12px !important;
        padding: 0 !important;
        gap: 8px !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        scrollbar-width: none !important;
    }
    .vitals-tabs::-webkit-scrollbar { display: none !important; }
    
    .vitals-tab {
        padding: 8px 16px !important;
        font-size: 13px !important;
        border-radius: 10px !important;
        background: #f8f9fb !important;
        border: none !important;
        font-weight: 600 !important;
        color: var(--color-text-light) !important;
        white-space: nowrap !important;
    }
    .vitals-tab.active {
        background: rgba(185, 129, 138, 0.1) !important;
        color: var(--color-rose) !important;
        box-shadow: none !important;
    }
    .vitals-tab::after {
        display: none !important; /* Hide the desktop underline */
    }

    /* ── Current Health Cards (Outer White Container) ── */
    .vitals-section-card {
        padding: 16px !important;
        border-radius: 16px !important;
        margin-bottom: 12px !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.03) !important;
        width: 100% !important;
        box-sizing: border-box !important;
    }
    .vitals-section-card .section-title {
        font-size: 16px !important;
        margin-bottom: 12px !important;
    }

    /* Dense Vitals Grid */
    .vitals-summary-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 8px !important;
    }
    .v-summary-card {
        padding: 12px !important;
        border-radius: 12px !important;
        box-shadow: none !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
    }
    .v-card-top {
        margin-bottom: 0 !important;
    }
    .v-icon-wrap {
        width: 24px !important;
        height: 24px !important;
        border-radius: 6px !important;
    }
    .v-icon-wrap svg {
        width: 12px !important;
        height: 12px !important;
    }
    .v-status {
        padding: 2px 6px !important;
        font-size: 9px !important;
        border-radius: 4px !important;
    }
    .v-value-wrap {
        margin-bottom: 0 !important;
    }
    .v-value {
        font-size: 18px !important;
    }
    .v-unit {
        font-size: 11px !important;
    }
    .v-label {
        font-size: 10px !important;
        margin-top: 0 !important;
    }

    /* ── Health Observations ── */
    .vitals-observations-card {
        padding: 16px !important;
        border-radius: 16px !important;
        margin-bottom: 12px !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.03) !important;
        width: 100% !important;
        box-sizing: border-box !important;
    }
    .vitals-observations-card .section-title {
        font-size: 16px !important;
        margin-bottom: 12px !important;
    }
    .vitals-alerts {
        gap: 8px !important;
    }
    .v-alert-banner {
        padding: 12px !important;
        border-radius: 12px !important;
        gap: 12px !important;
    }
    .v-alert-banner svg {
        width: 16px !important;
        height: 16px !important;
        flex-shrink: 0 !important;
    }
    .v-alert-text h4 {
        font-size: 13px !important;
        margin-bottom: 4px !important;
    }
    .v-alert-text p {
        font-size: 11px !important;
        line-height: 1.4 !important;
    }

    /* ── Vitals History Table -> Stacked Cards ── */
    .vitals-history .history-header {
        margin-top: 8px !important;
        margin-bottom: 12px !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 12px !important;
    }
    .vitals-history .section-title {
        font-size: 18px !important;
    }
    .v-table-wrap {
        padding: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        overflow: visible !important;
    }
    .v-table, .v-table tbody {
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
        width: 100% !important;
    }
    .v-table thead {
        display: none !important;
    }
    .v-table-row {
        display: flex !important;
        flex-direction: column !important;
        background: #ffffff !important;
        border-radius: 16px !important;
        padding: 16px !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.03) !important;
        border: 1px solid rgba(185, 129, 138, 0.08) !important;
        gap: 8px !important;
    }
    .v-table td {
        display: flex !important;
        justify-content: space-between !important;
        padding: 0 !important;
        border: none !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        color: var(--color-text-dark) !important;
        align-items: center !important;
    }
    .v-table td:first-child {
        font-size: 15px !important;
        font-weight: 800 !important;
        border-bottom: 1px solid #f1f5f9 !important;
        padding-bottom: 8px !important;
        margin-bottom: 4px !important;
        justify-content: space-between !important;
    }
    
    /* Move Trimester to the header row of the card */
    .v-table td:first-child::after {
        content: "Trimester";
        font-size: 11px !important;
        font-weight: 700 !important;
        color: var(--color-rose) !important;
        background: rgba(185, 129, 138, 0.1) !important;
        padding: 4px 8px !important;
        border-radius: 6px !important;
    }

    /* Hide the standalone trimester cell since we moved it */
    .v-table td:nth-child(6) {
        display: none !important;
    }

    /* Notes field spans full width */
    .v-table td:last-child {
        margin-top: 8px !important;
        justify-content: flex-start !important;
    }

    /* Add Data Labels for other rows */
    .v-table td:nth-child(2)::before { content: "Weight"; color: var(--color-text-light); font-weight: 600; font-size: 12px; }
    .v-table td:nth-child(3)::before { content: "Blood Pressure"; color: var(--color-text-light); font-weight: 600; font-size: 12px; }
    .v-table td:nth-child(4)::before { content: "Pulse"; color: var(--color-text-light); font-weight: 600; font-size: 12px; }
    .v-table td:nth-child(5)::before { content: "Temperature"; color: var(--color-text-light); font-weight: 600; font-size: 12px; }

    /* Empty state */
    .empty-vitals-message {
        background: white !important;
        border-radius: 16px !important;
        padding: 32px 16px !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Vitals Mobile Redesign CSS rules.');
