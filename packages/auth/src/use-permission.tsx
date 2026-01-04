'use client';

import { useCallback, useMemo } from 'react';
import { hasPermission, type Permission, type UserRole } from '@avocat-ai/shared';
import { useSession } from './session-provider.js';

export interface UsePermissionResult {
    hasAccess: boolean;
    role: UserRole | null;
    isLoading: boolean;
    can: (permission: Permission) => boolean;
}

/**
 * Hook to check permissions for the current user
 */
export function usePermission(permission?: Permission): UsePermissionResult {
    const { session, status } = useSession();

    const role: UserRole | null = useMemo(() => {
        if (!session?.user) return null;
        // Check user_metadata first, then app_metadata, default to viewer if undefined but user exists
        return (session.user.user_metadata?.role as UserRole) ||
            (session.user.app_metadata?.role as UserRole) ||
            'viewer';
    }, [session]);

    const can = useCallback(
        (perm: Permission) => {
            if (!role) return false;
            return hasPermission(role, perm);
        },
        [role],
    );

    const hasAccess = useMemo(() => {
        if (!permission) return true; // No permission required
        if (!role) return false;
        return hasPermission(role, permission);
    }, [permission, role]);

    const isLoading = status === 'loading';

    return {
        hasAccess,
        role,
        isLoading,
        can,
    };
}

/**
 * Hook to check if user has a specific role or higher
 */
export function useRole() {
    const { session, status } = useSession();

    const role: UserRole | null = useMemo(() => {
        if (!session?.user) return null;
        return (session.user.user_metadata?.role as UserRole) ||
            (session.user.app_metadata?.role as UserRole) ||
            'viewer';
    }, [session]);

    return {
        role,
        isLoading: status === 'loading',
    };
}
