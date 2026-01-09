'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function MatterDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const matterId = params.matterId as string;

  const [matter, setMatter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'vaults' | 'timeline' | 'team'>('overview');

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      loadMatter();
    }
  }, [session, router, matterId]);

  const loadMatter = async () => {
    try {
      const response = await fetch(`/api/matters/${matterId}`);
      if (response.ok) {
        const data = await response.json();
        setMatter(data);
      } else {
        router.push('/matters');
      }
    } catch (error) {
      console.error('Failed to load matter:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!matter) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Matter not found</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'cases', label: `Cases (${matter.cases?.length || 0})` },
    { id: 'vaults', label: `Vaults (${matter.vaults?.length || 0})` },
    { id: 'timeline', label: 'Timeline' },
    { id: 'team', label: 'Team' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Matter Header */}
      <div className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{matter.name}</h1>
            {matter.clientName && (
              <p className="text-gray-600 mt-1">Client: {matter.clientName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-3 py-1 rounded ${
                matter.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-700'
                  : matter.status === 'ARCHIVED'
                  ? 'bg-gray-100 text-gray-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {matter.status}
            </span>
            <Button variant="outline" size="sm">
              Share with Client
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Matter Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Description</h2>
                  <p className="text-gray-600">
                    {matter.description || 'No description provided.'}
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Recent Cases</h2>
                  {matter.cases && matter.cases.length > 0 ? (
                    <div className="space-y-3">
                      {matter.cases.slice(0, 5).map((case_: any) => (
                        <Link
                          key={case_.id}
                          href={`/cases/${case_.id}`}
                          className="block p-3 border rounded hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{case_.title}</h3>
                              {case_.caseNumber && (
                                <p className="text-sm text-gray-500">#{case_.caseNumber}</p>
                              )}
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                case_.status === 'closed'
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {case_.status}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No cases yet</p>
                  )}
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cases</span>
                      <span className="font-medium">{matter._count?.cases || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vaults</span>
                      <span className="font-medium">{matter._count?.vaults || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Chat Sessions</span>
                      <span className="font-medium">{matter._count?.chatSessions || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Workflows</span>
                      <span className="font-medium">{matter._count?.workflowExecutions || 0}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Team Members</h3>
                  {matter.teamMembers && matter.teamMembers.length > 0 ? (
                    <div className="space-y-2">
                      {matter.teamMembers.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between">
                          <span className="text-sm">{member.user.name}</span>
                          <span className="text-xs text-gray-500">{member.role || 'member'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No team members</p>
                  )}
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'cases' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Cases</h2>
                <Button>New Case</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matter.cases?.map((case_: any) => (
                  <Card key={case_.id} className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{case_.title}</h3>
                        {case_.caseNumber && (
                          <p className="text-sm text-gray-500">#{case_.caseNumber}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          case_.status === 'closed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {case_.status}
                      </span>
                    </div>
                    {case_.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {case_.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{case_._count?.documents || 0} documents</span>
                      <Link href={`/cases/${case_.id}`} className="text-blue-600 hover:underline">
                        View →
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'vaults' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Vaults</h2>
                <Button>New Vault</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matter.vaults?.map((vault: any) => (
                  <Link key={vault.id} href={`/vaults/${vault.id}`}>
                    <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{vault.name}</h3>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                            {vault.vaultType}
                          </span>
                        </div>
                      </div>
                      {vault.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {vault.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{vault._count?.documents || 0} documents</span>
                        <span className="text-blue-600">View →</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Team Members</h2>
              <Card className="p-6">
                <div className="space-y-4">
                  {matter.teamMembers?.map((member: any) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <p className="font-medium">{member.user.name}</p>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {member.role || 'member'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
