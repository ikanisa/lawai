'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Case {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  creator: { name: string; email: string };
  assignedUser: { name: string; email: string } | null;
  documents: any[];
  chatSessions: any[];
  _count: {
    documents: number;
    chatSessions: number;
  };
}

export default function CaseDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const caseId = params.caseId as string;
  const [case_, setCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      loadCase();
    }
  }, [session, router, caseId]);

  const loadCase = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`);
      if (response.ok) {
        const data = await response.json();
        setCase(data);
      } else {
        router.push('/cases');
      }
    } catch (error) {
      console.error('Failed to load case:', error);
      router.push('/cases');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!case_) return;
    setLoadingAI(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/summary`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const getSuggestions = async () => {
    if (!case_) return;
    setLoadingAI(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/suggestions`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  if (loading || !case_) {
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
          <Link
            href="/cases"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg mb-2"
          >
            ← Back to Cases
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{case_.title}</h1>
          <div className="flex gap-4 text-sm text-gray-500 mb-4">
            <span>Status: {case_.status.replace('_', ' ')}</span>
            <span>Created by {case_.creator.name}</span>
            {case_.assignedUser && (
              <span>Assigned to {case_.assignedUser.name}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Description</h2>
            <p className="text-gray-700">
              {case_.description || 'No description provided'}
            </p>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={generateSummary}
                disabled={loadingAI}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingAI ? 'Generating...' : 'Generate AI Summary'}
              </button>
              <button
                onClick={getSuggestions}
                disabled={loadingAI}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loadingAI ? 'Loading...' : 'Get AI Suggestions'}
              </button>
              <Link
                href={`/chat?case=${caseId}`}
                className="block w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-center"
              >
                Chat with AI about this case
              </Link>
            </div>
          </div>
        </div>

        {summary && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">AI Summary</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">AI Suggestions</h2>
            <ul className="list-disc list-inside space-y-2">
              {suggestions.map((suggestion, i) => (
                <li key={i} className="text-gray-700">{suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Documents ({case_._count.documents})</h2>
            {case_.documents.length === 0 ? (
              <p className="text-gray-500">No documents yet</p>
            ) : (
              <div className="space-y-2">
                {case_.documents.map((doc) => (
                  <div key={doc.id} className="flex justify-between items-center p-2 border rounded">
                    <span className="text-sm">{doc.filename}</span>
                    <button className="text-sm text-blue-600 hover:text-blue-800">
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Chat Sessions ({case_._count.chatSessions})</h2>
            {case_.chatSessions.length === 0 ? (
              <p className="text-gray-500">No chat sessions yet</p>
            ) : (
              <div className="space-y-2">
                {case_.chatSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/chat?session=${session.id}`}
                    className="block p-2 border rounded hover:bg-gray-50"
                  >
                    <span className="text-sm">{session.title || 'Untitled Chat'}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
