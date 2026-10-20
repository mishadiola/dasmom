import jsPDFPackage, { jsPDF as NamedJsPDF } from 'jspdf';
import autoTableFn, { autoTable as namedAutoTable } from 'jspdf-autotable';
import { DASMOM_LOGO_BASE64 } from '../assets/images/dasmomLogoBase64.js';

export const JsPDFConstructor = typeof NamedJsPDF === 'function' ? NamedJsPDF : (typeof jsPDFPackage === 'function' ? jsPDFPackage : jsPDFPackage?.jsPDF);
export const runAutoTable = typeof autoTableFn === 'function' ? autoTableFn : namedAutoTable;

/**
 * Format date in Philippine Standard Time (Asia/Manila)
 */
export const formatPSTDateTime = (dateInput = new Date()) => {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(d.getTime())) return String(dateInput);

        const dateStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }).format(d);

        const timeStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(d);

        return `${dateStr} at ${timeStr}`;
    } catch {
        return new Date().toLocaleString();
    }
};

/**
 * Draw the official standardized DASMOM+ header on a PDF document
 */
export const drawStaffPdfHeader = (doc, options = {}) => {
    const {
        title = 'Report',
        period = '',
        station = '',
        scope = '',
        totalRecords = null
    } = options;

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // 1. Official DASMOM+ Logo (15x15 mm, 1:1 ratio preserved)
    try {
        if (DASMOM_LOGO_BASE64) {
            doc.addImage(DASMOM_LOGO_BASE64, 'PNG', margin, 10, 15, 15);
        }
    } catch (err) {
        console.warn('Could not add logo to PDF:', err);
    }

    // 2. Organization Branding beside logo
    const orgTextX = margin + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(45, 34, 52); // Deep Plum
    doc.text('DASMOM+', orgTextX, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // Slate secondary
    doc.text('Maternal Health Monitoring System', orgTextX, 19.5);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Muted slate
    doc.text('City Health Office III · Dasmariñas City, Cavite', orgTextX, 23.5);

    // 3. Top Subtle Divider Line
    const divider1Y = 27.5;
    doc.setDrawColor(226, 232, 240); // Soft border color
    doc.setLineWidth(0.3);
    doc.line(margin, divider1Y, pageWidth - margin, divider1Y);

    // 4. Centered Report Title & Period
    const cleanTitle = String(title || '').trim().toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(45, 34, 52);
    doc.text(cleanTitle, pageWidth / 2, 33.5, { align: 'center' });

    let currentY = 34;
    const cleanPeriod = String(period || '').trim();
    if (cleanPeriod) {
        const periodText = cleanPeriod.toLowerCase().startsWith('reporting period') || cleanPeriod.toLowerCase().startsWith('period')
            ? cleanPeriod
            : `Reporting Period: ${cleanPeriod}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(periodText, pageWidth / 2, 38.5, { align: 'center' });
        currentY = 39;
    }

    // 5. Middle Subtle Divider Line
    const divider2Y = currentY + 3.5;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, divider2Y, pageWidth - margin, divider2Y);

    // 6. Metadata Row
    const metaY = divider2Y + 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    // Left: Station and/or Scope
    const metaParts = [];
    if (station && station !== 'All') {
        metaParts.push(`Station: ${station}`);
    } else {
        metaParts.push('Station: All Stations');
    }
    if (scope && scope !== 'All' && scope !== 'all') {
        metaParts.push(`Scope: ${scope}`);
    }
    const leftMetaText = metaParts.join(' · ');
    doc.text(leftMetaText, margin, metaY);

    // Right: Generation Date (PST) & Total Records
    const rightMetaParts = [];
    rightMetaParts.push(`Generated: ${formatPSTDateTime()}`);
    if (totalRecords !== null && totalRecords !== undefined) {
        rightMetaParts.push(`Records: ${totalRecords}`);
    }
    const rightMetaText = rightMetaParts.join(' · ');
    doc.text(rightMetaText, pageWidth - margin, metaY, { align: 'right' });

    return metaY + 4; // Return startY for the table
};

/**
 * Standard autoTable theme and styling settings
 */
export const getStaffTableStyles = (options = {}) => {
    const { fontSize = 7.5, headFontSize = 8 } = options;

    return {
        theme: 'grid',
        headStyles: {
            fillColor: [185, 129, 138], // Dusty Rose (#B9818A)
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: headFontSize,
            cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
            valign: 'middle',
            halign: 'left',
            lineColor: [200, 150, 160],
            lineWidth: 0.15
        },
        alternateRowStyles: {
            fillColor: [253, 248, 249] // Subtle rose-tinted warm off-white
        },
        styles: {
            fontSize: fontSize,
            cellPadding: { top: 2.2, right: 2.2, bottom: 2.2, left: 2.2 },
            textColor: [45, 34, 52], // Deep Plum (#2D2234)
            lineColor: [226, 232, 240], // Subtle grey grid lines
            lineWidth: 0.15,
            valign: 'middle',
            overflow: 'linebreak'
        },
        showHead: 'everyPage',
        rowPageBreak: 'avoid',
        margin: { top: 14, left: 14, right: 14, bottom: 18 }
    };
};

/**
 * Add page numbering and confidentiality notice to all pages, then save
 */
export const finalizeAndSaveStaffPdf = (doc, filename = 'report.pdf') => {
    const totalPages = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Footer divider line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        // Footer left text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('DASMOM+ · City Health Office III · Confidential Health Record', margin, pageHeight - 7);

        // Footer right text (Page X of Y)
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    doc.save(filename);
};

/**
 * Export a complete standardized Staff-side PDF report
 */
export const exportStandardStaffPdf = (config = {}) => {
    const {
        orientation = 'landscape',
        title = 'Report',
        period = '',
        station = '',
        scope = '',
        totalRecords = null,
        head = [],
        columns = null,
        body = [],
        rows = null,
        columnStyles = {},
        filename = 'report.pdf',
        fontSize = null
    } = config;

    const finalHead = (head && head.length > 0) ? head : (columns ? [columns] : []);
    const finalBody = (body && body.length > 0) ? body : (rows || []);

    const doc = new JsPDFConstructor({
        orientation,
        unit: 'mm',
        format: 'a4'
    });

    const count = totalRecords !== null ? totalRecords : (finalBody ? finalBody.length : 0);
    const startY = drawStaffPdfHeader(doc, {
        title,
        period,
        station,
        scope,
        totalRecords: count
    });

    if (!finalBody || finalBody.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('No records found for the selected reporting period and filters.', 14, startY + 8);
    } else {
        const tableOpts = getStaffTableStyles({
            fontSize: fontSize || (finalHead[0] && finalHead[0].length >= 10 ? 7 : (finalHead[0] && finalHead[0].length >= 8 ? 7.5 : 8))
        });

        runAutoTable(doc, {
            ...tableOpts,
            startY,
            head: finalHead,
            body: finalBody,
            columnStyles
        });
    }

    finalizeAndSaveStaffPdf(doc, filename);
};
