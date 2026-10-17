/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import supabase from '../config/supabaseclient';
import StaffPageLoader from '../components/Common/StaffPageLoader';

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
        const isLegacyBoolean = typeof options === 'boolean';
        const force = !isLegacyBoolean && !!options?.force;
        const suppressLoading = isLegacyBoolean ? options : !!options?.suppressLoading;

        if (!user?.id) {
            loadedUserId.current = null;
            lastRefreshAtRef.current = 0;
            setPermissions({});
            setError(null);
            setLoading(false);
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

        const isUserChanged = loadedUserId.current !== user.id;
        if (isUserChanged) {
            setPermissions({});
            if (!suppressLoading) {
                setLoading(true);
            }
        } else if (!suppressLoading && !loadedUserId.current) {
            setLoading(true);
        }

        refreshInFlightRef.current = true;
        setError(null);

        try {
            const { data, error: permissionError } = await supabase.rpc('get_my_permissions');
            if (permissionError) {
                console.warn('RolePermissionContext: get_my_permissions error:', permissionError);
                if (loadedUserId.current !== user.id) {
                    setPermissions({});
                    setError(permissionError);
                }
                setLoading(false);
                return false;
            }

            const nextPermissions = Object.fromEntries(
                (data || []).map(row => [row.permission_key, row.is_allowed === true])
            );

            setPermissions(nextPermissions);
            loadedUserId.current = user.id;
            lastRefreshAtRef.current = Date.now();
            setError(null);
            setLoading(false);
            return true;
        } catch (err) {
            console.warn('RolePermissionContext: permission check failed:', err);
            if (loadedUserId.current !== user.id) {
                setError(err);
            }
            return false;
        } finally {
            refreshInFlightRef.current = false;
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        let mounted = true;

        const loadPermissions = async () => {
            if (!mounted) return;
            await refresh({ suppressLoading: loadedUserId.current === user?.id });
        };

        const refreshWhenVisible = () => {
            if (!mounted || document.visibilityState !== 'visible') return;
            const now = Date.now();
            if (now - lastRefreshAtRef.current < 60000) return;
            refresh({ suppressLoading: true });
        };

        const refreshWhenFocused = () => {
            if (!mounted) return;
            const now = Date.now();
            if (now - lastRefreshAtRef.current < 60000) return;
            refresh({ suppressLoading: true });
        };

        loadPermissions();
        window.addEventListener('focus', refreshWhenFocused);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            mounted = false;
            window.removeEventListener('focus', refreshWhenFocused);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [user?.id, refresh]);

    const value = useMemo(() => ({
        permissions,
        loading,
        error,
        refresh,
        hasPermission: permissionKey => {
            if (user?.role?.toLowerCase() === 'admin') return true;
            return !loading && !error && permissions[permissionKey] === true;
        },
        hasAnyPermission: permissionKeys => {
            if (user?.role?.toLowerCase() === 'admin') return true;
            return !loading && !error
                && (permissionKeys || []).some(permissionKey => permissions[permissionKey] === true);
        },
    }), [permissions, loading, error, refresh, user?.role]);

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
        return <StaffPageLoader message="Verifying permissions..." minHeight="60vh" />;
    }

    if (!allowed) {
        return fallback || (
            <StaffPageLoader 
                error={error ? 'Permissions could not be verified. Access is blocked until the permission service is available.' : 'You do not have permission to access this action.'} 
                minHeight="60vh" 
            />
        );
    }

    return children;
};
