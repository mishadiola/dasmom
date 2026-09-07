const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MyAppointments.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   APPOINTMENTS REDESIGN: MOTHER MOBILE-FIRST
══════════════════════════════════════════ */

/* ── Hero / Header (Desktop fallback) ── */
.appt-hero-header {
    background: linear-gradient(135deg, var(--color-pink-light) 0%, var(--color-yellow) 35%, var(--color-sage) 70%, var(--color-rose) 100%);
    background-size: 300% 300%;
    animation: bg-pan-header 18s ease infinite;
    position: relative;
    overflow: hidden;
    min-height: 280px;
    display: flex;
    align-items: center;
    padding: 32px 40px !important;
    border-radius: var(--radius-xl);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
}
.appt-hero-content {
    width: 100%;
    max-width: 60%;
    position: relative;
    z-index: 1;
}
.appt-hero-text {
    display: flex;
    flex-direction: column;
}
.appt-hero-text .page-title {
    font-size: 38px;
    font-weight: 800;
    margin-bottom: 12px;
}
.appt-hero-text .page-subtitle {
    font-size: 17px;
    font-weight: 500;
    line-height: 1.5;
    opacity: 0.95;
}
.appt-hero-silhouette {
    position: absolute;
    right: -2%;
    top: -12%;
    height: 145%;
    width: 55%;
    max-width: 60%;
    object-fit: contain;
    object-position: right top;
    z-index: 0;
    pointer-events: none;
    opacity: 0.95;
}

/* ══════════════════════════════════════════
   MOBILE & TABLET REDESIGN (max-width: 768px)
══════════════════════════════════════════ */
@media (max-width: 768px) {
    /* Base Container */
    .my-appointments-page {
        padding: 0 0 80px 0 !important; /* Bottom padding for nav */
        gap: 6px !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
    }

    /* ── Compact Hero ── */
    .appt-hero-header {
        min-height: 0 !important;
        height: auto !important;
        padding: 12px 14px !important;
        border-radius: 12px !important;
        align-items: flex-start !important;
        box-sizing: border-box !important;
        margin-bottom: 6px !important; /* Match dashboard gap */
    }
    .appt-hero-content {
        width: 100% !important;
        max-width: 100% !important;
        padding-right: 5% !important; 
    }
    .appt-hero-text .page-title {
        font-size: 16px !important;
        margin-bottom: 8px !important;
    }
    .appt-hero-text .page-subtitle {
        font-size: 11px !important;
        margin-bottom: 8px !important;
    }
    .appt-hero-silhouette {
        right: -5% !important;
        bottom: -5% !important;
        top: auto !important;
        height: auto !important;
        max-height: 140px !important;
        width: 40% !important;
        max-width: 40% !important;
        object-position: right bottom !important;
        opacity: 0.15 !important;
    }

    /* ── Visit Type Tabs ── */
    .appt-content {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .visit-type-tabs {
        padding: 0 !important;
        margin-bottom: 0 !important;
        gap: 6px !important;
    }
    .visit-type-tab {
        padding: 8px 14px !important;
        font-size: 12px !important;
        border-radius: 8px !important;
        background: #f8f9fb !important;
        font-weight: 600 !important;
    }
    .visit-type-tab.active {
        background: rgba(185, 129, 138, 0.1) !important;
        color: var(--color-rose) !important;
    }

    /* ── Compact Calendar Section ── */
    .pv-calendar-section {
        background: #ffffff !important;
        border-radius: 12px !important;
        padding: 10px !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.03) !important;
        margin-bottom: 6px !important;
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
    }
    .section-head-bar {
        padding: 0 !important;
        gap: 8px !important;
    }
    .view-toggles {
        background: #f1f5f9 !important;
        padding: 4px !important;
        border-radius: 8px !important;
    }
    .view-toggle-btn {
        padding: 6px 0 !important;
        font-size: 11px !important;
        border-radius: 6px !important;
    }
    .view-toggle-btn.active {
        background: #ffffff !important;
        color: var(--color-rose) !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05) !important;
    }
    .date-nav h2 {
        font-size: 12px !important;
        font-weight: 700 !important;
    }

    /* ── Status Tabs (Upcoming / Attended / Missed) ── */
    .list-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100% !important;
        box-sizing: border-box !important;
    }
    .list-filters {
        padding: 0 !important;
        gap: 6px !important;
    }
    .filter-btn {
        padding: 8px 14px !important;
        font-size: 12px !important;
        border-radius: 8px !important;
        background: #ffffff !important;
        font-weight: 600 !important;
        border: 1px solid #eef0f4 !important;
    }
    .filter-btn.active {
        background: rgba(185, 129, 138, 0.1) !important;
        color: var(--color-rose) !important;
        border-color: rgba(185, 129, 138, 0.2) !important;
    }

    /* ── Appointment List & Cards ── */
    .appt-list {
        display: flex;
        flex-direction: column;
        gap: 6px !important;
        width: 100% !important;
        box-sizing: border-box !important;
    }
    .appt-list-item {
        background: #ffffff !important;
        padding: 10px !important;
        border-radius: 12px !important;
        gap: 10px !important;
        flex-direction: row !important;
        align-items: center !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.03) !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    }

    /* Date Tile */
    .appt-date-box {
        width: 44px !important;
        height: auto !important;
        min-height: 48px !important;
        padding: 4px !important;
        border-radius: 8px !important;
        background: #ffffff !important;
        border: 1px solid rgba(185, 129, 138, 0.15) !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
    }
    .appt-date-box .m { font-size: 9px !important; color: var(--color-rose) !important; }
    .appt-date-box .d { font-size: 16px !important; font-weight: 800 !important; margin: 1px 0 !important; color: var(--color-text-dark) !important; }

    /* Main Info */
    .appt-main-info {
        flex: 1 !important;
        min-width: 0 !important; /* Extremely important for anti-overflow */
        background: #f8f9fb !important;
        padding: 8px !important;
        border-radius: 8px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
    }

    /* Title Row */
    .appt-title-row {
        flex-direction: row !important;
        align-items: center !important;
        justify-content: space-between !important;
        margin-bottom: 2px !important;
        width: 100% !important;
    }
    .appt-title-row h3 {
        font-size: 11px !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        color: var(--color-text-dark) !important;
        margin: 0 !important;
    }
    .status-badge {
        font-size: 8px !important;
        font-weight: 700 !important;
        padding: 3px 6px !important;
        border-radius: 4px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        display: flex !important;
        align-items: center !important;
        gap: 3px !important;
    }
    
    /* Meta Row */
    .appt-meta-row {
        flex-direction: row !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
    }
    .appt-meta-row span {
        font-size: 9px !important;
        color: var(--color-text-muted) !important;
        display: flex !important;
        align-items: center !important;
        gap: 3px !important;
        white-space: nowrap !important;
    }
    .appt-meta-row svg {
        width: 10px !important;
        height: 10px !important;
    }

    /* Print Button Hide on mobile to save space */
    .appt-actions {
        display: none !important;
    }
    
    .empty-state {
        padding: 24px 0 !important;
    }
    .empty-state svg {
        width: 24px !important;
        height: 24px !important;
    }
    .empty-state p {
        font-size: 11px !important;
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Redesign CSS rules.');
