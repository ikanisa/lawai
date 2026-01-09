'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
}

export default function HistoryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.push('/login');
    } else {
      loadSessions();
    }
  }, [session, router]);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
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
            href="/documents"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg mb-2"
          >
            Documents
          </Link>
          <Link
            href="/history"
            className="block px-4 py-2 bg-blue-100 text-blue-700 rounded-lg"
          >
            History
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <h2 className="text-3xl font-bold mb-8">Query History</h2>

        {sessions.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <p className="text-gray-500">No chat history yet</p>
            <Link
              href="/chat"
              className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Start a New Chat
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white border rounded-lg p-6 flex justify-between items-center"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">
                    {session.title || 'Untitled Chat'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-1">
                    {session._count.messages} messages
                  </p>
                  <p className="text-xs text-gray-400">
                    Last updated: {new Date(session.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/chat?session=${session.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
