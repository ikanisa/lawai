'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DashboardMetrics {
  totalUsers: number;
  activeSessions: number;
  totalQueries: number;
  recentActivity: any[];
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session && session.user.role !== 'ADMIN') {
      router.push('/chat');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user.role === 'ADMIN') {
      loadMetrics();
    }
  }, [session]);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/admin/dashboard');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-neutral-50 p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-6">LawAI Admin</h1>
        
        <nav className="flex-1 space-y-2">
          <Link
            href="/dashboard"
            className="block px-4 py-2 bg-blue-100 text-blue-700 rounded-lg"
          >
            Dashboard
          </Link>
          <Link
            href="/users"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Users
          </Link>
          <Link
            href="/logs"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Audit Logs
          </Link>
          <Link
            href="/settings"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Settings
          </Link>
        </nav>

        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2">{session.user?.email}</p>
          <button
            onClick={() => signOut()}
            className="w-full px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <h2 className="text-3xl font-bold mb-8">Admin Dashboard</h2>

        {metrics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Users</h3>
                <p className="text-3xl font-bold">{metrics.totalUsers}</p>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Active Sessions (24h)</h3>
                <p className="text-3xl font-bold">{metrics.activeSessions}</p>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Queries</h3>
                <p className="text-3xl font-bold">{metrics.totalQueries}</p>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">System Status</h3>
                <p className="text-3xl font-bold text-green-600">Healthy</p>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {metrics.recentActivity.slice(0, 10).map((activity: any) => (
                  <div key={activity.id} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium">{activity.action}</p>
                      <p className="text-sm text-gray-500">
                        {activity.user?.name || 'System'} • {activity.resourceType}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
