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
    const refreshInFlightRef = useRef(false);
    const lastRefreshAtRef = useRef(0);

    const refresh = useCallback(async (options = {}) => {
        const { force = false, suppressLoading = false } = options;

        if (!user?.id) {
            setPermissions({});
            setError(null);
            setLoading(false);
            loadedUserId.current = null;
            lastRefreshAtRef.current = 0;
            return false;
        }

        const now = Date.now();
        const hasRecentRefresh = !force && now - lastRefreshAtRef.current < 60000 && loadedUserId.current === user.id;

        if (refreshInFlightRef.current && loadedUserId.current === user.id) {
            return false;
        }

        if (hasRecentRefresh) {
            return false;
        }

        if (loadedUserId.current !== user.id) {
            setPermissions({});
            if (!suppressLoading) {
                setLoading(true);
            }
        }

        refreshInFlightRef.current = true;
        setError(null);

        try {
            const { data, error: permissionError } = await supabase.rpc('get_my_permissions');
            if (permissionError) {
                setPermissions({});
                setError(permissionError);
                setLoading(false);
                return false;
            }

            const nextPermissions = Object.fromEntries(
                (data || []).map(row => [row.permission_key, row.is_allowed === true])
            );

            setPermissions(nextPermissions);
            loadedUserId.current = user.id;
            lastRefreshAtRef.current = Date.now();
            setLoading(false);
            return true;
        } catch (permissionError) {
            setPermissions({});
            setError(permissionError);
            setLoading(false);
            return false;
        } finally {
            refreshInFlightRef.current = false;
        }
    }, [user?.id]);

    useEffect(() => {
        let mounted = true;

        const loadPermissions = async () => {
            if (!mounted) return;
            await refresh({ suppressLoading: false });
        };

        const refreshWhenVisible = () => {
            if (!mounted || document.visibilityState !== 'visible') return;
            const now = Date.now();
            if (now - lastRefreshAtRef.current < 60000) return;
            refresh({ suppressLoading: true });
        };

        loadPermissions();
        window.addEventListener('focus', refreshWhenVisible);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            mounted = false;
            window.removeEventListener('focus', refreshWhenVisible);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [user?.id, refresh]);

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
