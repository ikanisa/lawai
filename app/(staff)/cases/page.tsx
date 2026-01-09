'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Case {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  creator: { name: string; email: string };
  assignedUser: { name: string; email: string } | null;
  _count: {
    documents: number;
    chatSessions: number;
  };
}

export default function CasesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open' as 'open' | 'in_progress' | 'closed',
  });

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      loadCases();
    }
  }, [session, router]);

  const loadCases = async () => {
    try {
      const response = await fetch('/api/cases');
      if (response.ok) {
        const data = await response.json();
        setCases(data);
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowCreateForm(false);
        setFormData({ title: '', description: '', status: 'open' });
        loadCases();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create case');
      }
    } catch (error) {
      console.error('Failed to create case:', error);
      alert('Failed to create case');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700';
      case 'closed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-neutral-50 p-4 flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Navigation</h2>
          <Link
            href="/chat"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg mb-2"
          >
            Chat
          </Link>
          <Link
            href="/cases"
            className="block px-4 py-2 bg-blue-100 text-blue-700 rounded-lg mb-2"
          >
            Cases
          </Link>
          <Link
            href="/documents"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg mb-2"
          >
            Documents
          </Link>
          <Link
            href="/history"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            History
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Cases</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            New Case
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Create New Case</h3>
            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {cases.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <p className="text-gray-500 mb-4">No cases yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Your First Case
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cases.map((case_) => (
              <Link
                key={case_.id}
                href={`/cases/${case_.id}`}
                className="block bg-white border rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold">{case_.title}</h3>
                  <span
                    className={`px-3 py-1 text-xs rounded-full ${getStatusColor(case_.status)}`}
                  >
                    {case_.status.replace('_', ' ')}
                  </span>
                </div>
                {case_.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {case_.description}
                  </p>
                )}
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>{case_._count.documents} documents</span>
                  <span>{case_._count.chatSessions} chats</span>
                  <span>Created by {case_.creator.name}</span>
                  {case_.assignedUser && (
                    <span>Assigned to {case_.assignedUser.name}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
