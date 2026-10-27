import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ANALYTICS_TEMPLATE_CATEGORIES,
    ANALYTICS_TEMPLATE_FIELDS,
    assertReportPermission,
    buildTemplateTable,
    createDefaultTemplateLayout,
    moveTemplateBlock,
    normalizeTemplateLayout,
    STATION_TEMPLATE_FIELDS,
    TEMPLATE_PERMISSION_KEYS
} from './reportTemplateUtils.js';

test('default analytics layouts include all report fields and the metric/value columns', () => {
    const layout = createDefaultTemplateLayout('analytics.overview', ANALYTICS_TEMPLATE_FIELDS);

    assert.deepEqual(layout.fields, ANALYTICS_TEMPLATE_FIELDS.map(field => field.key));
    assert.deepEqual(layout.columns.map(column => column.key), ['metric', 'value']);
});

test('analytics preview uses selected metric fields and retains zero-valued results', () => {
    const layout = {
        ...createDefaultTemplateLayout('analytics.overview', ANALYTICS_TEMPLATE_FIELDS),
        fields: ['totalPregnant', 'vaccRate']
    };
    const table = buildTemplateTable({
        reportType: 'analytics.overview',
        fields: ANALYTICS_TEMPLATE_FIELDS,
        dataRows: [{ totalPregnant: 0, vaccRate: 82 }],
        layout
    });

    assert.deepEqual(table.rows, [
        ['Total Managed Patients', 0],
        ['Vaccination Completion (%)', 82]
    ]);
});

test('Analytics categories use only metrics supported by the existing dashboards', () => {
    assert.deepEqual(
        ANALYTICS_TEMPLATE_CATEGORIES.vaccination.fields.map(field => field.key),
        ['vaccRate', 'missedVaccinationCount']
    );
    assert.ok(ANALYTICS_TEMPLATE_CATEGORIES.delivery.fields.some(field => field.key === 'csDel'));
});

test('station preview follows selected field and column order', () => {
    const layout = {
        ...createDefaultTemplateLayout('station.summary', STATION_TEMPLATE_FIELDS),
        fields: ['name', 'totalPatients'],
        columns: [
            { key: 'totalPatients', label: 'Patients', align: 'right', width: 20 },
            { key: 'name', label: 'Station area', align: 'left', width: 28 }
        ]
    };
    const table = buildTemplateTable({
        reportType: 'station.summary',
        fields: STATION_TEMPLATE_FIELDS,
        dataRows: [{ name: 'Central', totalPatients: 12, complications: 1 }],
        layout
    });

    assert.deepEqual(table.columns.map(column => column.label), ['Patients', 'Station area']);
    assert.deepEqual(table.rows, [[12, 'Central']]);
});

test('saved layouts reject unknown fields and clamp user-provided layout dimensions', () => {
    const layout = normalizeTemplateLayout({
        fields: ['unknown-field', 'name'],
        columns: [
            { key: 'unknown-field', label: 'Unknown', align: 'left', width: 20 },
            { key: 'name', label: 'Station', align: 'right', width: 500 }
        ],
        orientation: 'sideways',
        margin: 80
    }, 'station.summary', STATION_TEMPLATE_FIELDS);

    assert.deepEqual(layout.fields, ['name']);
    assert.deepEqual(layout.columns.map(column => column.key), ['name']);
    assert.equal(layout.columns[0].width, 100);
    assert.equal(layout.orientation, 'portrait');
    assert.equal(layout.margin, 30);
});

test('document blocks retain order, formatting, and safe logo references', () => {
    const layout = normalizeTemplateLayout({
        ...createDefaultTemplateLayout('station.summary', STATION_TEMPLATE_FIELDS),
        logoPath: '123e4567-e89b-12d3-a456-426614174000/logo-123e4567-e89b-12d3-a456-426614174001.png',
        pageStyle: {
            backgroundColor: '#f0f0f0',
            borderWidth: 30,
            tableHeaderColor: 'red',
            tableFontFamily: 'Unknown'
        },
        blocks: [
            { id: 'my-title', type: 'title', style: { fontFamily: 'Georgia', fontSize: 50, color: '#123456', bold: true } },
            { id: 'my-note', type: 'text', text: '<script>not html</script>', style: { fontFamily: 'Unknown', fontSize: 5, underline: true } }
        ]
    }, 'station.summary', STATION_TEMPLATE_FIELDS);

    assert.deepEqual(layout.blocks.slice(0, 2).map(block => block.id), ['my-title', 'my-note']);
    assert.equal(layout.blocks[0].style.fontFamily, 'Georgia');
    assert.equal(layout.blocks[0].style.fontSize, 36);
    assert.equal(layout.blocks[1].style.fontFamily, 'Arial');
    assert.equal(layout.blocks[1].style.fontSize, 8);
    assert.equal(layout.blocks[1].text, '<script>not html</script>');
    assert.equal(layout.logoPath, '123e4567-e89b-12d3-a456-426614174000/logo-123e4567-e89b-12d3-a456-426614174001.png');
    assert.equal(layout.pageStyle.backgroundColor, '#f0f0f0');
    assert.equal(layout.pageStyle.borderWidth, 8);
    assert.equal(layout.pageStyle.tableHeaderColor, '#9c6672');
});

test('document blocks can be reordered without mutating the original layout', () => {
    const blocks = [
        { id: 'title', type: 'title' },
        { id: 'text', type: 'text' },
        { id: 'table', type: 'table' }
    ];

    const reordered = moveTemplateBlock(blocks, 'table', 'title');

    assert.deepEqual(reordered.map(block => block.id), ['table', 'title', 'text']);
    assert.deepEqual(moveTemplateBlock(blocks, 'title', 'table').map(block => block.id), ['text', 'title', 'table']);
    assert.deepEqual(blocks.map(block => block.id), ['title', 'text', 'table']);
    assert.equal(moveTemplateBlock(blocks, 'missing', 'title'), blocks);
});

test('empty authorized report data produces an empty table without fabricated rows', () => {
    const layout = createDefaultTemplateLayout('station.summary', STATION_TEMPLATE_FIELDS);
    const table = buildTemplateTable({
        reportType: 'station.summary',
        fields: STATION_TEMPLATE_FIELDS,
        dataRows: [],
        layout
    });

    assert.deepEqual(table.rows, []);
    assert.equal(table.columns.length, STATION_TEMPLATE_FIELDS.length);
});

test('permission checks use independent keys and reject denied access', async () => {
    const calls = [];
    const authorizedClient = {
        rpc: async (functionName, args) => {
            calls.push([functionName, args.p_permission_key]);
            return { data: true, error: null };
        }
    };

    await assertReportPermission(authorizedClient, TEMPLATE_PERMISSION_KEYS.create);
    await assertReportPermission(authorizedClient, TEMPLATE_PERMISSION_KEYS.exportStation);

    assert.deepEqual(calls, [
        ['has_permission', 'reports.templates.create'],
        ['has_permission', 'reports.station.export']
    ]);

    await assert.rejects(
        assertReportPermission({
            rpc: async () => ({ data: false, error: null })
        }, TEMPLATE_PERMISSION_KEYS.edit),
        /do not have permission/
    );
});
