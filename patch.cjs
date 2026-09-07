const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MotherDashboard.css';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.lastIndexOf('/* ══════════════════════════════════════════', content.indexOf('MOBILE RESPONSIVE (max-width: 600px)'));
const endIdx = content.lastIndexOf('/* ══════════════════════════════════════════', content.indexOf('EXTRA SMALL MOBILE (max-width: 380px)'));

const before = content.slice(0, startIdx);
const after = content.slice(endIdx);

const replacement = `/* ══════════════════════════════════════════
   MOBILE RESPONSIVE (max-width: 600px)
══════════════════════════════════════════ */
@media (max-width: 600px) {
    .mother-dashboard {
        padding: 0 0 80px; /* Add bottom padding so bottom nav does not overlap */
        overflow-x: hidden;
        gap: 6px; /* Tighter gap */
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
    }

    .dashboard-content-layout {
        gap: 6px; /* Tighter layout gap */
        width: 100%;
    }

    /* ── Hero: COMPACT ── */
    .mother-welcome-header-with-img {
        min-height: 0 !important;
        height: auto !important;
        padding: 10px !important; /* Smaller padding */
        border-radius: 12px;
        margin-bottom: 0;
        position: relative;
        overflow: hidden;
        align-items: flex-start;
        display: flex;
        box-sizing: border-box;
    }

    .mother-welcome-header-content-wrapper {
        max-width: 65%;
        width: 65%;
        position: relative;
        z-index: 1;
        flex-shrink: 0;
    }

    .mother-welcome-text-section .page-title {
        font-size: 16px !important;
        font-weight: 800;
        margin-bottom: 2px;
        line-height: 1.1;
    }

    .mother-welcome-text-section .page-subtitle {
        font-size: 10px;
        line-height: 1.25;
        margin-bottom: 6px;
        font-weight: 500;
    }

    .welcome-badges-row {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap; /* keep them tight */
        gap: 4px;
        align-items: center;
        max-width: 100%;
        overflow-x: auto;
    }
    
    .welcome-badges-row::-webkit-scrollbar { display: none; }

    .welcome-badge {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 4px 6px;
        font-size: 8.5px;
        border-radius: 6px;
        flex-shrink: 0;
    }

    .welcome-badge svg {
        width: 9px;
        height: 9px;
        flex-shrink: 0;
    }

    /* ── Silhouette: absolute decorative ── */
    .pregnancy-silhouette-bg {
        position: absolute !important;
        right: -5% !important;
        bottom: -5% !important;
        top: auto !important;
        left: auto !important;
        width: 40% !important;
        max-width: 40% !important;
        height: auto !important;
        max-height: 140px !important;
        object-fit: contain !important;
        object-position: right bottom !important;
        opacity: 0.15 !important;
        pointer-events: none !important;
        z-index: 0 !important;
    }

    /* ── Cards: tight + compact ── */
    .mother-card {
        padding: 10px;
        border-radius: 12px;
        margin-bottom: 0;
        width: 100%;
        box-sizing: border-box;
    }

    .mother-card-header {
        margin-bottom: 6px;
    }

    .mother-card-title {
        font-size: 12px;
    }

    .mother-card-link {
        font-size: 10px;
    }

    /* ── Grid: stack vertically ── */
    .mother-dash-row-2col,
    .mother-dash-bottom-2col,
    .gestation-details-row {
        grid-template-columns: 1fr;
        width: 100%;
        gap: 6px;
    }

    /* ── Next Appointment ── */
    /* Target reference: horizontal, compact card */
    .appointments-card {
        padding: 10px;
    }
    .appointments-timeline {
        gap: 0; /* Only 1 item usually, but if more, no gap needed */
    }
    .timeline-item {
        padding: 6px;
        border-radius: 8px;
        gap: 8px;
        flex-direction: row;
        align-items: center;
        background: #f8f9fb;
    }
    .timeline-date-block {
        min-width: 40px;
        padding: 4px;
        border-radius: 6px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: white;
        border: 1px solid rgba(185, 129, 138, 0.15);
    }
    .timeline-date-block .month { font-size: 9px; }
    .timeline-date-block .day { font-size: 14px; font-weight: 800; margin: 1px 0; }
    .timeline-date-block .weekday { font-size: 8px; }
    
    .timeline-content {
        flex: 1;
        min-width: 0;
    }
    .timeline-header { margin-bottom: 2px; }
    .timeline-type { font-size: 11px; }
    .timeline-status { font-size: 8px; padding: 2px 6px; }
    .timeline-details { gap: 2px; margin-bottom: 2px; flex-direction: row; flex-wrap: wrap; }
    .timeline-detail { font-size: 9px; gap: 3px; }
    .timeline-detail svg { width: 10px; height: 10px; }
    .timeline-staff { font-size: 9px; }

    /* ── EDD Card compact horizontal layout ── */
    .edd-content-box {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        min-height: auto;
        padding: 4px 0;
    }
    .edd-icon-wrapper {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        flex-shrink: 0;
    }
    .edd-icon-wrapper svg { width: 16px; height: 16px; }
    .edd-details-wrapper { display: flex; flex-direction: column; }
    .edd-title-small { font-size: 9px; margin-bottom: 1px; }
    .edd-display { font-size: 14px; font-weight: 800; margin: 0; line-height: 1.1; }
    .edd-subtitle { font-size: 9px; padding: 2px 6px; margin-top: 2px; }

    /* ── Health Records: horizontal stacking ── */
    .health-records-row {
        flex-direction: row;
        flex-wrap: nowrap;
        overflow-x: hidden;
        gap: 6px;
        padding-bottom: 0;
    }
    .health-record-card-horizontal {
        flex-direction: column;
        align-items: center; /* Center the text to save space */
        min-width: 0;
        flex: 1;
        padding: 8px 4px;
        border-radius: 8px;
        gap: 4px;
    }
    .hrc-icon-bg {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        margin-bottom: 2px;
    }
    .hrc-icon-bg svg { width: 12px; height: 12px; }
    .hrc-info { align-items: center; gap: 1px; }
    .hrc-label { font-size: 8px; }
    .hrc-value { font-size: 11px; font-weight: 800; line-height: 1; }
    .hrc-status { font-size: 8px; }
    .hrc-status svg { width: 8px; height: 8px; }

    /* ── Pregnancy Progress Card compact ── */
    .pregnancy-card-main { padding: 10px; }
    .gestation-details-row { gap: 6px; margin-bottom: 6px; }
    .milestone-item { padding: 8px; border-radius: 8px; display: flex; align-items: center; gap: 8px; }
    .gest-icon { width: 24px; height: 24px; border-radius: 6px; font-size: 12px; flex-shrink: 0; }
    .gest-content { flex: 1; min-width: 0; }
    .gest-label { display: none; } /* Hide "This week:" to save space */
    .gest-val { font-size: 11px; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gest-desc { font-size: 9px; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    
    .pregnancy-progress-container { margin-top: 4px; }
    .progress-header { margin-bottom: 4px; }
    .progress-title { font-size: 11px; }
    .progress-stats { font-size: 10px; }
    .custom-progress-bar { height: 12px; min-width: 0; }
    .progress-fill { padding-right: 6px; }
    .progress-percentage { font-size: 9px; }
    .trimester-indicator { margin-top: 4px; }
    .tri-dot { font-size: 8px; }
    .countdown-banner { padding: 6px; font-size: 10px; gap: 4px; border-radius: 0 0 12px 12px; }
    .countdown-banner svg { width: 12px; height: 12px; }

    /* ── Tips Carousel compact ── */
    .tips-carousel { gap: 4px; }
    .tip-card-modern { padding: 6px; border-radius: 8px; gap: 6px; }
    .tip-icon-circle { width: 24px; height: 24px; }
    .tip-icon-circle svg { width: 12px; height: 12px; }
    .tip-title-modern { font-size: 10px; margin-bottom: 1px; }
    .tip-text-modern { font-size: 9px; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .carousel-nav { width: 20px; height: 20px; }
    .carousel-nav svg { width: 12px; height: 12px; }
    .carousel-indicators { margin-top: 6px; gap: 4px; }
    .indicator { width: 4px; height: 4px; }

    /* ── Support Card compact ── */
    .support-card { padding: 10px; }
    .support-header { gap: 8px; margin-bottom: 6px; }
    .support-icon-wrapper { width: 24px; height: 24px; }
    .support-icon-wrapper svg { width: 12px; height: 12px; }
    .support-title { font-size: 12px; margin-bottom: 0; }
    .support-subtitle { font-size: 9px; }
    .support-text { font-size: 9px; margin-bottom: 8px; line-height: 1.2; }
    .support-actions { flex-direction: row; gap: 6px; }
    .support-btn { padding: 6px 4px; font-size: 9px; border-radius: 6px; flex: 1; gap: 4px; }
    .support-btn svg { width: 10px; height: 10px; }
}
`;

fs.writeFileSync(path, before + replacement + '\n' + after);
console.log('Patched');
