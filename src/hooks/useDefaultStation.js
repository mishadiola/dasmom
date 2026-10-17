import { useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useRolePermissions } from '../context/RolePermissionContext';

export const normalizeRole = (role) => {
    return String(role || '').toLowerCase().replace(/_/g, ' ').trim();
};

export const isAdminRole = (role) => {
    const r = normalizeRole(role);
    return r === 'admin' || r === 'super admin';
};

export const isChoRole = (role) => {
    const r = normalizeRole(role);
    return r === 'cho personnel' || r === 'cho';
};

export const isStationStaffUser = (user) => {
    if (!user) return false;
    if (isAdminRole(user?.role)) return false;
    if (isChoRole(user?.role)) return false;
    return true;
};

/**
 * Custom hook to enforce default assigned station behavior across Staff pages.
 * 
 * - Station Staff: defaults to their assigned station.
 * - Admin & CHO Personnel: defaults to 'All' (or [] for multi-select).
 * - Cross-station viewing: enabled if permitted by Admin; preserves manual user selection.
 * - Unauthorized exposure prevented: unassigned Station Staff cannot view other stations.
 */
export const useDefaultStation = ({
    permissionKey = null,
    allStations = [],
    isArray = false,
} = {}) => {
    const { user } = useContext(AuthContext);
    const { hasPermission, hasAnyPermission, loading: permissionsLoading } = useRolePermissions();

    const isStationStaff = isStationStaffUser(user);
    const assignedStation = (user?.station || '').trim();
    const assignedStationId = user?.stationId || null;

    // Check if user is allowed to view data from other stations
    const canViewOtherStations = useMemo(() => {
        if (!isStationStaff) return true; // Admin and CHO Personnel always have citywide access
        if (permissionsLoading) return false;
        if (!permissionKey) return false;
        if (Array.isArray(permissionKey)) {
            return hasAnyPermission(permissionKey);
        }
        return hasPermission(permissionKey);
    }, [isStationStaff, permissionsLoading, permissionKey, hasPermission, hasAnyPermission]);

    // Initial default value
    const getDefaultValue = useCallback(() => {
        if (isStationStaff) {
            if (isArray) {
                return assignedStation ? [assignedStation] : ['__UNASSIGNED__'];
            }
            return assignedStation || '__UNASSIGNED__';
        }
        return isArray ? [] : 'All';
    }, [isStationStaff, isArray, assignedStation]);

    const [selectedStation, setSelectedStationState] = useState(() => getDefaultValue());
    const userHasManuallyChangedRef = useRef(false);

    // If profile or station loads after initial mount, sync if user hasn't made a manual change
    useEffect(() => {
        if (!userHasManuallyChangedRef.current && isStationStaff && assignedStation) {
            setSelectedStationState(prev => {
                if (isArray) {
                    if (Array.isArray(prev) && prev.length === 1 && prev[0] === assignedStation) return prev;
                    return [assignedStation];
                }
                return prev === assignedStation ? prev : assignedStation;
            });
        }
    }, [isStationStaff, assignedStation, isArray]);

    // Setter that tracks manual change
    const setSelectedStation = useCallback((valOrUpdater) => {
        userHasManuallyChangedRef.current = true;
        setSelectedStationState(valOrUpdater);
    }, []);

    // Filtered available stations based on permissions
    const availableStations = useMemo(() => {
        const uniqueStations = Array.from(new Set(allStations.filter(Boolean)));
        if (!isStationStaff || canViewOtherStations) {
            return uniqueStations;
        }
        // Restricted station staff: only their assigned station is selectable
        if (assignedStation) {
            const found = uniqueStations.find(s => s.trim().toLowerCase() === assignedStation.toLowerCase());
            return [found || assignedStation];
        }
        return [];
    }, [allStations, isStationStaff, canViewOtherStations, assignedStation]);

    // Station match tester
    const matchStation = useCallback((recordStation, stationFilter) => {
        const activeFilter = stationFilter !== undefined ? stationFilter : selectedStation;
        const record = (recordStation || '').trim().toLowerCase();

        // If station staff has no permission to view other stations, enforce assigned station strictly
        if (isStationStaff && !canViewOtherStations) {
            if (!assignedStation) return false; // unassigned staff sees no records
            return record === assignedStation.toLowerCase();
        }

        // Permitted user (or Admin/CHO)
        if (isArray) {
            const arr = Array.isArray(activeFilter) ? activeFilter : [];
            if (arr.length === 0) return true; // All stations
            return arr.some(s => s.trim().toLowerCase() === record);
        }

        if (!activeFilter || activeFilter === 'All' || activeFilter === 'all') {
            return true;
        }

        return record === String(activeFilter).trim().toLowerCase();
    }, [isStationStaff, canViewOtherStations, assignedStation, selectedStation, isArray]);

    return {
        user,
        isStationStaff,
        assignedStation,
        assignedStationId,
        canViewOtherStations,
        selectedStation,
        setSelectedStation,
        availableStations,
        matchStation,
        getDefaultValue,
        userHasManuallyChanged: userHasManuallyChangedRef.current,
    };
};

export default useDefaultStation;
