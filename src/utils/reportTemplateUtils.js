export const TEMPLATE_PERMISSION_KEYS = {
    create: 'reports.templates.create',
    edit: 'reports.templates.edit',
    exportAnalytics: 'reports.analytics.export',
    exportStation: 'reports.station.export'
};

export const ANALYTICS_TEMPLATE_FIELDS = [
    { key: 'totalPregnant', label: 'Total Managed Patients' },
    { key: 'highRisk', label: 'Patients with Health Conditions' },
    { key: 'moderateRisk', label: 'Moderate Risk Patients' },
    { key: 'lowRisk', label: 'Patients with No Reported Risk' },
    { key: 'teenage', label: 'Teenage Pregnancies' },
    { key: 'advancedAge', label: 'Advanced Maternal Age Cases' },
    { key: 'deliveries', label: 'Deliveries' },
    { key: 'vaccRate', label: 'Vaccination Completion (%)' },
    { key: 'ppRate', label: 'Postpartum Follow-up Compliance (%)' },
    { key: 'missedRate', label: 'Missed Appointment Rate (%)' },
    { key: 'missedVaccinationCount', label: 'Missed Vaccinations' },
    { key: 'normalDel', label: 'Normal Deliveries' },
    { key: 'assistedDel', label: 'Assisted Deliveries' },
    { key: 'csDel', label: 'Cesarean Deliveries' },
    { key: 'compHemorr', label: 'Postpartum Hemorrhage Cases' },
    { key: 'compHyper', label: 'Hypertensive Crisis Cases' },
    { key: 'compInfect', label: 'Infection / Sepsis Cases' },
    { key: 'compOther', label: 'Other Delivery Complications' },
    { key: 'recNormal', label: 'Fully Recovered' },
    { key: 'recObs', label: 'Under Midwife Observation' },
    { key: 'recComp', label: 'Complicated Recovery Cases' }
];

const selectAnalyticsFields = keys => ANALYTICS_TEMPLATE_FIELDS.filter(field => keys.includes(field.key));

export const ANALYTICS_TEMPLATE_CATEGORIES = {
    overview: {
        reportType: 'analytics.overview',
        label: 'Analytics Overview',
        fields: ANALYTICS_TEMPLATE_FIELDS
    },
    maternal: {
        reportType: 'analytics.maternal',
        label: 'Maternal Health',
        fields: selectAnalyticsFields([
            'totalPregnant', 'highRisk', 'moderateRisk', 'lowRisk', 'teenage',
            'advancedAge', 'ppRate', 'missedRate'
        ])
    },
    vaccination: {
        reportType: 'analytics.vaccination',
        label: 'Vaccination Coverage',
        fields: selectAnalyticsFields(['vaccRate', 'missedVaccinationCount'])
    },
    delivery: {
        reportType: 'analytics.delivery',
        label: 'Delivery Outcomes',
        fields: selectAnalyticsFields([
            'deliveries', 'normalDel', 'assistedDel', 'csDel', 'compHemorr',
            'compHyper', 'compInfect', 'compOther', 'recNormal', 'recObs', 'recComp'
        ])
    }
};

export const STATION_TEMPLATE_FIELDS = [
    { key: 'name', label: 'Station' },
    { key: 'totalPatients', label: 'Total Patients' },
    { key: 'withHealthConditions', label: 'With Health Conditions' },
    { key: 'recentDeliveries', label: 'Deliveries (Month)' },
    { key: 'newborns', label: 'Newborns' },
    { key: 'vaccCoverage', label: 'Vaccination Completion (%)' },
    { key: 'completedVaccinations', label: 'Completed Vaccination Doses' },
    { key: 'totalVaccinations', label: 'Total Vaccination Doses' },
    { key: 'suppCoverage', label: 'Supplement Coverage (%)' },
    { key: 'missedAppointments', label: 'Missed Appointments' },
    { key: 'appointmentsDue', label: 'Appointments in Period' },
    { key: 'missedRate', label: 'Missed Rate (%)' },
    { key: 'trimesterFirst', label: '1st Trimester' },
    { key: 'trimesterSecond', label: '2nd Trimester' },
    { key: 'trimesterThird', label: '3rd Trimester' },
    { key: 'complications', label: 'Complications' }
];

const isValidColumn = (column, fieldKeys) => (
    column
    && fieldKeys.has(column.key)
    && typeof column.label === 'string'
    && ['left', 'center', 'right'].includes(column.align)
    && Number.isFinite(Number(column.width))
);

export const createDefaultTemplateLayout = (reportType, fields) => {
    const reportFields = fields || [];
    const isAnalytics = String(reportType || '').startsWith('analytics.');
    const blocks = [
        { id: 'report-title', type: 'title', text: '', style: {} },
        { id: 'report-subtitle', type: 'subtitle', text: '', style: {} },
        { id: 'report-meta', type: 'meta', text: '', style: {} },
        { id: 'data-table', type: 'table', text: '', style: {} }
    ];

    return {
        title: isAnalytics ? 'Analytics Summary' : 'Station Reports',
        subtitle: '',
        blocks,
        pageStyle: {
            backgroundColor: '#ffffff',
            borderColor: '#d8d1d9',
            borderWidth: 0,
            tableHeaderColor: '#9c6672',
            tableHeaderTextColor: '#ffffff',
            tableBorderColor: '#e2e8f0',
            tableFontFamily: 'Arial',
            tableFontSize: 10
        },
        fields: reportFields.map(field => field.key),
        columns: isAnalytics
            ? [
                { key: 'metric', label: 'Metric', align: 'left', width: 120 },
                { key: 'value', label: 'Value', align: 'right', width: 45 }
            ]
            : reportFields.map((field, index) => ({
                key: field.key,
                label: field.label,
                align: 'left',
                width: index === 0 ? 28 : 14
            })),
        orientation: isAnalytics ? 'portrait' : 'landscape',
        margin: 14,
        pageNumbers: true
    };
};

const isHexColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const TEMPLATE_BLOCK_TYPES = new Set(['title', 'subtitle', 'meta', 'text', 'image', 'table']);
const TEMPLATE_FONT_FAMILIES = new Set(['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana']);

const normalizeBlockStyle = style => ({
    fontFamily: TEMPLATE_FONT_FAMILIES.has(style?.fontFamily) ? style.fontFamily : 'Arial',
    fontSize: Number.isFinite(Number(style?.fontSize))
        ? Math.min(36, Math.max(8, Number(style.fontSize)))
        : 12,
    color: isHexColor(style?.color) ? style.color : '#2d2234',
    backgroundColor: isHexColor(style?.backgroundColor) ? style.backgroundColor : '#ffffff',
    borderColor: isHexColor(style?.borderColor) ? style.borderColor : '#d8d1d9',
    borderWidth: Number.isFinite(Number(style?.borderWidth))
        ? Math.min(6, Math.max(0, Number(style.borderWidth)))
        : 0,
    align: ['left', 'center', 'right'].includes(style?.align) ? style.align : 'left',
    bold: style?.bold === true,
    italic: style?.italic === true,
    underline: style?.underline === true
});

export const normalizeTemplateLayout = (layout, reportType, fields) => {
    const defaults = createDefaultTemplateLayout(reportType, fields);
    if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return defaults;

    const fieldKeys = new Set((fields || []).map(field => field.key));
    const isAnalytics = String(reportType || '').startsWith('analytics.');
    const columnKeys = isAnalytics
        ? new Set(['metric', 'value'])
        : fieldKeys;
    const selectedFields = Array.isArray(layout.fields)
        ? [...new Set(layout.fields.filter(key => fieldKeys.has(key)))]
        : defaults.fields;
    const validColumns = Array.isArray(layout.columns)
        ? layout.columns.filter(column => isValidColumn(column, columnKeys))
        : [];
    const validLayoutColumns = isAnalytics
        ? validColumns
        : validColumns.filter(column => selectedFields.includes(column.key));
    const columns = validLayoutColumns.map(column => ({
        ...column,
        label: column.label.slice(0, 80),
        width: Math.min(100, Math.max(10, Number(column.width)))
    }));
    const blocks = Array.isArray(layout.blocks)
        ? layout.blocks
            .filter(block => block && TEMPLATE_BLOCK_TYPES.has(block.type) && typeof block.id === 'string')
            .slice(0, 20)
            .map(block => ({
                id: block.id.slice(0, 80),
                type: block.type,
                text: typeof block.text === 'string' ? block.text.slice(0, 1000) : '',
                style: normalizeBlockStyle(block.style)
            }))
        : defaults.blocks;
    const includedTypes = new Set(blocks.map(block => block.type));
    const requiredBlocks = defaults.blocks.filter(block => !includedTypes.has(block.type));
    const pageStyle = layout.pageStyle && typeof layout.pageStyle === 'object'
        ? layout.pageStyle
        : {};

    return {
        title: typeof layout.title === 'string' ? layout.title.slice(0, 120) : defaults.title,
        subtitle: typeof layout.subtitle === 'string' ? layout.subtitle.slice(0, 240) : '',
        blocks: [...blocks, ...requiredBlocks],
        logoPath: typeof layout.logoPath === 'string' && /^[0-9a-f-]{36}\/logo-[a-z0-9-]+\.(png|jpe?g|webp)$/i.test(layout.logoPath)
            ? layout.logoPath
            : '',
        pageStyle: {
            backgroundColor: isHexColor(pageStyle.backgroundColor) ? pageStyle.backgroundColor : '#ffffff',
            borderColor: isHexColor(pageStyle.borderColor) ? pageStyle.borderColor : '#d8d1d9',
            borderWidth: Number.isFinite(Number(pageStyle.borderWidth))
                ? Math.min(8, Math.max(0, Number(pageStyle.borderWidth)))
                : 0,
            tableHeaderColor: isHexColor(pageStyle.tableHeaderColor) ? pageStyle.tableHeaderColor : '#9c6672',
            tableHeaderTextColor: isHexColor(pageStyle.tableHeaderTextColor) ? pageStyle.tableHeaderTextColor : '#ffffff',
            tableBorderColor: isHexColor(pageStyle.tableBorderColor) ? pageStyle.tableBorderColor : '#e2e8f0',
            tableFontFamily: TEMPLATE_FONT_FAMILIES.has(pageStyle.tableFontFamily) ? pageStyle.tableFontFamily : 'Arial',
            tableFontSize: Number.isFinite(Number(pageStyle.tableFontSize))
                ? Math.min(18, Math.max(8, Number(pageStyle.tableFontSize)))
                : 10
        },
        fields: selectedFields.length > 0 ? selectedFields : defaults.fields,
        columns: columns.length > 0 ? columns : defaults.columns,
        orientation: layout.orientation === 'landscape' ? 'landscape' : 'portrait',
        margin: Number.isFinite(Number(layout.margin))
            ? Math.min(30, Math.max(10, Number(layout.margin)))
            : defaults.margin,
        pageNumbers: layout.pageNumbers !== false
    };
};

export const moveTemplateBlock = (blocks, sourceId, targetId) => {
    const from = blocks.findIndex(block => block.id === sourceId);
    const to = blocks.findIndex(block => block.id === targetId);
    if (from < 0 || to < 0 || from === to) return blocks;
    const reordered = [...blocks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(from < to ? to - 1 : to, 0, moved);
    return reordered;
};

export const buildTemplateTable = ({ reportType, fields, dataRows, layout }) => {
    const fieldMap = new Map((fields || []).map(field => [field.key, field]));
    const selectedFields = layout.fields.filter(key => fieldMap.has(key));

    if (String(reportType || '').startsWith('analytics.')) {
        const row = (dataRows || [])[0] || {};
        const columns = layout.columns.filter(column => ['metric', 'value'].includes(column.key));
        const rows = selectedFields.map(key => {
            const field = fieldMap.get(key);
            return columns.map(column => (
                column.key === 'metric' ? field.label : row[key] ?? 0
            ));
        });
        return { columns, rows };
    }

    const columns = layout.columns.filter(column => selectedFields.includes(column.key));
    const rows = (dataRows || []).map(row => columns.map(column => row[column.key] ?? ''));
    return { columns, rows };
};

export const assertReportPermission = async (supabase, permissionKey) => {
    const { data, error } = await supabase.rpc('has_permission', {
        p_permission_key: permissionKey
    });
    if (error) throw error;
    if (data !== true) {
        throw new Error('You do not have permission to perform this report action.');
    }
};

export const exportTemplateReport = async ({
    reportType,
    format,
    reportTitle,
    reportSubtitle,
    reportPeriod,
    station,
    table,
    layout
}) => {
    const exportPermission = String(reportType || '').startsWith('analytics.')
        ? TEMPLATE_PERMISSION_KEYS.exportAnalytics
        : TEMPLATE_PERMISSION_KEYS.exportStation;
    const { default: supabase } = await import('../config/supabaseclient.js');
    await assertReportPermission(supabase, exportPermission);

    const safeTitle = String(reportTitle || 'Report').replace(/[<>:"/\\|?*]+/g, '-').slice(0, 100);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `DASMOM_${safeTitle.replace(/\s+/g, '_')}_${dateStamp}`;

    if (format === 'excel') {
        const XLSX = await import('xlsx');
        const worksheetRows = [
            [reportTitle],
            ...(reportSubtitle ? [[reportSubtitle]] : []),
            [`Period: ${reportPeriod || 'All Dates'}`],
            [],
            table.columns.map(column => column.label),
            ...table.rows
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
        worksheet['!cols'] = table.columns.map(column => ({
            wch: Math.max(10, Math.min(60, Math.round(Number(column.width) || 18)))
        }));
        worksheet['!autofilter'] = {
            ref: XLSX.utils.encode_range({
                s: { r: reportSubtitle ? 4 : 3, c: 0 },
                e: { r: Math.max(reportSubtitle ? 4 : 3, worksheetRows.length - 1), c: Math.max(0, table.columns.length - 1) }
            })
        };
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
        XLSX.writeFile(workbook, `${filename}.xlsx`);
        return;
    }

    if (format !== 'pdf') throw new Error('Choose a supported report format.');

    const {
        JsPDFConstructor,
        drawStaffPdfHeader,
        getStaffTableStyles,
        runAutoTable,
        finalizeAndSaveStaffPdf
    } = await import('./staffPdfTemplate.js');
    const doc = new JsPDFConstructor({
        orientation: layout.orientation,
        unit: 'mm',
        format: 'a4'
    });
    const margin = Math.min(30, Math.max(10, Number(layout.margin) || 14));
    const pageWidth = doc.internal.pageSize.getWidth();
    const availableWidth = pageWidth - margin * 2;
    const configuredWidth = table.columns.reduce((total, column) => total + Math.max(10, Number(column.width) || 18), 0);
    const widthScale = Math.min(1, availableWidth / configuredWidth);
    const fontMap = {
        Arial: 'helvetica',
        'Times New Roman': 'times',
        'Courier New': 'courier',
        Georgia: 'times',
        Verdana: 'helvetica'
    };
    const toRgb = color => {
        const hex = isHexColor(color) ? color.slice(1) : '2d2234';
        return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
    };
    const paintedPages = new Set([1]);
    const paintPageBackground = targetDoc => {
        if (layout.pageStyle.backgroundColor === '#ffffff') return;
        const pageNumber = targetDoc.internal.getCurrentPageInfo().pageNumber;
        if (paintedPages.has(pageNumber)) return;
        targetDoc.setFillColor(...toRgb(layout.pageStyle.backgroundColor));
        targetDoc.rect(0, 0, targetDoc.internal.pageSize.getWidth(), targetDoc.internal.pageSize.getHeight(), 'F');
        paintedPages.add(pageNumber);
    };
    if (layout.pageStyle.backgroundColor !== '#ffffff') {
        doc.setFillColor(...toRgb(layout.pageStyle.backgroundColor));
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
    }
    let cursorY = drawStaffPdfHeader(doc, {
        title: '',
        period: reportPeriod || 'All Dates',
        station: station || 'All Stations',
        totalRecords: table.rows.length
    });
    const columns = table.columns.map((column, index) => ({
        header: column.label,
        dataKey: String(index)
    }));
    const body = table.rows.map(row => Object.fromEntries(
        row.map((value, index) => [String(index), value])
    ));
    const blockStyles = (layout.blocks || []).map(block => normalizeBlockStyle(block.style));
    const logoUrl = layout.logoUrl || '';
    let logoDataUrl = '';
    if (logoUrl) {
        const response = await fetch(logoUrl);
        if (!response.ok) throw new Error('The saved logo could not be loaded for export.');
        const logoBlob = await response.blob();
        logoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('The saved logo could not be prepared for export.'));
            reader.readAsDataURL(logoBlob);
        });
    }

    for (let index = 0; index < (layout.blocks || []).length; index += 1) {
        const block = layout.blocks[index];
        const style = blockStyles[index];
        if (block.type === 'title' || block.type === 'subtitle' || block.type === 'text' || block.type === 'meta') {
            const text = block.type === 'title'
                ? layout.title
                : block.type === 'subtitle'
                    ? layout.subtitle
                    : block.type === 'meta'
                        ? `${reportPeriod || 'All Dates'} · ${station || 'All Stations'}`
                        : block.text;
            if (!text) continue;
            const family = fontMap[style.fontFamily] || 'helvetica';
            const fontStyle = `${style.bold ? 'bold' : ''}${style.italic ? 'italic' : ''}` || 'normal';
            doc.setFont(family, fontStyle);
            doc.setFontSize(block.type === 'title' && !block.style?.fontSize ? 22 : style.fontSize);
            doc.setTextColor(...toRgb(style.color));
            const lines = doc.splitTextToSize(String(text), availableWidth);
            const lineHeight = (style.fontSize * 0.42) + 2;
            const blockHeight = lines.length * lineHeight + 4;
            if (cursorY + blockHeight > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                cursorY = 18;
                paintPageBackground(doc);
            }
            if (style.backgroundColor !== '#ffffff' || style.borderWidth > 0) {
                const textWidth = Math.min(availableWidth, Math.max(...lines.map(line => doc.getTextWidth(line)), 10) + 8);
                doc.setFillColor(...toRgb(style.backgroundColor));
                doc.setDrawColor(...toRgb(style.borderColor));
                doc.setLineWidth(style.borderWidth * 0.2);
                doc.rect(margin, cursorY - 5, textWidth, blockHeight, style.borderWidth > 0 ? 'FD' : 'F');
            }
            doc.text(lines, style.align === 'left' ? margin + 3 : style.align === 'center' ? pageWidth / 2 : pageWidth - margin, cursorY, {
                align: style.align,
                lineHeightFactor: 1.2
            });
            if (style.underline) {
                lines.forEach((line, lineIndex) => {
                    const width = doc.getTextWidth(line);
                    const startX = style.align === 'left' ? margin + 3 : style.align === 'center' ? (pageWidth - width) / 2 : pageWidth - margin - width;
                    doc.setDrawColor(...toRgb(style.color));
                    doc.setLineWidth(0.25);
                    doc.line(startX, cursorY + lineIndex * lineHeight + 0.8, startX + width, cursorY + lineIndex * lineHeight + 0.8);
                });
            }
            cursorY += blockHeight + 3;
        } else if (block.type === 'image' && logoDataUrl) {
            if (cursorY + 48 > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                cursorY = 18;
                paintPageBackground(doc);
            }
            const imageFormat = logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            const imageInfo = doc.getImageProperties(logoDataUrl);
            const imageRatio = imageInfo.width / imageInfo.height;
            const imageWidth = Math.min(60, availableWidth, 28 * imageRatio);
            const imageHeight = imageWidth / imageRatio;
            const imageX = style.align === 'center' ? (pageWidth - imageWidth) / 2 : style.align === 'right' ? pageWidth - margin - imageWidth : margin;
            doc.addImage(logoDataUrl, imageFormat, imageX, cursorY, imageWidth, imageHeight, undefined, 'FAST');
            cursorY += imageHeight + 4;
        } else if (block.type === 'table') {
            const tableFontSize = block.style?.fontSize || layout.pageStyle.tableFontSize;
            const tableFontFamily = fontMap[block.style?.fontFamily || layout.pageStyle.tableFontFamily] || 'helvetica';
            const tableBorderColor = toRgb(block.style?.borderColor || layout.pageStyle.tableBorderColor);
            runAutoTable(doc, {
                ...getStaffTableStyles({
                    fontSize: tableFontSize,
                    headFontSize: tableFontSize
                }),
                startY: cursorY,
                margin: { top: 14, left: margin, right: margin, bottom: 18 },
                columns,
                body,
                showHead: 'everyPage',
                rowPageBreak: 'avoid',
                headStyles: {
                    ...getStaffTableStyles({
                        fontSize: tableFontSize,
                        headFontSize: tableFontSize
                    }).headStyles,
                    fillColor: toRgb(layout.pageStyle.tableHeaderColor),
                    textColor: toRgb(layout.pageStyle.tableHeaderTextColor),
                    font: tableFontFamily,
                    fontSize: tableFontSize
                },
                styles: {
                    ...getStaffTableStyles({
                        fontSize: tableFontSize,
                        headFontSize: tableFontSize
                    }).styles,
                    font: tableFontFamily,
                    fontSize: tableFontSize,
                    lineColor: tableBorderColor,
                    textColor: toRgb(block.style?.color || '#2d2234')
                },
                willDrawPage: () => paintPageBackground(doc),
                columnStyles: Object.fromEntries(table.columns.map((column, columnIndex) => [
                    String(columnIndex),
                    {
                        halign: column.align,
                        cellWidth: Number(column.width) > 0 ? Number(column.width) * widthScale : 'auto'
                    }
                ]))
            });
            cursorY = (doc.lastAutoTable?.finalY || cursorY) + 5;
        }
    }

    if (layout.pageStyle.borderWidth > 0) {
        const pageCount = doc.internal.getNumberOfPages();
        for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
            doc.setPage(pageIndex);
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setDrawColor(...toRgb(layout.pageStyle.borderColor));
            doc.setLineWidth(layout.pageStyle.borderWidth * 0.25);
            doc.rect(margin / 2, margin / 2, pageWidth - margin, pageHeight - margin);
        }
    }

    if (layout.pageNumbers) finalizeAndSaveStaffPdf(doc, `${filename}.pdf`);
    else doc.save(`${filename}.pdf`);
};
