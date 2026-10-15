import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Search, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import supabase from '../config/supabaseclient';
import '../styles/components/RolePermissionManagement.css';

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/_/g, ' ');

const roleLabel = (role) => {
    const normalized = normalizeRole(role);
    if (normalized === 'staff') return 'Staff';
    if (normalized === 'cho personnel') return 'CHO Personnel';
    if (normalized === 'patient' || normalized === 'mother') return 'Patient / Mother';
    return normalized.replace(/\b\w/g, character => character.toUpperCase());
};

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

            const supportedRoles = (roleResult.data || []).filter(({ user_type }) =>
                ['admin', 'staff', 'cho personnel', 'patient', 'mother'].includes(normalizeRole(user_type))
            );
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

    const categories = useMemo(
        () => ['All categories', ...new Set(catalog.map(permission => permission.category))],
        [catalog]
    );

    const filteredPermissions = useMemo(() => {
        const query = search.trim().toLowerCase();
        return catalog.filter(permission => {
            const matchesCategory = category === 'All categories' || permission.category === category;
            const matchesSearch = !query
                || permission.label.toLowerCase().includes(query)
                || permission.description.toLowerCase().includes(query)
                || permission.permission_key.toLowerCase().includes(query);
            return matchesCategory && matchesSearch;
        });
    }, [catalog, category, search]);

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
    };

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
        setNotice('Role permissions saved successfully.');
        setSaving(false);
    };

    const groupedPermissions = filteredPermissions.reduce((groups, permission) => {
        groups[permission.category] = groups[permission.category] || [];
        groups[permission.category].push(permission);
        return groups;
    }, {});

    const selectedRole = roles.find(role => role.id === selectedRoleId);
    const adminAlwaysAllowed = normalizeRole(selectedRole?.user_type) === 'admin';

    if (loading) {
        return <div className="role-permissions-state">Loading role permissions...</div>;
    }

    if (error && catalog.length === 0) {
        return (
            <div className="role-permissions-state role-permissions-error" role="alert">
                <AlertCircle size={17} /> {error}
            </div>
        );
    }

    return (
        <section className="role-permissions" aria-labelledby="role-permissions-title">
            <div className="role-permissions-heading">
                <div className="role-permissions-title">
                    <ShieldCheck size={19} />
                    <div>
                        <h2 id="role-permissions-title">Role and Permission Management</h2>
                        <p>Changes are enforced by Supabase and recorded in the permission audit log.</p>
                    </div>
                </div>
                <button
                    className="btn btn-primary role-permissions-save"
                    type="button"
                    onClick={saveChanges}
                    disabled={saving || dirtyKeys.length === 0}
                >
                    <CheckCircle2 size={15} />
                    {saving ? 'Saving...' : `Save changes${dirtyKeys.length ? ` (${dirtyKeys.length})` : ''}`}
                </button>
            </div>

            <div className="role-permissions-controls">
                <label className="role-permissions-field">
                    <span>User type</span>
                    <select value={selectedRoleId} onChange={event => {
                        setSelectedRoleId(event.target.value);
                        setNotice('');
                    }}>
                        {roles.map(role => (
                            <option key={role.id} value={role.id}>{roleLabel(role.user_type)}</option>
                        ))}
                    </select>
                </label>

                <label className="role-permissions-field role-permissions-search">
                    <span>Search permissions</span>
                    <div className="role-permissions-search-input">
                        <Search size={15} aria-hidden="true" />
                        <input
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="Search by action or description"
                        />
                    </div>
                </label>

                <label className="role-permissions-field">
                    <span>Category</span>
                    <select value={category} onChange={event => setCategory(event.target.value)}>
                        {categories.map(option => <option key={option}>{option}</option>)}
                    </select>
                </label>
            </div>

            {selectedRole && (
                <p className="role-permissions-role-note">
                    Permissions for <strong>{roleLabel(selectedRole.user_type)}</strong>. Disabled permissions are denied by the database.
                </p>
            )}

            {error && (
                <div className="role-permissions-message role-permissions-error" role="alert">
                    <AlertCircle size={16} /> {error}
                </div>
            )}
            {notice && (
                <div className="role-permissions-message role-permissions-success" role="status">
                    <CheckCircle2 size={16} /> {notice}
                </div>
            )}

            {Object.entries(groupedPermissions).map(([group, permissions]) => (
                <div className="role-permissions-group" key={group}>
                    <h3>{group}</h3>
                    <div className="role-permissions-list">
                        {permissions.map(permission => {
                            const allowed = adminAlwaysAllowed || values[permission.permission_key] === true;
                            return (
                                <div className={`role-permission-row ${allowed ? '' : 'is-disabled'}`} key={permission.permission_key}>
                                    <div className="role-permission-copy">
                                        <span className="role-permission-label">{permission.label}</span>
                                        <span className="role-permission-description">{permission.description}</span>
                                        <code>{permission.permission_key}</code>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={allowed}
                                        aria-label={`${permission.label}: ${allowed ? 'allowed' : 'blocked'}`}
                                        className={`role-permission-toggle ${allowed ? 'is-on' : ''}`}
                                        disabled={adminAlwaysAllowed}
                                        onClick={() => setPermission(permission.permission_key, !allowed)}
                                    >
                                        {allowed ? <ToggleRight size={31} /> : <ToggleLeft size={31} />}
                                        <span>{allowed ? 'Allowed' : 'Blocked'}</span>
                                    </button>
                                </div>
                            );
                        })}
                        {permissions.length === 0 && <p className="role-permissions-empty">No matching permissions.</p>}
                    </div>
                </div>
            ))}
        </section>
    );
};

export default RolePermissionManagement;
