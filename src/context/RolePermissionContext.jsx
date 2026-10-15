/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
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
    const hasLoadedRef = useRef(false);
    const lastUserIdRef = useRef(null);

    const refresh = useCallback(async (isSilent = false) => {
        if (!user?.id) {
            hasLoadedRef.current = false;
            lastUserIdRef.current = null;
            setPermissions({});
            setError(null);
            setLoading(false);
            return false;
        }

        // Only show full loading state on initial load or user change
        const isUserChanged = lastUserIdRef.current !== user.id;
        if (isUserChanged || !hasLoadedRef.current) {
            lastUserIdRef.current = user.id;
            if (!isSilent) {
                setLoading(true);
            }
        }

        setError(null);
        try {
            const { data, error: permissionError } = await supabase.rpc('get_my_permissions');
            if (permissionError) {
                console.warn('RolePermissionContext: get_my_permissions error:', permissionError);
                if (!hasLoadedRef.current) {
                    setPermissions({});
                    setError(permissionError);
                }
                setLoading(false);
                return false;
            }

            setPermissions(Object.fromEntries(
                (data || []).map(row => [row.permission_key, row.is_allowed === true])
            ));
            hasLoadedRef.current = true;
            setError(null);
            return true;
        } catch (err) {
            console.warn('RolePermissionContext: permission check failed:', err);
            if (!hasLoadedRef.current) {
                setError(err);
            }
            return false;
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        let mounted = true;
        const load = async (silent = false) => {
            if (!mounted) return;
            await refresh(silent);
        };
        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') load(true);
        };
        const refreshWhenFocused = () => {
            load(true);
        };

        // Initial load for this user
        load(hasLoadedRef.current);
        window.addEventListener('focus', refreshWhenFocused);
        document.addEventListener('visibilitychange', refreshWhenVisible);
        const interval = window.setInterval(() => load(true), 60_000);

        return () => {
            mounted = false;
            window.removeEventListener('focus', refreshWhenFocused);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
            window.clearInterval(interval);
        };
    }, [refresh]);

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
