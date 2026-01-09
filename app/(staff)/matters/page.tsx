'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function MattersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [matters, setMatters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMatter, setNewMatter] = useState({ name: '', description: '', clientName: '' });

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      loadMatters();
    }
  }, [session, router]);

  const loadMatters = async () => {
    try {
      const response = await fetch('/api/matters');
      if (response.ok) {
        const data = await response.json();
        setMatters(data);
      }
    } catch (error) {
      console.error('Failed to load matters:', error);
    } finally {
      setLoading(false);
    }
  };

  const createMatter = async () => {
    try {
      const response = await fetch('/api/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMatter),
      });

      if (response.ok) {
        const matter = await response.json();
        router.push(`/matters/${matter.id}`);
      } else {
        const error = await response.json();
        alert(`Failed to create matter: ${error.error}`);
      }
    } catch (error) {
      console.error('Create matter error:', error);
      alert('Failed to create matter');
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
      <div className="flex-1 overflow-auto p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Matters</h1>
            <Button onClick={() => setShowCreateModal(true)}>New Matter</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matters.map((matter) => (
              <Link key={matter.id} href={`/matters/${matter.id}`}>
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{matter.name}</h3>
                      {matter.clientName && (
                        <p className="text-sm text-gray-500">Client: {matter.clientName}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        matter.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : matter.status === 'ARCHIVED'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {matter.status}
                    </span>
                  </div>

                  {matter.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {matter.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{matter._count?.cases || 0} cases</span>
                    <span>{matter._count?.vaults || 0} vaults</span>
                    <span>{matter._count?.chatSessions || 0} chats</span>
                  </div>

                  {matter.owner && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500">
                        Owner: {matter.owner.name}
                      </p>
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>

          {matters.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No matters yet</p>
              <Button onClick={() => setShowCreateModal(true)}>Create Your First Matter</Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Matter Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Matter</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Matter Name *</label>
                <input
                  type="text"
                  value={newMatter.name}
                  onChange={(e) => setNewMatter({ ...newMatter, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Acme Corp Litigation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client Name</label>
                <input
                  type="text"
                  value={newMatter.clientName}
                  onChange={(e) => setNewMatter({ ...newMatter, clientName: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Client name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newMatter.description}
                  onChange={(e) => setNewMatter({ ...newMatter, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Brief description of the matter"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    createMatter();
                    setShowCreateModal(false);
                  }}
                  disabled={!newMatter.name.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
