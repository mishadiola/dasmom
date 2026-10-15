/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import supabase from '../config/supabaseclient';

const RolePermissionContext = createContext({
    permissions: {},
    loading: true,
    error: null,
    hasPermission: () => false,
    hasAnyPermission: () => false,
    refresh: async () => false,
});

export const RolePermissionProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadedUserId = useRef(null);

    const refresh = useCallback(async () => {
        if (!user?.id) {
            setPermissions({});
            setError(null);
            setLoading(false);
            loadedUserId.current = null;
            return false;
        }

        if (loadedUserId.current !== user.id) {
            setPermissions({});
            setLoading(true);
        }
        setError(null);
        const { data, error: permissionError } = await supabase.rpc('get_my_permissions');
        if (permissionError) {
            setPermissions({});
            setError(permissionError);
            setLoading(false);
            return false;
        }

        setPermissions(Object.fromEntries(
            (data || []).map(row => [row.permission_key, row.is_allowed === true])
        ));
        loadedUserId.current = user.id;
        setLoading(false);
        return true;
    }, [user?.id]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!mounted) return;
            await refresh();
        };
        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') load();
        };

        load();
        window.addEventListener('focus', refreshWhenVisible);
        document.addEventListener('visibilitychange', refreshWhenVisible);
        const interval = window.setInterval(load, 60_000);

        return () => {
            mounted = false;
            window.removeEventListener('focus', refreshWhenVisible);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
            window.clearInterval(interval);
        };
    }, [refresh]);

    const value = useMemo(() => ({
        permissions,
        loading,
        error,
        refresh,
        hasPermission: permissionKey => !loading && !error && permissions[permissionKey] === true,
        hasAnyPermission: permissionKeys => !loading && !error
            && permissionKeys.some(permissionKey => permissions[permissionKey] === true),
    }), [permissions, loading, error, refresh]);

    return (
        <RolePermissionContext.Provider value={value}>
            {children}
        </RolePermissionContext.Provider>
    );
};

export const useRolePermissions = () => useContext(RolePermissionContext);

export const PermissionBoundary = ({ permission, anyOf, children, fallback }) => {
    const { loading, error, hasPermission, hasAnyPermission } = useRolePermissions();
    const allowed = permission
        ? hasPermission(permission)
        : hasAnyPermission(anyOf || []);

    if (loading) {
        return <div className="permission-boundary-message">Checking access...</div>;
    }

    if (!allowed) {
        return fallback || (
            <div className="permission-boundary-message" role="alert">
                {error
                    ? 'Permissions could not be verified. Access is blocked until the permission service is available.'
                    : 'You do not have permission to access this action.'}
            </div>
        );
    }

    return children;
};
