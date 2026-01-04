'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { type Permission } from '@avocat-ai/shared';
import { usePermission } from './use-permission';

interface RoleGuardProps {
    children: ReactNode;
    permission: Permission;
    fallbackPath?: string;
    showError?: boolean;
}

export function RoleGuard({
    children,
    permission,
    fallbackPath = '/forbidden',
    showError = false
}: RoleGuardProps) {
    const { hasAccess, isLoading } = usePermission(permission);
    const router = useRouter();

    if (isLoading) {
        return null; // Or return a loading spinner if preferred
    }

    if (!hasAccess) {
        if (typeof window !== 'undefined') {
            router.push(fallbackPath);
        }
        return null;
    }

    return <>{children}</>;
}

interface IfCanProps {
    permission: Permission;
    children: ReactNode;
    fallback?: ReactNode;
}

export function IfCan({ permission, children, fallback = null }: IfCanProps) {
    const { hasAccess, isLoading } = usePermission(permission);

    if (isLoading) return null;
    if (!hasAccess) return <>{fallback}</>;

    return <>{children}</>;
}
