import React, { useEffect, useMemo, useState } from 'react';
import {
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Search,
    X,
    Check,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    Users,
    Calendar,
    HeartPulse,
    Syringe,
    Package,
    BarChart3,
    Shield,
    FolderKey,
    KeyRound,
    Filter,
    Loader2,
    Plus
} from 'lucide-react';
import supabase from '../config/supabaseclient';
import '../styles/components/RolePermissionManagement.css';

/* ════════════════════════════════════════════════════════════════
   ROLE LABELS & CANONICAL CATEGORIES
   ════════════════════════════════════════════════════════════════ */
const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/_/g, ' ');

const roleLabel = (role) => {
    const normalized = normalizeRole(role);
    if (normalized === 'staff') return 'Staff';
    if (normalized === 'cho personnel') return 'CHO Personnel';
    if (normalized === 'patient' || normalized === 'mother') return 'Patient / Mother';
    if (normalized === 'admin') return 'Administrator';
    return normalized.replace(/\b\w/g, character => character.toUpperCase());
};

const CANONICAL_CATEGORIES = [
    'Patient Management',
    'Visits & Scheduling',
    'Maternal & Newborn Care',
    'Vaccinations & Supplements',
    'Inventory Management',
    'Reports & Analytics',
    'User & System Administration'
];

const mapCategory = (rawCategory) => {
    const raw = String(rawCategory || '').trim();
    if (raw === 'Patient Management') return 'Patient Management';
    if (raw === 'Patient Visits and Scheduling' || raw === 'Visits & Scheduling') return 'Visits & Scheduling';
    if (
        raw === 'Prenatal Visits' ||
        raw === 'Postpartum Visits' ||
        raw === 'Newborn and Delivery Records' ||
        raw === 'Maternal & Newborn Care'
    ) {
        return 'Maternal & Newborn Care';
    }
    if (raw === 'Vaccination' || raw === 'Vaccinations & Supplements') return 'Vaccinations & Supplements';
    if (raw === 'Inventory Management') return 'Inventory Management';
    if (raw === 'Staff and CHO Personnel Management' || raw === 'User & System Administration') {
        return 'User & System Administration';
    }
    if (raw === 'Reports & Analytics') return 'Reports & Analytics';
    return raw;
};

const getCategoryIcon = (categoryName) => {
    switch (categoryName) {
        case 'Patient Management':
            return Users;
        case 'Visits & Scheduling':
            return Calendar;
        case 'Maternal & Newborn Care':
            return HeartPulse;
        case 'Vaccinations & Supplements':
            return Syringe;
        case 'Inventory Management':
            return Package;
        case 'Reports & Analytics':
            return BarChart3;
        case 'User & System Administration':
            return ShieldCheck;
        default:
            return FolderKey;
    }
};

/* ════════════════════════════════════════════════════════════════
   ROLE PERMISSION MANAGEMENT COMPONENT
   ════════════════════════════════════════════════════════════════ */
const RolePermissionManagement = () => {
    const [roles, setRoles] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [rows, setRows] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [draft, setDraft] = useState({ roleId: '', values: {} });
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All categories');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [expandedCategories, setExpandedCategories] = useState({});
    const [visibleKeys, setVisibleKeys] = useState({});
    const [showAddUserType, setShowAddUserType] = useState(false);
    const [newUserType, setNewUserType] = useState('');
    const [addingUserType, setAddingUserType] = useState(false);

    // ── Load live permissions and catalog ──
    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError('');
            const [roleResult, catalogResult, permissionResult] = await Promise.all([
                supabase.from('user_type').select('id, user_type').order('user_type'),
                supabase.from('role_permission_catalog')
                    .select('permission_key, category, label, description, display_order')
                    .order('display_order'),
                supabase.from('role_permissions')
                    .select('role_id, permission_key, is_allowed'),
            ]);

            const failed = roleResult.error || catalogResult.error || permissionResult.error;
            if (failed) {
                if (!cancelled) {
                    setError(failed.message || 'Unable to load role permissions.');
                    setLoading(false);
                }
                return;
            }

            if (cancelled) return;

            const supportedRoles = roleResult.data || [];
            const permissionRows = permissionResult.data || [];
            setRoles(supportedRoles);
            setCatalog(catalogResult.data || []);
            setRows(permissionRows);

            const initialRole = supportedRoles.find(({ user_type }) => normalizeRole(user_type) === 'staff')
                || supportedRoles[0];
            setSelectedRoleId(current => current || initialRole?.id || '');
            setLoading(false);
        };

        load().catch(loadError => {
            if (!cancelled) {
                setError(loadError?.message || 'Unable to load role permissions.');
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    // ── Saved values for the currently selected role ──
    const savedRoleValues = useMemo(() => {
        if (!selectedRoleId || catalog.length === 0) return {};
        return Object.fromEntries(catalog.map(permission => {
            const row = rows.find(item =>
                item.role_id === selectedRoleId && item.permission_key === permission.permission_key
            );
            return [permission.permission_key, row?.is_allowed === true];
        }));
    }, [selectedRoleId, catalog, rows]);

    const values = draft.roleId === selectedRoleId ? draft.values : savedRoleValues;

    // ── Distinct logical categories for dropdown ──
    const availableCategories = useMemo(() => {
        const catSet = new Set(catalog.map(p => mapCategory(p.category)));
        const ordered = CANONICAL_CATEGORIES.filter(c => catSet.has(c));
        catSet.forEach(c => {
            if (!ordered.includes(c)) ordered.push(c);
        });
        return ['All categories', ...ordered];
    }, [catalog]);

    // ── Filter catalog by category & search ──
    const filteredCatalog = useMemo(() => {
        const query = search.trim().toLowerCase();
        return catalog.filter(permission => {
            const mappedCat = mapCategory(permission.category);
            const matchesCategory = category === 'All categories' || mappedCat === category;
            const matchesSearch = !query
                || (permission.label && permission.label.toLowerCase().includes(query))
                || (permission.description && permission.description.toLowerCase().includes(query))
                || (permission.permission_key && permission.permission_key.toLowerCase().includes(query));
            return matchesCategory && matchesSearch;
        });
    }, [catalog, category, search]);

    // ── Group filtered permissions by mapped category ──
    const groupedPermissions = useMemo(() => {
        const groups = {};
        filteredCatalog.forEach(permission => {
            const mappedCat = mapCategory(permission.category);
            if (!groups[mappedCat]) groups[mappedCat] = [];
            groups[mappedCat].push(permission);
        });
        return groups;
    }, [filteredCatalog]);

    // ── Sort categories into canonical order ──
    const orderedGroupEntries = useMemo(() => {
        const entries = Object.entries(groupedPermissions);
        return entries.sort(([catA], [catB]) => {
            const indexA = CANONICAL_CATEGORIES.indexOf(catA);
            const indexB = CANONICAL_CATEGORIES.indexOf(catB);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return catA.localeCompare(catB);
        });
    }, [groupedPermissions]);

    // ── Detect unsaved changes ──
    const dirtyKeys = useMemo(
        () => catalog
            .filter(permission => values[permission.permission_key] !== savedRoleValues[permission.permission_key])
            .map(permission => permission.permission_key),
        [catalog, values, savedRoleValues]
    );

    const setPermission = (permissionKey, isAllowed) => {
        setDraft(current => ({
            roleId: selectedRoleId,
            values: {
                ...(current.roleId === selectedRoleId ? current.values : savedRoleValues),
                [permissionKey]: isAllowed,
            },
        }));
        setNotice('');
        setError('');
    };

    // ── Save changes to Supabase ──
    const saveChanges = async () => {
        if (!selectedRoleId || dirtyKeys.length === 0 || saving) return;
        setSaving(true);
        setError('');
        setNotice('');

        const updates = dirtyKeys.map(permission_key => ({
            role_id: selectedRoleId,
            permission_key,
            is_allowed: values[permission_key] === true,
        }));

        try {
            const { data, error: saveError } = await supabase
                .from('role_permissions')
                .upsert(updates, { onConflict: 'role_id,permission_key' })
                .select('role_id, permission_key, is_allowed');

            if (saveError) {
                setError(saveError.message || 'Unable to save permission changes.');
                setSaving(false);
                return;
            }

            const savedRows = data || updates;
            setRows(current => {
                const next = current.filter(row => row.role_id !== selectedRoleId || !dirtyKeys.includes(row.permission_key));
                return [...next, ...savedRows];
            });
            setDraft({ roleId: selectedRoleId, values });
            setNotice(`Role permissions saved successfully. (${dirtyKeys.length} change${dirtyKeys.length !== 1 ? 's' : ''} applied)`);
        } catch (err) {
            console.error('Error saving role permissions:', err);
            setError(err?.message || 'A network error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    const addUserType = async (event) => {
        event.preventDefault();
        const name = newUserType.trim();
        if (!name || addingUserType) return;

        setAddingUserType(true);
        setError('');
        setNotice('');
        try {
            const { data: roleId, error: createError } = await supabase.rpc('create_user_type', {
                p_user_type: name,
            });
            if (createError) throw createError;
            if (!roleId) throw new Error('The user type was created without a role ID.');

            const [roleResult, permissionResult] = await Promise.all([
                supabase.from('user_type').select('id, user_type').order('user_type'),
                supabase.from('role_permissions').select('role_id, permission_key, is_allowed'),
            ]);
            if (roleResult.error) throw roleResult.error;
            if (permissionResult.error) throw permissionResult.error;

            setRoles(roleResult.data || []);
            setRows(permissionResult.data || []);
            setSelectedRoleId(roleId);
            setDraft({
                roleId,
                values: Object.fromEntries(catalog.map(permission => [permission.permission_key, false])),
            });
            setNewUserType('');
            setShowAddUserType(false);
            setNotice(`User type "${name}" created. Permissions are blocked until you configure them.`);
        } catch (addError) {
            console.error('Error creating user type:', addError);
            setError(addError?.message || 'Unable to create this user type.');
        } finally {
            setAddingUserType(false);
        }
    };

    // ── Accordion toggle handlers ──
    const isSearching = Boolean(search.trim());

    const isCategoryExpanded = (catName) => {
        if (isSearching) return true; // auto-expand matching categories during search
        return Boolean(expandedCategories[catName]);
    };

    const toggleCategory = (catName) => {
        setExpandedCategories(prev => ({
            ...prev,
            [catName]: !prev[catName]
        }));
    };

    const handleExpandAll = () => {
        const all = {};
        orderedGroupEntries.forEach(([catName]) => { all[catName] = true; });
        setExpandedCategories(all);
    };

    const handleCollapseAll = () => {
        setExpandedCategories({});
    };

    const toggleKeyVisibility = (permKey) => {
        setVisibleKeys(prev => ({
            ...prev,
            [permKey]: !prev[permKey]
        }));
    };

    const selectedRole = roles.find(role => role.id === selectedRoleId);
    const adminAlwaysAllowed = normalizeRole(selectedRole?.user_type) === 'admin';

    // ── Render States ──
    if (loading) {
        return (
            <div className="role-permissions-state" role="status">
                <Loader2 size={18} className="spin" />
                <span>Loading role permissions...</span>
            </div>
        );
    }

    if (error && catalog.length === 0) {
        return (
            <div className="role-permissions-state role-permissions-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <section className="role-permissions" aria-labelledby="role-permissions-title">
            {/* ── Page Header & Save Action ── */}
            <div className="role-permissions-heading">
                <div className="role-permissions-title">
                    <div className="role-title-icon-badge">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h2 id="role-permissions-title">Role and Permission Management</h2>
                        <p>Changes are enforced by Supabase database policies and logged in the permission audit trail.</p>
                    </div>
                </div>

                <div className="role-header-actions">
                    <button
                        className="btn"
                        type="button"
                        onClick={() => {
                            setShowAddUserType(current => !current);
                            setError('');
                            setNotice('');
                        }}
                    >
                        <Plus size={15} />
                        <span>Add User Type</span>
                    </button>
                    <button
                        className={`btn role-permissions-save ${dirtyKeys.length > 0 ? 'is-dirty' : ''}`}
                        type="button"
                        onClick={saveChanges}
                        disabled={saving || dirtyKeys.length === 0}
                        title={dirtyKeys.length === 0 ? 'No unsaved changes' : `Save ${dirtyKeys.length} change(s)`}
                    >
                        {saving ? (
                            <>
                                <Loader2 size={15} className="spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={15} />
                                <span>Save Changes{dirtyKeys.length ? ` (${dirtyKeys.length})` : ''}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {showAddUserType && (
                <form className="role-add-user-type" onSubmit={addUserType}>
                    <label htmlFor="new-user-type">New user type</label>
                    <input
                        id="new-user-type"
                        type="text"
                        value={newUserType}
                        onChange={event => setNewUserType(event.target.value)}
                        maxLength={64}
                        placeholder="e.g. Clinic Coordinator"
                        required
                    />
                    <button className="btn role-permissions-save" type="submit" disabled={addingUserType || !newUserType.trim()}>
                        {addingUserType ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                        <span>{addingUserType ? 'Adding...' : 'Create Type'}</span>
                    </button>
                    <button className="btn" type="button" onClick={() => setShowAddUserType(false)} disabled={addingUserType}>
                        Cancel
                    </button>
                    <p>New user types start with all permissions blocked.</p>
                </form>
            )}

            {/* ── Toolbar: Role selector, Search, Category Filter ── */}
            <div className="role-permissions-toolbar">
                <div className="role-toolbar-field role-field-role">
                    <label htmlFor="role-select">
                        <Shield size={14} className="field-icon" />
                        <span>User Role</span>
                    </label>
                    <div className="role-select-wrapper">
                        <select 
                            id="role-select"
                            value={selectedRoleId} 
                            onChange={event => {
                                setSelectedRoleId(event.target.value);
                                setNotice('');
                                setError('');
                            }}
                        >
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>
                                    {roleLabel(role.user_type)}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="select-arrow" />
                    </div>
                </div>

                <div className="role-toolbar-field role-field-search">
                    <label htmlFor="perm-search">
                        <Search size={14} className="field-icon" />
                        <span>Search Permissions</span>
                    </label>
                    <div className="role-search-input-wrapper">
                        <input
                            id="perm-search"
                            type="text"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="Search by action, description, or key..."
                        />
                        {search ? (
                            <button
                                type="button"
                                className="search-clear-btn"
                                onClick={() => setSearch('')}
                                title="Clear search"
                                aria-label="Clear search"
                            >
                                <X size={14} />
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="role-toolbar-field role-field-category">
                    <label htmlFor="category-select">
                        <Filter size={14} className="field-icon" />
                        <span>Category</span>
                    </label>
                    <div className="role-select-wrapper">
                        <select 
                            id="category-select"
                            value={category} 
                            onChange={event => setCategory(event.target.value)}
                        >
                            {availableCategories.map(option => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="select-arrow" />
                    </div>
                </div>
            </div>

            {/* ── Role Status / Info Bar ── */}
            <div className="role-info-bar">
                <div className="role-info-text">
                    <span>
                        Configuring permissions for <strong>{roleLabel(selectedRole?.user_type)}</strong>.
                        {adminAlwaysAllowed ? (
                            <span className="role-admin-pill"> Full Administrative Access Enabled</span>
                        ) : (
                            <span> Blocked permissions are denied by database policies.</span>
                        )}
                    </span>
                </div>

                {!isSearching && orderedGroupEntries.length > 0 && (
                    <div className="role-expand-actions">
                        <button 
                            type="button" 
                            className="btn-toggle-all"
                            onClick={handleExpandAll}
                            title="Expand all categories"
                        >
                            <ChevronsUpDown size={13} />
                            <span>Expand All</span>
                        </button>
                        <span className="action-divider">|</span>
                        <button 
                            type="button" 
                            className="btn-toggle-all"
                            onClick={handleCollapseAll}
                            title="Collapse all categories"
                        >
                            <span>Collapse All</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ── Unsaved Changes Alert ── */}
            {dirtyKeys.length > 0 && (
                <div className="role-unsaved-banner" role="status">
                    <div className="role-unsaved-banner-left">
                        <AlertTriangle size={16} className="unsaved-icon" />
                        <span>
                            You have <strong>{dirtyKeys.length}</strong> unsaved permission change{dirtyKeys.length !== 1 ? 's' : ''} for <strong>{roleLabel(selectedRole?.user_type)}</strong>.
                        </span>
                    </div>
                    <button 
                        type="button" 
                        className="btn-quick-save"
                        onClick={saveChanges}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Now'}
                    </button>
                </div>
            )}

            {/* ── Feedback Messages ── */}
            {error && (
                <div className="role-permissions-message role-permissions-error" role="alert">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}
            {notice && (
                <div className="role-permissions-message role-permissions-success" role="status">
                    <CheckCircle2 size={16} />
                    <span>{notice}</span>
                </div>
            )}

            {/* ── Collapsible Categories Accordion List ── */}
            <div className="role-categories-accordion" role="region" aria-label="Permission Categories">
                {orderedGroupEntries.map(([groupName, permissions]) => {
                    const CategoryIcon = getCategoryIcon(groupName);
                    const expanded = isCategoryExpanded(groupName);
                    const totalCount = permissions.length;
                    const allowedCount = permissions.filter(p => adminAlwaysAllowed || values[p.permission_key] === true).length;
                    
                    const badgeClass = allowedCount === totalCount
                        ? 'badge-all-allowed'
                        : allowedCount === 0
                            ? 'badge-all-blocked'
                            : 'badge-partial';

                    return (
                        <div className={`role-cat-card ${expanded ? 'is-open' : 'is-closed'}`} key={groupName}>
                            {/* Accordion Header */}
                            <button
                                type="button"
                                className="role-cat-header"
                                onClick={() => toggleCategory(groupName)}
                                aria-expanded={expanded}
                                aria-controls={`category-panel-${groupName.replace(/\s+/g, '-').toLowerCase()}`}
                            >
                                <div className="role-cat-header-left">
                                    <div className="role-cat-icon">
                                        <CategoryIcon size={18} />
                                    </div>
                                    <div className="role-cat-title-wrap">
                                        <h3 className="role-cat-name">{groupName}</h3>
                                        <span className="role-cat-sub">
                                            {totalCount} permission{totalCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>

                                <div className="role-cat-header-right">
                                    <span className={`role-cat-badge ${badgeClass}`}>
                                        {allowedCount} of {totalCount} Allowed
                                    </span>
                                    <div className="role-cat-chevron">
                                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>
                            </button>

                            {/* Accordion Content Panel */}
                            {expanded && (
                                <div 
                                    className="role-cat-body" 
                                    id={`category-panel-${groupName.replace(/\s+/g, '-').toLowerCase()}`}
                                >
                                    <div className="role-permissions-list">
                                        {permissions.map(permission => {
                                            const allowed = adminAlwaysAllowed || values[permission.permission_key] === true;
                                            const isKeyVisible = Boolean(visibleKeys[permission.permission_key]);
                                            const isDirty = values[permission.permission_key] !== savedRoleValues[permission.permission_key];

                                            return (
                                                <div 
                                                    className={`role-permission-row ${allowed ? 'is-allowed' : 'is-blocked'} ${isDirty ? 'is-row-dirty' : ''}`} 
                                                    key={permission.permission_key}
                                                >
                                                    <div className="role-permission-info">
                                                        <div className="role-permission-title-line">
                                                            <span className="role-permission-name">
                                                                {permission.label}
                                                            </span>

                                                            {isDirty && (
                                                                <span className="dirty-indicator" title="Unsaved change">
                                                                    Unsaved
                                                                </span>
                                                            )}

                                                            <button
                                                                type="button"
                                                                className={`role-key-toggle-btn ${isKeyVisible ? 'active' : ''}`}
                                                                onClick={() => toggleKeyVisibility(permission.permission_key)}
                                                                title={isKeyVisible ? 'Hide technical key' : 'Show technical key'}
                                                                aria-label={`Toggle technical key for ${permission.label}`}
                                                            >
                                                                <KeyRound size={11} />
                                                                <span>{isKeyVisible ? 'Hide Key' : 'Key'}</span>
                                                            </button>
                                                        </div>

                                                        <p className="role-permission-desc">
                                                            {permission.description}
                                                        </p>

                                                        {isKeyVisible && (
                                                            <div className="role-permission-key-tag">
                                                                <code>{permission.permission_key}</code>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="role-permission-action">
                                                        <button
                                                            type="button"
                                                            role="switch"
                                                            aria-checked={allowed}
                                                            aria-label={`${permission.label}: ${allowed ? 'Allowed' : 'Blocked'}`}
                                                            disabled={adminAlwaysAllowed}
                                                            className={`perm-switch ${allowed ? 'perm-switch--allowed' : 'perm-switch--blocked'}`}
                                                            onClick={() => setPermission(permission.permission_key, !allowed)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === ' ' || e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    if (!adminAlwaysAllowed) {
                                                                        setPermission(permission.permission_key, !allowed);
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <span className="perm-switch-track">
                                                                <span className="perm-switch-thumb">
                                                                    {allowed ? (
                                                                        <Check size={10} strokeWidth={3} />
                                                                    ) : (
                                                                        <X size={10} strokeWidth={3} />
                                                                    )}
                                                                </span>
                                                            </span>
                                                            <span className="perm-switch-label">
                                                                {allowed ? 'Allowed' : 'Blocked'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {orderedGroupEntries.length === 0 && (
                    <div className="role-permissions-empty">
                        <FolderKey size={28} className="empty-icon" />
                        <h4>No matching permissions found</h4>
                        <p>Try adjusting your search query or selecting "All categories".</p>
                        {search && (
                            <button 
                                type="button" 
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSearch('')}
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

export default RolePermissionManagement;
