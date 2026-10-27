import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowDown,
    ArrowUp,
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    Download,
    FileSpreadsheet,
    FileText,
    GripVertical,
    Image as ImageIcon,
    Italic,
    Plus,
    Save,
    Trash2,
    Underline,
    X
} from 'lucide-react';
import supabase from '../config/supabaseclient';
import { AuthContext } from '../context/AuthContext';
import { useRolePermissions } from '../context/RolePermissionContext';
import {
    assertReportPermission,
    buildTemplateTable,
    createDefaultTemplateLayout,
    exportTemplateReport,
    moveTemplateBlock,
    normalizeTemplateLayout,
    TEMPLATE_PERMISSION_KEYS
} from '../utils/reportTemplateUtils';
import '../styles/components/ReportTemplateBuilder.css';

const ReportTemplateBuilder = ({
    isOpen,
    onClose,
    reportType,
    reportTypeLabel,
    fields,
    fieldMode,
    dataRows,
    context,
    exportPermissionKey
}) => {
    const { user } = useContext(AuthContext);
    const { hasPermission, loading: permissionsLoading } = useRolePermissions();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [layout, setLayout] = useState(() => createDefaultTemplateLayout(reportType, fields));
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isShared, setIsShared] = useState(false);
    const [format, setFormat] = useState('pdf');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [selectedBlockId, setSelectedBlockId] = useState('report-title');
    const [logoUrl, setLogoUrl] = useState('');
    const [pendingLogoFile, setPendingLogoFile] = useState(null);
    const [draggingBlockId, setDraggingBlockId] = useState('');

    const canCreate = hasPermission(TEMPLATE_PERMISSION_KEYS.create);
    const canEdit = hasPermission(TEMPLATE_PERMISSION_KEYS.edit);
    const canExport = hasPermission(exportPermissionKey);
    const isAdmin = String(user?.role || '').trim().toLowerCase().replace(/_/g, ' ') === 'admin';
    const selectedTemplate = templates.find(template => template.id === selectedTemplateId);
    const canEditSelected = Boolean(
        canEdit && selectedTemplate
        && (isAdmin || selectedTemplate.created_by === user?.id || selectedTemplate.is_shared)
    );
    const canSaveAsNew = canCreate && !canEditSelected;
    const templateReadOnly = Boolean(selectedTemplate && !canCreate && !canEdit);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        setError('');
        const { data, error: queryError } = await supabase
            .from('report_templates')
            .select('id, name, description, report_type, layout_config, created_by, is_shared, updated_at')
            .eq('report_type', reportType)
            .order('updated_at', { ascending: false });

        if (queryError) {
            setError(`Could not load report templates: ${queryError.message}`);
            setTemplates([]);
        } else {
            setTemplates(data || []);
        }
        setLoading(false);
    }, [reportType]);

    useEffect(() => {
        if (!isOpen) return;
        const defaults = createDefaultTemplateLayout(reportType, fields);
        setSelectedTemplateId('');
        setLayout(defaults);
        setName('');
        setDescription('');
        setIsShared(false);
        setNotice('');
        setError('');
        setLogoUrl('');
        setPendingLogoFile(null);
        setSelectedBlockId('report-title');
        loadTemplates();
    }, [isOpen, reportType, fields, loadTemplates]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const closeOnEscape = event => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [isOpen, onClose]);

    useEffect(() => () => {
        if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
    }, [logoUrl]);

    const table = useMemo(() => buildTemplateTable({
        reportType,
        fields,
        dataRows,
        layout
    }), [reportType, fields, dataRows, layout]);

    const selectTemplate = async templateId => {
        setSelectedTemplateId(templateId);
        setNotice('');
        setError('');
        setPendingLogoFile(null);
        setLogoUrl('');
        if (!templateId) {
            setName('');
            setDescription('');
            setIsShared(false);
            setLayout(createDefaultTemplateLayout(reportType, fields));
            setSelectedBlockId('report-title');
            return;
        }
        const template = templates.find(item => item.id === templateId);
        if (!template) return;
        setName(template.name || '');
        setDescription(template.description || '');
        setIsShared(template.is_shared === true);
        const nextLayout = normalizeTemplateLayout(template.layout_config, reportType, fields);
        setLayout(nextLayout);
        setSelectedBlockId(nextLayout.blocks[0]?.id || '');
        if (nextLayout.logoPath) {
            const { data, error: signedUrlError } = await supabase.storage
                .from('report-template-assets')
                .createSignedUrl(nextLayout.logoPath, 60 * 60);
            if (signedUrlError) {
                setError(`Could not load this template's logo: ${signedUrlError.message}`);
            } else {
                setLogoUrl(data.signedUrl);
            }
        }
    };

    const selectedBlock = layout.blocks.find(block => block.id === selectedBlockId);

    const updateBlock = (blockId, changes) => {
        setLayout(current => ({
            ...current,
            blocks: current.blocks.map(block => (
                block.id === blockId ? { ...block, ...changes } : block
            ))
        }));
    };

    const updateBlockStyle = changes => {
        if (!selectedBlock) return;
        updateBlock(selectedBlock.id, { style: { ...selectedBlock.style, ...changes } });
    };

    const addBlock = type => {
        if (layout.blocks.length >= 20) {
            setError('A template can contain up to 20 document blocks.');
            return;
        }
        const id = crypto.randomUUID();
        const block = { id, type, text: type === 'text' ? 'Add your text here' : '', style: {} };
        setLayout(current => ({ ...current, blocks: [...current.blocks, block] }));
        setSelectedBlockId(id);
        setError('');
    };

    const handleLogoFile = event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) {
            setError('Choose a PNG or JPEG logo no larger than 2 MB.');
            return;
        }
        setError('');
        if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
        setPendingLogoFile(file);
        setLogoUrl(URL.createObjectURL(file));
        setLayout(current => {
            const hasImageBlock = current.blocks.some(block => block.type === 'image');
            return hasImageBlock ? current : {
                ...current,
                blocks: [...current.blocks, { id: crypto.randomUUID(), type: 'image', text: '', style: {} }]
            };
        });
    };

    const moveBlockTo = targetId => {
        setLayout(current => ({
            ...current,
            blocks: moveTemplateBlock(current.blocks, draggingBlockId, targetId)
        }));
        setDraggingBlockId('');
    };

    const moveBlockToEnd = () => {
        setLayout(current => {
            const from = current.blocks.findIndex(block => block.id === draggingBlockId);
            if (from < 0 || from === current.blocks.length - 1) return current;
            const blocks = [...current.blocks];
            const [moved] = blocks.splice(from, 1);
            blocks.push(moved);
            return { ...current, blocks };
        });
        setDraggingBlockId('');
    };

    const moveBlockBy = (blockId, direction) => {
        setLayout(current => {
            const from = current.blocks.findIndex(block => block.id === blockId);
            const to = from + direction;
            if (from < 0 || to < 0 || to >= current.blocks.length) return current;
            const blocks = [...current.blocks];
            [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
            return { ...current, blocks };
        });
    };

    const toggleField = key => {
        setLayout(current => {
            const isSelected = current.fields.includes(key);
            const nextFields = isSelected
                ? current.fields.filter(fieldKey => fieldKey !== key)
                : [...current.fields, key];
            const nextColumns = fieldMode === 'columns'
                ? isSelected
                    ? current.columns.filter(column => column.key !== key)
                    : [
                        ...current.columns,
                        { key, label: fields.find(field => field.key === key)?.label || key, align: 'left', width: 30 }
                    ]
                : current.columns;
            return { ...current, fields: nextFields, columns: nextColumns };
        });
    };

    const updateColumn = (key, changes) => {
        setLayout(current => ({
            ...current,
            columns: current.columns.map(column => (
                column.key === key ? { ...column, ...changes } : column
            ))
        }));
    };

    const moveColumn = (index, direction) => {
        setLayout(current => {
            const columns = [...current.columns];
            const target = index + direction;
            if (target < 0 || target >= columns.length) return current;
            [columns[index], columns[target]] = [columns[target], columns[index]];
            return { ...current, columns };
        });
    };

    const saveTemplate = async () => {
        if (!name.trim()) {
            setError('Enter a template name before saving.');
            return;
        }
        if (!layout.fields.length || !table.columns.length) {
            setError('Select at least one field to include in the report.');
            return;
        }
        if (pendingLogoFile && !canEdit) {
            setError('Logo uploads also require the Edit Report Templates permission.');
            return;
        }
        const updateExisting = canEditSelected;
        const requiredPermission = updateExisting
            ? TEMPLATE_PERMISSION_KEYS.edit
            : TEMPLATE_PERMISSION_KEYS.create;
        const layoutToSave = normalizeTemplateLayout(layout, reportType, fields);
        setSaving(true);
        setError('');
        setNotice('');
        try {
            await assertReportPermission(supabase, requiredPermission);
            const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;
            if (!authenticatedUser?.id) throw new Error('Your sign-in session could not be verified. Sign in again and retry.');
            const values = {
                name: name.trim(),
                description: description.trim(),
                report_type: reportType,
                layout_config: layoutToSave,
                is_shared: isShared
            };
            const result = updateExisting
                ? await supabase.from('report_templates')
                    .update(values)
                    .eq('id', selectedTemplate.id)
                    .select('id, name, description, report_type, layout_config, created_by, is_shared, updated_at')
                : await supabase.from('report_templates')
                    .insert({ ...values, created_by: authenticatedUser.id })
                    .select('id, name, description, report_type, layout_config, created_by, is_shared, updated_at');

            if (result.error) throw result.error;
            if (!result.data?.length) {
                throw new Error('The template was not saved. Check your access and try again.');
            }
            let savedTemplate = result.data[0];
            const previousLogoPath = normalizeTemplateLayout(
                selectedTemplate?.layout_config,
                reportType,
                fields
            ).logoPath;
            let nextLogoPath = layoutToSave.logoPath;

            if (pendingLogoFile) {
                const extension = pendingLogoFile.type === 'image/png' ? 'png' : 'jpg';
                nextLogoPath = `${savedTemplate.id}/logo-${crypto.randomUUID()}.${extension}`;
                const { error: uploadError } = await supabase.storage
                    .from('report-template-assets')
                    .upload(nextLogoPath, pendingLogoFile, {
                        contentType: pendingLogoFile.type,
                        upsert: false
                    });
                if (uploadError) throw uploadError;
            }
            if (nextLogoPath !== (savedTemplate.layout_config?.logoPath || '')) {
                const nextLayout = { ...layoutToSave, logoPath: nextLogoPath || '' };
                const { data: updatedData, error: layoutError } = await supabase
                    .from('report_templates')
                    .update({ layout_config: nextLayout })
                    .eq('id', savedTemplate.id)
                    .select('id, name, description, report_type, layout_config, created_by, is_shared, updated_at');
                if (layoutError) throw layoutError;
                if (!updatedData?.length) throw new Error('The logo was uploaded, but its template could not be updated.');
                savedTemplate = updatedData[0];
                setLayout(nextLayout);
            } else {
                setLayout(layoutToSave);
            }
            if (previousLogoPath && previousLogoPath !== nextLogoPath) {
                const { error: removeError } = await supabase.storage
                    .from('report-template-assets')
                    .remove([previousLogoPath]);
                if (removeError) throw removeError;
            }
            setPendingLogoFile(null);
            if (savedTemplate.layout_config?.logoPath) {
                const { data, error: signedUrlError } = await supabase.storage
                    .from('report-template-assets')
                    .createSignedUrl(savedTemplate.layout_config.logoPath, 60 * 60);
                if (signedUrlError) throw signedUrlError;
                if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
                setLogoUrl(data.signedUrl);
            } else {
                setLogoUrl('');
            }
            setTemplates(current => [
                savedTemplate,
                ...current.filter(item => item.id !== savedTemplate.id)
            ]);
            setSelectedTemplateId(savedTemplate.id);
            setNotice(updateExisting ? 'Template changes saved.' : 'Template created.');
        } catch (saveError) {
            setError(`Could not save this template: ${saveError.message || 'Unknown error.'}`);
        } finally {
            setSaving(false);
        }
    };

    const deleteTemplate = async () => {
        if (!selectedTemplate || !canEditSelected) return;
        if (!window.confirm(`Delete the template "${selectedTemplate.name}"?`)) return;
        setSaving(true);
        setError('');
        setNotice('');
        try {
            await assertReportPermission(supabase, TEMPLATE_PERMISSION_KEYS.edit);
            const logoPath = normalizeTemplateLayout(selectedTemplate.layout_config, reportType, fields).logoPath;
            if (logoPath) {
                const { error: assetError } = await supabase.storage
                    .from('report-template-assets')
                    .remove([logoPath]);
                if (assetError) throw assetError;
            }
            const { data, error: deleteError } = await supabase
                .from('report_templates')
                .delete()
                .eq('id', selectedTemplate.id)
                .select('id');
            if (deleteError) throw deleteError;
            if (!data?.length) throw new Error('The template was not deleted. Check your access and try again.');
            setTemplates(current => current.filter(item => item.id !== selectedTemplate.id));
            setSelectedTemplateId('');
            setName('');
            setDescription('');
            setIsShared(false);
            setLayout(createDefaultTemplateLayout(reportType, fields));
            setLogoUrl('');
            setPendingLogoFile(null);
            setNotice('Template deleted.');
        } catch (deleteError) {
            setError(`Could not delete this template: ${deleteError.message || 'Unknown error.'}`);
        } finally {
            setSaving(false);
        }
    };

    const exportReport = async () => {
        if (!canExport) {
            setError('You do not have permission to export this report.');
            return;
        }
        if (!table.columns.length) {
            setError('Select at least one field before exporting.');
            return;
        }
        setExporting(true);
        setError('');
        setNotice('');
        try {
            let exportLogoUrl = logoUrl;
            if (layout.logoPath && !pendingLogoFile) {
                const { data: signedData, error: signedUrlError } = await supabase.storage
                    .from('report-template-assets')
                    .createSignedUrl(layout.logoPath, 60 * 60);
                if (signedUrlError) throw signedUrlError;
                exportLogoUrl = signedData.signedUrl;
            }
            await exportTemplateReport({
                reportType,
                format,
                reportTitle: layout.title.trim(),
                reportSubtitle: layout.subtitle.trim(),
                reportPeriod: context.period,
                station: context.station,
                table,
                layout: { ...layout, logoUrl: exportLogoUrl }
            });
            setNotice(`${format === 'pdf' ? 'PDF' : 'Excel'} report exported.`);
        } catch (exportError) {
            setError(`Could not export this report: ${exportError.message || 'Unknown error.'}`);
        } finally {
            setExporting(false);
        }
    };

    if (!isOpen) return null;

    const isAnalytics = fieldMode === 'rows';
    return createPortal(
        <div className="report-template-overlay" onMouseDown={event => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section className="report-template-dialog" role="dialog" aria-modal="true" aria-labelledby="report-template-title">
                <header className="report-template-header">
                    <div>
                        <h2 id="report-template-title">Report Template Builder</h2>
                        <p>{reportTypeLabel} · Use the current authorized report data in the preview.</p>
                    </div>
                    <button type="button" className="report-template-icon-button" onClick={onClose} aria-label="Close template builder">
                        <X size={20} />
                    </button>
                </header>

                <div className="report-template-content">
                    <div className="report-template-editor">
                        <label className="report-template-control">
                            <span>Saved templates</span>
                            <select
                                value={selectedTemplateId}
                                onChange={event => selectTemplate(event.target.value)}
                                disabled={loading}
                            >
                                <option value="">Create a new template</option>
                                {templates.map(template => (
                                    <option key={template.id} value={template.id}>
                                        {template.name}{template.is_shared ? ' (shared)' : ''}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="report-template-form-grid">
                            <label className="report-template-control">
                                <span>Template name</span>
                                <input value={name} maxLength={100} readOnly={templateReadOnly} onChange={event => setName(event.target.value)} />
                            </label>
                            <label className="report-template-control">
                                <span>Report title</span>
                                <input value={layout.title} maxLength={120} readOnly={templateReadOnly} onChange={event => setLayout(current => ({ ...current, title: event.target.value }))} />
                            </label>
                        </div>

                        <label className="report-template-control">
                            <span>Description</span>
                            <textarea value={description} maxLength={500} rows={2} readOnly={templateReadOnly} onChange={event => setDescription(event.target.value)} />
                        </label>

                        <label className="report-template-control">
                            <span>Subtitle</span>
                            <input value={layout.subtitle} maxLength={240} readOnly={templateReadOnly} onChange={event => setLayout(current => ({ ...current, subtitle: event.target.value }))} />
                        </label>

                        <div className="report-template-context" aria-live="polite">
                            <strong>Current filters</strong>
                            <span>{context.period || 'Current reporting period'}</span>
                            <span>{context.station || 'All authorized stations'}</span>
                            {context.filters && <span>{context.filters}</span>}
                        </div>

                        <fieldset className="report-template-fields">
                            <legend>{isAnalytics ? 'Metrics to include' : 'Fields to include'}</legend>
                            {fields.map(field => (
                                <label key={field.key} className="report-template-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={layout.fields.includes(field.key)}
                                        disabled={templateReadOnly}
                                        onChange={() => toggleField(field.key)}
                                    />
                                    <span>{field.label}</span>
                                </label>
                            ))}
                        </fieldset>

                        <div className="report-template-columns">
                            <div className="report-template-section-title">
                                <h3>Columns and formatting</h3>
                                <span>Use the arrows to change order.</span>
                            </div>
                            {layout.columns.map((column, index) => (
                                <div className="report-template-column" key={column.key}>
                                    <div className="report-template-column-order">
                                        <button type="button" aria-label={`Move ${column.label} up`} disabled={templateReadOnly || index === 0} onClick={() => moveColumn(index, -1)}>
                                            <ArrowUp size={14} />
                                        </button>
                                        <button type="button" aria-label={`Move ${column.label} down`} disabled={templateReadOnly || index === layout.columns.length - 1} onClick={() => moveColumn(index, 1)}>
                                            <ArrowDown size={14} />
                                        </button>
                                    </div>
                                    <label className="report-template-column-label">
                                        <span>Heading</span>
                                        <input value={column.label} maxLength={80} readOnly={templateReadOnly} onChange={event => updateColumn(column.key, { label: event.target.value })} />
                                    </label>
                                    <label className="report-template-column-align">
                                        <span>Align</span>
                                        <select value={column.align} disabled={templateReadOnly} onChange={event => updateColumn(column.key, { align: event.target.value })}>
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </label>
                                    <label className="report-template-column-width">
                                        <span>Width (mm)</span>
                                        <input type="number" min="10" max="100" value={column.width} readOnly={templateReadOnly} onChange={event => updateColumn(column.key, { width: event.target.value })} />
                                    </label>
                                </div>
                            ))}
                        </div>

                        <section className="report-template-design">
                            <div className="report-template-section-title">
                                <h3>Document layout</h3>
                                <span>Drag blocks in the page preview to reorder them.</span>
                            </div>
                            <div className="report-template-block-actions">
                                <button type="button" disabled={templateReadOnly} onClick={() => addBlock('text')}><Plus size={14} /> Text</button>
                                <button type="button" disabled={templateReadOnly} onClick={() => addBlock('image')}><ImageIcon size={14} /> Logo block</button>
                            </div>
                            {selectedBlock && (
                                <div className="report-template-formatting">
                                    <div className="report-template-selected-block">
                                        <strong>Selected: {selectedBlock.type}</strong>
                                        <button type="button" aria-label="Move block up" disabled={templateReadOnly || layout.blocks[0]?.id === selectedBlock.id} onClick={() => moveBlockBy(selectedBlock.id, -1)}><ArrowUp size={14} /></button>
                                        <button type="button" aria-label="Move block down" disabled={templateReadOnly || layout.blocks[layout.blocks.length - 1]?.id === selectedBlock.id} onClick={() => moveBlockBy(selectedBlock.id, 1)}><ArrowDown size={14} /></button>
                                    </div>
                                    {selectedBlock.type === 'text' && (
                                        <label className="report-template-control">
                                            <span>Text</span>
                                            <textarea
                                                value={selectedBlock.text}
                                                maxLength={1000}
                                                rows={3}
                                                readOnly={templateReadOnly}
                                                onChange={event => updateBlock(selectedBlock.id, { text: event.target.value })}
                                            />
                                        </label>
                                    )}
                                    <div className="report-template-format-tools">
                                        <label className="report-template-control">
                                            <span>Font</span>
                                            <select value={selectedBlock.style.fontFamily || 'Arial'} disabled={templateReadOnly} onChange={event => updateBlockStyle({ fontFamily: event.target.value })}>
                                                {['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'].map(font => <option key={font}>{font}</option>)}
                                            </select>
                                        </label>
                                        <label className="report-template-control">
                                            <span>Size</span>
                                            <input type="number" min="8" max="36" value={selectedBlock.style.fontSize || (selectedBlock.type === 'title' ? 22 : 12)} readOnly={templateReadOnly} onChange={event => updateBlockStyle({ fontSize: Number(event.target.value) })} />
                                        </label>
                                        <label className="report-template-color">
                                            <span>Text</span>
                                            <input type="color" value={selectedBlock.style.color || '#2d2234'} disabled={templateReadOnly} onChange={event => updateBlockStyle({ color: event.target.value })} />
                                        </label>
                                        <label className="report-template-color">
                                            <span>Fill</span>
                                            <input type="color" value={selectedBlock.style.backgroundColor || '#ffffff'} disabled={templateReadOnly} onChange={event => updateBlockStyle({ backgroundColor: event.target.value })} />
                                        </label>
                                    </div>
                                    <div className="report-template-format-buttons" role="group" aria-label="Text formatting">
                                        <button type="button" aria-pressed={selectedBlock.style.bold === true} disabled={templateReadOnly} onClick={() => updateBlockStyle({ bold: !selectedBlock.style.bold })}><Bold size={15} /></button>
                                        <button type="button" aria-pressed={selectedBlock.style.italic === true} disabled={templateReadOnly} onClick={() => updateBlockStyle({ italic: !selectedBlock.style.italic })}><Italic size={15} /></button>
                                        <button type="button" aria-pressed={selectedBlock.style.underline === true} disabled={templateReadOnly} onClick={() => updateBlockStyle({ underline: !selectedBlock.style.underline })}><Underline size={15} /></button>
                                        <button type="button" aria-label="Align left" aria-pressed={(selectedBlock.style.align || 'left') === 'left'} disabled={templateReadOnly} onClick={() => updateBlockStyle({ align: 'left' })}><AlignLeft size={15} /></button>
                                        <button type="button" aria-label="Align center" aria-pressed={selectedBlock.style.align === 'center'} disabled={templateReadOnly} onClick={() => updateBlockStyle({ align: 'center' })}><AlignCenter size={15} /></button>
                                        <button type="button" aria-label="Align right" aria-pressed={selectedBlock.style.align === 'right'} disabled={templateReadOnly} onClick={() => updateBlockStyle({ align: 'right' })}><AlignRight size={15} /></button>
                                    </div>
                                    <div className="report-template-format-tools">
                                        <label className="report-template-control">
                                            <span>Border color</span>
                                            <input type="color" value={selectedBlock.style.borderColor || '#d8d1d9'} disabled={templateReadOnly} onChange={event => updateBlockStyle({ borderColor: event.target.value })} />
                                        </label>
                                        <label className="report-template-control">
                                            <span>Border width</span>
                                            <input type="number" min="0" max="6" value={selectedBlock.style.borderWidth || 0} readOnly={templateReadOnly} onChange={event => updateBlockStyle({ borderWidth: Number(event.target.value) })} />
                                        </label>
                                    </div>
                                    {(selectedBlock.type === 'image' || layout.blocks.some(block => block.type === 'image')) && (
                                        <label className="report-template-control">
                                            <span>Logo (PNG or JPEG, max 2 MB)</span>
                                            <input type="file" accept="image/png,image/jpeg" disabled={templateReadOnly} onChange={handleLogoFile} />
                                        </label>
                                    )}
                                    {logoUrl && (
                                        <div className="report-template-logo-control">
                                            <img src={logoUrl} alt="Uploaded report logo" />
                                            <button type="button" disabled={templateReadOnly} onClick={() => {
                                                if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
                                                setLogoUrl('');
                                                setPendingLogoFile(null);
                                                setLayout(current => ({ ...current, logoPath: '' }));
                                            }}>Remove logo</button>
                                        </div>
                                    )}
                                    {!['title', 'subtitle', 'meta', 'table'].includes(selectedBlock.type) && (
                                        <button
                                            type="button"
                                            className="report-template-delete-block"
                                            disabled={templateReadOnly}
                                            onClick={() => {
                                                setLayout(current => ({
                                                    ...current,
                                                    blocks: current.blocks.filter(block => block.id !== selectedBlock.id)
                                                }));
                                                setSelectedBlockId(layout.blocks.find(block => block.id !== selectedBlock.id)?.id || '');
                                            }}
                                        ><Trash2 size={14} /> Remove block</button>
                                    )}
                                </div>
                            )}
                            <div className="report-template-page-options">
                                <label className="report-template-color">
                                    <span>Page background</span>
                                    <input type="color" value={layout.pageStyle.backgroundColor} disabled={templateReadOnly} onChange={event => setLayout(current => ({ ...current, pageStyle: { ...current.pageStyle, backgroundColor: event.target.value } }))} />
                                </label>
                                <label className="report-template-color">
                                    <span>Page border</span>
                                    <input type="color" value={layout.pageStyle.borderColor} disabled={templateReadOnly} onChange={event => setLayout(current => ({ ...current, pageStyle: { ...current.pageStyle, borderColor: event.target.value } }))} />
                                </label>
                                <label className="report-template-control">
                                    <span>Border width</span>
                                    <input type="number" min="0" max="8" value={layout.pageStyle.borderWidth} readOnly={templateReadOnly} onChange={event => setLayout(current => ({ ...current, pageStyle: { ...current.pageStyle, borderWidth: Number(event.target.value) } }))} />
                                </label>
                                <label className="report-template-color">
                                    <span>Table header</span>
                                    <input type="color" value={layout.pageStyle.tableHeaderColor} disabled={templateReadOnly} onChange={event => setLayout(current => ({ ...current, pageStyle: { ...current.pageStyle, tableHeaderColor: event.target.value } }))} />
                                </label>
                                <label className="report-template-color">
                                    <span>Header text</span>
                                    <input type="color" value={layout.pageStyle.tableHeaderTextColor} disabled={templateReadOnly} onChange={event => setLayout(current => ({ ...current, pageStyle: { ...current.pageStyle, tableHeaderTextColor: event.target.value } }))} />
                                </label>
                                <label className="report-template-color">
                                    <span>Table borders</span>
                                    <input type="color" value={layout.pageStyle.tableBorderColor} disabled={templateReadOnly} onChange={event => setLayout(current => ({ ...current, pageStyle: { ...current.pageStyle, tableBorderColor: event.target.value } }))} />
                                </label>
                            </div>
                        </section>

                        <div className="report-template-options">
                            <label className="report-template-control">
                                <span>Page orientation</span>
                                <select value={layout.orientation} disabled={templateReadOnly} onChange={event => setLayout(current => ({ ...current, orientation: event.target.value }))}>
                                    <option value="portrait">Portrait</option>
                                    <option value="landscape">Landscape</option>
                                </select>
                            </label>
                            <label className="report-template-control">
                                <span>Margins (mm)</span>
                                <input type="number" min="10" max="30" value={layout.margin} readOnly={templateReadOnly} onChange={event => setLayout(current => ({ ...current, margin: event.target.value }))} />
                            </label>
                            <label className="report-template-checkbox report-template-shared">
                                <input type="checkbox" checked={isShared} disabled={templateReadOnly} onChange={event => setIsShared(event.target.checked)} />
                                <span>Share this template with users authorized for this report type</span>
                            </label>
                            <label className="report-template-checkbox report-template-shared">
                                <input type="checkbox" checked={layout.pageNumbers} disabled={templateReadOnly} onChange={event => setLayout(current => ({ ...current, pageNumbers: event.target.checked }))} />
                                <span>Include page numbers</span>
                            </label>
                        </div>
                    </div>

                    <div className="report-template-preview">
                        <div className="report-template-preview-heading">
                            <div>
                                <h3>Live preview</h3>
                                <p>{context.period || 'Current reporting period'} · {table.rows.length} row{table.rows.length === 1 ? '' : 's'}</p>
                            </div>
                            <label className="report-template-format">
                                <span>Export as</span>
                                <select value={format} onChange={event => setFormat(event.target.value)}>
                                    <option value="pdf">PDF</option>
                                    <option value="excel">Excel</option>
                                </select>
                            </label>
                        </div>
                        <div className="report-template-preview-paper" style={{
                            backgroundColor: layout.pageStyle.backgroundColor,
                            borderColor: layout.pageStyle.borderColor,
                            borderWidth: `${Math.max(1, Number(layout.pageStyle.borderWidth) || 0)}px`,
                            borderStyle: 'solid'
                        }}>
                            {layout.blocks.map(block => {
                                const style = block.style || {};
                                const blockStyle = {
                                    fontFamily: style.fontFamily || 'Arial',
                                    fontSize: `${style.fontSize || (block.type === 'title' ? 22 : block.type === 'subtitle' ? 14 : 12)}px`,
                                    color: style.color || '#2d2234',
                                    backgroundColor: style.backgroundColor || 'transparent',
                                    border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || '#d8d1d9'}` : 'none',
                                    fontWeight: style.bold || block.type === 'title' ? 700 : 400,
                                    fontStyle: style.italic ? 'italic' : 'normal',
                                    textDecoration: style.underline ? 'underline' : 'none',
                                    textAlign: style.align || (block.type === 'title' ? 'center' : 'left')
                                };
                                const blockProps = {
                                    key: block.id,
                                    className: `report-template-canvas-block${selectedBlockId === block.id ? ' is-selected' : ''}`,
                                    draggable: !templateReadOnly,
                                    onClick: () => setSelectedBlockId(block.id),
                                    onDragStart: () => setDraggingBlockId(block.id),
                                    onDragOver: event => event.preventDefault(),
                                    onDrop: event => {
                                        event.preventDefault();
                                        moveBlockTo(block.id);
                                    }
                                };
                                if (block.type === 'title') return <h4 {...blockProps} style={blockStyle}>{layout.title || 'Report title'}</h4>;
                                if (block.type === 'subtitle') return <p {...blockProps} style={blockStyle}>{layout.subtitle || 'Subtitle'}</p>;
                                if (block.type === 'meta') return <div {...blockProps} style={blockStyle}>{context.period || 'All dates'} · {context.station || 'All authorized stations'}</div>;
                                if (block.type === 'text') return <p {...blockProps} style={blockStyle}>{block.text || 'Add your text here'}</p>;
                                if (block.type === 'image') return (
                                    <div {...blockProps} style={{
                                        ...blockStyle,
                                        display: 'flex',
                                        justifyContent: style.align === 'center' ? 'center' : style.align === 'right' ? 'flex-end' : 'flex-start'
                                    }}>
                                        {logoUrl ? <img className="report-template-canvas-logo" src={logoUrl} alt="Report logo" /> : <span className="report-template-logo-placeholder"><ImageIcon size={18} /> Drop in your logo using the upload control</span>}
                                    </div>
                                );
                                if (block.type === 'table') return (
                                    <div {...blockProps} className={`${blockProps.className} report-template-table-wrap`} style={{
                                ...blockStyle,
                                '--report-table-border': style.borderColor || layout.pageStyle.tableBorderColor
                                    }}>
                                <table style={{
                                    fontFamily: style.fontFamily || layout.pageStyle.tableFontFamily,
                                    fontSize: `${style.fontSize || layout.pageStyle.tableFontSize}px`,
                                    color: style.color || '#2d2234'
                                }}>
                                            <thead style={{ backgroundColor: layout.pageStyle.tableHeaderColor, color: layout.pageStyle.tableHeaderTextColor }}>
                                                <tr>{table.columns.map(column => <th key={column.key} style={{ textAlign: column.align }}>{column.label}</th>)}</tr>
                                            </thead>
                                            <tbody>
                                                {table.rows.length ? table.rows.map((row, rowIndex) => (
                                                    <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${rowIndex}-${columnIndex}`} style={{ textAlign: table.columns[columnIndex]?.align || 'left' }}>{value === null || value === undefined ? '' : String(value)}</td>)}</tr>
                                                )) : <tr><td colSpan={Math.max(1, table.columns.length)}>No records are available for the current filters.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                                return null;
                            })}
                            <div
                                className="report-template-drop-end"
                                onDragOver={event => event.preventDefault()}
                                onDrop={event => {
                                    event.preventDefault();
                                    moveBlockToEnd();
                                }}
                            >Drop here to move a block to the end</div>
                            {!layout.blocks.some(block => block.type === 'table') && <p className="report-template-empty-note">Add a table block to show the report data.</p>}
                        </div>
                    </div>
                </div>

                <footer className="report-template-footer">
                    <div className="report-template-feedback" aria-live="polite">
                        {loading && <span>Loading saved templates…</span>}
                        {!permissionsLoading && !canCreate && !canEdit && <span>Template changes are disabled for your role.</span>}
                        {!canExport && <span>Export permission is not enabled for this report.</span>}
                        {error && <span className="is-error" role="alert">{error}</span>}
                        {notice && <span className="is-success" role="status">{notice}</span>}
                    </div>
                    <div className="report-template-actions">
                        {selectedTemplate && canEditSelected && (
                            <button type="button" className="report-template-delete" onClick={deleteTemplate} disabled={saving || exporting}>
                                <Trash2 size={15} /> Delete
                            </button>
                        )}
                        <button type="button" className="report-template-secondary" onClick={onClose}>Cancel</button>
                        {(canSaveAsNew || canEditSelected) && (
                            <button type="button" className="report-template-primary" onClick={saveTemplate} disabled={saving || exporting || permissionsLoading}>
                                {selectedTemplate && canEditSelected ? <Save size={15} /> : <Plus size={15} />}
                                {saving ? 'Saving…' : selectedTemplate && canEditSelected ? 'Save changes' : 'Save template'}
                            </button>
                        )}
                        <button type="button" className="report-template-primary" onClick={exportReport} disabled={exporting || saving || !canExport || permissionsLoading}>
                            {format === 'pdf' ? <FileText size={15} /> : <FileSpreadsheet size={15} />}
                            {exporting ? 'Exporting…' : 'Export report'}
                            <Download size={14} />
                        </button>
                    </div>
                </footer>
            </section>
        </div>,
        document.body
    );
};

export default ReportTemplateBuilder;
