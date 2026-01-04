import { RoleGuard } from '@avocat-ai/auth';
import type { ReactNode } from 'react';

export default function StaffLayout({ children }: { children: ReactNode }) {
    return (
        <RoleGuard permission="hitl:view">
            <div className="flex h-screen flex-col bg-gray-50">
                <header className="border-b bg-white px-6 py-4 shadow-sm">
                    <h1 className="text-lg font-semibold text-gray-800">Staff Portal (HITL)</h1>
                </header>
                <main className="flex-1 overflow-auto p-6">{children}</main>
            </div>
        </RoleGuard>
    );
}
